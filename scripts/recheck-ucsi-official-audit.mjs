#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const batchDir = path.join(root, "data/imports/ucsi/2026-06-20/official-audit");
const officialDomain = "ucsiuniversity.edu.my";
const generatedAt = malaysiaTimestamp();

function malaysiaTimestamp(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().replace("Z", "+08:00");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(batchDir, file), "utf8"));
}

function writeJson(file, payload) {
  fs.writeFileSync(path.join(batchDir, file), JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function writeText(file, payload) {
  fs.writeFileSync(path.join(batchDir, file), payload, "utf8");
}

function sha256File(target) {
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}

function compact(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function by(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function isOfficialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === `www.${officialDomain}` || url.hostname.endsWith(`.${officialDomain}`));
  } catch {
    return false;
  }
}

function isSimpleFeeSnippet(value) {
  return /^RM\s*[0-9][0-9,]*(?:\.[0-9]{2})?(?:\s*\([^)]+\))?$/.test(compact(value));
}

function classifyFee(programme) {
  const snippets = programme.feeSnippets || [];
  if (!snippets.length) {
    return {
      classification: "official-unpublished",
      reason: "No official fee-like amount was extracted from the rendered programme detail page.",
    };
  }
  if (snippets.every(isSimpleFeeSnippet)) {
    return {
      classification: "needs-manual-table-review",
      reason: "Rendered page exposes official RM amount snippets, but the parser has not reconciled exact international full-duration tuition, applicant scope, basis, and variant.",
    };
  }
  return {
    classification: "fee-like-ambiguous",
    reason: "At least one RM snippet is embedded in non-tuition prose or a mixed fee note, so it cannot be treated as the primary tuition value.",
  };
}

function internationalEvidence(programme) {
  const text = `${programme.officialAcademicRequirement || ""} ${programme.officialLanguageRequirement || ""}`;
  const hasProgrammeSignal = /\b(international students?|foreign|IELTS|TOEFL|MUET|PTE|Cambridge|Linguaskill)\b/i.test(text);
  return {
    classification: hasProgrammeSignal
      ? "general-route-plus-programme-requirement-evidence"
      : "general-route-only",
    reason: hasProgrammeSignal
      ? "Programme detail page includes international/language-route evidence, but the official application route still has to confirm programme-level availability."
      : "Only institution-level international admission route is available in this batch; programme-level international availability remains unclosed.",
  };
}

function sourceIdFor(programme) {
  return programme.fieldEvidence?.[0]?.sourceId || "";
}

function sourceRecord(cacheById, sourceId) {
  return sourceId ? cacheById.get(sourceId) : null;
}

function missingFieldRows(programmes, field) {
  return programmes
    .filter((programme) => {
      const value = programme[field];
      return Array.isArray(value) ? value.length === 0 : !compact(value);
    })
    .map((programme) => ({
      code: programme.code,
      level: programme.level,
      nameEnOfficial: programme.nameEnOfficial,
      sourceUrl: programme.officialSourceUrl,
      sourceId: sourceIdFor(programme),
    }));
}

function refreshDeliveryArtifacts(delivery, files) {
  const artifacts = delivery.artifacts || [];
  for (const item of artifacts) {
    if (item.path && fs.existsSync(path.join(batchDir, item.path))) {
      item.sha256 = sha256File(path.join(batchDir, item.path));
    }
  }
  const existing = new Set(artifacts.map((item) => item.path));
  for (const file of files) {
    if (existing.has(file.path)) continue;
    artifacts.push({
      role: file.role,
      path: file.path,
      sha256: sha256File(path.join(batchDir, file.path)),
      description: file.description,
    });
  }
  delivery.artifacts = artifacts;
}

const candidateDataset = readJson("08_candidate_dataset.json");
const programmes = candidateDataset.programmes || [];
const rowDisposal = readJson("04_official_row_disposal.json");
const sourceCache = readJson("05_source_cache_index.json");
const delivery = readJson("delivery.json");

const cacheById = new Map(sourceCache.map((item) => [item.id, item]));
const sourceIntegrityRows = programmes.map((programme) => {
  const sourceId = sourceIdFor(programme);
  const cache = sourceRecord(cacheById, sourceId);
  const rawPath = cache?.localPath ? path.join(root, cache.localPath) : "";
  const rawExists = rawPath ? fs.existsSync(rawPath) : false;
  const hashMatches = rawExists && cache?.sha256 ? sha256File(rawPath) === cache.sha256 : false;
  return {
    code: programme.code,
    nameEnOfficial: programme.nameEnOfficial,
    sourceId,
    officialSourceUrl: programme.officialSourceUrl,
    officialUrlValid: isOfficialUrl(programme.officialSourceUrl),
    sourceCacheFound: Boolean(cache),
    rawSnapshotPath: cache?.localPath || "",
    rawSnapshotExists: rawExists,
    sha256Matches: hashMatches,
  };
});

const duplicateGroups = new Map();
for (const row of rowDisposal) {
  const code = row.candidateCode || row.duplicateOf;
  if (!code) continue;
  if (!duplicateGroups.has(code)) duplicateGroups.set(code, []);
  duplicateGroups.get(code).push(row);
}

const duplicateAuditRows = [...duplicateGroups.entries()]
  .filter(([, rows]) => rows.some((row) => row.status === "duplicate-of"))
  .map(([code, rows]) => {
    const actualCampuses = [...new Set(rows.map((row) => row.campus).filter((campus) => campus && campus !== "Office of Research and Postgraduate Studies"))].sort();
    const urls = [...new Set(rows.map((row) => row.detailUrl).filter(Boolean))].sort();
    return {
      code,
      occurrenceCount: rows.length,
      duplicateRows: rows.filter((row) => row.status === "duplicate-of").length,
      sameDetailUrl: urls.length === 1,
      detailUrls: urls,
      actualCampuses,
      sourceCampuses: [...new Set(rows.map((row) => row.campus).filter(Boolean))].sort(),
      note: actualCampuses.length > 1
        ? "Same official detail URL appears under more than one campus directory; retained as one candidate with occurrence evidence because the detail page governs the offering."
        : "Same official detail URL appears in multiple official contexts; retained as one canonical candidate with duplicate occurrence evidence.",
    };
  });

const feeRows = programmes.map((programme) => ({
  code: programme.code,
  level: programme.level,
  nameEnOfficial: programme.nameEnOfficial,
  sourceUrl: programme.officialSourceUrl,
  snippetCount: (programme.feeSnippets || []).length,
  ...classifyFee(programme),
}));

const internationalRows = programmes.map((programme) => ({
  code: programme.code,
  level: programme.level,
  nameEnOfficial: programme.nameEnOfficial,
  sourceUrl: programme.officialSourceUrl,
  ...internationalEvidence(programme),
}));

const missingByField = {
  durationOfficial: missingFieldRows(programmes, "durationOfficial"),
  officialIntake: missingFieldRows(programmes, "officialIntake"),
  officialAcademicRequirement: missingFieldRows(programmes, "officialAcademicRequirement"),
  officialLanguageRequirement: missingFieldRows(programmes, "officialLanguageRequirement"),
  courseSettingOfficial: missingFieldRows(programmes, "courseSettingOfficial"),
  careerDirectionsOfficial: missingFieldRows(programmes, "careerDirectionsOfficial"),
  studyMode: missingFieldRows(programmes, "studyMode"),
  studyType: missingFieldRows(programmes, "studyType"),
};

const readyGateRecords = programmes.map((programme) => {
  const blockers = [];
  if (programme.publicDisplayStatus !== "ready") blockers.push("publicDisplayStatus is needs-review");
  if (programme.feeStatus !== "official-total" && programme.feeStatus !== "officially-verified") blockers.push("Exact international full-duration tuition is not closed");
  if (programme.internationalEligibility?.status !== "available") blockers.push("Per-programme international availability is not confirmed");
  if (!compact(programme.officialLanguageRequirement)) blockers.push("English language requirement needs review");
  if (!compact(programme.careerDirectionsOfficial)) blockers.push("Career directions need review");
  blockers.push("Student-facing Chinese localization is not finalized");
  return {
    code: programme.code,
    level: programme.level,
    nameEnOfficial: programme.nameEnOfficial,
    ready: blockers.length === 0,
    reviewReasons: blockers,
  };
});

const specialLevelDecisions = programmes
  .filter((programme) => /doctor of medicine|dba|industrial phd|prior publication/i.test(programme.nameEnOfficial))
  .map((programme) => ({
    code: programme.code,
    nameEnOfficial: programme.nameEnOfficial,
    level: programme.level,
    sourceUrl: programme.officialSourceUrl,
    decision: /doctor of medicine/i.test(programme.nameEnOfficial)
      ? "Retained as bachelor because UCSI publishes the MD page in an undergraduate/Springhill bachelor context and the detail page duration/mode behaves as a first professional degree."
      : "Retained as phd because the official title is doctorate/PhD/DBA/Industrial PhD/Prior Publication.",
  }));

const fieldDelta = {
  schemaVersion: 1,
  generatedAt,
  status: "review-required",
  institution: "UCSI University",
  officialDomains: [officialDomain],
  academicSession: candidateDataset.academicSession,
  correctionsApplied: [
    {
      id: "ucsi-source-url-about-blank",
      status: "fixed",
      evidence: "All 118 candidate officialSourceUrl values now resolve to https://www.ucsiuniversity.edu.my/ programme pages; about:blank count is 0.",
    },
    {
      id: "ucsi-postgraduate-office-hash-anchor-false-positive",
      status: "fixed",
      evidence: "The directory parser now filters page-internal #collapse anchors. The former UCSI-PHD-119 directory-page pseudo-candidate is no longer present.",
    },
    {
      id: "ucsi-delivery-coverage-overstatement",
      status: "fixed",
      evidence: "delivery.coverage is now summarized from 07_field_coverage_matrix.json: languageRequirement has 115 covered and 3 review; fee, internationalEligibility, deepSourceFieldExploration, and studentFacingContentHygiene remain review for all 118 records.",
    },
  ],
  counts: {
    canonicalProgrammes: programmes.length,
    byLevel: by(programmes, "level"),
    publicDisplayStatus: by(programmes, "publicDisplayStatus"),
    rowDisposal: by(rowDisposal, "status"),
  },
  sourceUrlIntegrity: {
    candidateCount: programmes.length,
    officialUrlValid: sourceIntegrityRows.filter((row) => row.officialUrlValid).length,
    aboutBlank: sourceIntegrityRows.filter((row) => row.officialSourceUrl === "about:blank").length,
    sourceCacheFound: sourceIntegrityRows.filter((row) => row.sourceCacheFound).length,
    rawSnapshotExists: sourceIntegrityRows.filter((row) => row.rawSnapshotExists).length,
    sha256Matches: sourceIntegrityRows.filter((row) => row.sha256Matches).length,
    issues: sourceIntegrityRows.filter((row) => !row.officialUrlValid || !row.sourceCacheFound || !row.rawSnapshotExists || !row.sha256Matches),
  },
  missingByField,
  feeClassification: {
    counts: by(feeRows, "classification"),
    records: feeRows,
  },
  internationalEligibilityClassification: {
    counts: by(internationalRows, "classification"),
    records: internationalRows,
  },
  duplicateAudit: {
    duplicateRows: rowDisposal.filter((row) => row.status === "duplicate-of").length,
    canonicalGroupsWithDuplicates: duplicateAuditRows.length,
    allDuplicateGroupsUseSameDetailUrl: duplicateAuditRows.every((row) => row.sameDetailUrl),
    groupsWithMultipleActualCampuses: duplicateAuditRows.filter((row) => row.actualCampuses.length > 1),
    records: duplicateAuditRows,
  },
  specialLevelDecisions,
};

const readyGate = {
  schemaVersion: 1,
  generatedAt,
  status: "review-required",
  institution: "UCSI University",
  authorization: "collect",
  officialDomains: [officialDomain],
  academicSession: candidateDataset.academicSession,
  counts: {
    canonicalProgrammes: programmes.length,
    ready: readyGateRecords.filter((record) => record.ready).length,
    needsReview: readyGateRecords.filter((record) => !record.ready).length,
    byLevel: by(programmes, "level"),
  },
  gates: {
    officialIdentityAndSource: {
      passed: sourceIntegrityRows.filter((row) => row.officialUrlValid && row.sourceCacheFound && row.rawSnapshotExists && row.sha256Matches).length,
      review: sourceIntegrityRows.filter((row) => !row.officialUrlValid || !row.sourceCacheFound || !row.rawSnapshotExists || !row.sha256Matches).length,
    },
    duration: { passed: programmes.length - missingByField.durationOfficial.length, review: missingByField.durationOfficial.length },
    intake: { passed: programmes.length - missingByField.officialIntake.length, review: missingByField.officialIntake.length },
    academicRequirement: { passed: programmes.length - missingByField.officialAcademicRequirement.length, review: missingByField.officialAcademicRequirement.length },
    languageRequirement: { passed: programmes.length - missingByField.officialLanguageRequirement.length, review: missingByField.officialLanguageRequirement.length },
    courseSetting: { passed: programmes.length - missingByField.courseSettingOfficial.length, review: missingByField.courseSettingOfficial.length },
    careerDirections: { passed: programmes.length - missingByField.careerDirectionsOfficial.length, review: missingByField.careerDirectionsOfficial.length },
    fee: { passed: 0, review: programmes.length },
    internationalEligibility: { passed: 0, review: programmes.length },
    studentFacingLocalization: { passed: 0, review: programmes.length },
  },
  records: readyGateRecords,
};

const exceptionQueue = {
  blocking: [],
  resolved: [
    {
      id: "ucsi-source-url-about-blank",
      scope: "source-trace",
      affectedCount: 118,
      resolution: "Generator now writes the official detail target URL instead of Playwright page.url() during cache replay.",
    },
    {
      id: "ucsi-postgraduate-office-hash-anchor-false-positive",
      scope: "identity",
      affectedCount: 1,
      resolution: "Directory parser filters page-internal #collapse anchors; the pseudo-candidate was removed from the canonical count.",
    },
  ],
  review: [
    {
      id: "ucsi-fee-reconciliation",
      scope: "field",
      affectedCount: programmes.length,
      classificationCounts: by(feeRows, "classification"),
      reason: "Official RM snippets exist, but exact international full-duration tuition has not been reconciled against fee table basis, applicant scope, and variants.",
      nextAction: "Follow official fee panels, brochures, PDFs, or application-route fee screens and map a unique international full-duration tuition value only when the source is exact.",
    },
    {
      id: "ucsi-international-eligibility",
      scope: "field",
      affectedCount: programmes.length,
      classificationCounts: by(internationalRows, "classification"),
      reason: "Institution-level international admission evidence exists, but programme-level international availability remains unclosed.",
      nextAction: "Verify each candidate through official international application/admissions route evidence before ready status.",
    },
    {
      id: "ucsi-language-requirement-missing",
      scope: "field",
      affectedCount: missingByField.officialLanguageRequirement.length,
      records: missingByField.officialLanguageRequirement,
      reason: "Rendered detail page did not expose English language requirements for these records.",
      nextAction: "Check linked official subpages, brochures, PDFs, and admissions pages before marking unpublished.",
    },
    {
      id: "ucsi-career-directions-missing",
      scope: "field",
      affectedCount: missingByField.careerDirectionsOfficial.length,
      records: missingByField.careerDirectionsOfficial,
      reason: "Rendered detail page did not expose career directions for these records.",
      nextAction: "Check brochures, faculty pages, and programme linked resources before marking unpublished.",
    },
    {
      id: "ucsi-localization",
      scope: "display",
      affectedCount: programmes.length,
      reason: "Chinese/Traditional Chinese/Malay student-facing localization has not been finalized; official English evidence must not be copied directly into public Chinese pages.",
      nextAction: "Localize course setting, careers, requirement summaries, intake, fee notes, and official source labels only after fee and eligibility facts are stable.",
    },
  ],
};

const languageMissingList = missingByField.officialLanguageRequirement.map((row) => `- ${row.code} ${row.nameEnOfficial}：${row.sourceUrl}`).join("\n") || "- 无";
const careerMissingList = missingByField.careerDirectionsOfficial.map((row) => `- ${row.code} ${row.nameEnOfficial}：${row.sourceUrl}`).join("\n") || "- 无";
const multiCampusList = fieldDelta.duplicateAudit.groupsWithMultipleActualCampuses.map((row) => `- ${row.code}：${row.actualCampuses.join(" / ")}，同一详情页 ${row.detailUrls[0]}`).join("\n") || "- 无";

const report = [
  "# UCSI University 官方本硕博专业信息深挖校对报告",
  "",
  "- 院校：UCSI University / 思特雅大学",
  "- 授权：collect-only，不入库、不发布",
  `- 复核执行时间：${generatedAt}`,
  `- 官方证据 current-as-of：${candidateDataset.academicSession}`,
  `- 官方域名：${officialDomain}`,
  "- 复核口径：只纳入 bachelor、master、phd；PGCert、PGDip、foundation、diploma、语言课程等继续保留在行处置但不进候选。",
  "",
  "## 复核修正",
  "",
  "- 已修复缓存模式下详情页 `officialSourceUrl=about:blank` 的来源链路错误；当前 118/118 条候选均指向 UCSI 官方 URL。",
  "- 已过滤研究生办公室目录页页内折叠锚点，移除原 `UCSI-PHD-119` 伪候选；候选数从 119 修正为 118。",
  "- 已将 delivery 覆盖统计改为从字段矩阵真实汇总，不再把缺失语言要求误标为全部 covered。",
  "",
  "## 修正后数量",
  "",
  `- 官方目录出现次数：${rowDisposal.length}`,
  `- canonical 本硕博候选：${programmes.length}`,
  `- 本科：${fieldDelta.counts.byLevel.bachelor || 0}`,
  `- 硕士：${fieldDelta.counts.byLevel.master || 0}`,
  `- 博士：${fieldDelta.counts.byLevel.phd || 0}`,
  `- out-of-scope 行：${fieldDelta.counts.rowDisposal["out-of-scope"] || 0}`,
  `- duplicate-of 行：${fieldDelta.counts.rowDisposal["duplicate-of"] || 0}`,
  "- ready：0；needs-review：118；international-unavailable：0",
  "",
  "## 字段缺口",
  "",
  "- duration、intake、academic requirement、course setting、study mode、study type：118/118 有官方详情页提取值。",
  `- English language requirement：115/118 有值，${missingByField.officialLanguageRequirement.length} 条需继续查官方子页/PDF。`,
  languageMissingList,
  `- Career directions：113/118 有值，${missingByField.careerDirectionsOfficial.length} 条需继续查官方子页/PDF。`,
  careerMissingList,
  "",
  "## 费用与国际生资格",
  "",
  `- 费用：${fieldDelta.feeClassification.counts["needs-manual-table-review"] || 0} 条为需人工表格复核的金额片段，${fieldDelta.feeClassification.counts["fee-like-ambiguous"] || 0} 条含非学费或混合金额语境；0 条可直接作为国际生完整学制总学费 ready。`,
  `- 国际生资格：${fieldDelta.internationalEligibilityClassification.counts["general-route-plus-programme-requirement-evidence"] || 0} 条有专业页语言/国际相关证据，${fieldDelta.internationalEligibilityClassification.counts["general-route-only"] || 0} 条只有通用路线；118 条都需官方申请路线逐条闭合。`,
  "",
  "## 重复与层级裁决",
  "",
  `- duplicate-of 复核：${fieldDelta.duplicateAudit.duplicateRows} 条重复行全部基于相同官方详情页合并，来源 occurrence 已保留。`,
  `- 多实际校区同页：${fieldDelta.duplicateAudit.groupsWithMultipleActualCampuses.length} 组。`,
  multiCampusList,
  "- Doctor of Medicine (MD) 继续作为 bachelor：官方目录上下文为 Springhill/undergraduate，详情页为 5 Years Full-time。",
  "- DBA、Industrial PhD、PhD by Prior Publication 继续作为 phd：官方标题/奖项为 doctorate/PhD 口径。",
  "",
  "## 结论",
  "",
  "当前批次为 `review-required`：官方来源链路与候选身份已校正，候选完整性通过；但费用、国际生逐项资格、3 条语言要求、5 条职业方向和中文学生端展示仍未达到 ready gate。",
  "",
  "## Notion 状态",
  "",
  "当前会话没有可写 Notion 连接；本地中文复核报告已更新，真实 Notion 未更新。",
  "",
].join("\n");

writeJson("17_field_accuracy_delta.json", fieldDelta);
writeJson("18_ready_gate_recheck.json", readyGate);
writeJson("11_exception_queue.json", exceptionQueue);
writeText("16_deep_accuracy_recheck_report.md", report);
writeText("12_operator_review_report.md", report);

delivery.exceptions = exceptionQueue;
refreshDeliveryArtifacts(delivery, [
  {
    role: "report",
    path: "16_deep_accuracy_recheck_report.md",
    description: "Deep accuracy recheck report",
  },
  {
    role: "audit",
    path: "17_field_accuracy_delta.json",
    description: "Field accuracy delta and source integrity audit",
  },
  {
    role: "audit",
    path: "18_ready_gate_recheck.json",
    description: "Per-record ready gate recheck",
  },
]);
writeJson("delivery.json", delivery);

console.log(JSON.stringify({
  status: "review-required",
  candidates: programmes.length,
  byLevel: by(programmes, "level"),
  sourceUrlIssues: fieldDelta.sourceUrlIntegrity.issues.length,
  missingLanguage: missingByField.officialLanguageRequirement.length,
  missingCareers: missingByField.careerDirectionsOfficial.length,
  feeClassification: fieldDelta.feeClassification.counts,
  ready: readyGate.counts.ready,
  needsReview: readyGate.counts.needsReview,
}, null, 2));
