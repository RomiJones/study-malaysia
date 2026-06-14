# USM 国际硕士官方数据采集审计

## 审计结论

- 审计日期：2026-06-14。
- 范围：USM、硕士层级、国际申请人。
- 当前官方费用学年：2025/2026。
- 采集状态：官方目录、274 个唯一硕士详情页、当前费用页、费用 PDF、IPS 注册页和研究型学期规则已采集。
- 发布状态：`blocked`。
- 数据库状态：未写入、未发布。

本轮确认的是 `274` 个唯一硕士详情页入口，不是最终商用规范专业数。官方目录同时混合研究领域、临床方向、双学位、离岸交付和同名不同模式项目，必须完成身份裁决后才能声明最终专业总数。

## 官方来源

| 来源 | 角色 | 范围 | SHA-256 |
| --- | --- | --- | --- |
| USM Postgraduate Programme Directory | 目录规范来源 | 当前目录，无明确学年 | `ccb852d13ccb650d2d80006c1ff18bf9129002fca83175db9158436d66f6be5f` |
| USM Postgraduate Fees 页面 | 当前费用字段权威来源 | 2025/2026 | `3597c8977755aa2f18fb3b389c813435989bd62cc54318f26b8e573c10401076` |
| USM Postgraduate Fees PDF | 费用表视觉与结构交叉验证 | 2025/2026，更新于 2025-03-11 | `24bc178e7da6de039ff9e5cd866c580a5f3ed1c73db04d08b8f7ca42cb75bcef` |
| USM IPS Admission 页面 | 2026 注册活动与注册材料 | 2026 | `8bc410b05fc4909de3d3bf6187cd6acd92bc760bfc293f0b2a2b3490476bec9c` |
| USM IPS Research Mode 页面 | 研究型学期规则 | 当前规则 | `604bd880c1a0c8528cb7c4233e86c08f80ba4075a126c14b15d46bb23eff2d3e` |

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

标题明确标注的模式为：coursework 34、mixed 25、research 47；另有 168 个标题未明确模式，必须根据详情页和费用表裁决，不能按标题猜测。

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

## 官方冲突

自动化仅对唯一、规范化后完全同名的收费行做初步匹配。49 条收费行完成唯一同名匹配，其中 28 条金额得到详情页印证，10 条详情页未公布费用，11 条出现官方金额冲突候选：

1. Master in Biomedical Science
2. Master of Science in Building Technology
3. Master of Science in Molecular Medicine
4. Master of Social Sciences in Islamic-Based Development Management
5. Master of Cognitive Neurosciences
6. Master of Digital Transformation
7. Master of Science in Clinical Exercise Science
8. Master of Medicine in Nuclear Medicine
9. Master of Medicine in Transfusion Medicine
10. Master of Pathology (Anatomic Pathology)
11. Master of Pathology (Haematology)

其余 61 条具名硕士收费行需要人工身份映射，主要涉及模式、track、临床方向、双学位、线上或同名不同校区。

当前发布口径应以 2025/2026 官方费用页为主，并保留详情页冲突证据。不能选取更低的旧详情页金额用于展示。

## 详情完整性

274 个详情页全部取得内容和哈希，69 个页面具备完整标准栏目，205 个页面至少缺少一个标准栏目：

- 62 个未单列专业级学术要求。
- 62 个未单列专业级语言要求。
- 62 个未单列结构化学制。
- 202 个未单列 `SEMESTER INTAKE`。
- 72 个未单列详情页费用。

这些缺口并非全部是采集失败。部分页面只有长文本介绍；研究型项目可由 IPS 学期规则补证；通用学术和语言要求可作为一般规则，但必须标注为全校规则，不能伪装成专业级要求。

## 注册与签证

IPS 当前页面公布：

- Clinical programmes：June 2026 注册活动。
- Coursework/Mixed/Online：September 2026 注册活动。
- Research mode：按研究型注册规则执行。
- 注册材料包括 Student Pledge Form、Medical Report Form、国际生 Health Declaration Form 和对应模式的 Confirmation of Registration Form。
- 国际在校学习者通常需要 Student Pass/Visa；coursework/mixed 应在新学期前 3 个月办理，research 应在计划注册日前 3 个月办理。
- Online 和 overseas offshore 项目不要求 Student Pass。

以上是录取后的注册材料，不等于完整的申请阶段材料清单。当前公开页面未提供可用于所有专业的完整申请材料清单，因此该字段继续阻断发布。

## 发布阻断

1. 274 个目录入口尚未完成规范专业、研究方向和开设项裁决。
2. 61 条具名收费行和全部研究型院系收费组尚未完整映射到规范专业。
3. 11 个同名项目存在官方费用冲突候选。
4. 申请阶段材料清单没有完整的当前官方来源。
5. 专业级缺栏仍需使用官方通用规则或其它学院来源补证并明确证据层级。
6. 四语本地化、数据库 dry-run、API 和前端验证尚未开始。

## 回滚与安全

本任务没有数据库写入，无业务数据回滚操作。删除本轮新增的采集 JSON、脚本和中文审计文件即可撤销代码层变更；官方来源缓存位于 `tmp`，不属于业务数据。
