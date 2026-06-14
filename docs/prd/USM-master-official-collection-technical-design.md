# USM 国际硕士官方数据采集技术方案

## 架构概览

本任务采用“官方来源快照 -> 结构化采集清单 -> 详情证据 -> 冲突审计 -> 发布门禁”的只读流水线。采集结果写入版本化 JSON，不连接业务数据库，也不改变前端公开数据。

目录页受 USM WAF 限制时，允许使用公开只读页面代理作为传输层；来源身份、字段证据和最终引用始终绑定 USM 官方 URL。费用 PDF 和可直接访问的 IPS 页面从官方服务器下载并计算 SHA-256。

## 模块边界

- `scripts/collect-usm-master-official.py`
  - 解析 USM 研究生目录。
  - 区分硕士与博士详情入口。
  - 解析离岸开设项和国家。
  - 结构化解析 2025/2026 费用 PDF。
  - 采集硕士详情页并提取要求、学制、批次和费用证据。
  - 生成缺失字段、旧费用和发布阻断清单。
- `scripts/verify-usm-master-official.py`
  - 校验固定来源计数、唯一身份、官方域名、来源哈希和只读发布状态。
- `scripts/build-usm-master-commercial-candidate.py`
  - 将目录、详情、研究型收费组、具名收费行和 OnlineIPS 申请指南合并为目录级完整候选。
  - 批量处理正常记录，只保留无法自动裁决的例外队列。
  - 专业页明确公布 2026/2027 新费率时，优先于 2025/2026 总表。
- `scripts/verify-usm-master-commercial-candidate.py`
  - 校验 274 条目录记录、110 条具名收费行、培养模式、申请材料、字段状态和来源哈希。
- `data/imports/usm/2026-06-14/master-official-source.json`
  - 保存本轮来源图、目录记录、费用结构、详情证据和审计结果。
- `data/imports/usm/2026-06-14/master-commercial-candidate.json`
  - 保存目录级完整候选、费用分配、申请材料、未公布状态和发布门禁。
- `tmp/usm-master-details`
  - 保存可重试的传输缓存，不作为业务数据或发布来源。

## 数据模型

本任务区分五类对象：

1. `directory record`：官方目录中的唯一详情页入口。
2. `canonical programme`：经申请选择或独立学位身份确认后的规范专业。
3. `offshore offering`：同一专业在不同国家、合作机构或交付地点的开设项。
4. `fee row`：按专业名称或研究院系公布的收费规则。
5. `detail evidence`：详情页中的学制、批次、要求、费用和原文证据。

目录入口数不能直接作为最终商用专业数。研究方向、临床专业方向、track、双学位、线上和离岸开设必须经过身份裁决后映射到规范专业或开设项。

Notion 只用于中文项目文档管理，不是业务数据库。

## 接口设计

采集命令：

```bash
python3 scripts/collect-usm-master-official.py \
  --directory-markdown tmp/usm-master-programmes-jina-https.md \
  --fee-page-markdown tmp/usm-pg-fee-page.md \
  --fee-pdf tmp/pdfs/usm-master/pg-fees-2025-03-11.pdf \
  --ips-admission-html tmp/usm-ips-admission-official.html \
  --research-mode-html tmp/usm-ips-research-mode.html \
  --detail-cache tmp/usm-master-details \
  --fetch-details \
  --workers 2 \
  --request-delay 6.5 \
  --output data/imports/usm/2026-06-14/master-official-source.json
```

验证命令：

```bash
python3 scripts/verify-usm-master-official.py \
  --manifest data/imports/usm/2026-06-14/master-official-source.json

python3 scripts/build-usm-master-commercial-candidate.py \
  --source data/imports/usm/2026-06-14/master-official-source.json \
  --application-guide tmp/pdfs/usm-master/online-application-guide-2026.pdf \
  --coursework-mixed-html tmp/usm-ips-coursework-mixed.html \
  --output data/imports/usm/2026-06-14/master-commercial-candidate.json

python3 scripts/verify-usm-master-commercial-candidate.py \
  --manifest data/imports/usm/2026-06-14/master-commercial-candidate.json
```

本任务不提供写库接口。后续写库必须建立新的中文任务并通过备份、dry-run、事务导入、API 与四语前端验证。

## 测试策略

- Python 语法检查。
- 固定目录计数和唯一 URL 校验。
- 离岸开设项按国家和层级统计。
- 费用表行数、币种、计费口径和学年校验。
- 官方来源域名与本地证据哈希校验。
- 详情采集失败与字段缺失必须显式进入审计。
- 发布状态必须保持 `blocked`，直到身份、费用映射、申请材料和四语门禁全部通过。

## 风险与权衡

- USM 目录页和详情页会被 WAF 阻断，传输代理可能限流；使用缓存、低并发和重试控制，不能把传输失败误判为官网未公布。
- 同一官方站点的详情页可能保留旧费用，而当前费用页公布 2025/2026 新费用；费用页和 USM Bursary 口径优先，冲突必须保留。
- 部分详情页只提供介绍，没有结构化要求或费用区；可由官方通用要求和费用表补证，但不得伪造专业级事实。
- 临床费用表将部分 `Area of studies` 按独立收费行列出，最终专业数量必须结合申请选择进一步裁决。
