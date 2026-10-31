# 多 Agent 协作沟通协议

本文档定义 `StudyMY Codex 单任务交付团队` 在执行任务期间的协作沟通方式。目标不是让所有 agent 同时说话，而是让每次沟通都有明确目的、责任人、输入和输出。

## 1. 协作原则

1. `Product Manager Agent / 产品经理` 是唯一调度和整合入口。
2. 每个 agent 只在自己的职责范围内发言、执行和交接。
3. 重要结论必须回到产品经理汇总，不能在两个 worker 之间私下形成最终决策。
4. 任何跨文件、跨端、跨数据口径的影响，必须同步给产品经理和对应部门主管。
5. 任何阻塞都要说明阻塞原因、影响范围、需要谁裁定，以及临时可推进事项。
6. 测试、设计 QA、数据验收有否决权；实现 agent 不能自己给自己判定完成。
7. 采集、验收、导入、发布必须分阶段交接，不允许跳步。
8. 产品经理派任务给部门主管，部门主管再拆给执行 agent；执行 agent 不应绕过主管直接扩大范围。

## 2. 标准沟通环节

每个任务默认经过八个沟通环节。涉及功能开发、数据导入、后端 API、用户端页面、管理端页面或共享契约时，必须启用 `Task Manager Agent / 任务管理者` 做决策申报处理，并启用 `Execution Governance Agent / 执行治理官` 做实时监督。

### 2.1 Kickoff 任务启动

发起人：Product Manager Agent / 产品经理

必须输出：

- 任务编号和任务标题。
- 事实来源：中文任务页、PRD、技术方案、用户最新指令。
- 本轮目标。
- 非目标。
- 可改文件范围。
- 需要参与的部门主管。
- 主管下的执行 agent。
- 每个部门和 agent 的职责边界。
- 预期验证命令。
- 当前已知风险。

参与 agent 必须回复：

- `READY`：可以开始。
- `QUESTION`：需要产品经理或 Ian 裁定。
- `BLOCKED`：当前不能开始，并说明原因。

### 2.2 Scope Sync 范围同步

触发条件：

- 任务描述模糊。
- 需求可能跨多个任务。
- 文件责任边界不清。
- UI、API、数据或管理端之间出现依赖。
- 用户新指令改变原任务范围。

输出格式：

```text
[SCOPE SYNC]
发现者：
问题：
影响范围：
建议处理：
需要 Ian 决策：YES/NO
```

### 2.3 Contract Sync 契约同步

触发条件：

- API DTO 变化。
- 数据库字段变化。
- shared 类型变化。
- 前端展示依赖新字段。
- 管理端需要维护新字段。
- audit JSON 字段无法映射到现有实体或 DTO。

输出必须说明：

- 字段或接口名称。
- 生产方。
- 消费方。
- 默认值和 fallback。
- 公开展示门禁。
- 破坏性影响。
- 需要同步修改的测试。

### 2.4 Handoff 交接

每次交接必须包含：

```text
[HANDOFF]
交接方：
接收方：
完成内容：
产物路径：
关键结论：
未解决问题：
禁止误用：
下一步建议：
```

禁止只说“已完成”。没有产物路径、关键结论和未解决问题的交接视为无效。

### 2.5 Verification Sync 验证同步

必须输出：

```text
[VERIFY]
验证人：
范围：
命令/路径：
结果：PASS / FAIL / PARTIAL
失败项：
阻塞：YES/NO
建议：
```

### 2.6 Final Review 最终收口

发起人：Product Manager Agent / 产品经理

必须输出：

- 本轮完成内容。
- 修改文件。
- 各 agent 交接结论。
- 验证结果。
- 未做事项。
- 剩余风险。
- Notion 或本地中文记录更新状态。

### 2.7 Gate Intervention 门禁干预

发起人：Execution Governance Agent

触发条件：

- 实现 agent 准备修改未授权文件。
- 实现 agent 准备修改门禁、权限、公开数据过滤、发布规则或质量标准。
- 实现 agent 准备绕过 Collector、Validator、Import、Test 或 Design QA 的职责边界。
- 实现 agent 发现需要跨组改动，但未发起 Scope Sync 或 Contract Sync。
- 实现 agent 试图把测试失败、设计变形、数据来源冲突或 i18n 风险降级为“可忽略”。
- 实现 agent 的方案与用户任务页、PRD、技术方案或 `AGENTS.md` 冲突。

干预格式：

```text
[GATE INTERVENTION]
发起人：Execution Governance Agent
被拦截 agent：
触发行为：
触碰门禁：
证据：
影响范围：
当前动作：PAUSE
需要参与协商的角色：
可行选项：
建议：
```

协商后必须输出：

```text
[RESOLUTION]
裁定人：Product Manager Agent / Ian
结论：CONTINUE / CHANGE PLAN / SPLIT TASK / BLOCKED
允许继续的范围：
禁止事项：
新增验证：
通知对象：
```

没有 `[RESOLUTION]` 前，被拦截 agent 不得继续相关改动。

### 2.8 Decision Request 决策申报

发起人：任何执行 agent

接收人：Task Manager Agent

触发条件：

- 不确定应该选哪种实现方案。
- 不确定是否需要改 shared、API、数据模型、UI 设计或测试。
- 不确定问题属于当前任务还是应拆新任务。
- 不确定是否需要 Ian 确认。
- 多个方案都可行，但成本、风险或验收方式不同。
- 遇到线上数据、历史改动、旧兼容逻辑或门禁规则，不确定如何处理。

申报格式：

```text
[DECISION REQUEST]
发起 agent：
当前任务：
不确定点：
已知事实：
候选方案：
各方案风险：
推荐但不确定的方案：
需要参与判断的角色：
是否可能超出任务范围：YES/NO
```

任务管理者必须回复：

```text
[DECISION GUIDANCE]
处理人：Task Manager Agent
判断结论：PROCEED / NEEDS_SYNC / ESCALATE_TO_LEAD / ASK_IAN / SPLIT_TASK / BLOCKED
推荐方案：
理由：
允许执行范围：
禁止事项：
需要同步的角色：
新增验证：
下一步：
```

如果判断涉及任务范围扩大、产品口径、发布授权、数据费用裁定、设计基线变更或门禁放宽，任务管理者不得自行裁定，必须输出：

```text
[DECISION ESCALATION]
提交给：Product Manager Agent / Ian
问题：
为什么不能由 Task Manager 直接裁定：
可选方案：
推荐方案：
需要的明确回复：
```

没有 `DECISION GUIDANCE` 或 `DECISION ESCALATION` 前，执行 agent 不得靠猜测继续实现。

## 3. 跨组协作矩阵

| 交接方向 | 必须交接内容 | 接收方动作 |
| --- | --- | --- |
| Product Manager Agent -> Department Manager | 任务目标、非目标、文件边界、验收标准 | 拆解执行分工并指定执行 agent |
| Department Manager -> Implementation Agent | 具体任务、可改文件、交接要求、验证要求 | 在边界内执行并按协议交接 |
| Implementation Agent -> Task Manager Agent | 不确定点、候选方案、风险、推荐但不确定的路径 | 给出 Decision Guidance 或升级给产品经理/Ian |
| Task Manager Agent -> Product Manager Agent | 超范围、需 Ian 裁定或需拆任务的问题 | 裁定、询问 Ian 或调整任务计划 |
| Implementation Agent -> Execution Governance Agent | 实现计划、目标文件、可能触碰的门禁 | 检查是否越界，必要时发起 Gate Intervention |
| Execution Governance Agent -> Product Manager Agent | 门禁风险、协商选项、建议处理 | 裁定继续、改方案、拆任务或阻塞 |
| Study Data Collector -> Study Audit Validator | `safe_to_import=false` audit JSON、source registry、programme_baseline、exception_queue | 验收 schema、来源、费用、默认路径、申请运营和会员中心同步 |
| Study Audit Validator -> Data Governance Manager Agent | 验收报告、PASS/FAIL、pending_issues、verified JSON 路径 | 向产品经理建议是否进入导入任务或阻塞 |
| Product Manager Agent -> Data Governance Manager Agent | Ian 授权、verified JSON、发布范围、禁止事项 | 指派 Data Import Engineer 做 dry-run、备份、导入或 review-only、verify-only |
| Data Import Engineer -> Backend API Engineer | 数据字段、状态、公开门禁、数据库统计 | 确认 API DTO 和公开查询口径 |
| Backend API Engineer -> Web/Admin Frontend Engineer | DTO 契约、错误形态、权限和 fallback | 按契约消费，不私自猜字段 |
| Shared Contract Engineer -> Backend/Web/Admin/Test | shared 类型、枚举、DTO、formatter 影响 | 同步消费端和测试 |
| UX Scope Designer -> Visual System Designer | 问题定义、用户价值、非目标、验收状态 | 输出视觉约束和组件状态 |
| Visual System Designer -> Web Frontend Engineer | 设计 token、响应式断点、组件状态 | 实现，不扩展设计范围 |
| I18n Copy Reviewer -> Web Frontend Engineer | 缺失 key、硬编码、动态 fallback 风险 | 修复文案和动态显示路径 |
| Design QA Reviewer -> Web Frontend Engineer | 截图、复现路径、阻塞等级 | 修复真实页面问题 |
| Test and Release Engineer -> QA Release Manager Agent | 测试、构建、API、浏览器或发布门禁结果 | 向产品经理建议完成、修复或阻塞 |

## 4. 官方数据链路协作

官方数据链路必须按顺序执行：

```text
Product Manager Agent
  -> Data Governance Manager Agent
       -> Study Data Collector
       -> Study Audit Validator
       -> Data Import Engineer
  -> Technical Director Agent
       -> Backend API Engineer
       -> Web/Admin Frontend Engineer
  -> Design Director Agent
       -> Design QA Reviewer
  -> QA Release Manager Agent
       -> Test and Release Engineer
  -> Product Manager Agent
```

强制规则：

- `Study Data Collector` 只能输出 `safe_to_import=false` audit JSON。
- `Study Audit Validator` 只能输出 verified audit JSON 和报告。
- `Data Import Engineer` 不能绕过 Validator。
- 发布必须有 Ian 明确授权。
- 任何 `needs-review` 数据进入公开列表都必须阻塞。
- 任何费用、语言成绩、默认路径或官方来源冲突，必须先由 Validator、官方数据治理主管或产品经理标记，不得由导入器自行裁决。

## 5. UI/设计链路协作

UI/设计任务必须按这个顺序沟通：

```text
Product Manager Agent
  -> Design Director Agent
       -> UX Scope Designer
       -> Visual System Designer
       -> I18n Copy Reviewer
       -> Design QA Reviewer
  -> Technical Director Agent
       -> Web Frontend Engineer
  -> QA Release Manager Agent
       -> Test and Release Engineer
  -> Product Manager Agent
```

强制规则：

- UX 先定义问题，不能直接跳到改样式。
- Visual 只给约束，不能推翻静态 HTML 基线，除非任务授权。
- Web 实现时不得私自改 API 或数据口径。
- I18n 必须检查四语言。
- Design QA 必须检查真实长数据、移动端、弹窗和滚动。
- 构建通过不等于视觉通过。

## 6. 后端/管理端链路协作

后端或管理端任务必须建立契约同步：

```text
Product Manager Agent
  -> Technical Director Agent
       -> Engineering Manager Agent
            -> Backend API Engineer
            -> Shared Contract Engineer
            -> Admin Frontend Engineer 或 Web Frontend Engineer
  -> QA Release Manager Agent
       -> Test and Release Engineer
  -> Product Manager Agent
```

强制规则：

- shared 类型变化必须同步所有消费端。
- 管理端字段维护必须保留审核状态、来源状态、费用状态和权限边界。
- API 错误形态必须能被前端本地化处理。
- 权限或数据范围变化必须由测试门禁复核。

## 7. 阻塞与升级

任何 agent 遇到以下情况必须输出 `[BLOCKED]`：

- 任务范围不清。
- 缺少中文任务页或事实来源。
- 需要修改未授权文件。
- 需要跨组改动但未授权。
- 数据来源冲突。
- 费用或语言成绩无法确认。
- 测试失败。
- UI 在真实数据、多语言或移动端下变形。
- skill 边界即将被违反。

阻塞格式：

```text
[BLOCKED]
报告人：
阻塞点：
证据：
影响范围：
可继续事项：
需要谁决策：
建议选项：
```

产品经理必须处理阻塞，不能让 worker 自行绕过。部门主管必须先收集本部门阻塞事实、证据和建议，再向产品经理上报。

## 7.1 执行中治理循环

实现类 agent 每进入一个实际修改阶段前，如果方向明确，必须向 `Execution Governance Agent` 提交简短计划：

```text
[IMPLEMENTATION INTENT]
执行 agent：
要改文件：
改动目的：
是否涉及门禁/权限/API/数据/设计基线：YES/NO
需要同步的角色：
预计验证：
```

`Execution Governance Agent` 必须回复：

```text
[GATE CHECK]
结论：CLEAR / NEEDS_SYNC / INTERVENTION
原因：
允许范围：
必须同步：
禁止事项：
```

只有 `CLEAR` 后，实现 agent 才能继续该阶段修改。`NEEDS_SYNC` 必须先完成 Scope Sync 或 Contract Sync。`INTERVENTION` 必须进入 Gate Intervention。

如果方向不明确，必须先走任务管理者的决策申报：

```text
Implementation Agent
  -> DECISION REQUEST
  -> Task Manager Agent
  -> DECISION GUIDANCE 或 DECISION ESCALATION
  -> 必要时 Product Manager Agent / Ian 裁定
  -> IMPLEMENTATION INTENT
  -> Execution Governance Agent GATE CHECK
  -> 执行
```

不得跳过 `DECISION REQUEST` 直接通过试错、猜测或自行扩大范围解决不确定问题。

## 8. 决策记录

以下事项必须由产品经理记录到最终汇报，必要时追加中文开发日志：

- Ian 的授权。
- 任务范围裁剪。
- 数据发布口径。
- 费用来源裁定。
- API 契约变化。
- UI 设计基线变化。
- 未执行测试原因。
- Notion 未更新原因。

## 8.1 上传下达职责

每个主管必须严格履行双向职责：

- 下达：把产品经理的任务目标、非目标、可改文件、验收标准和禁止事项拆给执行 agent。
- 监督：确认执行 agent 在修改前提交 `IMPLEMENTATION INTENT`，方向不清时提交 `DECISION REQUEST`。
- 收口：检查执行产物、测试证据、未解决问题和风险，不允许只派活不验收。
- 上报：把阻塞、范围冲突、门禁风险、测试失败和需要 Ian 裁定的事项回传给产品经理。
- 协调：涉及跨部门依赖时发起 Scope Sync 或 Contract Sync，而不是让执行 agent 私下协商最终方案。

## 9. 禁止的协作方式

- 多个 agent 同时改同一个文件。
- 执行 agent 遇到方向不确定时不申报，直接试错。
- Task Manager Agent 在需要 Ian 或产品经理裁定的问题上自行拍板。
- 实现 agent 未提交 `[IMPLEMENTATION INTENT]` 就直接改关键文件。
- Execution Governance Agent 发现越界后不暂停相关修改。
- Collector 采集后直接让 Import Engineer 入库，跳过 Validator。
- Validator 发现 schema 不适配后直接改项目代码。
- 设计 agent 绕过设计总监和产品经理直接要求前端改整体风格。
- 测试 agent 只报告“通过”，不列命令和范围。
- 产品经理未汇总交接内容就宣布完成。
- 将 WorkBuddy 团队当作常驻自动执行系统，脱离单任务边界持续改项目。
