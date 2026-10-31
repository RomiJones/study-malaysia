# Sunway University 本硕博数据完整性统计报告

生成时间：2026-06-27 17:36 +08:00

## 复核范围

- 院校：Sunway University / 双威大学
- 数据范围：当前数据库中 `sunway-official-2026-row-*` 官方批次专业
- 对照来源：`08_candidate_dataset.json`、当前 MySQL 数据库、公开 API `/api/universities/sunway-university`

## 总体结论

当前 Sunway 官方批次本硕博数据完整性通过。候选集、数据库官方行和公开 API 返回均为 97 条；无缺失 code、无额外 official code、无重复 code、无重复 slug；8 条旧 `SUNWAYP...` 占位行已全部归档，不进入公开数据。按 Ian 授权，`SUNWAY-PHD-009 Doctor of Philosophy in Nursing` 已将官方 `MUET Band 4 / CEFR Mid B2` 路线等效折算为列表 IELTS 6.0；官方原文仍保留在详情语言要求中。

## 数量统计

| 项目 | 预期 | 数据库官方行 | 公开 API |
|---|---:|---:|---:|
| 总专业数 | 97 | 97 | 97 |
| 本科 | 48 | 48 | 48 |
| 硕士 | 33 | 33 | 33 |
| 博士 | 16 | 16 | 16 |

## 公开状态统计

| 字段 | 统计 |
|---|---:|
| `publicDisplayStatus=ready` | 97 |
| `isPublished=true` | 97 |
| `officialSourceStatus=official-verified` | 97 |
| 公开 API 中 `SUNWAYP...` 旧代码 | 0 |
| 旧 `SUNWAYP...` active 行 | 0 |
| 旧 `SUNWAYP...` archived 行 | 8 |

## 核心字段完整性

| 字段 | 完整数 | 缺失/异常数 | 说明 |
|---|---:|---:|---|
| 简体中文专业名 | 97 | 0 | 无英文回退、无“本科课程/硕士课程/博士课程”前缀 |
| 英文官方专业名 | 97 | 0 | `name.en` 与 `nameEnOfficial` 均存在 |
| 中文学院名 | 97 | 0 | 无 `School/Faculty/Sunway` 英文泄漏 |
| 学制 | 97 | 0 | `durationYears` 与官方学制文本均存在 |
| 开学信息 | 97 | 0 | 有 `officialIntake` 或官方未公布说明 |
| 官方语言原文 | 97 | 0 | 全部有官方语言要求文本 |
| 列表 IELTS 数值 | 97 | 0 | `SUNWAY-PHD-009` 按授权由 MUET 4 / CEFR Mid B2 等效折算为 IELTS 6.0 |
| 学术要求 | 97 | 0 | 全部有官方学术要求文本 |
| 中国学生要求 | 97 | 0 | 全部有中国学生申请说明 |
| 中文申请材料 | 97 | 0 | 全部有中文申请材料 |
| 中文课程/研究内容 | 97 | 0 | 全部有中文课程或研究内容 |
| 中文职业方向 | 97 | 0 | 全部有中文职业方向 |
| 官方专业来源 URL | 97 | 0 | 全部为 Sunway 官方域名 |
| `sourceUrls` 官方来源数组 | 97 | 0 | 全部含 Sunway 官方来源 |
| 学费可展示或受控未公布 | 97 | 0 | 4 条为受控 `Official fee not published` |

## 学费统计

| 学费状态 | 数量 |
|---|---:|
| `official-rate-verified` | 83 |
| `matched-official` | 10 |
| `not-published` | 4 |

仍为官网未公布学费的 4 条：

| 层级 | Code | 专业 |
|---|---|---|
| 本科 | `SUNWAY-BACHELOR-020` | Bachelor of Arts (Honours) in Digital Media Communication |
| 本科 | `SUNWAY-BACHELOR-028` | Bachelor of Science (Honours) in Food Innovation |
| 硕士 | `SUNWAY-MASTER-007` | Master in Nursing |
| 博士 | `SUNWAY-PHD-009` | Doctor of Philosophy in Nursing |

## IELTS 统计

| IELTS | 数量 |
|---|---:|
| 5.5 | 6 |
| 6.0 | 86 |
| 6.5 | 3 |
| 7.0 | 2 |

其中 IELTS 6.0 的 86 条包含 85 条官方直接 IELTS 6.0，以及 1 条 `SUNWAY-PHD-009` 授权等效 IELTS 6.0。

| 层级 | Code | 专业 | 当前处理 |
|---|---|---|---|
| 博士 | `SUNWAY-PHD-009` | Doctor of Philosophy in Nursing | 列表 IELTS 6.0；详情保留官方 MUET 4 / CEFR Mid B2 原文和授权等效说明 |

## Code/Slug 一致性

| 检查项 | 结果 |
|---|---|
| 候选集 code 数 | 97 |
| 数据库 official code 数 | 97 |
| 候选集中有但数据库缺失 | 0 |
| 数据库 official 中有但候选集缺失 | 0 |
| 重复 code | 0 |
| 重复 slug | 0 |
| 首个 code | `SUNWAY-BACHELOR-001` |
| 末个 code | `SUNWAY-PHD-016` |

## 结论

Sunway University 当前本硕博官方批次数据可以继续作为前台公开展示数据使用。当前仅保留 4 条学费官网未公布；护理学哲学博士 IELTS 已按授权等效口径写入 IELTS 6.0，不再计入缺失字段。学费未公布字段继续受控展示，不属于采集缺失或数据事故。
