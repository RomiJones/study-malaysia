# StudyMY 费用审计状态与采集验收执行标准

## 1. 目标

本标准用于统一 StudyMY 官方数据采集、验收、导入和管理端维护中的费用审计口径，避免把“官方来源已核验”误当作“费用金额可上线”。

## 2. 状态边界

`officialSourceStatus` 表示专业或院校页面来源是否可信；`officialFeeAuditStatus` 只表示费用金额、费率、费用表和费用来源是否可用于展示。

| 字段 | 作用 | 管理端文案示例 |
| --- | --- | --- |
| `officialSourceStatus` | 官方页面、专业页、入学要求页等来源核验 | 官方来源已核验 |
| `officialFeeAuditStatus` | 学费金额或费率的审计结论 | 官方总学费一致 / 仅官方费率已核验 / 官网未公布费用 |

费用字段不得只因为 `officialSourceStatus = official-verified` 就自动视为费用通过。

## 3. 费用审计状态口径

| code | 管理端文案 | 使用条件 |
| --- | --- | --- |
| `matched-official` | 官方总学费一致 | 官方来源给出当前国际学生、当前专业、默认路径的单一总学费，且 `officialTuitionMYR` 与来源一致。 |
| `fee-sheet-verified` | 官方费用表已核验 | 官方费用表或 PDF 明确匹配当前专业和国际学生路径，但专业页不一定直接列总额。 |
| `official-approximate` | 官方近似金额 | 官方只给 approximate / indicative / estimated 费用，不能当作严格总额。 |
| `official-rate-verified` | 仅官方费率已核验 | 官方只给每学期、每学分或年度费率，未形成唯一总额。 |
| `calculated-from-official-rate` | 按官方费率计算总额 | 已核验官方费率和官方标准学制，且任务或验收明确允许按公式计算展示。 |
| `official-non-scalar` | 官方非单一金额 | 官方费用为区间、多校区、多模式、多 track 或无法唯一选择。 |
| `conflict` | 金额冲突 | 多个官方金额冲突，未获得 Ian 裁定。 |
| `source-conflict` | 费用来源冲突 | 来源层级、适用对象、年份或官方页面之间存在冲突。 |
| `pending-review` | 费用待复核 | 采集或验收尚未能给出可展示结论。 |
| `not-published` | 官网未公布费用 | 官方当前来源未公布该专业费用。 |

## 4. 采集 skill 执行逻辑

`study-collector` 只输出 `safe_to_import=false` 的 audit JSON，不写项目代码、不导入数据库。

采集阶段必须：

- 优先查当前官方专业页是否直接列国际学生当前费用。
- 费用来源、金额、费率、适用对象、年份和冲突来源必须写入 `fieldEvidence.tuition`。
- 只公布费率时，不得自动伪造成官方总学费；必须记录费率来源、公式风险和是否需要 Ian 授权。
- 金额冲突、来源冲突、非单一费用、近似金额、未公布费用必须进入 `pending_issues` 或 `exception_queue`。
- Collector 产物只能作为验收输入，不得把任何状态直接视为可上线。

## 5. 验收 skill 执行逻辑

`study-audit-validator` 读取 collector 的 audit JSON，先出验收报告；只有 Ian 确认后才能修复 audit JSON 副本。

验收阶段必须：

- 核对 `schema_version`、`collector_manifest`、`programme_baseline`、`workflow_status` 和 `safe_to_import=false`。
- 重新验证费用来源是否为官方来源、是否匹配当前专业、国际学生、当前周期和默认路径。
- 当前专业页直接金额优先；费用表、PDF 和学院页只能作为支撑来源，除非明确匹配且无冲突。
- 只有 `matched-official`、`fee-sheet-verified`、`calculated-from-official-rate` 等具备明确证据的状态，才允许导入为可展示费用。
- `official-rate-verified`、`official-approximate`、`official-non-scalar` 可以保留审计信息，但不得被当作唯一官方总学费。
- `conflict`、`source-conflict`、`pending-review` 必须保留为待处理问题，不能发布为费用已通过。

## 6. 导入与管理端规则

导入脚本和管理端保存必须遵守：

- 已核验或可追溯费用状态必须有 `officialFeeSourceUrl`。
- `officialTuitionMYR` 或 `tuitionCurrency = MYR` 存在时，必须有费用来源。
- `pending-review`、`conflict`、`source-conflict` 会进入质量工作台，不应作为发布完成状态。
- 管理端允许人工校准单个专业字段，但保存后必须触发单条质量检查。

## 7. 管理端下拉文案原则

费用审计下拉必须使用费用口径文案，不使用“官方来源已核验”这类来源状态文案。

推荐展示顺序：

1. 官方总学费一致
2. 官方费用表已核验
3. 官方近似金额
4. 仅官方费率已核验
5. 按官方费率计算总额
6. 官方非单一金额
7. 金额冲突
8. 费用来源冲突
9. 费用待复核
10. 官网未公布费用
