import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, Like, type DeepPartial, type EntityManager } from "typeorm";
import {
  QS_UNRANKED_RANK,
  type FeeAuditStatus,
  type LanguageRequirement,
  type LocalizedStringArray,
  type LocalizedText,
  type OfficialSourceLink,
  type OfficialSourceStatus,
  type ProgramCategoryCode,
  type PublicDisplayStatus,
  type TuitionCurrency
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export const LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX = "luc-postgraduate-20260705-row-";
export const DEFAULT_LUC_MASTER_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/LUC_audit_master_20260704_reviewed_v3_verified_20260705.json"
);
export const DEFAULT_LUC_DOCTORAL_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/LUC_audit_doctoral_20260704_reviewed_v2_verified_20260705.json"
);

const verifiedAt = "2026-07-05";
const officialWebsite = "https://www.lincoln.edu.my/";
const masterCatalogueUrl = "https://www.lincoln.edu.my/category/master/";
const doctoralCatalogueUrl = "https://www.lincoln.edu.my/category/phd/";
const applicationPortalUrl = "https://www.online.lincoln.edu.my//applyonline/landingapplyonline.aspx";
const applicationDocsUrl = "https://crm.lincoln.edu.my/UserSupport/FAQs?student=student";
const officialTuitionPendingDisplay = "待官方确认";

type LucAuditLevel = "master" | "doctoral";
type LucDbLevel = "master" | "phd";

const expectedProgrammes: Record<LucAuditLevel, number> = {
  master: 61,
  doctoral: 35
};

interface LucLanguage {
  ielts: number | null;
  toefl?: number | null;
  pte?: number | null;
  muet?: number | null;
  otherRequirement?: string | null;
  waiver?: string | null;
}

interface LucEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface LucAuditProgramme {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: LucAuditLevel;
  duration: number | null;
  tuitionMYR: number | null;
  tuitionNote: string | null;
  intake: number[];
  applicationDeadline: string | null;
  applicationDocs: string[];
  language: LucLanguage;
  curriculum: string[];
  curriculumNote: string | null;
  careerProspects: string[];
  officialFeeSourceUrl: string | null;
  officialSourceUrl: string;
  officialVerifiedAt: string;
  entryRequirement: LucEntryRequirement;
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
  _applicationOpsStatus?: string;
  _memberCenterSyncStatus?: string;
}

interface LucPostgraduateAudit {
  schema_version: "audit-json-v2.1";
  workflow_status?: string;
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  import_authorization?: {
    safe_to_import?: boolean;
    authorization_status?: string;
    authorized_by?: string | null;
    authorized_at?: string | null;
  };
  auditMeta?: {
    targetUniversity?: string;
    targetUniversityShortName?: string;
    targetLevel?: LucAuditLevel;
    officialDomain?: string;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
    exceptionCount?: number;
    validatedAt?: string;
    reviewedAt?: string;
  };
  collector_manifest?: Record<string, unknown>;
  sourceRegistry?: Record<string, unknown>;
  programme_baseline?: Record<string, unknown>;
  validation_result?: {
    recommended_for_import?: boolean;
    blocking_issues?: unknown[];
    accepted_gaps?: unknown[];
    requires_ian_decision?: unknown[];
  };
  validationMeta?: {
    strictFeeGateStats?: {
      totalProgrammesChecked?: number;
      programmePageDirectAmountRows?: number;
      programmePageDirectAmountMissRows?: number;
      decision?: string;
    };
  };
  pending_issues?: Array<{ issue_id?: string; issue_type?: string; resolution_note?: string; status?: string }>;
  exception_queue?: unknown[];
  programmes: LucAuditProgramme[];
}

interface LucAuditBundle {
  level: LucAuditLevel;
  path: string;
  audit: LucPostgraduateAudit;
}

export interface LucPostgraduateImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<LucDbLevel, number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  missingFeeRows: number;
  directIeltsRows: number;
  noDirectIeltsRows: number;
  durationReviewRows: number;
  curriculumRows: number;
  emptyCurriculumRows: number;
  careerRows: number;
  emptyCareerRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

export interface LucPostgraduateImportVerification extends LucPostgraduateImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  importedPublicLeakageRows: number;
  importedAdminNeedsReviewRows: number;
  applicationSelectableRows: number;
  memberCenterReadyRows: number;
  stalePostgraduateReviewRows: number;
}

interface PublicVisibilitySnapshot {
  universityExists: boolean;
  universityId: number | null;
  universityCode: string | null;
  universitySlug: string | null;
  universityIsPublished: boolean;
  universityPublicDisplayStatus: PublicDisplayStatus | null;
  publicUniversityVisible: boolean;
  publicProgrammeRows: number;
  reviewProgrammeRows: number;
  importedPostgraduateReviewRows: number;
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

export function loadLucPostgraduateAuditBundle(
  masterPath = DEFAULT_LUC_MASTER_AUDIT_PATH,
  doctoralPath = DEFAULT_LUC_DOCTORAL_AUDIT_PATH
): LucAuditBundle[] {
  return [
    { level: "master", path: masterPath, audit: loadJson<LucPostgraduateAudit>(masterPath) },
    { level: "doctoral", path: doctoralPath, audit: loadJson<LucPostgraduateAudit>(doctoralPath) }
  ];
}

export function validateLucPostgraduateAuditBundle(bundle: LucAuditBundle[]): string[] {
  const errors: string[] = [];
  const seenLevels = new Set<LucAuditLevel>();

  for (const item of bundle) {
    const { audit, level, path } = item;
    const expectedCount = expectedProgrammes[level];
    seenLevels.add(level);
    if (audit.schema_version !== "audit-json-v2.1") errors.push(`${path}: schema_version must be audit-json-v2.1.`);
    if (audit.safe_to_import !== false) errors.push(`${path}: safe_to_import must remain false.`);
    if (audit.import_authorization?.safe_to_import !== false) {
      errors.push(`${path}: import_authorization.safe_to_import must remain false.`);
    }
    if (audit.import_approved_by != null || audit.import_approved_at != null) {
      errors.push(`${path}: import approval fields must remain null.`);
    }
    if (audit.validation_result?.recommended_for_import !== false) {
      errors.push(`${path}: validation_result.recommended_for_import must remain false.`);
    }
    if (audit.auditMeta?.targetUniversityShortName !== "LUC") errors.push(`${path}: targetUniversityShortName must be LUC.`);
    if (audit.auditMeta?.targetLevel !== level) errors.push(`${path}: targetLevel must be ${level}.`);
    if (audit.auditMeta?.officialDomain !== "lincoln.edu.my") errors.push(`${path}: officialDomain must be lincoln.edu.my.`);
    if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
      errors.push(`${path}: ${level} audit must contain ${expectedCount} programmes.`);
    }
    if (audit.validationMeta?.strictFeeGateStats?.decision !== "FAIL") {
      errors.push(`${path}: strict fee gate must remain FAIL for Display-Only review import.`);
    }

    audit.programmes.forEach((programme, index) => {
      const ordinal = index + 1;
      if (!programme.nameEn) errors.push(`${path}: row ${ordinal} has no official English name.`);
      if (programme.level !== level) errors.push(`${path}: row ${ordinal} source level must be ${level}.`);
      if (!programme.officialSourceUrl?.includes("lincoln.edu.my")) {
        errors.push(`${path}: row ${ordinal} has no LUC official source URL.`);
      }
      if (programme.publicDisplayStatus !== "needs-review") errors.push(`${path}: row ${ordinal} must remain needs-review.`);
      if (programme.tuitionMYR !== null) errors.push(`${path}: row ${ordinal} tuitionMYR must remain null.`);
      if (programme.officialFeeSourceUrl !== null) errors.push(`${path}: row ${ordinal} officialFeeSourceUrl must remain null.`);
      if (asRecord(programme.fieldEvidence?.tuition).strictFeeGate !== "FAIL") {
        errors.push(`${path}: row ${ordinal} strict fee gate must remain FAIL.`);
      }
      if (programme._applicationOpsStatus !== "not-application-selectable") {
        errors.push(`${path}: row ${ordinal} must remain not-application-selectable.`);
      }
      if (programme._memberCenterSyncStatus !== "member-center-blocked") {
        errors.push(`${path}: row ${ordinal} must remain member-center-blocked.`);
      }
    });
  }

  if (!seenLevels.has("master")) errors.push("Master audit bundle is missing.");
  if (!seenLevels.has("doctoral")) errors.push("Doctoral audit bundle is missing.");
  return errors;
}

export function buildLucPostgraduateReviewRows(bundle: LucAuditBundle[]): Array<DeepPartial<ProgramEntity>> {
  return bundle.flatMap(({ audit, level }) =>
    audit.programmes.map((programme, index) => {
      const ordinal = index + 1;
      const dbLevel = toDbLevel(level);
      const sourceStatus: OfficialSourceStatus = "needs-review";
      const publicDisplayStatus: PublicDisplayStatus = "needs-review";
      const language = languageRequirement(programme);
      const durationYears = Number(programme.duration ?? 0);
      const curriculum = safeStringArray(programme.curriculum);
      const careers = safeStringArray(programme.careerProspects);
      const reviewReason = reviewReasonText(programme, level);
      const levelCode = dbLevel === "phd" ? "PHD" : "M";

      return {
        slug: `${LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX}${level}-${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
        code: `LUC-PG-${levelCode}-${String(ordinal).padStart(3, "0")}`,
        name: t(programme.nameEn, programme.nameEn, programme.name || programme.nameEn, programme.name || programme.nameEn),
        nameEnOfficial: programme.nameEn,
        level: dbLevel,
        category: inferCategory(programme.nameEn, programme.faculty),
        faculty: localizedFaculty(programme.faculty, programme.facultyZh),
        facultyZh: programme.facultyZh || programme.faculty,
        studyMode: studyModeDisplay(programme, level),
        campus: "Lincoln University College, Petaling Jaya, Selangor, Malaysia",
        durationYears,
        durationOfficial: durationYears > 0
          ? `${formatNumber(durationYears)} years`
          : "Official duration pending confirmation.",
        annualTuitionCny: 0,
        tuitionAmount: null,
        tuitionCurrency: "MYR" satisfies TuitionCurrency,
        tuitionDisplay: officialTuitionPendingDisplay,
        officialTuitionMYR: null,
        officialTuitionNote: tuitionNote(programme),
        officialFeeSourceUrl: "",
        secondaryOfficialFeeSourceUrl: "",
        officialFeeAuditStatus: "not-published" satisfies FeeAuditStatus,
        officialFeeAuditedAt: verifiedAt,
        intakeMonths: intakeMonths(programme),
        officialIntake: intakeOfficialText(programme),
        officialIntakeNote: intakeNote(programme),
        languageRequirement: language,
        officialLanguageRequirement: officialLanguageRequirement(programme),
        requirement: {
          gpa: numericRequirement(programme.entryRequirement.minGPA),
          gaokaoRequired: false,
          huikaoRequired: false,
          note: t(
            academicRequirementNote(programme, level),
            academicRequirementNote(programme, level),
            academicRequirementNote(programme, level),
            academicRequirementNote(programme, level)
          )
        },
        officialAcademicRequirement: officialAcademicRequirement(programme),
        chinaStudentRequirement: "LUC official sources checked in this audit do not publish a China-specific route; keep this row Display-Only and confirm with LUC before any application use.",
        specialRequirementsNote: specialRequirementsNote(programme, level),
        applicationDocs: arr(safeStringArray(programme.applicationDocs)),
        curriculum: arr(curriculum),
        careers: arr(careers),
        specializations: arr([]),
        description: descriptionText(programme, level, reviewReason),
        officialAccreditationNote: "No programme-level accreditation claim is adopted from this Display-Only review import.",
        officialSourceUrl: programme.officialSourceUrl,
        officialEntryRequirementSourceUrl: fieldStatusSource(programme, "entryRequirement") ||
          fieldStatusSource(programme, "entryRequirements") ||
          programme.officialSourceUrl,
        officialAccreditationSourceUrl: programme.officialSourceUrl,
        sourceUrls: sourceLinks(programme, level),
        officialVerifiedAt: dateOnly(programme.officialVerifiedAt) || verifiedAt,
        officialSourceStatus: sourceStatus,
        publicDisplayStatus,
        publicDisplayNote: "Display-Only review import. Hidden from application selectors, member-center readiness, recommendations, budget matching and public ready catalogues.",
        reviewReason,
        auditNote: [
          `Original LUC ${level} audit row ${ordinal}.`,
          `Validation result: ${programme._validationResult || "not-recorded"}.`,
          `Pending issues: ${safeStringArray(programme._pendingIssues).join(", ") || "not-recorded"}.`,
          `Strict fee gate: FAIL; audit status: ${programme.auditStatus}.`,
          `Application ops: ${programme._applicationOpsStatus || "not-recorded"}.`,
          `Member center sync: ${programme._memberCenterSyncStatus || "not-recorded"}.`,
          `Curriculum rows: ${curriculum.length}; career rows: ${careers.length}; direct IELTS: ${language.ielts > 0 ? language.ielts : "not published"}.`,
          "Display-Only policy: this row is non-public and must not appear in application, recommendation, member center, budget matching or public ready flows."
        ].join(" "),
        listTuitionText: officialTuitionPendingDisplay,
        isPublished: false
      };
    })
  );
}

export function summarizeLucPostgraduateReviewImport(rows: Array<DeepPartial<ProgramEntity>>): LucPostgraduateImportSummary {
  return {
    candidateRows: rows.length,
    importRows: rows.length,
    byLevel: {
      master: rows.filter((row) => row.level === "master").length,
      phd: rows.filter((row) => row.level === "phd").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    missingFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "not-published" && row.officialTuitionMYR == null).length,
    directIeltsRows: rows.filter((row) => Number(row.languageRequirement?.ielts || 0) > 0).length,
    noDirectIeltsRows: rows.filter((row) => Number(row.languageRequirement?.ielts || 0) === 0).length,
    durationReviewRows: rows.filter((row) => Number(row.durationYears || 0) <= 0).length,
    curriculumRows: rows.filter((row) => safeStringArray(row.curriculum?.["zh-CN"]).length > 0).length,
    emptyCurriculumRows: rows.filter((row) => safeStringArray(row.curriculum?.["zh-CN"]).length === 0).length,
    careerRows: rows.filter((row) => safeStringArray(row.careers?.["zh-CN"]).length > 0).length,
    emptyCareerRows: rows.filter((row) => safeStringArray(row.careers?.["zh-CN"]).length === 0).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildLucUniversityRow(
  bundle: LucAuditBundle[],
  summary: LucPostgraduateImportSummary,
  existing?: UniversityEntity | null
): DeepPartial<UniversityEntity> {
  const existingPublicReady = Boolean(existing?.isPublished && existing.publicDisplayStatus === "ready");
  const reviewProfile = {
    collectionScope: "LUC master and doctoral Display-Only review import",
    applicantScope: "international",
    academicSession: "2026",
    retrievedAt: verifiedAt,
    officialDomains: ["lincoln.edu.my"],
    sourceUniversityCode: "LUC",
    authorization: "display-only-review-import",
    importNamespace: LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX,
    sourceAudits: bundle.map((item) => ({
      level: item.level,
      path: item.path,
      safeToImport: item.audit.safe_to_import,
      recommendedForImport: item.audit.validation_result?.recommended_for_import,
      strictFeeGateDecision: item.audit.validationMeta?.strictFeeGateStats?.decision,
      pendingIssues: item.audit.pending_issues?.length || 0,
      exceptionQueue: item.audit.exception_queue?.length || 0
    })),
    workflowAcceptance: {
      declaredOfficialRows: expectedProgrammes.master + expectedProgrammes.doctoral,
      candidateProgrammes: summary.importRows,
      importedReviewRows: summary.needsReviewRows,
      publicReadyRows: 0,
      applicationReadyRows: 0,
      memberCenterReadyRows: 0,
      strictFeeGateDecision: "FAIL",
      officialPublishedFeeRows: 0,
      curriculumRows: summary.curriculumRows,
      emptyCurriculumRows: summary.emptyCurriculumRows,
      publicLeakageExpected: 0
    },
    catalogStatusSummary: {
      all: { total: summary.importRows, ready: 0, needsReview: summary.needsReviewRows, notAvailableForInternational: 0 },
      byLevel: {
        master: { total: summary.byLevel.master, ready: 0, needsReview: summary.byLevel.master, notAvailableForInternational: 0 },
        phd: { total: summary.byLevel.phd, ready: 0, needsReview: summary.byLevel.phd, notAvailableForInternational: 0 }
      }
    },
    reviewOnlyControls: {
      importedRowsPublicDisplayStatus: "needs-review",
      importedRowsIsPublished: false,
      sourceAuditSafeToImport: false,
      sourceAuditRecommendedForImport: false,
      applicationSelectable: false,
      memberCenterReady: false,
      budgetMatchEligible: false
    }
  };

  return {
    slug: existing?.slug || "lincoln-university-college",
    code: existing?.code || "LUC",
    name: existing?.name || t("Lincoln University College", "Lincoln University College", "林肯大学学院", "林肯大學學院"),
    shortName: existing?.shortName || "LUC",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#004E7C",
    qsRank: existing?.qsRank || QS_UNRANKED_RANK,
    qsAsiaRank: existing?.qsAsiaRank ?? null,
    location: existing?.location || t("Petaling Jaya, Selangor, Malaysia", "Petaling Jaya, Selangor, Malaysia", "马来西亚雪兰莪州八打灵再也", "馬來西亞雪蘭莪州八打靈再也"),
    region: existing?.region || t("Selangor", "Selangor", "雪兰莪州", "雪蘭莪州"),
    ownership: existing?.ownership || "private",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 2002,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: existing?.description || t(
      "Lincoln University College postgraduate programmes are imported for StudyMY Display-Only review. Application readiness is disabled until Ian approves a separate ready conversion.",
      "Lincoln University College postgraduate programmes are imported for StudyMY Display-Only review. Application readiness is disabled until Ian approves a separate ready conversion.",
      "林肯大学学院硕博专业已作为 StudyMY Display-Only 审核候选入库；Ian 单独批准 ready 转换前，不进入申请流程。",
      "林肯大學學院碩博專業已作為 StudyMY Display-Only 審核候選入庫；Ian 單獨批准 ready 轉換前，不進入申請流程。"
    ),
    website: existing?.website || officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: existing?.nameEnOfficial || "Lincoln University College",
    officialWebsite: existing?.officialWebsite || officialWebsite,
    studyPortalUrl: existing?.studyPortalUrl || masterCatalogueUrl,
    internationalPageUrl: existing?.internationalPageUrl || doctoralCatalogueUrl,
    applicationPortalUrl: existing?.applicationPortalUrl || applicationPortalUrl,
    officialAddress: existing?.officialAddress || "",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: existing?.applicationDocuments || arr(firstApplicationDocs(bundle)),
    chinaStudentRequirements: existing?.chinaStudentRequirements || arr([]),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      lucPostgraduateReviewImport: reviewProfile
    },
    officialSources: mergeOfficialSources(existing?.officialSources || [], bundle.flatMap((item) => sourceRegistryLinks(item.audit, item.level))),
    officialVerifiedAt: existing?.officialVerifiedAt || verifiedAt,
    officialSourceStatus: existing?.officialSourceStatus || "needs-review",
    officialAuditSummary: [
      existing?.officialAuditSummary || "",
      "LUC Display-Only postgraduate review import: 61 master and 35 doctoral candidates imported as non-public needs-review rows. All 96 rows keep tuition blank/pending because strict fee gate is FAIL, and all rows are blocked from application and member-center readiness."
    ].filter(Boolean).join(" "),
    publicDisplayStatus: existing?.publicDisplayStatus || "needs-review",
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: existing?.tuitionMinCny || 0,
    tuitionMaxCny: existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 0,
    minIelts: existing?.minIelts || 0,
    acceptNoLanguage: existing?.acceptNoLanguage || false,
    facilities: existing?.facilities || arr([]),
    highlights: existing?.highlights || arr(["Display-Only postgraduate review"], ["Display-Only postgraduate review"], ["硕博仅限展示审核"], ["碩博僅限展示審核"]),
    programCount: existingPublicReady ? existing?.programCount || 0 : summary.importRows,
    isPublished: existing?.isPublished || false
  };
}

function verifyLucPostgraduateImportedRecordSet(
  university: UniversityEntity,
  rows: ProgramEntity[],
  expectedSlugs: Set<string>
): LucPostgraduateImportVerification {
  const summary = summarizeLucPostgraduateReviewImport(rows);
  const importedPublicLeakageRows = rows.filter((row) => row.isPublished || row.publicDisplayStatus === "ready").length;
  const importedAdminNeedsReviewRows = rows.filter((row) => row.publicDisplayStatus === "needs-review" && row.isPublished === false).length;
  const applicationSelectableRows = rows.filter((row) => row.isPublished && row.publicDisplayStatus === "ready").length;
  const memberCenterReadyRows = rows.filter((row) => row.isPublished && row.publicDisplayStatus === "ready").length;
  const stalePostgraduateReviewRows = rows.filter((row) => !expectedSlugs.has(row.slug)).length;

  if (
    rows.length !== expectedProgrammes.master + expectedProgrammes.doctoral ||
    summary.byLevel.master !== expectedProgrammes.master ||
    summary.byLevel.phd !== expectedProgrammes.doctoral ||
    summary.readyRows !== 0 ||
    summary.needsReviewRows !== expectedProgrammes.master + expectedProgrammes.doctoral ||
    summary.publishedRows !== 0 ||
    summary.missingFeeRows !== expectedProgrammes.master + expectedProgrammes.doctoral ||
    summary.directIeltsRows !== 79 ||
    summary.noDirectIeltsRows !== 17 ||
    summary.durationReviewRows !== 51 ||
    summary.curriculumRows !== expectedProgrammes.master + expectedProgrammes.doctoral ||
    summary.emptyCurriculumRows !== 0 ||
    summary.careerRows !== expectedProgrammes.master + expectedProgrammes.doctoral ||
    summary.emptyCareerRows !== 0 ||
    importedPublicLeakageRows !== 0 ||
    importedAdminNeedsReviewRows !== expectedProgrammes.master + expectedProgrammes.doctoral ||
    applicationSelectableRows !== 0 ||
    memberCenterReadyRows !== 0 ||
    stalePostgraduateReviewRows !== 0
  ) {
    throw new Error(`LUC postgraduate review import verification failed: ${JSON.stringify({ summary, importedPublicLeakageRows, importedAdminNeedsReviewRows, applicationSelectableRows, memberCenterReadyRows, stalePostgraduateReviewRows, universityStatus: university.publicDisplayStatus, universityPublished: university.isPublished })}`);
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    importedPublicLeakageRows,
    importedAdminNeedsReviewRows,
    applicationSelectableRows,
    memberCenterReadyRows,
    stalePostgraduateReviewRows
  };
}

async function verifyImportedRows(
  manager: EntityManager | DataSource,
  universityId: number,
  expectedSlugs: Set<string>
): Promise<LucPostgraduateImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("LUC university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX}%`) }
  });
  return verifyLucPostgraduateImportedRecordSet(university, rows, expectedSlugs);
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

async function publicVisibilitySnapshot(manager: EntityManager | DataSource, university: UniversityEntity | null | undefined): Promise<PublicVisibilitySnapshot> {
  if (!university) {
    return {
      universityExists: false,
      universityId: null,
      universityCode: null,
      universitySlug: null,
      universityIsPublished: false,
      universityPublicDisplayStatus: null,
      publicUniversityVisible: false,
      publicProgrammeRows: 0,
      reviewProgrammeRows: 0,
      importedPostgraduateReviewRows: 0
    };
  }
  const rows = await manager.getRepository(ProgramEntity).find({ where: { universityId: university.id } });
  return {
    universityExists: true,
    universityId: university.id,
    universityCode: university.code,
    universitySlug: university.slug,
    universityIsPublished: university.isPublished,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    publicUniversityVisible: university.isPublished && university.publicDisplayStatus === "ready",
    publicProgrammeRows: rows.filter((row) => row.isPublished && ["ready", "current-cycle-not-open", "not-available-for-international"].includes(row.publicDisplayStatus)).length,
    reviewProgrammeRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    importedPostgraduateReviewRows: rows.filter((row) => row.slug.startsWith(LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX)).length
  };
}

async function findLucUniversity(manager: EntityManager | DataSource) {
  const repo = manager.getRepository(UniversityEntity);
  return (
    (await repo.findOne({ where: { code: "LUC" } })) ||
    (await repo.findOne({ where: { slug: "lincoln-university-college" } })) ||
    (await repo.findOne({ where: { slug: "lincoln-university-college-malaysia" } })) ||
    (await repo.findOne({ where: { slug: "lincoln-university" } }))
  );
}

function toDbLevel(level: LucAuditLevel): LucDbLevel {
  return level === "doctoral" ? "phd" : "master";
}

function languageRequirement(programme: LucAuditProgramme): LanguageRequirement {
  return {
    ielts: Number(programme.language?.ielts || 0),
    toefl: optionalNumber(programme.language?.toefl),
    pte: optionalNumber(programme.language?.pte),
    muet: optionalNumber(programme.language?.muet)
  };
}

function officialLanguageRequirement(programme: LucAuditProgramme) {
  const parts = [
    programme.language?.ielts ? `IELTS ${programme.language.ielts}` : "Direct IELTS value was not published in the official LUC evidence captured for this row.",
    programme.language?.toefl ? `TOEFL ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET ${programme.language.muet}` : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver || ""
  ].filter(Boolean);
  return normalizeLongText(parts.join("; "));
}

function localizedFaculty(faculty: string, facultyZh?: string | null): LocalizedText {
  const zhCN = facultyZh || faculty;
  return t(faculty, faculty, zhCN, zhCN);
}

function studyModeDisplay(programme: LucAuditProgramme, level: LucAuditLevel) {
  if (programme.studyMode) return normalizeText(programme.studyMode, 80);
  if (programme.thesisRequired || level === "doctoral") return "research";
  if (/\bODL\b/i.test(programme.nameEn) || /ODL|开放与远程学习/.test(programme.studyModeNote || "")) return "ODL";
  return "coursework";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|management|finance|account|entrepreneurship|tourism|hospitality|airline|airport|oil and gas/.test(value)) return "business";
  if (/computer|information technology|cyber|network|cloud|data analytics|e-commerce|multimedia|digital film|ai computing|artificial intelligence/.test(value)) return "it";
  if (/engineering|mechatronics|mechanical|electrical|electronics|civil|aeronautics|built environment/.test(value)) return "engineering";
  if (/medicine|medical|health|nursing|biomedical|physiotherapy|pharmacy|pharmaceutical|ayurvedic|homeopathic|dental|cardiopulmonary|perfusion|cosmetic/.test(value)) return "medicine";
  if (/law|legal/.test(value)) return "law";
  if (/science|nutrition|biotechnology|agriculture|sports|fitness|agricultural|biotechnology/.test(value)) return "science";
  return "arts";
}

function intakeMonths(programme: LucAuditProgramme) {
  return safeNumberArray(programme.intake).map((month) => monthName(month)).filter(Boolean);
}

function intakeOfficialText(programme: LucAuditProgramme) {
  const months = intakeMonths(programme);
  return months.length ? months.join(", ") : "Official intake pending confirmation.";
}

function intakeNote(programme: LucAuditProgramme) {
  const status = asRecord(programme.fieldStatus?.intake);
  const note = typeof status.note === "string" ? status.note : "";
  return normalizeLongText(note || "LUC audit captured official intake evidence where scalar months were available; missing rows remain Display-Only.");
}

function tuitionNote(programme: LucAuditProgramme) {
  return normalizeLongText(programme.tuitionNote || "Current official LUC programme page did not publish an adoptable international full-course MYR tuition amount.");
}

function academicRequirementNote(programme: LucAuditProgramme, level: LucAuditLevel) {
  return normalizeLongText(
    programme.entryRequirement.gpaNote ||
      programme.entryRequirement.degreeLevel ||
      `Official ${level} entry requirements require manual review before application readiness.`
  );
}

function officialAcademicRequirement(programme: LucAuditProgramme) {
  return normalizeLongText([
    programme.entryRequirement.degreeLevel ? `Degree level: ${programme.entryRequirement.degreeLevel}.` : "",
    programme.entryRequirement.degreeRelevance ? `Relevance: ${programme.entryRequirement.degreeRelevance}.` : "",
    programme.entryRequirement.workExperience ? `Work experience: ${programme.entryRequirement.workExperience}.` : "",
    programme.entryRequirement.gpaNote || ""
  ].filter(Boolean).join(" "));
}

function specialRequirementsNote(programme: LucAuditProgramme, level: LucAuditLevel) {
  return normalizeLongText([
    programme.studyModeNote ? `Study mode note: ${programme.studyModeNote}.` : "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.thesisNote || "",
    programme.supervisorSystem ? "Supervisor system is indicated and must be manually confirmed before application readiness." : "",
    `Imported for ${level} Display-Only frontend review. Do not publish into application flow until Ian approves conversion.`
  ].filter(Boolean).join(" "));
}

function descriptionText(programme: LucAuditProgramme, level: LucAuditLevel, reviewReason: string): LocalizedText {
  const zhCN = `${programme.name} 是 Lincoln University College ${level === "master" ? "硕士" : "博士"}层级的 Display-Only 审核候选专业。当前仅供前端审核缺口，不进入正式申请、会员中心 ready、预算匹配或费用承诺。`;
  return t(
    `${programme.nameEn} is a Lincoln University College ${level} Display-Only review candidate. ${reviewReason}`,
    `${programme.nameEn} is a Lincoln University College ${level} Display-Only review candidate. ${reviewReason}`,
    zhCN,
    zhCN
  );
}

function reviewReasonText(programme: LucAuditProgramme, level: LucAuditLevel) {
  const issues = safeStringArray(programme._pendingIssues);
  const reasons = [
    programme.remarks || `LUC ${level} row remains needs-review under validator output.`,
    "Strict fee gate failed because LUC official sources did not publish a current programme-page international full-course MYR tuition amount.",
    programme.duration == null ? "Official duration requires manual confirmation." : "",
    programme.language.ielts == null ? "No direct official IELTS scalar was captured; IELTS remains unpublished for this row." : "",
    issues.length ? `Pending issues: ${issues.join(", ")}.` : "",
    "Display-Only import for Ian frontend review; row is non-public and non-application-selectable."
  ].filter(Boolean);
  return normalizeLongText(reasons.join(" "));
}

function sourceLinks(programme: LucAuditProgramme, level: LucAuditLevel): OfficialSourceLink[] {
  const urls = new Set<string>([
    programme.officialSourceUrl,
    fieldStatusSource(programme, "entryRequirement"),
    fieldStatusSource(programme, "entryRequirements"),
    fieldStatusSource(programme, "tuitionMYR"),
    fieldStatusSource(programme, "officialFeeSourceUrl"),
    applicationDocsUrl,
    level === "master" ? masterCatalogueUrl : doctoralCatalogueUrl,
    ...supportingOfficialTuitionSources(programme)
  ].filter((url): url is string => Boolean(url)));
  return [...urls].map((url) => ({
    title: sourceLinkTitle(url, programme, level),
    url,
    sourceType: sourceLinkType(url),
    verifiedAt,
    status: "needs-review",
    note: sourceLinkNote(url, programme)
  }));
}

function sourceRegistryLinks(audit: LucPostgraduateAudit, level: LucAuditLevel): OfficialSourceLink[] {
  return collectUrls(audit.sourceRegistry)
    .filter((url) => /lincoln\.edu\.my/i.test(url))
    .map((url) => ({
      title: sourceLinkTitle(url, undefined, level),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "needs-review",
      note: `Official LUC ${level} source retained for Display-Only review import.`
    }));
}

function supportingOfficialTuitionSources(programme: LucAuditProgramme) {
  const tuition = asRecord(programme.fieldEvidence?.tuition);
  const supporting = Array.isArray(tuition.supportingOfficialSources) ? tuition.supportingOfficialSources : [];
  return supporting
    .map((item) => asRecord(item).sourceUrl)
    .filter((url): url is string => typeof url === "string" && /lincoln\.edu\.my/i.test(url));
}

function sourceLinkTitle(url: string, programme?: LucAuditProgramme, level?: LucAuditLevel) {
  if (programme && url === programme.officialSourceUrl) return "Official programme page";
  if (url === applicationDocsUrl) return "Official foreign-student document FAQ";
  if (url === masterCatalogueUrl) return "Official master catalogue";
  if (url === doctoralCatalogueUrl) return "Official doctoral catalogue";
  if (url === applicationPortalUrl) return "Official application portal";
  if (/wp-json/i.test(url)) return "Official WordPress API source";
  if (/wp-sitemap/i.test(url)) return "Official sitemap";
  if (/\.pdf(?:$|\?)/i.test(url)) return "Official PDF source";
  if (/online\.lincoln\.edu\.my/i.test(url)) return "Official application portal";
  return level ? `Official LUC ${level} source` : "Official LUC source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  if (/apply|application|crm\.lincoln/i.test(url)) return "admission";
  if (/fee|tuition/i.test(url)) return "fee";
  if (/entry|requirement/i.test(url)) return "entry-requirement";
  if (/category\/master|category\/phd|wp-json|sitemap|brochure|\.pdf/i.test(url)) return "profile";
  if (/lincoln\.edu\.my\/?$/i.test(url)) return "official-website";
  return "other";
}

function sourceLinkNote(url: string, programme: LucAuditProgramme) {
  if (url === programme.officialSourceUrl) return "Primary LUC programme page; row remains needs-review because strict fee and readiness gates did not pass.";
  if (url === applicationDocsUrl) return "Official LUC CRM FAQ used for foreign-student application document list.";
  if (/\.pdf(?:$|\?)/i.test(url)) return "Official LUC PDF evidence retained as supporting source; not adopted as a fee source.";
  return "Official LUC source retained for Display-Only review import.";
}

function fieldStatusSource(programme: LucAuditProgramme, key: string) {
  const status = programme.fieldStatus?.[key];
  return status?.sourceUrl || null;
}

function firstApplicationDocs(bundle: LucAuditBundle[]) {
  return safeStringArray(bundle.flatMap((item) => item.audit.programmes).find((programme) => programme.applicationDocs.length > 0)?.applicationDocs);
}

function monthName(value: number) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  return months[value - 1] || "";
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function safeNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 1 && item <= 12)
    : [];
}

function numericRequirement(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 4 ? parsed : 0;
}

function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, "");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function dateOnly(value?: string | null) {
  return value?.slice(0, 10) || null;
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function collectUrls(value: unknown): string[] {
  if (typeof value === "string") return /^https?:\/\//i.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(collectUrls);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectUrls);
  return [];
}

function mergeOfficialSources(existing: OfficialSourceLink[], incoming: OfficialSourceLink[]) {
  const byUrl = new Map<string, OfficialSourceLink>();
  for (const source of [...existing, ...incoming]) {
    if (source.url) byUrl.set(source.url, source);
  }
  return [...byUrl.values()];
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const masterPath = resolve(readArgValue("--audit-master") || DEFAULT_LUC_MASTER_AUDIT_PATH);
  const doctoralPath = resolve(readArgValue("--audit-doctoral") || DEFAULT_LUC_DOCTORAL_AUDIT_PATH);
  for (const auditPath of [masterPath, doctoralPath]) {
    if (!existsSync(auditPath)) throw new Error(`LUC audit JSON not found: ${auditPath}`);
  }

  const bundle = loadLucPostgraduateAuditBundle(masterPath, doctoralPath);
  const errors = validateLucPostgraduateAuditBundle(bundle);
  if (errors.length) throw new Error(`LUC postgraduate audit validation failed:\n${errors.join("\n")}`);

  const rows = buildLucPostgraduateReviewRows(bundle);
  const expectedSlugs = new Set(rows.map((row) => String(row.slug)));
  const summary = summarizeLucPostgraduateReviewImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import") || process.argv.includes("--confirm-review-import");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/luc-postgraduate-review-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportOutput = readArgValue("--report-output");

  if (!verifyOnly && !confirm) {
    const report = {
      mode: "dry-run",
      decision: "ready-for-display-only-review-import",
      universityCode: "LUC",
      auditPaths: { master: masterPath, doctoral: doctoralPath },
      writePolicy: {
        authorization: "display-only-review-import",
        requestedMode: "review-import",
        upsertPrefix: LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX,
        importRows: expectedProgrammes.master + expectedProgrammes.doctoral,
        university: {
          existingPublicInstitutionPolicy: "Preserve existing LUC public university fields; append review metadata only.",
          newInstitutionDefault: { isPublished: false, publicDisplayStatus: "needs-review" }
        },
        programmes: {
          isPublished: false,
          publicDisplayStatus: "needs-review",
          officialSourceStatus: "needs-review",
          officialFeeAuditStatus: "not-published",
          tuitionDisplay: officialTuitionPendingDisplay,
          applicationSelectable: false,
          memberCenterReady: false
        },
        archivePolicy: "Only remove stale rows inside the LUC postgraduate review namespace; do not archive or modify previous LUC namespaces.",
        backupRequired: true,
        transactionRequired: true,
        rollbackTarget: backupPath,
        publicLeakageExpected: 0,
        nextStep: "Review this dry-run, then rerun with --confirm-review-import to create a scoped backup and write transactionally."
      },
      summary
    };
    if (reportOutput) {
      mkdirSync(dirname(resolve(reportOutput)), { recursive: true });
      writeFileSync(resolve(reportOutput), JSON.stringify(report, null, 2), "utf8");
    }
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university = await findLucUniversity(dataSource);

    if (verifyOnly) {
      if (!university) throw new Error("LUC university row not found.");
      const report = {
        mode: "verified",
        decision: "display-only-review-imported",
        universityId: university.id,
        databaseUniversityCode: university.code,
        summary,
        verification: await verifyImportedRows(dataSource, university.id, expectedSlugs),
        publicVisibility: await publicVisibilitySnapshot(dataSource, university)
      };
      if (reportOutput) {
        mkdirSync(dirname(resolve(reportOutput)), { recursive: true });
        writeFileSync(resolve(reportOutput), JSON.stringify(report, null, 2), "utf8");
      }
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const beforePublicVisibility = await publicVisibilitySnapshot(dataSource, university);
    const currentPostgraduateRows = university
      ? await programRepo.find({ where: { universityId: university.id, slug: Like(`${LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX}%`) } })
      : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          targetUniversity: university,
          targetPostgraduateReviewRows: currentPostgraduateRows,
          publicVisibility: beforePublicVisibility
        },
        null,
        2
      ),
      "utf8"
    );

    let verification: LucPostgraduateImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await findLucUniversity(manager);
      const universitySeed = buildLucUniversityRow(bundle, summary, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const previousPostgraduateReviewRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX}%`) }
      });
      for (const previous of previousPostgraduateReviewRows) {
        if (!expectedSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id && !existing.slug.startsWith(LUC_POSTGRADUATE_REVIEW_SLUG_PREFIX)) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      verification = await verifyImportedRows(manager, university.id, expectedSlugs);
    });

    const refreshedUniversity = await universityRepo.findOne({ where: { id: university?.id } });
    const afterPublicVisibility = await publicVisibilitySnapshot(dataSource, refreshedUniversity);
    const catalogCacheCleared = await clearCatalogCache();
    const report = {
      mode: "imported",
      decision: "display-only-review-imported",
      universityId: university?.id,
      backupPath,
      rollbackTarget: backupPath,
      transaction: "completed",
      catalogCacheCleared,
      beforePublicVisibility,
      afterPublicVisibility,
      publicContinuityPreserved:
        beforePublicVisibility.publicUniversityVisible === afterPublicVisibility.publicUniversityVisible &&
        beforePublicVisibility.publicProgrammeRows === afterPublicVisibility.publicProgrammeRows,
      summary,
      verification
    };
    if (reportOutput) {
      mkdirSync(dirname(resolve(reportOutput)), { recursive: true });
      writeFileSync(resolve(reportOutput), JSON.stringify(report, null, 2), "utf8");
    }
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
