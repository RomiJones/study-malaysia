# USM 国际博士官方数据采集技术方案

## 范围与授权

本任务只处理 USM、博士层级、国际申请人。授权为 `collect`，流水线止于完整审计候选，不连接业务数据库。

## 来源图

1. USM Postgraduate Programme Directory：规范项目身份、院系、详情入口和开设类型。
2. USM General Entry Requirements：博士通用学术和语言要求。
3. USM Postgraduate Fees 2025/2026：研究院系国际费率和具名博士总学费。
4. USM IPS candidature pages：研究型及 coursework/mixed 学制与注册规则。
5. USM OnlineIPS 2026 application guide：申请材料和上传规则。

USM Admission 页面受 WAF 保护时，使用只读公开渲染作为传输层；证据 URL 始终保留官方域名。2026-06-14 再次复核时，目录与费用页业务内容未变化，渲染哈希差异只来自 `Published Time` 元数据。

## 共享流水线

`scripts/collect-usm-master-official.py` 保持原入口并新增 `--level master|phd`：

- 统一解析 405 个研究生目录入口。
- 按目标层级选择记录并使用独立详情缓存。
- 按层级解析通用要求和具名费用行。
- 输出统一来源、详情证据、费用结构和初步审计。

博士候选由 `scripts/build-usm-phd-candidate.py` 生成，不手工修改最终 JSON。

## 身份规则

- 129 个博士详情 URL 均唯一，因此形成 129 个规范项目候选。
- 同名 `Doctor of Philosophy` 在不同院系、校区、离岸合作方或独立详情入口下保留为独立申请开设。
- 详情页内 research areas、expertise、topics 和 supervisors 只保留为子数据，不增加项目数。
- offshore 20 条、joint-degree 4 条保持独立开设身份。
- `Fast-Track To PhD` 只作为入学路径，不创建项目。

## 字段裁决

- 研究型博士全日制采用官方 4–10 学期，主显示为 2–5 年；非研究型项目优先使用详情页学制。
- 研究型费用按官方院系映射国际全日制每学期费率，并计算 4–10 学期总学费区间。
- DBA、Doctor of Neuroscience、Doctor of Public Health、Doctor of Education 和联合 Doctor of Psychology 使用官方总学费。
- offshore、USM@KL 非联合心理学博士和 Newcastle 联合 PhD 没有唯一当前费用时保持 `official-unpublished`。
- `Malaysian Candidate Only` 进入 `not-available-for-international`。
- 详情页或当前国际费用权威来源无法确认国际范围时进入 `needs-review`。
- 专业级字段缺失时使用 `general-rule`、`official-unpublished` 或 `not-confirmed`，不伪装为专业原文。

## 输出与门禁

- `phd-official-source.json`：原始来源图、129 个详情证据和初步审计。
- `phd-candidate.json`：标准化候选、费用、要求、材料、证据和状态。
- `phd-audit.json`：覆盖率、异常和来源哈希。
- `phd-delivery.json`：一次交付范围、三类计数、状态分区、验证与决策。

专项验证器校验固定计数、唯一身份、官方域名、来源哈希、字段覆盖、费用行、状态分区和未写库约束。`scripts/audit_delivery.py` 校验最终交付 envelope。

## 回滚

本任务没有数据库写入。代码层回滚只需移除本任务新增脚本、博士 JSON 和中文文档；`tmp/usm-phd-details` 是可重建缓存，不是业务数据库。
