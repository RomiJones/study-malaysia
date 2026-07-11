import "reflect-metadata";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, type DeepPartial, type EntityManager } from "typeorm";
import type {
  FeeAuditStatus,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  OfficialSourceStatus,
  ProgramCategoryCode,
  PublicDisplayStatus,
  TuitionCurrency
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const uumImportDir = resolve(repositoryRoot, "data/imports/uum/2026-06-27/undergraduate-publication");

export const UUM_PUBLIC_UNDERGRADUATE_SLUG_PREFIX = "uum-undergraduate-20260627-";
export const DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/UUM_audit_undergraduate_20260627_reviewed_v5.json"
);
export const DEFAULT_UUM_PUBLISH_PLAN_PATH = resolve(uumImportDir, "01_publish_plan.json");
export const DEFAULT_UUM_POST_IMPORT_AUDIT_PATH = resolve(uumImportDir, "02_post_import_audit.json");
export const DEFAULT_UUM_RELEASE_REPORT_PATH = resolve(uumImportDir, "03_release_report.md");

const verifiedAt = "2026-06-27";
const myrToCny = 1.55;
const expectedProgrammes = 38;
const universitySlug = "universiti-utara-malaysia-uum";
const officialWebsite = "https://www.uum.edu.my/";
const programmeCatalogueUrl = "http://hea.uum.edu.my/index.php/undergraduate-international#progoffered";
const entryRequirementUrl = "http://hea.uum.edu.my/index.php/undergraduate-international#general";
const languageRequirementUrl = "http://hea.uum.edu.my/index.php/undergraduate-international#english";
const applicationPortalUrl = "https://apply.uum.edu.my/onlineapp_ug/app_login.aspx";
const academicCalendarUrl = "http://hea.uum.edu.my/index.php/academic-calendar-ug";
const feeSourceUrl = "https://drive.google.com/file/d/1ZBVne2hdOeI7gqIGaaGLyklMKNMRppOE/view?usp=drive_link";

const publicCatalogProgramStatuses = [
  "ready",
  "current-cycle-not-open",
  "official-language-requirement-not-published",
  "not-available-for-international"
] as const;

type UumAuditLevel = "undergraduate";
type UumDegreeLevel = "bachelor";
type UumPublicReferenceStatus = Extract<PublicDisplayStatus, "official-language-requirement-not-published">;

interface UumEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface UumAuditProgramme {
  code: string;
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: UumAuditLevel;
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
  entryRequirement: UumEntryRequirement;
  studyMode: string | null;
  studyModeNote: string | null;
  thesisRequired: boolean | null;
  thesisNote: string | null;
  interviewRequired: string | boolean | null;
  interviewNote: string | null;
  supervisorSystem: boolean | null;
  creditHours: number | null;
  publicDisplayStatus: PublicDisplayStatus;
  auditStatus: string;
  remarks?: string | null;
  fieldStatus?: Record<string, { status?: string; note?: string; sourceUrl?: string; crawlLevel?: string }>;
  fieldEvidence?: Record<string, unknown>;
  crawlLog?: Record<string, unknown>;
  _validationResult?: string;
  _validationIssues?: unknown[];
  _pendingIssues?: unknown[];
}

interface UumReviewedAudit {
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  auditMeta?: {
    targetUniversityShortName?: string;
    targetLevel?: UumAuditLevel;
    targetUniversity?: string;
    officialDomain?: string;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
    exceptionCount?: number;
  };
  sourceRegistry?: unknown;
  programmes: UumAuditProgramme[];
  pending_issues?: unknown[];
  exception_queue?: Array<Record<string, unknown>>;
  validationMeta?: {
    overallDecision?: string;
    reviewVersion?: number;
    counts?: {
      totalProgrammesValidated?: number;
      issuesPending?: number;
    };
    languageGateStats?: {
      directIeltsRows?: number;
      noDirectIeltsRows?: number;
      languageSlotMismatchRows?: number;
      equivalentPathMisusedAsIeltsRows?: number;
    };
    qualityRuleCandidates?: unknown[];
  };
  repair_log?: unknown[];
}

interface UumImportSummary {
  importRows: number;
  byLevel: Record<UumDegreeLevel, number>;
  readyRows: number;
  officialLanguageRequirementNotPublishedRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialFeeRows: number;
  directIeltsRows: number;
  missingDirectIeltsRows: number;
  durationKnownRows: number;
  chineseNameRows: number;
  chineseFacultyRows: number;
  chineseCurriculumRows: number;
  chineseCareerRows: number;
  sourceRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UumVerification extends UumImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  activeSupersededRows: number;
  legacyVisibleRows: number;
  visibleCurrentRows: number;
}

const t = (en: string, ms = en, zhCN = en, zhTW = zhCN): LocalizedText => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], ms = en, zhCN = en, zhTW = zhCN): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

const englishApplicationDocs = [
  "Register and submit the international undergraduate application through the UUM online application system.",
  "Use the registered account to save, continue or check submitted international undergraduate application status.",
  "Follow offer, visa, medical examination, registration and fee-payment instructions issued by UUM."
];

const chineseApplicationDocs = [
  "通过 UUM Undergraduate Application (International) 在线申请系统注册账号并提交申请",
  "使用已注册账号保存、继续或查看已提交的国际本科申请状态",
  "按 UUM 录取通知及国际学生流程办理签证、体检、注册和缴费"
];

export function loadUumReviewedAudit(path = DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH): UumReviewedAudit {
  return loadJson<UumReviewedAudit>(path);
}

export function validateUumReviewedAudit(audit: UumReviewedAudit): string[] {
  const errors: string[] = [];
  if (audit.safe_to_import !== false) errors.push("safe_to_import must remain false.");
  if (audit.import_approved_by != null || audit.import_approved_at != null) errors.push("import approval fields must remain null.");
  if (audit.auditMeta?.targetUniversityShortName !== "UUM") errors.push("targetUniversityShortName must be UUM.");
  if (audit.auditMeta?.targetLevel !== "undergraduate") errors.push("targetLevel must be undergraduate.");
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedProgrammes) errors.push(`baseline must be ${expectedProgrammes}.`);
  if (audit.auditMeta?.totalProgrammesCollected !== expectedProgrammes) errors.push(`collected count must be ${expectedProgrammes}.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedProgrammes) {
    errors.push(`expected ${expectedProgrammes} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if (audit.validationMeta?.overallDecision !== "PASS-WITH-EXCEPTIONS") {
    errors.push("validationMeta.overallDecision must be PASS-WITH-EXCEPTIONS.");
  }
  if (audit.validationMeta?.counts?.totalProgrammesValidated !== expectedProgrammes) {
    errors.push(`validation totalProgrammesValidated must be ${expectedProgrammes}.`);
  }
  if (audit.auditMeta?.readyCount !== expectedProgrammes || audit.auditMeta?.needsReviewCount !== 0) {
    errors.push("reviewed audit must have 38 ready rows and 0 needs-review rows before publication mapping.");
  }

  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `undergraduate ${index + 1} ${programme.code || "unknown"} ${programme.nameEn || "unknown"}`;
    if (!programme.code) errors.push(`${row}: code is required.`);
    if (seenCodes.has(programme.code)) errors.push(`${row}: duplicate programme code.`);
    seenCodes.add(programme.code);
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (seenNames.has(programme.nameEn)) errors.push(`${row}: duplicate programme name.`);
    seenNames.add(programme.nameEn);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn || !programme.name.includes(`（${programme.nameEn}）`)) {
      errors.push(`${row}: Chinese bilingual programme name is required.`);
    }
    if (programme.level !== "undergraduate") errors.push(`${row}: level must be undergraduate.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) errors.push(`${row}: Chinese faculty is required.`);
    if (!programme.officialSourceUrl || !/^https?:\/\//i.test(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl is required.`);
    if (!programme.officialFeeSourceUrl || !/^https?:\/\//i.test(programme.officialFeeSourceUrl)) errors.push(`${row}: officialFeeSourceUrl is required.`);
    if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: tuitionMYR must be a positive official total.`);
    if (programme.publicDisplayStatus !== "ready") errors.push(`${row}: source audit publicDisplayStatus must be ready.`);
    if (programme.auditStatus !== "official-verified-commercial-ready") errors.push(`${row}: auditStatus must be official-verified-commercial-ready.`);
    if (programme._pendingIssues?.length) errors.push(`${row}: _pendingIssues must be empty.`);
  }

  const directIeltsRows = (audit.programmes || []).filter((programme) => Number(programme.language?.ielts || 0) > 0);
  if (directIeltsRows.length !== 1 || directIeltsRows[0]?.code !== "UU6481001" || directIeltsRows[0]?.language?.ielts !== 5.5) {
    errors.push("UUM direct IELTS publication partition must be exactly one row: UU6481001 IELTS 5.5.");
  }

  return errors;
}

export function buildUumOfficialAuditRows(audit: UumReviewedAudit): Array<DeepPartial<ProgramEntity>> {
  return audit.programmes.map((programme, index) => buildUumProgrammeRow(programme, index + 1));
}

export function summarizeUumOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): UumImportSummary {
  return {
    importRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    officialLanguageRequirementNotPublishedRows: rows.filter(
      (row) => row.publicDisplayStatus === "official-language-requirement-not-published"
    ).length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    directIeltsRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0).length,
    missingDirectIeltsRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) <= 0).length,
    durationKnownRows: rows.filter((row) => Number(row.durationYears || 0) > 0).length,
    chineseNameRows: rows.filter((row) => hasChinese((row.name as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseFacultyRows: rows.filter((row) => hasChinese((row.faculty as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseCurriculumRows: rows.filter((row) => localizedArrayHasChinese(row.curriculum as LocalizedStringArray | undefined)).length,
    chineseCareerRows: rows.filter((row) => localizedArrayHasChinese(row.careers as LocalizedStringArray | undefined)).length,
    sourceRows: rows.filter((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 3).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildUumUniversityRow(
  audit: UumReviewedAudit,
  rows: Array<DeepPartial<ProgramEntity>>,
  existing: UniversityEntity | null = null
): DeepPartial<UniversityEntity> {
  const annualCosts = rows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const ieltsValues = rows.map((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0)).filter((value) => value > 0);

  return {
    slug: existing?.slug || universitySlug,
    code: existing?.code || "UUM",
    name: existing?.name || t("Universiti Utara Malaysia (UUM)", "Universiti Utara Malaysia (UUM)", "马来西亚北方大学", "馬來西亞北方大學"),
    shortName: existing?.shortName || "UUM",
    logoUrl: existing?.logoUrl || "/assets/static-html/fallback-university-logo.svg",
    imageUrl: existing?.imageUrl || "/assets/static-html/card-image-photo-1541339907198-e08756dedf3f-8421a6bf5c1a.jpg",
    color: existing?.color || "#003DA5",
    qsRank: existing?.qsRank || 540,
    qsAsiaRank: existing?.qsAsiaRank ?? 65,
    location: existing?.location || t("Sintok, Kedah", "Sintok, Kedah", "吉打新笃", "吉打新篤"),
    region: existing?.region || t("Kedah", "Kedah", "吉打州", "吉打州"),
    ownership: existing?.ownership || "public",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 1984,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: existing?.description || t(
      "Universiti Utara Malaysia (UUM) is a Malaysian public management-focused university. This public catalogue entry is backed by the 2026-06-27 official undergraduate audit.",
      "Universiti Utara Malaysia (UUM) is a Malaysian public management-focused university. This public catalogue entry is backed by the 2026-06-27 official undergraduate audit.",
      "马来西亚北方大学（UUM）是马来西亚公立管理型大学；本公开目录已接入 2026-06-27 官方本科审计数据。",
      "馬來西亞北方大學（UUM）是馬來西亞公立管理型大學；本公開目錄已接入 2026-06-27 官方本科審計資料。"
    ),
    website: officialWebsite,
    admissionEmail: existing?.admissionEmail || "international@uum.edu.my",
    nameEnOfficial: "Universiti Utara Malaysia (UUM)",
    officialWebsite,
    studyPortalUrl: programmeCatalogueUrl,
    internationalPageUrl: programmeCatalogueUrl,
    applicationPortalUrl,
    officialAddress: existing?.officialAddress || "Universiti Utara Malaysia, Sintok, Kedah, Malaysia",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: arr(englishApplicationDocs, englishApplicationDocs, chineseApplicationDocs, chineseApplicationDocs),
    chinaStudentRequirements: arr(
      ["UUM official undergraduate sources publish a general international undergraduate route; this audit did not find a separate China-specific equivalency table."],
      ["UUM official undergraduate sources publish a general international undergraduate route; this audit did not find a separate China-specific equivalency table."],
      ["UUM 官方本科来源公布国际本科统一路径；本轮审计未发现单独中国学生等效学历表。"],
      ["UUM 官方本科來源公布國際本科統一路徑；本輪審計未發現單獨中國學生等效學歷表。"]
    ),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      uumUndergraduatePublication: {
        sourceAudit: relative(repositoryRoot, DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH),
        publishedAt: new Date().toISOString(),
        verifiedAt,
        reviewVersion: audit.validationMeta?.reviewVersion,
        programmes: rows.length,
        byLevel: { bachelor: rows.length },
        readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
        officialLanguageRequirementNotPublishedRows: rows.filter(
          (row) => row.publicDisplayStatus === "official-language-requirement-not-published"
        ).length,
        directIeltsPolicy: "Only direct programme IELTS evidence is written to languageRequirement.ielts; MUET equivalence tables are not converted.",
        pendingIssues: audit.pending_issues || []
      },
      catalogStatusSummary: {
        all: {
          total: rows.length,
          ready: rows.filter((row) => row.publicDisplayStatus === "ready").length,
          officialLanguageRequirementNotPublished: rows.filter(
            (row) => row.publicDisplayStatus === "official-language-requirement-not-published"
          ).length,
          needsReview: 0
        },
        byLevel: {
          bachelor: {
            total: rows.length,
            ready: rows.filter((row) => row.publicDisplayStatus === "ready").length,
            officialLanguageRequirementNotPublished: rows.filter(
              (row) => row.publicDisplayStatus === "official-language-requirement-not-published"
            ).length,
            needsReview: 0
          }
        }
      }
    },
    officialSources: buildUumUniversitySourceLinks(audit),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: "UUM undergraduate programmes are published from UUM HEA international undergraduate, official faculty/school pages, official fee table and application sources. Rows without direct IELTS evidence are displayed as official reference records and are not treated as ready application-planning rows.",
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualCosts.length ? Math.min(...annualCosts) : existing?.tuitionMinCny || 0,
    tuitionMaxCny: annualCosts.length ? Math.max(...annualCosts) : existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 16000,
    minIelts: ieltsValues.length ? Math.min(...ieltsValues) : existing?.minIelts || 5.5,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr(
      ["UUM Sintok campus", "Library", "International undergraduate admission channel"],
      ["UUM Sintok campus", "Library", "International undergraduate admission channel"],
      ["UUM 新笃校区", "图书馆", "国际本科申请通道"],
      ["UUM 新篤校區", "圖書館", "國際本科申請通道"]
    ),
    highlights: existing?.highlights || arr(
      ["Official UUM undergraduate catalogue", "Public management-focused university", "Official international fee table"],
      ["Official UUM undergraduate catalogue", "Public management-focused university", "Official international fee table"],
      ["UUM 官方本科目录", "管理型公立大学", "官方国际学生费用表"],
      ["UUM 官方本科目錄", "管理型公立大學", "官方國際學生費用表"]
    ),
    programCount: rows.length,
    isPublished: true
  };
}

export function verifyUumUndergraduatePublicRecordSet(
  university: UniversityEntity,
  publicRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): UumVerification {
  const summary = summarizeUumOfficialAuditImport(publicRows);
  const activeSupersededRows = allUniversityRows.filter((row) =>
    !row.slug.startsWith(UUM_PUBLIC_UNDERGRADUATE_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(UUM_PUBLIC_UNDERGRADUATE_SLUG_PREFIX)
  );
  const visibleCurrentRows = publicRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    row.slug.startsWith(UUM_PUBLIC_UNDERGRADUATE_SLUG_PREFIX)
  ).length;

  if (
    publicRows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedProgrammes ||
    summary.readyRows !== 1 ||
    summary.officialLanguageRequirementNotPublishedRows !== 37 ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== expectedProgrammes ||
    summary.directIeltsRows !== 1 ||
    summary.missingDirectIeltsRows !== 37 ||
    summary.chineseNameRows !== expectedProgrammes ||
    summary.chineseFacultyRows !== expectedProgrammes ||
    summary.sourceRows !== expectedProgrammes ||
    visibleCurrentRows !== expectedProgrammes ||
    activeSupersededRows.length !== 0 ||
    legacyVisibleRows.length !== 0 ||
    university.publicDisplayStatus !== "ready" ||
    !university.isPublished ||
    university.programCount !== expectedProgrammes
  ) {
    throw new Error(`UUM undergraduate public verification failed: ${JSON.stringify({
      summary,
      activeSupersededRows: activeSupersededRows.map((row) => row.slug),
      legacyVisibleRows: legacyVisibleRows.map((row) => row.slug),
      visibleCurrentRows,
      universityStatus: university.publicDisplayStatus,
      universityPublished: university.isPublished,
      universityProgramCount: university.programCount
    })}`);
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    activeSupersededRows: activeSupersededRows.length,
    legacyVisibleRows: legacyVisibleRows.length,
    visibleCurrentRows
  };
}

function buildUumProgrammeRow(programme: UumAuditProgramme, ordinal: number): DeepPartial<ProgramEntity> {
  const durationYears = typeof programme.duration === "number" && programme.duration > 0 ? programme.duration : 0;
  const tuitionMYR = programme.tuitionMYR || 0;
  const hasDirectIelts = Number(programme.language?.ielts || 0) > 0;
  const publicDisplayStatus: PublicDisplayStatus = hasDirectIelts && durationYears > 0
    ? "ready"
    : "official-language-requirement-not-published" satisfies UumPublicReferenceStatus;
  const sourceUrls = buildUumProgrammeSourceLinks(programme);
  const curriculumZh = displayCurriculumZh(programme);
  const careerZh = displayCareerZh(programme);

  return {
    slug: `${UUM_PUBLIC_UNDERGRADUATE_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.code, 12)}-${slugify(programme.nameEn, 52)}`,
    code: `UUM-UG-${programme.code}`,
    name: t(programme.nameEn, programme.nameEn, programme.name, programme.name),
    nameEnOfficial: programme.nameEn,
    level: "bachelor",
    category: inferCategory(programme.nameEn, programme.faculty),
    faculty: t(programme.faculty, programme.faculty, programme.facultyZh || programme.faculty, programme.facultyZh || programme.faculty),
    facultyZh: programme.facultyZh || "",
    studyMode: "full-time",
    campus: inferCampus(programme),
    durationYears,
    durationOfficial: durationYears
      ? `${formatNumber(durationYears)} ${durationYears === 1 ? "year" : "years"}`
      : "Refer to the official UUM source; duration not published in the structured audit.",
    annualTuitionCny: Math.round((tuitionMYR * myrToCny) / Math.max(durationYears || 1, 1)),
    tuitionAmount: tuitionMYR,
    tuitionCurrency: "MYR" satisfies TuitionCurrency,
    tuitionDisplay: `RM ${formatNumber(tuitionMYR)}`,
    officialTuitionMYR: Math.round(tuitionMYR),
    officialTuitionNote: normalizeLongText([
      "UUM official HEA international undergraduate fee table total tuition fee.",
      sanitizeTuitionNote(programme.tuitionNote)
    ].join(" ")),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || feeSourceUrl,
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official" satisfies FeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: intakeMonthNames(programme.intake),
    officialIntake: intakeMonthNames(programme.intake).join(", "),
    officialIntakeNote: programme.applicationDeadline
      ? normalizeLongText(`Application timing: ${programme.applicationDeadline}`)
      : "UUM public application entry and A261 announcement do not publish programme-specific application deadlines.",
    languageRequirement: buildLanguage(programme),
    officialLanguageRequirement: buildLanguageText(programme, publicDisplayStatus),
    requirement: {
      gpa: programme.entryRequirement?.minGPA || 0,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: t(
        buildAcademicRequirement(programme),
        buildAcademicRequirement(programme),
        buildAcademicRequirementZh(programme),
        buildAcademicRequirementZh(programme)
      )
    },
    officialAcademicRequirement: buildAcademicRequirement(programme),
    chinaStudentRequirement: "UUM 官方本科来源公布国际本科统一路径；本轮审计未发现单独中国学生等效学历表。",
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: arr(englishApplicationDocs, englishApplicationDocs, programme.applicationDocs || chineseApplicationDocs, programme.applicationDocs || chineseApplicationDocs),
    curriculum: arr(displayCurriculumEn(programme), displayCurriculumEn(programme), curriculumZh, curriculumZh),
    careers: arr(displayCareerEn(programme), displayCareerEn(programme), careerZh, careerZh),
    specializations: arr([]),
    description: t(
      `${programme.nameEn} is published from UUM official undergraduate audit evidence. Rows without direct IELTS evidence are displayed as official reference records.`,
      `${programme.nameEn} is published from UUM official undergraduate audit evidence. Rows without direct IELTS evidence are displayed as official reference records.`,
      `${programme.name} 已按 UUM 官方本科审计证据公开展示；未直接公布 IELTS 的记录按官方参考展示，不进入 ready 申请规划口径。`,
      `${programme.name} 已按 UUM 官方本科審計證據公開展示；未直接公布 IELTS 的記錄按官方參考展示，不進入 ready 申請規劃口徑。`
    ),
    officialAccreditationNote: null,
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: entryRequirementUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    publicDisplayStatus,
    publicDisplayNote: publicDisplayStatus === "ready"
      ? "UUM 官方来源直接公布 IELTS，本记录可进入 ready 申请规划口径。"
      : "UUM 官方来源未直接公布本专业 IELTS；本记录作为官方本科参考展示，语言要求请以详情页官方说明为准。",
    reviewReason: publicDisplayStatus === "ready" ? null : "Direct IELTS requirement is not published by UUM for this programme; MUET/equivalence evidence is retained only in details.",
    auditNote: normalizeLongText([
      `Published from UUM undergraduate reviewed audit row ${ordinal}.`,
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || feeSourceUrl}.`,
      programme.remarks || "",
      programme.curriculumNote || "",
      programme.studyModeNote || "",
      programme.interviewNote || "",
      ...(programme._validationIssues || []).map(formatAuditIssue)
    ].filter(Boolean).join(" ")),
    listTuitionText: `RM ${formatNumber(tuitionMYR)}`,
    isPublished: true
  };
}

async function verifyImportedUumRows(manager: EntityManager | DataSource, universityId: number) {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("UUM university row not found during verification.");
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  const publicRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number])
  );
  return verifyUumUndergraduatePublicRecordSet(university, publicRows, allUniversityRows);
}

async function runUumPublication(options: {
  undergraduatePath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audit = loadUumReviewedAudit(options.undergraduatePath);
  const validationErrors = validateUumReviewedAudit(audit);
  if (validationErrors.length) throw new Error(`UUM undergraduate audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildUumOfficialAuditRows(audit);
  const summary = summarizeUumOfficialAuditImport(rows);
  const plan = buildPublishPlan(options, summary, audit);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "uum-undergraduate-dry-run",
      planPath: options.planOutput,
      summary,
      nextStep: "Run npm --workspace @studymy/api run import:uum:official-audit -- --confirm-import"
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "UUM" } })) ||
      (await universityRepo.findOne({ where: { slug: universitySlug } }));

    if (options.verifyOnly) {
      if (!university) throw new Error("UUM university row not found.");
      const verification = await verifyImportedUumRows(dataSource, university.id);
      console.log(JSON.stringify({ mode: "uum-undergraduate-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: universitySlug } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug ${universitySlug} belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/uum-undergraduate-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: UumVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "UUM" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: universitySlug } }));

      const universitySeed = buildUumUniversityRow(audit, rows, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UUM_PUBLIC_UNDERGRADUATE_SLUG_PREFIX}%`) }
      });
      for (const previous of previousCurrentRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      const allRows = await txProgramRepo.find({ where: { universityId: university.id } });
      for (const row of allRows) {
        if (!incomingSlugs.has(row.slug)) {
          row.isPublished = false;
          row.publicDisplayStatus = "archived";
          row.publicDisplayNote = "Archived because the UUM undergraduate official publication batch supersedes this legacy or review row.";
          row.reviewReason = normalizeLongText([
            row.reviewReason,
            "Archived by UUM undergraduate official publication; current public display uses uum-undergraduate-20260627 rows."
          ].filter(Boolean).join(" "));
          await txProgramRepo.save(row);
        }
      }

      const publicVisibleRows = await txProgramRepo.find({
        where: {
          universityId: university.id,
          isPublished: true,
          publicDisplayStatus: In([...publicCatalogProgramStatuses])
        }
      });
      const annualCosts = publicVisibleRows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
      const ieltsValues = publicVisibleRows.map((row) => Number(row.languageRequirement?.ielts || 0)).filter((value) => value > 0);
      university.programCount = publicVisibleRows.length;
      if (annualCosts.length) {
        university.tuitionMinCny = Math.min(...annualCosts);
        university.tuitionMaxCny = Math.max(...annualCosts);
      }
      if (ieltsValues.length) university.minIelts = Math.min(...ieltsValues);
      university = await txUniversityRepo.save(university);
      verification = await verifyImportedUumRows(manager, university.id);
    });

    if (!verification) throw new Error("UUM undergraduate publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    writeJson(options.postImportAuditOutput, buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared));
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "uum-undergraduate-published",
      universityId: university?.id,
      backupPath,
      catalogCacheCleared,
      summary,
      verification,
      artifacts: {
        planPath: options.planOutput,
        postImportAuditPath: options.postImportAuditOutput,
        releaseReportPath: options.releaseReportOutput
      }
    }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

function buildPublishPlan(options: { undergraduatePath: string }, summary: UumImportSummary, audit: UumReviewedAudit) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "UUM",
      shortName: "UUM",
      name: "Universiti Utara Malaysia",
      slug: universitySlug
    },
    authorization: "ian-requested-publication-after-review-v5",
    sourceInputs: {
      undergraduateAudit: relative(repositoryRoot, options.undergraduatePath),
      sourceAuditSafeToImport: false,
      sourceAuditReason: "StudyMY audit JSON stays safe_to_import=false by contract; this importer publishes only after explicit operator command."
    },
    writePolicy: {
      importer: "apps/api/src/db/import-uum-official-audit.ts",
      mode: "publish-undergraduate",
      upsertPrefix: UUM_PUBLIC_UNDERGRADUATE_SLUG_PREFIX,
      universityRow: `upsert by code UUM or slug ${universitySlug}`,
      programmeRows: "upsert 38 current UUM undergraduate public rows and archive non-current UUM rows",
      transactional: true,
      backupRequired: true
    },
    publicationPolicy: {
      readyRows: summary.readyRows,
      officialLanguageRequirementNotPublishedRows: summary.officialLanguageRequirementNotPublishedRows,
      rationale: "UUM directly publishes IELTS for only UU6481001. Other rows remain visible official reference records without being treated as ready application-planning rows.",
      languageGateStats: audit.validationMeta?.languageGateStats
    },
    expectedSurface: {
      programmeCount: expectedProgrammes,
      byLevel: { bachelor: expectedProgrammes },
      summary,
      validationMeta: audit.validationMeta,
      pendingIssues: audit.pending_issues || []
    }
  };
}

function buildPostImportAudit(
  summary: UumImportSummary,
  verification: UumVerification,
  backupPath: string,
  catalogCacheCleared: boolean
) {
  return {
    schemaVersion: 1,
    mode: "uum-undergraduate-published",
    createdAt: new Date().toISOString(),
    institution: {
      code: "UUM",
      name: "Universiti Utara Malaysia",
      importedRows: summary.importRows,
      byLevel: summary.byLevel
    },
    database: {
      backupPath: relative(repositoryRoot, backupPath),
      transactionalImport: "passed",
      catalogCacheCleared,
      scopedRows: verification.importRows,
      activeSupersededRows: verification.activeSupersededRows,
      legacyVisibleRows: verification.legacyVisibleRows,
      visibleCurrentRows: verification.visibleCurrentRows
    },
    publicVisibility: {
      universityPublicDisplayStatus: verification.universityPublicDisplayStatus,
      universityIsPublished: verification.universityIsPublished,
      universityProgramCount: verification.universityProgramCount,
      rowsPublished: verification.publishedRows,
      rowsReady: verification.readyRows,
      rowsOfficialLanguageRequirementNotPublished: verification.officialLanguageRequirementNotPublishedRows
    },
    displayGate: {
      chineseNameRows: verification.chineseNameRows,
      chineseFacultyRows: verification.chineseFacultyRows,
      chineseCurriculumRows: verification.chineseCurriculumRows,
      chineseCareerRows: verification.chineseCareerRows,
      directIeltsRows: verification.directIeltsRows,
      missingDirectIeltsRows: verification.missingDirectIeltsRows,
      officialFeeRows: verification.officialFeeRows,
      durationKnownRows: verification.durationKnownRows,
      sourceRows: verification.sourceRows
    }
  };
}

function buildReleaseReportMarkdown(verification: UumVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# UUM Undergraduate Official Publication Report",
    "",
    "- Decision: published for Ian review",
    "- Scope: Universiti Utara Malaysia official undergraduate programmes",
    `- Published rows: ${verification.publishedRows}`,
    `- By level: bachelor ${verification.byLevel.bachelor}`,
    `- Ready application-planning rows: ${verification.readyRows}`,
    `- Official language-not-published reference rows: ${verification.officialLanguageRequirementNotPublishedRows}`,
    `- Direct IELTS rows: ${verification.directIeltsRows}`,
    `- Missing direct IELTS rows: ${verification.missingDirectIeltsRows}`,
    `- Official fee rows: ${verification.officialFeeRows}`,
    `- Chinese programme name rows: ${verification.chineseNameRows}`,
    `- Chinese faculty rows: ${verification.chineseFacultyRows}`,
    `- Active superseded rows: ${verification.activeSupersededRows}`,
    `- Legacy visible rows: ${verification.legacyVisibleRows}`,
    `- University programCount: ${verification.universityProgramCount}`,
    `- Catalog cache cleared: ${catalogCacheCleared ? "yes" : "not configured"}`,
    `- Backup: ${relative(repositoryRoot, backupPath)}`,
    "",
    "## Publication Boundary",
    "",
    "- 38 UUM undergraduate programmes are visible in the public catalogue.",
    "- Only UU6481001 has direct official IELTS 5.5 evidence and is marked ready.",
    "- The remaining 37 rows are visible official reference rows because UUM publishes MUET/direct language notes but not direct IELTS; MUET equivalence was not converted to IELTS.",
    "",
    "## Official Sources",
    "",
    `- ${officialWebsite}`,
    `- ${programmeCatalogueUrl}`,
    `- ${entryRequirementUrl}`,
    `- ${languageRequirementUrl}`,
    `- ${feeSourceUrl}`,
    `- ${applicationPortalUrl}`,
    ""
  ].join("\n");
}

function buildUumProgrammeSourceLinks(programme: UumAuditProgramme): OfficialSourceLink[] {
  const urls = new Set([
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || feeSourceUrl,
    programmeCatalogueUrl,
    entryRequirementUrl,
    languageRequirementUrl,
    academicCalendarUrl,
    applicationPortalUrl,
    ...urlsFromUnknown(programme.fieldEvidence),
    ...urlsFromUnknown(programme.fieldStatus),
    ...urlsFromUnknown(programme.crawlLog)
  ].filter(Boolean));

  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({
      title: sourceLinkTitle(url, programme),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: url === (programme.officialFeeSourceUrl || feeSourceUrl)
        ? "UUM official HEA international undergraduate fee table source."
        : "Official UUM source used for the 2026-06-27 undergraduate publication audit."
    }));
}

function buildUumUniversitySourceLinks(audit: UumReviewedAudit): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    programmeCatalogueUrl,
    entryRequirementUrl,
    languageRequirementUrl,
    applicationPortalUrl,
    academicCalendarUrl,
    feeSourceUrl,
    ...urlsFromUnknown(audit.sourceRegistry)
  ]);
  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({
      title: sourceLinkTitle(url),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: "Official UUM university/programme source used for undergraduate publication."
    }));
}

function buildLanguage(programme: UumAuditProgramme): LanguageRequirement {
  return {
    ielts: programme.language?.ielts || 0,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: UumAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  const parts = [
    programme.language?.ielts ? `IELTS ${programme.language.ielts}` : "",
    programme.language?.toefl ? `TOEFL ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
    publicDisplayStatus === "official-language-requirement-not-published"
      ? "UUM official HEA language page does not directly publish an IELTS requirement for this programme; MUET/equivalence evidence is retained in details only and is not converted to IELTS."
      : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver ? `Waiver: ${programme.language.waiver}` : ""
  ].filter(Boolean);
  return normalizeLongText(parts.join("; "));
}

function buildAcademicRequirement(programme: UumAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `Qualification: ${requirement.degreeLevel}.` : "",
    requirement.degreeRelevance ? `Relevant background: ${requirement.degreeRelevance}.` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `Published CGPA threshold: ${requirement.minGPA}/${requirement.gpaScale || 4}.` : "",
    requirement.workExperience ? `Work or experience requirement: ${requirement.workExperience}.` : "",
    "See UUM official HEA undergraduate entry requirements for final equivalency assessment."
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirementZh(programme: UumAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `学历层级：${requirement.degreeLevel}。` : "",
    requirement.degreeRelevance ? `相关背景：${requirement.degreeRelevance}。` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `官方 CGPA 门槛：${requirement.minGPA}/${requirement.gpaScale || 4}。` : "",
    requirement.workExperience ? `工作经验要求：${requirement.workExperience}。` : "",
    "最终等效资格以 UUM 官方 HEA 本科入学要求审核为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: UumAuditProgramme) {
  return normalizeLongText([
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.creditHours ? `Credit hours: ${programme.creditHours}.` : "",
    programme.thesisNote || "",
    programme.supervisorSystem ? "Supervisor system applies where stated by the official source." : ""
  ].filter(Boolean).join(" "));
}

function displayCurriculumZh(programme: UumAuditProgramme) {
  if (programme.curriculum.length) return programme.curriculum;
  return ["官网未公布具体课程结构"];
}

function displayCurriculumEn(programme: UumAuditProgramme) {
  if (!programme.curriculum.length) return ["Official source does not publish a specific curriculum list for this programme."];
  return [`See the official UUM source for curriculum topics of ${programme.nameEn}.`];
}

function displayCareerZh(programme: UumAuditProgramme) {
  if (programme.careerProspects.length) return programme.careerProspects;
  return ["官网未公布具体职业方向"];
}

function displayCareerEn(programme: UumAuditProgramme) {
  if (!programme.careerProspects.length) return ["Official source does not publish a specific career list for this programme."];
  return [`See the official UUM source for career prospects of ${programme.nameEn}.`];
}

function inferCampus(programme: UumAuditProgramme) {
  const text = `${programme.officialSourceUrl} ${programme.faculty}`.toLowerCase();
  if (/kuala lumpur|kl/.test(text)) return "UUM Kuala Lumpur";
  return "UUM Sintok";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/computer|information technology|multimedia|data|analytics|decision mathematics/.test(value)) return "it";
  if (/law|legal/.test(value)) return "law";
  if (/hospitality|tourism|event/.test(value)) return "hospitality";
  if (/mathematics|statistics|science|agribusiness/.test(value)) return "science";
  if (/communication|media|creative|linguistics|literature|counselling|social work/.test(value)) return "arts";
  if (/business|management|finance|financial|banking|account|marketing|entrepreneur|economics|risk|insurance|muamalat|islamic/.test(value)) return "business";
  return "business";
}

function sanitizeTuitionNote(value: string | null | undefined) {
  return String(value || "")
    .replace(/effective\s+from/gi, "effective beginning")
    .replace(/from the second semester/gi, "beginning the second semester");
}

function formatAuditIssue(value: unknown) {
  const record = asRecord(value);
  return normalizeText([
    record.field ? `Field ${record.field}.` : "",
    record.issueType ? `Issue ${record.issueType}.` : "",
    record.description || ""
  ].filter(Boolean).join(" "), 800);
}

function intakeMonthNames(months: number[]) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (months || []).map((month) => names[month - 1]).filter(Boolean);
}

function sourceLinkTitle(url: string, programme?: UumAuditProgramme) {
  if (url === officialWebsite) return "UUM official website";
  if (url === programmeCatalogueUrl) return "UUM HEA undergraduate international programme catalogue";
  if (url === entryRequirementUrl) return "UUM HEA undergraduate entry requirements";
  if (url === languageRequirementUrl) return "UUM HEA English language requirements";
  if (url === applicationPortalUrl) return "UUM undergraduate international application portal";
  if (url === academicCalendarUrl) return "UUM undergraduate academic calendar";
  if (url === feeSourceUrl) return "UUM official international undergraduate fee table";
  if (programme && url === programme.officialSourceUrl) return "Official programme page";
  if (programme && url === programme.officialFeeSourceUrl) return "Official fee source";
  if (/drive\.google\.com/.test(url)) return "Official linked fee document";
  if (/hea\.uum\.edu\.my/.test(url)) return "UUM HEA source";
  if (/uum\.edu\.my/.test(url)) return "Official UUM source";
  return "Official source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/fee|yuran|drive\.google/.test(value)) return "fee";
  if (/admission|application|apply|entry|requirement|english/.test(value)) return "admission";
  if (/undergraduate|programme|program|hea|school|faculty/.test(value)) return "study-portal";
  if (value === officialWebsite) return "profile";
  return "other";
}

function urlsFromUnknown(value: unknown): string[] {
  const urls: string[] = [];
  const visit = (item: unknown) => {
    if (typeof item === "string") {
      const matches = item.match(/https?:\/\/[^\s)\]}"']+/g) || [];
      urls.push(...matches.map((url) => url.replace(/[.,;:]+$/, "")));
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (item && typeof item === "object") Object.values(item as Record<string, unknown>).forEach(visit);
  };
  visit(value);
  return urls.filter((url) => !url.includes("{"));
}

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function localizedArrayHasChinese(value?: LocalizedStringArray) {
  return Boolean(value?.["zh-CN"]?.length && value["zh-CN"].every(hasChinese));
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });
}

function slugify(value: string, maxLength = 80) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
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

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
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

async function main() {
  await runUumPublication({
    undergraduatePath: resolve(readArgValue("--undergraduate-audit") || DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH),
    planOutput: resolve(readArgValue("--plan-output") || DEFAULT_UUM_PUBLISH_PLAN_PATH),
    postImportAuditOutput: resolve(readArgValue("--post-import-audit-output") || DEFAULT_UUM_POST_IMPORT_AUDIT_PATH),
    releaseReportOutput: resolve(readArgValue("--release-report-output") || DEFAULT_UUM_RELEASE_REPORT_PATH),
    confirm: process.argv.includes("--confirm-import"),
    verifyOnly: process.argv.includes("--verify-only")
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
