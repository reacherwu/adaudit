import Link from "next/link";
import { TopBar, Footer, TrustBar, CONTACT_EMAIL } from "@/components/chrome";
import { UploadBox } from "@/components/UploadBox";
import { SampleReportCard } from "@/components/SampleReportCard";
import { ExportGuideFull } from "@/components/ExportGuide";

const CHECKS = [
  ["Ad sets spending with zero conversions", "Money going out, nothing coming back. We flag every one."],
  ["CPA blowouts", "Ad sets paying 2× or more per sale than your account average."],
  ["Audience fatigue", "The same people seeing your ad 4, 5, 6 times while clicks fall off."],
  ["Fragmented budgets", "Too many small ad sets, none with enough data to learn."],
  ["Cheap-traffic traps", "Suspiciously cheap clicks that never buy."],
  ["Missing conversion tracking", "If Results is empty, you're flying blind — and paying for it."],
  ["One-ad dependency", "80% of spend riding on a single ad is a risk, not a strategy."],
  ["Click-rate collapse", "Thousands of impressions, almost no clicks."],
] as const;

const FAQS: [string, string][] = [
  [
    "What file do I need to upload?",
    "A CSV or Excel export from Ads Manager covering the last 30 days, at ad set level. The step-by-step guide is in the “How to export” section below — it takes about a minute.",
  ],
  [
    "Do you need access to my ad account?",
    "No. No login, no password, no API access. You upload one file; that's all we ever see.",
  ],
  [
    "What happens to my file?",
    "It's processed in memory on our server and never stored — parsing it is the end of its life. We keep only the report and its summary numbers, for 90 days, then they're deleted too.",
  ],
  ["How long does it take?", "About 3 minutes. We email you the link when it's ready."],
  [
    "What if my report can't be generated?",
    "You get a full automatic refund. No forms, no emails to support.",
  ],
  [
    "Is the “estimated waste” real money I lost?",
    "It's an estimate from your own numbers, and every item shows its math. We label estimates as estimates — the methodology note is printed on every report.",
  ],
];

export default function HomePage() {
  return (
    <>
      <TopBar />
      <main>
        <section className="section" style={{ paddingBottom: 36 }}>
          <div className="wrap">
            <div style={{ maxWidth: 720 }}>
              <h1>Your agency charges $500+/mo to manage ads. We find what they&apos;re wasting — in 3 minutes, for $49.</h1>
              <p style={{ fontSize: 18, color: "var(--muted)" }}>
                Upload your Ads Manager export. Get a full audit in ~3 minutes. No account access needed.
              </p>
              <p>
                <a className="btn" href="#upload">Run my free audit →</a>{" "}
                <span className="muted" style={{ marginLeft: 10 }}>Free preview — no card required. Full report $49 once.</span>
              </p>
            </div>
            <div style={{ maxWidth: 720, marginTop: 30 }}>
              <SampleReportCard compact />
            </div>
          </div>
        </section>

        <TrustBar />

        <section className="section">
          <div className="wrap">
            <h2>What we check</h2>
            <div className="checks-grid">
              {CHECKS.map(([title, body]) => (
                <div className="check-card" key={title}>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt" id="how-to-export">
          <div className="wrap">
            <h2>How to export from Ads Manager</h2>
            <ExportGuideFull />
          </div>
        </section>

        <section className="section" id="upload">
          <div className="wrap" style={{ maxWidth: 860 }}>
            <h2>Start with your Ads Manager export</h2>
            <p className="muted">Takes ~3 minutes · Free preview · No account access needed</p>
            <UploadBox />
          </div>
        </section>

        <section className="section alt">
          <div className="wrap" style={{ maxWidth: 860 }}>
            <h2>What your report looks like</h2>
            <SampleReportCard />
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="wrap" style={{ maxWidth: 860 }}>
            <h2>Pricing</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
              <div className="card">
                <h3>Full report — $49 one-time</h3>
                <p><strong className="num" style={{ fontSize: 30 }}>$49</strong></p>
                <ul>
                  <li>Everything in the free preview, plus:</li>
                  <li>Every waste item with evidence &amp; $ amounts</li>
                  <li>Full fix checklist (this week / this month / later)</li>
                  <li>What&apos;s working</li>
                  <li>PDF download</li>
                  <li>1 free re-check within 30 days</li>
                </ul>
                <a className="btn" href="#upload">Upload &amp; unlock — $49</a>
              </div>
              <div className="card">
                <h3>Free preview</h3>
                <p><strong className="num" style={{ fontSize: 30 }}>$0</strong></p>
                <ul>
                  <li>Health score &amp; grade</li>
                  <li>Number of issues found</li>
                  <li>Estimated total waste</li>
                  <li>First waste item in full</li>
                </ul>
                <a className="btn secondary" href="#upload">Run free audit</a>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 14 }}>
              For scale: one month of agency ad management typically costs $500+. This is a one-time
              payment — not a subscription.
            </p>
          </div>
        </section>

        <section className="section alt" id="faq">
          <div className="wrap" style={{ maxWidth: 860 }}>
            <h2>FAQ</h2>
            {FAQS.map(([q, a]) => (
              <details className="faq" key={q}>
                <summary>{q}</summary>
                <div className="body"><p style={{ margin: 0 }}>{a}</p></div>
              </details>
            ))}
            <p className="muted">
              Still stuck? Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — we&apos;ll sort it out.
            </p>
            <p><Link href="/audit">Go to the audit page →</Link></p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
