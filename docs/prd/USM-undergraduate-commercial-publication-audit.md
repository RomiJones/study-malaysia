# USM 本科官方数据商用发布审计

## 发布结论

- 发布日期：2026-06-13
- 学年口径：USM 国际本科 2025/2026
- 规范专业数：63
- 代码唯一数：63
- 公开可展示数：63
- 官方来源已核验数：63
- 官方学费已匹配数：63
- 境外合作项目：4
- 同时开放 10 月和 3 月入学的项目：9
- 马来语授课标记项目：3

本次发布以 USM 官方 First Degree Prospectus 为规范目录，当前国际本科 CSV 仅用于变化检测。原 91 行 CSV 审核记录和旧数据继续保留为历史证据，但全部退出公开目录。

## 官方来源

1. [USM Prospectus for First Degree Academic Session 2025/2026](https://admission.usm.my/images/00uginternational/download_2025/PROSPECTUS_FOR_FIRST_DEGREE_2025-2026.pdf)
   - 73 页
   - SHA-256：`5b9587640dd81105148b618d98eb6096409f4ed35c514a61b3cd5795d0308621`
   - 用途：专业目录、代码、院系、学制、入学要求、语言要求、面试、职业方向和费用的规范来源
2. [USM Summary of Programme 2025/2026](https://admission.usm.my/images/00uginternational/download_2025/SUMMARY_OF_PROGRAMME.pdf)
   - SHA-256：`69e2ba522ae7074bfc1a8ff03c84d71863df22c755333c9162af0dbebb240056`
   - 用途：专业数量、学期和授课语言交叉核对
3. [USM Undergraduate International Tuition Fees](https://admission.usm.my/images/00uginternational/fee_2025/UNDERGRADUATE_INTERNATIONAL_TUITION_FEES_PER_SEMESTER.pdf)
   - SHA-256：`12f9a395911c5fc4858dc6ef7ea5ae88881867dca01ca079f8dcd4214f814404`
   - 用途：国际本科费用交叉核对
4. [USM 当前国际本科 CSV](https://admission.usm.my/images/data/antarbangsa.csv)
   - SHA-256：`ae455fbacf0d3dbc2c7ba01528b7f9bc1d75ad8aa678bdbde73b5dd5b6b3ef91`
   - 用途：变化检测，不作为规范主表
5. [USM 2026/2027 本地本科简章](https://pohon.usm.my/dokumendoc/2026_2027/Brochure_Saluran%20Perdana%20_Final.pdf)
   - 2 页
   - SHA-256：`b7d4bf3fce49adc883077a06c691e3be9b4b4eb0815b26211c7956386f6cd854`
   - 用途：官方马来文专业名交叉核对

## 冲突裁决

- `US6524001`：规范为 Chemical Engineering，不采用 CSV 的 Pharmacy 错配。
- `US6545003`：规范为 Medical Physics，不采用 CSV 的 Nutrition 错配。
- `US6581002`：规范为 Urban and Regional Planning，不采用 CSV 的 Architecture 错配。
- `US6545002`：规范为 Industrial Chemistry，不采用 CSV 的 Environmental and Occupational Health 错配。
- `US6526001`、`US6581002`、`US6582001`、`US6345001` 存在官方页内部学制或费用算术不一致；系统保留官方公布值和冲突备注，不自行重算。
- 2025 年历史申请截止日期已经失效，不作为当前截止日期展示。
- 官方简章没有公布完整课程清单和逐专业认证详情，系统明确显示“未公布”，不作推断。

## 数据与实现

- 采集脚本：`scripts/collect-usm-undergraduate-commercial.py`
- 可复现来源清单：`data/imports/usm/2026-06-13/undergraduate-commercial-source.json`
- 受控导入器：`apps/api/src/db/import-usm-undergraduate-commercial.ts`
- 专项门禁：`tests/api/usm-commercial-import.test.ts`
- 学费字段升级为 `DECIMAL(12,2)`，保留 `10937.50`、`2285.71` 等官方美元小数。
- API 将 MySQL `DECIMAL` 稳定转换为数字。
- 费用计算器按 `tuitionAmount + tuitionCurrency` 识别项目总学费，USM 不再被误算为 0 或重复乘以学制。
- USM 公开页面以官方公布的 USD 为主币种；院校主页仅在 63 项费用全部核验且币种一致时汇总显示官方总学费区间，不显示非官方换算值。
- 专业详情保留官方每学期学费、项目总学费、周期性费用、注册费和来源证据，避免主页汇总金额替代项目级费用口径。
- 四语名称、院系、简介、申请摘要、材料、职业和专业方向完整；官方英文长条款以“官方来源原文”明确展示。

## 发布验证

- 数据库：63 条规范记录、63 个唯一代码、63 条公开 ready、63 条官方核验、63 条费用匹配。
- 历史记录：104 条审核或归档记录保留，公开泄漏 0 条。
- API：`/api/programs?universityId=2&pageSize=100` 返回 63 条；大学详情嵌入 63 条本科专业。
- 费用 API：音乐荣誉学士返回 `USD 10,938` 项目总学费，来源口径为 `official-program-total`。
- 浏览器：简体中文、繁体中文、英文、马来语均通过 USM 列表和管理学详情弹窗检查；控制台错误 0。
- 全量测试：128 项，127 通过，1 项按仓库条件跳过。
- 全工作区构建：通过；管理端存在既有大 chunk 警告，不影响本次 USM 数据发布。
- `verify:task041:i18n`：仓库当前脚本对长学制英文的预期与现有单元测试相互冲突，仍报 3 条既有 duration 规则错误；本次新增的四语 USM 页面已通过真实浏览器验收。

## 回滚

写库前备份保存在本地 `apps/api/tmp/backups/`。该目录不提交到 Git，包含 USM 院校和全部旧专业记录，可用于人工回滚。

## Notion

当前 Codex 会话没有可写入的 Notion 连接。已更新本地中文任务快照和开发日志，真实 Notion 页面未同步。
