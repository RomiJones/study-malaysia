# INTI v3 校对优化报告

- 生成日期：2026-06-24
- 输入目录：`data/imports/iiu/2026-06-24/v3`
- 输出目录：`data/imports/iiu/2026-06-24/v3-calibrated`
- 范围：只优化审计 JSON；未导入、未发布、未修改前端/后端生产数据。

## 校对结果

- 本硕博总数：107 条（本科 74、硕士 23、博士 10）
- ready：0 条
- needs-review：107 条
- 本科中文课程/职业质量风险：75 -> 0
- 修改字段数：101
- 受影响专业数：61

## 本轮做了什么

1. 对 AUP、体育管理等可由官网 Programme Structure 明确对应的本科课程，替换为更准确的中文课程名。
2. 对物理治疗、中医、AUP 等可由官网 Career/major fields 明确对应的职业方向，替换为更稳的中文表达。
3. 删除 `相关岗位N`、`课程条目N`、孤立“之/与/管理/经理/工程师”等不适合公开展示的占位项。
4. 对仍无法稳定校正的课程或职业字段显式降级为 `needs-review`，避免脏中文进入上线候选。

## 仍不能上线的原因

- INTI 官网专业详情页仍只发布 `Approx. RM ...` 费用，并注明公布费用不含 SST，国际学生费用另加 6% SST；无法满足 StudyMY “官方精确国际学生总学费”门禁。
- 部分专业官方页面未发布英语语言要求或职业方向，只能保留 `official-unpublished` / `needs-review`。
- 2 条 Master of Engineering 仍存在官网 Degree taxonomy 与 award title 的产品层级确认问题。

## 输出文件

- `data/imports/iiu/2026-06-24/v3-calibrated/INTI_audit_undergraduate_20260624.json` sha256 `e9bc305cbdfc74396c73492e51574a4752b11c552cddd41a2a8598c5c475f931`
- `data/imports/iiu/2026-06-24/v3-calibrated/INTI_audit_master_20260624.json` sha256 `2664d92b0537216d54178385a118589fcb9708223fd83c3a1f7ca4f9b58c9a90`
- `data/imports/iiu/2026-06-24/v3-calibrated/INTI_audit_doctoral_20260624.json` sha256 `0bea1c6904668186ea04d2736fc1f1dddfbef6c7b913e1e139471d302dbfc332`

声明：本次输出仅为审计数据，未修改任何项目文件。safe_to_import 默认为 false，等待 Ian 审核。
