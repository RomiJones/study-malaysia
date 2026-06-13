# 任务：USM 本科官方采集数据受控写入

- **任务标识**: TASK-USM-UG-IMPORT-20260612
- **状态**: 已完成
- **优先级**: 高
- **任务类型**: 数据导入
- **授权来源**: 用户于 2026-06-12 明确要求开始写入已采集的 USM 本科数据
- **关联需求**: 产品需求文档中的院校、专业、费用、要求、申请材料和官方来源数据治理
- **关联技术方案**: 技术方案中的 TypeORM/MySQL 数据层与官方来源审计字段

## 任务目标

将 2026-06-12 USM 本科官方采集试点的 91 条原始专业记录写入 StudyMY 本地数据库审核层，保留来源、冲突、费用语义和缺失字段，不把未通过审核的数据发布到用户端。

## 写入边界

- 仅处理 `universityCode=USM`、`level=bachelor`。
- 不删除或覆盖已有 USM、其它院校或用户数据。
- 每条采集记录使用稳定的 row-based slug 幂等写入。
- 所有新记录设置 `isPublished=false`。
- 不允许 `publicDisplayStatus=ready`。
- 重复代码、无效代码、来源冲突和未验证详情页记录仍写入审核层，但保持隐藏或待审核。
- 美元小数费用保留在展示和审计字段；现有整数金额列不能精确承载时不取整写入。
- 正式写入前必须生成 USM 当前数据库备份。
- 写入和数量校验必须在同一事务中完成，校验失败回滚。

## 验收标准

- dry-run 输出 91 条记录及状态、来源、费用审核和冲突统计。
- 正式写入后，导入前缀记录数为 91。
- 新写入记录的 `isPublished=true` 数量为 0。
- 新写入记录的 `publicDisplayStatus=ready` 数量为 0。
- 已有 18 条 USM 专业和其它院校记录不被删除。
- 导入命令可重复执行，不重复创建相同 row-based slug。
- 专项测试、API 构建和数据库校验通过。

## Notion 状态

当前 Codex 会话没有可写入的 Notion 页面连接。本文件是本地中文任务快照，待项目 Notion 可写时同步；Notion 仍是任务管理事实来源，本地快照不是业务数据库。

## 执行结果

- dry-run：91 条，稳定 slug 91 个，待审核 59 条，隐藏未核验 32 条。
- 正式写入：USM `universityId=2`，新增或更新本次审核记录 91 条。
- 费用审核：官方匹配 9 条，来源冲突 40 条，待审核 42 条。
- 详情页核验：19 个原始行命中 9 个唯一专业详情页。
- 公开隔离：本次记录 `isPublished=true` 为 0，`publicDisplayStatus=ready` 为 0。
- 数据保留：USM 当前共 109 条专业，其中本次审核记录 91 条、原有记录 18 条；没有删除旧记录或其它院校数据。
- 公开 API：`GET /api/programs?universityId=2&pageSize=100` 返回 `total=0`，审核记录未进入用户端。
- 首次导入前备份：`tmp/backups/usm-undergraduate-before-20260612.json`。
- 审计状态收紧前备份：`tmp/backups/usm-undergraduate-before-audit-tightening-20260612.json`。
- 可重复数据集：`data/imports/usm/2026-06-12/undergraduate-manifest.json` 和 `undergraduate-details-parsed.json`。
- 只读复验命令：`npm --workspace @studymy/api run verify:usm:undergraduate`。

## 验证结果

- `npm run test -- tests/api/usm-official-import.test.ts tests/api/static-html-importer.test.ts`：20 个通过、0 失败、1 个可选旧 Windows 原始文件基线跳过。
- `npm --workspace @studymy/api run build`：通过。
- `npm run build`：API、Web、Admin、Shared 全部通过；管理端保留既有 chunk size 警告。
- `npm run test`：123 个用例中 122 个通过、0 失败、1 个跳过。
- 已用仓库内生成 fixture 替代静态目录单元测试对 `D:/mydev/StudyMY_UM_v58_na_display_tidy.html` 的强制依赖；真实 119/687 历史基线在原始文件存在时继续执行。
- `npm --workspace @studymy/api run verify:usm:undergraduate`：数据库 91 条审核记录、published 0、ready 0，状态与 manifest 完全一致。
- 公开 API 复验：HTTP 200，`total=0`、返回记录 0。
