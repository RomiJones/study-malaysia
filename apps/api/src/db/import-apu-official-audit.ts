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
const apuImportDir = resolve(repositoryRoot, "data/imports/apu/2026-06-27/all-level-publication");

export const APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX = "apu-public-20260627-";
export const DEFAULT_APU_UNDERGRADUATE_AUDIT_PATH = resolve(repositoryRoot, "audits/APU_audit_undergraduate_20260626_reviewed_v1.json");
export const DEFAULT_APU_MASTER_AUDIT_PATH = resolve(repositoryRoot, "audits/APU_audit_master_20260626_reviewed_v1.json");
export const DEFAULT_APU_DOCTORAL_AUDIT_PATH = resolve(repositoryRoot, "audits/APU_audit_doctoral_20260627.json");
export const DEFAULT_APU_PUBLISH_PLAN_PATH = resolve(apuImportDir, "01_publish_plan.json");
export const DEFAULT_APU_POST_IMPORT_AUDIT_PATH = resolve(apuImportDir, "02_post_import_audit.json");
export const DEFAULT_APU_RELEASE_REPORT_PATH = resolve(apuImportDir, "03_release_report.md");

const verifiedAt = "2026-06-27";
const myrToCny = 1.55;
const expectedProgrammes = 107;
const expectedByLevel = { bachelor: 56, master: 42, phd: 9 } as const;
const publicCatalogProgramStatuses = ["ready", "current-cycle-not-open", "not-available-for-international"] as const;
const officialWebsite = "https://www.apu.edu.my";
const programmeCatalogueUrl = "https://www.apu.edu.my/our-courses";
const undergraduateDirectoryUrl = "https://www.apu.edu.my/our-courses#text_block-25385";
const masterDirectoryUrl = "https://www.apu.edu.my/our-courses#text_block-25386";
const doctoralDirectoryUrl = "https://www.apu.edu.my/our-courses#text_block-25388";
const postgraduateLandingUrl = "https://www.apu.edu.my/postgraduate-studies";
const englishRequirementsUrl = "https://www.apu.edu.my/english-requirements";
const intakeCalendarUrl = "https://www.apu.edu.my/intake-calendar";
const applicationProceduresUrl = "https://www.apu.edu.my/international-students-application-procedures";
const applicationPortalUrl = "https://admissions.apu.edu.my/";
const phdTitleBankUrl = "https://www.apu.edu.my/node/409";
const postgraduateBrochurePdf = "https://publicwebsite-media.apu.edu.my/assets/2026-04/e2026_pg_brochure-v2.pdf?VersionId=XtCMIppR9Tjwq0VNWUFMiYXFu_GEit8m";

type ApuAuditLevel = "undergraduate" | "master" | "doctoral";
type ApuDegreeLevel = "bachelor" | "master" | "phd";

interface ApuEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface ApuAuditProgramme {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: ApuAuditLevel;
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
  entryRequirement: ApuEntryRequirement;
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

interface ApuPublicationAudit {
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  auditMeta?: {
    targetUniversityShortName?: string;
    targetLevel?: ApuAuditLevel;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
    exceptionCount?: number;
  };
  sourceRegistry?: unknown;
  programmes: ApuAuditProgramme[];
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

interface ApuAuditInputSet {
  undergraduate: ApuPublicationAudit;
  master: ApuPublicationAudit;
  doctoral: ApuPublicationAudit;
}

interface ApuImportSummary {
  importRows: number;
  byLevel: Record<ApuDegreeLevel, number>;
  readyRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialFeeRows: number;
  languageRows: number;
  chineseNameRows: number;
  chineseFacultyRows: number;
  chineseCurriculumRows: number;
  chineseCareerRows: number;
  sourceRows: number;
  officialUnpublishedCareerRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface ApuVerification extends ApuImportSummary {
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
  "Complete the APU online application form and select the intended programme and intake.",
  "Submit certified academic certificates and transcripts; documents not issued in English require English translation.",
  "Submit IELTS, TOEFL, PTE, MUET or other English-language evidence where applicable.",
  "Pay the pre-arrival application processing fee after receiving the offer letter.",
  "Submit a passport-size photo with white background.",
  "Submit a full passport copy with validity covering at least 24 months after intake.",
  "Submit the health declaration form and complete EMGS or APU medical-screening steps.",
  "Where applicable, submit NOC, LOE, visa-cancellation, release letter, attendance record or other supplementary documents."
];

const chineseApplicationDocs = [
  "填写 APU 在线申请表并选择申请专业与入学日期",
  "提交经认证的学历文件；非英文文件需附英文翻译",
  "提交 IELTS、TOEFL、PTE、MUET 等英语能力证明（如适用）",
  "收到录取通知后缴纳预抵达申请处理费",
  "提交白底护照照片",
  "提交全本护照复印件；护照有效期须至少覆盖入学日期后 24 个月",
  "提交健康声明表，并按 EMGS 或 APU 要求完成体检流程",
  "如适用，提交 NOC、LOE、转学签证取消与释放信、出勤记录等补充文件"
];

export function validateApuPublicationAudit(audit: ApuPublicationAudit, expectedCount: number, targetLevel: ApuAuditLevel): string[] {
  const errors: string[] = [];
  if (audit.safe_to_import !== false) errors.push(`${targetLevel}: safe_to_import must remain false.`);
  if (audit.import_approved_by != null || audit.import_approved_at != null) errors.push(`${targetLevel}: import approval fields must remain null.`);
  if (audit.auditMeta?.targetUniversityShortName !== "APU") errors.push(`${targetLevel}: targetUniversityShortName must be APU.`);
  if (audit.auditMeta?.targetLevel !== targetLevel) errors.push(`${targetLevel}: targetLevel mismatch.`);
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedCount) errors.push(`${targetLevel}: baseline must be ${expectedCount}.`);
  if (audit.auditMeta?.totalProgrammesCollected !== expectedCount) errors.push(`${targetLevel}: collected count must be ${expectedCount}.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
    errors.push(`${targetLevel}: expected ${expectedCount} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if (audit.auditMeta?.readyCount !== expectedCount) errors.push(`${targetLevel}: readyCount must be ${expectedCount}.`);
  if (audit.auditMeta?.needsReviewCount !== 0) errors.push(`${targetLevel}: needsReviewCount must be 0.`);
  if (audit.auditMeta?.exceptionCount !== 0) errors.push(`${targetLevel}: exceptionCount must be 0.`);
  if ((audit.exception_queue || []).length !== 0) errors.push(`${targetLevel}: exception_queue must be empty.`);
  if ((audit.pending_issues || []).length !== 0) errors.push(`${targetLevel}: pending_issues must be empty.`);
  if (audit.validationMeta?.overallDecision && audit.validationMeta.overallDecision !== "PASS") {
    errors.push(`${targetLevel}: validationMeta overallDecision must be PASS when present.`);
  }
  if (audit.validationMeta?.counts?.issuesPending != null && audit.validationMeta.counts.issuesPending !== 0) {
    errors.push(`${targetLevel}: validation issuesPending must be 0.`);
  }

  const seenNames = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `${targetLevel} ${index + 1} ${programme.nameEn || "unknown"}`;
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (seenNames.has(programme.nameEn)) errors.push(`${row}: duplicate programme name.`);
    seenNames.add(programme.nameEn);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn) errors.push(`${row}: Chinese programme name is required.`);
    if (programme.level !== targetLevel) errors.push(`${row}: level must be ${targetLevel}.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) errors.push(`${row}: Chinese faculty is required.`);
    if (!officialApuUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be APU official URL.`);
    if (!programme.officialFeeSourceUrl || !officialApuUrl(programme.officialFeeSourceUrl)) {
      errors.push(`${row}: officialFeeSourceUrl must be APU official URL.`);
    }
    if (programme.publicDisplayStatus !== "ready") errors.push(`${row}: publicDisplayStatus must be ready.`);
    if (programme.auditStatus !== "official-verified-commercial-ready") errors.push(`${row}: auditStatus must be official-verified-commercial-ready.`);
    if (typeof programme.duration !== "number" || programme.duration <= 0) errors.push(`${row}: duration must be positive number.`);
    if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: tuitionMYR must be positive number.`);
    if (!Array.isArray(programme.intake) || programme.intake.length === 0 || programme.intake.some((month) => month < 1 || month > 12)) {
      errors.push(`${row}: intake must be valid month numbers.`);
    }
    if (!programme.language || typeof programme.language.ielts !== "number" || programme.language.ielts <= 0) {
      errors.push(`${row}: IELTS list score is required.`);
    }
    if (!Array.isArray(programme.curriculum) || programme.curriculum.length === 0 || !programme.curriculum.every(hasChinese)) {
      errors.push(`${row}: Chinese curriculum array is required.`);
    }
    if (!Array.isArray(programme.applicationDocs) || programme.applicationDocs.length === 0 || !programme.applicationDocs.every(hasChinese)) {
      errors.push(`${row}: Chinese applicationDocs array is required.`);
    }

    const careerOfficiallyUnpublished = programme.fieldStatus?.careerProspects?.status === "official-unpublished";
    if (programme.careerProspects.length === 0 && !careerOfficiallyUnpublished) {
      errors.push(`${row}: empty careerProspects is only allowed when fieldStatus.careerProspects is official-unpublished.`);
    }
    if (programme.careerProspects.length > 0 && !programme.careerProspects.every(hasChinese)) {
      errors.push(`${row}: Chinese career array is required.`);
    }
  }
  return errors;
}

export function loadApuPublicationAudits(paths: {
  undergraduatePath?: string;
  masterPath?: string;
  doctoralPath?: string;
} = {}): ApuAuditInputSet {
  return {
    undergraduate: loadJson<ApuPublicationAudit>(paths.undergraduatePath || DEFAULT_APU_UNDERGRADUATE_AUDIT_PATH),
    master: loadJson<ApuPublicationAudit>(paths.masterPath || DEFAULT_APU_MASTER_AUDIT_PATH),
    doctoral: loadJson<ApuPublicationAudit>(paths.doctoralPath || DEFAULT_APU_DOCTORAL_AUDIT_PATH)
  };
}

export function buildApuOfficialAuditRows(audits: ApuAuditInputSet): Array<DeepPartial<ProgramEntity>> {
  const programmes = [
    ...audits.undergraduate.programmes,
    ...audits.master.programmes,
    ...audits.doctoral.programmes
  ];
  return programmes.map((programme, index) => buildApuProgrammeRow(programme, index + 1));
}

export function summarizeApuOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): ApuImportSummary {
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
    languageRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0).length,
    chineseNameRows: rows.filter((row) => hasChinese((row.name as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseFacultyRows: rows.filter((row) => hasChinese((row.faculty as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseCurriculumRows: rows.filter((row) => localizedArrayHasChinese(row.curriculum as LocalizedStringArray | undefined)).length,
    chineseCareerRows: rows.filter((row) => localizedArrayHasChinese(row.careers as LocalizedStringArray | undefined)).length,
    sourceRows: rows.filter((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 3).length,
    officialUnpublishedCareerRows: rows.filter((row) =>
      (row.careers as LocalizedStringArray | undefined)?.["zh-CN"]?.some((item) => item.includes("官网未公布"))
    ).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildApuUniversityRow(
  audits: ApuAuditInputSet,
  rows: Array<DeepPartial<ProgramEntity>>,
  existing: UniversityEntity | null = null
): DeepPartial<UniversityEntity> {
  const annualCosts = rows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const ieltsValues = rows.map((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0)).filter((value) => value > 0);

  return {
    slug: existing?.slug || "asia-pacific-university",
    code: existing?.code || "APU",
    name: existing?.name || t("Asia Pacific University of Technology & Innovation", "Asia Pacific University of Technology & Innovation", "亚太科技大学", "亞太科技大學"),
    shortName: existing?.shortName || "APU",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#0F766E",
    qsRank: existing?.qsRank || 597,
    qsAsiaRank: existing?.qsAsiaRank ?? 179,
    location: t("Technology Park Malaysia, Bukit Jalil, Kuala Lumpur", "Technology Park Malaysia, Bukit Jalil, Kuala Lumpur", "吉隆坡武吉加里尔 Technology Park Malaysia", "吉隆坡武吉加里爾 Technology Park Malaysia"),
    region: t("Kuala Lumpur", "Kuala Lumpur", "吉隆坡", "吉隆坡"),
    ownership: existing?.ownership || "private",
    institutionType: existing?.institutionType || "applied",
    foundedYear: existing?.foundedYear || 1993,
    students: existing?.students || 13000,
    intlStudents: existing?.intlStudents || 12000,
    csrCertified: existing?.csrCertified || true,
    description: t(
      "Asia Pacific University of Technology & Innovation (APU) is a Malaysian private university focused on technology, computing, business, engineering, design, media, psychology and research programmes.",
      "Asia Pacific University of Technology & Innovation (APU) is a Malaysian private university focused on technology, computing, business, engineering, design, media, psychology and research programmes.",
      "亚太科技大学（APU）是一所以科技、计算机、商科、工程、设计、媒体、心理学与研究型课程为重点的马来西亚私立大学。",
      "亞太科技大學（APU）是一所以科技、電腦、商科、工程、設計、媒體、心理學與研究型課程為重點的馬來西亞私立大學。"
    ),
    website: officialWebsite,
    admissionEmail: "info@apu.edu.my",
    nameEnOfficial: "Asia Pacific University of Technology & Innovation",
    officialWebsite,
    studyPortalUrl: programmeCatalogueUrl,
    internationalPageUrl: applicationProceduresUrl,
    applicationPortalUrl,
    officialAddress: "Asia Pacific University of Technology & Innovation (APU), Technology Park Malaysia, Bukit Jalil, 57000 Kuala Lumpur, Malaysia",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: arr(englishApplicationDocs, englishApplicationDocs, chineseApplicationDocs, chineseApplicationDocs),
    chinaStudentRequirements: arr(
      ["APU does not publish a separate China-specific equivalency route in the collected official sources; applications follow the international admission process and programme entry requirements."],
      ["APU does not publish a separate China-specific equivalency route in the collected official sources; applications follow the international admission process and programme entry requirements."],
      ["APU 本次采集的官方来源未单独公布中国学生学历等效路径；申请按国际招生流程和各专业入学要求评估。"],
      ["APU 本次採集的官方來源未單獨公布中國學生學歷等效路徑；申請按國際招生流程和各專業入學要求評估。"]
    ),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      apuAllLevelPublication: {
        sourceAudits: {
          undergraduate: relative(repositoryRoot, DEFAULT_APU_UNDERGRADUATE_AUDIT_PATH),
          master: relative(repositoryRoot, DEFAULT_APU_MASTER_AUDIT_PATH),
          doctoral: relative(repositoryRoot, DEFAULT_APU_DOCTORAL_AUDIT_PATH)
        },
        publishedAt: new Date().toISOString(),
        verifiedAt,
        programmes: rows.length,
        byLevel: expectedByLevel,
        publicationHardGate: "passed",
        officialUnpublishedCareerRows: 8,
        exceptions: [
          ...(audits.undergraduate.exception_queue || []),
          ...(audits.master.exception_queue || []),
          ...(audits.doctoral.exception_queue || [])
        ]
      }
    },
    officialSources: buildApuUniversitySourceLinks(audits),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: "APU bachelor, master and doctoral programmes are published from APU official programme pages, Fees & Certification sections, official English Requirements, Intake Calendar, international application procedures, PhD Title Bank and official brochure evidence. Public list fields pass StudyMY hard gates: Chinese programme name, Chinese faculty, IELTS list score, single official international tuition amount and numeric duration years.",
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualCosts.length ? Math.min(...annualCosts) : existing?.tuitionMinCny || 0,
    tuitionMaxCny: annualCosts.length ? Math.max(...annualCosts) : existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 30000,
    minIelts: ieltsValues.length ? Math.min(...ieltsValues) : existing?.minIelts || 0,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr(
      ["Technology Park Malaysia campus", "Computing and cybersecurity laboratories", "Engineering and design learning spaces", "International student services"],
      ["Technology Park Malaysia campus", "Computing and cybersecurity laboratories", "Engineering and design learning spaces", "International student services"],
      ["Technology Park Malaysia 校区", "计算机与网络安全实验室", "工程与设计学习空间", "国际学生服务"],
      ["Technology Park Malaysia 校區", "電腦與網路安全實驗室", "工程與設計學習空間", "國際學生服務"]
    ),
    highlights: arr(
      ["Official APU all-level catalogue", "Official international Total for International fees", "Strong coverage in computing, technology, business, engineering and digital disciplines"],
      ["Official APU all-level catalogue", "Official international Total for International fees", "Strong coverage in computing, technology, business, engineering and digital disciplines"],
      ["APU 官方本硕博目录", "官方国际学生 Total for International 费用", "计算机、科技、商科、工程与数字类学科覆盖完整"],
      ["APU 官方本碩博目錄", "官方國際學生 Total for International 費用", "電腦、科技、商科、工程與數位類學科覆蓋完整"]
    ),
    programCount: rows.length,
    isPublished: true
  };
}

export function verifyApuAllLevelPublicRecordSet(
  university: UniversityEntity,
  publicRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): ApuVerification {
  const summary = summarizeApuOfficialAuditImport(publicRows);
  const activeSupersededRows = allUniversityRows.filter((row) =>
    !row.slug.startsWith(APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  );
  const visibleCurrentRows = publicRows.filter((row) =>
    row.isPublished &&
    row.publicDisplayStatus === "ready" &&
    row.slug.startsWith(APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
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
    summary.chineseFacultyRows !== expectedProgrammes ||
    summary.chineseCurriculumRows !== expectedProgrammes ||
    summary.chineseCareerRows !== expectedProgrammes ||
    summary.sourceRows !== expectedProgrammes ||
    summary.officialUnpublishedCareerRows !== 8 ||
    visibleCurrentRows !== expectedProgrammes ||
    activeSupersededRows.length !== 0 ||
    legacyVisibleRows.length !== 0 ||
    university.publicDisplayStatus !== "ready" ||
    !university.isPublished ||
    university.programCount !== expectedProgrammes
  ) {
    throw new Error(`APU all-level public verification failed: ${JSON.stringify({
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

function buildApuProgrammeRow(programme: ApuAuditProgramme, ordinal: number): DeepPartial<ProgramEntity> {
  const level = mapApuLevel(programme.level);
  const tuitionMYR = programme.tuitionMYR || 0;
  const durationYears = programme.duration || 1;
  const code = `APU-${level.toUpperCase()}-${String(ordinal).padStart(3, "0")}`;
  const sourceUrls = buildApuProgrammeSourceLinks(programme);
  const careerZh = displayCareerZh(programme);
  const careerEn = displayCareerEn(programme);

  return {
    slug: `${APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
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
    tuitionDisplay: `RM ${formatNumber(tuitionMYR)}`,
    officialTuitionMYR: Math.round(tuitionMYR),
    officialTuitionNote: normalizeLongText(programme.tuitionNote || "APU official Fees & Certification International Total for International amount."),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || programme.officialSourceUrl,
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official" satisfies FeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: intakeMonthNames(programme.intake),
    officialIntake: intakeMonthNames(programme.intake).join(", "),
    officialIntakeNote: programme.applicationDeadline
      ? normalizeLongText(`Application timing: ${programme.applicationDeadline}`)
      : "APU publishes intake dates on the programme page and central Intake Calendar; a single programme-level application deadline is not published.",
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
    chinaStudentRequirement: "APU 未单独公布中国学生学历等效路径；按国际招生流程和该专业入学要求评估。",
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: arr(englishApplicationDocs, englishApplicationDocs, programme.applicationDocs || chineseApplicationDocs, programme.applicationDocs || chineseApplicationDocs),
    curriculum: localizedChineseList(programme.curriculum, englishListFromEvidence(programme, "curriculum", "programme curriculum")),
    careers: localizedChineseList(careerZh, careerEn),
    specializations: arr([]),
    description: t(
      `${programme.nameEn} is published from APU official programme, fee, admission, English requirement and brochure evidence.`,
      `${programme.nameEn} is published from APU official programme, fee, admission, English requirement and brochure evidence.`,
      `${programme.name} 已按 APU 官方专业页、费用、招生、英语要求和官方手册证据公开展示。`,
      `${programme.name} 已按 APU 官方專業頁、費用、招生、英語要求和官方手冊證據公開展示。`
    ),
    officialAccreditationNote: null,
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: programme.officialSourceUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    publicDisplayNote: programme.careerProspects.length === 0
      ? "已依据 APU 官方来源完成上线硬门禁校验；该研究型博士官网未公布职业方向，公开详情显示官网未公布，不编造字段。"
      : "已依据 APU 官方来源完成上线硬门禁校验：中文专业名、中文学院、列表 IELTS、准确国际学生学费和数字学制。",
    reviewReason: null,
    auditNote: normalizeLongText([
      `Published from APU ${programme.level} audit row ${ordinal}.`,
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || programme.officialSourceUrl}.`,
      programme.curriculumNote || "",
      programme.studyModeNote || "",
      programme.fieldStatus?.careerProspects?.note || ""
    ].filter(Boolean).join(" ")),
    listTuitionText: `RM ${formatNumber(tuitionMYR)}`,
    isPublished: true
  };
}

async function verifyImportedApuRows(manager: EntityManager | DataSource, universityId: number) {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("APU university row not found during verification.");
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  const publicRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number])
  );
  return verifyApuAllLevelPublicRecordSet(university, publicRows, allUniversityRows);
}

async function runApuPublication(options: {
  undergraduatePath: string;
  masterPath: string;
  doctoralPath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audits = loadApuPublicationAudits(options);
  const validationErrors = [
    ...validateApuPublicationAudit(audits.undergraduate, expectedByLevel.bachelor, "undergraduate"),
    ...validateApuPublicationAudit(audits.master, expectedByLevel.master, "master"),
    ...validateApuPublicationAudit(audits.doctoral, expectedByLevel.phd, "doctoral")
  ];
  if (validationErrors.length) throw new Error(`APU publication audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildApuOfficialAuditRows(audits);
  const summary = summarizeApuOfficialAuditImport(rows);
  const plan = buildPublishPlan(options, summary, audits);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "apu-all-level-dry-run",
      planPath: options.planOutput,
      summary,
      nextStep: "Run npm --workspace @studymy/api run import:apu:official-audit -- --confirm-import"
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "APU" } })) ||
      (await universityRepo.findOne({ where: { slug: "asia-pacific-university" } }));

    if (options.verifyOnly) {
      if (!university) throw new Error("APU university row not found.");
      const verification = await verifyImportedApuRows(dataSource, university.id);
      console.log(JSON.stringify({ mode: "apu-all-level-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: "asia-pacific-university" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug asia-pacific-university belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/apu-all-level-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: ApuVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "APU" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: "asia-pacific-university" } }));

      const universitySeed = buildApuUniversityRow(audits, rows, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX}%`) }
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
          row.publicDisplayNote = "Archived because the APU all-level official publication batch supersedes this legacy or review row.";
          row.reviewReason = normalizeLongText([
            row.reviewReason,
            "Archived by APU all-level official publication; current public display uses apu-public-20260627 rows."
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
      verification = await verifyImportedApuRows(manager, university.id);
    });

    if (!verification) throw new Error("APU all-level publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    writeJson(options.postImportAuditOutput, buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared));
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "apu-all-level-published",
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
  summary: ApuImportSummary,
  audits: ApuAuditInputSet
) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "APU",
      shortName: "APU",
      name: "Asia Pacific University of Technology & Innovation",
      slug: "asia-pacific-university"
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
      importer: "apps/api/src/db/import-apu-official-audit.ts",
      mode: "publish-all-levels",
      upsertPrefix: APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
      universityRow: "upsert by code APU or slug asia-pacific-university",
      programmeRows: "upsert 107 current APU public rows and archive non-current APU rows",
      transactional: true,
      backupRequired: true
    },
    publicationHardGate: {
      result: "passed",
      standard: "docs/prd/StudyMY-official-programme-publication-hard-gate.md",
      rules: [
        "Chinese programme name",
        "Chinese faculty",
        "IELTS list score",
        "single official international tuition",
        "numeric duration years",
        "official-unpublished fields do not leak English placeholders"
      ]
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
  summary: ApuImportSummary,
  verification: ApuVerification,
  backupPath: string,
  catalogCacheCleared: boolean
) {
  return {
    schemaVersion: 1,
    mode: "apu-all-level-published",
    createdAt: new Date().toISOString(),
    institution: {
      code: "APU",
      name: "Asia Pacific University of Technology & Innovation",
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
    displayHardGate: {
      chineseNameRows: verification.chineseNameRows,
      chineseFacultyRows: verification.chineseFacultyRows,
      chineseCurriculumRows: verification.chineseCurriculumRows,
      chineseCareerRows: verification.chineseCareerRows,
      officialUnpublishedCareerRows: verification.officialUnpublishedCareerRows,
      languageRows: verification.languageRows,
      officialFeeRows: verification.officialFeeRows,
      sourceRows: verification.sourceRows
    }
  };
}

function buildReleaseReportMarkdown(verification: ApuVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# APU All-Level Official Publication Report",
    "",
    "- Decision: published for Ian review",
    "- Scope: Asia Pacific University of Technology & Innovation official bachelor, master and doctoral programmes",
    `- Published rows: ${verification.publishedRows}`,
    `- By level: bachelor ${verification.byLevel.bachelor}, master ${verification.byLevel.master}, phd ${verification.byLevel.phd}`,
    `- Ready rows: ${verification.readyRows}`,
    `- Official fee rows: ${verification.officialFeeRows}`,
    `- IELTS rows: ${verification.languageRows}`,
    `- Chinese programme name rows: ${verification.chineseNameRows}`,
    `- Chinese faculty rows: ${verification.chineseFacultyRows}`,
    `- Chinese curriculum rows: ${verification.chineseCurriculumRows}`,
    `- Chinese career/display rows: ${verification.chineseCareerRows}`,
    `- Official-unpublished career rows: ${verification.officialUnpublishedCareerRows}`,
    `- Active superseded rows: ${verification.activeSupersededRows}`,
    `- Legacy visible rows: ${verification.legacyVisibleRows}`,
    `- University programCount: ${verification.universityProgramCount}`,
    `- Catalog cache cleared: ${catalogCacheCleared ? "yes" : "not configured"}`,
    `- Backup: ${relative(repositoryRoot, backupPath)}`,
    "",
    "## Hard Gate",
    "",
    "- 中文专业名：通过",
    "- 中文学院：通过",
    "- 列表 IELTS：通过",
    "- 学费为单一官方 International Total for International：通过",
    "- 学制为数字年数：通过",
    "- 官网未公布字段：只显示“官网未公布”，不编造、不回退英文：通过",
    "",
    "## Official Sources",
    "",
    `- ${programmeCatalogueUrl}`,
    `- ${postgraduateLandingUrl}`,
    `- ${englishRequirementsUrl}`,
    `- ${intakeCalendarUrl}`,
    `- ${applicationProceduresUrl}`,
    `- ${phdTitleBankUrl}`,
    `- ${postgraduateBrochurePdf}`,
    ""
  ].join("\n");
}

function buildApuProgrammeSourceLinks(programme: ApuAuditProgramme): OfficialSourceLink[] {
  const urls = new Set([
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || programme.officialSourceUrl,
    directoryUrlForLevel(programme.level),
    englishRequirementsUrl,
    intakeCalendarUrl,
    applicationProceduresUrl,
    programme.level === "doctoral" ? phdTitleBankUrl : "",
    programme.level !== "undergraduate" ? postgraduateBrochurePdf : "",
    ...urlsFromUnknown(programme.fieldEvidence),
    ...urlsFromUnknown(programme.fieldStatus)
  ].filter(Boolean));

  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && officialApuUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url, programme),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: url === (programme.officialFeeSourceUrl || programme.officialSourceUrl)
        ? "APU official programme page Fees & Certification used for the International Total for International amount."
        : "Official APU source used for the 2026-06-27 public audit."
    }));
}

function buildApuUniversitySourceLinks(audits: ApuAuditInputSet): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    programmeCatalogueUrl,
    undergraduateDirectoryUrl,
    masterDirectoryUrl,
    doctoralDirectoryUrl,
    postgraduateLandingUrl,
    englishRequirementsUrl,
    intakeCalendarUrl,
    applicationProceduresUrl,
    applicationPortalUrl,
    phdTitleBankUrl,
    postgraduateBrochurePdf,
    ...urlsFromUnknown(audits.undergraduate.sourceRegistry),
    ...urlsFromUnknown(audits.master.sourceRegistry),
    ...urlsFromUnknown(audits.doctoral.sourceRegistry)
  ]);
  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && officialApuUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: "Official APU university/programme source used for all-level publication."
    }));
}

function buildLanguage(programme: ApuAuditProgramme): LanguageRequirement {
  return {
    ielts: programme.language?.ielts || 0,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: ApuAuditProgramme) {
  const parts = [
    programme.language?.ielts ? `IELTS ${programme.language.ielts}` : "",
    programme.language?.toefl ? `TOEFL IBT ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver ? `Waiver: ${programme.language.waiver}` : ""
  ].filter(Boolean);
  return normalizeLongText(parts.join("; "));
}

function buildAcademicRequirement(programme: ApuAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `Degree level: ${requirement.degreeLevel}.` : "",
    requirement.degreeRelevance ? `Degree relevance: ${requirement.degreeRelevance}.` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `Published CGPA threshold: ${requirement.minGPA}/${requirement.gpaScale || 4}.` : "",
    requirement.workExperience ? `Work or experience requirement: ${requirement.workExperience}.` : "",
    "See the official APU programme page and admission review for final equivalency assessment."
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirementZh(programme: ApuAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `学历层级：${requirement.degreeLevel}。` : "",
    requirement.degreeRelevance ? `相关背景：${requirement.degreeRelevance}。` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `官方 CGPA 门槛：${requirement.minGPA}/${requirement.gpaScale || 4}。` : "",
    requirement.workExperience ? `工作经验要求：${requirement.workExperience}。` : "",
    "最终等效资格以 APU 官方专业页和录取审核为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: ApuAuditProgramme) {
  return normalizeLongText([
    programme.studyModeNote || "",
    programme.thesisRequired === true ? "Thesis, dissertation, research project or final project applies where required by the programme structure." : "",
    programme.thesisNote || "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.supervisorSystem === true ? "Supervisor or research supervision applies." : "",
    programme.creditHours ? `Credit hours: ${programme.creditHours}.` : "",
    programme.fieldStatus?.applicationDeadline?.note || "",
    programme.fieldStatus?.careerProspects?.note || ""
  ].filter(Boolean).join(" "));
}

function buildDurationOfficial(programme: ApuAuditProgramme) {
  const standard = `${programme.duration} ${programme.duration === 1 ? "year" : "years"}`;
  return normalizeText([standard, fieldEvidenceValue(programme, "duration"), programme.fieldStatus?.duration?.note, programme.studyModeNote].filter(Boolean).join(". "), 500);
}

function localizedChineseList(chineseItems: string[], englishItems: string[]): LocalizedStringArray {
  return arr(englishItems, englishItems, chineseItems, chineseItems);
}

function displayCareerZh(programme: ApuAuditProgramme) {
  if (programme.careerProspects.length) return programme.careerProspects;
  return ["官网未公布具体职业方向"];
}

function displayCareerEn(programme: ApuAuditProgramme) {
  if (!programme.careerProspects.length) return ["Official source does not publish specific career prospects for this research PhD."];
  return englishListFromEvidence(programme, "careerProspects", "career prospects");
}

function englishListFromEvidence(programme: ApuAuditProgramme, field: string, label: string) {
  const evidence = fieldEvidenceValue(programme, field);
  const parts = evidence
    .split(/\s*;\s*/)
    .map((item) => normalizeText(item, 160))
    .filter((item) => item && !hasChinese(item));
  return parts.length ? parts : [`See the official APU programme page for ${label} of ${programme.nameEn}.`];
}

function mapApuLevel(level: ApuAuditLevel): ApuDegreeLevel {
  if (level === "undergraduate") return "bachelor";
  if (level === "doctoral") return "phd";
  return "master";
}

function directoryUrlForLevel(level: ApuAuditLevel) {
  if (level === "undergraduate") return undergraduateDirectoryUrl;
  if (level === "doctoral") return doctoralDirectoryUrl;
  return masterDirectoryUrl;
}

function inferStudyMode(programme: ApuAuditProgramme) {
  const text = `${programme.nameEn} ${programme.studyModeNote || ""}`.toLowerCase();
  if (/odl|open distance|online distance/.test(text)) return "online-distance-learning";
  if (/research|doctor of philosophy|phd/.test(text)) return "research";
  if (/coursework/.test(text)) return "coursework";
  return "on-campus";
}

function inferCampus(programme: ApuAuditProgramme) {
  const text = `${programme.nameEn} ${programme.studyModeNote || ""}`.toLowerCase();
  if (/odl|open distance|online distance/.test(text)) return "APU Online Distance Learning";
  return "APU Campus, Technology Park Malaysia";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|mba|management|finance|accounting|banking|marketing|administration|entrepreneurship|economics|fintech/.test(value)) return "business";
  if (/computer|computing|information|analytics|data|software|digital|technology|multimedia|cyber|artificial intelligence|ict|games|game/.test(value)) return "it";
  if (/engineering|electrical|electronic|mechatronic|telecommunication|petroleum/.test(value)) return "engineering";
  if (/design|media|animation|visual effects|industrial design|creative/.test(value)) return "arts";
  if (/psychology/.test(value)) return "medicine";
  if (/science|actuarial|mathematics|statistics/.test(value)) return "science";
  return "arts";
}

function intakeMonthNames(months: number[]) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (months || []).map((month) => names[month - 1]).filter(Boolean);
}

function sourceLinkTitle(url: string, programme?: ApuAuditProgramme) {
  if (url === officialWebsite) return "APU official website";
  if (url.startsWith(programmeCatalogueUrl)) return "APU programme catalogue";
  if (url === postgraduateLandingUrl) return "APU Postgraduate Studies";
  if (url === englishRequirementsUrl) return "APU English Requirements";
  if (url === intakeCalendarUrl) return "APU Intake Calendar";
  if (url === applicationProceduresUrl) return "APU International Students Application Procedures";
  if (url === applicationPortalUrl) return "APU admissions portal";
  if (url === phdTitleBankUrl) return "APU PhD Title Bank";
  if (url === postgraduateBrochurePdf) return "APU Postgraduate Brochure";
  if (programme && url === programme.officialSourceUrl) return "Official programme page";
  if (/pdf|brochure/i.test(url)) return "Official APU PDF";
  return "Official APU source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/fee|tuition/.test(value)) return "fee";
  if (/application|admission|international|admissions\.apu/.test(value)) return "admission";
  if (/course|programme|program|postgraduate|brochure|title-bank|node\/409/.test(value)) return "study-portal";
  if (value === officialWebsite) return "profile";
  return "other";
}

function officialApuUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "apu.edu.my" || host.endsWith(".apu.edu.my");
  } catch {
    return false;
  }
}

function fieldEvidenceValue(programme: ApuAuditProgramme, field: string) {
  const value = asRecord(programme.fieldEvidence)[field];
  if (Array.isArray(value)) {
    const first = asRecord(value[0]);
    return normalizeText(first.evidence || first.value || "", 4000);
  }
  const record = asRecord(value);
  return normalizeText(record.evidence || record.value || "", 4000);
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
    if (item && typeof item === "object") {
      Object.values(item as Record<string, unknown>).forEach(visit);
    }
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
  await runApuPublication({
    undergraduatePath: resolve(readArgValue("--undergraduate-audit") || DEFAULT_APU_UNDERGRADUATE_AUDIT_PATH),
    masterPath: resolve(readArgValue("--master-audit") || DEFAULT_APU_MASTER_AUDIT_PATH),
    doctoralPath: resolve(readArgValue("--doctoral-audit") || DEFAULT_APU_DOCTORAL_AUDIT_PATH),
    planOutput: resolve(readArgValue("--plan-output") || DEFAULT_APU_PUBLISH_PLAN_PATH),
    postImportAuditOutput: resolve(readArgValue("--post-import-audit-output") || DEFAULT_APU_POST_IMPORT_AUDIT_PATH),
    releaseReportOutput: resolve(readArgValue("--release-report-output") || DEFAULT_APU_RELEASE_REPORT_PATH),
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
