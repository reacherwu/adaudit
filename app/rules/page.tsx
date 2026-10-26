import Link from "next/link";
import { TopBar, Footer, CONTACT_EMAIL } from "@/components/chrome";

export const metadata = {
  title: "The 12 waste checks — How AdAudit finds wasted Meta ad spend",
  description:
    "Exactly how AdAudit's audit engine works: 12 deterministic rules, their thresholds, and how the estimated waste is computed. No black box — every number comes from your own export.",
};

function Rule({
  id,
  title,
  impact,
  children,
}: {
  id: string;
  title: string;
  impact: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginTop: 40 }}>
      <h3>
        {title}{" "}
        <span
          className="muted"
          style={{ fontSize: 14, fontWeight: "normal", marginLeft: 8, whiteSpace: "nowrap" }}
        >
          {id} · impact: {impact}
        </span>
      </h3>
      {children}
    </section>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        borderLeft: "3px solid var(--border)",
        paddingLeft: 14,
        color: "var(--muted)",
        fontSize: 15,
      }}
    >
      <em>Illustrative example (demonstration numbers, not a real account):</em> {children}
    </p>
  );
}

export default function RulesPage() {
  return (
    <>
      <TopBar />
      <main className="section">
        <div className="report-wrap">
          <h1 style={{ fontSize: 32 }}>How the audit actually works</h1>
          <p className="muted">Last updated: October 24, 2026 · Mirrors the shipped engine code (lib/audit)</p>

          <p>
            AdAudit runs <strong>12 deterministic checks</strong> over your Ads Manager export.
            There is no black box: every finding below names the exact trigger conditions, and every
            dollar figure in your report is computed from your own rows. Nothing is invented, sampled,
            or extrapolated from industry averages.
          </p>

          <h3>How the numbers are computed</h3>
          <ul>
            <li>
              <strong>Deterministic rules engine.</strong> The engine is a set of pure functions: your
              rows go in, findings come out. No AI is involved in any calculation.
            </li>
            <li>
              <strong>AI writes words, not numbers.</strong> An AI model writes the narrative text of
              the report — and then every dollar figure it mentions is <strong>machine-checked against
              the engine&apos;s own evidence</strong>. A figure that doesn&apos;t match is rejected
              before the report is shown.
            </li>
            <li>
              <strong>Your currency, not ours.</strong> Amounts are detected from your export and shown
              in your account&apos;s own currency. We never convert or invent exchange rates.
            </li>
            <li>
              <strong>Never double-counted.</strong> When several checks hit the same ad set, its waste
              is owned by the single largest estimate and the others contribute $0. The total never
              counts the same dollars twice.
            </li>
            <li>
              <strong>Conservative by design.</strong> Where a number is genuinely uncertain, we
              under-report rather than over-report — and we label estimates as estimates, on the report
              itself.
            </li>
            <li>
              <strong>Health score 0–100.</strong> Each issue deducts points, capped per rule (a large
              waste item can&apos;t nuke the score alone). 80+ is <em>Healthy</em>, 60+ <em>Needs
              work</em>, 40+ <em>Wasteful</em>, below that <em>Critical</em>. The report also names
              your top 3 ad sets by cost per result — what&apos;s working, not just what&apos;s broken.
            </li>
          </ul>

          <p className="muted">
            Checks run at ad-set level, or at ad level when your export is ad-level. Severity (high /
            medium / low) reflects how much money is typically at stake — it does not change the math.
          </p>

          <Rule id="R1" title="Ad sets spending with zero conversions" impact="high">
            <p>
              <strong>What it catches:</strong> money going out with literally nothing coming back —
              the purest form of waste.
            </p>
            <p>
              <strong>Trigger:</strong> an ad set (or ad) that spent at least the <strong>larger
              of $50 and 2× your account&apos;s average cost per result</strong>, with zero results.
              The 2× clause scales the bar to your account: if your average CPA is high, the check only
              flags sets spending at least twice that much.
            </p>
            <p>
              <strong>Waste estimate:</strong> the full spend of each flagged set — every dollar of it
              produced nothing.
            </p>
            <Example>
              An ad set spends $210 with 0 purchases. Your account average CPA is $25, so the bar is
              max($50, 2 × $25) = $50. $210 ≥ $50 and results are 0 → flagged, estimated waste $210.
            </Example>
          </Rule>

          <Rule id="R2" title="Ad sets paying far too much per result" impact="high">
            <p>
              <strong>What it catches:</strong> ad sets whose cost per result has blown out far beyond
              what&apos;s normal for your account — expensive conversions subsidised by the rest.
            </p>
            <p>
              <strong>Trigger:</strong> an ad set with <strong>at least 3 results</strong> whose cost
              per result is <strong>at least 2× the benchmark</strong> — your target CPA if you
              entered one, otherwise the account average.
            </p>
            <p>
              <strong>Waste estimate:</strong> only the excess above the benchmark: spend − spend ×
              (benchmark ÷ its CPA). We don&apos;t call the whole spend waste — just the overpayment.
            </p>
            <Example>
              Account average CPA is $20. An ad set at $45 CPA spends $500. Estimated waste =
              $500 − $500 × ($20 ÷ $45) ≈ $277.78.
            </Example>
          </Rule>

          <Rule id="R3" title="Audiences seeing the same ads too many times" impact="high / medium">
            <p>
              <strong>What it catches:</strong> frequency fatigue — the same people seeing your ad on
              loop while clicks quietly fall off.
            </p>
            <p>
              <strong>Trigger:</strong> the ad set&apos;s impression-weighted average frequency
              reaches <strong>7</strong> (high), or <strong>4 with a below-median click rate</strong>
              (medium). Click rate is compared against the median of your own rows, not an external
              benchmark.
            </p>
            <p>
              <strong>Waste estimate:</strong> <strong>25% of the ad set&apos;s spend</strong> — a
              fixed, conservative share of the spend that went to oversaturated impressions.
            </p>
            <Example>
              An ad set with frequency 8.2 spends $400. Estimated waste = 25% × $400 = $100.
            </Example>
          </Rule>

          <Rule id="R4" title="Budget spread across too many small ad sets" impact="medium">
            <p>
              <strong>What it catches:</strong> fragmentation — so many thin ad sets that none ever
              accumulates enough conversions for delivery to stabilise.
            </p>
            <p>
              <strong>Trigger (account-wide):</strong> you have <strong>at least 8 active ad sets
              </strong> and <strong>40%+ of them spent under $30 with zero results</strong>; or
              <strong> 3+ ad sets run on daily budgets under $5</strong>. Either pattern means the
              budget is too thin to learn from.
            </p>
            <p>
              <strong>Waste estimate:</strong> <strong>50% of the fragmented spend</strong>, then
              reduced so it never double-counts ad sets already caught by another rule above.
            </p>
            <Example>
              10 active ad sets; 5 of them spent under $30 with no results. If those 5 total $120 in
              spend, estimated waste = 50% × $120 = $60 (before any de-duplication adjustment).
            </Example>
          </Rule>

          <Rule id="R5" title="No conversion tracking detected" impact="high">
            <p>
              <strong>What it catches:</strong> you&apos;re flying blind — and paying for it. Every
              decision is based on clicks because Results is empty everywhere.
            </p>
            <p>
              <strong>Trigger (account-wide):</strong> zero results across the whole account with
              total spend of <strong>at least $100</strong>.
            </p>
            <p>
              <strong>Waste estimate:</strong> none — deliberately. This is a tracking problem, not a
              spend line to be counted. The finding tells you to install the Pixel / Conversions API
              before touching any budget.
            </p>
          </Rule>

          <Rule id="R6" title="A single ad over-exposed and under-performing" impact="medium">
            <p>
              <strong>What it catches:</strong> one tired creative (or one ad set) carrying too much
              of the load while performing worse than the rest.
            </p>
            <p>
              <strong>Trigger:</strong> frequency of <strong>5+</strong> with a click rate of
              <strong> ≤0.5%</strong>; <em>or</em> the set takes <strong>60%+ of the account&apos;s
              spend</strong> while its cost per result is worse than the account average.
            </p>
            <p>
              <strong>Waste estimate:</strong> <strong>20% of its spend</strong>.
            </p>
            <Example>
              One ad takes 65% of a $1,000 account at a worse CPA than the account average and a 0.3%
              CTR. Estimated waste = 20% × $650 = $130.
            </Example>
          </Rule>

          <Rule id="R7" title="Too much spend riding on one ad" impact="low">
            <p>
              <strong>What it catches:</strong> concentration risk, not waste. If one ad set carries
              <strong> 80%+</strong> of all spend and it fatigues or gets disapproved, the account has
              no plan B.
            </p>
            <p>
              <strong>Trigger:</strong> the top-spending ad set&apos;s share of total spend ≥ 80%.
              No waste is estimated — this is a risk warning, and it&apos;s labelled as one.
            </p>
          </Rule>

          <Rule id="R8" title="Possible audience overlap between ad sets" impact="low">
            <p>
              <strong>What it catches:</strong> your own ad sets bidding against each other for the
              same people, driving up your own costs.
            </p>
            <p>
              <strong>Trigger (per campaign):</strong> <strong>at least 3 ad sets</strong> in the same
              campaign, each with frequency <strong>3+</strong>, whose CPMs sit <strong>within 20% of
              each other</strong> — similar CPMs across multiple sets is the tell.
            </p>
            <p>
              <strong>Waste estimate:</strong> none — deliberately. This is a low-confidence heuristic
              <strong> by design</strong>, and the finding says so: a CSV can&apos;t prove targeting
              overlap, so it tells you to verify in Ads Manager&apos;s Audience Overlap tool instead of
              presenting a number.
            </p>
          </Rule>

          <Rule id="R9" title="Suspiciously cheap traffic that never converts" impact="medium">
            <p>
              <strong>What it catches:</strong> the cheap-click trap — huge click volume at a fraction
              of the normal price that never turns into a sale (often junk placements).
            </p>
            <p>
              <strong>Trigger:</strong> an ad set whose cost per click is <strong>≤30% of the account
              median</strong>, taking <strong>≥20% of all impressions</strong>, with <strong>zero
              results</strong>.
            </p>
            <p>
              <strong>Waste estimate:</strong> the full spend of the set — those clicks bought nothing.
            </p>
            <Example>
              Median CPC across the account is $1.50. An ad set buys 25% of all impressions at $0.40
              CPC with 0 results, spending $180 → flagged, estimated waste $180.
            </Example>
          </Rule>

          <Rule id="R10" title="Ad sets starved of conversion volume" impact="low">
            <p>
              <strong>What it catches:</strong> ad sets stuck in &ldquo;learning limbo&rdquo; — enough
              spend to matter, not enough conversions for delivery to optimise.
            </p>
            <p>
              <strong>Trigger:</strong> <strong>1–6 results</strong> with spend of
              <strong> $100+</strong>. No waste is estimated — the finding recommends consolidating or
              raising budget so the set can learn, not pausing it.
            </p>
          </Rule>

          <Rule id="R11" title="Ads with a collapsed click rate" impact="medium">
            <p>
              <strong>What it catches:</strong> ads nobody clicks anymore — thousands of impressions
              served to people who scroll right past.
            </p>
            <p>
              <strong>Trigger:</strong> click rate <strong>≤0.3%</strong>, impressions
              <strong> ≥10,000</strong>, spend <strong>≥$30</strong>. The impression floor keeps this
              from firing on statistical noise.
            </p>
            <p>
              <strong>Waste estimate:</strong> <strong>30% of the ad set&apos;s spend</strong>.
            </p>
            <Example>
              An ad set with a 0.18% CTR over 40,000 impressions spends $300 → flagged, estimated
              waste = 30% × $300 = $90.
            </Example>
          </Rule>

          <Rule id="R12" title="Account-wide alarm: spending without results" impact="high">
            <p>
              <strong>What it catches:</strong> the fire alarm for the whole account. This finding is
              <strong> pinned to the top of your report</strong> so you can&apos;t miss it.
            </p>
            <p>
              <strong>Trigger (account-wide):</strong> total spend <strong>≥$200 with zero
              results</strong>; or, if you set a target CPA, the account average running at
              <strong> 3× or more</strong> of it.
            </p>
            <p>
              <strong>Waste estimate:</strong> none — this is an alarm, not an accusation. It deducts
              nothing from your health score; it exists so you stop and diagnose (tracking, campaign
              objective, offer) before funding another month.
            </p>
          </Rule>

          <h3 style={{ marginTop: 48 }}>What this page doesn&apos;t do</h3>
          <p>
            We don&apos;t benchmark you against &ldquo;industry averages&rdquo; — every threshold
            above is either a fixed constant or computed from your own account&apos;s medians and
            averages. We don&apos;t predict what you <em>would have</em> earned. And the engine is
            intentionally conservative: it would rather miss a borderline case than label healthy spend
            as waste.
          </p>

          <div
            className="card"
            style={{ marginTop: 40, textAlign: "center", padding: "32px 24px" }}
          >
            <h3 style={{ marginTop: 0 }}>See what these 12 checks find in your account</h3>
            <p className="muted">Free preview · ~3 minutes · your file is never stored</p>
            <p>
              <Link className="btn" href="/#upload">
                Run my free audit →
              </Link>
            </p>
          </div>

          <p className="muted" style={{ marginTop: 32 }}>
            Questions about the methodology?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
