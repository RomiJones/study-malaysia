# INTI 英迪国际大学官方数据 review-only 入库总结

- 记录时间：2026-06-24T16:45:31+08:00
- 任务编号：TASK-INTI-OFFICIAL-REVIEW-ONLY-IMPORT-20260624
- 范围：INTI International University & Colleges 本科、硕士、博士官方专业数据
- 来源策略：仅使用 `newinti.edu.my` 官方来源；未采用第三方事实源
- 上线口径：已入库到后台审核口径；未公开发布到学生端专业目录

## 本轮结果

1. 已将 INTI 官方本硕博候选数据写入数据库作为后台审核行，共 107 条。
2. 层级闭合：本科 74 条、硕士 23 条、博士 10 条。
3. 所有新导入专业保持 `publicDisplayStatus=needs-review`、`isPublished=false`、`officialFeeAuditStatus=pending-review`。
4. INTI 院校主档仍保持公开可访问，slug 为 `inti-international-university`。
5. 为满足“暂不采用其他来源”的口径，已将 5 条旧公开 seed 专业降级隐藏；这些旧行缺官方来源，字段为 `officialSourceStatus=missing-source`、`officialSourceUrl` 为空、费用币种为 `UNKNOWN`。
6. 降级后学生端公开 INTI 专业数为 0；107 条官方审核行未泄漏到公开 API。

## 验证结果

- `npx tsx --tsconfig tsconfig.test.json --test tests/api/inti-official-audit-import.test.ts`：通过，2 pass。
- `npm --workspace @studymy/api run import:inti:official-audit -- --report-output data/imports/iiu/2026-06-24/inti-review-import-dry-run-20260624.json`：通过，dry-run 判定 `ready-for-controlled-import`。
- `npm --workspace @studymy/api run import:inti:official-audit -- --confirm-import --backup-output apps/api/tmp/backups/inti-official-audit-review-before-2026-06-24T084400Z.json --report-output data/imports/iiu/2026-06-24/inti-review-import-confirmed-20260624.json`：通过，写入 107 条 review-only 行。
- `npm --workspace @studymy/api run verify:inti:official-audit -- --report-output data/imports/iiu/2026-06-24/inti-review-import-verify-after-legacy-hide-20260624.json`：通过，`reviewRows=107`、`publishedRows=0`、`publicLeakageRows=0`、`publicProgrammeCount=0`。
- `node scripts/audit-inti-review-import-public-api.mjs --base-url http://127.0.0.1:3000 --output data/imports/iiu/2026-06-24/inti-post-import-display-audit-after-legacy-hide-20260624.json`：通过，公开院校页暴露专业 0 条，review detail route 返回 404。

## 官方采集与校对产物

- `data/imports/iiu/2026-06-20/iiu-20260620/08_candidate_dataset.json`
- `data/imports/iiu/2026-06-20/iiu-20260620/02_official_source_registry.json`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_bachelor_20260624.json`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_master_20260624.json`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_phd_20260624.json`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_v2_calibrated_summary_20260624.json`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_v2_calibrated_report_20260624.md`
- `data/imports/iiu/2026-06-24/v3-calibrated/INTI_v3_calibrated_summary_20260624.json`
- `data/imports/iiu/2026-06-24/INTI_default_skill_second_pass_report_20260624.md`

## 仍缺数据与公开上线阻断

1. 精确国际学生总学费：107/107 缺失。INTI 官方专业页当前为近似费用或多费用选项，并注明国际学生费用另加 6% SST；不能作为公开精确总学费。
2. IELTS：20/107 未能从官方来源稳定归属，其中本科 15、硕士 4、博士 1。
3. 职业方向：7/107 缺官方可用值，其中本科 4、硕士 2、博士 1。
4. 课程设置：0/107 为空；本轮已把 3 个原空本科课程数组补齐，但公开前仍需 Ian 终审中文质量。
5. 学习模式与 GPA：v2 calibrated 中本科 74 条仍未结构化到 `studyMode` / `gpaRequirement` 字段，硕博已结构化；本科公开前需决定是否以官方 general-rule 统一展示或继续逐专业待审。
6. 面试要求：107/107 未能稳定结构化为布尔值；官方未明确时不应猜测。
7. 层级边界：2 条 `Master of Engineering ... 4+0` 仍需产品层级确认，官方标题为 Master，但原目录分类容易与本科 degree 页面混淆。
8. 四语言公开本地化：已完成一轮中文清理与补齐，但仍未达到公开发布终审标准。

## 官方来源入口

- Undergraduate: https://newinti.edu.my/academic-programmes/undergraduate/bachelor-degrees/
- Masters: https://newinti.edu.my/academic-programmes/postgraduate/masters/
- Doctorate: https://newinti.edu.my/academic-programmes/postgraduate/doctorate/
- International entry requirements: https://newinti.edu.my/international-students/entry-requirements/
- How to apply: https://newinti.edu.my/international-students/how-to-apply/

## 备份与回滚点

- Review-only 写库前备份：`apps/api/apps/api/tmp/backups/inti-official-audit-review-before-2026-06-24T084400Z.json`
- 旧公开专业降级前 SQL 备份：`apps/api/tmp/backups/inti-legacy-public-programs-before-hide-20260624.sql`
- INTI 院校行降级前 SQL 备份：`apps/api/tmp/backups/inti-university-before-hide-legacy-public-programs-20260624.sql`

## 结论

INTI 官方能采集到的本硕博数据已进入后台审核数据库，并且公开学生端不再混入旧的非官方来源专业。当前状态适合 Ian 审核“还缺什么”，但不适合公开发布专业列表；公开上线的硬阻断仍是官方未公布精确国际学生总学费，以及部分语言、职业、面试和本地化字段仍需人工策略确认。

声明：本次 v2/v3 calibrated 输出仍为审计数据，`safe_to_import=false`；数据库写入仅为受控 review-only 审核行，不是公开发布。
