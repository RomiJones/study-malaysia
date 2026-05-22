# TASK-005 管理端字段维护与内容管理升级规划

## 1. 文档信息

- **任务编号**：TASK-005
- **任务标题**：管理端字段维护与内容管理升级
- **运行编号**：TASK-005-2026-05-22T11-48-02-538Z
- **本轮执行时间**：2026-05-22T19:50:56+08:00
- **静态 HTML**：`D:\mydev\StudyMY_UM_v58_na_display_tidy.html`
- **旧系统路径**：`D:\mydev\study-malaysia`
- **产出范围**：本任务只产出中文 PRD、功能清单、视觉规范、旧系统差距分析和后续任务拆解。
- **禁止范围**：本任务不修改 `apps/web`、`apps/api`、`apps/admin` 的业务实现文件，不新增数据库迁移，不导入静态 HTML 数据。
- **事实来源**：Notion 是中文项目文档和任务管理来源，不是业务数据库；运行时业务数据仍应由 MySQL、NestJS API、Vue 用户端和管理端维护流程承载。
- **Notion 状态**：`NOTION_PROJECT_HOME` 为空；本轮 Notion 搜索只返回无关的「Notion 基础知识」页面，未定位到可安全更新的真实 TASK-005 页面，因此只更新本地中文文档和本地 Notion 快照。

## 2. 本轮结论

静态 HTML 不是简单落地页，而是一套已经包含 UM 官方数据、公开展示状态、来源核验、费用审计、申请材料、开学时间、用户端交互和视觉规范的产品样本。TASK-005 后续实现的重点不是给管理端增加零散输入框，而是让管理端、后端和共享类型完整承载静态页的官方字段，并让用户端 API 能读取这些字段用于 1:1 还原。

旧系统已有 Vue 3 + Element Plus 管理端，具备学校、专业、内容、申请、权限、菜单、配置、字典和日志基础能力。当前学校表单可维护基础资料、四语言文本、图片、排名、CNY 学费、生活成本、IELTS 和发布状态；专业表单可维护基础专业、四语言名称、学院、材料、课程、就业、学制、CNY 年学费、IELTS/GPA 和入学月份。

主要差距集中在静态页官方字段：官方 RM 总学费、官方学费来源、官方学制、官方开学、官方语言原文、官方学术要求、中国学生要求、认证说明、公开展示状态、来源状态、核验日期、费用审计和审计备注。

## 3. 静态 HTML 分析

### 3.1 数据统计

本轮已读取并分析 `D:\mydev\StudyMY_UM_v58_na_display_tidy.html`，并通过 `scripts/task005-analyze-static-html.mjs` 复核静态页自身数据与去重合并逻辑。

| 指标 | 数值 |
| --- | ---: |
| 文件大小 | 2,515,543 bytes |
| HTML 行数 | 38,405 |
| 页面标题 | StudyMY UM v39 — 商用可申请专业展示版 |
| `universitiesBase` 院校数 | 18 |
| `universitiesSupplement` 院校数 | 108 |
| 合并后院校数 | 119 |
| 合并后专业数 | 687 |
| `publicDisplayStatus = ready` 专业数 | 239 |
| `not-available-for-international` 专业数 | 6 |
| `hidden-unverified` 专业数 | 3 |
| 缺少 `publicDisplayStatus` 的遗留专业数 | 439 |
| ready 本科专业数 | 74 |
| ready 硕士专业数 | 136 |
| ready 博士专业数 | 29 |
| ready 专业类别数 | 46 |

用户端公开专业主列表必须以 `publicDisplayStatus === "ready"` 为准；不开放国际学生、隐藏未核验和缺少公开状态的数据应保留在后台和数据层，不能进入用户端公开主列表。

### 3.2 官方字段覆盖

| 字段 | 有值记录数 |
| --- | ---: |
| `officialTuitionMYR` | 240 |
| `officialFeeSourceUrl` | 248 |
| `officialDuration` | 246 |
| `officialIntake` | 245 |
| `officialLanguageRequirement` | 246 |
| `officialAcademicRequirement` | 246 |
| `chinaStudentRequirement` | 154 |
| `officialSourceUrl` | 248 |
| `officialVerifiedAt` | 246 |
| `officialSourceStatus` | 248 |
| `publicDisplayStatus` | 248 |
| `officialFeeAuditStatus` | 80 |
| `officialAccreditationNote` | 18 |

这些字段说明管理端必须维护 ready 数据之外的待核验、隐藏、不开放国际学生和来源冲突记录，否则用户端无法完整复刻静态页的展示与空状态逻辑。

### 3.3 院校字段范围

管理端院校维护至少需要覆盖以下字段组：

| 分组 | 字段 |
| --- | --- |
| 基础识别 | `id`、`name`、`nameEn`、`shortName`、`type`、`uniType`、`location`、`region`、`founded` |
| 视觉展示 | `logo`、`image`、`color`、`description`、`highlights`、`facilities` |
| 排名规模 | `qsRank`、`qsAsiaRank`、`qsRankDisplay`、`qsRankSourceNote`、`students`、`intlStudents`、`academicStaff`、`facultiesCount` |
| 费用语言 | `tuitionRange`、`livingCost`、`livingCostOfficialNote`、`minIELTS`、`acceptNoLanguage` |
| 官方入口 | `website`、`officialWebsite`、`studyPortal`、`internationalPage`、`applicationPortal`、`admissionEmail` |
| 官方档案 | `officialProfile.legalName`、`officialProfile.chineseName`、`officialProfile.address`、`officialProfile.institutionType`、`officialProfile.universityType`、`officialProfile.rankings`、`officialProfile.scale`、`officialProfile.levels` |
| 申请信息 | `officialProfile.applicationPeriods`、`officialProfile.applicationFees`、`officialProfile.applicationDocuments`、`officialProfile.chinaRequirement`、`officialProfile.contact`、`officialProfile.phones` |
| 来源审计 | `officialProfile.officialLinks`、`officialProfile.verifiedAt`、`officialProfile.qualityNote`、`officialProfile.sourceNote`、`officialProfile.programAuditNote`、`officialAuditSummary`、`contentAudit`、`postgraduateAudit` |

### 3.4 专业字段范围

管理端专业维护至少需要覆盖以下字段组：

| 分组 | 字段 |
| --- | --- |
| 基础识别 | `id`、`name`、`nameEn`、`level`、`category`、`faculty`、`facultyZh`、`type`、`mode`、`studyMode`、`programmeMode`、`campus` |
| 学制开学 | `duration`、`durationOfficial`、`officialDuration`、`intake`、`intakeOfficial`、`officialIntake`、`officialIntakeText`、`intakeNote`、`officialIntakeNote` |
| 官方费用 | `tuition`、`tuitionCurrency`、`tuitionDisplay`、`tuitionOfficialRM`、`officialTuitionMYR`、`officialTuitionText`、`officialTuitionNote`、`listTuitionText`、`displayFeeNote` |
| 费用审计 | `officialFeeSourceUrl`、`secondaryOfficialFeeSourceUrl`、`officialFeeAuditStatus`、`officialFeeAuditedAt`、`feeDisplayNote`、`feeRemark`、`feeVerificationNote`、`feeDisplayPolicy` |
| 要求信息 | `language`、`englishOfficial`、`officialLanguageRequirement`、`requirements`、`officialAcademicRequirement`、`chinaStudentRequirement`、`chinaStudentEligibility`、`specialRequirementsNote` |
| 内容字段 | `applicationDocs`、`curriculum`、`careers`、`specializations`、`description`、`notes`、`officialAccreditationNote` |
| 官方来源 | `officialUrl`、`officialSourceUrl`、`officialEntryRequirementSourceUrl`、`officialAccreditationSourceUrl`、`sourceUrls`、`sourcePriority`、`sourcePriorityNote` |
| 状态核验 | `sourceStatus`、`officialSourceStatus`、`officialSourceNote`、`verifiedAt`、`officialVerifiedAt`、`lastOfficialAudit`、`auditNote`、`dataAuthority`、`commercialAuditStatus`、`commercialAuditLevel`、`commercialUsePolicy` |
| 展示规则 | `publicDisplayStatus`、`publicDisplayNote`、`displayAdmissionStatus`、`displayStatusNote`、`displayNote`、`reviewReason` |

## 4. PRD

### 4.1 背景

StudyMY 旧系统具备基础管理台能力，但字段设计偏演示级。静态 HTML 已整理更严格的官方字段、展示状态和来源核验逻辑。为了让用户端后续按静态 HTML 1:1 还原，管理端必须升级为可维护这些字段的内容管理系统。

### 4.2 目标

- 管理员可以新增、编辑、查看静态页用户端展示所需的院校、专业、费用、要求、申请材料、开学时间、标签和官方来源字段。
- 字段保存后可通过后端 API 被用户端读取。
- 公开展示状态、来源状态和费用审计状态可维护、可筛选、可追溯。
- 专业类别不再被旧系统 7 个固定枚举限制，可覆盖静态页 46 类 ready 专业类别。
- 延续旧系统权限、菜单、表单校验、错误提示和操作日志能力。
- 明确 Notion 只作为中文项目文档和任务管理来源，不作为业务数据库。

### 4.3 非目标

- 本任务不实现表单、不改 API、不建表、不导入数据。
- 本任务不把静态 HTML 当作运行时数据库。
- 本任务不要求管理端界面 1:1 复刻静态 HTML；1:1 视觉要求只针对用户端页面。
- 本任务不处理依赖漏洞、既有 chunk 警告或历史编码问题。

### 4.4 角色

- **内容管理员**：维护学校、专业、内容块、官方链接和中文展示字段。
- **数据核验人员**：维护官方来源、核验日期、费用审计状态、公开展示状态和审计备注。
- **招生运营人员**：维护申请周期、申请费用、申请材料、中国学生要求和跟进说明。
- **系统管理员**：维护字段权限、字典、菜单、角色和操作日志。

### 4.5 成功标准

- 管理端字段清单覆盖静态页院校卡片、院校详情、专业 7 列列表和专业详情弹窗。
- 后端实体、DTO、映射和共享类型有明确升级方向。
- 后续任务按用户端、后端服务、管理端拆清楚。
- 用户端视觉基准明确指向静态 HTML，不以旧系统当前用户端样式为准。
- 文档明确 Notion 不是业务数据库。

## 5. 功能清单

### 5.1 学校管理升级

- 基础资料：slug、code、中文名、英文名、官方英文名、简称、办学性质、院校类型、城市、地区、创立年份。
- 视觉资料：Logo、封面图、品牌色、简介、亮点、设施、标签。
- 排名规模：QS 世界排名、QS 亚洲排名、排名展示文本、排名来源说明、学生总数、国际生数、学术人员数、学院数。
- 费用语言：学费范围、费用币种、生活成本、生活成本官方说明、最低 IELTS、是否接受无语言申请。
- 官方入口：官网、Study Portal、国际学生页、申请入口、招生邮箱、联系电话、官方地址。
- 申请信息：申请周期、申请费用、官方申请材料、中国学生要求、申请说明。
- 来源核验：官方链接集合、核验日期、来源状态、质量备注、来源备注、审计摘要、是否公开展示。

### 5.2 专业管理升级

- 基础资料：所属学校、slug、code、中文名、英文名、官方英文名、学历层级、专业类别、学院英文名、学院中文名。
- 学习信息：学制数值、官方学制文本、学习模式、项目模式、校区、开学时间、官方开学文本、开学备注。
- 费用信息：官方总学费 RM、费用币种、列表展示学费、费用备注、官方学费来源、二级费用来源、费用审计状态、费用核验时间。
- 要求信息：结构化语言要求、官方语言要求原文、结构化学术要求、官方学术要求原文、中国学生要求、特殊要求、认证说明。
- 内容信息：申请材料、课程结构、职业方向、专业方向、简介、备注。
- 来源信息：官方专业页、官方入学要求页、官方认证页、来源 URL 集合、来源优先级、来源状态、核验日期。
- 展示规则：公开展示状态、公开展示备注、不开放国际学生说明、待核验原因、是否发布。
- 审计信息：商业展示策略、费用展示策略、翻译审计、学院名审计、研究生审计标准、最终审计备注。

### 5.3 内容管理升级

- 保留旧系统 `ContentPage.vue` 的内容块维护能力。
- 增加首页 Hero、搜索提示、官方免责声明、费用说明、申请说明、底部内容等内容块分类。
- 内容块继续支持多语言字段，但中文内容必须完整。
- 内容块保存后需要清理 catalog 缓存，并由用户端 API 回显。

### 5.4 字典与状态管理

- 专业类别字典：支持静态页 46 类 ready 专业类别，字段包含 code、中文名、英文名、排序、启用状态、用户端显示状态。
- 公开展示状态字典：`ready`、`not-available-for-international`、`needs-review`、`hidden-unverified`、`archived`。
- 官方来源状态字典：`official-verified`、`official-page-verified-international-not-available`、`needs-review`、`source-conflict`、`missing-source`、`hidden-duplicate-superseded`。
- 费用审计状态字典：`matched-official`、`source-conflict`、`pending-review`、`not-published`。
- 学习模式、开学月份、申请材料类型、申请任务分层等后续也应使用字典维护。

### 5.5 导入校验工作台

- 提供静态 HTML dry-run 统计，不直接写入业务库。
- 展示院校数、专业数、ready 数、不开放数、隐藏数、缺失公开状态数、缺失官方来源数。
- 展示字段缺失、重复专业、费用异常、来源冲突、未核验记录。
- 支持按学校、层级、类别、公开状态、来源状态、费用审计状态筛选。
- 支持从问题项跳转到学校或专业编辑页。

### 5.6 权限、校验和日志

- 新增或细分权限：官方字段查看、官方字段编辑、公开状态编辑、导入校验查看、导入确认、字典维护、审计日志查看。
- 表单校验覆盖必填、URL、邮箱、数值范围、日期格式、状态枚举和数组字段。
- 错误提示继续使用 Element Plus 表单反馈和全局消息。
- 操作日志记录学校官方字段、专业官方字段、公开状态、来源状态、费用审计、导入校验、导入确认和内容块变更。

## 6. 视觉规范

### 6.1 用户端视觉基准

用户端页面样式必须以静态 HTML 为基准，后续实现必须做到 1:1 一致。管理端字段维护的目的，是让用户端能无硬编码地还原以下视觉模块：

- 全局 token：主墨色 `#0C0E1A`、纸色 `#FAFAF8`、金色 `#C8A84B`、青绿 `#1B7A72`、红色 `#C43830`、蓝色 `#1E4FA3`、大圆角 `16px`、小圆角 `10px`。
- 字体：`DM Sans` 与 `DM Serif Display`，基础字号 `15px`，行高 `1.6`。
- 首页：深墨色 Hero、金色强调、噪声纹理、点阵背景、居中搜索框、统计栏。
- 院校库：`260px 1fr` 布局、左侧 sticky 筛选栏、折叠筛选组、预算滑杆、活跃筛选标签、横向院校卡片和分页。
- 院校详情：深色详情 Hero、标签页、官方档案卡、申请信息卡和专业列表。
- 专业列表：7 列 CSS Grid；1180px 以下横向滚动；760px 以下块状字段。
- 弹窗：专业详情、费用估算、智能推荐和登录弹窗桌面居中、移动端贴底。
- 响应式断点至少覆盖 1180px、900px、768px、760px、700px、600px。

### 6.2 管理端视觉原则

管理端不要求复刻静态 HTML 的用户端视觉，但需要延续当前 Element Plus 管理台风格，并把复杂字段拆成可扫描的表单分组：

- 学校表单建议分为：基础信息、视觉展示、排名规模、费用语言、官方入口、申请信息、来源核验、发布规则。
- 专业表单建议分为：基础信息、学制开学、官方费用、入学要求、材料内容、官方来源、展示状态、审计备注。
- 长文本和官方原文说明使用 textarea；官方来源集合使用可增删列表；费用、状态、日期字段使用明确的控件。
- 公开展示状态和来源状态必须在列表页可见，并支持筛选。
- 从 `needs-review` 改为 `ready` 这类高风险状态变更必须记录日志。

### 6.3 字段到用户端视觉的映射

| 用户端模块 | 管理端必须维护的字段 |
| --- | --- |
| 院校卡片 | Logo、封面、中文名、英文名、QS、标签、简介、学费展示、专业数量 |
| 院校详情 Hero | 官方英文名、简称、排名、地点、官网、申请入口、核验状态 |
| 官方信息卡 | 官方链接、申请周期、申请费用、申请材料、中国学生要求、联系方式 |
| 专业 7 列列表 | 专业名、英文名、学院、学制、官方学费、语言要求、开学、公开状态 |
| 专业详情弹窗 | 费用、学制、开学、语言、学术要求、中国学生要求、认证、材料、课程、职业、来源、核验日期 |
| 筛选侧栏 | 院校类型、学历层级、QS、预算、专业类别、免语言、公开状态 |
| 对比表 | 排名、地区、学费、语言、申请入口、专业数量、官方核验字段 |

## 7. 旧系统差距分析

### 7.1 共享类型差距

| 当前能力 | 静态页要求 | 差距 |
| --- | --- | --- |
| `ProgramCategory` 固定 7 类 | ready 专业类别 46 类 | 需要改为字典驱动或扩展可维护类别 |
| `UniversityListItem` 基础院校字段 | 官方档案、申请入口、官方链接、申请材料和核验说明 | 需要新增官方档案结构 |
| `ProgramListItem` 基础专业字段 | RM 总学费、费用来源、公开展示状态、官方要求原文和审计备注 | 需要新增官方专业详情结构 |
| `isPublished` 发布状态 | `publicDisplayStatus` 展示规则 | 需要区分发布、公开展示、来源核验 |

### 7.2 后端实体和 DTO 差距

| 模块 | 当前能力 | 缺口 |
| --- | --- | --- |
| `UniversityEntity` | slug、code、四语言名称、Logo、封面、QS、地区、办学性质、CNY 学费、生活费、IELTS、亮点、设施、发布状态 | 缺少官方英文名、国际学生页、申请入口、申请周期、申请费用、官方材料、官方链接、核验日期、审计摘要、公开展示状态 |
| `ProgramEntity` | 所属学校、slug、code、四语言名称、层级、7 类分类、学院、学制、CNY 年学费、入学月份、语言、GPA、材料、课程、就业、发布状态 | 缺少 RM 总学费、费用来源、官方学制、官方开学、官方语言原文、官方学术要求、中国学生要求、认证说明、公开展示状态、来源状态、审计备注 |
| `SaveUniversityDto` | 覆盖旧学校字段 | 缺少静态页官方档案和来源核验字段 |
| `SaveProgramDto` | 覆盖旧专业字段 | 缺少官方费用、官方要求、公开展示状态和审计字段 |
| `mapUniversity` / `mapProgram` | 返回旧用户端字段 | 用户端无法读取静态页详情和弹窗所需字段 |

### 7.3 管理端页面差距

| 页面 | 当前能力 | 缺口 |
| --- | --- | --- |
| `UniversitiesPage.vue` | 搜索、办学性质、发布状态、基础学校表单 | 缺少官方档案、申请信息、官方入口、来源核验、公开展示状态和审计备注 |
| `ProgramsPage.vue` | 搜索、学校、层级、基础专业表单、材料/课程/就业维护 | 缺少 46 类类别策略、RM 总学费、费用来源、官方要求原文、公开展示状态、来源状态、核验日期和审计备注 |
| `ContentPage.vue` | 内容块 key、标题、正文编辑 | 缺少内容分类、首页、免责声明、费用说明等静态页内容块规划 |
| `SettingsPage.vue` | 配置、字典、日志 | 字典尚未驱动专业类别、公开状态、来源状态、费用审计状态 |
| 权限和菜单 | 学校、专业、内容、申请、设置 | 缺少官方字段维护、导入校验、公开状态编辑等细分权限 |

### 7.4 用户端支撑差距

- 院校卡片无法显示官方核验、官方来源和静态页学费展示策略。
- 院校详情无法展示完整官方档案、申请周期、申请费用和中国学生要求。
- 专业 7 列列表缺少官方学费、官方学制、开学备注、来源状态和公开展示状态。
- 专业详情弹窗缺少官方来源、核验日期、费用审计和不开放国际学生说明。
- 筛选类别仍受旧 7 类枚举限制，不能覆盖静态页 46 类 ready 类别。

## 8. 后续任务拆解

### 8.1 用户端任务

#### USER-CMS-005 用户端展示字段接入验证

- **范围**：`apps/web`
- **任务说明**：在管理端和后端字段升级后，检查首页、院校库、院校详情、专业列表和专业弹窗是否全部从 API 读取字段。
- **验收标准**：用户端静态页 1:1 还原不依赖前端硬编码官方字段；缺失字段有明确空状态或后台待补提示。
- **测试计划**：运行 `npm run build`；浏览器验证首页、院校详情、专业列表和专业弹窗。

#### USER-CMS-006 公开展示状态与筛选联动

- **范围**：`apps/web`
- **任务说明**：接入后端公开展示规则和字典类别，确保用户端只展示 ready 专业，并使用管理端维护的类别、状态和来源字段。
- **验收标准**：筛选类别来自字典；不开放和隐藏记录不进入主列表；专业详情可展示相关不开放说明。
- **测试计划**：运行 `npm run build`；浏览器验证筛选、专业列表、专业弹窗和空状态。

#### USER-VIS-014 管理端字段驱动的 1:1 视觉验收

- **范围**：`apps/web`
- **任务说明**：字段升级后，对静态 HTML 与 Vue 用户端同视口截图做最终检查，确认数据字段能驱动静态页视觉模块。
- **验收标准**：首页首屏、筛选列表、院校详情、专业列表、专业详情弹窗、对比、规划和登录弹窗与静态 HTML 一致。
- **测试计划**：运行 `npm run build`；使用浏览器截图对比 `1440x1000`、`1180x900`、`900x900`、`390x844`。

### 8.2 后端服务任务

#### API-CMS-005 官方字段实体、DTO 与共享类型升级

- **范围**：`apps/api`、`packages/shared`
- **任务说明**：扩展学校和专业实体、DTO、共享类型和映射，支持静态页官方字段、公开展示状态、来源状态和费用审计状态。
- **验收标准**：管理端保存字段后，公开 API 和管理端 API 均能返回；用户端不需要硬编码补字段。
- **测试计划**：运行 `npm run build`；验证学校和专业保存、读取、公开过滤。

#### API-CMS-006 用户端公开展示规则与缓存失效

- **范围**：`apps/api`
- **任务说明**：实现 `publicDisplayStatus` 展示规则，确保用户端主列表只展示 ready，状态变更后清理 catalog 缓存。
- **验收标准**：ready 专业进入公开列表；不开放、隐藏、待核验记录不进入主列表；管理端仍可查看全部状态。
- **测试计划**：运行 `npm run build`；验证不同状态的公开 API 和管理端 API 返回。

#### API-CMS-007 字典驱动专业类别和状态选项

- **范围**：`apps/api`、`packages/shared`
- **任务说明**：让专业类别、公开展示状态、官方来源状态和费用审计状态从字典读取，并提供给管理端和用户端筛选。
- **验收标准**：新增类别可被管理端选择；用户端筛选只显示启用类别；后端不再被旧 7 类枚举阻断。
- **测试计划**：运行 `npm run build`；验证字典 API、表单保存和筛选返回。

#### API-IMPORT-005 静态页数据 dry-run 解析与校验

- **范围**：`apps/api`
- **任务说明**：提供静态 HTML 数据层解析、去重、字段覆盖、状态统计、来源缺失和费用异常 dry-run。
- **验收标准**：dry-run 报告与静态页统计一致，并能输出管理端工作台所需问题列表。
- **测试计划**：运行 dry-run；运行 `npm run build`。

### 8.3 管理端任务

#### ADMIN-CMS-005 学校官方字段维护表单升级

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：扩展学校管理表单，新增官方档案、申请信息、官方入口、来源核验和公开展示状态字段分组。
- **验收标准**：管理员可新增、编辑和查看静态页院校卡片、院校详情 Hero、官方信息卡和申请信息所需字段；保存后 API 可回显。
- **测试计划**：运行 `npm run build`；浏览器验证新增、编辑、保存、回显和必填校验。

#### ADMIN-CMS-006 专业官方字段维护表单升级

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：扩展专业管理表单，新增 RM 总学费、费用来源、官方学制、官方开学、官方语言、官方学术要求、中国学生要求、认证说明、公开展示状态、来源状态、核验日期和审计备注。
- **验收标准**：管理员可维护专业 7 列列表和专业详情弹窗所需字段；公开展示状态能控制用户端是否展示。
- **测试计划**：运行 `npm run build`；浏览器验证 ready、不开放、隐藏、待核验状态保存和回显。

#### ADMIN-CMS-007 内容块分类与静态页文案维护

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：扩展内容管理，支持首页 Hero、搜索提示、费用说明、申请免责声明、页脚和官方来源说明等内容块分类。
- **验收标准**：内容块可按分类筛选和编辑；保存后用户端首页或说明区域可读取。
- **测试计划**：运行 `npm run build`；验证内容块编辑、保存、缓存清理和 API 回显。

#### ADMIN-DICT-005 专业类别与公开状态字典接入

- **范围**：`apps/admin`、`apps/api`、`packages/shared`
- **任务说明**：把专业类别、公开展示状态、官方来源状态、费用审计状态接入字典管理，并驱动管理端表单选项。
- **验收标准**：管理端不再被 7 个固定专业类别限制；可维护静态页 46 类 ready 类别；禁用字典项不再进入用户端筛选。
- **测试计划**：运行 `npm run build`；验证字典新增、禁用、排序和表单选项更新。

#### ADMIN-IMPORT-005 静态 HTML 导入校验工作台

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：新增静态页导入 dry-run 校验页面，展示统计、字段缺失、重复项、来源核验、费用异常和状态分布。
- **验收标准**：工作台能展示 119 所院校、687 个专业、239 个 ready 专业、6 个不开放专业、3 个隐藏专业和 439 个缺失公开状态记录，并支持筛选与跳转编辑。
- **测试计划**：运行 dry-run；运行 `npm run build`；浏览器验证统计、筛选、问题列表和跳转。

#### ADMIN-ACCESS-005 官方字段权限与操作日志

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：为官方字段维护、公开展示状态、导入校验、导入确认和字典维护新增权限点、菜单项和操作日志。
- **验收标准**：不同角色按权限访问模块；官方字段、状态、来源、费用审计和导入行为均写入日志。
- **测试计划**：运行 `npm run build`；用不同角色验证菜单、按钮权限和日志。

## 9. 验收说明

- 已读取项目 `AGENTS.md`。
- 已读取用户提供的 TASK-005 中文任务页内容、PRD Context 和 Technical Design Context。
- 已读取并分析静态 HTML：`D:\mydev\StudyMY_UM_v58_na_display_tidy.html`。
- 已结合旧系统：`D:\mydev\study-malaysia`。
- 已核对 `packages/shared/src/index.ts`、`apps/api/src/db/entities.ts`、`apps/api/src/common/mappers.ts`、`apps/api/src/admin/admin.controller.ts`、`apps/api/src/admin/admin-cms.service.ts`、`apps/admin/src/pages/UniversitiesPage.vue`、`apps/admin/src/pages/ProgramsPage.vue`、`apps/admin/src/pages/ContentPage.vue`、`apps/admin/src/pages/SettingsPage.vue`、`apps/api/src/db/admin-seed.ts`、`apps/api/src/common/admin-permissions.ts` 和 `apps/api/src/admin/admin-log.service.ts`。
- 已产出中文 PRD、功能清单、视觉规范、旧系统差距分析和按用户端、后端服务、管理端拆分的后续任务项。
- 已运行 `npm run build`，API、用户端、管理端和 shared workspace 构建通过；管理端存在既有 chunk 大小警告，不阻塞本任务。
- 本任务未修改 `apps/web`、`apps/api`、`apps/admin` 的业务实现文件。
- 本任务是中文规划文档任务，未进行浏览器 UI 验证；后续用户端实现任务必须按静态 HTML 做 1:1 截图对比。
- 当前目录 `D:\mydev\study-malaysia` 不是 Git 仓库，无法生成本地 commit；该问题不可由本任务的中文文档或业务代码修复，本轮通过不执行 commit 并在结构化结果中明确说明来规避。
