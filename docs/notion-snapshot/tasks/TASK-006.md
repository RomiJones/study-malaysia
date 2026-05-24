# 任务：用户端页面结构与静态样式 1:1 还原

- **任务编号**: TASK-006
- **任务标题**: 用户端页面结构与静态样式 1:1 还原
- **状态**: 待评审
- **优先级**: 高
- **任务类型**: 前端
- **负责人**: Codex
- **关联需求**: 产品需求文档
- **关联技术方案**: 技术方案
- **实现说明**: 升级 apps/web，把静态 HTML 的页面结构和视觉风格迁移到 Vue 3 用户端，确保新页面外观与静态页面一致。
- **测试计划**: 启动用户端和静态 HTML，使用浏览器截图对比桌面端和移动端关键区域。
- **验证结果**: 已读取并分析静态 HTML `D:\mydev\StudyMY_UM_v58_na_display_tidy.html`；已结合旧系统 `D:\mydev\study-malaysia`；已新增中文规划文档 `docs/prd/TASK-006-user-web-static-style-restoration-plan.md`；已运行 `npm run build`，构建通过，管理端存在现有大 chunk 警告，不阻塞本任务。
- **阻塞说明**: 未更新实际 Notion。`NOTION_PROJECT_HOME` 为空，Notion 搜索未定位到可安全更新的 TASK-006 页面；已更新本地中文文档与本地 Notion 快照。

## 依赖任务
- TASK-002
- TASK-004

## 验收标准
- 用户端首页、搜索筛选区、院校/专业卡片、详情弹窗、工具弹窗与静态页面视觉一致。
- 字体、颜色、阴影、间距、圆角、按钮、卡片、弹窗和响应式表现与静态页面一致。
- 已完成浏览器截图或人工视觉对比记录。

## 关联 Commit

## 执行记录

### 2026-05-21T22:05:44.100Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-006-2026-05-21T22-05-44-096Z 已领取该任务。

### 2026-05-22T06:30:00+08:00 - 自动化运行 TASK-006-2026-05-21T22-05-44-096Z

- **状态**: 待评审
- **说明**: 已按任务强制要求只产出中文 PRD、功能清单、视觉规范、旧系统差距分析和后续任务拆解，未修改 `apps/web`、`apps/api`、`apps/admin` 的实现文件。
- **产出文档**: `docs/prd/TASK-006-user-web-static-style-restoration-plan.md`
- **静态页分析**: 静态页合并后包含 119 所院校、687 个专业，其中 ready 专业 239 个，本科 74 个、硕士 136 个、博士 29 个，ready 专业类别 46 类；CSS 包含 18 个根变量、10 条媒体查询、5 个关键动画。
- **旧系统分析**: 已核对用户端视觉 token、首页、筛选区、院校卡片、院校详情、专业详情、收藏、对比、规划、弹窗，以及 API 实体、共享类型和管理端表单，确认当前系统不能直接作为静态页 1:1 还原基准。
- **验证结果**: 已运行 `npm run build`，构建通过；管理端存在现有大 chunk 警告，不阻塞文档任务。
- **Notion 更新**: 未更新实际 Notion；已更新本地中文任务快照。

### 2026-05-21T22:13:14.724Z - 自动状态更新

- **状态**: 待评审
- **说明**: Codex 已完成实现并返回完成状态。

### 2026-05-24T20:24:19+08:00 - Review 自动修复 TASK-006-REVIEW-002

- **状态**: 待评审
- **修复范围**: 仅补充 `TASK-006-REVIEW-002` 要求的当轮视觉验收证据；未处理 `TASK-006-REVIEW-001` 和 `TASK-006-REVIEW-003`，未修改 `apps/web`、`apps/api`、`apps/admin` 实现文件。
- **验证命令**: 已运行 `npm run verify:task028`，通过；已运行 `npm run build`，通过，管理端仍存在既有大 chunk 警告。
- **截图与报告目录**: `D:\mydev\study-malaysia\output\playwright\task028-20260524T122419Z`
- **报告文件**: `D:\mydev\study-malaysia\output\playwright\task028-20260524T122419Z\visual-diff-report.md`、`D:\mydev\study-malaysia\output\playwright\task028-20260524T122419Z\visual-diff-report.json`
- **覆盖范围**: 同视口截图覆盖 `1440x1000` 桌面端和 `390x844` 移动端；包含首页首屏、首页筛选与院校卡片、院校详情概览、院校详情专业列表、专业详情弹窗、收藏页、对比页、规划页、登录弹窗、费用估算弹窗和智能推荐弹窗。
- **截图统计**: 共生成 52 张截图，形成 26 组静态 HTML 与 Vue 用户端对比；自动检查的阻塞项数量为 0，差异项数量为 0。
- **关键截图路径**:
  - 首页首屏：`output\playwright\task028-20260524T122419Z\static-home-desktop.png`、`output\playwright\task028-20260524T122419Z\web-home-desktop.png`、`output\playwright\task028-20260524T122419Z\static-home-mobile.png`、`output\playwright\task028-20260524T122419Z\web-home-mobile.png`
  - 搜索筛选区与院校卡片：`output\playwright\task028-20260524T122419Z\static-list-filter-desktop.png`、`output\playwright\task028-20260524T122419Z\web-list-filter-desktop.png`、`output\playwright\task028-20260524T122419Z\static-list-filter-mobile.png`、`output\playwright\task028-20260524T122419Z\web-list-filter-mobile.png`
  - 院校详情与专业列表：`output\playwright\task028-20260524T122419Z\static-university-overview-desktop.png`、`output\playwright\task028-20260524T122419Z\web-university-overview-desktop.png`、`output\playwright\task028-20260524T122419Z\static-university-programs-mobile.png`、`output\playwright\task028-20260524T122419Z\web-university-programs-mobile.png`
  - 专业详情弹窗：`output\playwright\task028-20260524T122419Z\static-program-modal-desktop.png`、`output\playwright\task028-20260524T122419Z\web-program-modal-desktop.png`、`output\playwright\task028-20260524T122419Z\static-program-modal-mobile.png`、`output\playwright\task028-20260524T122419Z\web-program-modal-mobile.png`
  - 工具弹窗：`output\playwright\task028-20260524T122419Z\static-calculator-modal-desktop.png`、`output\playwright\task028-20260524T122419Z\web-calculator-modal-desktop.png`、`output\playwright\task028-20260524T122419Z\static-recommend-modal-mobile.png`、`output\playwright\task028-20260524T122419Z\web-recommend-modal-mobile.png`
- **视觉结论**: 本轮证据已补齐 Review 要求的桌面端与移动端关键区域截图和自动差异结论；`TASK-006-REVIEW-002` 可关闭。由于本轮只修复测试证据缺失，任务级实现范围问题仍以 `TASK-006-REVIEW-001` 为准。
- **Notion 更新**: 未更新实际 Notion；本轮只更新本地中文任务快照和本地中文规划文档。
