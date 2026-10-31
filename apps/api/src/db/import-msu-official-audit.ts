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

export const MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX = "msu-review-20260629-";
export const DEFAULT_MSU_UNDERGRADUATE_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/MSU_audit_undergraduate_20260629_verified_20260629_v9.json"
);
export const DEFAULT_MSU_2026_TUITION_REPORT_PATH = resolve(
  repositoryRoot,
  "data/imports/msu/2026-06-30/msu-2026-tuition-web-search-report.json"
);

const verifiedAt = "2026-06-29";
const nonOfficialFeeAuthorizedAt = "2026-06-30";
const expectedProgrammes = 80;
const expectedNonOfficialCandidateFees = 74;
const expectedNonOfficialFeeConflicts = 6;
const officialWebsite = "https://www.msu.edu.my";
const programmeCatalogueUrl = "https://apply.msu.edu.my/course/?faculty=all&qualification=bachelor";
const applicationPortalUrl = "https://apply.msu.edu.my/";
const onlineCatalogueUrl = "https://online.msu.edu.my/course/?faculty=school-of-hospitality-and-creative-arts&qualification=bachelor";
const yourUniTuitionUrl = "https://en.your-uni.com/university/msu-university";
const easyUniTuitionUrl = "https://www.easyuni.com/malaysia/management-science-university-msu-218/courses/";
const myrToCny = 1.55;

type MsuAuditLevel = "undergraduate";
type MsuDegreeLevel = "bachelor" | "master" | "phd";

interface MsuEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface MsuAuditProgramme {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: MsuAuditLevel;
  duration: number | null;
  tuitionMYR: number | null;
  tuitionNote: string | null;
  intake: number[];
  applicationDeadline: string | null;
  language: {
    ielts: number | null;
    toefl?: number | null;
    pte?: number | null;
    muet?: number | null;
    otherRequirement?: string | null;
    waiver?: string | null;
  };
  curriculum: string[];
  curriculumNote: string | null;
  careerProspects: string[];
  applicationDocs?: string[];
  officialFeeSourceUrl: string | null;
  officialSourceUrl: string;
  officialVerifiedAt: string;
  entryRequirement: MsuEntryRequirement;
  studyMode: string | null;
  studyModeNote: string | null;
  thesisRequired: boolean | null;
  thesisNote: string | null;
  interviewRequired: string | boolean | null;
  interviewNote: string | null;
  supervisorSystem: boolean | null;
  creditHours: number | null;
  fieldStatus?: Record<string, { status?: string; note?: string; sourceUrl?: string; crawlLevel?: string }>;
  fieldEvidence?: Record<string, unknown>;
  publicDisplayStatus: PublicDisplayStatus;
  auditStatus: string;
  remarks?: string | null;
  _validationResult?: string;
  _validationIssues?: unknown[];
  _pendingIssues?: unknown[];
}

interface MsuReviewedAudit {
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  recommended_for_import?: boolean;
  workflow_status?: string;
  collector_manifest?: {
    institution?: string;
    level?: string;
    sources_registered?: Array<{ url?: string; role?: string }>;
    sources_crawled?: string[];
    known_gaps?: string[];
  };
  programme_baseline?: {
    total_listed?: number;
    snapshot_date?: string;
    source?: string;
    confidence_note?: string;
    scope_decision?: Record<string, unknown>;
  };
  auditMeta?: {
    targetUniversity?: string;
    targetUniversityShortName?: string;
    targetLevel?: MsuAuditLevel;
    officialDomain?: string;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
    exceptionCount?: number;
  };
  sourceRegistry?: {
    officialName?: string;
    shortName?: string;
    officialDomains?: string[];
    roles?: Record<string, string>;
  };
  programmes: MsuAuditProgramme[];
  pending_issues?: unknown[];
  exception_queue?: unknown[];
  validation_result?: {
    recommended_for_import?: boolean;
    blocking_issues?: string[];
    accepted_gaps?: unknown[];
    requires_ian_decision?: string[];
  };
  validationMeta?: {
    overallDecision?: string;
    qualityScore?: Record<string, unknown>;
    counts?: {
      totalProgrammesValidated?: number;
      issuesPending?: number;
    };
    languageGateStats?: Record<string, unknown>;
    strictFeeGateStats?: Record<string, unknown>;
    baselineReconciliation?: Record<string, unknown>;
    tuitionRepairStats?: Record<string, unknown>;
    detailPageRepairStats?: Record<string, unknown>;
  };
}

interface MsuYourUniTuitionCandidate {
  source: "Your-Uni";
  sourceUrl: string;
  name: string;
  tuitionPerYearMYR: number;
  duration?: string;
}

interface MsuEasyUniTuitionCandidate {
  source: "EasyUni";
  sourceUrl: string;
  name: string;
  foreignPerYearRaw?: string;
}

interface Msu2026TuitionReport {
  yourUniBachelor?: MsuYourUniTuitionCandidate[];
  easyUniBachelor?: MsuEasyUniTuitionCandidate[];
}

interface MsuResolvedTuitionSource {
  source: "Your-Uni" | "EasyUni";
  sourceUrl: string;
  sourceProgrammeName: string;
  amountMYR: number;
}

interface MsuResolvedTuitionCandidate {
  auditName: string;
  amountMYR: number;
  displayText: string;
  selectedSource: MsuResolvedTuitionSource;
  sourceRows: MsuResolvedTuitionSource[];
  status: "single-source" | "cross-source-consistent" | "source-conflict-higher-selected";
  note: string;
}

interface TuitionLookup<T extends { name: string }> {
  byName: Map<string, T>;
  byKey: Map<string, T>;
}

interface MsuImportSummary {
  importRows: number;
  byLevel: Record<MsuDegreeLevel, number>;
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
  curriculumRows: number;
  careerRows: number;
  sourceRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface MsuVerification extends MsuImportSummary {
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

export function loadMsuReviewedAudit(path = DEFAULT_MSU_UNDERGRADUATE_AUDIT_PATH): MsuReviewedAudit {
  return loadJson<MsuReviewedAudit>(path);
}

export function validateMsuReviewedAudit(audit: MsuReviewedAudit): string[] {
  const errors: string[] = [];
  if (audit.safe_to_import !== false) errors.push("safe_to_import must remain false.");
  if (audit.import_approved_by != null || audit.import_approved_at != null) {
    errors.push("import approval fields must remain null in the audit artifact.");
  }
  if (audit.recommended_for_import !== false) errors.push("recommended_for_import must be false for MSU review import.");
  if (audit.workflow_status !== "validation_failed") errors.push("workflow_status must be validation_failed.");
  if (audit.auditMeta?.targetUniversityShortName !== "MSU") errors.push("targetUniversityShortName must be MSU.");
  if (audit.auditMeta?.targetLevel !== "undergraduate") errors.push("targetLevel must be undergraduate.");
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedProgrammes) errors.push(`baseline must be ${expectedProgrammes}.`);
  if (audit.auditMeta?.totalProgrammesCollected !== expectedProgrammes) errors.push(`collected count must be ${expectedProgrammes}.`);
  if (audit.auditMeta?.readyCount !== 0) errors.push("readyCount must be 0.");
  if (audit.auditMeta?.needsReviewCount !== expectedProgrammes) errors.push(`needsReviewCount must be ${expectedProgrammes}.`);
  if (audit.programme_baseline?.total_listed !== expectedProgrammes) errors.push(`programme baseline total_listed must be ${expectedProgrammes}.`);
  if (audit.validationMeta?.overallDecision !== "FAIL") errors.push("validationMeta overallDecision must be FAIL.");
  if (audit.validationMeta?.counts?.totalProgrammesValidated !== expectedProgrammes) {
    errors.push(`validation totalProgrammesValidated must be ${expectedProgrammes}.`);
  }
  if (!Array.isArray(audit.validation_result?.blocking_issues) || audit.validation_result.blocking_issues.length === 0) {
    errors.push("MSU audit must keep blocking issues explicit for review import.");
  }
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedProgrammes) {
    errors.push(`expected ${expectedProgrammes} programmes, got ${audit.programmes?.length || 0}.`);
  }

  const seenNames = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `programme ${index + 1} ${programme.nameEn || "unknown"}`;
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (seenNames.has(programme.nameEn)) errors.push(`${row}: duplicate programme name.`);
    seenNames.add(programme.nameEn);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn) errors.push(`${row}: Chinese programme name is required.`);
    if (programme.level !== "undergraduate") errors.push(`${row}: level must be undergraduate.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) {
      errors.push(`${row}: Chinese faculty is required.`);
    }
    if (!officialMsuUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be an MSU official URL.`);
    if (programme.officialFeeSourceUrl) errors.push(`${row}: officialFeeSourceUrl must stay empty until international tuition is confirmed.`);
    if (programme.tuitionMYR != null) errors.push(`${row}: tuitionMYR must stay null until international tuition is confirmed.`);
    if (programme.publicDisplayStatus !== "needs-review") errors.push(`${row}: publicDisplayStatus must be needs-review.`);
    if (programme.auditStatus !== "needs-manual-review") errors.push(`${row}: auditStatus must be needs-manual-review.`);
    if (!Array.isArray(programme.applicationDocs) || programme.applicationDocs.length === 0) {
      errors.push(`${row}: applicationDocs are required for review context.`);
    }
  }
  return errors;
}

export function loadMsu2026TuitionReport(path = DEFAULT_MSU_2026_TUITION_REPORT_PATH): Msu2026TuitionReport {
  return loadJson<Msu2026TuitionReport>(path);
}

export function buildMsu2026TuitionCandidates(
  audit: MsuReviewedAudit,
  report: Msu2026TuitionReport = loadMsu2026TuitionReport()
): Map<string, MsuResolvedTuitionCandidate> {
  const yourUniLookup = buildTuitionLookup(report.yourUniBachelor || []);
  const easyUniLookup = buildTuitionLookup(report.easyUniBachelor || []);
  const candidates = new Map<string, MsuResolvedTuitionCandidate>();

  for (const programme of audit.programmes || []) {
    if (/\b(PJJ|ODL)\b/i.test(programme.nameEn)) continue;
    const sources = [
      resolveYourUniFee(programme.nameEn, yourUniLookup),
      resolveEasyUniFee(programme.nameEn, easyUniLookup)
    ].filter((source): source is MsuResolvedTuitionSource => Boolean(source));

    if (!sources.length) continue;
    const selectedAmount = Math.max(...sources.map((source) => source.amountMYR));
    const selectedSource = sources.find((source) => source.amountMYR === selectedAmount && source.source === "Your-Uni") ||
      sources.find((source) => source.amountMYR === selectedAmount) ||
      sources[0];
    const uniqueAmounts = new Set(sources.map((source) => source.amountMYR));
    const status = sources.length > 1 && uniqueAmounts.size > 1
      ? "source-conflict-higher-selected"
      : sources.length > 1
        ? "cross-source-consistent"
        : "single-source";
    const compared = sources.map((source) => `${source.source} ${formatMyr(source.amountMYR)}`).join("; ");
    const note = status === "source-conflict-higher-selected"
      ? `EasyUni and Your-Uni 2026 foreign/international annual tuition differ; selected the higher amount by Ian's MSU-only authorization. Compared values: ${compared}.`
      : sources.length > 1
        ? `EasyUni and Your-Uni 2026 foreign/international annual tuition match. Compared values: ${compared}.`
        : `Only ${sources[0].source} 2026 foreign/international annual tuition was available in the authorized non-official source set.`;

    candidates.set(programme.nameEn, {
      auditName: programme.nameEn,
      amountMYR: selectedAmount,
      displayText: `${formatMyr(selectedAmount)} / year`,
      selectedSource,
      sourceRows: sources,
      status,
      note
    });
  }

  return candidates;
}

export function buildMsuOfficialAuditRows(
  audit: MsuReviewedAudit,
  tuitionCandidates: Map<string, MsuResolvedTuitionCandidate> = buildMsu2026TuitionCandidates(audit)
): Array<DeepPartial<ProgramEntity>> {
  return audit.programmes.map((programme, index) => buildMsuProgrammeRow(programme, index + 1, tuitionCandidates.get(programme.nameEn)));
}

function buildMsuReviewImportProfile(audit: MsuReviewedAudit, summary: MsuImportSummary) {
  return {
    collectionScope: "MSU official undergraduate review import",
    applicantScope: "international",
    currentAsOf: audit.programme_baseline?.snapshot_date || verifiedAt,
    officialDomains: audit.sourceRegistry?.officialDomains || ["www.msu.edu.my", "apply.msu.edu.my"],
    sourceUniversityCode: "MSU",
    authorization: "review-import",
    workflowStatus: audit.workflow_status,
    sourceAuditSafeToImport: audit.safe_to_import,
    sourceRecommendedForImport: audit.recommended_for_import,
    acceptedBaselineScope: audit.programme_baseline?.scope_decision || null,
    blockingIssues: audit.validation_result?.blocking_issues || [],
    acceptedGaps: audit.validation_result?.accepted_gaps || [],
    requiresIanDecision: audit.validation_result?.requires_ian_decision || [],
    qualityScore: audit.validationMeta?.qualityScore || null,
    catalogStatusSummary: {
      all: {
        total: summary.importRows,
        ready: 0,
        needsReview: summary.needsReviewRows,
        notAvailableForInternational: 0
      },
      byLevel: {
        bachelor: { total: summary.byLevel.bachelor, ready: 0, needsReview: summary.byLevel.bachelor, notAvailableForInternational: 0 }
      }
    },
    tuitionAudit: {
      authorizedNonOfficialFeeUse: {
        authorizedAt: nonOfficialFeeAuthorizedAt,
        scope: "MSU undergraduate review preview only",
        sources: [yourUniTuitionUrl, easyUniTuitionUrl],
        selectionPolicy: "Use EasyUni and Your-Uni 2026 foreign/international annual tuition. When both sources differ, select the higher annual MYR amount. Do not mark as official verified."
      },
      candidateCoverage: {
        annualTuitionRows: summary.nonOfficialCandidateFeeRows,
        missingAnnualTuitionRows: summary.missingNonOfficialCandidateFeeRows,
        sourceConflictRows: summary.sourceConflictFeeRows
      },
      notes: [
        "MSU undergraduate international-student programme tuition was not found as an adoptable official total amount in the reviewed source set.",
        "Ian authorized MSU-only use of non-official 2026 EasyUni/Your-Uni annual tuition candidates for review preview; officialTuitionMYR remains null and rows remain needs-review."
      ]
    },
    validationStats: {
      languageGateStats: audit.validationMeta?.languageGateStats || null,
      strictFeeGateStats: audit.validationMeta?.strictFeeGateStats || null,
      tuitionRepairStats: audit.validationMeta?.tuitionRepairStats || null,
      detailPageRepairStats: audit.validationMeta?.detailPageRepairStats || null
    }
  };
}

function mergeMsuOfficialProfile(existingProfile: unknown, audit: MsuReviewedAudit, summary: MsuImportSummary) {
  return {
    ...asRecord(existingProfile),
    msuUndergraduateReviewImport: buildMsuReviewImportProfile(audit, summary)
  };
}

export function buildMsuUniversityRow(
  audit: MsuReviewedAudit,
  summary: MsuImportSummary,
  existing?: Partial<UniversityEntity> | null
): DeepPartial<UniversityEntity> {
  return {
    slug: existing?.slug || "management-and-science-university",
    code: "MSU",
    name: existing?.name || t("Management and Science University", "Management and Science University", "管理与科学大学", "管理與科學大學"),
    shortName: existing?.shortName || "MSU",
    logoUrl: existing?.logoUrl ?? "",
    imageUrl: existing?.imageUrl ?? "",
    color: existing?.color || "#7C3AED",
    qsRank: typeof existing?.qsRank === "number" ? existing.qsRank : 608,
    qsAsiaRank: existing?.qsAsiaRank ?? 999,
    location: existing?.location || t("Shah Alam, Selangor, Malaysia", "Shah Alam, Selangor, Malaysia", "马来西亚雪兰莪州莎阿南", "馬來西亞雪蘭莪州莎阿南"),
    region: existing?.region || t("Selangor", "Selangor", "雪兰莪州", "雪蘭莪州"),
    ownership: existing?.ownership || "private",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 2001,
    students: existing?.students ?? 0,
    intlStudents: existing?.intlStudents ?? 0,
    csrCertified: existing?.csrCertified ?? false,
    description: existing?.description || t(
      "Management and Science University is retained as a QS-ranked university profile while the undergraduate official audit batch is reviewed separately.",
      "Management and Science University is retained as a QS-ranked university profile while the undergraduate official audit batch is reviewed separately.",
      "管理与科学大学保留为 QS 排名院校资料；本科官方审核批次单独进入预览，不覆盖院校层信息。",
      "管理與科學大學保留為 QS 排名院校資料；本科官方審核批次單獨進入預覽，不覆蓋院校層信息。"
    ),
    website: existing?.website || officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: existing?.nameEnOfficial || "Management and Science University",
    officialWebsite: existing?.officialWebsite || officialWebsite,
    studyPortalUrl: existing?.studyPortalUrl || programmeCatalogueUrl,
    internationalPageUrl: existing?.internationalPageUrl || "https://www.msu.edu.my/international-students/admissions",
    applicationPortalUrl: existing?.applicationPortalUrl || applicationPortalUrl,
    officialAddress: existing?.officialAddress || "University Drive, Off Persiaran Olahraga, Section 13, 40100 Shah Alam, Selangor, Malaysia",
    applicationPeriods: existing?.applicationPeriods ?? [],
    applicationFees: existing?.applicationFees ?? [],
    applicationDocuments: existing?.applicationDocuments || arr(defaultEnglishApplicationDocs(), defaultEnglishApplicationDocs(), defaultChineseApplicationDocs(), defaultChineseApplicationDocs()),
    chinaStudentRequirements: existing?.chinaStudentRequirements || arr([]),
    officialProfile: mergeMsuOfficialProfile(existing?.officialProfile, audit, summary),
    officialSources: existing?.officialSources || buildUniversitySourceLinks(audit),
    officialVerifiedAt: existing?.officialVerifiedAt ?? null,
    officialSourceStatus: existing?.officialSourceStatus || "official-verified",
    officialAuditSummary:
      existing?.officialAuditSummary ||
      "MSU undergraduate review import is isolated under the keyed preview API. University profile remains public and QS-sorted.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: existing?.livingCostOfficialNote ?? null,
    tuitionMinCny: existing?.tuitionMinCny ?? 20000,
    tuitionMaxCny: existing?.tuitionMaxCny ?? 60000,
    livingCostCny: existing?.livingCostCny ?? 20000,
    minIelts: existing?.minIelts ?? 5,
    acceptNoLanguage: existing?.acceptNoLanguage ?? true,
    facilities: existing?.facilities || arr([]),
    highlights: existing?.highlights || arr(["QS-ranked university profile retained"], ["QS-ranked university profile retained"], ["QS 排名院校资料已保留"], ["QS 排名院校資料已保留"]),
    programCount: Math.max(Number(existing?.programCount || 0), summary.importRows),
    isPublished: true
  };
}

export function summarizeMsuOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): MsuImportSummary {
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
    curriculumRows: rows.filter((row) => (row.curriculum as LocalizedStringArray | undefined)?.["zh-CN"]?.length).length,
    careerRows: rows.filter((row) => (row.careers as LocalizedStringArray | undefined)?.["zh-CN"]?.length).length,
    sourceRows: rows.filter((row) => row.officialSourceUrl).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function verifyMsuReviewRecordSet(university: UniversityEntity, rows: ProgramEntity[], allUniversityRows: ProgramEntity[]): MsuVerification {
  const summary = summarizeMsuOfficialAuditImport(rows);
  const publicLeakageRows = rows.filter((row) => row.isPublished || row.publicDisplayStatus === "ready").length;
  const adminNeedsReviewRows = allUniversityRows.filter(
    (row) => row.slug.startsWith(MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX) && row.publicDisplayStatus === "needs-review"
  ).length;
  const activeSupersededRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX) && row.level === "bachelor" && row.publicDisplayStatus !== "archived"
  ).length;

  if (
    rows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedProgrammes ||
    summary.readyRows !== 0 ||
    summary.needsReviewRows !== expectedProgrammes ||
    summary.publishedRows !== 0 ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== 0 ||
    summary.nonOfficialCandidateFeeRows !== expectedNonOfficialCandidateFees ||
    summary.missingNonOfficialCandidateFeeRows !== expectedProgrammes - expectedNonOfficialCandidateFees ||
    summary.sourceConflictFeeRows !== expectedNonOfficialFeeConflicts ||
    summary.pendingFeeRows !== expectedProgrammes ||
    summary.directIeltsRows !== 19 ||
    summary.missingDirectIeltsRows !== 61 ||
    summary.durationReviewRows !== 4 ||
    summary.sourceRows !== expectedProgrammes ||
    publicLeakageRows !== 0 ||
    adminNeedsReviewRows !== expectedProgrammes ||
    activeSupersededRows !== 0 ||
    university.isPublished !== true ||
    university.publicDisplayStatus !== "ready"
  ) {
    throw new Error(
      `MSU review import verification failed: ${JSON.stringify({
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

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number): Promise<MsuVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("MSU university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX}%`) }
  });
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifyMsuReviewRecordSet(university, rows, allUniversityRows);
}

function buildMsuProgrammeRow(
  programme: MsuAuditProgramme,
  ordinal: number,
  tuitionCandidate?: MsuResolvedTuitionCandidate
): DeepPartial<ProgramEntity> {
  const englishDocs = defaultEnglishApplicationDocs();
  const chineseDocs = programme.applicationDocs?.length ? programme.applicationDocs : defaultChineseApplicationDocs();
  const language = buildLanguageRequirement(programme);
  const durationYears = typeof programme.duration === "number" && programme.duration > 0 ? programme.duration : 0;
  const durationOfficial = durationYears > 0 ? `${formatNumber(durationYears)} years` : "Official duration requires review.";
  const officialLanguageRequirement = normalizeLongText([
    language.ielts ? `IELTS ${language.ielts}` : "",
    programme.language?.toefl ? `TOEFL ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET ${programme.language.muet}` : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver || ""
  ].filter(Boolean).join("; "));
  const reviewReason = reviewReasonText(programme, tuitionCandidate);
  const tuitionDisplay = tuitionCandidate?.displayText || "Official international tuition requires review";
  const candidateFeeNote = tuitionCandidate
    ? `Ian authorized MSU-only use of non-official 2026 annual tuition candidates on ${nonOfficialFeeAuthorizedAt}. Selected ${tuitionCandidate.displayText} from ${tuitionCandidate.selectedSource.source}; ${tuitionCandidate.note}`
    : "";
  const officialTuitionNote = normalizeLongText([
    programme.tuitionNote || "No adoptable official MSU international undergraduate tuition total was found in the reviewed source set.",
    candidateFeeNote
  ].filter(Boolean).join(" "));
  const officialFeeAuditStatus = tuitionCandidate?.status === "source-conflict-higher-selected"
    ? "source-conflict" satisfies FeeAuditStatus
    : "pending-review" satisfies FeeAuditStatus;
  const secondaryFeeSource = tuitionCandidate?.sourceRows.find((source) => source.sourceUrl !== tuitionCandidate.selectedSource.sourceUrl);

  return {
    slug: `${MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
    code: `MSU-UG-${String(ordinal).padStart(3, "0")}`,
    name: t(programme.nameEn, programme.nameEn, programme.name, programme.name),
    nameEnOfficial: programme.nameEn,
    level: "bachelor",
    category: inferCategory(programme.nameEn, programme.faculty),
    faculty: t(programme.faculty, programme.faculty, programme.facultyZh || programme.faculty, programme.facultyZh || programme.faculty),
    facultyZh: programme.facultyZh || "",
    studyMode: programme.studyMode || "on-campus",
    campus: "Shah Alam, Selangor, Malaysia",
    durationYears,
    durationOfficial,
    annualTuitionCny: tuitionCandidate ? Math.round(tuitionCandidate.amountMYR * myrToCny) : 0,
    tuitionAmount: tuitionCandidate?.amountMYR ?? null,
    tuitionCurrency: "MYR" satisfies TuitionCurrency,
    tuitionDisplay,
    officialTuitionMYR: null,
    officialTuitionNote,
    officialFeeSourceUrl: tuitionCandidate?.selectedSource.sourceUrl || "",
    secondaryOfficialFeeSourceUrl: secondaryFeeSource?.sourceUrl || "",
    officialFeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: (programme.intake || []).map(String),
    officialIntake: programme.intake?.length ? intakeMonthNames(programme.intake).join(", ") : "Official intake month not published",
    officialIntakeNote: normalizeLongText(
      programme.fieldStatus?.intake?.note ||
        programme.applicationDeadline ||
        "MSU official sources reviewed did not provide a per-programme structured intake month."
    ),
    languageRequirement: language,
    officialLanguageRequirement,
    requirement: {
      gpa: programme.entryRequirement?.minGPA || 0,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: t(
        academicRequirementText(programme),
        academicRequirementText(programme),
        academicRequirementChineseText(programme),
        academicRequirementChineseText(programme)
      )
    },
    officialAcademicRequirement: academicRequirementText(programme),
    chinaStudentRequirement: "China-specific undergraduate route was not separately confirmed in the MSU audit run; keep as needs-review before public display.",
    specialRequirementsNote: normalizeLongText([
      "Imported for backend/admin review only. Do not publish until per-record ready gate is completed.",
      programme.studyModeNote || "",
      programme.interviewNote ? `Interview: ${programme.interviewNote}` : "",
      programme.thesisNote ? `Thesis: ${programme.thesisNote}` : ""
    ].filter(Boolean).join(" ")),
    applicationDocs: arr(englishDocs, englishDocs, chineseDocs, chineseDocs),
    curriculum: arr(
      officialEnglishItems(programme, "curriculum"),
      officialEnglishItems(programme, "curriculum"),
      programme.curriculum || [],
      programme.curriculum || []
    ),
    careers: arr(
      officialEnglishItems(programme, "career"),
      officialEnglishItems(programme, "career"),
      programme.careerProspects || [],
      programme.careerProspects || []
    ),
    specializations: arr([]),
    description: t(
      `MSU undergraduate programme imported from the official audit batch for review. ${reviewReason}`,
      `MSU undergraduate programme imported from the official audit batch for review. ${reviewReason}`,
      `这是管理与科学大学本科官方审核候选专业。${reviewReason}`,
      `這是管理與科學大學本科官方審核候選專業。${reviewReason}`
    ),
    officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: programme.officialSourceUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls: sourceLinks(programme, tuitionCandidate),
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "needs-review",
    publicDisplayStatus: "needs-review",
    publicDisplayNote: "Review-only database import. Hidden from public catalogue until Ian approves ready conversion after resolving MSU blocking issues.",
    reviewReason,
    auditNote: normalizeLongText([
      `Original MSU audit row ${ordinal}.`,
      `Audit status: ${programme.auditStatus}; validation result: ${programme._validationResult || "not recorded"}.`,
      `Tuition field status: ${programme.fieldStatus?.tuitionMYR?.status || "not recorded"}.`,
      `Language IELTS field status: ${programme.fieldStatus?.["language.ielts"]?.status || "not recorded"}.`,
      `Pending issues: ${(programme._pendingIssues || []).length}; validation issues: ${(programme._validationIssues || []).length}.`,
      programme.remarks || ""
    ].filter(Boolean).join(" ")),
    listTuitionText: tuitionDisplay,
    isPublished: false
  };
}

function buildLanguageRequirement(programme: MsuAuditProgramme): LanguageRequirement {
  return {
    ielts: positiveNumber(programme.language?.ielts) || extractIeltsFromEvidence(programme) || 0,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function extractIeltsFromEvidence(programme: MsuAuditProgramme) {
  const languageEvidence = asRecord(asRecord(programme.fieldEvidence).language);
  const text = normalizeText(languageEvidence.directIeltsSourceText, 1000);
  if (!text) return null;
  const afterIelts = [...text.matchAll(/IELTS\s*(?:\(|:|score|at least)?\s*(\d(?:\.\d{1,2})?)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 9);
  const beforeIelts = [...text.matchAll(/(\d(?:\.\d{1,2})?)\s*(?:in|for)?\s*IELTS/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 9);
  const matches = [...afterIelts, ...beforeIelts];
  return matches.length ? Math.max(...matches) : null;
}

function buildUniversitySourceLinks(audit: MsuReviewedAudit): OfficialSourceLink[] {
  const urls = new Set<string>([
    officialWebsite,
    programmeCatalogueUrl,
    applicationPortalUrl,
    onlineCatalogueUrl,
    ...(audit.collector_manifest?.sources_registered || []).map((source) => source.url || ""),
    ...(audit.collector_manifest?.sources_crawled || [])
  ].filter(Boolean));
  return Array.from(urls).map((url) => ({
    title: sourceLinkTitle(url),
    url,
    sourceType: sourceLinkType(url),
    verifiedAt,
    status: "needs-review",
    note: url === programmeCatalogueUrl
      ? "Accepted MSU undergraduate baseline source: 80 official application-catalogue entries."
      : "Captured in the MSU undergraduate official audit batch; review-only before public display."
  }));
}

function sourceLinks(programme: MsuAuditProgramme, tuitionCandidate?: MsuResolvedTuitionCandidate): OfficialSourceLink[] {
  const urls = new Set<string>([
    programme.officialSourceUrl,
    programme.fieldStatus?.tuitionMYR?.sourceUrl || "",
    programme.fieldStatus?.intake?.sourceUrl || "",
    programme.fieldStatus?.["language.ielts"]?.sourceUrl || ""
  ].filter(Boolean));
  const officialLinks = Array.from(urls).map((url) => ({
    title: url === programme.officialSourceUrl ? "Official programme source" : "Official MSU source",
    url,
    sourceType: sourceLinkType(url),
    verifiedAt: programme.officialVerifiedAt || verifiedAt,
    status: "needs-review" as const,
    note: url === programme.officialSourceUrl
      ? "Programme source captured in the MSU review audit."
      : "Supporting MSU source captured in the review audit."
  }));
  const candidateLinks = (tuitionCandidate?.sourceRows || []).map((source) => ({
    title: `${source.source} 2026 tuition candidate`,
    url: source.sourceUrl,
    sourceType: "fee" as const,
    verifiedAt: nonOfficialFeeAuthorizedAt,
    status: "needs-review" as const,
    note: `Non-official MSU-only annual tuition candidate for ${source.sourceProgrammeName}: ${formatMyr(source.amountMYR)} / year.`
  }));
  return [...officialLinks, ...candidateLinks];
}

function reviewReasonText(programme: MsuAuditProgramme, tuitionCandidate?: MsuResolvedTuitionCandidate) {
  const reasons = [
    tuitionCandidate
      ? "official international tuition total not confirmed; non-official 2026 annual tuition candidate included for MSU-only review"
      : "international tuition total not confirmed by an adoptable official MSU source",
    tuitionCandidate?.status === "source-conflict-higher-selected" ? "EasyUni/Your-Uni tuition conflict; higher annual amount selected by Ian authorization" : "",
    programme.language?.ielts ? "" : "direct IELTS list score not published",
    programme.duration ? "" : "numeric duration requires review",
    programme.fieldStatus?.tuitionMYR?.note || "",
    programme.fieldStatus?.["language.ielts"]?.note || "",
    programme._pendingIssues?.length ? `${programme._pendingIssues.length} row-level pending issue(s)` : ""
  ].filter(Boolean);
  return normalizeLongText([...new Set(reasons)].join("; "));
}

function academicRequirementText(programme: MsuAuditProgramme) {
  const evidence = fieldEvidenceText(programme, "entryRequirement") || fieldEvidenceText(programme, "academicRequirement");
  return normalizeLongText(evidence || programme.entryRequirement?.gpaNote || "Official academic entry requirement requires manual review in the MSU audit batch.");
}

function academicRequirementChineseText(programme: MsuAuditProgramme) {
  if (programme.entryRequirement?.gpaNote) return programme.entryRequirement.gpaNote;
  return "MSU 审计批次中该专业学术入学要求仍需人工复核。";
}

function officialEnglishItems(programme: MsuAuditProgramme, kind: "curriculum" | "career"): string[] {
  const evidence = asRecord(programme.fieldEvidence);
  const field = kind === "curriculum" ? asRecord(evidence.curriculum) : asRecord(evidence.careerProspects);
  const raw = field.rawOfficialItems;
  if (Array.isArray(raw)) return raw.map((item) => normalizeText(item, 255)).filter(Boolean);
  const items = field.items;
  if (Array.isArray(items)) return items.map((item) => normalizeText(item, 255)).filter(Boolean);
  return [];
}

function fieldEvidenceText(programme: MsuAuditProgramme, fieldName: string) {
  const value = asRecord(programme.fieldEvidence)[fieldName];
  if (Array.isArray(value)) return normalizeText(asRecord(value[0]).evidence || asRecord(value[0]).value || "", 4000);
  const record = asRecord(value);
  return normalizeText(record.evidence || record.value || record.sourceText || "", 4000);
}

function defaultEnglishApplicationDocs() {
  return [
    "Certified copies of all academic qualifications, transcripts and certificates.",
    "Certified English-language test result such as TOEFL or IELTS where applicable.",
    "Certified passport copy including blank pages with at least one year validity from the admission date.",
    "Six identical passport-size colour photographs with white background.",
    "No Objection Certificate where required for African or Sub-Saharan African applicants.",
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
    "六张相同的护照尺寸彩色照片（正面、不微笑、白色背景）",
    "非洲或撒哈拉以南非洲申请人需提交所在国使馆 No Objection Certificate（如适用）",
    "入境前体检报告",
    "奖学金或学习贷款证明；自费申请人可提交财务担保信",
    "非英文文件需提供英文翻译件"
  ];
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|management|account|finance|banking|marketing|entrepreneurship|retail|investment|human capital|hospitality|culinary|tourism|event/.test(value)) return "business";
  if (/computer|information|software|network|cyber|data|game|mobile|technology|engineering/.test(value)) return "it";
  if (/medical|medicine|pharmacy|nursing|biomed|health|nutrition|dentistry|physiotherapy|optometry|cardiovascular|forensic|bioinformatics/.test(value)) return "medicine";
  if (/science|biology|biotechnology|food service technology/.test(value)) return "science";
  if (/law/.test(value)) return "law";
  if (/design|music|creative|broadcast|education|psychology|counselling|translation|fashion|visual|outdoor/.test(value)) return "arts";
  return "arts";
}

function sourceLinkTitle(url: string) {
  if (url === officialWebsite) return "MSU official website";
  if (url === programmeCatalogueUrl) return "MSU Bachelor application catalogue";
  if (url === applicationPortalUrl) return "MSU application portal";
  if (url === onlineCatalogueUrl) return "MSU online programme catalogue";
  if (/admissions|international-students/i.test(url)) return "MSU international admissions";
  if (/course\/\?/.test(url)) return "MSU official course catalogue";
  return "MSU official source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/fee|tuition|payment/.test(value)) return "fee";
  if (/admission|apply|application/.test(value)) return "admission";
  if (/course|programme|program|faculty|school/.test(value)) return "study-portal";
  if (value === officialWebsite) return "official-website";
  return "other";
}

const yourUniProgrammeAliases: Record<string, string> = {
  "Bachelor in Accountancy (Hons)": "Bachelor in Accounting (Honours)",
  "Bachelor in Bioinformatic (Honours)": "Bachelor in Bioinformatics (Hons)",
  "Bachelor in Information Technology (Mobile Wireless Technology) (Honours)": "Bachelor in Information Technology (Honours) Mobile Wireless and Technology",
  "Bachelor of Medical Sciences (Hons)": "Bachelor in Medical Sciences (Honours)",
  "Bachelor of Science (Hons) in Mechanical Engineering": "Bachelor of Science (Honours) in Mechanical Engineering",
  "Bachelor of Science in Aviation Management and Piloting (Hons)": "Bachelor of Science in Aviation Management and Piloting (Honours)",
  "Bachelor of Science in Pharmaceutical Technology (Hons)": "Bachelor of Science in Pharmaceutical Technology (Honours)"
};

const easyUniProgrammeAliases: Record<string, string> = {
  "Bachelor in Accountancy (Hons)": "Bachelor in Accounting (Hons)",
  "Bachelor in Bioinformatic (Honours)": "Bachelor in Bioinformatics (Hons)",
  "Bachelor in Creative Multimedia (Hons)": "Bachelor in Creative Mutimedia (Hons)",
  "Bachelor in Education (Electrical & Electronic Engineering) (Hons)": "Bachelor in Education (Electrical and Electronic Engineering) (Hons)",
  "Bachelor in Education (Health and Physical Education) (Hons)": "Bachelor in Education (Physical education and Health)",
  "Bachelor in Hospitality and Tourism Management (Hons)": "Bachelor in Hospitality & Tourism Management (Hons)",
  "Bachelor in Information Technology (Mobile Wireless Technology) (Honours)": "Bachelor in Information Technology (Mobile Wireless Technology) with Honours",
  "Bachelor in Investment Management (Hons)": "Bachelor in Investment Management",
  "Bachelor in Islamic Management (Hons)": "Bachelor in Islamic Management",
  "Bachelor in Music Technology (Hons)": "Bachelor in Music Technology",
  "Bachelor of New Media (Hons)": "Bachelor in New Media"
};

function buildTuitionLookup<T extends { name: string }>(rows: T[]): TuitionLookup<T> {
  return {
    byName: new Map(rows.map((row) => [row.name, row])),
    byKey: new Map(rows.map((row) => [tuitionNameKey(row.name), row]))
  };
}

function resolveYourUniFee(
  auditName: string,
  lookup: TuitionLookup<MsuYourUniTuitionCandidate>
): MsuResolvedTuitionSource | null {
  const lookupName = yourUniProgrammeAliases[auditName] || auditName;
  const row = lookup.byName.get(lookupName) || lookup.byKey.get(tuitionNameKey(lookupName));
  const amountMYR = positiveNumber(row?.tuitionPerYearMYR);
  if (!row || !amountMYR) return null;
  return {
    source: "Your-Uni",
    sourceUrl: row.sourceUrl || yourUniTuitionUrl,
    sourceProgrammeName: row.name,
    amountMYR
  };
}

function resolveEasyUniFee(
  auditName: string,
  lookup: TuitionLookup<MsuEasyUniTuitionCandidate>
): MsuResolvedTuitionSource | null {
  const lookupName = easyUniProgrammeAliases[auditName] || auditName;
  const row = lookup.byName.get(lookupName) || lookup.byKey.get(tuitionNameKey(lookupName));
  const amountMYR = parseMyrAmount(row?.foreignPerYearRaw);
  if (!row || !amountMYR) return null;
  return {
    source: "EasyUni",
    sourceUrl: row.sourceUrl || easyUniTuitionUrl,
    sourceProgrammeName: row.name,
    amountMYR
  };
}

function tuitionNameKey(value: string) {
  return normalizeTuitionName(value)
    .replace(/^bachelor\s+(in|of)\s+/, "bachelor ")
    .replace(/\bhonours\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTuitionName(value: string) {
  return value
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/&/g, " and ")
    .replace(/\bmutimedia\b/g, "multimedia")
    .replace(/\bhons?\b/g, "honours")
    .replace(/\(\s*honours\s*\)/g, " honours ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMyrAmount(value: unknown) {
  const match = String(value || "").match(/MYR\s*([0-9,]+)/i);
  return match ? positiveNumber(match[1].replace(/,/g, "")) : null;
}

function formatMyr(value: number) {
  return `RM ${formatCurrency(value)}`;
}

function intakeMonthNames(months: number[]) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (months || []).map((month) => names[month - 1]).filter(Boolean);
}

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function officialMsuUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "msu.edu.my" || host.endsWith(".msu.edu.my");
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeLongText(value: unknown) {
  return normalizeText(value, 4000);
}

function normalizeText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
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

async function main() {
  const auditPath = resolve(readArgValue("--audit") || DEFAULT_MSU_UNDERGRADUATE_AUDIT_PATH);
  if (!existsSync(auditPath)) throw new Error(`MSU audit file not found: ${auditPath}`);
  const audit = loadMsuReviewedAudit(auditPath);
  const errors = validateMsuReviewedAudit(audit);
  if (errors.length) throw new Error(`MSU undergraduate audit validation failed:\n${errors.join("\n")}`);

  const rows = buildMsuOfficialAuditRows(audit);
  const summary = summarizeMsuOfficialAuditImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/msu-undergraduate-review-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportOutput = readArgValue("--report-output");

  if (!verifyOnly && !confirm) {
    const report = {
      mode: "dry-run",
      universityCode: "MSU",
      auditPath,
      writePolicy: {
        authorization: "review-import",
        requestedMode: "review-import",
        upsertPrefix: MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX,
        importRows: expectedProgrammes,
        university: {
          isPublished: true,
          publicDisplayStatus: "ready",
          policy: "Preserve the public QS-ranked university profile; store MSU undergraduate review metadata under officialProfile.msuUndergraduateReviewImport."
        },
        programmes: { isPublished: false, publicDisplayStatus: "needs-review" },
        archiveLegacyRows:
          "Archive existing MSU bachelor rows outside the MSU review slug prefix so the admin review set shows exactly 80 current candidates.",
        publicLeakageExpected: 0,
        nextStep: "Review this dry-run, then rerun with --confirm-import to create a scoped backup and write transactionally."
      },
      blockingIssues: audit.validation_result?.blocking_issues || [],
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

    const slugConflict = await universityRepo.findOne({ where: { slug: "management-and-science-university" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug management-and-science-university belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: MsuVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "MSU" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: "management-and-science-university" } }));

      const universitySeed = buildMsuUniversityRow(audit, summary, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX}%`) }
      });
      for (const previous of previousCurrentRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      await txProgramRepo.update(
        {
          universityId: university.id,
          level: In(["bachelor"]),
          slug: Not(Like(`${MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: "Archived by the MSU undergraduate review import to prevent stale MSU bachelor rows from mixing with the current 80-row review baseline.",
          reviewReason: "Superseded by the 2026-06-29 MSU undergraduate official audit review import."
        }
      );

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      university.programCount = summary.importRows;
      await txUniversityRepo.save(university);
      verification = await verifyImportedRows(manager, university.id);
    });

    if (!verification) throw new Error("MSU review import verification did not run.");
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
