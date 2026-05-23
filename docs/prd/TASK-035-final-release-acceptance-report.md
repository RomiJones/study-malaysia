# TASK-035 前端细节最终验收和可发布检查报告

## 验收范围

- 任务：TASK-035 前端细节最终验收和可发布检查。
- 执行时间：2026-05-24T07:26:53+08:00。
- 静态参考：`D:\mydev\StudyMY_UM_v58_na_display_tidy.html`，本轮可访问。
- Vue 用户端：`apps/web`。
- 本轮新增测试脚本：`scripts/task035-final-release-audit.mjs`。
- 覆盖页面和状态：首页首屏、筛选列表、院校详情、专业列表、专业详情弹窗、收藏、对比、规划、登录弹窗、费用估算弹窗、智能推荐弹窗、四语言页面、移动端图片 fallback。

## Review 问题复核

- `TASK-030-REV-005`：英文页面显示中文分类值。已通过 `formatCategoryLabel` 中文别名和关键字映射、单元测试、TASK-035 四语言浏览器抽查复核；英文和马来文页面未再显示 `理科`、`商科` 等原始中文分类。
- `TASK-030-REV-006`：繁体页面动态数据残留简体字。已通过动态样本单元测试和 TASK-035 繁体浏览器抽查复核；未再命中 `软件`、`责任`、`农业`、`公开信息` 等已知残留。
- `TASK-030-REV-007`：用户端错误提示透出英文后端错误。已通过 TASK-035 登录错误态浏览器抽查复核；后端 mock 返回 `Invalid account or method` 时，中文页面显示 `认证失败`。
- `TASK-031-ASSET-001`：院校封面 fallback 仍显示默认破图图标和 alt 文本。已通过全页面截图和 TASK-035 移动端资产抽查复核；失败图片渲染为设计占位层，未检测到可见破图 `img`。

## 自动化验证结果

| 命令 | 结果 | 关键输出 |
| --- | --- | --- |
| `npm run test` | 通过 | 9 个测试套件、30 个用例全部通过。 |
| `npm run test:e2e` | 通过 | 输出目录 `output/e2e/task020-20260523T231853Z`，API、用户端、管理端核心流程通过。 |
| `npm run verify:task028` | 通过 | 输出目录 `output/playwright/task028-20260523T231701Z`，52 张截图、26 组对比、阻塞级问题 0、自动差异 0。 |
| `node scripts/task035-final-release-audit.mjs` | 通过 | 输出目录 `output/playwright/task035-20260523T232409Z`，10 张截图、5 类专项检查通过。 |
| `npm run build` | 通过 | API、Web、Admin、Shared 构建通过；管理端仍有既有 chunk 大小警告。 |

## 截图和报告

- 全页面视觉报告：`output/playwright/task028-20260523T231701Z/visual-diff-report.md`。
- 全页面视觉 JSON：`output/playwright/task028-20260523T231701Z/visual-diff-report.json`。
- TASK-035 专项 JSON：`output/playwright/task035-20260523T232409Z/task035-final-release-audit.json`。
- TASK-035 专项截图：`home-zh-CN.png`、`home-zh-TW.png`、`home-en.png`、`home-ms.png`、`program-modal-*.png`、`auth-error-zh-CN.png`、`mobile-home-assets.png`。
- 人工抽查截图：`web-home-desktop.png`、`web-list-filter-mobile.png`、`web-program-modal-mobile.png`、`web-auth-modal-desktop.png`、`program-modal-en.png`、`program-modal-zh-TW.png`、`auth-error-zh-CN.png`、`mobile-home-assets.png`。

## 细节验收结论

- 数据展示：未检测到明显 `undefined`、`[object Object]`、动态 i18n key 或空白核心字段；费用、学制、语言、开学时间和官方来源 fallback 正常。
- 翻译文案：已识别支持语言 `zh-CN`、`zh-TW`、`en`、`ms`；四语言首页和专业弹窗专项抽查通过。
- 卡片和按钮：桌面端和移动端院校卡片、收藏/对比按钮、分页、筛选标签和详情按钮未发现错位或文本溢出。
- 表格和列表：专业列表和对比表在全页面视觉脚本中通过横向溢出、文本溢出和关键元素检查。
- 弹窗状态：专业详情、登录、费用估算和智能推荐弹窗通过桌面居中、移动贴底和关闭检查；登录错误态不透出英文后端错误。
- 空状态和加载错误：已有单元测试和视觉回归覆盖，未发现阻塞级异常。
- 移动端布局：390x844 视口全页面截图和 TASK-035 移动端专项抽查通过，无整页横向溢出。
- 资产：TASK-035 mock 破图场景触发设计 fallback，占位层可见，未检测到 `naturalWidth === 0` 的可见破图图片。

## 剩余风险

- 全页面视觉脚本以关键元素、溢出、弹窗布局和截图证据为主，不做逐像素相似度断言。
- 视觉回归使用 mock API 固定状态，不能替代发布环境真实全量数据库的最终冒烟。
- 管理端构建仍有既有 Vite chunk 大小警告，当前不阻塞发布检查，但后续可做性能拆包优化。
- 真实 Notion 未更新：`NOTION_PROJECT_HOME` 为空，Notion 搜索 `TASK-035 前端细节最终验收和可发布检查` 未定位到项目任务页；本轮已更新本地中文任务快照和本报告。

## 发布判断

本轮 TASK-035 验收通过。当前未发现明显 `undefined`、缺失翻译 key、文本溢出、按钮错位、弹窗不可关闭、破图 alt 暴露或核心流程不可用问题。建议进入待评审 / 可发布确认状态。
