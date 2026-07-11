import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const uocImportDir = resolve(repositoryRoot, "data/imports/uoc/2026-06-25/all-level-publication");

export const UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX = "uoc-public-20260625-";
export const DEFAULT_UOC_UNDERGRADUATE_AUDIT_PATH = resolve(repositoryRoot, "audits/UoC_audit_undergraduate_20260625_reviewed_v3.json");
export const DEFAULT_UOC_MASTER_AUDIT_PATH = resolve(repositoryRoot, "audits/UoC_audit_master_20260625_reviewed_v1.json");
export const DEFAULT_UOC_DOCTORAL_AUDIT_PATH = resolve(repositoryRoot, "audits/UoC_audit_doctoral_20260625_reviewed_v1.json");
export const DEFAULT_UOC_PUBLISH_PLAN_PATH = resolve(uocImportDir, "01_publish_plan.json");
export const DEFAULT_UOC_POST_IMPORT_AUDIT_PATH = resolve(uocImportDir, "02_post_import_audit.json");
export const DEFAULT_UOC_RELEASE_REPORT_PATH = resolve(uocImportDir, "03_release_report.md");

const verifiedAt = "2026-06-25";
const myrToCny = 1.55;
const expectedProgrammes = 38;
const expectedByLevel = { bachelor: 19, master: 14, phd: 5 } as const;
const publicCatalogProgramStatuses = ["ready", "current-cycle-not-open", "not-available-for-international"] as const;
const feeUrl = "https://cyberjaya.edu.my/admission/fees/international-fees-structure";
const applicationUrl = "https://cyberjaya.edu.my/admission/online-application";
const officialWebsite = "https://cyberjaya.edu.my";
const mastersDirectoryUrl = "https://cyberjaya.edu.my/programmes?_by_level=masters";
const phdDirectoryUrl = "https://cyberjaya.edu.my/programmes?_by_level=phd";
const ugProspectusUrl = "https://web.cyberjaya.edu.my/wp-content/uploads/2026/03/FA-A5UG-Prospectus-16-MARCH-2026-cc.pdf";
const pgProspectusUrl = "https://web.cyberjaya.edu.my/wp-content/uploads/2026/05/FA-A5PG-Prospectus-4-MAY-2026.pdf";

type UocAuditLevel = "undergraduate" | "master" | "doctoral";
type UocDegreeLevel = "bachelor" | "master" | "phd";

interface UocEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface UocAuditProgramme {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: UocAuditLevel;
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
  entryRequirement: UocEntryRequirement;
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
  fieldStatus?: Record<string, { status?: string; note?: string; sourceUrl?: string; crawlLevel?: string }>;
  fieldEvidence?: Record<string, unknown>;
  _validationResult?: string;
  _validationIssues?: unknown[];
  _pendingIssues?: unknown[];
}

interface UocReviewedAudit {
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  auditMeta?: {
    targetUniversityShortName?: string;
    targetLevel?: UocAuditLevel;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
  };
  sourceRegistry?: Array<{ url?: string; title?: string; sourceType?: string; status?: string }>;
  programmes: UocAuditProgramme[];
  pending_issues?: unknown[];
  exception_queue?: unknown[];
  validationMeta?: {
    overallDecision?: string;
    counts?: {
      totalProgrammesValidated?: number;
      issuesPending?: number;
    };
  };
}

interface UocAuditInputSet {
  undergraduate: UocReviewedAudit;
  master: UocReviewedAudit;
  doctoral: UocReviewedAudit;
}

interface UocImportSummary {
  importRows: number;
  byLevel: Record<UocDegreeLevel, number>;
  readyRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialFeeRows: number;
  languageRows: number;
  chineseNameRows: number;
  chineseCurriculumRows: number;
  chineseCareerRows: number;
  sourceRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UocVerification extends UocImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  activeSupersededRows: number;
  legacyVisibleRows: number;
  visibleCurrentRows: number;
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

const englishApplicationDocs = [
  "Student Pass or visa processing payment evidence where required.",
  "Passport-size photo with white background.",
  "Full passport copy with validity meeting admission requirements.",
  "Certified academic certificates and transcripts.",
  "EMGS health declaration form.",
  "English language proficiency evidence.",
  "English translations for documents not issued in English.",
  "Where applicable, work-experience evidence, research proposal, reference letters or sponsorship documents."
];

const chineseApplicationDocs = [
  "学生签证或 Student Pass 相关处理费用证明",
  "白底护照尺寸照片",
  "护照全页复印件且护照有效期需满足入学要求",
  "经认证的学历证书和成绩单",
  "EMGS 健康声明表",
  "英语语言能力证明",
  "非英文材料的英文翻译件",
  "如适用，工作经验证明、研究计划、推荐信或资助证明等补充材料"
];

export function validateUocReviewedAudit(audit: UocReviewedAudit, expectedCount: number, targetLevel: UocAuditLevel): string[] {
  const errors: string[] = [];
  if (audit.safe_to_import !== false) errors.push(`${targetLevel}: safe_to_import must remain false.`);
  if (audit.auditMeta?.targetUniversityShortName !== "UoC") errors.push(`${targetLevel}: targetUniversityShortName must be UoC.`);
  if (audit.auditMeta?.targetLevel !== targetLevel) errors.push(`${targetLevel}: targetLevel mismatch.`);
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedCount) errors.push(`${targetLevel}: baseline must be ${expectedCount}.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
    errors.push(`${targetLevel}: expected ${expectedCount} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if ((audit.pending_issues || []).length !== 0) errors.push(`${targetLevel}: pending_issues must be empty.`);
  if (audit.validationMeta?.counts?.issuesPending !== 0) errors.push(`${targetLevel}: validation issuesPending must be 0.`);

  const seenNames = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `${targetLevel} ${index + 1} ${programme.nameEn || "unknown"}`;
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (!hasChinese(programme.name)) errors.push(`${row}: Chinese programme name is required.`);
    if (seenNames.has(programme.nameEn)) errors.push(`${row}: duplicate programme name.`);
    seenNames.add(programme.nameEn);
    if (programme.level !== targetLevel) errors.push(`${row}: level must be ${targetLevel}.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "")) errors.push(`${row}: Chinese faculty is required.`);
    if (!officialUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be UoC official URL.`);
    if (programme.officialFeeSourceUrl && !officialUrl(programme.officialFeeSourceUrl)) {
      errors.push(`${row}: officialFeeSourceUrl must be UoC official URL.`);
    }
    if (programme.publicDisplayStatus !== "ready") errors.push(`${row}: publicDisplayStatus must be ready.`);
    if (programme.auditStatus !== "official-verified-commercial-ready") errors.push(`${row}: auditStatus must be official-verified-commercial-ready.`);
    if (typeof programme.duration !== "number" || programme.duration <= 0) errors.push(`${row}: duration must be positive number.`);
    if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: tuitionMYR must be positive number.`);
    if (!Array.isArray(programme.intake) || programme.intake.some((month) => month < 1 || month > 12)) {
      errors.push(`${row}: intake must be valid month numbers.`);
    }
    if (!programme.language || !(programme.language.ielts || programme.language.toefl || programme.language.muet || programme.language.otherRequirement)) {
      errors.push(`${row}: language requirement is required.`);
    }
    if (!Array.isArray(programme.curriculum) || programme.curriculum.length === 0 || !programme.curriculum.every(hasChinese)) {
      errors.push(`${row}: Chinese curriculum array is required.`);
    }
    if (!Array.isArray(programme.careerProspects) || programme.careerProspects.length === 0 || !programme.careerProspects.every(hasChinese)) {
      errors.push(`${row}: Chinese career array is required.`);
    }
  }
  return errors;
}

export function loadUocReviewedAudits(paths: {
  undergraduatePath?: string;
  masterPath?: string;
  doctoralPath?: string;
} = {}): UocAuditInputSet {
  return {
    undergraduate: loadJson<UocReviewedAudit>(paths.undergraduatePath || DEFAULT_UOC_UNDERGRADUATE_AUDIT_PATH),
    master: loadJson<UocReviewedAudit>(paths.masterPath || DEFAULT_UOC_MASTER_AUDIT_PATH),
    doctoral: loadJson<UocReviewedAudit>(paths.doctoralPath || DEFAULT_UOC_DOCTORAL_AUDIT_PATH)
  };
}

export function buildUocOfficialAuditRows(audits: UocAuditInputSet): Array<DeepPartial<ProgramEntity>> {
  const programmes = [
    ...audits.undergraduate.programmes,
    ...audits.master.programmes,
    ...audits.doctoral.programmes
  ];
  return programmes.map((programme, index) => buildUocProgrammeRow(programme, index + 1));
}

export function summarizeUocOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): UocImportSummary {
  return {
    importRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length,
      master: rows.filter((row) => row.level === "master").length,
      phd: rows.filter((row) => row.level === "phd").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    languageRows: rows.filter((row) => Boolean(row.officialLanguageRequirement)).length,
    chineseNameRows: rows.filter((row) => hasChinese((row.name as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseCurriculumRows: rows.filter((row) => localizedArrayHasChinese(row.curriculum as LocalizedStringArray | undefined)).length,
    chineseCareerRows: rows.filter((row) => localizedArrayHasChinese(row.careers as LocalizedStringArray | undefined)).length,
    sourceRows: rows.filter((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 3).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildUocUniversityRow(
  audits: UocAuditInputSet,
  rows: Array<DeepPartial<ProgramEntity>>,
  existing: UniversityEntity | null = null
): DeepPartial<UniversityEntity> {
  const annualCosts = rows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const ieltsValues = rows
    .map((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0))
    .filter((value) => value > 0);

  return {
    slug: existing?.slug || "university-of-cyberjaya",
    code: existing?.code || "UOC",
    name: existing?.name || t("University of Cyberjaya", "University of Cyberjaya", "赛城大学", "賽城大學"),
    shortName: existing?.shortName || "UoC",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#6F3FA0",
    qsRank: existing?.qsRank || 999,
    qsAsiaRank: existing?.qsAsiaRank ?? 450,
    location: existing?.location || t("Cyberjaya, Selangor, Malaysia", "Cyberjaya, Selangor, Malaysia", "马来西亚雪兰莪赛城", "馬來西亞雪蘭莪賽城"),
    region: existing?.region || t("Selangor", "Selangor", "雪兰莪", "雪蘭莪"),
    ownership: existing?.ownership || "private",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 2005,
    students: existing?.students || 8000,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: existing?.description || t(
      "University of Cyberjaya is a private Malaysian university in Cyberjaya with programmes across medicine, pharmacy, health sciences, psychology, business, technology, creative arts and related fields.",
      "University of Cyberjaya is a private Malaysian university in Cyberjaya with programmes across medicine, pharmacy, health sciences, psychology, business, technology, creative arts and related fields.",
      "赛城大学是一所位于马来西亚雪兰莪赛城的私立大学，提供医学、药剂、健康科学、心理学、商科、科技、创意艺术等领域课程。",
      "賽城大學是一所位於馬來西亞雪蘭莪賽城的私立大學，提供醫學、藥劑、健康科學、心理學、商科、科技、創意藝術等領域課程。"
    ),
    website: existing?.website || officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: existing?.nameEnOfficial || "University of Cyberjaya",
    officialWebsite,
    studyPortalUrl: "https://cyberjaya.edu.my/programmes",
    internationalPageUrl: "https://cyberjaya.edu.my/admission/international-admissions",
    applicationPortalUrl: applicationUrl,
    officialAddress: "University of Cyberjaya (UoC), Persiaran Bestari, Cyber 11, 63000 Cyberjaya, Selangor Darul Ehsan, Malaysia",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: arr(englishApplicationDocs, englishApplicationDocs, chineseApplicationDocs, chineseApplicationDocs),
    chinaStudentRequirements: arr(
      ["UoC does not publish a separate China-specific equivalency route in the collected pages; applications are evaluated through the international admission process and programme entry requirements."],
      ["UoC does not publish a separate China-specific equivalency route in the collected pages; applications are evaluated through the international admission process and programme entry requirements."],
      ["UoC 本次采集页面未单独公布中国学生学历等效路径；申请按国际招生流程和各专业入学要求评估。"],
      ["UoC 本次採集頁面未單獨公布中國學生學歷等效路徑；申請按國際招生流程和各專業入學要求評估。"]
    ),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      uocAllLevelPublication: {
        sourceAudits: {
          undergraduate: relative(repositoryRoot, DEFAULT_UOC_UNDERGRADUATE_AUDIT_PATH),
          master: relative(repositoryRoot, DEFAULT_UOC_MASTER_AUDIT_PATH),
          doctoral: relative(repositoryRoot, DEFAULT_UOC_DOCTORAL_AUDIT_PATH)
        },
        publishedAt: new Date().toISOString(),
        verifiedAt,
        programmes: rows.length,
        byLevel: expectedByLevel,
        sourceDomains: ["cyberjaya.edu.my", "web.cyberjaya.edu.my"],
        exceptions: [
          ...(audits.master.exception_queue || []),
          ...(audits.doctoral.exception_queue || [])
        ]
      },
      rankings: {
        ...asRecord(asRecord(existing?.officialProfile).rankings),
        qsWorld: {
          year: 2027,
          status: "ranked",
          rankDisplay: "Top 1000",
          sourceUrl: pgProspectusUrl,
          retrievedAt: verifiedAt
        },
        qsAsia: {
          year: 2026,
          status: "ranked",
          rankDisplay: "Top 450",
          sourceUrl: pgProspectusUrl,
          retrievedAt: verifiedAt
        }
      }
    },
    officialSources: buildUocUniversitySourceLinks(),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: "University of Cyberjaya bachelor, master and doctoral programmes are published from current UoC official programme pages, official international fees, online application choices and 2026 official prospectuses.",
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualCosts.length ? Math.min(...annualCosts) : existing?.tuitionMinCny || 0,
    tuitionMaxCny: annualCosts.length ? Math.max(...annualCosts) : existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 18000,
    minIelts: ieltsValues.length ? Math.min(...ieltsValues) : existing?.minIelts || 0,
    acceptNoLanguage: existing?.acceptNoLanguage || false,
    facilities: existing?.facilities || arr(
      ["University library", "Science laboratories", "Mock pharmacy", "Health and Psychology Clinic", "Anatomy Gallery", "Simulated clinical wards"],
      ["University library", "Science laboratories", "Mock pharmacy", "Health and Psychology Clinic", "Anatomy Gallery", "Simulated clinical wards"],
      ["大学图书馆", "科学实验室", "模拟药房", "健康与心理诊所", "解剖展厅", "模拟临床病房"],
      ["大學圖書館", "科學實驗室", "模擬藥房", "健康與心理診所", "解剖展廳", "模擬臨床病房"]
    ),
    highlights: arr(
      ["Official all-level UoC catalogue", "Official full-duration international fees", "Programmes across health sciences, business, technology and research"],
      ["Official all-level UoC catalogue", "Official full-duration international fees", "Programmes across health sciences, business, technology and research"],
      ["赛城大学官方本硕博目录", "官方国际学生完整学制费用", "覆盖健康科学、商科、科技与研究型项目"],
      ["賽城大學官方本碩博目錄", "官方國際學生完整學制費用", "覆蓋健康科學、商科、科技與研究型項目"]
    ),
    programCount: rows.length,
    isPublished: true
  };
}

export function verifyUocAllLevelPublicRecordSet(
  university: UniversityEntity,
  publicRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): UocVerification {
  const summary = summarizeUocOfficialAuditImport(publicRows);
  const activeSupersededRows = allUniversityRows.filter((row) =>
    !row.slug.startsWith(UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  );
  const visibleCurrentRows = publicRows.filter((row) =>
    row.isPublished &&
    row.publicDisplayStatus === "ready" &&
    row.slug.startsWith(UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  ).length;

  if (
    publicRows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedByLevel.bachelor ||
    summary.byLevel.master !== expectedByLevel.master ||
    summary.byLevel.phd !== expectedByLevel.phd ||
    summary.readyRows !== expectedProgrammes ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== expectedProgrammes ||
    summary.languageRows !== expectedProgrammes ||
    summary.chineseNameRows !== expectedProgrammes ||
    summary.chineseCurriculumRows !== expectedProgrammes ||
    summary.chineseCareerRows !== expectedProgrammes ||
    summary.sourceRows !== expectedProgrammes ||
    visibleCurrentRows !== expectedProgrammes ||
    activeSupersededRows.length !== 0 ||
    legacyVisibleRows.length !== 0 ||
    university.publicDisplayStatus !== "ready" ||
    !university.isPublished ||
    university.programCount !== expectedProgrammes
  ) {
    throw new Error(`UoC all-level public verification failed: ${JSON.stringify({
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

function buildUocProgrammeRow(programme: UocAuditProgramme, ordinal: number): DeepPartial<ProgramEntity> {
  const level = mapUocLevel(programme.level);
  const tuitionMYR = programme.tuitionMYR || 0;
  const durationYears = programme.duration || 1;
  const code = `UOC-${level.toUpperCase()}-${String(ordinal).padStart(3, "0")}`;
  const sourceUrls = buildUocProgrammeSourceLinks(programme);

  return {
    slug: `${UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
    code,
    name: t(programme.nameEn, programme.nameEn, programme.name, programme.name),
    nameEnOfficial: programme.nameEn,
    level,
    category: inferCategory(programme.nameEn, programme.faculty),
    faculty: t(programme.faculty, programme.faculty, programme.facultyZh || programme.faculty, programme.facultyZh || programme.faculty),
    facultyZh: programme.facultyZh || "",
    studyMode: normalizeText(programme.studyMode || inferStudyMode(programme), 80),
    campus: inferCampus(programme),
    durationYears,
    durationOfficial: buildDurationOfficial(programme),
    annualTuitionCny: Math.round((tuitionMYR * myrToCny) / Math.max(durationYears, 0.5)),
    tuitionAmount: tuitionMYR,
    tuitionCurrency: "MYR" satisfies TuitionCurrency,
    tuitionDisplay: `RM ${formatNumber(tuitionMYR)} Total Payable Fees`,
    officialTuitionMYR: Math.round(tuitionMYR),
    officialTuitionNote: normalizeLongText(programme.tuitionNote || "UoC official International Fees Structure total payable fees for the full programme duration."),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || feeUrl,
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official" satisfies FeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: intakeMonthNames(programme.intake),
    officialIntake: intakeMonthNames(programme.intake).join(", "),
    officialIntakeNote: programme.applicationDeadline
      ? `Application deadline: ${programme.applicationDeadline}`
      : "UoC publishes intake months or application choices; programme-level application deadlines were not published in the captured official sources.",
    languageRequirement: buildLanguage(programme),
    officialLanguageRequirement: buildLanguageText(programme),
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
    chinaStudentRequirement: "UoC 未单独公布中国学生学历等效路径；按国际招生流程和该专业入学要求评估。",
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: arr(englishApplicationDocs, englishApplicationDocs, programme.applicationDocs || chineseApplicationDocs, programme.applicationDocs || chineseApplicationDocs),
    curriculum: localizedChineseList(
      programme.curriculum,
      ["See the official University of Cyberjaya programme page and prospectus for the detailed module, research or clinical structure."]
    ),
    careers: localizedChineseList(
      programme.careerProspects,
      ["See the official University of Cyberjaya programme page and prospectus for published career pathways or outcomes."]
    ),
    specializations: arr([]),
    description: t(
      `${programme.nameEn} is published from University of Cyberjaya official programme, fee, application and prospectus evidence.`,
      `${programme.nameEn} is published from University of Cyberjaya official programme, fee, application and prospectus evidence.`,
      `${programme.name} 已按赛城大学官方专业页、国际费用页、申请入口和官方手册证据公开展示。`,
      `${programme.name} 已按賽城大學官方專業頁、國際費用頁、申請入口和官方手冊證據公開展示。`
    ),
    officialAccreditationNote: buildAccreditationNote(programme),
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: programme.officialSourceUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    publicDisplayNote: "已依据赛城大学官方来源完成字段补缺并公开展示；官网未公布字段不作推断。",
    reviewReason: null,
    auditNote: normalizeLongText([
      `Published from UoC reviewed ${programme.level} audit row ${ordinal}.`,
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || feeUrl}.`,
      programme.curriculumNote || "",
      programme.fieldStatus?.publicDisplayStatus?.note || ""
    ].filter(Boolean).join(" ")),
    listTuitionText: `RM ${formatNumber(tuitionMYR)}`,
    isPublished: true
  };
}

async function verifyImportedUocRows(manager: EntityManager | DataSource, universityId: number) {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("UoC university row not found during verification.");
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  const publicRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number])
  );
  return verifyUocAllLevelPublicRecordSet(university, publicRows, allUniversityRows);
}

async function runUocPublication(options: {
  undergraduatePath: string;
  masterPath: string;
  doctoralPath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audits = loadUocReviewedAudits(options);
  const validationErrors = [
    ...validateUocReviewedAudit(audits.undergraduate, expectedByLevel.bachelor, "undergraduate"),
    ...validateUocReviewedAudit(audits.master, expectedByLevel.master, "master"),
    ...validateUocReviewedAudit(audits.doctoral, expectedByLevel.phd, "doctoral")
  ];
  if (validationErrors.length) throw new Error(`UoC reviewed audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildUocOfficialAuditRows(audits);
  const summary = summarizeUocOfficialAuditImport(rows);
  const plan = buildPublishPlan(options, summary, audits);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "uoc-all-level-dry-run",
      planPath: options.planOutput,
      summary,
      nextStep: "Run npm --workspace @studymy/api run import:uoc:official-audit -- --confirm-import"
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "UOC" } })) ||
      (await universityRepo.findOne({ where: { slug: "university-of-cyberjaya" } }));

    if (options.verifyOnly) {
      if (!university) throw new Error("UoC university row not found.");
      const verification = await verifyImportedUocRows(dataSource, university.id);
      console.log(JSON.stringify({ mode: "uoc-all-level-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: "university-of-cyberjaya" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug university-of-cyberjaya belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/uoc-all-level-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: UocVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "UOC" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: "university-of-cyberjaya" } }));

      const universitySeed = buildUocUniversityRow(audits, rows, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX}%`) }
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
          row.publicDisplayNote = "Archived because the UoC all-level official publication batch supersedes this legacy or review row.";
          row.reviewReason = normalizeLongText([
            row.reviewReason,
            "Archived by UoC all-level official publication; current public display uses uoc-public-20260625 rows."
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
      verification = await verifyImportedUocRows(manager, university.id);
    });

    if (!verification) throw new Error("UoC all-level publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    const postImportAudit = buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared);
    writeJson(options.postImportAuditOutput, postImportAudit);
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "uoc-all-level-published",
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

function buildPublishPlan(
  options: { undergraduatePath: string; masterPath: string; doctoralPath: string },
  summary: UocImportSummary,
  audits: UocAuditInputSet
) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "UOC",
      shortName: "UoC",
      name: "University of Cyberjaya",
      slug: "university-of-cyberjaya"
    },
    authorization: "operator-requested-publication",
    sourceInputs: {
      undergraduateAudit: relative(repositoryRoot, options.undergraduatePath),
      masterAudit: relative(repositoryRoot, options.masterPath),
      doctoralAudit: relative(repositoryRoot, options.doctoralPath),
      sourceAuditSafeToImport: false,
      sourceAuditReason: "StudyMY audit JSON stays safe_to_import=false by contract; this importer publishes only after explicit operator command."
    },
    writePolicy: {
      importer: "apps/api/src/db/import-uoc-official-audit.ts",
      mode: "publish-all-levels",
      upsertPrefix: UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
      universityRow: "upsert by code UOC or slug university-of-cyberjaya",
      programmeRows: "upsert 38 current UoC public rows and archive non-current UoC rows",
      transactional: true,
      backupRequired: true
    },
    expectedSurface: {
      programmeCount: expectedProgrammes,
      byLevel: expectedByLevel,
      summary,
      exceptions: [
        ...(audits.undergraduate.exception_queue || []),
        ...(audits.master.exception_queue || []),
        ...(audits.doctoral.exception_queue || [])
      ]
    }
  };
}

function buildPostImportAudit(
  summary: UocImportSummary,
  verification: UocVerification,
  backupPath: string,
  catalogCacheCleared: boolean
) {
  return {
    schemaVersion: 1,
    mode: "uoc-all-level-published",
    createdAt: new Date().toISOString(),
    institution: {
      code: "UOC",
      name: "University of Cyberjaya",
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
      rowsReady: verification.readyRows
    },
    displayHygiene: {
      chineseNameRows: verification.chineseNameRows,
      chineseCurriculumRows: verification.chineseCurriculumRows,
      chineseCareerRows: verification.chineseCareerRows,
      languageRows: verification.languageRows,
      officialFeeRows: verification.officialFeeRows,
      sourceRows: verification.sourceRows
    }
  };
}

function buildReleaseReportMarkdown(verification: UocVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# UoC All-Level Official Publication Report",
    "",
    "- Decision: published for operator review",
    "- Scope: University of Cyberjaya official bachelor, master and doctoral programmes",
    `- Published rows: ${verification.publishedRows}`,
    `- By level: bachelor ${verification.byLevel.bachelor}, master ${verification.byLevel.master}, phd ${verification.byLevel.phd}`,
    `- Ready rows: ${verification.readyRows}`,
    `- Official fee rows: ${verification.officialFeeRows}`,
    `- Language rows: ${verification.languageRows}`,
    `- Active superseded rows: ${verification.activeSupersededRows}`,
    `- Legacy visible rows: ${verification.legacyVisibleRows}`,
    `- University programCount: ${verification.universityProgramCount}`,
    `- Catalog cache cleared: ${catalogCacheCleared ? "yes" : "not configured"}`,
    `- Backup: ${relative(repositoryRoot, backupPath)}`,
    "",
    "## Accepted Exceptions",
    "",
    "- MBA Dual Award Top Up is excluded because it is a top-up fee path, not a standalone public programme.",
    "- DBA ODL is excluded because only a fee row was verified; no current standalone detail/prospectus programme entry was confirmed.",
    "- Programme-level application deadlines are marked official-unpublished where UoC does not publish them.",
    "",
    "## Official Sources",
    "",
    `- ${mastersDirectoryUrl}`,
    `- ${phdDirectoryUrl}`,
    `- ${feeUrl}`,
    `- ${applicationUrl}`,
    `- ${ugProspectusUrl}`,
    `- ${pgProspectusUrl}`,
    ""
  ].join("\n");
}

function buildUocProgrammeSourceLinks(programme: UocAuditProgramme): OfficialSourceLink[] {
  const evidence = asRecord(programme.fieldEvidence);
  const evidenceUrls = Object.values(evidence)
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (Array.isArray(value)) return value.filter((item) => typeof item === "string") as string[];
      return [];
    })
    .filter((value) => /^https?:\/\//i.test(value));
  const prospectusUrl = programme.level === "undergraduate" ? ugProspectusUrl : pgProspectusUrl;
  const urls = new Set([
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || feeUrl,
    applicationUrl,
    prospectusUrl,
    ...evidenceUrls
  ].filter(Boolean));

  return Array.from(urls).map((url) => ({
    title: sourceLinkTitle(url, programme),
    url,
    sourceType: sourceLinkType(url),
    verifiedAt,
    status: "official-verified",
    note: url === (programme.officialFeeSourceUrl || feeUrl)
      ? "UoC official International Fees Structure used for full-duration Total Payable Fees."
      : "Official UoC source used for the 2026-06-25 public audit."
  }));
}

function buildUocUniversitySourceLinks(): OfficialSourceLink[] {
  return [
    officialWebsite,
    "https://cyberjaya.edu.my/programmes",
    mastersDirectoryUrl,
    phdDirectoryUrl,
    feeUrl,
    applicationUrl,
    "https://cyberjaya.edu.my/admission/international-admissions",
    ugProspectusUrl,
    pgProspectusUrl
  ].map((url) => ({
    title: sourceLinkTitle(url),
    url,
    sourceType: sourceLinkType(url),
    verifiedAt,
    status: "official-verified",
    note: "Official UoC university/programme source used for all-level publication."
  }));
}

function buildLanguage(programme: UocAuditProgramme): LanguageRequirement {
  return {
    ielts: programme.language?.ielts || 0,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: UocAuditProgramme) {
  const parts = [
    programme.language?.ielts ? `IELTS ${programme.language.ielts}` : "",
    programme.language?.toefl ? `TOEFL ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver ? `Waiver: ${programme.language.waiver}` : ""
  ].filter(Boolean);
  return normalizeLongText(parts.join("; "));
}

function buildAcademicRequirement(programme: UocAuditProgramme) {
  const requirement = programme.entryRequirement;
  return normalizeLongText([
    requirement.degreeLevel ? `Degree level: ${requirement.degreeLevel}.` : "",
    requirement.degreeRelevance ? `Degree relevance: ${requirement.degreeRelevance}.` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `Published GPA threshold: ${requirement.minGPA}/${requirement.gpaScale || 4}.` : "",
    requirement.workExperience ? `Work or experience requirement: ${requirement.workExperience}.` : "",
    "See the official UoC programme page and admission review for final equivalency assessment."
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirementZh(programme: UocAuditProgramme) {
  const requirement = programme.entryRequirement;
  return normalizeLongText([
    requirement.degreeLevel ? `学历层级：${requirement.degreeLevel}。` : "",
    requirement.degreeRelevance ? `相关背景：${requirement.degreeRelevance}。` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `官方 GPA/CGPA 门槛：${requirement.minGPA}/${requirement.gpaScale || 4}。` : "",
    requirement.workExperience ? `工作经验要求：${requirement.workExperience}。` : "",
    "最终等效资格以 UoC 官方专业页和录取审核为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: UocAuditProgramme) {
  return normalizeLongText([
    programme.studyModeNote || "",
    programme.thesisRequired === true ? "Thesis or research project required." : "",
    programme.thesisNote || "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.supervisorSystem === true ? "Supervisor or research supervision applies." : "",
    programme.fieldStatus?.applicationDeadline?.note || ""
  ].filter(Boolean).join(" "));
}

function buildDurationOfficial(programme: UocAuditProgramme) {
  const standard = `${programme.duration} ${programme.duration === 1 ? "year" : "years"}`;
  return normalizeText(programme.studyModeNote ? `${standard}. ${programme.studyModeNote}` : standard, 500);
}

function buildAccreditationNote(programme: UocAuditProgramme) {
  const evidence = asRecord(programme.fieldEvidence);
  const note = evidence.accreditationOrApprovalNote || evidence.accreditationNote || evidence.approvalCode;
  return note ? normalizeLongText(note) : null;
}

function localizedChineseList(chineseItems: string[], englishItems: string[]): LocalizedStringArray {
  return arr(englishItems, englishItems, chineseItems, chineseItems);
}

function mapUocLevel(level: UocAuditLevel): UocDegreeLevel {
  if (level === "undergraduate") return "bachelor";
  if (level === "doctoral") return "phd";
  return "master";
}

function inferStudyMode(programme: UocAuditProgramme) {
  const text = `${programme.nameEn} ${programme.studyModeNote || ""}`.toLowerCase();
  if (/open\s*&?\s*distance|odl|online-distance/.test(text)) return "online-distance-learning";
  if (/research|phd|doctor of philosophy/.test(text)) return "research";
  return "on-campus";
}

function inferCampus(programme: UocAuditProgramme) {
  return inferStudyMode(programme) === "online-distance-learning" ? "Online & Distance Learning" : "Cyberjaya Main Campus";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|mba|management|finance|accounting|economics|marketing|commerce|administration/.test(value)) return "business";
  if (/computer|information|analytics|data|software|digital|technology|multimedia|cyber|animation/.test(value)) return "it";
  if (/engineering|biomedical/.test(value)) return "engineering";
  if (/medicine|medical|nursing|pharmacy|pharmaceutical|physiotherapy|dietetics|health|psychology|counselling|homeopathic|clinical/.test(value)) return "medicine";
  if (/science|biology|chemistry|occupational safety/.test(value)) return "science";
  return "arts";
}

function intakeMonthNames(months: number[]) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (months || []).map((month) => names[month - 1]).filter(Boolean);
}

function sourceLinkTitle(url: string, programme?: UocAuditProgramme) {
  if (url === officialWebsite) return "UoC official website";
  if (url.includes("/programmes")) return "UoC programme directory";
  if (url === feeUrl) return "UoC International Fees Structure";
  if (url === applicationUrl) return "UoC Online Application";
  if (url === ugProspectusUrl) return "UoC Undergraduate Prospectus 2026";
  if (url === pgProspectusUrl) return "UoC Postgraduate Prospectus 2026";
  if (programme && url === programme.officialSourceUrl) return "Official programme page";
  if (/international-admissions/i.test(url)) return "UoC International Admissions";
  return "Official UoC source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/fee|tuition/.test(value)) return "fee";
  if (/application|admission|international/.test(value)) return "admission";
  if (/programme|programmes|prospectus/.test(value)) return "study-portal";
  if (value === officialWebsite) return "profile";
  return "other";
}

function officialUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "cyberjaya.edu.my" || host.endsWith(".cyberjaya.edu.my");
  } catch {
    return false;
  }
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
  await runUocPublication({
    undergraduatePath: resolve(readArgValue("--undergraduate-audit") || DEFAULT_UOC_UNDERGRADUATE_AUDIT_PATH),
    masterPath: resolve(readArgValue("--master-audit") || DEFAULT_UOC_MASTER_AUDIT_PATH),
    doctoralPath: resolve(readArgValue("--doctoral-audit") || DEFAULT_UOC_DOCTORAL_AUDIT_PATH),
    planOutput: resolve(readArgValue("--plan-output") || DEFAULT_UOC_PUBLISH_PLAN_PATH),
    postImportAuditOutput: resolve(readArgValue("--post-import-audit-output") || DEFAULT_UOC_POST_IMPORT_AUDIT_PATH),
    releaseReportOutput: resolve(readArgValue("--release-report-output") || DEFAULT_UOC_RELEASE_REPORT_PATH),
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
