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

export const LUC_OFFICIAL_AUDIT_SLUG_PREFIX = "luc-official-20260630-row-";
export const DEFAULT_LUC_OFFICIAL_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/LUC_audit_undergraduate_20260630_verified_20260630_r4.json"
);

const verifiedAt = "2026-06-30";
const expectedProgrammes = 57;
const officialWebsite = "https://www.lincoln.edu.my/";
const programmeCatalogueUrl = "https://www.lincoln.edu.my/category/bachelor/";
const applicationPortalUrl = "https://www.online.lincoln.edu.my//applyonline/landingapplyonline.aspx";
const applicationDocsUrl = "https://crm.lincoln.edu.my/UserSupport/FAQs?student=student";
const officialTuitionUnpublishedDisplay = "Official LUC international tuition not published";

type LucAuditLevel = "undergraduate";

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
}

interface LucOfficialAudit {
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
  };
  sourceRegistry?: Record<string, unknown>;
  programme_baseline?: Record<string, unknown>;
  validation_result?: {
    recommended_for_import?: boolean;
    blocking_issues?: Array<{ issue_id?: string; field?: string; reason?: string }> | string[];
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
  pending_issues?: Array<{ issue_id?: string; resolution_note?: string; status?: string }>;
  exception_queue?: unknown[];
  programmes: LucAuditProgramme[];
}

export interface LucImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<"bachelor", number>;
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

export interface LucImportVerification extends LucImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  importedPublicLeakageRows: number;
  importedAdminNeedsReviewRows: number;
  legacyPublicRows: number;
  staleReviewRows: number;
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
  importedReviewRows: number;
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

export function loadLucOfficialAudit(path = DEFAULT_LUC_OFFICIAL_AUDIT_PATH): LucOfficialAudit {
  return loadJson<LucOfficialAudit>(path);
}

export function validateLucOfficialAudit(audit: LucOfficialAudit): string[] {
  const errors: string[] = [];
  if (audit.schema_version !== "audit-json-v2.1") errors.push("LUC audit must use schema_version audit-json-v2.1.");
  if (audit.safe_to_import !== false) errors.push("safe_to_import must remain false.");
  if (audit.import_authorization?.safe_to_import !== false) errors.push("import_authorization.safe_to_import must remain false.");
  if (audit.import_approved_by != null || audit.import_approved_at != null) {
    errors.push("import approval fields must remain null in the audit artifact.");
  }
  if (audit.validation_result?.recommended_for_import !== false) {
    errors.push("LUC r4 audit must remain not recommended for public import.");
  }
  if (audit.auditMeta?.targetUniversityShortName !== "LUC") errors.push("targetUniversityShortName must be LUC.");
  if (audit.auditMeta?.targetLevel !== "undergraduate") errors.push("targetLevel must be undergraduate.");
  if (audit.auditMeta?.officialDomain !== "lincoln.edu.my") errors.push("officialDomain must be lincoln.edu.my.");
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedProgrammes) {
    errors.push(`LUC undergraduate audit must contain ${expectedProgrammes} programmes.`);
  }
  if (audit.validationMeta?.strictFeeGateStats?.decision !== "FAIL") {
    errors.push("LUC strict fee gate must remain FAIL for review-only import.");
  }

  const serialized = JSON.stringify(audit);
  if (/mqa\.gov\.my|google\.com\/url|apu\.edu\.my/i.test(serialized)) {
    errors.push("LUC r4 audit must not contain third-party URL strings.");
  }

  audit.programmes.forEach((programme, index) => {
    const ordinal = index + 1;
    if (!programme.nameEn) errors.push(`Row ${ordinal} has no official English name.`);
    if (!programme.officialSourceUrl?.includes("lincoln.edu.my")) errors.push(`Row ${ordinal} has no LUC official source URL.`);
    if (programme.level !== "undergraduate") errors.push(`Row ${ordinal} source level must be undergraduate.`);
    if (programme.publicDisplayStatus !== "needs-review") errors.push(`Row ${ordinal} must remain needs-review.`);
    if (programme.tuitionMYR !== null) errors.push(`Row ${ordinal} tuitionMYR must remain null.`);
    if (programme.officialFeeSourceUrl !== null) errors.push(`Row ${ordinal} officialFeeSourceUrl must remain null.`);
    const tuitionEvidence = asRecord(programme.fieldEvidence?.tuition);
    if (tuitionEvidence.strictFeeGate !== "FAIL") errors.push(`Row ${ordinal} strict fee gate must remain FAIL.`);
  });

  return errors;
}

export function buildLucOfficialAuditRows(audit: LucOfficialAudit): Array<DeepPartial<ProgramEntity>> {
  return audit.programmes.map((programme, index) => {
    const ordinal = index + 1;
    const sourceStatus: OfficialSourceStatus = "needs-review";
    const publicDisplayStatus: PublicDisplayStatus = "needs-review";
    const language = languageRequirement(programme);
    const durationYears = Number(programme.duration ?? 0);
    const curriculum = safeStringArray(programme.curriculum);
    const careers = safeStringArray(programme.careerProspects);
    const reviewReason = reviewReasonText(programme);

    return {
      slug: `${LUC_OFFICIAL_AUDIT_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
      code: `LUC-UG-${String(ordinal).padStart(3, "0")}`,
      name: t(programme.nameEn, programme.nameEn, programme.name || programme.nameEn, programme.name || programme.nameEn),
      nameEnOfficial: programme.nameEn,
      level: "bachelor",
      category: inferCategory(programme.nameEn, programme.faculty),
      faculty: localizedFaculty(programme.faculty, programme.facultyZh),
      facultyZh: programme.facultyZh || programme.faculty,
      studyMode: studyModeDisplay(programme),
      campus: "Lincoln University College, Petaling Jaya, Selangor, Malaysia",
      durationYears,
      durationOfficial: durationYears > 0
        ? `${formatNumber(durationYears)} years`
        : "Official duration requires review in the LUC audit.",
      annualTuitionCny: 0,
      tuitionAmount: null,
      tuitionCurrency: "MYR" satisfies TuitionCurrency,
      tuitionDisplay: officialTuitionUnpublishedDisplay,
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
          programme.entryRequirement.gpaNote || "Official undergraduate entry paths require manual review before public display.",
          programme.entryRequirement.gpaNote || "Official undergraduate entry paths require manual review before public display.",
          programme.entryRequirement.gpaNote || "官方本科入学路径需人工复核后再公开展示。",
          programme.entryRequirement.gpaNote || "官方本科入學路徑需人工覆核後再公開展示。"
        )
      },
      officialAcademicRequirement: normalizeLongText(programme.entryRequirement.gpaNote || ""),
      chinaStudentRequirement: "LUC official sources checked in this audit do not publish a China-specific route; keep the row in admin review and confirm against LUC before public release.",
      specialRequirementsNote: specialRequirementsNote(programme),
      applicationDocs: arr(safeStringArray(programme.applicationDocs)),
      curriculum: arr(curriculum),
      careers: arr(careers),
      specializations: arr([]),
      description: descriptionText(programme, reviewReason),
      officialAccreditationNote: "No programme-level accreditation claim is published from this LUC review-only import. Any DDS/MD level mapping remains an Ian decision.",
      officialSourceUrl: programme.officialSourceUrl,
      officialEntryRequirementSourceUrl: fieldStatusSource(programme, "entryRequirement") || programme.officialSourceUrl,
      officialAccreditationSourceUrl: programme.officialSourceUrl,
      sourceUrls: sourceLinks(programme),
      officialVerifiedAt: dateOnly(programme.officialVerifiedAt) || verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: "Review-only database import. Hidden from the public student catalogue until LUC fee, curriculum and level gates are resolved and Ian approves ready conversion.",
      reviewReason,
      auditNote: [
        `Original LUC audit row ${ordinal}.`,
        `Validation result: ${programme._validationResult || "not-recorded"}.`,
        `Pending issues: ${safeStringArray(programme._pendingIssues).join(", ") || "not-recorded"}.`,
        `Strict fee gate: FAIL; audit status: ${programme.auditStatus}.`,
        `Curriculum rows: ${curriculum.length}; career rows: ${careers.length}; direct IELTS: ${language.ielts > 0 ? language.ielts : "not published"}.`,
        `Review-only policy: imported rows are non-public and must not appear in public APIs, lists, programme details, aggregates, or recommendations.`
      ].join(" "),
      listTuitionText: officialTuitionUnpublishedDisplay,
      isPublished: false
    };
  });
}

export function summarizeLucOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): LucImportSummary {
  return {
    candidateRows: rows.length,
    importRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length
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
  audit: LucOfficialAudit,
  summary: LucImportSummary,
  existing?: UniversityEntity | null
): DeepPartial<UniversityEntity> {
  const existingPublicReady = Boolean(existing?.isPublished && existing.publicDisplayStatus === "ready");
  if (existingPublicReady && existing) {
    return {
      ...existing,
      id: existing.id,
      isPublished: true,
      publicDisplayStatus: "ready"
    };
  }

  const reviewProfile = {
    collectionScope: "LUC undergraduate official audit review import",
    applicantScope: "international",
    academicSession: "2026",
    retrievedAt: audit.auditMeta?.validatedAt || verifiedAt,
    officialDomains: ["lincoln.edu.my"],
    sourceUniversityCode: "LUC",
    authorization: "review-import",
    importNamespace: LUC_OFFICIAL_AUDIT_SLUG_PREFIX,
    validatorDecision: audit.validation_result,
    workflowAcceptance: {
      declaredOfficialRows: audit.auditMeta?.totalProgrammesBaseline || expectedProgrammes,
      candidateProgrammes: summary.importRows,
      importedReviewRows: summary.needsReviewRows,
      publicReadyRows: 0,
      strictFeeGateDecision: audit.validationMeta?.strictFeeGateStats?.decision || "FAIL",
      officialPublishedFeeRows: 0,
      curriculumRows: summary.curriculumRows,
      emptyCurriculumRows: summary.emptyCurriculumRows,
      publicLeakageExpected: 0
    },
    catalogStatusSummary: {
      all: { total: summary.importRows, ready: 0, needsReview: summary.needsReviewRows, notAvailableForInternational: 0 },
      byLevel: {
        bachelor: { total: summary.byLevel.bachelor, ready: 0, needsReview: summary.byLevel.bachelor, notAvailableForInternational: 0 }
      }
    },
    reviewOnlyControls: {
      importedRowsPublicDisplayStatus: "needs-review",
      importedRowsIsPublished: false,
      publicLeakageExpected: 0,
      sourceAuditSafeToImport: false,
      sourceAuditRecommendedForImport: false
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
      "Lincoln University College is imported as a StudyMY official review candidate. Public display is disabled until LUC undergraduate records pass the ready gate.",
      "Lincoln University College is imported as a StudyMY official review candidate. Public display is disabled until LUC undergraduate records pass the ready gate.",
      "林肯大学学院已作为 StudyMY 官方审核候选入库；本科专业通过 ready 门禁前不会进入公开学生目录。",
      "林肯大學學院已作為 StudyMY 官方審核候選入庫；本科專業通過 ready 門檻前不會進入公開學生目錄。"
    ),
    website: existing?.website || officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: "Lincoln University College",
    officialWebsite,
    studyPortalUrl: programmeCatalogueUrl,
    internationalPageUrl: programmeCatalogueUrl,
    applicationPortalUrl,
    officialAddress: existing?.officialAddress || "",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: existing?.applicationDocuments || arr(firstApplicationDocs(audit)),
    chinaStudentRequirements: existing?.chinaStudentRequirements || arr([]),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      lucReviewImport: reviewProfile
    },
    officialSources: mergeOfficialSources(existing?.officialSources || [], sourceRegistryLinks(audit)),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "needs-review",
    officialAuditSummary: "LUC review-only import: 57 undergraduate candidates imported as non-public needs-review rows. Validator blocks public import because all rows fail the current official programme-page international tuition gate, 56 curriculum arrays remain unresolved, and DDS/MD level mapping needs Ian decision.",
    publicDisplayStatus: "needs-review",
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: existing?.tuitionMinCny || 0,
    tuitionMaxCny: existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 0,
    minIelts: 0,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr([]),
    highlights: arr(["Official review import only"], ["Official review import only"], ["仅限后台审核"], ["僅限後台審核"]),
    programCount: summary.importRows,
    isPublished: false
  };
}

function verifyLucImportedRecordSet(university: UniversityEntity, rows: ProgramEntity[], allUniversityRows: ProgramEntity[]): LucImportVerification {
  const summary = summarizeLucOfficialAuditImport(rows);
  const importedPublicLeakageRows = rows.filter((row) => row.isPublished || row.publicDisplayStatus === "ready").length;
  const importedAdminNeedsReviewRows = rows.filter((row) => row.publicDisplayStatus === "needs-review" && row.isPublished === false).length;
  const legacyPublicRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(LUC_OFFICIAL_AUDIT_SLUG_PREFIX) && row.isPublished && ["ready", "current-cycle-not-open", "not-available-for-international"].includes(row.publicDisplayStatus)
  ).length;
  const staleReviewRows = allUniversityRows.filter(
    (row) =>
      !row.slug.startsWith(LUC_OFFICIAL_AUDIT_SLUG_PREFIX) &&
      !(row.isPublished && ["ready", "current-cycle-not-open", "not-available-for-international"].includes(row.publicDisplayStatus)) &&
      row.publicDisplayStatus !== "archived"
  ).length;

  if (
    rows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedProgrammes ||
    summary.readyRows !== 0 ||
    summary.needsReviewRows !== expectedProgrammes ||
    summary.publishedRows !== 0 ||
    summary.missingFeeRows !== expectedProgrammes ||
    summary.directIeltsRows !== 52 ||
    summary.noDirectIeltsRows !== 5 ||
    summary.curriculumRows !== 1 ||
    summary.emptyCurriculumRows !== 56 ||
    summary.careerRows !== 53 ||
    summary.emptyCareerRows !== 4 ||
    importedPublicLeakageRows !== 0 ||
    importedAdminNeedsReviewRows !== expectedProgrammes ||
    staleReviewRows !== 0
  ) {
    throw new Error(`LUC import verification failed: ${JSON.stringify({ summary, importedPublicLeakageRows, importedAdminNeedsReviewRows, legacyPublicRows, staleReviewRows, universityStatus: university.publicDisplayStatus, universityPublished: university.isPublished })}`);
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    importedPublicLeakageRows,
    importedAdminNeedsReviewRows,
    legacyPublicRows,
    staleReviewRows
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number): Promise<LucImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("LUC university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${LUC_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
  });
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifyLucImportedRecordSet(university, rows, allUniversityRows);
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
      importedReviewRows: 0
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
    importedReviewRows: rows.filter((row) => row.slug.startsWith(LUC_OFFICIAL_AUDIT_SLUG_PREFIX)).length
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

function studyModeDisplay(programme: LucAuditProgramme) {
  if (programme.studyMode) return normalizeText(programme.studyMode, 80);
  if (/\bODL\b/i.test(programme.nameEn) || /ODL|开放与远程学习/.test(programme.studyModeNote || "")) return "ODL";
  return "Full-time";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|management|finance|account|entrepreneurship|tourism|hospitality|airline|airport|oil and gas/.test(value)) return "business";
  if (/computer|information technology|cyber|network|cloud|data analytics|e-commerce|multimedia|digital film|ai computing|artificial intelligence/.test(value)) return "it";
  if (/engineering|mechatronics|mechanical|electrical|electronics|civil|aeronautics|built environment/.test(value)) return "engineering";
  if (/medicine|medical|health|nursing|biomedical|physiotherapy|pharmacy|pharmaceutical|ayurvedic|homeopathic|dental|cardiopulmonary|perfusion|cosmetic/.test(value)) return "medicine";
  if (/law|legal/.test(value)) return "law";
  if (/science|nutrition|biotechnology|agriculture|sports|fitness/.test(value)) return "science";
  return "arts";
}

function intakeMonths(programme: LucAuditProgramme) {
  return safeNumberArray(programme.intake).map((month) => monthName(month)).filter(Boolean);
}

function intakeOfficialText(programme: LucAuditProgramme) {
  const months = intakeMonths(programme);
  return months.length ? months.join(", ") : "Official intake requires review.";
}

function intakeNote(programme: LucAuditProgramme) {
  const status = asRecord(programme.fieldStatus?.intake);
  const note = typeof status.note === "string" ? status.note : "";
  return normalizeLongText([
    note || "LUC audit captured the official intake months shown in the programme evidence where scalar months were available.",
    programme.nameEn === "Doctor of Medicine (MD)" ? "Validator flagged September/October source fragments for manual intake review." : ""
  ].filter(Boolean).join(" "));
}

function tuitionNote(programme: LucAuditProgramme) {
  return normalizeLongText(programme.tuitionNote || "Current official LUC programme page did not publish an adoptable international full-course MYR tuition amount.");
}

function specialRequirementsNote(programme: LucAuditProgramme) {
  return normalizeLongText([
    programme.studyModeNote ? `Study mode note: ${programme.studyModeNote}.` : "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.thesisNote || "",
    ["Doctor of Dental Surgery", "Doctor of Medicine (MD)"].includes(programme.nameEn)
      ? "DDS/MD professional first-degree level mapping requires Ian decision before public display."
      : "",
    "Imported for backend/admin review only. Do not publish until LUC ready gates pass."
  ].filter(Boolean).join(" "));
}

function descriptionText(programme: LucAuditProgramme, reviewReason: string): LocalizedText {
  const zhCN = `${programme.name} 是 Lincoln University College 本科层级的审核候选专业。当前仅供后台审核；费用、课程设置和层级/时长异常通过前不会进入公开学生目录。`;
  return t(
    `${programme.nameEn} is a Lincoln University College undergraduate review candidate. ${reviewReason}`,
    `${programme.nameEn} is a Lincoln University College undergraduate review candidate. ${reviewReason}`,
    zhCN,
    zhCN
  );
}

function reviewReasonText(programme: LucAuditProgramme) {
  const issues = safeStringArray(programme._pendingIssues);
  const reasons = [
    programme.remarks || "LUC row remains needs-review under validator output.",
    "Strict fee gate failed because LUC official sources did not publish a current programme-page international full-course MYR tuition amount.",
    programme.curriculum.length === 0 ? "Curriculum array is empty or unresolved." : "",
    programme.careerProspects.length === 0 ? "Career prospects array is empty or unresolved." : "",
    programme.language.ielts == null ? "No direct official IELTS scalar was captured; IELTS remains unpublished for this row." : "",
    ["Doctor of Dental Surgery", "Doctor of Medicine (MD)"].includes(programme.nameEn) ? "DDS/MD undergraduate professional-degree mapping requires Ian decision." : "",
    issues.length ? `Pending issues: ${issues.join(", ")}.` : "",
    "Review-only import for Ian approval; row is non-public."
  ].filter(Boolean);
  return normalizeLongText(reasons.join(" "));
}

function sourceLinks(programme: LucAuditProgramme): OfficialSourceLink[] {
  const urls = new Set<string>([
    programme.officialSourceUrl,
    fieldStatusSource(programme, "entryRequirement"),
    applicationDocsUrl,
    ...supportingOfficialTuitionSources(programme)
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

function sourceRegistryLinks(audit: LucOfficialAudit): OfficialSourceLink[] {
  const registry = asRecord(audit.sourceRegistry);
  const urls = [
    registry.officialHome,
    registry.programmeCatalogue,
    registry.wpApiBachelorPages,
    registry.officialSitemap,
    registry.onlineApplication,
    registry.crmFaqForeignStudentDocuments,
    ...safeStringArray(registry.officialPdfSources)
  ].filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url));
  return [...new Set(urls)].map((url) => ({
    title: sourceLinkTitle(url),
    url,
    sourceType: sourceLinkType(url),
    verifiedAt,
    status: "needs-review",
    note: "Official LUC source retained for backend review-only import."
  }));
}

function supportingOfficialTuitionSources(programme: LucAuditProgramme) {
  const tuition = asRecord(programme.fieldEvidence?.tuition);
  const supporting = Array.isArray(tuition.supportingOfficialSources) ? tuition.supportingOfficialSources : [];
  return supporting
    .map((item) => asRecord(item).sourceUrl)
    .filter((url): url is string => typeof url === "string" && /lincoln\.edu\.my/i.test(url));
}

function sourceLinkTitle(url: string, programme?: LucAuditProgramme) {
  if (programme && url === programme.officialSourceUrl) return "Official programme page";
  if (url === applicationDocsUrl) return "Official foreign-student document FAQ";
  if (url === programmeCatalogueUrl) return "Official bachelor catalogue";
  if (url === applicationPortalUrl) return "Official application portal";
  if (/wp-json/i.test(url)) return "Official WordPress API source";
  if (/wp-sitemap/i.test(url)) return "Official sitemap";
  if (/\.pdf(?:$|\?)/i.test(url)) return "Official PDF source";
  if (/online\.lincoln\.edu\.my/i.test(url)) return "Official application portal";
  return "Official LUC source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  if (/apply|application|crm\.lincoln/i.test(url)) return "admission";
  if (/fee|tuition/i.test(url)) return "fee";
  if (/entry|requirement/i.test(url)) return "entry-requirement";
  if (/category\/bachelor|wp-json|sitemap|brochure|\.pdf/i.test(url)) return "profile";
  if (/lincoln\.edu\.my\/?$/i.test(url)) return "official-website";
  return "other";
}

function sourceLinkNote(url: string, programme: LucAuditProgramme) {
  if (url === programme.officialSourceUrl) return "Primary LUC programme page; row remains needs-review because strict fee and completeness gates did not pass.";
  if (url === applicationDocsUrl) return "Official LUC CRM FAQ used for foreign-student application document list.";
  if (/\.pdf(?:$|\?)/i.test(url)) return "Official LUC PDF evidence retained as supporting source; not adopted as a fee source.";
  return "Official LUC source retained for backend review-only import.";
}

function fieldStatusSource(programme: LucAuditProgramme, key: string) {
  const status = programme.fieldStatus?.[key];
  return status?.sourceUrl || null;
}

function firstApplicationDocs(audit: LucOfficialAudit) {
  return safeStringArray(audit.programmes.find((programme) => programme.applicationDocs.length > 0)?.applicationDocs);
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
  const auditPath = resolve(readArgValue("--audit") || DEFAULT_LUC_OFFICIAL_AUDIT_PATH);
  if (!existsSync(auditPath)) throw new Error(`LUC audit JSON not found: ${auditPath}`);
  const audit = loadJson<LucOfficialAudit>(auditPath);
  const errors = validateLucOfficialAudit(audit);
  if (errors.length) throw new Error(`LUC official audit validation failed:\n${errors.join("\n")}`);

  const rows = buildLucOfficialAuditRows(audit);
  const summary = summarizeLucOfficialAuditImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import") || process.argv.includes("--confirm-review-import");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/luc-official-audit-review-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportOutput = readArgValue("--report-output");

  if (!verifyOnly && !confirm) {
    const report = {
      mode: "dry-run",
      decision: "ready-for-review-import",
      universityCode: "LUC",
      auditPath,
      writePolicy: {
        authorization: "review-import",
        requestedMode: "review-import",
        upsertPrefix: LUC_OFFICIAL_AUDIT_SLUG_PREFIX,
        importRows: expectedProgrammes,
        university: {
          newInstitutionDefault: { isPublished: false, publicDisplayStatus: "needs-review" },
          existingPublicInstitutionPolicy: "Preserve an existing public LUC university surface if present; import only non-public review programme rows."
        },
        programmes: {
          isPublished: false,
          publicDisplayStatus: "needs-review",
          officialSourceStatus: "needs-review",
          officialFeeAuditStatus: "not-published"
        },
        archivePolicy: "Archive stale non-public LUC rows outside the LUC official-audit namespace; preserve any existing public visible LUC rows.",
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
        decision: "review-imported",
        universityId: university.id,
        databaseUniversityCode: university.code,
        summary,
        verification: await verifyImportedRows(dataSource, university.id),
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
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          targetUniversity: university,
          targetPrograms: currentPrograms,
          publicVisibility: beforePublicVisibility
        },
        null,
        2
      ),
      "utf8"
    );

    let verification: LucImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await findLucUniversity(manager);
      const universitySeed = buildLucUniversityRow(audit, summary, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousOfficialAuditRows = await txProgramRepo.find({
        where: { slug: Like(`${LUC_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
      });
      for (const previous of previousOfficialAuditRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      await txProgramRepo.createQueryBuilder()
        .update(ProgramEntity)
        .set({
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: "Archived by the LUC official review import to prevent stale non-public review rows from mixing with the current 57-row official baseline.",
          reviewReason: "Superseded by the 2026-06-30 LUC undergraduate official review import."
        })
        .where("universityId = :universityId", { universityId: university.id })
        .andWhere("slug NOT LIKE :slugPrefix", { slugPrefix: `${LUC_OFFICIAL_AUDIT_SLUG_PREFIX}%` })
        .andWhere("NOT (isPublished = true AND publicDisplayStatus IN (:...visibleStatuses))", {
          visibleStatuses: ["ready", "current-cycle-not-open", "not-available-for-international"]
        })
        .execute();

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id && !existing.slug.startsWith(LUC_OFFICIAL_AUDIT_SLUG_PREFIX)) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      if (!university.isPublished) {
        university.programCount = summary.importRows;
        await txUniversityRepo.save(university);
      }

      verification = await verifyImportedRows(manager, university.id);
    });

    const refreshedUniversity = await universityRepo.findOne({ where: { id: university?.id } });
    const afterPublicVisibility = await publicVisibilitySnapshot(dataSource, refreshedUniversity);
    const catalogCacheCleared = await clearCatalogCache();
    const report = {
      mode: "imported",
      decision: "review-imported",
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
