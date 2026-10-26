import Link from "next/link";
import { TopBar, Footer, CONTACT_EMAIL } from "@/components/chrome";

export const metadata = {
  title: "Meta ads audit tools compared — AdAudit, Adspirer, AdSherpa, Digilign",
  description:
    "What each Meta ads audit tool actually checks, what it costs, and whether it touches your ad account. Competitor prices re-checked October 26, 2026.",
};

const CHECKS: [string, string][] = [
  ["R1", "Zero conversions: spend ≥ max($50, 2× avg CPA), 0 results → full spend counted."],
  ["R2", "CPA blowout: ≥3 results, CPA ≥2× benchmark → excess over benchmark only."],
  ["R3", "Frequency fatigue: weighted frequency ≥7, or ≥4 with below-median CTR → 25% of spend."],
  ["R4", "Fragmentation: ≥8 ad sets and 40%+ under $30 with 0 results, or 3+ daily budgets <$5 → 50% of fragmented spend (de-duplicated)."],
  ["R5", "No tracking: 0 results account-wide, spend ≥$100 → no $ counted, fix tracking first."],
  ["R6", "Over-exposed single ad: frequency ≥5 with CTR ≤0.5%, or ≥60% of spend at worse-than-average CPA → 20% of spend."],
  ["R7", "Concentration: top set ≥80% of spend → risk warning, no $ counted."],
  ["R8", "Possible overlap: ≥3 sets in one campaign, frequency ≥3, CPMs within 20% → heuristic only, no $ counted, verify in Ads Manager."],
  ["R9", "Cheap-traffic trap: CPC ≤30% of median, ≥20% of impressions, 0 results → full spend counted."],
  ["R10", "Learning limbo: 1–6 results, spend ≥$100 → no $ counted, consolidate/raise budget."],
  ["R11", "Click-rate collapse: CTR ≤0.3%, impressions ≥10,000, spend ≥$30 → 30% of spend."],
  ["R12", "Account alarm: spend ≥$200 with 0 results, or avg CPA ≥3× target → alarm only, no $ counted."],
];

export default function ComparePage() {
  return (
    <>
      <TopBar />
      <main className="section">
        <div className="report-wrap">
          <h1 style={{ fontSize: 32 }}>Meta ads audit tools, compared</h1>
          <p className="muted">
            Prices and features re-checked against each competitor&apos;s own site on October 26,
            2026. See the caveats at the bottom — they are part of this page, not fine print.
          </p>

          <p>
            AdAudit is a <strong>one-time, read-only audit of your own export</strong>. It does not
            manage campaigns, launch ads, or connect to your ad account. The tools below do
            different jobs — pick by whether you want a one-off diagnosis, an ongoing manager, or
            an agent that acts inside your accounts.
          </p>

          <div style={{ overflowX: "auto", marginTop: 32 }}>
            <table className="cols" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th></th>
                  <th>AdAudit</th>
                  <th>Adspirer</th>
                  <th>AdSherpa</th>
                  <th>Digilign Meta audit</th>
                  <th>Manual / agency</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Job</strong></td>
                  <td>One-time audit of a Meta export</td>
                  <td>AI paid-media manager / MCP agent across 6 platforms</td>
                  <td>Ongoing AI audit + chat, competitor tracking</td>
                  <td>One-time audit, delivered in 24h</td>
                  <td>Human audit / management</td>
                </tr>
                <tr>
                  <td><strong>Price</strong></td>
                  <td>$49 once; free preview</td>
                  <td>Free: 15 tasks/mo; Plus $40/mo; Pro $83/mo; Max $167/mo (monthly rates shown with annual billing)</td>
                  <td>Basic $59/mo, Plus $99/mo, Pro $149/mo</td>
                  <td>Tier 1 $29 (last $75K spend), Tier 2 $49 (last $300K), Tier 3 $79 (last $1.5M)</td>
                  <td>Agency management typically $500+/mo; human audits seen at $147–$450</td>
                </tr>
                <tr>
                  <td><strong>Account access</strong></td>
                  <td>None — CSV/XLSX upload only</td>
                  <td>Connects via MCP to ad platforms</td>
                  <td>Connects to ad accounts (official OAuth integration)</td>
                  <td>Read-only partner access — you add them in Business Settings</td>
                  <td>Usually full access</td>
                </tr>
                <tr>
                  <td><strong>What it checks</strong></td>
                  <td>12 deterministic rules (below)</td>
                  <td>Campaign build, monitoring, optimisation, deep audits across platforms</td>
                  <td>Audit + competitor analysis, persona builder, creative studio</td>
                  <td>11-point analysis (campaigns, creatives, audiences, spend)</td>
                  <td>Varies by person</td>
                </tr>
                <tr>
                  <td><strong>Recurring cost</strong></td>
                  <td>None</td>
                  <td>Monthly, task-based</td>
                  <td>Monthly, credit-based</td>
                  <td>None per audit</td>
                  <td>Monthly or per project</td>
                </tr>
                <tr>
                  <td><strong>Best for</strong></td>
                  <td>An advertiser who wants one priced diagnosis before spending more</td>
                  <td>Teams that want an agent working inside several ad platforms</td>
                  <td>Advertisers who want ongoing reports + competitor tracking</td>
                  <td>An advertiser who wants a one-off audit priced by spend analysed</td>
                  <td>Accounts that want hands-on management</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 style={{ marginTop: 48 }}>AdAudit&apos;s 12 checks, in one line each</h2>
          <p className="muted">
            Full thresholds, triggers and worked examples:{" "}
            <Link href="/rules">the 12 checks, explained →</Link>
          </p>
          <ul>
            {CHECKS.map(([id, body]) => (
              <li key={id}>
                <strong>{id}.</strong> {body}
              </li>
            ))}
          </ul>
          <p className="muted">
            Engine notes: no double-counting (the largest estimate owns shared spend); amounts in
            the account&apos;s own currency; estimates labelled as estimates.
          </p>

          <h2 style={{ marginTop: 48 }}>Caveats — read these before comparing prices</h2>
          <ul>
            <li>
              <strong>Competitor prices and features change.</strong> The figures above were
              re-checked on each competitor&apos;s own pricing page on October 26, 2026. If you
              are reading this later, re-check before deciding.
            </li>
            <li>
              <strong>An older Adspirer figure is out of date.</strong> A $485–$2,000/year figure
              that circulated in October 2026 no longer matches Adspirer&apos;s current
              task-priced monthly page. The current page wins; the old figure is noted here
              rather than silently carried over.
            </li>
            <li>
              <strong>AdAudit has no paying customers yet</strong> (last checked October 24,
              2026). This page therefore shows no testimonials, customer counts, or
              &ldquo;trusted by&rdquo; claims. The only numbers on this page are AdAudit&apos;s own
              price, its 12 published thresholds, and competitors&apos; published prices.
            </li>
            <li>
              <strong>&ldquo;Best for&rdquo; rows are positioning, not verdicts.</strong> We do not
              claim AdAudit beats the others on accuracy — no head-to-head test has been run.
            </li>
          </ul>

          <div
            className="card"
            style={{ marginTop: 40, textAlign: "center", padding: "32px 24px" }}
          >
            <h3 style={{ marginTop: 0 }}>Run AdAudit on your own export</h3>
            <p className="muted">Free preview · ~3 minutes · your file is never stored</p>
            <p>
              <Link className="btn" href="/#upload">
                Run my free audit →
              </Link>
            </p>
          </div>

          <p className="muted" style={{ marginTop: 32 }}>
            Questions about this comparison?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
