# PRD：AI 广告账户审计（Meta 起步）MVP v1

- 版本：v1.0（2026-10-21，产品经理定稿）
- 状态：可直接开工
- 依据：`~/workspace/projects/_ideas/ai-ad-account-audit-2026-10-21.md`、`~/workspace/projects/_research/demand-scan-2026-10-21.md`（候选 1）
- 一句话形态：**免登录落地页 → 上传 Ads Manager 导出报表 → 规则引擎找浪费 → DeepSeek 生成审计报告 → 免费预览勾住、$49 一次性解锁完整报告。**

---

## 1. 产品定位

给月广告费 $1K–$10K 的中小广告主和小型代理商的**只读** Meta 广告账户审计工具。用户上传 Ads Manager 导出的报表文件，系统在 3 分钟内产出一份审计报告：账户健康分、浪费清单（每一项带证据数字和估算浪费金额）、按优先级排序的修复清单。免费看预览，$49 一次性付费解锁完整报告。

卖点一句话（对用户）：*"Your agency charges $500+/mo to manage ads. We find what they're wasting — in 3 minutes, for $49."*（代理商一个月收你 $500+，我们 3 分钟找出他们浪费的钱，$49。）

### 判生死（写进产品节奏，不是文案）
- 上线后 3 周内：触达 50 个广告主/小代理（Reddit 广告/电商社区 + X 定向）。
- 付费审计 < 2 单 → 杀；≥ 5 单 → 立项订阅版（持续监控 + Meta OAuth）。

---

## 2. 目标用户与核心场景

### 目标用户（按优先级）
1. **P0 独立广告主/小企业主**：自己投 Facebook/Instagram 广告，月花费 $1K–$10K，没有专职优化师，怀疑"钱在烧但不知道烧在哪"。
2. **P0 小型代理商/自由职业广告优化师**：手里管 3–20 个客户账户，用审计报告做交付物和续约证据（一个人当十个账户的"第二双眼睛"）。
3. P1 电商卖家（Shopify 等）：广告是主要获客渠道，对 ROAS 敏感。

### 核心场景
- **场景 A（主场景）**：广告主听说产品 → 打开落地页 → 按图示从 Ads Manager 导出最近 30 天报表 → 上传 + 留邮箱 → 2 分钟后收到免费预览：健康分 47/100、查出 9 个问题、估算月浪费 $612，其中第 1 条完整展示（"3 个广告组花了 $847、0 转化"）→ 点 $49 解锁 → 支付 → 立即看完整报告页 + 下载 PDF，照着修复清单逐项改自己的账户。
- **场景 B**：代理商给客户做月度复盘前跑一份审计，PDF 直接附进给客户的汇报里。
- **场景 C（回访）**：用户改完问题，30 天内用同一报告链接免费复测一次（v1 以"重新上传生成新报告、凭原订单号免费解锁"实现，见 F7），对比健康分变化。

---

## 3. 技术栈与资产复用（工程师直接按此执行）

| 层 | 选型 | 说明 |
|---|---|---|
| 前后端 | Next.js（App Router）+ TypeScript，单体应用 | 复用 Quotalis 代码骨架（页面、API route、邮件、部署脚本） |
| 部署 | Vercel | 复用现有 Vercel 部署管线；新开独立项目与域名（域名待 boss 定，开发环境先用 vercel.app 子域名） |
| 数据库 | Postgres（Vercel Postgres / Neon 二选一，开工时按现有 Quotalis 配置复用） | 存订单、报告元数据、聚合指标、发现项 JSON；**不存原始上传文件**（见 §7） |
| 文件解析 | `papaparse`（CSV）+ `exceljs`（XLSX） | 纯服务端解析 |
| 规则引擎 | TypeScript 纯函数模块 `lib/audit/rules.ts` | 每条规则一个函数：入参为标准化行数据，出参为 Finding 数组；全部可单测 |
| LLM | **DeepSeek 官方 API，模型 `deepseek-chat`，直连，不走 OpenRouter** | 硬约束：OpenRouter 余额仅约 $0.33，禁止默认消耗；key 走环境变量 `DEEPSEEK_API_KEY` |
| 支付 | Creem 一次性产品 $49 | 复用 Quotalis 的 Creem 接入（KYC 已过）：建新 product、Checkout Session、webhook 回调解锁 |
| 邮件 | 复用 Quotalis 现有邮件通道 | 发报告链接、付费解锁通知 |
| PDF | 服务端 HTML→PDF（`puppeteer-core` + Vercel 兼容 chromium 或先用浏览器打印样式页，P1 再优化） | v1 可接受：报告页提供"打印/另存 PDF"样式 + 服务端生成 PDF 二选一，开工时以能稳定产出为准 |

**铁律（来自简报）**：只读——系统任何环节不调用 Meta 写接口、不要求用户广告账户密码、不碰用户资金。v1 连 Meta 读接口都不调（纯文件上传），零平台审核。

---

## 4. 功能清单

### F1 落地页（P0）
- 单页英文落地页，结构固定：
  1. Hero：主标题（卖点句）+ 副标题（"Upload your Ads Manager export. Get a full audit in ~3 minutes. No account access needed."）+ CTA 按钮 `Run my free audit`（锚点跳上传区）
  2. 信任条：Read-only · Your file is deleted after analysis · No password, no account access
  3. "We check for" 问题清单（对应 §5 规则，列 6–8 条，英文短句）
  4. 示例报告截图/样例卡片（用我们自己造的演示账户数据生成，**页面上明确标注 Sample**，禁止伪造用户证言、禁止编造用户数/收入）
  5. 价格区：Free preview / Full report $49 one-time，对比锚点："one month of agency management: $500+"
  6. FAQ：数据怎么处理、要导出什么、多久出报告、退款（报告未能生成自动全额退）
  7. 页脚：隐私政策、条款、联系邮箱
- SEO 基础：title/description/OG 标签、语义化 HTML；关键词方向 `meta ads audit`、`facebook ads audit tool`（精确搜索量未查，文案不许编造数据）。

### F2 文件上传与导出指引（P0）—— v1 唯一输入方式
- 上传区（含 F1 落地页内 + 独立 `/audit` 页）：
  - 接受 `.csv`、`.xlsx`；拖拽 + 点击选择；大小上限 **10 MB**、行数上限 **50,000 行**，超限明确报错。
  - 上传前必选：数据层级（Ad set level 默认推荐 / Ad level）单选；可选填：目标 CPA（美元）、账户月预算、行业（下拉）——用于调阈值和报告语气，可全跳过。
- **导出指引（页面图文步骤，写死在产品里，这是转化关键）**：
  1. 打开 Ads Manager → 选广告账户 → 时间范围选最近 30 天
  2. 切到 **Ad sets** 标签页（或 Ads）
  3. 右上角 Columns → Customize Columns，勾选必需列（见下表）
  4. Export → 选 CSV 或 Excel → 上传到这里
- **必需列**（导出时缺列在解析阶段报错并指明缺哪列）：

| 标准化字段 | Ads Manager 列名（英文导出） | 用途 |
|---|---|---|
| campaign_name | Campaign name | 结构分析 |
| adset_name | Ad set name | 规则主键（层级=广告组时） |
| ad_name | Ad name | 层级=广告时必需 |
| amount_spent | Amount spent (USD) | 全部浪费计算 |
| impressions | Impressions | 频次/CPM |
| reach | Reach | 频次计算校验 |
| frequency | Frequency | 疲劳/频次规则 |
| clicks | Clicks (all) | CTR |
| ctr | CTR (all) | 疲劳/质量规则 |
| cpc | CPC (all) | 异常规则 |
| results | Results | 转化量（无转化事件账户为空 → 触发 R5） |
| cost_per_result | Cost per result | CPA 对比 |
| daily_budget / lifetime_budget | Ad set daily budget / Lifetime budget（可选） | 预算分散规则（缺失时用花费近似） |

- 列名映射做**别名表**（大小写、括号、货币后缀差异容错）；映射失败时列出"我们读到的列名 vs 需要的列名"，让用户回 Ads Manager 补勾——不许静默生成残缺报告。

### F3 报表解析与标准化（P0）
- 解析 → 统一内部结构 `AdRow[]`：数值列去千分位/货币符号转 number；空值转 null；日期范围从文件元信息或用户选择读取（默认按"最近 30 天"表述，报告注明数据期）。
- 数据质量门：总花费 ≤ 0、行数 < 3、关键列全空 → 终止并给出具体修复提示（这类文件多为导错层级或时间范围为空）。
- 解析完成后**立即删除原始文件**（见 §7），只保留聚合与发现。

### F4 审计规则引擎（P0）—— 见 §5 逐条判定逻辑。

### F5 健康评分（P0）
- 起始 100 分，按发现扣分：`扣分 = min(该规则扣分上限, 基础扣分 + 浪费金额占总花费比例 × 系数)`，具体参数按 §5 表执行，全部写在代码常量里可调。
- 分级：80–100 Healthy / 60–79 Needs work / 40–59 Wasteful / 0–39 Critical。评分口径在报告页脚注公开（"Score is a heuristic based on the checks below"），不许包装成行业标准。

### F6 LLM 报告生成（P0）
- **输入给 LLM 的只有结构化数据**：账户聚合指标 JSON + Finding 列表 JSON + 用户可选填的行业/目标 CPA。**永远不把原始 CSV 整表发给 LLM**（成本 + 隐私双红线）。
- 模型：DeepSeek `deepseek-chat`，temperature 0.3，输入 token 上限 8,000、输出上限 3,000（超限截断 Finding 证据细节，不截断清单本身）。
- 报告结构（固定五段，LLM 只写文字，数字一律引用规则引擎给出的值，prompt 中明确禁止 LLM 自行计算或编造数字）：
  1. **Executive summary**：3–4 句，总判断 + 最重要的一个问题 + 估算月浪费总额
  2. **Health score**：分数 + 分级 + 一句话理由（分数由引擎算，LLM 只解释）
  3. **Waste list**：逐条 = 问题标题、证据数字（花费/转化/频次等）、估算浪费金额、影响说明
  4. **Fix checklist**：按 P0（本周就改）/P1（本月改）/P2（有空再改）分组，每条 = 做什么 + 在 Ads Manager 里的具体操作路径 + 预期效果
  5. **What's working**：表现好的广告组/广告点名肯定（数据真实来自聚合 Top 项），避免整篇只有坏消息
- LLM 输出做 JSON schema 校验 + 数字一致性抽查（报告中出现的 $ 金额必须能在 Finding 集合中找到，找不到 → 该段回退为模板文案，不许带病发布）。
- LLM 调用失败/超时（>60s 重试 1 次）→ 回退纯模板报告（规则结果 + 预写文案拼接），报告页标注 "Summary generated from rule data"。**报告必须出，形式可降级。**

### F7 付费墙与支付（P0）
- **免费预览**（留邮箱后可见）：健康分 + 分级、问题总数、估算月浪费总额、Waste list 第 1 条完整内容、其余条目只显示标题且金额打码、Fix checklist 只显示条数不显示内容、报告页顶部固定解锁 CTA。
- **付费完整版（$49 一次性）**：全部 Waste list（含每条证据与金额）、完整 Fix checklist、What's working、PDF 下载、**30 天内免费复测 1 次**（凭订单邮箱重新上传，系统匹配未用复测额度自动解锁新报告）。
- **定价结论：一次性 $49**。依据：①需求报告锚点区间 $49–99，取下限压低首次决策门槛（<$50 心理线）；②对比锚：代理商月费 $500+ 的 1/10、Adspirer 年付 $485 的约 1/10，ROI 一句话成立；③成本侧：单次审计总成本目标 < $1（见 §8），$49 毛利足够覆盖获客试错；④v1 不做订阅——订阅（持续监控）是验证 ≥5 单后的二期，不在 v1 收款路径里增加复杂度。
- 支付：Creem Checkout；webhook 收到 `checkout.completed` → 订单置 paid → 报告解锁 + 发邮件。支付成功页自动跳回报告页。
- **服务端强制门禁**：未付费状态下，完整报告内容不下发到前端（API 按 order 状态裁剪字段），禁止只靠前端打码——验收要测（见 §9）。
- 退款规则（写进 FAQ 与条款）：报告生成失败自动全额退款；其余情况人工邮件处理，页面如实写明，不许玩文字游戏。

### F8 邮箱留资（P0）
- 时机：上传文件解析通过后、生成预览前，弹邮箱输入（"Where should we send your audit?"），邮箱即报告归属凭证，v1 **不做账号系统、不设密码**。
- 报告访问 = 邮件中的不可猜测链接（UUID token，≥128 bit 随机）；链接即凭证，页面提示用户保管。
- 邮箱用途如实声明：发报告、复测提醒；不卖数据、不发无关营销（订阅产品上线通知需单独 opt-in 勾选，默认不勾）。

### F9 报告页（P0）
- 路由 `/report/[token]`，`noindex`，内容按付费状态服务端裁剪（见 F7）。
- 页面顺序：健康分大字卡 → Executive summary → Waste list → Fix checklist → What's working → （未付费时）解锁区 → 页脚口径说明 + 数据删除说明。
- 付费后出现 `Download PDF` 按钮；PDF 内容与网页一致（含生成日期、数据期、口径注脚）。
- 空/错状态齐全：报告生成中（进度态，轮询）、生成失败（道歉 + 自动退款说明 + 支持邮箱）、链接失效（引导联系支持）。

### F10 管理与观测（P0，极简）
- 环境变量开关的内部统计页或直接查 DB：每日上传数、预览生成数、邮箱数、付费数、转化率、单次 LLM 成本（每次调用记录 token 用量与估算成本到 `llm_calls` 表）。
- 判生死只看这四个数：上传 → 邮箱 → 付费 → 复测。不做复杂 BI。

### P1 功能（v1 不做，列明防蔓延）
- **Meta OAuth 直连读账户**（P1）：理由——Meta 应用需提交审核（ads_read 权限 + 企业验证），周期不可控，会卡死 3 周判生死窗口；且 OAuth 授权转化率未必高于文件上传（用户对"交出账户权限"的戒心 > 导出一个文件的麻烦）。v1 用 CSV 验证"报告值不值 $49"这个真问题，OAuth 只解决输入摩擦，等付费验证成立后再投入。届时复用已有 Meta Ads connector。
- 订阅版持续监控/周报、Google Ads / TikTok 审计、代理商白标 PDF 与多账户面板、受众重叠的精确版（需 OAuth 拉 targeting 数据）、广告素材（图片/文案）级分析、多语言界面。

---

## 5. 审计规则引擎：逐条判定逻辑（P0 全部实现）

通用约定：`S` = 报表期总花费；阈值中的金额按报表期（默认 30 天）计；用户填了目标 CPA 时记为 `CPA_t`，未填时 `CPA_ref` = 账户整体平均 CPA（总花费/总转化，总转化=0 时该参数不适用）。每条 Finding 输出：`{rule_id, severity(high/med/low), title, evidence{...数字}, waste_usd, fix_template_key}`。`waste_usd` 一律给**估算口径并在报告中标注 estimated**。

| # | 规则 | 判定逻辑（满足即触发） | 浪费金额估算 | 扣分上限 |
|---|---|---|---|---|
| R1 | 零转化高花费广告组 | 层级=广告组（或广告）行：`amount_spent ≥ max($50, 2 × CPA_ref)` 且 `results = 0 或 null` | 该行全部花费 | 15 |
| R2 | CPA 失控广告组 | `results > 0` 且 `cost_per_result ≥ 2 × CPA_t`（填了目标）或 `≥ 2 × CPA_ref` 且该组转化 ≥ 3（样本足够） | 花费 − 花费 × (CPA目标/CPA实际) | 12 |
| R3 | 频次过高（受众疲劳） | `frequency ≥ 4` 且 `ctr < 账户 CTR 中位数`；或 `frequency ≥ 7`（无条件触发，severity=high） | 花费 × 25%（频次超限段的经验浪费占比，报告标注估算） | 10 |
| R4 | 预算分散/碎片化 | 活跃广告组数 ≥ 8，且其中 ≥ 40% 的组报表期花费 < $30 且转化 = 0（或填了日预算时：日预算 < $5 的组 ≥ 3 个） | 低效小组花费合计 × 50% | 8 |
| R5 | 无转化追踪/无转化事件 | 全账户 `results` 合计 = 0 且 `S ≥ $100`；或所有广告系列均为流量/互动类目标（由 Results 列为空 + 点击量>0 推断，文案写"appears to"） | 不估算金额，severity=high 单列（这是追踪问题不是花费问题） | 15 |
| R6 | 广告疲劳（单广告长跑） | 层级=广告行：单条广告 `frequency ≥ 5` 且 `ctr ≤ 0.5%`；或单条广告花费占账户 ≥ 60% 且其 CPA 高于账户均值 | 该广告花费 × 20% | 8 |
| R7 | 素材/广告集中度风险 | Top 1 广告花费占比 ≥ 80%（层级=广告时）；层级=广告组时改为 Top 1 广告组 ≥ 80% | 不估算金额，severity=low（风险提示型） | 4 |
| R8 | 受众重叠风险（启发式，置信度标注 low） | 同一广告系列下 ≥ 3 个广告组同时活跃、各自 `frequency ≥ 3` 且系列内各组 CPM 差异 < 20%（高度疑似抢同一人群）；Finding 必须标注 "likely overlap — CSV data can't confirm targeting overlap; check Audience Overlap tool"，v1 不许下确定结论 | 不估算金额 | 5 |
| R9 | 廉价流量陷阱 | 某行 `cpc ≤ 账户中位 CPC × 0.3` 且 `impressions` 占比 ≥ 20% 且 `results = 0`（疑似低质版位/受众网络灌量） | 该行花费 | 8 |
| R10 | 学习期不足/转化量太稀 | 广告组报表期转化在 1–6 之间（周均 < 2）且花费 ≥ $100：量级不足以让系统优化，文案建议合并或提预算 | 不估算金额，severity=low | 5 |
| R11 | 点击率塌方组 | `ctr ≤ 0.3%` 且 `impressions ≥ 10,000` 且花费 ≥ $30 | 花费 × 30% | 6 |
| R12 | 整体烧钱无产出（兜底总警报） | 全账户转化 = 0 且 S ≥ $200，或整体 CPA ≥ 3 × CPA_t（填了目标时） | 在 summary 中置顶呈现，不重复扣分（与 R1/R5 去重：同根因只扣最高一项） | — |

去重规则：同一广告组被多条规则命中时，Waste list 按广告组聚合展示（主问题 + 附带问题），`waste_usd` 取各规则估算的最大值，禁止叠加重复计算——**宁可少报，不许多报**，这是诚实红线。

阈值全部集中在 `lib/audit/thresholds.ts` 常量文件，PRD 表格数值即初版值，后续调参只改此文件并留 changelog 注释。

---

## 6. 报告结构示例（给工程师与设计师对齐用）

```
Health Score: 47/100 — Wasteful
Summary: ...（LLM, 3-4 句）
Estimated waste last 30 days: $612 (estimated)

WASTE LIST
1. [HIGH] 3 ad sets spent $847 with zero conversions ...
2. [HIGH] No conversion tracking detected ...
3. [MED] Frequency hit 6.2 on "Retargeting — 30d" ...

FIX CHECKLIST
This week: Pause or fix the 3 zero-conversion ad sets (Ads Manager → Ad sets → ...)
This month: Consolidate 9 ad sets into 4 ...
Later: ...

WHAT'S WORKING
"Lookalike 2% — Prospecting" CPA $18.40, 38% below account average ...
```

免费预览 = 上面前两段 + Waste list 第 1 条 + 其余打码（实现按 F7）。

---

## 7. 数据与隐私（硬性要求，验收要查）

- **只读承诺**：v1 不接任何广告平台 API 写权限；不向用户索要广告账户密码；产品文案与实现一致。
- **原始文件生命周期**：上传 → 内存/临时区解析 → **解析完成即删**（含解析失败的情况）；禁止写入长期对象存储；临时文件最长存活 10 分钟，定时任务兜底清理 `/tmp/uploads`。
- **留存数据**：仅保留聚合指标、Finding JSON、报告文本、邮箱、订单状态。报告与关联数据保留 **90 天**后自动删除（用户可邮件要求提前删除，3 个工作日内执行——写进隐私政策）。
- **LLM 数据边界**：发往 DeepSeek 的只有聚合 + Finding JSON，不含原始行数据、不含邮箱等个人信息。隐私政策如实披露"anonymized aggregates are processed by an AI model provider (DeepSeek)"。
- **传输与存储**：全站 HTTPS；DB 中邮箱与 token 正常存储即可（非敏感凭证），报告链接 token 用密码学随机数生成。
- **不做的事**：不出售/分享数据、不把用户数据用于训练、不在报告页加第三方广告追踪像素（基础分析可用自有/隐私友好统计）。

---

## 8. 非功能需求

| 项 | 要求 |
|---|---|
| LLM 成本 | **单次审计 LLM 成本目标 < $0.5**（DeepSeek 直连价下正常应在 $0.05 量级）；每次调用记录 input/output tokens 与估算成本；超 8k 输入截断策略见 F6；日调用量设熔断上限（默认 200 次/天，env 可调）防刷 |
| 总时延 | 上传→预览报告 P95 < 3 分钟；解析+规则 < 10 秒，LLM 段 < 90 秒（超时走 F6 回退） |
| 上传安全 | 扩展名 + MIME + 文件头三重校验（XLSX 验 ZIP 魔数）；拒绝 `.xlsm`/宏文件、拒绝压缩包伪装；CSV 单元格防公式注入（导出 PDF/再导出时对 `=,+,-,@` 开头单元格转义）；文件名不落盘使用（内存名随机化） |
| 防滥用 | 同 IP 每日免费审计 ≤ 3 次；同邮箱每日 ≤ 3 次；上传接口限流；验证码留 P1（出现刷量再加） |
| 支付安全 | 金额以 Creem 服务端产品价为准，前端不传价；webhook 验签后才解锁；解锁接口幂等 |
| 可用性 | 报告页/上传页移动端可用（广告主多为手机上先看到落地页，但导出文件动作在桌面完成，页面需提示"请在电脑上导出上传"） |
| 可观测 | 每次审计生成 audit_id 贯穿日志；LLM 失败、解析失败、支付回调异常全部记错误日志 |
| 文案诚实 | 全站禁止编造用户数、评价、收入、"AI 精准预测"类话术；所有估算数字标注 estimated；示例报告标注 Sample |

---

## 9. 验收标准（逐条可测）

1. 用一份真实格式 Ads Manager 导出样本（30 天、广告组层级、含必需列）上传，3 分钟内生成免费预览，健康分、问题数、浪费总额与规则引擎离线跑同一文件的输出一致。
2. 样本文件中构造一个花费 $120、0 转化的广告组，R1 必须触发且金额、名称与文件一致；构造频次 6.5 且 CTR 低于中位数的组，R3 触发。
3. 缺必需列的文件上传 → 明确报错列出所缺列名，不生成报告；`xlsm` 文件、改扩展名的 zip → 被拒并提示原因；11 MB 文件 → 被拒。
4. 未付费状态下：直接请求报告 API 拿到的 JSON 不含第 2 条起 Waste 的金额与 Fix checklist 正文（抓包验证，非仅页面打码）。
5. Creem 测试支付完成 → webhook 后 1 分钟内报告解锁、PDF 可下载、确认邮件发出；重复投递同一 webhook 不重复解锁/不报错。
6. 审计完成 15 分钟后检查：服务器上无该次原始上传文件残留（临时目录 + 对象存储双查）。
7. 断开/模拟 DeepSeek 超时 → 仍产出模板回退报告且页面有标注；LLM 返回含 Finding 中不存在的金额 → 该段被回退替换。
8. 单次审计的 `llm_calls` 记录存在，估算成本 < $0.5；连续用同 IP 第 4 次免费审计被限流。
9. 付费后 30 天内同邮箱重新上传 → 新报告自动解锁（复测额度消耗 1 次），第二次复测回到付费墙。
10. 落地页与报告页通读检查：无编造数据/证言，估算数字均带 estimated，示例报告带 Sample 标注，隐私政策写明文件删除与 90 天留存。
11. 移动端打开落地页：布局正常且有桌面导出提示；桌面端完整走通场景 A 全流程无死按钮、无 TODO 占位。

---

## 10. 明确不做（v1 Out of Scope）

- Meta OAuth / 任何平台 API 直连（P1，理由见 F-P1 条）
- Google Ads、TikTok、LinkedIn 等其他平台审计
- 订阅制、持续监控、定时复查、告警推送
- 任何对用户广告账户的写操作、自动优化、一键暂停
- 账号注册/登录系统（v1 用邮箱 + token 链接）
- 代理商白标、多账户管理、团队协作、API 开放
- 广告素材内容分析（图片/视频/文案打分）
- 受众重叠的确定性判定（需 targeting 数据，v1 只做 R8 启发式提示）
- 多语言（v1 仅英文界面与报告）
- 原生 App、浏览器插件

---

## 11. 构建顺序建议（工程师排期参考）

1. 骨架 + 数据模型 + 上传/解析/标准化（含列映射与报错）
2. 规则引擎 + 单测（含 §9 第 2 条构造样本）
3. 报告页（先模板版跑通全链路）+ 邮箱/token 链路
4. DeepSeek 接入 + 数字一致性校验 + 成本记录
5. Creem 付费墙（服务端裁剪）+ webhook + PDF + 复测额度
6. 落地页 + 导出指引 + 隐私/条款页
7. 按 §9 全条验收 → 过红队/真实性审计 → 上线

产品名、域名、视觉：不在本 PRD 范围，开工前由 boss/设计环节另定；开发先用占位名 `AdAudit` 于代码与 vercel 子域名，不阻塞构建。
