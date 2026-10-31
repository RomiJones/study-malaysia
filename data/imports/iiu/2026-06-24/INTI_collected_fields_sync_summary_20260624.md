# INTI 英迪国际大学已采集字段补充上线摘要

- 执行时间：2026-06-24T17:20:27+08:00
- 任务编号：TASK-INTI-COLLECTED-FIELDS-SYNC-20260624
- 目标：在不修改任何前端/后台设计的前提下，把已经采集到的学费、语言要求、学制、开学月份、课程设置、职业方向、入学要求等字段补充到现有 StudyMY 全栈统一展示链路。
- 数据范围：INTI 官方导入行 107 条，本科 74 条、硕士 23 条、博士 10 条。
- 数据来源：仅使用本地已采集的 INTI 官方来源审计产物，不引入非官方来源。

## 已补充字段

- 中文专业名：107/107
- 中文学院/领域：107/107
- 学制：107/107
- 开学月份：107/107
- 学习模式：107/107
- 已采集近似学费金额：107/107
- 折算人民币年费：107/107
- 中文课程设置：107/107
- 中文职业方向：104/107
- 入学要求备注：107/107
- GPA/成绩字段：96/107
- 语言成绩字段：
  - IELTS：92/107
  - TOEFL：44/107
  - PTE：22/107
  - MUET：52/107

## 费用处理口径

INTI 官网已采集费用多为 `Approx. RM ...` 或多费用选项，并且官方说明费用不含 6% SST。本轮为了让用户端先可查阅，已将已采集的近似 RM 金额写入 `tuitionAmount`，并按 `1 MYR = 1.55 CNY` 与学制折算 `annualTuitionCny`。

但本轮没有把这些近似费用伪装为精确官方总学费：

- `officialTuitionMYR` 保持 `NULL`
- `officialFeeAuditStatus` 保持 `pending-review`
- `officialTuitionNote` 保留近似费用和 SST 风险说明

## 质量门禁

- 匹配结果：107 条全部匹配，缺失 0 条。
- 语言成绩范围门禁：无越界值。
  - IELTS 仅允许 1-9
  - TOEFL 仅允许 30-677
  - PTE 仅允许 20-90
  - MUET 仅允许 1-5
- 公开状态：107 条均已进入现有公开展示链路，`publicDisplayStatus=ready`、`isPublished=1`。
- 院校主档：`programCount=107`，费用区间已更新为 `tuitionMinCny=14794`、`tuitionMaxCny=73024`，`minIelts=3.5`。

## 仍待后续补齐或人工确认

- 精确官方国际学生总学费：107/107 仍缺。原因是当前官方费用为近似值或多选项，并排除 SST。
- 职业方向缺 3 条：
  - INTI-M-001 Master in Education Management
  - INTI-M-022 Master of Science in Integrated Project Management (Online Learning)
  - INTI-P-008 Doctor of Philosophy (PhD) (Innovation and Technology) (by Research)
- IELTS 缺 15 条，TOEFL/PTE/MUET 仅在官方来源明确出现时补充；未明确归属的数字不写入。

## 验证记录

- `npx tsx --tsconfig apps/api/tsconfig.json scripts/sync-inti-collected-fields.ts`
- `curl http://127.0.0.1:3000/api/universities/inti-international-university`
- `curl 'http://127.0.0.1:3000/api/programs?universityId=13&pageSize=120&includeMeta=true'`
- 数据库覆盖率复核：
  - `total=107`
  - `tuition_amount_rows=107`
  - `annual_cny_rows=107`
  - `duration_rows=107`
  - `curriculum_rows=107`
  - `career_rows=104`
  - `invalid_language_rows=0`

## 本轮文件产物

- 同步脚本：`scripts/sync-inti-collected-fields.ts`
- 同步 JSON 报告：`data/imports/iiu/2026-06-24/inti-collected-fields-sync-report-20260624.json`
- 本摘要报告：`data/imports/iiu/2026-06-24/INTI_collected_fields_sync_summary_20260624.md`
- 数据库备份：
  - `apps/api/tmp/backups/inti-official-rows-before-collected-fields-sync-20260624.sql`
  - `apps/api/tmp/backups/inti-university-before-collected-fields-sync-20260624.sql`

## 设计边界

本轮没有修改 `apps/web` 或 `apps/admin` 的页面设计、布局、样式、组件或交互。当前工作区中已有的大量前端改动属于本轮前已存在状态，本轮未处理、未回滚、未覆盖。

## Notion

当前会话没有真实 Notion 写入连接，真实 Notion 未更新；本轮仅更新本地中文开发日志与 INTI 本地报告。
