# 自动化 Review 问题统计

- **项目目录**: D:\mydev\study-malaysia
- **更新时间**: 2026-05-26T06:17:30.531Z
- **问题总数**: 180
- **Open**: 91
- **Fixing**: 3
- **Fixed**: 27
- **Verified**: 56
- **Blocked**: 3

## 待处理问题

| ID | 任务 | 分类 | 严重度 | 状态 | 可自动修复 | 标题 |
| --- | --- | --- | --- | --- | --- | --- |
| TASK-105-REV-001 | TASK-105 需要注意多语言下的样式变形的问题落地：多语言文案一致性拆分 | automation | medium | open | 否 | TASK-105 实现结果提交指针指向无关提交 |
| TASK-099-REV-001 | TASK-099 新增需求边界、验收标准和依赖规划补充：多语言文案一致性拆分 | automation | medium | open | 否 | 实现结果提交指针与 TASK-099 实际提交不一致 |
| TASK-088-REV-002 | TASK-088 新增需求边界和验收标准补充：Notion 后端 API 和服务拆分 | automation | medium | blocked | 否 | 实现结果中的提交指针不一致 |
| TASK-088-REV-002 | TASK-088 新增需求边界和验收标准补充：Notion 后端 API 和服务拆分 | automation | medium | open | 否 | 实现结果中的提交指针不一致 |
| TASK-082-REV-002 | TASK-082 新增需求边界、验收标准和依赖规划补充：Notion 用户端页面和交互拆分 | automation | medium | blocked | 否 | TASK-082 拆分范围把 Notion 误生成为用户端业务功能 |
| TASK-090-REV-002 | TASK-090 新增需求边界和验收标准补充：文件或 后端 API 和服务拆分 | automation | low | blocked | 否 | TASK-090 与 TASK-089 范围和提交归属仍未解决 |
| TASK-082-REV-002 | TASK-082 新增需求边界、验收标准和依赖规划补充：Notion 用户端页面和交互拆分 | automation | medium | open | 否 | TASK-082 拆分范围把 Notion 误生成为用户端业务功能 |
| TASK-090-REV-002 | TASK-090 新增需求边界和验收标准补充：文件或 后端 API 和服务拆分 | automation | low | open | 否 | TASK-090 与 TASK-089 范围和提交归属存在自动化风险 |
| TASK-005-REV-001 | TASK-005 管理端字段维护与内容管理升级 | functional | high | open | 否 | 本轮交付没有实现管理端字段维护验收 |
| TASK-005-REV-002 | TASK-005 管理端字段维护与内容管理升级 | test | medium | open | 否 | 缺少管理端表单和 API 保存回归验证 |
| TASK-029-REVIEW-001 | TASK-029 前端数据展示口径与字段兜底修复 | functional | high | open | 是 | 缺少官方费用来源时仍会展示自动生成的 CNY 学费 |
| TASK-028-REVIEW-001 | TASK-028 全页面视觉回归验收和差异收口 | responsive | high | open | 是 | 移动端对比表格未按静态基准收口 |
| TASK-028-REVIEW-002 | TASK-028 全页面视觉回归验收和差异收口 | automation | medium | open | 是 | 视觉脚本在存在未批准差异时仍返回 passed |
| TASK-026-REVIEW-001 | TASK-026 收藏、对比、规划、费用计算、推荐和登录弹窗视觉 1:1 修复 | responsive | high | open | 是 | 移动端对比表格横向溢出，无法同屏比较院校 |
| TASK-026-REVIEW-002 | TASK-026 收藏、对比、规划、费用计算、推荐和登录弹窗视觉 1:1 修复 | automation | medium | open | 是 | 截图验证脚本在明显差异存在时仍返回 passed |
| TASK-024-REVIEW-001 | TASK-024 院校详情页视觉 1:1 修复 | visual | high | open | 是 | 核心截图仍与静态 HTML 存在明显差异 |
| TASK-024-REVIEW-002 | TASK-024 院校详情页视觉 1:1 修复 | automation | high | open | 是 | 截图对比脚本检测到差异仍返回 passed |
| TASK-023-REV-001 | TASK-023 首页、院校列表和筛选区视觉 1:1 修复 | automation | high | open | 是 | 视觉验证脚本当前无法完整复跑 |
| TASK-023-REV-002 | TASK-023 首页、院校列表和筛选区视觉 1:1 修复 | automation | high | open | 是 | 列表筛选截图被滚动状态污染 |
| TASK-023-REV-003 | TASK-023 首页、院校列表和筛选区视觉 1:1 修复 | visual | medium | open | 是 | 列表和筛选区差异未达到显著收敛 |
| TASK-022-REVIEW-001 | TASK-022 全页面视觉截图基线与差异清单 | automation | high | open | 是 | 专业详情弹窗截图场景未切换专业标签导致复跑失败 |
| TASK-018-REVIEW-I18N-001 | TASK-018 用户端收藏规划画像申请任务落地 | i18n | high | open | 是 | 英文界面混入大量中文文案 |
| TASK-018-REVIEW-TEST-001 | TASK-018 用户端收藏规划画像申请任务落地 | test | medium | open | 是 | 缺少 store 或 API client 自动化测试 |
| TASK-020-REVIEW-001 | TASK-020 端到端功能测试和测试数据闭环落地 | test | high | open | 是 | 管理端字段维护没有走管理端 UI 流程 |
| TASK-020-REVIEW-002 | TASK-020 端到端功能测试和测试数据闭环落地 | automation | medium | open | 是 | 失败路径不会默认清理 E2E 测试库 |
| TASK-021-REVIEW-001 | TASK-021 视觉回归、全量验收和发布前修复收口 | automation | high | open | 是 | 视觉回归脚本在当前院校详情 tab 结构下失效 |
| TASK-019-REVIEW-001 | TASK-019 单元测试和集成测试体系落地 | functional | high | open | 是 | apiFetch 仍允许自定义 Authorization 覆盖真实 token |
| TASK-015-REVIEW-001 | TASK-015 管理端字段维护页面和导入校验落地 | responsive | medium | open | 是 | 移动端编辑弹窗固定宽度导致横向溢出 |
| TASK-015-REVIEW-002 | TASK-015 管理端字段维护页面和导入校验落地 | functional | medium | open | 是 | 字典字段仍会回退到前端硬编码选项 |
| TASK-015-REVIEW-003 | TASK-015 管理端字段维护页面和导入校验落地 | data | medium | open | 是 | 导入校验概览未统计院校数据质量问题 |
| TASK-014-REVIEW-001 | TASK-014 管理端字段维护 API、校验和审计落地 | data | high | open | 是 | 官方来源只校验非空，非法 URL 也能标记为已核验公开数据 |
| TASK-014-REVIEW-002 | TASK-014 管理端字段维护 API、校验和审计落地 | data | medium | open | 是 | 核验日期校验会接受不存在的日历日期 |
| TASK-013-REVIEW-001 | TASK-013 收藏、对比、规划画像和申请任务 API 落地 | test | high | open | 是 | TASK-013 专项验证在当前工作区失败 |
| TASK-013-REVIEW-002 | TASK-013 收藏、对比、规划画像和申请任务 API 落地 | data | medium | open | 是 | 申请任务去重缺少数据库唯一约束 |
| TASK-007-REVIEW-008 | TASK-007 搜索筛选、专业详情与对比功能升级 | functional | high | fixing | 是 | 首页 Hero 快捷分类标签使用旧分类值导致筛选结果全空 |
| TASK-007-REVIEW-009 | TASK-007 搜索筛选、专业详情与对比功能升级 | functional | high | fixing | 是 | Hero 快捷分类仍与静态基准不一致，医学被显示成牙科且酒店缺失 |
| TASK-007-REVIEW-010 | TASK-007 搜索筛选、专业详情与对比功能升级 | functional | high | fixing | 是 | 公开 API 常规数组筛选查询返回 500 |
| TASK-007-REVIEW-004 | TASK-007 搜索筛选、专业详情与对比功能升级 | automation | high | open | 否 | TASK-007 交付记录仍与实际实现验收口径不一致 |
| TASK-006-REVIEW-001 | TASK-006 用户端页面结构与静态样式 1:1 还原 | functional | high | open | 否 | TASK-006 任务口径与可追踪实现仍不一致 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 自动化 Git 状态与任务记录仍不一致 |
| TASK-006-REVIEW-004 | TASK-006 用户端页面结构与静态样式 1:1 还原 | test | high | open | 否 | 当前视觉验收脚本不能证明严格 1:1 还原 |
| TASK-006-REVIEW-005 | TASK-006 用户端页面结构与静态样式 1:1 还原 | responsive | medium | open | 否 | 移动端对比页仍存在可见布局差异 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 默认路径仍未明确纳入生活费 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 自动化 Git 状态与任务记录仍不一致 |
| TASK-006-REVIEW-004 | TASK-006 用户端页面结构与静态样式 1:1 还原 | test | high | open | 否 | 当前视觉验收脚本不能证明严格 1:1 还原 |
| TASK-006-REVIEW-005 | TASK-006 用户端页面结构与静态样式 1:1 还原 | responsive | medium | open | 否 | 移动端对比页仍存在可见布局差异 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 默认路径仍未明确纳入生活费 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 默认路径仍未明确纳入生活费 |
| TASK-006-REVIEW-001 | TASK-006 用户端页面结构与静态样式 1:1 还原 | functional | high | open | 否 | TASK-006 任务口径与可追踪实现仍不一致 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 自动化 Git 状态与任务记录仍不一致 |
| TASK-006-REVIEW-004 | TASK-006 用户端页面结构与静态样式 1:1 还原 | test | high | open | 否 | 当前视觉验收脚本不能证明严格 1:1 还原 |
| TASK-006-REVIEW-005 | TASK-006 用户端页面结构与静态样式 1:1 还原 | responsive | medium | open | 否 | 移动端对比页仍存在可见布局差异 |
| TASK-007-REVIEW-004 | TASK-007 搜索筛选、专业详情与对比功能升级 | automation | high | open | 否 | TASK-007 交付记录仍与实际实现验收口径不一致 |
| TASK-006-REVIEW-001 | TASK-006 用户端页面结构与静态样式 1:1 还原 | functional | high | open | 否 | TASK-006 任务口径与可追踪实现仍不一致 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 自动化 Git 状态与任务记录仍不一致 |
| TASK-006-REVIEW-004 | TASK-006 用户端页面结构与静态样式 1:1 还原 | test | high | open | 否 | 当前视觉验收脚本不能证明严格 1:1 还原 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 默认路径仍未明确纳入生活费 |
| TASK-007-REVIEW-004 | TASK-007 搜索筛选、专业详情与对比功能升级 | automation | high | open | 否 | TASK-007 交付记录仍与实际实现验收口径不一致 |
| TASK-007-REVIEW-004 | TASK-007 搜索筛选、专业详情与对比功能升级 | automation | high | open | 否 | TASK-007 交付记录仍与前端实现验收口径不一致 |
| TASK-006-REVIEW-001 | TASK-006 用户端页面结构与静态样式 1:1 还原 | functional | high | open | 否 | TASK-006 任务口径与可追踪实现仍不一致 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 自动化 Git 状态与任务记录仍不一致 |
| TASK-006-REVIEW-004 | TASK-006 用户端页面结构与静态样式 1:1 还原 | test | high | open | 否 | 当前视觉验收脚本不能证明严格 1:1 还原 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 默认路径仍未明确纳入生活费 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 默认路径仍未明确纳入生活费 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 默认路径仍漏算生活费 |
| TASK-007-REVIEW-004 | TASK-007 搜索筛选、专业详情与对比功能升级 | automation | high | open | 否 | TASK-007 交付记录仍与前端实现验收口径不一致 |
| TASK-006-REVIEW-001 | TASK-006 用户端页面结构与静态样式 1:1 还原 | functional | high | open | 否 | TASK-006 任务口径与可追踪实现仍不一致 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 自动化 Git 状态与任务记录仍不一致 |
| TASK-006-REVIEW-004 | TASK-006 用户端页面结构与静态样式 1:1 还原 | test | high | open | 否 | 当前视觉验收脚本不能证明严格 1:1 还原 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 默认路径仍漏算生活费 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现范围不一致 |
| TASK-004-REVIEW-011 | TASK-004 院校与专业数据模型及 API 升级 | functional | medium | open | 否 | 费用估算的官方 MYR programId 路径默认漏算生活费 |
| TASK-007-REVIEW-004 | TASK-007 搜索筛选、专业详情与对比功能升级 | automation | high | open | 否 | TASK-007 交付记录仍与前端实现验收口径不一致 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | high | open | 否 | TASK-004 任务记录仍与当前实现基线不一致 |
| TASK-007-REVIEW-004 | TASK-007 搜索筛选、专业详情与对比功能升级 | automation | high | open | 否 | TASK-007 交付记录仍与前端实现验收口径不一致 |
| TASK-006-REVIEW-001 | TASK-006 用户端页面结构与静态样式 1:1 还原 | functional | high | open | 否 | 实现范围仍未满足 TASK-006 前端还原要求 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 自动化 Git 状态与任务记录仍需纠正 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | medium | open | 否 | TASK-004 任务记录仍与当前实现基线不一致 |
| TASK-007-REVIEW-004 | TASK-007 搜索筛选、专业详情与对比功能升级 | automation | high | open | 否 | TASK-007 交付记录与前端实现验收口径不一致 |
| TASK-006-REVIEW-001 | TASK-006 用户端页面结构与静态样式 1:1 还原 | functional | high | open | 否 | 实现范围未满足 TASK-006 前端还原要求 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 实现结果中的 Git 状态判断仍需纠正 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | documentation | medium | open | 否 | TASK-004 任务记录仍与当前实现基线不一致 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | functional | high | open | 否 | 任务要求与实际产出范围不一致 |
| TASK-006-REVIEW-001 | TASK-006 用户端页面结构与静态样式 1:1 还原 | functional | high | open | 否 | 实现范围未满足 TASK-006 前端还原要求 |
| TASK-006-REVIEW-003 | TASK-006 用户端页面结构与静态样式 1:1 还原 | automation | medium | open | 否 | 实现结果中的 Git 状态判断不准确 |
| TASK-004-REVIEW-001 | TASK-004 院校与专业数据模型及 API 升级 | functional | high | open | 否 | 任务要求与实际产出范围不一致 |
| TASK-030-REV-005 | TASK-030 前端中英文翻译和页面文案统一修复 | i18n | high | open | 是 | 英文页面仍显示中文分类值 |
| TASK-030-REV-006 | TASK-030 前端中英文翻译和页面文案统一修复 | i18n | high | open | 是 | 繁体页面动态数据仍有简体字残留 |
| TASK-030-REV-007 | TASK-030 前端中英文翻译和页面文案统一修复 | i18n | high | open | 是 | 用户端错误提示直接透出英文后端错误 |

## 分类统计

- functional: 45
- automation: 35
- i18n: 34
- test: 19
- data: 19
- documentation: 13
- responsive: 7
- visual: 3
- security: 3
- asset: 1
- accessibility: 1

## 自动化处理规则

- Review Agent 发现的问题必须结构化记录。
- autoFixable=true 的问题可以进入 Fix Agent 自动修复流程。
- 修复后必须再次 Review，确认问题进入 verified 或继续保留 open。
- 多次修复失败或需要人工产品决策的问题应标记为 blocked。
