# 任务：USM 国际博士官方数据采集、审计与可入库候选

- **任务标识**：TASK-USM-PHD-COLLECT-20260614
- **状态**：已完成（可入库审核候选已生成，公开发布仍受门禁控制）
- **优先级**：最高
- **任务类型**：官方数据采集、规范化、审计与入库候选
- **授权来源**：用户于 2026-06-14 明确要求按照升级后的专用 Skill 一次完成

## 任务目标

按 StudyMY 官方院校采集标准，完成 USM 面向国际申请人的博士项目官方来源快照、规范项目身份、培养模式、院系、校区、学制、开学时间、费用、要求、申请材料、证据、异常队列和交付审计，产出不写数据库的可入库审核候选。

## 当前边界

- 院校：Universiti Sains Malaysia（USM）。
- 层级：`phd`。
- 申请人范围：国际申请人。
- 当前目录：截至 2026-06-14 的 USM 官方研究生目录。
- 费用口径：2025/2026 官方研究生费用表。
- 授权：`collect`，不执行数据库写入、API 发布或前端上线。
- 不修改 USM 本科、硕士、其它院校或用户数据。

## 验收标准

- 目录出现次数、唯一官方入口和规范项目数分别统计。
- 独立项目、研究方向、离岸开设、联合学位和具名专业博士正确区分。
- 研究型费用仅在院系、国际生费率和 4–10 学期范围均明确时计算总学费区间。
- 13 条具名博士费用全部映射，无法唯一匹配的项目保持官网未公布。
- 国际资格、学制、开学时间、要求、材料和证据均有明确状态。
- 全部记录分区为 `ready`、`needs-review` 或 `not-available-for-international`。
- 专项记录验证和 delivery envelope 审计无错误。
- 不写数据库。

## 执行结果

- 官方目录博士出现次数：129。
- 唯一官方详情入口：129。
- 规范博士项目：129。
- 重复博士入口：0。
- 详情页采集：129，传输失败：0。
- 状态分区：`ready` 16、`needs-review` 112、`not-available-for-international` 1。
- 培养模式：research 116、coursework 6、mixed 7。
- 开设类型：本部或未单列 105、offshore 20、joint-degree 4。
- 费用：93 条官方组件计算区间、13 条官方总学费、23 条官网未公布。
- 数据库状态：`not-performed`。
- 最终交付决策：`audited-candidate-with-review-exceptions`。

## 异常说明

- 106 个项目未公布专业级 intake。
- 23 个项目未得到明确国际资格确认，同时没有唯一适用的当前国际学费。
- 2 个项目未公布可结构化的数字学制。
- 同一记录可同时命中多项原因，因此异常记录总数为 112，不等于原因次数之和。

## 产物

- `data/imports/usm/2026-06-14/phd-official-source.json`
- `data/imports/usm/2026-06-14/phd-candidate.json`
- `data/imports/usm/2026-06-14/phd-audit.json`
- `data/imports/usm/2026-06-14/phd-delivery.json`
- `docs/prd/USM-phd-official-collection-technical-design.md`
- `docs/prd/USM-phd-official-collection-audit.md`

## Notion 状态

当前 Codex 会话没有可调用的 Notion 连接器。本文件作为本地中文任务快照；真实 Notion 未更新。
