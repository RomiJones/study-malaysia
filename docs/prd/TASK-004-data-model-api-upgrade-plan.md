# TASK-004 院校与专业数据模型及 API 升级方案

## 1. 文档信息

- **任务编号**：TASK-004
- **任务标题**：院校与专业数据模型及 API 升级
- **运行编号**：TASK-004-2026-05-21T21-56-01-152Z
- **静态页面路径**：`D:\mydev\StudyMY_UM_v58_na_display_tidy.html`
- **旧系统路径**：`D:\mydev\study-malaysia`
- **文档定位**：本文件只产出中文 PRD、功能清单、视觉规范、旧系统差距分析和后续任务拆解。
- **范围限制**：本任务不修改 `apps/web`、`apps/api`、`apps/admin` 的业务实现文件，不创建迁移，不导入数据，不扩展运行时接口。
- **事实来源说明**：Notion 是中文项目文档和任务管理来源，不是业务数据库；运行时业务数据应落到 MySQL、NestJS API、Vue 前端状态和管理端维护流程。
- **Notion 更新说明**：本次通过 Notion 搜索 `TASK-004 院校与专业数据模型及 API 升级` 和 `院校与专业数据模型`，未定位到可安全更新的 TASK-004 页面，因此只更新本地中文文档与本地 Notion 快照。

## 2. 结论摘要

静态 HTML 不只是视觉稿，也包含一套已经整理过的 UM 官方数据层、公开展示规则和用户端交互状态。当前旧系统已经有 Vue 用户端、NestJS API、TypeORM/MySQL 实体、Element Plus 管理端和共享类型，但数据契约仍停留在演示级模型：院校和专业以四语言展示、CNY 年学费、基础 IELTS/GPA、基础材料和 `isPublished` 为主，无法支撑静态页中的官方来源、RM 总学费、核验日期、公开展示状态、不开放国际学生说明、审计备注、专业直达弹窗、搜索建议和管理端官方字段维护。

TASK-004 后续实现应先升级共享类型和后端实体，再扩展管理端维护能力，最后让用户端按静态 HTML 1:1 还原时不再依赖硬编码数据。用户端页面样式必须以静态 HTML 为基准，不能以当前旧系统用户端样式作为最终标准。

## 3. 静态 HTML 分析

### 3.1 数据层规模

从 `D:\mydev\StudyMY_UM_v58_na_display_tidy.html` 中提取 `universitiesBase` 后得到以下结构：

| 项目 | 结果 |
| --- | --- |
| 静态文件字节大小 | 2,515,543 bytes |
| `universitiesBase` 院校数 | 18 |
| 专业总数 | 431 |
| `publicDisplayStatus = ready` 专业数 | 239 |
| `publicDisplayStatus = not-available-for-international` 专业数 | 6 |
| `publicDisplayStatus = hidden-unverified` 专业数 | 3 |
| 缺少 `publicDisplayStatus` 的遗留专业数 | 183 |
| 本科专业数 | 225 |
| 硕士专业数 | 170 |
| 博士专业数 | 36 |
| ready 专业类别数 | 46 |
| 使用 `MYR` 费用币种的专业数 | 155 |

静态页主列表展示规则为：用户端公开专业主列表只展示 `publicDisplayStatus === "ready"`；不开放国际学生、隐藏未核验和缺少公开状态的记录不得进入主列表，但需要在数据层或管理端保留以便追溯。

### 3.2 院校字段清单

静态页院校对象包含以下主要字段：

- 基础识别：`id`、`name`、`nameEn`、`shortName`、`type`、`uniType`、`color`。
- 展示资产：`logo`、`image`、`description`、`highlights`、`facilities`。
- 排名与规模：`qsRank`、`qsAsiaRank`、`qsRankDisplay`、`qsRankSourceNote`、`students`、`intlStudents`、`academicStaff`、`facultiesCount`、`founded`。
- 地理与费用：`location`、`region`、`tuitionRange`、`livingCost`、`livingCostOfficialNote`、`minIELTS`、`acceptNoLanguage`。
- 官方来源：`website`、`officialWebsite`、`studyPortal`、`internationalPage`、`applicationPortal`、`admissionEmail`、`officialProfile`、`officialAuditSummary`。
- 内容审计：`contentAudit`、`postgraduateAudit`。
- 子数据：`programs`。

这些字段要求后端院校模型不仅保存营销展示信息，还必须保存官方来源、官方说明、费用审计和核验摘要。

### 3.3 专业字段清单

静态页专业对象包含以下主要字段：

- 基础识别：`id`、`name`、`nameEn`、`level`、`category`、`faculty`、`facultyZh`、`type`、`mode`、`campus`。
- 学制与入学：`duration`、`durationOfficial`、`officialDuration`、`intake`、`intakeOfficial`、`officialIntake`、`intakeNote`、`officialIntakeNote`、`officialIntakeText`。
- 费用：`tuition`、`tuitionCurrency`、`tuitionOfficialRM`、`officialTuitionMYR`、`tuitionOfficialText`、`officialTuitionText`、`officialTuitionNote`、`officialFeeSourceUrl`、`secondaryOfficialFeeSourceUrl`、`officialFeeAuditStatus`、`officialFeeAuditedAt`、`feeDisplayNote`、`feeRemark`、`feeVerificationNote`。
- 要求：`language`、`englishOfficial`、`officialLanguageRequirement`、`requirements`、`officialAcademicRequirement`、`chinaStudentRequirement`、`chinaStudentEligibility`、`specialRequirementsNote`。
- 材料与内容：`applicationDocs`、`curriculum`、`careers`、`specializations`、`description`、`notes`。
- 来源与审计：`officialUrl`、`officialSourceUrl`、`officialEntryRequirementSourceUrl`、`officialAccreditationSourceUrl`、`sourceUrls`、`sourceStatus`、`officialSourceStatus`、`officialSourceNote`、`sourcePriority`、`sourcePriorityNote`、`verifiedAt`、`officialVerifiedAt`、`lastOfficialAudit`、`auditNote`、`dataAuthority`、`commercialAuditStatus`、`commercialAuditLevel`、`commercialUsePolicy`、`pgAuditStandard`、`translationAuditNote`、`facultyAuditStatus`、`facultyOfficialNote`、`officialNameNote`、`officialNameAuditNote`。
- 展示规则：`publicDisplayStatus`、`publicDisplayNote`、`displayAdmissionStatus`、`displayFeeNote`、`displayStatusNote`、`displayNote`、`listTuitionText`、`reviewReason`。

这些字段要求专业模型从“基础专业卡片”升级为“官方可核验专业档案”。后续实现不应把审计说明塞进通用 `description`，应拆成可维护、可筛选、可追溯的字段。

### 3.4 交互状态与本地持久化

静态页使用以下本地存储键：

- `studymy_favorites`：收藏院校和收藏专业。
- `studymy_compare`：院校对比列表。
- `studymy_profile`：规划画像。
- `studymy_material_progress`：材料进度。
- `studymy_application_tasks`：申请任务。
- `studymy_visa_checklist`：签证清单。
- `studymy_user_auth`：本地登录状态。

静态页应用状态包含：

- 页面状态：`page`、`selectedUni`、`selectedProg`、`homePage`。
- 筛选状态：`search`、`qsRankMax`、`tuitionMin`、`tuitionMax`、`categories`、`levels`、`types`、`acceptNoLanguage`。
- 弹窗状态：`showCalc`、`showRec`、`showAuth`、`authMode`、`mobileMenu`。
- 工具状态：`calcInputs`、`favorites`、`compareList`、`profile`、`materialProgress`、`appTasks`、`visaChecklist`、`userAuth`。

后续 API 设计必须明确未登录 localStorage 与登录后服务端数据的合并策略，避免用户端 1:1 还原时只能依赖本地临时状态。

### 3.5 静态页关键功能函数

静态页脚本包含 86 个函数，其中与本任务相关的核心函数包括：

- 数据与状态：`mergeUniquePrograms`、`filteredUnis`、`getSearchSuggestions`、`getRecommendations`。
- 收藏与对比：`isFavUni`、`isFavProg`、`inCompare`、`toggleFavUni`、`toggleFavProg`、`toggleCompare`。
- 渲染：`renderHome`、`renderUniCard`、`renderPagination`、`renderUniDetail`、`renderUniOverview`、`renderUniProgramsForLevel`、`renderProgModal`、`renderFavorites`、`renderCompare`、`renderPlanner`、`renderCalcModal`、`renderRecModal`、`renderAuthModal`。
- 筛选搜索：`setFilter`、`toggleCatFilter`、`toggleLevelFilter`、`toggleTypeFilter`、`toggleNoLang`、`resetFilters`、`clearFilter`、`onSearchInput`、`onSearchKey`、`doSearch`。
- 工具弹窗：`openCalc`、`closeCalc`、`updateCalc`、`openAuth`、`closeAuth`、`doAuth`、`toggleMobile`。

这说明后续后端 API 不能只返回列表，还必须支持搜索建议、筛选聚合、专业直达、收藏、对比、规划、费用估算和推荐。

## 4. TASK-004 PRD

### 4.1 背景

旧系统已有院校、专业、收藏、规划和后台管理基础能力，但数据模型无法覆盖静态 HTML 中已经校验过的 UM 官方数据。当前任务的目标不是立即改业务代码，而是把后续升级的后端数据模型、API、管理端维护能力和用户端依赖字段拆清楚，形成可执行中文任务项。

### 4.2 目标

- 定义院校与专业升级后的数据模型方向，使其覆盖静态页展示所需字段。
- 明确用户端搜索、筛选、详情、对比、收藏、规划、费用估算和推荐所需 API。
- 明确管理端可维护的核心字段、官方来源、公开展示状态和审计信息。
- 明确用户端视觉还原对数据字段的依赖，确保后续 Vue 页面以静态 HTML 为 1:1 基准。
- 将后续任务按用户端、后端服务、管理端拆分为中文任务项。

### 4.3 非目标

- 本任务不修改 `apps/web`、`apps/api`、`apps/admin` 的业务实现文件。
- 本任务不创建数据库迁移、不导入静态 HTML 数据、不修改种子数据。
- 本任务不做浏览器 UI 验证，因为当前没有实现用户端视觉改造。
- 本任务不把 Notion 当业务数据库，也不把静态 HTML 直接作为运行时数据库。

## 5. 功能清单

### 5.1 后端服务功能清单

#### 5.1.1 院校模型能力

- 支持基础身份字段：slug、code、中文名、英文名、简称、类型、城市、地区、国家。
- 支持视觉字段：Logo、封面图、品牌色、简介、亮点、设施。
- 支持排名与规模：QS 排名、QS 亚洲排名、学生数、国际生数、学院数、教职工数、创立年份。
- 支持费用字段：学费范围、生活成本、费用币种、官方费用说明。
- 支持官方档案：官网、学习入口、国际学生页、申请入口、联系邮箱、官方档案 JSON。
- 支持申请字段：申请周期、申请费用、申请材料、中国学生要求、申请说明。
- 支持核验字段：官方来源 URL、核验日期、核验状态、审计摘要、来源备注。
- 支持展示规则：是否发布、是否用户端可见、是否参与筛选统计。

#### 5.1.2 专业模型能力

- 支持基础字段：所属院校、slug、code、中文名、英文名、学历层级、类别、学院、学院中文名。
- 支持学制字段：展示学制、官方学制、学制备注、学习模式、校区。
- 支持费用字段：官方总学费 RM、展示学费文本、费用币种、费用备注、学费来源 URL、二级来源 URL、费用审计状态、费用核验时间。
- 支持入学字段：展示开学时间、官方开学时间、开学备注、申请周期说明。
- 支持要求字段：语言要求结构化字段、官方语言要求原文、学术要求结构化字段、官方学术要求原文、中国学生要求、特殊要求。
- 支持材料字段：申请材料、课程结构、职业方向、方向标签、认证说明。
- 支持来源字段：官方专业页 URL、官方入学要求 URL、官方认证 URL、多个来源 URL、来源优先级、来源状态、核验日期、审计备注。
- 支持展示字段：公开展示状态、公开展示备注、不开放国际学生说明、列表学费文本、详情展示说明。
- 支持管理字段：翻译审计、学院名审计、商业展示策略、研究生审计标准。

#### 5.1.3 搜索与筛选 API

- 院校列表 API 支持搜索、院校类型、学历层级、QS 排名上限、预算范围、专业类别、免语言开关、公开展示状态和分页。
- 专业列表 API 支持院校、学历层级、类别、预算、开学时间、公开展示状态和来源状态。
- 搜索建议 API 支持院校、专业、城市混合搜索，返回命中类型、标题、副标题、高亮字段、目标院校 slug、目标专业 id。
- 筛选聚合 API 返回可选类别、层级、院校类型、QS 档位、预算范围、结果数量和活跃筛选摘要。
- 院校详情 API 返回详情 Hero、官方信息卡、申请信息、来源核验说明和按学历分组的 ready 专业列表。
- 专业详情 API 返回弹窗所需完整官方字段，并支持从院校详情按专业 id 打开。

#### 5.1.4 用户状态与工具 API

- 收藏 API 支持院校和专业收藏、取消收藏、批量同步、登录后合并 localStorage。
- 对比 API 明确最多 4 所院校，支持新增、移除、清空和登录后持久化。
- 规划 API 支持画像、材料、申请任务、申请组合分层、签证清单、推荐结果和进度统计。
- 费用估算 API 支持静态页手动输入，也支持基于官方专业总学费和生活成本估算。
- 智能推荐 API 支持学历、类别、预算、GPA、IELTS、免语言偏好、公开展示状态和官方来源状态过滤。

#### 5.1.5 导入与校验能力

- 支持静态 HTML 数据提取 dry-run，不直接写入业务库。
- 输出院校数、专业数、ready 数、不开放数、隐藏数、缺失状态数、缺失官方来源数、重复专业数。
- 输出字段缺失报告、费用异常报告、来源状态报告、公开展示状态报告。
- 支持后续管理端导入校验工作台读取 dry-run 结果。

### 5.2 管理端功能清单

- 学校管理需要新增官方档案分组、申请信息分组、官方来源分组、核验审计分组。
- 专业管理需要新增官方费用分组、官方要求分组、官方来源分组、公开展示状态分组、审计备注分组。
- 字典管理需要支持专业类别、公开展示状态、来源状态、费用审计状态、申请任务分层。
- 导入校验工作台需要展示 dry-run 统计、问题列表、筛选、跳转编辑。
- 权限与菜单需要新增官方字段维护、发布状态维护、导入校验和审计日志权限。
- 操作日志需要记录官方字段变更、公开状态变更、导入校验执行、导入确认和发布行为。

### 5.3 用户端功能清单

用户端不在 TASK-004 中实现，但后端和管理端必须为以下功能提供数据：

- 首页 Hero、导航、搜索入口、搜索建议、统计栏。
- 院校库、260px sticky 筛选栏、活跃筛选标签、横向院校卡片、分页。
- 院校详情深色 Hero、官方档案、申请信息、来源说明、专业 7 列列表。
- 专业详情弹窗、费用估算弹窗、智能推荐弹窗、登录弹窗。
- 收藏、对比、规划、会员中心、浮动按钮和移动端布局。

## 6. 视觉规范

后续用户端页面样式必须以静态 HTML 为基准，并优先遵守 `docs/prd/TASK-002-static-page-visual-baseline.md`。TASK-004 的 API 与字段设计必须能驱动这些视觉模块，不允许通过前端硬编码补齐关键展示字段。

### 6.1 全局视觉 token

- 主墨色：`#0C0E1A`
- 辅助墨色：`#3A3D52`
- 弱文本：`#8A8EA8`
- 纸色背景：`#FAFAF8`
- 浅纸色块：`#F2F2EE`
- 边框：`#E4E4DC`
- 金色：`#C8A84B`
- 青绿：`#1B7A72`
- 红色：`#C43830`
- 蓝色：`#1E4FA3`
- 大圆角：`16px`
- 小圆角：`10px`
- 默认阴影：`0 2px 12px rgba(12,14,26,.07)`
- 强阴影：`0 12px 40px rgba(12,14,26,.12)`

### 6.2 布局要求

- 首页必须还原深墨色 Hero、金色强调、噪声纹理、点阵背景、居中搜索框和统计栏。
- 院校库必须还原 `260px 1fr` 桌面主网格、左侧 sticky 筛选栏、预算滑杆和活跃筛选条。
- 院校卡片必须支持横向布局、QS 浮层、标签、收藏和对比按钮。
- 专业列表必须使用静态页 7 列 CSS Grid；1180px 以下横向滚动，760px 以下转为块状字段。
- 专业详情、费用估算、智能推荐、登录弹窗必须遵守桌面居中、移动贴底规则。
- 响应式断点至少覆盖 `1180px`、`900px`、`768px`、`760px`、`700px`、`600px`。

### 6.3 对 API 的视觉依赖

- 院校卡片需要 `qsRank`、`logo`、`image`、`shortName`、`name`、`nameEn`、`description`、`tags`、`tuitionRange`、`programCount`。
- 院校详情 Hero 需要官方名称、排名、地点、官网、申请入口、官方核验状态和统计信息。
- 专业 7 列列表需要专业中文名、英文名、学院中文名、学历层级、学制、学费展示文本、语言要求、开学时间和详情入口 id。
- 专业弹窗需要官方费用、学制、开学、语言、学术要求、申请材料、课程、职业方向、官方来源、核验日期和审计备注。
- 对比表需要统一字段标签和值，避免前端按不同模型临时拼接。

## 7. 旧系统差距分析

### 7.1 共享类型差距

| 当前能力 | 静态页要求 | 差距 |
| --- | --- | --- |
| `DegreeLevel` 为 `bachelor`、`master`、`phd` | 静态页用中文层级展示，本质仍是本科、硕士、博士 | 需要明确 API 内部枚举与用户端中文展示映射 |
| `ProgramCategory` 固定 7 类 | ready 专业类别 46 类 | 需要改为字典驱动或扩展为可维护类别 |
| `UniversityListItem` 基础院校字段 | 官方档案、申请入口、申请周期、官方来源和核验说明 | 需要新增官方信息结构 |
| `ProgramListItem` 基础专业字段 | RM 总学费、官方来源、公开展示状态、审计备注 | 需要新增官方专业详情结构 |
| 收藏与规划类型存在 | 对比、同步、申请任务分层、费用估算展示字段不足 | 需要新增状态同步与展示响应类型 |

### 7.2 后端实体差距

| 实体 | 当前字段 | 缺失字段 |
| --- | --- | --- |
| `UniversityEntity` | slug、code、name、shortName、logoUrl、imageUrl、qsRank、location、ownership、institutionType、foundedYear、students、intlStudents、description、website、admissionEmail、CNY 学费、生活费、IELTS、facilities、highlights、programCount、isPublished | 官方英文名、官方地址、国际学生页、申请入口、官方档案、申请周期、申请费用、申请材料、中国学生要求、费用官方说明、官方来源 URL、核验日期、审计摘要、公开展示规则 |
| `ProgramEntity` | universityId、slug、code、name、level、category、faculty、durationYears、annualTuitionCny、intakeMonths、languageRequirement、requirement、applicationDocs、curriculum、careers、specializations、description、isPublished | RM 总学费、费用币种、官方学费来源、官方学制、开学备注、官方语言原文、官方学术要求、中国学生要求、认证说明、官方专业页、核验日期、来源状态、公开展示状态、不开放说明、审计备注 |
| `FavoriteEntity` | userId、favoriteType、targetId | 批量同步、未登录合并策略 | 需要新增同步 API 或约定 |
| `PlannerProfileEntity` 和 `PlannerTaskEntity` | 基础画像、材料、任务和签证 | 任务分层、申请组合说明、官方截止日期、推荐卡解释字段不足 | 需要扩展响应和可能的实体字段 |
| 字典与配置 | 通用 `DictionaryItemEntity`、`SystemConfigEntity` | 专业类别和公开状态尚未接入业务模型 | 需要接入管理端和 API 查询 |

### 7.3 API 差距

| API | 当前能力 | 缺口 |
| --- | --- | --- |
| `GET /universities/meta/home` | 返回首页基础统计和内容块 | 缺少静态页统计策略、ready 专业统计、官方核验摘要 |
| `GET /universities` | 支持搜索、类别、层级、办学性质、免语言、QS、学费上限 | 缺少预算下限、公开展示状态、筛选聚合、活跃筛选摘要、城市建议 |
| `GET /universities/:slug` | 返回院校详情和已发布专业 | 缺少官方档案、申请信息、来源说明和专业弹窗所需字段 |
| `GET /programs` | 返回所有已发布专业 | 缺少分页、筛选、公开状态过滤、官方字段 |
| `GET /programs/:slug` | 返回单个专业与院校 | 缺少弹窗完整字段和按 id 直达能力 |
| `GET /programs/recommendations` | 基础推荐 | 固定 7 类，缺少官方状态过滤、RM 预算和推荐解释字段 |
| `GET /programs/cost-estimate/:id` | 按专业估算 CNY 年费用 | 缺少静态页手动输入、RM 总学费和杂费策略 |
| `favorites` API | 支持登录后读取、切换、删除 | 缺少本地收藏批量同步和合并 |
| `planner` API | 支持画像、材料、任务、签证 | 缺少静态页申请任务分层、推荐卡和官方字段 |
| 管理端 API | 支持学校、专业、内容、申请、配置、字典、日志 | DTO 和实体没有官方来源、公开状态和导入校验字段 |

### 7.4 管理端差距

| 页面 | 当前能力 | 缺口 |
| --- | --- | --- |
| `UniversitiesPage.vue` | 维护基础学校资料、四语言内容、图片、排名、CNY 学费、IELTS、发布状态 | 缺少官方档案、国际学生页、申请入口、申请周期、申请费用、官方材料、来源 URL、核验日期、审计摘要 |
| `ProgramsPage.vue` | 维护学校、code、slug、层级、7 类分类、四语言名称、学院、材料、课程、就业、学制、CNY 年学费、IELTS、GPA、入学月份、发布状态 | 缺少 46 类专业类别维护、RM 总学费、费用来源、官方要求原文、公开展示状态、来源状态、核验日期、审计备注 |
| `SettingsPage.vue` | 配置、字典、日志 | 字典未驱动专业类别和公开状态 |
| 权限菜单 | 学校、专业、内容、申请、设置 | 缺少导入校验、官方字段维护和发布规则权限 |

### 7.5 种子数据差距

旧系统 `seed-data.ts` 中存在 50 个 `slug` 字段，其中包含院校和专业记录；`seed-um-extra.ts` 额外有 2 个 `slug` 字段。当前种子数据以演示数据为主，静态页则包含 18 所院校和 431 个专业记录。后续导入不能直接覆盖当前业务库，应先 dry-run 校验，再由管理端确认导入或人工维护。

## 8. 数据模型升级方案

### 8.1 共享类型建议

新增或调整以下共享类型：

- `PublicDisplayStatus`：`ready`、`not-available-for-international`、`needs-review`、`hidden-unverified`、`archived`。
- `OfficialSourceStatus`：`official-verified`、`official-page-verified-international-not-available`、`needs-review`、`source-conflict`、`missing-source`、`hidden-duplicate-superseded`。
- `TuitionCurrency`：`MYR`、`CNY`、`USD`、`UNKNOWN`。
- `FeeAuditStatus`：`matched-official`、`conflict`、`pending-review`、`not-published`。
- `ApplicationTier`：`reach`、`target`、`safe`。
- `ProgramCategoryOption`：从固定枚举升级为字典项，包含 code、中文名、英文名、排序、是否启用、是否用户端显示。
- `OfficialSourceLink`：包含 title、url、sourceType、verifiedAt、note。
- `TuitionInfo`：包含 amount、currency、displayText、officialAmountMYR、sourceUrl、auditStatus、note。
- `ProgramOfficialProfile`：包含官方学制、官方开学、官方语言、官方学术要求、中国学生要求、认证说明、来源状态、公开展示状态。
- `UniversityOfficialProfile`：包含官方官网、国际学生页、申请入口、申请周期、申请费用、官方材料、来源状态、核验摘要。

### 8.2 后端实体建议

优先采取“核心字段列化 + 扩展 JSON”的折中方案，避免第一轮升级拆出过多表导致管理端和 API 改造成本过高。

#### `universities` 建议新增字段

- `nameEnOfficial`：官方英文名。
- `officialWebsite`：官方官网。
- `studyPortalUrl`：学习入口。
- `internationalPageUrl`：国际学生页。
- `applicationPortalUrl`：申请入口。
- `officialAddress`：官方地址。
- `applicationPeriods`：JSON，申请周期。
- `applicationFees`：JSON，申请费用。
- `applicationDocuments`：JSON，官方材料。
- `chinaStudentRequirements`：JSON，中国学生要求。
- `officialProfile`：JSON，官方档案。
- `officialSources`：JSON，官方来源链接。
- `officialVerifiedAt`：核验日期。
- `officialSourceStatus`：来源状态。
- `officialAuditSummary`：审计摘要。
- `publicDisplayStatus`：公开展示状态。

#### `programs` 建议新增字段

- `nameEnOfficial`：官方英文名。
- `facultyZh`：学院中文名。
- `studyMode`：学习模式。
- `campus`：校区。
- `durationOfficial`：官方学制文本。
- `tuitionAmount`：费用数值。
- `tuitionCurrency`：费用币种。
- `tuitionDisplay`：列表展示费用文本。
- `officialTuitionMYR`：官方 RM 总学费。
- `officialFeeSourceUrl`：官方费用来源。
- `secondaryOfficialFeeSourceUrl`：二级费用来源。
- `officialFeeAuditStatus`：费用审计状态。
- `officialFeeAuditedAt`：费用审计时间。
- `officialIntake`：官方开学。
- `officialIntakeNote`：开学备注。
- `officialLanguageRequirement`：官方语言要求原文。
- `officialAcademicRequirement`：官方学术要求原文。
- `chinaStudentRequirement`：中国学生要求。
- `officialAccreditationNote`：认证说明。
- `officialSourceUrl`：官方专业页。
- `officialEntryRequirementSourceUrl`：官方入学要求来源。
- `sourceUrls`：多个来源 URL。
- `officialVerifiedAt`：核验日期。
- `officialSourceStatus`：官方来源状态。
- `publicDisplayStatus`：公开展示状态。
- `publicDisplayNote`：公开展示备注。
- `reviewReason`：待核验原因。
- `auditNote`：审计备注。

### 8.3 展示规则建议

- 用户端主院校列表只展示 `publicDisplayStatus = ready` 或旧数据 `isPublished = true` 且院校可公开。
- 用户端主专业列表只展示 `publicDisplayStatus = ready`。
- `not-available-for-international` 不进入主列表，但可在管理端和详情内部说明中保留。
- `hidden-unverified` 和缺失公开状态的记录不进入公开 API。
- 管理端必须允许查看所有状态，并显示字段缺失和来源核验问题。
- API 响应中保留 `isPublished` 兼容旧系统，但新增 `publicDisplayStatus` 作为用户端展示事实源。

## 9. API 升级方案

### 9.1 用户端公开 API

| 方法 | 路径 | 用途 | 关键响应 |
| --- | --- | --- | --- |
| `GET` | `/universities/meta/home` | 首页统计和 Hero 数据 | 院校数、ready 专业数、best QS、官方核验摘要、内容块 |
| `GET` | `/search/suggestions` | 混合搜索建议 | type、title、subtitle、highlight、universitySlug、programId |
| `GET` | `/universities` | 院校列表和筛选 | items、pagination、facets、activeFilters |
| `GET` | `/universities/:slug` | 院校详情 | officialProfile、applicationInfo、programGroups、sources |
| `GET` | `/programs` | 专业列表 | items、pagination、facets |
| `GET` | `/programs/:id` | 专业弹窗详情 | tuitionInfo、requirements、materials、sources、audit |
| `GET` | `/programs/:slug` | 专业 SEO/直达详情 | 与 id 详情等价 |
| `POST` | `/favorites/sync` | 登录后合并本地收藏 | merged favorites |
| `GET` | `/favorites` | 收藏列表 | universities、programs |
| `POST` | `/compare/sync` | 登录后合并本地对比 | 最多 4 所院校 |
| `GET` | `/compare` | 对比列表 | compareItems、fields |
| `GET` | `/planner` | 规划面板 | profile、materials、tasks、visa、recommendations、stats |
| `PATCH` | `/planner/profile` | 更新画像 | profile、recommendations |
| `PATCH` | `/planner/materials/:key` | 更新材料状态 | materials、stats |
| `POST` | `/planner/tasks` | 添加申请任务 | task |
| `PATCH` | `/planner/tasks/:id/advance` | 推进任务阶段 | task |
| `PATCH` | `/planner/visa` | 更新签证清单 | visaChecklist |
| `POST` | `/tools/cost-estimate` | 费用估算 | total、breakdown、currency |
| `GET` | `/programs/recommendations` | 智能推荐 | score、reasons、university、program、cost |

### 9.2 管理端 API

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/admin/universities` | 学校列表，支持公开状态、来源状态、核验状态筛选 |
| `POST` | `/admin/universities` | 保存基础字段和官方字段 |
| `GET` | `/admin/programs` | 专业列表，支持学校、层级、类别、公开状态、来源状态、费用审计状态筛选 |
| `POST` | `/admin/programs` | 保存基础字段、官方字段和展示状态 |
| `GET` | `/admin/import/static-html/dry-run` | 静态 HTML 导入 dry-run |
| `POST` | `/admin/import/static-html/confirm` | 后续确认导入，第一阶段可暂缓实现 |
| `GET` | `/admin/settings/dictionaries?dictType=program_category` | 专业类别字典 |
| `GET` | `/admin/settings/dictionaries?dictType=public_display_status` | 公开展示状态字典 |
| `GET` | `/admin/settings/dictionaries?dictType=official_source_status` | 官方来源状态字典 |
| `GET` | `/admin/settings/logs` | 官方字段和导入行为日志 |

## 10. 后续中文任务项

### 10.1 后端服务任务项

#### API-DATA-004 共享类型与字典驱动专业类别升级

- **范围**：`packages/shared`、`apps/api`
- **任务说明**：新增公开展示状态、官方来源状态、费用币种、费用审计状态、申请任务分层、官方来源链接和费用信息类型；把专业类别从 7 个固定枚举升级为可维护字典策略。
- **验收标准**：共享类型能表达静态页 46 类 ready 专业类别、官方费用、官方来源、公开展示状态和推荐结果；`npm run build` 通过。
- **测试计划**：运行 `npm run build`；补充类型编译验证。

#### API-DATA-005 院校官方档案实体与映射升级

- **范围**：`apps/api`
- **任务说明**：扩展院校实体、映射和响应结构，支持官网、学习入口、国际学生页、申请入口、申请周期、申请费用、官方材料、官方档案、核验摘要和公开展示状态。
- **验收标准**：`GET /universities` 与 `GET /universities/:slug` 能返回静态页院校卡片、详情 Hero、官方信息卡和申请信息所需字段。
- **测试计划**：运行 `npm run build`；验证示例院校响应字段。

#### API-DATA-006 专业官方档案实体与公开展示规则升级

- **范围**：`apps/api`
- **任务说明**：扩展专业实体、映射和响应结构，支持 RM 总学费、费用来源、官方学制、官方开学、官方语言、官方学术要求、中国学生要求、公开展示状态、来源状态和审计备注。
- **验收标准**：主专业列表只返回 ready 专业；专业详情返回弹窗所需全部官方字段；不开放和隐藏记录不进入公开主列表。
- **测试计划**：运行 `npm run build`；验证 ready、not-available、hidden 三类状态响应。

#### API-SEARCH-002 搜索建议、筛选聚合和专业直达 API

- **范围**：`apps/api`
- **任务说明**：新增院校、专业、城市混合搜索建议；院校列表返回 facets、activeFilters 和专业直达信息；专业详情支持按 id 打开弹窗。
- **验收标准**：用户端可以通过 API 完成搜索建议浮层、命中高亮、回车搜索、院校直达、专业直达和组合筛选。
- **测试计划**：运行 `npm run build`；验证关键词、空结果、组合筛选、专业直达。

#### API-USER-002 收藏、对比、规划和工具状态同步

- **范围**：`apps/api`
- **任务说明**：明确并实现未登录 localStorage 与登录后服务端状态合并；新增或扩展对比同步；扩展规划、费用估算和推荐响应字段。
- **验收标准**：登录后收藏、对比、画像、材料、申请任务、签证状态可持久化；对比最多 4 所；费用估算支持手动输入和官方专业字段。
- **测试计划**：运行 `npm run build`；验证新增、移除、清空、合并、推进、估算。

#### API-IMPORT-001 静态 HTML 数据导入 dry-run 与校验报告

- **范围**：`apps/api`
- **任务说明**：提供静态 HTML 数据层提取、去重、字段校验和状态统计 dry-run，不直接写入业务库。
- **验收标准**：报告展示院校数、专业数、ready 数、不开放数、隐藏数、缺失公开状态数、缺失官方来源数、重复专业和字段异常。
- **测试计划**：运行 dry-run；运行 `npm run build`。

### 10.2 管理端任务项

#### ADMIN-DATA-004 学校官方字段维护表单

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：扩展学校管理表单，新增官方档案、申请信息、官方来源、核验审计字段分组。
- **验收标准**：管理端可维护静态页院校卡片、详情 Hero、官方信息卡和申请信息所需字段；保存后 API 可回显。
- **测试计划**：运行 `npm run build`；浏览器验证新增、编辑、保存、回显。

#### ADMIN-DATA-005 专业官方字段维护表单

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：扩展专业管理表单，新增 RM 总学费、费用来源、官方学制、官方要求、公开展示状态、来源状态、核验日期和审计备注。
- **验收标准**：管理端可维护专业 7 列列表和专业详情弹窗所需字段；公开展示状态可控制用户端显示。
- **测试计划**：运行 `npm run build`；浏览器验证 ready、not-available、hidden 状态保存和回显。

#### ADMIN-DICT-001 专业类别与状态字典维护

- **范围**：`apps/admin`、`apps/api`、`packages/shared`
- **任务说明**：把专业类别、公开展示状态、官方来源状态、费用审计状态接入字典管理，并供管理端表单和 API 查询使用。
- **验收标准**：管理端不再被 7 个固定专业类别限制；用户端筛选类别来自启用字典项。
- **测试计划**：运行 `npm run build`；验证字典新增、禁用、排序和表单选项。

#### ADMIN-IMPORT-001 静态 HTML 导入校验工作台

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：新增导入校验页面，展示 dry-run 统计、字段缺失、重复项、状态分布、来源核验问题，并支持筛选和跳转编辑。
- **验收标准**：工作台能展示 18 所院校、431 个专业、239 个 ready 专业、6 个不开放专业、3 个隐藏专业和 183 个缺失公开状态记录的校验结果。
- **测试计划**：运行 dry-run；运行 `npm run build`；浏览器验证统计、筛选和跳转。

#### ADMIN-ACCESS-002 官方字段、导入和发布规则权限日志

- **范围**：`apps/admin`、`apps/api`
- **任务说明**：为官方字段维护、公开展示状态、导入校验、导入确认和发布规则新增菜单、权限点和操作日志。
- **验收标准**：不同角色按权限访问模块；官方字段变更、状态变更、导入校验和发布操作均写入日志。
- **测试计划**：运行 `npm run build`；使用不同角色验证访问控制和日志。

### 10.3 用户端任务项

#### USER-API-001 用户端 catalog 数据接入

- **范围**：`apps/web`
- **任务说明**：把首页、院校库、院校详情和专业弹窗的数据读取切换到升级后的 API 响应，移除对旧字段或前端硬编码补字段的依赖。
- **验收标准**：用户端所有展示字段均来自 API；院校卡片、详情 Hero、专业 7 列列表和专业弹窗能消费官方字段。
- **测试计划**：运行 `npm run build`；浏览器验证首页、院校库、院校详情、专业弹窗。

#### USER-API-002 搜索、筛选、收藏和对比 API 接入

- **范围**：`apps/web`
- **任务说明**：接入搜索建议、筛选聚合、收藏同步和对比同步 API，保留未登录本地状态并在登录后合并。
- **验收标准**：搜索建议支持院校/专业/城市混合结果；筛选变化能刷新列表和活跃标签；收藏与对比登录后可同步；对比最多 4 所。
- **测试计划**：运行 `npm run build`；浏览器验证搜索、筛选、收藏、对比和登录后同步。

#### USER-API-003 规划、费用估算和智能推荐 API 接入

- **范围**：`apps/web`
- **任务说明**：接入升级后的规划、费用估算和推荐 API，让申请规划五标签页、费用弹窗和推荐弹窗使用后端数据。
- **验收标准**：画像、材料、申请任务、签证清单、费用估算和推荐结果可持久化或按规则计算；展示字段与静态页一致。
- **测试计划**：运行 `npm run build`；浏览器验证规划、费用估算、推荐和移动端弹窗。

#### USER-VIS-007 静态 HTML 视觉 1:1 还原总验收

- **范围**：`apps/web`
- **任务说明**：在 API 接入后，对首页、筛选列表、院校详情、专业列表、专业详情弹窗、收藏、对比、规划、费用估算、推荐、登录和移动导航做静态 HTML 同视口截图对比。
- **验收标准**：用户端页面样式以静态 HTML 为基准；字体、颜色、间距、圆角、阴影、卡片、按钮、弹窗、筛选区、对比表格和响应式表现 1:1 一致。
- **测试计划**：运行 `npm run build`；使用浏览器截图对比 `1440x1000`、`1180x900`、`900x900`、`390x844`。

## 11. 验收说明

本 TASK-004 文档满足以下验收点：

- 已读取并分析静态 HTML：`D:\mydev\StudyMY_UM_v58_na_display_tidy.html`。
- 已结合旧系统路径：`D:\mydev\study-malaysia`。
- 已明确后端数据模型需要覆盖静态页面展示字段。
- 已明确用户端搜索、筛选、详情、对比、收藏和规划接口方案。
- 已明确管理端维护核心字段和官方来源信息的后续任务。
- 已按后端服务、管理端、用户端拆分中文任务项。
- 已明确用户端页面样式必须以静态 HTML 为基准，后续实现必须 1:1 一致。
- 已运行 `npm run build`，API、用户端、管理端和共享包构建通过；管理端存在现有大 chunk 警告，不阻塞本任务。
- 本任务未修改 `apps/web`、`apps/api`、`apps/admin` 的实现文件。
