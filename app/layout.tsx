import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdAudit — Find what your Meta ads are wasting, in 3 minutes",
  description:
    "Upload your Ads Manager export and get a read-only audit of your Meta ads account: health score, waste list with evidence, and a prioritized fix checklist. Free preview, full report $49 one-time. No account access needed.",
  openGraph: {
    title: "AdAudit — Meta Ads Audit",
    description:
      "Your agency charges $500+/mo to manage ads. We find what they're wasting — in 3 minutes, for $49.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<Analytics /></body>
    </html>
  );
}
