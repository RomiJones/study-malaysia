# USM 官方学费数字展示校正

## 任务边界

- 院校：Universiti Sains Malaysia（USM）
- 层级：硕士、博士
- 学生范围：国际学生
- 官方学年：2025/2026
- 发布授权：已确认，可执行受控数据库导入和公开页面验收

## 问题

研究型硕士和博士项目已经匹配 USM 官方学费表，但列表主金额仍显示“官方未公布”，与下方“官方费率已核验”状态冲突。该展示会让学生和家长误解为网站没有找到费用，无法达到商用标准。

## 官方样本

- 样本专业：MASTER OF ARTS (FINE ARTS)
- 官方项目页：https://admission.usm.my/index.php/postgraduate/programmes?view=article&id=367&catid=53
- 官方学费入口：https://admission.usm.my/index.php/postgraduate/fee-pg
- 官方学费表：https://admission.usm.my/images/PG%20FEE%20-%20YURAN%20PG/PG%20FEES%2011.03.2025.pdf
- 官方 PDF SHA256：`24bc178e7da6de039ff9e5cd866c580a5f3ed1c73db04d08b8f7ca42cb75bcef`
- School of Arts 国际学生全日制费率：`USD 1,400 / 学期`
- School of Arts 国际学生非全日制费率：`USD 1,190 / 学期`

研究型学生按实际注册学期缴费，官方没有为该专业公布唯一固定总额。因此不能把最低学期数与费率相乘后冒充官方总学费。

## 固定展示规则

- 官方明确公布唯一项目总额：主金额展示官方总学费。
- 官方只公布每学期费率：主金额展示官方全日制每学期数字，状态显示“官方费率已核验”。
- 费率型记录的 `tuitionAmount` 保持为空，禁止生成估算总额或费用范围。
- 官网没有任何数字费用：才显示“官方未公布”。
- 延期、超期或额外注册学期产生的费用不计入标准总学费。
- 列表列名统一为“官方学费”，避免把费率误称为总学费。

## 全量处理结果

- 硕士费率型记录：151 条
- 博士费率型记录：62 条
- 合计：213 条
- 公开 API 中费率型记录均提供数字化 `tuitionDisplay`，金额字段继续为空。
- MASTER OF ARTS (FINE ARTS) 公开显示为 `USD 1,400 / 学期（全日制）`。

## 验证

- 候选审计：通过
- 硕士专项验证：305 条规范记录，304 条公开
- 博士专项验证：95 条规范记录，93 条公开
- 全量测试：136 通过，1 跳过
- Web 生产构建：通过
- 一键商用门禁：`commercial-release-ready`
- 四语浏览器验收：通过，控制台错误 0
- 门禁报告：`data/imports/usm/2026-06-14/publication/usm-official-rate-display-release-report.json`
- 受控导入前备份：
  - `apps/api/tmp/backups/usm-master-commercial-before-2026-06-15T14-02-27-357Z.json`
  - `apps/api/tmp/backups/usm-phd-commercial-before-2026-06-15T14-02-37-492Z.json`
  - 博士发布证据备份：`data/imports/usm/2026-06-14/publication/usm-phd-before-official-rate-display.json.gz`

## 文档状态

当前环境未连接 Notion 写入工具。本文件作为中文开发记录快照；Notion 尚未同步。
