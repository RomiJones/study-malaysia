# INTI 深挖校对与验收缺口报告

- 批次目录：`data/imports/iiu/2026-06-20/iiu-20260620`
- 复核日期：2026-06-21
- 复核口径：StudyMY 最新官方采集 skill、反遗漏标准、字段展示契约、Ian 商用列表与详情页验收标准
- 结论：数量基线闭合，但当前仍不满足直接公开商用展示；应保持 `review-required`

## 总体状态

- 官方目录行处置：151 条
- 本硕博候选：107 条
- 本科：74 条
- 硕士：23 条
- 博士：10 条
- ready：0 条
- needs-review：107 条
- 国际学生不可用：0 条

## 费用校对

- INTI 官网当前费用均以 `Approx. RM ...` 发布，并说明国际学生费用另加 6% SST。
- 因此本轮不再把唯一数字直接作为精确 `verified-official-total`。
- `official-approximate-excluding-sst`: 91
- `official-non-scalar-approximate-excluding-sst`: 16

## 语言要求校对

- 缺官方语言要求或无法从 HTML/PDF 稳定归属：14 条
- 有语言原文但缺稳定 IELTS 列表摘要：26 条

缺语言/IELTS 摘要样例：
- `INTI-B-002` Australian Degree Transfer Programme (Commerce)
- `INTI-B-003` Australian Degree Transfer Programme (Science)
- `INTI-B-004` B.A. (Hons) in Fashion Management and Communication 3+0 in collaboration with Sheffield Hallam University, UK
- `INTI-B-009` Bachelor of Accountancy (Honours)
- `INTI-B-015` Bachelor of Arts (Honours) Digital Media
- `INTI-B-021` Bachelor of Banking and Finance (Honours)
- `INTI-B-022` Bachelor of Biotechnology (Hons)
- `INTI-B-027` Bachelor of Business (Honours) Digital Enterprise Management
- `INTI-B-036` Bachelor of Business (Honours) Management
- `INTI-B-040` Bachelor of Civil Engineering with Honours
- `INTI-B-043` Bachelor of Computer Science (Hons)
- `INTI-B-056` Bachelor of Mechanical Engineering with Honours
- `INTI-M-018` Master of Science in Engineering and Eco-Innovation (by Research)
- `INTI-M-019` Master of Science in Facilities Management (Online Learning)

## 层级映射校对

- 官网 taxonomy 标为 Degree 但 award title 为 Master of Engineering 的记录仍需产品层级人工决策：
- `INTI-B-072` Master of Engineering in Electrical and Electronic Engineering 4+0 in collaboration with Coventry University, UK
- `INTI-B-073` Master of Engineering in Mechanical Engineering 4+0 in collaboration with Coventry University, UK

## 展示结构校对

- 时长不能稳定规范化为 years-only list 值：1 条
- zh-CN/zh-TW/ms 本地化尚未完成：107 条。官方英文证据已保留，但不能直接作为中文前台内容。

## 课程与职业方向

- 课程设置官方未公布：4 条
- `INTI-B-023` Bachelor of Business (3+0) in collaboration with Swinburne University of Technology, Australia
- `INTI-B-041` Bachelor of Computer Science (3+0) in collaboration with Swinburne University of Technology, Australia
- `INTI-B-042` Bachelor of Computer Science (Honours) (Online Learning)
- `INTI-B-057` Bachelor of Media and Communication (3+0) in collaboration with Swinburne University of Technology, Australia
- 职业方向官方未公布：3 条
- `INTI-P-008` Doctor of Philosophy (PhD) (Innovation and Technology) (by Research)
- `INTI-M-001` Master in Education Management
- `INTI-M-022` Master of Science in Integrated Project Management (Online Learning)

## 路线型要求

- 已从官方要求/课程/职业文本中结构化识别以下路线型要求，后续可用于详情页 badge 或人工复核：
- `healthOrMedical`: 24
- `internshipOrPracticum`: 38
- `portfolio`: 16
- `proposalOrSupervisor`: 15
- `publication`: 4
- `testOrPlacement`: 23
- `workExperience`: 34

## 中国学生路径

- 官方国际入学要求页已解析 China general-rule：Senior Secondary School Graduation Certificate (SM3 / Year 12)、Vocational / Technical Secondary School、Zhong Zhuan、Jixiao、Zhejiang Secondary Specialised School。
- 该路径为院校级 general-rule，不代表每个专业的额外科目、作品集、健康检查或面试要求已被中国学生路径覆盖。

## 下一步建议

1. 人工确认是否允许前台显示 INTI 官方 approximate fee，并以“不含 6% SST”的费用状态展示。
2. 继续补查仍缺 IELTS 摘要的专业，尤其是 Swinburne/Coventry/online programme 的官方 partner requirement。
3. 人工确认 2 条 Master of Engineering 的产品层级。
4. 执行中文/繁体/马来本地化与 public-display formatter pass。
5. 如要入库审核，再走 controlled review import，不进入公开学生目录。
