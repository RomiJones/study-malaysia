# UPSI 新流程采集门禁报告

生成时间：2026-07-07T13:12:45Z

## Phase 1 多源发现

- Tier 1 官方源：UPSI 主站、About、International、BHEA、IMAC PDF、UPSI faculty directory、各学院专业详情页、IPS list-of、IPS requirements、IPS fee PDF。
- Tier 2 交叉源：QS 官方 profile。
- robots：主站允许；BHEA 仅禁 /wp-admin；IPS robots.txt 返回 404 页面，本轮只访问公开 HTML/PDF。

## Phase 2 交叉验证

- 院校身份、地址、建校年份：主站/About/International 一致。
- QS：QS 官方 profile 显示 WUR 2027 #851-900。
- 本科：BHEA landing 声明 54 bachelor + 14 diploma；当前 IMAC 2025/07 PDF 列出 46 个本科国际生费用项目，每个 MYR 44,000，2026-01 起生效；UPSI 官方 faculty/programme pages 补齐 8 个本科专业，8 条均已按 UPSI 2025/07 官方学院册展示学制总费用并标记 `official-approximate`。
- 硕士：IPS list-of 解析 142 行，按代码去重 138 个；MT014、MT017、MT022、MT196 重复。
- 博士：IPS list-of 解析 109 行，按代码去重 108 个；PT017 重复。
- 研究生费用：2026-03 intake 官方 PDF，Master RM22,180-RM26,160，PhD RM39,190-RM47,030，EdD RM59,590；每个专业还需要映射 fee category。

## Phase 3 结构化建模

- 已生成：`candidate-dataset.json`。
- 本轮把本科建模补齐到 BHEA 官方数量 54 条：46 条来自当前 IMAC 国际本科费用清单，8 条来自 UPSI 官方学院/专业页面。
- 费用口径：46 条 IMAC fee-listed 行保存总学费 RM 44,000；8 条补齐本科保存官方学院册学制总费用，状态均为 `official-approximate`，不标为 IMAC 国际生费用表核验。
- 硕博保留 baseline + sample，不伪造每个专业 fee category。

## GATE 1 Dry-Run

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| TS 编译 0 错误 | PASS | `npm --workspace @studymy/api run build` 与 `npm --workspace @studymy/web run build` 均已通过 |
| slug 唯一 | PASS | 54 个本科 candidate slug 唯一 |
| institutionType <= 20 | PASS | public |
| 四语非空 | PASS / 待精校 | 字段非空，中文为本轮人工译名，ms 暂用英文官方名 |
| 学费 > 0 | PASS / 例外记录 | 46 个 fee-listed 本科 candidate 均 MYR 44,000；8 个补齐本科均按官方 2025/07 学院册展示学制总费用，状态 `official-approximate` |

结论：本科数量已补齐到 54；费用硬门禁对 46 个 IMAC 官方费用表列名行和 8 个官方学院册总费用展示行通过；当前本科无 `not-published` 费用行。

## 本科 8 条补齐

| Code | 专业 | 官方源 | 费用状态 |
| --- | --- | --- | --- |
| UPSI-UG-047 | Bachelor of Education (Ethnic Languages) with Honours | FBK official programme page + FBK fee PDF | RM 6,643，`official-approximate` |
| UPSI-UG-048 | Bachelor of Malaysian Studies with Education | FSK official programme page + FSK fee PDF | RM 7,472，`official-approximate` |
| UPSI-UG-049 | Bachelor of Education (Sports Science) with Honours | FSSK official education overview + FSSK fee PDF | RM 8,032，`official-approximate` |
| UPSI-UG-050 | Bachelor of Education (Coaching Science) with Honours | FSSK official education overview + FSSK fee PDF | RM 8,032，`official-approximate` |
| UPSI-UG-051 | Bachelor of Education (Physical Education) with Honours | FSSK official education overview + FSSK fee PDF | RM 8,032，`official-approximate` |
| UPSI-UG-052 | Bachelor of Education (Home Economics) with Honours | FTV official programme page + FTV fee PDF | RM 8,672，`official-approximate` |
| UPSI-UG-053 | Bachelor of Education (Design and Technology) with Honours | FTV official programme page + FTV fee PDF | RM 8,672，`official-approximate` |
| UPSI-UG-054 | Bachelor of Education (Invention) with Honours | FTV official programme page + FTV fee PDF | RM 8,672，`official-approximate` |

说明：FTV 导航还列出 `Bachelor of Agricultural Science (Agricultural Extension) with Education`。由于 BHEA 总数基准是 54，本次只补齐 46→54 的 8 条；该额外 FTV 标题保留为 source-discrepancy backlog，不在本次 8 条中强行加入。

## 8 条学费补查结果

补查更新：在 UPSI 2025/07 官方学院册中进一步找到 FBK、FSK、FTV 费用页后，8 条补齐本科均已按官方学院册展示学制总费用，状态为 `official-approximate`。这些金额仍不是 IMAC 国际生费用表单列金额，因此不标为 `fee-sheet-verified`。

已检查并拒绝填入的来源：

- 当前 IMAC PDF（2025-07）：46 个本科 fee-listed 行均为 `RM 44,000`，但不包含这 8 个专业，不能复制金额。
- 官方 2024-12 国际学费 PDF：仍不包含这 8 个专业，且不是当前 2026 生效费表。
- 官方 2023 BHEA 国际本科指南：包含旧版国际费用行，但不包含这 8 个补齐专业。
- UPSI 官方 `FSSK.pdf`（2025-07）：列出 `Sarjana Muda (Pendidikan)` 学制总费用 `RM 8,032`，8 学期，不含住宿/college fee；用于 `UPSI-UG-049`、`UPSI-UG-050`、`UPSI-UG-051` 三条 FSSK 体育教育类本科的展示费用。
- UPSI 官方 `FBK.pdf`（2025-07）：列出 `Sarjana Muda Pendidikan (Bahasa Etnik)` 学制总费用 `RM 6,643`，7 学期，不含住宿/college fee；用于 `UPSI-UG-047`。
- UPSI 官方 `FSK.pdf`（2025-07）：列出 `Sarjana Muda (Pendidikan)` 学制总费用 `RM 7,472`，8 学期，不含住宿/college fee；用于 `UPSI-UG-048`。
- UPSI 官方 `FTV.pdf`（2025-07）：列出 `Sarjana Muda (Pendidikan)` 学制总费用 `RM 8,672`，8 学期，不含住宿/college fee；用于 `UPSI-UG-052`、`UPSI-UG-053`、`UPSI-UG-054`。
- eBITARA 2026 Degree 公共申请流程：可读取 2026 intake、faculty、course options；8 条中只有 `AT58 Malaysian Studies with Education` 出现在 Sep 2026 course options，接口不返回 fee/yuran 字段；没有执行 `apply_col`，因为那会写入外部申请状态。
- BHEA 2024/2022/2020 本科本地/补贴费用表：可找到部分 AT 代码的本地费用，但不是国际生总学费，不能用于 StudyMY 国际费用字段。

解释边界：eBITARA 存在国际学生申请入口，只能说明 UPSI 学校层面接收国际申请；某个专业未出现在当前公共 course options 或 IMAC 费用表中，不能推导为“不招国际学生”。

处理原则：8 条补齐本科均按官方学院宣传册学制总费用展示；全部保持 `official-approximate`。一旦 UPSI 发布对应 IMAC 国际生费用 PDF/页面，才能改为 `fee-sheet-verified` 或 `matched-official`。

## 阻塞项

1. BHEA 54 个 bachelor 与 IMAC 当前 46 个国际生费用项目已完成数量补齐；8 个补齐本科已按官方学院册展示总费用，但仍不是 IMAC 国际生费用表核验。
2. 硕士、博士只有官方目录 baseline 和统一费用表，还未把每个项目映射到 science/technical、non-science、science stream fee category。
3. 46 个本科项目没有逐个完成官方详情页 curriculum、duration、career、programme-specific requirement 深挖；本次按用户指令转为审核版 ready/published，但风险说明保留在 audit/review 字段中。

## 审核版入库上线

- 导入脚本：`apps/api/src/db/import-upsi-official-audit.ts`。
- 导入命令：`npm --workspace @studymy/api run import:upsi:official-audit -- --confirm-import`。
- 数据库结果：UPSI university id=16，slug=`universiti-pendidikan-sultan-idris`，`isPublished=true`，`publicDisplayStatus=ready`。
- 专业结果：补齐后目标为 54 个本科项目 `isPublished=true` 且 `publicDisplayStatus=ready`；其中 46 个 `fee-sheet-verified`，8 个 `official-approximate`，0 个 `not-published`。8 条旧 UPSI 占位项目保持归档。
- 审核 URL：`http://localhost:5173/universities/universiti-pendidikan-sultan-idris`。

## GATE 2 三层验证

| 层级 | 结果 | 说明 |
| --- | --- | --- |
| DB 直查 | PASS | UPSI ready/published，54 个可见本科项目；46 个 `fee-sheet-verified`，8 个 `official-approximate`，0 个 `not-published`；8 条补齐本科均有 `tuitionDisplay` 和 `officialTuitionMYR` |
| API 端点 | PASS | `/api/universities/universiti-pendidikan-sultan-idris` 返回 54 个 programs；8 条补齐本科返回 `tuitionDisplay=listTuitionText` 对应 RM 6,643 / RM 7,472 / RM 8,032 / RM 8,672；普通端点未被 review-preview 劫持 |
| 前端浏览器渲染 | PASS | Playwright 验证本科 54、RM 44,000 fee-listed 行 46 个、官方学院册费用行 8 个、`官方未公布` 0 个；截图：`output/playwright/upsi-bachelor-all-fees-final-20260707.png` |

## 费用口径修正

- IMAC PDF 中 46 个本科国际生费用为项目总学费 `RM 44,000`。
- 46 条 fee-listed 行数据库展示字段：`tuitionAmount=44000`、`officialTuitionMYR=44000`、`tuitionDisplay=RM 44,000 total programme fee`。
- 8 条补齐本科数据库展示字段：
  - `UPSI-UG-047`: `tuitionAmount=6643`、`tuitionDisplay=RM 6,643`、`officialFeeAuditStatus=official-approximate`
  - `UPSI-UG-048`: `tuitionAmount=7472`、`tuitionDisplay=RM 7,472`、`officialFeeAuditStatus=official-approximate`
  - `UPSI-UG-049/050/051`: `tuitionAmount=8032`、`tuitionDisplay=RM 8,032`、`officialFeeAuditStatus=official-approximate`
  - `UPSI-UG-052/053/054`: `tuitionAmount=8672`、`tuitionDisplay=RM 8,672`、`officialFeeAuditStatus=official-approximate`
- `annualTuitionCny=18700` 仅作为预算筛选用的年度折算值，不作为页面展示学费。

## 质量评分草案

80/100，达到本科正式上线线。本科数量已按 BHEA 54 补齐，8 条补齐本科均有官方学院册学制总费用展示；剩余风险是这些金额未在 IMAC 国际生费用表中单列，且硕博和课程/详情深挖仍需后续补齐。
