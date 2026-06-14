# USM 博士阶段官方数据采集审计

- 审计日期：2026-06-14
- 官方当前目录：https://admission.usm.my/index.php/main/postgraduate
- 当前官方博士标准数量：95
- 当前目录唯一详情页：91
- 可入库候选数量：95
- 逐条比对结果：缺失 0，额外 0
- 数据库写入：未执行

## 官方数量确认

USM 当前招生动态目录在 `PHD/DOCTORATE` 筛选下显示 95 条记录，这是本次完整性审计采用的官方标准数量。旧版 programme directory 中的 129 个博士详情入口作为历史详细证据保留，不再作为当前招生目录的标准数量。

本次补采了当前目录中不在旧版 129 个入口内的 9 个详情 URL。合并后共审计 138 个唯一详情页。

## 候选结果

| 指标 | 数量 |
| --- | ---: |
| 当前官方目录记录 | 95 |
| 当前目录唯一详情 URL | 91 |
| 候选记录 | 95 |
| 与官方目录逐条缺失 | 0 |
| 与官方目录逐条额外 | 0 |
| `ready` | 14 |
| `needs-review` | 79 |
| `not-available-for-international` | 2 |

同一详情 URL 可能对应不同的官方项目身份，因此身份审计使用项目名称、学位类型、学院和详情 URL 的组合，不以 URL 单独去重。

## 项目分布

| 维度 | 分类 | 数量 |
| --- | --- | ---: |
| 学习模式 | research | 82 |
| 学习模式 | coursework | 6 |
| 学习模式 | mixed | 6 |
| 学习模式 | online | 1 |
| 交付类型 | on-campus-or-unspecified | 70 |
| 交付类型 | offshore | 20 |
| 交付类型 | joint-degree | 3 |
| 交付类型 | dual-degree | 2 |

## 字段覆盖与例外

项目身份、学院、学习模式、校区、申请要求、材料要求和证据链均覆盖 95 条。数值学制覆盖 93 条，2 条官方未公布；入学批次覆盖 20 条，75 条官方未公布；国际生资格确认覆盖 72 条，23 条待人工复核。

费用状态：

| 状态 | 数量 |
| --- | ---: |
| verified-current-official-fee | 13 |
| verified-calculated-total-range | 59 |
| official-unpublished | 23 |

79 条 `needs-review` 记录主要由以下官方信息缺口触发：

| 原因 | 数量 |
| --- | ---: |
| 入学批次未公布 | 75 |
| 国际生资格未确认 | 23 |
| 当前学费未公布 | 23 |
| 数值学制未公布 | 2 |

## Offshore 对账

旧版官方 offshore 申请清单共 24 个 application code，其中 19 个可映射到当前 95 条目录，5 个仅存在于 application-code 清单，保留为 `application-code-only-needs-review`，不计入当前 95 条可入库候选：

- C006 — DBA, Shanghai Jiao Tong University, China
- R16 — PhD, School of Medical Sciences, University of Lahore, Pakistan
- R31 — PhD, School of Chemical Engineering, Turkiye
- R94 — PhD, School of Health Sciences, Turkiye
- R39 — PhD, Centre for Instructional Technology and Multimedia, Turkiye

## 证据与哈希

| 文件 | SHA-256 |
| --- | --- |
| `phd-current-catalogue.json` | `03be7bc3fadfbb2313e6ddefbdf02457481832041724176bccdd60ad878c9372` |
| `phd-official-source.json` | `984590ce65da53933076f532d9cb2b0add50f2f25fed1a5d118a5311af8ba617` |
| `phd-candidate.json` | `6dee3df9b39d4ef7c4e19bc1f3e3c6f858602152bd53f5d489e41f55a1b1594d` |
| `phd-audit.json` | `dfee790c6d9cfc0b86119d12e6446cb4c0499d674578f7549a5cdb60f2c7dd3a` |
| `phd-delivery.json` | `fc1878ad9543fa3a645ce1c3a39cfcf63b047114f375c8118db680b4f5005008` |

## 发布结论

当前博士候选已经达到官方公布的 95 条标准数量，且逐条比对缺失 0、额外 0。候选可进入受控导入评审，但本次未写入数据库；`needs-review` 和国际生不可申请记录必须继续遵守导入状态约束。

Notion 本次未更新；中文任务记录、技术设计和审计结论已写入仓库文档。
