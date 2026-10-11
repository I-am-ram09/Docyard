const { Pool } = require("pg");

const useSsl = String(process.env.DATABASE_SSL ?? "true").toLowerCase() !== "false";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on("error", (err) => console.error("[db] Unexpected pool error:", err.message));

const many = async (text, params = []) => (await pool.query(text, params)).rows;
const one = async (text, params = []) => (await pool.query(text, params)).rows[0] || null;
const run = (text, params = []) => pool.query(text, params);

// Creates tables on first start. Safe to run every time.
async function init() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      google_id TEXT,
      avatar_url TEXT,
      lang TEXT NOT NULL DEFAULT 'en',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      credentials TEXT,
      original_filename TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      expiry_date TEXT,
      share_token TEXT,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_id) WHERE google_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_docs_share ON documents(share_token);
  `);

  // --- v3 upgrade: clusters/categories, password lock, collaborative documents -------------------
  // Every statement is idempotent, so it is safe on every start and on your existing data.
  await run(`
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS cluster TEXT NOT NULL DEFAULT 'other';
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS lock_hash TEXT;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'file';
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS collab_state BYTEA;
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE documents ALTER COLUMN storage_key DROP NOT NULL;
    ALTER TABLE documents ALTER COLUMN original_filename DROP NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_docs_cluster ON documents(user_id, cluster);

    CREATE TABLE IF NOT EXISTS doc_invites (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'editor',
      label TEXT,
      expires_at TIMESTAMPTZ,
      revoked BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS doc_activity (
      id BIGSERIAL PRIMARY KEY,
      doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      role TEXT,
      action TEXT NOT NULL,
      at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_activity_doc ON doc_activity(doc_id, at DESC);
  `);
}

module.exports = { pool, many, one, run, init };
