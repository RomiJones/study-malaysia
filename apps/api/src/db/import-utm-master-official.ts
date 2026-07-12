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
export const UTM_MASTER_IMPORT_SLUG_PREFIX = "utm-master-official-2026-";
export const DEFAULT_UTM_MASTER_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/utm/2026-06-17/master/candidate-dataset.json"
);

const verifiedAt = "2026-06-17";
const cnyPerMyr = 1.55;
const utmInternationalPostgraduateEntryRequirementUrl = "https://admission.utm.my/int-pg-entry-requirements/";
const utmOdlAdmissionRequirementUrl = "https://admission.utm.my/odl/";
const odlEducationCalculatedFee = {
  totalMYR: 34650,
  registrationFeeMYR: 2670,
  serviceFeePerSemesterMYR: 1470,
  standardSemesters: 4,
  studyFeePerCreditMYR: 580,
  totalCredits: 45,
  sourceText:
    "UTM ODL official international fee table publishes Registration Fees MYR 2,670, Service Fees MYR 1,470 every semester, and Master of Education international Study Fees MYR 580 for 01 credit. The official ODL admission page publishes matching Master of Education totals of MYR 34,650 without prerequisite; StudyMY calculates 2,670 + 1,470 x 4 + 580 x 45 = 34,650."
};

type StudyMode = "coursework" | "mixed" | "research" | "distance";
type FeeStatus = "verified-official-total" | "conflict" | "official-rate-only";

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
  internationalPostgraduate: string;
  fees: string;
  entryRequirements: string;
  englishRequirements: string;
  intake: string;
  applicationDocuments: string;
}

export interface UTMMasterCandidateRecord {
  ordinal: number;
  code: string;
  slug: string;
  universityCode: "UTM";
  nameEnOfficial: string;
  level: "master";
  facultyEn: string;
  campus: string;
  studyMode: StudyMode;
  studyModeOfficial: string;
  applicantScope: "international";
  internationalEligibility: "available";
  academicSession: string;
  durationOfficial: string;
  durationYears: number;
  officialIntake: string;
  officialSourceUrl: string;
  fee: UTMFee;
  tuition: {
    status: FeeStatus;
    amountMYR: number | null;
    currency: "MYR";
    basis: string;
    sourceUrl: string;
    note: string;
  };
  academicRequirement: { status: string; sourceUrl: string; summary: string };
  languageRequirement: {
    status: string;
    sourceUrl: string;
    summary: string;
    scores?: {
      muet?: number | null;
      ielts?: number | null;
      toeflIbt?: number | null;
      pteAcademic?: number | null;
      cambridgeCeq?: number | null;
      ciepElsLevel?: number | null;
    };
  };
  applicationDocumentsPolicy: { status: string; sourceUrl: string; documents: string[] };
  sourceUrls: UTMSourceUrls;
  evidence: Array<Record<string, unknown>>;
  fieldCoverage: Record<string, string>;
  publicDisplayStatus: "ready";
  reviewReason: string;
  reviewedDecisions: string[];
}

export interface UTMMasterCandidateDataset {
  universityCode: "UTM";
  level: "master";
  applicantScope: "international";
  academicSession: string;
  programmeCount: number;
  statusPartition: {
    ready: number;
    needsReview: number;
    notAvailableForInternational: number;
  };
  programmes: UTMMasterCandidateRecord[];
}

interface UTMMasterImportSummary {
  candidateRows: number;
  importRows: number;
  readyRows: number;
  uniqueSlugs: number;
  officialDurationRows: number;
  officialTotalFeeRows: number;
  calculatedFromOfficialRateRows: number;
  officialRateOnlyRows: number;
  conflictFeeRows: number;
  academicRequirementGpaRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
  modes: Record<string, number>;
}

interface UTMMasterImportVerification {
  importedRows: number;
  readyRows: number;
  publishedRows: number;
  legacyMasterPublicRows: number;
  officialDurationRows: number;
  officialTotalFeeRows: number;
  calculatedFromOfficialRateRows: number;
  officialRateOnlyRows: number;
  conflictFeeRows: number;
  noScalarTotalRows: number;
  academicRequirementGpaRows: number;
  levelRows: number;
  languageRows: number;
  sourceLinkedRows: number;
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
  if (!existsSync(path)) throw new Error(`UTM master candidate not found: ${path}`);
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
  if (/computer|software|artificial intelligence|data|cyber|information technology|multimedia/.test(haystack)) return "it";
  if (/architecture|planning|built environment|education|language|psychology|islamic|tourism|design|social/.test(haystack)) return "arts";
  if (/business|management|accounting|finance|entrepreneurship|administration/.test(haystack)) return "business";
  if (/engineering|geomatics|chemical|mechanical|electrical|electronic|petroleum|nuclear|marine|offshore|construction/.test(haystack)) {
    return "engineering";
  }
  return "science";
}

const traditionalCharacterMap = Object.fromEntries(
  [
    ["学", "學"], ["硕", "碩"], ["领", "領"], ["筑", "築"], ["环", "環"], ["结", "結"], ["构", "構"],
    ["运", "運"], ["输", "輸"], ["与", "與"], ["网", "網"], ["络", "絡"], ["证", "證"], ["项", "項"],
    ["气", "氣"], ["职", "職"], ["业", "業"], ["创", "創"], ["医", "醫"], ["电", "電"], ["无", "無"],
    ["线", "線"], ["机", "機"], ["复", "復"], ["技", "技"], ["术", "術"], ["资", "資"], ["开", "開"],
    ["发", "發"], ["数", "數"], ["课", "課"], ["评", "評"], ["询", "詢"], ["体", "體"], ["儿", "兒"],
    ["说", "說"], ["该", "該"], ["习", "習"], ["论", "論"], ["导", "導"],
    ["区", "區"], ["遥", "遙"], ["测", "測"], ["绘", "繪"], ["产", "產"], ["规", "規"], ["划", "劃"],
    ["计", "計"], ["软", "軟"], ["据", "據"], ["经", "經"], ["济", "濟"], ["预", "預"], ["灾", "災"],
    ["风", "風"], ["险", "險"], ["续", "續"], ["设", "設"], ["联", "聯"], ["双", "雙"], ["国", "國"],
    ["际", "際"], ["马", "馬"], ["来", "來"], ["亚", "亞"], ["汉", "漢"], ["兹", "茲"]
  ] as Array<[string, string]>
);

function toTraditional(value: string) {
  return Array.from(value).map((char) => traditionalCharacterMap[char] || char).join("");
}

const facultyZhMap: Record<string, string> = {
  "Azman Hashim International Business School": "阿兹曼哈希姆国际商学院",
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
  "Generic": "通用",
  "Engineering Education": "工程教育",
  "Civil": "土木工程",
  "Construction Management": "施工管理",
  "Environmental Management": "环境管理",
  "Structure": "结构工程",
  "Geotechnical Engineering": "岩土工程",
  "Hydraulics and Hydrology": "水力学与水文学",
  "Transportation Engineering": "交通工程",
  "Forensic Engineering": "法证工程",
  "Project Management": "项目管理",
  "Chemical Engineering": "化学工程",
  "Petroleum Engineering": "石油工程",
  "Gas Engineering": "天然气工程",
  "Gas Engineering and Management": "天然气工程与管理",
  "Energy Management": "能源管理",
  "Occupational Safety and Health": "职业安全与健康",
  "Occupational Safety and Health Management": "职业安全与健康管理",
  "Food Processing Innovation": "食品加工创新",
  "Bioprocess Engineering": "生物加工工程",
  "Polymer Engineering": "高分子工程",
  "Biomedical Engineering": "生物医学工程",
  "Wireless Communication and Network": "无线通信与网络",
  "Computer and Microelectronic Systems": "计算机与微电子系统",
  "Electrical Power and Energy": "电力与能源",
  "Mechatronics and Automatic Control": "机电一体化与自动控制",
  "Electrical Engineering": "电气工程",
  "Rehabilitation Technology": "康复技术",
  "Industrial Engineering": "工业工程",
  "Mechanical Engineering": "机械工程",
  "Science, Technology and Innovation Policy": "科学、技术与创新政策",
  "Policy Studies": "政策研究",
  "Human Resource Development": "人力资源开发",
  "Islamic Studies": "伊斯兰研究",
  "Halal Science": "清真科学",
  "Communication and Digital Culture": "传播与数字文化",
  "Chemistry": "化学",
  "Curriculum and Instruction": "课程与教学",
  "Education and Development": "教育与发展",
  "Educational Psychology": "教育心理学",
  "Educational Technology": "教育技术",
  "Guidance and Counselling": "指导与咨询",
  "Guidance and Counselling in Education": "教育指导与咨询",
  "Management and Administration": "管理与行政",
  "Management and Administration in Education": "教育管理与行政",
  "Mathematics": "数学",
  "Measurement and Evaluation": "测量与评估",
  "Measurement & Evaluation": "测量与评估",
  "Measurement and Evaluation in Education": "教育测量与评估",
  "Physics": "物理",
  "Teaching English as a Second Language": "英语作为第二语言教学",
  "Teaching English as a Second Language (TESL)": "英语作为第二语言教学（TESL）",
  "Technical and Vocational Education": "技术与职业教育",
  "Physical Education and Sports Science": "体育教育与运动科学",
  "Early Childhood Education": "学前教育",
  "Science": "科学",
  "Chemistry Education": "化学教育",
  "Mathematics Education": "数学教育",
  "Physics Education": "物理教育",
  "Multimedia in Education": "教育多媒体",
  "Online Learning": "在线学习",
  "Architecture": "建筑学",
  "Asset and Facilities Management": "资产与设施管理",
  "Construction Contract Management": "建筑合同管理",
  "Geoinformatics": "地理信息学",
  "Real Estate": "房地产",
  "Tourism Planning": "旅游规划",
  "Urban and Regional Planning": "城市与区域规划",
  "Remote Sensing": "遥感",
  "Geomatics Engineering": "测绘工程",
  "Land Administration and Development": "土地行政与发展",
  "Transportation Planning": "交通规划",
  "Data Science": "数据科学",
  "Innovative Computing": "创新计算",
  "Cyber Security": "网络安全",
  "Informatics": "信息学",
  "Information Security Assurance": "信息安全保障",
  "Software Engineering": "软件工程",
  "Computer Science": "计算机科学",
  "Technology Management": "技术管理",
  "Management": "管理学",
  "Forensic Science": "法证科学",
  "Biotechnology": "生物技术",
  "Engineering Mathematics": "工程数学",
  "Bioscience": "生物科学",
  "Business Administration": "工商管理",
  "Computer Systems Engineering": "计算机系统工程",
  "Business Intelligence and Analytics": "商业智能与分析",
  "Engineering Business Management": "工程商业管理",
  "Engineering Design": "工程设计",
  "Professional Science": "专业科学",
  "Systems Engineering": "系统工程",
  "Sustainable Infrastructure": "可持续基础设施",
  "Industrial Design": "工业设计",
  "Disaster Risk Management": "灾害风险管理",
  "Sustainability and Environmental Sciences": "可持续发展与环境科学",
  "Sustainable Systems": "可持续系统",
  "Technology and Innovation Management": "技术与创新管理",
  "Sustainable Urban Design": "可持续城市设计",
  "Electronic Systems Engineering": "电子系统工程",
  "Management of Technology": "技术管理"
};

function translateSubject(value: string) {
  const normalized = normalizeText(value).replace(/^Field of Research\s*:?\s*/i, "").replace(/\s*&\s*/g, " and ");
  return subjectZhMap[normalized] || normalized;
}

function localizedProgrammeName(name: string): LocalizedText {
  const normalized = normalizeText(name);
  let zhCN = normalized;
  const fieldMatch = normalized.match(/^Master of Philosophy Field of Research\s*:?\s*(.*)$/i);
  const mPhilParenthesis = normalized.match(/^Master of Philosophy\s*\(\s*(.*?)\s*\)$/i);
  const educationSpecialization = normalized.match(/^Master in Education Specialization\s*:\s*(.*)$/i);
  const managementSpecialization = normalized.match(/^Master of Management Specialization\s*:\s*(.*)$/i);
  const engineeringSpecialization = normalized.match(/^Master of Engineering Specialization\s*:\s*(.*)$/i);
  const scienceParenthesis = normalized.match(/^Master of Science\s*\(\s*(.*?)\s*\)$/i);
  const educationParenthesis = normalized.match(/^Master of Education\s*\(\s*(.*?)\s*\)$/i);
  const engineeringParenthesis = normalized.match(/^Master of Engineering\s*\(\s*(.*?)\s*\)$/i);
  const scienceIn = normalized.match(/^Master of Science in\s+(.*)$/i);
  const engineeringIn = normalized.match(/^Master of Engineering in\s+(.*)$/i);
  const masterIn = normalized.match(/^Master in\s+(.*)$/i);
  const masterOf = normalized.match(/^Master of\s+(.*)$/i);

  if (/^Dual Degree - Master of Science \(Mechanical Engineering\) UTM and Master of Engineering \(Kyushu University\)$/i.test(normalized)) {
    zhCN = "双学位：机械工程理学硕士（UTM）与工程硕士（九州大学）";
  } else if (/^Dual Degree - Master of Science \(Mechanical Engineering\) UTM and Master of Science \(Pusan National University\)$/i.test(normalized)) {
    zhCN = "双学位：机械工程理学硕士（UTM）与理学硕士（釜山国立大学）";
  } else if (/^Dual Degree Master in Technology and Innovation Management \(UTM\) and Master in Management of Technology \(Yamaguchi University\)$/i.test(normalized)) {
    zhCN = "双学位：技术与创新管理硕士（UTM）与技术管理硕士（山口大学）";
  } else if (/^Master of Sustainability and Environmental Sciences \(Joint Degree\) with Tsukuba University$/i.test(normalized)) {
    zhCN = "可持续发展与环境科学硕士（与筑波大学联合学位）";
  } else if (fieldMatch) {
    const subject = translateSubject(fieldMatch[1]);
    zhCN = subject ? `哲学硕士（研究领域：${subject}）` : "哲学硕士（研究领域）";
  } else if (mPhilParenthesis) {
    zhCN = `哲学硕士（${translateSubject(mPhilParenthesis[1])}）`;
  } else if (normalized === "Master of Philosophy") {
    zhCN = "哲学硕士";
  } else if (educationSpecialization) {
    zhCN = `教育硕士（专业方向：${translateSubject(educationSpecialization[1])}）`;
  } else if (managementSpecialization) {
    zhCN = `管理硕士（专业方向：${translateSubject(managementSpecialization[1])}）`;
  } else if (engineeringSpecialization) {
    zhCN = `工程硕士（专业方向：${translateSubject(engineeringSpecialization[1])}）`;
  } else if (educationParenthesis) {
    zhCN = `教育硕士（${translateSubject(educationParenthesis[1])}）`;
  } else if (engineeringParenthesis) {
    zhCN = `工程硕士（${translateSubject(engineeringParenthesis[1])}）`;
  } else if (scienceParenthesis) {
    zhCN = `理学硕士（${translateSubject(scienceParenthesis[1])}）`;
  } else if (scienceIn) {
    zhCN = `${translateSubject(scienceIn[1])}理学硕士`;
  } else if (engineeringIn) {
    zhCN = `工程硕士（${translateSubject(engineeringIn[1])}）`;
  } else if (/^Master of Education Teaching English as a Second Language \(TESL\)$/i.test(normalized)) {
    zhCN = "教育硕士（英语作为第二语言教学 TESL）";
  } else if (/^Master of Language in Communication and Digital Culture$/i.test(normalized)) {
    zhCN = "传播与数字文化语言硕士";
  } else if (masterIn) {
    zhCN = `${translateSubject(masterIn[1])}硕士`;
  } else if (masterOf) {
    const subject = translateSubject(masterOf[1]);
    zhCN = subject === "Business Administration" || subject === "工商管理" ? "工商管理硕士（MBA）" : `${subject}硕士`;
  }
  return t(name, zhCN, toTraditional(zhCN), name);
}

function localizedFaculty(faculty: string): LocalizedText {
  const zhCN = facultyZhMap[faculty] || faculty;
  return t(faculty, zhCN, toTraditional(zhCN), faculty);
}

function normalizedMasterFocus(name: string) {
  const normalized = normalizeText(name);
  const fieldMatch = normalized.match(/^Master of Philosophy Field of Research\s*:?\s*(.*)$/i);
  if (fieldMatch?.[1]) {
    return { kind: "research-field" as const, value: normalizeText(fieldMatch[1]) };
  }
  const specializationMatch = normalized.match(/Specialization\s*:?\s*(.*)$/i);
  if (specializationMatch?.[1]) {
    return { kind: "specialization" as const, value: normalizeText(specializationMatch[1]) };
  }
  return null;
}

function masterCourseSetting(candidate: UTMMasterCandidateRecord): LocalizedStringArray {
  const focus = normalizedMasterFocus(candidate.nameEnOfficial);
  if (!focus) return arr([]);
  const subjectZh = translateSubject(focus.value);
  if (focus.kind === "research-field") {
    const zh = `研究领域：${subjectZh}`;
    return arr(
      [`Research field: ${focus.value}`],
      [zh],
      [toTraditional(zh)],
      [`Research field: ${focus.value}`]
    );
  }
  const zh = `官方专业方向：${subjectZh}`;
  return arr(
    [`Official specialization: ${focus.value}`],
    [zh],
    [toTraditional(zh)],
    [`Official specialization: ${focus.value}`]
  );
}

function masterSpecializations(candidate: UTMMasterCandidateRecord): LocalizedStringArray {
  const focus = normalizedMasterFocus(candidate.nameEnOfficial);
  if (!focus || focus.kind !== "specialization") return arr([]);
  const zh = translateSubject(focus.value);
  return arr([focus.value], [zh], [toTraditional(zh)], [focus.value]);
}

function studyModeDisplay(mode: StudyMode, official: string) {
  if (mode === "distance") {
    const arrangement = official || "Open and Distance Learning";
    return /coursework|mixed|research/i.test(arrangement) ? arrangement : `Coursework / ${arrangement}`;
  }
  if (mode === "mixed") return official || "Mixed mode";
  if (mode === "research") return official || "Research";
  return official || "Coursework";
}

function isOdlCandidate(candidate: UTMMasterCandidateRecord) {
  return /open\s+and\s+distance\s+learning|\bodl\b/i.test(candidate.studyModeOfficial);
}

function formatYears(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} years`;
}

function semesterEvidenceText(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)?)\s*semesters?/i);
  return match?.[1]?.replace(/\s*[-–—]\s*/g, "-");
}

function standardizedDurationOfficial(candidate: UTMMasterCandidateRecord) {
  const raw = normalizeText(candidate.durationOfficial, 600);
  if (/^Standardized duration:/i.test(raw)) return raw;
  const semesters = semesterEvidenceText(raw);
  const semesterNote = semesters ? ` (${semesters} semesters)` : "";
  return `Standardized duration: ${formatYears(candidate.durationYears)}${semesterNote}. Official source: ${raw}`;
}

function annualTuitionCny(totalMyr: number | null, years: number) {
  if (!totalMyr) return 0;
  return Math.round((totalMyr / Math.max(years, 1)) * cnyPerMyr);
}

function academicRequirementPresentation(candidate: UTMMasterCandidateRecord) {
  const name = candidate.nameEnOfficial.toLowerCase();
  if (isOdlCandidate(candidate)) {
    return {
      gpa: 2.5,
      sourceUrl: utmOdlAdmissionRequirementUrl,
      officialText:
        "UTM ODL official admission requirement: a recognised Bachelor's Degree with good honours with minimum CGPA 2.5/4.0 or equivalent. International applicants must also satisfy academic admission and English language proficiency requirements.",
      note: t(
        "UTM ODL official admission requirement: a recognised Bachelor's Degree with good honours with minimum CGPA 2.5/4.0 or equivalent. International applicants must also satisfy academic admission and English language proficiency requirements.",
        "UTM ODL 官方入学要求：认可本科荣誉学位，最低 CGPA 2.5/4.0 或同等资格；国际申请人还须满足学术录取与英语能力要求。",
        "UTM ODL 官方入學要求：認可本科榮譽學位，最低 CGPA 2.5/4.0 或同等資格；國際申請人還須滿足學術錄取與英語能力要求。",
        "Syarat kemasukan rasmi ODL UTM: Ijazah Sarjana Muda yang diiktiraf dengan kepujian baik dan minimum CGPA 2.5/4.0 atau setara. Pemohon antarabangsa juga mesti memenuhi syarat akademik dan kemahiran bahasa Inggeris."
      )
    };
  }
  if (name.includes("master of business administration")) {
    return {
      gpa: 3.5,
      sourceUrl: utmInternationalPostgraduateEntryRequirementUrl,
      officialText:
        "UTM official MBA entry requirement: CPA 3.50 and above requires no working experience; CPA 3.00 to 3.49 requires 2 years working experience in the related field; CPA 2.00 to 2.99 requires 5 years working experience in the related field.",
      note: t(
        "UTM official MBA entry requirement: CPA 3.50 and above requires no working experience; CPA 3.00 to 3.49 requires 2 years related working experience; CPA 2.00 to 2.99 requires 5 years related working experience.",
        "UTM 官方 MBA 入学要求：CPA 3.50 及以上无需工作经验；CPA 3.00 至 3.49 需 2 年相关工作经验；CPA 2.00 至 2.99 需 5 年相关工作经验。",
        "UTM 官方 MBA 入學要求：CPA 3.50 及以上無需工作經驗；CPA 3.00 至 3.49 需 2 年相關工作經驗；CPA 2.00 至 2.99 需 5 年相關工作經驗。",
        "Syarat kemasukan rasmi MBA UTM: CPA 3.50 dan ke atas tidak memerlukan pengalaman kerja; CPA 3.00 hingga 3.49 memerlukan 2 tahun pengalaman kerja berkaitan; CPA 2.00 hingga 2.99 memerlukan 5 tahun pengalaman kerja berkaitan."
      )
    };
  }
  if (name === "master of architecture") {
    return {
      gpa: 2.3,
      sourceUrl: utmInternationalPostgraduateEntryRequirementUrl,
      officialText:
        "UTM official Master of Architecture entry requirement: Bachelor of Science in Architecture/Degree in Architecture with CPA 3.0 to 4.0 requires 6 months working experience in an architectural firm; CPA 2.7 to 2.99 requires 12 months; CPA 2.5 to 2.69 requires 24 months; CPA 2.3 to 2.49 requires 36 months. International candidates must obtain LAM Part 1 certificate before applying.",
      note: t(
        "UTM official Master of Architecture entry requirement: CPA 3.0 to 4.0 requires 6 months architectural-firm experience; CPA 2.7 to 2.99 requires 12 months; CPA 2.5 to 2.69 requires 24 months; CPA 2.3 to 2.49 requires 36 months. International candidates must obtain LAM Part 1 certificate before applying.",
        "UTM 官方建筑学硕士入学要求：建筑科学本科/建筑学学位背景；CPA 3.0 至 4.0 需 6 个月建筑事务所经验，CPA 2.7 至 2.99 需 12 个月，CPA 2.5 至 2.69 需 24 个月，CPA 2.3 至 2.49 需 36 个月。国际申请人申请前必须取得 LAM Part 1 证书。",
        "UTM 官方建築學碩士入學要求：建築科學本科/建築學學位背景；CPA 3.0 至 4.0 需 6 個月建築事務所經驗，CPA 2.7 至 2.99 需 12 個月，CPA 2.5 至 2.69 需 24 個月，CPA 2.3 至 2.49 需 36 個月。國際申請人申請前必須取得 LAM Part 1 證書。",
        "Syarat kemasukan rasmi Sarjana Seni Bina UTM: CPA 3.0 hingga 4.0 memerlukan 6 bulan pengalaman firma seni bina; CPA 2.7 hingga 2.99 memerlukan 12 bulan; CPA 2.5 hingga 2.69 memerlukan 24 bulan; CPA 2.3 hingga 2.49 memerlukan 36 bulan. Calon antarabangsa mesti memperoleh sijil LAM Part 1 sebelum memohon."
      )
    };
  }
  if (candidate.studyMode === "research" || candidate.studyMode === "mixed") {
    return {
      gpa: 2.75,
      sourceUrl: utmInternationalPostgraduateEntryRequirementUrl,
      officialText:
        "UTM official entry requirement for Master by Mixed-Mode and Research programme: CPA Scale of 4 at 2.75 or higher requires no working experience; 2.50 < CPA < 2.75 is subject to rigorous internal assessment; CPA below 2.50 requires 5 years working experience in the related field.",
      note: t(
        "UTM official entry requirement for Master by Mixed-Mode and Research programme: CPA 2.75/4.00 or higher requires no working experience; 2.50 < CPA < 2.75 is subject to rigorous internal assessment; CPA below 2.50 requires 5 years related working experience.",
        "UTM 官方混合模式/研究型硕士入学要求：CPA 2.75/4.00 及以上无需工作经验；2.50 < CPA < 2.75 需经过严格内部评估；CPA 低于 2.50 需 5 年相关工作经验。",
        "UTM 官方混合模式/研究型碩士入學要求：CPA 2.75/4.00 及以上無需工作經驗；2.50 < CPA < 2.75 需經過嚴格內部評估；CPA 低於 2.50 需 5 年相關工作經驗。",
        "Syarat kemasukan rasmi UTM untuk sarjana mod campuran dan penyelidikan: CPA 2.75/4.00 atau lebih tinggi tidak memerlukan pengalaman kerja; 2.50 < CPA < 2.75 tertakluk kepada penilaian dalaman yang ketat; CPA di bawah 2.50 memerlukan 5 tahun pengalaman kerja berkaitan."
      )
    };
  }
  return {
    gpa: 2.5,
    sourceUrl: utmInternationalPostgraduateEntryRequirementUrl,
    officialText:
      "UTM official entry requirement for Master by Coursework programme: CPA Scale of 4 at 2.50 or higher requires no working experience; CPA below 2.50 requires 5 years working experience in the related field.",
    note: t(
      "UTM official entry requirement for Master by Coursework programme: CPA 2.50/4.00 or higher requires no working experience; CPA below 2.50 requires 5 years related working experience.",
      "UTM 官方授课型硕士入学要求：CPA 2.50/4.00 及以上无需工作经验；CPA 低于 2.50 需 5 年相关工作经验。",
      "UTM 官方授課型碩士入學要求：CPA 2.50/4.00 及以上無需工作經驗；CPA 低於 2.50 需 5 年相關工作經驗。",
      "Syarat kemasukan rasmi UTM untuk sarjana kerja kursus: CPA 2.50/4.00 atau lebih tinggi tidak memerlukan pengalaman kerja; CPA di bawah 2.50 memerlukan 5 tahun pengalaman kerja berkaitan."
    )
  };
}

function feePresentation(candidate: UTMMasterCandidateRecord): {
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
      note: `UTM official international postgraduate fee source: ${fee.note}`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "matched-official",
      officialTuitionMYR: amount
    };
  }
  if (fee.status === "official-rate-only") {
    if (/^Master in Education Specialization\s*:/i.test(candidate.nameEnOfficial)) {
      return {
        amount: odlEducationCalculatedFee.totalMYR,
        currency: "MYR",
        display: `MYR ${odlEducationCalculatedFee.totalMYR.toLocaleString("en-US")} calculated total tuition`,
        note: `StudyMY calculated the UTM ODL international education master total from official rates and the standard fee structure: MYR ${odlEducationCalculatedFee.registrationFeeMYR.toLocaleString("en-US")} registration fee + MYR ${odlEducationCalculatedFee.serviceFeePerSemesterMYR.toLocaleString("en-US")} service fee x ${odlEducationCalculatedFee.standardSemesters} semesters + MYR ${odlEducationCalculatedFee.studyFeePerCreditMYR.toLocaleString("en-US")} study fee x ${odlEducationCalculatedFee.totalCredits} credits = MYR ${odlEducationCalculatedFee.totalMYR.toLocaleString("en-US")}. ${odlEducationCalculatedFee.sourceText}`,
        sourceUrl: fee.officialFeeSourceUrl,
        auditStatus: "calculated-from-official-rate",
        officialTuitionMYR: odlEducationCalculatedFee.totalMYR
      };
    }
    return {
      amount: null,
      currency: "MYR",
      display: "UTM publishes an official rate basis only; no single total programme fee is displayed.",
      note: `No StudyMY scalar total is written because UTM publishes rate-only fee information for this row. Official note: ${fee.note}`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "official-rate-verified",
      officialTuitionMYR: null
    };
  }
  const prerequisiteFeeNumbers = [...fee.note.matchAll(/RM\s?([\d,]+)/gi)].map((match) => Number(match[1].replace(/,/g, "")));
  const hasPrerequisiteVariant = /with(?:out)?[-\s]?prerequisite/i.test(fee.note) && prerequisiteFeeNumbers.length >= 2;
  if (fee.status === "conflict" && hasPrerequisiteVariant) {
    const standardAmount = Math.min(...prerequisiteFeeNumbers);
    const prerequisiteAmount = Math.max(...prerequisiteFeeNumbers);
    return {
      amount: standardAmount,
      currency: "MYR",
      display: `MYR ${standardAmount.toLocaleString("en-US")} standard ODL total tuition`,
      note: `UTM ODL official international fee source publishes prerequisite-dependent totals. StudyMY displays the standard without-prerequisite total of MYR ${standardAmount.toLocaleString("en-US")} in the list; the with-prerequisite variant is MYR ${prerequisiteAmount.toLocaleString("en-US")}. Official note: ${fee.note}`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "matched-official",
      officialTuitionMYR: standardAmount
    };
  }
  const feeNumbers = [...fee.note.matchAll(/RM\s?([\d,]+)/gi)].map((match) => Number(match[1].replace(/,/g, "")));
  const officialVariantDisplay = feeNumbers.length
    ? `Official fee variants: ${feeNumbers.map((amount) => `MYR ${amount.toLocaleString("en-US")}`).join(" / ")}`
    : "UTM publishes non-primary fee information; no single total programme fee is displayed.";
  return {
    amount: null,
    currency: "MYR",
    display: officialVariantDisplay,
    note: `No StudyMY scalar total is written because UTM publishes more than one applicable fee value or a non-primary total. Official note: ${fee.note}`,
    sourceUrl: fee.officialFeeSourceUrl,
    auditStatus: "official-non-scalar",
    officialTuitionMYR: null
  };
}

function sourceLinks(candidate: UTMMasterCandidateRecord): OfficialSourceLink[] {
  const links: OfficialSourceLink[] = [
    {
      title: "UTM official postgraduate programme list",
      url: candidate.sourceUrls.facultyProgrammeList || candidate.officialSourceUrl,
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
      title: "UTM international postgraduate fee source",
      url: candidate.fee.officialFeeSourceUrl || candidate.sourceUrls.fees,
      sourceType: "fee",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international postgraduate entry requirements",
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
    }
  ];
  return links.filter((link, index, array) => link.url && array.findIndex((item) => item.url === link.url && item.title === link.title) === index);
}

export function validateUtmMasterCandidate(dataset: UTMMasterCandidateDataset) {
  const errors: string[] = [];
  if (dataset.universityCode !== "UTM") errors.push("Candidate universityCode must be UTM.");
  if (dataset.level !== "master") errors.push("Candidate level must be master.");
  if (dataset.applicantScope !== "international") errors.push("Candidate applicantScope must be international.");
  if (dataset.programmeCount !== dataset.programmes.length) errors.push("programmeCount must match programmes length.");
  if (dataset.programmes.length !== 153) errors.push(`Expected 153 canonical UTM master rows; got ${dataset.programmes.length}.`);
  if (dataset.statusPartition.ready !== 153 || dataset.statusPartition.needsReview !== 0 || dataset.statusPartition.notAvailableForInternational !== 0) {
    errors.push("Expected UTM master status partition to be 153 ready, 0 needs-review, 0 not-available-for-international.");
  }
  if (new Set(dataset.programmes.map((item) => item.code)).size !== dataset.programmes.length) errors.push("Candidate codes must be unique.");
  if (new Set(dataset.programmes.map((item) => item.slug)).size !== dataset.programmes.length) errors.push("Candidate slugs must be unique.");
  const feeCounts = countBy(dataset.programmes, (item) => item.fee.status);
  if (feeCounts["verified-official-total"] !== 132) errors.push(`Expected 132 verified official total fees; got ${feeCounts["verified-official-total"] || 0}.`);
  if (feeCounts.conflict !== 7) errors.push(`Expected 7 conflict fee rows; got ${feeCounts.conflict || 0}.`);
  if (feeCounts["official-rate-only"] !== 14) errors.push(`Expected 14 official-rate-only rows; got ${feeCounts["official-rate-only"] || 0}.`);
  for (const record of dataset.programmes) {
    if (record.level !== "master") errors.push(`Row ${record.ordinal} is not master level.`);
    if (record.applicantScope !== "international") errors.push(`Row ${record.ordinal} is not international applicant scope.`);
    if (record.internationalEligibility !== "available") errors.push(`Row ${record.ordinal} is not marked available to international applicants.`);
    if (record.publicDisplayStatus !== "ready") errors.push(`Row ${record.ordinal} is not ready.`);
    if (!record.nameEnOfficial) errors.push(`Row ${record.ordinal} has no official English name.`);
    if (!record.facultyEn) errors.push(`Row ${record.ordinal} has no faculty.`);
    if (!record.officialSourceUrl) errors.push(`Row ${record.ordinal} has no official source URL.`);
    if (!record.fee.officialFeeSourceUrl) errors.push(`Row ${record.ordinal} has no official fee source URL.`);
    if (!(record.durationYears > 0)) errors.push(`Row ${record.ordinal} has no standardized duration years.`);
    if (Math.abs(record.durationYears - 1.5) > 0.01 || !/(?:3\s*semesters?|1\.5\s*years?)/i.test(record.durationOfficial)) {
      errors.push(`Row ${record.ordinal} has no official evidence for the 1.5-year duration.`);
    }
    if (record.fee.status === "verified-official-total" && !record.fee.tuitionAmount) {
      errors.push(`Row ${record.ordinal} verified official total fee has no amount.`);
    }
  }
  return errors;
}

export function buildUtmMasterProgramRows(dataset: UTMMasterCandidateDataset): Array<DeepPartial<ProgramEntity>> {
  return dataset.programmes.map((candidate) => {
    const fee = feePresentation(candidate);
    const academicRequirement = academicRequirementPresentation(candidate);
    const faculty = localizedFaculty(candidate.facultyEn);
    const sourceStatus: OfficialSourceStatus = "official-verified";
    const publicDisplayStatus: PublicDisplayStatus = "ready";
    const applicationDocuments = candidate.applicationDocumentsPolicy.documents.length
      ? candidate.applicationDocumentsPolicy.documents
      : ["Passport", "Academic certificates", "Academic transcripts", "English language result"];
    const noScalarTotal = fee.officialTuitionMYR == null;
    return {
      slug: `${UTM_MASTER_IMPORT_SLUG_PREFIX}${String(candidate.ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: candidate.code,
      name: localizedProgrammeName(candidate.nameEnOfficial),
      nameEnOfficial: candidate.nameEnOfficial,
      level: "master",
      category: inferCategory(candidate.nameEnOfficial, candidate.facultyEn),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: studyModeDisplay(candidate.studyMode, candidate.studyModeOfficial),
      campus: candidate.campus,
      durationYears: candidate.durationYears,
      durationOfficial: standardizedDurationOfficial(candidate),
      annualTuitionCny: annualTuitionCny(fee.officialTuitionMYR, candidate.durationYears),
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: fee.officialTuitionMYR,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: candidate.sourceUrls.fees,
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: ["February", "September"],
      officialIntake: normalizeText(candidate.officialIntake, 255),
      officialIntakeNote: "Captured from UTM official postgraduate admission FAQ and ODL intake page where applicable.",
      languageRequirement: {
        ielts: candidate.languageRequirement.scores?.ielts ?? 6,
        toefl: candidate.languageRequirement.scores?.toeflIbt ?? null,
        pte: candidate.languageRequirement.scores?.pteAcademic ?? null,
        muet: candidate.languageRequirement.scores?.muet ?? null
      },
      officialLanguageRequirement: normalizeText(candidate.languageRequirement.summary),
      requirement: {
        gpa: academicRequirement.gpa,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: academicRequirement.note
      },
      officialAcademicRequirement: normalizeText(academicRequirement.officialText),
      chinaStudentRequirement: "Chinese applicants must follow UTM international postgraduate academic, English, visa and registration document rules; final equivalency is assessed by UTM.",
      specialRequirementsNote: noScalarTotal
        ? "Fee source is retained exactly as official evidence, but no single total programme fee is displayed because UTM does not publish one unique scalar total for this row."
        : `International eligibility status: ${candidate.internationalEligibility}.`,
      applicationDocs: arr(
        applicationDocuments,
        ["UTM 录取信", "白底照片", "护照", "学历证书", "成绩单", "健康状况声明表", "如适用，提交资格信/无异议信"],
        ["UTM 錄取信", "白底照片", "護照", "學歷證書", "成績單", "健康狀況聲明表", "如適用，提交資格信/無異議信"],
        applicationDocuments
      ),
      curriculum: masterCourseSetting(candidate),
      careers: arr([]),
      specializations: masterSpecializations(candidate),
      description: t(
        `${candidate.nameEnOfficial} is listed by UTM for international postgraduate admission under ${candidate.facultyEn}.`,
        `${candidate.nameEnOfficial} 已列入 UTM 国际硕士招生目录，隶属 ${candidate.facultyEn}。`,
        `${candidate.nameEnOfficial} 已列入 UTM 國際碩士招生目錄，隸屬 ${candidate.facultyEn}。`,
        `${candidate.nameEnOfficial} is listed by UTM for international postgraduate admission under ${candidate.facultyEn}.`
      ),
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
      officialSourceUrl: candidate.officialSourceUrl,
      officialEntryRequirementSourceUrl: academicRequirement.sourceUrl,
      officialAccreditationSourceUrl: candidate.officialSourceUrl,
      sourceUrls: sourceLinks(candidate),
      officialVerifiedAt: verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: noScalarTotal
        ? "Published from official UTM postgraduate sources; fee field is displayed as official non-scalar evidence without a StudyMY total amount."
        : "Published from official UTM postgraduate sources; StudyMY localisations are non-official.",
      reviewReason: noScalarTotal ? `Official fee status retained: ${candidate.fee.status}. ${candidate.fee.note}` : null,
      auditNote: [
        `Imported from UTM master official candidate ordinal ${candidate.ordinal}.`,
        `Official candidate slug: ${candidate.slug}.`,
        `Official mode: ${candidate.studyModeOfficial}.`,
        `Fee status: ${candidate.fee.status}.`,
        `Field coverage: ${JSON.stringify(candidate.fieldCoverage)}.`,
        `Reviewed decisions: ${JSON.stringify(candidate.reviewedDecisions || [])}.`
      ].join(" "),
      listTuitionText: fee.display,
      isPublished: true
    };
  });
}

export function summarizeUtmMasterImport(dataset: UTMMasterCandidateDataset, rows: Array<DeepPartial<ProgramEntity>>): UTMMasterImportSummary {
  return {
    candidateRows: dataset.programmes.length,
    importRows: rows.length,
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready" && row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialDurationRows: rows.filter((row) => Number(row.durationYears || 0) > 0 && /^Standardized duration:\s*1\.5 years\b/i.test(String(row.durationOfficial))).length,
    officialTotalFeeRows: rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official").length,
    calculatedFromOfficialRateRows: rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate").length,
    officialRateOnlyRows: rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified").length,
    conflictFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "official-non-scalar").length,
    academicRequirementGpaRows: rows.filter((row) => Number(row.requirement?.gpa || 0) > 0).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus)),
    modes: countBy(rows, (row) => String(row.studyMode))
  };
}

function verifyUtmMasterImportedRecordSet(rows: ProgramEntity[], legacyMasterPublicRows: number, expectedRows: number): UTMMasterImportVerification {
  const readyRows = rows.filter((row) => row.publicDisplayStatus === "ready");
  const publishedRows = rows.filter((row) => row.isPublished);
  const officialDurationRows = rows.filter(
    (row) => Number(row.durationYears || 0) > 0 && /^Standardized duration:\s*1\.5 years\b/i.test(String(row.durationOfficial))
  );
  const officialTotalFeeRows = rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official");
  const calculatedFromOfficialRateRows = rows.filter(
    (row) => row.officialTuitionMYR != null && row.tuitionAmount != null && row.officialFeeAuditStatus === "calculated-from-official-rate"
  );
  const officialRateOnlyRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified" && row.officialTuitionMYR == null);
  const conflictFeeRows = rows.filter((row) => row.officialFeeAuditStatus === "official-non-scalar" && row.officialTuitionMYR == null);
  const noScalarTotalRows = rows.filter((row) => row.officialTuitionMYR == null && row.tuitionAmount == null).length;
  const academicRequirementGpaRows = rows.filter((row) => Number(row.requirement?.gpa || 0) > 0).length;
  const levelRows = rows.filter((row) => row.level === "master");
  const languageRows = rows.filter((row) => Number(row.languageRequirement?.ielts || 0) >= 6).length;
  const sourceLinkedRows = rows.filter((row) => (row.sourceUrls || []).length >= 5).length;
  if (
    rows.length !== expectedRows ||
    readyRows.length !== expectedRows ||
    publishedRows.length !== expectedRows ||
    officialDurationRows.length !== expectedRows ||
    officialTotalFeeRows.length !== 138 ||
    calculatedFromOfficialRateRows.length !== 14 ||
    officialRateOnlyRows.length !== 0 ||
    conflictFeeRows.length !== 1 ||
    noScalarTotalRows !== 1 ||
    academicRequirementGpaRows !== expectedRows ||
    levelRows.length !== expectedRows ||
    languageRows !== expectedRows ||
    sourceLinkedRows !== expectedRows ||
    legacyMasterPublicRows !== 0
  ) {
    throw new Error(
      `UTM master import verification failed: expected=${expectedRows}, actual=${rows.length}, ready=${readyRows.length}, published=${publishedRows.length}, officialDurations=${officialDurationRows.length}, officialTotal=${officialTotalFeeRows.length}, calculated=${calculatedFromOfficialRateRows.length}, rateOnly=${officialRateOnlyRows.length}, conflict=${conflictFeeRows.length}, noScalarTotal=${noScalarTotalRows}, academicGpa=${academicRequirementGpaRows}, level=${levelRows.length}, language=${languageRows}, sourceLinks=${sourceLinkedRows}, legacyPublic=${legacyMasterPublicRows}.`
    );
  }
  return {
    importedRows: rows.length,
    readyRows: readyRows.length,
    publishedRows: publishedRows.length,
    legacyMasterPublicRows,
    officialDurationRows: officialDurationRows.length,
    officialTotalFeeRows: officialTotalFeeRows.length,
    calculatedFromOfficialRateRows: calculatedFromOfficialRateRows.length,
    officialRateOnlyRows: officialRateOnlyRows.length,
    conflictFeeRows: conflictFeeRows.length,
    noScalarTotalRows,
    academicRequirementGpaRows,
    levelRows: levelRows.length,
    languageRows,
    sourceLinkedRows,
    publicDisplayStatusCounts: countBy(rows, (row) => row.publicDisplayStatus),
    officialSourceStatusCounts: countBy(rows, (row) => row.officialSourceStatus),
    feeAuditStatusCounts: countBy(rows, (row) => row.officialFeeAuditStatus)
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number, expectedRows: number) {
  const repository = manager.getRepository(ProgramEntity);
  const rows = await repository.find({ where: { universityId, slug: Like(`${UTM_MASTER_IMPORT_SLUG_PREFIX}%`) } });
  const legacyMasterPublicRows = await repository.count({
    where: {
      universityId,
      level: "master",
      isPublished: true,
      publicDisplayStatus: "ready",
      slug: Not(Like(`${UTM_MASTER_IMPORT_SLUG_PREFIX}%`))
    }
  });
  return verifyUtmMasterImportedRecordSet(rows, legacyMasterPublicRows, expectedRows);
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

async function updateUniversityAfterMasterImport(manager: EntityManager, university: UniversityEntity, summary: UTMMasterImportSummary) {
  const programRepo = manager.getRepository(ProgramEntity);
  const universityRepo = manager.getRepository(UniversityEntity);
  const bachelor = await visibleLevelSummary(programRepo, university.id, "bachelor");
  const master = {
    total: summary.importRows,
    ready: summary.readyRows,
    currentCycleNotOpen: 0,
    needsReview: 0,
    notAvailableForInternational: 0
  };
  const phd = await visibleLevelSummary(programRepo, university.id, "phd");
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
    collectionScope: "UTM official international bachelor and master catalogue import",
    masterCollectionScope: "UTM official international postgraduate master candidate import",
    masterAcademicSession: "2026/2027",
    cnyDisplayRateNote: `CNY display uses internal review conversion ${cnyPerMyr} CNY/MYR and is not an official UTM amount.`,
    catalogStatusSummary: {
      all,
      byLevel: { bachelor, master, phd }
    }
  };
  university.officialAuditSummary = `UTM official catalogue import: ${bachelor.total} bachelor rows and ${master.total} master rows are public-visible from official UTM sources. Master fees include ${summary.officialTotalFeeRows} official total rows, ${summary.calculatedFromOfficialRateRows} rows calculated from official ODL rates, and ${summary.conflictFeeRows} rows retained as official non-scalar variants.`;
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
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_UTM_MASTER_CANDIDATE_PATH);
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/utm-master-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const dataset = loadJson<UTMMasterCandidateDataset>(candidatePath);
  const errors = validateUtmMasterCandidate(dataset);
  if (errors.length) throw new Error(`UTM master candidate validation failed:\n${errors.join("\n")}`);
  const rows = buildUtmMasterProgramRows(dataset);
  const summary = summarizeUtmMasterImport(dataset, rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const dryRun = !verifyOnly && !process.argv.includes("--confirm-import");

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          universityCode: "UTM",
          scope: "master",
          candidatePath,
          writePolicy: {
            upsertPrefix: UTM_MASTER_IMPORT_SLUG_PREFIX,
            importRows: rows.length,
            publicVisibleRows: rows.length,
            publicReadyRows: rows.length,
            archiveLegacyPublicMasterRows: true,
            preserveBachelorRows: true,
            feePolicy: {
              officialTotalRows: summary.officialTotalFeeRows,
              calculatedFromOfficialRateRows: summary.calculatedFromOfficialRateRows,
              officialRateOnlyRows: summary.officialRateOnlyRows,
              conflictRows: summary.conflictFeeRows,
              nonScalarRowsDisplayNoStudyMYTotal: summary.officialRateOnlyRows + summary.conflictFeeRows
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

    let verification: UTMMasterImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const programRepo = manager.getRepository(ProgramEntity);
      const universityRepo = manager.getRepository(UniversityEntity);
      const transactionUniversity = await universityRepo.findOne({ where: { code: "UTM" } });
      if (!transactionUniversity) throw new Error("UTM university row not found inside transaction.");
      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const currentMaster = await programRepo.find({ where: { universityId: transactionUniversity.id, level: "master" } });
      for (const existing of currentMaster) {
        if (incomingSlugs.has(existing.slug)) continue;
        if (existing.slug.startsWith(UTM_MASTER_IMPORT_SLUG_PREFIX)) {
          await programRepo.remove(existing);
          continue;
        }
        existing.isPublished = false;
        existing.publicDisplayStatus = "archived";
        existing.publicDisplayNote = "Archived by UTM master official import to prevent duplicate public-list leakage.";
        existing.reviewReason = "Superseded by the audited UTM official master catalogue dataset.";
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
      await updateUniversityAfterMasterImport(manager, transactionUniversity, summary);
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
