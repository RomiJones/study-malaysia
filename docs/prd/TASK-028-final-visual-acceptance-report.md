# TASK-028 全页面视觉回归验收和差异收口报告

## 验收范围

- 任务：TASK-028 全页面视觉回归验收和差异收口。
- 静态参考：`D:\mydev\StudyMY_UM_v58_na_display_tidy.html`。
- Vue 用户端：`apps/web`。
- 最终截图输出：`output/playwright/task028-20260523T073331Z`。
- 覆盖视口：桌面端 `1440x1000`，移动端 `390x844`。
- 覆盖页面和弹窗：首页、院校列表、院校详情、专业列表、专业详情弹窗、收藏、对比、规划、登录弹窗、费用估算弹窗、智能推荐弹窗。

## 差异收口

- 新增 `npm run verify:task028`，执行静态 HTML 与 Vue 用户端最终全页面截图对比。
- 视觉脚本固定 mock API、收藏、对比、规划、费用估算、推荐和登录状态，避免本地数据库或浏览器状态影响截图。
- 收藏页已收口为更接近静态 HTML 的结构：标题区去掉卡片外框，收藏分组补计数圆点，专业收藏卡增加右侧查看和移除动作。
- 视觉脚本修正了收藏页、院校详情官方信息卡、专业弹窗操作区的选择器，确保两端对比的是同一语义组件。

## 最终截图清单

| 页面 | 桌面静态 HTML | 桌面 Vue | 移动静态 HTML | 移动 Vue | 差异说明 | 剩余风险 |
| --- | --- | --- | --- | --- | --- | --- |
| 首页首屏 | `static-home-desktop.png` | `web-home-desktop.png` | `static-home-mobile.png` | `web-home-mobile.png` | 自动指标无差异。 | 不做逐像素断言，仍需发布前抽样查看真实数据环境。 |
| 院校列表 | `static-list-filter-desktop.png` | `web-list-filter-desktop.png` | `static-list-filter-mobile.png` | `web-list-filter-mobile.png` | 自动指标无差异。 | mock API 的院校数量少于静态 HTML 全量数据。 |
| 院校详情 | `static-university-overview-desktop.png` | `web-university-overview-desktop.png` | `static-university-overview-mobile.png` | `web-university-overview-mobile.png` | 自动指标无差异。 | Vue 由接口字段驱动，真实数据库缺字段时仍会显示回退文案。 |
| 专业列表 | `static-university-programs-desktop.png` | `web-university-programs-desktop.png` | `static-university-programs-mobile.png` | `web-university-programs-mobile.png` | 自动指标无差异。 | 专业数量和具体费用字段以 mock API 固定数据为准。 |
| 专业详情弹窗 | `static-program-modal-desktop.png` | `web-program-modal-desktop.png` | `static-program-modal-mobile.png` | `web-program-modal-mobile.png` | 自动指标无差异，桌面居中和移动贴底均通过。 | 静态页与 Vue 示例专业不是同一个专业，文案内容不同但布局不受影响。 |
| 收藏 | `static-favorites-desktop.png` | `web-favorites-desktop.png` | `static-favorites-mobile.png` | `web-favorites-mobile.png` | 自动指标无差异；已完成明显结构差异收口。 | 收藏状态通过 localStorage 固定，未覆盖登录后服务端合并。 |
| 对比 | `static-compare-desktop.png` | `web-compare-desktop.png` | `static-compare-mobile.png` | `web-compare-mobile.png` | 自动指标无差异。 | 对比数据使用 2 所 mock 院校，未覆盖 4 所上限的拥挤状态。 |
| 规划申请概览 | `static-planner-overview-desktop.png` | `web-planner-overview-desktop.png` | `static-planner-overview-mobile.png` | `web-planner-overview-mobile.png` | 自动指标无差异。 | 规划数据为固定本地状态，未覆盖所有用户画像组合。 |
| 规划材料清单 | `static-planner-materials-desktop.png` | `web-planner-materials-desktop.png` | `static-planner-materials-mobile.png` | `web-planner-materials-mobile.png` | 自动指标无差异。 | 材料状态为固定样例。 |
| 规划签证清单 | `static-planner-visa-desktop.png` | `web-planner-visa-desktop.png` | `static-planner-visa-mobile.png` | `web-planner-visa-mobile.png` | 自动指标无差异。 | 签证状态为固定样例。 |
| 登录弹窗 | `static-auth-modal-desktop.png` | `web-auth-modal-desktop.png` | `static-auth-modal-mobile.png` | `web-auth-modal-mobile.png` | 自动指标无差异，桌面居中和移动贴底均通过。 | 未执行真实认证提交。 |
| 费用估算弹窗 | `static-calculator-modal-desktop.png` | `web-calculator-modal-desktop.png` | `static-calculator-modal-mobile.png` | `web-calculator-modal-mobile.png` | 自动指标无差异，桌面居中和移动贴底均通过。 | 费用结果使用前端和 mock 状态验收，不代表官方实时费用。 |
| 智能推荐弹窗 | `static-recommend-modal-desktop.png` | `web-recommend-modal-desktop.png` | `static-recommend-modal-mobile.png` | `web-recommend-modal-mobile.png` | 自动指标无差异，桌面居中和移动贴底均通过。 | 推荐结果使用 mock API 固定数据。 |

## 验证结果

- `npm run verify:task028`：通过，生成 52 张截图、26 组对比，阻塞级问题数 0，自动指标差异数 0。最新报告为 `output/playwright/task028-20260523T073331Z/visual-diff-report.md`。
- `npm run test`：通过，8 个测试套件、21 个测试全部通过。
- `npm run test:e2e`：通过，最新运行目录为 `output/e2e/task020-20260523T073851Z`。
- `npm run build`：通过；管理端仍保留既有 Vite chunk 体积警告。

## E2E 收口说明

- E2E 首次失败点为用户端流程中的旧选择器：院校卡片操作按钮已从 `.ghost-action` 调整为 `.icon-action`，收藏页院校卡片已使用 `.favorite-university-card`。
- E2E 第二次失败点为旧流程假设详情页默认可见专业行；当前详情页需要先切换到对应学历标签页。
- 已将 `scripts/run-e2e.mjs` 更新为兼容当前 UI 结构，并根据测试专业 `level` 切换本科、硕士或博士标签页。

## 剩余风险

- 本任务使用 mock API 与 localStorage 固定视觉状态，适合视觉验收，但不替代真实数据库全量数据验收。
- 截图脚本检查整页横向溢出、文本溢出、关键元素缺失、弹窗居中和贴底状态，不做逐像素相似度断言。
- 静态 HTML 与 Vue 示例专业并非完全同一条数据，文案和费用数字差异不影响布局验收结论。
- 实际 Notion 未更新；本轮中文验收记录写入本地 `docs/prd` 文档。
