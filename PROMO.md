# AdAudit — 推广素材（英文）

产品：AdAudit — AI Meta Ads Account Audit
上线地址：https://adaudit.vercel.app
事实口径（对外统一）：No-login upload of an Ads Manager export → 12-rule audit → free preview → $49 one-time full report (PDF + 1 free re-audit within 30 days). Files deleted after parsing. Read-only — we never touch your ad account.

---

## 1. X 推文

### 1a. 产品发布向（创始人第一人称）

I built the thing I kept wishing existed.

Upload your Meta Ads Manager export, and AdAudit runs 12 waste-finding rules over your account — zero-conversion campaigns still spending, frequency through the roof, budget scattered across 40 ad sets.

Free preview. $49 if you want the full report.

No login. No account access. Your file is deleted after parsing.

adaudit.vercel.app

### 1b. 痛点向（创始人第一人称）

Agencies charge $500+/mo to "manage" your Meta ads.

Last month I exported one account and found the waste by hand: dead campaigns still spending, one ad set at frequency 14, budget split so thin nothing could learn.

It took me hours. So I automated it — 12 rules, one upload, free preview: adaudit.vercel.app

---

## 2. Product Hunt

**Name:** AdAudit

**Tagline:** Find the waste in your Meta ads account in minutes — no login, no account access

**首段描述：**

AdAudit audits your Meta ad account the way a good media buyer would — without the $500+/month agency retainer. Export your report from Ads Manager, upload it (no login, no API access, your file is deleted right after parsing), and our 12-rule engine checks for the leaks that quietly burn budget: campaigns spending with zero conversions, ad fatigue and frequency creep, budgets spread too thin to learn, and more. You get a free preview of what we found; the full report — every finding, the numbers behind it, and what to fix first — is a one-time $49, including a PDF and one free re-audit within 30 days so you can verify the fixes worked.

**Maker 首评：**

Hey PH 👋 Maker here.

I built AdAudit after doing this audit by hand on a spreadsheet one too many times. The waste patterns in Meta accounts are boringly predictable — the same dozen mistakes, over and over — which makes them perfect for a rule engine instead of a monthly retainer.

How it works:
1. Export your campaign report from Ads Manager (CSV)
2. Upload it — no account connection, no login
3. Get a free preview of the findings
4. Unlock the full report for a one-time $49 (PDF included, plus a free re-audit within 30 days)

Privacy was a design constraint from day one: your file is parsed and deleted, and we never get write — or even read — access to your actual ad account.

I'd love feedback from anyone running Meta ads: which of the 12 rules do you think catches the most waste? What should rule #13 be?

---

## 3. Reddit 帖草稿

> 发布守则（两帖通用）：先给价值再提工具；标题不带产品名；正文末尾才披露 maker 身份并附链接；不跨社区复制粘贴同文；发帖后认真回评论，不辩解、不刷评。

### 3a. r/FacebookAds — 经验分享向

**Title:** I audited 12 Meta accounts by hand last month. The same 5 mistakes were in almost every one.

**Body:**

I do freelance media buying, and recently I started every client engagement with a manual audit of their Ads Manager export before touching anything. After a dozen accounts, the waste patterns got depressing in how repetitive they are:

1. **Campaigns spending with zero conversions for 2+ weeks.** Not "low" conversions — zero. Still active, still spending, because nobody sorted by results and checked.
2. **Frequency way past the fatigue point.** Saw one prospecting ad set at frequency 14. CTR had fallen off a cliff but the budget never moved.
3. **Budget fragmentation.** 30–40 ad sets each getting a few dollars a day. Nothing exits the learning phase, everything looks mediocre, so the conclusion becomes "Meta doesn't work for us."
4. **One winning ad carrying an entire ad set** while 8 variants burn spend with no path to ever winning.
5. **No structure for killing losers.** No rule for when an ad set gets paused, so decisions happen by mood.

None of this needs an agency retainer to catch — it's all sitting in the export. Sorting by spend and cross-checking conversions/frequency took me about an hour per account once I had a checklist.

Full disclosure: I got tired of doing this by hand and built a small tool (AdAudit) that runs these checks — 12 rules — on an uploaded Ads Manager export, free preview, no account access needed. Link in my profile / happy to share it in comments if mods allow. But honestly, the checklist above is the whole point of this post — you can run it yourself in a spreadsheet in under an hour.

What's the most common waste you see when you inherit an account?

### 3b. r/PPC — 数据向

**Title:** I turned my manual Meta audit checklist into 12 rules and ran the numbers — here's what the waste actually looks like

**Body:**

Background: when I inherit a Meta account, I audit the last 30–90 days of Ads Manager exports before changing anything. I eventually formalized the checklist into 12 deterministic rules. Sharing the framework because I think the *categories* are useful even if you never automate them:

**The rules (grouped):**
- **Dead spend:** campaigns/ad sets above a spend threshold with zero conversions in the window; spend on completed/expired promotions
- **Fatigue:** frequency above threshold with declining CTR vs. the account's own baseline
- **Fragmentation:** ad sets below a minimum viable daily budget relative to CPA; overlapping audiences splitting delivery
- **Structure:** ads with meaningful spend share and zero results inside otherwise healthy ad sets; too many ads per set for the budget

**What surprised me when I started tallying it:**
- Dead spend is almost never one big campaign — it's a long tail of "test" campaigns nobody paused.
- Fragmentation is the silent one: the account looks "fine" in aggregate, but no single ad set gets enough signal to optimize against.
- Fatigue waste shows up as rising CPM + falling CTR weeks before anyone notices ROAS slipping.

The fix order matters more than the fix list: kill dead spend first (pure savings), consolidate second (restores learning), refresh creative third (only after 1–2 are done, or you're pouring new ads into a leaking structure).

Disclosure: I built a tool that runs these 12 rules on an uploaded export (AdAudit — adaudit.vercel.app, free preview, file deleted after parsing, no account connection). Posting mainly for the framework — curious how other PPC folks structure their first-pass audits. What's on your checklist that I missed?

---

## 4. Indie Hackers 帖大纲

**标题候选：** "I automated the $500/mo agency audit into a $49 one-time report — launching AdAudit"

**大纲：**

1. **起点（故事）**：手动给客户做广告账户审计，一次几小时；发现浪费模式高度重复（同样的 12 类问题）。代理商对同样的事收 $500+/月、Adspirer 年费 $485 起——价格锚点说明市场已验证、且留了平价切入口。
2. **判断**：不用教育市场（广告主本来就在为审计/管理付费）；不用碰客户账户（上传导出报表即可）——信任门槛和合规风险都最低；先验证"报告值不值钱"，OAuth 直连和订阅都往后放。
3. **产品形态（一节讲清）**：免登录 → 上传 Ads Manager 导出 CSV → 12 条规则引擎（确定性计算，不靠 LLM 编数字）→ AI 只负责把发现写成人话 → 免费预览 → $49 一次性解锁完整报告（PDF + 30 天免费复测一次）。
4. **隐私作为卖点**：文件解析后即删、只读、不需要账户权限——这是对"连账户才给审"竞品的差异化。
5. **定价逻辑**：$49 是一次性决策（<$50 心理线），约代理商月费的 1/10；订阅等验证成立（≥5 单）再说，不提前承诺。
6. **判生死标准（公开写出来）**：3 周内定向触达 50 个广告主/小代理，付费 <2 单就停，≥5 单做订阅版——把标准亮出来，请 IH 社区当见证。
7. **求反馈（收尾）**：广告主们——这 12 条里哪条最戳你？复测一次的权益对决策有帮助吗？定价 $49 一次性 vs 年费，你会选哪个？

---

## 使用备注（内部）

- 全部素材只用产品事实，未出现任何用户数、评价、收入数字。
- Reddit 两帖需间隔发布、各自按社区当期规则再核一遍（尤其链接政策）；r/FacebookAds 版默认链接放 profile，r/PPC 版链接在披露句中，遇 mod 要求即删链保留正文。
- X 两条可间隔 3–5 天发，痛点向可配一张脱敏的审计发现截图（发布前确认无客户数据）。
