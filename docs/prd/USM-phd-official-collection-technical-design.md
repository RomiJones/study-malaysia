# USM 国际博士官方数据采集技术方案

## 范围与授权

本任务只处理 USM、博士层级、国际申请人。授权为 `collect`，流水线止于完整审计候选，不连接业务数据库。

## 2026-06-17 发布后补充校对说明

原始技术方案记录的是博士候选采集阶段边界。用户后续已明确要求继续完成最终标准，因此 2026-06-16 已执行受控入库与商业发布门禁，2026-06-17 又执行发布后补充校对和两条 Doctor of Education 修复。本补充不改变原始候选采集事实，但将最终验收口径更新如下：

- 当前发布授权：`publish` 已执行；2026-06-17 已重新受控入库并完成发布后校验。
- 博士规范记录：95；公开记录：95；`needs-review`：0；国际生不可用：0。
- 修复根因：旧动态目录标题中的 `Malaysian Candidate Only` 覆盖了当前详情页证据；当前详情页 H1、国际申请语言要求和官方国际费用表共同确认两条 Doctor of Education 可供国际申请人申请。
- 采集器修复：当前详情页 H1 不含 Malaysian-only 标记时清理旧标题；当前详情页国际申请语言要求和官方国际费用同时存在时判定 `eligible`。
- 公开 API 当前费用分区：博士公开层 `matched-official=13`、`calculated-from-official-rate=62`、`not-published=20`；USM 全公开层 `matched-official=196`、`calculated-from-official-rate=213`、`not-published=53`。
- DBA 当前官方 HTML 学制字段为 `Full time: 7 semesters to 10 semesters Part time: 10 semesters to 14 semesters`。
- 补充审计产物：`data/imports/usm/2026-06-17/phd-supplemental-audit/acceptance_recheck.json`。
- 商业发布门禁报告：`tmp/reports/usm-commercial-release-gate-95-phd-public-20260617.json`，决策 `commercial-release-ready`。

## 来源图

1. USM 新版 Postgraduate Programme 动态表：当前规范项目身份、模式、学位类型、院系和精确数量。
2. USM 旧 Postgraduate Programme Directory：细分详情、研究方向和 offshore 代码交叉验证。
3. USM General Entry Requirements：博士通用学术和语言要求。
4. USM Postgraduate Fees 2025/2026：研究院系国际费率和具名博士总学费。
5. USM IPS candidature pages：研究型及 coursework/mixed 学制与注册规则。
6. USM OnlineIPS 2026 application guide：申请材料和上传规则。

USM Admission 页面受 WAF 保护时，使用只读公开渲染或浏览器动态表作为传输层；证据 URL 始终保留官方域名。新版动态表总计 400 个研究生项目，筛选 `PHD/DOCTORATE` 后为 95 条。

## 共享流水线

`scripts/collect-usm-master-official.py` 保持原入口并新增 `--level master|phd`：

- 统一解析旧版目录的 405 个研究生入口。
- 读取新版 95 条博士规范目录快照。
- 按目标层级选择记录并使用独立详情缓存。
- 按层级解析通用要求和具名费用行。
- 输出统一来源、详情证据、费用结构和初步审计。

博士候选由 `scripts/build-usm-phd-candidate.py` 生成，不手工修改最终 JSON。

## 身份规则

- 新版动态表的 95 行是当前规范项目主表，其中 91 个唯一 URL，4 组同 URL 不同学位身份按官方表分别保留。
- 旧目录的 129 个博士详情入口用于补充 research field 和细分证据，不直接决定规范项目数量。
- 详情页内 research areas、expertise、topics 和 supervisors 只保留为子数据，不增加项目数。
- 新版主表包含 offshore 20 条、joint-degree 3 条、dual-degree 2 条。
- 旧目录的 24 个 offshore 申请代码全部保留：19 个映射主表，5 个作为代码型 offering 待审核。
- `Fast-Track To PhD` 只作为入学路径，不创建项目。

## 字段裁决

- 研究型博士全日制采用官方 4–10 学期，主显示为 2–5 年；非研究型项目优先使用详情页学制。
- 研究型费用按官方院系映射国际全日制每学期费率，标记为 `official-rate-only`；不计算 4–10 学期总额或费用范围。
- DBA、Doctor of Neuroscience、Doctor of Public Health、Doctor of Education 和联合 Doctor of Psychology 使用官方总学费。
- 仅有费率或没有唯一当前总学费的项目保持 `official-unpublished`；offshore、USM@KL 非联合心理学博士和 Newcastle 联合 PhD 同样适用。
- `Malaysian Candidate Only` 只有在当前详情页和当前国际费用证据不能推翻旧标题时才进入 `not-available-for-international`；当前详情页 H1、国际申请语言要求和国际费用表共同确认适用于国际申请人时，以当前证据为准。
- 详情页或当前国际费用权威来源无法确认国际范围时进入 `needs-review`。
- 专业级字段缺失时使用 `general-rule`、`official-unpublished` 或 `not-confirmed`，不伪装为专业原文。

## 输出与门禁

- `phd-current-catalogue.json`：新版官方动态表的 95 条规范记录快照。
- `phd-official-source.json`：来源图、旧目录 129 条和联合后的 138 个详情证据。
- `phd-candidate.json`：标准化候选、费用、要求、材料、证据和状态。
- `phd-audit.json`：覆盖率、异常和来源哈希。
- `phd-delivery.json`：一次交付范围、三类计数、状态分区、验证与决策。
- `sources/`：当前目录、费用页、费用 PDF、IPS 规则页和申请指南的版本化原始证据。

专项验证器校验固定计数、唯一身份、官方域名、可离线读取的来源哈希、字段覆盖、费用行、状态分区、总学费标量约束和未写库约束。`scripts/audit_delivery.py` 校验最终交付 envelope。

## 回滚

本任务没有数据库写入。代码层回滚只需移除本任务新增脚本、博士 JSON 和中文文档；`tmp/usm-phd-details` 是可重建缓存，不是业务数据库。
