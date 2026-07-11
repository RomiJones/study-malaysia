import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, type DeepPartial, type EntityManager, In, Like, Not } from "typeorm";
import type {
  FeeAuditStatus,
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
export const UTM_PHD_IMPORT_SLUG_PREFIX = "utm-phd-official-2026-";
export const DEFAULT_UTM_PHD_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/utm/2026-06-18/phd/candidate-dataset.json"
);
export const DEFAULT_UTM_PHD_ROW_DISPOSAL_PATH = resolve(
  repositoryRoot,
  "data/imports/utm/2026-06-18/phd/skill-workflow-audit/04_official_row_disposal.json"
);

const verifiedAt = "2026-06-18";
const cnyPerMyr = 1.55;
const dppCode = "UTM-PHD-005";
const eddCode = "UTM-PHD-023";
const utmInternationalPostgraduateEntryRequirementUrl = "https://admission.utm.my/int-pg-entry-requirements/";
const utmOdlAdmissionRequirementUrl = "https://admission.utm.my/odl/";
const utmFestEddProgrammeUrl = "https://fest.utm.my/edd-programmes/";

type StudyMode = "coursework" | "mixed" | "research" | "distance";
type FeeStatus = "verified-official-total" | "conflict" | "official-rate-only" | "official-non-scalar";

interface UTMFee {
  status: FeeStatus;
  tuitionAmount: number | null;
  tuitionCurrency: "MYR";
  tuitionBasis: string;
  tuitionAcademicSession: string;
  officialFeeSourceUrl: string;
  tuitionDisplay: string;
  note: string;
}

interface UTMSourceUrls {
  facultyProgrammeList: string;
  programmeDetail?: string;
  internationalPostgraduate: string;
  fees: string;
  entryRequirements: string;
  englishRequirements: string;
  intake: string;
  applicationDocuments: string;
}

export interface UTMPhdCandidateRecord {
  ordinal: number;
  code: string;
  slug: string;
  universityCode: "UTM";
  nameEnOfficial: string;
  level: "phd";
  facultyEn: string;
  campus: string;
  studyMode: StudyMode;
  studyModeOfficial: string;
  applicantScope: "international";
  internationalEligibility: "available";
  academicSession: string;
  durationOfficial: string;
  durationYears: number | null;
  officialIntake: string;
  officialSourceUrl: string;
  officialVerifiedAt: string;
  fee: UTMFee;
  tuition: {
    status: FeeStatus;
    amountMYR: number | null;
    currency: "MYR";
    basis: string;
    sourceUrl: string;
    note: string;
  };
  tuitionAmount: number | null;
  tuitionCurrency: "MYR";
  officialTuitionMYR: number | null;
  officialFeeSourceUrl: string;
  officialFeeAuditStatus: FeeAuditStatus;
  officialFeeAuditedAt: string;
  academicRequirement: {
    status: string;
    sourceUrl: string;
    minimumGpa: number | null;
    summary: string;
    sourceText: string;
  };
  officialAcademicRequirement: string;
  languageRequirement: {
    status: string;
    sourceUrl: string;
    summary: string;
    sourceText: string;
    scores?: {
      muet?: number | null;
      ielts?: number | null;
      toeflIbt?: number | null;
      pteAcademic?: number | null;
      cambridgeCeq?: number | null;
      ciepElsLevel?: number | null;
    };
  };
  officialLanguageRequirement: string;
  applicationDocumentsPolicy: { status: string; sourceUrl: string; documents: string[] };
  sourceUrls: UTMSourceUrls;
  evidence: Array<Record<string, unknown>>;
  fieldCoverage: Record<string, string>;
  publicDisplayStatus: "ready";
  reviewReason: string;
  reviewedDecisions: string[];
}

export interface UTMPhdCandidateDataset {
  schemaVersion: number;
  universityCode: "UTM";
  institutionNameOfficial: "Universiti Teknologi Malaysia";
  level: "phd";
  applicantScope: "international";
  academicSession: string;
  officialDomains: string[];
  programmeCount: number;
  statusPartition: {
    ready: number;
    needsReview: number;
    notAvailableForInternational: number;
  };
  programmes: UTMPhdCandidateRecord[];
}

export interface UTMPhdOfficialRowDisposal {
  rowId: string;
  sourceId: string;
  sourceUrl: string;
  level: "phd";
  faculty: string;
  nameEnOfficial: string;
  status: "candidate" | "duplicate-of" | "needs-review" | "excluded-with-reason" | "not-available-for-international";
  candidateCode?: string;
  duplicateOf?: string;
  reason: string;
}

interface UTMPhdImportSummary {
  candidateRows: number;
  importRows: number;
  readyRows: number;
  uniqueSlugs: number;
  officialDurationRows: number;
  officialTotalFeeRows: number;
  calculatedFromOfficialRateRows: number;
  officialRateOnlyRows: number;
  officialNonScalarRows: number;
  noScalarTotalRows: number;
  officialAcademicRequirementRows: number;
  dppOfficialOccurrenceRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
  modes: Record<string, number>;
}

interface UTMPhdImportVerification {
  importedRows: number;
  readyRows: number;
  publishedRows: number;
  legacyPhdPublicRows: number;
  officialDurationRows: number;
  officialTotalFeeRows: number;
  calculatedFromOfficialRateRows: number;
  officialRateOnlyRows: number;
  officialNonScalarRows: number;
  noScalarTotalRows: number;
  officialAcademicRequirementRows: number;
  levelRows: number;
  languageRows: number;
  sourceLinkedRows: number;
  dppRows: number;
  dppOfficialOccurrenceLinks: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

const t = (en: string, zhCN = en, zhTW = zhCN, ms = en): LocalizedText => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], zhCN = en, zhTW = zhCN, ms = en): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

function countBy<T>(items: T[], getter: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item) || "unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function loadJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`UTM doctoral import artifact not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function normalizeText(value: string | null | undefined, maxLength = 1800) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const haystack = `${name} ${faculty}`.toLowerCase();
  if (/computer|software|artificial intelligence|data|cyber|information technology|informatics|multimedia/.test(haystack)) return "it";
  if (/architecture|planning|built environment|education|language|psychology|islamic|tourism|design|social|humanities|tesl/.test(haystack)) return "arts";
  if (/business|management|accounting|finance|entrepreneurship|administration/.test(haystack)) return "business";
  if (/engineering|geomatics|chemical|mechanical|electrical|electronic|petroleum|nuclear|marine|offshore|construction|process plant/.test(haystack)) {
    return "engineering";
  }
  return "science";
}

const traditionalCharacterMap = Object.fromEntries(
  [
    ["学", "學"], ["领", "領"], ["筑", "築"], ["环", "環"], ["境", "境"], ["结", "結"], ["构", "構"],
    ["运", "運"], ["输", "輸"], ["与", "與"], ["网", "網"], ["络", "絡"], ["证", "證"], ["项", "項"],
    ["气", "氣"], ["职", "職"], ["业", "業"], ["创", "創"], ["医", "醫"], ["电", "電"], ["无", "無"],
    ["线", "線"], ["机", "機"], ["复", "復"], ["术", "術"], ["资", "資"], ["开", "開"],
    ["发", "發"], ["数", "數"], ["课", "課"], ["评", "評"], ["询", "詢"], ["体", "體"], ["儿", "兒"],
    ["说", "說"], ["该", "該"], ["习", "習"], ["论", "論"], ["导", "導"],
    ["区", "區"], ["遥", "遙"], ["测", "測"], ["绘", "繪"], ["产", "產"], ["规", "規"], ["划", "劃"],
    ["计", "計"], ["软", "軟"], ["据", "據"], ["经", "經"], ["济", "濟"], ["预", "預"], ["灾", "災"],
    ["风", "風"], ["险", "險"], ["续", "續"], ["设", "設"], ["联", "聯"], ["双", "雙"], ["国", "國"],
    ["际", "際"], ["马", "馬"], ["来", "來"], ["亚", "亞"], ["汉", "漢"], ["兹", "茲"], ["践", "踐"],
    ["现", "現"], ["协", "協"],
    ["务", "務"], ["专", "專"], ["门", "門"], ["统", "統"], ["讯", "訊"], ["药", "藥"], ["护", "護"],
    ["临", "臨"], ["传", "傳"], ["销", "銷"], ["会", "會"], ["动", "動"], ["验", "驗"], ["应", "應"],
    ["艺", "藝"], ["译", "譯"], ["写", "寫"], ["阅", "閱"], ["离", "離"], ["岸", "岸"]
  ] as Array<[string, string]>
);

function toTraditional(value: string) {
  return Array.from(value).map((char) => traditionalCharacterMap[char] || char).join("");
}

const facultyZhMap: Record<string, string> = {
  "Azman Hashim International Business School": "阿兹曼哈希姆国际商学院",
  "Cross-faculty ODL collaboration": "跨学院 ODL 协作项目",
  "Engineering Education & Generic Programmes": "工程教育与通用课程",
  "Faculty of Artificial Intelligence": "人工智能学院",
  "Faculty of Built Environment and Surveying": "建筑环境与测量学院",
  "Faculty of Chemical and Energy Engineering": "化学与能源工程学院",
  "Faculty of Civil Engineering": "土木工程学院",
  "Faculty of Computing": "计算学院",
  "Faculty of Educational Sciences and Technology": "教育科学与技术学院",
  "Faculty of Electrical Engineering": "电气工程学院",
  "Faculty of Management": "管理学院",
  "Faculty of Mechanical Engineering": "机械工程学院",
  "Faculty of Science": "理学院",
  "Faculty of Social Science and Humanities": "社会科学与人文学院",
  "Islamic Civilization Academy": "伊斯兰文明学院",
  "Language Academy": "语言学院",
  "Malaysia-Japan International Institute of Technology": "马来西亚-日本国际技术学院",
  "School of HRD and Psychology": "人力资源开发与心理学学院"
};

const subjectZhMap: Record<string, string> = {
  "Bioprocess Engineering": "生物加工工程",
  "Biomedical Engineering": "生物医学工程",
  "Bioscience": "生物科学",
  "Business Administration": "工商管理",
  "Chemical Engineering": "化学工程",
  "Chemistry": "化学",
  "Chemistry Education": "化学教育",
  "Computer Science": "计算机科学",
  "Construction Technology and Management": "建筑技术与管理",
  "Curriculum and Instruction": "课程与教学",
  "Early Childhood Education": "学前教育",
  "Education and Development": "教育与发展",
  "Educational Psychology": "教育心理学",
  "Educational Technology": "教育技术",
  "Electrical Engineering": "电气工程",
  "Engineering Business Management": "工程商业管理",
  "Engineering Education": "工程教育",
  "Environmental Engineering": "环境工程",
  "Fiqh Science and Technology": "伊斯兰法学科学与技术",
  "Gas Engineering": "天然气工程",
  "Guidance and Counselling in Education": "教育指导与咨询",
  "Health Science": "健康科学",
  "Informatics Engineering": "信息工程",
  "Management": "管理学",
  "Management and Administration in Education": "教育管理与行政",
  "Mathematics": "数学",
  "Mathematics Education": "数学教育",
  "Mechanical Engineering": "机械工程",
  "Measurement and Evaluation in Education": "教育测量与评估",
  "Multimedia in Education": "教育多媒体",
  "Online Learning": "在线学习",
  "Petroleum Engineering": "石油工程",
  "Physical Education and Sports Science": "体育教育与运动科学",
  "Physics": "物理",
  "Physics Education": "物理教育",
  "Policy Studies": "政策研究",
  "Polymer Engineering": "高分子工程",
  "Process Plant Management": "工艺装置管理",
  "Software Engineering": "软件工程",
  "Teaching English as a Second Language (TESL)": "英语作为第二语言教学（TESL）",
  "Technical and Vocational Education": "技术与职业教育"
};

function translateSubject(value: string) {
  const normalized = normalizeText(value).replace(/^Field of Research\s*:?\s*/i, "").replace(/\s*&\s*/g, " and ");
  return subjectZhMap[normalized] || normalized;
}

function localizedProgrammeName(name: string): LocalizedText {
  const normalized = normalizeText(name);
  let zhCN = normalized;
  const fieldMatch = normalized.match(/^Doctor of Philosophy Field of Research\s*:?\s*(.*)$/i);
  const philosophyParenthesis = normalized.match(/^Doctor of Philosophy\s*\(\s*(.*?)\s*\)$/i);
  const engineeringSpecialization = normalized.match(/^Doctor of Engineering Specialization\s*:\s*(.*)$/i);
  const engineeringIn = normalized.match(/^Doctor of Engineering in\s+(.*)$/i);

  if (/^Doctor of Professional Practice \(DPP\)$/i.test(normalized)) {
    zhCN = "专业实践博士（DPP）";
  } else if (/^Doctor in Education \(EdD\)$/i.test(normalized)) {
    zhCN = "教育博士（EdD）";
  } else if (/^Doctor of Business Administration$/i.test(normalized)) {
    zhCN = "工商管理博士（DBA）";
  } else if (engineeringSpecialization) {
    zhCN = `工程博士（专业方向：${translateSubject(engineeringSpecialization[1])}）`;
  } else if (engineeringIn) {
    zhCN = `工程博士（${translateSubject(engineeringIn[1])}）`;
  } else if (fieldMatch) {
    const subject = translateSubject(fieldMatch[1]);
    zhCN = subject ? `哲学博士（研究领域：${subject}）` : "哲学博士（研究领域）";
  } else if (philosophyParenthesis) {
    const subject = translateSubject(philosophyParenthesis[1]);
    zhCN = /generic/i.test(philosophyParenthesis[1]) ? "哲学博士（通用研究方向）" : `哲学博士（${subject}）`;
  } else if (/^Doctor of Philosophy$/i.test(normalized)) {
    zhCN = "哲学博士";
  }
  return t(name, zhCN, toTraditional(zhCN), name);
}

function localizedFaculty(faculty: string): LocalizedText {
  const zhCN = facultyZhMap[faculty] || faculty;
  return t(faculty, zhCN, toTraditional(zhCN), faculty);
}

function normalizedDoctoralFocus(name: string) {
  const normalized = normalizeText(name);
  const fieldMatch = normalized.match(/^Doctor of Philosophy Field of Research\s*:?\s*(.*)$/i);
  if (fieldMatch?.[1]) {
    return { kind: "research-field" as const, value: normalizeText(fieldMatch[1]) };
  }
  const philosophyParenthesis = normalized.match(/^Doctor of Philosophy\s*\(\s*(.*?)\s*\)$/i);
  if (philosophyParenthesis?.[1] && !/generic/i.test(philosophyParenthesis[1])) {
    return { kind: "research-field" as const, value: normalizeText(philosophyParenthesis[1]) };
  }
  const engineeringSpecialization = normalized.match(/^Doctor of Engineering Specialization\s*:\s*(.*)$/i);
  if (engineeringSpecialization?.[1]) {
    return { kind: "specialization" as const, value: normalizeText(engineeringSpecialization[1]) };
  }
  const engineeringIn = normalized.match(/^Doctor of Engineering in\s+(.*)$/i);
  if (engineeringIn?.[1]) {
    return { kind: "specialization" as const, value: normalizeText(engineeringIn[1]) };
  }
  return null;
}

const eddConcentrations = [
  ["Educational Management & Administration", "教育管理与行政"],
  ["Guidance & Counselling", "指导与咨询"],
  ["Curriculum & Instruction", "课程与教学"],
  ["Educational Psychology", "教育心理学"],
  ["Physical Education & Sport Science", "体育教育与运动科学"],
  ["STEM Education", "STEM 教育"],
  ["Educational Technology", "教育技术"],
  ["Measurement & Evaluation", "测量与评估"],
  ["Technical & Vocational Education", "技术与职业教育"]
] as const;

function studyModeDisplay(mode: StudyMode, official: string) {
  if (mode === "distance") return official || "Open and Distance Learning";
  if (mode === "mixed") return official || "Mixed mode";
  if (mode === "research") return official || "Research";
  return official || "Coursework";
}

function durationYears(candidate: UTMPhdCandidateRecord) {
  if (candidate.durationYears) return candidate.durationYears;
  if (candidate.code === dppCode) return 3;
  return 0;
}

function formatYears(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} years`;
}

function semesterRangeToYearRange(value: string) {
  const rangeMatch = value.match(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*semesters?/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]) / 2;
    const max = Number(rangeMatch[2]) / 2;
    return {
      years: `${formatYears(min).replace(/\s+years$/, "")}-${formatYears(max)}`,
      semesters: `${rangeMatch[1]}-${rangeMatch[2]} semesters`
    };
  }
  const singleMatch = value.match(/(\d+(?:\.\d+)?)\s*semesters?/i);
  if (singleMatch) {
    return {
      years: formatYears(Number(singleMatch[1]) / 2),
      semesters: `${singleMatch[1]} semesters`
    };
  }
  return null;
}

function standardizedDurationOfficial(candidate: UTMPhdCandidateRecord) {
  const raw = normalizeText(candidate.durationOfficial, 700);
  if (/^Standardized duration:/i.test(raw)) return raw;
  if (candidate.code === dppCode || candidate.code === eddCode) {
    return `Standardized duration: 3-8 years (6-16 semesters). Official source: ${raw}`;
  }
  const semesterRange = semesterRangeToYearRange(raw);
  if (semesterRange) {
    return `Standardized duration: ${semesterRange.years} (${semesterRange.semesters}). Official source: ${raw}`;
  }
  const years = durationYears(candidate);
  return `Standardized duration: ${formatYears(years)}. Official source: ${raw}`;
}

function annualTuitionCny(totalMyr: number | null, years: number) {
  if (!totalMyr) return 0;
  return Math.round((totalMyr / Math.max(years, 1)) * cnyPerMyr);
}

function academicRequirementPresentation(candidate: UTMPhdCandidateRecord) {
  if (candidate.code === dppCode) {
    return {
      gpa: 0,
      sourceUrl: candidate.academicRequirement.sourceUrl || utmOdlAdmissionRequirementUrl,
      officialText: candidate.officialAcademicRequirement || candidate.academicRequirement.sourceText,
      note: t(
        "UTM ODL DPP official admission requirements include a master's degree from UTM or another Senate-recognised institution, equivalent qualifications with relevant experience, or approved conversion from a registered UTM master's programme; at least 3 years related working experience is required.",
        "UTM ODL DPP 官方入学要求包括硕士学位、参议会认可的同等资格与相关经验，或从已注册 UTM 硕士项目获批转换；相关领域至少 3 年工作经验。",
        "UTM ODL DPP 官方入學要求包括碩士學位、參議會認可的同等資格與相關經驗，或從已註冊 UTM 碩士項目獲批轉換；相關領域至少 3 年工作經驗。",
        "UTM ODL DPP official admission requirements include a master's degree, equivalent qualifications with relevant experience, or approved conversion from a registered UTM master's programme; at least 3 years related working experience is required."
      )
    };
  }
  if (candidate.code === eddCode) {
    return {
      gpa: 0,
      sourceUrl: candidate.academicRequirement.sourceUrl || utmFestEddProgrammeUrl,
      officialText: candidate.officialAcademicRequirement || candidate.academicRequirement.sourceText,
      note: t(
        "UTM FEST EdD specific admission requirements include a Bachelor's degree or equivalent, a Master's degree or equivalent, two (2) years of work experience in education or a related field, and a 500-1,000 word brief research proposal.",
        "UTM FEST EdD 官方专项入学要求包括学士学位或同等资格、硕士学位或同等资格、教育或相关领域 2 年工作经验，并提交 500-1,000 字研究计划简介。",
        "UTM FEST EdD 官方專項入學要求包括學士學位或同等資格、碩士學位或同等資格、教育或相關領域 2 年工作經驗，並提交 500-1,000 字研究計劃簡介。",
        "UTM FEST EdD specific admission requirements include a Bachelor's degree or equivalent, a Master's degree or equivalent, two (2) years of work experience in education or a related field, and a 500-1,000 word brief research proposal."
      )
    };
  }
  return {
    gpa: 0,
    sourceUrl: candidate.academicRequirement.sourceUrl || utmInternationalPostgraduateEntryRequirementUrl,
    officialText: candidate.officialAcademicRequirement || candidate.academicRequirement.sourceText,
    note: t(
      "UTM official entry requirement for Doctoral Degree by Mixed-Mode and Research: a Master's Degree from UTM or any other higher learning institution recognised by the Senate, or other equivalent qualification and relevant experience recognised by the Senate.",
      "UTM 官方混合模式与研究型博士入学要求：获得 UTM 或参议会认可高等教育机构的硕士学位，或参议会认可的同等资格与相关经验。",
      "UTM 官方混合模式與研究型博士入學要求：獲得 UTM 或參議會認可高等教育機構的碩士學位，或參議會認可的同等資格與相關經驗。",
      "UTM official entry requirement for Doctoral Degree by Mixed-Mode and Research: a Master's Degree from UTM or any other higher learning institution recognised by the Senate, or equivalent qualification and relevant experience recognised by the Senate."
    )
  };
}

function feePresentation(candidate: UTMPhdCandidateRecord): {
  amount: number | null;
  currency: TuitionCurrency;
  display: string;
  note: string;
  sourceUrl: string;
  auditStatus: FeeAuditStatus;
  officialTuitionMYR: number | null;
} {
  const fee = candidate.fee;
  if (fee.status === "verified-official-total") {
    const amount = fee.tuitionAmount ?? candidate.tuition.amountMYR;
    if (!amount) throw new Error(`Row ${candidate.ordinal} has verified-official-total without amount.`);
    return {
      amount,
      currency: "MYR",
      display: fee.tuitionDisplay || `MYR ${amount.toLocaleString("en-US")} total programme fee`,
      note: `UTM official international doctoral fee source: ${fee.note}`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "matched-official",
      officialTuitionMYR: amount
    };
  }
  if (candidate.code === dppCode && (fee.status === "official-non-scalar" || fee.status === "official-rate-only")) {
    return {
      amount: 71490,
      currency: "MYR",
      display: "MYR 71,490 calculated standard minimum total tuition",
      note: `UTM ODL DPP calculated standard minimum total tuition: MYR 2,670 registration fee + MYR 1,470 service fee x 6 official minimum semesters + MYR 750 study fee x 80 credits = MYR 71,490. UTM official ODL admission page publishes the international DPP fee range as RM 71,490 - RM 86,190 for 6-16 semesters, and the ODL fee structure states the actual study fee is charged based on enrolled credits. Official note: ${fee.note}`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "calculated-from-official-rate",
      officialTuitionMYR: 71490
    };
  }
  if (fee.status === "official-rate-only") {
    return {
      amount: null,
      currency: "MYR",
      display: "MYR 750 per credit",
      note: `UTM ODL official fee structure publishes international DPP study fee MYR 750 per credit, plus registration and service fees. No StudyMY scalar total is written because the official DPP duration is 6-16 semesters and enrolment credits can vary. Official note: ${fee.note}`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "official-rate-verified",
      officialTuitionMYR: null
    };
  }
  return {
    amount: null,
    currency: "MYR",
    display: "UTM publishes non-primary doctoral fee information; no single total programme fee is displayed.",
    note: `No StudyMY scalar total is written because UTM publishes more than one applicable fee value or a non-primary total. Official note: ${fee.note}`,
    sourceUrl: fee.officialFeeSourceUrl,
    auditStatus: "official-non-scalar",
    officialTuitionMYR: null
  };
}

function officialOccurrences(candidate: UTMPhdCandidateRecord, disposal: UTMPhdOfficialRowDisposal[]) {
  const matches = disposal.filter((row) => row.candidateCode === candidate.code || row.duplicateOf === candidate.code);
  if (matches.length) return matches;
  return [
    {
      rowId: `candidate-${candidate.code}`,
      sourceId: "candidate",
      sourceUrl: candidate.sourceUrls.facultyProgrammeList || candidate.officialSourceUrl,
      level: "phd" as const,
      faculty: candidate.facultyEn,
      nameEnOfficial: candidate.nameEnOfficial,
      status: "candidate" as const,
      candidateCode: candidate.code,
      reason: "Candidate source row."
    }
  ];
}

function sourceLinks(candidate: UTMPhdCandidateRecord, disposal: UTMPhdOfficialRowDisposal[]): OfficialSourceLink[] {
  const occurrenceRows = officialOccurrences(candidate, disposal);
  const programmeDetailUrl = candidate.sourceUrls.programmeDetail && candidate.sourceUrls.programmeDetail !== candidate.officialSourceUrl
    ? candidate.sourceUrls.programmeDetail
    : "";
  const links: OfficialSourceLink[] = [
    {
      title: candidate.code === dppCode
        ? "UTM official DPP ODL admission page"
        : candidate.code === eddCode
          ? "UTM FEST EdD official programme detail"
          : "UTM official doctoral programme list",
      url: candidate.officialSourceUrl,
      sourceType: "admission",
      verifiedAt,
      status: "official-verified"
    },
    ...(programmeDetailUrl
      ? [
          {
            title: candidate.code === eddCode ? "UTM FEST EdD official programme detail" : "UTM official doctoral programme detail",
            url: programmeDetailUrl,
            sourceType: "official-website" as const,
            verifiedAt,
            status: "official-verified" as const
          }
        ]
      : []),
    {
      title: "UTM official doctoral faculty programme list",
      url: candidate.sourceUrls.facultyProgrammeList,
      sourceType: "admission",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international postgraduate study",
      url: candidate.sourceUrls.internationalPostgraduate,
      sourceType: "admission",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: candidate.code === dppCode ? "UTM ODL DPP official fee range" : "UTM international postgraduate fee source",
      url: candidate.fee.officialFeeSourceUrl || candidate.sourceUrls.fees,
      sourceType: "fee",
      verifiedAt,
      status: "official-verified"
    },
    ...(candidate.code === dppCode
      ? [
          {
            title: "UTM ODL DPP per-credit fee structure",
            url: candidate.sourceUrls.fees,
            sourceType: "fee" as const,
            verifiedAt,
            status: "official-verified" as const
          }
        ]
      : []),
    {
      title: candidate.code === dppCode ? "UTM ODL DPP entry requirements" : "UTM international postgraduate entry requirements",
      url: candidate.sourceUrls.entryRequirements,
      sourceType: "entry-requirement",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM English language requirements",
      url: candidate.sourceUrls.englishRequirements,
      sourceType: "entry-requirement",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM postgraduate intake FAQ",
      url: candidate.sourceUrls.intake,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international student registration documents",
      url: candidate.sourceUrls.applicationDocuments,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified"
    },
    ...(candidate.code === dppCode
      ? occurrenceRows.map((row) => ({
          title: `UTM official DPP occurrence: ${row.faculty}`,
          url: row.sourceUrl,
          sourceType: "admission" as const,
          verifiedAt,
          status: "official-verified" as const,
          note: row.reason
        }))
      : [])
  ];
  return links.filter((link, index, array) => link.url && array.findIndex((item) => item.url === link.url && item.title === link.title) === index);
}

function programmeSpecializations(candidate: UTMPhdCandidateRecord, disposal: UTMPhdOfficialRowDisposal[]) {
  if (candidate.code === eddCode) {
    const en = eddConcentrations.map(([name]) => name);
    const zhCN = eddConcentrations.map(([, zh]) => zh);
    return arr(en, zhCN, zhCN.map(toTraditional), en);
  }
  const focus = normalizedDoctoralFocus(candidate.nameEnOfficial);
  if (focus?.kind === "specialization") {
    const zh = translateSubject(focus.value);
    return arr([focus.value], [zh], [toTraditional(zh)], [focus.value]);
  }
  if (candidate.code !== dppCode) return arr([]);
  const occurrenceRows = officialOccurrences(candidate, disposal);
  const en = occurrenceRows.map((row) => `Official DPP occurrence: ${row.faculty}`);
  const zhCN = occurrenceRows.map((row) => `官方 DPP 出现位置：${facultyZhMap[row.faculty] || row.faculty}`);
  return arr(en, zhCN, zhCN.map(toTraditional), en);
}

function doctoralCourseSetting(candidate: UTMPhdCandidateRecord): LocalizedStringArray {
  if (candidate.code === eddCode) {
    const concentrationsEn = eddConcentrations.map(([name]) => name).join("; ");
    const concentrationsZh = eddConcentrations.map(([, zh]) => zh).join("；");
    const zhCN = [
      "混合型博士结构：官方说明该 EdD 结合课程学习与论文/项目研究。",
      `教育方向：${concentrationsZh}。`
    ];
    return arr(
      [
        "Mixed Mode doctorate structure: the official EdD page states that the programme combines coursework and dissertation/project research.",
        `Education concentrations: ${concentrationsEn}.`
      ],
      zhCN,
      zhCN.map(toTraditional),
      [
        "Mixed Mode doctorate structure: the official EdD page states that the programme combines coursework and dissertation/project research.",
        `Education concentrations: ${concentrationsEn}.`
      ]
    );
  }
  const focus = normalizedDoctoralFocus(candidate.nameEnOfficial);
  if (!focus) return arr([]);
  const subjectZh = translateSubject(focus.value);
  if (focus.kind === "research-field") {
    const zh = `研究领域：${subjectZh}`;
    return arr([`Research field: ${focus.value}`], [zh], [toTraditional(zh)], [`Research field: ${focus.value}`]);
  }
  const zh = `博士专业方向：${subjectZh}`;
  return arr([`Doctoral specialization: ${focus.value}`], [zh], [toTraditional(zh)], [`Doctoral specialization: ${focus.value}`]);
}

function intakeMonthsForCandidate(candidate: UTMPhdCandidateRecord) {
  if (candidate.code === eddCode) return ["March", "October"];
  return ["February", "September"];
}

function intakeNoteForCandidate(candidate: UTMPhdCandidateRecord) {
  if (candidate.code === eddCode) return "Captured from the UTM FEST EdD programme detail page.";
  return "Captured from UTM official postgraduate admission FAQ and ODL intake page where applicable.";
}

function validateDppPolicy(dataset: UTMPhdCandidateDataset, disposal: UTMPhdOfficialRowDisposal[], errors: string[]) {
  const dppRows = dataset.programmes.filter((row) => row.nameEnOfficial === "Doctor of Professional Practice (DPP)");
  if (dppRows.length !== 1) errors.push(`Expected one canonical DPP programme; got ${dppRows.length}.`);
  const [dpp] = dppRows;
  if (!dpp) return;
  if (dpp.code !== dppCode) errors.push(`Expected DPP code ${dppCode}; got ${dpp.code}.`);
  if (dpp.facultyEn !== "Cross-faculty ODL collaboration") errors.push("DPP faculty must remain Cross-faculty ODL collaboration.");
  if (dpp.fee.status !== "official-rate-only" && dpp.fee.status !== "official-non-scalar") {
    errors.push("DPP fee must remain official-rate-only or official-non-scalar.");
  }
  const occurrenceRows = officialOccurrences(dpp, disposal);
  if (occurrenceRows.length !== 8) errors.push(`Expected 8 official DPP row occurrences; got ${occurrenceRows.length}.`);
  if (occurrenceRows.filter((row) => row.status === "duplicate-of").length !== 7) errors.push("Expected 7 DPP duplicate-of official row decisions.");
}

export function validateUtmPhdCandidate(dataset: UTMPhdCandidateDataset, disposal: UTMPhdOfficialRowDisposal[] = []) {
  const errors: string[] = [];
  if (dataset.universityCode !== "UTM") errors.push("Candidate universityCode must be UTM.");
  if (dataset.level !== "phd") errors.push("Candidate level must be phd.");
  if (dataset.applicantScope !== "international") errors.push("Candidate applicantScope must be international.");
  if (dataset.programmeCount !== dataset.programmes.length) errors.push("programmeCount must match programmes length.");
  if (dataset.programmes.length !== 55) errors.push(`Expected 55 canonical UTM doctoral rows; got ${dataset.programmes.length}.`);
  if (dataset.statusPartition.ready !== 55 || dataset.statusPartition.needsReview !== 0 || dataset.statusPartition.notAvailableForInternational !== 0) {
    errors.push("Expected UTM doctoral status partition to be 55 ready, 0 needs-review, 0 not-available-for-international.");
  }
  if (new Set(dataset.programmes.map((item) => item.code)).size !== dataset.programmes.length) errors.push("Candidate codes must be unique.");
  if (new Set(dataset.programmes.map((item) => item.slug)).size !== dataset.programmes.length) errors.push("Candidate slugs must be unique.");
  const feeCounts = countBy(dataset.programmes, (item) => item.fee.status);
  if (feeCounts["verified-official-total"] !== 54) errors.push(`Expected 54 verified official total fees; got ${feeCounts["verified-official-total"] || 0}.`);
  if (feeCounts["official-rate-only"] !== 1) errors.push(`Expected 1 official-rate-only row; got ${feeCounts["official-rate-only"] || 0}.`);
  if ((feeCounts["official-non-scalar"] || 0) !== 0) errors.push(`Expected 0 official-non-scalar rows; got ${feeCounts["official-non-scalar"] || 0}.`);
  validateDppPolicy(dataset, disposal, errors);
  for (const record of dataset.programmes) {
    if (record.level !== "phd") errors.push(`Row ${record.ordinal} is not doctoral level.`);
    if (record.applicantScope !== "international") errors.push(`Row ${record.ordinal} is not international applicant scope.`);
    if (record.internationalEligibility !== "available") errors.push(`Row ${record.ordinal} is not marked available to international applicants.`);
    if (record.publicDisplayStatus !== "ready") errors.push(`Row ${record.ordinal} is not ready.`);
    if (!record.nameEnOfficial) errors.push(`Row ${record.ordinal} has no official English name.`);
    if (!record.facultyEn) errors.push(`Row ${record.ordinal} has no faculty.`);
    if (!record.officialSourceUrl) errors.push(`Row ${record.ordinal} has no official source URL.`);
    if (!record.fee.officialFeeSourceUrl) errors.push(`Row ${record.ordinal} has no official fee source URL.`);
    if (!record.officialAcademicRequirement) errors.push(`Row ${record.ordinal} has no official academic requirement.`);
    if (!record.officialLanguageRequirement) errors.push(`Row ${record.ordinal} has no official language requirement.`);
    if (durationYears(record) <= 0) errors.push(`Row ${record.ordinal} has no standardized duration years.`);
    if (!/^Standardized duration:\s*(?:3 years|3-8 years)\b/i.test(record.durationOfficial)) {
      errors.push(`Row ${record.ordinal} duration is not standardized to years.`);
    }
    if (record.fee.status === "verified-official-total" && !record.fee.tuitionAmount) {
      errors.push(`Row ${record.ordinal} verified official total fee has no amount.`);
    }
  }
  return errors;
}

export function buildUtmPhdProgramRows(
  dataset: UTMPhdCandidateDataset,
  disposal: UTMPhdOfficialRowDisposal[] = []
): Array<DeepPartial<ProgramEntity>> {
  return dataset.programmes.map((candidate) => {
    const fee = feePresentation(candidate);
    const academicRequirement = academicRequirementPresentation(candidate);
    const faculty = localizedFaculty(candidate.facultyEn);
    const sourceStatus: OfficialSourceStatus = "official-verified";
    const publicDisplayStatus: PublicDisplayStatus = "ready";
    const applicationDocuments = candidate.applicationDocumentsPolicy.documents.length
      ? candidate.applicationDocumentsPolicy.documents
      : ["UTM offer letter", "Photo with white background", "Passport", "Academic certificates", "Academic transcripts", "Health Status Declaration Form"];
    const years = durationYears(candidate);
    const noScalarTotal = fee.officialTuitionMYR == null;
    const occurrenceRows = officialOccurrences(candidate, disposal);
    const dpp = candidate.code === dppCode;
    const edd = candidate.code === eddCode;
    return {
      slug: `${UTM_PHD_IMPORT_SLUG_PREFIX}${String(candidate.ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: candidate.code,
      name: localizedProgrammeName(candidate.nameEnOfficial),
      nameEnOfficial: candidate.nameEnOfficial,
      level: "phd",
      category: inferCategory(candidate.nameEnOfficial, candidate.facultyEn),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: studyModeDisplay(candidate.studyMode, candidate.studyModeOfficial),
      campus: candidate.campus,
      durationYears: years,
      durationOfficial: standardizedDurationOfficial(candidate),
      annualTuitionCny: annualTuitionCny(fee.officialTuitionMYR, years),
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: fee.officialTuitionMYR,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: candidate.sourceUrls.fees,
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: intakeMonthsForCandidate(candidate),
      officialIntake: normalizeText(candidate.officialIntake, 255),
      officialIntakeNote: intakeNoteForCandidate(candidate),
      languageRequirement: {
        ielts: candidate.languageRequirement.scores?.ielts ?? 6,
        toefl: candidate.languageRequirement.scores?.toeflIbt ?? null,
        pte: candidate.languageRequirement.scores?.pteAcademic ?? null,
        muet: candidate.languageRequirement.scores?.muet ?? null
      },
      officialLanguageRequirement: normalizeText(candidate.officialLanguageRequirement),
      requirement: {
        gpa: academicRequirement.gpa,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: academicRequirement.note
      },
      officialAcademicRequirement: normalizeText(academicRequirement.officialText),
      chinaStudentRequirement: "Chinese applicants must follow UTM international postgraduate academic, English, visa and registration document rules; final equivalency is assessed by UTM.",
      specialRequirementsNote: dpp
        ? "DPP is listed across 8 UTM faculty pages; StudyMY groups it as one cross-faculty ODL doctorate and retains every official occurrence in source links. The list amount is the standard minimum total calculated from official DPP registration, service, credit, credit-count, and minimum-semester evidence; the detail note retains the official 6-16 semester fee range."
        : edd
          ? "EdD is one Mixed Mode doctorate with multiple concentrations. UTM FEST also states flexible full-time and part-time pathways, two years of education-related work experience, and a 500-1,000 word brief research proposal."
        : noScalarTotal
          ? "Fee source is retained exactly as official evidence, but no single total programme fee is displayed because UTM does not publish one unique scalar total for this row."
          : `International eligibility status: ${candidate.internationalEligibility}.`,
      applicationDocs: arr(
        applicationDocuments,
        ["UTM 录取信", "白底照片", "护照", "学历证书", "成绩单", "健康状况声明表", "如适用，提交资格信/无异议信"],
        ["UTM 錄取信", "白底照片", "護照", "學歷證書", "成績單", "健康狀況聲明表", "如適用，提交資格信/無異議信"],
        applicationDocuments
      ),
      curriculum: doctoralCourseSetting(candidate),
      careers: arr([]),
      specializations: programmeSpecializations(candidate, disposal),
      description: dpp
        ? t(
            "Doctor of Professional Practice (DPP) is grouped as one cross-faculty UTM ODL doctorate. UTM lists the same DPP offering across 8 faculty pages; StudyMY keeps those official appearances in the source links.",
            "专业实践博士（DPP）按一个跨学院 UTM ODL 博士项目展示。UTM 在 8 个学院页面列出同一 DPP 项目，StudyMY 在来源链接中保留全部官方出现位置。",
            "專業實踐博士（DPP）按一個跨學院 UTM ODL 博士項目展示。UTM 在 8 個學院頁面列出同一 DPP 項目，StudyMY 在來源連結中保留全部官方出現位置。",
            "Doctor of Professional Practice (DPP) is grouped as one cross-faculty UTM ODL doctorate. UTM lists the same DPP offering across 8 faculty pages; StudyMY keeps those official appearances in the source links."
          )
        : edd
          ? t(
              "Doctor in Education (EdD) is a UTM FEST Mixed Mode doctorate combining coursework and dissertation, with flexible full-time and part-time pathways and multiple education concentrations.",
              "教育博士（EdD）是 UTM FEST 混合型博士项目，结合课程学习与论文/项目研究，提供全日制与非全日制灵活路径，并设有多个教育方向。",
              "教育博士（EdD）是 UTM FEST 混合型博士項目，結合課程學習與論文/項目研究，提供全日制與非全日制彈性路徑，並設有多個教育方向。",
              "Doctor in Education (EdD) is a UTM FEST Mixed Mode doctorate combining coursework and dissertation, with flexible full-time and part-time pathways and multiple education concentrations."
            )
        : t(
            `${candidate.nameEnOfficial} is listed by UTM for international doctoral admission under ${candidate.facultyEn}.`,
            `${candidate.nameEnOfficial} 已列入 UTM 国际博士招生目录，隶属 ${candidate.facultyEn}。`,
            `${candidate.nameEnOfficial} 已列入 UTM 國際博士招生目錄，隸屬 ${candidate.facultyEn}。`,
            `${candidate.nameEnOfficial} is listed by UTM for international doctoral admission under ${candidate.facultyEn}.`
          ),
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
      officialSourceUrl: candidate.officialSourceUrl,
      officialEntryRequirementSourceUrl: academicRequirement.sourceUrl,
      officialAccreditationSourceUrl: candidate.officialSourceUrl,
      sourceUrls: sourceLinks(candidate, disposal),
      officialVerifiedAt: verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: noScalarTotal
        ? "Published from official UTM doctoral sources; fee field displays official non-scalar evidence without a StudyMY single total amount."
        : dpp
          ? "Published from official UTM doctoral sources; DPP list tuition is the calculated standard minimum total from official DPP fee components."
          : "Published from official UTM doctoral sources; StudyMY localisations are non-official.",
      reviewReason: noScalarTotal ? `Official fee status retained: ${candidate.fee.status}. ${candidate.fee.note}` : null,
      auditNote: [
        `Imported from UTM doctoral official candidate ordinal ${candidate.ordinal}.`,
        `Official candidate slug: ${candidate.slug}.`,
        `Official mode: ${candidate.studyModeOfficial}.`,
        `Official row occurrences for this canonical programme: ${occurrenceRows.length}.`,
        `Fee status: ${candidate.fee.status}.`,
        `Field coverage: ${JSON.stringify(candidate.fieldCoverage)}.`,
        `Reviewed decisions: ${JSON.stringify(candidate.reviewedDecisions || [])}.`
      ].join(" "),
      listTuitionText: fee.display,
      isPublished: true
    };
  });
}

export function summarizeUtmPhdImport(
  dataset: UTMPhdCandidateDataset,
  rows: Array<DeepPartial<ProgramEntity>>,
  disposal: UTMPhdOfficialRowDisposal[] = []
): UTMPhdImportSummary {
  const dpp = dataset.programmes.find((row) => row.code === dppCode);
  return {
    candidateRows: dataset.programmes.length,
    importRows: rows.length,
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready" && row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialDurationRows: rows.filter((row) => Number(row.durationYears || 0) > 0 && /^Standardized duration:\s*(?:3 years|3-8 years)\b/i.test(String(row.durationOfficial))).length,
    officialTotalFeeRows: rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official").length,
    calculatedFromOfficialRateRows: rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate").length,
    officialRateOnlyRows: rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified").length,
    officialNonScalarRows: rows.filter((row) => row.officialFeeAuditStatus === "official-non-scalar").length,
    noScalarTotalRows: rows.filter((row) => row.officialTuitionMYR == null && row.tuitionAmount == null).length,
    officialAcademicRequirementRows: rows.filter((row) => String(row.officialAcademicRequirement || "").length > 0).length,
    dppOfficialOccurrenceRows: dpp ? officialOccurrences(dpp, disposal).length : 0,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus)),
    modes: countBy(rows, (row) => String(row.studyMode))
  };
}

function verifyUtmPhdImportedRecordSet(rows: ProgramEntity[], legacyPhdPublicRows: number, expectedRows: number): UTMPhdImportVerification {
  const readyRows = rows.filter((row) => row.publicDisplayStatus === "ready");
  const publishedRows = rows.filter((row) => row.isPublished);
  const officialDurationRows = rows.filter(
    (row) => Number(row.durationYears || 0) > 0 && /^Standardized duration:\s*(?:3 years|3-8 years)\b/i.test(String(row.durationOfficial))
  );
  const officialTotalFeeRows = rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official");
  const calculatedFromOfficialRateRows = rows.filter(
    (row) => row.officialTuitionMYR != null && row.tuitionAmount != null && row.officialFeeAuditStatus === "calculated-from-official-rate"
  );
  const officialRateOnlyRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified" && row.officialTuitionMYR == null);
  const officialNonScalarRows = rows.filter((row) => row.officialFeeAuditStatus === "official-non-scalar" && row.officialTuitionMYR == null);
  const noScalarTotalRows = rows.filter((row) => row.officialTuitionMYR == null && row.tuitionAmount == null).length;
  const officialAcademicRequirementRows = rows.filter((row) => String(row.officialAcademicRequirement || "").length > 0).length;
  const levelRows = rows.filter((row) => row.level === "phd").length;
  const languageRows = rows.filter((row) => Number(row.languageRequirement?.ielts || 0) >= 6).length;
  const sourceLinkedRows = rows.filter((row) => (row.sourceUrls || []).length >= 5).length;
  const dppRows = rows.filter((row) => row.code === dppCode);
  const dppOfficialOccurrenceLinks = dppRows[0]?.sourceUrls?.filter((link) => /^UTM official DPP occurrence:/.test(link.title)).length || 0;
  if (
    rows.length !== expectedRows ||
    readyRows.length !== expectedRows ||
    publishedRows.length !== expectedRows ||
    officialDurationRows.length !== expectedRows ||
    officialTotalFeeRows.length !== 54 ||
    calculatedFromOfficialRateRows.length !== 1 ||
    officialRateOnlyRows.length !== 0 ||
    officialNonScalarRows.length !== 0 ||
    noScalarTotalRows !== 0 ||
    officialAcademicRequirementRows !== expectedRows ||
    levelRows !== expectedRows ||
    languageRows !== expectedRows ||
    sourceLinkedRows !== expectedRows ||
    dppRows.length !== 1 ||
    dppOfficialOccurrenceLinks !== 8 ||
    legacyPhdPublicRows !== 0
  ) {
    throw new Error(
      `UTM doctoral import verification failed: expected=${expectedRows}, actual=${rows.length}, ready=${readyRows.length}, published=${publishedRows.length}, officialDurations=${officialDurationRows.length}, officialTotal=${officialTotalFeeRows.length}, calculated=${calculatedFromOfficialRateRows.length}, rateOnly=${officialRateOnlyRows.length}, nonScalar=${officialNonScalarRows.length}, noScalarTotal=${noScalarTotalRows}, academic=${officialAcademicRequirementRows}, level=${levelRows}, language=${languageRows}, sourceLinks=${sourceLinkedRows}, dpp=${dppRows.length}, dppOccurrenceLinks=${dppOfficialOccurrenceLinks}, legacyPublic=${legacyPhdPublicRows}.`
    );
  }
  return {
    importedRows: rows.length,
    readyRows: readyRows.length,
    publishedRows: publishedRows.length,
    legacyPhdPublicRows,
    officialDurationRows: officialDurationRows.length,
    officialTotalFeeRows: officialTotalFeeRows.length,
    calculatedFromOfficialRateRows: calculatedFromOfficialRateRows.length,
    officialRateOnlyRows: officialRateOnlyRows.length,
    officialNonScalarRows: officialNonScalarRows.length,
    noScalarTotalRows,
    officialAcademicRequirementRows,
    levelRows,
    languageRows,
    sourceLinkedRows,
    dppRows: dppRows.length,
    dppOfficialOccurrenceLinks,
    publicDisplayStatusCounts: countBy(rows, (row) => row.publicDisplayStatus),
    officialSourceStatusCounts: countBy(rows, (row) => row.officialSourceStatus),
    feeAuditStatusCounts: countBy(rows, (row) => row.officialFeeAuditStatus)
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number, expectedRows: number) {
  const repository = manager.getRepository(ProgramEntity);
  const rows = await repository.find({ where: { universityId, slug: Like(`${UTM_PHD_IMPORT_SLUG_PREFIX}%`) } });
  const legacyPhdPublicRows = await repository.count({
    where: {
      universityId,
      level: "phd",
      isPublished: true,
      publicDisplayStatus: "ready",
      slug: Not(Like(`${UTM_PHD_IMPORT_SLUG_PREFIX}%`))
    }
  });
  return verifyUtmPhdImportedRecordSet(rows, legacyPhdPublicRows, expectedRows);
}

async function visibleLevelSummary(repository: ReturnType<EntityManager["getRepository"]>, universityId: number, level: "bachelor" | "master" | "phd") {
  const rows = await repository.find({
    where: { universityId, level, isPublished: true, publicDisplayStatus: In(["ready", "current-cycle-not-open", "not-available-for-international"]) }
  });
  return {
    total: rows.length,
    ready: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    currentCycleNotOpen: rows.filter((row) => row.publicDisplayStatus === "current-cycle-not-open").length,
    needsReview: 0,
    notAvailableForInternational: rows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length
  };
}

async function updateUniversityAfterPhdImport(manager: EntityManager, university: UniversityEntity, summary: UTMPhdImportSummary) {
  const programRepo = manager.getRepository(ProgramEntity);
  const universityRepo = manager.getRepository(UniversityEntity);
  const bachelor = await visibleLevelSummary(programRepo, university.id, "bachelor");
  const master = await visibleLevelSummary(programRepo, university.id, "master");
  const phd = {
    total: summary.importRows,
    ready: summary.readyRows,
    currentCycleNotOpen: 0,
    needsReview: 0,
    notAvailableForInternational: 0
  };
  const all = {
    total: bachelor.total + master.total + phd.total,
    ready: bachelor.ready + master.ready + phd.ready,
    currentCycleNotOpen: bachelor.currentCycleNotOpen + master.currentCycleNotOpen + phd.currentCycleNotOpen,
    needsReview: 0,
    notAvailableForInternational: bachelor.notAvailableForInternational + master.notAvailableForInternational + phd.notAvailableForInternational
  };
  university.programCount = all.total;
  university.officialProfile = {
    ...(university.officialProfile || {}),
    collectionScope: "UTM official international bachelor, master and doctoral catalogue import",
    doctoralCollectionScope: "UTM official international postgraduate doctoral candidate import",
    doctoralAcademicSession: "2026/2027",
    cnyDisplayRateNote: `CNY display uses internal review conversion ${cnyPerMyr} CNY/MYR and is not an official UTM amount.`,
    catalogStatusSummary: {
      all,
      byLevel: { bachelor, master, phd }
    }
  };
  university.officialAuditSummary = `UTM official catalogue import: ${bachelor.total} bachelor rows, ${master.total} master rows, and ${phd.total} doctoral rows are public-visible from official UTM sources. Doctoral fees include ${summary.officialTotalFeeRows} official total rows and ${summary.calculatedFromOfficialRateRows} DPP row calculated from official DPP fee components; DPP is grouped as one cross-faculty ODL doctorate with ${summary.dppOfficialOccurrenceRows} official row occurrences retained as evidence.`;
  university.officialVerifiedAt = verifiedAt;
  university.officialSourceStatus = "official-verified";
  university.publicDisplayStatus = "ready";
  university.isPublished = true;
  await universityRepo.save(university);
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
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_UTM_PHD_CANDIDATE_PATH);
  const rowDisposalPath = resolve(readArgValue("--row-disposal") || DEFAULT_UTM_PHD_ROW_DISPOSAL_PATH);
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/utm-phd-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const dataset = loadJson<UTMPhdCandidateDataset>(candidatePath);
  const disposal = existsSync(rowDisposalPath) ? loadJson<UTMPhdOfficialRowDisposal[]>(rowDisposalPath) : [];
  const errors = validateUtmPhdCandidate(dataset, disposal);
  if (errors.length) throw new Error(`UTM doctoral candidate validation failed:\n${errors.join("\n")}`);
  const rows = buildUtmPhdProgramRows(dataset, disposal);
  const summary = summarizeUtmPhdImport(dataset, rows, disposal);
  const verifyOnly = process.argv.includes("--verify-only");
  const dryRun = !verifyOnly && !process.argv.includes("--confirm-import");

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          universityCode: "UTM",
          scope: "phd",
          candidatePath,
          rowDisposalPath,
          writePolicy: {
            upsertPrefix: UTM_PHD_IMPORT_SLUG_PREFIX,
            importRows: rows.length,
            publicVisibleRows: rows.length,
            publicReadyRows: rows.length,
            archiveLegacyPublicPhdRows: true,
            preserveBachelorRows: true,
            preserveMasterRows: true,
            dppDisplayPolicy: {
              canonicalRows: rows.filter((row) => row.code === dppCode).length,
              officialRowOccurrencesRetained: summary.dppOfficialOccurrenceRows,
              listDisplay: "one cross-faculty ODL doctorate",
              detailEvidence: "all official DPP faculty-page occurrences retained in source links and specialization chips"
            },
            feePolicy: {
              officialTotalRows: summary.officialTotalFeeRows,
              calculatedFromOfficialRateRows: summary.calculatedFromOfficialRateRows,
              officialRateOnlyRows: summary.officialRateOnlyRows,
              officialNonScalarRows: summary.officialNonScalarRows,
              nonScalarRowsDisplayNoStudyMYTotal: summary.noScalarTotalRows
            }
          },
          summary,
          nextStep: "Review this output, then rerun with --confirm-import to create a backup and write transactionally."
        },
        null,
        2
      )
    );
    return;
  }

  loadEnvFiles();
  const dataSource = new DataSource({
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

  await dataSource.initialize();
  try {
    const universityRepository = dataSource.getRepository(UniversityEntity);
    const university = await universityRepository.findOne({ where: { code: "UTM" } });
    if (!university) throw new Error("UTM university row not found.");

    if (verifyOnly) {
      const verification = await verifyImportedRows(dataSource, university.id, rows.length);
      console.log(JSON.stringify({ mode: "verified", universityId: university.id, summary, verification, universityProgramCount: university.programCount }, null, 2));
      return;
    }

    const currentPrograms = await dataSource.getRepository(ProgramEntity).find({ where: { universityId: university.id } });
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2), "utf8");

    let verification: UTMPhdImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const programRepo = manager.getRepository(ProgramEntity);
      const universityRepo = manager.getRepository(UniversityEntity);
      const transactionUniversity = await universityRepo.findOne({ where: { code: "UTM" } });
      if (!transactionUniversity) throw new Error("UTM university row not found inside transaction.");
      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const currentPhd = await programRepo.find({ where: { universityId: transactionUniversity.id, level: "phd" } });
      for (const existing of currentPhd) {
        if (incomingSlugs.has(existing.slug)) continue;
        if (existing.slug.startsWith(UTM_PHD_IMPORT_SLUG_PREFIX)) {
          await programRepo.remove(existing);
          continue;
        }
        existing.isPublished = false;
        existing.publicDisplayStatus = "archived";
        existing.publicDisplayNote = "Archived by UTM doctoral official import to prevent duplicate public-list leakage.";
        existing.reviewReason = "Superseded by the audited UTM official doctoral catalogue dataset.";
        await programRepo.save(existing);
      }

      for (const row of rows) {
        const existing = await programRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== transactionUniversity.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await programRepo.save(programRepo.create({ ...row, id: existing?.id, universityId: transactionUniversity.id }));
      }
      verification = await verifyImportedRows(manager, transactionUniversity.id, rows.length);
      await updateUniversityAfterPhdImport(manager, transactionUniversity, summary);
    });
    const cacheCleared = await clearCatalogCache();
    const refreshedUniversity = await universityRepository.findOne({ where: { code: "UTM" } });

    console.log(
      JSON.stringify(
        {
          mode: "imported",
          universityId: refreshedUniversity?.id,
          backupPath,
          summary,
          verification,
          universityProgramCount: refreshedUniversity?.programCount,
          cacheCleared
        },
        null,
        2
      )
    );
  } finally {
    await dataSource.destroy();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
