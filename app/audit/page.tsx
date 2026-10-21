import { TopBar, Footer, TrustBar } from "@/components/chrome";
import { UploadBox } from "@/components/UploadBox";
import { RecheckRequest } from "@/components/RecheckRequest";

export const metadata = { title: "Run your free audit — AdAudit" };

export default function AuditPage() {
  return (
    <>
      <TopBar />
      <main>
        <section className="section">
          <div className="wrap" style={{ maxWidth: 860 }}>
            <h1 style={{ fontSize: 32 }}>Run your free audit</h1>
            <p className="muted">Takes ~3 minutes · Free preview · No account access needed</p>
            <UploadBox />
            <RecheckRequest />
          </div>
        </section>
        <TrustBar />
      </main>
      <Footer />
    </>
  );
}
