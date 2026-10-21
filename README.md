# AdAudit

**Find the money your Meta Ads are wasting — in minutes, not meetings.**

AdAudit audits a Meta (Facebook) Ads account from a standard Ads Manager export and tells you exactly where the budget leaks: which ad sets burn spend with zero conversions, where CPA has blown out, which audiences are fatigued — each finding with the evidence and a concrete fix.

**Live product: [adaudit.vercel.app](https://adaudit.vercel.app)**

- No login, no ad-account access, no OAuth. Upload one exported report and get an audit.
- Free preview shows your health score and the first finding in full.
- The full report is a **one-time $49** (not a subscription): every finding, a downloadable PDF, and one free re-check within 30 days.

---

## How it works

1. **Export** a report from Ads Manager (ad set level) as CSV or XLSX — the site includes a step-by-step export guide.
2. **Upload** it on the landing page. The file is parsed in memory and never written to disk.
3. **Get your audit**: a deterministic rules engine scores the account and flags waste; an LLM writes the narrative summary from the engine's numbers — and only from those numbers.
4. **Fix and re-check**: work through the prioritized fix list, then re-upload within 30 days to verify the improvement (included in the $49).

## What it checks

Twelve rules, tuned on real Ads Manager data shapes. When several rules hit the same ad set, the wasted spend is counted **once** — we'd rather under-report than inflate.

| # | Check | What it catches |
|---|-------|-----------------|
| R1 | Zero-conversion spenders | Ad sets spending real money with zero results |
| R2 | CPA blowouts | Cost per result far above the account's own baseline |
| R3 | Frequency fatigue | Audiences shown the same ad too many times |
| R4 | Fragmentation | Budget shredded across too many tiny ad sets |
| R5 | Missing conversion tracking | Spend running with no results signal at all |
| R6 | Single-ad fatigue | One tired creative carrying a whole ad set |
| R7 | Concentration risk | Too much budget riding on a single winner |
| R8 | Audience overlap | Ad sets likely bidding against each other |
| R9 | Cheap-traffic trap | Cheap clicks that never turn into results |
| R10 | Starved campaigns | Campaigns that never get enough data to optimize |
| R11 | CTR collapse | Click-through rates far below account norms |
| R12 | Account-wide alarm | Structural problems that span the whole account |

Every finding ships with severity, the estimated waste, the evidence behind it, and a prioritized fix ("this week" / "this month" / "later").

## Design principles

- **Read-only by design.** AdAudit never connects to your ad account. It analyzes the export *you* choose to upload — nothing else.
- **Files never touch disk.** Uploads are parsed in memory and discarded; there is no copy of your raw data on the server.
- **A real paywall.** Locked findings are trimmed on the server. Unpaid reports never receive the evidence, amounts, or fix text for locked items — blurring on the client would not count.
- **An honest AI boundary.** The LLM only narrates. Every dollar figure in its summary is verified against the rules engine's output; anything that doesn't check out falls back to a template summary, labeled as such on the page.
- **Promises are implemented, not marketing.** Reports auto-delete after 90 days (enforced on read and by a scheduled cleanup). If a paid report fails to generate, the payment is automatically refunded in full — and if the refund call itself fails, the order stays visibly `refund_pending` and keeps retrying instead of pretending it was refunded.

## Tech stack

- **Next.js** (App Router) + TypeScript, deployed on **Vercel**
- **PostgreSQL** via Prisma for report/order persistence
- **Creem** for one-time payments, webhooks, and refunds
- **DeepSeek** for report narration (with numeric consistency checks)
- **pdf-lib** for server-side PDF generation
- **Resend** for transactional email (optional — report links are also shown on-site)

## Getting started

```bash
npm install
cp .env.example .env.local   # everything is optional for the free-preview flow
npm run build
npm run start                 # http://localhost:3000
```

Sample exports live in [`test-data/`](test-data/): a realistic ad-set-level Ads Manager export (CSV) that runs the full flow end to end, plus a missing-columns file for testing validation errors. The XLSX twin of the sample can be regenerated with `node scripts/make-xlsx-sample.mjs`.

## Environment variables

| Variable | Purpose | If unset |
|----------|---------|----------|
| `DEEPSEEK_API_KEY` | LLM narration for report summaries (direct API) | Summary falls back to a rule-data template, labeled on the page |
| `CREEM_API_KEY` / `CREEM_PRODUCT_ID` | $49 one-time checkout | Checkout returns 503; free preview unaffected |
| `CREEM_WEBHOOK_SECRET` | Webhook signature verification (HMAC-SHA256) | Webhooks rejected with 401; nothing unlocks |
| `RESEND_API_KEY` / `MAIL_FROM` | Report and unlock emails | Sends logged as `not_configured`; links still shown on-site |
| `CRON_SECRET` | Guards the scheduled cleanup endpoint | Cleanup endpoint returns 503 and does nothing |
| `ADMIN_KEY` | Internal funnel stats page (`/admin/stats`) | Stats page disabled |
| `ADMIN_ALERT_EMAIL` | Ops alerts (e.g. pending refunds) | Defaults to the support address |
| `LLM_DAILY_CALL_CAP` | Daily LLM call circuit breaker (default 200) | — |

Scheduled cleanup runs daily via the cron entry in [`vercel.json`](vercel.json): it purges reports older than 90 days and retries any pending refunds.

## Repository guide

| Path | Contents |
|------|----------|
| `app/` | Pages and API routes (landing, upload, report, PDF, checkout, webhooks, cron) |
| `lib/audit/` | Column mapping, parsing/validation, thresholds, the 12 rules, fix templates |
| `lib/report/` | Report pipeline: generation, paywall trimming, orchestration |
| `lib/creem.ts` · `lib/refund.ts` | Payments, webhook handling, automatic-refund flow |
| `lib/store*.ts` | Persistence layer (PostgreSQL in production) |
| [`PRD.md`](PRD.md) | Product requirements document |
| [`DESIGN.md`](DESIGN.md) | Page and state design |
| [`BIZ.md`](BIZ.md) | Business model and go-to-market notes |

---

Built for advertisers and small agencies who run Meta Ads and want an outside pair of eyes on their spend — without handing over account access.
