# TASK-025 专业列表和专业详情弹窗视觉 1:1 修复报告

## 验证范围

- 页面：`/universities/universiti-malaya-um`
- 静态参考：`D:\mydev\StudyMY_UM_v58_na_display_tidy.html`
- 最新截图输出：`output/playwright/task025-20260523T062934Z`
- 覆盖场景：UM 本科专业列表、首个专业详情弹窗
- 覆盖视口：桌面端 `1440x1000`、移动端 `390x844`

## 已修复项

- 专业列表标题、计数圆点、表格容器、7 列 grid、行按钮字体和 focus 状态对齐静态 HTML。
- 1180px 以下保留横向滚动，760px 以下专业行按 `data-label` 转为块状字段。
- 专业详情弹窗保留桌面居中、移动端贴底、`860px` 最大宽度和 `88vh` / `92vh` 高度规则。
- 弹窗章节顺序调整为费用与开学、入学要求、核心课程、职业方向、申请材料、官方来源。
- 官方来源区域补充费用状态、开学备注、资料备注和多来源链接展示。

## 剩余差异

- Vue 页面由 API 字段驱动；当接口没有完整官方字段时，弹窗会使用回退文案，静态 HTML 则直接读取内置数据。
- 静态 HTML 关闭按钮使用内联 SVG，Vue 页面仍使用现有文本关闭按钮并保持同等 `32px` 点击区域。
- 截图脚本记录 DOM 尺寸、grid、弹窗、材料、来源链接和文本溢出指标，不做逐像素相似度断言；最终仍需要结合截图人工抽样复核。

## 验证结果

- `npm run verify:task025`：通过，生成 8 张静态 HTML / Vue 对比截图。
- `npm run test`：通过，21 个测试全部通过。
- `npm run build`：通过；仅保留 Vite 对 admin 构建产物超过 500 kB 的体积提示。
- 最新脚本报告：`output/playwright/task025-20260523T062934Z/visual-diff-report.md`
- 最新 JSON 报告：`output/playwright/task025-20260523T062934Z/visual-diff-report.json`

## Notion 更新说明

本轮没有获得可写的 Notion 项目主页或任务页 ID，因此未直接更新 Notion。已将中文开发记录保存到本地仓库文档，并在自动截图报告中记录本轮修复项和剩余差异。
