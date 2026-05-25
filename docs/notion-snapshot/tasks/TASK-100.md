# 任务：新增需求边界、验收标准和依赖规划补充：集成验证和 Review 拆分

- **任务编号**: TASK-100
- **任务标题**: 新增需求边界、验收标准和依赖规划补充：集成验证和 Review 拆分
- **状态**: 已完成
- **优先级**: 高
- **任务类型**: 测试
- **负责人**: Codex
- **关联需求**: 产品需求文档
- **关联技术方案**: 技术方案
- **实现说明**: 从父任务 TASK-067 中拆出最终构建、测试、浏览器验证、Review 和验收记录。
- **测试计划**: 运行父任务要求的最终构建、测试、浏览器验证或 Review 命令。
- **验证结果**: 通过。已完成当前工作树快照的集成验证：`npm run test` 通过 15 个测试套件、88 个用例；`npm run build` 通过 API、Web、Admin 和 Shared 构建，Admin 仅保留既有 chunk size 警告；`npm run verify:task041:i18n` 通过，缺失 key、硬编码可见文案和 raw API error 展示均为 0；`npm run verify:task040:browser` 修复验证脚本选择器漂移后通过，生成 22 张浏览器截图和 JSON 报告。
- **阻塞说明**: 无当前构建、测试或浏览器验证阻塞。注意：父任务 TASK-067 的子任务 TASK-096 至 TASK-099 在本地任务快照中仍未全部标记完成，本轮只能证明当前工作树快照通过集成验证；父任务最终释放前建议在所有子任务完成后再次复跑。

## 依赖任务


## 并行分组
- parallelGroup: tests

## 影响范围
- affectedApps: tests, apps/web, apps/api, docs
- affectedModules: tests, apps/web:需求边界, apps/api:需求边界, docs:需求边界
- likelyFiles: none

## 锁范围建议
- lockScopeHint: task
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
- 并行说明：parallelGroup=tests，lockScopeHint=task。文件或模块冲突由运行时锁控制，不通过伪依赖解决。

## 验收标准
- 相关子任务完成后执行集成验证。
- Review issues 已记录，可自动修复问题已处理或明确阻塞。

## 关联 Commit

## 执行记录

### 2026-05-25T13:46:49.128Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-100-2026-05-25T13-46-49-121Z 已领取该任务。

### 2026-05-25T21:52:25.493+08:00 - Codex 集成验证记录

- **状态**: 已完成
- **说明**: 已按 TASK-100 范围执行最终测试、构建、i18n 审计和浏览器验证。首次 `npm run verify:task040:browser` 因旧脚本仍等待 `.shell-select` 失败；当前页面语言选择器为 `.language-switcher__select`，已将脚本改为兼容旧/新选择器后复跑通过。
- **验证命令**:
  - `npm run test`：通过，15 个测试套件、88 个用例。
  - `npm run build`：通过，API、Web、Admin、Shared 构建完成；Admin 仅保留既有 chunk size 警告。
  - `npm run verify:task041:i18n`：通过，四语言 key 完整性、动态文案、硬编码可见文案和 raw API error 展示扫描均通过。
  - `npm run verify:task040:browser`：通过，输出目录 `output/playwright/task035-20260525T135103Z`，生成 22 张截图。
- **Review 结论**: 当前 Review 快照没有 TASK-100 专属 open issue；与多语言相关的 TASK-030 历史 open issue 已被当前单测和 i18n 审计覆盖复验，但本轮不直接改写历史 Review 状态。其它历史视觉、管理端、费用和文档问题不属于 TASK-100 锁范围，已记录为非本轮阻塞。
- **Notion 更新**: 未更新真实 Notion；本轮没有可写入的 Notion 页面 ID，仅更新本地 Notion 快照。
