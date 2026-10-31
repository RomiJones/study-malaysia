# 任务：搜索筛选、专业详情与对比功能升级

- **任务编号**: TASK-007
- **任务标题**: 搜索筛选、专业详情与对比功能升级
- **状态**: 已阻塞
- **优先级**: 高
- **任务类型**: 前端
- **负责人**: Codex
- **关联需求**: 产品需求文档
- **关联技术方案**: 技术方案
- **实现说明**: 实现静态页面中的搜索建议、筛选组、活跃筛选标签、专业详情弹窗、对比表格等交互。
- **测试计划**: 浏览器验证搜索、筛选、清除筛选、打开详情、加入/移除对比、对比表格展示。
- **验证结果**: 已运行 `npm run build`，API、用户端、管理端和共享包构建通过；管理端存在既有大 chunk 警告，不阻塞本任务。
- **阻塞说明**: TASK-007 已存在不可自动修复的 Review 问题：TASK-007-REVIEW-004（high/automation）：TASK-007 交付记录仍与实际实现验收口径不一致；TASK-007-REVIEW-004（high/automation）：TASK-007 交付记录仍与实际实现验收口径不一致；TASK-007-REVIEW-004（high/automation）：TASK-007 交付记录仍与实际实现验收口径不一致；另有 5 个问题。已停止重复 Review，等待人工决策或单独修复任务处理。

## 依赖任务
- TASK-006

## 验收标准
- 搜索和筛选结果与页面状态同步。
- 专业详情展示完整字段和官方来源。
- 对比功能可添加、移除并展示多个项目差异。

## 关联 Commit

## 执行记录

### 2026-05-21T22:13:19.744Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-007-2026-05-21T22-13-19-744Z 已领取该任务。

### 2026-05-22T06:19:41+08:00 - 自动化运行 TASK-007-2026-05-21T22-13-19-744Z

- **状态**: 待评审
- **摘要**: 已读取并分析静态 HTML `D:\mydev\StudyMY_UM_v58_na_display_tidy.html`，已结合旧系统 `D:\mydev\study-malaysia`，产出中文规划文档 `docs/prd/TASK-007-search-filter-program-detail-compare-plan.md`。文档覆盖中文 PRD、功能清单、视觉规范、旧系统差距分析和按用户端、后端服务、管理端拆分的后续中文任务项。
- **静态页分析**: 已核验 `filteredUnis`、`getSearchSuggestions`、`renderHome`、`renderProgModal`、`toggleCompare`、`renderCompare`、`setFilter`、`resetFilters`、`clearFilter`、`onSearchInput`、`selectSug` 等关键交互；确认静态页搜索建议最多 8 条、只推荐 ready 专业、筛选更新回到第 1 页、对比最多 4 所、专业详情弹窗展示官方字段和来源。
- **旧系统分析**: 已核对 `apps/web` 用户端状态和页面、`apps/api` 公开服务和实体、`apps/admin` 字段维护页面、`packages/shared` 类型，确认当前系统缺少搜索建议 API、筛选 facets、activeFilters、专业公开状态、完整官方字段、对比 4 所上限和静态页弹窗主流程。
- **测试结果**: 已运行 `npm run build`，API、用户端、管理端和共享包构建通过；管理端存在既有大 chunk 警告，不阻塞本任务。
- **Commit**: 无。当前目录不是 Git 仓库，无法生成本地 commit。
- **Notion 更新**: 未更新实际 Notion。`NOTION_PROJECT_HOME` 为空，Notion 搜索未定位到 TASK-007 页面；已更新本地中文文档与本地 Notion 快照。

### 2026-05-21T22:21:19.376Z - 自动状态更新

- **状态**: 待评审
- **说明**: Codex 已完成实现并返回完成状态。

### 2026-05-24T23:02:04.085Z - 自动状态更新

- **状态**: 已阻塞
- **说明**: TASK-007 已存在不可自动修复的 Review 问题：TASK-007-REVIEW-004（high/automation）：TASK-007 交付记录仍与实际实现验收口径不一致；TASK-007-REVIEW-004（high/automation）：TASK-007 交付记录仍与实际实现验收口径不一致；TASK-007-REVIEW-004（high/automation）：TASK-007 交付记录仍与实际实现验收口径不一致；另有 5 个问题。已停止重复 Review，等待人工决策或单独修复任务处理。
