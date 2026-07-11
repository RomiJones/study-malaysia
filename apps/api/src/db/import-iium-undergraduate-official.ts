import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, Not, type DeepPartial, type EntityManager } from "typeorm";
import { muetBandToIeltsEquivalent } from "@studymy/shared";
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
const iiumImportDir = resolve(repositoryRoot, "data/imports/iium/2026-06-29/undergraduate-official");

export const IIUM_UNDERGRADUATE_SLUG_PREFIX = "iium-undergraduate-20260629-";
export const DEFAULT_IIUM_UNDERGRADUATE_AUDIT_PATH = resolve(repositoryRoot, "audits/IIUM_audit_undergraduate_20260629_verified_20260629_r16.json");
export const DEFAULT_IIUM_PUBLISH_PLAN_PATH = resolve(iiumImportDir, "01_publish_plan.json");
export const DEFAULT_IIUM_POST_IMPORT_AUDIT_PATH = resolve(iiumImportDir, "02_post_import_audit.json");
export const DEFAULT_IIUM_RELEASE_REPORT_PATH = resolve(iiumImportDir, "03_release_report.md");

const verifiedAt = "2026-06-29";
const myrToCny = 1.55;
const expectedProgrammes = 58;
const expectedByLevel = { bachelor: 58, master: 0, phd: 0 } as const;
const expectedOfficialDirectIeltsRows = 5;
const expectedMuetEquivalentIeltsRows = 9;
const expectedListIeltsRows = expectedOfficialDirectIeltsRows + expectedMuetEquivalentIeltsRows;
const expectedNoListIeltsRows = expectedProgrammes - expectedListIeltsRows;
const expectedOfficialUnpublishedDirectIeltsRows = 53;
const expectedOfficialUnpublishedCareerRows = 26;
const publicCatalogProgramStatuses = ["ready", "current-cycle-not-open", "not-available-for-international"] as const;

const officialWebsite = "https://www.iium.edu.my/v2/";
const academicsUrl = "https://www.iium.edu.my/v2/academics/";
const admissionUrl = "https://division.iium.edu.my/amad/admission-2/";
const academicCalendarUrl = "https://division.iium.edu.my/amad/academic-calendar/";
const amadFaqUrl = "https://division.iium.edu.my/amad/faq/";
const eAdmissionUrl = "https://eadmission.iium.edu.my/";
const financeFeeUrl = "https://division.iium.edu.my/finance/3d-flip-book/bachelor-degree-programmes-international/";
const financeFeePdfUrl = "https://division.iium.edu.my/finance/wp-content/uploads/sites/6/2026/05/2.4.2-UG-International-After-Discount-Sem-1-2024-2025-1.7-Mar26.pdf";

type IiumAuditLevel = "undergraduate";
type IiumDegreeLevel = "bachelor" | "master" | "phd";
type IssueStatus = "resolved" | "accepted_gap" | string;

interface IiumEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface IiumAuditProgramme {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: IiumAuditLevel;
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
  entryRequirement: IiumEntryRequirement;
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
  _acceptedGaps?: string[];
}

interface IiumReviewedAudit {
  schema_version?: string;
  workflow_status?: string;
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  auditMeta?: {
    targetUniversity?: string;
    targetUniversityShortName?: string;
    targetLevel?: IiumAuditLevel;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
    exceptionCount?: number;
  };
  sourceRegistry?: unknown;
  programmeBaseline?: unknown;
  programme_baseline?: unknown;
  programmes: IiumAuditProgramme[];
  pending_issues?: Array<{ status?: IssueStatus; issue_id?: string; field?: string }>;
  exception_queue?: Array<{ status?: IssueStatus; issue_id?: string; field?: string }>;
  validation_result?: {
    recommended_for_import?: boolean;
    blocking_issues?: unknown[];
    accepted_gaps?: unknown[];
    requires_ian_decision?: unknown[];
    import_boundary?: string;
  };
  import_authorization?: {
    authorization_status?: string;
    safe_to_import?: boolean;
  };
  validationMeta?: {
    overallDecision?: string;
    languageGateStats?: {
      directIeltsRows?: number;
      noDirectIeltsRows?: number;
    };
    deepRepairStats?: Record<string, unknown>;
    acceptedGapSummary?: Record<string, unknown>;
    counts?: {
      totalProgrammesValidated?: number;
      pass?: number;
      warn?: number;
      repair?: number;
      reject?: number;
      issuesPending?: number;
    };
  };
}

interface IiumImportSummary {
  importRows: number;
  byLevel: Record<IiumDegreeLevel, number>;
  readyRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialFeeRows: number;
  officialDirectIeltsRows: number;
  muetEquivalentIeltsRows: number;
  listIeltsRows: number;
  noListIeltsRows: number;
  officialUnpublishedDirectIeltsRows: number;
  languageCoverageRows: number;
  chineseNameRows: number;
  chineseFacultyRows: number;
  chineseCurriculumRows: number;
  careerDisplayRows: number;
  officialUnpublishedCareerRows: number;
  sourceRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface IiumVerification extends IiumImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  activeSupersededBachelorRows: number;
  legacyVisibleBachelorRows: number;
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
  "Submit the online application through IIUM eAdmission or the official IIUM admission channel.",
  "Submit international academic qualification documents or equivalent evidence.",
  "Submit passport or identity-document evidence required by IIUM.",
  "Submit supplementary documents and payment evidence as requested by AMAD or the application portal."
];

const chineseApplicationDocs = [
  "通过 IIUM 官方 eAdmission / Admissions 入口提交线上申请",
  "提交国际学历资格证明或等效证明",
  "提交护照或身份证明文件",
  "按 AMAD 要求提交补充材料与缴费证明"
];

export function validateIiumReviewedAudit(audit: IiumReviewedAudit, expectedCount = expectedProgrammes): string[] {
  const errors: string[] = [];
  if (audit.workflow_status !== "verified_candidate") errors.push("workflow_status must be verified_candidate.");
  if (audit.safe_to_import !== false) errors.push("safe_to_import must remain false.");
  if (audit.import_approved_by != null || audit.import_approved_at != null) errors.push("import approval fields must remain null.");
  if (audit.import_authorization?.safe_to_import !== false) errors.push("import_authorization.safe_to_import must remain false.");
  if (audit.validation_result?.recommended_for_import !== true) errors.push("validation_result.recommended_for_import must be true.");
  if ((audit.validation_result?.blocking_issues || []).length !== 0) errors.push("validation_result.blocking_issues must be empty.");
  if ((audit.validation_result?.requires_ian_decision || []).length !== 0) errors.push("validation_result.requires_ian_decision must be empty.");
  if (audit.auditMeta?.targetUniversityShortName !== "IIUM") errors.push("targetUniversityShortName must be IIUM.");
  if (audit.auditMeta?.targetLevel !== "undergraduate") errors.push("targetLevel must be undergraduate.");
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedCount) errors.push(`baseline must be ${expectedCount}.`);
  if (audit.auditMeta?.totalProgrammesCollected !== expectedCount) errors.push(`collected count must be ${expectedCount}.`);
  if (audit.auditMeta?.readyCount !== expectedCount) errors.push(`readyCount must be ${expectedCount}.`);
  if (audit.auditMeta?.needsReviewCount !== 0) errors.push("needsReviewCount must be 0.");
  if (audit.auditMeta?.exceptionCount !== 0) errors.push("auditMeta.exceptionCount must be 0 after validator repair.");
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
    errors.push(`expected ${expectedCount} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if (!["PASS", "PASS-WITH-EXCEPTIONS"].includes(String(audit.validationMeta?.overallDecision || ""))) {
    errors.push("validationMeta.overallDecision must be PASS or PASS-WITH-EXCEPTIONS.");
  }
  if (audit.validationMeta?.counts?.totalProgrammesValidated !== expectedCount) {
    errors.push(`validationMeta.counts.totalProgrammesValidated must be ${expectedCount}.`);
  }
  if (audit.validationMeta?.counts?.pass !== expectedCount) errors.push(`validationMeta.counts.pass must be ${expectedCount}.`);
  if (audit.validationMeta?.counts?.issuesPending !== 0) errors.push("validationMeta.counts.issuesPending must be 0.");
  if (audit.validationMeta?.languageGateStats?.directIeltsRows !== expectedOfficialDirectIeltsRows) {
    errors.push(`direct IELTS row count must be ${expectedOfficialDirectIeltsRows}.`);
  }
  if (audit.validationMeta?.languageGateStats?.noDirectIeltsRows !== expectedOfficialUnpublishedDirectIeltsRows) {
    errors.push(`official-unpublished IELTS row count must be ${expectedOfficialUnpublishedDirectIeltsRows}.`);
  }

  const openIssues = [
    ...(audit.pending_issues || []),
    ...(audit.exception_queue || [])
  ].filter((issue) => !["resolved", "accepted_gap"].includes(String(issue.status || "")));
  if (openIssues.length) errors.push(`pending_issues/exception_queue contain open statuses: ${JSON.stringify(openIssues)}`);

  const seenNames = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `undergraduate ${index + 1} ${programme.nameEn || "unknown"}`;
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (seenNames.has(programme.nameEn)) errors.push(`${row}: duplicate programme name.`);
    seenNames.add(programme.nameEn);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn || !programme.name.includes(programme.nameEn)) {
      errors.push(`${row}: Chinese bilingual programme name is required.`);
    }
    if (programme.level !== "undergraduate") errors.push(`${row}: level must be undergraduate.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) errors.push(`${row}: Chinese faculty is required.`);
    if (!officialIiumUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be IIUM official URL.`);
    if (!programme.officialFeeSourceUrl || !officialIiumUrl(programme.officialFeeSourceUrl)) {
      errors.push(`${row}: officialFeeSourceUrl must be IIUM official URL.`);
    }
    if (programme.publicDisplayStatus !== "ready") errors.push(`${row}: publicDisplayStatus must be ready.`);
    if (programme.auditStatus !== "official-verified-commercial-ready") errors.push(`${row}: auditStatus must be official-verified-commercial-ready.`);
    if (programme._validationResult !== "PASS") errors.push(`${row}: _validationResult must be PASS.`);
    if ((programme._validationIssues || []).length !== 0) errors.push(`${row}: _validationIssues must be empty.`);
    if ((programme._pendingIssues || []).length !== 0) errors.push(`${row}: _pendingIssues must be empty.`);
    if (typeof programme.duration !== "number" || programme.duration <= 0) errors.push(`${row}: duration must be positive number.`);
    if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: tuitionMYR must be positive number.`);
    if (!Array.isArray(programme.intake) || programme.intake.length === 0 || programme.intake.some((month) => month < 1 || month > 12)) {
      errors.push(`${row}: intake must be valid month numbers.`);
    }
    if (!programme.applicationDeadline || !hasChinese(programme.applicationDeadline)) {
      errors.push(`${row}: applicationDeadline must store current official intake/opening note.`);
    }
    if (!Array.isArray(programme.curriculum) || programme.curriculum.length === 0 || !programme.curriculum.every(hasChinese)) {
      errors.push(`${row}: Chinese curriculum array is required.`);
    }
    if (!Array.isArray(programme.applicationDocs) || programme.applicationDocs.length === 0 || !programme.applicationDocs.every(hasChinese)) {
      errors.push(`${row}: Chinese applicationDocs array is required.`);
    }
    const hasDirectIelts = typeof programme.language?.ielts === "number" && programme.language.ielts > 0;
    const languageOfficiallyUnpublished = programme.fieldStatus?.["language.ielts"]?.status === "official-unpublished";
    if (!hasDirectIelts && !languageOfficiallyUnpublished) {
      errors.push(`${row}: IELTS must be direct official value or official-unpublished.`);
    }
    const careerOfficiallyUnpublished = ["official-unpublished", "accepted-gap-official-unpublished"].includes(String(programme.fieldStatus?.careerProspects?.status || ""));
    if (programme.careerProspects.length === 0 && !careerOfficiallyUnpublished) {
      errors.push(`${row}: empty careerProspects is only allowed for official-unpublished accepted gap.`);
    }
    if (programme.careerProspects.length > 0 && !programme.careerProspects.every(hasChinese)) {
      errors.push(`${row}: Chinese career array is required.`);
    }
  }
  return errors;
}

export function loadIiumReviewedAudit(path = DEFAULT_IIUM_UNDERGRADUATE_AUDIT_PATH): IiumReviewedAudit {
  if (!existsSync(path)) throw new Error(`IIUM audit file not found: ${path}`);
  return loadJson<IiumReviewedAudit>(path);
}

export function buildIiumUndergraduateRows(audit: IiumReviewedAudit): Array<DeepPartial<ProgramEntity>> {
  return audit.programmes.map((programme, index) => buildIiumProgrammeRow(programme, index + 1));
}

export function summarizeIiumUndergraduateImport(rows: Array<DeepPartial<ProgramEntity>>): IiumImportSummary {
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
    officialDirectIeltsRows: rows.filter((row) =>
      String(row.officialLanguageRequirement || "").includes("Official direct IELTS")
    ).length,
    muetEquivalentIeltsRows: rows.filter((row) => String(row.officialLanguageRequirement || "").includes("MUET-equivalent")).length,
    listIeltsRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0).length,
    noListIeltsRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) === 0).length,
    officialUnpublishedDirectIeltsRows: rows.filter((row) =>
      !String(row.officialLanguageRequirement || "").includes("Official direct IELTS")
    ).length,
    languageCoverageRows: rows.filter((row) => Boolean(normalizeText(row.officialLanguageRequirement, 4000))).length,
    chineseNameRows: rows.filter((row) => hasChinese((row.name as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseFacultyRows: rows.filter((row) => hasChinese((row.faculty as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseCurriculumRows: rows.filter((row) => localizedArrayHasChinese(row.curriculum as LocalizedStringArray | undefined)).length,
    careerDisplayRows: rows.filter((row) => localizedArrayHasChinese(row.careers as LocalizedStringArray | undefined)).length,
    officialUnpublishedCareerRows: rows.filter((row) =>
      (row.careers as LocalizedStringArray | undefined)?.["zh-CN"]?.some((item) => item.includes("官网未公布"))
    ).length,
    sourceRows: rows.filter((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 4).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildIiumUniversityRow(
  audit: IiumReviewedAudit,
  rows: Array<DeepPartial<ProgramEntity>>,
  existing: UniversityEntity | null = null
): DeepPartial<UniversityEntity> {
  const annualCosts = rows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const directIeltsValues = rows.map((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0)).filter((value) => value > 0);
  const qsWorld2027 = {
    name: "QS World University Rankings",
    year: 2027,
    status: "ranked",
    context: "malaysia-institution",
    rankDisplay: "=691",
    rankSort: 691,
    officialSortRank: 693,
    overallScore: "25.8",
    sourceUrl: "https://www.topuniversities.com/rankings/endpoint?nid=4153156&page=0&items_per_page=100&tab=indicators&region=&countries=my&cities=&search=&star=&sort_by=rank&order_by=asc&program_type=&scholarship=&fee=&english_score=&academic_score=&mix_student=&loggedincache=&study_level=&subjects=",
    profileUrl: "https://www.topuniversities.com/universities/international-islamic-university-malaysia-iium",
    qsTitle: "International Islamic University Malaysia (IIUM)",
    qsCountry: "Malaysia",
    qsCity: "Kuala Lumpur",
    publishedAt: "2026-06-19",
    retrievedAt: "2026-06-19"
  };

  return {
    slug: existing?.slug || "international-islamic-university-malaysia",
    code: existing?.code || "IIUM",
    name: existing?.name || t("International Islamic University Malaysia", "International Islamic University Malaysia", "国际伊斯兰大学", "國際伊斯蘭大學"),
    shortName: existing?.shortName || "IIUM",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#006B3F",
    qsRank: existing?.qsRank || 691,
    qsAsiaRank: existing?.qsAsiaRank ?? null,
    location: existing?.location || t("Gombak, Selangor, Malaysia", "Gombak, Selangor, Malaysia", "马来西亚雪兰莪鹅唛", "馬來西亞雪蘭莪鵝嘜"),
    region: existing?.region || t("Selangor", "Selangor", "雪兰莪", "雪蘭莪"),
    ownership: existing?.ownership || "public",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 1983,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: existing?.description || t(
      "International Islamic University Malaysia (IIUM) is a Malaysian public university with undergraduate programmes across education, law, human sciences, engineering, economics, ICT, allied health sciences, medicine, dentistry, nursing, pharmacy, science, languages and tourism.",
      "International Islamic University Malaysia (IIUM) is a Malaysian public university with undergraduate programmes across education, law, human sciences, engineering, economics, ICT, allied health sciences, medicine, dentistry, nursing, pharmacy, science, languages and tourism.",
      "国际伊斯兰大学（IIUM）是马来西亚公立大学，本科专业覆盖教育、法律、人文、工程、经济管理、信息技术、健康科学、医学、牙科、护理、药学、科学、语言与旅游等方向。",
      "國際伊斯蘭大學（IIUM）是馬來西亞公立大學，本科課程涵蓋教育、法律、人文、工程、經濟管理、資訊科技、健康科學、醫學、牙科、護理、藥學、科學、語言與旅遊等方向。"
    ),
    website: officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: "International Islamic University Malaysia",
    officialWebsite,
    studyPortalUrl: academicsUrl,
    internationalPageUrl: admissionUrl,
    applicationPortalUrl: eAdmissionUrl,
    officialAddress: existing?.officialAddress || "International Islamic University Malaysia, Jalan Gombak, 53100 Kuala Lumpur, Malaysia",
    applicationPeriods: [
      "March intake",
      "October intake",
      "Semester 1, 2026/2027 undergraduate international-qualification application access is open on IIUM eAdmission; no concrete closing date is published in the collected official sources."
    ],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: arr(englishApplicationDocs, englishApplicationDocs, chineseApplicationDocs, chineseApplicationDocs),
    chinaStudentRequirements: arr(
      ["IIUM did not publish a China-specific undergraduate equivalency route in the collected official sources; international applications follow AMAD/eAdmission and programme-level requirements."],
      ["IIUM did not publish a China-specific undergraduate equivalency route in the collected official sources; international applications follow AMAD/eAdmission and programme-level requirements."],
      ["IIUM 本次采集的官方来源未单独公布中国学生本科等效路径；国际申请按 AMAD / eAdmission 及各专业要求评估。"],
      ["IIUM 本次採集的官方來源未單獨公布中國學生本科等效路徑；國際申請按 AMAD / eAdmission 及各課程要求評估。"]
    ),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      rankings: {
        ...asRecord(asRecord(existing?.officialProfile).rankings),
        qsWorld: qsWorld2027
      },
      iiumUndergraduatePublication: {
        sourceAudit: relative(repositoryRoot, DEFAULT_IIUM_UNDERGRADUATE_AUDIT_PATH),
        publishedAt: new Date().toISOString(),
        verifiedAt,
        programmes: rows.length,
        byLevel: expectedByLevel,
        workflowStatus: audit.workflow_status,
        validationDecision: audit.validationMeta?.overallDecision,
        acceptedGapSummary: audit.validationMeta?.acceptedGapSummary || null,
        validationResult: audit.validation_result || null
      }
    },
    officialSources: buildIiumUniversitySourceLinks(audit),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: "IIUM undergraduate programmes are published from the 2026-06-29 verified official-source audit. The batch contains 58 ready rows with official Finance international undergraduate fee evidence, official programme/Kulliyyah sources, March/October intake evidence and accepted launch gaps for central baseline, curriculum summary depth, official-unpublished careers, direct IELTS gaps and no published concrete application closing date.",
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualCosts.length ? Math.min(...annualCosts) : existing?.tuitionMinCny || 0,
    tuitionMaxCny: annualCosts.length ? Math.max(...annualCosts) : existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 30000,
    minIelts: directIeltsValues.length ? Math.min(...directIeltsValues) : existing?.minIelts || 0,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr(
      ["Gombak campus", "Kuantan campus", "Pagoh campus", "Academic and student-service divisions"],
      ["Gombak campus", "Kuantan campus", "Pagoh campus", "Academic and student-service divisions"],
      ["鹅唛校区", "关丹校区", "巴莪校区", "学术与学生服务部门"],
      ["鵝嘜校區", "關丹校區", "巴莪校區", "學術與學生服務部門"]
    ),
    highlights: arr(
      ["QS WUR 2027 =691", "58 verified undergraduate rows", "Official IIUM Finance international undergraduate fee table", "Public Malaysian university"],
      ["QS WUR 2027 =691", "58 verified undergraduate rows", "Official IIUM Finance international undergraduate fee table", "Public Malaysian university"],
      ["QS 世界大学排名 2027 =691", "58 个已验收本科专业", "采用 IIUM Finance 官方国际本科费用表", "马来西亚公立大学"],
      ["QS 世界大學排名 2027 =691", "58 個已驗收本科課程", "採用 IIUM Finance 官方國際本科費用表", "馬來西亞公立大學"]
    ),
    programCount: rows.length,
    isPublished: true
  };
}

function buildIiumProgrammeRow(programme: IiumAuditProgramme, ordinal: number): DeepPartial<ProgramEntity> {
  const tuitionMYR = programme.tuitionMYR || 0;
  const durationYears = programme.duration || 1;
  const code = `IIUM-BACH-${String(ordinal).padStart(3, "0")}`;
  const sourceUrls = buildIiumProgrammeSourceLinks(programme);
  const careerZh = displayCareerZh(programme);
  const careerEn = displayCareerEn(programme);

  return {
    slug: `${IIUM_UNDERGRADUATE_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
    code,
    name: t(programme.nameEn, programme.nameEn, programme.name, programme.name),
    nameEnOfficial: programme.nameEn,
    level: "bachelor",
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
    officialTuitionNote: normalizeLongText(programme.tuitionNote || "IIUM Finance official Bachelor Degree Programmes (International) fee table."),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || financeFeeUrl,
    secondaryOfficialFeeSourceUrl: financeFeePdfUrl,
    officialFeeAuditStatus: "matched-official" satisfies FeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: intakeMonthNames(programme.intake),
    officialIntake: intakeMonthNames(programme.intake).join(", "),
    officialIntakeNote: normalizeLongText(programme.applicationDeadline || "IIUM publishes March and October undergraduate intakes; no concrete programme-level closing date is published in the collected official sources."),
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
    chinaStudentRequirement: "IIUM 未单独公布中国学生本科等效路径；按 AMAD / eAdmission、国际学历资格与该专业入学要求评估。",
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: arr(englishApplicationDocs, englishApplicationDocs, programme.applicationDocs || chineseApplicationDocs, programme.applicationDocs || chineseApplicationDocs),
    curriculum: localizedChineseList(programme.curriculum, [`See the official IIUM programme source for curriculum signals of ${programme.nameEn}.`]),
    careers: localizedChineseList(careerZh, careerEn),
    specializations: arr([]),
    description: t(
      `${programme.nameEn} is published from IIUM official programme, admission, Finance fee and validator evidence in the 2026-06-29 undergraduate audit.`,
      `${programme.nameEn} is published from IIUM official programme, admission, Finance fee and validator evidence in the 2026-06-29 undergraduate audit.`,
      `${programme.name} 已按 IIUM 官方专业、招生、Finance 费用与 2026-06-29 验收证据公开展示。`,
      `${programme.name} 已按 IIUM 官方課程、招生、Finance 費用與 2026-06-29 驗收證據公開展示。`
    ),
    officialAccreditationNote: null,
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: programme.officialSourceUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    publicDisplayNote: buildPublicDisplayNote(programme),
    reviewReason: null,
    auditNote: normalizeLongText([
      `Published from IIUM undergraduate verified audit row ${ordinal}.`,
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || financeFeeUrl}.`,
      programme.curriculumNote || "",
      programme.studyModeNote || "",
      programme.fieldStatus?.careerProspects?.note || "",
      programme.fieldStatus?.["language.ielts"]?.note || "",
      programme.fieldStatus?.creditHours?.note || ""
    ].filter(Boolean).join(" ")),
    listTuitionText: `RM ${formatNumber(tuitionMYR)}`,
    isPublished: true
  };
}

function verifyIiumUndergraduatePublicRecordSet(
  university: UniversityEntity,
  importRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): IiumVerification {
  const summary = summarizeIiumUndergraduateImport(importRows);
  const activeSupersededBachelorRows = allUniversityRows.filter((row) =>
    row.level === "bachelor" &&
    !row.slug.startsWith(IIUM_UNDERGRADUATE_SLUG_PREFIX) &&
    row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleBachelorRows = allUniversityRows.filter((row) =>
    row.level === "bachelor" &&
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(IIUM_UNDERGRADUATE_SLUG_PREFIX)
  );
  const visibleCurrentRows = importRows.filter((row) =>
    row.isPublished &&
    row.publicDisplayStatus === "ready" &&
    row.slug.startsWith(IIUM_UNDERGRADUATE_SLUG_PREFIX)
  ).length;

  if (
    importRows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedProgrammes ||
    summary.readyRows !== expectedProgrammes ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== expectedProgrammes ||
    summary.officialDirectIeltsRows !== expectedOfficialDirectIeltsRows ||
    summary.muetEquivalentIeltsRows !== expectedMuetEquivalentIeltsRows ||
    summary.listIeltsRows !== expectedListIeltsRows ||
    summary.noListIeltsRows !== expectedNoListIeltsRows ||
    summary.officialUnpublishedDirectIeltsRows !== expectedOfficialUnpublishedDirectIeltsRows ||
    summary.languageCoverageRows !== expectedProgrammes ||
    summary.chineseNameRows !== expectedProgrammes ||
    summary.chineseFacultyRows !== expectedProgrammes ||
    summary.chineseCurriculumRows !== expectedProgrammes ||
    summary.careerDisplayRows !== expectedProgrammes ||
    summary.officialUnpublishedCareerRows !== expectedOfficialUnpublishedCareerRows ||
    summary.sourceRows !== expectedProgrammes ||
    visibleCurrentRows !== expectedProgrammes ||
    activeSupersededBachelorRows.length !== 0 ||
    legacyVisibleBachelorRows.length !== 0 ||
    university.publicDisplayStatus !== "ready" ||
    !university.isPublished ||
    university.programCount < expectedProgrammes
  ) {
    throw new Error(`IIUM undergraduate public verification failed: ${JSON.stringify({
      summary,
      activeSupersededBachelorRows: activeSupersededBachelorRows.map((row) => row.slug),
      legacyVisibleBachelorRows: legacyVisibleBachelorRows.map((row) => row.slug),
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
    activeSupersededBachelorRows: activeSupersededBachelorRows.length,
    legacyVisibleBachelorRows: legacyVisibleBachelorRows.length,
    visibleCurrentRows
  };
}

async function verifyImportedIiumRows(manager: EntityManager | DataSource, universityId: number) {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("IIUM university row not found during verification.");
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  const importRows = allUniversityRows.filter((row) => row.slug.startsWith(IIUM_UNDERGRADUATE_SLUG_PREFIX));
  return verifyIiumUndergraduatePublicRecordSet(university, importRows, allUniversityRows);
}

async function updateUniversityAfterUndergraduateImport(
  manager: EntityManager,
  university: UniversityEntity,
  audit: IiumReviewedAudit,
  importSummary: IiumImportSummary
) {
  const programRepo = manager.getRepository(ProgramEntity);
  const universityRepo = manager.getRepository(UniversityEntity);
  const visibleRows = await programRepo.find({
    where: {
      universityId: university.id,
      isPublished: true,
      publicDisplayStatus: In([...publicCatalogProgramStatuses])
    }
  });
  const annualCosts = visibleRows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const directIeltsValues = visibleRows.map((row) => Number(row.languageRequirement?.ielts || 0)).filter((value) => value > 0);
  const byLevel = {
    bachelor: visibleRows.filter((row) => row.level === "bachelor").length,
    master: visibleRows.filter((row) => row.level === "master").length,
    phd: visibleRows.filter((row) => row.level === "phd").length
  };
  university.programCount = visibleRows.length;
  if (annualCosts.length) {
    university.tuitionMinCny = Math.min(...annualCosts);
    university.tuitionMaxCny = Math.max(...annualCosts);
  }
  if (directIeltsValues.length) university.minIelts = Math.min(...directIeltsValues);
  university.officialProfile = {
    ...asRecord(university.officialProfile),
    iiumUndergraduatePublication: {
      ...asRecord(asRecord(university.officialProfile).iiumUndergraduatePublication),
      sourceAudit: relative(repositoryRoot, DEFAULT_IIUM_UNDERGRADUATE_AUDIT_PATH),
      importedAt: new Date().toISOString(),
      verifiedAt,
      programmes: importSummary.importRows,
      byLevel,
      workflowStatus: audit.workflow_status,
      validationDecision: audit.validationMeta?.overallDecision,
      officialDirectIeltsRows: importSummary.officialDirectIeltsRows,
      muetEquivalentIeltsRows: importSummary.muetEquivalentIeltsRows,
      listIeltsRows: importSummary.listIeltsRows,
      noListIeltsRows: importSummary.noListIeltsRows,
      officialUnpublishedDirectIeltsRows: importSummary.officialUnpublishedDirectIeltsRows,
      officialUnpublishedCareerRows: importSummary.officialUnpublishedCareerRows,
      acceptedGapSummary: audit.validationMeta?.acceptedGapSummary || null
    }
  };
  university.officialAuditSummary = `IIUM official undergraduate import: ${importSummary.importRows} bachelor rows are public-visible from official IIUM sources. The batch keeps safe_to_import=false at audit-file level and is published only by explicit operator import command; accepted gaps are recorded for official-unpublished language/career fields, curriculum summary depth and no concrete published application closing date.`;
  university.officialVerifiedAt = verifiedAt;
  university.officialSourceStatus = "official-verified";
  university.publicDisplayStatus = "ready";
  university.isPublished = true;
  await universityRepo.save(university);
}

async function runIiumUndergraduatePublication(options: {
  auditPath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audit = loadIiumReviewedAudit(options.auditPath);
  const validationErrors = validateIiumReviewedAudit(audit, expectedProgrammes);
  if (validationErrors.length) throw new Error(`IIUM undergraduate audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildIiumUndergraduateRows(audit);
  const summary = summarizeIiumUndergraduateImport(rows);
  assertImportSummary(summary);
  const plan = buildPublishPlan(options, summary, audit);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "iium-undergraduate-dry-run",
      planPath: options.planOutput,
      summary,
      nextStep: "Run npm --workspace @studymy/api run import:iium:undergraduate -- --confirm-import"
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "IIUM" } })) ||
      (await universityRepo.findOne({ where: { slug: "international-islamic-university-malaysia" } }));

    if (options.verifyOnly) {
      if (!university) throw new Error("IIUM university row not found.");
      const verification = await verifyImportedIiumRows(dataSource, university.id);
      console.log(JSON.stringify({ mode: "iium-undergraduate-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: "international-islamic-university-malaysia" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug international-islamic-university-malaysia belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/iium-undergraduate-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: IiumVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "IIUM" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: "international-islamic-university-malaysia" } }));

      const universitySeed = buildIiumUniversityRow(audit, rows, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${IIUM_UNDERGRADUATE_SLUG_PREFIX}%`) }
      });
      for (const previous of previousCurrentRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      await txProgramRepo.update(
        {
          universityId: university.id,
          level: "bachelor",
          isPublished: true,
          publicDisplayStatus: In([...publicCatalogProgramStatuses]),
          slug: Not(Like(`${IIUM_UNDERGRADUATE_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: "Archived by IIUM undergraduate official import to prevent legacy public-list leakage.",
          reviewReason: "Archived by IIUM undergraduate official publication; current public display uses iium-undergraduate-20260629 rows."
        }
      );

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      await updateUniversityAfterUndergraduateImport(manager, university, audit, summary);
      verification = await verifyImportedIiumRows(manager, university.id);
    });

    if (!verification) throw new Error("IIUM undergraduate publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    writeJson(options.postImportAuditOutput, buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared, audit));
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "iium-undergraduate-published",
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

function assertImportSummary(summary: IiumImportSummary) {
  const failed =
    summary.importRows !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedProgrammes ||
    summary.byLevel.master !== 0 ||
    summary.byLevel.phd !== 0 ||
    summary.readyRows !== expectedProgrammes ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== expectedProgrammes ||
    summary.officialDirectIeltsRows !== expectedOfficialDirectIeltsRows ||
    summary.muetEquivalentIeltsRows !== expectedMuetEquivalentIeltsRows ||
    summary.listIeltsRows !== expectedListIeltsRows ||
    summary.noListIeltsRows !== expectedNoListIeltsRows ||
    summary.officialUnpublishedDirectIeltsRows !== expectedOfficialUnpublishedDirectIeltsRows ||
    summary.languageCoverageRows !== expectedProgrammes ||
    summary.chineseNameRows !== expectedProgrammes ||
    summary.chineseFacultyRows !== expectedProgrammes ||
    summary.chineseCurriculumRows !== expectedProgrammes ||
    summary.careerDisplayRows !== expectedProgrammes ||
    summary.officialUnpublishedCareerRows !== expectedOfficialUnpublishedCareerRows ||
    summary.sourceRows !== expectedProgrammes;
  if (failed) throw new Error(`IIUM import row summary hard gate failed: ${JSON.stringify(summary)}`);
}

function buildPublishPlan(
  options: { auditPath: string },
  summary: IiumImportSummary,
  audit: IiumReviewedAudit
) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "IIUM",
      shortName: "IIUM",
      name: "International Islamic University Malaysia",
      slug: "international-islamic-university-malaysia"
    },
    authorization: "operator-requested-publication",
    sourceInputs: {
      undergraduateAudit: relative(repositoryRoot, options.auditPath),
      sourceAuditSafeToImport: audit.safe_to_import,
      sourceAuditReason: "StudyMY audit JSON stays safe_to_import=false by validator contract; this importer publishes only after explicit operator command."
    },
    writePolicy: {
      importer: "apps/api/src/db/import-iium-undergraduate-official.ts",
      mode: "publish-undergraduate",
      upsertPrefix: IIUM_UNDERGRADUATE_SLUG_PREFIX,
      universityRow: "upsert by code IIUM or slug international-islamic-university-malaysia",
      programmeRows: "upsert 58 current IIUM undergraduate public rows and archive legacy visible IIUM bachelor rows only",
      preserveOtherLevels: true,
      transactional: true,
      backupRequired: true
    },
    publicationGate: {
      result: "passed",
      rules: [
        "58 ready PASS programme rows",
        "Chinese programme names",
        "Chinese faculty names",
        "official international tuition rows",
        "numeric duration years",
        "official source URLs",
        "official-unpublished language/career fields displayed as official-unpublished, not inferred"
      ]
    },
    acceptedGaps: {
      pendingIssues: audit.pending_issues || [],
      exceptionQueue: audit.exception_queue || [],
      validationAcceptedGaps: audit.validation_result?.accepted_gaps || [],
      acceptedGapSummary: audit.validationMeta?.acceptedGapSummary || null
    },
    expectedSurface: {
      programmeCount: expectedProgrammes,
      byLevel: expectedByLevel,
      summary
    }
  };
}

function buildPostImportAudit(
  summary: IiumImportSummary,
  verification: IiumVerification,
  backupPath: string,
  catalogCacheCleared: boolean,
  audit: IiumReviewedAudit
) {
  return {
    schemaVersion: 1,
    mode: "iium-undergraduate-published",
    createdAt: new Date().toISOString(),
    institution: {
      code: "IIUM",
      name: "International Islamic University Malaysia",
      importedRows: summary.importRows,
      byLevel: summary.byLevel
    },
    sourceAudit: {
      workflowStatus: audit.workflow_status,
      safeToImport: audit.safe_to_import,
      recommendedForImport: audit.validation_result?.recommended_for_import,
      validationDecision: audit.validationMeta?.overallDecision,
      acceptedGapSummary: audit.validationMeta?.acceptedGapSummary || null
    },
    database: {
      backupPath: relative(repositoryRoot, backupPath),
      transactionalImport: "passed",
      catalogCacheCleared,
      scopedRows: verification.importRows,
      activeSupersededBachelorRows: verification.activeSupersededBachelorRows,
      legacyVisibleBachelorRows: verification.legacyVisibleBachelorRows,
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
      careerDisplayRows: verification.careerDisplayRows,
      officialUnpublishedCareerRows: verification.officialUnpublishedCareerRows,
      officialDirectIeltsRows: verification.officialDirectIeltsRows,
      muetEquivalentIeltsRows: verification.muetEquivalentIeltsRows,
      listIeltsRows: verification.listIeltsRows,
      noListIeltsRows: verification.noListIeltsRows,
      officialUnpublishedDirectIeltsRows: verification.officialUnpublishedDirectIeltsRows,
      languageCoverageRows: verification.languageCoverageRows,
      officialFeeRows: verification.officialFeeRows,
      sourceRows: verification.sourceRows
    }
  };
}

function buildReleaseReportMarkdown(verification: IiumVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# IIUM Undergraduate Official Publication Report",
    "",
    "- Decision: published for Ian review",
    "- Scope: International Islamic University Malaysia official undergraduate programmes",
    `- Published rows: ${verification.publishedRows}`,
    `- Ready rows: ${verification.readyRows}`,
    `- Official fee rows: ${verification.officialFeeRows}`,
    `- Official direct IELTS rows: ${verification.officialDirectIeltsRows}`,
    `- MUET-equivalent IELTS rows: ${verification.muetEquivalentIeltsRows}`,
    `- List IELTS rows: ${verification.listIeltsRows}`,
    `- No list IELTS rows: ${verification.noListIeltsRows}`,
    `- No official direct IELTS rows: ${verification.officialUnpublishedDirectIeltsRows}`,
    `- Chinese programme name rows: ${verification.chineseNameRows}`,
    `- Chinese faculty rows: ${verification.chineseFacultyRows}`,
    `- Chinese curriculum rows: ${verification.chineseCurriculumRows}`,
    `- Career/display rows: ${verification.careerDisplayRows}`,
    `- Official-unpublished career rows: ${verification.officialUnpublishedCareerRows}`,
    `- Active superseded bachelor rows: ${verification.activeSupersededBachelorRows}`,
    `- Legacy visible bachelor rows: ${verification.legacyVisibleBachelorRows}`,
    `- University programCount: ${verification.universityProgramCount}`,
    `- Catalog cache cleared: ${catalogCacheCleared ? "yes" : "not configured"}`,
    `- Backup: ${relative(repositoryRoot, backupPath)}`,
    "",
    "## Gate",
    "",
    "- 中文专业名：通过",
    "- 中文学院：通过",
    "- 官方国际学生学费：通过",
    "- 学制为数字年数：通过",
    "- 课程摘要：Ian 接受作为上线版本，后续可补完整课程结构",
    "- 英语要求：5 行有官方直接 IELTS；9 行按 Ian 确认的 MUET 等效口径展示列表 IELTS；44 行仍无可换算列表 IELTS",
    "- 职业方向：26 行按官网未公布显示，不使用第三方或推断内容",
    "- 申请截止：使用 IIUM eAdmission 当前 2026/2027 第一学期国际学历申请开放说明；官网未公布具体截止日期",
    "",
    "## Official Sources",
    "",
    `- ${officialWebsite}`,
    `- ${academicsUrl}`,
    `- ${admissionUrl}`,
    `- ${academicCalendarUrl}`,
    `- ${amadFaqUrl}`,
    `- ${eAdmissionUrl}`,
    `- ${financeFeeUrl}`,
    `- ${financeFeePdfUrl}`,
    ""
  ].join("\n");
}

function buildIiumProgrammeSourceLinks(programme: IiumAuditProgramme): OfficialSourceLink[] {
  const urls = new Set([
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || financeFeeUrl,
    financeFeePdfUrl,
    academicsUrl,
    admissionUrl,
    academicCalendarUrl,
    amadFaqUrl,
    eAdmissionUrl,
    ...urlsFromUnknown(programme.fieldEvidence),
    ...urlsFromUnknown(programme.fieldStatus),
    ...urlsFromUnknown(programme.crawlLog)
  ].filter(Boolean));

  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && officialIiumUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url, programme),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: url === (programme.officialFeeSourceUrl || financeFeeUrl)
        ? "IIUM official Finance Bachelor Degree Programmes (International) source used for the international undergraduate fee amount."
        : "Official IIUM source used for the 2026-06-29 undergraduate public audit."
    }));
}

function buildIiumUniversitySourceLinks(audit: IiumReviewedAudit): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    academicsUrl,
    admissionUrl,
    academicCalendarUrl,
    amadFaqUrl,
    eAdmissionUrl,
    financeFeeUrl,
    financeFeePdfUrl,
    ...urlsFromUnknown(audit.sourceRegistry),
    ...urlsFromUnknown(audit.programmeBaseline),
    ...urlsFromUnknown(audit.programme_baseline)
  ]);
  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && officialIiumUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: "Official IIUM university/programme source used for undergraduate publication."
    }));
}

function buildLanguage(programme: IiumAuditProgramme): LanguageRequirement {
  const directIelts = programme.language?.ielts || 0;
  const muetEquivalent = directIelts > 0 ? 0 : muetBandToIeltsEquivalent(programme.language?.muet) || 0;
  return {
    ielts: directIelts || muetEquivalent,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: IiumAuditProgramme) {
  const directIelts = programme.language?.ielts || 0;
  const muetEquivalent = directIelts > 0 ? 0 : muetBandToIeltsEquivalent(programme.language?.muet) || 0;
  const parts = [
    directIelts ? `IELTS ${directIelts}` : "",
    programme.language?.toefl ? `TOEFL ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver ? `Waiver: ${programme.language.waiver}` : ""
  ].filter(Boolean);
  if (directIelts && parts.length) return normalizeLongText(`Official direct IELTS requirement: ${parts.join("; ")}.`);
  if (muetEquivalent) {
    return normalizeLongText([
      `StudyMY list IELTS ${formatNumber(muetEquivalent)} uses Ian-approved MUET-equivalent display mapping from official MUET Band ${programme.language?.muet}.`,
      parts.length ? `Official language evidence: ${parts.join("; ")}.` : "",
      asRecord(programme.fieldEvidence?.language).evidenceText || programme.fieldStatus?.["language.ielts"]?.note || ""
    ].filter(Boolean).join(" "));
  }
  const evidence = asRecord(programme.fieldEvidence?.language).evidenceText;
  const note = programme.fieldStatus?.["language.ielts"]?.note;
  return normalizeLongText([
    "IIUM 校内英语能力测试（EPT）：IIUM AMAD FAQ states English Proficiency Test (EPT) is compulsory for all new students.",
    "Official sources did not publish a direct IELTS value for this programme.",
    note || evidence || ""
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirement(programme: IiumAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `Academic level: ${requirement.degreeLevel}.` : "",
    requirement.degreeRelevance ? `Academic relevance: ${requirement.degreeRelevance}.` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `Published GPA threshold: ${requirement.minGPA}/${requirement.gpaScale || 4}.` : "",
    requirement.workExperience ? `Work or experience requirement: ${requirement.workExperience}.` : "",
    "Final equivalency assessment follows IIUM AMAD/eAdmission and programme-level official requirements."
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirementZh(programme: IiumAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `学历层级：${requirement.degreeLevel}。` : "",
    requirement.degreeRelevance ? `相关背景：${requirement.degreeRelevance}。` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `官方 GPA 门槛：${requirement.minGPA}/${requirement.gpaScale || 4}。` : "",
    requirement.workExperience ? `工作经验要求：${requirement.workExperience}。` : "",
    "最终等效资格以 IIUM AMAD / eAdmission 与专业官方要求为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: IiumAuditProgramme) {
  return normalizeLongText([
    programme.studyModeNote || "",
    programme.thesisRequired === true ? "Thesis, dissertation, research project or final project applies where required by the programme structure." : "",
    programme.thesisNote || "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.supervisorSystem === true ? "Supervisor or research supervision applies." : "",
    programme.creditHours ? `Credit hours: ${programme.creditHours}.` : "",
    programme.fieldStatus?.creditHours?.note || "",
    programme.fieldStatus?.applicationDeadline?.note || "",
    programme.fieldStatus?.careerProspects?.note || ""
  ].filter(Boolean).join(" "));
}

function buildDurationOfficial(programme: IiumAuditProgramme) {
  const standard = `${programme.duration} ${programme.duration === 1 ? "year" : "years"}`;
  const credit = programme.creditHours ? `Credit hours: ${programme.creditHours}` : "";
  return normalizeText([standard, credit, programme.studyModeNote].filter(Boolean).join("; "), 500);
}

function buildPublicDisplayNote(programme: IiumAuditProgramme) {
  const directIelts = programme.language?.ielts || 0;
  const muetEquivalent = directIelts > 0 ? 0 : muetBandToIeltsEquivalent(programme.language?.muet) || 0;
  const notes = [
    "已依据 IIUM 官方来源完成上线校验：中文专业名、中文学院、官方国际学生学费、数字学制与官方来源链接。",
    directIelts ? "" : muetEquivalent
      ? `官方公布 MUET Band ${programme.language?.muet}；列表按 Ian 确认口径展示 IELTS ${formatNumber(muetEquivalent)} 等效。`
      : "英语要求为官网未公布直接 IELTS，且无可换算 MUET 分数。",
    programme.careerProspects.length ? "" : "职业方向为官网未公布，不使用第三方或推断内容。",
    "申请截止采用当前 eAdmission 开放说明；官网未公布具体截止日期。"
  ].filter(Boolean);
  return normalizeLongText(notes.join(" "));
}

function localizedChineseList(chineseItems: string[], englishItems: string[]): LocalizedStringArray {
  return arr(englishItems, englishItems, chineseItems, chineseItems);
}

function displayCareerZh(programme: IiumAuditProgramme) {
  if (programme.careerProspects.length) return programme.careerProspects;
  return ["官网未公布具体职业方向"];
}

function displayCareerEn(programme: IiumAuditProgramme) {
  if (!programme.careerProspects.length) return ["Official IIUM sources do not publish specific career prospects for this programme."];
  return [`See the official IIUM programme source for career prospects of ${programme.nameEn}.`];
}

function inferStudyMode(programme: IiumAuditProgramme) {
  const text = `${programme.nameEn} ${programme.studyModeNote || ""}`.toLowerCase();
  if (/odl|open distance|online distance/.test(text)) return "online-distance-learning";
  return "on-campus";
}

function inferCampus(programme: IiumAuditProgramme) {
  const value = `${programme.nameEn} ${programme.faculty}`.toLowerCase();
  if (/medicine|pharmacy|dentistry|nursing|allied health|science/.test(value)) return "IIUM Kuantan Campus";
  if (/tourism|contemporary languages/.test(value)) return "IIUM Pagoh Campus";
  return "IIUM Gombak Campus";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/law|shariah|kulliyyah of laws/.test(value)) return "law";
  if (/business|management|finance|accounting|economics|administration|kulliyyah of economics/.test(value)) return "business";
  if (/computer|information technology|ict|kulliyyah of information/.test(value)) return "it";
  if (/engineering|aerospace|mechanical|mechatronics|civil|materials|manufacturing|electrical|electronics|quantity surveying|architecture|urban|planning|landscape|built environment/.test(value)) return "engineering";
  if (/medicine|medical|pharmacy|dental|dentistry|nursing|allied health|audiology|optometry|physiotherapy|dietetics|biomedical|speech-language|psychology/.test(value)) return "medicine";
  if (/science|biotechnology|mathematical|chemistry|physics|marine|plant/.test(value)) return "science";
  return "arts";
}

function intakeMonthNames(months: number[]) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (months || []).map((month) => names[month - 1]).filter(Boolean);
}

function sourceLinkTitle(url: string, programme?: IiumAuditProgramme) {
  if (url === officialWebsite) return "IIUM official website";
  if (url === academicsUrl) return "IIUM Academics";
  if (url === admissionUrl) return "IIUM AMAD Admission";
  if (url === academicCalendarUrl) return "IIUM Academic Calendar";
  if (url === amadFaqUrl) return "IIUM AMAD FAQ";
  if (url === eAdmissionUrl || url.startsWith(eAdmissionUrl)) return "IIUM eAdmission";
  if (url === financeFeeUrl) return "IIUM Finance Bachelor Degree Programmes (International)";
  if (url === financeFeePdfUrl) return "IIUM Finance UG International fee PDF";
  if (programme && url === programme.officialSourceUrl) return "Official programme source";
  if (/pdf/i.test(url)) return "Official IIUM PDF";
  return "Official IIUM source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/fee|finance|tuition/.test(value)) return "fee";
  if (/admission|amad|eadmission|calendar|faq/.test(value)) return "admission";
  if (/academics|programme|program|kulliyyah|undergraduate|handbook|bachelor/.test(value)) return "study-portal";
  if (value === officialWebsite) return "profile";
  return "other";
}

function officialIiumUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "iium.edu.my" || host.endsWith(".iium.edu.my");
  } catch {
    return false;
  }
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
    .replace(/[’']/g, "")
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
  await runIiumUndergraduatePublication({
    auditPath: resolve(readArgValue("--audit") || DEFAULT_IIUM_UNDERGRADUATE_AUDIT_PATH),
    planOutput: resolve(readArgValue("--plan-output") || DEFAULT_IIUM_PUBLISH_PLAN_PATH),
    postImportAuditOutput: resolve(readArgValue("--post-import-audit-output") || DEFAULT_IIUM_POST_IMPORT_AUDIT_PATH),
    releaseReportOutput: resolve(readArgValue("--release-report-output") || DEFAULT_IIUM_RELEASE_REPORT_PATH),
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
