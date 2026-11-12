import { Capacitor } from '@capacitor/core';

/**
 * Cloud sync.
 *
 * The phone's own storage stays the working copy (the app has to work in a gym
 * with no signal). This module keeps it in step with a master copy on the
 * server, one record at a time:
 *
 *   kind        id            data
 *   session     session.id    a logged workout
 *   template    template.id   a template, without its `current` flag
 *   exercise    exercise.id   a library entry
 *   settings    'settings'    the settings object
 *   state       'current'     { templateId } — which template is current
 *
 * Conflict rule: last write wins, per record, by the time the change was made
 * on the device. Deletions travel as tombstones. Changes that predate the first
 * sync after signing in are stamped 0 ("unknown, old"), so on a second device
 * the server's copy wins for anything both sides already have and everything
 * else is merged in — the first sync never overwrites the cloud.
 *
 * Everything here is pure or a thin fetch wrapper; the root component owns the
 * state and decides when to sync.
 */

// The iOS app runs from capacitor://localhost, so it needs the real address.
// The web app talks to whichever site served it.
export const SYNC_SITE = 'https://gymloggr.netlify.app';

function apiBase() {
  return Capacitor.isNativePlatform() ? SYNC_SITE : '';
}

export const KINDS = ['session', 'template', 'exercise', 'settings', 'state'];
const SINGLETONS = { settings: true, state: true };

export const EMPTY_SYNC = { token: null, user: null, lastRev: 0, shadow: {}, pending: {}, everSynced: false, lastSyncAt: null };

/** JSON with sorted keys, so two equal objects always produce the same string. */
export function stableStringify(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (typeof v === 'object') {
    const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  return 'null';
}

function fnv(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function hashOf(v) {
  const s = stableStringify(v);
  return fnv(s, 2166136261) + fnv(s, 3339675911) + s.length.toString(36);
}

/** The app's four collections as { kind: { id: data } }. */
export function toRecords(local) {
  const out = { session: {}, template: {}, exercise: {}, settings: {}, state: {} };
  (local.sessions || []).forEach((s) => { if (s && s.id) out.session[s.id] = s; });
  (local.templates || []).forEach((t) => {
    if (!t || !t.id) return;
    const copy = { ...t };
    delete copy.current;
    out.template[t.id] = copy;
  });
  (local.library || []).forEach((e) => { if (e && e.id) out.exercise[e.id] = e; });
  if (local.settings) out.settings.settings = local.settings;
  const cur = (local.templates || []).find((t) => t && t.current);
  if (cur) out.state.current = { templateId: cur.id };
  return out;
}

export function hashRecords(records) {
  const out = {};
  KINDS.forEach((kind) => {
    out[kind] = {};
    Object.keys(records[kind] || {}).forEach((id) => { out[kind][id] = hashOf(records[kind][id]); });
  });
  return out;
}

/**
 * What differs from the last state the server is known to have.
 * Returns { kind: { id: { h, t } } } — h is the content hash (null = deleted),
 * t is when the change was first seen (0 = before the first sync).
 */
export function updatePending(hashes, shadow, pending, everSynced, now) {
  const next = {};
  KINDS.forEach((kind) => {
    const cur = hashes[kind] || {};
    const sh = (shadow && shadow[kind]) || {};
    const pe = (pending && pending[kind]) || {};
    const out = {};
    Object.keys(cur).forEach((id) => {
      if (cur[id] === sh[id]) return;
      const prev = pe[id];
      out[id] = prev ? (prev.h === cur[id] ? prev : { h: cur[id], t: now }) : { h: cur[id], t: everSynced ? now : 0 };
    });
    if (!SINGLETONS[kind]) {
      Object.keys(sh).forEach((id) => {
        if (id in cur) return;
        const prev = pe[id];
        out[id] = prev && prev.h === null ? prev : { h: null, t: now };
      });
    }
    if (Object.keys(out).length) next[kind] = out;
  });
  return next;
}

export function countPending(pending) {
  let n = 0;
  Object.keys(pending || {}).forEach((kind) => { n += Object.keys(pending[kind] || {}).length; });
  return n;
}

/**
 * Merge records from the server into the local collections.
 * `normalizeSettings` is the app's own settings validator. Returns the new
 * collections plus which of them actually changed.
 */
export function applyRemoteRecords(local, records, normalizeSettings) {
  let sessions = local.sessions;
  let templates = local.templates;
  let library = local.library;
  let settings = local.settings;
  const changed = { sessions: false, templates: false, library: false, settings: false };
  let wantCurrent = null;

  const upsert = (list, item) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i < 0) return [...list, item];
    const copy = list.slice();
    copy[i] = item;
    return copy;
  };

  records.forEach((r) => {
    if (!r || !r.kind || typeof r.id !== 'string') return;
    const data = r.data;
    const valid = !r.deleted && data && typeof data === 'object';
    if (r.kind === 'session') {
      if (r.deleted) sessions = sessions.filter((s) => s.id !== r.id);
      else if (valid && Array.isArray(data.exercises)) sessions = upsert(sessions, { ...data, id: r.id });
      else return;
      changed.sessions = true;
    } else if (r.kind === 'template') {
      if (r.deleted) {
        templates = templates.filter((t) => t.id !== r.id);
      } else if (valid && data.days && typeof data.days === 'object') {
        const existing = templates.find((t) => t.id === r.id);
        const days = data.days;
        templates = upsert(templates, {
          ...data,
          id: r.id,
          dayOrder: Array.isArray(data.dayOrder) ? data.dayOrder.filter((k) => days[k]) : Object.keys(days),
          current: !!(existing && existing.current),
        });
      } else return;
      changed.templates = true;
    } else if (r.kind === 'exercise') {
      if (r.deleted) library = library.filter((e) => e.id !== r.id);
      else if (valid && typeof data.name === 'string') library = upsert(library, { ...data, id: r.id });
      else return;
      changed.library = true;
    } else if (r.kind === 'settings') {
      if (valid) {
        settings = normalizeSettings ? normalizeSettings(data) : data;
        changed.settings = true;
      }
    } else if (r.kind === 'state' && r.id === 'current') {
      if (valid && data.templateId) wantCurrent = data.templateId;
    }
  });

  if (changed.sessions) sessions = sessions.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  // Exactly one current template: the one the server names if it exists here,
  // otherwise whatever was current, otherwise the first.
  if (templates.length) {
    const curNow = templates.find((t) => t.current);
    let target = curNow ? curNow.id : null;
    if (wantCurrent && templates.some((t) => t.id === wantCurrent)) target = wantCurrent;
    if (!target) target = templates[0].id;
    if (templates.filter((t) => t.current).length !== 1 || !curNow || curNow.id !== target) {
      templates = templates.map((t) => ({ ...t, current: t.id === target }));
      changed.templates = true;
    }
  }

  return { next: { sessions, templates, library, settings }, changed };
}

/* ---------- API ---------- */

async function call(path, body, token) {
  let res;
  try {
    res = await fetch(apiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {}),
    });
  } catch (e) {
    const err = new Error('No connection');
    err.offline = true;
    throw err;
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // non-JSON response (e.g. the host's own error page)
  }
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Request failed (' + res.status + ')');
    err.status = res.status;
    err.code = data && data.error;
    throw err;
  }
  return data || {};
}

export const syncApi = {
  requestCode: (email) => call('/api/auth/request', { email }),
  verifyCode: (email, code) => call('/api/auth/verify', { email, code }),
  signOut: (token) => call('/api/auth/signout', {}, token),
  deleteAccount: (token) => call('/api/account/delete', {}, token),
  sync: (token, body) => call('/api/sync', body, token),
};
