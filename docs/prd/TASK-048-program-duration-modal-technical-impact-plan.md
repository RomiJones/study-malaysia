# TASK-048 专业长字段与详情弹窗技术影响分析和实现方案

## 1. 文档信息

- **任务编号**：TASK-048
- **任务标题**：新增需求技术影响分析和实现方案
- **运行编号**：TASK-048-2026-05-24T22-17-12-241Z
- **关联新增需求**：REQ-2026-05-24T00-39-56-408Z
- **前置任务**：TASK-047 专业长字段与详情弹窗需求边界和验收标准
- **新增需求描述**：`Full-Time Duration: 6 个学期, (Clinical) — official page title is Doctor of Public Health (Mixed-Mode)` 这类字段在专业列表中展示过长，导致列表样式越界；需要统一列表普通展示口径，通过感叹号或等价信息入口显示完整详情；同时优化专业详情模态框的滚动条、内部间距和不同内容长度下的兼容性。
- **目标项目**：`D:\mydev\study-malaysia`
- **文档定位**：本文件只输出技术影响分析、后续实现方案、验证方式和回滚边界；不修改业务代码、不导入数据库、不调整运行时页面表现。
- **事实来源说明**：Notion 和本地 Markdown 快照只用于中文项目文档和任务管理，不是业务数据库；本需求不使用 `task.json` 作为事实源。
- **Notion 更新说明**：本轮没有可写入的 Notion 页面 ID，已更新本地中文技术方案文档和 TASK-048 任务快照；实际 Notion 页面需由后续同步流程或人工确认后更新。

## 2. 需求边界

本任务只分析 TASK-047 定义的新增需求，范围限定为：

- 学校详情页本科、硕士、博士专业列表中的长学制、学习模式、临床标记、官方标题备注等字段展示。
- 专业详情模态框的滚动边界、滚动条观感、内部间距和不同内容长度下的兼容。
- 后续实现应保留完整官方说明，并在列表中只展示统一、可扫读的摘要。

本任务不处理以下范围：

- 不处理学校详情页“概览、本科专业、硕士专业、博士专业、校园设施、申请信息”的 tab 切换样式；该范围已属于 TASK-043 至 TASK-046。
- 不处理 UM 静态 HTML 数据导入数据库；该范围属于 TASK-051 至 TASK-054，TASK-052 已单独输出技术方案。
- 不修改 `apps/api`、`apps/admin`、`packages/shared` 或 `apps/web` 的业务代码。
- 不创建迁移、不导入数据、不新增接口、不调整真实数据库。
- 不把示例专业 `Doctor of Public Health (Mixed-Mode)` 的业务规则写成框架默认规则。

如果后续实现发现字段语义或数据契约必须调整，应先按本文第 6 节的条件影响处理，不应在 TASK-049 中静默扩大范围。

## 3. 当前实现基线

### 3.1 用户端列表和弹窗

当前学校详情页位于 `apps/web/src/pages/UniversityPage.vue`：

- 本科、硕士、博士列表使用 `.programme-grid-head` 和 `.programme-grid-row` 渲染 7 列：专业名、学院、学制、学费、语言、开学时间、详情。
- 每条专业记录当前整体是一个 `<button class="programme-grid-row">`，点击后调用 `openProgram(program)` 打开专业详情。
- 学制列调用 `durationLabel(program)`，再由 `formatProgramDuration(program, currentLocale.value)` 输出展示文案。
- 专业详情模态框复用同一个 `durationLabel(catalog.selectedProgramDetail)`，顶部标签和“官方学制”字段都只展示同一份格式化结果。
- 模态框源信息区域已能展示 `auditNote`、`publicDisplayNote`、`reviewReason`、官方来源链接和费用核验状态，可作为完整说明的承载位置。

### 3.2 展示格式化

当前格式化逻辑位于 `apps/web/src/utils/format.ts`：

- `formatProgramDuration` 优先读取 `durationOfficial`，再回退到 `durationYears`。
- `normalizeAcademicText` 已能把 `6 Semesters (Clinical)` 转成当前语言的短文案。
- 测试中已覆盖长混合字段：`Full-Time Duration: 6 Semesters, (Clinical) — official page title is Doctor of Public Health (Mixed-Mode)` 当前会回退为“以院校官方页面为准”，避免未知英文备注直接泄漏到中文界面。
- 当前没有同时返回“列表摘要”和“完整详情”的结构化 helper，因此列表无法在显示短文案的同时保留可见详情入口。

### 3.3 数据契约

共享类型位于 `packages/shared/src/index.ts`：

- `ProgramOfficialProfile` 已包含 `studyMode`、`durationOfficial`、`officialIntake`、`publicDisplayStatus`、`publicDisplayNote`、`reviewReason`、`auditNote` 等字段。
- `ProgramListItem` 和 `ProgramCatalogDetail` 继承上述字段；当前 API 已能把 `durationOfficial` 和审计说明传到用户端。

后端映射位于 `apps/api/src/common/mappers.ts`：

- `mapProgram` 已输出 `durationOfficial`、`studyMode`、`officialSourceStatus`、`publicDisplayStatus`、`auditNote` 和 `sourceUrls`。
- 第一阶段可不新增 API 字段，通过前端视图模型拆分摘要和详情。

### 3.4 样式基线

当前样式位于 `apps/web/src/style.css`：

- `.programme-grid-head` 和 `.programme-grid-row` 使用 7 列 CSS Grid，1180px 以下设置 `min-width: 1030px` 并横向滚动。
- `.programme-pill` 目前 `white-space: nowrap`，长文案会带来列宽或溢出风险。
- `.modal-backdrop` 固定定位并 `overflow: hidden`。
- `.modal` 当前 `max-height: 92vh; overflow: auto;`，专业详情模态框本身滚动，容易出现用户反馈的“滚动条在模态框外侧或观感突兀”。
- `.modal-header` 为 sticky，`.modal-body` 当前仅设置 `padding: 24px`，没有专门限制专业详情内部滚动区域。

## 4. 影响模块和文件范围

### 4.1 后续 TASK-049 必然影响

| 模块 | 文件范围 | 影响说明 |
| --- | --- | --- |
| 用户端学校详情页 | `apps/web/src/pages/UniversityPage.vue` | 专业列表学制列需要使用“摘要 + 详情入口”视图模型；如果增加可点击信息图标，必须避免在现有 row button 内嵌套 button；专业详情模态框需要展示完整学制/官方标题/审计说明。 |
| 用户端格式化工具 | `apps/web/src/utils/format.ts` | 新增或扩展纯函数，返回列表摘要、完整详情、是否需要信息入口、可选标签；不能只做简单截断。 |
| 用户端全局样式 | `apps/web/src/style.css` | 限定调整 `.programme-*` 和 `.program-detail-modal` 相关样式；处理长字段、信息图标、popover/tooltip、模态框内部滚动和间距。 |
| 前端格式化测试 | `tests/web/format.test.ts` | 覆盖长混合字段、普通学制、字段缺失、多语言输出、中文/英文/马来文/繁体回退。 |

### 4.2 条件影响

| 模块 | 文件范围 | 触发条件 |
| --- | --- | --- |
| 共享类型 | `packages/shared/src/index.ts` | 只有确认 API 需要长期返回结构化 `durationSummary`、`durationDetail` 或 `durationBadges` 时才修改；第一阶段不建议改共享契约。 |
| 后端映射 | `apps/api/src/common/mappers.ts` | 只有共享类型新增字段或后端需要统一生成展示摘要时才修改；否则维持现有 `durationOfficial` 输出。 |
| 数据实体和迁移 | `apps/api/src/db/entities.ts` | 只有确认需要持久化官方标题别名、临床说明或列表摘要字段时才修改；本需求默认不创建迁移。 |
| 管理端字段维护 | `apps/admin` 相关页面和服务 | 只有产品确认运营需要单独编辑“列表摘要/完整备注/官方标题别名”时才新增字段；不能作为 TASK-049 的顺手改动。 |
| 视觉验证脚本 | `scripts/task025-program-visual.mjs` 或新增 `scripts/task049-program-duration-modal-visual.mjs` | 如果现有脚本不能稳定覆盖多个专业弹窗和长字段样本，需要新增 TASK-049 专用浏览器验证脚本。 |

### 4.3 不应影响

- 不修改收藏、对比、规划、费用估算、登录、搜索筛选逻辑。
- 不修改专业数量、公开展示状态、专业排序和 API 查询条件。
- 不修改学校详情页一级 tab 组件；只允许在专业列表内部处理长字段。
- 不修改 UM 数据导入命令、静态 HTML 提取器或数据库导入器。
- 不修改 `task.json`。

## 5. 接口、数据结构和状态影响

### 5.1 接口影响

第一阶段建议不新增接口，不改变 `/api/universities/:slug`、`/api/programs`、`/api/programs/detail/:idOrSlug` 的响应契约。

原因：

- 当前 API 已提供 `durationOfficial`、`studyMode`、`nameEnOfficial`、`auditNote`、`publicDisplayNote`、`reviewReason` 和 `sourceUrls`。
- 本需求主要是展示层拆分和模态框体验问题，可以先在用户端生成视图模型。
- 避免为了一个 Demo 示例新增后端字段并固化业务规则。

如果产品后续确认“列表摘要”和“完整备注”必须由管理端维护或由 API 统一输出，应拆分为数据契约任务，并考虑新增如下字段：

| 字段 | 层级 | 用途 | 约束 |
| --- | --- | --- | --- |
| `durationSummary` | API/共享类型/可选持久化 | 列表普通态展示短文案 | 不应写死 UM 或单个专业；必须支持多语言或可被前端本地化。 |
| `durationDetail` | API/共享类型/可选持久化 | 信息入口和详情弹窗展示完整说明 | 应保留官方原文、审计说明和来源关系。 |
| `durationBadges` | API/共享类型/前端视图模型 | 表示 Clinical、Mixed-Mode、Full-Time 等标签 | 只能来自通用解析或结构化字段，不得为具体专业硬编码。 |

### 5.2 前端视图模型

后续实现建议新增前端-only 视图模型：

| 字段 | 用途 | 示例 |
| --- | --- | --- |
| `summary` | 专业列表短展示 | `全日制 · 6 个学期` |
| `detail` | 完整说明入口内容 | `Full-Time Duration: 6 Semesters, (Clinical) — official page title is Doctor of Public Health (Mixed-Mode)` |
| `hasDetail` | 是否显示信息图标 | 长字段、备注、官方标题存在时为 `true` |
| `badges` | 可选辅助标签 | `Clinical`、`Mixed-Mode`、`Full-Time` |
| `source` | 可选来源说明 | `durationOfficial`、`auditNote` 或官方来源 |

推荐函数形态：

- `formatProgramDurationSummary(program, locale)`
- `formatProgramDurationDetail(program, locale)`
- 或 `formatProgramDurationDisplay(program, locale)` 一次返回完整对象。

`formatProgramDuration` 可继续作为兼容函数返回 `summary`，避免一次性改动所有调用点。

### 5.3 前端状态影响

如果信息入口使用点击式 popover，需要在 `UniversityPage.vue` 增加本地状态，例如：

- `activeDurationInfoProgramId: number | null`
- 或更轻量的 hover/focus CSS tooltip 状态。

该状态只应存在于学校详情页组件内部，不写入 URL、不写入 localStorage、不进入 Pinia store、不调用后端接口。切换 tab、打开专业详情、关闭模态框或点击页面其他区域时应关闭该信息提示。

### 5.4 交互结构影响

当前 `.programme-grid-row` 是 `<button>`。如果后续要在学制列中加入可点击的感叹号或信息图标，不能把新的 `<button>` 嵌套在已有 `<button>` 内。

推荐方案：

- 将列表行改为非 button 容器，例如 `<article>` 或 `<div role="button" tabindex="0">`。
- 行容器保留点击、Enter、Space 打开专业详情的能力。
- 信息图标使用真实 `<button>`，点击时 `stopPropagation`，只打开说明 popover。
- “详情”列也可以使用按钮或链接式控件打开专业详情。
- 样式继续复用 `.programme-grid-row`，保证视觉和历史布局稳定。

若实现任务选择纯 tooltip 且不提供点击入口，则必须证明移动端和键盘仍可访问；否则不满足 TASK-047 的验收边界。

## 6. 推荐实现方案

### 6.1 长字段拆分策略

后续 TASK-049 应采用“可解析摘要 + 完整详情保留”的策略：

1. 读取 `durationOfficial` 原文，清理空值、`undefined`、`[object Object]` 等无效值。
2. 通用识别学习模式：`Full-Time`、`Part-Time`、`Mixed-Mode`、`Coursework`、`Research`。
3. 通用识别学制长度：`6 Semesters`、`3 years`、`1.5 years` 等。
4. 通用识别补充标签：括号中的 `Clinical`、`Mixed-Mode` 等。
5. 通用识别官方标题备注：`official page title is ...` 这类说明进入 `detail`，不进入列表摘要。
6. 如果无法安全解析短摘要，列表显示 `officialPageFallback(locale)`，信息入口仍展示完整原文或说明。

该策略不能依赖具体专业名、具体学校、具体任务样本或静态 Demo 的固定字符串。可以识别通用模式，但不应写成 “Doctor of Public Health 专用规则”。

### 6.2 列表展示方案

专业列表学制列建议展示：

- 主体短文案：`全日制 · 6 个学期`、`6 个学期`、`1.5 年` 等。
- 如果存在详情：在短文案右侧显示信息图标或感叹号图标。
- 信息入口在 hover、focus、click 和移动端 tap 下可用。
- 信息内容至少包含原始完整说明、官方标题备注和相关审计说明；如内容较长，应在 popover 内换行并限制宽度。
- 列表不展示完整长原文，不让 `programme-pill` 因长文本撑开 7 列 Grid。

样式约束：

- 信息图标尺寸稳定，避免行高跳动。
- `programme-pill` 可允许内部短文案 `min-width: 0` 和省略，但不应只靠 `text-overflow` 隐藏完整信息。
- 1180px 以下仍遵守当前横向滚动策略；760px 以下若列表转为块状字段，需要确保图标和提示不遮挡字段 label。

### 6.3 专业详情模态框方案

专业详情模态框应限定在 `.program-detail-modal` 内优化，避免影响登录、费用计算、智能推荐等其他弹窗：

- 将专业详情模态框设为 `display: flex; flex-direction: column; overflow: hidden; max-height: min(92vh, ...);`。
- 将滚动边界放到 `.program-detail-modal .modal-body`，使用 `overflow-y: auto`、`min-height: 0` 和合理的 `scrollbar-gutter`。
- 保留 `.modal-header` sticky 或等价固定头部，但保证 header 与 body 的背景和阴影衔接自然。
- 使用响应式 padding，例如桌面 `24px` 至 `28px`，移动端不小于 `18px`，避免内容贴边。
- 对 `.req-grid`、`.modal-section`、`.program-doc-list`、`.curriculum-pills`、`.career-pills` 设置合理 gap 和 `overflow-wrap: anywhere`。
- 滚动条可以轻量美化或隐藏，但必须保留滚轮、键盘和触控滚动能力；不能让用户误以为内容不可滚动。

完整学制详情应在详情模态框中可见，例如：

- “官方学制”显示短摘要。
- 同一区块或“来源核验”区显示完整原文/官方标题备注。
- 如果原文已被格式化为短摘要，仍可通过“官方备注”“数据说明”或“来源核验”看到完整说明。

### 6.4 多语言和可访问性

后续实现必须继续通过格式化工具和 i18n 文案输出：

- 新增图标的 `aria-label`、popover 标题、关闭按钮或提示文案必须补齐 `en`、`ms`、`zh-CN`、`zh-TW`。
- 英文和马来文页面不得显示中文 fallback；简体和繁体页面不得直接泄漏未知英文长备注，除非该备注位于明确的官方原文区域。
- 信息图标应有可见 focus 状态。
- popover 应支持 `Escape` 关闭，点击外部关闭，或至少在失焦后关闭。
- 如果图标只用感叹号，必须有辅助文本或 `aria-label`，不能只依赖视觉符号。

## 7. 与已有能力的兼容关系

- 与 TASK-002 兼容：继续遵守专业列表 7 列 Grid、1180px 横向滚动、760px 以下移动端适配和静态页面弹窗规则。
- 与 TASK-047 兼容：保留完整详情入口，不用简单截断替代统一方案。
- 与 TASK-024、TASK-025、TASK-028 兼容：学校详情和专业详情视觉脚本可继续作为基线；后续只补充长字段和弹窗兼容样本。
- 与 TASK-030 至 TASK-042 兼容：新增文案和动态字段展示必须继续满足多语言、资产和视觉回归要求；已有开放 Review 问题不因本需求被覆盖。
- 与后端兼容：第一阶段不新增 API 字段、不改变实体、不影响公开展示状态。
- 与管理端兼容：不要求后台立即编辑“摘要/详情”字段；如产品需要结构化维护，应拆为后续任务。
- 与 TASK-051 至 TASK-054 兼容：UM 数据导入可能带来更多真实长字段样本，但导入链路本身不属于 TASK-049。

## 8. 风险和控制方式

| 风险 | 影响 | 控制方式 |
| --- | --- | --- |
| 只截断长字段 | 丢失官方标题、临床说明和审计信息 | 使用“摘要 + 完整详情入口”，完整内容在 popover 或详情模态框可见。 |
| 针对单个示例硬编码 | 后续其他专业长字段仍失败 | 只识别通用学制、学习模式、括号说明和官方标题备注模式。 |
| 在 row button 内嵌 button | HTML 语义错误、键盘和点击行为异常 | 若图标可点击，先把行改为非 button 容器并补齐键盘打开行为。 |
| tooltip 只支持 hover | 移动端和键盘不可用 | 信息入口必须支持 focus/click/tap，并有可见焦点。 |
| 模态框滚动改动过宽 | 误伤登录、费用计算、推荐等弹窗 | 选择器限定到 `.program-detail-modal`。 |
| 滚动条完全隐藏 | 用户不知道内容可滚动 | 保留滚动能力和视觉暗示，或做轻量美化而非无提示隐藏。 |
| 多语言 fallback 不一致 | 英文/马来文页面出现中文，繁体页面残留简体 | 新增测试覆盖四语言，并复用现有 formatter。 |
| 只验证一个专业 | 长内容、短内容、缺失字段仍可能出错 | 浏览器验证至少覆盖 5 类专业样本。 |

## 9. 后续实现步骤

TASK-049 建议按以下顺序执行：

1. 读取 TASK-047、本文档、TASK-002 视觉基线和当前 `UniversityPage.vue`、`format.ts`、`style.css`。
2. 在 `format.ts` 新增 `formatProgramDurationDisplay` 或等价纯函数，返回摘要、详情、是否展示信息入口和标签。
3. 在 `tests/web/format.test.ts` 增加真实长字段、普通字段、缺失字段和四语言样例。
4. 在 `UniversityPage.vue` 将专业列表学制列改为摘要 + 信息入口，并避免交互控件嵌套。
5. 在专业详情模态框中展示完整学制/官方标题/审计说明。
6. 在 `style.css` 限定调整 `.programme-*`、信息入口和 `.program-detail-modal` 样式。
7. 如现有视觉脚本覆盖不足，新增 TASK-049 专用 Playwright 脚本或扩展 `scripts/task025-program-visual.mjs`。
8. 运行单元测试、构建和浏览器验证，保存截图证据。
9. 记录与已有 Review issue 的关系：本任务只处理长字段和模态框，不顺手修复其他任务遗留问题。

## 10. 验证方式

### 10.1 本架构任务验证

本任务是中文技术方案文档任务，验证方式为：

- 人工检查本文档是否列出影响模块、文件范围、接口或数据结构。
- 人工检查本文档是否说明兼容关系、风险、验证方式和回滚边界。
- 运行 `npm run test`。
- 运行 `npm run build`。

### 10.2 后续 TASK-049 实现验证

实现任务至少需要运行：

- `npm run test`
- `npm run build`
- `npm run verify:task025` 或新增 `npm run verify:task049`

浏览器验证至少覆盖：

| 视口 | 页面/动作 | 验证点 |
| --- | --- | --- |
| `1440x1000` | `/universities/universiti-malaya-um`，切换本科/硕士/博士列表 | 长字段不撑开 7 列 Grid，摘要和信息图标清晰。 |
| `1180x900` | 同上 | 横向滚动边界稳定，无整页横向溢出。 |
| `900x900` | 同上 | 列表和弹窗不重叠，图标可点击。 |
| `760x900` | 同上 | 断点附近布局不跳动，字段 label 与值不遮挡。 |
| `390x844` | 移动端打开多个专业弹窗 | 模态框滚动在内部，内容不贴边，底部按钮可见或可滚动到。 |

专业样本至少覆盖：

- 包含 `Full-Time Duration`、`Clinical`、`official page title is ...` 的长字段专业。
- 普通短学制专业。
- 只包含 `durationYears` 或学制缺失的专业。
- 详情内容很长的专业，例如多段要求、材料、来源和职业方向。
- 详情内容较短的专业。

多语言验证至少覆盖：

- `zh-CN`：短摘要可读，完整说明入口存在。
- `zh-TW`：动态文本不残留明显简体。
- `en`：不出现中文 fallback。
- `ms`：长词不撑破列表或按钮。

数据校验：

- 打开专业详情前后，专业数量、排序、收藏状态、对比状态和规划按钮行为不变。
- `/api/universities/:slug` 和 `/api/programs/detail/:idOrSlug` 响应结构不因第一阶段实现改变。
- 如果后续新增 API 字段，必须补充共享契约测试和后端 mapper 测试。

建议截图保存：

- `output/playwright/task049-program-list-duration-desktop.png`
- `output/playwright/task049-program-list-duration-mobile.png`
- `output/playwright/task049-program-modal-long-desktop.png`
- `output/playwright/task049-program-modal-long-mobile.png`
- `output/playwright/task049-program-modal-short-mobile.png`
- `output/playwright/task049-program-duration-non-zh.png`

## 11. 回滚方案

如果 TASK-049 实现后出现视觉或交互回归，回滚应限定为：

- 回退 `apps/web/src/pages/UniversityPage.vue` 中专业列表长字段、信息入口和专业详情模态框展示相关改动。
- 回退 `apps/web/src/utils/format.ts` 中新增的 duration display helper 或兼容改动。
- 回退 `apps/web/src/style.css` 中 `.programme-*`、信息入口和 `.program-detail-modal` 相关样式。
- 回退 `tests/web/format.test.ts` 中与新 helper 强绑定的测试。
- 回退可能新增或修改的 TASK-049 浏览器验证脚本。

不需要回滚后端、数据库、管理端或共享类型，前提是 TASK-049 按第一阶段方案不修改这些层。如果后续确认新增 API 字段，应在独立数据契约任务中定义迁移和回滚策略。

## 12. Review 问题判断

当前 Review 统计中没有 TASK-048 专属未解决问题。已有开放问题主要属于 TASK-004、TASK-006、TASK-007、TASK-030 和 TASK-031：

- TASK-030 的 i18n 问题会影响后续四语言浏览器验证口径，但不阻塞本轮架构文档。
- TASK-006 的视觉 1:1 验收问题会影响全局视觉结论，但不改变本需求的实现边界。
- TASK-031 的图片 fallback 问题与专业长字段和模态框无直接关系。

后续 TASK-049 如果新增多语言文案或浏览器截图，应在报告中明确区分本需求修复结果和历史 Review 残留问题。

## 13. 结论

本新增需求适合按“用户端展示层优先、数据契约谨慎扩展”的方式处理。第一阶段不需要改后端接口或数据库，应在用户端通过通用格式化 helper 生成专业学制摘要、完整详情和信息入口，并把专业详情模态框滚动边界收敛到内部内容区域。后续实现的关键是保留官方完整说明、避免列表长字段撑破布局、覆盖多专业和多语言样本，并把改动严格限定在专业列表和专业详情模态框范围内。
