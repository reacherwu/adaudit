import { NextRequest, NextResponse } from "next/server";
import { RECHECK_COOKIE, verifyPayload } from "@/lib/auth";

/**
 * GET /recheck/verify?t=<signed token> — the magic-link landing. A valid
 * signature (plus 1-hour expiry) proves the visitor controls the payer's
 * inbox; we exchange the link token for the same signed grant cookie the
 * report page flow sets, then send them to upload a fresh export. The
 * credit is consumed later, in the email step, after re-validation.
 */
export async function GET(req: NextRequest) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const payload = verifyPayload(t, "recheck");
  if (!payload) {
    return new NextResponse(
      `<!doctype html><html><head><meta charset="utf-8"><title>Re-check link expired — AdAudit</title></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px">
<h2>This re-check link doesn't work</h2>
<p>It may have expired (links last 1 hour) or been copied incompletely. You can request a fresh
link from the <a href="/audit">audit page</a>, or open your original report and tap
&ldquo;Start free re-check&rdquo; there.</p>
<p><a href="/">Back to home</a></p>
</body></html>`,
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const res = NextResponse.redirect(new URL("/audit", req.url));
  res.cookies.set(RECHECK_COOKIE, t, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 2 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
