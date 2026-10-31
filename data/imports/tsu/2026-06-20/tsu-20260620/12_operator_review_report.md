# Taylor's University 官方本硕博采集审计报告

- 范围：Taylor's University 本科、硕士、博士/DBA；国际申请人；2026 official programme information。
- 授权：collect-only；未入库、未发布、未改公开 API。
- 官方域名：taylors.edu.my。
- 官方目录：Explore All Programmes 静态 `listing-data` 共 95 行。
- 本轮候选：89 条，其中本科 46、硕士 28、博士/DBA 15。
- 出范围处置：6 条（Diploma/Advanced Diploma、American Degree Transfer Program、Intensive English、Postgraduate Certificate）。
- 状态分区：ready=89，needs-review=0，not-available-for-international=0。
- 费用口径：优先使用官方详情页 Programme Information for 2026 的 International USD 总额；同时缓存 Fees Schedules 页面和对应 USD PDF 链接。费用不使用估算、换算、范围或本地生金额。
- 主要 review 原因：部分专业详情页未将语言要求拆成独立 IELTS/TOEFL 等结构，课程与职业中文本地化需人工复核后才能进入公开展示。
- Runtime continuity：采集期间未关闭、重启或占用 Ian 正在使用的 StudyMY 项目端。
- Notion：当前会话无真实 Notion 写入连接，本轮仅生成本地批次产物；开发日志可由本地快照记录。

## 验证

待运行：

```bash
python3 scripts/audit_pipeline_stage.py data/imports/tsu/2026-06-20/tsu-20260620 --stage delivery_review --summary-only
python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_delivery.py data/imports/tsu/2026-06-20/tsu-20260620/delivery.json --summary-only
```

## 深挖校对补充

- 校对时间：2026-06-20T16:23:03+00:00。
- 已将 89 条候选的语言要求、成绩门槛、申请材料和特殊要求拆为结构化字段。
- 严格 public display 状态已调整为 needs-review=89、ready=0；官方事实状态保留为 verified-official。
- 当前决策调整为 review-required，原因是中文本地化和部分 IELTS-only 列表策略仍需验收。
