# 任务：USM 本硕博官方总量复核、完整审计与上线

- **任务标识**：TASK-USM-ALL-LEVEL-AUDIT-20260614
- **状态**：已完成
- **执行日期**：2026-06-14
- **授权来源**：用户要求完整确认 USM 本科、硕士、博士官方总量，并在一致后完成上线审计

## 目标

确认 USM 三个层级的官方标准数量、补齐与官方目录不一致的数据、完成字段与证据审计，并通过受控导入、公开 API、四语页面和生产启动验证。

## 官方数量口径

| 层级 | 官方观察层 | 规范项目数 | 数据库规范数 | 结论 |
| --- | ---: | ---: | ---: | --- |
| 本科 | 当前 CSV 91 行；2025/2026 Prospectus 63 项 | 63 | 63 | 一致 |
| 硕士 | 当前动态目录 305 行、255 个详情 URL | 305 | 305 | 已由旧版 274 补齐 |
| 博士 | 当前动态目录 95 行、91 个详情 URL | 95 | 95 | 一致 |
| 合计 |  | 463 | 463 | 一致 |

本科当前 CSV 与已审计快照 SHA-256 完全一致。CSV 的重复行和代码冲突继续作为变化检测证据，规范主表仍以官方 2025/2026 Prospectus 的 63 项为准。

## 发布结果

- 本科：63 条 `ready`。
- 硕士：302 条 `ready`、2 条 `needs-review`、1 条 `not-available-for-international`。
- 博士：72 条 `ready`、21 条 `needs-review`、2 条 `not-available-for-international`。
- 总计：463 条规范记录；437 条公开；23 条待审核；3 条不适用于国际申请人。
- 所有审核或不可用记录保留在数据库审计层，公开 API 泄漏 0。
- 三个层级的中文项目名普通英文残留为 0；官方英文原文继续单独保留。

## 验证

- 三个层级数据库专项验证通过。
- 全量测试：134 项，133 通过，1 项按仓库条件跳过。
- 四语专项审计通过：缺失键 0、英文泄漏 0、可见硬编码 0。
- 全工作区生产构建通过。
- `npm --workspace @studymy/api run start` 生产启动通过。
- 本地浏览器确认院校概览显示本科 63、硕士 305、博士 95、公开 437、隔离 26。
- 博士标签仅显示 72 条可公开项目；神经科学博士详情的学制、费用、要求和官方链接通过验收。

## 2026-06-15 本科学制展示修正

- 63 条本科主学制统一按年展示，不再以学期作为列表或详情主值。
- 官方来源中的学期数继续保留在版本化来源清单中，数据库主字段改为 `3.5 years`、`4 years`、`5 years` 等年制值。
- 四语本科简介同步改为年制表达，避免中文页面再次出现“8 个学期（4 年）”。

## 产物

- `data/imports/usm/2026-06-14/master-current-catalogue.json`
- `data/imports/usm/2026-06-14/master-official-source.json`
- `data/imports/usm/2026-06-14/master-commercial-candidate.json`
- `data/imports/usm/2026-06-14/phd-candidate.json`
- `data/imports/usm/2026-06-14/phd-audit.json`
- `data/imports/usm/2026-06-14/phd-delivery.json`
- `data/imports/usm/2026-06-14/sources/`
- `docs/prd/USM-all-level-official-publication-audit.md`

## Notion 状态

当前 Codex 会话没有可写入的 Notion 连接器。本文件已更新本地中文任务快照，真实 Notion 页面未更新。
