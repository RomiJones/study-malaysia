# TASK-096 数据模型和数据准备需求边界与验收补充

## 1. 文档信息

- **任务编号**：TASK-096
- **任务标题**：新增需求边界、验收标准和依赖规划补充：数据模型和数据准备拆分
- **运行编号**：TASK-096-2026-05-25T15-07-39-352Z
- **父任务**：TASK-067
- **父任务新增需求**：后端接口返回的数据多语言不完整，学校和专业等业务数据也需要以多语言正常版本入库，不能只依赖前端多语言兜底。
- **当前子任务定位**：只处理学校、专业、费用、要求、申请材料、官方来源等后端数据模型与可重复数据准备的边界、验收标准、依赖规划和本地验证记录。
- **事实来源说明**：Notion 是中文项目文档和任务管理来源，不是业务数据库；本地 Markdown 快照只作为本轮可写入记录，不使用 `task.json` 作为任务事实源。

## 2. 目标和用户价值

TASK-096 的目标是把父任务 TASK-067 中“业务数据本身多语言正常入库”的数据层范围单独收口。后续学校和专业数据应在数据库层具备 `zh-CN`、`zh-TW`、`en`、`ms` 四语言字段承载能力、公开展示状态、官方来源状态、费用审计状态、导入或种子数据校验方式，避免接口只能返回中文字段后再由前端临时伪装为多语言。

对用户的价值是：用户在英文、马来文、简体中文或繁体中文界面查看院校详情、专业列表、专业弹窗、费用、申请要求和材料时，看到的是可追溯的业务数据，而不是前端硬编码或不透明 fallback。对运营和管理端的价值是：缺失翻译、来源不足、未核验和不适合公开展示的数据可以进入数据治理流程，而不是混入公开列表。

## 3. 数据模型边界

TASK-096 覆盖以下后端数据层对象和状态：

- 院校主档：`name`、`location`、`region`、`description`、`facilities`、`highlights`、`applicationDocuments`、`chinaStudentRequirements` 等应按四语言结构存储。
- 专业主档：`name`、`faculty`、`description`、`requirement.note`、`applicationDocs`、`curriculum`、`careers`、`specializations` 等应按四语言结构存储。
- 官方原文字段：官方学制、开学时间、语言要求、学术要求、认证说明、来源标题和来源 URL 可保留官方原文，但必须与普通展示字段、审计备注和本地化字段边界清楚。
- 数据状态：院校和专业必须保留 `publicDisplayStatus`、`isPublished`、`officialSourceStatus`、`officialVerifiedAt`、`officialAuditSummary`、`officialFeeAuditStatus`、`officialFeeAuditedAt`、`reviewReason` 或等价审计字段。
- 费用与要求：官方 MYR 学费、展示学费、费用来源、二级费用来源、语言成绩、学术要求、中国学生要求和申请材料应可被 API、管理端和导入校验复用。

当前工作区的 `UniversityEntity` 和 `ProgramEntity` 已具备上述核心字段承载能力；本任务不新增数据库字段。若后续发现真实数据库 schema 未同步这些实体字段，或正式环境禁止 TypeORM `synchronize` 自动同步，应由独立迁移任务处理，不能在本任务中临时写库或跳过迁移审查。

## 4. 数据准备边界

TASK-096 覆盖可重复数据准备和校验方式，不直接导入生产数据：

- 静态 HTML 提取应以 `D:\mydev\StudyMY_UM_v58_na_display_tidy.html` 为输入源，并支持按数据层和院校 scope 生成校验报告。
- UM 数据准备应可使用 `--university-code UM` 限定范围，避免把父需求误扩展为全量院校导入。
- dry-run 必须输出输入路径、数据层、scope、静态校验结果、导入计划、创建/更新/跳过数量、公开状态分布、层级分布、字段缺失、重复或 code/slug 冲突。
- 正式导入必须在 dry-run 通过后再执行，且 scope 导入默认不得 prune 非 UM 数据；出现跨院校 code/slug 冲突时必须阻塞。
- 导入后应有数据库统计校验，至少覆盖院校数、专业数、ready 专业数、官方 MYR 学费数量、官方费用来源数量和官方开学信息数量。
- 多语言业务数据应有独立覆盖率检查，至少识别缺失 locale、localized payload 形状错误，以及英文/马来文字段中混入中文内容。

## 5. 非目标

- TASK-096 不修改用户端页面、CSS、弹窗、语言切换入口或前端 formatter。
- TASK-096 不设计后端 API 响应契约、控制器鉴权、查询参数或错误响应结构；这些属于 TASK-097。
- TASK-096 不处理管理端页面、审批发布工作台或字段编辑表单。
- TASK-096 不执行生产或测试数据库真实导入，不删除或覆盖已有用户收藏、规划、申请记录。
- TASK-096 不把 Notion、本地 Markdown、静态 HTML 或 `task.json` 当作业务运行时数据库。
- TASK-096 不关闭历史 Review issue；只能判断它们是否影响当前数据模型和数据准备范围。

## 6. 当前数据层基线判断

本轮读取当前工作区后确认：

- `packages/shared/src/i18n.ts` 定义的支持语言为 `en`、`ms`、`zh-CN`、`zh-TW`，并提供 `LocalizedText` 与 `LocalizedStringArray`。
- `apps/api/src/db/entities.ts` 的 `UniversityEntity` 和 `ProgramEntity` 使用 JSON 字段承载主要多语言文本和多语言数组。
- `apps/api/src/db/static-html-catalog.ts` 已定义 UM base scope 基线：1 所院校、248 个专业、239 个 ready 专业、240 个官方 MYR 学费、248 个官方费用来源、245 个官方开学信息。
- `apps/api/src/db/import-static-html.ts` 和 `apps/api/src/db/verify-static-html.ts` 已支持 `--university-code` 与 `--university-slug` scope 参数。
- `apps/api/src/i18n/catalog-localization.service.ts` 已提供数据多语言覆盖率检查逻辑，可识别缺失 locale、payload 形状错误和英文/马来文字段中文泄漏。
- `tests/api/static-html-importer.test.ts` 和 `tests/api/catalog-localization-service.test.ts` 已覆盖 scoped import、UM 统计基线、冲突检测和多语言覆盖率检查。

上述判断基于当前工作区快照；由于工作区存在并行任务未提交改动，最终提交归属和 Review 状态仍需要由各子任务在验证通过后分别收口。

## 7. 相关 Review 问题判断

本轮读取本地 Review 快照后，与 TASK-096 数据层直接或间接相关的开放问题包括：

- `TASK-004-REVIEW-001`：数据模型任务记录与当前实现范围不一致，影响数据层可追踪性。
- `TASK-004-REVIEW-011`：费用估算的官方 MYR programId 路径仍未明确纳入生活费，属于费用消费逻辑，不属于本任务字段边界。
- `TASK-013-REVIEW-002`：申请任务去重缺少数据库唯一约束，属于用户申请数据一致性，不属于院校/专业多语言入库字段。
- `TASK-014-REVIEW-001`、`TASK-014-REVIEW-002`：官方来源 URL 和核验日期校验不足，会影响管理端核验可信度，但修复应归属管理端 CMS 校验任务。
- `TASK-030-REV-005`、`TASK-030-REV-006`：用户端仍可能显示中文分类或简体动态数据，说明前端 fallback 不能替代 TASK-096 的真实业务数据多语言治理。

这些问题不阻塞本轮文档边界和数据准备验证；后续实现和 Review 应继续跟踪，尤其是来源 URL、核验日期和费用消费口径。

## 8. 验收标准

TASK-096 完成后应满足：

- 已明确院校和专业多语言业务数据必须在数据库或种子数据层具备四语言承载能力。
- 已明确公开展示状态、官方来源状态、费用审计状态和核验字段属于数据模型验收范围。
- 已明确静态 HTML、UM scope dry-run、导入计划、冲突检测和导入后统计校验的可重复验证方式。
- 已说明前端 i18n fallback、后端 API 契约、用户端页面和最终集成验收分别由 TASK-099、TASK-097、TASK-098 和 TASK-100 承接。
- 已复核相关开放 Review 问题是否影响当前任务，并记录边界判断。
- 数据层专项测试、全量测试和构建通过后，任务页记录验证结果和 Notion 未更新原因。

## 9. 验证命令

本任务的可重复验证命令为：

- `npm run check:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base --university-code UM`
- `npm run test -- tests/api/static-html-importer.test.ts tests/api/catalog-localization-service.test.ts`
- `npm run test`
- `npm run build`

若连接真实数据库执行 dry-run 或正式导入，还应先运行：

- `npm run import:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base --university-code UM --dry-run`

正式写库导入需要在 dry-run 审阅通过后追加确认参数，且不得在未确认环境、备份和覆盖策略时执行。

## 10. 本轮验证结果

本轮已执行并通过：

- `npm run check:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base --university-code UM`
  - `staticValidation.ok = true`。
  - scope 命中 `code=UM`、`slug=universiti-malaya-um`。
  - UM base 基线：1 所院校、248 个专业、239 个 ready 专业、240 个官方 MYR 学费、248 个官方费用来源、245 个官方开学信息。
  - 公开状态分布：`ready=239`、`not-available-for-international=6`、`hidden-unverified=3`。
  - 层级分布：本科 80、硕士 137、博士 31。
- `npm run test -- tests/api/static-html-importer.test.ts tests/api/catalog-localization-service.test.ts`
  - 2 个测试套件、22 个用例通过。
  - 覆盖 UM scope 基线、scoped prune 行为、跨院校 code/slug 冲突、目录多语言缺失和英文/马来文字段中文泄漏检查。
- `npm run test`
  - 17 个测试套件、111 个用例通过。
- `npm run build`
  - API、Web、Admin、Shared workspace 构建通过。
  - Admin 构建保留既有 chunk size 警告，不阻塞本任务。

本轮没有执行真实数据库写入导入；`dbStats` 和 `dbValidation` 未启用，因为未确认目标数据库环境、备份和覆盖策略。

## 11. 依赖规划

当前 TASK-096 没有真实前置任务，可在 `parallelGroup=data-models` 下独立完成数据层边界和本地验证。

后续真实依赖按能力判断，而不是按任务编号机械串联：

- TASK-097 依赖 TASK-096 明确的数据字段、状态和覆盖率检查结果，才能定义 API 多语言契约。
- TASK-098 可先实现用户端兜底，但完整证明“业务数据多语言正常”仍依赖 TASK-096 和 TASK-097。
- TASK-099 的前端文案一致性只能防止可见混合语言，不能替代数据层多语言入库。
- TASK-100 应将 TASK-096 的静态校验、数据层测试、全量测试和构建结果纳入最终验收。
- 若后续需要真实数据库迁移、管理端翻译维护或生产导入，应拆为独立任务并扩大锁范围。

## 12. 风险和待确认问题

- 真实数据库环境、迁移策略和是否允许 TypeORM `synchronize` 自动同步仍需确认。
- UM 数据目前可通过静态 HTML scope 校验，但“所有学校数据多语言入库”应另开全量数据治理任务，不应混入 TASK-096。
- 官方英文校名、专业名、来源标题和 URL 可保留原文；验收时不能简单把所有英文判断为未本地化。
- 马来文翻译质量和官方中文翻译来源需要运营或人工校对，自动脚本只能识别结构和明显中文泄漏。
- 当前工作区已有大量并行未提交改动，提交时必须只纳入 TASK-096 文档和验证记录。
