# StudyMY Agent 团队手册

本文档定义 StudyMY 项目的 Codex agent 团队结构、调用方式和交付纪律。它不是业务需求来源，也不替代 Notion、中文 PRD 或技术方案。

## 基本判断

StudyMY 不是单纯前端项目。它同时包含用户端、管理端、API、官方数据采集、导入审计、多语言、视觉回归和发布门禁。因此团队不能只拆成“开发”和“设计”两个松散小组，必须有一个统一交付中枢。

推荐组织结构：

- `Product Manager Agent / 产品经理`：团队领导者，负责读取任务、锁定范围、指挥部门主管、集成验收和中文记录。
- `00 产品经理办公室`：包含 `Task Manager Agent / 任务管理者` 和 `Execution Governance Agent / 执行治理官`，负责决策申报和实时门禁治理。
- `01 技术管理部`：由 `Technical Director Agent / 技术总监` 负责，下面设置产品工程主管和后端、共享契约、用户端、管理端工程师。
- `02 设计体验部`：由 `Design Director Agent / 设计总监` 负责，下面设置 UX、视觉系统、多语言文案和设计 QA。
- `03 官方数据治理部`：由 `Data Governance Manager Agent / 官方数据治理主管` 负责，下面设置采集、验收和导入发布角色。
- `04 测试发布门禁部`：由 `QA Release Manager Agent / 测试发布主管` 负责，下面设置测试发布工程师。

产品经理必须始终承担最终责任。部门主管负责把产品经理的任务拆成可执行分工，执行 agent 只在授权边界内产出。`Task Manager Agent / 任务管理者` 负责处理执行 agent 的方向犹豫、方案取舍和不确定性申报；`Execution Governance Agent / 执行治理官` 负责在任务执行过程中实时监督执行 agent，发现越界、触碰门禁或擅自改规则时必须暂停相关修改并发起协商。辅助 agent 只能输出建议、补丁或验证结果，不能自行扩大任务范围。

## 团队目录

- `operating-model.md`：团队运行模型、任务生命周期和派工规则。
- `organization-chart.md`：产品经理负责制组织架构图、岗位职责和各类 agent 工作流。
- `official-programme-collector-position.md`：Ian 日常院校专业采集岗位说明，固定官方采集员的触发口令、可写范围、阶段门禁和交付物。
- `agent-functional-positioning.md`：agent 功能定位、任务路由、agent 与 skill 对应关系和越界识别。
- `role-cards.md`：每个角色的职责、输入、输出和禁止事项。
- `call-templates.md`：你日常调用团队时可以直接复制的中文指令模板。
- `quality-gates.md`：不同任务类型必须通过的验证门禁。
- `collaboration-protocol.md`：任务执行期间的跨 agent 沟通、交接、阻塞和验收同步协议。
- `workbuddy-setup.md`：把本团队配置成 WorkBuddy 智能体团队的成员、prompt、权限和协作蓝图。
- `../prompts/codex-team-router.prompt.md`：主调度器 prompt，用于启动一次受控团队执行。

## 硬性纪律

1. 每次只推进一个 Notion 任务或一个明确的本地元任务。
2. 未读取 `AGENTS.md`、中文任务页、中文 PRD 和技术方案，不进入实现。
3. Notion 是中文项目文档和任务管理来源，不是业务数据库。
4. 不使用 `task.json` 作为事实来源。
5. 代码、文件名、变量名、函数名和代码注释使用英文。
6. 用户可见输出、阻塞报告、验证报告和开发记录使用简体中文。
7. UI 任务必须做浏览器或截图验证；数据任务必须有来源、dry-run、审计和回滚口径。
8. 测试和构建未通过，不允许描述为完成。
9. 有大量未提交改动时，必须先说明改动归属风险，禁止混入无关文件。
10. 真实 Notion 未更新时，必须明确说明，并更新本地中文开发记录。

## 推荐调用入口

日常不要说“把团队都叫上”。更好的调用方式是：

```text
启动 StudyMY Codex 单任务交付团队，处理 TASK-XXX。
只允许推进这一个任务。
先读取中文任务页、PRD、技术方案和本团队手册。
由 Product Manager Agent 判断是否需要调用技术总监、设计总监、官方数据治理主管或测试发布主管。
完成后给出验证结果、变更文件和 Notion 更新状态。
```

如果只是做设计方案：

```text
启动 StudyMY Codex 单任务交付团队的体验设计组，只做 TASK-XXX 的方案和验收标准，不写代码。
必须指出风险、非目标和需要浏览器验证的页面。
```

如果只是做数据：

```text
启动 StudyMY Codex 单任务交付团队的官方数据治理组，处理 XXX 大学 XXX 层级官方数据。
本轮只生成 audit JSON 和 gap audit，不入库、不发布、不改业务代码。
```

如果要在 WorkBuddy 中选择智能体团队，优先按 [WorkBuddy 团队配置蓝图](workbuddy-setup.md) 创建 `StudyMY Codex 单任务交付团队`。WorkBuddy 只是运行时入口，不能替代本目录中的边界、角色卡、协作协议和质量门禁。

## 关键提醒

agent 团队的价值不是让更多人同时写代码，而是让需求边界、实现、设计、数据和验证互相制衡。你作为项目负责人应该要求每次执行都回答三个问题：

- 这次到底只做哪一个任务？
- 哪些证据证明它真的完成？
- 哪些事情明确没有做？
