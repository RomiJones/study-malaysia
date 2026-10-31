# 质量门禁

本文档定义不同任务类型的最低验收门槛。实际任务页要求高于本文档时，以任务页为准。

## 通用门禁

所有任务必须满足：

- 已读取 `AGENTS.md`。
- 已读取选中中文任务页；如果没有任务页，已说明这是本地元任务。
- 已读取中文 PRD 和技术方案，或说明为何本任务不适用。
- 只处理一个任务。
- 未使用 `task.json` 作为事实来源。
- 未回滚用户或其它 agent 的既有改动。
- 已说明真实 Notion 是否更新。

## 文档或团队手册任务

最低验证：

- 文件路径存在。
- 内容能被 `sed` 或 `rg` 正常读取。
- 没有覆盖已有同名文档。
- 中文开发日志已追加，或明确说明未追加原因。

推荐命令：

```bash
find docs/agent-team -type f | sort
rg "Product Manager Agent|Technical Director Agent|Design Director Agent|Study Data Collector|Design QA|Contract Sync" docs/agent-team docs/prompts
```

## 后端/API 任务

最低验证：

- 相关 API 测试通过。
- `npm --workspace @studymy/api run build` 通过。
- 如果改 shared 类型，必须运行 shared 相关测试或全量测试。
- 如果改公开数据门禁，必须做 API 抽查。

常用命令：

```bash
npm run test -- tests/api/<target>.test.ts
npm --workspace @studymy/api run build
```

## 用户端任务

最低验证：

- 相关 web 测试通过。
- `npm --workspace @studymy/web run build` 通过。
- 涉及 UI 时必须做浏览器或截图验证。
- 涉及多语言时必须检查四语言。

常用命令：

```bash
npm run test -- tests/web/<target>.test.ts
npm --workspace @studymy/web run build
npm run verify:task042
```

## 管理端任务

最低验证：

- 管理端构建通过。
- 涉及权限时必须验证当前用户、角色、菜单和数据范围。
- 涉及表单时必须验证创建、编辑、校验和失败提示。

常用命令：

```bash
npm --workspace @studymy/admin run build
```

## 官方数据采集任务

最低验证：

- 必须由 `Study Data Collector` 执行。
- 必须使用 `study-collector`。
- 官方来源图完整。
- candidate dataset 可重复生成。
- source cache index 有 URL、时间和哈希。
- pre-import gap audit 明确缺失、异常和待确认。
- 本轮没有写库，除非用户明确授权。

必须说明：

- 院校官方身份。
- 学历层级。
- 国际学生范围。
- current-as-of 日期。
- 官方目录数量和规范数量。
- 字段覆盖率。
- 例外队列。

禁止：

- Collector 验收自己的 audit JSON。
- Collector 修改项目代码、导入脚本、前端或管理端。
- Collector 输出 `safe_to_import=true`。

## Audit JSON 验收修复任务

最低验证：

- 必须由 `Study Audit Validator` 执行。
- 必须使用 `study-audit-validator`。
- 输入必须是 audit JSON 路径或用户粘贴的合法 audit JSON。
- Phase 4 先输出验收报告，等待 Ian 确认后才能修复。
- verified JSON 输出后 `safe_to_import` 仍必须为 `false`。

必须说明：

- schema compatibility。
- collector_manifest 和 programme_baseline 是否完整。
- PASS、PASS-WITH-EXCEPTIONS 或 FAIL。
- `application-ready`、`advisor-review-required`、`not-application-selectable` 统计。
- `member-center-ready`、`member-center-display-only`、`member-center-blocked` 统计。
- repair_log、pending_issues 和 exception_queue。

禁止：

- 修改 StudyMY 项目代码、前端、管理端、导入器或 skill 文件。
- 自行批准导入。
- 把 verified JSON 直接发布。

## 数据入库任务

最低验证：

- 已读取已验收 audit JSON。
- Collector 和 Validator 不参与写代码。
- 已执行 dry-run。
- 已备份。
- 写库必须有显式授权。
- 写库后执行 verify-only。
- 公开 API 抽查数量、层级、状态和费用口径。

禁止：

- 无备份写库。
- 无 dry-run 写库。
- 把 `needs-review` 数据混入普通公开列表。
- 把非官方来源标为官方来源。

## 发布上线任务

最低验证：

- 发布前门禁通过。
- `publicDisplayStatus=ready` 与 `isPublished=true` 口径清楚。
- `officialSourceStatus` 和 `officialFeeAuditStatus` 清楚。
- API、用户端页面和必要截图验证通过。
- 回滚路径明确。

必须输出：

- 发布范围。
- 公开数量。
- 隐藏或归档数量。
- 费用口径。
- 验证命令。
- 报告路径。

## UI/视觉任务

最低验证：

- 明确页面、状态、视口和语言。
- 对照静态 HTML 或任务指定设计基线。
- 检查真实数据长文本。
- 检查弹窗、滚动、遮挡、重叠和横向溢出。
- 提供截图路径或说明浏览器验证失败原因。

禁止：

- 只看中文桌面首屏。
- 只靠构建通过证明 UI 正确。
- 在任务未授权时重做整体视觉。

## 多语言任务

最低验证：

- 四语言 key 一致。
- 用户可见硬编码为 0，或列出剩余项。
- raw API error 不直出到用户界面。
- 动态业务数据 fallback 口径清楚。
- 前端文案多语言与数据入库多语言分开验收。

常用命令：

```bash
npm run verify:task041:i18n
npm run test -- tests/web/format.test.ts
```

## 阻塞标准

遇到以下情况必须阻塞：

- 没有任务页且不是本地元任务。
- 需求同时要求多个互相独立任务。
- 文件责任边界不清，会覆盖大量既有改动。
- 数据来源不明或可能污染公开数据库。
- UI 任务缺少可复现路径且无法浏览器验证。
- 测试失败且无法证明与本任务无关。
- 用户要求违反项目硬门禁。
