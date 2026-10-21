import Link from "next/link";

export const CONTACT_EMAIL = "service@adaudit.app";

export function TopBar() {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link className="logo" href="/">
          Ad<span>Audit</span>
        </Link>
        <nav>
          <Link href="/#how-to-export">How to export</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/#faq">FAQ</Link>
          <Link href="/audit">Run audit</Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <p>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>Contact: {CONTACT_EMAIL}</a>
        </p>
        <p style={{ margin: 0 }}>
          Files are processed in memory and never stored. Reports are kept for 90 days, then deleted.
          AdAudit is an independent tool and is not affiliated with Meta Platforms, Inc.
        </p>
      </div>
    </footer>
  );
}

export function TrustBar() {
  return (
    <div className="trustbar">
      <div className="wrap">
        <div className="item">🔒 Read-only — we never touch your ad account</div>
        <div className="item">🗑 Your file is deleted after analysis</div>
        <div className="item">🚫 No password, no account access</div>
      </div>
    </div>
  );
}
