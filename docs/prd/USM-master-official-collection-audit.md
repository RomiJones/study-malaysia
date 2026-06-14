# USM 国际硕士官方数据采集审计

## 审计结论

- 审计日期：2026-06-14。
- 范围：USM、硕士层级、国际申请人。
- 当前官方费用口径：2025/2026 总表；5 个专业入口按详情页采用 2026/2027 新费率。
- 采集状态：官方目录、274 个唯一硕士详情页、当前费用、OnlineIPS 申请指南、IPS 注册页和培养模式规则已采集并合并。
- 发布状态：`blocked`。
- 数据库状态：未写入、未发布。

本轮完成 `274` 个唯一硕士详情页入口的目录级完整候选。该数字可作为 USM 当前公开硕士目录入口数，但不能冒充需要登录的 OnlineIPS 最终申请选择数。

## 官方来源

| 来源 | 角色 | 范围 | SHA-256 |
| --- | --- | --- | --- |
| USM Postgraduate Programme Directory | 目录规范来源 | 当前目录，无明确学年 | `ccb852d13ccb650d2d80006c1ff18bf9129002fca83175db9158436d66f6be5f` |
| USM Postgraduate Fees 页面 | 当前费用字段权威来源 | 2025/2026 | `3597c8977755aa2f18fb3b389c813435989bd62cc54318f26b8e573c10401076` |
| USM Postgraduate Fees PDF | 费用表视觉与结构交叉验证 | 2025/2026，更新于 2025-03-11 | `24bc178e7da6de039ff9e5cd866c580a5f3ed1c73db04d08b8f7ca42cb75bcef` |
| USM IPS Admission 页面 | 2026 注册活动与注册材料 | 2026 | `8bc410b05fc4909de3d3bf6187cd6acd92bc760bfc293f0b2a2b3490476bec9c` |
| USM IPS Research Mode 页面 | 研究型学期规则 | 当前规则 | `604bd880c1a0c8528cb7c4233e86c08f80ba4075a126c14b15d46bb23eff2d3e` |
| OnlineIPS Online Application Guideline | 申请材料与上传规则 | 2026-01 | `92559bbca13240e19d9cec7b761c7718eace5fa86648f3a13a0ea46fd443ece3` |

USM Admission 页面会对当前采集环境返回 WAF 403。目录和详情页使用公开只读页面代理作为传输层，所有来源身份、详情 URL 和字段证据仍绑定 USM 官方域名。费用 PDF 与 IPS 页面直接从官方服务器下载。

## 目录统计

- 全部详情入口出现次数：405。
- 硕士标题出现次数：276。
- 硕士唯一详情页：274。
- 重复硕士入口：2。
- 博士入口：129。

按目录栏目统计：

| 栏目 | 硕士详情页 |
| --- | ---: |
| Medical, Dental & Health | 82 |
| Applied Sciences | 44 |
| Pure Arts | 43 |
| Pure Sciences | 42 |
| Applied Arts | 37 |
| Engineering | 22 |
| Dual Degree | 2 |
| Double Degree | 1 |
| Joint Degree | 1 |

结合目录标题、详情正文和当前费用表后，274 条候选模式已全部裁决：

| 模式 | 数量 |
| --- | ---: |
| Research | 176 |
| Coursework | 51 |
| Mixed | 40 |
| Clinical | 7 |

## 离岸开设

当前目录离岸板块共有 54 个开设项，其中硕士 30 个。旧试点记录的 49 个已不再作为当前基准。

| 国家或地区 | 全层级开设项 | 硕士开设项 |
| --- | ---: | ---: |
| Turkiye | 40 | 21 |
| Malaysia | 4 | 4 |
| China | 4 | 1 |
| Iraq | 2 | 2 |
| Uzbekistan | 2 | 2 |
| Indonesia | 1 | 0 |
| Pakistan | 1 | 0 |

离岸开设项必须与规范专业建立关联，不应全部重复创建为新学位。

## 费用统计

- 研究型院系收费组：47。
- 具名收费行：123。
- 其中硕士具名收费行：110。
- 研究型费用按学期收费。
- mixed、coursework 和 clinical 表中的金额为完整项目总额。
- 国际学生费用以 `USD` 公布，马来西亚学生费用以 `MYR` 公布。
- 当前费用页明确说明费率适用于 Academic Session 2025/2026。

费用页面和 PDF 同时声明：费用可能调整；承诺前应再次确认；如有差异，以 USM Bursary 金额为准。

## 费用裁决

- 110 条具名硕士收费行已全部分配，例外队列为 0。
- 同名 `Master of Science in Building Technology` 按 mixed 和 coursework 两种模式分别映射，避免名称覆盖。
- 教育、景观建筑、Master of Medicine 等方向费用挂在其官方父级目录入口下，不虚增目录数量。
- `Master of Pathology (Chemical Pathology)` 和 `Master of Pathology (Medical Genetics)` 只有当前官方收费行、没有公开目录入口，作为 2 个待申请系统确认的收费项单独保留。
- 5 个详情页已明确公布 2026/2027 新费率：Master of Communication 两个入口为国际总学费 USD 8,600；Master of Business Analytics 三个入口为国际总学费 USD 9,030。
- 其余项目使用 2025/2026 官方费用总表。旧详情页与总表冲突时不采用旧金额。
- 238 个目录入口具有直接当前费率；另有 4 个父级入口具有方向或 track 当前费率。
- 32 个入口没有唯一适用的当前公开费率，主要为离岸或新增项目，必须显示“官网未公布/请向 USM 确认”，不得套用本部旧金额。

## 详情完整性

274 个详情页全部取得内容和哈希。修复链接式章节标题解析后，71 个页面具备完整标准栏目，203 个页面至少缺少一个标准栏目：

- 60 个未单列专业级学术要求。
- 60 个未单列专业级语言要求。
- 60 个未单列结构化学制。
- 200 个未单列 `SEMESTER INTAKE`。
- 70 个未单列详情页费用。

候选清单已用官方通用要求、研究型学制和学期规则补足结构，并保留 `official-programme-specific`、`official-general-rule`、`official-unpublished` 等证据层级，不把通用规则伪装成专业级要求。

## 注册与签证

IPS 当前页面公布：

- Clinical programmes：June 2026 注册活动。
- Coursework/Mixed/Online：September 2026 注册活动。
- Research mode：按研究型注册规则执行。
- 注册材料包括 Student Pledge Form、Medical Report Form、国际生 Health Declaration Form 和对应模式的 Confirmation of Registration Form。
- 国际在校学习者通常需要 Student Pass/Visa；coursework/mixed 应在新学期前 3 个月办理，research 应在计划注册日前 3 个月办理。
- Online 和 overseas offshore 项目不要求 Student Pass。

OnlineIPS 2026 官方申请指南另外确认了护照、证件照、本科学位证、成绩单、评分标准、英语成绩或豁免证明、研究计划、推荐人资料和奖学金信等 10 类申请材料及上传规则。研究计划仅适用于研究型申请，推荐人资料适用于研究型或 Master of Medicine。

## 发布阻断

1. 四语 StudyMY 本地化尚未生产和审核。
2. OnlineIPS 的最终申请选择需要登录，当前不能公开验证其数量是否与 274 个目录入口完全一致。
3. 32 个目录入口没有唯一适用的当前公开费率，公开页面必须抑制金额并显示官方未公布状态。
4. 数据库 dry-run、事务导入、API 和前端验证尚未开始。

## 回滚与安全

本任务没有数据库写入，无业务数据回滚操作。删除本轮新增的采集 JSON、脚本和中文审计文件即可撤销代码层变更；官方来源缓存位于 `tmp`，不属于业务数据。
