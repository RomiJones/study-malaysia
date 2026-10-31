# INTI 默认 skill 第二轮优化采集补充报告

- 生成日期：2026-06-24
- 范围：继续优化本地 audit JSON；只使用 INTI 官方页面/PDF 已采集证据；未导入、未发布、未修改项目生产数据。

## 本轮补充

- 补齐 3 个本科课程空数组：
  - Bachelor of Food Service Management with Culinary Arts (Honours) 3+0 in collaboration with CY Cergy Paris Université, France：58 个课程条目
  - Bachelor of Technology in Intelligent Manufacturing：40 个课程条目
  - Bachelor of Technology in Intelligent Process and Product Design：40 个课程条目

## 当前状态

- 本硕博总数：107 条
- ready：0 条
- needs-review：107 条
- v2 本科课程空数组：0 条
- 所有 `tuitionMYR` 仍为 `null`，因为 INTI 官方未发布精确国际学生总学费。

## 输出更新

- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_bachelor_20260624.json` sha256 `db73c55480e106b0bfd8c5fa50d1ee265c7d6710c4412a795e571d3b66dc31bf`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_master_20260624.json` sha256 `cc2bf3f651cb93d26da3d77f66e7e9c8f5f46d0517866e439d93b50b7113ae75`
- `data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_phd_20260624.json` sha256 `351b734a6418ea291556dc051ced79910f6e49dce4a727cde31ed15ebcbe0d5f`

声明：本次输出仅为审计数据，未修改任何项目文件。safe_to_import 默认为 false。
