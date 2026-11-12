import type { Config, Context } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Yawl sync API. One function, routed by path:
 *
 *   POST /api/auth/request   { email }            -> emails a 6-digit code
 *   POST /api/auth/verify    { email, code }      -> { token, user }
 *   POST /api/auth/signout   (Bearer)             -> forget this device's token
 *   POST /api/account/delete (Bearer)             -> delete the account and all its data
 *   POST /api/sync           (Bearer) { since, changes } -> { rev, records, more, accepted, rejected }
 *
 * Environment variables (scope must include Functions; redeploy after changing):
 *   RESEND_API_KEY        required to send sign-in emails (https://resend.com)
 *   YAWL_EMAIL_FROM       optional sender, default "Yawl <onboarding@resend.dev>"
 *   YAWL_ALLOWED_EMAILS   optional comma-separated list; if set, only these can sign in
 *   YAWL_DEV_ECHO_CODES   "1" returns the code in the response instead of emailing it.
 *                         FOR A TEST SITE ONLY — it makes sign-in public. Never set it in production.
 */

const KINDS = new Set(["session", "template", "exercise", "settings", "state"]);
const PAGE = 500;

// Auth is a bearer token, never a cookie, and the iOS app calls from capacitor://localhost,
// so any origin may call. Without the token there is nothing to read.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function env(key: string): string | undefined {
  const n = (globalThis as any).Netlify;
  return (n && n.env && n.env.get(key)) || process.env[key] || undefined;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS } });
}

function fail(status: number, error: string, message: string) {
  return json(status, { error, message });
}

let pool: any = null;
function db() {
  if (!pool) pool = getDatabase().pool;
  return pool;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const hashCode = (email: string, code: string) => sha("yawl-code:" + email + ":" + code);

function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function normEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

async function requestCode(body: any) {
  const email = normEmail(body.email);
  if (!email) return fail(400, "bad_email", "Enter a valid email address.");

  const allowed = (env("YAWL_ALLOWED_EMAILS") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(email)) return fail(403, "not_allowed", "This email is not allowed to sign in here.");

  const recent = await db().query("SELECT count(*)::int AS n FROM login_codes WHERE email = $1 AND created_at > now() - interval '15 minutes'", [email]);
  if (recent.rows[0].n >= 3) return fail(429, "too_many", "Too many codes requested. Wait a few minutes and try again.");
  const flood = await db().query("SELECT count(*)::int AS n FROM login_codes WHERE created_at > now() - interval '1 hour'");
  if (flood.rows[0].n >= 40) return fail(429, "too_many", "Sign-in is busy. Try again later.");

  const echo = env("YAWL_DEV_ECHO_CODES") === "1";
  const key = env("RESEND_API_KEY");
  if (!echo && !key) return fail(503, "email_not_configured", "Sign-in email is not set up on the server yet.");

  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  await db().query("INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')", [email, hashCode(email, code)]);

  if (echo) return json(200, { ok: true, devCode: code });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("YAWL_EMAIL_FROM") || "Yawl <onboarding@resend.dev>",
      to: [email],
      subject: "Your Yawl sign-in code: " + code,
      text: "Your Yawl sign-in code is " + code + "\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email.",
    }),
  });
  if (!res.ok) {
    console.error("resend failed", res.status, (await res.text()).slice(0, 300));
    return fail(502, "email_failed", "Could not send the sign-in email. Try again in a minute.");
  }
  return json(200, { ok: true });
}

async function verifyCode(body: any) {
  const email = normEmail(body.email);
  const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
  if (!email || code.length !== 6) return fail(400, "bad_code", "Enter the 6-digit code from the email.");

  const found = await db().query(
    "SELECT id, code_hash, attempts FROM login_codes WHERE email = $1 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
    [email],
  );
  const row = found.rows[0];
  if (!row) return fail(400, "expired", "That code has expired. Request a new one.");
  if (row.attempts >= 5) return fail(429, "too_many", "Too many wrong tries. Request a new code.");
  if (!sameHash(row.code_hash, hashCode(email, code))) {
    await db().query("UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    return fail(400, "bad_code", "That code is not right.");
  }

  await db().query("UPDATE login_codes SET used = true WHERE email = $1", [email]);
  await db().query("DELETE FROM login_codes WHERE created_at < now() - interval '1 day'");
  const user = (await db().query("INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id, email", [email])).rows[0];
  const token = randomBytes(32).toString("base64url");
  await db().query("INSERT INTO auth_sessions (token_hash, user_id) VALUES ($1, $2)", [sha(token), user.id]);
  return json(200, { token, user: { id: user.id, email: user.email } });
}

async function authenticate(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const tokenHash = sha(token);
  const found = await db().query(
    "UPDATE auth_sessions s SET last_used_at = now() FROM users u WHERE s.token_hash = $1 AND u.id = s.user_id RETURNING u.id, u.email",
    [tokenHash],
  );
  return found.rows[0] ? { id: found.rows[0].id as string, email: found.rows[0].email as string, tokenHash } : null;
}

function toRecord(r: any) {
  return { kind: r.kind, id: r.id, data: r.deleted ? null : r.data, deleted: r.deleted, updatedAt: Number(r.updated_at), rev: Number(r.rev) };
}

async function sync(user: { id: string }, body: any) {
  const since = Number.isFinite(body.since) ? Math.max(0, Math.floor(body.since)) : 0;
  const changes = Array.isArray(body.changes) ? body.changes : [];
  if (changes.length > 300) return fail(400, "too_many_changes", "Too many changes in one request.");
  for (const c of changes) {
    const ok =
      c && KINDS.has(c.kind) && typeof c.id === "string" && c.id.length > 0 && c.id.length <= 200 &&
      Number.isFinite(c.updatedAt) && c.updatedAt >= 0 &&
      (c.deleted === true || (c.data !== null && typeof c.data === "object" && !Array.isArray(c.data)));
    if (!ok) return fail(400, "bad_change", "A change in the request is malformed.");
  }

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    // One sync at a time per account, so revision numbers are handed out in commit order
    // and a device can never skip past a change that commits a moment later.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1::text))", [user.id]);

    const accepted: { kind: string; id: string }[] = [];
    const rejected: any[] = [];
    for (const c of changes) {
      // Last write wins: the incoming version replaces the stored one only if it is newer.
      const res = await client.query(
        `INSERT INTO records (user_id, kind, id, data, deleted, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)
         ON CONFLICT (user_id, kind, id) DO UPDATE
           SET data = EXCLUDED.data, deleted = EXCLUDED.deleted, updated_at = EXCLUDED.updated_at, rev = nextval('records_rev_seq')
           WHERE EXCLUDED.updated_at > records.updated_at
         RETURNING rev`,
        [user.id, c.kind, c.id, c.deleted === true ? null : JSON.stringify(c.data), c.deleted === true, Math.floor(c.updatedAt)],
      );
      if (res.rowCount) {
        accepted.push({ kind: c.kind, id: c.id });
      } else {
        const cur = await client.query("SELECT kind, id, data, deleted, updated_at, rev FROM records WHERE user_id = $1 AND kind = $2 AND id = $3", [user.id, c.kind, c.id]);
        if (cur.rows[0]) rejected.push(toRecord(cur.rows[0]));
      }
    }

    const page = await client.query(
      "SELECT kind, id, data, deleted, updated_at, rev FROM records WHERE user_id = $1 AND rev > $2 ORDER BY rev LIMIT $3",
      [user.id, since, PAGE + 1],
    );
    const more = page.rows.length > PAGE;
    const rows = more ? page.rows.slice(0, PAGE) : page.rows;
    let rev = since;
    if (more) {
      rev = Number(rows[rows.length - 1].rev);
    } else {
      const top = await client.query("SELECT COALESCE(max(rev), 0) AS rev FROM records WHERE user_id = $1", [user.id]);
      rev = Math.max(since, Number(top.rows[0].rev));
    }
    await client.query("COMMIT");
    return json(200, { rev, records: rows.map(toRecord), more, accepted, rejected });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  let body: any = {};
  try {
    const text = await req.text();
    if (text.length > 4_500_000) return fail(413, "too_large", "That request is too large.");
    if (text) body = JSON.parse(text);
  } catch (e) {
    return fail(400, "bad_json", "The request was not valid JSON.");
  }
  if (!body || typeof body !== "object") body = {};

  try {
    if (path === "/api/auth/request") return await requestCode(body);
    if (path === "/api/auth/verify") return await verifyCode(body);

    const user = await authenticate(req);
    if (!user) return fail(401, "unauthorized", "Sign in again.");

    if (path === "/api/sync") return await sync(user, body);
    if (path === "/api/auth/signout") {
      await db().query("DELETE FROM auth_sessions WHERE token_hash = $1", [user.tokenHash]);
      return json(200, { ok: true });
    }
    if (path === "/api/account/delete") {
      await db().query("DELETE FROM users WHERE id = $1", [user.id]); // cascades to records and sessions
      return json(200, { ok: true });
    }
    return fail(404, "not_found", "No such endpoint.");
  } catch (e) {
    console.error("api error", path, e);
    return fail(500, "server_error", "Something went wrong on the server. Your data on this device is unaffected.");
  }
};

export const config: Config = { path: "/api/*" };
