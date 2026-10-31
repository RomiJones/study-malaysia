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
const uitmImportDir = resolve(repositoryRoot, "data/imports/uitm/2026-06-28/all-level-official-publication");

export const UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX = "uitm-public-20260628-";
export const UITM_PUBLIC_UNDERGRADUATE_SLUG_PREFIX = UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX;
export const DEFAULT_UITM_UNDERGRADUATE_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/UiTM_audit_undergraduate_20260627_reviewed_v4.json"
);
export const DEFAULT_UITM_MASTER_AUDIT_PATH = resolve(repositoryRoot, "audits/UiTM_audit_master_20260628_reviewed_v3.json");
export const DEFAULT_UITM_DOCTORAL_AUDIT_PATH = resolve(repositoryRoot, "audits/UiTM_audit_doctoral_20260628_reviewed_v1.json");
export const DEFAULT_UITM_PUBLISH_PLAN_PATH = resolve(uitmImportDir, "01_publish_plan.json");
export const DEFAULT_UITM_POST_IMPORT_AUDIT_PATH = resolve(uitmImportDir, "02_post_import_audit.json");
export const DEFAULT_UITM_RELEASE_REPORT_PATH = resolve(uitmImportDir, "03_release_report.md");

const verifiedAt = "2026-06-28";
const myrToCny = 1.55;
const expectedProgrammes = 388;
const expectedByLevel = { bachelor: 164, master: 162, phd: 62 } as const;
const expectedReadyRows = 222;
const expectedNotAvailableRows = 166;
const expectedLanguageExceptionRows = 0;
const expectedOfficialFeeRows = 222;
const publicCatalogProgramStatuses = [
  "ready",
  "current-cycle-not-open",
  "official-language-requirement-not-published",
  "not-available-for-international"
] as const;
const officialWebsite = "https://uitm.edu.my";
const programmeCatalogueUrl = "https://online.uitm.edu.my/degree.cfm";
const eSyaratUrl = "https://pengambilan.uitm.edu.my/index.php/e-aplikasi/e-syarat";
const syaratAmUrl = "https://a.uitm.edu.my/SyaratAm/UE";
const faqUrl = "https://pengambilan.uitm.edu.my/index.php/faq";
const heaProgrammeUrl = "https://hea.uitm.edu.my/index.php/academic/program-pelaksana-pu";
const feePageUrl = "https://bendahari.uitm.edu.my/index.php/component/content/article/37-pelajar/73-struktur-yuran-perdana?Itemid=101";
const academicCalendarUrl = "https://hea.uitm.edu.my/index.php/calendars/academic-calendar";
const ipsisClusterUrl = "https://ipsis.uitm.edu.my/index.php/apply-now-2-admission/program-by-cluster";
const ipsisApplyUrl = "https://ipsis.uitm.edu.my/index.php/apply-now-2-admission";
const internationalBrochureUrl = "https://ipsis.uitm.edu.my/images/Admission/BROCHURE_INTERNATIONAL_2024.pdf";
const universitySlug = "universiti-teknologi-mara-uitm";

type UitmAuditLevel = "undergraduate" | "master" | "doctoral";
type UitmDegreeLevel = "bachelor" | "master" | "phd";

interface UitmEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface UitmAuditProgramme {
  code: string;
  officialCodeAlias?: string | null;
  nameEn: string;
  name: string;
  officialMalayName?: string | null;
  faculty: string;
  facultyZh: string | null;
  level: UitmAuditLevel;
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
  entryRequirement: UitmEntryRequirement;
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
  _repairsApplied?: unknown[];
  _pendingIssues?: unknown[];
}

interface UitmReviewedAudit {
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  auditMeta?: {
    targetUniversityShortName?: string;
    targetLevel?: UitmAuditLevel;
    targetUniversity?: string;
    officialDomain?: string;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
    exceptionCount?: number;
  };
  sourceRegistry?: unknown;
  programmes: UitmAuditProgramme[];
  pending_issues?: unknown[];
  exception_queue?: Array<Record<string, unknown>>;
  validationMeta?: {
    overallDecision?: string;
    reviewVersion?: number;
    counts?: {
      totalProgrammesValidated?: number;
      issuesPending?: number;
    };
    qualityRuleCandidates?: string[];
  };
  repair_log?: unknown[];
}

interface UitmAuditInputSet {
  undergraduate: UitmReviewedAudit;
  master: UitmReviewedAudit;
  doctoral: UitmReviewedAudit;
}

interface UitmImportSummary {
  importRows: number;
  byLevel: Record<UitmDegreeLevel, number>;
  readyRows: number;
  notAvailableForInternationalRows: number;
  languageExceptionRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialFeeRows: number;
  officialFeeNotPublishedRows: number;
  directIeltsRows: number;
  readyIeltsRows: number;
  muetRows: number;
  chineseNameRows: number;
  translatedEnglishNameRows: number;
  chineseFacultyRows: number;
  chineseCurriculumRows: number;
  chineseCareerRows: number;
  englishPublicTextRows: number;
  sourceRows: number;
  officialUnpublishedCurriculumRows: number;
  officialUnpublishedCareerRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UitmVerification extends UitmImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityOfficialSourceStatus: OfficialSourceStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  activeSupersededRows: number;
  legacyVisibleRows: number;
  visibleCurrentRows: number;
}

const t = (en: string, ms = en, zhCN = en, zhTW = zhCN): LocalizedText => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], ms = en, zhCN = en, zhTW = zhCN): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

const englishApplicationDocs = [
  "Submit the UiTM IPSis or official admission application for the selected postgraduate programme where international admission is open.",
  "Submit passport biodata pages and international student identity documents.",
  "Submit certified academic certificates and transcripts; non-English documents require English translation.",
  "Submit official English-language evidence such as IELTS, TOEFL or MUET where applicable.",
  "Research applicants submit research proposal, supervisor matching or faculty-specific research materials where required.",
  "Complete UiTM, IPSis, EMGS, visa, medical-screening and registration steps after offer instructions."
];

const chineseApplicationDocs = [
  "通过 UiTM IPSis 或官方招生系统提交对应研究生专业申请（仅限官方开放国际申请的专业）",
  "提交护照首页及国际学生身份相关材料",
  "提交经认证的学历证书和完整成绩单；非英文材料需附英文翻译",
  "按要求提交 IELTS、TOEFL 或 MUET 等官方英语能力证明",
  "研究型申请人按院系要求提交研究计划、导师匹配或研究相关材料",
  "收到录取说明后完成 UiTM、IPSis、EMGS、签证、体检和注册相关步骤"
];

const englishUnavailableDocs = [
  "Official source states this programme is not open to international applicants, or UiTM undergraduate admission is not open to non-citizens or permanent residents.",
  "International application documents and international tuition are not applicable for this display row.",
  "This row is retained as official programme reference and must not be used for application planning."
];

const chineseUnavailableDocs = [
  "官方来源显示该专业不开放国际申请，或 UiTM 官方 FAQ 明确本科不开放给非马来西亚公民或永久居民申请",
  "国际申请材料与国际学生学费不适用于该展示行",
  "该行仅作为官方专业参考展示，不可用于申请规划"
];

export function validateUitmReviewedAudit(
  audit: UitmReviewedAudit,
  expectedCount = expectedCountForAudit(audit.auditMeta?.targetLevel || "undergraduate"),
  targetLevel: UitmAuditLevel = audit.auditMeta?.targetLevel || "undergraduate"
): string[] {
  const errors: string[] = [];
  if (audit.safe_to_import !== false) errors.push(`${targetLevel}: safe_to_import must remain false.`);
  if (audit.import_approved_by != null || audit.import_approved_at != null) errors.push(`${targetLevel}: import approval fields must remain null.`);
  if (audit.auditMeta?.targetUniversityShortName !== "UiTM") errors.push(`${targetLevel}: targetUniversityShortName must be UiTM.`);
  if (audit.auditMeta?.targetLevel !== targetLevel) errors.push(`${targetLevel}: targetLevel must be ${targetLevel}.`);
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedCount) errors.push(`${targetLevel}: baseline must be ${expectedCount}.`);
  if (audit.auditMeta?.totalProgrammesCollected !== expectedCount) errors.push(`${targetLevel}: collected count must be ${expectedCount}.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
    errors.push(`${targetLevel}: expected ${expectedCount} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if ((audit.pending_issues || []).length !== 0) errors.push(`${targetLevel}: pending_issues must be empty.`);
  if (!["PASS", "PASS-WITH-EXCEPTIONS"].includes(String(audit.validationMeta?.overallDecision || ""))) {
    errors.push(`${targetLevel}: validationMeta.overallDecision must be PASS or PASS-WITH-EXCEPTIONS.`);
  }
  if (audit.validationMeta?.counts?.totalProgrammesValidated !== expectedCount) {
    errors.push(`${targetLevel}: validation totalProgrammesValidated must be ${expectedCount}.`);
  }
  if (audit.validationMeta?.counts?.issuesPending !== 0) errors.push(`${targetLevel}: validation issuesPending must be 0.`);

  const seenCodes = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `${targetLevel} ${index + 1} ${programme.code || "unknown"} ${programme.nameEn || "unknown"}`;
    if (!programme.code) errors.push(`${row}: code is required.`);
    if (seenCodes.has(programme.code)) errors.push(`${row}: duplicate programme code.`);
    seenCodes.add(programme.code);
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn || !programme.name.includes(`（${programme.nameEn}）`)) {
      errors.push(`${row}: Chinese bilingual programme name is required.`);
    }
    if (programme.level !== targetLevel) errors.push(`${row}: level must be ${targetLevel}.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) errors.push(`${row}: Chinese faculty is required.`);
    if (!allowedUitmSourceUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be UiTM official or official-linked URL.`);
    if (programme._pendingIssues?.length) errors.push(`${row}: _pendingIssues must be empty.`);
    if (typeof programme.duration !== "number" || programme.duration <= 0) errors.push(`${row}: duration must be positive number.`);
    if (!Array.isArray(programme.intake) || programme.intake.some((month) => month < 1 || month > 12)) {
      errors.push(`${row}: intake must be valid month numbers.`);
    }
    if (Array.isArray(programme.intake) && programme.intake.length === 0 && !hasOfficialUnpublishedIntake(programme)) {
      errors.push(`${row}: empty intake requires official-unpublished intake evidence.`);
    }

    if (targetLevel === "undergraduate") {
      if (programme.officialFeeSourceUrl != null) errors.push(`${row}: undergraduate officialFeeSourceUrl must stay null.`);
      if (programme.tuitionMYR != null) errors.push(`${row}: undergraduate tuitionMYR must stay null.`);
      if (programme.publicDisplayStatus !== "needs-review") errors.push(`${row}: undergraduate source publicDisplayStatus must remain needs-review.`);
      if (programme.auditStatus !== "official-admission-blocked") errors.push(`${row}: undergraduate auditStatus must be official-admission-blocked.`);
      if (programme._validationResult !== "PASS") errors.push(`${row}: validation result must be PASS.`);
      continue;
    }

    if (programme.publicDisplayStatus === "ready") {
      if (programme.auditStatus !== "official-verified-commercial-ready") errors.push(`${row}: ready auditStatus must be official-verified-commercial-ready.`);
      if (!programme.officialFeeSourceUrl || !allowedUitmSourceUrl(programme.officialFeeSourceUrl)) {
        errors.push(`${row}: ready officialFeeSourceUrl must be UiTM official URL.`);
      }
      if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: ready tuitionMYR must be positive number.`);
      if (!programme.language || typeof programme.language.ielts !== "number" || programme.language.ielts <= 0) {
        errors.push(`${row}: ready IELTS list score is required.`);
      }
      if (programme.language?.ielts === programme.language?.muet && [3, 4].includes(Number(programme.language?.ielts))) {
        errors.push(`${row}: IELTS appears to be copied from MUET.`);
      }
      continue;
    }

    if (programme.publicDisplayStatus === "not-available-for-international") {
      if (programme.auditStatus !== "official-admission-blocked") errors.push(`${row}: not-available row must use official-admission-blocked.`);
      if (programme.tuitionMYR != null) errors.push(`${row}: not-available row tuitionMYR must be null.`);
      if (programme.language?.ielts != null) errors.push(`${row}: not-available row IELTS must be null.`);
      continue;
    }

    if (programme.publicDisplayStatus === "official-language-requirement-not-published") {
      if (programme.code !== "LG950") errors.push(`${row}: only LG950 is approved for the UiTM single-IELTS display exception.`);
      if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: language exception tuitionMYR must be positive number.`);
      if (programme.language?.ielts != null) errors.push(`${row}: language exception must not expose one IELTS scalar.`);
      if (!programme.language?.otherRequirement) errors.push(`${row}: language exception must retain official split requirement in otherRequirement.`);
      continue;
    }

    errors.push(`${row}: unsupported publicDisplayStatus ${programme.publicDisplayStatus}.`);
  }
  return errors;
}

export function loadUitmReviewedAudit(path = DEFAULT_UITM_UNDERGRADUATE_AUDIT_PATH): UitmReviewedAudit {
  return loadJson<UitmReviewedAudit>(path);
}

export function loadUitmReviewedAudits(paths: {
  undergraduatePath?: string;
  masterPath?: string;
  doctoralPath?: string;
} = {}): UitmAuditInputSet {
  return {
    undergraduate: loadJson<UitmReviewedAudit>(paths.undergraduatePath || DEFAULT_UITM_UNDERGRADUATE_AUDIT_PATH),
    master: loadJson<UitmReviewedAudit>(paths.masterPath || DEFAULT_UITM_MASTER_AUDIT_PATH),
    doctoral: loadJson<UitmReviewedAudit>(paths.doctoralPath || DEFAULT_UITM_DOCTORAL_AUDIT_PATH)
  };
}

export function buildUitmOfficialAuditRows(input: UitmAuditInputSet | UitmReviewedAudit): Array<DeepPartial<ProgramEntity>> {
  const programmes = isAuditInputSet(input)
    ? [...input.undergraduate.programmes, ...input.master.programmes, ...input.doctoral.programmes]
    : input.programmes;
  return programmes.map((programme, index) => buildUitmProgrammeRow(programme, index + 1));
}

export function summarizeUitmOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): UitmImportSummary {
  return {
    importRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length,
      master: rows.filter((row) => row.level === "master").length,
      phd: rows.filter((row) => row.level === "phd").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    notAvailableForInternationalRows: rows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length,
    languageExceptionRows: rows.filter((row) => row.publicDisplayStatus === "official-language-requirement-not-published").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    officialFeeNotPublishedRows: rows.filter((row) => row.officialFeeAuditStatus === "not-published").length,
    directIeltsRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0).length,
    readyIeltsRows: rows.filter((row) =>
      row.publicDisplayStatus === "ready" && Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0
    ).length,
    muetRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.muet || 0) > 0).length,
    chineseNameRows: rows.filter((row) => hasChinese((row.name as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    translatedEnglishNameRows: rows.filter((row) => /translated-from-official-malay/i.test(String(row.auditNote || ""))).length,
    chineseFacultyRows: rows.filter((row) => hasChinese((row.faculty as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseCurriculumRows: rows.filter((row) => localizedArrayHasChinese(row.curriculum as LocalizedStringArray | undefined)).length,
    chineseCareerRows: rows.filter((row) => localizedArrayHasChinese(row.careers as LocalizedStringArray | undefined)).length,
    englishPublicTextRows: rows.filter((row) =>
      !hasChinese((row.name as LocalizedText | undefined)?.en || "") &&
      !hasChinese((row.faculty as LocalizedText | undefined)?.en || "") &&
      localizedArrayHasNoChinese(row.curriculum as LocalizedStringArray | undefined, "en") &&
      localizedArrayHasNoChinese(row.careers as LocalizedStringArray | undefined, "en")
    ).length,
    sourceRows: rows.filter((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 3).length,
    officialUnpublishedCurriculumRows: rows.filter((row) =>
      (row.curriculum as LocalizedStringArray | undefined)?.["zh-CN"]?.some((item) => item.includes("官网未公布"))
    ).length,
    officialUnpublishedCareerRows: rows.filter((row) =>
      (row.careers as LocalizedStringArray | undefined)?.["zh-CN"]?.some((item) => item.includes("官网未公布"))
    ).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildUitmUniversityRow(
  input: UitmAuditInputSet | UitmReviewedAudit,
  rows: Array<DeepPartial<ProgramEntity>>,
  existing: UniversityEntity | null = null
): DeepPartial<UniversityEntity> {
  const audits = toAuditInputSet(input);
  const annualCosts = rows
    .filter((row) => row.publicDisplayStatus !== "not-available-for-international")
    .map((row) => Number(row.annualTuitionCny || 0))
    .filter((value) => value > 0);
  const ieltsValues = rows
    .filter((row) => row.publicDisplayStatus === "ready")
    .map((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0))
    .filter((value) => value > 0);
  const statusSummary = buildCatalogStatusSummary(rows);

  return {
    slug: existing?.slug || universitySlug,
    code: existing?.code || "UITM",
    name: t("Universiti Teknologi MARA (UiTM)", "Universiti Teknologi MARA (UiTM)", "玛拉工艺大学（UiTM）", "瑪拉工藝大學（UiTM）"),
    shortName: existing?.shortName || "UiTM",
    logoUrl: existing?.logoUrl || "/assets/static-html/university-logos/uitm-universiti-teknologi-mara-uitm-e6c978245a.png",
    imageUrl: existing?.imageUrl || "/assets/static-html/university-covers/uitm-universiti-teknologi-mara-uitm-755d4053a7.jpg",
    color: existing?.color || "#4B206D",
    qsRank: 549,
    qsAsiaRank: existing?.qsAsiaRank ?? 116,
    location: t("Shah Alam, Selangor, Malaysia", "Shah Alam, Selangor, Malaysia", "马来西亚雪兰莪州莎阿南", "馬來西亞雪蘭莪州莎阿南"),
    region: t("Selangor", "Selangor", "雪兰莪", "雪蘭莪"),
    ownership: existing?.ownership || "public",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 1956,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: t(
      "Universiti Teknologi MARA (UiTM) is a Malaysian public university. This StudyMY publication keeps UiTM undergraduate rows as official reference-only entries because official FAQ evidence says undergraduate admission is not open to non-citizens or permanent residents, while reviewed master and doctoral rows are shown from official IPSis, faculty, prospectus and international brochure evidence.",
      "Universiti Teknologi MARA (UiTM) is a Malaysian public university. This StudyMY publication keeps UiTM undergraduate rows as official reference-only entries because official FAQ evidence says undergraduate admission is not open to non-citizens or permanent residents, while reviewed master and doctoral rows are shown from official IPSis, faculty, prospectus and international brochure evidence.",
      "玛拉工艺大学（UiTM）是马来西亚公立大学。本次 StudyMY 上线将本科保留为官方参考行并标注国际学生未开放；已复核的硕士和博士则依据 UiTM IPSis、学院页面、官方 Prospectus 与国际学生手册证据展示。",
      "瑪拉工藝大學（UiTM）是馬來西亞公立大學。本次 StudyMY 上線將本科保留為官方參考行並標註國際學生未開放；已複核的碩士和博士則依據 UiTM IPSis、學院頁面、官方 Prospectus 與國際學生手冊證據展示。"
    ),
    website: officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: "Universiti Teknologi MARA",
    officialWebsite,
    studyPortalUrl: ipsisClusterUrl,
    internationalPageUrl: ipsisApplyUrl,
    applicationPortalUrl: "",
    officialAddress: existing?.officialAddress || "Universiti Teknologi MARA, Shah Alam, Selangor, Malaysia",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: arr(englishApplicationDocs, englishApplicationDocs, chineseApplicationDocs, chineseApplicationDocs),
    chinaStudentRequirements: arr(
      ["UiTM did not publish a separate China-specific equivalency route in the collected official sources. Undergraduate admission is not open to international applicants; postgraduate applicants follow the official international and programme-specific requirements."],
      ["UiTM did not publish a separate China-specific equivalency route in the collected official sources. Undergraduate admission is not open to international applicants; postgraduate applicants follow the official international and programme-specific requirements."],
      ["本次采集的 UiTM 官方来源未单独公布中国学生学历等效路径。本科不开放国际申请；研究生申请按国际招生流程和各专业官方要求评估。"],
      ["本次採集的 UiTM 官方來源未單獨公布中國學生學歷等效路徑。本科不開放國際申請；研究生申請按國際招生流程和各專業官方要求評估。"]
    ),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      rankings: {
        ...asRecord(asRecord(existing?.officialProfile).rankings),
        qsWorld: {
          name: "QS World University Rankings",
          year: 2027,
          status: "ranked",
          context: "malaysia-institution",
          qsTitle: "Universiti Teknologi MARA - UiTM",
          rankDisplay: "=549",
          rankSort: 549,
          sourceUrl: "https://www.topuniversities.com/universities/universiti-teknologi-mara-uitm",
          retrievedAt: "2026-06-19T00:00:00+08:00"
        }
      },
      uitmAllLevelPublication: {
        sourceAudits: {
          undergraduate: relative(repositoryRoot, DEFAULT_UITM_UNDERGRADUATE_AUDIT_PATH),
          master: relative(repositoryRoot, DEFAULT_UITM_MASTER_AUDIT_PATH),
          doctoral: relative(repositoryRoot, DEFAULT_UITM_DOCTORAL_AUDIT_PATH)
        },
        publishedAt: new Date().toISOString(),
        verifiedAt,
        programmes: rows.length,
        byLevel: expectedByLevel,
        readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
        notAvailableForInternationalRows: rows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length,
        languageExceptionRows: rows.filter((row) => row.publicDisplayStatus === "official-language-requirement-not-published").length,
        publicationHardGate: "passed",
        sourceAuditSafeToImport: false,
        importerAuthorization: "ian-explicit-operator-command",
        qualityRuleCandidates: [
          ...(audits.undergraduate.validationMeta?.qualityRuleCandidates || []),
          ...(audits.master.validationMeta?.qualityRuleCandidates || []),
          ...(audits.doctoral.validationMeta?.qualityRuleCandidates || [])
        ],
        exceptions: [
          ...(audits.undergraduate.exception_queue || []),
          ...(audits.master.exception_queue || []),
          ...(audits.doctoral.exception_queue || [])
        ]
      },
      catalogStatusSummary: statusSummary
    },
    officialSources: buildUitmUniversitySourceLinks(audits),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: "UiTM all-level publication uses official-only evidence. Bachelor rows are displayed as not available for international applicants. Master and doctoral ready rows pass StudyMY hard gates: Chinese bilingual programme name, Chinese faculty, direct IELTS scalar, single official MYR tuition amount and numeric duration. MD786 and AM700 are marked not available for international applicants; LG950 is displayed with Ian-approved conditional language handling: the list shows the minimum international IELTS 5.0 while the detail page retains the official English-major IELTS 6.0 route.",
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualCosts.length ? Math.min(...annualCosts) : existing?.tuitionMinCny || 0,
    tuitionMaxCny: annualCosts.length ? Math.max(...annualCosts) : existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 24000,
    minIelts: ieltsValues.length ? Math.min(...ieltsValues) : 0,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr(
      ["Official UiTM undergraduate catalogue", "UiTM IPSis postgraduate admission sources", "Official faculty and programme prospectus evidence", "Official international brochure evidence"],
      ["Official UiTM undergraduate catalogue", "UiTM IPSis postgraduate admission sources", "Official faculty and programme prospectus evidence", "Official international brochure evidence"],
      ["UiTM 官方本科目录", "UiTM IPSis 研究生招生来源", "官方学院页面与专业 Prospectus 证据", "官方国际学生手册证据"],
      ["UiTM 官方本科目錄", "UiTM IPSis 研究生招生來源", "官方學院頁面與專業 Prospectus 證據", "官方國際學生手冊證據"]
    ),
    highlights: arr(
      ["Official UiTM bachelor, master and doctoral data", "Undergraduate rows marked not available for international applicants", "Postgraduate ready rows retain official IELTS and MYR fee evidence"],
      ["Official UiTM bachelor, master and doctoral data", "Undergraduate rows marked not available for international applicants", "Postgraduate ready rows retain official IELTS and MYR fee evidence"],
      ["UiTM 官方本硕博数据", "本科统一标注国际学生未开放", "研究生 ready 行保留官方 IELTS 与 MYR 学费证据"],
      ["UiTM 官方本碩博資料", "本科統一標註國際學生未開放", "研究生 ready 行保留官方 IELTS 與 MYR 學費證據"]
    ),
    programCount: rows.length,
    isPublished: true
  };
}

export function verifyUitmAllLevelPublicRecordSet(
  university: UniversityEntity,
  publicRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): UitmVerification {
  const summary = summarizeUitmOfficialAuditImport(publicRows);
  const activeSupersededRows = allUniversityRows.filter((row) =>
    !row.slug.startsWith(UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  );
  const visibleCurrentRows = publicRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    row.slug.startsWith(UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  ).length;

  if (
    publicRows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedByLevel.bachelor ||
    summary.byLevel.master !== expectedByLevel.master ||
    summary.byLevel.phd !== expectedByLevel.phd ||
    summary.readyRows !== expectedReadyRows ||
    summary.notAvailableForInternationalRows !== expectedNotAvailableRows ||
    summary.languageExceptionRows !== expectedLanguageExceptionRows ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== expectedOfficialFeeRows ||
    summary.officialFeeNotPublishedRows !== expectedNotAvailableRows ||
    summary.readyIeltsRows !== expectedReadyRows ||
    summary.chineseNameRows !== expectedProgrammes ||
    summary.chineseFacultyRows !== expectedProgrammes ||
    summary.chineseCurriculumRows !== expectedProgrammes ||
    summary.chineseCareerRows !== expectedProgrammes ||
    summary.englishPublicTextRows !== expectedProgrammes ||
    summary.sourceRows !== expectedProgrammes ||
    visibleCurrentRows !== expectedProgrammes ||
    activeSupersededRows.length !== 0 ||
    legacyVisibleRows.length !== 0 ||
    university.publicDisplayStatus !== "ready" ||
    university.officialSourceStatus !== "official-verified" ||
    !university.isPublished ||
    university.programCount !== expectedProgrammes
  ) {
    throw new Error(`UiTM all-level public verification failed: ${JSON.stringify({
      summary,
      activeSupersededRows: activeSupersededRows.map((row) => row.slug),
      legacyVisibleRows: legacyVisibleRows.map((row) => row.slug),
      visibleCurrentRows,
      universityStatus: university.publicDisplayStatus,
      universityOfficialSourceStatus: university.officialSourceStatus,
      universityPublished: university.isPublished,
      universityProgramCount: university.programCount
    })}`);
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityOfficialSourceStatus: university.officialSourceStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    activeSupersededRows: activeSupersededRows.length,
    legacyVisibleRows: legacyVisibleRows.length,
    visibleCurrentRows
  };
}

export const verifyUitmUndergraduatePublicRecordSet = verifyUitmAllLevelPublicRecordSet;

function buildUitmProgrammeRow(programme: UitmAuditProgramme, ordinal: number): DeepPartial<ProgramEntity> {
  const level = mapUitmLevel(programme.level);
  const publicDisplayStatus = mapPublicationStatus(programme);
  const isUnavailable = publicDisplayStatus === "not-available-for-international";
  const isLanguageException = publicDisplayStatus === "official-language-requirement-not-published";
  const hasFee = !isUnavailable && typeof programme.tuitionMYR === "number" && programme.tuitionMYR > 0;
  const tuitionMYR = hasFee ? Number(programme.tuitionMYR) : 0;
  const durationYears = programme.duration || 1;
  const sourceUrls = buildUitmProgrammeSourceLinks(programme, publicDisplayStatus);
  const curriculumZh = displayCurriculumZh(programme, publicDisplayStatus);
  const curriculumEn = displayCurriculumEn(programme, publicDisplayStatus);
  const careerZh = displayCareerZh(programme, publicDisplayStatus);
  const careerEn = displayCareerEn(programme, publicDisplayStatus);
  const requirementNote = buildAcademicRequirementNote(programme, publicDisplayStatus);
  const slug = `${UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.code)}-${slugify(programme.nameEn)}`.slice(0, 120);
  const officialSourceStatus = isUnavailable
    ? "official-page-verified-international-not-available" satisfies OfficialSourceStatus
    : "official-verified" satisfies OfficialSourceStatus;
  const officialFeeAuditStatus = hasFee
    ? "matched-official" satisfies FeeAuditStatus
    : "not-published" satisfies FeeAuditStatus;

  return {
    slug,
    code: `UITM-${level.toUpperCase()}-${programme.code}`,
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
    annualTuitionCny: hasFee ? Math.round((tuitionMYR * myrToCny) / Math.max(durationYears, 0.5)) : 0,
    tuitionAmount: hasFee ? tuitionMYR : null,
    tuitionCurrency: hasFee ? "MYR" as TuitionCurrency : "UNKNOWN" as TuitionCurrency,
    tuitionDisplay: hasFee ? `RM ${formatNumber(tuitionMYR)}` : "Not applicable to international students",
    officialTuitionMYR: hasFee ? Math.round(tuitionMYR) : null,
    officialTuitionNote: buildTuitionNote(programme, publicDisplayStatus),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || programme.officialSourceUrl || (isUnavailable ? faqUrl : internationalBrochureUrl),
    secondaryOfficialFeeSourceUrl: hasFee && programme.officialFeeSourceUrl !== internationalBrochureUrl ? internationalBrochureUrl : "",
    officialFeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: intakeMonthNames(programme.intake),
    officialIntake: intakeMonthNames(programme.intake).join(", ") || "Official source does not publish a programme-level intake month",
    officialIntakeNote: buildIntakeNote(programme, publicDisplayStatus),
    languageRequirement: buildLanguage(programme, publicDisplayStatus),
    officialLanguageRequirement: buildLanguageText(programme, publicDisplayStatus),
    requirement: {
      gpa: programme.entryRequirement?.minGPA || 0,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: requirementNote
    },
    officialAcademicRequirement: buildAcademicRequirement(programme, publicDisplayStatus),
    chinaStudentRequirement: chinaStudentRequirement(programme, publicDisplayStatus),
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: isUnavailable
      ? arr(englishUnavailableDocs, englishUnavailableDocs, programme.applicationDocs?.length ? programme.applicationDocs : chineseUnavailableDocs, programme.applicationDocs?.length ? programme.applicationDocs : chineseUnavailableDocs)
      : arr(englishApplicationDocs, englishApplicationDocs, programme.applicationDocs || chineseApplicationDocs, programme.applicationDocs || chineseApplicationDocs),
    curriculum: arr(curriculumEn, curriculumEn, curriculumZh, curriculumZh),
    careers: arr(careerEn, careerEn, careerZh, careerZh),
    specializations: buildSpecializations(),
    description: buildProgrammeDescription(programme, publicDisplayStatus),
    officialAccreditationNote: null,
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: firstSourceUrl(programme, ["entryRequirement", "language", "nameEn"]) || programme.officialSourceUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus,
    publicDisplayStatus,
    publicDisplayNote: publicDisplayNote(programme, publicDisplayStatus),
    reviewReason: reviewReason(programme, publicDisplayStatus),
    auditNote: normalizeLongText([
      `Published from UiTM ${programme.level} reviewed audit row ${ordinal}.`,
      `Programme code: ${programme.code}.`,
      programme.officialCodeAlias ? `Official code alias: ${programme.officialCodeAlias}.` : "",
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || programme.officialSourceUrl}.`,
      `Publication status: ${publicDisplayStatus}.`,
      programme.officialMalayName ? `Official Malay name: ${programme.officialMalayName}. translated-from-official-malay` : "",
      programme.curriculumNote || "",
      programme.studyModeNote || "",
      programme.thesisNote || "",
      programme.remarks || "",
      ...(programme._validationIssues || []).map((item) => String(item))
    ].filter(Boolean).join(" ")),
    listTuitionText: hasFee ? `RM ${formatNumber(tuitionMYR)}` : "Not applicable to international students",
    isPublished: true
  };
}

async function verifyImportedUitmRows(manager: EntityManager | DataSource, universityId: number) {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("UiTM university row not found during verification.");
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  const publicRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number])
  );
  return verifyUitmAllLevelPublicRecordSet(university, publicRows, allUniversityRows);
}

async function runUitmPublication(options: {
  undergraduatePath: string;
  masterPath: string;
  doctoralPath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audits = loadUitmReviewedAudits(options);
  const validationErrors = [
    ...validateUitmReviewedAudit(audits.undergraduate, expectedByLevel.bachelor, "undergraduate"),
    ...validateUitmReviewedAudit(audits.master, expectedByLevel.master, "master"),
    ...validateUitmReviewedAudit(audits.doctoral, expectedByLevel.phd, "doctoral")
  ];
  if (validationErrors.length) throw new Error(`UiTM all-level audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildUitmOfficialAuditRows(audits);
  const summary = summarizeUitmOfficialAuditImport(rows);
  const plan = buildPublishPlan(options, summary, audits);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "uitm-all-level-dry-run",
      planPath: options.planOutput,
      summary,
      nextStep: "Run npm --workspace @studymy/api run import:uitm:official-audit -- --confirm-import"
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "UITM" } })) ||
      (await universityRepo.findOne({ where: { slug: universitySlug } }));

    if (options.verifyOnly) {
      if (!university) throw new Error("UiTM university row not found.");
      const verification = await verifyImportedUitmRows(dataSource, university.id);
      console.log(JSON.stringify({ mode: "uitm-all-level-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: universitySlug } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug ${universitySlug} belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/uitm-all-level-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: UitmVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "UITM" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: universitySlug } }));

      const universitySeed = buildUitmUniversityRow(audits, rows, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX}%`) }
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
          row.publicDisplayNote = "Archived because the UiTM all-level official publication batch supersedes this legacy or review row.";
          row.reviewReason = normalizeLongText([
            row.reviewReason,
            "Archived by UiTM all-level official publication; current public display uses uitm-public-20260628 rows."
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
      const annualCosts = publicVisibleRows
        .filter((row) => row.publicDisplayStatus !== "not-available-for-international")
        .map((row) => Number(row.annualTuitionCny || 0))
        .filter((value) => value > 0);
      const ieltsValues = publicVisibleRows
        .filter((row) => row.publicDisplayStatus === "ready")
        .map((row) => Number(row.languageRequirement?.ielts || 0))
        .filter((value) => value > 0);
      university.programCount = publicVisibleRows.length;
      if (annualCosts.length) {
        university.tuitionMinCny = Math.min(...annualCosts);
        university.tuitionMaxCny = Math.max(...annualCosts);
      }
      university.minIelts = ieltsValues.length ? Math.min(...ieltsValues) : 0;
      university.acceptNoLanguage = false;
      university = await txUniversityRepo.save(university);
      verification = await verifyImportedUitmRows(manager, university.id);
    });

    if (!verification) throw new Error("UiTM all-level publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    writeJson(options.postImportAuditOutput, buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared));
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "uitm-all-level-published",
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
  summary: UitmImportSummary,
  audits: UitmAuditInputSet
) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "UITM",
      shortName: "UiTM",
      name: "Universiti Teknologi MARA",
      slug: universitySlug
    },
    authorization: "ian-approved-all-level-official-publication",
    sourceInputs: {
      undergraduateAudit: relative(repositoryRoot, options.undergraduatePath),
      masterAudit: relative(repositoryRoot, options.masterPath),
      doctoralAudit: relative(repositoryRoot, options.doctoralPath),
      sourceAuditSafeToImport: false,
      sourceAuditReason: "StudyMY audit JSON stays safe_to_import=false by contract; this importer publishes only after explicit operator command."
    },
    writePolicy: {
      importer: "apps/api/src/db/import-uitm-official-audit.ts",
      mode: "publish-all-levels",
      upsertPrefix: UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
      universityRow: `upsert by code UITM or slug ${universitySlug}`,
      programmeRows: "upsert 388 current UiTM public rows and archive non-current UiTM rows",
      transactional: true,
      backupRequired: true
    },
    publicationHardGate: {
      result: "passed",
      standard: "docs/prd/StudyMY-official-programme-publication-hard-gate.md",
      rules: [
        "Official-only source trail",
        "Chinese bilingual programme name",
        "Chinese faculty",
        "ready rows must have direct IELTS scalar",
        "ready rows must have one official MYR tuition amount",
        "ready rows must have numeric duration years",
        "international-unavailable rows must not invent IELTS, fee or application path",
        "LG950 conditional international language requirement displays IELTS 5.0 in the list and retains IELTS 6.0 / 5.0 split details"
      ]
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
      exceptionQueue: [
        ...(audits.undergraduate.exception_queue || []),
        ...(audits.master.exception_queue || []),
        ...(audits.doctoral.exception_queue || [])
      ]
    }
  };
}

function buildPostImportAudit(
  summary: UitmImportSummary,
  verification: UitmVerification,
  backupPath: string,
  catalogCacheCleared: boolean
) {
  return {
    schemaVersion: 1,
    mode: "uitm-all-level-published",
    createdAt: new Date().toISOString(),
    institution: {
      code: "UITM",
      name: "Universiti Teknologi MARA",
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
      universityOfficialSourceStatus: verification.universityOfficialSourceStatus,
      universityIsPublished: verification.universityIsPublished,
      universityProgramCount: verification.universityProgramCount,
      rowsPublished: verification.publishedRows,
      rowsReady: verification.readyRows,
      rowsNotAvailableForInternational: verification.notAvailableForInternationalRows,
      rowsOfficialLanguageScalarException: verification.languageExceptionRows
    },
    displayHardGate: {
      chineseNameRows: verification.chineseNameRows,
      chineseFacultyRows: verification.chineseFacultyRows,
      chineseCurriculumRows: verification.chineseCurriculumRows,
      chineseCareerRows: verification.chineseCareerRows,
      englishPublicTextRows: verification.englishPublicTextRows,
      directIeltsRows: verification.directIeltsRows,
      readyIeltsRows: verification.readyIeltsRows,
      muetRows: verification.muetRows,
      officialFeeRows: verification.officialFeeRows,
      officialFeeNotPublishedRows: verification.officialFeeNotPublishedRows,
      sourceRows: verification.sourceRows,
      officialUnpublishedCurriculumRows: verification.officialUnpublishedCurriculumRows,
      officialUnpublishedCareerRows: verification.officialUnpublishedCareerRows
    }
  };
}

function buildReleaseReportMarkdown(verification: UitmVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# UiTM All-Level Official Publication Report",
    "",
    "- Decision: published for Ian review",
    "- Scope: Universiti Teknologi MARA official bachelor, master and doctoral data",
    `- Published rows: ${verification.publishedRows}`,
    `- By level: bachelor ${verification.byLevel.bachelor}, master ${verification.byLevel.master}, phd ${verification.byLevel.phd}`,
    `- Ready rows: ${verification.readyRows}`,
    `- Not available for international rows: ${verification.notAvailableForInternationalRows}`,
    `- Official language-scalar exception rows: ${verification.languageExceptionRows}`,
    `- Official fee rows: ${verification.officialFeeRows}`,
    `- Ready IELTS rows: ${verification.readyIeltsRows}`,
    `- Direct IELTS rows including unavailable reference rows: ${verification.directIeltsRows}`,
    `- Chinese programme name rows: ${verification.chineseNameRows}`,
    `- Chinese faculty rows: ${verification.chineseFacultyRows}`,
    `- Chinese curriculum/display rows: ${verification.chineseCurriculumRows}`,
    `- Chinese career/display rows: ${verification.chineseCareerRows}`,
    `- English public text rows without Chinese leakage: ${verification.englishPublicTextRows}`,
    `- Active superseded rows: ${verification.activeSupersededRows}`,
    `- Legacy visible rows: ${verification.legacyVisibleRows}`,
    `- University programCount: ${verification.universityProgramCount}`,
    `- Catalog cache cleared: ${catalogCacheCleared ? "yes" : "not configured"}`,
    `- Backup: ${relative(repositoryRoot, backupPath)}`,
    "",
    "## Hard Gate",
    "",
    "- 官方专业数据：通过",
    "- 中文专业名：通过",
    "- 中文学院：通过",
    "- ready 行列表 IELTS：通过",
    "- ready 行单一官方 MYR 学费：通过",
    "- ready 行数字学制：通过",
    "- 国际学生未开放行不编造学费、IELTS 或申请路径：通过",
    "- LG950 按 Ian 授权作为条件型语言要求展示：列表 IELTS 5.0，详情保留 English major 6.0 / 其他语言方向 5.0：通过",
    "",
    "## Official Sources",
    "",
    `- ${officialWebsite}`,
    `- ${programmeCatalogueUrl}`,
    `- ${eSyaratUrl}`,
    `- ${faqUrl}`,
    `- ${ipsisClusterUrl}`,
    `- ${ipsisApplyUrl}`,
    `- ${internationalBrochureUrl}`,
    ""
  ].join("\n");
}

function buildUitmProgrammeSourceLinks(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || "",
    programme.level === "undergraduate" ? programmeCatalogueUrl : ipsisClusterUrl,
    programme.level === "undergraduate" ? eSyaratUrl : ipsisApplyUrl,
    programme.level === "undergraduate" ? syaratAmUrl : internationalBrochureUrl,
    programme.level === "undergraduate" ? faqUrl : "",
    programme.level === "undergraduate" ? heaProgrammeUrl : "",
    programme.level === "undergraduate" ? feePageUrl : "",
    programme.level === "undergraduate" ? academicCalendarUrl : "",
    ...urlsFromUnknown(programme.fieldEvidence),
    ...urlsFromUnknown(programme.fieldStatus),
    ...urlsFromUnknown(programme.crawlLog)
  ].filter(Boolean));

  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && allowedUitmSourceUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url, programme),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: publicDisplayStatus === "not-available-for-international"
        ? "official-page-verified-international-not-available"
        : "official-verified",
      note: sourceLinkNote(url, publicDisplayStatus)
    }));
}

function buildUitmUniversitySourceLinks(audits: UitmAuditInputSet): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    programmeCatalogueUrl,
    eSyaratUrl,
    syaratAmUrl,
    faqUrl,
    heaProgrammeUrl,
    feePageUrl,
    academicCalendarUrl,
    ipsisClusterUrl,
    ipsisApplyUrl,
    internationalBrochureUrl,
    ...urlsFromUnknown(audits.undergraduate.sourceRegistry),
    ...urlsFromUnknown(audits.master.sourceRegistry),
    ...urlsFromUnknown(audits.doctoral.sourceRegistry)
  ]);
  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && allowedUitmSourceUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: "Official UiTM source used for the 2026-06-28 all-level publication."
    }));
}

function buildLanguage(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus): LanguageRequirement {
  if (publicDisplayStatus === "not-available-for-international" && programme.level !== "undergraduate") {
    return { ielts: 0, toefl: null, pte: null, muet: null };
  }
  if (isLg950ConditionalLanguageProgramme(programme)) {
    return { ielts: 5, toefl: null, pte: null, muet: 3 };
  }
  if (publicDisplayStatus === "official-language-requirement-not-published") {
    return { ielts: 0, toefl: null, pte: null, muet: null };
  }
  return {
    ielts: programme.language?.ielts || 0,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (isLg950ConditionalLanguageProgramme(programme)) {
    return "列表按国际学生最低语言门槛显示 IELTS 5.0。官方 LG950 Prospectus 按研究语言方向公布两套国际学生要求：English major 需 CEFR B2 或 IELTS 6.0 / MUET Band 4；其他语言方向需 CEFR B1 或 IELTS 5.0 / MUET Band 3。";
  }
  if (publicDisplayStatus === "not-available-for-international") {
    return normalizeLongText(programme.language?.otherRequirement || "International applicant English requirement is not applicable because the official source says this route is not open to international applicants.");
  }
  if (publicDisplayStatus === "official-language-requirement-not-published") {
    return normalizeLongText(programme.language?.otherRequirement || "Official source publishes split language requirements by research language or major; no single IELTS scalar is safe for public ready display.");
  }
  const parts = [
    programme.language?.ielts ? `IELTS ${formatNumber(programme.language.ielts)}` : "",
    programme.language?.toefl ? `TOEFL IBT ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
    programme.language?.otherRequirement && !hasChinese(programme.language.otherRequirement) ? programme.language.otherRequirement : "",
    programme.language?.waiver && !hasChinese(programme.language.waiver) ? `Waiver: ${programme.language.waiver}` : ""
  ].filter(Boolean);
  return normalizeLongText(parts.join("; "));
}

function buildAcademicRequirement(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (programme.level === "undergraduate") {
    return normalizeLongText([
      `${programme.code} e-Syarat evidence lists route-specific Malaysian undergraduate entry requirements.`,
      "The audit does not collapse STPM, STAM, matriculation, foundation, diploma, APEL or other routes into one GPA.",
      programme.entryRequirement?.minGPA ? `Detected CGPA threshold: ${programme.entryRequirement.minGPA}/${programme.entryRequirement.gpaScale || 4}.` : "",
      "International undergraduate admission is not open according to the official UiTM admission FAQ."
    ].filter(Boolean).join(" "));
  }
  const officialEntryEvidence = englishFieldEvidence(programme, "entryRequirement");
  const gpaNote = englishOrEmpty(programme.entryRequirement?.gpaNote);
  const degreeLevel = englishOrEmpty(programme.entryRequirement?.degreeLevel);
  const degreeRelevance = englishOrEmpty(programme.entryRequirement?.degreeRelevance);
  const workExperience = englishOrEmpty(programme.entryRequirement?.workExperience);
  return normalizeLongText([
    officialEntryEvidence || gpaNote,
    degreeLevel ? `Degree level: ${degreeLevel}.` : "",
    degreeRelevance && degreeRelevance !== "required" ? `Degree relevance: ${degreeRelevance}.` : "",
    programme.entryRequirement?.minGPA ? `Published CGPA threshold: ${programme.entryRequirement.minGPA}/${programme.entryRequirement.gpaScale || 4}.` : "",
    workExperience ? `Work or experience requirement: ${workExperience}.` : "",
    publicDisplayStatus === "not-available-for-international" ? "Official source indicates this programme is not open to international applicants." : "",
    "See the official UiTM programme, IPSis or faculty source for final equivalency assessment."
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirementNote(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus): LocalizedText {
  return t(
    buildAcademicRequirement(programme, publicDisplayStatus),
    buildAcademicRequirement(programme, publicDisplayStatus),
    buildAcademicRequirementZh(programme, publicDisplayStatus),
    buildAcademicRequirementZh(programme, publicDisplayStatus)
  );
}

function buildAcademicRequirementZh(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (programme.level === "undergraduate") {
    return normalizeLongText([
      `${programme.code} e-Syarat 证据按 STPM、STAM、预科、文凭、APEL 等不同本地入学路径列出要求。`,
      programme.entryRequirement?.gpaNote || "本审计不将多路径要求压缩为单一 GPA。",
      "UiTM 官方 FAQ 明确本科不开放国际学生申请。"
    ].filter(Boolean).join(" "));
  }
  return normalizeLongText([
    programme.entryRequirement?.degreeLevel ? `学历层级：${programme.entryRequirement.degreeLevel}。` : "",
    programme.entryRequirement?.degreeRelevance ? `相关背景：${programme.entryRequirement.degreeRelevance}。` : "",
    programme.entryRequirement?.gpaNote || "",
    programme.entryRequirement?.minGPA ? `官方 CGPA 门槛：${programme.entryRequirement.minGPA}/${programme.entryRequirement.gpaScale || 4}。` : "",
    programme.entryRequirement?.workExperience ? `工作经验要求：${programme.entryRequirement.workExperience}。` : "",
    publicDisplayStatus === "not-available-for-international" ? "官方来源显示该专业不开放国际申请。" : "",
    "最终等效资格以 UiTM 官方专业页、IPSis 或学院审核为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: UitmAuditProgramme) {
  return normalizeLongText([
    programme.studyModeNote || "",
    programme.thesisRequired === true ? "Thesis, dissertation, research project, clinical, practicum or studio components apply where required by the official programme structure." : "",
    programme.thesisNote || "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.supervisorSystem === true ? "Supervisor or research supervision applies." : "",
    programme.creditHours ? `Credit hours: ${programme.creditHours}.` : "",
    programme.fieldStatus?.applicationDeadline?.note || "",
    programme.fieldStatus?.careerProspects?.note || ""
  ].filter(Boolean).join(" "));
}

function buildDurationOfficial(programme: UitmAuditProgramme) {
  const standard = `${formatNumber(programme.duration || 1)} ${programme.duration === 1 ? "year" : "years"}`;
  return normalizeText([
    standard,
    englishOrEmpty(programme.durationNote),
    englishFieldEvidence(programme, "duration"),
    englishOrEmpty(programme.studyModeNote)
  ].filter(Boolean).join(". "), 500);
}

function buildTuitionNote(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (publicDisplayStatus === "not-available-for-international") {
    return normalizeLongText(programme.tuitionNote || "International student tuition is not applicable because this route is not open to international applicants.");
  }
  return normalizeLongText(programme.tuitionNote || "UiTM official source publishes the international student total estimated tuition in MYR.");
}

function buildIntakeNote(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (!intakeMonthNames(programme.intake).length) return "Official source was checked and did not publish or expose a programme-level intake month for this row.";
  if (programme.level === "undergraduate") return "UiTM e-Syarat evidence is retained for local admission-route reference only; international undergraduate admission is not open.";
  if (publicDisplayStatus === "not-available-for-international") return "Official source indicates this programme is not open to international applicants; intake is retained only as official reference.";
  return programme.applicationDeadline
    ? normalizeLongText(`Application timing: ${programme.applicationDeadline}`)
    : "UiTM official source publishes the intake months captured in this reviewed audit.";
}

function displayCurriculumZh(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (programme.curriculum.length) return programme.curriculum;
  if (programme.curriculumNote) return [normalizeText(programme.curriculumNote, 260)];
  if (publicDisplayStatus === "not-available-for-international") return ["官网未公布具体课程结构；本专业按 UiTM 官方来源标注为国际学生未开放。"];
  if (programme.level === "doctoral") return ["官网未公布具体课程列表；官方 Prospectus 标注为研究型博士，结构以研究、导师指导和论文为主。"];
  return ["官网未公布具体课程结构；具体课程安排以 UiTM 官方专业页、Prospectus 或学院审核为准。"];
}

function displayCurriculumEn(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (!programme.curriculum.length) {
    const evidence = englishEvidenceList(programme, "curriculum");
    if (evidence.length) return evidence;
    if (publicDisplayStatus === "not-available-for-international") return ["Official source does not publish a specific curriculum list for this international-unavailable reference row."];
    if (programme.level === "doctoral") return ["Official prospectus marks this as PhD by Research or supervised research; the structure is research, supervision and thesis rather than taught courses."];
    return ["Official source does not publish a specific curriculum list for this programme."];
  }
  return englishListFromEvidence(programme, "curriculum", "curriculum");
}

function displayCareerZh(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (programme.careerProspects.length) return programme.careerProspects;
  if (publicDisplayStatus === "not-available-for-international") return ["官网未公布具体职业方向；本专业按 UiTM 官方来源标注为国际学生未开放。"];
  return ["官网未公布具体职业方向。"];
}

function displayCareerEn(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (!programme.careerProspects.length) {
    if (publicDisplayStatus === "not-available-for-international") return ["Official source does not publish specific career prospects for this international-unavailable reference row."];
    return ["Official source does not publish specific career prospects for this programme."];
  }
  return englishListFromEvidence(programme, "careerProspects", "career prospects");
}

function buildSpecializations(): LocalizedStringArray {
  return arr(
    ["Official source does not publish programme-specific specializations for this row."],
    ["Official source does not publish programme-specific specializations for this row."],
    ["官网未公布专业方向。"],
    ["官網未公布專業方向。"]
  );
}

function englishListFromEvidence(programme: UitmAuditProgramme, field: string, label: string) {
  const parts = englishEvidenceList(programme, field);
  return parts.length ? parts : [`See the official UiTM source for ${label} of ${programme.nameEn}.`];
}

function englishEvidenceList(programme: UitmAuditProgramme, field: string) {
  const evidence = englishFieldEvidence(programme, field);
  if (!evidence || /no programme-specific/i.test(evidence)) return [];
  if (field === "curriculum") {
    const courseItems = extractOfficialCourseItems(evidence);
    if (courseItems.length) return courseItems;
  }
  return evidence
    .split(/[;；。]\s*/)
    .map((item) => normalizeText(item, 500))
    .filter(Boolean);
}

function extractOfficialCourseItems(evidence: string) {
  const curriculumOnly = evidence.split(/\bFEES\b/i)[0] || evidence;
  const matches = curriculumOnly.match(/\b[A-Z]{2,}[A-Z0-9]*\d{3}\s+(?:-\s+)?[^,;.]+/g) || [];
  const items = matches
    .map((item) => normalizeText(item.replace(/^\d+\.\s*/, ""), 220))
    .filter(Boolean);
  return items.length >= 2 ? Array.from(new Set(items)) : [];
}

function buildProgrammeDescription(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus): LocalizedText {
  if (publicDisplayStatus === "not-available-for-international") {
    return t(
      `${programme.nameEn} is retained from UiTM official evidence as a programme reference only and is not available to international applicants.`,
      `${programme.nameEn} is retained from UiTM official evidence as a programme reference only and is not available to international applicants.`,
      `${stripOfficialEnglishFromChineseName(programme.name, programme.nameEn)}已按 UiTM 官方来源作为专业参考展示；该专业不开放国际学生申请。`,
      `${stripOfficialEnglishFromChineseName(programme.name, programme.nameEn)}已按 UiTM 官方來源作為專業參考展示；該專業不開放國際學生申請。`
    );
  }
  if (publicDisplayStatus === "official-language-requirement-not-published") {
    return t(
      `${programme.nameEn} is displayed from UiTM official evidence with a language-requirement exception because the official prospectus publishes different English routes by major and no single IELTS scalar is safe for the ready list.`,
      `${programme.nameEn} is displayed from UiTM official evidence with a language-requirement exception because the official prospectus publishes different English routes by major and no single IELTS scalar is safe for the ready list.`,
      `${programme.name} 已按 UiTM 官方来源展示，但官网按方向公布两套英语要求，列表不强行展示单一 IELTS；详情保留官方分流要求。`,
      `${programme.name} 已按 UiTM 官方來源展示，但官網按方向公布兩套英語要求，列表不強行展示單一 IELTS；詳情保留官方分流要求。`
    );
  }
  return t(
    `${programme.nameEn} is published from UiTM official ${programme.level} audit evidence, including programme, fee, intake and language sources.`,
    `${programme.nameEn} is published from UiTM official ${programme.level} audit evidence, including programme, fee, intake and language sources.`,
    `${programme.name} 已按 UiTM 官方${levelLabelZh(programme.level)}审计证据公开展示，来源覆盖专业、费用、入学月份和语言要求。`,
    `${programme.name} 已按 UiTM 官方${levelLabelZh(programme.level)}審計證據公開展示，來源覆蓋專業、費用、入學月份和語言要求。`
  );
}

function publicDisplayNote(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (publicDisplayStatus === "not-available-for-international") {
    return programme.level === "undergraduate"
      ? "UiTM 官方 FAQ 明确非马来西亚公民或永久居民不可申请本科；本专业仅作官方参考展示，不开放国际学生申请。"
      : "UiTM 官方专业来源显示该专业不开放国际学生申请；本专业仅作官方参考展示，不作为国际可申请项目。";
  }
  if (isLg950ConditionalLanguageProgramme(programme)) {
    return "已按 Ian 授权作为条件型语言要求上线：列表显示国际学生最低 IELTS 5.0，详情保留 English major IELTS 6.0 与其他语言方向 IELTS 5.0 的官方分流要求。";
  }
  if (publicDisplayStatus === "official-language-requirement-not-published") {
    return "官方 Prospectus 按研究方向公布两套语言要求，无法安全生成单一列表 IELTS；详情保留官方分流要求。";
  }
  return "已依据 UiTM 官方来源完成上线硬门槛校验：中文专业名、中文学院、列表 IELTS、准确国际学生学费和数字学制。";
}

function reviewReason(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (publicDisplayStatus === "not-available-for-international") {
    return programme.level === "undergraduate"
      ? "International undergraduate admission is not open according to the official UiTM admission FAQ."
      : "Official programme source indicates this programme is not open to international applicants.";
  }
  if (publicDisplayStatus === "official-language-requirement-not-published") {
    return "Official LG950 prospectus publishes split language requirements by major; StudyMY must not invent one IELTS scalar.";
  }
  return null;
}

function chinaStudentRequirement(programme: UitmAuditProgramme, publicDisplayStatus: PublicDisplayStatus) {
  if (programme.level === "undergraduate") return "UiTM 官方 FAQ 明确本科不开放国际学生申请；中国学生本科申请路径不适用。";
  if (publicDisplayStatus === "not-available-for-international") return "UiTM 官方专业来源显示该专业不开放国际申请；中国学生申请路径不适用。";
  return "UiTM 本次采集的官方来源未单独公布中国学生学历等效路径；按国际招生流程和该专业入学要求评估。";
}

function firstSourceUrl(programme: UitmAuditProgramme, fields: string[]) {
  for (const field of fields) {
    const value = asRecord(programme.fieldEvidence)[field];
    const sourceUrl = String(asRecord(value).sourceUrl || "");
    if (sourceUrl && allowedUitmSourceUrl(sourceUrl)) return sourceUrl;
  }
  return "";
}

function hasOfficialUnpublishedIntake(programme: UitmAuditProgramme) {
  const status = asRecord(programme.fieldStatus?.intake);
  if (String(status.status || "").includes("official-unpublished")) return true;
  return /no programme-level intake|not publish|未公布|not extractable/i.test(fieldEvidenceValue(programme, "intake"));
}

function mapPublicationStatus(programme: UitmAuditProgramme): PublicDisplayStatus {
  if (programme.level === "undergraduate") return "not-available-for-international";
  if (isLg950ConditionalLanguageProgramme(programme)) return "ready";
  if (programme.publicDisplayStatus === "not-available-for-international") return "not-available-for-international";
  if (programme.publicDisplayStatus === "official-language-requirement-not-published") return "official-language-requirement-not-published";
  return "ready";
}

function isLg950ConditionalLanguageProgramme(programme: Pick<UitmAuditProgramme, "code">) {
  return programme.code === "LG950";
}

function mapUitmLevel(level: UitmAuditLevel): UitmDegreeLevel {
  if (level === "undergraduate") return "bachelor";
  if (level === "doctoral") return "phd";
  return "master";
}

function expectedCountForAudit(level: UitmAuditLevel) {
  if (level === "undergraduate") return expectedByLevel.bachelor;
  if (level === "doctoral") return expectedByLevel.phd;
  return expectedByLevel.master;
}

function inferStudyMode(programme: UitmAuditProgramme) {
  const text = `${programme.nameEn} ${programme.studyMode || ""} ${programme.studyModeNote || ""}`.toLowerCase();
  if (/research|doctor of philosophy|philosophy/.test(text)) return "research";
  if (/coursework/.test(text)) return "coursework";
  if (/clinical|medicine|paediatric|internal medicine/.test(text)) return "clinical";
  return "full-time";
}

function inferCampus(programme: UitmAuditProgramme) {
  const text = `${programme.faculty} ${programme.nameEn}`.toLowerCase();
  if (/medicine|clinical|paediatric|internal medicine/.test(text)) return "UiTM Faculty of Medicine";
  if (/transport|mitrans/.test(text)) return "UiTM Malaysian Institute of Transport";
  if (/acis|islamic/.test(text)) return "UiTM ACIS";
  if (programme.level === "undergraduate") return "UiTM official campus";
  return "UiTM official postgraduate campus";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/medicine|medical|nursing|pharmacy|dentistry|dental|health|optometry|physiotherapy|radiography|laboratory|occupational therapy|paediatric|internal medicine/.test(value)) return "medicine";
  if (/law|legal/.test(value)) return "law";
  if (/accounting|business|management|finance|marketing|administrative|policy|tourism|hotel|economics|office|transport|logistics|corporate/.test(value)) return "business";
  if (/computer|computing|software|cyber|data|statistics|mathematics|information system|information science|library|analytics/.test(value)) return "it";
  if (/engineering|electrical|electronic|mechanical|chemical|civil|manufacturing|construction|surveying|architecture|built environment|quantity|infrastructure/.test(value)) return "engineering";
  if (/art|design|music|film|theatre|animation|creative|communication|media|language|education|islamic|sport/.test(value)) return "arts";
  return "science";
}

function intakeMonthNames(months: number[]) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (months || []).map((month) => names[month - 1]).filter(Boolean);
}

function sourceLinkTitle(url: string, programme?: UitmAuditProgramme) {
  if (url === officialWebsite) return "UiTM official website";
  if (url === programmeCatalogueUrl) return "UiTM undergraduate programme catalogue";
  if (url === eSyaratUrl) return "UiTM e-Syarat official page";
  if (url === syaratAmUrl) return "UiTM Syarat Am page";
  if (url === faqUrl) return "UiTM admission FAQ";
  if (url === heaProgrammeUrl) return "UiTM HEA programme implementer table";
  if (url === feePageUrl) return "UiTM Bendahari fee page";
  if (url === academicCalendarUrl) return "UiTM academic calendar";
  if (url === ipsisClusterUrl) return "UiTM IPSis programme by cluster";
  if (url === ipsisApplyUrl) return "UiTM IPSis admission page";
  if (url === internationalBrochureUrl) return "UiTM IPSis international brochure";
  if (programme && url === programme.officialSourceUrl) return "Official programme source";
  if (/Prospectus|BROCHURE|brochure|pdf/i.test(url)) return "Official UiTM PDF";
  if (/drive\.google\.com/.test(url)) return "Official-linked UiTM e-Syarat PDF";
  if (/afb\.my/.test(url)) return "Official-linked UiTM e-Syarat shortlink";
  return "Official UiTM source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/bendahari|fee|yuran|brochure_international|prospectus/.test(value)) return "fee";
  if (/pengambilan|syarat|faq|admission|calendar|apply-now/.test(value)) return "admission";
  if (/online\.uitm|hea\.uitm|afb\.my|drive\.google|programme|program|prospectus|cluster|faculty|fsg|medicine|acis|fsppp|kelantan|ppkapp|ipsis/.test(value)) return "study-portal";
  if (value === officialWebsite) return "profile";
  return "other";
}

function sourceLinkNote(url: string, publicDisplayStatus: PublicDisplayStatus) {
  if (/afb\.my|drive\.google\.com/.test(url)) {
    return "Official-linked exception retained because UiTM e-Syarat official page links to the shortlink/PDF evidence.";
  }
  if (url === faqUrl) return "Official UiTM admission FAQ confirms international undergraduate admission is not available.";
  if (publicDisplayStatus === "not-available-for-international") return "Official UiTM source used to display this row as not available for international applicants.";
  if (publicDisplayStatus === "official-language-requirement-not-published") return "Official UiTM source retained for a visible language-scalar exception row.";
  return "Official UiTM source used for the 2026-06-28 all-level public audit.";
}

function allowedUitmSourceUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "uitm.edu.my" ||
      host.endsWith(".uitm.edu.my") ||
      host === "afb.my" ||
      host === "drive.google.com";
  } catch {
    return false;
  }
}

function fieldEvidenceValue(programme: UitmAuditProgramme, field: string) {
  const value = asRecord(programme.fieldEvidence)[field];
  const record = asRecord(value);
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(asRecord(item).value || asRecord(item).evidenceText || asRecord(item).evidence || "", 500)).join("; ");
  }
  return normalizeText(record.evidenceText || record.evidence || record.value || record.valuesZh || "", 4000);
}

function englishFieldEvidence(programme: UitmAuditProgramme, field: string) {
  return englishOrEmpty(fieldEvidenceValue(programme, field));
}

function englishOrEmpty(value: unknown) {
  const text = normalizeLongText(value);
  return text && !hasChinese(text) ? text : "";
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

function buildCatalogStatusSummary(rows: Array<DeepPartial<ProgramEntity>>) {
  const makeLevel = (level: UitmDegreeLevel) => {
    const levelRows = rows.filter((row) => row.level === level);
    return {
      total: levelRows.length,
      ready: levelRows.filter((row) => row.publicDisplayStatus === "ready").length,
      needsReview: levelRows.filter((row) => row.publicDisplayStatus === "needs-review").length,
      currentCycleNotOpen: levelRows.filter((row) => row.publicDisplayStatus === "current-cycle-not-open").length,
      notAvailableForInternational: levelRows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length,
      officialLanguageRequirementNotPublished: levelRows.filter((row) => row.publicDisplayStatus === "official-language-requirement-not-published").length
    };
  };
  const all = {
    total: rows.length,
    ready: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReview: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    currentCycleNotOpen: rows.filter((row) => row.publicDisplayStatus === "current-cycle-not-open").length,
    notAvailableForInternational: rows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length,
    officialLanguageRequirementNotPublished: rows.filter((row) => row.publicDisplayStatus === "official-language-requirement-not-published").length
  };
  return {
    all,
    byLevel: {
      bachelor: makeLevel("bachelor"),
      master: makeLevel("master"),
      "postgraduate-certificate": { total: 0, ready: 0, needsReview: 0, currentCycleNotOpen: 0, notAvailableForInternational: 0, officialLanguageRequirementNotPublished: 0 },
      "postgraduate-diploma": { total: 0, ready: 0, needsReview: 0, currentCycleNotOpen: 0, notAvailableForInternational: 0, officialLanguageRequirementNotPublished: 0 },
      phd: makeLevel("phd")
    }
  };
}

function isAuditInputSet(value: UitmAuditInputSet | UitmReviewedAudit): value is UitmAuditInputSet {
  return Boolean((value as UitmAuditInputSet).undergraduate && (value as UitmAuditInputSet).master && (value as UitmAuditInputSet).doctoral);
}

function toAuditInputSet(value: UitmAuditInputSet | UitmReviewedAudit): UitmAuditInputSet {
  if (isAuditInputSet(value)) return value;
  const empty: UitmReviewedAudit = {
    safe_to_import: false,
    auditMeta: { targetUniversityShortName: "UiTM", targetLevel: "master", totalProgrammesBaseline: 0, totalProgrammesCollected: 0 },
    programmes: [],
    pending_issues: [],
    exception_queue: [],
    validationMeta: { overallDecision: "PASS-WITH-EXCEPTIONS", counts: { totalProgrammesValidated: 0, issuesPending: 0 } }
  };
  if (value.auditMeta?.targetLevel === "doctoral") return { undergraduate: empty, master: empty, doctoral: value };
  if (value.auditMeta?.targetLevel === "master") return { undergraduate: empty, master: value, doctoral: empty };
  return { undergraduate: value, master: empty, doctoral: empty };
}

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function localizedArrayHasChinese(value?: LocalizedStringArray) {
  return Boolean(value?.["zh-CN"]?.length && value["zh-CN"].every(hasChinese));
}

function localizedArrayHasNoChinese(value?: LocalizedStringArray, locale: keyof LocalizedStringArray = "en") {
  return Boolean(value?.[locale]?.length && value[locale].every((item) => !hasChinese(item)));
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });
}

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function stripOfficialEnglishFromChineseName(name: string, nameEn: string) {
  return normalizeText(name.replace(`（${nameEn}）`, "").replace(`(${nameEn})`, ""), 255) || name;
}

function levelLabelZh(level: UitmAuditLevel) {
  if (level === "undergraduate") return "本科";
  if (level === "doctoral") return "博士";
  return "硕士";
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
  await runUitmPublication({
    undergraduatePath: resolve(readArgValue("--undergraduate-audit") || DEFAULT_UITM_UNDERGRADUATE_AUDIT_PATH),
    masterPath: resolve(readArgValue("--master-audit") || DEFAULT_UITM_MASTER_AUDIT_PATH),
    doctoralPath: resolve(readArgValue("--doctoral-audit") || DEFAULT_UITM_DOCTORAL_AUDIT_PATH),
    planOutput: resolve(readArgValue("--plan-output") || DEFAULT_UITM_PUBLISH_PLAN_PATH),
    postImportAuditOutput: resolve(readArgValue("--post-import-audit-output") || DEFAULT_UITM_POST_IMPORT_AUDIT_PATH),
    releaseReportOutput: resolve(readArgValue("--release-report-output") || DEFAULT_UITM_RELEASE_REPORT_PATH),
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
