/**
 * Parsed rows waiting for the email step. The uploaded FILE is never
 * written anywhere; only its normalized rows are held, for at most
 * 15 minutes, and dropped as soon as the pipeline consumes them.
 *
 * Production: rows live in the shared Postgres store (adaudit.pending_rows
 * with an expiry timestamp) so the email step finds them no matter which
 * serverless instance handled the upload — the previous process-memory
 * Map lost them whenever the two steps landed on different instances,
 * which is what broke production reports. Local dev without a database
 * keeps the old in-process Map.
 */

import type { AdRow } from "./audit/types";
import { ensureSchema, getPool, storeBackend } from "./db";

const TTL_MS = 15 * 60 * 1000;

const map = new Map<string, { rows: AdRow[]; expires: number }>();

export async function putPendingRows(auditId: string, rows: AdRow[]): Promise<void> {
  if (storeBackend() === "pg") {
    await ensureSchema();
    const pool = getPool();
    await pool.query(
      `INSERT INTO adaudit.pending_rows (audit_id, rows, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (audit_id) DO UPDATE
         SET rows = EXCLUDED.rows, expires_at = EXCLUDED.expires_at`,
      [auditId, JSON.stringify(rows), new Date(Date.now() + TTL_MS)],
    );
    // opportunistic cleanup of expired rows
    await pool
      .query("DELETE FROM adaudit.pending_rows WHERE expires_at < now()")
      .catch(() => undefined);
    return;
  }
  map.set(auditId, { rows, expires: Date.now() + TTL_MS });
  for (const [k, v] of map) if (v.expires < Date.now()) map.delete(k);
}

export async function takePendingRows(auditId: string): Promise<AdRow[] | null> {
  if (storeBackend() === "pg") {
    await ensureSchema();
    // Atomic consume: the row is deleted whether or not it has expired,
    // so rows can never be replayed by a second email step.
    const { rows } = await getPool().query(
      "DELETE FROM adaudit.pending_rows WHERE audit_id = $1 RETURNING rows, expires_at",
      [auditId],
    );
    if (rows.length === 0) return null;
    if (new Date(rows[0].expires_at as string).getTime() < Date.now()) return null;
    return rows[0].rows as AdRow[];
  }
  const entry = map.get(auditId);
  if (!entry) return null;
  map.delete(auditId);
  if (entry.expires < Date.now()) return null;
  return entry.rows;
}

/** Drop any held rows for an audit (retention purge / lifecycle cleanup). */
export async function dropPendingRows(auditId: string): Promise<void> {
  if (storeBackend() === "pg") {
    await ensureSchema();
    await getPool().query("DELETE FROM adaudit.pending_rows WHERE audit_id = $1", [auditId]);
    return;
  }
  map.delete(auditId);
}
