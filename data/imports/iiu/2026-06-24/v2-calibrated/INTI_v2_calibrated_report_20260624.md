# INTI 默认 skill v2 校对补充报告

- 生成日期：2026-06-24
- 输出目录：`data/imports/iiu/2026-06-24/v2-calibrated`
- 范围：默认 collector v2 audit JSON；只输出审计数据，未导入、未发布、未修改项目生产数据。

## 结果

- 本硕博总数：107 条
- 本科：74 条
- 硕士：23 条
- 博士：10 条
- ready：0 条
- needs-review：107 条

## 本轮补充优化

1. 沿用 v2 固定入库字段格式，重新生成本硕博三个独立 audit JSON。
2. `tuitionMYR` 全部改为 `null`，原因是 INTI 官方只发布近似费用或多费用选项且不含 SST，不能当作精确总学费。
3. 复用 calibrated v3 已校正的本科课程与职业中文，清除明显机器转换风险。
4. 对无法由官方来源稳定确认的 IELTS、课程、职业方向和硕博面试要求保留缺失标记与 `needs-review`。

## 输出文件

- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_bachelor_20260624.json` sha256 `579bdad6a50bcf308fca9e9398c71a9a338cceb15ad95b2900296a130445a78b`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_master_20260624.json` sha256 `cc2bf3f651cb93d26da3d77f66e7e9c8f5f46d0517866e439d93b50b7113ae75`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_phd_20260624.json` sha256 `351b734a6418ea291556dc051ced79910f6e49dce4a727cde31ed15ebcbe0d5f`

声明：本次输出仅为审计数据，未修改任何项目文件。safe_to_import 默认为 false。
