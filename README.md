# AdAudit — AI 广告账户审计（Meta 起步）MVP

免登录落地页 → 上传 Ads Manager 导出报表 → 12 条规则引擎找浪费 → DeepSeek 生成审计报告 →
免费预览 → Creem 一次性 $49 解锁完整报告（含 PDF + 30 天内免费复测 1 次）。
全程只读，不接任何广告平台 API，不碰用户广告账户。

依据：`../PRD.md`（产品定义）、`../DESIGN.md`（页面与状态设计）。

## 快速启动

```bash
npm install
cp .env.example .env.local   # 按需填写，见下表（全部可留空跑免费预览链路）
npm run build
npm run start                 # http://localhost:3000
# 开发模式：npm run dev
```

自测样例在 `test-data/`：`sample-ads-manager-export.csv`（及等价 `.xlsx`）为真实格式的
Ads Manager 广告组层级导出，在落地页上传、留邮箱即可跑通全链路；
`sample-missing-columns.csv` 用于验证缺列报错。

## 环境变量

| 变量 | 用途 | 缺失时行为 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek 报告叙述（直连官方 API，不走 OpenRouter） | 报告回退为规则数据模板版，页面明示 "Summary generated from rule data"，`llm_calls` 记 `no_key` |
| `CREEM_API_KEY` / `CREEM_PRODUCT_ID` | Creem 一次性 $49 产品结算 | 结算接口返回 503 明示"支付未配置"，免费预览不受影响 |
| `CREEM_WEBHOOK_SECRET` | webhook HMAC-SHA256 验签 | webhook 一律 401，不解锁 |
| `RESEND_API_KEY` / `MAIL_FROM` | 报告/解锁邮件 | 发送记录记 `not_configured`；报告链接同时在站内展示，流程不依赖邮件 |
| `CREEM_API_KEY`（退款） | 报告生成失败时自动全额退款（调 Creem 退款 API） | 订单落 `refund_pending` + 管理员告警，绝不假装已退；cron 持续重试 |
| `CRON_SECRET` | `/api/cron/cleanup` 定时清理入口的密钥校验 | 接口返回 503，不执行任何清理 |
| `ADMIN_ALERT_EMAIL` | 管理员告警收件箱（退款待处理等），默认 `service@adaudit.app` | 用默认 |
| `ADMIN_KEY` | `/admin/stats` 内部统计页（请求头 `x-admin-key`） | 统计页关闭 |
| `DATA_DIR` | 数据文件目录（默认 `./data`） | — |
| `LLM_DAILY_CALL_CAP` | LLM 日调用熔断（默认 200） | — |

## 架构

```
app/
  page.tsx                 落地页（Hero/信任条/检查清单/导出指引/上传/示例/定价/FAQ）
  audit/page.tsx           独立上传页（与落地页共用 UploadBox）
  report/[token]/page.tsx  报告页（服务端取数 + ReportClient 轮询/渲染）
  privacy/ terms/          隐私与条款（文件删除、90 天留存、退款口径）
  admin/stats/             F10 极简漏斗统计（env 门禁）
  api/upload               上传校验+解析（内存处理，文件永不落盘）
  api/audit/[id]/email     留资、发 token、复测额度匹配、启动审计流水线
  api/report/[token]       报告 JSON（服务端裁剪 = 真付费墙）
  api/report/[token]/pdf   PDF 下载（付费专属，402 门禁）
  api/checkout             Creem 结算（价格以 Creem 产品为准）
  api/webhooks/creem       验签 + 幂等解锁（同时存 Creem 订单/交易 id 供退款定位）
  api/cron/cleanup         定时清理入口（CRON_SECRET 校验）：90 天留存删除 + 退款重试
lib/
  audit/columns.ts         列名别名映射（与导出指引共用同一份列名常量）
  audit/parse.ts           三重文件校验、CSV/XLSX 解析、标准化、数据质量门
  audit/thresholds.ts      PRD §5 全部阈值与扣分上限（调参只改这里）
  audit/rules.ts           12 条规则 + 按组去重（同一笔钱只算一次）+ 健康评分
  audit/fixes.ts           修复清单模板与无数字预览标题
  report/generate.ts       DeepSeek 调用 + 数字一致性校验 + 模板回退 + 成本记录
  report/view.ts           付费墙裁剪视图（页面与 API 共用，未付费数据不出服务器）
  report/run.ts            流水线编排（解析→规则→叙述→邮件）
  pdf.ts                   pdf-lib 服务端 PDF（含公式注入转义、WinAnsi 净化）
  creem.ts / mail.ts       Creem API（含退款）与 Resend 邮件（均为真实调用实现）
  refund.ts                生成失败自动退款编排：refunded / refund_pending 状态流转 + 管理员告警
  store.ts                 持久化（JSON 文档库，实体形状与 PRD 的 Postgres 方案一致，
                           上线换 Postgres 只改此文件）；从不存原始上传文件；
                           内含 90 天留存清理（purgeExpiredAudits / 读取惰性过期）
  pending.ts               解析后行数据的进程内暂存（≤15 分钟，流水线消费即删）
```

## 关键设计决策（与 PRD 的对应）

- **文件生命周期**：上传文件全程仅在内存中解析，从不写盘——比"解析后删除"更严格，
  服务器上不存在原始文件残留的可能（PRD §7 / 验收 6）。
- **付费墙**：裁剪在服务端 `lib/report/view.ts` 完成；未付费时第 2 条起发现项只下发
  无数字预览标题，证据、金额、修复正文均为 `null`。前端黑块只是呈现（验收 4）。
- **LLM 诚实边界**：只把聚合 + Finding JSON 发给 DeepSeek（永不发原始行）；LLM 输出的
  每个 $ 金额必须能在引擎数字集合中找到，否则该段回退模板；总览段造假则整篇回退（PRD F6）。
- **去重**：同一广告组被多条规则命中时，浪费只归最大的一条规则，其余标注说明；
  R4 的估算会扣除已被其他规则占用的部分。宁可少报，不许多报。
- **复测**：付费后 30 天内同邮箱重新上传，新报告自动解锁并消耗来源订单的复测额度（验收 9）。

## 数据留存与定时清理（90 天删除承诺的实现）

隐私页/FAQ/页脚/邮件/PDF 都承诺"报告保留 90 天后自动删除"，实现是双通道：

- **批量清理**：`store.purgeExpiredAudits()` 删除 `created_at` 超过 90 天的审计记录、
  其全部报告内容、关联订单与 LLM 调用记录、以及待处理行数据；只保留匿名聚合计数
  （累计清理数、累计 LLM 成本，存 `retention_stats`，不含邮箱与报告内容），供漏斗统计连续。
  邮箱发送记录（含地址）按自身时间戳同样 90 天过期。
- **读取惰性过期**：报告页、报告 JSON API、PDF API 读到过期记录时先删除再返回
  过期状态（页面显示 "This report has expired"，API 返回 410）——cron 没跑也不会发出过期报告。
- **退款优先**：某订单处于 `refund_pending` 的审计不删（钱没处理完不删数据），
  先由清理任务重试退款，退款落地后下一轮再删。

**挂定时任务**：入口 `GET/POST /api/cron/cleanup`，密钥校验（`CRON_SECRET`，
请求头 `Authorization: Bearer <secret>` 或 `x-cron-secret: <secret>`；未配密钥返回 503）。

- Vercel：仓库根 `vercel.json` 已配每日 cron（03:17 UTC）；在 Vercel 项目环境变量里
  设置 `CRON_SECRET` 后，Vercel Cron 会自动带 `Authorization: Bearer` 调用。
- 其他平台：任意外部定时器每日请求一次即可，例如
  `curl -H "Authorization: Bearer $CRON_SECRET" https://<域名>/api/cron/cleanup`。

## 生成失败自动退款（退款承诺的实现）

条款/FAQ/报告页承诺"报告生成失败自动全额退款"，实现在 `lib/refund.ts`：

- 流水线生成失败且该审计是 Creem 直接付费的 → 调 `lib/creem.ts` 的 `createRefund`
  （`POST /v1/transactions/{transaction_id}/refund`，全额；交易号优先取 webhook 存下的，
  否则经 checkout/订单查询解析）→ 订单状态变 `refunded`，审计取消付费标记。
- API 不可用或未配 key → 订单变 `refund_pending` 并存失败原因，同时发管理员告警
  （`sendAdminAlert`，发送记录落库）；`/api/cron/cleanup` 每次运行都会重试所有
  `refund_pending` 订单。**没有真实 API 成功，绝不标 refunded。**
- 复测额度生成的审计（`paid_via = "recheck"`）本身没付过钱，不触发退款。

## 本地验收记录（2026-10-21，生产构建 + 真实 HTTP 全链路）

- 样例 CSV（15 行，$2,815.45）上传 → 报告生成：健康分 73（Needs work），6 个问题，
  总浪费 $1,296.23（estimated）；R1 命中含 $120/0 转化广告组，R3（频次 6.51）触发，
  与规则离线推算一致。
- 未付费：API JSON 中第 2 条起 `locked=true` 且金额为 `null`；PDF 接口返回 402。
- 缺列文件 → 422 并点名缺失列（Results、Cost per result）；`.xlsm` → 拒绝；
  ZIP 改名 `.csv` → 魔数校验拒绝；同 IP 第 4 次上传 → 429。
- Webhook：错签名 401；正确签名解锁；重放同事件幂等；解锁后 PDF 200（%PDF）。
- 复测：同邮箱第 3 次上传（来源订单 30 天内、额度未用）→ 新报告自动解锁。
- DeepSeek / Creem / Resend 在本地无 key：分别以 `no_key` / 503 明示 / `not_configured`
  如实呈现，无任何伪造结果。接入真实 key 后走同一代码路径。
