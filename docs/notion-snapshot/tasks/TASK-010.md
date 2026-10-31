# 任务：共享类型、后端实体和数据库字段落地

- **任务编号**: TASK-010
- **任务标题**: 共享类型、后端实体和数据库字段落地
- **状态**: 已完成
- **优先级**: 高
- **任务类型**: 后端
- **负责人**: Codex
- **关联需求**: 产品需求文档
- **关联技术方案**: 技术方案
- **实现说明**: 本任务允许修改业务代码。根据 TASK-004、TASK-005 和 TASK-009 的中文方案，升级 `packages/shared` 与 `apps/api` 的院校、专业、费用、要求、申请材料、开学时间、官方来源、公开展示状态、来源状态、核验日期、费用审计等类型和实体结构；保持旧字段兼容，不做用户端大改。
- **测试计划**: 运行 `npm run build`；补充或运行实体、mapper、类型边界相关单元测试。
- **验证结果**: `npm run build` 通过；`npx tsc -p apps/api/tsconfig.json --noEmit` 通过；管理端存在既有 Vite chunk 大小警告，不阻塞本任务。
- **阻塞说明**: 无。真实 Notion 未更新：`NOTION_PROJECT_HOME` 为空且未提供 TASK-010 页面 URL，本轮仅更新本地 Notion 快照。

## 依赖任务
- TASK-009

## 验收标准
- `packages/shared` 暴露三端可复用的院校、专业、费用、要求、官方来源和展示状态类型。
- `apps/api` 实体覆盖静态 HTML 中已确认的核心字段，并保留旧系统字段兼容。
- mapper/DTO 能输出用户端和管理端所需字段，不把官方来源和审计信息塞进通用描述字段。
- `npm run build` 通过。
- 相关单元测试或类型验证通过。

## 关联 Commit

- 已提交，最终 commit hash 以本轮结构化结果为准。

## 执行记录

### 2026-05-22T16:26:58.756Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-010-2026-05-22T16-26-58-741Z 已领取该任务。

### 2026-05-23T00:39:56+08:00 - Codex 实现完成

- **状态**: 已完成
- **摘要**: 已按 TASK-004、TASK-005 和 TASK-009 中文方案落地共享类型、API 实体、公开 mapper、管理端 DTO 和公开展示过滤。`packages/shared` 新增公开展示状态、官方来源状态、费用币种、费用审计、官方来源链接、费用信息、要求信息、院校官方档案和专业官方档案类型；保留旧 `ProgramCategory` 给现有用户端规划表单使用，并新增 `ProgramCategoryCode` 支撑字典驱动分类。`apps/api` 院校和专业实体新增官方入口、申请信息、官方来源、核验日期、公开展示状态、RM 学费、费用审计、官方要求、审计备注等字段，并保留旧 `isPublished`、CNY 学费、基础要求等字段兼容。
- **公开 API 规则**: 院校、专业、推荐和费用估算的公开读取均以 `isPublished = true` 且 `publicDisplayStatus = ready` 为主；管理端列表仍可按公开状态、来源状态和费用审计状态查看维护记录。
- **mapper/DTO**: mapper 已显式输出 `officialSources`、`tuitionInfo`、`requirementInfo`、`publicDisplayStatus`、`officialSourceStatus` 和审计字段，不把官方来源或审计信息塞进 `description`；管理端保存 DTO 已允许提交新增官方字段。
- **验证结果**: `npm run build` 通过；`npx tsc -p apps/api/tsconfig.json --noEmit` 通过；管理端仍有既有大 chunk 警告，不阻塞本任务。
- **Notion 更新**: 未直接更新真实 Notion；`NOTION_PROJECT_HOME` 为空且未提供 TASK-010 页面 URL，本轮只更新本地中文快照。

### 2026-05-22T16:42:22.306Z - 自动状态更新

- **状态**: 待评审
- **说明**: Codex 已完成实现并返回完成状态。

### 2026-05-24T21:26:38.961Z - 自动状态更新

- **状态**: 已完成
- **说明**: Review 通过：Review 通过。共享类型、后端实体、公开 mapper、管理端 DTO/校验和公开 API 边界已覆盖 TASK-010 的核心验收点；此前隐藏父院校 relation 泄漏问题已修复，专业列表、专业详情、院校搜索与 programCount、收藏、对比、规划和费用估算均按公开目录条件过滤。构建和测试通过；管理端仍只有既有 Vite chunk 大小警告，不阻塞本任务。真实 Notion 本轮未更新。
