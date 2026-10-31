# 任务：USM 国际博士官方数据采集、审计与可入库候选

## 2026-06-17 最终修复更新

用户指出仍有两条博士专业不对后，已重新核验当前官方详情页和费用证据，并修复旧动态目录标题误判问题。当前最终验收口径如下：

- 博士规范记录：95。
- 博士公开 ready：95。
- 博士 `needs-review`：0。
- 博士 `not-available-for-international`：0。
- USM 全层级规范记录：463。
- USM 全层级公开记录：462，本科 63、硕士 304、博士 95。
- 全层级唯一官方总学费：196；按官方费率和官方最短学制计算：213；官方未公布数字费用：53。

两条此前被判为不适用于国际学生的记录已经修正：

- `USM-PHD-ARTICLE-348-5EFB3077`：当前官方详情页 H1 为 `Doctor of Education in Curriculum & Instruction`，语言要求写明适用于国际申请人，当前官方费用表有 International `USD 18,000`。
- `USM-PHD-ARTICLE-349-8BE97FAD`：当前官方详情页 H1 为 `Doctor of Education in TESOL`，语言要求写明适用于国际申请人，当前官方费用表有 International `USD 18,000`。

根因是旧动态目录标题中的 `Malaysian Candidate Only` 被采集器优先级过高地保留下来；当前详情页 H1、国际申请语言要求和官方国际费用表已经共同推翻旧标题标记。采集器、导入器、专项测试、商业发布门禁和验收报告均已按 95 条公开博士固定。

## 2026-06-14 发布更新

博士规范总数仍为 95，现已完成受控入库和公开发布门禁：72 条 `ready`、21 条 `needs-review`、2 条 `not-available-for-international`。75 条专业级 intake 未公布和 20 条唯一国际学费未公布作为公开披露警告，不再自动阻断；20 条 offshore 国际资格未确认项目及 1 条未公布数字学制的 DBA 继续隔离。以下“仅采集、不写数据库”及 14 / 79 / 2 的内容仅保留为采集阶段记录，最终结论以 `TASK-USM-ALL-LEVEL-AUDIT-20260614.md` 和 `USM-all-level-official-publication-audit.md` 为准。

- **任务标识**：TASK-USM-PHD-COLLECT-20260614
- **状态**：已完成（当前官方 95 条规范博士项目已全量覆盖）
- **优先级**：最高
- **任务类型**：官方数据采集、规范化、审计与入库候选
- **授权来源**：用户于 2026-06-14 明确要求按照升级后的专用 Skill 一次完成

## 任务目标

按 StudyMY 官方院校采集标准，完成 USM 面向国际申请人的博士项目官方来源快照、规范项目身份、培养模式、院系、校区、学制、开学时间、费用、要求、申请材料、证据、异常队列和交付审计，产出不写数据库的可入库审核候选。

## 当前边界

- 院校：Universiti Sains Malaysia（USM）。
- 层级：`phd`。
- 申请人范围：国际申请人。
- 当前目录：截至 2026-06-14 的 USM 新版动态研究生目录。
- 费用口径：2025/2026 官方研究生费用表。
- 授权：`collect`，不执行数据库写入、API 发布或前端上线。
- 不修改 USM 本科、硕士、其它院校或用户数据。

## 验收标准

- 新版规范目录、旧详情目录和 offshore 申请代码分别统计。
- 独立项目、研究方向、离岸开设、联合学位和具名专业博士正确区分。
- 研究型费用仅在院系、国际生费率和 4–10 学期范围均明确时计算总学费区间。
- 13 条具名博士费用全部映射，无法唯一匹配的项目保持官网未公布。
- 国际资格、学制、开学时间、要求、材料和证据均有明确状态。
- 全部记录分区为 `ready`、`needs-review` 或 `not-available-for-international`。
- 专项记录验证和 delivery envelope 审计无错误。
- 不写数据库。

## 执行结果

- 新版官方动态目录筛选 `PHD/DOCTORATE`：95 条，91 个唯一详情 URL。
- 规范博士项目候选：95，逐行名称、URL、模式、学位类型和学院对账缺失 0、额外 0。
- 旧目录博士详情入口：129；作为细分详情和历史交叉证据，不再冒充当前规范项目数。
- 新版目录新增旧目录之外的详情 URL：9，已全部采集。
- 联合详情证据：138 个唯一页面记录，传输失败 0。
- Offshore 官方申请代码：24；19 个映射当前规范项目，5 个仅有申请代码并进入 offering 审核队列。
- 状态分区：`ready` 14、`needs-review` 79、`not-available-for-international` 2。
- 培养模式：research 82、coursework 6、mixed 6、online 1。
- 开设类型：本部或未单列 70、offshore 20、joint-degree 3、dual-degree 2。
- 费用：59 条官方组件计算区间、13 条官方总学费、23 条官网未公布。
- 数据库状态：`not-performed`。
- 最终交付决策：`audited-candidate-with-review-exceptions`。

## 异常说明

- 75 个项目未公布专业级 intake。
- 23 个项目未得到明确国际资格确认，同时没有唯一适用的当前国际学费。
- 2 个项目未公布可结构化的数字学制。
- 同一记录可同时命中多项原因，因此异常记录总数为 79，不等于原因次数之和。

## 产物

- `data/imports/usm/2026-06-14/phd-current-catalogue.json`
- `data/imports/usm/2026-06-14/phd-official-source.json`
- `data/imports/usm/2026-06-14/phd-candidate.json`
- `data/imports/usm/2026-06-14/phd-audit.json`
- `data/imports/usm/2026-06-14/phd-delivery.json`
- `docs/prd/USM-phd-official-collection-technical-design.md`
- `docs/prd/USM-phd-official-collection-audit.md`

## 2026-06-16 博士字段覆盖率查漏补缺

- 用户要求：在硕士阶段达标后，对 USM 博士专业开始标准化信息数据的查漏补缺校对。
- 执行边界：
  - 本轮仅执行 `collect-audit-no-import`，未写入数据库、未发布公开端、未提交代码。
  - 仅处理 `USM`、`level=phd`、国际申请人范围，不修改本科、硕士或其它院校数据。
  - 当前博士规范口径仍为 95 条，其中 93 条公开、2 条国际生不可用、0 条待审核。
- 修复内容：
  - 在 `scripts/build-usm-phd-candidate.py` 增加当前官方 HTML 面板解析，读取 `OVERVIEW`、`ADMISSION REQUIREMENTS`、`LANGUAGE REQUIREMENTS`、`DURATION`、`SEMESTER INTAKE`。
  - 新增 `--current-html-cache`，默认读取 `tmp/usm-phd-current-html`。
  - 候选记录新增 `durationProvenance` 与 `intakeProvenance`，避免旧结构中单一 `provenance` 同时代表不同字段。
  - DBA 当前官方页面学制更新为 `Full time: 7 semesters to 10 semesters Part time: 10 semesters to 14 semesters`，测试断言已按当前官方文本更新。
- 官方当前 HTML 覆盖结果：
  - 博士唯一详情 URL：91。
  - 当前 HTML 成功抓取：20 个唯一详情页，对应 22 条候选记录。
  - 当前 HTML 传输失败：71 个唯一详情页，已记录为 transport exception，不判定为官方未公布。
  - 学术要求 `general-rule` 从 32 条降至 24 条。
  - 语言要求 `general-rule` 从 32 条降至 26 条。
  - 剩余通用规则记录均保留 USM 官方研究生通用规则和来源证据，不臆造专业级要求。
- 新增审计产物：
  - `data/imports/usm/2026-06-16/phd-level-audit/run_contract.json`
  - `data/imports/usm/2026-06-16/phd-level-audit/level_manifest.json`
  - `data/imports/usm/2026-06-16/phd-level-audit/source_cache_index.json`
  - `data/imports/usm/2026-06-16/phd-level-audit/candidate_dataset.json`
  - `data/imports/usm/2026-06-16/phd-level-audit/pre_import_gap_audit.json`
  - `data/imports/usm/2026-06-16/phd-level-audit/current_official_field_coverage_audit.json`
- 验证：
  - `python3 scripts/verify-usm-phd-candidate.py --manifest data/imports/usm/2026-06-14/phd-candidate.json` 通过。
  - `python3 scripts/audit-official-total-tuition.py data/imports/usm/2026-06-14/phd-candidate.json --summary-only` 通过。
  - `python3 -m py_compile scripts/build-usm-phd-candidate.py scripts/verify-usm-phd-candidate.py scripts/audit-official-total-tuition.py` 通过。
  - `npm test -- tests/api/usm-phd-commercial-import.test.ts tests/web/format.test.ts` 通过。
  - JSON 结构校验通过：博士候选、审计、交付和 2026-06-16 博士字段覆盖率审计文件均可解析。

## 2026-06-16 最终标准发布验收

- 用户追加授权：继续完成达到标准，执行范围从博士候选最终审推进到受控入库、公开 API/UI 验收和商业发布门禁。
- 执行流程：
  - 已先运行 `npm --workspace @studymy/api run publish:usm:phd` dry-run，确认写入计划为博士规范 95、公开 93、待审 0、国际生不可用 2。
  - 已执行 `npm --workspace @studymy/api run publish:usm:phd -- --confirm-import --backup-output tmp/backups/usm-phd-commercial-before-final-standard-2026-06-16.json`。
  - 实际备份路径：`apps/api/tmp/backups/usm-phd-commercial-before-final-standard-2026-06-16.json`。
  - 已生成发布后展示审计：`data/imports/usm/2026-06-16/phd-level-audit/post_import_display_audit.json`。
- 入库后数据库验证：
  - 博士规范记录：95。
  - 博士公开记录：93。
  - 博士 `needs-review`：0。
  - 博士国际生不可用：2。
  - 旧博士公开泄漏：0。
  - USM 本硕博规范总数：463。
  - USM 公开总数：460。
- 公开 API 验证：
  - `/api/universities/universiti-sains-malaysia-usm` 返回 `programCount=460`。
  - 公开层级计数：本科 63、硕士 304、博士 93。
  - `catalogStatusSummary.all`：total 463、ready 460、needsReview 0、notAvailableForInternational 3。
  - 公开项目费用状态：matched-official 194、calculated-from-official-rate 213、not-published 53。
  - 公开非 ready 泄漏：0。
- 商业发布门禁：
  - `node scripts/verify-usm-commercial-release.mjs --web-url http://localhost:5173/universities/universiti-sains-malaysia-usm --report tmp/reports/usm-commercial-release-gate.json` 通过。
  - 门禁决策：`commercial-release-ready`。
  - 已通过本科数据库、硕士候选、硕士数据库、博士候选、博士 delivery、博士数据库、学费政策、全量测试、生产构建、四语审计、公开 API invariants 和四语浏览器学费审计。
  - 最新全量测试结果：139 tests，138 pass，1 skipped，0 failed。
- 本轮未提交 Git：当前工作区存在大量非本轮改动，避免把无关文件混入提交。真实 Notion 暂无可写连接，已仅更新本地中文快照。

## 2026-06-17 补充校对

- 用户要求：按照验收标准继续推进补充校对。
- 执行边界：
  - 本轮为 `audit-only-after-publication`，不再次写库、不改变候选事实、不提交 Git。
  - 只校对 USM 博士发布后数据链路：候选、数据库专项验证、公开 API 列表、93 个公开博士详情接口、商业发布门禁和中文审计文档。
- 新增产物：
  - `data/imports/usm/2026-06-17/phd-supplemental-audit/README.md`
  - `data/imports/usm/2026-06-17/phd-supplemental-audit/acceptance_recheck.json`
- 补充校对结果：
  - 博士候选：95 条，ready 93、not-available-for-international 2、needs-review 0。
  - 数据库专项验证：博士规范 95、公开 93、旧博士公开泄漏 0，USM 本硕博规范 463、公开 460。
  - 公开 API 列表：本科 63、硕士 304、博士 93；公开非 ready 泄漏 0；费用范围 0。
  - 公开博士详情接口：93/93 返回 200；要求缺失 0、语言缺失 0、来源缺失 0、列表/详情费用状态不一致 0、估算学费文本 0。
  - 当前公开费用分区：USM 全公开层 matched-official 194、calculated-from-official-rate 213、not-published 53；博士公开层 matched-official 11、calculated-from-official-rate 62、not-published 20。
  - 候选层博士官方总学费为 13 条，但其中 2 条不适用于国际申请人，不进入公开列表，因此博士公开层 official total 为 11 条。
  - DBA 学制按当前官方 HTML 保留为 `Full time: 7 semesters to 10 semesters Part time: 10 semesters to 14 semesters`。
- 文档修正：
  - 已补充 `docs/prd/USM-all-level-official-publication-audit.md` 的 2026-06-17 校对更新，修正旧费用分区与 DBA 旧学制表述。
  - 已补充 `docs/prd/USM-phd-official-collection-technical-design.md` 的发布后校对说明，区分原 collect 技术方案和后续 publish 验收。
- 验证命令：
  - `npm --workspace @studymy/api run verify:usm:phd:commercial` 通过。
  - `python3 scripts/verify-usm-phd-candidate.py --manifest data/imports/usm/2026-06-14/phd-candidate.json` 通过。
  - `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_records.py data/imports/usm/2026-06-14/phd-candidate.json --profile candidate --expected-count 95 --official-domain admission.usm.my --allow-official-rate-calculation --summary-only` 通过。
  - 93 个公开博士详情接口补充校对通过。

## 2026-06-17 最终版博士数据采集

- 用户要求：采用标准工作流和专用 skill 完成最终版博士数据采集。
- 执行边界：
  - 本轮为 `collect`，不再次写库、不发布、不提交 Git。
  - 仅处理 USM 博士层级，申请人范围为国际申请人。
  - 使用 2026-06-14 官方来源快照、2026-06-16 当前官方 HTML 补抓缓存和 2026-06-17 补充验收结果生成最终采集包。
- 最终采集目录：
  - `data/imports/usm/2026-06-17/phd-final-collection/`
- 最终采集产物：
  - `run_contract.json`
  - `level_manifest.json`
  - `source_cache_index.json`
  - `candidate_dataset.json`
  - `exception_queue.json`
  - `pre_import_gap_audit.json`
  - `current_official_diff_audit.json`
  - `phd-candidate.json`
  - `phd-audit.json`
  - `phd-delivery.json`
  - `final_collection_report.json`
  - `README.md`
- 最终采集结果：
  - 规范博士项目：95。
  - 公开 ready：93。
  - `needs-review`：0。
  - 国际生不可用：2。
  - 培养模式：mixed 6、online 1、coursework 6、research 82。
  - 费用：当前官方总学费 13、官方费率 62、官方未公布 20。
  - 当前官方 HTML：尝试 91 个唯一 URL，成功 20，传输异常 71；对应 22 条候选命中当前 HTML。传输异常仅记录为 transport exception，不判定为官方未公布。
  - 最终采集决策：`final-collection-passed`。
- 验证：
  - `python3 scripts/verify-usm-phd-candidate.py --manifest data/imports/usm/2026-06-17/phd-final-collection/phd-candidate.json` 通过。
  - `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_records.py data/imports/usm/2026-06-17/phd-final-collection/phd-candidate.json --profile candidate --expected-count 95 --official-domain admission.usm.my --allow-official-rate-calculation --summary-only` 通过。
  - `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_delivery.py data/imports/usm/2026-06-17/phd-final-collection/phd-delivery.json --summary-only` 通过，状态为 `ready-for-controlled-import`。
  - `python3 scripts/audit-official-total-tuition.py data/imports/usm/2026-06-17/phd-final-collection/phd-candidate.json --summary-only` 通过。
  - `python3 -m py_compile scripts/build-usm-phd-candidate.py scripts/verify-usm-phd-candidate.py scripts/audit-official-total-tuition.py` 通过。
  - `npm test -- tests/api/usm-phd-commercial-import.test.ts tests/web/format.test.ts` 通过：17 项通过，0 失败。

## 2026-06-17 最终固定入库

> 注意：本节记录的是 2026-06-17 早前的旧判断，已经被后续“两条博士误判修复与最终验收”覆盖。当前验收口径以本文顶部“2026-06-17 最终修复更新”和下方“2026-06-17 两条博士误判修复与最终验收”为准：博士 95 条全部公开 ready，博士 `not-available-for-international=0`。

- 用户要求：达到验收标准后将 USM 博士数据入库固定，并说明 2 条不适用于国际学生的原因。
- 入库源：
  - `data/imports/usm/2026-06-14/phd-candidate.json`
  - `data/imports/usm/2026-06-17/phd-final-collection/phd-candidate.json`
  - 两份候选 SHA-256 均为 `5920f855a59f8113061deaf5ae0e4afb98873d9c0335e074c553c443a15dd492`，内容一致。
- 2 条国际生不可用记录：
  - `USM-PHD-ARTICLE-348-5EFB3077`：`DOCTOR OF EDUCATION IN CURRICULUM & INSTRUCTION *MALAYSIAN CANDIDATE ONLY`，官方项目名称明确标注 `MALAYSIAN CANDIDATE ONLY`。
  - `USM-PHD-ARTICLE-349-8BE97FAD`：`DOCTOR OF EDUCATION IN TESOL - MALAYSIAN CANDIDATE ONLY`，官方项目名称明确标注 `MALAYSIAN CANDIDATE ONLY`。
  - 两条均保留在规范目录与审计层，状态为 `not-available-for-international`，不进入公开国际学生专业列表。
- 入库执行：
  - 已先运行 `npm --workspace @studymy/api run publish:usm:phd` dry-run，计划为博士规范 95、公开 93、待审 0、国际生不可用 2。
  - 已执行 `npm --workspace @studymy/api run publish:usm:phd -- --confirm-import --backup-output tmp/backups/usm-phd-commercial-before-final-fixed-2026-06-17.json`。
  - 实际备份路径：`apps/api/tmp/backups/usm-phd-commercial-before-final-fixed-2026-06-17.json`。
- 入库后验证：
  - `npm --workspace @studymy/api run verify:usm:phd:commercial` 通过：博士规范 95、公开博士 93、待审 0、国际生不可用 2、旧博士公开泄漏 0。
  - USM 本硕博规范总数 463、公开总数 460。
  - `npm test -- tests/api/usm-phd-commercial-import.test.ts tests/web/format.test.ts` 通过：17 项通过，0 失败。
  - `python3 scripts/verify-usm-phd-candidate.py --manifest data/imports/usm/2026-06-14/phd-candidate.json` 通过。
  - `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_records.py data/imports/usm/2026-06-14/phd-candidate.json --profile candidate --expected-count 95 --official-domain admission.usm.my --allow-official-rate-calculation --summary-only` 通过。
  - `python3 scripts/audit-official-total-tuition.py data/imports/usm/2026-06-14/phd-candidate.json --summary-only` 通过。
  - `node scripts/verify-usm-commercial-release.mjs --api-url http://127.0.0.1:3000/api/universities/universiti-sains-malaysia-usm --web-url http://127.0.0.1:5173/universities/universiti-sains-malaysia-usm --report tmp/reports/usm-commercial-release-gate-final-fixed-20260617.json` 通过，决策为 `commercial-release-ready`。

## 2026-06-17 两条博士误判修复与最终验收

- 用户要求：修复仍然不对的两条博士专业，核心目标是专业数量足够一致，相关专业信息全部校对完整，避免再次返工。
- 根因：两条 Doctor of Education 在旧动态目录标题中残留 `Malaysian Candidate Only`，但当前官方详情页 H1 已不带该限制，且当前详情页语言要求明确适用于国际申请人，官方费用表也发布了 International `USD 18,000`。上一版采集器错误地让旧标题优先级压过当前详情页和费用表证据。
- 修复内容：
  - `scripts/build-usm-phd-candidate.py` 读取当前详情页 H1，并在 H1 不含 Malaysian-only 标记时清理旧标题。
  - 当前详情页国际申请语言要求和官方国际费用同时存在时，`internationalEligibility.status` 判定为 `eligible`。
  - `scripts/verify-usm-phd-candidate.py`、`apps/api/src/db/import-usm-phd-commercial.ts`、`tests/api/usm-phd-commercial-import.test.ts`、`scripts/verify-usm-commercial-release.mjs` 均改为锁定博士 95 条公开、0 条博士国际生不可用。
- 修复记录：
  - `USM-PHD-ARTICLE-348-5EFB3077`：公开名 `DOCTOR OF EDUCATION IN CURRICULUM & INSTRUCTION`，公开 ready，`USD 18,000 total tuition`。
  - `USM-PHD-ARTICLE-349-8BE97FAD`：公开名 `DOCTOR OF EDUCATION IN TESOL`，公开 ready，`USD 18,000 total tuition`。
- 入库与验收结果：
  - 博士规范 95、公开 95、`needs-review` 0、博士 `not-available-for-international` 0。
  - USM 全层级规范 463、公开 462；唯一不适用于国际申请人的记录现在只剩硕士 1 条。
  - 公开 API 层级：本科 63、硕士 304、博士 95。
  - 公开费用状态：`matched-official=196`、`calculated-from-official-rate=213`、`not-published=53`。
  - 95 个博士详情接口全部校对通过：HTTP、公开状态、要求、语言、来源、费用状态、列表/详情一致性、费用范围和估算费用问题均为 0。
- 最新备份：
  - `apps/api/tmp/backups/usm-phd-commercial-before-95-public-fix-2026-06-17.json`
  - `apps/api/tmp/backups/usm-phd-commercial-before-summary-95-fix-2026-06-17.json`
- 最新门禁报告：
  - `tmp/reports/usm-commercial-release-gate-95-phd-public-20260617.json`
- 验证通过：
  - `npm --workspace @studymy/api run publish:usm:phd`
  - `npm --workspace @studymy/api run publish:usm:phd -- --confirm-import --backup-output tmp/backups/usm-phd-commercial-before-summary-95-fix-2026-06-17.json`
  - `npm --workspace @studymy/api run verify:usm:phd:commercial`
  - `npm test -- tests/api/usm-phd-commercial-import.test.ts tests/web/format.test.ts`
  - `python3 scripts/verify-usm-phd-candidate.py --manifest data/imports/usm/2026-06-14/phd-candidate.json`
  - `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_records.py data/imports/usm/2026-06-14/phd-candidate.json --profile candidate --expected-count 95 --official-domain admission.usm.my --allow-official-rate-calculation --summary-only`
  - `python3 /Users/ian/.codex/skills/studymy-official-university-collector/scripts/audit_delivery.py data/imports/usm/2026-06-14/phd-delivery.json --summary-only`
  - `python3 scripts/audit-official-total-tuition.py data/imports/usm/2026-06-14/phd-candidate.json --summary-only`
  - `PYTHONPYCACHEPREFIX=/Users/ian/Desktop/dev/study-malaysia/tmp/pycache python3 -m py_compile scripts/build-usm-phd-candidate.py scripts/verify-usm-phd-candidate.py scripts/audit-official-total-tuition.py`
  - `node scripts/verify-usm-commercial-release.mjs --api-url http://127.0.0.1:3000/api/universities/universiti-sains-malaysia-usm --web-url http://127.0.0.1:5173/universities/universiti-sains-malaysia-usm --report tmp/reports/usm-commercial-release-gate-95-phd-public-20260617.json`

## Notion 状态

当前 Codex 会话没有可调用的 Notion 连接器。本文件作为本地中文任务快照；真实 Notion 未更新。
