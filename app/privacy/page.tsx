import { TopBar, Footer, CONTACT_EMAIL } from "@/components/chrome";

export const metadata = { title: "Privacy Policy — AdAudit" };

export default function PrivacyPage() {
  return (
    <>
      <TopBar />
      <main className="section">
        <div className="report-wrap">
          <h1 style={{ fontSize: 32 }}>Privacy Policy</h1>
          <p className="muted">Last updated: October 21, 2026</p>

          <h3>What we collect</h3>
          <p>
            When you run an audit, you upload one Ads Manager export file and give us an email address.
            That is all. We never ask for your ad account password, and this product never connects to
            your ad account.
          </p>

          <h3>Your uploaded file</h3>
          <p>
            Your file is processed in memory on our server and is <strong>never written to disk or
            long-term storage</strong>. The moment parsing finishes, the file ceases to exist on our
            systems. We keep only: your account&apos;s aggregate metrics, the audit findings, the
            generated report text, your email address, and your order status.
          </p>

          <h3>AI processing</h3>
          <p>
            Anonymized aggregates and audit findings (never your raw rows, never your email) are processed
            by an AI model provider (DeepSeek) to write the narrative parts of your report. Your data is
            not used to train models, and we do not sell or share your data with anyone else.
          </p>

          <h3>Retention</h3>
          <p>
            Reports and their associated data are kept for <strong>90 days</strong>, then automatically
            deleted. You can ask for earlier deletion at any time by emailing{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; we will complete it within 3 business days.
          </p>

          <h3>Email</h3>
          <p>
            We email you your report link and, if you buy the full report, an unlock confirmation. We do
            not send unrelated marketing. A separate opt-in for launch news may be offered; it is never
            pre-checked.
          </p>

          <h3>Contact</h3>
          <p>
            Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
