# INTI 双语专业名与无区间学费修复记录

## 修复范围

- 院校：INTI International University & Colleges
- 层级：本科、硕士、博士
- 公开专业：107 条
- 修复时间：2026-06-26

## 修复内容

- 中文与繁体中文专业名改为中英文双语主标题：中文译名在前，官方英文名放在中文括号中。
- 英文与马来文界面继续使用官方英文专业名，不回退中文。
- 学院名继续按当前语言隔离：中文界面显示中文学院名，英文/马来文显示官方英文学院名。
- 16 条 `official-non-scalar` 多金额费用不再显示 `RM A - B` 区间，公开列表改为本地化的“官方非单一费用已核验”状态。
- INTI 导入校验新增双语专业名门禁和费用区间门禁。
- StudyMY 验收专用 skill 已同步规则：中文专业名要求双语主标题，多金额费用不得用区间冒充主学费。

## 入库结果

- 已执行确认导入：`public-imported`
- universityId：13
- ready 专业：107
- 本科：74
- 硕士：23
- 博士：10
- 官方预估费用：91
- 官方非单一费用：16
- 重新导入报告：`data/imports/iiu/2026-06-24/inti-bilingual-no-range-reimport-20260626.json`

## 验证结果

- `npm run test -- tests/web/format.test.ts tests/api/inti-official-audit-import.test.ts` 通过。
- `npm --workspace @studymy/api run import:inti:official-audit -- --verify-only` 通过。
- `npm --workspace @studymy/web run build` 通过。
- 公开 API 扫描 107 条，问题数 0：中文专业名双语、英文/马来无中文泄漏、学费无区间。
- Playwright 四语言页面验收通过：`zh-CN`、`zh-TW`、`en`、`ms`。

## Notion 状态

当前会话没有可写 Notion 连接器；真实 Notion 未直接更新。本地中文修复记录已更新。
