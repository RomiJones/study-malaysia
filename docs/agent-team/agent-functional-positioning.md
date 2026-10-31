# Agent 团队功能定位与任务路由准则

本文档用于在每次开工前确认：当前任务应由哪个 agent 负责、是否需要对应 skill、哪些边界不能触碰，以及何时必须升级给 Product Manager Agent 或 Ian。

本文档不替代 Notion、中文 PRD、技术方案或 `organization-chart.md`。它是 `StudyMY Codex 单任务交付团队` 的执行定位说明，重点解决“谁在干活、用什么工具、做到哪里停”的问题。

## 1. 基本定义

| 概念 | 定义 | 示例 |
| --- | --- | --- |
| Agent | 团队岗位和责任边界 | Product Manager Agent、Study Data Collector、Study Audit Validator |
| Skill | 某个 agent 可使用的专用工作流或工具规则 | `study-collector`、`study-audit-validator`、`skill-creator` |
| Task | Ian 当前明确要求推进的一件事 | LUC master 官方采集、audit JSON 验收、导入 dry-run |
| Gate | 不能靠执行 agent 自行放宽的硬门禁 | 阶段确认、费用来源、语言槽位、safe_to_import、写库授权 |

执行时必须先判断 agent，再判断 skill。不能因为某个 skill 能做类似事情，就跳过 agent 职责边界。

## 2. 总入口

每个任务默认先进入：

```text
Product Manager Agent / 产品经理
```

产品经理负责锁定：

- 本次只做哪一个任务。
- 事实来源是什么。
- 哪些文件或数据可以改。
- 哪些事情明确不做。
- 需要哪一个部门主管负责。
- 验证和交付标准是什么。

除非 Ian 明确指定某个执行 agent，否则执行 agent 不应直接绕过 Product Manager Agent 开工。

## 3. Agent 与 Skill 对应关系

| 任务场景 | 主责 agent | 可用 skill / 工具 | 主要产物 | 禁止事项 |
| --- | --- | --- | --- | --- |
| 官方数据采集 | Study Data Collector | `study-collector` | `safe_to_import=false` audit JSON、source registry、programme baseline、field audit | 不验收、不导入、不改代码、不改 `safe_to_import=true` |
| audit JSON 验收复核 | Study Audit Validator | `study-audit-validator` | 验收报告、verified JSON、diff / repair log | 不改项目代码、不导入、不发布 |
| 已验收数据导入 | Data Import Engineer | 项目导入脚本、测试命令 | dry-run、备份、导入报告、verify-only | 不绕过 validator、不无授权写库、不公开 `needs-review` |
| skill 本身优化 | Product Manager Agent + Execution Governance Agent | `skill-creator` 规则 | skill 文件更新、校验结果 | 不借 skill 优化修改业务代码或数据 |
| 后端 API 功能 | Backend API Engineer | 项目测试和构建工具 | API 补丁、契约说明、测试结果 | 不绕过数据审计、不私自放宽公开数据门禁 |
| shared 契约 | Shared Contract Engineer | 项目测试和构建工具 | DTO、枚举、类型、消费端同步清单 | 不改字段含义但不通知消费端 |
| 用户端页面 | Web Frontend Engineer | 浏览器验证、web 测试 | web 补丁、截图或验证说明 | 不改 API、数据库、导入器或数据口径 |
| 管理端页面 | Admin Frontend Engineer | admin 构建和权限验证 | admin 补丁、表单/权限验证 | 不隐藏审核风险、不绕过权限 |
| 多语言和视觉体验 | Design Director Agent 下属角色 | 浏览器截图、i18n audit | UX/视觉/i18n/Design QA 结论 | 不用主观审美替代验收 |
| 测试发布门禁 | Test and Release Engineer | 测试、构建、API 抽查、Playwright | VERIFY、失败项、发布或阻塞建议 | 不用“看起来没问题”替代验证 |

## 4. 官方数据任务路由

官方数据任务必须经过官方数据治理部：

```text
Product Manager Agent
  -> Data Governance Manager Agent
     -> Study Data Collector / Study Audit Validator / Data Import Engineer
```

### 4.1 采集任务

触发语义：

- “采集 XXX 大学本科/硕士/博士专业信息”
- “开始 XXX 院校 XXX 层级官方数据”
- “补采 audit JSON”

执行定位：

```text
主责 agent：Study Data Collector
专用 skill：study-collector
范围：一所大学 + 一个学历层级
输出：safe_to_import=false audit JSON
```

阶段规则：

- Phase 1 和 Phase 2 必须等待 Ian 明确确认进入下一阶段。
- Phase 3 默认使用 `calibrated_batch`，不再每个专业都要求 Ian 确认。
- 每条专业仍必须生成 `[PROGRAMME FIELD AUDIT]`。
- 普通缺口降级为 `needs-review` 后继续。
- 费用、语言、schema、来源合法性、爬取礼仪或 evidence 完整性触碰门禁时必须 `[PHASE 3 HARD STOP]`。

### 4.2 验收复核任务

触发语义：

- “验收这个 audit JSON”
- “复核 XXX 院校 XXX 层级专业信息”
- “修复这份采集结果”

执行定位：

```text
主责 agent：Study Audit Validator
专用 skill：study-audit-validator
前置条件：存在 collector 输出的 audit JSON
输出：验收报告、verified JSON、diff / repair log
```

若 audit JSON 不存在，不能假装验收；必须回到采集链路，由 Study Data Collector 先补齐对应院校和层级。

### 4.3 导入发布任务

触发语义：

- “导入”
- “发布”
- “写库”
- “同步到正式数据”

执行定位：

```text
主责 agent：Data Import Engineer
前置条件：validator 通过 + Ian 明确授权
输出：dry-run、备份、导入报告、verify-only
```

没有 Ian 明确授权时，只能做 dry-run 或阻塞报告，不能写库或公开发布。

## 5. LUC 当前任务定位

当前林肯大学任务应拆成两个独立层级：

| 子任务 | 正确 agent | 正确 skill | 当前阶段定位 |
| --- | --- | --- | --- |
| LUC master 官方采集 | Study Data Collector | `study-collector` | 已进入 Phase 3，可按 `calibrated_batch` 继续 |
| LUC doctoral 官方采集 | Study Data Collector | `study-collector` | 需单独启动 Phase 0/1，不得混入 master session |
| LUC master/doctoral 验收复核 | Study Audit Validator | `study-audit-validator` | 只有对应 audit JSON 存在后才能执行 |

因此，继续 LUC master 时不需要再额外授权 `batch mode`；但仍不能把 master 和 doctoral 合并成一个采集 session，也不能跳过 Phase 4/5 质量门禁。

## 6. Skill 优化任务定位

当 Ian 要求“优化 collector / validator / agent 规则 / 团队规则”时，这不是官方数据采集任务，而是团队能力维护任务。

正确定位：

```text
主责 agent：Product Manager Agent
协作 agent：Execution Governance Agent
适用规则：skill-creator
输出：skill 或团队文档更新、校验结果、未更新 Notion 状态
```

禁止事项：

- 不借规则优化机会修改 StudyMY 业务代码。
- 不修改主数据、导入器、前端、后端或测试。
- 不把临时讨论口径直接当成业务数据。
- 不绕过 skill 校验。

## 7. 开工前 Agent Check

每次正式执行前，产品经理必须输出或内部确认：

```text
[AGENT CHECK]
任务：
任务类型：
主责 agent：
上级主管：
使用 skill / 工具：
可写文件范围：
禁止事项：
阶段门禁：
验证方式：
```

若无法填完整，说明当前任务边界不清，必须交给 Task Manager Agent 做 `DECISION REQUEST`，不能直接执行。

## 8. 越界识别

出现以下情况，说明 agent 跑偏：

- 采集任务开始修改项目代码、导入脚本、前端或后端。
- 验收任务在没有 audit JSON 的情况下继续“验收”。
- Collector 把 `safe_to_import` 改成 `true`。
- Validator 未经 Ian 确认直接修复并进入导入。
- Data Import Engineer 绕过 validator 或无授权写库。
- 前端工程师改数据口径或隐藏审核风险。
- 测试失败后仍宣称完成。
- Phase 1 / Phase 2 未经 Ian 明确确认就进入下一阶段。
- Phase 3 为了效率省略 `[PROGRAMME FIELD AUDIT]`。

触发越界时必须立即输出：

```text
[GATE INTERVENTION]
触发行为：
风险：
应负责 agent：
当前应暂停事项：
需要 Ian / Product Manager 裁定：
```

## 9. 最终交付说明

最终回复必须说明：

- 实际使用的 agent / skill。
- 完成了什么。
- 修改了哪些文件或生成了哪些产物。
- 执行了哪些验证。
- 哪些事情没有做。
- Notion 或中文开发记录是否更新。

如果 Notion 没有更新，必须明确写出“Notion 未更新”。
