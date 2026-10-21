/**
 * Postgres access for the persistence layer (production backend).
 *
 * The database is the team's managed Prisma Postgres instance, reached
 * via DATABASE_URL. Everything for this app lives in the dedicated
 * `adaudit` schema so it never touches another product's tables.
 *
 * Backend selection is fail-loud: on Vercel (process.env.VERCEL set) a
 * missing DATABASE_URL throws instead of silently falling back to
 * instance-local storage — that silent fallback is exactly the bug that
 * broke production report links (each serverless instance had its own
 * store file, so a report token minted on one instance did not exist on
 * the next). Locally (no Vercel, no DATABASE_URL) the JSON file backend
 * in lib/store-file.ts is used, as before.
 */

import { Pool, type PoolClient } from "pg";

export function pgEnabled(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

export function storeBackend(): "pg" | "file" {
  if (pgEnabled()) return "pg";
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. Refusing to persist to ephemeral instance-local " +
        "storage on Vercel — audits and report tokens would not survive across " +
        "serverless instances.",
    );
  }
  return "file";
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    if (!pgEnabled()) throw new Error("DATABASE_URL is not set.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return pool;
}

const DDL = `
CREATE SCHEMA IF NOT EXISTS adaudit;
CREATE TABLE IF NOT EXISTS adaudit.audits (
  id text PRIMARY KEY,
  token text,
  email text,
  ip text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'awaiting_email',
  paid boolean NOT NULL DEFAULT false,
  paid_via text,
  recheck_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  doc jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS audits_token_idx ON adaudit.audits (token);
CREATE INDEX IF NOT EXISTS audits_email_created_idx ON adaudit.audits (email, created_at);
CREATE INDEX IF NOT EXISTS audits_ip_created_idx ON adaudit.audits (ip, created_at);
CREATE TABLE IF NOT EXISTS adaudit.orders (
  id text PRIMARY KEY,
  audit_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL,
  doc jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_audit_idx ON adaudit.orders (audit_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON adaudit.orders (status);
CREATE TABLE IF NOT EXISTS adaudit.llm_calls (
  id text PRIMARY KEY,
  audit_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  est_cost_usd double precision NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS llm_calls_created_idx ON adaudit.llm_calls (created_at);
CREATE TABLE IF NOT EXISTS adaudit.emails (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS adaudit.attempts (
  ip text NOT NULL,
  at_ms bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_ip_at_idx ON adaudit.attempts (ip, at_ms);
CREATE TABLE IF NOT EXISTS adaudit.meta (
  key text PRIMARY KEY,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS adaudit.pending_rows (
  audit_id text PRIMARY KEY,
  rows jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
`;

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(DDL)
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null; // allow a later call to retry
        throw err;
      });
  }
  return schemaReady;
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
