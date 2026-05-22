# TASK-021 视觉回归、全量验收和发布前修复收口报告

## 1. 文档信息

- **任务编号**: TASK-021
- **任务标题**: 视觉回归、全量验收和发布前修复收口
- **运行编号**: TASK-021-2026-05-22T20-19-16-625Z
- **项目路径**: `D:\mydev\study-malaysia`
- **静态 HTML 基准**: `D:\mydev\StudyMY_UM_v58_na_display_tidy.html`
- **报告时间**: 2026-05-23T04:27:16+08:00
- **结论状态**: 待评审 / 发布前可复核

## 2. 结论摘要

本轮已完成发布前全量收口验证：静态 HTML 数据校验、数据库导入复核、单元/集成测试、E2E 功能测试、全量构建和桌面/移动视觉截图均已执行。

静态 HTML 基准和数据库统计一致：119 所院校、687 个专业、239 个 ready 专业、240 个官方 MYR 学费、248 个官方费用来源、245 个官方开学时间。重复执行静态导入后没有新增或裁剪记录，说明导入脚本保持幂等。

自动化测试和构建均通过。管理端构建仍有既有 Vite chunk 体积警告，不阻塞构建。视觉截图已生成 28 张，覆盖静态页和用户端的首页、列表、院校详情、专业详情弹窗、对比、规划和登录弹窗在桌面与移动视口的表现。

本轮没有修改业务代码。新增了 TASK-021 专用视觉截图脚本，用于可重复生成发布前视觉回归证据。

## 3. 自动化错误复核

Automation Error Context 中 5 个未解决错误均来自 TASK-009，不是 TASK-021 新失败。已复核最近日志和本轮执行结果：

- `ERR-2026-05-22T13-55-47-331Z-21b12cb752`: 旧自动化 CLI 使用不兼容模型 `gpt-5.5`，属于运行器环境问题。
- `ERR-2026-05-22T14-04-22-867Z-1ff8772e2d`: 日志显示 TASK-009 文档产出已完成，失败更接近状态解析或结果收敛问题。
- `ERR-2026-05-22T14-07-17-346Z-f25b58c0cb`: 日志显示构建和报告已执行，失败不代表当前业务代码不可验证。
- `ERR-2026-05-22T15-52-36-592Z-a8f2fba8d5`: 日志显示构建、接口验证和截图已完成，属于历史运行器收口问题。
- `ERR-2026-05-22T16-04-26-528Z-f460e53509`: 日志显示 TASK-009 已完成截图和报告更新，但视觉结论为有风险，不影响本轮重新验收。

本轮已通过当前 Codex 会话直接执行所有验证命令，并以结构化最终结果规避历史结果解析失败。

## 4. 数据导入和统计复核

### 4.1 静态 HTML 基准校验

命令：

`npm run check:static`

结果：通过。

关键统计：

| 指标 | 数值 |
| --- | ---: |
| 院校数量 | 119 |
| 专业数量 | 687 |
| ready 专业 | 239 |
| 官方 MYR 学费 | 240 |
| 官方费用来源 URL | 248 |
| 官方开学时间 | 245 |
| ready 本科 | 74 |
| ready 硕士 | 136 |
| ready 博士 | 29 |
| ready 专业类别 | 46 |

### 4.2 数据库统计校验

首次直接运行数据库校验时，`.env` 中 MySQL 端口 5306 拒绝连接。按 TASK-020 E2E 已验证的方式改用本机 3306 后通过。

命令：

`$env:MYSQL_PORT='3306'; npm --workspace @studymy/api run check:static -- --db`

结果：通过。

数据库统计：

| 指标 | 数据库 | 静态 HTML | 结论 |
| --- | ---: | ---: | --- |
| 院校数量 | 119 | 119 | 一致 |
| 专业数量 | 687 | 687 | 一致 |
| ready 专业 | 239 | 239 | 一致 |
| 官方 MYR 学费 | 240 | 240 | 一致 |
| 官方费用来源 URL | 248 | 248 | 一致 |
| 官方开学时间 | 245 | 245 | 一致 |

### 4.3 静态导入复核

命令：

`$env:MYSQL_PORT='3306'; npm run import:static`

结果：通过。

导入摘要：

- `createdUniversities`: 0
- `updatedUniversities`: 119
- `createdPrograms`: 0
- `updatedPrograms`: 687
- `prunedUniversities`: 0
- `prunedPrograms`: 0
- `dbValidation.ok`: true

## 5. 测试和构建结果

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `npm run test` | 通过 | 8 个测试套件、21 个测试全部通过 |
| `npm run test:e2e` | 通过 | 运行目录 `output/e2e/task020-20260522T202108Z`；测试库已清理 |
| `npm run build` | 通过 | API、用户端、管理端和 shared workspace 均构建成功 |
| `node --check scripts/task021-visual-regression.mjs` | 通过 | TASK-021 视觉脚本语法检查通过 |
| `node scripts/task021-visual-regression.mjs` | 通过 | 生成 28 张桌面/移动截图 |

构建备注：管理端仍提示 chunk 超过 500 kB，这是既有 Vite 体积警告，不影响本轮构建通过。

## 6. 视觉截图记录

截图目录：

`output/playwright/task021-20260522T202601Z`

截图报告：

`output/playwright/task021-20260522T202601Z/visual-regression-report.json`

覆盖范围：

| 场景 | 静态 HTML 截图 | 用户端截图 | 视口 |
| --- | --- | --- | --- |
| 首页首屏 | `static-home-desktop.png` | `web-home-desktop.png` | 1440x1000 |
| 筛选列表 | `static-list-desktop.png` | `web-list-desktop.png` | 1440x1000 |
| 院校详情 | `static-university-desktop.png` | `web-university-desktop.png` | 1440x1000 |
| 专业详情弹窗 | `static-program-modal-desktop.png` | `web-program-modal-desktop.png` | 1440x1000 |
| 对比页 | `static-compare-desktop.png` | `web-compare-desktop.png` | 1440x1000 |
| 规划页 | `static-planner-desktop.png` | `web-planner-desktop.png` | 1440x1000 |
| 登录弹窗 | `static-auth-desktop.png` | `web-auth-desktop.png` | 1440x1000 |
| 首页首屏 | `static-home-mobile.png` | `web-home-mobile.png` | 390x844 |
| 筛选列表 | `static-list-mobile.png` | `web-list-mobile.png` | 390x844 |
| 院校详情 | `static-university-mobile.png` | `web-university-mobile.png` | 390x844 |
| 专业详情弹窗 | `static-program-modal-mobile.png` | `web-program-modal-mobile.png` | 390x844 |
| 对比页 | `static-compare-mobile.png` | `web-compare-mobile.png` | 390x844 |
| 规划页 | `static-planner-mobile.png` | `web-planner-mobile.png` | 390x844 |
| 登录弹窗 | `static-auth-mobile.png` | `web-auth-mobile.png` | 390x844 |

抽样查看结果：关键截图均不是空白页或错误页；首页、筛选列表、院校详情、专业详情弹窗、对比、规划和登录弹窗均能渲染。

## 7. 视觉差异和剩余风险

- 用户端首页统计按公开展示口径显示 239 个 ready 专业；静态页首屏文案显示 687+ 专业项目。数据库层面两者一致，差异来自用户端公开展示口径。
- 用户端顶部导航包含语言切换和当前实现的品牌副标题，静态页没有完全相同的控件组合；该差异需要产品确认是否作为发布前可接受差异。
- 首页 Hero、筛选侧栏、院校详情深色 Hero、专业弹窗、对比页和规划页已保留静态页核心视觉结构，但不是逐像素一致。
- 管理端构建存在既有 chunk 体积警告；建议后续用动态导入或 manualChunks 优化，但不阻塞本轮发布前验收。
- `.env` 默认 MySQL 端口 5306 在本机不可用，本轮验证均通过显式 `MYSQL_PORT=3306` 或 E2E 自动回退完成；发布前应确认目标环境数据库端口配置。

## 8. 发布前建议

- 发布前以 `MYSQL_PORT`、`VITE_API_BASE_URL`、`VITE_ADMIN_API_BASE_URL` 为重点复核目标环境变量。
- 保留 `output/playwright/task021-20260522T202601Z` 作为本轮视觉回归证据。
- 管理端 chunk 警告可进入后续性能优化任务，不建议在本轮扩大范围。
- 如果产品要求静态页文案和当前用户端逐字一致，需要单独开视觉文案对齐任务；本轮未发现会阻塞自动化测试和构建的缺陷。

## 9. Notion 更新说明

已尝试通过 Notion 搜索 `TASK-021 视觉回归 全量验收 发布前修复收口 study-malaysia`，只返回无关页面，未定位到可安全更新的真实 TASK-021 页面。真实 Notion 未更新。本轮更新本地中文任务快照和本报告作为验收记录。
