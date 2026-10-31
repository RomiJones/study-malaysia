# Taylor's University 验收缺口审核

- 审核时间：2026-06-21 Asia/Kuala_Lumpur
- 批次：`data/imports/tsu/2026-06-20/tsu-20260620`
- 范围：Taylor's University 本科、硕士、博士/DBA；国际申请人；collect-only
- 基线：官方目录 95 行；候选 89 条；本科 46、硕士 28、博士/DBA 15；出范围 6 条
- 结论：本文件已由 `17_deep_calibration_audit.json` 和 `18_deep_calibration_report.md` 复核更新。批次官方事实已完成进一步结构化校对，但严格学生端展示状态为 `review-required`。

## 已闭合数据

- 官方目录行处置已闭合：95/95。
- 候选身份、层级、faculty、campus、duration、intake、tuition、academic requirement、language requirement 均有官方证据。
- 89 条候选均有官方 International USD total programme fee，费用审计通过。
- 来源链、source hash、field evidence、display parity、delivery schema、candidate integrity 均已通过脚本审计。

## 仍缺乏或不能直接公开的数据

1. 中文本地化未完成：89/89
   - 专业中文名仍为英文原名。
   - Faculty 中文名仍为英文。
   - 简介、课程设置、职业方向中文字段目前是复核占位文案，不是学生可读内容。

2. 学生端内容卫生仍需人工/规则化复核：89/89
   - `studentFacingContentHygiene` 为 `needs-review`。
   - `localization` 为 `needs-review`。
   - 当前候选数据可以审，但不能直接作为中文公开详情页。

3. 申请材料已完成结构化 general-rule + programme supplement：89/89
   - 已按 undergraduate、postgraduate coursework international、postgraduate research international 三类拆出材料清单。
   - 已把 portfolio、proposal、prior publication、health/medical、work experience、reference letter 等 programme-specific supplement 接入候选记录。

4. 语言要求已结构化：89/89
   - 已拆出国际申请人口径文本与 IELTS、TOEFL iBT、MUET、PTE、Cambridge、Taylor's EET / IEN 等官方路线。
   - IELTS list summary：77/89 有官方 IELTS 数值；12/89 没有直接 IELTS 数值，需要产品决定如何展示非 IELTS 官方路线。

5. GPA / CGPA / academic-performance 已结构化：89/89
   - 已拆出官方成绩门槛或学历门槛，包括 CGPA、ATAR、grade、honours、average、points、class/division 等。
   - 硕博记录已保留 work experience、bridging/prerequisite、proposal/supervisor、prior publication 等替代或附加路径。

6. 特殊申请条件已拆成 structured requirement
   - Work experience：48 条。
   - Interview / internal assessment：35 条。
   - Aptitude assessment：1 条。
   - Portfolio：3 条。
   - Proposal：20 条。
   - Supervisor / doctoral faculty：4 条。
   - Prior publication route：14 条。
   - Health / medical：1 条。

7. 中国学生专项路径：89/89 官方未公布
   - 当前状态为 `official-unpublished`。
   - 这不是采集遗漏，但前台如要展示中国学生说明，需要使用受控的“官网未公布中国专项路径”文案，不能写泛化保证。

8. Recognition / accreditation：89/89 官方未公布
   - 当前状态为 `official-unpublished`。
   - 若后续商用展示要突出专业认证，需要继续从官方 programme page、faculty page、PDF 或 accreditation page 做专项补采；未找到前不能推断。

9. 课程设置中文化未完成：89/89
   - 官方 Programme Structure 已采集。
   - 88/89 有 individual course/module title 或等价结构；1 条 `TSU-D-001 Doctor of Philosophy (PhD) in Architecture` 为 individual course titles `official-unpublished`。
   - 中文课程设置目前不是可公开的课程列表，需要翻译并保留官方英文术语。

10. 职业方向中文化未完成：89/89
    - 官方 Future Careers 已采集。
    - 中文职业方向目前为复核占位，不是学生可读职业列表。

## 优先级建议

1. 先完成中文本地化：专业名、faculty、简介、课程设置、职业方向。
2. 决定 12 条无直接 IELTS 数值记录的列表展示策略，不能把 MUET/equivalent 硬换算成 IELTS。
3. 对 Recognition / accreditation 做官方专项补采；未找到前继续 official-unpublished。
4. 对中国学生专项路径维持 official-unpublished，除非找到 Taylor's 官方中国申请路线。

## 当前状态判断

- 可以进入下一步 controlled import review：需要用户确认，因为当前严格状态为 `review-required`。
- 可以宣称 public / commercial display ready：否。
- 可以直接上中文学生端：否。
- 需要真实 Notion 更新：当前会话无 Notion 写入连接，只能保留本地报告。
