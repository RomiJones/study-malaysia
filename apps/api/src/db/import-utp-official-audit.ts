import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, Not, type DeepPartial, type EntityManager } from "typeorm";
import { QS_WORLD_RANKING_NAME, QS_WORLD_RANKING_YEAR } from "@studymy/shared";
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
export const UTP_OFFICIAL_AUDIT_SLUG_PREFIX = "utp-official-2026-row-";
export const DEFAULT_UTP_OFFICIAL_AUDIT_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/utp/2026-06-19/official-audit/08_candidate_dataset.json"
);
export const DEFAULT_UTP_OFFICIAL_SOURCE_REGISTRY_PATH = resolve(
  repositoryRoot,
  "data/imports/utp/2026-06-19/official-audit/02_official_source_registry.json"
);

const verifiedAt = "2026-06-19";
const myrToCny = 1.55;
const defaultEntryRequirementUrl = "https://www.utp.edu.my/Pages/Admission/Postgraduate/International-Applicants/Entry-Requirement.aspx";
const defaultUndergraduateEntryRequirementUrl = "https://www.utp.edu.my/Pages/Admission/Undergraduate/International/Entry-Requirement.aspx";
const utpQsWorld2027 = {
  name: QS_WORLD_RANKING_NAME,
  year: QS_WORLD_RANKING_YEAR,
  status: "ranked",
  context: "malaysia-institution",
  rankDisplay: "=261",
  rankSort: 261,
  officialSortRank: 261,
  overallScore: "49.9",
  sourceUrl: "https://www.topuniversities.com/world-university-rankings?countries=my",
  profileUrl: "https://www.topuniversities.com/universities/universiti-teknologi-petronas-utp",
  qsTitle: "Universiti Teknologi PETRONAS (UTP)",
  qsCountry: "Malaysia",
  qsCity: "Seri Iskandar",
  publishedAt: "2026-06-18",
  retrievedAt: "2026-06-19T00:00:00+08:00"
} as const;

type UTPLevel = "bachelor" | "master" | "phd";
type UTPFeeStatus = "verified-official-total" | "official-rate-only" | "calculated-from-official-rate" | "needs-review" | "not-confirmed";

interface UTPImportOptions {
  publish?: boolean;
  allowRateDerived?: boolean;
}

interface UTPFee {
  tuitionAmount: number | null;
  tuitionCurrency: "RM" | "MYR" | null;
  tuitionBasis: string | null;
  tuitionAcademicSession: string;
  applicantScope: "international";
  status: UTPFeeStatus;
  officialFeeSourceUrl: string;
  conflictingOfficialValues?: unknown[];
  notes?: string;
}

interface UTPFieldState {
  officialText?: string;
  status?: string;
}

interface UTPFieldEvidence {
  field: string | string[];
  sourceId?: string;
  sourceUrl?: string;
  sourceText?: string;
  retrievedAt?: string;
  confidence?: number;
}

interface UTPCandidateProgramme {
  code: string;
  nameEnOfficial: string;
  level: UTPLevel;
  universityCode: "UTP";
  facultyEn: string;
  campus: string;
  studyMode: string;
  studyType?: string;
  studyArrangement?: string;
  applicantScope: "international";
  academicSession: string;
  durationOfficial: string;
  officialIntake: string;
  intake: string[];
  officialAcademicRequirement: string;
  academicRequirement?: Record<string, unknown>;
  officialLanguageRequirement: string;
  languageRequirement?: Record<string, unknown>;
  applicationDocuments: string[];
  description?: string;
  courseSetting?: UTPFieldState;
  researchAreas?: UTPFieldState;
  careerDirections?: UTPFieldState;
  fee: UTPFee;
  programmeDetails?: string;
  sourceUrls: string[];
  officialSourceUrl: string;
  officialVerifiedAt: string;
  officialSourceStatus: string;
  publicDisplayStatus: "needs-review";
  reviewReasons: string[];
  fieldEvidence?: UTPFieldEvidence[];
}

interface UTPCandidateDataset {
  schemaVersion: number;
  universityCode: "UTP";
  officialDomains: string[];
  collectionScope: "full";
  levels: UTPLevel[];
  applicantScope: "international";
  academicSession: string;
  currentAsOf: string;
  auditMeta?: {
    canonicalProgrammes?: number;
    ready?: number;
    needsReview?: number;
    byLevel?: Record<UTPLevel, number>;
  };
  university: {
    nameEnOfficial: string;
    shortName: "UTP";
    officialWebsite: string;
    applicationPortalUrl: string;
    location: string;
    sourceId: string;
  };
  programmes: UTPCandidateProgramme[];
}

interface UTPSourceRegistry {
  sources?: Array<{
    id: string;
    url: string;
    finalUrl?: string;
    role: string;
    title?: string;
    fields?: string[];
    status?: string;
    sha256?: string;
  }>;
}

interface UTPImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<UTPLevel, number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialTotalRows: number;
  officialRateRows: number;
  calculatedFromOfficialRateRows: number;
  pendingFeeRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UTPImportVerification extends UTPImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  universityQsRank: number;
  universityQsRankDisplay: string | null;
  publicLeakageRows: number;
  adminNeedsReviewRows: number;
  legacyActiveRows: number;
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

const facultyLocalization: Record<string, { zhCN: string; zhTW: string }> = {
  "Faculty of Engineering": { zhCN: "工程学院", zhTW: "工程學院" },
  "Faculty of Science, Management and Computing": { zhCN: "科学、管理与计算学院", zhTW: "科學、管理與計算學院" },
  "Computer and Information Sciences Department": { zhCN: "计算机与信息科学系", zhTW: "計算機與資訊科學系" },
  "Management and Humanities Department": { zhCN: "管理与人文系", zhTW: "管理與人文系" }
};

const programNameLocalization: Record<string, { zhCN: string; zhTW: string }> = {
  "Bachelor of Integrated Engineering with Honours": { zhCN: "综合工程荣誉学士", zhTW: "綜合工程榮譽學士" },
  "Bachelor of Chemical Engineering with Honours": { zhCN: "化学工程荣誉学士", zhTW: "化學工程榮譽學士" },
  "Bachelor of Civil Engineering with Honours - Civil Engineering Course in Malaysia": { zhCN: "土木工程荣誉学士", zhTW: "土木工程榮譽學士" },
  "Bachelor of Computer Engineering with Honours": { zhCN: "计算机工程荣誉学士", zhTW: "電腦工程榮譽學士" },
  "Bachelor of Electrical and Electronics Engineering with Honours": { zhCN: "电气与电子工程荣誉学士", zhTW: "電氣與電子工程榮譽學士" },
  "Bachelor of Materials Engineering with Honours": { zhCN: "材料工程荣誉学士", zhTW: "材料工程榮譽學士" },
  "Bachelor of Mechanical Engineering with Honours": { zhCN: "机械工程荣誉学士", zhTW: "機械工程榮譽學士" },
  "Bachelor of Petroleum Engineering with Honours": { zhCN: "石油工程荣誉学士", zhTW: "石油工程榮譽學士" },
  "Bachelor in Information Systems (Hons)": { zhCN: "信息系统荣誉学士", zhTW: "資訊系統榮譽學士" },
  "Bachelor in Information Technology (Hons) - IT Course in Malaysia": { zhCN: "信息技术荣誉学士", zhTW: "資訊科技榮譽學士" },
  "Bachelor of Computer Science (Hons) - Computer Science Course in Malaysia": { zhCN: "计算机科学荣誉学士", zhTW: "電腦科學榮譽學士" },
  "Bachelor in Business Management (Hons)": { zhCN: "商业管理荣誉学士", zhTW: "商業管理榮譽學士" },
  "Bachelor of Science (Hons) Applied Chemistry": { zhCN: "应用化学理学荣誉学士", zhTW: "應用化學理學榮譽學士" },
  "Bachelor-of-Science-in-Industrial-Physics": { zhCN: "工业物理理学荣誉学士", zhTW: "工業物理理學榮譽學士" },
  "Bachelor of Science (Hons) Geoscience": { zhCN: "地球科学理学荣誉学士", zhTW: "地球科學理學榮譽學士" },
  "MBA in En ergy Management": { zhCN: "能源管理工商管理硕士", zhTW: "能源管理工商管理碩士" },
  "Master of Science in Applied Computing": { zhCN: "应用计算理学硕士", zhTW: "應用計算理學碩士" },
  "MSc in Asset Management and Maintenance": { zhCN: "资产管理与维护理学硕士", zhTW: "資產管理與維護理學碩士" },
  "MSc in Corrosion Engineering": { zhCN: "腐蚀工程理学硕士", zhTW: "腐蝕工程理學碩士" },
  "MSC in Drilling Engineering by Coursework and Dissertation": { zhCN: "钻井工程理学硕士", zhTW: "鑽井工程理學碩士" },
  "MSc in Electronic System Engineering": { zhCN: "电子系统工程理学硕士", zhTW: "電子系統工程理學碩士" },
  "MSc in Industrial Environmental Engineering": { zhCN: "工业环境工程理学硕士", zhTW: "工業環境工程理學碩士" },
  "MSc in Offshore Engineering by Coursework and Dissertation": { zhCN: "海洋工程理学硕士", zhTW: "海洋工程理學碩士" },
  "MSc in Petroleum Geoscience": { zhCN: "石油地球科学理学硕士", zhTW: "石油地球科學理學碩士" },
  "MSc in Process Integration": { zhCN: "过程集成理学硕士", zhTW: "製程整合理學碩士" },
  "MSc in Process Safety": { zhCN: "过程安全理学硕士", zhTW: "製程安全理學碩士" },
  "MSc in Petroleum Engineering - Masters by Coursework": { zhCN: "石油工程理学硕士", zhTW: "石油工程理學碩士" },
  "Master of Science in Predictive Analytics ODL": { zhCN: "预测分析理学硕士（开放与远程学习）", zhTW: "預測分析理學碩士（開放與遠距學習）" },
  "MBA in En ergy Management (ODL)": { zhCN: "能源管理工商管理硕士（开放与远程学习）", zhTW: "能源管理工商管理碩士（開放與遠距學習）" },
  "MSc in Electronic Systems Engineering (ODL)": { zhCN: "电子系统工程理学硕士（开放与远程学习）", zhTW: "電子系統工程理學碩士（開放與遠距學習）" },
  "Master of Science in Applied Computing ODL": { zhCN: "应用计算理学硕士（开放与远程学习）", zhTW: "應用計算理學碩士（開放與遠距學習）" },
  "MSc in Asset Management and Maintenance (ODL)": { zhCN: "资产管理与维护理学硕士（开放与远程学习）", zhTW: "資產管理與維護理學碩士（開放與遠距學習）" },
  "MSc in Corrosion Engineering ODL": { zhCN: "腐蚀工程理学硕士（开放与远程学习）", zhTW: "腐蝕工程理學碩士（開放與遠距學習）" },
  "MSc in Data Science (ODL)": { zhCN: "数据科学理学硕士（开放与远程学习）", zhTW: "資料科學理學碩士（開放與遠距學習）" },
  "MSC in Drilling Engineering by Coursework and Dissertation ODL": { zhCN: "钻井工程理学硕士（开放与远程学习）", zhTW: "鑽井工程理學碩士（開放與遠距學習）" },
  "MSc in Industrial Environmental Engineering ODL": { zhCN: "工业环境工程理学硕士（开放与远程学习）", zhTW: "工業環境工程理學碩士（開放與遠距學習）" },
  "MSc in Offshore Engineering ODL": { zhCN: "海洋工程理学硕士（开放与远程学习）", zhTW: "海洋工程理學碩士（開放與遠距學習）" },
  "MSc in Petroleum Engineering (ODL)": { zhCN: "石油工程理学硕士（开放与远程学习）", zhTW: "石油工程理學碩士（開放與遠距學習）" },
  "MSc Petroleum Geoscience (ODL)": { zhCN: "石油地球科学理学硕士（开放与远程学习）", zhTW: "石油地球科學理學碩士（開放與遠距學習）" },
  "MSc in Process Integration by Coursework (ODL)": { zhCN: "过程集成理学硕士（开放与远程学习）", zhTW: "製程整合理學碩士（開放與遠距學習）" },
  "MSc in Chemical Engineering": { zhCN: "化学工程理学硕士", zhTW: "化學工程理學碩士" },
  "MSc in Petroleum Engineering - Masters by Research": { zhCN: "石油工程理学硕士（研究型）", zhTW: "石油工程理學碩士（研究型）" },
  "MSc in Petroleum Geoscience - Masters by Research": { zhCN: "石油地球科学理学硕士（研究型）", zhTW: "石油地球科學理學碩士（研究型）" },
  "MSc in Civil Engineering by Research": { zhCN: "土木工程理学硕士（研究型）", zhTW: "土木工程理學碩士（研究型）" },
  "MSc in Mechanical Engineering": { zhCN: "机械工程理学硕士", zhTW: "機械工程理學碩士" },
  "MSc in Electrical & Electronic Engineering": { zhCN: "电气与电子工程理学硕士", zhTW: "電氣與電子工程理學碩士" },
  "MSc in Information Technology (Research)": { zhCN: "信息技术理学硕士（研究型）", zhTW: "資訊科技理學碩士（研究型）" },
  "MSc in Information Systems": { zhCN: "信息系统理学硕士", zhTW: "資訊系統理學碩士" },
  "MSc of Science (by Research)": { zhCN: "理学硕士（研究型）", zhTW: "理學碩士（研究型）" },
  "Master of Philosophy in Management": { zhCN: "管理哲学硕士", zhTW: "管理哲學碩士" },
  "Master of Philosophy": { zhCN: "哲学硕士", zhTW: "哲學碩士" },
  "PhD in Chemical Engineering": { zhCN: "化学工程哲学博士", zhTW: "化學工程哲學博士" },
  "PhD in Petroleum Engineering": { zhCN: "石油工程哲学博士", zhTW: "石油工程哲學博士" },
  "PhD in Petroleum Geoscience": { zhCN: "石油地球科学哲学博士", zhTW: "石油地球科學哲學博士" },
  "PhD in Civil Engineering": { zhCN: "土木工程哲学博士", zhTW: "土木工程哲學博士" },
  "PhD in Mechanical Engineering": { zhCN: "机械工程哲学博士", zhTW: "機械工程哲學博士" },
  "PhD in Electrical and Electronic Engineering": { zhCN: "电气与电子工程哲学博士", zhTW: "電氣與電子工程哲學博士" },
  "PhD in Information Technology": { zhCN: "信息技术哲学博士", zhTW: "資訊科技哲學博士" },
  "PhD in Information Systems": { zhCN: "信息系统哲学博士", zhTW: "資訊系統哲學博士" },
  "PhD in Management": { zhCN: "管理哲学博士", zhTW: "管理哲學博士" },
  "PhD in Applied Science": { zhCN: "应用科学哲学博士", zhTW: "應用科學哲學博士" },
  "PhD in Social Science & Humanities": { zhCN: "社会科学与人文学科哲学博士", zhTW: "社會科學與人文學科哲學博士" },
  "MSc in Process Safety (ODL)": { zhCN: "过程安全理学硕士（开放与远程学习）", zhTW: "製程安全理學碩士（開放與遠距學習）" }
};

export function validateUtpOfficialAuditDataset(dataset: UTPCandidateDataset): string[] {
  const errors: string[] = [];
  if (dataset.universityCode !== "UTP") errors.push("Dataset universityCode must be UTP.");
  if (dataset.university?.shortName !== "UTP") errors.push("University shortName must be UTP.");
  if (dataset.collectionScope !== "full") errors.push("UTP import expects full collection scope.");
  if (dataset.applicantScope !== "international") errors.push("UTP import expects international applicant scope.");
  if (dataset.currentAsOf !== "2026-06-19") errors.push(`UTP currentAsOf must be 2026-06-19; got ${dataset.currentAsOf}.`);
  if (!dataset.officialDomains?.includes("utp.edu.my")) errors.push("Official domain utp.edu.my is required.");
  if (!dataset.officialDomains?.includes("utpdec.microsoftcrmportals.com")) errors.push("Official application portal domain is required.");
  if (dataset.programmes.length !== 63) errors.push(`Candidate programme count must be 63; got ${dataset.programmes.length}.`);

  const levelCounts = countBy(dataset.programmes, (row) => row.level);
  if (levelCounts.bachelor !== 15) errors.push(`Expected 15 bachelor rows; got ${levelCounts.bachelor || 0}.`);
  if (levelCounts.master !== 37) errors.push(`Expected 37 master rows; got ${levelCounts.master || 0}.`);
  if (levelCounts.phd !== 11) errors.push(`Expected 11 phd rows; got ${levelCounts.phd || 0}.`);

  dataset.programmes.forEach((row, index) => {
    const ordinal = index + 1;
    if (row.universityCode !== "UTP") errors.push(`Row ${ordinal} universityCode is not UTP.`);
    if (row.applicantScope !== "international") errors.push(`Row ${ordinal} applicant scope is not international.`);
    if (row.publicDisplayStatus !== "needs-review") errors.push(`Row ${ordinal} must remain needs-review.`);
    if (!row.code) errors.push(`Row ${ordinal} has no original candidate code.`);
    if (!row.nameEnOfficial) errors.push(`Row ${ordinal} has no official English name.`);
    if (!row.facultyEn) errors.push(`Row ${ordinal} has no faculty.`);
    if (!row.officialSourceUrl) errors.push(`Row ${ordinal} has no official source URL.`);
    if (!row.fee?.officialFeeSourceUrl) errors.push(`Row ${ordinal} has no official fee source URL.`);
    if (!["verified-official-total", "official-rate-only", "needs-review", "not-confirmed"].includes(row.fee?.status)) {
      errors.push(`Row ${ordinal} has unsupported fee status ${row.fee?.status}.`);
    }
  });

  return errors;
}

export function buildUtpOfficialAuditRows(dataset: UTPCandidateDataset, options: UTPImportOptions = {}): Array<DeepPartial<ProgramEntity>> {
  const publish = Boolean(options.publish);
  return dataset.programmes.map((candidate, index) => {
    const ordinal = index + 1;
    const fee = feePresentation(candidate, options);
    const faculty = localizedFaculty(candidate.facultyEn);
    const language = parseLanguageRequirement(candidate.officialLanguageRequirement);
    const curriculum = courseSettingItems(candidate);
    const careers = fieldItems(candidate.careerDirections);
    const sourceStatus: OfficialSourceStatus = publish ? "official-verified" : "needs-review";
    const publicDisplayStatus: PublicDisplayStatus = publish ? "ready" : "needs-review";
    const reviewReason = reviewReasonText(candidate, fee, options);
    const originalCodeNote = `Original UTP candidate code: ${candidate.code}.`;

    return {
      slug: `${UTP_OFFICIAL_AUDIT_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: utpShortCode(candidate.level, ordinal),
      name: localizedProgramName(candidate.nameEnOfficial),
      nameEnOfficial: candidate.nameEnOfficial,
      level: candidate.level,
      category: inferCategory(candidate.nameEnOfficial, candidate.facultyEn),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: studyModeDisplay(candidate),
      campus: candidate.campus || "Seri Iskandar, Perak, Malaysia",
      durationYears: parseDurationYears(candidate.durationOfficial),
      durationOfficial: normalizeText(candidate.durationOfficial || "Official duration requires review.", 500),
      annualTuitionCny: annualTuitionCny(candidate, fee),
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: fee.officialTuitionMYR,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: candidate.intake || parseIntakeMonths(candidate.officialIntake),
      officialIntake: normalizeText(candidate.officialIntake, 255),
      officialIntakeNote: "Official intake evidence captured in the UTP official audit batch; remains review-only before public display.",
      languageRequirement: language,
      officialLanguageRequirement: normalizeLongText(candidate.officialLanguageRequirement),
      requirement: {
        gpa: extractCgpaRequirement(candidate.officialAcademicRequirement),
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          candidate.officialAcademicRequirement || "Official academic requirement requires review in the UTP audit batch.",
          candidate.officialAcademicRequirement || "Official academic requirement requires review in the UTP audit batch.",
          candidate.officialAcademicRequirement || "UTP 审计批次中该专业学术要求仍需复核。",
          candidate.officialAcademicRequirement || "UTP 審計批次中該專業學術要求仍需覆核。"
        )
      },
      officialAcademicRequirement: normalizeLongText(candidate.officialAcademicRequirement),
      chinaStudentRequirement: "China-specific route was not separately confirmed in the UTP audit run; keep as needs-review before public display.",
      specialRequirementsNote: publish
        ? "Published after controlled UTP release gates; China-specific route remains not separately published by UTP official evidence."
        : "Imported for backend/admin review only. Do not publish until per-record ready gate is completed.",
      applicationDocs: arr(candidate.applicationDocuments || []),
      curriculum: arr(curriculum),
      careers: arr(careers),
      specializations: arr(fieldItems(candidate.researchAreas)),
      description: t(
        descriptionText(candidate),
        descriptionText(candidate),
        publish
          ? `这是国油科技大学 UTP ${candidate.level} 层级面向国际申请人的官方来源专业。`
          : `这是国油科技大学 UTP ${candidate.level} 层级的国际申请审核候选专业。当前仅供后台审查，不进入公开学生端展示。`,
        publish
          ? `這是國油科技大學 UTP ${candidate.level} 層級面向國際申請人的官方來源專業。`
          : `這是國油科技大學 UTP ${candidate.level} 層級的國際申請審核候選專業。當前僅供後台審查，不進入公開學生端展示。`
      ),
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
      officialSourceUrl: candidate.officialSourceUrl,
      officialEntryRequirementSourceUrl: candidate.level === "bachelor" ? defaultUndergraduateEntryRequirementUrl : defaultEntryRequirementUrl,
      officialAccreditationSourceUrl: candidate.officialSourceUrl,
      sourceUrls: sourceLinks(candidate, fee, publish),
      officialVerifiedAt: candidate.officialVerifiedAt || verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: publish
        ? "Published by authorized UTP controlled release. Research-mode totals derived only when official annual fee and official minimum full-time duration are both captured."
        : "Review-only database import. Hidden from public catalogue until Ian approves ready conversion.",
      reviewReason,
      auditNote: [
        originalCodeNote,
        `Study type: ${candidate.studyType || candidate.studyMode}; study arrangement: ${candidate.studyArrangement || "not captured"}.`,
        `Fee candidate status: ${candidate.fee.status}; fee basis: ${candidate.fee.tuitionBasis || "not confirmed"}.`,
        `Field evidence count: ${(candidate.fieldEvidence || []).length}.`,
        publish
          ? `Publication note: ${fee.auditStatus === "calculated-from-official-rate" ? fee.note : "UTP row published after controlled official-source release gates."}`
          : `Review reasons: ${candidate.reviewReasons?.join(" | ") || "UTP row requires Ian/data review before public display."}`
      ].join(" "),
      listTuitionText: fee.display,
      isPublished: publish
    };
  });
}

export function buildUtpUniversityRow(
  dataset: UTPCandidateDataset,
  summary: UTPImportSummary,
  sourceRegistry: UTPSourceRegistry | null,
  options: UTPImportOptions & { dbCode?: string; shortName?: string } = {}
): DeepPartial<UniversityEntity> {
  const publish = Boolean(options.publish);
  const annualTuitionCnyValues = dataset.programmes
    .map((candidate) => annualTuitionCny(candidate, feePresentation(candidate, options)))
    .filter((value) => value > 0);
  const officialSources = (sourceRegistry?.sources || []).slice(0, 16).map<OfficialSourceLink>((source) => ({
    title: source.title || source.id,
    url: source.finalUrl || source.url,
    sourceType: sourceLinkType(source.fields || [], source.role),
    verifiedAt,
    status: publish ? "official-verified" : "needs-review",
    note: `${source.role}; source status ${source.status || "cached"}; sha256 ${source.sha256 || "not-recorded"}`
  }));

  return {
    slug: "universiti-teknologi-petronas",
    code: options.dbCode || "UTP",
    name: t("Universiti Teknologi PETRONAS", "Universiti Teknologi PETRONAS", "国油科技大学", "國油科技大學"),
    shortName: options.shortName || "UTP",
    logoUrl: "",
    imageUrl: "",
    color: "#0B7A75",
    qsRank: utpQsWorld2027.rankSort,
    qsAsiaRank: null,
    location: t("Seri Iskandar, Perak, Malaysia", "Seri Iskandar, Perak, Malaysia", "马来西亚霹雳州斯里依斯干达", "馬來西亞霹靂州斯里依斯干達"),
    region: t("Perak", "Perak", "霹雳州", "霹靂州"),
    ownership: "private",
    institutionType: "research",
    foundedYear: 1997,
    students: 0,
    intlStudents: 0,
    csrCertified: false,
    description: t(
      publish
        ? "Universiti Teknologi PETRONAS is published from the StudyMY official UTP audit batch for international-applicant bachelor, master and doctoral review."
        : "Universiti Teknologi PETRONAS is imported as a StudyMY official review candidate. Public display is disabled until the imported UTP audit records pass the ready gate.",
      publish
        ? "Universiti Teknologi PETRONAS is published from the StudyMY official UTP audit batch for international-applicant bachelor, master and doctoral review."
        : "Universiti Teknologi PETRONAS is imported as a StudyMY official review candidate. Public display is disabled until the imported UTP audit records pass the ready gate.",
      publish
        ? "国油科技大学已根据 StudyMY 官方 UTP 审计批次发布，覆盖国际申请人的本科、硕士和博士专业。"
        : "国油科技大学已作为 StudyMY 官方审核候选入库；审核通过前不会进入公开目录。",
      publish
        ? "國油科技大學已根據 StudyMY 官方 UTP 審計批次發布，覆蓋國際申請人的本科、碩士和博士專業。"
        : "國油科技大學已作為 StudyMY 官方審核候選入庫；審核通過前不會進入公開目錄。"
    ),
    website: dataset.university.officialWebsite,
    admissionEmail: "",
    nameEnOfficial: dataset.university.nameEnOfficial,
    officialWebsite: dataset.university.officialWebsite,
    studyPortalUrl: "https://www.utp.edu.my/Pages/Admission/Home.aspx",
    internationalPageUrl: "https://www.utp.edu.my/Pages/Admission/International.aspx",
    applicationPortalUrl: dataset.university.applicationPortalUrl,
    officialAddress: dataset.university.location,
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: arr([]),
    chinaStudentRequirements: arr([]),
    officialProfile: {
      collectionScope: "UTP official bachelor, master and doctoral review import",
      applicantScope: dataset.applicantScope,
      academicSession: dataset.academicSession,
      currentAsOf: dataset.currentAsOf,
      officialDomains: dataset.officialDomains,
      sourceUniversityCode: dataset.universityCode,
      rankings: {
        qsWorld: utpQsWorld2027
      },
      authorization: publish ? "publish" : "review-import",
      workflowAcceptance: {
        officialPublishedProgrammes: 63,
        candidateProgrammes: 63,
        missingOfficialProgrammes: 0,
        publicReadyRows: publish ? summary.readyRows : 0,
        reviewRows: publish ? 0 : summary.needsReviewRows,
        publicLeakageExpected: 0
      },
      catalogStatusSummary: {
        all: {
          total: summary.importRows,
          ready: publish ? summary.readyRows : 0,
          needsReview: publish ? 0 : summary.needsReviewRows,
          notAvailableForInternational: 0
        },
        byLevel: {
          bachelor: { total: summary.byLevel.bachelor, ready: publish ? summary.byLevel.bachelor : 0, needsReview: publish ? 0 : summary.byLevel.bachelor, notAvailableForInternational: 0 },
          master: { total: summary.byLevel.master, ready: publish ? summary.byLevel.master : 0, needsReview: publish ? 0 : summary.byLevel.master, notAvailableForInternational: 0 },
          phd: { total: summary.byLevel.phd, ready: publish ? summary.byLevel.phd : 0, needsReview: publish ? 0 : summary.byLevel.phd, notAvailableForInternational: 0 }
        }
      }
    },
    officialSources,
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: publish ? "official-verified" : "needs-review",
    officialAuditSummary: publish
      ? "UTP official publication import: 63 official bachelor/master/phd programmes published as ready; 41 rows use official total fees and 22 research rows use authorized calculated totals from official annual international fees and official minimum full-time duration."
      : "UTP review-only import: 63 official bachelor/master/phd candidates imported as needs-review; official published URL coverage is closed, pending fee rows are resolved, and research fee rows use official annual/rate-based international amounts with explicit non-total display notes.",
    publicDisplayStatus: publish ? "ready" : "needs-review",
    livingCostOfficialNote: null,
    tuitionMinCny: annualTuitionCnyValues.length ? Math.min(...annualTuitionCnyValues) : 0,
    tuitionMaxCny: annualTuitionCnyValues.length ? Math.max(...annualTuitionCnyValues) : 0,
    livingCostCny: 0,
    minIelts: publish ? 5 : 0,
    acceptNoLanguage: false,
    facilities: arr([]),
    highlights: publish
      ? arr(
          ["Official bachelor/master/doctoral catalogue verified", "International applicant scope", "UTP source-linked fees and requirements"],
          ["Official bachelor/master/doctoral catalogue verified", "International applicant scope", "UTP source-linked fees and requirements"],
          ["本硕博官方目录已核验", "国际申请人范围", "UTP 官方来源费用与要求"],
          ["本碩博官方目錄已核驗", "國際申請人範圍", "UTP 官方來源費用與要求"]
        )
      : arr(["Official review import only"], ["Official review import only"], ["仅限后台审核"], ["僅限後台審核"]),
    programCount: summary.importRows,
    isPublished: publish
  };
}

export function summarizeUtpOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): UTPImportSummary {
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
    officialRateRows: rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified").length,
    calculatedFromOfficialRateRows: rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate").length,
    pendingFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "pending-review").length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

function verifyUtpImportedRecordSet(university: UniversityEntity, rows: ProgramEntity[], allUniversityRows: ProgramEntity[], options: UTPImportOptions = {}): UTPImportVerification {
  const summary = summarizeUtpOfficialAuditImport(rows);
  const publish = Boolean(options.publish);
  const publicLeakageRows = publish ? 0 : rows.filter((row) => row.isPublished || row.publicDisplayStatus === "ready").length;
  const adminNeedsReviewRows = allUniversityRows.filter((row) => row.publicDisplayStatus === "needs-review").length;
  const legacyActiveRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(UTP_OFFICIAL_AUDIT_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  ).length;
  const expectedReadyRows = publish ? 63 : 0;
  const expectedNeedsReviewRows = publish ? 0 : 63;
  const expectedPublishedRows = publish ? 63 : 0;
  const expectedOfficialRateRows = publish ? 0 : 22;
  const expectedCalculatedRows = publish ? 22 : 0;
  const expectedAdminNeedsReviewRows = publish ? 0 : 63;
  const expectedUniversityPublished = publish;
  const expectedUniversityStatus: PublicDisplayStatus = publish ? "ready" : "needs-review";
  const officialProfile = university.officialProfile as { rankings?: { qsWorld?: { rankDisplay?: string; year?: number; status?: string } } } | null;
  const qsWorld = officialProfile?.rankings?.qsWorld;
  if (
    rows.length !== 63 ||
    summary.byLevel.bachelor !== 15 ||
    summary.byLevel.master !== 37 ||
    summary.byLevel.phd !== 11 ||
    summary.readyRows !== expectedReadyRows ||
    summary.needsReviewRows !== expectedNeedsReviewRows ||
    summary.publishedRows !== expectedPublishedRows ||
    summary.officialTotalRows !== 41 ||
    summary.officialRateRows !== expectedOfficialRateRows ||
    summary.calculatedFromOfficialRateRows !== expectedCalculatedRows ||
    summary.pendingFeeRows !== 0 ||
    publicLeakageRows !== 0 ||
    adminNeedsReviewRows !== expectedAdminNeedsReviewRows ||
    legacyActiveRows !== 0 ||
    university.qsRank !== utpQsWorld2027.rankSort ||
    qsWorld?.rankDisplay !== utpQsWorld2027.rankDisplay ||
    qsWorld?.year !== QS_WORLD_RANKING_YEAR ||
    qsWorld?.status !== "ranked" ||
    university.isPublished !== expectedUniversityPublished ||
    university.publicDisplayStatus !== expectedUniversityStatus
  ) {
    throw new Error(
      `UTP import verification failed: ${JSON.stringify({
        summary,
        publicLeakageRows,
        adminNeedsReviewRows,
        legacyActiveRows,
        universityStatus: university.publicDisplayStatus,
        universityPublished: university.isPublished,
        universityQsRank: university.qsRank,
        universityQsWorld: qsWorld
      })}`
    );
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    universityQsRank: university.qsRank,
    universityQsRankDisplay: qsWorld?.rankDisplay || null,
    publicLeakageRows,
    adminNeedsReviewRows,
    legacyActiveRows
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number, options: UTPImportOptions = {}): Promise<UTPImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("UTP university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${UTP_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
  });
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifyUtpImportedRecordSet(university, rows, allUniversityRows, options);
}

function feePresentation(candidate: UTPCandidateProgramme, options: UTPImportOptions = {}): {
  amount: number | null;
  officialTuitionMYR: number | null;
  annualAmountMYR: number | null;
  currency: TuitionCurrency;
  display: string;
  sourceUrl: string;
  auditStatus: FeeAuditStatus;
  note: string;
} {
  const publish = Boolean(options.publish);
  const fee = candidate.fee;
  const amount = fee.tuitionAmount;
  const formatted = amount == null ? "RM official amount needs review" : `RM ${amount.toLocaleString("en-US")}`;
  if (fee.status === "verified-official-total" && fee.tuitionBasis === "total-programme" && amount != null) {
    return {
      amount,
      officialTuitionMYR: amount,
      annualAmountMYR: null,
      currency: "MYR",
      display: publish ? `${formatted} total tuition` : `${formatted} total programme`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "matched-official",
      note: publish
        ? `${fee.notes || "Official total fee captured from UTP evidence."} Published after UTP controlled release gates.`
        : `${fee.notes || "Official total fee captured from UTP evidence."} Imported as needs-review until non-fee ready gates pass.`
    };
  }

  if (fee.status === "official-rate-only") {
    if (publish && options.allowRateDerived && amount != null) {
      const durationYears = standardFeeDurationYears(candidate);
      const total = Math.round(amount * durationYears);
      const formula = `RM ${amount.toLocaleString("en-US")} official annual full-time fee x ${formatNumber(durationYears)} official minimum full-time year(s) = RM ${total.toLocaleString("en-US")}`;
      return {
        amount: total,
        officialTuitionMYR: total,
        annualAmountMYR: amount,
        currency: "MYR",
        display: `RM ${total.toLocaleString("en-US")} calculated total tuition`,
        sourceUrl: fee.officialFeeSourceUrl,
        auditStatus: "calculated-from-official-rate",
        note: `${fee.notes || "Research fees are published as annual/rate-based values."} StudyMY calculated the public full-duration total from UTP official annual international fee and official minimum full-time duration. Formula: ${formula}. Excludes separately charged viva, research methodology, extension, repeat, registration or other non-standard charges unless the official source states they are included.`
      };
    }
    return {
      amount: null,
      officialTuitionMYR: amount,
      annualAmountMYR: amount,
      currency: "MYR",
      display: amount == null ? "Official annual/rate-based fee, not full programme total" : `${formatted} official annual fee, not full programme total`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "official-rate-verified",
      note: `${fee.notes || "Research fees are published as annual/rate-based values."} StudyMY must not display this as full-duration total tuition without a separate approved calculation gate.`
    };
  }

  return {
    amount: null,
    officialTuitionMYR: amount,
    annualAmountMYR: amount,
    currency: "MYR",
    display: amount == null ? "Official fee requires review" : `${formatted} requires source-priority review`,
    sourceUrl: fee.officialFeeSourceUrl,
    auditStatus: "pending-review",
    note: `${fee.notes || "UTP fee evidence requires review."} Keep out of primary public total tuition until source-priority review is complete.`
  };
}

function sourceLinks(candidate: UTPCandidateProgramme, fee: ReturnType<typeof feePresentation>, publish = false): OfficialSourceLink[] {
  const urls = new Set([candidate.officialSourceUrl, fee.sourceUrl, candidate.level === "bachelor" ? defaultUndergraduateEntryRequirementUrl : defaultEntryRequirementUrl, ...(candidate.sourceUrls || [])].filter(Boolean));
  return Array.from(urls).map((url) => ({
    title: url === candidate.officialSourceUrl ? "Official programme page" : url === fee.sourceUrl ? "Official fee source" : "Official source",
    url,
    sourceType: url === fee.sourceUrl ? "fee" : /Entry-Requirement/i.test(url) ? "entry-requirement" : "profile",
    verifiedAt,
    status: publish ? "official-verified" : "needs-review",
    note: url === fee.sourceUrl ? fee.note : publish ? "Captured in UTP official publication audit batch." : "Captured in UTP official audit batch; remains review-only."
  }));
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

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function utpShortCode(level: UTPLevel, ordinal: number) {
  const prefix = level === "bachelor" ? "UG" : level === "master" ? "MA" : "PHD";
  return `UTP-${prefix}-${String(ordinal).padStart(3, "0")}`;
}

function localizedFaculty(facultyEn: string): LocalizedText {
  const translation = facultyLocalization[facultyEn];
  return t(facultyEn, facultyEn, translation?.zhCN || facultyEn, translation?.zhTW || translation?.zhCN || facultyEn);
}

function localizedProgramName(nameEn: string): LocalizedText {
  const translation = programNameLocalization[nameEn];
  return t(nameEn, nameEn, translation?.zhCN || nameEn, translation?.zhTW || translation?.zhCN || nameEn);
}

function annualTuitionCny(candidate: UTPCandidateProgramme, fee: ReturnType<typeof feePresentation>) {
  if (fee.officialTuitionMYR == null || fee.officialTuitionMYR <= 0) return 0;
  if (fee.auditStatus === "calculated-from-official-rate" && fee.annualAmountMYR != null) return Math.round(fee.annualAmountMYR * myrToCny);
  if (fee.auditStatus === "official-rate-verified") return Math.round(fee.officialTuitionMYR * myrToCny);
  const years = parseDurationYears(candidate.durationOfficial);
  if (fee.auditStatus === "matched-official" && years > 0) return Math.round((fee.officialTuitionMYR / years) * myrToCny);
  return Math.round(fee.officialTuitionMYR * myrToCny);
}

function standardFeeDurationYears(candidate: UTPCandidateProgramme) {
  return Math.max(parseDurationYears(candidate.durationOfficial), 1);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|mba|management|finance|accounting|economics|marketing/.test(value)) return "business";
  if (/computer|information|analytics|data|software|digital|technology/.test(value)) return "it";
  if (/engineering|petroleum|drilling|offshore|corrosion|process|asset|maintenance|electronic|mechanical|civil|chemical|electrical|materials|integrated/.test(value)) return "engineering";
  if (/geoscience|science|physics|chemistry|applied/.test(value)) return "science";
  return "arts";
}

function parseDurationYears(value: string) {
  const text = String(value || "");
  const yearsWithMonths = text.match(/(\d+(?:\.\d+)?)\s*years?\s*(\d+(?:\.\d+)?)?\s*months?/i);
  if (yearsWithMonths) {
    return Number(yearsWithMonths[1]) + (yearsWithMonths[2] ? Number(yearsWithMonths[2]) / 12 : 0);
  }
  const monthRange = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*months?/i);
  if (monthRange) return Number(monthRange[1]) / 12;
  const months = text.match(/(\d+(?:\.\d+)?)\s*months?/i);
  if (months) return Number(months[1]) / 12;
  const range = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*years?/i);
  if (range) return Number(range[1]);
  const years = text.match(/(\d+(?:\.\d+)?)\s*years?/i);
  if (years) return Number(years[1]);
  const semesters = text.match(/(\d+(?:\.\d+)?)\s*semesters?/i);
  if (semesters) return Number(semesters[1]) / 2;
  const number = text.match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : 1;
}

function studyModeDisplay(candidate: UTPCandidateProgramme) {
  const type = candidate.studyType || candidate.studyMode;
  const arrangement = String(candidate.studyArrangement || "").trim();
  if (!arrangement || arrangement.toLowerCase() === type.toLowerCase()) return normalizeText(type, 80);
  return normalizeText(`${type} / ${arrangement}`, 80);
}

function parseIntakeMonths(value: string) {
  const text = String(value || "");
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

function parseLanguageRequirement(value: string): LanguageRequirement {
  const text = String(value || "");
  const ielts = numberAfter(text, /IELTS\s*(?:Band)?\s*(\d+(?:\.\d+)?)/i);
  const toefl = numberAfter(text, /TOEFL(?:\s*iBT)?\s*(\d+)/i);
  const pte = numberAfter(text, /PTE\s*(\d+)/i);
  const muet = numberAfter(text, /MUET\s*(?:Band)?\s*(\d+(?:\.\d+)?)/i);
  return {
    ielts: ielts || 0,
    toefl: toefl || null,
    pte: pte || null,
    muet: muet || null
  };
}

function extractCgpaRequirement(value: string) {
  const text = normalizeLongText(value || "");
  if (!/\b(?:CGPA|GPA)\b/i.test(text)) return 0;

  const minimumMatch = text.match(/\bminimum\s+(?:CGPA|GPA)(?:\s+of)?\s*(\d(?:\.\d+)?)/i);
  if (minimumMatch?.[1]) return boundedCgpaValue(minimumMatch[1]);

  const cgpaMatch = text.match(/\b(?:CGPA|GPA)(?:\s+of)?\s*(\d(?:\.\d+)?)/i);
  if (cgpaMatch?.[1]) return boundedCgpaValue(cgpaMatch[1]);

  return 0;
}

function boundedCgpaValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 4 ? parsed : 0;
}

function numberAfter(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1] ? Number(match[1]) : null;
}

function fieldItems(field?: UTPFieldState) {
  const text = normalizeLongText(field?.officialText || "");
  if (!text || field?.status === "official-unpublished" || field?.status === "not-applicable") return [];
  return splitEvidenceList(text);
}

function courseSettingItems(candidate: UTPCandidateProgramme) {
  const courseItems = fieldItems(candidate.courseSetting);
  if (courseItems.length) return courseItems;
  return fieldItems(candidate.researchAreas);
}

function splitEvidenceList(value: string) {
  const text = normalizeLongText(value);
  if (!text) return [];
  return text
    .split(/\s+\*\s+|\n+-\s+|\n+\s*/)
    .map((item) => normalizeText(item, 240))
    .filter((item) => item.length > 12)
    .slice(0, 10);
}

function descriptionText(candidate: UTPCandidateProgramme) {
  const description = normalizeLongText(candidate.description || candidate.programmeDetails || "");
  if (description) return description;
  return `${candidate.nameEnOfficial} is an audited Universiti Teknologi PETRONAS ${candidate.level} candidate for international applicants. It remains in StudyMY review status until fee, requirement, language and localization gates pass.`;
}

function reviewReasonText(candidate: UTPCandidateProgramme, fee: ReturnType<typeof feePresentation>, options: UTPImportOptions = {}) {
  if (options.publish) {
    return fee.auditStatus === "calculated-from-official-rate"
      ? "Published by controlled UTP release with authorized calculated-from-official-rate tuition formula."
      : "Published by controlled UTP release after official-source and display gates."
  }
  const reasons = [
    ...(candidate.reviewReasons || []),
    candidate.fee.status !== "verified-official-total" ? `Fee review: ${candidate.fee.status}.` : "",
    fee.auditStatus === "official-rate-verified" ? "Rate-only fee must not become public total tuition without approval." : ""
  ].filter(Boolean);
  return normalizeLongText(reasons.join(" "));
}

function sourceLinkType(fields: string[], role: string): OfficialSourceLink["sourceType"] {
  const value = `${fields.join(" ")} ${role}`.toLowerCase();
  if (/fee|tuition/.test(value)) return "fee";
  if (/entry|language|requirement/.test(value)) return "entry-requirement";
  if (/admission|apply|application/.test(value)) return "admission";
  if (/institution|profile|home/.test(value)) return "profile";
  return "other";
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

async function main() {
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_UTP_OFFICIAL_AUDIT_CANDIDATE_PATH);
  const sourceRegistryPath = resolve(readArgValue("--source-registry") || DEFAULT_UTP_OFFICIAL_SOURCE_REGISTRY_PATH);
  if (!existsSync(candidatePath)) throw new Error(`UTP candidate dataset not found: ${candidatePath}`);
  const dataset = loadJson<UTPCandidateDataset>(candidatePath);
  const sourceRegistry = existsSync(sourceRegistryPath) ? loadJson<UTPSourceRegistry>(sourceRegistryPath) : null;
  const publish = process.argv.includes("--publish") || process.argv.includes("--confirm-publish");
  const allowRateDerived = process.argv.includes("--allow-rate-derived") || process.argv.includes("--allow-official-rate-calculation");
  const importOptions: UTPImportOptions = { publish, allowRateDerived };
  if (publish && !allowRateDerived) {
    throw new Error("UTP publication requires --allow-rate-derived so research annual/rate fees can be converted with explicit formula notes.");
  }
  const errors = validateUtpOfficialAuditDataset(dataset);
  if (errors.length) throw new Error(`UTP official audit candidate validation failed:\n${errors.join("\n")}`);

  const rows = buildUtpOfficialAuditRows(dataset, importOptions);
  const summary = summarizeUtpOfficialAuditImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import") || process.argv.includes("--confirm-publish");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/utp-official-audit-${publish ? "publish" : "review"}-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportOutput = readArgValue("--report-output");

  if (!verifyOnly && !confirm) {
    const report = {
      mode: "dry-run",
      universityCode: "UTP",
      candidatePath,
      sourceRegistryPath: sourceRegistry ? sourceRegistryPath : null,
      writePolicy: {
        authorization: publish ? "publish" : "review-import",
        requestedMode: publish ? "publish" : "review-import",
        rateDerivedFeePolicy: publish
          ? "Authorized by --allow-rate-derived; 22 research rows display calculated total tuition from official annual international fee x official minimum full-time duration with formula and exclusions in detail notes."
          : "Research rows are stored as official annual/rate-based values and are not displayed as public full-duration totals.",
        upsertPrefix: UTP_OFFICIAL_AUDIT_SLUG_PREFIX,
        importRows: 63,
        university: { isPublished: publish, publicDisplayStatus: publish ? "ready" : "needs-review" },
        programmes: { isPublished: publish, publicDisplayStatus: publish ? "ready" : "needs-review" },
        archiveLegacyRows:
          "Archive existing UTP bachelor/master/phd rows outside the UTP official-audit slug prefix so the admin review list shows exactly 63 current candidates.",
        publicLeakageExpected: 0,
        nextStep: publish
          ? "Review this dry-run, then rerun with --confirm-publish --publish --allow-rate-derived to create a scoped backup and write transactionally."
          : "Review this dry-run, then rerun with --confirm-import to create a scoped backup and write transactionally."
      },
      summary
    };
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "UTP" } })) ||
      (await universityRepo.findOne({ where: { slug: "universiti-teknologi-petronas" } }));
    if (verifyOnly) {
      if (!university) throw new Error("UTP university row not found.");
      const report = {
        mode: "verified",
        universityId: university.id,
        databaseUniversityCode: university.code,
        summary,
        verification: await verifyImportedRows(dataSource, university.id, importOptions)
      };
      if (reportOutput) {
        mkdirSync(dirname(resolve(reportOutput)), { recursive: true });
        writeFileSync(resolve(reportOutput), JSON.stringify(report, null, 2), "utf8");
      }
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: "universiti-teknologi-petronas" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug universiti-teknologi-petronas belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const targetUniversityCode = university?.code || "UTP";
    const targetShortName = university?.shortName || "UTP";

    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );

    let verification: UTPImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await txUniversityRepo.findOne({ where: { code: targetUniversityCode } });
      const universitySeed = buildUtpUniversityRow(dataset, summary, sourceRegistry, { ...importOptions, dbCode: targetUniversityCode, shortName: targetShortName });
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousOfficialAuditRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UTP_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
      });
      for (const previous of previousOfficialAuditRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }
      await txProgramRepo.update(
        {
          universityId: university.id,
          level: In(["bachelor", "master", "phd"]),
          slug: Not(Like(`${UTP_OFFICIAL_AUDIT_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: publish
            ? "Archived by the UTP official publication import to prevent stale UTP rows from mixing with the current 63-row official baseline."
            : "Archived by the UTP official-audit review import to prevent stale UTP rows from mixing with the current 63-row official baseline.",
          reviewReason: "Superseded by the 2026-06-19 UTP official bachelor/master/phd audit import."
        }
      );

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      university.programCount = summary.importRows;
      await txUniversityRepo.save(university);
      verification = await verifyImportedRows(manager, university.id, importOptions);
    });

    const catalogCacheCleared = await clearCatalogCache();
    const report = {
      mode: "imported",
      universityId: university?.id,
      backupPath,
      catalogCacheCleared,
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
