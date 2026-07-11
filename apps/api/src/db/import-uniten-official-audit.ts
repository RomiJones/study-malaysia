import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, type DeepPartial, type EntityManager } from "typeorm";
import type {
  DegreeLevel,
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
const unitenImportDir = resolve(repositoryRoot, "data/imports/uniten/2026-06-26/official-audit");

export const UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX = "uniten-official-20260626-";
export const DEFAULT_UNITEN_UNDERGRADUATE_AUDIT_PATH = resolve(repositoryRoot, "audits/UNITEN_audit_undergraduate_20260626_reviewed_v1.json");
export const DEFAULT_UNITEN_MASTER_AUDIT_PATH = resolve(repositoryRoot, "audits/UNITEN_audit_master_20260626_reviewed_v5.json");
export const DEFAULT_UNITEN_DOCTORAL_AUDIT_PATH = resolve(repositoryRoot, "audits/UNITEN_audit_doctoral_20260626_reviewed_v1.json");
export const DEFAULT_UNITEN_PUBLISH_PLAN_PATH = resolve(unitenImportDir, "01_publish_plan.json");
export const DEFAULT_UNITEN_POST_IMPORT_AUDIT_PATH = resolve(unitenImportDir, "02_post_import_audit.json");
export const DEFAULT_UNITEN_RELEASE_REPORT_PATH = resolve(unitenImportDir, "03_release_report.md");

const verifiedAt = "2026-06-26";
const myrToCny = 1.55;
const expectedProgrammes = 37;
const expectedByLevel = { bachelor: 18, master: 16, phd: 3 } as const;
const publicCatalogProgramStatuses = ["ready", "current-cycle-not-open", "not-available-for-international"] as const;
const officialWebsite = "https://www.uniten.edu.my";
const undergraduateDirectoryUrl = "https://www.uniten.edu.my/programme/undergraduate/";
const postgraduateDirectoryUrl = "https://www.uniten.edu.my/programme/postgraduate/";
const admissionUrl = "https://www.uniten.edu.my/admission/";
const internationalStudentsUrl = "https://www.uniten.edu.my/apply-now/international-students/";
const academicCalendarUrl = "https://www.uniten.edu.my/campus-life/academic-calendar-20262027/";

type UnitenAuditLevel = "undergraduate" | "master" | "doctoral";
type UnitenDegreeLevel = "bachelor" | "master" | "phd";

interface UnitenEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface UnitenAuditProgramme {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: UnitenAuditLevel;
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
  entryRequirement: UnitenEntryRequirement;
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

interface UnitenReviewedAudit {
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  auditMeta?: {
    targetUniversityShortName?: string;
    targetLevel?: UnitenAuditLevel;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
  };
  sourceRegistry?: unknown;
  programmes: UnitenAuditProgramme[];
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

interface UnitenAuditInputSet {
  undergraduate: UnitenReviewedAudit;
  master: UnitenReviewedAudit;
  doctoral: UnitenReviewedAudit;
}

interface UnitenImportSummary {
  importRows: number;
  byLevel: Record<UnitenDegreeLevel, number>;
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
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UnitenVerification extends UnitenImportSummary {
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
  "Passport biodata page copy.",
  "Certified academic certificates and transcripts; documents not issued in English require certified English translation.",
  "Certified IELTS, TOEFL or other English-language certificate and transcript.",
  "Completed UNITEN online application with required uploads.",
  "Research proposal where required for full research programmes.",
  "Work-experience evidence where applicable."
];

const chineseApplicationDocs = [
  "护照首页复印件",
  "经认证的学历证书和成绩单；非英文材料需提供认证英文翻译件",
  "经认证的 IELTS、TOEFL 或其他英语能力证书及成绩单",
  "通过 UNITEN 在线申请系统填写申请表并上传所需材料",
  "研究型项目如适用需提交研究计划书",
  "如适用，提交工作经验证明"
];

export function validateUnitenReviewedAudit(audit: UnitenReviewedAudit, expectedCount: number, targetLevel: UnitenAuditLevel): string[] {
  const errors: string[] = [];
  if (audit.safe_to_import !== false) errors.push(`${targetLevel}: safe_to_import must remain false.`);
  if (audit.import_approved_by != null || audit.import_approved_at != null) errors.push(`${targetLevel}: import approval fields must remain null.`);
  if (audit.auditMeta?.targetUniversityShortName !== "UNITEN") errors.push(`${targetLevel}: targetUniversityShortName must be UNITEN.`);
  if (audit.auditMeta?.targetLevel !== targetLevel) errors.push(`${targetLevel}: targetLevel mismatch.`);
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedCount) errors.push(`${targetLevel}: baseline must be ${expectedCount}.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
    errors.push(`${targetLevel}: expected ${expectedCount} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if (audit.auditMeta?.readyCount !== expectedCount) errors.push(`${targetLevel}: readyCount must be ${expectedCount}.`);
  if (audit.auditMeta?.needsReviewCount !== 0) errors.push(`${targetLevel}: needsReviewCount must be 0.`);
  if ((audit.pending_issues || []).length !== 0) errors.push(`${targetLevel}: pending_issues must be empty.`);
  if (audit.validationMeta?.counts?.issuesPending !== 0) errors.push(`${targetLevel}: validation issuesPending must be 0.`);

  const seenNames = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `${targetLevel} ${index + 1} ${programme.nameEn || "unknown"}`;
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (seenNames.has(programme.nameEn)) errors.push(`${row}: duplicate programme name.`);
    seenNames.add(programme.nameEn);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn || !programme.name.includes(programme.nameEn)) {
      errors.push(`${row}: Chinese bilingual programme name is required.`);
    }
    if (programme.level !== targetLevel) errors.push(`${row}: level must be ${targetLevel}.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) errors.push(`${row}: Chinese faculty is required.`);
    if (!officialUnitenUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be UNITEN official URL.`);
    if (programme.officialFeeSourceUrl && !officialUnitenUrl(programme.officialFeeSourceUrl)) {
      errors.push(`${row}: officialFeeSourceUrl must be UNITEN official URL.`);
    }
    if (programme.publicDisplayStatus !== "ready") errors.push(`${row}: publicDisplayStatus must be ready.`);
    if (programme.auditStatus !== "official-verified-commercial-ready") errors.push(`${row}: auditStatus must be official-verified-commercial-ready.`);
    if (typeof programme.duration !== "number" || programme.duration <= 0) errors.push(`${row}: duration must be positive number.`);
    if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: tuitionMYR must be positive number.`);
    if (!Array.isArray(programme.intake) || programme.intake.some((month) => month < 1 || month > 12)) {
      errors.push(`${row}: intake must be valid month numbers.`);
    }
    if (!programme.language || typeof programme.language.ielts !== "number" || programme.language.ielts <= 0) {
      errors.push(`${row}: IELTS list score is required.`);
    }
    if (!Array.isArray(programme.curriculum) || programme.curriculum.length === 0 || !programme.curriculum.every(hasChinese)) {
      errors.push(`${row}: Chinese curriculum array is required.`);
    }
    if (!Array.isArray(programme.careerProspects) || programme.careerProspects.length === 0 || !programme.careerProspects.every(hasChinese)) {
      errors.push(`${row}: Chinese career array is required.`);
    }
    if (!Array.isArray(programme.applicationDocs) || programme.applicationDocs.length === 0 || !programme.applicationDocs.every(hasChinese)) {
      errors.push(`${row}: Chinese applicationDocs array is required.`);
    }
  }
  return errors;
}

export function loadUnitenReviewedAudits(paths: {
  undergraduatePath?: string;
  masterPath?: string;
  doctoralPath?: string;
} = {}): UnitenAuditInputSet {
  return {
    undergraduate: loadJson<UnitenReviewedAudit>(paths.undergraduatePath || DEFAULT_UNITEN_UNDERGRADUATE_AUDIT_PATH),
    master: loadJson<UnitenReviewedAudit>(paths.masterPath || DEFAULT_UNITEN_MASTER_AUDIT_PATH),
    doctoral: loadJson<UnitenReviewedAudit>(paths.doctoralPath || DEFAULT_UNITEN_DOCTORAL_AUDIT_PATH)
  };
}

export function buildUnitenOfficialAuditRows(audits: UnitenAuditInputSet): Array<DeepPartial<ProgramEntity>> {
  const programmes = [
    ...audits.undergraduate.programmes,
    ...audits.master.programmes,
    ...audits.doctoral.programmes
  ];
  return programmes.map((programme, index) => buildUnitenProgrammeRow(programme, index + 1));
}

export function summarizeUnitenOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): UnitenImportSummary {
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
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildUnitenUniversityRow(
  audits: UnitenAuditInputSet,
  rows: Array<DeepPartial<ProgramEntity>>,
  existing: UniversityEntity | null = null
): DeepPartial<UniversityEntity> {
  const annualCosts = rows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const ieltsValues = rows.map((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0)).filter((value) => value > 0);

  return {
    slug: existing?.slug || "universiti-tenaga-nasional",
    code: existing?.code || "UNITEN",
    name: existing?.name || t("Universiti Tenaga Nasional (UNITEN)", "Universiti Tenaga Nasional (UNITEN)", "国家能源大学（UNITEN）", "國家能源大學（UNITEN）"),
    shortName: existing?.shortName || "UNITEN",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#F05A28",
    qsRank: existing?.qsRank || 519,
    qsAsiaRank: existing?.qsAsiaRank ?? null,
    location: t("Kajang, Selangor, Malaysia", "Kajang, Selangor, Malaysia", "马来西亚雪兰莪加影", "馬來西亞雪蘭莪加影"),
    region: t("Selangor", "Selangor", "雪兰莪", "雪蘭莪"),
    ownership: existing?.ownership || "private",
    institutionType: existing?.institutionType || "applied",
    foundedYear: 1997,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: t(
      "Universiti Tenaga Nasional (UNITEN) is The Energy University in Malaysia, offering engineering, computing, business, accounting, finance, economics and research programmes.",
      "Universiti Tenaga Nasional (UNITEN) is The Energy University in Malaysia, offering engineering, computing, business, accounting, finance, economics and research programmes.",
      "国家能源大学（UNITEN）是马来西亚以能源与工程应用为特色的私立大学，开设工程、计算机、商科、会计、金融、经济及研究型课程。",
      "國家能源大學（UNITEN）是馬來西亞以能源與工程應用為特色的私立大學，開設工程、電腦、商科、會計、金融、經濟及研究型課程。"
    ),
    website: officialWebsite,
    admissionEmail: "intadmission@uniten.edu.my",
    nameEnOfficial: "Universiti Tenaga Nasional (UNITEN)",
    officialWebsite,
    studyPortalUrl: officialWebsite,
    internationalPageUrl: internationalStudentsUrl,
    applicationPortalUrl: "https://apply.uniten.edu.my/uniapps/LoginApplicant.aspx",
    officialAddress: "Jalan IKRAM-UNITEN, 43000 Kajang, Selangor, Malaysia",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: arr(englishApplicationDocs, englishApplicationDocs, chineseApplicationDocs, chineseApplicationDocs),
    chinaStudentRequirements: existing?.chinaStudentRequirements || arr(
      ["UNITEN does not publish a separate China-specific equivalency route in the collected official sources; applications follow the international admission process and programme entry requirements."],
      ["UNITEN does not publish a separate China-specific equivalency route in the collected official sources; applications follow the international admission process and programme entry requirements."],
      ["UNITEN 本次采集的官方来源未单独公布中国学生学历等效路径；申请按国际招生流程和各专业入学要求评估。"],
      ["UNITEN 本次採集的官方來源未單獨公布中國學生學歷等效路徑；申請按國際招生流程和各專業入學要求評估。"]
    ),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      unitenAllLevelPublication: {
        sourceAudits: {
          undergraduate: relative(repositoryRoot, DEFAULT_UNITEN_UNDERGRADUATE_AUDIT_PATH),
          master: relative(repositoryRoot, DEFAULT_UNITEN_MASTER_AUDIT_PATH),
          doctoral: relative(repositoryRoot, DEFAULT_UNITEN_DOCTORAL_AUDIT_PATH)
        },
        publishedAt: new Date().toISOString(),
        verifiedAt,
        programmes: rows.length,
        byLevel: expectedByLevel,
        publicationHardGate: "passed",
        exceptions: [
          ...(audits.undergraduate.exception_queue || []),
          ...(audits.master.exception_queue || []),
          ...(audits.doctoral.exception_queue || [])
        ]
      }
    },
    officialSources: buildUnitenUniversitySourceLinks(audits),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: "UNITEN bachelor, master and doctoral programmes are published from reviewed UNITEN official programme pages, admission pages and official handbook evidence. Public list fields pass the StudyMY hard gate: Chinese programme name, Chinese faculty, IELTS-only list language, single official tuition amount and numeric duration years.",
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualCosts.length ? Math.min(...annualCosts) : existing?.tuitionMinCny || 0,
    tuitionMaxCny: annualCosts.length ? Math.max(...annualCosts) : existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 18000,
    minIelts: ieltsValues.length ? Math.min(...ieltsValues) : existing?.minIelts || 0,
    acceptNoLanguage: false,
    facilities: arr(
      ["Putrajaya Campus", "Sultan Haji Ahmad Shah Campus", "College of Graduate Studies support", "International student services"],
      ["Putrajaya Campus", "Sultan Haji Ahmad Shah Campus", "College of Graduate Studies support", "International student services"],
      ["Putrajaya 校区", "Sultan Haji Ahmad Shah 校区", "研究生院支持", "国际学生服务"],
      ["Putrajaya 校區", "Sultan Haji Ahmad Shah 校區", "研究生院支援", "國際學生服務"]
    ),
    highlights: arr(
      ["Official UNITEN all-level catalogue", "Official international total programme fees", "Strong coverage in engineering, computing, business and energy-related fields"],
      ["Official UNITEN all-level catalogue", "Official international total programme fees", "Strong coverage in engineering, computing, business and energy-related fields"],
      ["UNITEN 官方本硕博目录", "官方国际学生完整项目费用", "工程、计算机、商科与能源相关领域覆盖完整"],
      ["UNITEN 官方本碩博目錄", "官方國際學生完整項目費用", "工程、電腦、商科與能源相關領域覆蓋完整"]
    ),
    programCount: rows.length,
    isPublished: true
  };
}

export function verifyUnitenAllLevelPublicRecordSet(
  university: UniversityEntity,
  publicRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): UnitenVerification {
  const summary = summarizeUnitenOfficialAuditImport(publicRows);
  const activeSupersededRows = allUniversityRows.filter((row) =>
    !row.slug.startsWith(UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  );
  const visibleCurrentRows = publicRows.filter((row) =>
    row.isPublished &&
    row.publicDisplayStatus === "ready" &&
    row.slug.startsWith(UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
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
    visibleCurrentRows !== expectedProgrammes ||
    activeSupersededRows.length !== 0 ||
    legacyVisibleRows.length !== 0 ||
    university.publicDisplayStatus !== "ready" ||
    !university.isPublished ||
    university.programCount !== expectedProgrammes
  ) {
    throw new Error(`UNITEN all-level public verification failed: ${JSON.stringify({
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

function buildUnitenProgrammeRow(programme: UnitenAuditProgramme, ordinal: number): DeepPartial<ProgramEntity> {
  const level = mapUnitenLevel(programme.level);
  const tuitionMYR = programme.tuitionMYR || 0;
  const durationYears = programme.duration || 1;
  const code = `UNITEN-${level.toUpperCase()}-${String(ordinal).padStart(3, "0")}`;
  const sourceUrls = buildUnitenProgrammeSourceLinks(programme);

  return {
    slug: `${UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
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
    officialTuitionNote: normalizeLongText(programme.tuitionNote || "UNITEN official Total Programme Fee for international students."),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || programme.officialSourceUrl,
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official" satisfies FeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: intakeMonthNames(programme.intake),
    officialIntake: intakeMonthNames(programme.intake).join(", "),
    officialIntakeNote: programme.applicationDeadline
      ? normalizeLongText(`Application timing: ${programme.applicationDeadline}`)
      : "UNITEN publishes intake months on the official programme page; application deadlines follow the official admission page.",
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
    chinaStudentRequirement: "UNITEN 未单独公布中国学生学历等效路径；按国际招生流程和该专业入学要求评估。",
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: arr(englishApplicationDocs, englishApplicationDocs, programme.applicationDocs || chineseApplicationDocs, programme.applicationDocs || chineseApplicationDocs),
    curriculum: localizedChineseList(programme.curriculum, englishListFallback("programme curriculum", programme)),
    careers: localizedChineseList(programme.careerProspects, englishListFallback("career pathways", programme)),
    specializations: arr([]),
    description: t(
      `${programme.nameEn} is published from reviewed UNITEN official programme, fee, admission and handbook evidence.`,
      `${programme.nameEn} is published from reviewed UNITEN official programme, fee, admission and handbook evidence.`,
      `${programme.name} 已按 UNITEN 官方专业页、费用、招生和手册证据公开展示。`,
      `${programme.name} 已按 UNITEN 官方專業頁、費用、招生和手冊證據公開展示。`
    ),
    officialAccreditationNote: null,
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: programme.officialSourceUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    publicDisplayNote: "已依据 UNITEN 官方来源完成上线硬门禁校验：中文专业名、中文学院、列表仅 IELTS、准确学费和数字学制。",
    reviewReason: null,
    auditNote: normalizeLongText([
      `Published from UNITEN reviewed ${programme.level} audit row ${ordinal}.`,
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || programme.officialSourceUrl}.`,
      programme.curriculumNote || "",
      programme.studyModeNote || ""
    ].filter(Boolean).join(" ")),
    listTuitionText: `RM ${formatNumber(tuitionMYR)}`,
    isPublished: true
  };
}

async function verifyImportedUnitenRows(manager: EntityManager | DataSource, universityId: number) {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("UNITEN university row not found during verification.");
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  const publicRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number])
  );
  return verifyUnitenAllLevelPublicRecordSet(university, publicRows, allUniversityRows);
}

async function runUnitenPublication(options: {
  undergraduatePath: string;
  masterPath: string;
  doctoralPath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audits = loadUnitenReviewedAudits(options);
  const validationErrors = [
    ...validateUnitenReviewedAudit(audits.undergraduate, expectedByLevel.bachelor, "undergraduate"),
    ...validateUnitenReviewedAudit(audits.master, expectedByLevel.master, "master"),
    ...validateUnitenReviewedAudit(audits.doctoral, expectedByLevel.phd, "doctoral")
  ];
  if (validationErrors.length) throw new Error(`UNITEN reviewed audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildUnitenOfficialAuditRows(audits);
  const summary = summarizeUnitenOfficialAuditImport(rows);
  const plan = buildPublishPlan(options, summary, audits);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "uniten-all-level-dry-run",
      planPath: options.planOutput,
      summary,
      nextStep: "Run npm --workspace @studymy/api run import:uniten:official-audit -- --confirm-import"
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "UNITEN" } })) ||
      (await universityRepo.findOne({ where: { slug: "universiti-tenaga-nasional" } }));

    if (options.verifyOnly) {
      if (!university) throw new Error("UNITEN university row not found.");
      const verification = await verifyImportedUnitenRows(dataSource, university.id);
      console.log(JSON.stringify({ mode: "uniten-all-level-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: "universiti-tenaga-nasional" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug universiti-tenaga-nasional belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/uniten-all-level-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: UnitenVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "UNITEN" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: "universiti-tenaga-nasional" } }));

      const universitySeed = buildUnitenUniversityRow(audits, rows, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX}%`) }
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
          row.publicDisplayNote = "Archived because the UNITEN all-level official publication batch supersedes this legacy or review row.";
          row.reviewReason = normalizeLongText([
            row.reviewReason,
            "Archived by UNITEN all-level official publication; current public display uses uniten-official-20260626 rows."
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
      verification = await verifyImportedUnitenRows(manager, university.id);
    });

    if (!verification) throw new Error("UNITEN all-level publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    writeJson(options.postImportAuditOutput, buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared));
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "uniten-all-level-published",
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
  summary: UnitenImportSummary,
  audits: UnitenAuditInputSet
) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "UNITEN",
      shortName: "UNITEN",
      name: "Universiti Tenaga Nasional (UNITEN)",
      slug: "universiti-tenaga-nasional"
    },
    authorization: "operator-requested-publication-for-review",
    sourceInputs: {
      undergraduateAudit: relative(repositoryRoot, options.undergraduatePath),
      masterAudit: relative(repositoryRoot, options.masterPath),
      doctoralAudit: relative(repositoryRoot, options.doctoralPath),
      sourceAuditSafeToImport: false,
      sourceAuditReason: "StudyMY audit JSON stays safe_to_import=false by contract; this importer publishes only after explicit operator command."
    },
    writePolicy: {
      importer: "apps/api/src/db/import-uniten-official-audit.ts",
      mode: "publish-all-levels",
      upsertPrefix: UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
      universityRow: "upsert by code UNITEN or slug universiti-tenaga-nasional",
      programmeRows: "upsert 37 current UNITEN public rows and archive non-current UNITEN rows",
      transactional: true,
      backupRequired: true
    },
    publicationHardGate: {
      result: "passed",
      standard: "docs/prd/StudyMY-official-programme-publication-hard-gate.md",
      rules: ["Chinese programme name", "Chinese faculty", "IELTS-only list language", "single official tuition", "numeric duration years"]
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
  summary: UnitenImportSummary,
  verification: UnitenVerification,
  backupPath: string,
  catalogCacheCleared: boolean
) {
  return {
    schemaVersion: 1,
    mode: "uniten-all-level-published-for-review",
    createdAt: new Date().toISOString(),
    institution: {
      code: "UNITEN",
      name: "Universiti Tenaga Nasional (UNITEN)",
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
      languageRows: verification.languageRows,
      officialFeeRows: verification.officialFeeRows,
      sourceRows: verification.sourceRows
    }
  };
}

function buildReleaseReportMarkdown(verification: UnitenVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# UNITEN All-Level Official Publication Report",
    "",
    "- Decision: published for Ian review",
    "- Scope: Universiti Tenaga Nasional official bachelor, master and doctoral programmes",
    `- Published rows: ${verification.publishedRows}`,
    `- By level: bachelor ${verification.byLevel.bachelor}, master ${verification.byLevel.master}, phd ${verification.byLevel.phd}`,
    `- Ready rows: ${verification.readyRows}`,
    `- Official fee rows: ${verification.officialFeeRows}`,
    `- IELTS rows: ${verification.languageRows}`,
    `- Chinese programme name rows: ${verification.chineseNameRows}`,
    `- Chinese faculty rows: ${verification.chineseFacultyRows}`,
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
    "- 列表仅展示 IELTS：通过",
    "- 学费为单一准确官方费用：通过",
    "- 学制为数字年数：通过",
    "",
    "## Official Sources",
    "",
    `- ${undergraduateDirectoryUrl}`,
    `- ${postgraduateDirectoryUrl}`,
    `- ${admissionUrl}`,
    `- ${internationalStudentsUrl}`,
    `- ${academicCalendarUrl}`,
    ""
  ].join("\n");
}

function buildUnitenProgrammeSourceLinks(programme: UnitenAuditProgramme): OfficialSourceLink[] {
  const urls = new Set([
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || programme.officialSourceUrl,
    programme.level === "undergraduate" ? undergraduateDirectoryUrl : postgraduateDirectoryUrl,
    admissionUrl,
    internationalStudentsUrl,
    ...urlsFromUnknown(programme.fieldEvidence),
    ...urlsFromUnknown(programme.fieldStatus)
  ].filter(Boolean));

  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({
      title: sourceLinkTitle(url, programme),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: url === (programme.officialFeeSourceUrl || programme.officialSourceUrl)
        ? "UNITEN official programme page used for the international Total Programme Fee."
        : "Official UNITEN source used for the 2026-06-26 public audit."
    }));
}

function buildUnitenUniversitySourceLinks(audits: UnitenAuditInputSet): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    undergraduateDirectoryUrl,
    postgraduateDirectoryUrl,
    admissionUrl,
    internationalStudentsUrl,
    academicCalendarUrl,
    ...urlsFromUnknown(audits.undergraduate.sourceRegistry),
    ...urlsFromUnknown(audits.master.sourceRegistry),
    ...urlsFromUnknown(audits.doctoral.sourceRegistry)
  ]);
  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({
      title: sourceLinkTitle(url),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: "Official UNITEN university/programme source used for all-level publication."
    }));
}

function buildLanguage(programme: UnitenAuditProgramme): LanguageRequirement {
  return {
    ielts: programme.language?.ielts || 0,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: UnitenAuditProgramme) {
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

function buildAcademicRequirement(programme: UnitenAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `Degree level: ${requirement.degreeLevel}.` : "",
    requirement.degreeRelevance ? `Degree relevance: ${requirement.degreeRelevance}.` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `Published CGPA threshold: ${requirement.minGPA}/${requirement.gpaScale || 4}.` : "",
    requirement.workExperience ? `Work or experience requirement: ${requirement.workExperience}.` : "",
    "See the official UNITEN programme page and admission review for final equivalency assessment."
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirementZh(programme: UnitenAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `学历层级：${requirement.degreeLevel}。` : "",
    requirement.degreeRelevance ? `相关背景：${requirement.degreeRelevance}。` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `官方 CGPA 门槛：${requirement.minGPA}/${requirement.gpaScale || 4}。` : "",
    requirement.workExperience ? `工作经验要求：${requirement.workExperience}。` : "",
    "最终等效资格以 UNITEN 官方专业页和录取审核为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: UnitenAuditProgramme) {
  return normalizeLongText([
    programme.studyModeNote || "",
    programme.thesisRequired === true ? "Thesis, dissertation, research project or final project applies where required by the programme structure." : "",
    programme.thesisNote || "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.supervisorSystem === true ? "Supervisor or research supervision applies." : "",
    programme.creditHours ? `Credit hours: ${programme.creditHours}.` : "",
    programme.fieldStatus?.applicationDeadline?.note || ""
  ].filter(Boolean).join(" "));
}

function buildDurationOfficial(programme: UnitenAuditProgramme) {
  const evidence = fieldEvidenceValue(programme, "duration");
  const standard = `${programme.duration} ${programme.duration === 1 ? "year" : "years"}`;
  return normalizeText([standard, evidence, programme.fieldStatus?.duration?.note, programme.studyModeNote].filter(Boolean).join(". "), 500);
}

function localizedChineseList(chineseItems: string[], englishItems: string[]): LocalizedStringArray {
  return arr(englishItems, englishItems, chineseItems, chineseItems);
}

function englishListFallback(label: string, programme: UnitenAuditProgramme) {
  return [`See the official UNITEN programme page for ${label} of ${programme.nameEn}.`];
}

function mapUnitenLevel(level: UnitenAuditLevel): UnitenDegreeLevel {
  if (level === "undergraduate") return "bachelor";
  if (level === "doctoral") return "phd";
  return "master";
}

function inferStudyMode(programme: UnitenAuditProgramme) {
  const text = `${programme.nameEn} ${programme.studyModeNote || ""}`.toLowerCase();
  if (/open|distance|odl/.test(text)) return "online-distance-learning";
  if (/research|doctor of philosophy|phd/.test(text)) return "research";
  if (/coursework/.test(text)) return "coursework";
  return "on-campus";
}

function inferCampus(programme: UnitenAuditProgramme) {
  const text = `${programme.faculty} ${programme.nameEn}`.toLowerCase();
  if (/business|accounting|finance|management|economics/.test(text)) return "Sultan Haji Ahmad Shah Campus / UNITEN Malaysia";
  return "Putrajaya Campus / UNITEN Malaysia";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|mba|management|finance|accounting|economics|marketing|administration|entrepreneurship/.test(value)) return "business";
  if (/computer|information|analytics|data|software|digital|technology|multimedia|cyber|artificial intelligence|ict/.test(value)) return "it";
  if (/engineering|electrical|mechanical|civil|structural|energy/.test(value)) return "engineering";
  if (/science/.test(value)) return "science";
  return "arts";
}

function intakeMonthNames(months: number[]) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (months || []).map((month) => names[month - 1]).filter(Boolean);
}

function sourceLinkTitle(url: string, programme?: UnitenAuditProgramme) {
  if (url === officialWebsite) return "UNITEN official website";
  if (url === undergraduateDirectoryUrl) return "UNITEN undergraduate programme directory";
  if (url === postgraduateDirectoryUrl) return "UNITEN postgraduate programme directory";
  if (url === admissionUrl) return "UNITEN Admission";
  if (url === internationalStudentsUrl) return "UNITEN International Students";
  if (url === academicCalendarUrl) return "UNITEN Academic Calendar";
  if (programme && url === programme.officialSourceUrl) return "Official programme page";
  if (/handbook|prospectus|booklet|pdf/i.test(url)) return "Official UNITEN PDF";
  return "Official UNITEN source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/fee|tuition/.test(value)) return "fee";
  if (/application|admission|international|apply-now/.test(value)) return "admission";
  if (/programme|program|prospectus|booklet|handbook/.test(value)) return "study-portal";
  if (value === officialWebsite) return "profile";
  return "other";
}

function officialUnitenUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "www.uniten.edu.my" || host.endsWith(".uniten.edu.my") || host === "unitendev.blob.core.windows.net";
  } catch {
    return false;
  }
}

function fieldEvidenceValue(programme: UnitenAuditProgramme, field: string) {
  const value = asRecord(programme.fieldEvidence)[field];
  if (Array.isArray(value)) {
    const first = asRecord(value[0]);
    return normalizeText(first.evidence || first.value || "", 500);
  }
  const record = asRecord(value);
  return normalizeText(record.evidence || record.value || "", 500);
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
  await runUnitenPublication({
    undergraduatePath: resolve(readArgValue("--undergraduate-audit") || DEFAULT_UNITEN_UNDERGRADUATE_AUDIT_PATH),
    masterPath: resolve(readArgValue("--master-audit") || DEFAULT_UNITEN_MASTER_AUDIT_PATH),
    doctoralPath: resolve(readArgValue("--doctoral-audit") || DEFAULT_UNITEN_DOCTORAL_AUDIT_PATH),
    planOutput: resolve(readArgValue("--plan-output") || DEFAULT_UNITEN_PUBLISH_PLAN_PATH),
    postImportAuditOutput: resolve(readArgValue("--post-import-audit-output") || DEFAULT_UNITEN_POST_IMPORT_AUDIT_PATH),
    releaseReportOutput: resolve(readArgValue("--release-report-output") || DEFAULT_UNITEN_RELEASE_REPORT_PATH),
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
