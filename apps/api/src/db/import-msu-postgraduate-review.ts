import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, Not, type DeepPartial, type EntityManager } from "typeorm";
import type {
  FeeAuditStatus,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  ProgramCategoryCode,
  PublicDisplayStatus,
  TuitionCurrency
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export const MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX = "msu-review-20260630-postgraduate-";
export const DEFAULT_MSU_POSTGRADUATE_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/msu/2026-06-30/msu-postgraduate-2026-authorized-fee-candidates.json"
);

const verifiedAt = "2026-06-30";
const nonOfficialFeeAuthorizedAt = "2026-06-30";
const expectedProgrammes = 30;
const expectedMasterProgrammes = 20;
const expectedPhdProgrammes = 10;
const expectedNonOfficialCandidateFees = 27;
const expectedMissingCandidateFees = 3;
const expectedDirectIeltsRows = 4;
const officialWebsite = "https://www.msu.edu.my";
const officialApplyDataUrl = "https://apply.msu.edu.my/newdata.json";
const officialMasterCatalogueUrl = "https://apply.msu.edu.my/course/?faculty=all&qualification=master";
const officialPhdCatalogueUrl = "https://apply.msu.edu.my/course/?faculty=all&qualification=phd";
const applicationPortalUrl = "https://apply.msu.edu.my/";
const yourUniTuitionUrl = "https://en.your-uni.com/university/msu-university";
const easyUniTuitionUrl = "https://www.easyuni.com/malaysia/management-science-university-msu-218/courses/";
const myrToCny = 1.55;

type MsuPostgraduateLevel = "master" | "phd";

interface MsuPostgraduateTuitionSource {
  source: "Your-Uni" | "EasyUni";
  sourceUrl: string;
  sourceProgrammeName: string;
  amountMYR: number;
  duration?: string;
}

interface MsuPostgraduateTuitionCandidate {
  amountMYR: number;
  displayText: string;
  selectedSource: MsuPostgraduateTuitionSource;
  sourceRows: MsuPostgraduateTuitionSource[];
  status: "single-source" | "cross-source-consistent" | "source-conflict-higher-selected";
  note: string;
}

interface MsuPostgraduateProgrammeCandidate {
  level: MsuPostgraduateLevel;
  officialCategory: string;
  name: string;
  mode: string;
  registrationDate: string;
  requirement: string;
  sourceUrl: string;
  tuitionCandidate: MsuPostgraduateTuitionCandidate | null;
}

interface MsuPostgraduateCandidateDataset {
  generatedAt: string;
  scope: Record<string, unknown>;
  sources: Record<string, string>;
  sourcePolicy: Record<string, string>;
  duplicateOfficialEntries?: unknown[];
  officialProgrammes: MsuPostgraduateProgrammeCandidate[];
  sourceCoverage: {
    officialUniquePostgraduateProgrammes: number;
    master: number;
    phd: number;
    yourUniPostgraduateRows: number;
    easyUniPostgraduateRows: number;
    matchedAnnualTuitionRows: number;
    missingAnnualTuitionRows: number;
  };
  missingAnnualTuition?: Array<{ level: MsuPostgraduateLevel; name: string }>;
}

interface MsuPostgraduateImportSummary {
  importRows: number;
  byLevel: Record<"bachelor" | "master" | "phd", number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialFeeRows: number;
  nonOfficialCandidateFeeRows: number;
  missingNonOfficialCandidateFeeRows: number;
  sourceConflictFeeRows: number;
  pendingFeeRows: number;
  directIeltsRows: number;
  missingDirectIeltsRows: number;
  durationReviewRows: number;
  sourceRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface MsuPostgraduateVerification extends MsuPostgraduateImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  publicLeakageRows: number;
  adminNeedsReviewRows: number;
  activeSupersededRows: number;
}

const t = (en: string, ms = en, zhCN = en, zhTW = zhCN): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const arr = (en: string[], ms = en, zhCN = en, zhTW = zhCN): LocalizedStringArray => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

export function loadMsuPostgraduateCandidateDataset(path = DEFAULT_MSU_POSTGRADUATE_CANDIDATE_PATH): MsuPostgraduateCandidateDataset {
  return loadJson<MsuPostgraduateCandidateDataset>(path);
}

export function validateMsuPostgraduateCandidateDataset(dataset: MsuPostgraduateCandidateDataset): string[] {
  const errors: string[] = [];
  const rows = dataset.officialProgrammes || [];
  if (rows.length !== expectedProgrammes) errors.push(`expected ${expectedProgrammes} unique postgraduate programmes, got ${rows.length}.`);
  if (dataset.sourceCoverage?.master !== expectedMasterProgrammes) errors.push(`expected ${expectedMasterProgrammes} master programmes.`);
  if (dataset.sourceCoverage?.phd !== expectedPhdProgrammes) errors.push(`expected ${expectedPhdProgrammes} phd programmes.`);
  if (dataset.sourceCoverage?.matchedAnnualTuitionRows !== expectedNonOfficialCandidateFees) {
    errors.push(`expected ${expectedNonOfficialCandidateFees} non-official annual tuition candidates.`);
  }
  if (dataset.sourceCoverage?.missingAnnualTuitionRows !== expectedMissingCandidateFees) {
    errors.push(`expected ${expectedMissingCandidateFees} missing non-official annual tuition rows.`);
  }
  if (!String(dataset.scope?.authorization || "").includes("MSU-only")) {
    errors.push("dataset authorization must be scoped to MSU only.");
  }
  const seen = new Set<string>();
  for (const [index, programme] of rows.entries()) {
    const row = `programme ${index + 1} ${programme.name || "unknown"}`;
    if (!programme.name) errors.push(`${row}: name is required.`);
    if (seen.has(`${programme.level}:${programme.name}`)) errors.push(`${row}: duplicate programme name per level.`);
    seen.add(`${programme.level}:${programme.name}`);
    if (programme.level !== "master" && programme.level !== "phd") errors.push(`${row}: level must be master or phd.`);
    if (!programme.requirement) errors.push(`${row}: official apply requirement is required.`);
    if (!officialMsuApplyUrl(programme.sourceUrl)) errors.push(`${row}: official apply source URL is required.`);
  }
  return errors;
}

export function buildMsuPostgraduateReviewRows(dataset: MsuPostgraduateCandidateDataset): Array<DeepPartial<ProgramEntity>> {
  return dataset.officialProgrammes.map((programme, index) => buildMsuPostgraduateRow(programme, index + 1));
}

export function summarizeMsuPostgraduateReviewImport(rows: Array<DeepPartial<ProgramEntity>>): MsuPostgraduateImportSummary {
  return {
    importRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length,
      master: rows.filter((row) => row.level === "master").length,
      phd: rows.filter((row) => row.level === "phd").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    nonOfficialCandidateFeeRows: rows.filter((row) => Number(row.tuitionAmount || 0) > 0 && row.officialTuitionMYR == null).length,
    missingNonOfficialCandidateFeeRows: rows.filter((row) => Number(row.tuitionAmount || 0) === 0 && row.officialTuitionMYR == null).length,
    sourceConflictFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "source-conflict").length,
    pendingFeeRows: rows.filter((row) => ["pending-review", "source-conflict", "conflict"].includes(String(row.officialFeeAuditStatus))).length,
    directIeltsRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0).length,
    missingDirectIeltsRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) === 0).length,
    durationReviewRows: rows.filter((row) => Number(row.durationYears || 0) === 0).length,
    sourceRows: rows.filter((row) => row.officialSourceUrl).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function verifyMsuPostgraduateRecordSet(
  university: UniversityEntity,
  rows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): MsuPostgraduateVerification {
  const summary = summarizeMsuPostgraduateReviewImport(rows);
  const publicLeakageRows = rows.filter((row) => row.isPublished || row.publicDisplayStatus === "ready").length;
  const adminNeedsReviewRows = allUniversityRows.filter(
    (row) => row.slug.startsWith(MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX) && row.publicDisplayStatus === "needs-review"
  ).length;
  const activeSupersededRows = allUniversityRows.filter(
    (row) =>
      !row.slug.startsWith(MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX) &&
      (row.level === "master" || row.level === "phd") &&
      row.publicDisplayStatus !== "archived"
  ).length;

  if (
    summary.importRows !== expectedProgrammes ||
    summary.byLevel.master !== expectedMasterProgrammes ||
    summary.byLevel.phd !== expectedPhdProgrammes ||
    summary.readyRows !== 0 ||
    summary.needsReviewRows !== expectedProgrammes ||
    summary.publishedRows !== 0 ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== 0 ||
    summary.nonOfficialCandidateFeeRows !== expectedNonOfficialCandidateFees ||
    summary.missingNonOfficialCandidateFeeRows !== expectedMissingCandidateFees ||
    summary.sourceConflictFeeRows !== 0 ||
    summary.pendingFeeRows !== expectedProgrammes ||
    summary.directIeltsRows !== expectedDirectIeltsRows ||
    summary.missingDirectIeltsRows !== expectedProgrammes - expectedDirectIeltsRows ||
    summary.durationReviewRows !== expectedMissingCandidateFees ||
    summary.sourceRows !== expectedProgrammes ||
    publicLeakageRows !== 0 ||
    adminNeedsReviewRows !== expectedProgrammes ||
    activeSupersededRows !== 0 ||
    university.isPublished !== true ||
    university.publicDisplayStatus !== "ready"
  ) {
    throw new Error(
      `MSU postgraduate review import verification failed: ${JSON.stringify({
        summary,
        publicLeakageRows,
        adminNeedsReviewRows,
        activeSupersededRows,
        universityStatus: university.publicDisplayStatus,
        universityPublished: university.isPublished,
        universityProgramCount: university.programCount
      })}`
    );
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    publicLeakageRows,
    adminNeedsReviewRows,
    activeSupersededRows
  };
}

function buildMsuPostgraduateReviewProfile(dataset: MsuPostgraduateCandidateDataset, summary: MsuPostgraduateImportSummary) {
  return {
    collectionScope: "MSU official postgraduate review import",
    applicantScope: "international",
    currentAsOf: verifiedAt,
    sourceUniversityCode: "MSU",
    authorization: "review-import-msu-only-non-official-fee-candidates",
    sourceAuditSafeToImport: false,
    sourceRecommendedForImport: false,
    officialBaseline: {
      source: officialApplyDataUrl,
      masterCatalogue: officialMasterCatalogueUrl,
      phdCatalogue: officialPhdCatalogueUrl,
      total: summary.importRows,
      master: summary.byLevel.master,
      phd: summary.byLevel.phd,
      duplicateOfficialEntriesRemoved: dataset.duplicateOfficialEntries?.length || 0
    },
    catalogStatusSummary: {
      all: { total: summary.importRows, ready: 0, needsReview: summary.needsReviewRows, notAvailableForInternational: 0 },
      byLevel: {
        bachelor: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 },
        master: { total: summary.byLevel.master, ready: 0, needsReview: summary.byLevel.master, notAvailableForInternational: 0 },
        phd: { total: summary.byLevel.phd, ready: 0, needsReview: summary.byLevel.phd, notAvailableForInternational: 0 }
      }
    },
    tuitionAudit: {
      authorizedNonOfficialFeeUse: {
        authorizedAt: nonOfficialFeeAuthorizedAt,
        scope: "MSU postgraduate review preview only",
        sources: [yourUniTuitionUrl, easyUniTuitionUrl],
        selectionPolicy: "Use EasyUni/Your-Uni style 2026 foreign/international annual tuition candidates for MSU only. EasyUni main MSU courses page exposed no postgraduate foreign annual rows; matched postgraduate annual fees are from Your-Uni."
      },
      candidateCoverage: {
        annualTuitionRows: summary.nonOfficialCandidateFeeRows,
        missingAnnualTuitionRows: summary.missingNonOfficialCandidateFeeRows,
        sourceConflictRows: summary.sourceConflictFeeRows,
        yourUniPostgraduateRows: dataset.sourceCoverage.yourUniPostgraduateRows,
        easyUniPostgraduateRows: dataset.sourceCoverage.easyUniPostgraduateRows
      },
      notes: [
        "MSU official apply data does not expose postgraduate programme-level tuition amounts.",
        "Ian authorized MSU-only use of non-official 2026 annual tuition candidates for review preview; officialTuitionMYR remains null and rows remain needs-review."
      ]
    },
    missingAnnualTuition: dataset.missingAnnualTuition || []
  };
}

function mergeMsuPostgraduateProfile(existingProfile: unknown, dataset: MsuPostgraduateCandidateDataset, summary: MsuPostgraduateImportSummary) {
  return {
    ...asRecord(existingProfile),
    msuPostgraduateReviewImport: buildMsuPostgraduateReviewProfile(dataset, summary)
  };
}

function buildMsuUniversityUpdate(
  existing: UniversityEntity,
  dataset: MsuPostgraduateCandidateDataset,
  summary: MsuPostgraduateImportSummary,
  totalReviewRows: number
): DeepPartial<UniversityEntity> {
  return {
    id: existing.id,
    officialProfile: mergeMsuPostgraduateProfile(existing.officialProfile, dataset, summary),
    officialAuditSummary: existing.officialAuditSummary || "MSU review imports are isolated under the keyed preview API. University profile remains public and QS-sorted.",
    programCount: Math.max(Number(existing.programCount || 0), totalReviewRows),
    publicDisplayStatus: "ready",
    isPublished: true
  };
}

function buildMsuPostgraduateRow(programme: MsuPostgraduateProgrammeCandidate, ordinal: number): DeepPartial<ProgramEntity> {
  const tuition = programme.tuitionCandidate;
  const durationYears = tuition ? parseDurationYears(tuition.selectedSource.duration) : 0;
  const levelCode = programme.level === "master" ? "MAST" : "PHD";
  const language = buildLanguageRequirement(programme.requirement);
  const officialLanguageRequirement = language.ielts
    ? `IELTS ${language.ielts}${language.toefl ? `; TOEFL ${language.toefl}` : ""}`
    : "MSU official apply data did not publish a direct programme-level IELTS score for this postgraduate entry.";
  const reviewReason = reviewReasonText(programme);
  const tuitionDisplay = tuition?.displayText || "Official international tuition requires review";
  const officialTuitionNote = normalizeLongText([
    "MSU official apply data does not expose programme-level postgraduate tuition.",
    tuition
      ? `Ian authorized MSU-only use of non-official 2026 annual tuition candidates on ${nonOfficialFeeAuthorizedAt}. Selected ${tuition.displayText} from ${tuition.selectedSource.source}; ${tuition.note}`
      : "No EasyUni/Your-Uni postgraduate annual tuition candidate was matched."
  ].join(" "));

  return {
    slug: `${MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX}${programme.level}-${String(ordinal).padStart(3, "0")}-${slugify(programme.name)}`,
    code: `MSU-${levelCode}-${String(ordinal).padStart(3, "0")}`,
    name: t(programme.name, programme.name, localizedProgrammeName(programme.name), localizedProgrammeName(programme.name)),
    nameEnOfficial: programme.name,
    level: programme.level,
    category: inferCategory(programme.name, programme.officialCategory),
    faculty: t(programme.officialCategory, programme.officialCategory, localizedFaculty(programme.officialCategory), localizedFaculty(programme.officialCategory)),
    facultyZh: localizedFaculty(programme.officialCategory),
    studyMode: programme.mode === "FT" ? "full-time" : "on-campus",
    campus: "Shah Alam, Selangor, Malaysia",
    durationYears,
    durationOfficial: tuition?.selectedSource.duration || "Official duration requires review.",
    annualTuitionCny: tuition ? Math.round(tuition.amountMYR * myrToCny) : 0,
    tuitionAmount: tuition?.amountMYR ?? null,
    tuitionCurrency: "MYR" satisfies TuitionCurrency,
    tuitionDisplay,
    officialTuitionMYR: null,
    officialTuitionNote,
    officialFeeSourceUrl: tuition?.selectedSource.sourceUrl || "",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "pending-review" satisfies FeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: [],
    officialIntake: programme.registrationDate ? `Next registration date: ${programme.registrationDate}` : "Official intake month not published",
    officialIntakeNote: "MSU official apply data exposes a registration_date field but not a stable postgraduate intake-month array.",
    languageRequirement: language,
    officialLanguageRequirement,
    requirement: {
      gpa: extractCgpa(programme.requirement) || 0,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: t(programme.requirement, programme.requirement, academicRequirementChinese(programme), academicRequirementChinese(programme))
    },
    officialAcademicRequirement: programme.requirement,
    chinaStudentRequirement: "China-specific postgraduate route was not separately confirmed in the MSU official apply data; keep as needs-review before public display.",
    specialRequirementsNote: "Imported for backend/admin review only. Do not publish until per-record ready gate is completed.",
    applicationDocs: arr(defaultEnglishApplicationDocs(), defaultEnglishApplicationDocs(), defaultChineseApplicationDocs(), defaultChineseApplicationDocs()),
    curriculum: arr([]),
    careers: arr([]),
    specializations: arr([]),
    description: t(
      `MSU postgraduate programme imported from the official apply catalogue for review. ${reviewReason}`,
      `MSU postgraduate programme imported from the official apply catalogue for review. ${reviewReason}`,
      `这是管理与科学大学研究生官方申请目录审核候选专业。${reviewReason}`,
      `這是管理與科學大學研究生官方申請目錄審核候選專業。${reviewReason}`
    ),
    officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
    officialSourceUrl: programme.sourceUrl,
    officialEntryRequirementSourceUrl: programme.sourceUrl,
    officialAccreditationSourceUrl: programme.sourceUrl,
    sourceUrls: sourceLinks(programme),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "needs-review",
    publicDisplayStatus: "needs-review",
    publicDisplayNote: "Review-only database import. Hidden from public catalogue until Ian approves ready conversion after resolving MSU postgraduate blocking issues.",
    reviewReason,
    auditNote: normalizeLongText([
      `Original MSU postgraduate official apply row ${ordinal}.`,
      `Official category: ${programme.officialCategory}.`,
      `Registration date: ${programme.registrationDate || "not recorded"}.`,
      `Non-official annual tuition candidate: ${tuition ? tuition.displayText : "not matched"}.`,
      `Source policy: MSU-only non-official fee authorization; officialTuitionMYR remains null.`
    ].join(" ")),
    listTuitionText: tuitionDisplay,
    isPublished: false
  };
}

function reviewReasonText(programme: MsuPostgraduateProgrammeCandidate) {
  const reasons = [
    "official postgraduate tuition total not confirmed by an adoptable official MSU source",
    programme.tuitionCandidate ? "non-official 2026 annual tuition candidate included for MSU-only review" : "EasyUni/Your-Uni annual tuition candidate not matched",
    buildLanguageRequirement(programme.requirement).ielts ? "" : "direct IELTS list score not published",
    programme.tuitionCandidate ? "" : "numeric duration requires review"
  ].filter(Boolean);
  return normalizeLongText([...new Set(reasons)].join("; "));
}

function sourceLinks(programme: MsuPostgraduateProgrammeCandidate): OfficialSourceLink[] {
  const links: OfficialSourceLink[] = [
    {
      title: programme.level === "master" ? "MSU official Master application catalogue" : "MSU official PhD application catalogue",
      url: programme.sourceUrl,
      sourceType: "admission",
      verifiedAt,
      status: "needs-review",
      note: "Official MSU apply catalogue row captured for postgraduate review import."
    },
    {
      title: "MSU official apply frontend data",
      url: officialApplyDataUrl,
      sourceType: "admission",
      verifiedAt,
      status: "needs-review",
      note: "Official MSU apply data exposes programme, requirement, registration_date and mode fields; no tuition amount field is present."
    }
  ];
  for (const source of programme.tuitionCandidate?.sourceRows || []) {
    links.push({
      title: `${source.source} 2026 tuition candidate`,
      url: source.sourceUrl,
      sourceType: "fee",
      verifiedAt,
      status: "needs-review",
      note: `Non-official MSU-only annual tuition candidate for ${source.sourceProgrammeName}: RM ${formatCurrency(source.amountMYR)} / year.`
    });
  }
  return links;
}

function buildLanguageRequirement(requirement: string): LanguageRequirement {
  return {
    ielts: extractIelts(requirement) || 0,
    toefl: extractToefl(requirement),
    pte: null,
    muet: null
  };
}

function extractIelts(value: string) {
  const matches = [
    ...[...value.matchAll(/IELTS(?:\s*(?:Band|score|of|at least|minimum|min\.?))*[\s():,-]*(\d(?:\.\d+)?)/gi)].map((match) => Number(match[1])),
    ...[...value.matchAll(/(\d(?:\.\d+)?)\s*(?:overall\s+)?(?:in|for)?\s*IELTS/gi)].map((match) => Number(match[1]))
  ].filter((item) => Number.isFinite(item) && item > 0 && item <= 9);
  return matches.length ? Math.max(...matches) : null;
}

function extractToefl(value: string) {
  const matches = [
    ...[...value.matchAll(/TOEFL(?:\s*(?:score|overall|of|PBT|cBT|iBT|at least|minimum|min\.?))*[\s():,-]*(\d{2,3})/gi)].map(
      (match) => Number(match[1])
    ),
    ...[...value.matchAll(/(\d{2,3})\s*(?:overall\s+)?(?:in|for)?\s*TOEFL/gi)].map((match) => Number(match[1]))
  ].filter((item) => Number.isFinite(item) && item >= 30 && item <= 677);
  return matches.length ? Math.max(...matches) : null;
}

function extractCgpa(value: string) {
  const matches = [...value.matchAll(/(?:CGPA|GPA)[^0-9]{0,20}(\d(?:\.\d{1,2})?)/gi)].map((match) => Number(match[1]));
  const valid = matches.filter((item) => Number.isFinite(item) && item > 0 && item <= 4);
  return valid.length ? Math.min(...valid) : null;
}

function parseDurationYears(value: unknown) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function academicRequirementChinese(programme: MsuPostgraduateProgrammeCandidate) {
  if (programme.level === "phd") return "MSU 官方申请目录要求申请人具备硕士学位或 MSU 参议会认可的同等资格；具体条件以官方申请目录为准。";
  const cgpa = extractCgpa(programme.requirement);
  return cgpa
    ? `MSU 官方申请目录列明相关本科或同等资格要求，最低 CGPA 约 ${cgpa.toFixed(2)}；具体条件以官方申请目录为准。`
    : "MSU 官方申请目录列明相关本科或同等资格要求；具体条件以官方申请目录为准。";
}

function defaultEnglishApplicationDocs() {
  return [
    "Certified copies of all academic qualifications, transcripts and certificates.",
    "Certified English-language test result such as TOEFL or IELTS where applicable.",
    "Certified passport copy including blank pages with at least one year validity from the admission date.",
    "Six identical passport-size colour photographs with white background.",
    "Pre-arrival medical check-up report.",
    "Scholarship, study loan or financial sponsorship evidence where applicable.",
    "English translations for documents not issued in English."
  ];
}

function defaultChineseApplicationDocs() {
  return [
    "所有学历资格文件的认证副本（成绩单和证书）",
    "TOEFL 或 IELTS 成绩认证副本（如适用）",
    "护照认证副本（包括空白页），有效期须自入学日期起至少 1 年",
    "六张相同的护照尺寸彩色照片（白色背景）",
    "入境前体检报告",
    "奖学金或学习贷款证明；自费申请人可提交财务担保信",
    "非英文文件需提供英文翻译件"
  ];
}

function localizedProgrammeName(name: string) {
  const mapped = programmeNameZh[name];
  return mapped ? `${mapped}（${name}）` : `${name}（中文译名待审核）`;
}

const programmeNameZh: Record<string, string> = {
  "Master in Fashion Business": "时尚商业硕士",
  "Master in Educational Management and Leadership": "教育管理与领导力硕士",
  "Master in Early Childhood Education (MECE)": "幼儿教育硕士",
  "Master in Counselling and Guidance (MCG)": "咨询与辅导硕士",
  "Master in Business Administration": "工商管理硕士",
  "Master in Accounting/Finance (By Research)": "会计/金融硕士（研究型）",
  "Master of Science In Public Health": "公共卫生理学硕士",
  "Master of Science in Engineering": "工程理学硕士",
  "Master of Science (Medical Physiology)": "医学生理学理学硕士",
  "Master of Science (Applied Science)": "应用科学理学硕士",
  "Master of Pharmacy": "药学硕士",
  "Master of Design": "设计硕士",
  "Master of Clinical Pharmacy": "临床药学硕士",
  "Master of Anatomy": "解剖学硕士",
  "Master in Science (by Research) Biomedicine": "生物医学理学硕士（研究型）",
  "Master in Information Technology": "信息技术硕士",
  "Master in Food Service Technology (by Research)": "食品服务技术硕士（研究型）",
  "Master in Computer Science": "计算机科学硕士",
  "Master in Clinical Psychology": "临床心理学硕士",
  "Master in Biomedical Sciences": "生物医学科学硕士",
  "Doctor of Philosophy (Management/Business)": "管理/商业哲学博士",
  "Doctor of Philosophy (Accounting/Finance)": "会计/金融哲学博士",
  "PhD in Food Service Technology": "食品服务技术哲学博士",
  "Doctor of Philosophy in Engineering": "工程哲学博士",
  "Doctor of Philosophy in Education (by research)": "教育哲学博士（研究型）",
  "Doctor of Philosophy (Information and Communication Technology)": "信息与通信技术哲学博士",
  "Doctor of Philosophy (Health Science)": "健康科学哲学博士",
  "Doctor of Philosophy (Computer Science)": "计算机科学哲学博士",
  "Doctor of Philosophy (by Research) in Biomedicine": "生物医学哲学博士（研究型）",
  "Doctor of Philosophy (Applied Science)": "应用科学哲学博士"
};

function localizedFaculty(value: string) {
  if (/Business/i.test(value)) return "商业与管理";
  if (/Postgraduate/i.test(value)) return "研究生院";
  return value;
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|management|account|finance|fashion/.test(value)) return "business";
  if (/computer|information|technology|engineering/.test(value)) return "it";
  if (/pharmacy|health|biomed|medical|anatomy|physiology|clinical psychology|public health/.test(value)) return "medicine";
  if (/science|food service/.test(value)) return "science";
  if (/education|counselling|design/.test(value)) return "arts";
  return "arts";
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number): Promise<MsuPostgraduateVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("MSU university row not found during postgraduate verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX}%`) }
  });
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifyMsuPostgraduateRecordSet(university, rows, allUniversityRows);
}

function officialMsuApplyUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "apply.msu.edu.my";
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeLongText(value: unknown) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildDataSource() {
  loadEnvFiles();
  return new DataSource({
    type: "mysql",
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "123456",
    database: process.env.MYSQL_DATABASE || "study_malaysia",
    entities: [...ALL_ENTITIES],
    synchronize: false,
    charset: "utf8mb4_unicode_ci"
  });
}

async function clearCatalogCache() {
  if (!process.env.REDIS_URL) return false;
  const RedisCtor = IORedis as unknown as new (connection: string, options: Record<string, unknown>) => Redis;
  const client = new RedisCtor(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  client.on("error", () => undefined);
  try {
    await client.connect();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", "catalog:*", "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) await client.del(...keys);
    } while (cursor !== "0");
    return true;
  } catch {
    return false;
  } finally {
    await client.quit().catch(() => undefined);
  }
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function countMsuReviewRows(manager: EntityManager | DataSource, universityId: number) {
  return manager.getRepository(ProgramEntity).count({
    where: { universityId, slug: Like("msu-review-%"), publicDisplayStatus: "needs-review" }
  });
}

async function main() {
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_MSU_POSTGRADUATE_CANDIDATE_PATH);
  if (!existsSync(candidatePath)) throw new Error(`MSU postgraduate candidate file not found: ${candidatePath}`);
  const dataset = loadMsuPostgraduateCandidateDataset(candidatePath);
  const errors = validateMsuPostgraduateCandidateDataset(dataset);
  if (errors.length) throw new Error(`MSU postgraduate candidate validation failed:\n${errors.join("\n")}`);

  const rows = buildMsuPostgraduateReviewRows(dataset);
  const summary = summarizeMsuPostgraduateReviewImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/msu-postgraduate-review-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportOutput = readArgValue("--report-output");

  if (!verifyOnly && !confirm) {
    const report = {
      mode: "dry-run",
      universityCode: "MSU",
      candidatePath,
      writePolicy: {
        authorization: "review-import-msu-only-non-official-fee-candidates",
        importRows: expectedProgrammes,
        programmes: { isPublished: false, publicDisplayStatus: "needs-review" },
        publicLeakageExpected: 0,
        nextStep: "Review this dry-run, then rerun with --confirm-import to create a scoped backup and write transactionally."
      },
      summary
    };
    if (reportOutput) writeJson(resolve(reportOutput), report);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "MSU" } })) ||
      (await universityRepo.findOne({ where: { slug: "management-and-science-university" } }));

    if (verifyOnly) {
      if (!university) throw new Error("MSU university row not found.");
      const report = {
        mode: "verified",
        universityId: university.id,
        databaseUniversityCode: university.code,
        summary,
        verification: await verifyImportedRows(dataSource, university.id)
      };
      if (reportOutput) writeJson(resolve(reportOutput), report);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    if (!university) throw new Error("MSU university row not found.");
    const currentPrograms = await programRepo.find({ where: { universityId: university.id } });
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: MsuPostgraduateVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = await txUniversityRepo.findOne({ where: { id: university!.id } });
      if (!university) throw new Error("MSU university row not found in transaction.");

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX}%`) }
      });
      for (const previous of previousCurrentRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      await txProgramRepo.update(
        {
          universityId: university.id,
          level: In(["master", "phd"]),
          slug: Not(Like(`${MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: "Archived by the MSU postgraduate review import to prevent stale MSU postgraduate rows from mixing with the current review baseline.",
          reviewReason: "Superseded by the 2026-06-30 MSU postgraduate official apply review import."
        }
      );

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      const totalReviewRows = await countMsuReviewRows(manager, university.id);
      await txUniversityRepo.save(txUniversityRepo.create(buildMsuUniversityUpdate(university, dataset, summary, totalReviewRows)));
      verification = await verifyImportedRows(manager, university.id);
    });

    if (!verification) throw new Error("MSU postgraduate review import verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    const report = {
      mode: "imported",
      universityId: university?.id,
      backupPath,
      catalogCacheCleared,
      summary,
      verification
    };
    if (reportOutput) writeJson(resolve(reportOutput), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
