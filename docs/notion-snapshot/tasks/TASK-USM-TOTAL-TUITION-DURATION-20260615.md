# USM 学费总额与学制优化

## 任务边界

- 院校：Universiti Sains Malaysia（USM）
- 层级：硕士、博士
- 学生范围：国际学生
- 任务日期：2026-06-15
- 目标：列表只展示一个可比较的总学费，补齐剩余数字学制，并保持计算依据可审计

## 官方依据

- USM 当前专业页标注最后更新日期为 2026-06-12。
- 本次复核 28 个唯一官方页面，对应 30 条硕士目录身份。
- 版本化证据：`data/imports/usm/2026-06-15/master-duration-fee-refresh.json`
- 官方学费入口：https://admission.usm.my/index.php/postgraduate/fee-pg

## 数据规则

- 官网直接公布唯一项目总额时，使用 `matched-official`，原值进入主学费。
- 官网只公布每学期费率时，使用官方全日制费率乘以官方最短全日制学期数，状态为 `calculated-from-official-rate`。
- 计算总额是 StudyMY 标准比较值，不声称为 USM 直接公布的项目总额。
- 列表只显示一个总学费，不显示“每学期”、全日制或非全日制重复信息。
- 详情展示计算公式、官方非全日制费率，并明确排除延期学期学费和其他单独费用。
- 官网没有可匹配数字费用时保持 `not-published`，不得生成金额。

## 本次修改

- 刷新 30 条硕士记录的官方数字学制，硕士 305 条记录不再出现无数字学制占位。
- 清理研究型专业页尾部污染文本，并对缺失的研究型学制使用官方研究模式规则。
- 更新 4 个当前专业页总学费：
  - Master of Architecture：`USD 9,000`
  - Master of Data Science and Analytics：`USD 8,800`
  - USM MBA / University of Glasgow MSc 双学位：`GBP 5,000`
  - Master of Professional Management USM@KL：`USD 10,500`
- 硕士费率型 151 条、博士费率型 62 条，统一生成标准总学费。

## 入库结果

- 规范记录：本科 63、硕士 305、博士 95，共 463。
- 公开国际生专业：本科 63、硕士 304、博士 93，共 460。
- 公开费用状态：194 条官方总额、213 条按官方费率与学制计算、53 条未公布。
- Master 导入前备份：`apps/api/tmp/backups/usm-master-commercial-before-2026-06-15T14-52-38-952Z.json`
- PhD 汇总重算前备份：`apps/api/tmp/backups/usm-phd-commercial-before-2026-06-15T14-54-41-383Z.json`
- 导入后验证：`needs-review = 0`、历史公开记录泄漏为 0、305 条硕士学制均转换为年。

## 验证

- 候选生成：305 条，异常 0。
- 定向测试：25 通过。
- Master 与 PhD 数据库专项验证：通过。
- 全量测试、生产构建、四语审计、一键商用门禁和浏览器验收：见发布报告。
- 发布报告：`data/imports/usm/2026-06-15/publication/usm-total-tuition-duration-release-report.json`

## 回滚

- 数据回滚使用本任务生成的 Master 导入前备份。
- 代码回滚使用本任务聚焦提交，不覆盖工作区其他未提交修改。

## 文档状态

当前环境未连接 Notion 写入工具。本文件作为中文开发记录快照；真实 Notion 尚未同步。
