# TASK-006 用户端页面结构与静态样式 1:1 还原规划

## 1. 文档信息

- **任务编号**：TASK-006
- **任务标题**：用户端页面结构与静态样式 1:1 还原
- **运行编号**：TASK-006-2026-05-21T22-05-44-096Z
- **静态页面路径**：`D:\mydev\StudyMY_UM_v58_na_display_tidy.html`
- **旧系统路径**：`D:\mydev\study-malaysia`
- **文档定位**：本文件只产出中文 PRD、功能清单、视觉规范、旧系统差距分析和后续任务拆解。
- **范围限制**：本任务不修改 `apps/web`、`apps/api`、`apps/admin` 的业务实现文件，不导入静态页数据，不启动业务改造。
- **事实来源说明**：Notion 是中文项目文档和任务管理来源，不是业务数据库；运行时业务数据必须进入 MySQL、NestJS API、Vue 用户端状态和管理端维护流程。
- **Notion 更新说明**：已通过 Notion 搜索 `TASK-006 用户端页面结构与静态样式 1:1 还原` 和 `study-malaysia TASK-006`，未定位到可安全更新的项目任务页；本次只更新本地中文文档与本地 Notion 快照。

## 2. 结论摘要

TASK-006 不应直接进入 Vue 代码实现。静态 HTML 已经提供完整用户端视觉基准、页面结构、交互状态、数据字段和响应式规则；旧系统虽然已有 Vue 3 用户端、NestJS API、Element Plus 管理端和共享类型，但当前用户端仍是旧视觉系统，不能作为最终 UI 标准。

后续真正实施用户端 1:1 还原时，必须以静态 HTML 为唯一视觉基准，优先复用或等价实现静态页的 CSS token、字体、深墨色 Hero、64px sticky 导航、260px sticky 筛选栏、横向院校卡片、7 列专业 grid、桌面居中/移动贴底弹窗、右下浮动按钮和移动导航抽屉。旧系统当前的米色/绿色主视觉、32px 大圆角、营销式卡片布局、独立专业详情页和本地状态散落逻辑都需要按静态页重构。

从静态 HTML 独立核验得到：`universitiesBase` 有 18 所院校，`universitiesSupplement` 有 108 所院校；按页面自身 `dedupeUniversities` 与 `mergeUniquePrograms` 逻辑合并后为 119 所院校、687 个专业，其中 `publicDisplayStatus = ready` 的可公开展示专业为 239 个，本科 74 个、硕士 136 个、博士 29 个，ready 专业类别 46 类。静态页内联 CSS 有 18 个根变量、10 条媒体查询、5 个关键动画和大量页面级选择器，脚本包含 86 个函数，覆盖搜索、筛选、收藏、对比、规划、费用估算、推荐和登录。

## 3. PRD

### 3.1 背景

项目目标是把静态 HTML 中已经验证过的用户端展示和交互迁移到 StudyMY 旧系统。TASK-006 的强制要求是先完成文档化拆解，不修改业务代码。后续实现应在后端数据契约和管理端维护能力补齐后，再对用户端做 1:1 视觉还原与截图验收。

### 3.2 目标

- 明确用户端要还原的页面结构、组件边界和交互流程。
- 明确静态 HTML 的视觉规范和不可偏离的样式 token。
- 明确旧系统 `apps/web` 与静态页的页面、组件、样式和交互差距。
- 明确用户端还原依赖的后端字段、API 和管理端维护能力。
- 把后续任务按用户端、后端服务、管理端拆成中文任务项。

### 3.3 非目标

- 本任务不改 Vue、NestJS、Element Plus 业务实现。
- 本任务不运行浏览器截图对比，因为还没有新的用户端实现可对比。
- 本任务不把静态 HTML 作为运行时数据库。
- 本任务不把 Notion 作为业务数据库。
- 本任务不解决依赖漏洞、构建警告或旧系统风格债务。

### 3.4 成功标准

- 已读取并分析静态 HTML。
- 已结合旧系统路径完成差距分析。
- 已形成用户端页面结构、功能清单和视觉规范。
- 已明确后端服务和管理端必须补齐的支撑能力。
- 已形成后续中文任务项。
- 未修改 `apps/web`、`apps/api`、`apps/admin` 实现文件。

## 4. 静态 HTML 分析

### 4.1 页面与数据规模

| 项目 | 结果 |
| --- | ---: |
| 静态文件大小 | 2,515,543 bytes |
| `universitiesBase` 院校数 | 18 |
| `universitiesSupplement` 院校数 | 108 |
| 合并后院校数 | 119 |
| 合并后专业数 | 687 |
| ready 专业数 | 239 |
| 不开放国际学生专业数 | 6 |
| 隐藏未核验专业数 | 3 |
| 缺少公开展示状态专业数 | 439 |
| ready 本科专业 | 74 |
| ready 硕士专业 | 136 |
| ready 博士专业 | 29 |
| ready 专业类别数 | 46 |

静态页用户端主列表规则非常明确：公开列表只展示 `publicDisplayStatus === "ready"` 的专业；不开放国际学生、隐藏未核验和缺少公开展示状态的数据应保留在数据层或管理端核验流程中，不进入用户端公开主列表。

### 4.2 CSS 与交互规模

| 项目 | 结果 |
| --- | ---: |
| `:root` 根变量 | 18 |
| 媒体查询 | 10 |
| 关键动画 | 5 |
| 脚本函数 | 86 |

关键动画为 `pulse`、`fadeDown`、`fadeUp`、`fadeIn`、`slideUp`。媒体查询覆盖 `1180px`、`900px`、`768px`、`760px`、`700px`、`600px` 等断点。

### 4.3 页面结构

- 首页：sticky 导航、深墨色 Hero、eyebrow、标题、副标题、居中搜索框、搜索建议、CTA、统计栏。
- 院校库：首页下方主体区，左侧 260px 筛选栏，右侧结果摘要、活跃筛选标签、院校列表和分页。
- 院校卡片：横向图片卡片、QS 浮层、logo、中文/英文名、标签、简介、学费、收藏、对比、详情入口。
- 院校详情：深色详情 Hero、标签页、官方概览、申请信息、设施亮点、专业列表。
- 专业列表：按本科、硕士、博士分组，每组使用 7 列 CSS Grid，桌面显示表头，窄屏横向滚动，移动端转块状字段。
- 专业详情：弹窗展示官方费用、学制、开学、语言要求、学术要求、材料、课程、职业方向、官方来源和核验状态。
- 收藏与对比：收藏院校/专业，对比最多 4 所院校。
- 申请规划：申请概览、学生画像、材料清单、申请管理、签证清单五个标签页。
- 工具弹窗：费用估算、智能推荐、登录/注册。
- 移动端：移动导航抽屉、贴底弹窗、卡片纵向布局、专业字段块状展示。

### 4.4 核心状态和函数

静态页状态包含：

- 页面状态：`page`、`selectedUni`、`selectedProg`、`homePage`。
- 筛选状态：`search`、`qsRankMax`、`tuitionMin`、`tuitionMax`、`categories`、`levels`、`types`、`acceptNoLanguage`。
- 弹窗状态：`showCalc`、`showRec`、`showAuth`、`authMode`、`mobileMenu`。
- 工具状态：`favorites`、`compareList`、`profile`、`materialProgress`、`appTasks`、`visaChecklist`、`userAuth`。

关键函数包含：

- 搜索筛选：`filteredUnis`、`getSearchSuggestions`、`setFilter`、`toggleCatFilter`、`toggleLevelFilter`、`toggleTypeFilter`、`toggleNoLang`、`resetFilters`。
- 页面渲染：`renderHome`、`renderUniCard`、`renderUniDetail`、`renderUniProgramsForLevel`、`renderProgModal`。
- 用户状态：`toggleFavUni`、`toggleFavProg`、`toggleCompare`。
- 工具页面：`renderFavorites`、`renderCompare`、`renderPlanner`、`renderCalcModal`、`renderRecModal`、`renderAuthModal`。

后续 Vue 实现不能只迁移静态页面外观，还要保留这些交互关系，尤其是搜索建议直达院校/专业弹窗、筛选后分页回到第 1 页、对比最多 4 所、未登录本地状态与登录后持久化合并。

## 5. 功能清单

### 5.1 用户端功能清单

- 全局导航：logo、导航链接、收藏/对比计数、登录入口、移动导航抽屉。
- 首页 Hero：深墨背景、金色强调、搜索入口、搜索建议、快捷标签、统计栏。
- 院校筛选：院校类型、学历层级、QS 档位、预算、专业类别、免语言申请。
- 活跃筛选：展示当前筛选、单项移除、清除全部、结果数量。
- 院校列表：横向院校卡片、图片、QS 浮层、标签、简介、学费、收藏、对比、详情入口。
- 院校详情：官方档案、申请入口、联系方式、申请周期、官方说明、核验备注、设施亮点。
- 专业列表：本科、硕士、博士分组；7 列 grid；移动端字段块状展示。
- 专业详情弹窗：费用、学制、开学、学院、语言、学术要求、中国学生要求、材料、课程、职业方向、官方来源。
- 收藏夹：院校收藏、专业收藏、空状态。
- 院校对比：最多 4 所院校、统一对比字段、清空与移除。
- 申请规划：概览、画像、材料、申请任务、签证五标签页。
- 费用估算：手动输入学费、生活费、学制、杂费，输出总费用与分项。
- 智能推荐：基于学历、类别、预算、GPA、IELTS、免语言偏好生成推荐卡。
- 登录/注册：tab 切换、输入、状态持久化和后续服务端合并。
- 浮动按钮：右下工具入口、收藏/对比提示、移动端位置适配。

### 5.2 后端服务支撑清单

- 院校公开列表、详情、搜索建议、筛选聚合和分页。
- 专业列表、专业详情、公开展示状态、官方来源和核验字段。
- 收藏、对比、规划、材料、签证、费用估算和推荐 API。
- 未登录 localStorage 与登录后服务端数据合并策略。
- 静态 HTML 数据导入 dry-run 和字段校验报告。
- 管理端维护字段对应的 DTO、实体、映射和权限日志。

### 5.3 管理端支撑清单

- 学校官方档案维护：官网、国际学生页、申请入口、申请周期、费用、材料、联系人、核验备注。
- 专业官方字段维护：RM 总学费、费用来源、学制、开学、语言、学术要求、中国学生要求、认证说明。
- 公开展示状态维护：ready、不开放国际学生、待核验、隐藏未核验、归档。
- 专业类别字典维护：支持静态页 46 类 ready 专业类别，不再被 7 个固定枚举限制。
- 静态 HTML 导入核验工作台：统计、缺失字段、重复项、来源状态、费用异常、跳转编辑。
- 权限、菜单和操作日志：覆盖官方字段、公开状态、导入校验和发布规则。

## 6. 视觉规范

### 6.1 全局 token

| Token | 值 | 用途 |
| --- | --- | --- |
| `--ink` | `#0C0E1A` | 深墨主色、Hero、主按钮 |
| `--ink-2` | `#3A3D52` | 正文辅助文字、hover 深色 |
| `--ink-3` | `#8A8EA8` | 弱文本、说明、表头 |
| `--paper` | `#FAFAF8` | 页面背景 |
| `--paper-2` | `#F2F2EE` | 浅纸色块、hover 背景 |
| `--border` | `#E4E4DC` | 边框 |
| `--gold` | `#C8A84B` | 品牌金、CTA、强调 |
| `--gold-lt` | `#F5E9C4` | 金色浅底标签 |
| `--teal` | `#1B7A72` | 官方已核验、成功状态 |
| `--teal-lt` | `#D0EDEB` | 青绿浅底 |
| `--red` | `#C43830` | 风险、移除、收藏强调 |
| `--red-lt` | `#FDECEA` | 红色浅底 |
| `--blue` | `#1E4FA3` | 对比、QS 筛选 |
| `--blue-lt` | `#D9E5FA` | 蓝色浅底 |
| `--r` | `16px` | 卡片和弹窗大圆角 |
| `--r-sm` | `10px` | 按钮、输入框、小卡片圆角 |
| `--shadow` | `0 2px 12px rgba(12,14,26,.07)` | 默认阴影 |
| `--shadow-lg` | `0 12px 40px rgba(12,14,26,.12)` | 强阴影 |

### 6.2 字体与排版

- 正文字体：`DM Sans`, `system-ui`, `sans-serif`。
- 标题字体：`DM Serif Display`, `Georgia`, `serif`。
- 基准字号：`15px`。
- 基准行高：`1.6`。
- Hero 标题：`clamp(38px, 6.5vw, 72px)`，移动端 600px 以下 `32px`。
- 标题字距以静态页为准；后续不得引入旧系统当前的大字距中文营销风格。

### 6.3 关键布局

- 页面背景必须为纸色 `#FAFAF8`。
- 主容器最大宽度 `1280px`，左右内边距 `24px`。
- 导航高度 `64px`，半透明纸色背景，sticky 顶部。
- 首页 Hero 必须是深墨色全宽区域，包含噪声纹理、点阵背景和金色径向光。
- 院校库桌面布局为 `260px 1fr`，左侧筛选栏 sticky，顶部偏移 `80px`。
- 院校卡片桌面为横向卡片，图片区域约 `200px`，700px 以下转纵向。
- 专业列表必须使用 7 列 CSS Grid，1180px 以下横向滚动，760px 以下块状字段。
- 专业详情弹窗最大宽度 `860px`，工具弹窗分别为 `640px`、`720px`、登录弹窗 `440px`。
- 浮动按钮固定右下角 `24px`，列方向排列。

### 6.4 组件规则

- 按钮：`inline-flex`、`gap: 8px`、`padding: 10px 20px`、小圆角 `10px`、`font-weight: 600`。
- 输入框：白底、`1.5px solid --border`、圆角 `10px`、focus 时金色边框。
- 标签：胶囊形，`font-size: 12px`，状态色使用金、青绿、蓝、红和浅纸色。
- 卡片：白底、1px 边框、16px 圆角、轻阴影；hover 上移和阴影增强。
- 弹窗：遮罩 `rgba(12,14,26,.55)`；移动端贴底；桌面端居中；关闭按钮 32px。
- 专业表格：表头 `12px` 强字重弱文本；行最小高度 `116px`；hover 背景 `#FCFCFA`。
- 申请规划：五标签页、金色激活下划线、进度条金色到青绿渐变。

### 6.5 响应式断点

| 断点 | 要求 |
| --- | --- |
| `max-width: 1180px` | 专业 grid 最小宽度 1030px，容器横向滚动 |
| `max-width: 900px` | 主体改单列，筛选栏取消 sticky，表单和要求栅格改单列 |
| `min-width: 768px` | 弹窗由贴底改居中，增加 24px 外边距 |
| `max-width: 760px` | 专业表头隐藏，专业行转块状字段 |
| `max-width: 700px` | 院校卡片转纵向，图片高度约 160px |
| `max-width: 600px` | 桌面导航链接隐藏，Hero 标题固定 32px，统计数字 28px |

## 7. 旧系统差距分析

### 7.1 用户端差距

旧系统 `apps/web` 已有首页、院校详情、专业详情、收藏、对比、规划、会员、登录、费用估算和推荐弹窗，但与静态页存在以下差距：

- 全局 token 不一致：旧系统使用 `--bg: #f5f0e7`、`--primary: #1f3c31`、`--radius-xl: 32px`，静态页要求深墨、金色、纸色、16px/10px 圆角体系。
- 字体不一致：旧系统使用系统中文和 Iowan/Palatino 系列，静态页要求 `DM Sans` 与 `DM Serif Display`。
- 首页结构不一致：旧系统是分栏 Hero 与 brief card，静态页是深墨色居中 Hero、搜索框和统计栏。
- 搜索交互不完整：旧系统有搜索和筛选，但缺少静态页搜索建议浮层、命中高亮、回车处理、院校/专业直达。
- 筛选区不一致：旧系统筛选面板不是静态页折叠侧栏，缺少预算滑杆、活跃筛选标签、清除全部和精确断点表现。
- 院校卡片不一致：旧系统已有 `UniversityCard`，但图片比例、QS 浮层、底部信息区、hover、标签和按钮均需重做。
- 院校详情不一致：旧系统详情页使用大圆角 section card，缺少深色详情 Hero、标签页、官方档案卡和专业 7 列 grid。
- 专业详情形态不一致：旧系统有 `/programs/:slug` 独立页，静态页要求从院校详情打开专业详情弹窗；独立页最多作为 SEO 或直达辅助。
- 对比上限不一致：旧系统当前对比逻辑需要与静态页最多 4 所对齐。
- 规划、收藏、会员和工具弹窗已有雏形，但视觉、字段、贴底弹窗和服务端同步策略都未对齐。

### 7.2 后端服务差距

- 共享类型 `ProgramCategory` 当前只有 7 类，无法覆盖静态页 46 类 ready 专业类别。
- 院校实体缺少官方档案、国际学生页、申请入口、申请周期、申请费、官方材料、官方来源和核验备注。
- 专业实体缺少 RM 总学费、费用来源 URL、官方学制、官方开学、官方语言原文、官方学术要求、中国学生要求、认证说明、公开展示状态、来源状态和审计备注。
- 院校列表 API 缺少筛选聚合、预算下限、公开展示状态和活跃筛选摘要。
- 专业 API 仍以 `slug` 独立详情为主，缺少弹窗按 id 直达和完整官方字段。
- 搜索建议 API 缺失，无法支持静态页院校/专业/城市混合建议。
- 收藏、对比、规划、费用估算和推荐已有部分服务，但未完成未登录本地状态与登录后服务端状态合并。

### 7.3 管理端差距

- 学校管理表单能维护基础学校资料、排名、图片、费用、IELTS、发布状态，但缺少官方档案和核验分组。
- 专业管理表单仍以 CNY 年学费、基础 IELTS/GPA、材料、课程、就业和 7 类分类为主，无法维护静态页官方字段。
- 字典管理存在，但还没有驱动专业类别、公开展示状态、来源状态和费用审计状态。
- 缺少静态 HTML 导入 dry-run 和校验工作台。
- 缺少官方字段、导入校验、发布规则的菜单、权限点和操作日志。

## 8. 后续任务拆解

### 8.1 用户端任务

#### USER-VIS-008 全局视觉系统替换

- **范围**：`apps/web`
- **目标**：用静态 HTML token、字体、按钮、输入框、标签、卡片、弹窗和动画替换旧系统用户端视觉基础。
- **验收标准**：页面背景、字体、颜色、圆角、阴影和基础组件状态与静态页一致；旧系统米色/绿色和 32px 大圆角不再主导用户端。
- **测试计划**：运行 `npm run build`；浏览器截图对比基础组件、导航和空状态。

#### USER-VIS-009 导航、首页 Hero 和搜索建议还原

- **范围**：`apps/web`
- **目标**：还原 64px sticky 导航、深墨色 Hero、金色强调、噪声纹理、点阵背景、居中搜索框、统计栏、搜索建议和移动导航抽屉。
- **验收标准**：桌面 `1440x1000` 与移动 `390x844` 首屏截图和静态 HTML 一致；搜索支持回车、Escape、院校直达和专业直达。
- **测试计划**：运行 `npm run build`；启动静态页和 Vue 用户端，保存同视口截图对比。

#### USER-VIS-010 筛选侧栏、活跃筛选和院校卡片还原

- **范围**：`apps/web`
- **目标**：还原 260px sticky 筛选栏、折叠筛选组、预算滑杆、QS chip、类别按钮、免语言开关、活跃筛选条、院校卡片和分页。
- **验收标准**：筛选组合、清除全部、分页回退、卡片 hover、图片缩放、QS 浮层、收藏/对比按钮与静态页一致。
- **测试计划**：运行 `npm run build`；截图覆盖桌面、900px、700px、390px。

#### USER-VIS-011 院校详情和专业 7 列列表还原

- **范围**：`apps/web`
- **目标**：还原院校详情深色 Hero、标签页、官方档案、申请信息、来源核验说明和本科/硕士/博士专业 grid。
- **验收标准**：详情页布局、信息卡、专业表头、7 列字段、1180px 横滚和 760px 块状字段与静态页一致。
- **测试计划**：运行 `npm run build`；截图覆盖详情 Hero、概览、申请信息、专业列表桌面和移动端。

#### USER-VIS-012 专业详情、费用估算、推荐和登录弹窗还原

- **范围**：`apps/web`
- **目标**：用弹窗替代用户主流程中的独立专业详情页，并还原专业、费用估算、智能推荐、登录/注册弹窗。
- **验收标准**：弹窗遮罩、宽度、圆角、header、section、关闭行为、桌面居中和移动贴底规则与静态页一致。
- **测试计划**：运行 `npm run build`；浏览器验证打开、关闭、遮罩点击、移动端贴底和键盘可用性。

#### USER-VIS-013 收藏、对比、申请规划、会员和浮动按钮还原

- **范围**：`apps/web`
- **目标**：还原收藏夹、对比表、申请规划五标签页、会员中心、右下浮动按钮组和移动端布局。
- **验收标准**：对比最多 4 所；规划进度条、画像表单、材料项、任务卡、签证步骤、浮动按钮视觉与静态页一致。
- **测试计划**：运行 `npm run build`；浏览器截图覆盖收藏、对比、规划、费用、推荐、登录和移动导航。

### 8.2 后端服务任务

#### API-VIS-004 用户端展示字段契约补齐

- **范围**：`apps/api`、`packages/shared`
- **目标**：补齐用户端 1:1 展示需要的院校、专业、费用、要求、来源、公开状态和核验字段。
- **验收标准**：用户端院校卡片、详情 Hero、专业 grid 和专业弹窗不需要硬编码静态页字段。
- **测试计划**：运行 `npm run build`；验证示例接口响应字段完整。

#### API-VIS-005 搜索建议与筛选聚合 API

- **范围**：`apps/api`
- **目标**：新增院校/专业/城市混合搜索建议、筛选 facets、activeFilters、分页和专业弹窗定位字段。
- **验收标准**：前端可通过 API 完成静态页搜索建议、高亮、院校直达、专业直达和筛选摘要。
- **测试计划**：运行 `npm run build`；接口覆盖关键词、空结果、组合筛选和专业直达。

#### API-VIS-006 收藏对比规划与工具同步 API

- **范围**：`apps/api`
- **目标**：支持收藏、最多 4 所对比、画像、材料、申请任务、签证、费用估算和推荐的服务端同步。
- **验收标准**：未登录 localStorage 可在登录后合并到服务端；费用估算和推荐响应可驱动静态页弹窗。
- **测试计划**：运行 `npm run build`；验证新增、移除、清空、合并、推进和估算。

### 8.3 管理端任务

#### ADMIN-VIS-004 学校与专业官方字段维护

- **范围**：`apps/admin`、`apps/api`
- **目标**：扩展学校和专业表单，维护静态页卡片、详情、专业表格和弹窗所需字段。
- **验收标准**：保存后 API 能回显官方档案、费用、来源、公开状态和核验字段。
- **测试计划**：运行 `npm run build`；浏览器验证新增、编辑、保存、回显。

#### ADMIN-VIS-005 公开展示状态和专业类别字典

- **范围**：`apps/admin`、`apps/api`、`packages/shared`
- **目标**：用字典维护专业类别、公开展示状态、来源状态和费用审计状态。
- **验收标准**：管理端不再被 7 个固定专业类别限制；用户端只展示 ready 专业；状态变更有日志。
- **测试计划**：运行 `npm run build`；验证字典新增、禁用、排序和用户端筛选选项。

#### ADMIN-VIS-006 静态 HTML 导入核验工作台

- **范围**：`apps/admin`、`apps/api`
- **目标**：提供静态页数据 dry-run 统计、字段缺失、重复项、来源核验和费用异常检查界面。
- **验收标准**：工作台能展示 119 所院校、687 个专业、239 个 ready 专业和 439 个缺失公开展示状态专业，并支持筛选与跳转编辑。
- **测试计划**：运行 dry-run；运行 `npm run build`；浏览器验证统计、筛选、问题列表和跳转。

## 9. UI 验收截图清单

后续真正实施用户端 UI 后，必须保留静态 HTML 与 Vue 页面同视口截图。最少视口：`1440x1000`、`1180x900`、`900x900`、`390x844`。

| 页面/组件 | 桌面 | 移动 | 重点 |
| --- | --- | --- | --- |
| 首页首屏 | 必须 | 必须 | 导航、Hero、搜索、统计、背景纹理 |
| 搜索建议 | 必须 | 必须 | 浮层、命中高亮、键盘行为 |
| 筛选与院校列表 | 必须 | 必须 | 侧栏、活跃标签、院校卡片、分页 |
| 院校详情 | 必须 | 必须 | 深色 Hero、标签页、官方信息 |
| 专业列表 | 必须 | 必须 | 7 列 grid、横滚、块状字段 |
| 专业详情弹窗 | 必须 | 必须 | 居中/贴底、遮罩、section、关闭 |
| 收藏夹 | 必须 | 可选 | 空状态、收藏卡片 |
| 院校对比 | 必须 | 必须 | 最多 4 所、对比表 |
| 申请规划 | 必须 | 必须 | 五标签页、进度、材料、任务、签证 |
| 费用估算 | 必须 | 必须 | 深色 header、费用结果 |
| 智能推荐 | 必须 | 必须 | 推荐卡、分数块 |
| 登录/注册 | 必须 | 必须 | tab、输入、贴底/居中 |
| 浮动按钮 | 必须 | 必须 | 右下位置、胶囊样式 |
| 移动导航 | 不适用 | 必须 | 遮罩、右侧面板、链接状态 |

## 10. 本任务验证记录

- 已读取本地 `AGENTS.md`。
- 已读取本地任务页快照、产品需求文档和技术方案。
- 已读取并分析 `D:\mydev\StudyMY_UM_v58_na_display_tidy.html`。
- 已通过静态页脚本结构核验院校、专业、公开展示状态、CSS token、媒体查询、动画和函数数量。
- 已读取旧系统 `apps/web`、`apps/api`、`apps/admin`、`packages/shared` 的关键结构和差距。
- 已搜索 Notion，但未找到可安全更新的 TASK-006 页面。
- 已新增本地中文 PRD/规划文档。
- 本任务未修改 `apps/web`、`apps/api`、`apps/admin` 的实现文件。

## 11. Review 自动修复视觉验收补充

### 11.1 修复范围

- 本节仅补充 `TASK-006-REVIEW-002` 要求的当轮浏览器视觉验收证据。
- 本轮未修改 `apps/web`、`apps/api`、`apps/admin` 实现文件。
- `TASK-006-REVIEW-001` 和 `TASK-006-REVIEW-003` 为不可自动修复问题，不在本轮处理范围内。

### 11.2 验证命令

- 已运行 `npm run verify:task028`，结果通过。
- 已运行 `npm run build`，结果通过；管理端仍存在既有大 chunk 警告，不阻塞本轮测试证据补充。

### 11.3 截图产物

- 输出目录：`D:\mydev\study-malaysia\output\playwright\task028-20260524T122419Z`
- Markdown 报告：`D:\mydev\study-malaysia\output\playwright\task028-20260524T122419Z\visual-diff-report.md`
- JSON 报告：`D:\mydev\study-malaysia\output\playwright\task028-20260524T122419Z\visual-diff-report.json`
- 截图数量：52 张。
- 对比数量：26 组。
- 覆盖视口：`1440x1000`、`390x844`。
- 自动差异结论：阻塞项 0，差异项 0。

### 11.4 关键截图路径

| 覆盖项 | 桌面端截图 | 移动端截图 |
| --- | --- | --- |
| 首页首屏 | `output\playwright\task028-20260524T122419Z\static-home-desktop.png` / `output\playwright\task028-20260524T122419Z\web-home-desktop.png` | `output\playwright\task028-20260524T122419Z\static-home-mobile.png` / `output\playwright\task028-20260524T122419Z\web-home-mobile.png` |
| 搜索筛选区与院校卡片 | `output\playwright\task028-20260524T122419Z\static-list-filter-desktop.png` / `output\playwright\task028-20260524T122419Z\web-list-filter-desktop.png` | `output\playwright\task028-20260524T122419Z\static-list-filter-mobile.png` / `output\playwright\task028-20260524T122419Z\web-list-filter-mobile.png` |
| 院校详情概览 | `output\playwright\task028-20260524T122419Z\static-university-overview-desktop.png` / `output\playwright\task028-20260524T122419Z\web-university-overview-desktop.png` | `output\playwright\task028-20260524T122419Z\static-university-overview-mobile.png` / `output\playwright\task028-20260524T122419Z\web-university-overview-mobile.png` |
| 专业列表 | `output\playwright\task028-20260524T122419Z\static-university-programs-desktop.png` / `output\playwright\task028-20260524T122419Z\web-university-programs-desktop.png` | `output\playwright\task028-20260524T122419Z\static-university-programs-mobile.png` / `output\playwright\task028-20260524T122419Z\web-university-programs-mobile.png` |
| 专业详情弹窗 | `output\playwright\task028-20260524T122419Z\static-program-modal-desktop.png` / `output\playwright\task028-20260524T122419Z\web-program-modal-desktop.png` | `output\playwright\task028-20260524T122419Z\static-program-modal-mobile.png` / `output\playwright\task028-20260524T122419Z\web-program-modal-mobile.png` |
| 登录弹窗 | `output\playwright\task028-20260524T122419Z\static-auth-modal-desktop.png` / `output\playwright\task028-20260524T122419Z\web-auth-modal-desktop.png` | `output\playwright\task028-20260524T122419Z\static-auth-modal-mobile.png` / `output\playwright\task028-20260524T122419Z\web-auth-modal-mobile.png` |
| 费用估算弹窗 | `output\playwright\task028-20260524T122419Z\static-calculator-modal-desktop.png` / `output\playwright\task028-20260524T122419Z\web-calculator-modal-desktop.png` | `output\playwright\task028-20260524T122419Z\static-calculator-modal-mobile.png` / `output\playwright\task028-20260524T122419Z\web-calculator-modal-mobile.png` |
| 智能推荐弹窗 | `output\playwright\task028-20260524T122419Z\static-recommend-modal-desktop.png` / `output\playwright\task028-20260524T122419Z\web-recommend-modal-desktop.png` | `output\playwright\task028-20260524T122419Z\static-recommend-modal-mobile.png` / `output\playwright\task028-20260524T122419Z\web-recommend-modal-mobile.png` |

### 11.5 结论

本轮已补齐桌面端和移动端关键区域的静态 HTML 与 Vue 用户端同视口截图、可复现命令、报告路径和自动差异结论，可作为 `TASK-006-REVIEW-002` 的修复证据。Notion 未更新；本轮只更新本地中文任务快照和本地中文规划文档。

### 11.6 本轮复核补充

- 复核时间：2026-05-24T20:45:04+08:00。
- 修复范围：仅复跑并补充 `TASK-006-REVIEW-002` 的视觉验收证据；未处理不可自动修复的 `TASK-006-REVIEW-001` 和 `TASK-006-REVIEW-003`。
- 验证命令：已运行 `npm run verify:task028`，结果通过；已运行 `npm run build`，结果通过，管理端仍存在既有大 chunk 警告。
- 输出目录：`D:\mydev\study-malaysia\output\playwright\task028-20260524T124504Z`
- Markdown 报告：`D:\mydev\study-malaysia\output\playwright\task028-20260524T124504Z\visual-diff-report.md`
- JSON 报告：`D:\mydev\study-malaysia\output\playwright\task028-20260524T124504Z\visual-diff-report.json`
- 截图数量：52 张。
- 对比数量：26 组。
- 覆盖视口：`1440x1000`、`390x844`。
- 覆盖页面与弹窗：首页首屏、首页筛选与院校卡片、院校详情概览、院校详情专业列表、专业详情弹窗、收藏页、对比页、规划页、登录弹窗、费用估算弹窗和智能推荐弹窗。
- 自动差异结论：阻塞项 0，差异项 0。
- 关键截图路径：`output\playwright\task028-20260524T124504Z\static-home-desktop.png`、`output\playwright\task028-20260524T124504Z\web-home-desktop.png`、`output\playwright\task028-20260524T124504Z\static-list-filter-mobile.png`、`output\playwright\task028-20260524T124504Z\web-list-filter-mobile.png`、`output\playwright\task028-20260524T124504Z\static-university-programs-desktop.png`、`output\playwright\task028-20260524T124504Z\web-university-programs-desktop.png`、`output\playwright\task028-20260524T124504Z\static-program-modal-mobile.png`、`output\playwright\task028-20260524T124504Z\web-program-modal-mobile.png`、`output\playwright\task028-20260524T124504Z\static-calculator-modal-desktop.png`、`output\playwright\task028-20260524T124504Z\web-calculator-modal-desktop.png`、`output\playwright\task028-20260524T124504Z\static-recommend-modal-mobile.png`、`output\playwright\task028-20260524T124504Z\web-recommend-modal-mobile.png`。

本轮复核已重新生成可复现截图和自动指标报告，可作为 `TASK-006-REVIEW-002` 的当前修复证据。Notion 未更新；本轮只更新本地中文任务快照和本地中文规划文档。
