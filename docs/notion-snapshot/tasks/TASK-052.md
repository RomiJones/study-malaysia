# 任务：新增需求技术影响分析和实现方案

- **任务编号**: TASK-052
- **任务标题**: 新增需求技术影响分析和实现方案
- **状态**: 已完成
- **优先级**: 高
- **任务类型**: 架构
- **负责人**: Codex
- **关联需求**: 产品需求文档
- **关联技术方案**: 技术方案
- **实现说明**: 基于新增需求补充技术方案，明确影响模块、数据或状态变化、接口、前端交互、验证方式和回滚风险。
- **测试计划**: 人工检查技术影响分析是否能指导后续单任务实现。
- **验证结果**: 已完成 TASK-052 技术影响分析文档 `docs/prd/TASK-052-um-static-html-data-import-impact-plan.md`。已验证静态 HTML base 层可读取并确认 UM 子集基线：1 所院校、248 个专业，其中 ready 239 个、不面向国际生 6 个、隐藏未核验 3 个。`npm run check:static -- --input "D:\mydev\StudyMY_UM_v58_na_display_tidy.html" --layer base`、`npm run test`、`npm run build` 均通过；管理端构建存在既有 chunk 体积警告，不阻塞本架构任务。
- **阻塞说明**: 

## 依赖任务


## 并行分组
- parallelGroup: api-endpoints

## 影响范围
- affectedApps: apps/web, apps/api
- affectedModules: apps/web:需求技术影响分析和实, apps/api:需求技术影响分析和实
- likelyFiles: none

## 锁范围建议
- lockScopeHint: module_scope
- riskLevel: medium

## 依赖说明
- 当前任务没有真实前置任务；如锁范围不冲突，可作为并行候选。
- 并行说明：parallelGroup=api-endpoints，lockScopeHint=module_scope。文件或模块冲突由运行时锁控制，不通过伪依赖解决。

## 验收标准
- 已列出新增需求影响的模块、文件范围、接口或数据结构。
- 已说明与已有能力的兼容关系和风险。
- 已明确验证命令、浏览器验证或数据校验方式。
- 已避免把具体 Demo 业务规则固化为框架默认规则。

## 关联 Commit

## 执行记录

### 2026-05-24T13:38:51.600Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-052-2026-05-24T13-38-51-584Z 已领取该任务。

### 2026-05-24T13:38:51.584Z - Codex 技术方案补充

- **状态**: 待评审
- **摘要**: 已补充 UM 静态 HTML 数据导入技术影响分析和实现方案，明确后续实现必须采用 `code=UM` scoped import，不得把 base 全量 18 所院校或 merged 119 所院校默认写入数据库；scoped import 默认禁止全库 prune，必须先 dry-run，再导入，再做数据库校验。
- **影响模块**: `apps/api` 静态 HTML 提取、导入、校验、实体映射、公共 API mapper；`apps/web` 院校详情、专业列表、专业弹窗和搜索筛选的数据展示规则；`apps/admin` 学校和专业官方字段维护。
- **关键数据结构**: 复用 `UniversityEntity`、`ProgramEntity`、`StaticUniversitySeed`、`StaticProgramSeed`、`ProgramCategoryCode`、`PublicDisplayStatus` 和官方来源/费用/要求字段；第一阶段不建议新增数据库字段。
- **接口和命令方案**: 后续 TASK-053 应为 `check:static` 和 `import:static` 增加 `--university-code UM` 或等价参数，dry-run 输出 UM 子集统计，正式导入后按 UM 子集校验数据库。
- **兼容和风险**: 现有模型基本可承载 UM 数据；主要风险是误导入全量院校、scoped import 触发全库 prune、code/slug 冲突导致用户状态失效、长官方字段进入列表造成 UI 溢出。
- **验证记录**: 静态提取校验、单元测试和构建均通过；本任务未修改业务代码，未执行数据库写入，未做浏览器 UI 验证。
- **Notion 更新**: 未更新实际 Notion 页面；本轮只更新本地中文任务快照和 TASK-052 技术方案补充文档。

### 2026-05-24T13:47:16.904Z - 自动状态更新

- **状态**: 待评审
- **说明**: Codex 已完成实现并返回完成状态。

### 2026-05-24T13:50:37.241Z - 自动状态更新

- **状态**: 已完成
- **说明**: Review 通过：Review 通过。TASK-052 本轮实际变更为架构与任务快照文档，未修改业务代码或写入数据库；新增文档覆盖了 UM 数据导入范围、影响模块、数据状态、接口命令、验证方式、兼容风险和回滚策略，符合本架构任务验收标准。当前工作区存在大量非本轮未提交改动，测试复核是在当前工作区状态下执行。

### 2026-05-24T13:50:37.261Z - 自动状态更新

- **状态**: 已完成
- **说明**: Review 通过：Review 通过。TASK-052 本轮实际变更为架构与任务快照文档，未修改业务代码或写入数据库；新增文档覆盖了 UM 数据导入范围、影响模块、数据状态、接口命令、验证方式、兼容风险和回滚策略，符合本架构任务验收标准。当前工作区存在大量非本轮未提交改动，测试复核是在当前工作区状态下执行。
