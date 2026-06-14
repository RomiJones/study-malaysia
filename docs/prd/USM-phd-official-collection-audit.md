# USM 国际博士官方数据采集审计

## 审计结论

- 审计日期：2026-06-14。
- 范围：USM、博士层级、国际申请人。
- 目录口径：当前官方目录。
- 费用口径：2025/2026 官方研究生费用表。
- 规范项目数：129。
- 交付决策：`audited-candidate-with-review-exceptions`。
- 数据库状态：未写入。

本轮已形成可重复构建、可验证、可进入人工审核与后续受控导入流程的候选。它不是可直接公开发布的数据集：112 条记录仍有至少一个审核原因。

## 三类计数

| 口径 | 数量 |
| --- | ---: |
| 目录出现次数 | 129 |
| 唯一官方详情入口 | 129 |
| 规范博士项目 | 129 |
| 重复入口 | 0 |

研究方向、expertise 和 thesis topics 没有拆成独立项目。

## 状态与模式

| 状态 | 数量 |
| --- | ---: |
| ready | 16 |
| needs-review | 112 |
| not-available-for-international | 1 |

| 模式 | 数量 |
| --- | ---: |
| research | 116 |
| coursework | 6 |
| mixed | 7 |

| 开设类型 | 数量 |
| --- | ---: |
| on-campus-or-unspecified | 105 |
| offshore | 20 |
| joint-degree | 4 |

## 字段覆盖

| 字段 | 已覆盖 | 官网未公布 | 待审核 |
| --- | ---: | ---: | ---: |
| identity | 129 | 0 | 0 |
| faculty | 129 | 0 | 0 |
| studyMode | 129 | 0 | 0 |
| campus | 129 | 0 | 0 |
| duration | 127 | 2 | 0 |
| intake | 23 | 106 | 0 |
| internationalEligibility | 106 | 0 | 23 |
| academicRequirement | 129 | 0 | 0 |
| languageRequirement | 129 | 0 | 0 |
| applicationDocuments | 129 | 0 | 0 |
| fee | 106 | 23 | 0 |
| evidence | 129 | 0 | 0 |

34 个详情页未单列博士学术要求、语言要求或学制时，候选使用明确标记为 `general-rule` 的官方博士通用规则。129 个详情页均已取得内容和 SHA-256，无传输失败。

## 费用审计

- 47 个研究型院系收费组。
- 13 条具名博士收费行，全部映射。
- 93 个研究型项目采用国际全日制每学期费率乘以 4–10 学期，币种为 USD，来源标记为 `calculated-from-official-components`。
- 13 个具名博士项目使用官方完整项目总学费。
- 23 个项目没有唯一适用的当前国际学费，保持 `official-unpublished`。
- 单独收费的注册费、personal bond、研究方法、论文评审和毕业费不计入主总学费。

23 个未公布费用项目包括 20 个 offshore 博士、2 个 USM@KL 非联合心理学博士和 1 个 USM-Newcastle broad joint PhD。不得把本部研究费率套用于这些开设。

## 异常队列

- 106 个项目未公布专业级 intake。
- 23 个项目的国际资格未明确确认。
- 同 23 个项目没有唯一当前国际学费。
- 2 个项目没有可结构化的数字学制。
- 1 个 `Doctor of Education in TESOL` 明确为 `Malaysian Candidate Only`，已排除国际公开候选。

异常原因可能重叠，最终 `needs-review` 记录为 112 条。

## 主要来源哈希

| 来源 | SHA-256 |
| --- | --- |
| Postgraduate Programme Directory | `ccb852d13ccb650d2d80006c1ff18bf9129002fca83175db9158436d66f6be5f` |
| Postgraduate Fees 页面 | `3597c8977755aa2f18fb3b389c813435989bd62cc54318f26b8e573c10401076` |
| PG Fees 2025/2026 PDF | `24bc178e7da6de039ff9e5cd866c580a5f3ed1c73db04d08b8f7ca42cb75bcef` |
| IPS Admission | `8bc410b05fc4909de3d3bf6187cd6acd92bc760bfc293f0b2a2b3490476bec9c` |
| IPS Research Mode | `604bd880c1a0c8528cb7c4233e86c08f80ba4075a126c14b15d46bb23eff2d3e` |
| OnlineIPS Application Guide 2026 | `92559bbca13240e19d9cec7b761c7718eace5fa86648f3a13a0ea46fd443ece3` |
| Coursework/Mixed candidature | `10a840d099c43a52c4dfaf7ab9b1173549eded928a2a55b8d9e987554afd77a0` |

## 产物哈希

| 产物 | SHA-256 |
| --- | --- |
| `phd-official-source.json` | `b296255567e95c83bda74102d317c2966c14dfb91bef93c908b54cba6423ee2f` |
| `phd-candidate.json` | `fa891702242a44b1e19061271d6855f80b59c05a50fe9ef25f88f26ea7999a61` |
| `phd-audit.json` | `bf97d74740c95a599bd9d020bd07f834da036a7dc2326533f19a2b725d85fa74` |
| `phd-delivery.json` | `57dcd3c29d092220e133b5eec91ea176f1bf8d82ba85dd12d58263ea91bfdcc7` |

## 验证与发布边界

专项来源验证、候选验证和 delivery 审计均无错误。当前授权没有数据库写入，因此未执行备份、dry-run、事务导入、API、四语 UI 或浏览器发布验证。公开发布必须另行授权，并只允许 `ready` 记录进入国际公开列表。

## Notion 与回滚

当前会话没有 Notion 连接器，真实 Notion 未更新；本地中文任务快照和本审计报告已更新。本任务没有数据库回滚需求。
