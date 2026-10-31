# 任务：院校与专业数据模型及 API 升级

- **任务编号**: TASK-004
- **任务标题**: 院校与专业数据模型及 API 升级
- **状态**: 已阻塞
- **优先级**: 高
- **任务类型**: 后端
- **负责人**: Codex
- **关联需求**: 产品需求文档
- **关联技术方案**: 技术方案
- **实现说明**: 根据静态页面字段升级后端实体、共享类型、种子数据和 API，使用户端和管理端能支撑新展示功能。
- **测试计划**: 运行 API 构建、种子数据或接口验证；必要时补充 mock 数据。
- **验证结果**: 已产出中文方案文档 `docs/prd/TASK-004-data-model-api-upgrade-plan.md`；已读取并分析静态 HTML 和旧系统；已明确后端数据模型、API、管理端维护能力、用户端数据依赖和后续中文任务项；已运行 `npm run build` 并通过。本任务未修改 `apps/web`、`apps/api`、`apps/admin` 的业务实现文件。
- **阻塞说明**: Review 未通过：本轮按后端/API 独立 Review 复核，未修改代码。实际 Notion 搜索未定位到 TASK-004 页面，因此以用户提供的任务页内容、本地任务快照、PRD 文档和当前工作区代码为依据。`npm test -- tests/api/public-api-services.test.ts`、`npm test -- tests/api/compare-service.test.ts`、`npm test -- tests/web/format.test.ts`、`npm test -- tests/api` 和 `npm run build` 均通过，构建仅保留 admin chunk 体积警告。但仍有 2 个问题：TASK-004 任务记录仍声明未改业务实现，和当前大范围代码变更不一致；费用估算在官方 MYR programId 默认路径下仍不纳入生活费，且 `/tools/cost-estimate` 与 `/programs/cost-estimate/:id` 口径不统一。

## 依赖任务
- TASK-003

## 验收标准
- 后端数据模型覆盖静态页面展示所需字段。
- 用户端所需搜索、筛选、详情、对比、收藏和规划接口有明确实现方案。
- 管理端可维护核心字段和官方来源信息。

## 关联 Commit

## 执行记录

### 2026-05-21T21:56:01.152Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-004-2026-05-21T21-56-01-152Z 已领取该任务。

### 2026-05-22T06:03:26+08:00 - Codex 执行记录

- **状态**: 待评审
- **产出文档**: `docs/prd/TASK-004-data-model-api-upgrade-plan.md`
- **静态 HTML 分析**: 已读取 `D:\mydev\StudyMY_UM_v58_na_display_tidy.html`，提取到 18 所院校、431 个专业、239 个 ready 专业、6 个不开放国际学生专业、3 个隐藏未核验专业、183 个缺少公开展示状态的遗留专业，以及 46 个 ready 专业类别。
- **旧系统分析**: 已结合 `D:\mydev\study-malaysia`，核对 `packages/shared`、`apps/api`、`apps/admin` 和 `apps/web` 的现有字段、API、管理端表单和用户端数据依赖。
- **任务拆解**: 已按后端服务、管理端、用户端拆分后续中文任务项，覆盖共享类型、实体、搜索筛选、收藏对比、规划工具、导入校验、管理端官方字段维护和用户端 API 接入。
- **Notion 更新**: 未更新实际 Notion。`NOTION_PROJECT_HOME` 为空，Notion 搜索未定位到 TASK-004 页面；已更新本地中文文档快照。

### 2026-05-21T22:05:39.089Z - 自动状态更新

- **状态**: 待评审
- **说明**: Codex 已完成实现并返回完成状态。

### 2026-05-24T22:19:16.094Z - 自动状态更新

- **状态**: 已阻塞
- **说明**: Review 未通过：本轮按后端/API 独立 Review 复核，未修改代码。实际 Notion 搜索未定位到 TASK-004 页面，因此以用户提供的任务页内容、本地任务快照、PRD 文档和当前工作区代码为依据。`npm test -- tests/api/public-api-services.test.ts`、`npm test -- tests/api/compare-service.test.ts`、`npm test -- tests/web/format.test.ts`、`npm test -- tests/api` 和 `npm run build` 均通过，构建仅保留 admin chunk 体积警告。但仍有 2 个问题：TASK-004 任务记录仍声明未改业务实现，和当前大范围代码变更不一致；费用估算在官方 MYR programId 默认路径下仍不纳入生活费，且 `/tools/cost-estimate` 与 `/programs/cost-estimate/:id` 口径不统一。
