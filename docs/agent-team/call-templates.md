# Agent 团队调用模板

以下模板用于你日常调用 Codex agent 团队。复制后替换尖括号内容即可。

## 0. Codex 团队模式快速调用

```text
启动我的 StudyMY Codex 单任务交付团队，按 WorkBuddy 团队模式处理：<任务描述>。

要求：
- 先由 Codex 作为 Product Manager Agent 做 AGENT CHECK。
- 说明主责 agent、上级主管、使用 skill / 工具、可写范围、禁止事项和阶段门禁。
- 如果是官方采集，由 Product Manager Agent 指派 Data Governance Manager Agent，再调用 Study Data Collector + study-collector。
- 如果是 audit JSON 验收，由 Product Manager Agent 指派 Data Governance Manager Agent，再调用 Study Audit Validator + study-audit-validator。
- 如果是业务功能开发，由 Product Manager Agent 判断是否需要 Technical Director、Design Director、QA Release Manager 和 Execution Governance Agent。
- 只推进这一个任务。
- 最终汇报实际使用的 agent / skill、完成内容、验证结果、未做事项和 Notion 更新状态。
```

最短调用：

```text
启动我的 agent 团队，先做 AGENT CHECK，然后处理：<任务描述>。
```

## 1. 完整单任务开发

```text
启动 StudyMY Codex 单任务交付团队，处理 <TASK-ID 和任务标题>。

要求：
- 只推进这一个任务。
- 先读取 AGENTS.md、中文任务页、中文 PRD、中文技术方案和 docs/agent-team。
- Product Manager Agent 先判断是否需要指派技术总监、设计总监、官方数据治理主管或测试发布主管。
- 部门主管必须先拆解执行分工，再安排具体执行 agent。
- 执行期间必须遵守 collaboration-protocol.md。
- 执行 agent 遇到方向不确定或方案取舍困难时，必须向 Task Manager Agent 提交 DECISION REQUEST，得到 DECISION GUIDANCE 或 ESCALATION 后再继续。
- 功能实现阶段必须启用 Execution Governance Agent；实现 agent 修改前必须提交 IMPLEMENTATION INTENT 并获得 GATE CHECK 放行。
- 如需派工，必须明确每个 agent 的文件责任边界。
- 实现后运行任务要求的测试、构建或浏览器验证。
- 最后更新中文开发记录；如果真实 Notion 未更新，明确说明。

任务页内容：
<粘贴 Notion 中文任务页或本地快照>
```

## 2. 只做方案，不写代码

```text
启动 StudyMY Codex 单任务交付团队的体验设计组，为 <TASK-ID 和任务标题> 做方案。

本轮禁止写代码。
请输出：
- 问题定义
- 用户价值
- 非目标
- 推荐交互方案
- 视觉约束
- 桌面/平板/移动端验收标准
- 多语言和真实数据风险
- 后续实现任务的可改文件范围
```

## 3. 用户端 UI 修复

```text
启动 StudyMY Codex 单任务交付团队，处理用户端 UI 修复：<问题描述>。

约束：
- 只允许改 apps/web 相关文件和对应测试。
- 不改后端接口、不改数据库、不改管理端。
- 必须检查 zh-CN、zh-TW、en、ms 四语言下的布局风险。
- 必须做浏览器或截图验证。
- 如果修复会影响静态 HTML 视觉基线，先阻塞并说明。
```

## 4. 管理端功能

```text
启动 StudyMY Codex 单任务交付团队的产品工程组，处理管理端任务：<任务描述>。

约束：
- 管理端是运营工具，优先效率、密度、权限和可维护性。
- 只允许改 apps/admin、必要 API client 和对应测试。
- 如果需要新增后端接口，先输出影响范围并等待确认。
- 必须验证权限、表单、列表、空状态和错误状态。
```

## 5. 后端 API

```text
启动 StudyMY Codex 单任务交付团队的产品工程组，处理后端 API 任务：<任务描述>。

约束：
- 只允许改 apps/api、packages/shared 和对应测试。
- 不改用户端和管理端 UI。
- 必须说明 API 契约、公开数据门禁和权限影响。
- 必须运行相关 API 测试和 build。
```

## 6. 官方数据采集

```text
启动 StudyMY Codex 单任务交付团队的官方数据治理组，采集 <大学名称> <本科/硕士/博士> 官方数据。

本轮只采集和生成 audit JSON，不入库、不发布、不改业务代码。
必须输出：
- 官方来源图
- current-as-of 日期
- 官方目录数量
- 字段覆盖率
- 来源快照和证据
- exception queue
- candidate dataset
- pre-import gap audit
- 验证命令
```

## 7. 数据入库或发布

```text
启动 StudyMY Codex 单任务交付团队的官方数据治理组和测试发布门禁组，处理 <大学名称> 数据入库/发布。

要求：
- 先读取已验收 audit JSON 和发布边界。
- 必须先 dry-run。
- 必须备份。
- 必须说明是否写库、是否公开、是否 review-only。
- 必须运行 verify-only、API 抽查和必要前端页面检查。
- 未经明确授权，不得把 safe_to_import=false 的数据直接公开。
```

## 8. 多语言专项

```text
启动 StudyMY I18n Copy Reviewer 和 Web Frontend Engineer，处理多语言问题：<问题描述>。

约束：
- 区分前端文案多语言和业务数据多语言入库。
- 不得把前端 fallback 当作数据层完成。
- 必须检查四语言 key、硬编码、动态字段 fallback 和 raw API error。
- 必须运行 i18n 专项验证命令。
```

## 9. 视觉验收

```text
启动 StudyMY Design QA Reviewer，验收页面：<页面 URL 或路由>。

本轮默认只读，不写代码。
请检查：
- 桌面、平板、移动端
- 默认态、加载态、空状态、错误态
- 弹窗、滚动、遮挡、重叠、横向溢出
- zh-CN、zh-TW、en、ms 四语言
- 真实长数据样本

输出截图路径、问题清单和阻塞等级。
```

## 10. 发布前门禁

```text
启动 StudyMY Test and Release Engineer，做 <TASK-ID> 发布前门禁。

请读取本任务变更范围，只验证相关内容。
必须输出：
- 执行的命令
- 通过项
- 失败项
- 未执行项及原因
- 剩余风险
- 是否建议发布
```

## 11. WorkBuddy 团队调用

```text
使用 WorkBuddy 的 StudyMY Codex 单任务交付团队处理 <TASK-ID 或任务描述>。

要求：
- 只推进这一个任务。
- Product Manager Agent 先读取 AGENTS.md、中文任务页、中文 PRD、中文技术方案和 docs/agent-team。
- Product Manager Agent 根据任务类型选择必要部门主管，不要默认全员参与。
- 部门主管再把工作拆给具体执行 agent，并声明文件责任边界。
- 执行期间必须遵守 collaboration-protocol.md：Kickoff、Scope Sync、Contract Sync、Handoff、Verification Sync、Final Review。
- 方向不确定时必须启用 Task Manager Agent 做 DECISION REQUEST / DECISION GUIDANCE。
- 功能实现、导入发布或契约变更阶段必须启用 Execution Governance Agent 做实时门禁治理。
- 如果是官方采集，只能调用 Study Data Collector，并使用 study-collector。
- 如果是 audit JSON 验收或修复，只能调用 Study Audit Validator，并使用 study-audit-validator。
- Collector 和 Validator 不能修改项目代码、导入脚本、前端、管理端或配置。
- 实现类 agent 必须有明确文件责任边界。
- 测试或门禁失败时，输出阻塞报告，不得宣称完成。
```

## 12. WorkBuddy 官方采集调用

```text
使用 WorkBuddy 的 StudyMY Codex 单任务交付团队。
请 Product Manager Agent 指派 Data Governance Manager Agent，再由其调用 Study Data Collector，并使用 study-collector。

任务：
采集 <大学名称> <undergraduate/master/doctoral> 官方专业数据。

边界：
- 只处理一所大学、一个学历层级。
- 只输出 safe_to_import=false audit JSON。
- 不验收、不入库、不发布、不改项目代码。
- Phase 1、Phase 2 和 batch Phase 3 summary 后必须等待 Ian 明确确认。
```

## 13. WorkBuddy Audit 验收调用

```text
使用 WorkBuddy 的 StudyMY Codex 单任务交付团队。
请 Product Manager Agent 指派 Data Governance Manager Agent，再由其调用 Study Audit Validator，并使用 study-audit-validator。

任务：
验收 audit JSON：<文件路径或粘贴 JSON>。

边界：
- 先输出验收报告，等待我确认后再修复。
- 只允许输出 verified audit JSON、验收报告和 diff 报告。
- 不修改项目代码、导入脚本、前端、管理端、配置或 skill 文件。
- safe_to_import 必须保持 false。
```
