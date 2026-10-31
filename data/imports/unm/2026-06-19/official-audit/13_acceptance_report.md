# UNM 官方公布项目全集验收报告

- 验收时间：2026-06-19T23:34:04+08:00
- 院校：University of Nottingham Malaysia / UNM
- 官方域名：nottingham.edu.my
- 学年/招生口径：2026 intake
- 申请人范围：international
- 授权：collect-only，不入库、不发布
- 批次目录：`data/imports/unm/2026-06-19/official-audit`

## 验收结论

通过 collect-only 交付验收，状态为 `ready-for-controlled-import`。

本轮不是发布验收，未执行数据库写入、公开 API/UI、四语真实页面、浏览器控制台和提交门禁。

## 数量闭合

- 官方原始公布行：64
- 官方公布项目候选：81
- 本科：36
- 硕士：28
- 博士：15
- PGCert：1
- PGDip：1
- ready：81
- needs-review：0
- not-available-for-international：0

## 费用验收

- 官方 `per programme` 总额：13
- 官方 annual/per-year 费率派生总额：68
- 费用审计政策：`official-total-or-authorized-rate-calculation`
- 派生规则：仅当官方年费率和官方最短全日制学制同时存在时，计算 StudyMY 完整学制总学费。
- 审计保留：候选数据保留原始年费、官方学制、计算公式、币种、session 和官方费用来源。

## 官方行与字段锁

- `official_row_disposal`：81/81
- `page_option_inventory`：81/81
- `field_coverage_matrix`：81/81
- `source_to_candidate_trace`：已生成
- `display_parity_report`：已生成，5 个 surface
- source snapshot：72 个官方来源快照
- instruction ledger：13 项，全部有终态

## 验收命令结果

- `python3 scripts/audit_pipeline_stage.py ... --stage scaffold --summary-only`：passed
- `discover_sources`：passed
- `lock_baseline`：passed
- `dispose_rows`：passed
- `cache_sources`：passed
- `inventory_pages`：passed
- `extract_fields`：passed
- `build_candidate`：passed
- `audit_candidate`：passed
- `display_parity`：passed
- `delivery_review`：passed
- `python3 scripts/audit_candidate_integrity.py ... --require-instruction-ledger --require-display-parity --summary-only`：passed
- `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_delivery.py ... --summary-only`：ready-for-controlled-import，issueCounts={}
- `validate_artifact_schema.py`：instruction ledger、official row disposal、page option inventory、field coverage matrix、display parity report、delivery schema 均 passed
- `audit_total_tuition.py --allow-official-rate-calculation`：passed，officialTotal=13，rateCalculated=68
- `python3 -m py_compile scripts/collect-unm-official-audit.py`：passed
- `audit_records.py` 本硕博 79 条子集：passed

## 工具边界记录

`audit_records.py` 当前通用枚举只支持 `bachelor/master/phd`，不支持用户要求纳入的 `postgraduate-certificate/postgraduate-diploma`。因此全集 81 条运行该通用脚本时仅剩 3 个枚举类 issue：`invalid-levels` 1 个、`invalid-level` 2 个。权威交付门禁、候选完整性、行处置、字段覆盖、display parity、delivery 和费用总额验收均已覆盖 81 条全集并通过。

## Notion 与 Git

当前 Codex 会话没有可写入的真实 Notion 连接，已更新本地中文开发日志。未提交 Git。
