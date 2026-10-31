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

## 2026-06-16 开学时间语义优化

- 业务口径：马来西亚研究型硕博很多不是固定公开开学月份，申请可全年开放；实际报到/注册时间以学校发放 offer 和注册安排为准。
- 优化规则：
  - 研究型硕博如果没有官方专业页固定月份，不再显示“待官方确认”，统一显示 `Open year-round application`，中文前端展示为“全年开放申请”。
  - 研究型硕博如果官方专业页明确公布具体月份，例如 `April & October`，继续保留具体月份。
  - 授课型、混合型、在线、临床项目继续使用官方公布的固定月份；未公布时仍保持官方未公布/待核验语义，不套用研究型规则。
- 数据库顺序导入：
  - Master 备份：`/Users/ian/Desktop/dev/study-malaysia/apps/api/apps/api/tmp/backups/usm-master-before-year-round-intake-2026-06-16.json`
  - PhD 初次并行备份：`/Users/ian/Desktop/dev/study-malaysia/apps/api/apps/api/tmp/backups/usm-phd-before-year-round-intake-2026-06-16.json`
  - PhD 顺序修复备份：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-phd-before-year-round-summary-fix-2026-06-16.json`
  - 注意：Master 与 PhD 导入不能并行执行，因为两个脚本都会更新 USM 官方 profile summary；本轮已顺序重跑 PhD 导入并恢复 463/460 汇总。
- API 抽样：
  - `MASTER OF ARTS (FINE ARTS)`：`intakeMonths=[]`、`officialIntake=Open year-round application`。
  - `DOCTOR OF PHILOSOPHY (ARCHITECTURE)`：保留 `April & October`。
  - USM 公开 API：463 条规范记录、460 条公开专业、236 条 `Open year-round application`。

## 2026-06-16 辅导学硕士开学月份修正

- 用户反馈：`MASTER IN COUNSELING` 公开详情页和后台仍显示“以院校官方页面为准”，但官方链接内的 `SEMESTER INTAKE` 明确写有 `October`。
- 官方核验：
  - 官方页面：`https://admission.usm.my/index.php/postgraduate/programmes?view=article&id=342&catid=53`
  - 页面标题：`Master in Counselling`
  - 官方字段：`SEMESTER INTAKE` = `October`
  - 页脚：`Last Update: Friday 12 June 2026`
- 实现方式：
  - 在 `scripts/build-usm-master-commercial-candidate.py` 增加 `PROGRAMME_INTAKE_OVERRIDES`，仅覆盖 `USM-PG-ARTICLE-342-733AE3B5` 为 `October`。
  - 重新生成 `data/imports/usm/2026-06-14/master-commercial-candidate.json`，候选记录状态为 `official-programme-page-refreshed-2026-06-12`。
  - 重新顺序导入 Master，再导入 PhD 恢复 USM profile summary。
- 入库备份：
  - Master：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-master-before-counseling-intake-fix-2026-06-16.json`
  - PhD summary 修复：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-phd-before-counseling-summary-fix-2026-06-16.json`
- 验证抽样：
  - API：`MASTER IN COUNSELING` 的 `intakeMonths=["October"]`、`officialIntake=October`。
  - 中文详情页：`开学月份: 10月`，不再显示“以院校官方页面为准”。

## 2026-06-16 辅导学硕士入学与语言要求中文修正

- 用户反馈：同一专业详情介绍页内的“入学与语言要求”仍是通用兜底句，需要按照官方专业页的 `ADMISSION REQUIREMENTS` 与 `LANGUAGE REQUIREMENTS` 准确翻译成中文并放入详情页对应要求区域。
- 官方核验：
  - 官方页面：`https://admission.usm.my/index.php/postgraduate/programmes?view=article&id=342&catid=53`
  - 页面标题：`Master in Counselling`
  - 官方字段：`ADMISSION REQUIREMENTS`、`LANGUAGE REQUIREMENTS`、`DURATION`、`SEMESTER INTAKE`
  - 页脚：`Last Update: Friday 12 June 2026`
- 中文展示口径：
  - 入学要求说明相关领域本科学位、CGPA 2.75/4.00 及以上直接满足；CGPA 2.50-2.74/4.00 需满足研究经验、相关工作经验、学术发表、主修/选修课程 Grade B 或毕业项目 Grade B+ 等条件之一；荣誉本科学位 CGPA 2.00-2.49/4.00 需满足官方列明的更长研究/工作经验及附加条件。
  - 同一中文说明补充心理学与辅导领域经验，特别是参与指导活动和助人过程的经验；录取前需参加面试。
  - 语言要求说明国际申请人须提交 IELTS 5、TOEFL iBT 40、TOEFL Essentials 7.5、PTE 47、Cambridge English (CAE/CPE) 154、Linguaskill Online 154、CIEP Level (ELS) 107 或 MUET 3.5 之一；英语为母语或国家语言、或毕业于英语授课高校者可考虑豁免；申请时未提交英语成绩将被拒。
- 实现方式：
  - 在 `scripts/build-usm-master-commercial-candidate.py` 增加 `PROGRAMME_ACADEMIC_REQUIREMENT_OVERRIDES` 与 `PROGRAMME_LANGUAGE_REQUIREMENT_OVERRIDES`，仅覆盖 `USM-PG-ARTICLE-342-733AE3B5`，来源状态标记为 `official-programme-page-refreshed-2026-06-12`。
  - 在 `apps/api/src/db/import-usm-master-commercial.ts` 增加该专业的 `requirementNote` 中文专门文案，详情页不再显示“相关本科学位或同等学历；具体要求以官方项目页为准。”。
  - 重新生成 `data/imports/usm/2026-06-14/master-commercial-candidate.json` 并顺序导入 Master、PhD，保持 USM profile summary 为 463/460。
- 入库备份：
  - Master：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-master-before-counseling-requirements-zh-2026-06-16.json`
  - PhD summary 修复：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-phd-before-counseling-requirements-summary-2026-06-16.json`
- 验证抽样：
  - API：`officialEntryRequirementSourceUrl` 指向该官方专业页，`officialLanguageRequirement` 保存该页语言要求原文；`languageRequirement` 解析为 `IELTS 5`、`TOEFL iBT 40`、`PTE 47`、`MUET 3.5`。
  - 中文详情页：`语言要求: IELTS 5+ / TOEFL iBT 40+ / PTE 47+ / MUET 3.5+`、`开学月份: 10月`，并显示专业级中文入学要求、面试要求和材料不完整将被拒说明。

## 2026-06-16 辅导学硕士 GPA 结构化字段修正

- 用户反馈：官方专业页 `ADMISSION REQUIREMENTS` 已明确写有 `CGPA of at least 2.75 / 4.00`，详情页不应只在中文说明中出现 GPA，而应同步采集到结构化 GPA 字段。
- 问题原因：
  - 原 `extractCgpa` 只识别 `CGPA 2.75` 或 `minimum of 2.75` 这类紧凑写法。
  - USM 官方页面采用 `CGPA of at least 2.75 / 4.00` 写法，导致 `requirement.gpa` 被解析为 `0`。
- 修正方式：
  - 扩展 `apps/api/src/db/import-usm-master-commercial.ts` 的 GPA 解析规则，支持 `CGPA of at least ...`。
  - 在 `tests/api/usm-master-commercial-import.test.ts` 增加 `MASTER IN COUNSELING` 的 `requirement.gpa = 2.75` 断言。
  - 重新顺序导入 Master、PhD，保持 USM profile summary 为 463/460。
- 入库备份：
  - Master：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-master-before-counseling-gpa-fix-2026-06-16.json`
  - PhD summary 修复：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-phd-before-counseling-gpa-summary-2026-06-16.json`
- 验证抽样：
  - API：`MASTER IN COUNSELING` 的 `requirement.gpa = 2.75`，中文说明仍保留完整 CGPA 分段条件。

## 2026-06-16 辅导学硕士概述与课程设置采集

- 用户反馈：同一官方专业页 `OVERVIEW` 内不只有概述简介，还公布了专修方向、课程设置、实习与项目说明，需要采集到详情页对应位置。
- 官方核验：
  - 官方页面：`https://admission.usm.my/index.php/postgraduate/programmes?view=article&id=342&catid=53`
  - 官方字段：`OVERVIEW`
  - 页脚：`Last Update: Friday 12 June 2026`
- 采集内容：
  - 专业简介：面向辅导教师、私立及公立学院辅导与心理学讲师，以及具有辅导与心理学经验、尤其参与指导活动和助人过程的申请人；课程涵盖辅导体系、行政管理、课程与相关辅导议题。
  - 专修方向：儿童与青少年、婚姻与家庭、危机辅导、组织辅导；官方说明为选择 2 门，共 6 学分。
  - 课程设置：辅导实践理论应用、个人辅导、团体辅导、指导与职业辅导、毕生发展心理学、多元文化辅导、辅导伦理与法律、个体评估、职业辅导、实践课程、婚姻与家庭辅导、婚姻与家庭中的法律和文化议题、理论与人力资源发展、组织中的行为议题、哀伤心理学、危机干预、儿童与青少年心理学、儿童与青少年行为议题。
  - 实习与项目：补充官方 internship 与 project 说明，并标注开设学院为教育研究学院。
- 实现方式：
  - 在 `apps/api/src/db/import-usm-master-commercial.ts` 增加 `localizedCurriculum`、`localizedDescription` 与该专业的 `localizedSpecializations` 映射。
  - 课程清单进入 `curriculum`，四个专修方向进入 `specializations`，专业概述进入 `description`。
  - 在 `tests/api/usm-master-commercial-import.test.ts` 增加中文课程、实习、项目和专修方向断言。
  - 重新顺序导入 Master、PhD，保持 USM profile summary 为 463/460。
- 入库备份：
  - Master：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-master-before-counseling-curriculum-fix-2026-06-16.json`
  - PhD summary 修复：`/Users/ian/Desktop/dev/study-malaysia/apps/api/tmp/backups/usm-phd-before-counseling-curriculum-summary-2026-06-16.json`
- 验证抽样：
  - API：`description.zh-CN` 为专业级概述，`curriculum.zh-CN` 共 22 条，`specializations.zh-CN` 为 4 个官方方向。
  - 中文详情页：显示专业简介、专修课程、课程清单、实习、项目和四个方向标签，控制台错误 0。

## 2026-06-16 USM 硕士详情页字段标准化校对

- 用户反馈：USM 每一个硕士专业的对应链接已在专业详情页内，需要直接采集详情页数据并补充到项目对应位置；本轮按 USM 硕士阶段专业信息标准化校对执行。
- 实现方式：
  - 在 `scripts/build-usm-master-commercial-candidate.py` 增加 `--detail-cache` 读取逻辑，从 `tmp/usm-master-details/usm-pg-article-*.md` 官方详情快照中回填 `programmeContent`。
  - `programmeContent` 结构化保存官方概述、课程结构、课程清单、专修方向、研究方向、实习、项目和开设单位。
  - 在 `apps/api/src/db/import-usm-master-commercial.ts` 中新增通用消费逻辑，将上述字段写入 `description`、`curriculum`、`specializations` 等公开项目字段；保留 `MASTER IN COUNSELING` 的已精修专业级中文文案。
  - 补充教育类和生物过程技术方向词表，修正 `TESOL` 缩写和 Bioprocess 长短语翻译顺序。
- 候选重生成结果：
  - `master-commercial-candidate.json` 仍为 305 条规范硕士、模式统计不变：mixed 51、coursework 57、research 170、online 5、clinical 22。
  - 305 条全部具备 `programmeContent`；291 条回填官方概述；52 条含课程结构；114 条含研究方向；29 条含专修方向；11 条含课程清单；1 条含实习；4 条含项目；169 条含开设单位。
- 入库结果：
  - Master 已顺序导入，备份：`apps/api/tmp/backups/usm-master-before-bioprocess-term-cleanup-2026-06-16.json`。
  - PhD 已顺序重跑以恢复 USM profile 汇总，备份：`apps/api/tmp/backups/usm-phd-before-bioprocess-term-summary-2026-06-16.json`。
  - 数据库校验：USM 硕士规范记录 305、公开硕士 304、国际不可用 1、needs-review 0、旧硕士归档 3。
  - USM 总汇总保持规范记录 463、公开国际生专业 460，本科 63、硕士 304、博士 93。
- 抽样确认：
  - `MASTER IN BIOMEDICAL SCIENCE` 写入课程结构与课程清单。
  - `MASTER IN BIOPROCESS TECHNOLOGY` 写入 8 个研究方向，并完成中文标准化显示。
  - `MASTER OF ARTS (EDUCATION) - CURRICULUM STUDIES` 写入 11 个教育专修方向。
  - `MASTER IN COUNSELING` 保留专业简介、22 条课程/实习/项目和 4 个专修方向。
- 验证：
  - `npm test -- tests/api/usm-master-commercial-import.test.ts tests/api/usm-phd-commercial-import.test.ts tests/web/format.test.ts` 通过。
  - `node scripts/verify-usm-commercial-release.mjs` 通过，决策为 `commercial-release-ready`，报告写入 `tmp/reports/usm-commercial-release-gate.json`。
  - 本轮新增 post-import 展示审计：`data/imports/usm/2026-06-16/master-level-audit/post_import_display_audit.json`。

## 2026-06-16 USM 硕士开学月份漏采修复

- 用户反馈：`MASTER IN GLOBAL ISLAMIC FINANCE` 与 `MASTER OF ARCHITECTURE` 公开详情页官方链接内已明确展示开学月份，但项目中仍显示“以院校官方页面为准”。
- 问题原因：
  - 6 月 14 日 Jina Markdown 缓存中部分详情页只保留了概述正文，没有保留当前官网 HTML tab 中的 `SEMESTER INTAKE` 面板。
  - 导入器的研究型开学月份逻辑此前只接受 `official-programme-specific` 状态；即使候选后续刷新成 `official-programme-page-refreshed-*`，研究型项目仍可能被覆盖成 `Open year-round application`。
- 全面检测：
  - 使用当前 USM 官方 HTML 对硕士唯一详情页重新抽取 `SEMESTER INTAKE`；官方站点直连覆盖 233 条记录级检查。
  - 对直连失败页面使用只读文本代理补抓，补充 29 条记录级检查；64 条记录级检查仍受传输限制，不把传输失败视为官方未公布。
  - 在可读取的当前官方页面中发现 23 条候选漏采或被通用规则覆盖的开学月份。
  - 修复后实质剩余差异为 0；另有 2 条仅为 `October & April` 与 `April & October` 顺序差异。
- 修复内容：
  - `scripts/build-usm-master-commercial-candidate.py` 新增 `--current-html-cache`，从当前官方 HTML 的 `SEMESTER INTAKE` 面板抽取月份并写入候选。
  - `apps/api/src/db/import-usm-master-commercial.ts` 修正研究型开学时间展示逻辑，允许 `official-programme-page-refreshed-2026-06-16` 这类官方项目页刷新状态保留具体月份。
  - `tests/api/usm-master-commercial-import.test.ts` 新增断言覆盖：
    - `MASTER IN GLOBAL ISLAMIC FINANCE`：`April & October`
    - `MASTER OF ARCHITECTURE`：`October`
    - `MASTER OF SCIENCE (COMPUTER SCIENCE)` 特定研究型记录：`April & October`
- 入库结果：
  - Master 已重新导入，备份：`apps/api/tmp/backups/usm-master-before-current-html-intake-fix-2026-06-16.json`。
  - PhD 已顺序重跑以恢复 USM profile 汇总，备份：`apps/api/tmp/backups/usm-phd-before-current-html-intake-summary-2026-06-16.json`。
  - 数据库抽样确认：伊斯兰金融硕士为 `April & October`，建筑学硕士为 `October`，对应 `intakeMonths` 已结构化。
- 验证：
  - `npm test -- tests/api/usm-master-commercial-import.test.ts tests/api/usm-phd-commercial-import.test.ts tests/web/format.test.ts` 通过。
  - `node scripts/verify-usm-commercial-release.mjs` 通过，决策仍为 `commercial-release-ready`。
  - 新增审计报告：`data/imports/usm/2026-06-16/master-level-audit/current_html_intake_fix_audit.json`。

## 2026-06-16 USM 硕士字段覆盖率查漏补缺

- 用户要求：按标准流程完成 USM 硕士数据查漏补缺，重点避免从一开始的信息采集阶段漏采官方详情页字段，再靠后续反复校对修补。
- 执行边界：
  - 本轮仅执行 `collect-audit-no-import`，不写入数据库，不发布公开数据，不提交代码。
  - 以 USM 当前硕士规范口径 305 条为准，旧 274 条口径不再作为验收依据。
  - 官方来源继续限定为 USM Postgraduate 目录、当前详情页 HTML、官方费用页、OnlineIPS 指南和已版本化缓存。
- 问题原因：
  - 旧 Jina Markdown 详情缓存没有稳定保留 `ADMISSION REQUIREMENTS`、`LANGUAGE REQUIREMENTS`、`DURATION` 等当前官网 HTML 面板。
  - 旧缺口审计把传输层缺字段等同于项目级官方未公布，导致 56 条学术要求和 56 条语言要求落入通用规则。
- 修复方式：
  - 在 `scripts/build-usm-master-commercial-candidate.py` 增加当前 HTML section 解析，统一抽取 `OVERVIEW`、`ADMISSION REQUIREMENTS`、`LANGUAGE REQUIREMENTS`、`DURATION`、`SEMESTER INTAKE`。
  - 字段优先级调整为：已核准的专业级 override、当前官方 HTML section、旧官方详情来源、官方通用规则。
  - 重新生成 `data/imports/usm/2026-06-14/master-commercial-candidate.json`，并刷新 `data/imports/usm/2026-06-16/master-level-audit/` 下的运行契约、层级清单、来源索引、候选摘要、导入前缺口审计和当前官方字段覆盖率审计。
- 查漏补缺结果：
  - 候选记录保持 305 条，模式统计保持 mixed 51、coursework 57、research 170、online 5、clinical 22。
  - 学术要求和语言要求由当前官方 HTML 面板批量补齐 229 条；旧的通用规则数量从 56 条降至 9 条。
  - 学制由当前官方 HTML 回填 205 条，仅 4 条继续使用研究型官方规则。
  - 剩余 9 条通用规则均已写入 `current_official_field_coverage_audit.json`，原因统一为当前传输没有可解析的项目级 admission/language 面板，因此保留 USM 官方研究生通用规则和来源证据，不臆造专业级要求。
- 验证结果：
  - `python3 scripts/verify-usm-master-commercial-candidate.py --manifest data/imports/usm/2026-06-14/master-commercial-candidate.json` 通过，errors 为 0。
  - `python3 scripts/audit-official-total-tuition.py data/imports/usm/2026-06-14/master-commercial-candidate.json --summary-only` 通过，305 条硕士中 121 条官方总额、151 条官方费率型、33 条官方未公布或无唯一当前费用行。
  - `npm test -- tests/api/usm-master-commercial-import.test.ts tests/web/format.test.ts` 通过。
  - `python3 -m py_compile scripts/build-usm-master-commercial-candidate.py scripts/verify-usm-master-commercial-candidate.py scripts/audit-official-total-tuition.py` 通过。
  - JSON 结构校验通过：候选文件、`level_manifest.json`、`pre_import_gap_audit.json`、`current_official_field_coverage_audit.json` 均可解析。

## 2026-06-16 全院校通用防返工规则

- 用户强调：不要到处缺失个别数据，导致后续不断返工。
- 执行口径已固化：任何单个专业被发现官网有值但项目缺失时，不能只修该专业，必须把问题升级为同层级、同字段、同页面结构、同来源类型的批量缺口审计。
- 后续院校采集不再把 USM 经验作为孤例，而是按不同官网公布方式灵活选择策略：静态 HTML 解析、tab/accordion/隐藏面板解析、JavaScript 渲染页面浏览器采集、PDF/招生手册抽取、学院子站或申请指南交叉校验。
- 缓存、Markdown reader、文本代理和搜索结果只作为传输或发现层；这些层缺字段时，不能直接判定官方未公布，必须回到当前官方页面或官方附件核验。
- 修复优先落在构建器、解析器、字段映射、导入器和审计门禁中，并重新生成候选、导入和验证；禁止只手改生成 JSON 来掩盖个别缺失。
- 本轮已同步更新通用 skill `studymy-official-university-collector` 与项目发布流程 `docs/prd/USM-commercial-release-workflow.md`。真实 Notion 暂无可写连接，本地中文快照已记录。

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
  - 开学时间浏览器抽样：研究型缺固定月份详情页显示“全年开放申请”；官方明确月份的研究型博士详情页显示“4月 & 10月”。

## 文档状态

当前环境未连接 Notion 写入工具。本文件作为中文开发记录快照；真实 Notion 尚未同步。
