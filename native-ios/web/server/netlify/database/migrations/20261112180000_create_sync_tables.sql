-- Accounts are just an email address; sign-in is a short-lived emailed code.
CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per code sent. Only a hash of the code is stored.
CREATE TABLE login_codes (
  id         bigserial PRIMARY KEY,
  email      text NOT NULL,
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_codes_email_idx ON login_codes (email, created_at DESC);

-- A signed-in device. Only a hash of its token is stored.
CREATE TABLE auth_sessions (
  token_hash   text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

-- The synced data: one row per record (a workout, a template, an exercise,
-- the settings object, the current-template pointer).
--   updated_at  when the change was made on the device (ms since epoch; 0 = unknown/old)
--   rev         server-side change counter; devices ask for "everything after rev N"
--   deleted     tombstone, so a deletion reaches the other devices
CREATE SEQUENCE records_rev_seq;
CREATE TABLE records (
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       text NOT NULL,
  id         text NOT NULL,
  data       jsonb,
  deleted    boolean NOT NULL DEFAULT false,
  updated_at bigint NOT NULL DEFAULT 0,
  rev        bigint NOT NULL DEFAULT nextval('records_rev_seq'),
  PRIMARY KEY (user_id, kind, id)
);
CREATE INDEX records_user_rev_idx ON records (user_id, rev);
