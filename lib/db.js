// Postgres connection (Neon on Vercel). Tables are created automatically on first use.
import pg from 'pg';

const url =
  process.env.DATABASE_URL ||
  process.env.STORAGE_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_DATABASE_URL;

let pool = null;
let ready = null;

export function hasDatabase() {
  return !!url;
}

function getPool() {
  if (!url) {
    const e = new Error('No database is connected. In Vercel, open Storage and connect the Neon database to this project.');
    e.code = 'no_database';
    throw e;
  }
  if (!pool) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    pool = new pg.Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10000,
      ssl: local ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function ensureSchema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      pw_hash TEXT NOT NULL,
      pw_salt TEXT NOT NULL,
      failed_logins INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS docs (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doc_id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, doc_id)
    );
    CREATE TABLE IF NOT EXISTS ai_usage (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      count INT NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    );
    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      tz TEXT,
      last_quote DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS push_subs_user_idx ON push_subs(user_id);
    CREATE TABLE IF NOT EXISTS friends (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, friend_id)
    );
    CREATE INDEX IF NOT EXISTS friends_friend_idx ON friends(friend_id);
    CREATE TABLE IF NOT EXISTS nudges (
      from_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      PRIMARY KEY (from_id, to_id, day)
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tz TEXT;
  `);
}

export async function query(text, params) {
  const p = getPool();
  if (!ready) ready = ensureSchema().catch(e => { ready = null; throw e; });
  await ready;
  return p.query(text, params);
}
