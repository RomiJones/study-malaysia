import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, Like, type DeepPartial, type EntityManager } from "typeorm";
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
export const TSU_OFFICIAL_AUDIT_SLUG_PREFIX = "tsu-official-2026-row-";
export const DEFAULT_TSU_OFFICIAL_AUDIT_BATCH_DIR = resolve(
  repositoryRoot,
  "data/imports/tsu/2026-06-20/tsu-20260620"
);
export const DEFAULT_TSU_OFFICIAL_AUDIT_CANDIDATE_PATH = resolve(
  DEFAULT_TSU_OFFICIAL_AUDIT_BATCH_DIR,
  "08_candidate_dataset.json"
);

const verifiedAt = "2026-06-20";
const usdToCnyReviewEstimate = 7.2;
const taylorSlug = "taylors-university";
const taylorExistingPublicSlug = "taylor-s-university";
const taylorExistingPublicCode = "TAYLORS";
const taylorOfficialWebsite = "https://university.taylors.edu.my/en.html";
const taylorStudyPortalUrl = "https://university.taylors.edu.my/en/study/explore-all-programmes.html";
const taylorApplicationPortalUrl = "https://topas.taylors.edu.my/";
const undergraduateAdmissionUrl = "https://university.taylors.edu.my/en/study/how-to-apply/undergraduate-admission.html";
const postgraduateAdmissionUrl = "https://university.taylors.edu.my/en/study/how-to-apply/postgraduate-admission.html";

type TSULevel = Extract<DegreeLevel, "bachelor" | "master" | "phd">;

interface TSUTestScore {
  score?: number;
  display?: string;
  sourceText?: string;
}

interface TSULanguageRequirement {
  status?: string;
  officialText?: string;
  internationalText?: string;
  tests?: Record<string, TSUTestScore>;
  otherRoutes?: unknown[];
  ieltsOnlySummary?: string;
  ieltsOnlySummaryStatus?: string;
  listSummary?: string;
  sourceUrl?: string;
}

interface TSUApplicationDocuments {
  status?: string;
  route?: string;
  items?: string[];
  sourceUrl?: string;
  applicationPortalUrl?: string;
  programmeSpecificSupplementSourceUrl?: string;
}

interface TSUAcademicPerformance {
  status?: string;
  summary?: string;
  thresholds?: Array<{ type?: string; display?: string; value?: number }>;
  degreeBasis?: string[];
  sourceUrl?: string;
  sourceText?: string;
}

interface TSUFee {
  tuitionAmount?: number | null;
  tuitionCurrency?: "USD" | TuitionCurrency | null;
  tuitionBasis?: string;
  tuitionAcademicSession?: string;
  tuitionDisplay?: string;
  status?: string;
  officialFeeSourceUrl?: string;
  officialSourceUrl?: string;
  note?: string;
}

interface TSUCandidateProgramme {
  code: string;
  nameEnOfficial: string;
  name?: LocalizedText;
  level: TSULevel;
  universityCode: "TSU";
  facultyEn: string;
  faculty?: LocalizedText;
  campus?: string;
  studyMode?: string;
  studyType?: string;
  studyArrangement?: string[] | string;
  applicantScope: "international";
  academicSession: string;
  durationOfficial: string;
  durationYears?: number;
  officialIntake?: string;
  intake?: { officialText?: string; months?: string[] } | string[];
  tuitionAmount?: number | null;
  tuitionCurrency?: "USD" | TuitionCurrency | null;
  tuitionBasis?: string;
  tuitionAcademicSession?: string;
  tuitionDisplay?: string;
  localFeeMYR?: { amount?: number | null; display?: string };
  fee?: TSUFee;
  feeStatus?: string;
  officialFeeSourceUrl?: string;
  officialAcademicRequirement?: string;
  officialLanguageRequirement?: string;
  language?: TSULanguageRequirement;
  languageRequirementStructured?: TSULanguageRequirement;
  ieltsOnlySummaryStatus?: string;
  academicPerformanceRequirement?: TSUAcademicPerformance;
  gpaOrAcademicPerformanceRequirement?: TSUAcademicPerformance;
  applicationDocuments?: TSUApplicationDocuments;
  specialRequirements?: Record<string, { status?: string; sourceText?: string[] }>;
  description?: LocalizedText;
  curriculum?: LocalizedText;
  careers?: LocalizedText;
  sourceUrl?: string;
  sourceUrls?: string[];
  officialSourceUrl: string;
  officialVerifiedAt?: string;
  officialSourceStatus?: string;
  publicDisplayStatus: "needs-review";
  sourceDataStatus?: string;
  commercialDisplayStatus?: string;
  reviewReason?: string;
  evidence?: unknown[];
  fieldEvidence?: unknown[];
}

interface TSUOfficialSource {
  id: string;
  url: string;
  finalUrl?: string;
  sourceType?: string;
  role?: string;
  fields?: string[];
  retrievedAt?: string;
  academicSession?: string;
  status?: string;
  localPath?: string;
  sha256?: string;
}

export interface TSUCandidateDataset {
  schemaVersion: number;
  universityCode: "TSU";
  officialDomains: string[];
  collectionScope: "full";
  levels: TSULevel[];
  applicantScope: "international";
  academicSession: string;
  retrievedAt: string;
  declaredProgrammeCount: number;
  university: {
    code: "TSU";
    nameEnOfficial: string;
    officialWebsite: string;
    officialAddress: string;
    applicationPortalUrl: string;
    internationalPageUrl: string;
    officialSourceStatus: string;
    officialVerifiedAt: string;
  };
  sources?: TSUOfficialSource[];
  programmes: TSUCandidateProgramme[];
}

export interface TSUImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<TSULevel, number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialTotalRows: number;
  ieltsOfficialValueRows: number;
  noIeltsScalarRows: number;
  localizedNameRows: number;
  localizedFacultyRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

export interface TSUImportVerification extends TSUImportSummary {
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

const zeroLevelCounts = (): Record<TSULevel, number> => ({ bachelor: 0, master: 0, phd: 0 });

const facultyLocalization: Record<string, { zhCN: string; zhTW: string }> = {
  "School of Architecture, Building and Design": { zhCN: "建筑、建成环境与设计学院", zhTW: "建築、建成環境與設計學院" },
  "School of Biosciences": { zhCN: "生物科学学院", zhTW: "生物科學學院" },
  "Taylor's Business School": { zhCN: "泰莱商学院", zhTW: "泰萊商學院" },
  "Taylor's Culinary Institute": { zhCN: "泰莱烹饪学院", zhTW: "泰萊烹飪學院" },
  "School of Media and Communication": { zhCN: "媒体与传播学院", zhTW: "媒體與傳播學院" },
  "School of Computer Science": { zhCN: "计算机科学学院", zhTW: "電腦科學學院" },
  "The Design School at Taylor's": { zhCN: "泰莱设计学院", zhTW: "泰萊設計學院" },
  "School of Education": { zhCN: "教育学院", zhTW: "教育學院" },
  "School of Engineering": { zhCN: "工程学院", zhTW: "工程學院" },
  "School of Hospitality, Tourism and Events": { zhCN: "酒店、旅游与活动学院", zhTW: "酒店、旅遊與活動學院" },
  "School of Law and Governance": { zhCN: "法律与治理学院", zhTW: "法律與治理學院" },
  "School of Liberal Arts and Sciences": { zhCN: "文理学院", zhTW: "文理學院" },
  "School of Pharmacy": { zhCN: "药学院", zhTW: "藥學院" },
  "School of Medicine": { zhCN: "医学院", zhTW: "醫學院" }
};

const exactProgramNameZh: Record<string, string> = {
  "Bachelor of Quantity Surveying (Honours)": "工料测量荣誉学士",
  "Bachelor of Business (Honours)": "商业荣誉学士",
  "Bachelor of Accounting (Finance) (Honours)": "会计与金融荣誉学士",
  "Bachelor of Banking and Finance (Honours)": "银行与金融荣誉学士",
  "Bachelor of Finance and Economics (Honours)": "金融与经济荣誉学士",
  "Bachelor of Actuarial Studies (Honours)": "精算学荣誉学士",
  "Bachelor of Entrepreneurship (Honours) in Team Entrepreneurship": "团队创业荣誉学士",
  "Bachelor of Accounting With Fintech (Honours)": "会计与金融科技荣誉学士",
  "Bachelor of Patisserie Arts (Honours)": "西点艺术荣誉学士",
  "Bachelor of Culinary Management (Honours)": "烹饪管理荣誉学士",
  "Bachelor of Mass Communication (Honours)": "大众传播荣誉学士",
  "Bachelor of Interactive Spatial Design (Honours)": "互动空间设计荣誉学士",
  "Bachelor of Fashion Design Technology (Honours)": "时装设计技术荣誉学士",
  "Bachelor of Design (Honours) In Creative Media": "创意媒体设计荣誉学士",
  "Bachelor of Education (Honours)": "教育荣誉学士",
  "Bachelor of Mechatronics Engineering with Honours": "机电工程荣誉学士",
  "Bachelor of International Hospitality Management (Honours)": "国际酒店管理荣誉学士",
  "Bachelor of International Events Management (Honours)": "国际活动管理荣誉学士",
  "Bachelor of International Tourism Management (Honours)": "国际旅游管理荣誉学士",
  "Bachelor of Laws (Honours)": "法律荣誉学士",
  "Bachelor in Philosophy, Politics, and Economics (Honours)": "哲学、政治与经济荣誉学士",
  "Bachelor of Performing Arts (Honours)": "表演艺术荣誉学士",
  "Bachelor of Psychology (Honours)": "心理学荣誉学士",
  "Bachelor of Pharmacy with Honours": "药学荣誉学士",
  "Bachelor of Pharmaceutical Science (Honours)": "药剂科学荣誉学士",
  "Bachelor of Medicine, Bachelor of Surgery (MBBS)": "医学士与外科学士（MBBS）",
  "Master of Business Administration": "工商管理硕士",
  "Master of Management": "管理学硕士",
  "Master of Business Administration (100% Online)": "工商管理硕士（100% 在线）",
  "Master of Management (100% Online)": "管理学硕士（100% 在线）",
  "Doctor of Business Administration Programme (DBA)": "工商管理博士（DBA）",
  "Doctor of Philosophy In Design Management": "设计管理哲学博士",
  "Doctor of Philosophy In Food Studies": "食品研究哲学博士",
  "Doctor of Philosophy In Hospitality & Tourism": "酒店与旅游哲学博士"
};

const subjectZh: Record<string, string> = {
  Architecture: "建筑学",
  "Interior Architecture": "室内建筑",
  "Sustainable Digital Construction Management": "可持续数字建造管理",
  "Virtual Design and Construction": "虚拟设计与建造",
  Science: "科学",
  "Biomedical Science": "生物医学科学",
  "Food Science": "食品科学",
  Biotechnology: "生物技术",
  "Applied Health Sciences": "应用健康科学",
  "International Business and Marketing": "国际商务与市场营销",
  Culinology: "厨艺科学",
  "Food Studies and Gastronomy": "食品研究与美食学",
  "Food Studies": "食品研究",
  "Advertising and Brand Management": "广告与品牌管理",
  "Digital Media Production": "数字媒体制作",
  "Public Relations and Event Management": "公共关系与活动管理",
  "Public Relations and Marketing": "公共关系与市场营销",
  Communication: "传播学",
  "Media and Communication Studies": "媒体与传播研究",
  "Computer Science": "计算机科学",
  "Software Engineering": "软件工程",
  "Information Technology": "信息技术",
  "Applied Computing": "应用计算",
  Design: "设计",
  "Teaching and Learning": "教学与学习",
  Education: "教育学",
  "Chemical Engineering": "化学工程",
  "Electrical and Electronic Engineering": "电气与电子工程",
  "Mechanical Engineering": "机械工程",
  Engineering: "工程学",
  "Global Hospitality Management": "全球酒店管理",
  "International Hospitality Management": "国际酒店管理",
  Tourism: "旅游学",
  Law: "法学",
  "Healthcare and Medical Law": "医疗健康法",
  Counselling: "辅导学",
  "Clinical Psychology": "临床心理学",
  "Social Sciences": "社会科学",
  "Pharmaceutical Sciences": "药剂科学",
  Pharmacy: "药学",
  "Medical Science": "医学科学"
};

const docZh: Record<string, string> = {
  photographs: "证件照片",
  "identity document": "身份证明文件",
  "academic transcripts": "成绩单",
  "completion certificates": "毕业或完成证明",
  "official English translation if academic documents are not in English": "非英文材料的官方英文翻译件",
  "certified Bachelor and/or Master degree certificates and transcripts": "经认证的本科和/或硕士学位证书与成绩单",
  "passport copies, including blank pages, with at least 15 months validity": "护照复印件（含空白页），有效期至少 15 个月",
  "passport-sized photographs": "护照规格照片",
  "research proposal": "研究计划书",
  "curriculum vitae or resume": "个人简历",
  "two academic referee reports": "两封学术推荐人报告",
  "addendum if applicable": "适用时提交补充说明",
  "scholarship or sponsorship letter if applicable": "适用时提交奖学金或资助证明",
  "evidence of English competency when previous degree was not completed in English": "前序学历非英文授课时的英语能力证明",
  "pre-arrival health examination report after acceptance for visa processing": "录取后用于签证流程的抵达前体检报告",
  "design portfolio or practical experience portfolio when the programme-specific requirement publishes it": "专业要求公布时提交设计作品集或实践经验证明",
  "research proposal or statement of research intent when the programme route requires it": "研究型路径要求时提交研究计划或研究意向说明",
  "published works, executive summary, and scholarly publication list for prior-publication doctoral route": "以既有发表成果申请博士路径时提交发表作品、执行摘要和学术发表清单",
  "work experience evidence such as company reference letter when the route requires it": "路径要求时提交工作经验证明，例如公司推荐信"
};

const simpleTraditionalMap: Record<string, string> = {
  学: "學",
  术: "術",
  与: "與",
  业: "業",
  专: "專",
  药: "藥",
  医: "醫",
  经: "經",
  济: "濟",
  传: "傳",
  播: "播",
  计: "計",
  算: "算",
  机: "機",
  设: "設",
  筑: "築",
  环: "環",
  境: "境",
  程: "程",
  管: "管",
  理: "理",
  国: "國",
  际: "際",
  线: "線",
  证: "證",
  书: "書",
  页: "頁",
  览: "覽",
  审: "審",
  核: "核",
  开: "開",
  发: "發",
  数: "數",
  据: "據",
  体: "體",
  历: "歷",
  对: "對",
  应: "應",
  后: "後",
  复: "覆",
  硕: "碩",
  博: "博",
  荣: "榮",
  誉: "譽",
  马: "馬",
  来: "來",
  亚: "亞",
  湾: "灣",
  游: "遊",
  艺: "藝",
  创: "創",
  临: "臨",
  床: "床",
  剂: "劑",
  科: "科",
  馆: "館",
  餐: "餐",
  饮: "飲"
};

export function validateTsuOfficialAuditDataset(dataset: TSUCandidateDataset): string[] {
  const errors: string[] = [];
  if (dataset.universityCode !== "TSU") errors.push("Dataset universityCode must be TSU.");
  if (dataset.university?.code !== "TSU") errors.push("University code must be TSU.");
  if (dataset.collectionScope !== "full") errors.push("TSU import expects full collection scope.");
  if (dataset.applicantScope !== "international") errors.push("TSU import expects international applicant scope.");
  if (dataset.academicSession !== "2026") errors.push(`TSU academicSession must be 2026; got ${dataset.academicSession}.`);
  if (!dataset.officialDomains?.includes("taylors.edu.my")) errors.push("Official domain taylors.edu.my is required.");
  if (dataset.programmes.length !== 89) errors.push(`Candidate programme count must be 89; got ${dataset.programmes.length}.`);

  const levelCounts = countBy(dataset.programmes, (row) => row.level);
  if (levelCounts.bachelor !== 46) errors.push(`Expected 46 bachelor rows; got ${levelCounts.bachelor || 0}.`);
  if (levelCounts.master !== 28) errors.push(`Expected 28 master rows; got ${levelCounts.master || 0}.`);
  if (levelCounts.phd !== 15) errors.push(`Expected 15 phd rows; got ${levelCounts.phd || 0}.`);

  const seenCodes = new Set<string>();
  dataset.programmes.forEach((row, index) => {
    const ordinal = index + 1;
    if (row.universityCode !== "TSU") errors.push(`Row ${ordinal} universityCode is not TSU.`);
    if (row.applicantScope !== "international") errors.push(`Row ${ordinal} applicant scope is not international.`);
    if (row.publicDisplayStatus !== "needs-review") errors.push(`Row ${ordinal} must remain needs-review.`);
    if (row.sourceDataStatus !== "verified-official") errors.push(`Row ${ordinal} sourceDataStatus must be verified-official.`);
    if (!row.code) errors.push(`Row ${ordinal} has no original candidate code.`);
    if (seenCodes.has(row.code)) errors.push(`Duplicate candidate code ${row.code}.`);
    seenCodes.add(row.code);
    if (!row.nameEnOfficial) errors.push(`Row ${ordinal} has no official English name.`);
    if (!row.facultyEn) errors.push(`Row ${ordinal} has no faculty.`);
    if (!row.officialSourceUrl?.includes("taylors.edu.my")) errors.push(`Row ${ordinal} has no Taylor's official source URL.`);
    if (!officialFeeSourceUrl(row).includes("taylors.edu.my")) errors.push(`Row ${ordinal} has no Taylor's official fee source URL.`);
    if (row.feeStatus !== "verified-official-total" && row.fee?.status !== "verified-official-total") {
      errors.push(`Row ${ordinal} fee status must be verified-official-total.`);
    }
    if (!Number.isFinite(Number(row.tuitionAmount ?? row.fee?.tuitionAmount)) || Number(row.tuitionAmount ?? row.fee?.tuitionAmount) <= 0) {
      errors.push(`Row ${ordinal} has no positive official USD tuition amount.`);
    }
  });

  return errors;
}

export function buildTsuOfficialAuditRows(dataset: TSUCandidateDataset): Array<DeepPartial<ProgramEntity>> {
  return dataset.programmes.map((candidate, index) => {
    const ordinal = index + 1;
    const fee = feePresentation(candidate);
    const name = localizedProgramName(candidate.nameEnOfficial);
    const faculty = localizedFaculty(candidate.facultyEn);
    const language = parseLanguageRequirement(candidate);
    const academicSummary = academicPerformanceSummary(candidate);
    const officialLanguage = normalizeLongText(candidate.officialLanguageRequirement || candidate.language?.officialText || candidate.languageRequirementStructured?.officialText || "");
    const officialAcademic = normalizeLongText(candidate.officialAcademicRequirement || candidate.academicPerformanceRequirement?.sourceText || "");
    const sourceStatus: OfficialSourceStatus = "official-verified";
    const publicDisplayStatus: PublicDisplayStatus = "needs-review";

    return {
      slug: `${TSU_OFFICIAL_AUDIT_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: tsuShortCode(candidate.level, ordinal),
      name,
      nameEnOfficial: candidate.nameEnOfficial,
      level: candidate.level,
      category: inferCategory(candidate.nameEnOfficial, candidate.facultyEn),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: studyModeDisplay(candidate),
      campus: candidate.campus || "Taylor's University Lakeside Campus, Subang Jaya, Selangor, Malaysia",
      durationYears: durationYears(candidate),
      durationOfficial: normalizeText(candidate.durationOfficial || `${durationYears(candidate)} years`, 500),
      annualTuitionCny: annualTuitionCny(candidate, fee),
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: candidate.localFeeMYR?.amount ?? null,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: intakeMonths(candidate),
      officialIntake: normalizeText(candidate.officialIntake || intakeOfficialText(candidate), 255),
      officialIntakeNote: "Taylor's official intake months captured in the TSU 2026 official audit batch; imported for backend/admin review only.",
      languageRequirement: language,
      officialLanguageRequirement: officialLanguage,
      requirement: {
        gpa: primaryGpaRequirement(candidate),
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          academicSummary.en,
          academicSummary.en,
          academicSummary.zhCN,
          academicSummary.zhTW
        )
      },
      officialAcademicRequirement: officialAcademic,
      chinaStudentRequirement: "China-specific admission route was not separately published in the TSU official evidence; keep for Ian review before any public display.",
      specialRequirementsNote: specialRequirementSummary(candidate),
      applicationDocs: localizedApplicationDocs(candidate),
      curriculum: localizedCurriculum(candidate),
      careers: localizedCareers(candidate),
      specializations: localizedSpecializations(candidate),
      description: localizedDescription(candidate, name, faculty),
      officialAccreditationNote: "No programme-level accreditation claim is published from this review-only import unless the candidate evidence carries a dedicated official accreditation source.",
      officialSourceUrl: candidate.officialSourceUrl,
      officialEntryRequirementSourceUrl: entryRequirementSourceUrl(candidate),
      officialAccreditationSourceUrl: candidate.officialSourceUrl,
      sourceUrls: sourceLinks(candidate, fee),
      officialVerifiedAt: dateOnly(candidate.officialVerifiedAt) || verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: "Review-only database import. Hidden from the public student catalogue until Ian approves the ready conversion and public release gates pass.",
      reviewReason: reviewReasonText(candidate),
      auditNote: [
        `Original TSU candidate code: ${candidate.code}.`,
        `Official source data status: ${candidate.sourceDataStatus}; candidate officialSourceStatus: ${candidate.officialSourceStatus}.`,
        `Fee candidate status: ${candidate.feeStatus || candidate.fee?.status}; fee basis: ${candidate.tuitionBasis || candidate.fee?.tuitionBasis}.`,
        `IELTS scalar status: ${candidate.language?.ieltsOnlySummaryStatus || candidate.ieltsOnlySummaryStatus || "not-recorded"}.`,
        `Field evidence count: ${(candidate.fieldEvidence || candidate.evidence || []).length}.`,
        "Review-only policy: imported rows are non-public and must not appear in public APIs, lists, programme details, aggregates, or recommendations."
      ].join(" "),
      listTuitionText: fee.display,
      isPublished: false
    };
  });
}

export function summarizeTsuOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): TSUImportSummary {
  return {
    candidateRows: rows.length,
    importRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length,
      master: rows.filter((row) => row.level === "master").length,
      phd: rows.filter((row) => row.level === "phd").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialTotalRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    ieltsOfficialValueRows: rows.filter((row) => Number(row.languageRequirement?.ielts || 0) > 0).length,
    noIeltsScalarRows: rows.filter((row) => Number(row.languageRequirement?.ielts || 0) === 0).length,
    localizedNameRows: rows.filter((row) => row.name?.["zh-CN"] && row.name["zh-CN"] !== row.name?.en).length,
    localizedFacultyRows: rows.filter((row) => row.faculty?.["zh-CN"] && row.faculty["zh-CN"] !== row.faculty?.en).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildTsuUniversityRow(
  dataset: TSUCandidateDataset,
  summary: TSUImportSummary,
  existing?: UniversityEntity | null
): DeepPartial<UniversityEntity> {
  const existingPublicReady = Boolean(existing?.isPublished && existing.publicDisplayStatus === "ready");
  const annualValues = dataset.programmes.map((candidate) => annualTuitionCny(candidate, feePresentation(candidate))).filter((value) => value > 0);
  const officialSources = sourceRegistryLinks(dataset.sources || []);
  const reviewProfile = {
    collectionScope: "TSU official bachelor, master and doctoral review import",
    applicantScope: dataset.applicantScope,
    academicSession: dataset.academicSession,
    retrievedAt: dataset.retrievedAt,
    officialDomains: dataset.officialDomains,
    sourceUniversityCode: dataset.universityCode,
    authorization: "review-import",
    importNamespace: TSU_OFFICIAL_AUDIT_SLUG_PREFIX,
    workflowAcceptance: {
      declaredOfficialRows: dataset.declaredProgrammeCount,
      candidateProgrammes: 89,
      importedReviewRows: 89,
      publicReadyRows: 0,
      officialTotalFeeRows: summary.officialTotalRows,
      ieltsOfficialValueRows: summary.ieltsOfficialValueRows,
      officialEquivalentLanguageRowsWithoutIeltsScalar: summary.noIeltsScalarRows,
      publicLeakageExpected: 0
    },
    catalogStatusSummary: {
      all: { total: summary.importRows, ready: 0, needsReview: summary.needsReviewRows, notAvailableForInternational: 0 },
      byLevel: {
        bachelor: { total: summary.byLevel.bachelor, ready: 0, needsReview: summary.byLevel.bachelor, notAvailableForInternational: 0 },
        master: { total: summary.byLevel.master, ready: 0, needsReview: summary.byLevel.master, notAvailableForInternational: 0 },
        phd: { total: summary.byLevel.phd, ready: 0, needsReview: summary.byLevel.phd, notAvailableForInternational: 0 }
      }
    },
    reviewOnlyControls: {
      importedRowsPublicDisplayStatus: "needs-review",
      importedRowsIsPublished: false,
      preserveExistingPublicInstitutionPage: existingPublicReady,
      publicLeakageExpected: 0
    }
  };

  if (existing?.isPublished && existing.publicDisplayStatus === "ready") {
    const current = existing;
    return {
      ...current,
      id: current.id,
      officialProfile: { ...(asRecord(current.officialProfile)), tsuReviewImport: reviewProfile },
      officialSources: mergeOfficialSources(current.officialSources || [], officialSources),
      officialVerifiedAt: verifiedAt,
      officialAuditSummary: [
        current.officialAuditSummary || "",
        "TSU review-only import prepared 89 official-source bachelor/master/phd records as non-public needs-review rows; existing public university visibility is preserved."
      ].filter(Boolean).join(" "),
      programCount: Math.max(current.programCount || 0, summary.importRows),
      isPublished: true,
      publicDisplayStatus: "ready"
    };
  }

  return {
    slug: existing?.slug || taylorSlug,
    code: existing?.code || "TSU",
    name: t("Taylor's University", "Taylor's University", "泰莱大学", "泰萊大學"),
    shortName: existing?.shortName || "TSU",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#A61D33",
    qsRank: existing?.qsRank || 9999,
    qsAsiaRank: existing?.qsAsiaRank ?? null,
    location: t("Subang Jaya, Selangor, Malaysia", "Subang Jaya, Selangor, Malaysia", "马来西亚雪兰莪州梳邦再也", "馬來西亞雪蘭莪州梳邦再也"),
    region: t("Selangor", "Selangor", "雪兰莪州", "雪蘭莪州"),
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 1969,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: t(
      "Taylor's University is imported as a StudyMY official review candidate. Public display is disabled until the imported TSU audit records pass the ready gate.",
      "Taylor's University is imported as a StudyMY official review candidate. Public display is disabled until the imported TSU audit records pass the ready gate.",
      "泰莱大学已作为 StudyMY 官方审核候选入库；审核通过前不会进入公开学生目录。",
      "泰萊大學已作為 StudyMY 官方審核候選入庫；審核通過前不會進入公開學生目錄。"
    ),
    website: dataset.university.officialWebsite || taylorOfficialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: dataset.university.nameEnOfficial,
    officialWebsite: dataset.university.officialWebsite || taylorOfficialWebsite,
    studyPortalUrl: taylorStudyPortalUrl,
    internationalPageUrl: dataset.university.internationalPageUrl || undergraduateAdmissionUrl,
    applicationPortalUrl: dataset.university.applicationPortalUrl || taylorApplicationPortalUrl,
    officialAddress: dataset.university.officialAddress,
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: existing?.applicationDocuments || arr([]),
    chinaStudentRequirements: existing?.chinaStudentRequirements || arr([]),
    officialProfile: { ...(asRecord(existing?.officialProfile)), tsuReviewImport: reviewProfile },
    officialSources,
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified",
    officialAuditSummary: "TSU review-only import: 89 official-source bachelor/master/phd candidates imported as non-public needs-review rows with official 2026 USD total fees and official requirement evidence.",
    publicDisplayStatus: "needs-review",
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualValues.length ? Math.min(...annualValues) : 0,
    tuitionMaxCny: annualValues.length ? Math.max(...annualValues) : 0,
    livingCostCny: existing?.livingCostCny || 0,
    minIelts: 0,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr([]),
    highlights: arr(["Official review import only"], ["Official review import only"], ["仅限后台审核"], ["僅限後台審核"]),
    programCount: summary.importRows,
    isPublished: false
  };
}

function verifyTsuImportedRecordSet(university: UniversityEntity, rows: ProgramEntity[], allUniversityRows: ProgramEntity[]): TSUImportVerification {
  const summary = summarizeTsuOfficialAuditImport(rows);
  const importedPublicLeakageRows = rows.filter((row) => row.isPublished || row.publicDisplayStatus === "ready").length;
  const importedAdminNeedsReviewRows = rows.filter((row) => row.publicDisplayStatus === "needs-review" && row.isPublished === false).length;
  const legacyPublicRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(TSU_OFFICIAL_AUDIT_SLUG_PREFIX) && row.isPublished && ["ready", "current-cycle-not-open", "not-available-for-international"].includes(row.publicDisplayStatus)
  ).length;
  const staleReviewRows = allUniversityRows.filter(
    (row) =>
      !row.slug.startsWith(TSU_OFFICIAL_AUDIT_SLUG_PREFIX) &&
      ["bachelor", "master", "phd"].includes(row.level) &&
      !(row.isPublished && ["ready", "current-cycle-not-open", "not-available-for-international"].includes(row.publicDisplayStatus)) &&
      row.publicDisplayStatus !== "archived"
  ).length;

  if (
    rows.length !== 89 ||
    summary.byLevel.bachelor !== 46 ||
    summary.byLevel.master !== 28 ||
    summary.byLevel.phd !== 15 ||
    summary.readyRows !== 0 ||
    summary.needsReviewRows !== 89 ||
    summary.publishedRows !== 0 ||
    summary.officialTotalRows !== 89 ||
    summary.ieltsOfficialValueRows !== 77 ||
    summary.noIeltsScalarRows !== 12 ||
    summary.localizedNameRows !== 89 ||
    summary.localizedFacultyRows !== 89 ||
    importedPublicLeakageRows !== 0 ||
    importedAdminNeedsReviewRows !== 89 ||
    staleReviewRows !== 0
  ) {
    throw new Error(`TSU import verification failed: ${JSON.stringify({ summary, importedPublicLeakageRows, importedAdminNeedsReviewRows, legacyPublicRows, staleReviewRows, universityStatus: university.publicDisplayStatus, universityPublished: university.isPublished })}`);
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

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number): Promise<TSUImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("TSU university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${TSU_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
  });
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifyTsuImportedRecordSet(university, rows, allUniversityRows);
}

function feePresentation(candidate: TSUCandidateProgramme): {
  amount: number;
  currency: TuitionCurrency;
  display: string;
  sourceUrl: string;
  auditStatus: FeeAuditStatus;
  note: string;
} {
  const amount = Number(candidate.tuitionAmount ?? candidate.fee?.tuitionAmount);
  const display = candidate.tuitionDisplay || candidate.fee?.tuitionDisplay || `USD ${amount.toLocaleString("en-US")}`;
  const sourceUrl = officialFeeSourceUrl(candidate);
  const localFee = candidate.localFeeMYR?.display ? ` Local-student MYR fee captured separately as ${candidate.localFeeMYR.display}; it is not used as the international total.` : "";
  return {
    amount,
    currency: "USD",
    display: /total/i.test(display) ? display : `${display} total programme`,
    sourceUrl,
    auditStatus: "matched-official",
    note: `${candidate.fee?.note || "Taylor's 2026 official international USD total fee captured from the official fee schedule."}${localFee} CNY annual value is a review-only sorting estimate and must not be presented as an official converted tuition amount.`
  };
}

function sourceLinks(candidate: TSUCandidateProgramme, fee: ReturnType<typeof feePresentation>): OfficialSourceLink[] {
  const documentUrl = candidate.applicationDocuments?.sourceUrl;
  const urls = new Set([
    candidate.officialSourceUrl,
    fee.sourceUrl,
    entryRequirementSourceUrl(candidate),
    documentUrl,
    candidate.applicationDocuments?.applicationPortalUrl,
    ...(candidate.sourceUrls || [])
  ].filter((url): url is string => Boolean(url)));
  return Array.from(urls).map((url) => ({
    title: url === candidate.officialSourceUrl ? "Official programme page" : url === fee.sourceUrl ? "Official fee source" : "Official source",
    url,
    sourceType: sourceLinkType(url, candidate, fee),
    verifiedAt,
    status: "official-verified",
    note: url === fee.sourceUrl ? fee.note : "Captured in the TSU 2026 official review-import audit batch."
  }));
}

function sourceRegistryLinks(sources: TSUOfficialSource[]): OfficialSourceLink[] {
  return sources.slice(0, 24).map((source) => ({
    title: source.id,
    url: source.finalUrl || source.url,
    sourceType: sourceLinkTypeFromFields(source.fields || [], source.role || source.sourceType || ""),
    verifiedAt,
    status: "official-verified",
    note: `${source.role || source.sourceType || "official source"}; source status ${source.status || "cached"}; sha256 ${source.sha256 || "not-recorded"}`
  }));
}

function sourceLinkType(url: string, candidate: TSUCandidateProgramme, fee: ReturnType<typeof feePresentation>): OfficialSourceLink["sourceType"] {
  if (url === fee.sourceUrl || /fees|fee-schedule/i.test(url)) return "fee";
  if (url === entryRequirementSourceUrl(candidate) || /admission|entry|requirement/i.test(url)) return "entry-requirement";
  if (/topas|apply|admission/i.test(url)) return "admission";
  if (/en\.html$/.test(url)) return "official-website";
  return "profile";
}

function sourceLinkTypeFromFields(fields: string[], role: string): OfficialSourceLink["sourceType"] {
  const text = `${fields.join(" ")} ${role}`.toLowerCase();
  if (/fee|tuition/.test(text)) return "fee";
  if (/entry|language|requirement/.test(text)) return "entry-requirement";
  if (/admission|apply|application/.test(text)) return "admission";
  if (/institution|homepage|profile/.test(text)) return "profile";
  return "other";
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
    importedReviewRows: rows.filter((row) => row.slug.startsWith(TSU_OFFICIAL_AUDIT_SLUG_PREFIX)).length
  };
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function tsuShortCode(level: TSULevel, ordinal: number) {
  const prefix = level === "bachelor" ? "UG" : level === "master" ? "MA" : "PHD";
  return `TSU-${prefix}-${String(ordinal).padStart(3, "0")}`;
}

function localizedFaculty(facultyEn: string): LocalizedText {
  const translation = facultyLocalization[facultyEn];
  const zhCN = translation?.zhCN || `${facultyEn}（中文名待复核）`;
  return t(facultyEn, facultyEn, zhCN, translation?.zhTW || toTraditional(zhCN));
}

function localizedProgramName(nameEn: string): LocalizedText {
  const exact = exactProgramNameZh[nameEn];
  const zhCN = exact || inferProgramNameZh(nameEn);
  return t(nameEn, nameEn, zhCN, toTraditional(zhCN));
}

function inferProgramNameZh(nameEn: string) {
  let name = nameEn.trim();
  const online = /\(100%\s*Online\)/i.test(name) ? "（100% 在线）" : "";
  name = name.replace(/\(100%\s*Online\)/gi, "").trim();

  const phdMatch = name.match(/^Doctor of Philosophy\s*(?:\(PhD\))?\s+in\s+(.+)$/i);
  if (phdMatch?.[1]) return `${translateSubject(phdMatch[1])}哲学博士${/\(PhD\)/i.test(nameEn) ? "（PhD）" : ""}${online}`;

  const masterOfScience = name.match(/^Master of Science in (.+)$/i);
  if (masterOfScience?.[1]) return `${translateSubject(masterOfScience[1])}理学硕士${online}`;

  const masterIn = name.match(/^Master in (.+?)(?:\s*\(.+\))?$/i);
  if (masterIn?.[1]) return `${translateSubject(masterIn[1])}硕士${online}`;

  const masterOf = name.match(/^Master of (.+?)(?:\s*\(.+\))?$/i);
  if (masterOf?.[1]) return `${translateSubject(masterOf[1])}硕士${online}`;

  const masterLaws = name.match(/^Master of Laws(?: in (.+))?$/i);
  if (masterLaws) return `${masterLaws[1] ? translateSubject(masterLaws[1]) : ""}法学硕士${online}`;

  const bachelorScience = name.match(/^Bachelor of Science \(Honours\) in (.+)$/i);
  if (bachelorScience?.[1]) return `${translateSubject(bachelorScience[1])}理学荣誉学士`;

  const bachelorArts = name.match(/^Bachelor of Arts \(Honours\) in (.+)$/i);
  if (bachelorArts?.[1]) return `${translateSubject(bachelorArts[1])}文学荣誉学士`;

  const bachelorMass = name.match(/^Bachelor of Mass Communication \(Honours\) in (.+)$/i);
  if (bachelorMass?.[1]) return `${translateSubject(bachelorMass[1])}大众传播荣誉学士`;

  const bachelorSocial = name.match(/^Bachelor of Social Science \(Honours\) in (.+)$/i);
  if (bachelorSocial?.[1]) return `${translateSubject(bachelorSocial[1])}社会科学荣誉学士`;

  const bachelorGeneric = name.match(/^Bachelor of (.+?) \(Honours\)$/i);
  if (bachelorGeneric?.[1]) return `${translateSubject(bachelorGeneric[1])}荣誉学士`;

  return `${nameEn}（中文名待复核）`;
}

function translateSubject(value: string) {
  const cleaned = value.replace(/\s*\((?:Coursework|Research)\)\s*$/i, "").trim();
  return subjectZh[cleaned] || cleaned.split(/\s+and\s+|\s*&\s*/i).map((part) => subjectZh[part.trim()] || part.trim()).join("与");
}

function toTraditional(value: string) {
  return value.split("").map((char) => simpleTraditionalMap[char] || char).join("");
}

function annualTuitionCny(candidate: TSUCandidateProgramme, fee: ReturnType<typeof feePresentation>) {
  const years = Math.max(durationYears(candidate), 1);
  return Math.round((fee.amount * usdToCnyReviewEstimate) / years);
}

function durationYears(candidate: TSUCandidateProgramme) {
  if (Number(candidate.durationYears) > 0) return Number(candidate.durationYears);
  return parseDurationYears(candidate.durationOfficial);
}

function parseDurationYears(value: string) {
  const text = String(value || "");
  const yearRange = text.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*years?/i);
  if (yearRange) return Number(yearRange[1]);
  const years = text.match(/(\d+(?:\.\d+)?)\s*[- ]?\s*years?/i);
  if (years) return Number(years[1]);
  const months = text.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (months) return Number(months[1]) / 12;
  const semesters = text.match(/(\d+(?:\.\d+)?)\s*semesters?/i);
  if (semesters) return Number(semesters[1]) / 2;
  const number = text.match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : 1;
}

function studyModeDisplay(candidate: TSUCandidateProgramme) {
  const type = candidate.studyType || candidate.studyMode || "coursework";
  const arrangement = Array.isArray(candidate.studyArrangement) ? candidate.studyArrangement.join(" / ") : String(candidate.studyArrangement || "").trim();
  if (!arrangement || arrangement.toLowerCase() === type.toLowerCase()) return normalizeText(type, 80);
  return normalizeText(`${type} / ${arrangement}`, 80);
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|management|finance|accounting|banking|economics|marketing|entrepreneurship|hospitality|tourism|events|culinary|patisserie|gastronomy/.test(value)) return "business";
  if (/computer|software|information technology|applied computing|digital|fintech|interactive spatial/.test(value)) return "it";
  if (/engineering|mechatronics|construction|quantity surveying|architecture/.test(value)) return "engineering";
  if (/medicine|medical|biomedical|pharmacy|pharmaceutical|health|psychology|counselling|clinical/.test(value)) return "medicine";
  if (/law|laws|governance|legal/.test(value)) return "law";
  if (/science|biotechnology|food science|actuarial/.test(value)) return "science";
  return "arts";
}

function intakeOfficialText(candidate: TSUCandidateProgramme) {
  return Array.isArray(candidate.intake) ? candidate.intake.join(", ") : candidate.intake?.officialText || "";
}

function intakeMonths(candidate: TSUCandidateProgramme) {
  if (!Array.isArray(candidate.intake) && Array.isArray(candidate.intake?.months)) return candidate.intake.months;
  const text = [candidate.officialIntake, intakeOfficialText(candidate)].filter(Boolean).join(", ");
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
  return months.filter((month) => new RegExp(`\\b${month}\\b`, "i").test(text));
}

function parseLanguageRequirement(candidate: TSUCandidateProgramme): LanguageRequirement {
  const structured = candidate.language || candidate.languageRequirementStructured || {};
  const tests = structured.tests || {};
  const text = tsuInternationalLanguageText(
    structured.internationalText || structured.officialText || candidate.officialLanguageRequirement || ""
  );
  return {
    ielts: numberFromTest(tests.ielts) || firstNumberAfter(text, [
      /IELTS\s*\(or\s*Equivalent\)\s*Band\s*(\d+(?:\.\d+)?)/i,
      /IELTS(?:\/IELTS Online)?\s*(?:score\s*of|Band|minimum\s*Band)?\s*(\d+(?:\.\d+)?)/i,
      /International English Language Testing System\s*\(IELTS\)\s*score\s*of\s*(\d+(?:\.\d+)?)/i,
      /(?:equivalent\s+)?score\s*of\s*(\d+(?:\.\d+)?)\s*in\s*IELTS/i,
      /Band\s*(\d+(?:\.\d+)?)\s*(?:for|in)\s*IELTS/i
    ]) || 0,
    toefl: numberFromTest(tests.toeflIbt || tests.toefl || tests.toeflInternetBasedTest) || firstNumberAfter(text, [
      /TOEFL\s*iBT\s*(\d+)/i,
      /TOEFL\s*(\d+)\s*\(Internet Based Test\)/i,
      /TOEFL\s*(?:IBT|iBT)?\s*(?:overall\s*)?(?:score\s*of\s*)?(\d+)/i
    ]),
    pte: numberFromTest(tests.pte) || firstNumberAfter(text, [
      /PTE(?:\s+Academic)?\s*(\d+)/i
    ]),
    muet: numberFromTest(tests.muet) || firstNumberAfter(text, [
      /MUET\s*(?:Min\.\s*)?(?:Band|band)?\s*(\d+(?:\.\d+)?)/i,
      /MUET\s+with\s+Band\s*(\d+(?:\.\d+)?)/i,
      /Band\s*(\d+(?:\.\d+)?)\s*(?:in|for)\s*MUET/i,
      /minimum\s+score\s+of\s+Band\s*(\d+(?:\.\d+)?)\s*in\s*MUET/i
    ])
  };
}

function tsuInternationalLanguageText(value: string) {
  const source = normalizeLongText(value);
  if (!source) return "";
  const markers = [
    /\bINTERNATIONAL STUDENTS\b/i,
    /\bFor International students\b:?/i,
    /\bInternational Students\b:?/i,
    /\bInternational students must\b/i,
    /\bEnglish Requirement for international students\b\s*:?/i
  ];
  const matchedMarker = markers.map((pattern) => source.match(pattern)).find(Boolean);
  const markerIndex = matchedMarker?.index ?? -1;
  let text = markerIndex >= 0 ? source.slice(markerIndex) : source;
  text = text
    .replace(/^INTERNATIONAL STUDENTS\b\s*:?/i, "")
    .replace(/^For International students\b\s*:?/i, "")
    .replace(/^International Students\b\s*:?/i, "")
    .trim();

  const cutPatterns = [
    /\bFor Malaysian students\b/i,
    /\bLOCAL STUDENTS\b/i,
    /\bNotes?\s*:/i,
    /\bNote\s*:/i,
    /\bInterview\b/i,
    /\bHealth Requirements\b/i,
    /\bIf Your Bachelor's Degree\b/i,
    /\bAccelerated PhD\b/i,
    /\bPrior Publication Mode\b/i,
    /\bStudents without\b/i,
    /\bAccreditation of Prior Experiential Learning\b/i,
    /\bAll information is subject to change\b/i
  ];
  const cutIndex = cutPatterns.reduce((current, pattern) => {
    const match = text.match(pattern);
    if (!match || match.index == null || match.index <= 0) return current;
    return Math.min(current, match.index);
  }, text.length);

  return normalizeLongText(text.slice(0, cutIndex));
}

function numberFromTest(value?: TSUTestScore) {
  return Number.isFinite(Number(value?.score)) ? Number(value?.score) : null;
}

function primaryGpaRequirement(candidate: TSUCandidateProgramme) {
  const thresholds = candidate.academicPerformanceRequirement?.thresholds || candidate.gpaOrAcademicPerformanceRequirement?.thresholds || [];
  const cgpa = thresholds.find((item) => item.type === "cgpa" && Number(item.value) > 0 && Number(item.value) <= 4);
  if (cgpa?.value) return Number(cgpa.value);
  return extractCgpaRequirement(candidate.officialAcademicRequirement || candidate.academicPerformanceRequirement?.summary || "");
}

function extractCgpaRequirement(value: string) {
  const text = normalizeLongText(value || "");
  const match = text.match(/\b(?:minimum|min\.?|at least)?\s*(?:CGPA|GPA)(?:\s+of)?\s*(\d(?:\.\d+)?)/i);
  if (!match?.[1]) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 4 ? parsed : 0;
}

function academicPerformanceSummary(candidate: TSUCandidateProgramme) {
  const performance = candidate.academicPerformanceRequirement || candidate.gpaOrAcademicPerformanceRequirement;
  const summary = normalizeText(performance?.summary || "", 260);
  const fallback = primaryGpaRequirement(candidate) ? `CGPA ${primaryGpaRequirement(candidate)}` : "Official academic threshold captured for review.";
  const en = summary || fallback;
  const zhCN = summary
    ? `官方学术门槛摘要：${summary}。具体学历路径与例外条件以官方页面证据为准。`
    : "官方学术门槛已采集；公开前需按具体学历路径完成中文展示复核。";
  return { en, zhCN, zhTW: toTraditional(zhCN) };
}

function localizedApplicationDocs(candidate: TSUCandidateProgramme) {
  const items = (candidate.applicationDocuments?.items || []).filter(Boolean);
  const zhCN = items.map((item) => docZh[item] || `${item}（译名待复核）`);
  return arr(items, items, zhCN, zhCN.map(toTraditional));
}

function localizedCurriculum(candidate: TSUCandidateProgramme): LocalizedStringArray {
  const enItems = splitEvidenceList(candidate.curriculum?.en || "");
  const studyType = candidate.studyType || candidate.studyMode || "official programme";
  const arrangement = Array.isArray(candidate.studyArrangement) ? candidate.studyArrangement.join(" / ") : candidate.studyArrangement || "official arrangement";
  const zhCN = [
    `官方课程设置已采集，当前记录包含 ${enItems.length || "若干"} 个课程结构或研究方向条目；公开前需逐项完成中文译名复核。`,
    `学习类型：${studyType}；学习安排：${arrangement}；官方学制：${candidate.durationOfficial}。`
  ];
  if (candidate.level === "phd" || /research/i.test(studyType)) {
    zhCN.push("研究型信息以官方研究方向、研究方法、论文或发表要求为准，英文证据保存在审计字段中。");
  }
  return arr(enItems, enItems, zhCN, zhCN.map(toTraditional));
}

function localizedCareers(candidate: TSUCandidateProgramme): LocalizedStringArray {
  const enItems = splitEvidenceList(candidate.careers?.en || "");
  const zhCN = enItems.length
    ? [`官方职业方向已采集 ${enItems.length} 项；公开前需逐项完成中文职业名称校对。`]
    : ["官方页面未发布可直接展示的职业方向，或该字段需要人工复核后再公开。"];
  return arr(enItems, enItems, zhCN, zhCN.map(toTraditional));
}

function localizedSpecializations(candidate: TSUCandidateProgramme): LocalizedStringArray {
  const researchHints = splitEvidenceList(candidate.curriculum?.en || "").filter((item) => /research|topic|speciali[sz]ation|area/i.test(item)).slice(0, 8);
  const zhCN = researchHints.length ? ["官方研究方向或专题信息已采集，公开前需中文校对。"] : [];
  return arr(researchHints, researchHints, zhCN, zhCN.map(toTraditional));
}

function localizedDescription(candidate: TSUCandidateProgramme, name: LocalizedText, faculty: LocalizedText): LocalizedText {
  const zhCN = `${name["zh-CN"]} 是泰莱大学 ${candidate.level} 层级的审核候选专业，由${faculty["zh-CN"]}开设。官方证据已覆盖学制、开学月份、国际学生 USD 总学费、入学要求、英语要求和来源链接；当前仅供后台审查，不进入公开学生目录。`;
  return t(
    normalizeLongText(candidate.description?.en || `${candidate.nameEnOfficial} is an audited Taylor's University candidate for international applicants.`),
    normalizeLongText(candidate.description?.ms || candidate.description?.en || `${candidate.nameEnOfficial} is an audited Taylor's University candidate for international applicants.`),
    zhCN,
    toTraditional(zhCN)
  );
}

function specialRequirementSummary(candidate: TSUCandidateProgramme) {
  const requirements = candidate.specialRequirements || {};
  const active = Object.entries(requirements)
    .filter(([, value]) => value?.status === "official-value")
    .map(([key]) => key);
  if (!active.length) {
    return "No programme-specific interview, portfolio, proposal, supervisor, publication or work-experience condition is marked for public display in this review-only row unless official evidence is reviewed.";
  }
  return `Programme-specific official requirement flags captured for review: ${active.join(", ")}. Public display requires Ian review of source wording before release.`;
}

function reviewReasonText(candidate: TSUCandidateProgramme) {
  const reasons = [
    candidate.reviewReason || "Official facts calibrated; public display still requires final student-facing copy review.",
    candidate.language?.ieltsOnlySummaryStatus === "official-unpublished" ? "No IELTS-only scalar published; use official equivalent English-route wording during review." : "",
    "Review-only import for Ian approval; all rows are non-public."
  ].filter(Boolean);
  return normalizeLongText(reasons.join(" "));
}

function entryRequirementSourceUrl(candidate: TSUCandidateProgramme) {
  return candidate.academicPerformanceRequirement?.sourceUrl || candidate.gpaOrAcademicPerformanceRequirement?.sourceUrl || candidate.officialSourceUrl;
}

function officialFeeSourceUrl(candidate: TSUCandidateProgramme) {
  return candidate.officialFeeSourceUrl || candidate.fee?.officialFeeSourceUrl || candidate.fee?.officialSourceUrl || "";
}

function numberAfter(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1] ? Number(match[1]) : null;
}

function firstNumberAfter(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = numberAfter(text, pattern);
    if (value != null) return value;
  }
  return null;
}

function splitEvidenceList(value: string) {
  return normalizeLongText(value)
    .split(/\s*;\s*|\n+-\s+|\n+\s*/)
    .map((item) => normalizeText(item, 220))
    .filter((item) => item.length > 8 && !/^note:?$/i.test(item) && !/^all information is subject to change/i.test(item))
    .slice(0, 14);
}

function normalizeLongText(value: unknown) {
  return normalizeText(String(value || ""), 4000);
}

function normalizeText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function dateOnly(value?: string) {
  return value?.slice(0, 10) || null;
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

async function findTsuUniversity(manager: EntityManager | DataSource) {
  const repo = manager.getRepository(UniversityEntity);
  return (
    (await repo.findOne({ where: { code: taylorExistingPublicCode } })) ||
    (await repo.findOne({ where: { slug: taylorExistingPublicSlug } })) ||
    (await repo.findOne({ where: { code: "TSU" } })) ||
    (await repo.findOne({ where: { slug: taylorSlug } })) ||
    (await repo.findOne({ where: { slug: "taylors-university-malaysia" } }))
  );
}

async function main() {
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_TSU_OFFICIAL_AUDIT_CANDIDATE_PATH);
  if (!existsSync(candidatePath)) throw new Error(`TSU candidate dataset not found: ${candidatePath}`);
  const dataset = loadJson<TSUCandidateDataset>(candidatePath);
  const errors = validateTsuOfficialAuditDataset(dataset);
  if (errors.length) throw new Error(`TSU official audit candidate validation failed:\n${errors.join("\n")}`);

  const rows = buildTsuOfficialAuditRows(dataset);
  const summary = summarizeTsuOfficialAuditImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import") || process.argv.includes("--confirm-review-import");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/tsu-official-audit-review-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportOutput = readArgValue("--report-output");

  if (!verifyOnly && !confirm) {
    const report = {
      mode: "dry-run",
      decision: "ready-for-review-import",
      universityCode: "TSU",
      candidatePath,
      writePolicy: {
        authorization: "review-import",
        requestedMode: "review-import",
        upsertPrefix: TSU_OFFICIAL_AUDIT_SLUG_PREFIX,
        importRows: 89,
        university: {
          newInstitutionDefault: { isPublished: false, publicDisplayStatus: "needs-review" },
          existingPublicInstitutionPolicy: "Preserve existing public university visibility and public rows; only stale non-public TSU review rows may be archived."
        },
        programmes: { isPublished: false, publicDisplayStatus: "needs-review", officialSourceStatus: "official-verified" },
        archivePolicy: "Archive stale non-public TSU bachelor/master/phd rows outside the TSU official-audit namespace; preserve any existing public visible TSU rows.",
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
    let university = await findTsuUniversity(dataSource);

    if (verifyOnly) {
      if (!university) throw new Error("TSU university row not found.");
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

    const reviewNamespaceUniversity = await universityRepo.findOne({ where: { code: "TSU" } });

    const beforePublicVisibility = await publicVisibilitySnapshot(dataSource, university);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    const reviewNamespacePrograms =
      reviewNamespaceUniversity && reviewNamespaceUniversity.id !== university?.id
        ? await programRepo.find({ where: { universityId: reviewNamespaceUniversity.id } })
        : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          targetUniversity: university,
          targetPrograms: currentPrograms,
          reviewNamespaceUniversity,
          reviewNamespacePrograms,
          publicVisibility: beforePublicVisibility
        },
        null,
        2
      ),
      "utf8"
    );

    let verification: TSUImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await findTsuUniversity(manager);
      const universitySeed = buildTsuUniversityRow(dataset, summary, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousOfficialAuditRows = await txProgramRepo.find({
        where: { slug: Like(`${TSU_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
      });
      for (const previous of previousOfficialAuditRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      await txProgramRepo.createQueryBuilder()
        .update(ProgramEntity)
        .set({
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: "Archived by the TSU official review import to prevent stale non-public review rows from mixing with the current 89-row official baseline.",
          reviewReason: "Superseded by the 2026-06-20 TSU official bachelor/master/phd review import."
        })
        .where("universityId = :universityId", { universityId: university.id })
        .andWhere("level IN (:...levels)", { levels: ["bachelor", "master", "phd"] })
        .andWhere("slug NOT LIKE :slugPrefix", { slugPrefix: `${TSU_OFFICIAL_AUDIT_SLUG_PREFIX}%` })
        .andWhere("NOT (isPublished = true AND publicDisplayStatus IN (:...visibleStatuses))", {
          visibleStatuses: ["ready", "current-cycle-not-open", "not-available-for-international"]
        })
        .execute();

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id && !existing.slug.startsWith(TSU_OFFICIAL_AUDIT_SLUG_PREFIX)) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      university.programCount = Math.max(university.programCount || 0, summary.importRows);
      await txUniversityRepo.save(university);

      const orphanReviewUniversity = await txUniversityRepo.findOne({ where: { code: "TSU" } });
      if (
        orphanReviewUniversity &&
        orphanReviewUniversity.id !== university.id &&
        !orphanReviewUniversity.isPublished &&
        orphanReviewUniversity.slug === taylorSlug
      ) {
        const remainingRows = await txProgramRepo.count({ where: { universityId: orphanReviewUniversity.id } });
        if (remainingRows === 0) await txUniversityRepo.remove(orphanReviewUniversity);
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
