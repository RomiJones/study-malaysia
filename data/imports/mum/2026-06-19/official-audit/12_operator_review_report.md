# Monash University Malaysia 官方本硕博采集审计报告

- 院校：Monash University Malaysia（莫纳什大学马来西亚校区）
- 授权：collect，仅采集统计，不入库不发布
- 申请人范围：international
- 当前口径：2026 官方页面，采集日期 2026-06-19
- 官方域名：monash.edu.my、monash.edu

## 目录统计

| 层级 | 官方候选数 | ready | needs-review | international-unavailable |
| --- | ---: | ---: | ---: | ---: |
| 本科 | 36 | 0 | 36 | 0 |
| 硕士 | 17 | 0 | 17 | 0 |
| 博士 | 7 | 0 | 7 | 0 |
| 合计 | 60 | 0 | 60 | 0 |

## 来源与口径

- 本科目录/费用：`https://www.monash.edu.my/study/undergraduate`、`https://www.monash.edu.my/study/undergraduate/fees`
- 硕博目录/费用：`https://www.monash.edu.my/study/postgraduate-and-research`、`https://www.monash.edu.my/study/postgraduate-and-research/fees`
- 英语要求：`https://www.monash.edu.my/study/entry-requirements/english/tests`
- 申请路径：`https://www.monash.edu.my/study/apply/application-form`

## 关键审计结论

- 官网直连在本地请求中返回 Cloudflare verification；本批次按 source-routing stop rule 改用 reader 快照，并在 `05_source_cache_index.json` 中记录传输方式和哈希。
- Monash 2026 本科费用页发布的是 `Tuition fees per year (RM)`；博士和研究型硕士多为 `per year`。当前用户未授权官方费率换算，所以不把年费乘学制写成公开总学费。
- 授课型硕士中部分费用为 `full course`，但仍需要完成逐专业详情页、英语分数和中文本地化复核后才能进入 public ready。
- 本批次所有 60 条候选均保留为 `needs-review`，用于 Ian 审核，不进入公开列表。

## 主要待审问题

- 被 Cloudflare/reader 阻断的详情页需人工或浏览器路线补采。
- IELTS/TOEFL/PTE 等语言分数已锁定通用官方来源，但逐专业适用分数需复核。
- 课程设置、研究领域和职业方向已从可读详情页抽取片段；最终中文本地化和 handbook 级别课程标题仍需复核。
- 公共列表要求“完整学制总学费”，本批次未授权官方费率换算，故本科和研究型项目不能标为 ready。

## Notion 状态

当前 Codex 会话没有 Notion 写入工具；本次未更新真实 Notion。已写入本地中文开发记录 `tmp/dev-logs/2026-06-19-mum-official-audit.md`。
