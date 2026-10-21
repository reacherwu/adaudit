import { TopBar, Footer, CONTACT_EMAIL } from "@/components/chrome";

export const metadata = { title: "Terms of Service — AdAudit" };

export default function TermsPage() {
  return (
    <>
      <TopBar />
      <main className="section">
        <div className="report-wrap">
          <h1 style={{ fontSize: 32 }}>Terms of Service</h1>
          <p className="muted">Last updated: October 21, 2026</p>

          <h3>The service</h3>
          <p>
            AdAudit produces a read-only audit report from an Ads Manager export file that you upload.
            The report is informational. Health scores are a heuristic based on the checks shown in the
            report — not an industry standard — and figures labelled “estimated” are estimates derived
            from your own data. Nothing in a report is financial advice, and we do not guarantee any
            particular advertising outcome.
          </p>

          <h3>Payment</h3>
          <p>
            The full report costs $49 USD, one time. It is not a subscription and will never renew.
            Payment is processed by Creem. Each purchase includes one free re-check within 30 days.
          </p>

          <h3>Refunds</h3>
          <p>
            If we cannot generate your report, your payment is refunded in full, automatically. For any
            other case, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will handle
            it by email — the decision is made by a human, in plain language.
          </p>

          <h3>Your responsibilities</h3>
          <p>
            You confirm you have the right to upload the export you provide (your own ad account, or a
            client&apos;s account you manage). You must not upload files containing malware or crafted
            content intended to break the service; uploaded files are validated and rejected when they
            don&apos;t match the expected formats.
          </p>

          <h3>Availability &amp; liability</h3>
          <p>
            We aim to generate reports within a few minutes but do not guarantee a specific turnaround.
            To the extent permitted by law, our liability is limited to the amount you paid us.
          </p>

          <h3>Contact</h3>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
