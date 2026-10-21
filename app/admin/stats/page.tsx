import { headers } from "next/headers";
import { timingSafeEqual } from "crypto";
import { funnelStats } from "@/lib/store";

/**
 * F10 minimal internal stats — gated by the `x-admin-key` request header
 * (never a URL query parameter: query strings leak into logs, proxies and
 * browser history). Shows the only four numbers that decide this product's
 * life: uploads -> emails -> paid -> re-checks, plus per-call LLM costs.
 */
export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const key = (await headers()).get("x-admin-key");
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return <main className="section"><div className="wrap"><h2>Stats not configured</h2><p>Set ADMIN_KEY to enable this page.</p></div></main>;
  }
  const ok =
    key !== null &&
    key.length === expected.length &&
    timingSafeEqual(Buffer.from(key), Buffer.from(expected));
  if (!ok) {
    return <main className="section"><div className="wrap"><h2>Forbidden</h2></div></main>;
  }
  const s = await funnelStats();
  return (
    <main className="section">
      <div className="wrap">
        <h2>Funnel</h2>
        <table className="cols" style={{ maxWidth: 520 }}>
          <tbody>
            <tr><td>Uploads</td><td className="num">{s.uploads}</td></tr>
            <tr><td>Emails captured</td><td className="num">{s.emails}</td></tr>
            <tr><td>Reports ready</td><td className="num">{s.reports_ready}</td></tr>
            <tr><td>Paid orders</td><td className="num">{s.paid}</td></tr>
            <tr><td>Re-checks used</td><td className="num">{s.rechecks}</td></tr>
            <tr><td>Total LLM cost</td><td className="num">${s.total_llm_cost_usd.toFixed(4)}</td></tr>
          </tbody>
        </table>
        <h2 style={{ marginTop: 34 }}>LLM calls</h2>
        {s.llm_calls.length === 0 ? (
          <p className="muted">No calls yet.</p>
        ) : (
          <table className="cols">
            <thead><tr><th>When</th><th>Status</th><th>In tokens</th><th>Out tokens</th><th>Est. cost</th></tr></thead>
            <tbody>
              {s.llm_calls.map((c, i) => (
                <tr key={i}>
                  <td>{new Date(c.created_at).toLocaleString()}</td>
                  <td>{c.status}</td>
                  <td className="num">{c.input_tokens}</td>
                  <td className="num">{c.output_tokens}</td>
                  <td className="num">${c.est_cost_usd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
