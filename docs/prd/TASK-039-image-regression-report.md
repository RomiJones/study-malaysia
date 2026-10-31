# TASK-039 图片资产全页面回归与外链清理验收报告

## 摘要

- **任务编号**: TASK-039
- **运行编号**: task039-20260524T105314Z
- **生成时间**: 2026-05-24T10:54:09.118Z
- **状态**: passed
- **静态 HTML**: `D:\mydev\StudyMY_UM_v58_na_display_tidy.html`
- **用户端地址**: `http://127.0.0.1:5200`
- **输出目录**: `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z`

## 验收结论

- 覆盖页面和弹窗：首页首屏、院校列表、院校详情、专业列表、专业详情弹窗、收藏页、对比页、规划页、登录弹窗、费用计算弹窗、推荐弹窗。
- 覆盖视口：桌面端 1440x1000、移动端 390x844。
- DOM 图片检查总数：82，其中可见图片 82。
- 本地图片请求数：297。
- 外部运行时图片请求数：0。
- 失败图片请求数：0。
- 可见破图数：0。
- TASK-031-ASSET-001 复核状态：已验证通过。

## 阻塞问题

- 未发现图片加载、外链图片请求、图片 404、可见破图或移动端图片横向溢出阻塞。

## 页面检查明细

| 页面 | 视口 | DOM 图片 | 外链图片请求 | 失败图片 | 破图 | fallback | Vue 截图 | 静态截图 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 首页首屏 | 桌面端 1440x1000 | 6 | 0 | 0 | 0 | 4 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-home-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-home-static.png` |
| 院校列表 | 桌面端 1440x1000 | 6 | 0 | 0 | 0 | 4 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-university-list-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-university-list-static.png` |
| 院校详情 | 桌面端 1440x1000 | 1 | 0 | 0 | 0 | 1 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-university-detail-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-university-detail-static.png` |
| 专业列表 | 桌面端 1440x1000 | 1 | 0 | 0 | 0 | 1 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-program-list-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-program-list-static.png` |
| 专业详情弹窗 | 桌面端 1440x1000 | 1 | 0 | 0 | 0 | 1 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-program-modal-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-program-modal-static.png` |
| 收藏页 | 桌面端 1440x1000 | 2 | 0 | 0 | 0 | 2 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-favorites-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-favorites-static.png` |
| 对比页 | 桌面端 1440x1000 | 2 | 0 | 0 | 0 | 2 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-compare-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-compare-static.png` |
| 规划页 | 桌面端 1440x1000 | 2 | 0 | 0 | 0 | 2 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-planner-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-planner-static.png` |
| 登录弹窗 | 桌面端 1440x1000 | 6 | 0 | 0 | 0 | 4 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-auth-modal-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-auth-modal-static.png` |
| 费用计算弹窗 | 桌面端 1440x1000 | 6 | 0 | 0 | 0 | 4 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-calculator-modal-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-calculator-modal-static.png` |
| 推荐弹窗 | 桌面端 1440x1000 | 8 | 0 | 0 | 0 | 6 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-recommend-modal-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/desktop-recommend-modal-static.png` |
| 首页首屏 | 移动端 390x844 | 6 | 0 | 0 | 0 | 4 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-home-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-home-static.png` |
| 院校列表 | 移动端 390x844 | 6 | 0 | 0 | 0 | 4 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-university-list-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-university-list-static.png` |
| 院校详情 | 移动端 390x844 | 1 | 0 | 0 | 0 | 1 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-university-detail-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-university-detail-static.png` |
| 专业列表 | 移动端 390x844 | 1 | 0 | 0 | 0 | 1 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-program-list-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-program-list-static.png` |
| 专业详情弹窗 | 移动端 390x844 | 1 | 0 | 0 | 0 | 1 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-program-modal-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-program-modal-static.png` |
| 收藏页 | 移动端 390x844 | 2 | 0 | 0 | 0 | 2 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-favorites-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-favorites-static.png` |
| 对比页 | 移动端 390x844 | 2 | 0 | 0 | 0 | 2 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-compare-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-compare-static.png` |
| 规划页 | 移动端 390x844 | 2 | 0 | 0 | 0 | 2 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-planner-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-planner-static.png` |
| 登录弹窗 | 移动端 390x844 | 6 | 0 | 0 | 0 | 4 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-auth-modal-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-auth-modal-static.png` |
| 费用计算弹窗 | 移动端 390x844 | 6 | 0 | 0 | 0 | 4 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-calculator-modal-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-calculator-modal-static.png` |
| 推荐弹窗 | 移动端 390x844 | 8 | 0 | 0 | 0 | 6 | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-recommend-modal-web.png` | `D:/mydev/study-malaysia/output/playwright/task039-20260524T105314Z/mobile-recommend-modal-static.png` |

## 图片尺寸、裁切和 fallback 记录

### 首页首屏 / 桌面端 1440x1000

- Vue 可见图片：6，尺寸范围：200x294, 40x40。
- 静态参考可见图片：16，尺寸范围：200x224, 40x40。
- Vue fallback 状态：本地 fallback 图片 4 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 16，Vue 可见 img 数 6；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 4 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 院校列表 / 桌面端 1440x1000

- Vue 可见图片：6，尺寸范围：200x294, 40x40。
- 静态参考可见图片：2，尺寸范围：200x224, 40x40。
- Vue fallback 状态：本地 fallback 图片 4 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 2，Vue 可见 img 数 6；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 4 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 院校详情 / 桌面端 1440x1000

- Vue 可见图片：1，尺寸范围：60x60。
- 静态参考可见图片：1，尺寸范围：60x60。
- Vue fallback 状态：本地 fallback 图片 1 个，fallback 元素 0 个。
- 可接受差异：Vue 使用 1 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 专业列表 / 桌面端 1440x1000

- Vue 可见图片：1，尺寸范围：60x60。
- 静态参考可见图片：1，尺寸范围：60x60。
- Vue fallback 状态：本地 fallback 图片 1 个，fallback 元素 0 个。
- 可接受差异：Vue 使用 1 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 专业详情弹窗 / 桌面端 1440x1000

- Vue 可见图片：1，尺寸范围：60x60。
- 静态参考可见图片：1，尺寸范围：60x60。
- Vue fallback 状态：本地 fallback 图片 1 个，fallback 元素 0 个。
- 可接受差异：Vue 使用 1 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 收藏页 / 桌面端 1440x1000

- Vue 可见图片：2，尺寸范围：40x40。
- 静态参考可见图片：1，尺寸范围：40x40。
- Vue fallback 状态：本地 fallback 图片 2 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 1，Vue 可见 img 数 2；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 2 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 对比页 / 桌面端 1440x1000

- Vue 可见图片：2，尺寸范围：36x36。
- 静态参考可见图片：0，尺寸范围：无可见 img。
- Vue fallback 状态：本地 fallback 图片 2 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 0，Vue 可见 img 数 2；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 2 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 规划页 / 桌面端 1440x1000

- Vue 可见图片：2，尺寸范围：40x40。
- 静态参考可见图片：0，尺寸范围：无可见 img。
- Vue fallback 状态：本地 fallback 图片 2 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 0，Vue 可见 img 数 2；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 2 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 登录弹窗 / 桌面端 1440x1000

- Vue 可见图片：6，尺寸范围：200x294, 40x40。
- 静态参考可见图片：16，尺寸范围：200x224, 40x40。
- Vue fallback 状态：本地 fallback 图片 4 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 16，Vue 可见 img 数 6；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 4 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 费用计算弹窗 / 桌面端 1440x1000

- Vue 可见图片：6，尺寸范围：200x294, 40x40。
- 静态参考可见图片：16，尺寸范围：200x224, 40x40。
- Vue fallback 状态：本地 fallback 图片 4 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 16，Vue 可见 img 数 6；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 4 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 推荐弹窗 / 桌面端 1440x1000

- Vue 可见图片：8，尺寸范围：200x294, 40x40。
- 静态参考可见图片：0，尺寸范围：无可见 img。
- Vue fallback 状态：本地 fallback 图片 6 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 0，Vue 可见 img 数 8；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 6 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 首页首屏 / 移动端 390x844

- Vue 可见图片：6，尺寸范围：364x160, 40x40。
- 静态参考可见图片：16，尺寸范围：388x160, 40x40。
- Vue fallback 状态：本地 fallback 图片 4 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 16，Vue 可见 img 数 6；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 4 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 院校列表 / 移动端 390x844

- Vue 可见图片：6，尺寸范围：364x160, 40x40。
- 静态参考可见图片：2，尺寸范围：388x160, 40x40。
- Vue fallback 状态：本地 fallback 图片 4 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 2，Vue 可见 img 数 6；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 4 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 院校详情 / 移动端 390x844

- Vue 可见图片：1，尺寸范围：52x52。
- 静态参考可见图片：1，尺寸范围：60x60。
- Vue fallback 状态：本地 fallback 图片 1 个，fallback 元素 0 个。
- 可接受差异：Vue 使用 1 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 专业列表 / 移动端 390x844

- Vue 可见图片：1，尺寸范围：52x52。
- 静态参考可见图片：1，尺寸范围：60x60。
- Vue fallback 状态：本地 fallback 图片 1 个，fallback 元素 0 个。
- 可接受差异：Vue 使用 1 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 专业详情弹窗 / 移动端 390x844

- Vue 可见图片：1，尺寸范围：52x52。
- 静态参考可见图片：1，尺寸范围：60x60。
- Vue fallback 状态：本地 fallback 图片 1 个，fallback 元素 0 个。
- 可接受差异：Vue 使用 1 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 收藏页 / 移动端 390x844

- Vue 可见图片：2，尺寸范围：40x40。
- 静态参考可见图片：1，尺寸范围：40x40。
- Vue fallback 状态：本地 fallback 图片 2 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 1，Vue 可见 img 数 2；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 2 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 对比页 / 移动端 390x844

- Vue 可见图片：2，尺寸范围：36x36。
- 静态参考可见图片：0，尺寸范围：无可见 img。
- Vue fallback 状态：本地 fallback 图片 2 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 0，Vue 可见 img 数 2；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 2 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 规划页 / 移动端 390x844

- Vue 可见图片：2，尺寸范围：40x40。
- 静态参考可见图片：0，尺寸范围：无可见 img。
- Vue fallback 状态：本地 fallback 图片 2 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 0，Vue 可见 img 数 2；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 2 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 登录弹窗 / 移动端 390x844

- Vue 可见图片：6，尺寸范围：364x160, 40x40。
- 静态参考可见图片：16，尺寸范围：388x160, 40x40。
- Vue fallback 状态：本地 fallback 图片 4 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 16，Vue 可见 img 数 6；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 4 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 费用计算弹窗 / 移动端 390x844

- Vue 可见图片：6，尺寸范围：364x160, 40x40。
- 静态参考可见图片：16，尺寸范围：388x160, 40x40。
- Vue fallback 状态：本地 fallback 图片 4 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 16，Vue 可见 img 数 6；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 4 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

### 推荐弹窗 / 移动端 390x844

- Vue 可见图片：8，尺寸范围：364x160, 40x40。
- 静态参考可见图片：0，尺寸范围：无可见 img。
- Vue fallback 状态：本地 fallback 图片 6 个，fallback 元素 0 个。
- 可接受差异：静态参考可见 img 数 0，Vue 可见 img 数 8；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。
- 可接受差异：Vue 使用 6 个本地 fallback 图片和 0 个 fallback 元素，未检测到破图图标。

## 剩余视觉差异与建议

- 静态 HTML 原始图片引用包含外部 Unsplash/Wikimedia/官网图片；本脚本在静态参考截图中用本地占位资产替换远程图片请求，仅用于观察尺寸、裁切和页面位置。
- Vue 用户端运行时图片全部来自本地 /assets/static-html 或组件 fallback，目标是消除破图和外链请求，不做逐像素图片内容一致性断言。
- 登录、费用估算等弹窗主要使用 CSS 图标与装饰，不一定包含 img 标签；本轮按网络请求、CSS 图标加载和截图完整性验收。

## Notion 更新说明

- 本轮没有可写入的真实 Notion 页面 URL，未直接更新 Notion；已生成本地中文验收报告，可由后续同步流程写回任务页。
