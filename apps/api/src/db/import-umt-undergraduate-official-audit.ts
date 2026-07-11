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

export const UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX = "umt-undergraduate-20260706-row-";
export const DEFAULT_UMT_UNDERGRADUATE_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/UMT_audit_undergraduate_20260706_verified_20260706.json"
);

const verifiedAt = "2026-07-06";
const expectedProgrammes = 38;
const officialWebsite = "https://www.umt.edu.my/";
const catalogueUrl = "https://www.umt.edu.my/all-programs-at-umt/";
const internationalUndergraduateUrl = "https://www.umt.edu.my/international-student-undergraduate/";
const officialFeePdfUrl = "https://akademik.umt.edu.my/wp-content/uploads/2025/02/2-PPPA-UG-LIST-PROGRAMMES-AND-FEES-FOR-INTERNATIONAL-STUDENTS.pdf";
const languageGuideUrl = "https://akademik.umt.edu.my/wp-content/uploads/2025/02/3-PPPA-APPLICATION-GUIDELINES.pdf";
const applicationFormUrl = "https://akademik.umt.edu.my/wp-content/uploads/2025/07/1-PPPA.-LATEST-2025-UNDERGRADUATE-APPLICATION-FORM-INTERNATIONAL-STUDENT.pdf";
const officialTuitionPendingDisplay = "待官方确认";

interface UmtLanguage {
  ielts: number | null;
  toefl?: number | null;
  pte?: number | null;
  muet?: number | null;
  otherRequirement?: string | null;
  waiver?: string | null;
}

interface UmtEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface FieldStatusItem {
  status?: string;
  note?: string;
  sourceUrl?: string;
  crawlLevel?: string;
}

interface UmtAuditProgramme {
  code?: string | null;
  nameEn: string;
  name: string;
  officialMalayName?: string | null;
  faculty: string;
  facultyZh: string | null;
  level: "undergraduate";
  duration: number | null;
  durationNote: string | null;
  tuitionMYR: number | null;
  tuitionNote: string | null;
  intake: number[];
  applicationDeadline: string | null;
  language: UmtLanguage;
  curriculum: string[];
  curriculumNote: string | null;
  careerProspects: string[];
  applicationDocs: string[];
  officialFeeSourceUrl: string | null;
  officialSourceUrl: string;
  officialVerifiedAt: string;
  entryRequirement: UmtEntryRequirement;
  studyMode: string | null;
  studyModeNote: string | null;
  thesisRequired: boolean | null;
  thesisNote: string | null;
  interviewRequired: string | boolean | null;
  interviewNote: string | null;
  supervisorSystem: boolean | null;
  creditHours: number | null;
  fieldStatus?: Record<string, FieldStatusItem>;
  fieldEvidence?: Record<string, unknown>;
  publicDisplayStatus: PublicDisplayStatus;
  auditStatus: string;
  remarks?: string | null;
}

interface UmtUndergraduateAudit {
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
    targetShortName?: string;
    targetLevel?: string;
    officialDomain?: string;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
    exceptionCount?: number;
    validatedAt?: string;
  };
  sourceRegistry?: Record<string, unknown>;
  programme_baseline?: Record<string, unknown>;
  validation_result?: {
    recommended_for_import?: boolean;
    blocking_issues?: unknown[];
    accepted_gaps?: unknown[];
    requires_ian_decision?: unknown[];
  };
  validationMeta?: {
    overallDecision?: string;
    strictFeeGateStats?: {
      totalProgrammesChecked?: number;
      programmePageDirectAmountRows?: number;
      programmePageDirectAmountMissRows?: number;
      supportingSourceOnlyRows?: number;
      officialDomainRows?: number;
      openHighFeeConflictRows?: number;
      rowsMissingTuitionAcademicYear?: number;
      decision?: string;
    };
    applicationOpsGateStats?: {
      applicationSelectableRows?: number;
      applicationReadyRows?: number;
      notApplicationSelectableRows?: number;
      programmeSpecificApplicationDocsRows?: number;
      universityGeneralApplicationDocsRows?: number;
      chinaRouteUnverifiedRows?: number;
      decision?: string;
    };
    memberCenterSyncGateStats?: {
      memberCenterReadyRows?: number;
      memberCenterBlockedRows?: number;
      budgetComparableRows?: number;
      dbMappingVerifiedRows?: number;
      decision?: string;
    };
  };
  pending_issues?: Array<{ issue_id?: string; issue_type?: string; resolution_note?: string; status?: string }>;
  exception_queue?: unknown[];
  programmes: UmtAuditProgramme[];
}

export interface UmtUndergraduateImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<"bachelor", number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  missingFeeRows: number;
  sourceConflictFeeRows: number;
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

export interface UmtUndergraduateImportVerification extends UmtUndergraduateImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  importedPublicLeakageRows: number;
  importedAdminNeedsReviewRows: number;
  applicationSelectableRows: number;
  memberCenterReadyRows: number;
  staleUndergraduateReviewRows: number;
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
  importedUndergraduateReviewRows: number;
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

export function loadUmtUndergraduateAudit(path = DEFAULT_UMT_UNDERGRADUATE_AUDIT_PATH): UmtUndergraduateAudit {
  return loadJson<UmtUndergraduateAudit>(path);
}

export function validateUmtUndergraduateAudit(audit: UmtUndergraduateAudit, path = DEFAULT_UMT_UNDERGRADUATE_AUDIT_PATH): string[] {
  const errors: string[] = [];
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
  const targetShortName = audit.auditMeta?.targetUniversityShortName || audit.auditMeta?.targetShortName;
  if (targetShortName !== "UMT") errors.push(`${path}: target short name must be UMT.`);
  if (audit.auditMeta?.targetLevel !== "undergraduate") errors.push(`${path}: targetLevel must be undergraduate.`);
  if (audit.auditMeta?.officialDomain !== "umt.edu.my") errors.push(`${path}: officialDomain must be umt.edu.my.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedProgrammes) {
    errors.push(`${path}: UMT undergraduate audit must contain ${expectedProgrammes} programmes.`);
  }
  if (audit.validationMeta?.overallDecision !== "FAIL") errors.push(`${path}: validation overall decision must remain FAIL.`);
  if (audit.validationMeta?.strictFeeGateStats?.decision !== "FAIL") {
    errors.push(`${path}: strict fee gate must remain FAIL for review-only import.`);
  }
  if (audit.validationMeta?.applicationOpsGateStats?.applicationReadyRows !== 0) {
    errors.push(`${path}: applicationReadyRows must remain 0.`);
  }
  if (audit.validationMeta?.applicationOpsGateStats?.applicationSelectableRows !== 0) {
    errors.push(`${path}: applicationSelectableRows must remain 0.`);
  }
  if (audit.validationMeta?.memberCenterSyncGateStats?.memberCenterReadyRows !== 0) {
    errors.push(`${path}: memberCenterReadyRows must remain 0.`);
  }

  audit.programmes.forEach((programme, index) => {
    const ordinal = index + 1;
    if (!programme.nameEn) errors.push(`${path}: row ${ordinal} has no official English name.`);
    if (programme.level !== "undergraduate") errors.push(`${path}: row ${ordinal} source level must be undergraduate.`);
    if (!programme.officialSourceUrl?.includes("umt.edu.my")) errors.push(`${path}: row ${ordinal} has no UMT official source URL.`);
    if (programme.publicDisplayStatus !== "needs-review") errors.push(`${path}: row ${ordinal} must remain needs-review.`);
    if (programme.tuitionMYR !== null) errors.push(`${path}: row ${ordinal} tuitionMYR must remain null.`);
    if (asRecord(programme.fieldEvidence?.tuition).strictFeeGate !== "FAIL") {
      errors.push(`${path}: row ${ordinal} strict fee gate must remain FAIL.`);
    }
    if (Number(programme.language?.ielts || 0) <= 0) errors.push(`${path}: row ${ordinal} must retain direct IELTS evidence.`);
  });

  return errors;
}

export function buildUmtUndergraduateReviewRows(audit: UmtUndergraduateAudit): Array<DeepPartial<ProgramEntity>> {
  return audit.programmes.map((programme, index) => {
    const ordinal = index + 1;
    const sourceStatus: OfficialSourceStatus = "needs-review";
    const publicDisplayStatus: PublicDisplayStatus = "needs-review";
    const feeStatus: FeeAuditStatus = "source-conflict";
    const language = languageRequirement(programme);
    const durationYears = Number(programme.duration ?? 0);
    const curriculum = safeStringArray(programme.curriculum);
    const careers = safeStringArray(programme.careerProspects);
    const reviewReason = reviewReasonText(programme, audit, ordinal);

    return {
      slug: `${UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
      code: `UMT-UG-${String(ordinal).padStart(3, "0")}`,
      name: t(programme.nameEn, programme.officialMalayName || programme.nameEn, programme.name || programme.nameEn, programme.name || programme.nameEn),
      nameEnOfficial: programme.nameEn,
      level: "bachelor",
      category: inferCategory(programme.nameEn, programme.faculty),
      faculty: localizedFaculty(programme.faculty, programme.facultyZh),
      facultyZh: programme.facultyZh || programme.faculty,
      studyMode: studyModeDisplay(programme),
      campus: "Kuala Nerus, Terengganu, Malaysia",
      durationYears,
      durationOfficial: programme.durationNote || (durationYears > 0 ? `${formatNumber(durationYears)} years` : "Official duration pending confirmation."),
      annualTuitionCny: 0,
      tuitionAmount: null,
      tuitionCurrency: "MYR" satisfies TuitionCurrency,
      tuitionDisplay: officialTuitionPendingDisplay,
      officialTuitionMYR: null,
      officialTuitionNote: tuitionNote(programme),
      officialFeeSourceUrl: "",
      secondaryOfficialFeeSourceUrl: programme.officialFeeSourceUrl || officialFeePdfUrl,
      officialFeeAuditStatus: feeStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: [],
      officialIntake: "Official programme-specific intake months pending confirmation.",
      officialIntakeNote: intakeNote(programme),
      languageRequirement: language,
      officialLanguageRequirement: officialLanguageRequirement(programme),
      requirement: {
        gpa: numericRequirement(programme.entryRequirement.minGPA),
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          academicRequirementNote(programme),
          academicRequirementNote(programme),
          academicRequirementNote(programme),
          academicRequirementNote(programme)
        )
      },
      officialAcademicRequirement: officialAcademicRequirement(programme),
      chinaStudentRequirement: "UMT official sources checked in this audit do not publish a China-specific route; keep this row review-only and confirm with UMT before any application use.",
      specialRequirementsNote: specialRequirementsNote(programme),
      applicationDocs: arr(safeStringArray(programme.applicationDocs)),
      curriculum: arr(curriculum),
      careers: arr(careers),
      specializations: arr([]),
      description: descriptionText(programme, reviewReason),
      officialAccreditationNote: "No programme-level accreditation claim is adopted from this review-only import.",
      officialSourceUrl: programme.officialSourceUrl,
      officialEntryRequirementSourceUrl: fieldStatusSource(programme, "entryRequirement") || programme.officialSourceUrl,
      officialAccreditationSourceUrl: programme.officialSourceUrl,
      sourceUrls: sourceLinks(programme, audit),
      officialVerifiedAt: dateOnly(programme.officialVerifiedAt) || verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: "Review-only UMT undergraduate import. Hidden from application selectors, member-center readiness, recommendations, budget matching and ordinary public catalogues.",
      reviewReason,
      auditNote: [
        `Original UMT undergraduate verified audit row ${ordinal}.`,
        `Audit status: ${programme.auditStatus}.`,
        `Strict fee gate: FAIL; tuitionMYR remains null; USD supporting fee evidence is not converted to MYR.`,
        `Application ready rows in source audit: ${audit.validationMeta?.applicationOpsGateStats?.applicationReadyRows ?? "not-recorded"}.`,
        `Member-center ready rows in source audit: ${audit.validationMeta?.memberCenterSyncGateStats?.memberCenterReadyRows ?? "not-recorded"}.`,
        `Curriculum rows: ${curriculum.length}; career rows: ${careers.length}; direct IELTS: ${language.ielts > 0 ? language.ielts : "not published"}.`,
        "Review-only policy: this row is non-public and must not appear in application, recommendation, member-center, budget matching or public ready flows."
      ].join(" "),
      listTuitionText: officialTuitionPendingDisplay,
      isPublished: false
    };
  });
}

export function summarizeUmtUndergraduateReviewImport(rows: Array<DeepPartial<ProgramEntity>>): UmtUndergraduateImportSummary {
  return {
    candidateRows: rows.length,
    importRows: rows.length,
    byLevel: { bachelor: rows.filter((row) => row.level === "bachelor").length },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    missingFeeRows: rows.filter((row) => row.officialTuitionMYR == null).length,
    sourceConflictFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "source-conflict").length,
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

export function buildUmtUniversityRow(
  audit: UmtUndergraduateAudit,
  summary: UmtUndergraduateImportSummary,
  existing?: UniversityEntity | null
): DeepPartial<UniversityEntity> {
  const existingPublicReady = Boolean(existing?.isPublished && existing.publicDisplayStatus === "ready");
  const reviewProfile = {
    collectionScope: "UMT undergraduate review-only import",
    applicantScope: "international undergraduate",
    academicSession: "2026",
    retrievedAt: verifiedAt,
    officialDomains: ["umt.edu.my", "akademik.umt.edu.my"],
    sourceUniversityCode: "UMT",
    authorization: "review-only-frontend-audit-import",
    importNamespace: UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX,
    sourceAudit: {
      path: DEFAULT_UMT_UNDERGRADUATE_AUDIT_PATH,
      safeToImport: audit.safe_to_import,
      recommendedForImport: audit.validation_result?.recommended_for_import,
      overallDecision: audit.validationMeta?.overallDecision,
      strictFeeGateDecision: audit.validationMeta?.strictFeeGateStats?.decision,
      pendingIssues: audit.pending_issues?.length || 0,
      exceptionQueue: audit.exception_queue?.length || 0
    },
    workflowAcceptance: {
      declaredOfficialRows: expectedProgrammes,
      candidateProgrammes: summary.importRows,
      importedReviewRows: summary.needsReviewRows,
      publicReadyRows: 0,
      applicationReadyRows: audit.validationMeta?.applicationOpsGateStats?.applicationReadyRows || 0,
      memberCenterReadyRows: audit.validationMeta?.memberCenterSyncGateStats?.memberCenterReadyRows || 0,
      strictFeeGateDecision: "FAIL",
      officialPublishedMyrFeeRows: 0,
      sourceConflictFeeRows: summary.sourceConflictFeeRows,
      curriculumRows: summary.curriculumRows,
      emptyCurriculumRows: summary.emptyCurriculumRows,
      publicLeakageExpected: 0
    },
    catalogStatusSummary: {
      all: { total: summary.importRows, ready: 0, needsReview: summary.needsReviewRows, notAvailableForInternational: 0 },
      byLevel: {
        bachelor: { total: summary.byLevel.bachelor, ready: 0, needsReview: summary.byLevel.bachelor, notAvailableForInternational: 0 },
        master: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 },
        phd: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 }
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
    slug: existing?.slug || "universiti-malaysia-terengganu",
    code: existing?.code || "UMT",
    name: existing?.name || t("Universiti Malaysia Terengganu", "Universiti Malaysia Terengganu", "马来西亚登嘉楼大学", "馬來西亞登嘉樓大學"),
    shortName: existing?.shortName || "UMT",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#006B6F",
    qsRank: existing?.qsRank || QS_UNRANKED_RANK,
    qsAsiaRank: existing?.qsAsiaRank ?? null,
    location: existing?.location || t("Kuala Nerus, Terengganu, Malaysia", "Kuala Nerus, Terengganu, Malaysia", "马来西亚登嘉楼州瓜拉尼鲁斯", "馬來西亞登嘉樓州瓜拉尼魯斯"),
    region: existing?.region || t("Terengganu", "Terengganu", "登嘉楼州", "登嘉樓州"),
    ownership: existing?.ownership || "public",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 1979,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: existing?.description || t(
      "Universiti Malaysia Terengganu undergraduate programmes are imported for StudyMY review-only display. Application readiness is disabled until a separate approved conversion.",
      "Universiti Malaysia Terengganu undergraduate programmes are imported for StudyMY review-only display. Application readiness is disabled until a separate approved conversion.",
      "马来西亚登嘉楼大学本科专业已作为 StudyMY 审核候选入库；单独批准 ready 转换前，不进入申请流程。",
      "馬來西亞登嘉樓大學本科專業已作為 StudyMY 審核候選入庫；單獨批准 ready 轉換前，不進入申請流程。"
    ),
    website: existing?.website || officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: existing?.nameEnOfficial || "Universiti Malaysia Terengganu",
    officialWebsite: existing?.officialWebsite || officialWebsite,
    studyPortalUrl: existing?.studyPortalUrl || catalogueUrl,
    internationalPageUrl: existing?.internationalPageUrl || internationalUndergraduateUrl,
    applicationPortalUrl: existing?.applicationPortalUrl || internationalUndergraduateUrl,
    officialAddress: existing?.officialAddress || "",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: existing?.applicationDocuments || arr(firstApplicationDocs(audit)),
    chinaStudentRequirements: existing?.chinaStudentRequirements || arr([]),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      umtUndergraduateReviewImport: reviewProfile
    },
    officialSources: mergeOfficialSources(existing?.officialSources || [], sourceRegistryLinks(audit)),
    officialVerifiedAt: existing?.officialVerifiedAt || verifiedAt,
    officialSourceStatus: existing?.officialSourceStatus || "needs-review",
    officialAuditSummary: [
      existing?.officialAuditSummary || "",
      "UMT undergraduate review-only import: 38 bachelor candidates imported as non-public needs-review rows. All rows keep tuition blank/pending because strict fee gate is FAIL, and all rows are blocked from application and member-center readiness."
    ].filter(Boolean).join(" "),
    publicDisplayStatus: existing?.publicDisplayStatus || "needs-review",
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: existing?.tuitionMinCny || 0,
    tuitionMaxCny: existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 0,
    minIelts: existing?.minIelts || 5,
    acceptNoLanguage: existing?.acceptNoLanguage || false,
    facilities: existing?.facilities || arr([]),
    highlights: existing?.highlights || arr(["Review-only undergraduate audit"], ["Review-only undergraduate audit"], ["本科仅限审核展示"], ["本科僅限審核展示"]),
    programCount: existingPublicReady ? existing?.programCount || 0 : summary.importRows,
    isPublished: existing?.isPublished || false
  };
}

function verifyUmtUndergraduateImportedRecordSet(
  university: UniversityEntity,
  rows: ProgramEntity[],
  expectedSlugs: Set<string>
): UmtUndergraduateImportVerification {
  const summary = summarizeUmtUndergraduateReviewImport(rows);
  const importedPublicLeakageRows = rows.filter((row) => row.isPublished || row.publicDisplayStatus === "ready").length;
  const importedAdminNeedsReviewRows = rows.filter((row) => row.publicDisplayStatus === "needs-review" && row.isPublished === false).length;
  const applicationSelectableRows = rows.filter((row) => row.isPublished && row.publicDisplayStatus === "ready").length;
  const memberCenterReadyRows = rows.filter((row) => row.isPublished && row.publicDisplayStatus === "ready").length;
  const staleUndergraduateReviewRows = rows.filter((row) => !expectedSlugs.has(row.slug)).length;

  if (
    rows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedProgrammes ||
    summary.readyRows !== 0 ||
    summary.needsReviewRows !== expectedProgrammes ||
    summary.publishedRows !== 0 ||
    summary.missingFeeRows !== expectedProgrammes ||
    summary.sourceConflictFeeRows !== expectedProgrammes ||
    summary.directIeltsRows !== expectedProgrammes ||
    summary.noDirectIeltsRows !== 0 ||
    summary.durationReviewRows !== 0 ||
    summary.curriculumRows !== 0 ||
    summary.emptyCurriculumRows !== expectedProgrammes ||
    summary.careerRows !== 0 ||
    summary.emptyCareerRows !== expectedProgrammes ||
    importedPublicLeakageRows !== 0 ||
    importedAdminNeedsReviewRows !== expectedProgrammes ||
    applicationSelectableRows !== 0 ||
    memberCenterReadyRows !== 0 ||
    staleUndergraduateReviewRows !== 0
  ) {
    throw new Error(`UMT undergraduate review import verification failed: ${JSON.stringify({ summary, importedPublicLeakageRows, importedAdminNeedsReviewRows, applicationSelectableRows, memberCenterReadyRows, staleUndergraduateReviewRows, universityStatus: university.publicDisplayStatus, universityPublished: university.isPublished })}`);
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
    staleUndergraduateReviewRows
  };
}

async function verifyImportedRows(
  manager: EntityManager | DataSource,
  universityId: number,
  expectedSlugs: Set<string>
): Promise<UmtUndergraduateImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("UMT university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX}%`) }
  });
  return verifyUmtUndergraduateImportedRecordSet(university, rows, expectedSlugs);
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
      importedUndergraduateReviewRows: 0
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
    importedUndergraduateReviewRows: rows.filter((row) => row.slug.startsWith(UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX)).length
  };
}

async function findUmtUniversity(manager: EntityManager | DataSource) {
  const repo = manager.getRepository(UniversityEntity);
  return (
    (await repo.findOne({ where: { code: "UMT" } })) ||
    (await repo.findOne({ where: { slug: "universiti-malaysia-terengganu" } })) ||
    (await repo.findOne({ where: { slug: "umt" } }))
  );
}

function languageRequirement(programme: UmtAuditProgramme): LanguageRequirement {
  return {
    ielts: Number(programme.language?.ielts || 0),
    toefl: optionalNumber(programme.language?.toefl),
    pte: optionalNumber(programme.language?.pte),
    muet: optionalNumber(programme.language?.muet)
  };
}

function officialLanguageRequirement(programme: UmtAuditProgramme) {
  const parts = [
    programme.language?.ielts ? `IELTS ${programme.language.ielts}` : "",
    programme.language?.toefl ? `TOEFL iBT ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE Academic ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver || ""
  ].filter(Boolean);
  return normalizeLongText(parts.join("; "));
}

function localizedFaculty(faculty: string, facultyZh?: string | null): LocalizedText {
  const zhCN = facultyZh || faculty;
  return t(faculty, faculty, zhCN, zhCN);
}

function studyModeDisplay(programme: UmtAuditProgramme) {
  if (programme.studyMode) return normalizeText(programme.studyMode, 80);
  return "Full-time undergraduate";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|management|finance|account|entrepreneurship|tourism|hospitality|maritime management|marketing|economics/.test(value)) return "business";
  if (/computer|information technology|software|data|informatics|cyber|digital|artificial intelligence/.test(value)) return "it";
  if (/engineering|nautical|maritime technology|mechanical|electrical|electronics|civil/.test(value)) return "engineering";
  if (/medicine|medical|health|nursing|biomedical|pharmacy|nutrition/.test(value)) return "medicine";
  if (/law|legal/.test(value)) return "law";
  if (/science|fisheries|aquaculture|marine|environment|biology|chemistry|mathematics|physics|biodiversity|food|agrotechnology|analytics/.test(value)) return "science";
  return "arts";
}

function intakeNote(programme: UmtAuditProgramme) {
  const note = programme.fieldStatus?.intake?.note || "";
  return normalizeLongText(note || "UMT official undergraduate sources checked in this audit did not publish programme-specific intake months.");
}

function tuitionNote(programme: UmtAuditProgramme) {
  return normalizeLongText(programme.tuitionNote || "Current UMT official programme page did not publish an adoptable international MYR tuition amount.");
}

function academicRequirementNote(programme: UmtAuditProgramme) {
  return normalizeLongText(
    programme.entryRequirement.gpaNote ||
      programme.entryRequirement.degreeLevel ||
      "Official undergraduate entry requirements require manual review before application readiness."
  );
}

function officialAcademicRequirement(programme: UmtAuditProgramme) {
  return normalizeLongText([
    programme.entryRequirement.degreeLevel ? `Degree level: ${programme.entryRequirement.degreeLevel}.` : "",
    programme.entryRequirement.degreeRelevance ? `Relevance: ${programme.entryRequirement.degreeRelevance}.` : "",
    programme.entryRequirement.workExperience ? `Work experience: ${programme.entryRequirement.workExperience}.` : "",
    programme.entryRequirement.gpaNote || ""
  ].filter(Boolean).join(" "));
}

function specialRequirementsNote(programme: UmtAuditProgramme) {
  return normalizeLongText([
    programme.studyModeNote ? `Study mode note: ${programme.studyModeNote}.` : "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.thesisNote || "",
    programme.supervisorSystem ? "Supervisor system is indicated and must be manually confirmed before application readiness." : "",
    "Imported for UMT undergraduate review-only frontend audit. Do not publish into application flow until a separate ready conversion is approved."
  ].filter(Boolean).join(" "));
}

function descriptionText(programme: UmtAuditProgramme, reviewReason: string): LocalizedText {
  const zhCN = `${programme.name} 是 Universiti Malaysia Terengganu 本科层级的审核候选专业。当前仅供前端审核缺口，不进入正式申请、会员中心 ready、预算匹配或费用承诺。`;
  return t(
    `${programme.nameEn} is a Universiti Malaysia Terengganu undergraduate review-only candidate. ${reviewReason}`,
    `${programme.nameEn} is a Universiti Malaysia Terengganu undergraduate review-only candidate. ${reviewReason}`,
    zhCN,
    zhCN
  );
}

function reviewReasonText(programme: UmtAuditProgramme, audit: UmtUndergraduateAudit, ordinal: number) {
  const pendingIds = safeStringArray(audit.pending_issues?.map((issue) => issue.issue_id).filter(Boolean));
  const reasons = [
    programme.remarks || `UMT undergraduate row ${ordinal} remains needs-review under validator output.`,
    "Strict fee gate failed because UMT official sources did not publish a current programme-page international MYR tuition amount.",
    "Official USD-per-semester fee evidence is retained only as supporting evidence and is not converted to MYR.",
    "Programme-specific intake months are not published in the captured official sources.",
    safeStringArray(programme.curriculum).length === 0 ? "Curriculum array is empty for ready display." : "",
    safeStringArray(programme.careerProspects).length === 0 ? "Career prospects array is empty for ready display." : "",
    pendingIds.length ? `File-level pending issues: ${pendingIds.join(", ")}.` : "",
    "Review-only import for Ian frontend review; row is non-public and non-application-selectable."
  ].filter(Boolean);
  return normalizeLongText(reasons.join(" "));
}

function sourceLinks(programme: UmtAuditProgramme, audit: UmtUndergraduateAudit): OfficialSourceLink[] {
  const urls = new Set<string>([
    programme.officialSourceUrl,
    fieldStatusSource(programme, "entryRequirement"),
    fieldStatusSource(programme, "tuitionMYR"),
    fieldStatusSource(programme, "officialFeeSourceUrl"),
    fieldStatusSource(programme, "language"),
    programme.officialFeeSourceUrl,
    catalogueUrl,
    internationalUndergraduateUrl,
    officialFeePdfUrl,
    languageGuideUrl,
    applicationFormUrl,
    ...supportingOfficialTuitionSources(programme),
    ...collectUrls(audit.sourceRegistry).filter((url) => /umt\.edu\.my/i.test(url))
  ].filter((url): url is string => Boolean(url)));
  return [...urls].map((url) => ({
    title: sourceLinkTitle(url, programme),
    url,
    sourceType: sourceLinkType(url),
    verifiedAt,
    status: "needs-review",
    note: sourceLinkNote(url, programme)
  }));
}

function sourceRegistryLinks(audit: UmtUndergraduateAudit): OfficialSourceLink[] {
  return collectUrls(audit.sourceRegistry)
    .filter((url) => /umt\.edu\.my/i.test(url))
    .map((url) => ({
      title: sourceLinkTitle(url),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "needs-review",
      note: "Official UMT source retained for undergraduate review-only import."
    }));
}

function supportingOfficialTuitionSources(programme: UmtAuditProgramme) {
  const tuition = asRecord(programme.fieldEvidence?.tuition);
  const supporting = Array.isArray(tuition.supportingOfficialSources) ? tuition.supportingOfficialSources : [];
  return supporting
    .map((item) => asRecord(item).sourceUrl)
    .filter((url): url is string => typeof url === "string" && /umt\.edu\.my/i.test(url));
}

function sourceLinkTitle(url: string, programme?: UmtAuditProgramme) {
  if (programme && url === programme.officialSourceUrl) return "Official programme page";
  if (url === catalogueUrl) return "Official undergraduate catalogue";
  if (url === internationalUndergraduateUrl) return "Official international undergraduate page";
  if (url === officialFeePdfUrl) return "Official undergraduate international fee PDF";
  if (url === languageGuideUrl) return "Official undergraduate application guideline";
  if (url === applicationFormUrl) return "Official undergraduate international application form";
  if (/\.pdf(?:$|\?)/i.test(url)) return "Official PDF source";
  if (/umt\.edu\.my\/?$/i.test(url)) return "Official UMT website";
  return "Official UMT source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  if (/application|apply|guideline|form/i.test(url)) return "admission";
  if (/fee|tuition|fees/i.test(url)) return "fee";
  if (/entry|requirement|guideline/i.test(url)) return "entry-requirement";
  if (/all-programs|programme|programmes|programs|sarjana-muda|\.pdf/i.test(url)) return "profile";
  if (/umt\.edu\.my\/?$/i.test(url)) return "official-website";
  return "other";
}

function sourceLinkNote(url: string, programme?: UmtAuditProgramme) {
  if (programme && url === programme.officialSourceUrl) return "Primary UMT programme page; row remains needs-review because strict fee and readiness gates did not pass.";
  if (url === officialFeePdfUrl) return "Official UMT USD fee evidence retained as supporting source; not adopted as MYR tuition and not used for ready status.";
  if (url === languageGuideUrl) return "Official UMT application guideline used for central international language requirement.";
  return "Official UMT source retained for review-only import.";
}

function fieldStatusSource(programme: UmtAuditProgramme, key: string) {
  return programme.fieldStatus?.[key]?.sourceUrl || null;
}

function firstApplicationDocs(audit: UmtUndergraduateAudit) {
  return safeStringArray(audit.programmes.find((programme) => programme.applicationDocs.length > 0)?.applicationDocs);
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
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
  const auditPath = resolve(readArgValue("--audit") || DEFAULT_UMT_UNDERGRADUATE_AUDIT_PATH);
  if (!existsSync(auditPath)) throw new Error(`UMT audit JSON not found: ${auditPath}`);

  const audit = loadUmtUndergraduateAudit(auditPath);
  const errors = validateUmtUndergraduateAudit(audit, auditPath);
  if (errors.length) throw new Error(`UMT undergraduate audit validation failed:\n${errors.join("\n")}`);

  const rows = buildUmtUndergraduateReviewRows(audit);
  const expectedSlugs = new Set(rows.map((row) => String(row.slug)));
  const summary = summarizeUmtUndergraduateReviewImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import") || process.argv.includes("--confirm-review-import");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/umt-undergraduate-review-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportOutput = readArgValue("--report-output");

  if (!verifyOnly && !confirm) {
    const report = {
      mode: "dry-run",
      decision: "ready-for-review-only-import",
      universityCode: "UMT",
      auditPath,
      writePolicy: {
        authorization: "review-only-frontend-audit-import",
        requestedMode: "review-import",
        upsertPrefix: UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX,
        importRows: expectedProgrammes,
        university: {
          existingPublicInstitutionPolicy: "Preserve existing UMT public university fields; append review metadata only.",
          newInstitutionDefault: { isPublished: false, publicDisplayStatus: "needs-review" }
        },
        programmes: {
          isPublished: false,
          publicDisplayStatus: "needs-review",
          officialSourceStatus: "needs-review",
          officialFeeAuditStatus: "source-conflict",
          tuitionDisplay: officialTuitionPendingDisplay,
          applicationSelectable: false,
          memberCenterReady: false
        },
        archivePolicy: "Only remove stale rows inside the UMT undergraduate review namespace; do not archive or modify existing UMT programme rows.",
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
    let university = await findUmtUniversity(dataSource);

    if (verifyOnly) {
      if (!university) throw new Error("UMT university row not found.");
      const report = {
        mode: "verified",
        decision: "review-only-imported",
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
    const currentUndergraduateRows = university
      ? await programRepo.find({ where: { universityId: university.id, slug: Like(`${UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX}%`) } })
      : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          targetUniversity: university,
          targetUndergraduateReviewRows: currentUndergraduateRows,
          publicVisibility: beforePublicVisibility
        },
        null,
        2
      ),
      "utf8"
    );

    let verification: UmtUndergraduateImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await findUmtUniversity(manager);
      const universitySeed = buildUmtUniversityRow(audit, summary, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const previousUndergraduateReviewRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX}%`) }
      });
      for (const previous of previousUndergraduateReviewRows) {
        if (!expectedSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id && !existing.slug.startsWith(UMT_UNDERGRADUATE_REVIEW_SLUG_PREFIX)) {
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
      decision: "review-only-imported",
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
