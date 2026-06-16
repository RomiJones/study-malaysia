# USM 最终字段确认：语言要求并列展示

## 任务边界

- 院校：Universiti Sains Malaysia（USM）
- 层级：硕士、博士
- 学生范围：国际学生
- 任务日期：2026-06-16
- 本轮目标：在已完成的 USM 463 条规范项目基础上，继续确认详情页核心字段展示，重点补齐官方语言要求中的 IELTS、TOEFL iBT、PTE、MUET 等效分数。

## 官方来源逻辑

- 专业身份、学费、开学月份、学制继续沿用已审计的 USM 官方招生目录、专业详情页、官方学费入口和 OnlineIPS 指南。
- 官网直接公布总学费的专业继续展示官方总额。
- 官网只公布学期费率的硕博专业继续按官方全日制费率与官方最短全日制学制计算一个标准总学费，并在详情页展示计算公式与排除项。
- 语言要求以专业详情页或官方通用研究生语言要求文本为准，解析并展示 IELTS、TOEFL iBT、PTE、MUET。

## 2026-06-16 继续核验

- 重新打开 USM 官方 Postgraduate、Postgraduate Fees、General Entry Requirements 与 IPS Admission 页面。
- USM Postgraduate 页面当前页脚为 `Last Update: Friday 12 June 2026`，仍作为硕博目录入口。
- USM General Entry Requirements 当前页脚为 `Last Update: Friday 12 June 2026`，语言要求仍明确列出 IELTS 5、TOEFL Internet-based 40、PTE 47、MUET 3.5 的通用最低线，并提示按各专业要求核对。
- USM Postgraduate Fees 页面仍展示 Mixed/Coursework/Clinical 总学费表，以及 Research Mode 每学期费率表；页面文字仍注明研究型费用为 `total per semester`，因此研究型总学费继续按官方全日制费率与官方最短学制计算并标注公式。
- IPS Admission 页面重新抓取到 `tmp/usm-final-confirmation/ips-admission-downloads-2026-06-16.html`，SHA-256 为 `bb0e56bcfa5294b2f8c16c9cddf4446e0ef30a40c0d89231bea060437e9fc2e5`，当前页脚为 `Last Modified: Monday 15 June 2026`。
- IPS Admission 页面继续显示 Coursework/Mixed/Online Mode `September 2026` intake，并保留 Academic Session 2025/2026 日历入口 `October 2025 / March 2026 intake`。

## 本次修改

- 硕士与博士导入器从官方语言要求文本中解析：
  - IELTS
  - TOEFL iBT（排除 TOEFL Essentials）
  - PTE
  - MUET
- 专业详情页展示并列语言分数，例如：
  - `IELTS 5+ / TOEFL iBT 40+ / PTE 47+ / MUET 3.5+`
- 院校专业列表仍保持紧凑 IELTS 标签，避免列表列宽被长分数串撑开。
- 保持既有总学费、开学月份、年制学制和公开状态数量不变。

## 入库结果

- 规范记录：本科 63、硕士 305、博士 95，共 463。
- 公开国际生专业：本科 63、硕士 304、博士 93，共 460。
- 公开费用状态：194 条官方总额、213 条按官方费率与学制计算、53 条未公布。
- Master 导入前备份：`apps/api/tmp/backups/usm-master-commercial-before-2026-06-16T09-34-35-566Z.json`
- PhD 导入前备份：
  - `apps/api/tmp/backups/usm-phd-commercial-before-2026-06-16T09-34-35-703Z.json`
  - `apps/api/tmp/backups/usm-phd-commercial-before-2026-06-16T09-35-09-002Z.json`

## 验证

- 定向测试：
  - `npm test -- tests/api/usm-master-commercial-import.test.ts tests/api/usm-phd-commercial-import.test.ts`
  - `npm test -- tests/web/format.test.ts`
- 构建：
  - `npm --workspace @studymy/api run build`
  - `npm --workspace @studymy/web run build`
- 浏览器抽样：
  - Counseling 详情页显示 `IELTS 5+ / TOEFL iBT 40+ / PTE 47+ / MUET 3.5+`、`USD 9,010`、`1-2年`
  - PhD Architecture 详情页显示同组语言分数、`USD 7,400`
  - 控制台错误 0
- 一键商用门禁：`commercial-release-ready`
- 发布报告：`data/imports/usm/2026-06-15/publication/usm-final-language-confirmation-release-report.json`
- 本轮重跑门禁报告：`tmp/reports/usm-commercial-release-gate.json`
  - `public API invariants`：463 条规范记录、460 条公开专业，本科 63、硕士 304、博士 93。
  - 费用状态：194 条官方总额、213 条按官方费率与学制计算、53 条未公布。
  - `four-locale browser tuition audit`：zh-CN、zh-TW、en、ms 通过，控制台错误 0。

## 文档状态

当前环境未连接 Notion 写入工具。本文件作为中文开发记录快照；真实 Notion 尚未同步。
