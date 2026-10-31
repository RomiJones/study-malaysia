# 任务：新增需求边界、验收标准和依赖规划补充：多语言文案一致性拆分

- **任务编号**: TASK-099
- **任务标题**: 新增需求边界、验收标准和依赖规划补充：多语言文案一致性拆分
- **状态**: 已阻塞
- **优先级**: 高
- **任务类型**: 前端
- **负责人**: Codex
- **关联需求**: 产品需求文档
- **关联技术方案**: 技术方案
- **实现说明**: 从父任务 TASK-067 中拆出多语言 key、硬编码文案和语言切换一致性检查。
- **测试计划**: 切换所有支持语言，检查混合语言、缺失 key 和布局稳定性。
- **验证结果**: 已补充多语言文案一致性需求边界、验收标准和依赖规划；本轮复核 `npm run verify:task041:i18n` 通过，确认四语言 key 完整、缺失 key 为 0、可见硬编码文案为 0、raw API error 用户可见展示为 0；`npm run test -- tests/web/format.test.ts` 通过，13 个用例覆盖中文分类本地化、英文/马来文页面中文动态文本防泄漏、繁体动态样本转换和院系 fallback；`npm run verify:task042` 通过，420 个四语言桌面端和移动端场景均无阻塞问题；`npm run test` 通过，17 个套件 111 个用例通过；`npm run build` 通过，Admin 仅保留既有 chunk size 警告。
- **阻塞说明**: TASK-099 已存在不可自动修复的 Review 问题：TASK-099-REV-001（medium/automation）：实现结果提交指针与 TASK-099 实际提交不一致。已停止重复 Review，等待人工决策或单独修复任务处理。

## 依赖任务


## 并行分组
- parallelGroup: i18n

## 影响范围
- affectedApps: apps/web
- affectedModules: i18n
- likelyFiles: none

## 锁范围建议
- lockScopeHint: module_scope
- riskLevel: medium

## 父子任务
- parentTaskId: TASK-067
- childTaskIds: none
- splitDepth: 1
- splitReason: 由父任务 TASK-067 拆分生成。
- splitStatus: not_split

## 任务粒度
- taskSize: medium
- taskSizeScore: 0
- taskSizeReasons: 子任务由任务拆分门禁生成，默认按 medium 以下粒度执行。

## 执行提示
- shouldRunAsParent: true
- childCompletionPolicy: all_children_passed

## 依赖说明
- 当前子任务没有真实前置任务；如锁范围不冲突，可作为并行候选。
- 并行说明：parallelGroup=i18n，lockScopeHint=module_scope。文件或模块冲突由运行时锁控制，不通过伪依赖解决。

## 验收标准
- 支持语言没有明显混合语言。
- 缺失 key 和硬编码文案得到处理或记录。

## 关联 Commit

## 执行记录

### 2026-05-25T13:45:24.389Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-099-2026-05-25T13-45-24-384Z 已领取该任务。

### 2026-05-25T14:00:00.000Z - Codex 执行记录

- **状态**: 已完成
- **说明**: 已新增 `docs/prd/TASK-099-i18n-copy-consistency-requirement-boundary.md`，并在本地 PRD 与技术方案快照中补充 TASK-099 的目标、用户价值、功能范围、非目标、历史 Review 关系、验收口径、依赖规划、阻塞条件和详细文档链接。
- **Review 判断**: 已读取 Review 快照。`TASK-030-REV-005`、`TASK-030-REV-006`、`TASK-030-REV-007` 与本任务相关；当前专项 i18n 审计、format 单测和四语言浏览器抽查均未复现对应问题。Review 快照仍显示 open，后续应由 Review 流程依据本轮验证结果标记 fixed 或 verified。
- **验证命令**:
  - `npm run verify:task041:i18n`：通过。
  - `npm run test -- tests/web/format.test.ts`：通过，13 个用例通过。
  - `npm run verify:task042`：首次在 Playwright `page.evaluate` 导航竞态处失败，已完成 178 个场景均无阻塞；复跑超过 5 分钟超时，判定为全量脚本稳定性风险，已用 TASK-099 轻量浏览器抽查补足四语言验证。
  - TASK-099 四语言浏览器抽查：通过，32 个场景通过，截图和 JSON 报告位于 `output/playwright/task099-i18n-smoke`。
  - `npm run test`：通过，16 个套件 94 个用例通过。
  - `npm run build`：通过，Admin 仅保留既有 chunk size 警告。
- **Notion 更新说明**: 未更新真实 Notion 页面；本轮没有可写入的 TASK-099 Notion 页面 ID，已更新本地中文 Notion 快照和 PRD/技术方案文档。

### 2026-05-25T14:09:11.253Z - 自动状态更新

- **状态**: 已失败
- **说明**: 通过。i18n 审计通过，缺失 key=0、可见硬编码文案=0、raw API error 用户可见展示=0；format 单测 13 个通过；四语言浏览器抽查 32 个场景通过；全量测试 16 个套件 94 个用例通过；全量构建通过，Admin 仅有既有 chunk size 警告。

### 2026-05-25T15:10:50.453Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-099-2026-05-25T15-10-50-407Z 已领取该任务。

### 2026-05-25T15:10:50.407Z - Codex 复核记录

- **状态**: 已完成
- **说明**: 已复核同任务历史 `external_auth_required` 自动化错误。该错误记录中的摘要和测试结果均显示 TASK-099 已完成，失败根因是缺少真实 Notion 可写页面或外部同步状态，不是代码、文档或验证失败；本轮继续以本地中文快照记录结果。
- **Review 判断**: `TASK-030-REV-005`、`TASK-030-REV-006`、`TASK-030-REV-007` 仍在 Review 快照中显示 open，但本轮 i18n 审计、format 单测和全量四语言视觉回归均未复现；后续应由 Review 流程按本轮证据标记 fixed 或 verified。
- **验证命令**:
  - `npm run verify:task041:i18n`：通过，四语言 key 数 487，缺失 key 0，额外 key 0，可见硬编码文案 0，raw API error 用户可见展示 0。
  - `npm run test -- tests/web/format.test.ts`：通过，13 个用例通过。
  - `npm run test`：通过，17 个套件 111 个用例通过。
  - `npm run build`：通过，Admin 仅保留既有 chunk size 警告。
  - `npm run verify:task042`：通过，420 个场景和 420 张截图通过，阻塞问题 0，报告位于 `output/playwright/task042-20260525T151347Z`。
- **Notion 更新说明**: 未更新真实 Notion 页面；本轮没有可写入的 TASK-099 Notion 页面 ID，已更新本地中文任务快照和开发记录。

### 2026-05-25T15:23:13.981Z - 自动状态更新

- **状态**: 待评审
- **说明**: Codex 已完成实现并返回完成状态。

### 2026-05-25T15:31:39.067Z - 自动状态更新

- **状态**: 已阻塞
- **说明**: TASK-099 已存在不可自动修复的 Review 问题：TASK-099-REV-001（medium/automation）：实现结果提交指针与 TASK-099 实际提交不一致。已停止重复 Review，等待人工决策或单独修复任务处理。
