import "reflect-metadata";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, type DeepPartial, type EntityManager } from "typeorm";
import {
  muetBandToIeltsEquivalent,
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
const uumImportDir = resolve(repositoryRoot, "data/imports/uum/2026-06-28/all-level-publication");

export const UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX = "uum-public-20260628-";
export const DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/UUM_audit_undergraduate_20260627_reviewed_v6.json"
);
export const DEFAULT_UUM_MASTER_AUDIT_PATH = resolve(repositoryRoot, "audits/UUM_audit_master_20260628_reviewed_v7.json");
export const DEFAULT_UUM_DOCTORAL_AUDIT_PATH = resolve(repositoryRoot, "audits/UUM_audit_doctoral_20260628_reviewed_v3.json");
export const DEFAULT_UUM_PUBLISH_PLAN_PATH = resolve(uumImportDir, "01_publish_plan.json");
export const DEFAULT_UUM_POST_IMPORT_AUDIT_PATH = resolve(uumImportDir, "02_post_import_audit.json");
export const DEFAULT_UUM_RELEASE_REPORT_PATH = resolve(uumImportDir, "03_release_report.md");

const verifiedAt = "2026-06-28";
const myrToCny = 1.55;
const expectedProgrammes = 105;
const expectedByLevel = { bachelor: 38, master: 61, phd: 6 } as const;
const universitySlug = "universiti-utara-malaysia-uum";
const officialWebsite = "https://www.uum.edu.my/";
const undergraduateCatalogueUrl = "http://hea.uum.edu.my/index.php/undergraduate-international#progoffered";
const undergraduateLanguageUrl = "http://hea.uum.edu.my/index.php/undergraduate-international#english";
const undergraduateEntryUrl = "http://hea.uum.edu.my/index.php/undergraduate-international#general";
const undergraduateApplicationPortalUrl = "https://apply.uum.edu.my/onlineapp_ug/app_login.aspx";
const undergraduateCalendarUrl = "http://hea.uum.edu.my/index.php/academic-calendar-ug";
const undergraduateFeeSourceUrl = "https://drive.google.com/file/d/1ZBVne2hdOeI7gqIGaaGLyklMKNMRppOE/view?usp=drive_link";
const postgraduateGuidelinesUrl = "https://www.uum.edu.my/admissions/application-guidelines/postgraduate";
const masterCatalogueUrl = "https://www.uum.edu.my/admissions/application-guidelines/postgraduate/master-programmes";
const doctoralCatalogueUrl = "https://www.uum.edu.my/admissions/application-guidelines/postgraduate/doctorate-programmes";
const postgraduateFeesUrl = "https://www.uum.edu.my/admissions/fees/postgraduate";
const postgraduateApplicationPortalUrl = "https://apply.uum.edu.my/onlineapp/app_login.aspx";
const postgraduateCalendarUrl = "https://hea.uum.edu.my/index.php/postgraduate-academic-calendar";
const oyagsbHandbook2026Url = "https://oyagsb.uum.edu.my/images/2026/academichandbook/PG%20HANDBOOK%20EDISI%202026.pdf";

const publicCatalogProgramStatuses = ["ready", "current-cycle-not-open", "official-language-requirement-not-published", "not-available-for-international"] as const;

type UumAuditLevel = "undergraduate" | "master" | "doctoral";
type UumDegreeLevel = "bachelor" | "master" | "phd";

interface UumEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface UumAuditProgramme {
  code?: string;
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: UumAuditLevel;
  duration: number | null;
  durationNote?: string | null;
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
  pending_issues?: Array<Record<string, unknown>>;
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
    strictFeeGateStats?: Record<string, unknown>;
    policyDecisions?: unknown[];
    qualityRuleCandidates?: unknown[];
  };
  repair_log?: unknown[];
}

interface UumAuditInputSet {
  undergraduate: UumReviewedAudit;
  master: UumReviewedAudit;
  doctoral: UumReviewedAudit;
}

interface UumImportSummary {
  importRows: number;
  byLevel: Record<UumDegreeLevel, number>;
  readyRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialTotalFeeRows: number;
  calculatedFromOfficialRateRows: number;
  officialRateFeeRows: number;
  scalarTuitionRows: number;
  rateOnlyDisplayRows: number;
  languageRows: number;
  undergraduateEquivalentIeltsRows: number;
  durationKnownRows: number;
  durationOfficialUnpublishedRows: number;
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
  "Submit the official UUM online application for the intended programme and intake.",
  "Upload academic certificates and transcripts; documents not issued in English require translation where requested.",
  "Submit passport, photo, English-language evidence and other supporting documents requested by UUM.",
  "Follow offer, visa, medical screening, registration and fee-payment instructions issued by UUM."
];

const chineseApplicationDocs = [
  "通过 UUM 官方在线申请系统提交目标专业和入学批次申请",
  "提交学历证书和成绩单；非英文文件按 UUM 要求提供翻译件",
  "提交护照、照片、英语成绩证明及 UUM 要求的其他支持材料",
  "按 UUM 录取、签证、体检、注册和缴费指引完成后续流程"
];

export function loadUumPublicationAudits(paths: {
  undergraduatePath?: string;
  masterPath?: string;
  doctoralPath?: string;
} = {}): UumAuditInputSet {
  return {
    undergraduate: loadJson<UumReviewedAudit>(paths.undergraduatePath || DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH),
    master: loadJson<UumReviewedAudit>(paths.masterPath || DEFAULT_UUM_MASTER_AUDIT_PATH),
    doctoral: loadJson<UumReviewedAudit>(paths.doctoralPath || DEFAULT_UUM_DOCTORAL_AUDIT_PATH)
  };
}

export function validateUumPublicationAudit(audit: UumReviewedAudit, expectedCount: number, targetLevel: UumAuditLevel): string[] {
  const errors: string[] = [];
  if (audit.safe_to_import !== false) errors.push(`${targetLevel}: safe_to_import must remain false.`);
  if (audit.import_approved_by != null || audit.import_approved_at != null) errors.push(`${targetLevel}: import approval fields must remain null.`);
  if (audit.auditMeta?.targetUniversityShortName !== "UUM") errors.push(`${targetLevel}: targetUniversityShortName must be UUM.`);
  if (audit.auditMeta?.targetLevel !== targetLevel) errors.push(`${targetLevel}: targetLevel mismatch.`);
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedCount) errors.push(`${targetLevel}: baseline must be ${expectedCount}.`);
  if (audit.auditMeta?.totalProgrammesCollected !== expectedCount) errors.push(`${targetLevel}: collected count must be ${expectedCount}.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
    errors.push(`${targetLevel}: expected ${expectedCount} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if (audit.auditMeta?.readyCount !== expectedCount) errors.push(`${targetLevel}: readyCount must be ${expectedCount}.`);
  if (audit.auditMeta?.needsReviewCount !== 0) errors.push(`${targetLevel}: needsReviewCount must be 0.`);
  if (!["PASS", "PASS-WITH-EXCEPTIONS"].includes(String(audit.validationMeta?.overallDecision || ""))) {
    errors.push(`${targetLevel}: validationMeta overallDecision must be PASS or PASS-WITH-EXCEPTIONS.`);
  }
  if (targetLevel !== "undergraduate" && (audit.pending_issues || []).length !== 0) {
    errors.push(`${targetLevel}: pending_issues must be empty.`);
  }
  if (targetLevel !== "undergraduate" && openExceptions(audit).length !== 0) {
    errors.push(`${targetLevel}: exception_queue must not contain open blocking exceptions.`);
  }

  const seenNames = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `${targetLevel} ${index + 1} ${programme.nameEn || "unknown"}`;
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (seenNames.has(programme.nameEn)) errors.push(`${row}: duplicate programme name.`);
    seenNames.add(programme.nameEn);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn || !programme.name.includes(`（${programme.nameEn}）`)) {
      errors.push(`${row}: Chinese bilingual programme name is required.`);
    }
    if (programme.level !== targetLevel) errors.push(`${row}: level must be ${targetLevel}.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) errors.push(`${row}: Chinese faculty is required.`);
    if (!officialUumUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be UUM official URL.`);
    if (!programme.officialFeeSourceUrl || !officialUumOrLinkedFeeUrl(programme.officialFeeSourceUrl)) {
      errors.push(`${row}: officialFeeSourceUrl must be UUM official URL or UUM HEA linked fee file.`);
    }
    if (programme.publicDisplayStatus !== "ready") errors.push(`${row}: publicDisplayStatus must be ready.`);
    if (!String(programme.auditStatus || "").startsWith("official-verified")) errors.push(`${row}: auditStatus must be official-verified.`);
    if (typeof programme.duration !== "number" && programme.fieldStatus?.duration?.status !== "official-unpublished") {
      errors.push(`${row}: missing duration must be marked official-unpublished.`);
    }
    if (!feeIsPublishable(programme, targetLevel)) errors.push(`${row}: tuition must be an official or officially calculated scalar total.`);
    const ielts = publicationIelts(programme, targetLevel);
    if (!ielts) errors.push(`${row}: IELTS list score is required for publication mapping.`);
    if (!Array.isArray(programme.applicationDocs) || programme.applicationDocs.length === 0) {
      errors.push(`${row}: applicationDocs array is required.`);
    }
  }
  return errors;
}

export function buildUumOfficialAuditRows(audits: UumAuditInputSet): Array<DeepPartial<ProgramEntity>> {
  const inputs: Array<[UumAuditLevel, UumReviewedAudit]> = [
    ["undergraduate", audits.undergraduate],
    ["master", audits.master],
    ["doctoral", audits.doctoral]
  ];
  let ordinal = 0;
  return inputs.flatMap(([level, audit]) =>
    audit.programmes.map((programme) => buildUumProgrammeRow(programme, level, ++ordinal))
  );
}

export function summarizeUumOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): UumImportSummary {
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
    officialTotalFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    calculatedFromOfficialRateRows: rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate").length,
    officialRateFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified").length,
    scalarTuitionRows: rows.filter((row) => Number(row.tuitionAmount || 0) > 0 && Number(row.officialTuitionMYR || 0) > 0).length,
    rateOnlyDisplayRows: rows.filter((row) => feeDisplayIsRateOnly(row)).length,
    languageRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0).length,
    undergraduateEquivalentIeltsRows: rows.filter((row) => String(row.auditNote || "").includes("本科列表 IELTS 展示口径")).length,
    durationKnownRows: rows.filter((row) => Number(row.durationYears || 0) > 0).length,
    durationOfficialUnpublishedRows: rows.filter((row) => !Number(row.durationYears || 0) && /not published/i.test(String(row.durationOfficial || ""))).length,
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
  audits: UumAuditInputSet,
  rows: Array<DeepPartial<ProgramEntity>>,
  existing: UniversityEntity | null = null
): DeepPartial<UniversityEntity> {
  const annualCosts = rows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const ieltsValues = rows.map((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0)).filter((value) => value > 0);
  const summary = summarizeUumOfficialAuditImport(rows);
  const {
    uumUndergraduatePublication: _legacyUumUndergraduatePublication,
    ...officialProfileBase
  } = asRecord(existing?.officialProfile);

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
    description: t(
      "Universiti Utara Malaysia (UUM) is a Malaysian public management-focused university. This public catalogue entry is backed by the 2026-06-28 official bachelor, master and doctoral audit publication batch.",
      "Universiti Utara Malaysia (UUM) is a Malaysian public management-focused university. This public catalogue entry is backed by the 2026-06-28 official bachelor, master and doctoral audit publication batch.",
      "马来西亚北方大学（UUM）是马来西亚公立管理型大学；本公开目录已接入 2026-06-28 官方本科、硕士和博士审计发布批次。",
      "馬來西亞北方大學（UUM）是馬來西亞公立管理型大學；本公開目錄已接入 2026-06-28 官方本科、碩士和博士審計發布批次。"
    ),
    website: officialWebsite,
    admissionEmail: existing?.admissionEmail || "international@uum.edu.my",
    nameEnOfficial: "Universiti Utara Malaysia (UUM)",
    officialWebsite,
    studyPortalUrl: undergraduateCatalogueUrl,
    internationalPageUrl: undergraduateCatalogueUrl,
    applicationPortalUrl: undergraduateApplicationPortalUrl,
    officialAddress: existing?.officialAddress || "Universiti Utara Malaysia, Sintok, Kedah, Malaysia",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: arr(englishApplicationDocs, englishApplicationDocs, chineseApplicationDocs, chineseApplicationDocs),
    chinaStudentRequirements: arr(
      ["UUM official sources publish general international undergraduate and postgraduate routes; this batch did not find a separate China-specific equivalency table."],
      ["UUM official sources publish general international undergraduate and postgraduate routes; this batch did not find a separate China-specific equivalency table."],
      ["UUM 官方来源公布国际本科和研究生统一路径；本批次未发现单独中国学生等效学历表。"],
      ["UUM 官方來源公布國際本科和研究生統一路徑；本批次未發現單獨中國學生等效學歷表。"]
    ),
    officialProfile: {
      ...officialProfileBase,
      uumAllLevelPublication: {
        sourceAudits: {
          undergraduate: relative(repositoryRoot, DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH),
          master: relative(repositoryRoot, DEFAULT_UUM_MASTER_AUDIT_PATH),
          doctoral: relative(repositoryRoot, DEFAULT_UUM_DOCTORAL_AUDIT_PATH)
        },
        publishedAt: new Date().toISOString(),
        verifiedAt,
        reviewVersions: {
          undergraduate: audits.undergraduate.validationMeta?.reviewVersion,
          master: audits.master.validationMeta?.reviewVersion,
          doctoral: audits.doctoral.validationMeta?.reviewVersion
        },
        summary,
        publicationPolicies: [
          "Audit JSON remains safe_to_import=false by contract; this importer writes only after Ian's explicit publication command.",
          "Undergraduate rows keep original MUET evidence in audit fields, while publication list IELTS uses the project's MUET-to-IELTS display mapping requested by Ian.",
          "Master and doctoral multi-mode or research fees use official rate display when UUM does not publish a unique total.",
          "Duration rows use official UUM full-time/minimum duration evidence; public list keeps compact year values and detail fields retain source notes."
        ],
        pendingIssuesResolvedForPublication: audits.undergraduate.pending_issues || []
      },
      catalogStatusSummary: {
        all: {
          total: rows.length,
          ready: summary.readyRows,
          needsReview: 0
        },
        byLevel: {
          bachelor: { total: summary.byLevel.bachelor, ready: summary.byLevel.bachelor, needsReview: 0 },
          master: { total: summary.byLevel.master, ready: summary.byLevel.master, needsReview: 0 },
          phd: { total: summary.byLevel.phd, ready: summary.byLevel.phd, needsReview: 0 }
        }
      }
    },
    officialSources: buildUumUniversitySourceLinks(audits),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: "UUM bachelor, master and doctoral programmes are published from official UUM HEA, UUM postgraduate, OYAGSB handbook, fee and application sources. Multi-mode and research rows preserve official rate notes where UUM does not publish a unique total.",
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualCosts.length ? Math.min(...annualCosts) : existing?.tuitionMinCny || 0,
    tuitionMaxCny: annualCosts.length ? Math.max(...annualCosts) : existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 16000,
    minIelts: ieltsValues.length ? Math.min(...ieltsValues) : existing?.minIelts || 5,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr(
      ["UUM Sintok campus", "Library", "International undergraduate and postgraduate admission channels"],
      ["UUM Sintok campus", "Library", "International undergraduate and postgraduate admission channels"],
      ["UUM 新笃校区", "图书馆", "国际本科与研究生申请通道"],
      ["UUM 新篤校區", "圖書館", "國際本科與研究生申請通道"]
    ),
    highlights: existing?.highlights || arr(
      ["Official UUM all-level catalogue", "Public management-focused university", "Official international fee evidence"],
      ["Official UUM all-level catalogue", "Public management-focused university", "Official international fee evidence"],
      ["UUM 官方本硕博目录", "管理型公立大学", "官方国际学生费用证据"],
      ["UUM 官方本碩博目錄", "管理型公立大學", "官方國際學生費用證據"]
    ),
    programCount: rows.length,
    isPublished: true
  };
}

export function verifyUumAllLevelPublicRecordSet(
  university: UniversityEntity,
  publicRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): UumVerification {
  const summary = summarizeUumOfficialAuditImport(publicRows);
  const activeSupersededRows = allUniversityRows.filter((row) =>
    !row.slug.startsWith(UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  );
  const visibleCurrentRows = publicRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    row.slug.startsWith(UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  ).length;

  if (
    publicRows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedByLevel.bachelor ||
    summary.byLevel.master !== expectedByLevel.master ||
    summary.byLevel.phd !== expectedByLevel.phd ||
    summary.readyRows !== expectedProgrammes ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialTotalFeeRows !== 38 ||
    summary.calculatedFromOfficialRateRows !== 67 ||
    summary.officialRateFeeRows !== 0 ||
    summary.scalarTuitionRows !== expectedProgrammes ||
    summary.rateOnlyDisplayRows !== 0 ||
    summary.languageRows !== expectedProgrammes ||
    summary.undergraduateEquivalentIeltsRows !== 37 ||
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
    throw new Error(`UUM all-level public verification failed: ${JSON.stringify({
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

function buildUumProgrammeRow(programme: UumAuditProgramme, auditLevel: UumAuditLevel, ordinal: number): DeepPartial<ProgramEntity> {
  const level = degreeLevelFor(auditLevel);
  const durationYears = typeof programme.duration === "number" && programme.duration > 0 ? programme.duration : 0;
  const tuition = buildUumTuitionPresentation(programme, auditLevel, durationYears);
  const languageRequirement = buildLanguage(programme, auditLevel);
  const undergraduateEquivalent = auditLevel === "undergraduate" && !programme.language?.ielts && languageRequirement.ielts > 0;
  const sourceUrls = buildUumProgrammeSourceLinks(programme, auditLevel);
  const curriculumZh = displayCurriculumZh(programme);
  const careerZh = displayCareerZh(programme);

  return {
    slug: `${UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX}${level}-${String(ordinal).padStart(3, "0")}-${slugify(programme.code || programme.nameEn, 16)}-${slugify(programme.nameEn, 56)}`,
    code: buildProgrammeCode(programme, level, ordinal),
    name: t(programme.nameEn, programme.nameEn, programme.name, programme.name),
    nameEnOfficial: programme.nameEn,
    level,
    category: inferCategory(programme.nameEn, programme.faculty),
    faculty: t(programme.faculty, programme.faculty, programme.facultyZh || programme.faculty, programme.facultyZh || programme.faculty),
    facultyZh: programme.facultyZh || "",
    studyMode: normalizeStudyMode(programme, auditLevel),
    campus: inferCampus(programme),
    durationYears,
    durationOfficial: durationYears
      ? `${formatNumber(durationYears)} ${durationYears === 1 ? "year" : "years"}`
      : "Official duration not published by UUM for a single public-list value; see official source details.",
    annualTuitionCny: annualTuitionCny(tuition.amountMYR, durationYears),
    tuitionAmount: tuition.amountMYR,
    tuitionCurrency: "MYR" satisfies TuitionCurrency,
    tuitionDisplay: tuition.display,
    officialTuitionMYR: tuition.amountMYR,
    officialTuitionNote: buildTuitionNote(programme, auditLevel, tuition),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || feeSourceFor(auditLevel),
    secondaryOfficialFeeSourceUrl: secondaryFeeSourceFor(programme, auditLevel),
    officialFeeAuditStatus: tuition.auditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: intakeMonthNames(programme.intake),
    officialIntake: intakeMonthNames(programme.intake).join(", ") || "Refer to UUM official academic calendar or programme page.",
    officialIntakeNote: programme.applicationDeadline
      ? normalizeLongText(`Application timing: ${programme.applicationDeadline}`)
      : "UUM official source did not publish a single programme-specific application deadline for this row.",
    languageRequirement,
    officialLanguageRequirement: buildLanguageText(programme, auditLevel, undergraduateEquivalent),
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
    chinaStudentRequirement: "UUM 官方来源公布国际学生统一申请路径；本批次未发现单独中国学生等效学历表。",
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: arr(englishApplicationDocs, englishApplicationDocs, programme.applicationDocs || chineseApplicationDocs, programme.applicationDocs || chineseApplicationDocs),
    curriculum: arr(displayCurriculumEn(programme), displayCurriculumEn(programme), curriculumZh, curriculumZh),
    careers: arr(displayCareerEn(programme), displayCareerEn(programme), careerZh, careerZh),
    specializations: arr([]),
    description: t(
      `${programme.nameEn} is published from UUM official ${auditLevel} audit evidence.`,
      `${programme.nameEn} is published from UUM official ${auditLevel} audit evidence.`,
      `${programme.name} 已按 UUM 官方${levelLabelZh(auditLevel)}审计证据公开展示。`,
      `${programme.name} 已按 UUM 官方${levelLabelZh(auditLevel)}審計證據公開展示。`
    ),
    officialAccreditationNote: null,
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: entryRequirementSourceFor(auditLevel),
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    publicDisplayNote: buildPublicDisplayNote(programme, auditLevel, undergraduateEquivalent, tuition),
    reviewReason: null,
    auditNote: normalizeLongText([
      `Published from UUM all-level official audit row ${ordinal}.`,
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || feeSourceFor(auditLevel)}.`,
      undergraduateEquivalent
        ? "UUM 本科列表 IELTS 展示口径已按 Ian 指令执行；原始审计证据保留 MUET。"
        : "",
      tuition.amountMYR
        ? tuition.auditStatus === "calculated-from-official-rate"
          ? `Publication list fee uses scalar total tuition calculated from official UUM rates and official duration/credit evidence. ${tuition.calculationNote}`
          : "Publication list fee uses official total MYR amount."
        : "Publication list fee is not scalar and must not pass the public import gate.",
      durationYears
        ? "Publication duration uses official UUM duration evidence and keeps a compact year value for the public list."
        : "Publication duration keeps official-unpublished note; no invented year count is used.",
      programme.durationNote || "",
      programme.remarks || "",
      programme.curriculumNote || "",
      programme.studyModeNote || "",
      programme.interviewNote || "",
      ...(programme._validationIssues || []).map(formatAuditIssue)
    ].filter(Boolean).join(" ")),
    listTuitionText: tuition.display,
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
  return verifyUumAllLevelPublicRecordSet(university, publicRows, allUniversityRows);
}

async function runUumPublication(options: {
  undergraduatePath: string;
  masterPath: string;
  doctoralPath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audits = loadUumPublicationAudits(options);
  const validationErrors = [
    ...validateUumPublicationAudit(audits.undergraduate, expectedByLevel.bachelor, "undergraduate"),
    ...validateUumPublicationAudit(audits.master, expectedByLevel.master, "master"),
    ...validateUumPublicationAudit(audits.doctoral, expectedByLevel.phd, "doctoral")
  ];
  if (validationErrors.length) throw new Error(`UUM all-level audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildUumOfficialAuditRows(audits);
  const summary = summarizeUumOfficialAuditImport(rows);
  const plan = buildPublishPlan(options, summary, audits);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "uum-all-level-dry-run",
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
      console.log(JSON.stringify({ mode: "uum-all-level-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: universitySlug } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug ${universitySlug} belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/uum-all-level-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
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

      const universitySeed = buildUumUniversityRow(audits, rows, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX}%`) }
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
          row.publicDisplayNote = "Archived because the UUM all-level official publication batch supersedes this legacy or review row.";
          row.reviewReason = normalizeLongText([
            row.reviewReason,
            "Archived by UUM all-level official publication; current public display uses uum-public-20260628 rows."
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

    if (!verification) throw new Error("UUM all-level publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    writeJson(options.postImportAuditOutput, buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared));
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "uum-all-level-published",
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

function buildPublishPlan(options: { undergraduatePath: string; masterPath: string; doctoralPath: string }, summary: UumImportSummary, audits: UumAuditInputSet) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "UUM",
      shortName: "UUM",
      name: "Universiti Utara Malaysia",
      slug: universitySlug
    },
    authorization: "ian-requested-all-level-publication-after-review",
    sourceInputs: {
      undergraduateAudit: relative(repositoryRoot, options.undergraduatePath),
      masterAudit: relative(repositoryRoot, options.masterPath),
      doctoralAudit: relative(repositoryRoot, options.doctoralPath),
      sourceAuditSafeToImport: false,
      sourceAuditReason: "StudyMY audit JSON stays safe_to_import=false by contract; this importer publishes only after Ian's explicit operator command."
    },
    writePolicy: {
      importer: "apps/api/src/db/import-uum-official-all-level.ts",
      mode: "publish-all-level",
      upsertPrefix: UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
      universityRow: `upsert by code UUM or slug ${universitySlug}`,
      programmeRows: "upsert 105 current UUM all-level public rows and archive non-current UUM rows",
      transactional: true,
      backupRequired: true,
      frontendDesignPolicy: "data-only publication; no web component, style or layout edits"
    },
    publicationPolicy: {
      readyRows: summary.readyRows,
      undergraduateEquivalentIeltsRows: summary.undergraduateEquivalentIeltsRows,
      officialTotalFeeRows: summary.officialTotalFeeRows,
      calculatedFromOfficialRateRows: summary.calculatedFromOfficialRateRows,
      officialRateFeeRows: summary.officialRateFeeRows,
      scalarTuitionRows: summary.scalarTuitionRows,
      rateOnlyDisplayRows: summary.rateOnlyDisplayRows,
      durationKnownRows: summary.durationKnownRows,
      durationOfficialUnpublishedRows: summary.durationOfficialUnpublishedRows,
      rationale: "UUM undergraduate list IELTS follows Ian's MUET-equivalent display instruction; UUM duration display uses official full-time/minimum duration evidence; UUM public tuition display now uses scalar total tuition only. Undergraduate rows use official HEA total fees; postgraduate rows use UUM official rates calculated against official duration or official credit-hour evidence, with mode-specific fee notes preserved in details.",
      undergraduateLanguageGateStats: audits.undergraduate.validationMeta?.languageGateStats,
      masterStrictFeeGateStats: audits.master.validationMeta?.strictFeeGateStats,
      doctoralStrictFeeGateStats: audits.doctoral.validationMeta?.strictFeeGateStats
    },
    expectedSurface: {
      programmeCount: expectedProgrammes,
      byLevel: expectedByLevel,
      summary,
      validationMeta: {
        undergraduate: audits.undergraduate.validationMeta,
        master: audits.master.validationMeta,
        doctoral: audits.doctoral.validationMeta
      },
      pendingIssues: {
        undergraduate: audits.undergraduate.pending_issues || [],
        master: audits.master.pending_issues || [],
        doctoral: audits.doctoral.pending_issues || []
      }
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
    mode: "uum-all-level-published",
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
      rowsReady: verification.readyRows
    },
    displayGate: {
      chineseNameRows: verification.chineseNameRows,
      chineseFacultyRows: verification.chineseFacultyRows,
      chineseCurriculumRows: verification.chineseCurriculumRows,
      chineseCareerRows: verification.chineseCareerRows,
      languageRows: verification.languageRows,
      undergraduateEquivalentIeltsRows: verification.undergraduateEquivalentIeltsRows,
      officialTotalFeeRows: verification.officialTotalFeeRows,
      calculatedFromOfficialRateRows: verification.calculatedFromOfficialRateRows,
      officialRateFeeRows: verification.officialRateFeeRows,
      scalarTuitionRows: verification.scalarTuitionRows,
      rateOnlyDisplayRows: verification.rateOnlyDisplayRows,
      durationKnownRows: verification.durationKnownRows,
      durationOfficialUnpublishedRows: verification.durationOfficialUnpublishedRows,
      sourceRows: verification.sourceRows
    },
    designBoundary: {
      frontendFilesModified: false,
      note: "This publication imports data only and does not alter StudyMY page design, layout, CSS or components."
    }
  };
}

function buildReleaseReportMarkdown(verification: UumVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# UUM All-Level Official Publication Report",
    "",
    "- Decision: published for Ian review",
    "- Scope: Universiti Utara Malaysia official bachelor, master and doctoral programmes",
    `- Published rows: ${verification.publishedRows}`,
    `- By level: bachelor ${verification.byLevel.bachelor}, master ${verification.byLevel.master}, phd ${verification.byLevel.phd}`,
    `- Ready rows: ${verification.readyRows}`,
    `- IELTS rows: ${verification.languageRows}`,
    `- Undergraduate MUET-to-IELTS display rows: ${verification.undergraduateEquivalentIeltsRows}`,
    `- Official total-fee rows: ${verification.officialTotalFeeRows}`,
    `- Calculated total-fee rows: ${verification.calculatedFromOfficialRateRows}`,
    `- Official fee-rate rows: ${verification.officialRateFeeRows}`,
    `- Scalar tuition rows: ${verification.scalarTuitionRows}`,
    `- Rate-only display rows: ${verification.rateOnlyDisplayRows}`,
    `- Known duration rows: ${verification.durationKnownRows}`,
    `- Official-unpublished duration rows: ${verification.durationOfficialUnpublishedRows}`,
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
    "- Audit JSON files remain safe_to_import=false.",
    "- The importer writes public database rows only because Ian explicitly requested all-level import and publication review.",
    "- No frontend design, page layout, CSS or component files are changed.",
    "- Undergraduate list IELTS uses the project MUET-to-IELTS mapping requested by Ian; original audit evidence remains preserved.",
    "- Duration list values use official UUM full-time/minimum duration evidence; full official mode/range notes remain in audit evidence and detail notes.",
    "- Master and doctoral rows use scalar total tuition calculated from official UUM fee rates and official duration/credit evidence; rate-only list display is blocked.",
    "",
    "## Official Sources",
    "",
    `- ${officialWebsite}`,
    `- ${undergraduateCatalogueUrl}`,
    `- ${undergraduateLanguageUrl}`,
    `- ${undergraduateFeeSourceUrl}`,
    `- ${postgraduateGuidelinesUrl}`,
    `- ${masterCatalogueUrl}`,
    `- ${doctoralCatalogueUrl}`,
    `- ${postgraduateFeesUrl}`,
    `- ${oyagsbHandbook2026Url}`,
    ""
  ].join("\n");
}

function buildUumProgrammeSourceLinks(programme: UumAuditProgramme, auditLevel: UumAuditLevel): OfficialSourceLink[] {
  const urls = new Set([
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || feeSourceFor(auditLevel),
    catalogueUrlFor(auditLevel),
    entryRequirementSourceFor(auditLevel),
    feeSourceFor(auditLevel),
    applicationPortalFor(auditLevel),
    calendarSourceFor(auditLevel),
    ...urlsFromUnknown(programme.fieldEvidence),
    ...urlsFromUnknown(programme.fieldStatus),
    ...urlsFromUnknown(programme.crawlLog)
  ].filter(Boolean));

  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url) => ({
      title: sourceLinkTitle(url, programme, auditLevel),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: url === (programme.officialFeeSourceUrl || feeSourceFor(auditLevel))
        ? "Official UUM fee evidence used for the all-level publication batch."
        : "Official UUM source used for the all-level publication batch."
    }));
}

function buildUumUniversitySourceLinks(audits: UumAuditInputSet): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    undergraduateCatalogueUrl,
    undergraduateLanguageUrl,
    undergraduateEntryUrl,
    undergraduateApplicationPortalUrl,
    undergraduateCalendarUrl,
    undergraduateFeeSourceUrl,
    postgraduateGuidelinesUrl,
    masterCatalogueUrl,
    doctoralCatalogueUrl,
    postgraduateFeesUrl,
    postgraduateApplicationPortalUrl,
    postgraduateCalendarUrl,
    oyagsbHandbook2026Url,
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
      note: "Official UUM university/programme source used for all-level publication."
    }));
}

function buildLanguage(programme: UumAuditProgramme, auditLevel: UumAuditLevel): LanguageRequirement {
  const ielts = programme.language?.ielts || (auditLevel === "undergraduate" ? muetBandToIeltsEquivalent(programme.language?.muet) || 0 : 0);
  return {
    ielts,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: UumAuditProgramme, auditLevel: UumAuditLevel, undergraduateEquivalent: boolean) {
  const language = buildLanguage(programme, auditLevel);
  const parts = [
    `IELTS ${formatNumber(language.ielts)}`,
    undergraduateEquivalent
      ? `UUM HEA 原始公布 MUET Band ${programme.language?.muet}；StudyMY 列表按 Ian 指令展示 IELTS ${formatNumber(language.ielts)}。`
      : "",
    programme.language?.toefl ? `TOEFL ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
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
    "See UUM official entry requirements for final equivalency assessment."
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
    "最终等效资格以 UUM 官方入学要求审核为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: UumAuditProgramme) {
  return normalizeLongText([
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.creditHours ? `Credit hours: ${programme.creditHours}.` : "",
    programme.durationNote || "",
    programme.thesisNote || "",
    programme.supervisorSystem ? "Supervisor system applies where stated by the official source." : ""
  ].filter(Boolean).join(" "));
}

interface UumTuitionPresentation {
  amountMYR: number | null;
  display: string;
  auditStatus: FeeAuditStatus;
  calculationNote: string;
}

function buildUumTuitionPresentation(programme: UumAuditProgramme, auditLevel: UumAuditLevel, durationYears: number): UumTuitionPresentation {
  const auditAmount = typeof programme.tuitionMYR === "number" && programme.tuitionMYR > 0 ? Math.round(programme.tuitionMYR) : null;
  const calculated = calculateUumTuitionFromOfficialRate(programme, auditLevel, durationYears);
  const amountMYR = auditAmount || calculated?.amountMYR || null;
  const calculationNote = calculated?.note || String(asRecord(programme.fieldEvidence?.tuition).calculationFormula || "");

  if (!amountMYR) {
    return {
      amountMYR: null,
      display: primaryRateDisplay(programme, auditLevel),
      auditStatus: "official-rate-verified",
      calculationNote: "No scalar total could be calculated from the available UUM official evidence."
    };
  }

  return {
    amountMYR,
    display: `RM ${formatNumber(amountMYR)}`,
    auditStatus: auditLevel === "undergraduate" ? "matched-official" : "calculated-from-official-rate",
    calculationNote
  };
}

function calculateUumTuitionFromOfficialRate(programme: UumAuditProgramme, auditLevel: UumAuditLevel, durationYears: number) {
  const semesters = semestersForDuration(durationYears);
  if (auditLevel === "master") {
    if (isResearchMaster(programme) && semesters > 0) {
      return {
        amountMYR: 4650 * semesters,
        note: `RM 4,650/semester x ${semesters} semesters = RM ${formatNumber(4650 * semesters)}.`
      };
    }
    if (typeof programme.creditHours === "number" && programme.creditHours > 0) {
      const rate = masterCreditHourRate(programme);
      return {
        amountMYR: programme.creditHours * rate,
        note: `${programme.creditHours} credit hours x RM ${formatNumber(rate)}/credit hour = RM ${formatNumber(programme.creditHours * rate)}.`
      };
    }
  }

  if (auditLevel === "doctoral" && semesters > 0) {
    const rate = doctoralSemesterRate(programme);
    return {
      amountMYR: rate * semesters,
      note: `RM ${formatNumber(rate)}/semester x ${semesters} semesters = RM ${formatNumber(rate * semesters)}.`
    };
  }

  return null;
}

function semestersForDuration(durationYears: number) {
  return Math.max(Math.round(Number(durationYears || 0) * 2), 0);
}

function isResearchMaster(programme: UumAuditProgramme) {
  return programme.studyMode === "research" || /(?:-\s*)?Research\b/i.test(programme.nameEn) || /研究型/.test(programme.name || "");
}

function masterCreditHourRate(programme: UumAuditProgramme) {
  if (/Business Administration/i.test(programme.nameEn)) return 750;
  if (/Business Management/i.test(programme.nameEn)) return 600;
  return 550;
}

function doctoralSemesterRate(programme: UumAuditProgramme) {
  if (/DBA|Business Administration/i.test(programme.nameEn)) return 8820;
  if (/Education|Ed\.?D/i.test(programme.nameEn)) return 5250;
  return 5700;
}

function buildTuitionNote(programme: UumAuditProgramme, auditLevel: UumAuditLevel, tuition: UumTuitionPresentation) {
  return normalizeLongText([
    sanitizeTuitionNote(programme.tuitionNote),
    auditLevel === "undergraduate"
      ? "Publication list fee uses the official HEA total tuition fee."
      : `Publication list fee uses scalar total tuition calculated from UUM official postgraduate rates and official duration/credit-hour evidence. ${tuition.calculationNote} Details keep mode-specific fee notes and excluded charges.`
  ].filter(Boolean).join(" "));
}

function buildPublicDisplayNote(programme: UumAuditProgramme, auditLevel: UumAuditLevel, undergraduateEquivalent: boolean, tuition: UumTuitionPresentation) {
  if (undergraduateEquivalent) {
    return `列表展示 IELTS ${formatNumber(buildLanguage(programme, auditLevel).ielts)}；UUM 官方本科表原始公布为 MUET Band ${programme.language?.muet}，展示口径按 Ian 指令执行。`;
  }
  if (tuition.auditStatus === "calculated-from-official-rate") {
    return `UUM 硕博列表展示总学费；金额按官方费率与官方学制/学分证据计算。${tuition.calculationNote}`;
  }
  return "UUM 官方数据已通过本批次发布映射，可进入公开审核。";
}

function primaryRateDisplay(programme: UumAuditProgramme, auditLevel: UumAuditLevel) {
  const note = String(programme.tuitionNote || "");
  if (auditLevel === "doctoral" && /DBA/i.test(programme.nameEn)) return "RM 8,820 / semester";
  if (auditLevel === "doctoral" && /Education|Ed\.?D/i.test(programme.nameEn)) return "RM 5,250 / semester";
  if (auditLevel === "doctoral") return "RM 5,700 / semester";
  const semesterMatch = note.match(/RM\s*([\d,]+)\s*\/\s*semester|RM\s*([\d,]+)\s*\/\s*学期|RM\s*([\d,]+)\s*\/\s*學期|RM\s*([\d,]+)\s*\/semester/i);
  if (semesterMatch) return `RM ${formatNumber(Number(String(semesterMatch.slice(1).find(Boolean)).replace(/,/g, "")))} / semester`;
  if (/Research/i.test(programme.nameEn) || /研究型/.test(programme.name)) return "RM 4,650 / semester";
  const creditMatch = note.match(/RM\s*([\d,]+)\s*\/\s*credit/i);
  if (creditMatch) return `RM ${formatNumber(Number(creditMatch[1].replace(/,/g, "")))} / credit`;
  return "Official fee rate published in details";
}

function annualTuitionCny(tuitionMYR: number | null, durationYears: number) {
  if (!tuitionMYR) return 0;
  if (!durationYears) return Math.round(tuitionMYR * myrToCny);
  return Math.round((tuitionMYR * myrToCny) / Math.max(durationYears, 1));
}

function displayCurriculumZh(programme: UumAuditProgramme) {
  if (programme.curriculum?.length) return programme.curriculum;
  return ["官网未公布具体课程结构"];
}

function displayCurriculumEn(programme: UumAuditProgramme) {
  if (!programme.curriculum?.length) return ["Official source does not publish a specific curriculum list for this programme."];
  return [`See the official UUM source for curriculum topics of ${programme.nameEn}.`];
}

function displayCareerZh(programme: UumAuditProgramme) {
  if (programme.careerProspects?.length) return programme.careerProspects;
  return ["官网未公布具体职业方向"];
}

function displayCareerEn(programme: UumAuditProgramme) {
  if (!programme.careerProspects?.length) return ["Official source does not publish a specific career list for this programme."];
  return [`See the official UUM source for career prospects of ${programme.nameEn}.`];
}

function normalizeStudyMode(programme: UumAuditProgramme, auditLevel: UumAuditLevel) {
  if (programme.studyMode) return programme.studyMode;
  if (auditLevel === "undergraduate") return "full-time";
  if (/Research/i.test(programme.nameEn)) return "research";
  if (/DBA|Education|Ed\.?D/i.test(programme.nameEn)) return "mixed";
  return "postgraduate";
}

function inferCampus(programme: UumAuditProgramme) {
  const text = `${programme.officialSourceUrl} ${programme.faculty}`.toLowerCase();
  if (/kuala lumpur|kl/.test(text)) return "UUM Kuala Lumpur";
  return "UUM Sintok";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/computer|information technology|multimedia|data|analytics|decision mathematics|cybersecurity|intelligent system/.test(value)) return "it";
  if (/law|legal/.test(value)) return "law";
  if (/hospitality|tourism|event/.test(value)) return "hospitality";
  if (/mathematics|statistics|science|agribusiness|operations research/.test(value)) return "science";
  if (/communication|media|creative|linguistics|literature|counselling|social work|psychology|education|history|sociology/.test(value)) return "arts";
  if (/business|management|finance|financial|banking|account|marketing|entrepreneur|economics|risk|insurance|muamalat|islamic|tax|human resource|project|supply chain|logistics|transportation/.test(value)) return "business";
  return "business";
}

function degreeLevelFor(level: UumAuditLevel): UumDegreeLevel {
  if (level === "undergraduate") return "bachelor";
  if (level === "doctoral") return "phd";
  return "master";
}

function buildProgrammeCode(programme: UumAuditProgramme, level: UumDegreeLevel, ordinal: number) {
  const levelPrefix = level === "bachelor" ? "UG" : level === "master" ? "M" : "D";
  return `UUM-${levelPrefix}-${programme.code || String(ordinal).padStart(3, "0")}`;
}

function levelLabelZh(level: UumAuditLevel) {
  if (level === "undergraduate") return "本科";
  if (level === "master") return "硕士";
  return "博士";
}

function feeIsPublishable(programme: UumAuditProgramme, auditLevel: UumAuditLevel) {
  const durationYears = typeof programme.duration === "number" && programme.duration > 0 ? programme.duration : 0;
  return Boolean(buildUumTuitionPresentation(programme, auditLevel, durationYears).amountMYR);
}

function feeDisplayIsRateOnly(row: DeepPartial<ProgramEntity>) {
  const text = [row.tuitionDisplay, row.listTuitionText].filter(Boolean).join(" ");
  return /\/\s*(?:semester|credit|学期|學期|学分|學分)\b|published in details|official fee rate published/i.test(text);
}

function publicationIelts(programme: UumAuditProgramme, level: UumAuditLevel) {
  return programme.language?.ielts || (level === "undergraduate" ? muetBandToIeltsEquivalent(programme.language?.muet) || 0 : 0);
}

function openExceptions(audit: UumReviewedAudit) {
  return (audit.exception_queue || []).filter((item) => !String(item.status || "").startsWith("resolved"));
}

function officialUumUrl(url: string | null | undefined) {
  return typeof url === "string" && /^https?:\/\/[^/]*uum\.edu\.my\b/i.test(url);
}

function officialUumOrLinkedFeeUrl(url: string | null | undefined) {
  return officialUumUrl(url) || /^https?:\/\/drive\.google\.com\//i.test(String(url || ""));
}

function catalogueUrlFor(level: UumAuditLevel) {
  if (level === "undergraduate") return undergraduateCatalogueUrl;
  if (level === "master") return masterCatalogueUrl;
  return doctoralCatalogueUrl;
}

function feeSourceFor(level: UumAuditLevel) {
  if (level === "undergraduate") return undergraduateFeeSourceUrl;
  if (level === "doctoral") return oyagsbHandbook2026Url;
  return postgraduateFeesUrl;
}

function secondaryFeeSourceFor(programme: UumAuditProgramme, level: UumAuditLevel) {
  const url = level === "doctoral" ? postgraduateFeesUrl : "";
  return programme.officialFeeSourceUrl && url && programme.officialFeeSourceUrl !== url ? url : "";
}

function entryRequirementSourceFor(level: UumAuditLevel) {
  return level === "undergraduate" ? undergraduateEntryUrl : postgraduateGuidelinesUrl;
}

function applicationPortalFor(level: UumAuditLevel) {
  return level === "undergraduate" ? undergraduateApplicationPortalUrl : postgraduateApplicationPortalUrl;
}

function calendarSourceFor(level: UumAuditLevel) {
  return level === "undergraduate" ? undergraduateCalendarUrl : postgraduateCalendarUrl;
}

function sourceLinkTitle(url: string, programme?: UumAuditProgramme, auditLevel?: UumAuditLevel) {
  if (url === officialWebsite) return "UUM official website";
  if (url === undergraduateCatalogueUrl) return "UUM HEA undergraduate international programme catalogue";
  if (url === undergraduateEntryUrl) return "UUM HEA undergraduate entry requirements";
  if (url === undergraduateLanguageUrl) return "UUM HEA English language requirements";
  if (url === undergraduateApplicationPortalUrl) return "UUM undergraduate international application portal";
  if (url === undergraduateCalendarUrl) return "UUM undergraduate academic calendar";
  if (url === undergraduateFeeSourceUrl) return "UUM official international undergraduate fee table";
  if (url === postgraduateGuidelinesUrl) return "UUM postgraduate application guidelines";
  if (url === masterCatalogueUrl) return "UUM master programme catalogue";
  if (url === doctoralCatalogueUrl) return "UUM doctoral programme catalogue";
  if (url === postgraduateFeesUrl) return "UUM postgraduate fees";
  if (url === postgraduateApplicationPortalUrl) return "UUM postgraduate application portal";
  if (url === postgraduateCalendarUrl) return "UUM postgraduate academic calendar";
  if (url === oyagsbHandbook2026Url) return "OYAGSB 2026 postgraduate academic handbook";
  if (programme && url === programme.officialSourceUrl) return `Official ${auditLevel || ""} programme page`.trim();
  if (programme && url === programme.officialFeeSourceUrl) return "Official fee source";
  if (/drive\.google\.com/.test(url)) return "Official linked fee document";
  if (/hea\.uum\.edu\.my/.test(url)) return "UUM HEA source";
  if (/oyagsb\.uum\.edu\.my/.test(url)) return "OYAGSB official source";
  if (/uum\.edu\.my/.test(url)) return "Official UUM source";
  return "Official source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/fee|yuran|drive\.google|handbook/.test(value)) return "fee";
  if (/admission|application|apply|entry|requirement|english/.test(value)) return "admission";
  if (/undergraduate|postgraduate|programme|program|hea|school|faculty|oyagsb/.test(value)) return "study-portal";
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

function sanitizeTuitionNote(value: string | null | undefined) {
  return String(value || "")
    .replace(/effective\s+from/gi, "effective beginning")
    .replace(/from the second semester/gi, "beginning the second semester");
}

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function localizedArrayHasChinese(value?: LocalizedStringArray) {
  return Boolean(value?.["zh-CN"]?.length && value["zh-CN"].every(hasChinese));
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1, minimumFractionDigits: Number.isInteger(value) ? 0 : 0 });
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
    masterPath: resolve(readArgValue("--master-audit") || DEFAULT_UUM_MASTER_AUDIT_PATH),
    doctoralPath: resolve(readArgValue("--doctoral-audit") || DEFAULT_UUM_DOCTORAL_AUDIT_PATH),
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
