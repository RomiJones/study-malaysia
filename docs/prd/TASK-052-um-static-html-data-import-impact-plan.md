# TASK-052 UM 静态 HTML 数据导入技术影响分析和实现方案

## 1. 文档信息

- **任务编号**：TASK-052
- **任务标题**：新增需求技术影响分析和实现方案
- **关联新增需求**：REQ-2026-05-24T12-55-06-287Z
- **新增需求描述**：需要从 `D:\mydev\StudyMY_UM_v58_na_display_tidy.html` 提取马来大学所有数据进入到对应的数据库中。
- **目标项目**：`D:\mydev\study-malaysia`
- **文档定位**：本文件只输出技术影响分析和后续实现方案，不直接导入数据库，不修改业务代码，不把 Notion 或 Markdown 快照作为运行时业务数据库。

## 2. 需求边界

本轮按“马来大学”理解为静态 HTML 中 `code=UM` 的 Universiti Malaya / University of Malaya 数据。后续实现应只导入 UM 院校档案及其专业数据，不应默认把 `universitiesBase` 中全部 18 所院校或 `merged` 中 119 所院校写入业务库。

“所有数据”在本需求中包含 UM 院校基础信息、官方来源、申请信息、校园设施、费用说明、以及 UM 下全部 248 个专业记录。用户端公开列表仍只能展示 `publicDisplayStatus = ready` 的 239 个专业；`not-available-for-international` 和 `hidden-unverified` 记录需要进入数据库以便管理端追溯，但不能进入普通用户主列表。

## 3. 当前基线核对

已运行静态提取校验：

- `npm run check:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base`
- 结果：通过，`staticValidation.ok = true`。

静态 HTML base 层全量基线：

| 项目 | 数量 |
| --- | ---: |
| 院校数 | 18 |
| 专业数 | 431 |
| ready 专业数 | 239 |
| 官方 MYR 学费专业数 | 240 |
| 官方费用来源 URL 专业数 | 248 |
| 官方开学信息专业数 | 245 |

UM 子集基线：

| 项目 | 数量 |
| --- | ---: |
| 院校 | 1 |
| 院校 code | UM |
| 院校 slug | `universiti-malaya-um` |
| 专业总数 | 248 |
| ready 专业数 | 239 |
| 不面向国际生专业数 | 6 |
| 隐藏未核验专业数 | 3 |
| 本科专业数 | 80 |
| 硕士专业数 | 137 |
| 博士专业数 | 31 |
| 官方 MYR 学费专业数 | 240 |
| 官方费用来源 URL 专业数 | 248 |
| 官方开学信息专业数 | 245 |

## 4. 影响模块和文件范围

### 4.1 后端数据层

受影响文件范围：

- `apps/api/src/db/entities.ts`
- `apps/api/src/db/static-html-catalog.ts`
- `apps/api/src/db/static-html-importer.ts`
- `apps/api/src/db/import-static-html.ts`
- `apps/api/src/db/verify-static-html.ts`
- `apps/api/src/common/mappers.ts`
- `packages/shared/src/index.ts`
- `tests/api/static-html-importer.test.ts`

当前 `UniversityEntity` 和 `ProgramEntity` 已具备本次 UM 数据导入所需的大部分字段：官方网址、申请入口、申请材料、中国学生要求、官方来源、公开展示状态、官方学费、费用来源、学制、开学时间、语言要求、学术要求、认证说明、审计备注和公开展示备注。第一阶段不建议新增数据库字段，除非实现时发现静态 HTML 中有无法落到现有字段且必须结构化检索的 UM 数据。

当前 `static-html-catalog.ts` 已能从静态 HTML 提取 base、supplement、merged 三层数据，并映射为 `StaticUniversitySeed` 与 `StaticProgramSeed`。但当前 CLI 默认按 layer 导入，缺少“只导入 UM”的稳定过滤参数；如果直接使用 base 导入，会扩大到 18 所院校，不符合本需求边界。

### 4.2 后端接口和命令

必须新增或调整的命令能力：

- `import:static` 支持 `--university-code UM` 或等价参数，默认只筛选 UM 院校和 UM 专业。
- `check:static` 支持同样的 UM 过滤参数，输出 UM 子集校验统计。
- scoped import 默认不得执行全库 prune；只有显式确认 scoped prune 时，才允许删除当前 scope 内的陈旧 UM 记录。
- dry-run 输出需要包含 UM 子集统计、状态分布、层级分布、官方来源数量、费用来源数量、开学信息数量和将创建/更新/跳过的记录数。

可延后能力：

- 管理端导入工作台接口可以沿用 TASK-004 规划中的 `/admin/import/static-html/dry-run` 和 `/admin/import/static-html/confirm` 方向，但本新增需求的首个实现可先完成 CLI 级 dry-run、导入和数据库校验。

### 4.3 用户端影响

受影响模块：

- `apps/web` 院校详情页、专业列表、专业详情弹窗、搜索筛选和对比展示。

本需求本身不要求调整视觉样式，但导入 UM 全部 248 个专业后，用户端必须继续遵守既有展示规则：

- 普通专业列表只展示 `publicDisplayStatus = ready`。
- 不面向国际生、隐藏未核验和需要复核的专业不能进入普通筛选结果。
- 列表展示使用 `listTuitionText`、`durationOfficial`、`officialIntake` 等短展示字段；详细官方说明只在专业详情中展示，避免把长官方文本塞进列表造成溢出。
- 前端不得把 UM 的专业数量、类别或费用规则固化为框架默认规则，应完全由 API 数据驱动。

### 4.4 管理端影响

受影响模块：

- `apps/admin` 学校管理、专业管理、官方来源和审计字段维护。

导入后管理端需要能够查看并维护 UM 的隐藏未核验、不面向国际生、费用来源、官方入学要求来源和审计备注。若当前管理端字段已可编辑，可不新增页面；若缺少筛选或批量复核能力，应作为后续管理端任务处理，不阻塞本次 CLI 数据导入。

## 5. 数据结构和状态设计

### 5.1 导入 scope

新增实现应引入明确的导入 scope：

- `layer`：仍表示 `base`、`supplement`、`merged` 数据层。
- `universityCode`：本需求固定为 `UM`。
- `expectedStats`：导入 scope 后应按 UM 子集重新计算，不沿用 base 全量 18 所院校统计。

这样可以避免把“马来大学导入”误写成“静态 HTML 全量导入”。

### 5.2 记录匹配策略

院校匹配：

- 优先按 `code=UM` 匹配。
- 其次可按 `slug=universiti-malaya-um` 兜底。
- 不应按中文名模糊匹配写库，避免同名或翻译差异误覆盖。

专业匹配：

- 优先按 `code` 匹配。
- 其次按 `slug` 匹配。
- 若 code 与 slug 命中不同记录，必须在 dry-run 中标记为冲突，不自动合并。

### 5.3 公开展示状态

导入必须保留静态 HTML 的 `publicDisplayStatus`：

- `ready`：允许进入用户端公开列表。
- `not-available-for-international`：进入数据库和管理端，不进入普通用户公开列表。
- `hidden-unverified`：进入数据库和管理端，不进入普通用户公开列表。
- `needs-review`：仅在管理端或内部校验中可见。

该规则来自数据状态，不应写死为 UM 专属规则。

### 5.4 事务和回滚

后续实现应优先使用事务包裹 UM scope 导入。导入前必须 dry-run，正式导入前建议先备份数据库或至少导出当前 UM 院校和专业记录。若正式导入后校验失败，应通过数据库备份或事务回滚恢复，不应依赖手工逐条删除。

## 6. 兼容关系

与既有能力兼容：

- 现有共享类型支持动态 `ProgramCategoryCode`，可以承载静态页中 46 个 ready 类别，不需要回退到 7 个核心类别。
- 现有 `mapProgram` 会输出官方费用、来源、学制、开学和要求字段，用户端可以继续复用现有 API 契约。
- 现有收藏、对比和规划依赖 `programId`、`universityId`，导入时应以更新为主，避免删除重建导致用户状态失效。

需要注意的兼容风险：

- 当前导入器 base 层默认 prune，如果直接用 UM 子集执行 prune，会误删非 UM 数据。
- 当前数据库连接使用 `synchronize: true`，正式环境导入前需确认不会触发非预期 schema 变更。
- 当前静态提取的 `sourceId` 未持久化到实体；若后续需要按静态 HTML 原始 id 做长期追溯，需要另开任务评估新增字段或导入审计表。
- 当前仓库已有多个未解决 i18n/视觉 Review issue，但它们不阻塞本任务的导入方案；正式 UI 验证时仍需避免中文动态内容泄漏到英文或马来文页面。

## 7. 后续实现步骤

1. 在 `static-html-catalog.ts` 中增加按 `universityCode` 或 `slug` 过滤 catalog 的纯函数，并保持 `stats` 与 `expectedStats` 按过滤后数据重新计算。
2. 在 `verify-static-html.ts` 和 `import-static-html.ts` 中接入 `--university-code UM` 参数。
3. 调整 `shouldPruneStaticCatalog` 或导入选项：scoped import 默认 `pruneCatalog=false`，避免误删非 UM 数据。
4. 在 `static-html-importer.ts` 的 dry-run/summary 中输出 create、update、conflict、skip、status 分布和 DB 校验结果。
5. 为 UM 子集统计、scoped prune 行为、code/slug 冲突和状态分布补充 `tests/api/static-html-importer.test.ts`。
6. 正式导入前运行 dry-run，确认 UM 子集为 1 所院校、248 个专业。
7. 正式导入后运行数据库校验，确认 UM 子集数量、公开状态、官方费用来源和开学信息与静态基线一致。
8. 若后续用户端页面展示导入数据，需要进行浏览器验证，重点检查院校详情专业 tab、专业列表、专业详情弹窗和搜索筛选。

## 8. 验证方式

本架构任务验证：

- `npm run check:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base`
- `npm run test`
- `npm run build`

后续实现任务建议新增验证：

- `npm run check:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base --university-code UM`
- `npm run import:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base --university-code UM --dry-run`
- `npm run import:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base --university-code UM --confirm-import`
- `npm run check:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base --university-code UM --db`
- `npm run test`
- `npm run build`

如用户端读取真实数据库展示 UM 数据，还需要浏览器验证：

- UM 院校详情页专业 tab 和专业数量。
- 本科、硕士、博士专业列表的横向/移动端布局。
- 至少抽查 5 个不同长度、不同状态、不同费用字段的专业详情弹窗。
- 搜索和筛选结果不包含非 ready 专业。

## 9. 风险和回滚

| 风险 | 影响 | 控制方式 |
| --- | --- | --- |
| 将 UM 需求误实现为全量 18 所院校或 merged 119 所院校导入 | 数据范围扩大，可能覆盖历史数据 | 必须引入 `universityCode=UM` scope，dry-run 显示 UM 子集统计 |
| scoped import 触发全库 prune | 误删非 UM 院校、专业和关联用户状态 | scoped import 默认禁止 prune，正式 prune 需额外确认 |
| code/slug 生成规则变化 | 收藏、对比、规划中的 programId 可能失效 | 导入以更新为主，冲突时阻塞，不自动删除重建 |
| 长官方字段进入列表 | 用户端列表溢出或布局错乱 | 列表只使用短字段，详情弹窗展示完整官方说明 |
| 费用或来源字段缺失 | 费用估算和官方核验说明不可信 | dry-run 输出缺失统计，缺失数据保持 `needs-review` 或审计备注 |
| 多语言动态数据不完整 | 英文/马来文页面出现中文内容 | API 与前端继续使用本地化字段和安全 fallback，UI 验证纳入后续任务 |

## 10. 结论

当前数据模型基本可以承载 UM 静态 HTML 数据，本新增需求的关键不是新增大量字段，而是把导入范围从 layer 全量导入收窄为 UM scoped import，并补齐 dry-run、统计校验、默认不 prune、冲突阻塞和导入后数据库校验。后续 TASK-053 应只实现 UM 数据导入链路，不应顺手处理其他院校导入、管理端工作台大改或用户端视觉重构。
