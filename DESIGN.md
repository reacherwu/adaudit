# DESIGN：AI 广告账户审计（Meta 起步）MVP v1

- 版本：v1.0（2026-10-21，UI/UX 设计师）
- 依据：`~/workspace/projects/_builds/ai-ad-audit/PRD.md`（F1–F10）
- 产品占位名：**AdAudit**（正式名/域名待定，视觉不得依赖品牌名长度做死布局）
- 目标读者：构建工程师。本文的线框为文字线框，标注了区块顺序、层级、文案方向与状态；不提供像素级稿。

---

## 0. 设计原则（先定调，后细节）

1. **可信 > 好看**。用户是来交出广告数据文件的——页面必须像"会计师事务所的网站"，不像"AI 创业公司的炫技页"。无渐变光晕、无 3D 插画、无动效炫技。
2. **数字先行**。每个页面上最大的视觉元素应该是数字（健康分、浪费金额、$49），不是插图。这是给广告主看的工具，他们只认数。
3. **诚实可视化**。打码是打码、估算是 estimated、示例是 Sample——这些标记在设计上是**显性元素**，不是小字脚注。信任来自把丑话说在明处。
4. **一步一屏**。上传流程每一步只问一件事。广告主不是技术用户，多一个字段就多一分流失。
5. **桌面完成、手机可读**。导出/上传在桌面完成（页面要明确提示），但落地页、处理中页、报告页在手机上必须完整可读可操作（用户大概率在手机上点开邮件链接看报告）。

---

## 1. 信息架构与页面清单

| # | 页面 | 路由 | 登录 | 核心任务 |
|---|---|---|---|---|
| P1 | 落地页（含上传区） | `/` | 否 | 说服 + 完成上传 |
| P2 | 导出指引（落地页内区块 + 独立页） | `/#how-to-export`、`/audit` | 否 | 教会非技术用户正确导出文件 |
| P3 | 留资步（弹窗） | 上传解析通过后触发 | 否（邮箱即凭证） | 收集邮箱、归属报告 |
| P4 | 处理中状态页 | `/report/[token]`（生成中态） | token | 等待 1–3 分钟不焦虑、不流失 |
| P5 | 报告页·免费预览态 | `/report/[token]` | token | 勾住：给足证据，锁住解法 |
| P6 | 报告页·付费完整态 | `/report/[token]` | token | 交付：可读、可下载、可复测 |
| P7 | 支付成功页（过场） | Creem 回跳 `/report/[token]?paid=1` | token | 确认 + 2 秒内回到完整报告 |
| P8 | 支付失败页 | Creem 回跳（失败态） | token | 不丢单：原因 + 一键重试 |
| P9 | 静态页 | `/privacy`、`/terms` | 否 | 如实写明文件删除、90 天留存、退款规则 |
| P10 | 错误/失效页 | 报告 token 失效、404 | — | 引导联系支持，不露技术信息 |

> 说明：P1 与 P2 的上传区是同一组件两种出现方式（落地页内嵌 + 独立 `/audit` 页），设计一套即可。P4/P5/P6 是同一路由的三种状态，骨架共用。

---

## 2. 视觉风格

### 2.1 配色

底色与文字用中性灰阶，品牌色只用一种深蓝，语义色克制使用。总色数（含语义色）≤ 7。

| 角色 | 色值 | 用途 |
|---|---|---|
| 背景 | `#FFFFFF` / `#F7F8FA`（区块交替） | 页面底、卡片底 |
| 主文字 | `#14202E`（近黑蓝灰） | 标题、正文 |
| 次文字 | `#5A6B7C` | 说明、脚注、次要信息 |
| 品牌/主操作 | `#1D4ED8` → 压深用 `#1E40AF` | 主 CTA、链接、选中态 |
| 边框/分隔 | `#E2E8F0` | 卡片边、表格线 |
| 健康分·好 | `#15803D`（绿） | 80–100 Healthy |
| 健康分·中 | `#B45309`（琥珀） | 40–79 Needs work / Wasteful |
| 健康分·差/浪费金额 | `#B91C1C`（暗红） | 0–39 Critical、浪费金额、HIGH 严重度 |
| 警告底 | `#FFFBEB` / 错误底 `#FEF2F2` | 提示条、报错条背景 |

规则：
- 红色只给"钱在浪费"和真错误，不许用作装饰或促销（不用红价签、不用"限时"红字）。
- 健康分颜色与 PRD 分级严格对应（80+ 绿 / 60–79 琥珀 / 40–59 琥珀加深或保持琥珀 / 0–39 红），四级色板在报告页与示例卡上完全一致。
- 不用紫蓝渐变、不用玻璃拟态、不用阴影堆叠；卡片深度只靠 1px 边框 + 极浅阴影（`0 1px 2px rgba(16,24,40,.05)`）。

### 2.2 字体

- 西文字体栈：`Inter, -apple-system, "Segoe UI", Roboto, sans-serif`（Inter 优先，系统字体兜底，保证加载快）。
- 数字一律用等宽数字特性：`font-variant-numeric: tabular-nums`——健康分、金额、表格列必须对齐，这是"专业感"的最大来源。
- 字号阶梯：H1 40/48（移动 30/38）、H2 28/36、H3 20/28、正文 16/26、次要 14/22、脚注 13/20。报告正文不小于 15px。
- 金额与分数用字重 700；标题 650–700；正文 400；不用 300 以下细体（投影/手机上不可读）。

### 2.3 气质与图形语言

- 气质关键词：**audit（审计）、ledger（账本）、plain（朴素）**。像 Stripe 文档 + 会计报告，不像 AI 工具落地页模板。
- 图标：单色线性图标（Lucide 风格，2px 描边），只用于导航性位置（上传、锁、下载、盾牌），不做装饰图标墙。
- 截图/示例：只用真实产品界面截图（示例报告卡），截图上压 "SAMPLE" 角标（见 §3.4）；不使用 stock 图、不使用人物头像式"用户证言"（PRD 明令禁止伪造证言）。
- 圆角：卡片 8px、按钮 6px、输入框 6px——克制的商务圆角，不用大圆角胶囊风。
- 动效：仅允许状态过渡（上传进度条、骨架屏、展开/收起 150ms）；无入场动画、无视差滚动。

---

## 3. P1 落地页

### 3.1 结构（单列居中，内容宽 1120px，区块顺序按 PRD F1 固定）

```
┌────────────────────────────────────────────────────┐
│ [logo AdAudit]                    Privacy · FAQ · Contact │  ← 顶栏 56px，吸顶，底边 1px
├────────────────────────────────────────────────────┤
│                                                    │
│   Your agency charges $500+/mo to manage ads.      │  ← H1，左对齐，两行内
│   We find what they're wasting —                   │
│   in 3 minutes, for $49.                           │
│                                                    │
│   Upload your Ads Manager export. Get a full       │  ← 副标题 18px 次文字
│   audit in ~3 minutes. No account access needed.   │
│                                                    │
│   [ Run my free audit → ]     Free preview ·       │  ← 主 CTA（跳 #upload）+ 辅助说明
│                               Full report $49 once │
│                                                    │
│   ┌──────────────────────────────────────────┐   │
│   │ ▸ 示例报告卡缩略（Sample 角标）              │   │  ← Hero 右侧或下方：真实报告卡样式
│   │ Health Score 47/100 — Wasteful              │   │     的静态预览，让用户先看到"产品长什么样"
│   │ Estimated waste: $612/mo                    │   │
│   └──────────────────────────────────────────┘   │
├────────────────────────────────────────────────────┤
│  🔒 Read-only  ·  🗑 Your file is deleted after    │  ← 信任条：浅灰底，横向三等分，
│     analysis  ·  🚫 No password, no account access │     移动端纵向堆叠
├────────────────────────────────────────────────────┤
│  What we check（H2）                                │
│  ┌───────────────┐ ┌───────────────┐               │  ← 2 列（移动 1 列）清单卡，
│  │ Ad sets spending│ │ High frequency, │               │     每条 = 一句问题 + 一句"为什么烧钱"
│  │ with 0 sales…   │ │ tired audiences…│               │
│  └───────────────┘ └───────────────┘  ×6–8 条       │
├────────────────────────────────────────────────────┤
│  #upload 上传区（见 §4，含导出指引链接）            │
├────────────────────────────────────────────────────┤
│  Sample report（H2）+ 完整示例报告卡（见 §3.4）      │
├────────────────────────────────────────────────────┤
│  Pricing（H2）—— 两列对比卡（见 §3.5）              │
├────────────────────────────────────────────────────┤
│  FAQ（H2）—— 手风琴 5–6 条（见 §3.6）               │
├────────────────────────────────────────────────────┤
│  页脚：Privacy · Terms · Contact(service@…)        │
│  "Files are deleted after analysis. Reports are    │
│   kept for 90 days."                                │
└────────────────────────────────────────────────────┘
```

### 3.2 Hero 文案方向（英文示例）

- H1（PRD 卖点句，不改语义，可调断行）：`Your agency charges $500+/mo to manage ads. We find what they're wasting — in 3 minutes, for $49.`
- 副标题：`Upload your Ads Manager export. Get a full audit in ~3 minutes. No account access needed.`
- CTA：`Run my free audit`（按钮）；按钮旁小字：`Free preview — no card required.`
- 禁忌：不出现 "AI-powered"、"revolutionary"、"10x"、用户数、评价星。不许编造任何数字（PRD §8 文案诚实）。

### 3.3 "What we check" 清单文案（对应规则 R1–R12，取 6–8 条说人话）

每条格式：**问题**（粗体短句）+ 一句后果。

- `Ad sets spending with zero conversions` — Money going out, nothing coming back. We flag every one.
- `CPA blowouts` — Ad sets paying 2× or more per sale than your account average.
- `Audience fatigue` — The same people seeing your ad 4, 5, 6 times while clicks fall off.
- `Fragmented budgets` — Too many small ad sets, none with enough data to learn.
- `Cheap-traffic traps` — Suspiciously cheap clicks that never buy.
- `Missing conversion tracking` — If Results is empty, you're flying blind — and paying for it.
- `One-ad dependency` — 80% of spend riding on a single ad is a risk, not a strategy.
- `Click-rate collapse` — Thousands of impressions, almost no clicks.

### 3.4 示例报告卡（Sample）

- 样式 = 真实报告页的缩小版（同色板、同评分卡、同 Waste list 行样式），保证"所见即所得"。
- 右上角固定角标：`SAMPLE`（琥珀底深字，12px，大写）。卡内脚注一行：`Sample report generated from demo data. Your numbers will differ.`
- 内容用 PRD §6 示例数据（47/100、$612、3 条 waste、What's working 1 条），Fix checklist 只露标题行带锁图标（与免费预览态一致，顺带教育付费墙长什么样）。
- 禁止：星级、头像、引言式证言、"join 2,000+ advertisers" 类任何社会证明数字。

### 3.5 定价区

两列并排卡（移动端纵向），**不做三档**（v1 只有一个付费点）：

| | Free preview | Full report — $49 one-time |
|---|---|---|
| 视觉 | 白底、灰边、标题 20px | 白底、品牌蓝 2px 边、标题含价格大字 `$49` |
| 内容 | Health score & grade / Number of issues found / Estimated total waste / First waste item in full | Everything in Free, plus: / Every waste item with evidence & $ / Full fix checklist (this week / this month / later) / What's working / PDF download / 1 free re-check within 30 days |
| CTA | `Run free audit`（锚点回 #upload） | `Upload & unlock — $49`（锚点回 #upload；价格在点支付前再次出现，不玩到结账才见价） |

价格卡下方一行对比锚（次文字，事实陈述）：`For scale: one month of agency ad management typically costs $500+. This is a one-time payment — not a subscription.`

### 3.6 FAQ（手风琴，默认全收起；问题即用户疑虑原文）

1. `What file do I need to upload?` — A CSV or Excel export from Ads Manager, last 30 days, ad set level. Step-by-step with screenshots: → How to export（锚点 #how-to-export）。
2. `Do you need access to my ad account?` — No. No login, no password, no API access. You upload one file; that's all we ever see.
3. `What happens to my file?` — It's parsed on our server and deleted immediately after analysis. We keep only the report and summary numbers, for 90 days, then they're deleted too.
4. `How long does it take?` — About 3 minutes. We email you the link when it's ready.
5. `What if my report can't be generated?` — You get a full automatic refund. No forms, no emails to support.
6. `Is the "estimated waste" real money I lost?` — It's an estimate from your own numbers, and every item shows its math. We label estimates as estimates — check our methodology note on every report.（口径诚实，FAQ 里就把丑话说了）

### 3.7 状态

- 空态：落地页无用户数据，无空态。
- 加载态：首屏无异步内容；示例卡为静态渲染，不许出现骨架屏闪烁。
- 报错态：锚点跳转失败等前端问题不单独设计；上传区错误见 §4.5。

---

## 4. P2 上传页 / 上传区组件（含导出指引）

上传是全站转化生死点，单独成节。组件出现在 `/` 的 `#upload` 区块和独立 `/audit` 页（独立页 = 顶栏 + 标题 + 本组件 + 信任条简版 + 页脚）。

### 4.1 结构线框

```
┌──────────────────────────────────────────────────┐
│  Run your free audit（H2，仅独立页）/             │
│  Start with your Ads Manager export（H2，落地页）  │
│  Takes ~3 minutes · Free preview · No account     │
│  access needed                                    │
│ ┌──────────────────────────────────────────────┐ │
│ │  Step 1 — Export from Ads Manager            │ │  ← 指引区（默认展开，与上传同屏，
│ │  [ 迷你步骤条 1→2→3→4，见 §4.2 ]              │ │     不许藏进"帮助"链接里）
│ │  Not sure? See the full guide →              │ │
│ ├──────────────────────────────────────────────┤ │
│ │  Step 2 — Upload your file                   │ │
│ │  ┌ - - - - - - - - - - - - - - - - - - - ┐  │ │
│ │  │   ⬆  Drag your .csv or .xlsx here     │  │ │  ← 拖放区：虚线边，hover/拖入
│ │  │      or [ Browse files ]              │  │ │     时品牌蓝实线 + 浅蓝底
│ │  │      Max 10 MB · Up to 50,000 rows    │  │ │
│ │  └ - - - - - - - - - - - - - - - - - - - ┘  │ │
│ │  Data level: (•) Ad sets (recommended)       │ │  ← 单选，必选，默认广告组
│ │              ( ) Ads                         │ │
│ │  ▸ Optional: help us tune the audit          │ │  ← 折叠区，默认收起：
│ │     Target CPA ($) [____]  Monthly budget    │ │     目标 CPA、月预算、行业下拉
│ │     ($) [____]  Industry [ select ▾ ]        │ │     三个字段，每个带"Optional"标注
│ │                                              │ │
│ │  [ Analyze my ads — free ]  ← 文件选好前置灰  │ │
│ └──────────────────────────────────────────────┘ │
│  🖥 Best done on a desktop — Ads Manager exports  │  ← 移动端访问时才显示此提示条
│  are easier to download on a computer.           │
└──────────────────────────────────────────────────┘
```

关键交互规则：
- 未选文件时主按钮置灰（disabled + 说明文字 `Choose a file to continue`）；选好文件立刻显示文件名 + 大小 + 行数预检（如可前端粗读）+ `[✕ Remove]`。
- 点 `Analyze my ads — free` → 先上传进度（见 §4.4）→ 服务端解析 → 通过才弹留资弹窗（P3）。**邮箱不在此页收**，避免用户在没见到任何价值前被要邮箱。
- 可选字段折叠默认收起，标题写明 `Optional — skip if you're not sure`，不填不影响流程，不许红星、不许拦截。

### 4.2 导出指引的呈现方式（转化关键，单独定死）

指引有三层，逐层加深，用户卡在哪层就停在哪层：

**第一层：迷你步骤条（与上传区同屏，默认可见）**
横向 4 步编号条（移动端纵向），每步一句话 + 一个关键界面词加粗：

1. `Open Ads Manager → pick your ad account → set date range: Last 30 days`
2. `Go to the Ad sets tab`
3. `Columns → Customize Columns → tick the required columns`（"required columns" 是可点链接，展开第三层清单）
4. `Export → CSV or Excel → upload the file here`

每步配一张小截图缩略图（Ads Manager 真实界面截图，关键按钮用品牌蓝描边框出，不用手绘示意图冒充）。点缩略图放大（lightbox）。

**第二层：完整图文指南（落地页 `#how-to-export` 区块 / 指南展开态）**
四步逐条展开：大截图（宽度 100%，≤720px）+ 2–3 句说明 + 一句常见错提示，如：
- Step 3 下方提示条（琥珀底）：`The #1 mistake: forgetting the Results and Cost per result columns. Without them we can't measure waste.`
- Step 1 下方：`Use the last 30 days. Shorter ranges make the audit unreliable; we'll tell you if your file covers less.`

**第三层：必需列清单（可展开表格 + 一键对照）**
表格两列：`Column in Ads Manager` | `Why we need it`，内容按 PRD F2 必需列表（Campaign name / Ad set name / Amount spent (USD) / Impressions / Reach / Frequency / Clicks (all) / CTR (all) / CPC (all) / Results / Cost per result）。清单上方一行：`Ticking extra columns is fine — missing one of these is what breaks the export.` 这份清单与解析报错（§4.5）里"缺哪列"的文案必须用同一套列名，用户能直接对照补勾。

### 4.3 上传中状态

- 拖放区替换为进度态：文件名、已传百分比进度条（品牌蓝实色，非动画条纹）、`Uploading…` 文案；>2MB 文件显示预计秒数不必精确。
- 上传完成自动进入 `Checking your file…`（服务端解析，骨架脉冲 + 步骤文案轮换：`Reading columns → Checking data quality`，只写真实阶段，不编假进度百分比）。

### 4.4 文件被拒（格式/超限）—— 就地报错，不跳页

报错出现在拖放区正下方，红底条（`#FEF2F2`）+ 红字 + 一句"怎么改"，文件不进入流程：

| 情况 | 文案（英文示例） |
|---|---|
| 格式不对 | `That file type won't work. Upload a .csv or .xlsx export from Ads Manager.` |
| 疑似宏/伪装（xlsm、zip 改名） | `This file looks like a macro or archive file, which we can't accept. In Ads Manager, choose Export → CSV instead.` |
| 超 10 MB | `This file is 14.2 MB — over the 10 MB limit. Export the last 30 days only, at ad set level, and try again.` |
| 超 50,000 行 | `This file has 62,300 rows — over the 50,000-row limit. Split by campaign or shorten the date range.` |
| 空文件/读不出 | `We couldn't read any rows in this file. Re-export from Ads Manager and make sure the date range actually has data.` |

每条错误条右侧带 `[ Try again ]`（重置上传区）。错误文案铁律：**说清是什么错 + 用户下一步做什么**，禁止出现 error code、"invalid file" 式空话。

### 4.5 解析失败（列缺失/数据质量门）—— 全屏接管态（仍在上传页内）

解析在服务端完成后失败，不弹 toast（太轻、易错过），用上传区整块替换为失败说明卡（白底、红左边框 3px）：

```
┌──────────────────────────────────────────────────┐
│ ⚠ We can't audit this file yet                    │
│                                                  │
│ Your export is missing 2 columns we need:        │
│   ✗ Results            ← 我们读到的列名对照表      │
│   ✗ Cost per result       （见下）                 │
│                                                  │
│ Columns we found in your file:                   │
│ Campaign name, Ad set name, Amount spent, …      │
│                                                  │
│ How to fix: Ads Manager → Columns → Customize    │
│ Columns → tick the missing ones → Export again.  │
│ [ See the step-by-step guide ]                   │
│                                                  │
│ [ Upload a corrected file ]   ← 主按钮，回到上传态 │
│ Your file has been deleted — we don't keep it.   │
└──────────────────────────────────────────────────┘
```

变体（文案替换主体部分，其余骨架不变）：
- 总花费为 0 / 数据期为空：`This export shows $0 spend. That usually means the date range was empty or the wrong ad account was selected. Check the range covers days with active ads, then re-export.`
- 行数 < 3：`Only 2 rows in this file — too little data to audit. Export at ad set level for the last 30 days.`
- 关键列全空（如 Results 列存在但全空 → 这是 R5 的报告级发现，**不报错**，正常出报告；仅当花费等基础列全空才走失败卡。设计与实现须区分这两类，PRD F3 数据质量门为准。）

---

## 5. P3 留资弹窗（邮箱）

时机：解析通过、点名"文件没问题"之后、生成开始之前。模态弹窗，宽 440px（移动端全屏底部弹出式 sheet），不可点遮罩关闭（但右上角有 ✕，关闭 = 回到上传完成态，文件已删，需重新上传——关闭时二次确认一行字说清这点，别让用户白白丢掉进度）。

```
┌──────────────────────────────────────┐
│ Where should we send your audit?  ✕  │
│                                      │
│ Your file checks out — 38 ad sets,   │  ← 先给价值确认：解析出的人话摘要
│ $4,213 spent in the period.          │     （行数/总花费来自真实解析结果）
│                                      │
│ Email                                │
│ [ you@company.com              ]     │
│                                      │
│ We'll email you the report link.     │
│ The link is your key — there's no    │
│ account and no password.             │
│                                      │
│ ☐ Email me when the subscription     │  ← opt-in，默认不勾（PRD F8）
│   version launches (optional)       │
│                                      │
│ [ Send my free preview ]             │
│                                      │
│ We never sell your data. Your file   │  ← 脚注 13px 次文字
│ is already deleted.                  │
└──────────────────────────────────────┘
```

状态：
- 邮箱格式错：输入框红边 + 下方红字 `That doesn't look like an email address.`，按钮不提交。
- 提交中：按钮转 loading（`Sending…`）防重复点击。
- 提交失败（网络/服务端）：弹窗内顶部红条 `Something went wrong sending that. Your file data is safe — try again.` + 重试按钮；**不关弹窗、不丢上下文**。
- 成功：弹窗关闭 → 跳 `/report/[token]` 处理中态（P4）。同时发邮件（邮件含报告链接；弹窗关闭瞬间页面一句话提示 `We've also emailed the link to you@….`）。

---

## 6. P4 处理中状态页

路由 `/report/[token]` 的生成中态。用户可能留在页面等，也可能关掉去等邮件——两种都要照顾。

```
┌──────────────────────────────────────────────────┐
│ [logo]                                    (无导航) │
│                                                  │
│        ◌  Auditing your account…                 │  ← 大标题 + 低调 spinner
│                                                  │
│        ✓ File received & checked                 │  ← 真实阶段清单，已完成打勾，
│        ✓ 12 checks run against your data         │     进行中转圈，未开始置灰——
│        ◌ Writing your report                     │     阶段名与后端实际阶段对应，
│        ○ Preparing your preview                  │     不许编造百分比
│                                                  │
│        This usually takes 1–3 minutes.           │
│        You can close this page — we'll email     │
│        the link to you@company.com when it's     │
│        ready.                                    │
└──────────────────────────────────────────────────┘
```

- 实现提示（给工程师）：前端轮询状态接口（PRD F9 进度态），阶段文案由服务端状态驱动。
- 超时降级态（>3 分钟仍未完成）：清单下方出现琥珀提示条：`Taking longer than usual — this can happen with larger accounts. We'll email you the moment it's ready. You can safely leave this page.` 不许无限转圈无解释。
- 生成失败态（LLM 与模板双双失败/系统错误）：整页替换为失败卡：标题 `We couldn't finish your audit` + 正文道歉与说明 + `If you paid anything, it will be refunded automatically.`（未付费阶段则为 `You haven't been charged.`）+ `Contact us: service@…` 按钮 + `[ Start over ]` 回落地页。（注：按 PRD F6，LLM 失败应回退模板报告，此态仅兜底系统性失败。）
- 模板回退报告的标注位置：若报告为模板回退版，报告页摘要区上方有一行小字条 `Summary generated from rule data.`（PRD F6 原文），设计上用次文字 13px，不用警告色——这是降级不是错误。

---

## 7. P5/P6 报告页（核心页）

### 7.1 通用骨架（预览态与完整态共用）

内容宽 800px 单列（报告是阅读物，不用宽屏）。顶部不放站级导航，只放一行极简头：logo + `Report for [邮箱打码显示，如 a•••@company.com]` + 生成日期与数据期。

```
┌──────────────────────────────────────────────────┐
│ AdAudit — Audit report        Generated Oct 21,  │
│                               Data: last 30 days │
├──────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐ │
│ │  47  /100        Wasteful                    │ │ ← 健康分大字卡：分数 64px 等宽数字，
│ │  ██████░░░░  (bar)                           │ │    分级词 + 一句话理由在其右
│ │  "Three ad sets are burning budget with      │ │
│ │   no sales to show for it."                  │ │
│ │  Estimated waste last 30 days:  $612 (est.)  │ │ ← 浪费金额独立行，暗红，带 (estimated)
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Executive summary                                │  ← H3 段标题，LLM 文案 3–4 句
│ …                                                │
│                                                  │
│ WASTE LIST — 9 issues found                      │  ← 计数在标题里
│ ┌──────────────────────────────────────────────┐ │
│ │ 1. [HIGH] 3 ad sets spent $847 with zero     │ │ ← 每条一张卡，见 §7.2
│ │    conversions …                             │ │
│ └──────────────────────────────────────────────┘ │
│ …（其余条目，预览态打码，见 §7.3）                  │
│                                                  │
│ FIX CHECKLIST                                    │
│ This week （预览态：只显示组名 + 条数）            │
│ …                                                │
│                                                  │
│ WHAT'S WORKING                                   │
│ …                                                │
│                                                  │
│ [ 未付费 → 解锁区（付费墙），见 §7.4 ]             │
│ [ 已付费 → Download PDF 按钮区，见 §7.5 ]          │
│                                                  │
│ ──────────────────────────────────────────────   │
│ How this score works: …（口径脚注，见 §7.6）       │
│ Your file was deleted after analysis. This       │
│ report is kept for 90 days. [Delete it now]      │
└──────────────────────────────────────────────────┘
```

### 7.2 单条 Waste 卡（完整态）

```
┌──────────────────────────────────────────────┐
│ [HIGH]  3 ad sets spent $847 with 0 sales    │  ← 严重度徽标（HIGH 红/MED 琥珀/LOW 灰）
│                                              │     + 标题（结论句，不是规则名）
│ Evidence: $847.00 spent · 0 results ·        │  ← 证据行：等宽数字，分隔点排版，
│ 41,208 impressions · last 30 days            │     数字全部来自规则引擎
│                                              │
│ Why it matters: …（LLM 影响说明 1–2 句）       │
│ Estimated waste: $847 (estimated)            │  ← 金额行；不估算的条目此行为
│                                              │     "Tracking issue — no waste estimated."
│ Applies to: "Spring Sale — Broad",           │  ← 命中的广告组名逐个列出
│ "Retargeting — 30d", "Lookalike 2%"          │     （PRD 去重规则：按组聚合展示）
└──────────────────────────────────────────────┘
```

低置信度条目（如 R8 受众重叠）在卡内额外一行斜体次文字：`Likely overlap — CSV data can't confirm targeting overlap; check the Audience Overlap tool in Ads Manager.`（PRD 指定文案方向，设计上必须预留此行，不许被"优化掉"。）

### 7.3 免费预览态 vs 付费完整态的视觉区分（本页设计核心）

原则：**预览态必须看起来像一份真报告被锁住了一部分，而不是一份残缺报告。** 骨架、排版、卡片数、条目标题全部真实呈现；被锁的只有"具体数字与解法"。

| 元素 | 免费预览态 | 付费完整态 |
|---|---|---|
| 健康分卡 | 完整可见（分数、分级、浪费总额，均真实） | 同左 |
| Executive summary | 完整可见 | 同左 |
| Waste 第 1 条 | **完整可见**（证据、金额、影响全开） | 完整可见 |
| Waste 第 2 条起 | 标题可见；证据行与金额做**内容替换式打码**：数字位置渲染为 `████` 等宽黑块（不是 CSS blur——服务端本就不下发真实数字，PRD F7 门禁，前端打码只是呈现），影响说明隐藏 | 全部真实渲染 |
| Fix checklist | 只显示三组组名 + 每组条数：`This week — 3 fixes`、`This month — 2 fixes`、`Later — 1 fix`，正文位置渲染为锁行（🔒 + 灰色占位条） | 完整条目：动作 + Ads Manager 操作路径 + 预期效果 |
| What's working | 完整可见（好消息不锁——建立信任，且不构成付费核心价值） | 同左 |
| PDF 下载 | 无按钮，解锁区内列为权益之一 | 有（见 §7.5） |
| 顶部状态条 | 有（见下） | 无状态条；改为已购标识行（见 §7.5） |

**预览态顶部固定条**（sticky，出现在报告页顶部、滚动时跟随）：浅蓝底（`#EFF6FF`），一行字 + 按钮：
`Free preview — 1 of 9 issues shown in full.` `[ Unlock full report — $49 ]`
页面滚到底部解锁区时该条仍在，保证任何位置都能转化；但**不许弹窗、不许遮罩全屏拦截阅读**（用户正在读第 1 条和 summary 时被弹窗打断 = 信任杀手）。

**打码呈现规范**（重要）：黑块用等宽字符块渲染，长度与真实内容无关（固定 4–8 块），避免从长度泄露数字位数；锁行占位条高度固定。视觉上黑块 + 锁图标传达"这里有真东西被锁住"，配合每条标题（标题是真实的、具体的）形成钩子——标题本身就是广告：`Ad set "Retargeting — 30d" hit frequency 6.2` 这种标题即使金额打码也足够勾人，但注意：标题中若含具体数字（如频次 6.2），按服务端裁剪口径——被裁剪字段一律不出现在前端，标题由服务端生成预览版标题（如 `Frequency is far too high on "Retargeting — 30d"`）。设计只定原则：**前端不持有未付费内容的任何真实片段**。

### 7.4 付费墙位置（解锁区）

位置：**Waste list 之后、Fix checklist 之前**再加一个内嵌解锁卡 + **页尾完整解锁区**，两处。理由：用户读完浪费清单是痛感峰值，此刻给墙；Fix checklist 是他最想要的东西，把墙放在它前面而不是报告最末尾（末尾时用户已划走）。

内嵌解锁卡（Waste 与 Fix 之间，白底、品牌蓝 2px 边、宽同正文）：

```
┌──────────────────────────────────────────────┐
│ Unlock the full report                       │
│                                              │
│ ✓ All 9 waste items — with evidence & $      │  ← 权益清单，数字来自本报告真实计数
│ ✓ The full fix checklist (6 fixes, ordered)  │
│ ✓ PDF download for your records              │
│ ✓ 1 free re-check within 30 days             │
│                                              │
│ [ Unlock now — $49 one-time ]                │  ← 主按钮；下方小字：
│ One-time payment. Not a subscription.        │
│ If we can't generate your report, you're     │
│ refunded automatically.                      │
└──────────────────────────────────────────────┘
```

页尾解锁区与内嵌卡内容一致（可复用组件），多一行复测说明。点击任一解锁按钮 → 跳 Creem Checkout（站外支付页）；按钮点击后变 loading 态防重复下单。

### 7.5 付费完整态的差异点

- 顶部状态条消失，改为健康分卡上方一行已购标识（次文字 + 绿勾）：`Full report unlocked · Order #… · Paid Oct 21`。
- Fix checklist 每条结构：`[P0] Pause or fix the 3 zero-conversion ad sets` + 操作路径小字（`Ads Manager → Ad sets → select → Pause`，等宽/次文字呈现，像操作手册）+ 预期效果一句。三组之间以组标题分隔（`This week` / `This month` / `Later`）。
- 健康分卡下方、页尾解锁区原位置 → **下载与复测区**：
  - 主按钮 `[ Download PDF ]`（次级样式，非品牌蓝实心——报告已买完，不要再用促销式按钮）+ 说明 `Same content as this page, with date and methodology notes.`
  - 复测行：`Fixed things? Re-check free within 30 days — [ Upload a new export ]`（链回 /audit，凭订单邮箱自动解锁逻辑按 PRD F7）；已用掉后此行改为次文字 `Your free re-check was used on Nov 2.`；超 30 天改为 `Re-checks are $49 — [ Run a new audit ]`。
- 生成失败退款等售后信息不在已购页出现，只在 FAQ/条款。

### 7.6 报告页脚注区（诚实区，固定文案位）

- 口径：`Score is a heuristic based on the checks above — not an industry standard. Waste figures marked (estimated) are estimates from your own data; each item shows its math.`（PRD F5/F6 指定口径）
- 数据：`Your uploaded file was deleted immediately after analysis. This report and its summary data are kept for 90 days, then deleted. [ Request early deletion ]`（链到联系邮箱 mailto）。
- 模板回退标注（仅回退版出现）：`Summary generated from rule data.`（见 §6）。

### 7.7 报告页其他状态

- **链接失效/不存在的 token**：整页错误卡：标题 `This report link doesn't work` + `It may have expired (reports are kept for 90 days) or the link was copied incompletely.` + `[ Contact support ]`（mailto，带上用户可粘贴的 token 后 6 位示意？不——错误页不回显 token，只给邮箱） + `[ Back to home ]`。
- **报告已删（90 天到期）**：标题 `This report has been deleted` + 一句说明 + `[ Run a new audit ]`。
- **空态**：报告不存在"无问题"空态的缺失设计——若规则零命中（如健康账户），Waste list 区替换为绿色确认卡：`No waste found in the checks we run. Your account passed all 12 checks for this period.` + What's working 照常 + 解锁区权益文案随之调整（仍售 Fix checklist 的"保持建议"？——设计口径：零命中时付费墙文案改为 `Get the full report — including what's working and your maintenance checklist`，**不许编造不存在的问题凑数**，此为诚实红线，工程师与文案共同遵守）。

---

## 8. P7/P8 支付成功 / 失败

支付在 Creem 托管页完成，本产品只设计回跳后的两页。

### 8.1 支付成功（过场页 → 自动回报告）

- 回跳到 `/report/[token]?paid=1`：报告页顶部出现绿色确认条（5 秒后淡出或手动关闭）：`Payment received — your full report is unlocked.` 同时页面已是完整态（服务端 webhook 解锁可能有秒级延迟：若回跳时订单状态未更新，页面显示过渡态——健康分卡位置出现 `Unlocking your report…` + 自动轮询，≤30 秒；超时仍未解锁 → 确认条变琥珀色：`Payment received — unlocking is taking longer than usual. We'll email you the moment it's ready, and your link stays the same.` **绝不让已付费用户看到付费墙还挂着**——延迟态下隐藏全部解锁 CTA。）
- 独立中转页仅作兜底（webhook 环境异常时）：居中卡片 `Payment received ✓` + `Taking you to your report…` + 3 秒自动跳转 + 手动链接 `[ Go to my report ]`。

### 8.2 支付失败

回跳失败态落在报告页顶部红色提示条 + 解锁区保持可用（不单独整页，避免用户迷路）：

```
┌──────────────────────────────────────────────┐
│ ✗ Your payment didn't go through.            │
│ No charge was made. Your preview is still    │
│ here — pick up right where you left off.     │
│ [ Try again — $49 ]   [ Use a different card ]│  ← 两按钮均回 Creem 结账
└──────────────────────────────────────────────┘
```

- 若 Creem 回传具体失败原因（如卡被拒），在条内加一行次文字如实转述（`Your card was declined.`），不猜测、不夸大。
- 失败 3 次以上：提示条追加 `Still stuck? Email us at service@… — we'll sort it out.`（人工兜底，符合退款/售后走邮件的 PRD 口径）。
- 设计铁律：失败态**不得**清空或降级用户已看到的免费预览内容；不得出现"重新上传"要求。

---

## 9. 全状态总表（验收对照）

| 页面 | 空态 | 加载态 | 报错态 |
|---|---|---|---|
| 落地页 | 无数据依赖，无空态 | 静态渲染，无骨架屏 | 锚点/静态资源异常不单独设计 |
| 上传区 | 初始态 = 拖放虚线框 + 指引步骤条 | 上传进度条 → `Checking your file…` 阶段文案 | 格式/超限/宏文件：拖放区下方红条就地报错（§4.4）；缺列/质量门：整块失败卡 + 两列对照（§4.5） |
| 留资弹窗 | — | 提交按钮 loading | 邮箱格式红边红字；发送失败弹窗内红条 + 重试（§5） |
| 处理中页 | — | 阶段清单（真实阶段驱动） | >3 分钟琥珀提示；系统失败整页失败卡 + 退款口径（§6） |
| 报告页·预览 | 零命中 → 绿色"全通过"卡替换 Waste 区（§7.7） | 骨架屏（分数卡 + 条目卡轮廓）≤1 屏 | token 失效/已删除整页错误卡（§7.7） |
| 报告页·完整 | 同上 | 同上；解锁延迟态单独处理（§8.1） | PDF 生成失败：按钮旁红字 `We couldn't build the PDF just now — try again in a minute, or email us and we'll send it.`（不许静默失败） |
| 支付 | — | 回跳轮询解锁中 | 失败红条 + 重试/换卡 + 3 次后人工兜底（§8.2） |

---

## 10. 移动端适配要点

断点：`≤768px` 为移动布局；内容不横向滚动是硬指标（含报告表格/证据行）。

1. **落地页**：H1 降至 30px、左对齐不变；信任条三格纵向堆叠；"What we check" 单列；定价两列改纵向（Full report 卡在前——移动端用户先看价格再决定往不往下读，顺序与桌面相反）；上传区顶部出现桌面提示条：`🖥 You'll need a computer to export from Ads Manager — but you can read everything here and come back.` 同时给一个 `[ Email me the link for later ]` 次级入口？——**v1 不做**（PRD 无此功能），改为提示条文案引导用户在桌面打开本站即可，不画不存在的按钮。
2. **上传区**：拖放区在移动端保留但主操作改为大号 `[ Browse files ]` 按钮（移动端无拖拽习惯）；步骤条纵向；可选字段全宽单列。
3. **留资弹窗**：底部 sheet 式上滑，邮箱输入框字号 ≥16px（防 iOS 自动缩放），按钮吸底。
4. **处理中页**：阶段清单全宽，字号不变；提示文案保留"可关页等邮件"（手机用户更可能关页）。
5. **报告页**（移动端是报告的主阅读场景，优先级最高）：单列天然适配；健康分卡内分数与分级改为上下排（分数 56px）；Waste 卡证据行允许换行但数字不拆行（`white-space: nowrap` 于数字片段）；顶部解锁条 sticky 保留但按钮缩为 `$49 Unlock` 短文案，高度 ≤48px 不挡内容；Fix checklist 操作路径小字不小于 13px。
6. **触控**：所有可点元素 ≥44px 高；手风琴（FAQ、列清单、可选字段）展开区带足够内边距。
7. **性能**：落地页首屏不加载报告页资源；示例卡用静态图/HTML 直出；全站不依赖 Web Font 加载完成才显示文字（`font-display: swap`）。

---

## 11. 组件清单（工程师拆分用）

| 组件 | 出现位置 | 备注 |
|---|---|---|
| `TopBar` / `Footer` | 全站 | 页脚含删除/留存一句话说明 |
| `TrustBar` | 落地页、/audit | 三项信任点，文案与实现一致才准上 |
| `SampleReportCard` | 落地页 ×2（Hero 缩略 + Sample 区完整） | 带 SAMPLE 角标，数据写死为示例数据并注释标明 |
| `ExportGuide`（三层：步骤条/图文/列清单） | 落地页、/audit、解析失败卡内链接 | 列名与服务端列映射共用同一常量来源 |
| `UploadBox`（拖放+选项+可选字段折叠） | 落地页 #upload、/audit | 状态机：idle → uploading → checking → error-inline / error-card |
| `EmailCaptureModal` | 上传解析通过后 | 含解析摘要回显（行数/总花费） |
| `ProcessingState` | /report/[token] | 阶段清单由服务端状态驱动 |
| `ScoreCard` | 报告页 | 分级色板单一数据源 |
| `WasteItemCard`（含 locked 变体） | 报告页 | locked 变体只接收标题与占位，不接收真实数字 |
| `FixChecklist`（含 locked 变体） | 报告页 | locked 只显示组名+计数 |
| `UnlockCard` / `UnlockStickyBar` | 报告页预览态 | 权益数字来自报告真实计数 |
| `PaymentBanner`（success/unlocking/failure） | 报告页顶部 | 三态，failure 带重试计数逻辑 |
| `ErrorCard`（token 失效/已删除/生成失败） | 报告页、兜底 | 文案模板三套 |

---

## 12. 设计红线（与 PRD 对齐，交付时逐项自查）

1. 不出现任何编造的用户数、评价、收入、星级、头像证言。
2. 所有估算数字旁必有 `(estimated)`；示例必有 `SAMPLE`。
3. 未付费内容不以任何形式出现在前端（blur 假打码禁止，必须是服务端裁剪 + 前端黑块占位）。
4. 付费墙不弹窗、不拦截阅读；价格 $49 在落地页、定价区、解锁条、结账前四处一致可见。
5. 每个错误都给"下一步动作"；每个等待都给"可以离开"的出口。
6. 红色只用于浪费与真实错误；无倒计时、无"限时优惠"、无虚假稀缺。
