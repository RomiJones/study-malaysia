# Sunway University 官方本硕博采集审计报告

- 采集范围：Sunway University / 双威大学，本科、硕士、博士，国际申请人，ready-for-controlled-import。
- 当前日期：2026-06-21
- 官方域名：sunwayuniversity.edu.my, studyonline.sunwayuniversity.edu.my
- 官方课程目录：https://sunwayuniversity.edu.my/courses
- 官方申请/国际学生入口：https://sunwayuniversity.edu.my/apply；https://sunwayuniversity.edu.my/international
- 官方申请表 PDF：https://sunwayuniversity.edu.my/sites/default/files/20241220.%20SUN-U%20APPLICATION%20FORM%20(editable).pdf；https://sunwayuniversity.edu.my/sites/default/files/documents/2023-07/20230606.%20SUN-U%20POSTGRADUATE%20APPLICATION%20FORM%20(Editable).pdf
- 目录行数：本次纳入本科/研究生目录行 104；规范候选 97；出界 7。
- 分层候选：本科 48，硕士 33，博士 16。
- 状态分区：ready 97，needs-review 0，not-available-for-international 0。
- 深挖校对结论：7 个 online master 使用 `studyonline.sunwayuniversity.edu.my` 特殊页面模板，已补抓 duration、study periods、academic requirement、English requirement、fees and schedule、course subjects 和 eligibility-check documents。
- 主要审计结论：Sunway 官方详情页已发布多数项目的 intake、duration、2026 fee、entry requirements、English requirements、programme structure 和 career prospects；按用户确认口径，官网展示 USD 时 StudyMY 原样照搬 USD，并把 RM 等值缴费说明放到详情页说明。Online master 的 RM programme fee 按官网项目费采集，单独费用保留为详情说明。
- 材料校对：本科/研究生官方申请表 PDF 已纳入 source registry，未在专业页公布材料的记录以 official application form PDF 作为 general-rule 来源。
- 出界处理：American Degree Transfer Program、ASU Pathway Program、Post Basic Certificate、Postgraduate Diploma 已写入 official row disposal，不静默丢弃。
- 缺口处理：7 个专业官网未发布可用国际 fee block、3 个博士专业官网未发布固定 intake、部分专业官网未发布 career/recognition/interview；这些均在 `17_pre_import_gap_audit.json` 中作为 official-unpublished 明示，不再作为受控入库审查阻塞项。
- Notion 状态：当前 Codex 会话没有可写 Notion 连接，真实 Notion 未更新；本地中文开发日志见 `tmp/dev-logs/2026-06-20-sunway-official-collection.md`。

## 交付文件

- `00_run_contract.json`
- `02_official_source_registry.json`
- `03_level_manifest.json`
- `04_official_row_disposal.json`
- `05_source_cache_index.json`
- `06_page_option_inventory.json`
- `07_field_coverage_matrix.json`
- `08_candidate_dataset.json`
- `09_source_to_candidate_trace.json`
- `10_display_parity_report.json`
- `11_exception_queue.json`
- `13_runtime_continuity_check.json`
- `14_deep_source_field_audit.json`
- `15_public_display_hygiene_audit.json`
- `16_current_official_diff_audit.json`
- `17_pre_import_gap_audit.json`
- `delivery.json`

## 入库审查口径

1. 候选包已达到 `ready-for-controlled-import`：可用于后台/审查入库。
2. 直接公开发布仍需单独授权；review-only import 必须保持 `isPublished=false`、`publicDisplayStatus=needs-review`，确保学生端零泄漏。
3. Doctor of Medicine 当前按官方课程目录保留在本科/undergraduate scope，并保留官方奖项名称。
