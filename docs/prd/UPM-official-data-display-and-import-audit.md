# UPM 官方数据展示方式与 StudyMY 导入审计说明

## 背景

本说明用于记录 Universiti Putra Malaysia（UPM / 马来西亚博特拉大学）官方资料展示方式，以及 StudyMY 数据层应如何把它转换成用户端更直观、可筛选、可审计的展示结构。

UPM 的官方资料并不像 UM 静态数据那样集中在单一目录中，而是分散在本科 admission 页面、学院页面、SGS 研究生页面、研究生 handbook、申请指南和费用 PDF 中。因此，StudyMY 不能简单照搬一个网页表格，而应按官方来源类型建立 source map，再转换成稳定的院校与专业数据行。

## 官方来源地图

| 来源 | 用途 | StudyMY 处理 |
| --- | --- | --- |
| `https://tppa.upm.edu.my/admission/programmes/undergraduate-75800` | 当前本科 programme-title 清单，按 faculty 分组 | 每个 programme title 作为一个本科专业行 |
| `https://akademik.upm.edu.my/upload/dokumen/menul320250417184027Undergraduate_Programmes_Brochure_for_International_Students.pdf` | 国际本科费用相关 PDF | 作为费用来源；未能明确匹配到单专业费用时不猜测 |
| `https://sgs.upm.edu.my/programme_of_study/programme_by_coursework-4574` | 授课型研究生入口和学院清单 | 结合 handbook 中 programme title 建行 |
| `https://sgs.upm.edu.my/upload/dokumen/20260408095929Postgraduate_Student_Handbook_2026_-_with_cover_compressed.pdf` | 研究生 handbook 2026，授课型专业清单 | 每个 coursework programme title 作为专业行 |
| `https://sgs.upm.edu.my/programme_of_study/programme_by_research_phd_master-4568` | 研究型硕博 degree title 与 300+ fields of study | degree title 建行，fields 放入 `specializations` |
| `https://sgs.upm.edu.my/upload/dokumen/20250821150314UPM_Postgraduate_Application_Guidelines.pdf` | 研究生申请、语言、intake 和国际生限制 | 作为要求与状态判断来源 |

## UPM 展示方式的转换规则

- 本科：UPM 当前页面按学院展示 programme-title 清单，不在该页面逐个展开费用、学制、intake 和详细要求。StudyMY 应把 86 个本科 programme-title 转成可筛选的专业行；未公布的费用、学制、intake 等字段统一写“官方未公布”，并把原因放进 audit note。
- 授课型研究生：UPM SGS 页面先给 faculty 入口，handbook 再列 programme-title。StudyMY 应展示直观专业行，不把入口页本身当专业。
- 研究型硕博：UPM 官方页面明确是少量研究型 degree title 加 300+ fields of study。StudyMY 只把 Master of Science、Master of Arts、Master of Veterinary Science、PhD、Deng、PhD by Publication、PhD by Retrospective 这类 degree title 当专业；research fields 进入详情页 `specializations`，不计入主列表专业数量。
- 医学类/暂停招生项：官方标记不开放国际生或暂停 intake 的，保留在数据库审计层，`publicDisplayStatus` 设为 `not-available-for-international`，不进入普通用户主列表。
- 前台列表：只展示专业名、学院、层级/模式、简短学制、简短费用、intake 和详情入口；长官方说明、来源 URL、audit note 和未公布原因放在详情页或后台。

## 当前实现结果

已更新 `apps/api/src/db/import-upm-official.ts`：

- 本科清单从旧 73 条改为当前官方本科 admission 页的 86 条。
- 默认执行 `--dry-run`，未显式传入 `--confirm-import` 时不会连接数据库写入。
- 支持 `--level master`，可以只导入 UPM 硕士数据，不删除或重写本科、博士等其它层级。
- 增加 `import:upm:official` npm script。
- dry-run 输出官方来源、UPM 展示方式转换规则、层级统计、状态统计和前 5 条样例。

dry-run 统计：

| 项目 | 数量 |
| --- | ---: |
| 总专业行 | 177 |
| 本科 | 86 |
| 硕士 | 86 |
| 博士 | 5 |
| ready | 167 |
| not-available-for-international | 10 |
| 研究型 degree title | 7 |

## 硕士专项校对结果

本轮已按 UPM 官方硕士口径完成专项校对：

- Coursework Master：83 个，来自 UPM Postgraduate Student Handbook 2026 的 Programme by Coursework 清单。
- Research Master degree title：3 个，来自 SGS Programme by Research 页面，分别为 Master of Veterinary Science (M.V.Sc.)、Master of Science (M.S.)、Master of Arts (M.A)。
- Doctor of Public Health 保留为博士层级，不计入硕士数量。
- 300+ research fields of study 放入研究型硕士/博士详情页的 `specializations`，不作为独立硕士专业计数。
- 医学类本地公民限定和暂停 intake 的硕士保留在数据库审计层，`publicDisplayStatus=not-available-for-international`，不进入普通用户 ready 主列表。

硕士 dry-run 统计：

| 项目 | 数量 |
| --- | ---: |
| 硕士总数 | 86 |
| Coursework Master | 83 |
| Research Master degree title | 3 |
| ready | 76 |
| not-available-for-international | 10 |
| 数量闭合 | 是 |

已执行真实写库导入：

```bash
npm --workspace @studymy/api run import:upm:official -- --level master --confirm-import
```

写库结果：UPM `universityId=6`，硕士层级写入后数据库统计为 `ready=76`、`not-available-for-international=10`。本轮只删除并重写 UPM 的 `level=master` 专业，没有重写本科、博士或其它院校数据。

## 2026 国际学生学费校准结果

本轮使用用户提供的官方资料 `UPM_Tuition_Fees_International_2026_official.pdf` 校准 UPM 国际学生学费。该 PDF 提供的是 Foundation 与 Bachelor Degree Programmes 的国际学生费用表，字段包含 `TUITION FEE PER SEM (MYR)` 和 `OVERALL TOTAL FEE (MYR)`；本轮将 StudyMY 的 `officialTuitionMYR` 统一存储为官方总学费 MYR，将 `tuitionDisplay` / `listTuitionText` 展示为总学费并附带每学期费用。

处理规则：

- 能与当前 UPM 本科目录明确匹配的专业，写入官方 programme code、学期数、学制、每学期学费和总学费。
- 当前 UPM admission 页面存在，但该 PDF 没有对应费用行的专业，继续保留 `officialTuitionMYR=null` 和 `tuitionStatus=official-not-published` 口径，不套用相邻学院或旧费用。
- PDF 内 Science / Veterinary 部分存在同一 code 的重复低价行；本轮采用前面完整 `BACHELOR DEGREE PROGRAMMES` 主表中的费用，并在 `auditNote` 记录冲突。
- 该 PDF 不包含硕士授课型或研究型学费明细，所以 UPM 硕士仍保持“官方未公布”，没有用本科费用套硕士。

本科学费 dry-run 统计：

| 项目 | 数量 |
| --- | ---: |
| 当前 UPM 本科专业 | 86 |
| 已匹配官方学费 | 75 |
| PDF 未公布或未匹配 | 11 |
| 写库层级 | bachelor |

已执行真实写库导入：

```bash
npm --workspace @studymy/api run import:upm:official -- --level bachelor --confirm-import
```

写库结果：UPM `universityId=6`，本科层级写入后数据库统计为 `ready=86`。本轮只删除并重写 UPM 的 `level=bachelor` 专业，没有重写硕士、博士或其它院校数据。

## 四语言业务数据补齐结果

本轮已按 StudyMY 顶部语言切换设计补齐 UPM 业务数据的四语言结构，重点覆盖用户端会直接展示的字段：

- 专业名：`name.en` 保留官方英文，`name.ms`、`name.zh-CN`、`name.zh-TW` 由规则翻译层生成。
- 学院名：`faculty` 补齐英文、马来文、简体中文、繁体中文。
- 专业描述：`description` 补齐四语言，说明开设学院和学习模式。
- 入学要求摘要：`requirement.note` 补齐四语言。
- 申请材料：`applicationDocs` 补齐四语言。
- 研究方向：`specializations` 补齐四语言；研究方向仍不作为独立专业计数。
- 空的课程和就业字段使用四语言空数组，不再把中文“官方未公布”塞进英文或马来文字段。

官方原文、来源 URL、审计备注和费用冲突说明仍保留英文原始事实，避免把审计字段误翻译成不可靠结论。

已执行真实写库导入：

```bash
npm --workspace @studymy/api run import:upm:official -- --confirm-import
```

写库结果：UPM `universityId=6`，当前数据库 UPM 官方数据集为本科 `ready=86`、硕士 `ready=76`、硕士 `not-available-for-international=10`、博士 `ready=5`，公开可展示专业数 `programCount=167`。本次全量重写 UPM 专业数据，没有修改其它院校。

多语言本地校验：

```bash
npx tsx --tsconfig apps/api/tsconfig.json tmp/check-upm-i18n.ts
```

校验结果：177 条 UPM 专业的 `name`、`faculty`、`description`、`requirement.note`、`applicationDocs`、`curriculum`、`careers`、`specializations` 中，英文和马来文字段 CJK 泄漏数为 `0`。

## 本科专业名称校验结果

本轮已单独校验 UPM 本科专业名称展示层：

- 本科英文名：`name.en` 与 `nameEnOfficial` 保持官方英文一致，不混入中文。
- 本科简体中文名：`name.zh-CN` 使用完整中文学位名，不再回退英文原文。
- 本科繁体中文名：`name.zh-TW` 使用完整繁体中文学位名，不再回退英文原文。
- 保留 `TESL` 等官方常用缩写，但不允许出现 `Bachelor`、`Science`、`with`、`Honours` 等英文词夹在中文名称中。
- `Doctor of Medicine` 与 `Doctor of Veterinary Medicine` 是 UPM 官方本科目录和本科费用表中的 first professional degree title，保留在 `level=bachelor`；用户端英文展示改为 `Bachelor of Medicine (Professional Degree)` / `Bachelor of Veterinary Medicine (Professional Degree)`，中文展示改为“医学学士（专业学位） / 兽医医学学士（专业学位）”，避免用户误解为 PhD/博士层级。

本科名称数据库校验结果：

| 项目 | 数量 |
| --- | ---: |
| 本科专业总数 | 86 |
| 英文字段异常 | 0 |
| 简中字段中英文混杂 | 0 |
| 繁中字段中英文混杂 | 0 |
| 简中未翻译 | 0 |
| 繁中未翻译 | 0 |
| 本科中文名误含“博士” | 0 |
| 本科用户端英文名误含 `Doctor` | 0 |
| 空名称字段 | 0 |

## 硕士专业名称校验结果

本轮已按本科同一标准校验并优化 UPM 硕士专业名称展示层：

- 硕士英文名：`name.en` 与 `nameEnOfficial` 保持官方英文一致，不混入中文。
- 硕士简体中文名：`name.zh-CN` 使用完整中文专业名，不再回退英文原文。
- 硕士繁体中文名：`name.zh-TW` 使用完整繁体中文专业名，不再回退英文原文。
- 保留 `M.S.`、`M.A`、`M.V.Sc.`、`GIS` 等官方常用缩写，但不允许出现 `Master`、`Science`、`with`、`in` 等英文词夹在中文名称中。
- 医学类 `not-available-for-international` 硕士也同步完成名称校对，保留审计状态，不进入普通 ready 主列表。

硕士名称数据库校验结果：

| 项目 | 数量 |
| --- | ---: |
| 硕士专业总数 | 86 |
| ready | 76 |
| not-available-for-international | 10 |
| 英文字段异常 | 0 |
| 简中字段中英文混杂 | 0 |
| 繁中字段中英文混杂 | 0 |
| 简中未翻译 | 0 |
| 繁中未翻译 | 0 |
| 空名称字段 | 0 |

## 硕士语言要求校准结果

本轮根据 UPM SGS 官方 English Language Requirements 页面（updated 13/05/2026）校准 UPM 硕士语言要求：

- 普通硕士：结构化字段写入 IELTS 6.0、TOEFL iBT/Home Edition 72、PTE Academic 59、MUET Band 4.0。官方说明补充 Cambridge Linguaskill at CALC UPM 169-175、CIEP/PTEST 110、注册前提交、成绩有效期不超过两年，以及 IELTS Indicator、APTIS、Duolingo、TOEFL ITP、MoI letter 不接受。
- English Department 相关硕士：`Master in Applied English Linguistics` 使用同样分数，但官方说明标记为申请时必须提交 full-offer 成绩，不提供 provisional English offer。
- 语言授课路径：`Master of Malay Language and Linguistics` 按官方 Malay Language Studies / Arabic / Chinese Literature / language-of-instruction 路径写入 IELTS 5.0、TOEFL iBT/Home Edition 44、PTE Academic 47、MUET Band 3.5，并标记不提供 provisional English offer。

硕士语言要求数据库校验结果：

| 项目 | 数量 |
| --- | ---: |
| 硕士专业总数 | 90 |
| 语言要求空值 | 0 |
| IELTS 6.0 / TOEFL 72 / PTE 59 / MUET 4.0 | 89 |
| IELTS 5.0 / TOEFL 44 / PTE 47 / MUET 3.5 | 1 |

## 硕博费用与学制校准结果

本轮使用用户提供的三份 UPM 官方研究生费用资料校准硕博阶段：

- `UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf`
- `UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf`
- `UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf`

处理规则：

- 授课型硕士按 Dual Semester 或 Trimester 官方表写入国际学生总学费 MYR，并按费用表对应的 1 年、2 年或 4 年展示学制。
- 医学类硕士按 Medicine local/international 表中的 `INTERNATIONAL` 类别写入费用；Master of Public Health 展示 1 年，临床医学/外科类硕士展示 4 年。
- Doctor of Public Health 按 Medicine 表写入国际学生 3 年总学费 MYR 150,750。
- 研究型硕士/博士按官方 Medical、Science & Technology、Social Science 集群费用展示范围；研究方向仍放入 `specializations`，不作为独立专业。
- 三份费用 PDF 中未出现的授课型兽医硕士费用保持 `official-not-published`，不套用研究型或医学类费用。

本轮查漏补缺结果：

| 项目 | 数量 |
| --- | ---: |
| UPM 总专业 | 181 |
| 硕士专业 | 90 |
| 博士专业 | 5 |
| 研究生专业合计 | 95 |
| 授课型硕士 | 87 |
| 研究型硕士 degree title | 3 |
| 博士/专业博士 | 5 |
| 研究生 ready | 95 |
| 研究生名称异常 | 0 |
| 研究生学制格式异常 | 0 |
| 研究生已匹配官方费用 | 93 |
| 研究生费用官方未公布 | 2 |

研究生学制分布：

| 学制展示 | 数量 |
| --- | ---: |
| 1 year | 11 |
| 2 years | 70 |
| 3 years | 1 |
| 4 years | 13 |

仍保持官方未公布费用的研究生专业：

| 专业 | 原因 |
| --- | --- |
| Master of Veterinary Science | 三份研究生费用 PDF 未出现对应授课型费用行 |
| Master of Veterinary Medicine | 三份研究生费用 PDF 未出现对应授课型费用行 |

## 学制展示校准结果

本轮已按 StudyMY 用户端列表展示要求，把 UPM 专业学制统一整理为年份单位：

- 本科：优先使用官方 2026 国际学生费用表中的 `SEM` / `YEAR` 换算，写入 `durationYears` 和 `durationOfficial`，例如 `3.5 years`、`4 years`、`5 years`。
- PDF 未匹配到费用行的当前本科专业：列表仍按本科默认 `4 years` 展示，未匹配原因只放入 `auditNote`，不撑爆前台学制列。
- 授课型硕士：统一展示为 `2 years`，具体官方页面若后续公布更细学制，再按专业覆盖。
- 研究型硕士：统一展示为 `2 years`。
- 博士：统一展示为 `3 years`。

本地学制格式校验：177 条 UPM 专业的 `durationOfficial` 均符合年份格式，异常数 `0`。

## 开学时间展示校准结果

本轮已按 StudyMY 用户端列表展示要求，把 UPM 本硕专业开学时间字段校准为“只展示开学月份”：

- `intakeMonths` 只允许写入 `January` 到 `December` 的月份名数组，不再写入长句、申请说明、暂停招生说明或 `Throughout the year`。
- `officialIntake` 只用于前台直观展示；有明确月份时展示月份，没有明确官方月份时统一写 `Not published by official source`，由前端语言切换显示对应语言文案。
- 官方长说明保留在 `officialIntakeNote` / `auditNote`，用于后台审计，不进入前台列表的开学时间列。
- 本科：按 UPM 国际本科招生资料，Bachelor 开学月份展示为 `October, March`。
- 硕士 Dual-Semester：按 UPM 研究生申请指南与研究生资料，普通双学期硕士展示为 `September, March`。
- 硕士 Trimester：按 UPM Trimester 资料，普通 trimester 硕士展示为 `July, November, March`；官方标明 First Trimester only 的专业只展示 `July`。
- 硕士医学类：Master of Public Health 展示 `October, March`；临床医学/外科类硕士按 Medicine 费用资料展示 `June, December`。
- 官方标明 First Semester only 或 Second Semester only 的硕士，只展示对应月份。

本硕开学时间数据库校验结果：

| 项目 | 数量 |
| --- | ---: |
| 本硕专业总数 | 176 |
| 本科 | 86 |
| 硕士 | 90 |
| 非月份内容异常 | 0 |
| 空开学月份 | 0 |

本硕开学月份组合分布：

| 月份组合 | 数量 |
| --- | ---: |
| October, March | 87 |
| September, March | 59 |
| September | 11 |
| June, December | 9 |
| July, November, March | 8 |
| July | 1 |
| March | 1 |

## 验证命令

```bash
npm --workspace @studymy/api run import:upm:official -- --level master --dry-run
npm --workspace @studymy/api run import:upm:official -- --level bachelor --dry-run
npm --workspace @studymy/api run import:upm:official -- --dry-run
npm --workspace @studymy/api run import:upm:official -- --confirm-import
npm --workspace @studymy/api run build
```

## 未执行事项

- 本轮未更新 Notion，因为当前对话没有提供可写入的 Notion 页面 ID。
- 本轮不修改用户端 UI、CSS、Tab、筛选或弹窗逻辑。
