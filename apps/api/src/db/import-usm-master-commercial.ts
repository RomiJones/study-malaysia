import "reflect-metadata";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, type DeepPartial, type EntityManager } from "typeorm";
import type { LocalizedStringArray, LocalizedText, OfficialSourceLink } from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const USM_MASTER_SLUG_PREFIX = "usm-master-commercial-2026-";
export const DEFAULT_USM_MASTER_SOURCE_PATH = resolve(
  repositoryRoot,
  "data/imports/usm/2026-06-14/master-commercial-candidate.json"
);
const feeDirectoryUrl = "https://admission.usm.my/index.php/postgraduate/fee-pg";
const applicationGuideUrl =
  "https://onlineips.usm.my/images/ONLINE%20APPLICATION%20GUIDELINE%20012026%20v1.pdf";

type StudyMode = "research" | "coursework" | "mixed" | "clinical";
type FeeCurrency = "USD" | "MYR";

interface OfficialAmount {
  currency: FeeCurrency;
  amount?: number;
  raw?: string;
  basis?: string;
  fullTimePerSemester?: number;
  partTimePerSemester?: number;
}

interface OfficialFee {
  status: string;
  feeType?: string;
  officialFeeName?: string;
  academicSession?: string;
  effectiveNote?: string;
  international?: OfficialAmount;
  malaysian?: OfficialAmount;
  officialSourceUrl?: string;
  sourcePage?: number;
  reason?: string;
}

interface CandidateRecord {
  code: string;
  officialName: string;
  faculty: string;
  campus: { name: string; status: string };
  studyMode: StudyMode;
  delivery: string;
  internationalEligibility: string;
  overviewOfficial: string;
  academicRequirement: { textEnOfficial: string; status: string; officialSourceUrl: string };
  languageRequirement: { textEnOfficial: string; status: string; officialSourceUrl: string };
  duration: { textEnOfficial: string; status: string };
  intake: { textEnOfficial: string; status: string };
  fee: OfficialFee;
  specialisationOrVariantFees: OfficialFee[];
  careers: { status: string; items: string[]; note: string };
  evidence: {
    officialDirectoryUrl: string;
    detailSha256: string;
    detailStatus: string;
    retrievedAt: string;
  };
}

export interface MasterCommercialSource {
  universityCode: "USM";
  level: "master";
  applicantScope: "international";
  academicSession: { baseFeeSchedule: string; programmeOverrides: string };
  applicationDocuments: {
    status: string;
    officialSourceUrl: string;
    items: Array<{ id: string; nameEn: string; sourcePage: number; conditional?: string }>;
    uploadRules: string[];
  };
  audit: {
    recordCount: number;
    modeCounts: Record<StudyMode, number>;
    currentNamedFeeRowsAccountedFor: number;
    feeOnlyOfferingCount: number;
    exceptionCount: number;
  };
  catalogueDecision: { officialDirectoryEntryCount: number; canonicalCountClaim: string };
  records: CandidateRecord[];
}

const t = (en: string, ms: string, zhCN: string, zhTW: string): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const localizedArray = (
  en: string[],
  ms: string[],
  zhCN: string[],
  zhTW: string[]
): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

const traditionalCharacters: Record<string, string> = {
  学: "學", 术: "術", 业: "業", 专: "專", 门: "門", 设: "設", 计: "計", 统: "統", 资: "資",
  讯: "訊", 电: "電", 机: "機", 械: "械", 医: "醫", 药: "藥", 护: "護", 临: "臨", 床: "床",
  语: "語", 言: "言", 传: "傳", 播: "播", 经: "經", 济: "濟", 营: "營", 销: "銷", 会: "會",
  数: "數", 据: "據", 网: "網", 络: "絡", 软: "軟", 体: "體", 环: "環", 境: "境",
  筑: "築", 规: "規", 划: "劃", 测: "測", 绘: "繪", 材: "材", 料: "料", 矿: "礦", 产: "產",
  动: "動", 物: "物", 植: "植", 验: "驗", 应: "應", 用: "用", 管: "管", 理: "理", 教: "教",
  育: "育", 艺: "藝", 创: "創", 媒: "媒", 译: "譯", 写: "寫", 阅: "閱", 发: "發",
  展: "展", 国: "國", 际: "際", 马: "馬", 来: "來", 亚: "亞", 离: "離", 岸: "岸", 联: "聯",
  合: "合", 双: "雙", 证: "證", 课: "課", 程: "程", 混: "混", 型: "型", 硕: "碩", 项: "項"
};

const toTraditional = (value: string) =>
  Array.from(value)
    .map((character) => traditionalCharacters[character] || character)
    .join("");

const facultyTranslations: Record<string, [string, string]> = {
  "School of Biological Sciences": ["生物科学学院", "Pusat Pengajian Sains Kajihayat"],
  "School of Chemical Sciences": ["化学科学学院", "Pusat Pengajian Sains Kimia"],
  "School of Mathematical Sciences": ["数学科学学院", "Pusat Pengajian Sains Matematik"],
  "School of Physics": ["物理学院", "Pusat Pengajian Sains Fizik"],
  "School of Computer Sciences": ["计算机科学学院", "Pusat Pengajian Sains Komputer"],
  "School of Medical Sciences": ["医学科学学院", "Pusat Pengajian Sains Perubatan"],
  "School of Dental Sciences": ["牙科科学学院", "Pusat Pengajian Sains Pergigian"],
  "School of Health Sciences": ["健康科学学院", "Pusat Pengajian Sains Kesihatan"],
  "School of Pharmaceutical Sciences": ["药学学院", "Pusat Pengajian Sains Farmasi"],
  "School of Educational Studies": ["教育研究学院", "Pusat Pengajian Ilmu Pendidikan"],
  "School of Humanities": ["人文学院", "Pusat Pengajian Ilmu Kemanusiaan"],
  "School of Social Sciences": ["社会科学学院", "Pusat Pengajian Sains Kemasyarakatan"],
  "School of Arts": ["艺术学院", "Pusat Pengajian Seni"],
  "School of Communication": ["传播学院", "Pusat Pengajian Komunikasi"],
  "School of Management": ["管理学院", "Pusat Pengajian Pengurusan"],
  "Graduate School of Business": ["商学研究生院", "Pusat Pengajian Siswazah Perniagaan"],
  "School of Housing, Building and Planning": ["住房、建筑与规划学院", "Pusat Pengajian Perumahan, Bangunan dan Perancangan"],
  "School of Mechanical Engineering": ["机械工程学院", "Pusat Pengajian Kejuruteraan Mekanik"],
  "School of Electrical and Electronic Engineering": ["电气与电子工程学院", "Pusat Pengajian Kejuruteraan Elektrik dan Elektronik"],
  "School of Chemical Engineering": ["化学工程学院", "Pusat Pengajian Kejuruteraan Kimia"],
  "School of Civil Engineering": ["土木工程学院", "Pusat Pengajian Kejuruteraan Awam"],
  "School of Aerospace Engineering": ["航空航天工程学院", "Pusat Pengajian Kejuruteraan Aeroangkasa"],
  "School of Materials and Mineral Resources Engineering": ["材料与矿产资源工程学院", "Pusat Pengajian Kejuruteraan Bahan dan Sumber Mineral"],
  "School of Industrial Technology": ["工业技术学院", "Pusat Pengajian Teknologi Industri"],
  "School of Languages, Literacies & Translation": ["语言、读写与翻译学院", "Pusat Pengajian Bahasa, Literasi dan Terjemahan"],
  "School of Distance Education": ["远程教育学院", "Pusat Pengajian Pendidikan Jarak Jauh"],
  "USM@KL": ["USM 吉隆坡校区", "USM@KL"],
  "Analytical Biochemistry Research Centre": ["分析生物化学研究中心", "Pusat Penyelidikan Biokimia Analisis"],
  "Centre For Marine And Coastal Studies": ["海洋与海岸研究中心", "Pusat Kajian Samudera dan Pantai"],
  "Centre for Chemical Biology": ["化学生物学中心", "Pusat Biologi Kimia"],
  "Centre for Drug Research": ["药物研究中心", "Pusat Penyelidikan Dadah"],
  "Centre for Global Archaeological Research": ["全球考古研究中心", "Pusat Penyelidikan Arkeologi Global"],
  "Centre for Global Sustainability Studies": ["全球可持续发展研究中心", "Pusat Kajian Kelestarian Global"],
  "Centre for Instructional Technology and Multimedia": ["教学技术与多媒体中心", "Pusat Teknologi Pengajaran dan Multimedia"],
  "Centre for Islamic Development Management Studies": ["伊斯兰发展管理研究中心", "Pusat Kajian Pengurusan Pembangunan Islam"],
  "Centre for Policy Research": ["政策研究中心", "Pusat Penyelidikan Dasar"],
  "Centre for Research on Women and Gender (KANITA)": ["女性与性别研究中心（KANITA）", "Pusat Penyelidikan Wanita dan Gender (KANITA)"],
  "Collaborative Microelectronic Design Excellence Centre": ["协同微电子设计卓越中心", "Pusat Kecemerlangan Reka Bentuk Mikroelektronik Kolaboratif"],
  "Cyber Security Research Centre": ["网络安全研究中心", "Pusat Penyelidikan Keselamatan Siber"],
  "Institute for Research in Molecular Medicine": ["分子医学研究所", "Institut Penyelidikan Perubatan Molekul"],
  "Institute of Nano Optoelectronics Research & Technology": ["纳米光电子研究与技术研究所", "Institut Penyelidikan dan Teknologi Nano Optoelektronik"],
  "Malaysian Institute of Pharmaceuticals and Nutraceuticals": ["马来西亚药物与营养制品研究所", "Institut Farmaseutikal dan Nutraseutikal Malaysia"],
  "National Higher Education Research Institute": ["国家高等教育研究所", "Institut Penyelidikan Pendidikan Tinggi Negara"],
  "National Poison Centre": ["国家毒物中心", "Pusat Racun Negara"],
  "Pusat Kanser Tun Abdullah Ahmad Badawi": ["敦阿都拉·阿末·巴达维癌症中心", "Pusat Kanser Tun Abdullah Ahmad Badawi"],
  "River Engineering and Urban Drainage Research Centre": ["河流工程与城市排水研究中心", "Pusat Penyelidikan Kejuruteraan Sungai dan Saliran Bandar"]
};

const subjectTranslations: Array<[RegExp, string]> = [
  [/Business Administration/gi, "工商管理"],
  [/Business Analytics/gi, "商业分析"],
  [/Biomedical Science/gi, "生物医学科学"],
  [/Bioprocess Technology/gi, "生物过程技术"],
  [/Public Administration/gi, "公共管理"],
  [/Communication/gi, "传播学"],
  [/Computer Science/gi, "计算机科学"],
  [/Cyber Security/gi, "网络安全"],
  [/Cybersecurity/gi, "网络安全"],
  [/Data Science/gi, "数据科学"],
  [/Information Technology/gi, "信息技术"],
  [/Software Engineering/gi, "软件工程"],
  [/Artificial Intelligence/gi, "人工智能"],
  [/Educational Technology/gi, "教育技术"],
  [/Higher Education/gi, "高等教育"],
  [/Civilisation Studies/gi, "文明研究"],
  [/Drama & Theatre, Acting & Directing/gi, "戏剧与剧场（表演与导演）"],
  [/Interpretation/gi, "口译"],
  [/Language Studies/gi, "语言研究"],
  [/Education/gi, "教育学"],
  [/Engineering/gi, "工程"],
  [/Architecture/gi, "建筑学"],
  [/Urban and Regional Planning/gi, "城市与区域规划"],
  [/Project Management/gi, "项目管理"],
  [/Management/gi, "管理学"],
  [/Accounting/gi, "会计学"],
  [/Finance/gi, "金融学"],
  [/Economics/gi, "经济学"],
  [/Social Science[s]?/gi, "社会科学"],
  [/Political Science/gi, "政治学"],
  [/Psychology/gi, "心理学"],
  [/Counselling/gi, "辅导学"],
  [/Sociology/gi, "社会学"],
  [/Anthropology/gi, "人类学"],
  [/Translation/gi, "翻译学"],
  [/Linguistics/gi, "语言学"],
  [/Literature/gi, "文学"],
  [/History/gi, "历史学"],
  [/Geography/gi, "地理学"],
  [/Fine Art[s]?/gi, "美术"],
  [/Music/gi, "音乐"],
  [/Design/gi, "设计"],
  [/Biotechnology/gi, "生物技术"],
  [/Biology/gi, "生物学"],
  [/Microbiology/gi, "微生物学"],
  [/Chemistry/gi, "化学"],
  [/Physics/gi, "物理学"],
  [/Mathematics/gi, "数学"],
  [/Statistics/gi, "统计学"],
  [/Environmental/gi, "环境"],
  [/Food Technology/gi, "食品技术"],
  [/Medicine/gi, "医学"],
  [/Medical/gi, "医学"],
  [/Plant Pathology/gi, "植物病理学"],
  [/Pathology/gi, "病理学"],
  [/Pharmacology/gi, "药理学"],
  [/Physiology/gi, "生理学"],
  [/Surgery/gi, "外科学"],
  [/Dentistry/gi, "牙科学"],
  [/Dental/gi, "牙科"],
  [/Pharmacy/gi, "药学"],
  [/Pharmaceutical/gi, "药学"],
  [/Public Health/gi, "公共卫生"],
  [/Clinical Pharmacy/gi, "临床药学"],
  [/Nursing/gi, "护理学"],
  [/Health/gi, "健康"],
  [/Nutrition/gi, "营养学"],
  [/Neuroscience/gi, "神经科学"],
  [/Molecular Medicine/gi, "分子医学"],
  [/Sustainability/gi, "可持续发展"],
  [/Planning Studies/gi, "规划研究"],
  [/Quantity Surveying/gi, "工料测量"],
  [/Zoology/gi, "动物学"],
  [/Archaeology/gi, "考古学"],
  [/Islamic/gi, "伊斯兰"],
  [/Marine/gi, "海洋"],
  [/Science/gi, "科学"]
];

function translatedSubject(value: string) {
  const original = value.replace(/\s+/g, " ").trim();
  const translated = subjectTranslations.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), original)
    .replace(/\s+/g, " ")
    .trim();
  return /[\u3400-\u9fff]/.test(translated) && /[A-Za-z]{3,}/.test(translated) ? original : translated;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function localizeProgrammeName(officialName: string, faculty: string): LocalizedText {
  const cleaned = officialName
    .replace(/\s+-\s+(Research|Coursework|Mixed(?: Mode)?|Clinical)\s*$/i, "")
    .replace(/\s*-\s*\((Research|Coursework|Mixed(?: Mode)?|Clinical)\)\s*$/i, "")
    .replace(/\s+by\s+(Research|Coursework|Mixed)\s*$/i, "")
    .replace(/\s*\((Research|Coursework|Mixed(?: Mode)?|Clinical)\)\s*$/i, "")
    .trim();
  const facultyPattern = new RegExp(`\\s*[–—-]\\s*${escapeRegExp(faculty)}\\s*$`, "i");
  const core = cleaned
    .replace(facultyPattern, "")
    .replace(/\s*[–—-]\s*(?:School|Centre|Center|Institute|Advanced Medical|National|Pusat|USM@KL)\b.+$/i, "")
    .replace(/\s*[–—-]\s*\([A-Z0-9@& -]{2,20}\)\s*$/i, "")
    .replace(/\s+-\s+(?:Offshore|Online|USM@KL|Dual Degree|Double Degree|Joint Degree).+$/i, "")
    .replace(/\s*-?\s*\((?:Offshore|Online|USM@KL)\b.*$/i, "")
    .replace(/\s*-?\s*\((?:Offshore|Online|USM@KL)(?:[^)]*)\)\s*$/i, "")
    .replace(/\s*\((Research|Coursework|Mixed(?: Mode)?|Clinical)\)\s*$/i, "")
    .trim();
  const modeSuffix = /offshore/i.test(officialName)
    ? "（离岸项目）"
    : /online/i.test(officialName)
      ? "（在线）"
      : /USM@KL/i.test(officialName)
        ? "（USM@KL）"
        : "";
  const degreePatterns: Array<[RegExp, string]> = [
    [/^Master of Science(?: in)?\s*\(([^)]+)\)$/i, "理学硕士"],
    [/^Master of Science(?: in)?\s+(.+)$/i, "理学硕士"],
    [/^MSc\b(?: in)?\s+\(?([^)]+)\)?$/i, "理学硕士"],
    [/^Master of Arts(?: in)?\s*\(([^)]+)\)$/i, "文学硕士"],
    [/^Master of Arts(?: in)?\s+(.+)$/i, "文学硕士"],
    [/^MA\b(?: in)?\s+\(?([^)]+)\)?$/i, "文学硕士"],
    [/^Master of Social Science[s]?(?: in)?\s*\(([^)]+)\)$/i, "社会科学硕士"],
    [/^Master of Social Science[s]?(?: in)?\s+(.+)$/i, "社会科学硕士"],
    [/^Master of Engineering(?: in)?\s*\(([^)]+)\)$/i, "工程硕士"],
    [/^Master of Engineering(?: in)?\s+(.+)$/i, "工程硕士"],
    [/^Master of Education(?: in)?\s*\(([^)]+)\)$/i, "教育学硕士"],
    [/^Master of Education(?: in)?\s+(.+)$/i, "教育学硕士"],
    [/^Master of Medicine(?: in)?\s*\(([^)]+)\)$/i, "医学硕士"],
    [/^Master of Medicine(?: in)?\s+(.+)$/i, "医学硕士"],
    [/^Master of Pathology(?: in)?\s*\(([^)]+)\)$/i, "病理学硕士"],
    [/^Master of Pathology(?: in)?\s+(.+)$/i, "病理学硕士"],
    [/^Master of Surgery(?: in)?\s*\(([^)]+)\)$/i, "外科学硕士"],
    [/^Master of Surgery(?: in)?\s+(.+)$/i, "外科学硕士"],
    [/^Master of Pharmacy(?: in)?\s*\(([^)]+)\)$/i, "药学硕士"],
    [/^Master of Pharmacy(?: in)?\s+(.+)$/i, "药学硕士"]
  ];
  let zh = "";
  if (/Malaysian Candidate Only/i.test(officialName)) {
    zh = "教育学硕士（仅限马来西亚申请人）";
  } else if (/^Master of Arts$/i.test(core)) {
    zh = "文学硕士";
  } else if (/^Master of Science$/i.test(core)) {
    zh = "理学硕士";
  } else if (/^Master of Social Sciences?$/i.test(core)) {
    zh = "社会科学硕士";
  } else if (/^Master of Engineering$/i.test(core)) {
    zh = "工程硕士";
  } else if (/^Master of Education$/i.test(core)) {
    zh = "教育学硕士";
  } else if (/^Master of Business Administration/i.test(core)) {
    zh = "工商管理硕士";
  } else if (/^Master of Public Administration$/i.test(core)) {
    zh = "公共管理硕士";
  } else {
    for (const [pattern, degree] of degreePatterns) {
      const match = core.match(pattern);
      if (match) {
        const subject = translatedSubject(match[1]);
        zh = (degree === "文学硕士" && subject === "文学")
          || (degree === "社会科学硕士" && subject === "社会科学")
          ? degree
          : `${subject}${degree}`;
        break;
      }
    }
  }
  if (!zh) {
    const generic = core.match(/^Master(?: in| of)?\s+(.+)$/i);
    zh = `${translatedSubject(generic?.[1] || core)}硕士`;
  }
  zh += modeSuffix;
  const ms = cleaned
    .replace(/^Master of Science/i, "Sarjana Sains")
    .replace(/^Master of Arts/i, "Sarjana Sastera")
    .replace(/^Master of Engineering/i, "Sarjana Kejuruteraan")
    .replace(/^Master of Education/i, "Sarjana Pendidikan")
    .replace(/^Master of Business Administration/i, "Sarjana Pentadbiran Perniagaan")
    .replace(/^Master of Public Administration/i, "Sarjana Pentadbiran Awam")
    .replace(/^Master of Medicine/i, "Sarjana Perubatan")
    .replace(/^Master of Pathology/i, "Sarjana Patologi")
    .replace(/^Master of Surgery/i, "Sarjana Pembedahan")
    .replace(/^Master of Pharmacy/i, "Sarjana Farmasi")
    .replace(/^Master of /i, "Sarjana ")
    .replace(/^Master in /i, "Sarjana dalam ")
    .replace(/^Master/i, "Sarjana");
  return t(officialName, ms, zh, toTraditional(zh));
}

function localizeFaculty(faculty: string): LocalizedText {
  const translated = facultyTranslations[faculty] || [`${faculty}（USM）`, faculty];
  return t(faculty, translated[1], translated[0], toTraditional(translated[0]));
}

function normalizeEvidenceText(value: string) {
  return value
    .split(/Postgraduate Institute of Postgraduate Studies|Disclaimer|Last Update:/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeOfficialText(value: string) {
  return normalizeEvidenceText(value)
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const formatYears = (value: number) => (Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2))));

function durationUnitYears(value: number, unit: string) {
  if (/semester/i.test(unit)) return value / 2;
  if (/month/i.test(unit)) return value / 12;
  return value;
}

function parseModeDuration(text: string, label: "full" | "part") {
  const start = label === "full" ? /full[\s-]*time/i : /part[\s-]*time/i;
  const other = label === "full" ? /part[\s-]*time/i : /full[\s-]*time/i;
  const match = start.exec(text);
  if (!match) return null;
  const tail = text.slice(match.index + match[0].length);
  const otherMatch = other.exec(tail);
  const section = otherMatch ? tail.slice(0, otherMatch.index) : tail;
  const range = section.match(
    /(?:min(?:imum|inum)?\.?\s*)?(\d+(?:\.\d+)?)\s*(?:years?|months?|semesters?)?[\s/]*(?:max(?:imum)?\.?\s*|[-–]|to)\s*(\d+(?:\.\d+)?)\s*(years?|months?|semesters?)/i
  );
  if (range) {
    return {
      min: durationUnitYears(Number(range[1]), range[3]),
      max: durationUnitYears(Number(range[2]), range[3])
    };
  }
  const explicit = section.match(/(\d+(?:\.\d+)?)\s*(years?|months?|semesters?)/i);
  if (explicit) {
    const years = durationUnitYears(Number(explicit[1]), explicit[2]);
    return { min: years, max: years };
  }
  return null;
}

function fullTimeSemesterRange(text: string, studyMode: StudyMode) {
  const fullTime = parseModeDuration(text, "full");
  if (fullTime) {
    return {
      min: Math.round(fullTime.min * 2),
      max: Math.round(fullTime.max * 2),
      source: "programme-specific" as const
    };
  }
  if (studyMode === "research") {
    return { min: 2, max: 6, source: "research-mode-general-rule" as const };
  }
  return null;
}

export function normalizeMasterDuration(
  officialText: string,
  studyMode: StudyMode
): { durationYears: number; durationOfficial: string; rawOfficial: string; numeric: boolean } {
  const rawOfficial = normalizeEvidenceText(officialText);
  const full = parseModeDuration(rawOfficial, "full");
  const part = parseModeDuration(rawOfficial, "part");
  if (full) {
    const fullText =
      full.min === full.max ? `${formatYears(full.min)} years` : `${formatYears(full.min)}-${formatYears(full.max)} years`;
    const partText = part
      ? part.min === part.max
        ? `${formatYears(part.min)} years`
        : `${formatYears(part.min)}-${formatYears(part.max)} years`
      : "";
    return {
      durationYears: full.min,
      durationOfficial: partText ? `Full-time: ${fullText}; Part-time: ${partText}` : `Full-time: ${fullText}`,
      rawOfficial,
      numeric: true
    };
  }
  const simpleRange = rawOfficial.match(
    /(\d+(?:\.\d+)?)\s*(years?|months?|semesters?)\s*(?:to|[-–/])\s*(\d+(?:\.\d+)?)\s*(years?|months?|semesters?)/i
  );
  if (simpleRange) {
    const min = durationUnitYears(Number(simpleRange[1]), simpleRange[2]);
    const max = durationUnitYears(Number(simpleRange[3]), simpleRange[4]);
    return {
      durationYears: min,
      durationOfficial: `${formatYears(min)}-${formatYears(max)} years`,
      rawOfficial,
      numeric: true
    };
  }
  const fixed = rawOfficial.match(/(\d+(?:\.\d+)?)\s*(years?|months?|semesters?)/i);
  if (fixed) {
    const years = durationUnitYears(Number(fixed[1]), fixed[2]);
    return {
      durationYears: years,
      durationOfficial: `${formatYears(years)} years`,
      rawOfficial,
      numeric: true
    };
  }
  if (studyMode === "research") {
    return {
      durationYears: 1,
      durationOfficial: "Full-time: 1-3 years; Part-time: 2-6 years",
      rawOfficial,
      numeric: true
    };
  }
  return {
    durationYears: 0,
    durationOfficial: "Official duration in years is not published; refer to the programme structure",
    rawOfficial,
    numeric: false
  };
}

function categoryFor(record: CandidateRecord) {
  const value = `${record.faculty} ${record.officialName}`.toLowerCase();
  if (/engineering|architecture|building|planning|technology/.test(value)) return "engineering";
  if (/computer|cyber|data science|information technology|microelectronic/.test(value)) return "it";
  if (/business|management|accounting|finance|economic/.test(value)) return "business";
  if (/medical|medicine|health|dental|pharmacy|pharmaceutical|drug|poison|cancer|nutrition|nursing/.test(value)) return "medicine";
  if (/science|biology|chemistry|physics|mathemat|marine|molecular|nano/.test(value)) return "science";
  return "arts";
}

function stableCode(sourceCode: string) {
  const article = sourceCode.match(/ARTICLE-(\d+)/);
  if (article) return `USM-M-ARTICLE-${article[1]}`;
  return `USM-M-${createHash("sha1").update(sourceCode).digest("hex").slice(0, 12).toUpperCase()}`;
}

function stableSlug(record: CandidateRecord) {
  const identity = stableCode(record.code).toLowerCase();
  return `${USM_MASTER_SLUG_PREFIX}${identity}`.slice(0, 120);
}

function extractIntakeMonths(text: string) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const semesterStarts = [...text.matchAll(/Semester\s+[IVX0-9]+\s*:\s*(January|February|March|April|May|June|July|August|September|October|November|December)/gi)]
    .map((match) => months.find((month) => month.toLowerCase() === match[1].toLowerCase()))
    .filter((month): month is string => Boolean(month));
  if (semesterStarts.length) return Array.from(new Set(semesterStarts));
  return months.filter((month) => new RegExp(month, "i").test(text));
}

function extractIelts(text: string) {
  const beforeIelts = text.match(/Band\s*(\d(?:\.\d+)?)\s*(?:for|in)\s*IELTS/i);
  if (beforeIelts) return Number(beforeIelts[1]);
  const afterIelts = text.match(
    /IELTS(?:\/IELTS Online|\s*\(Academic\)|\s+Academic)?(?:\s+minimum)?(?:\s+Band)?\s*(\d(?:\.\d+)?)/i
  );
  return Number(afterIelts?.[1] || 0);
}

function extractCgpa(text: string) {
  const match = text.match(/(?:CGPA|minimum of)\s*(\d\.\d{1,2})/i);
  return Number(match?.[1] || 0);
}

function feePresentation(record: CandidateRecord) {
  const direct = record.fee.status === "verified-current-official-fee" ? record.fee : null;
  const variants = record.specialisationOrVariantFees.filter(
    (fee) => fee.status === "verified-current-official-fee" && fee.international
  );
  if (direct?.international) {
    const fee = direct.international;
    if (fee.fullTimePerSemester) {
      const duration = fullTimeSemesterRange(record.duration.textEnOfficial, record.studyMode);
      if (!duration) {
        return {
          amount: null,
          currency: fee.currency,
          display: "",
          status: "not-published" as const,
          sourceUrl: direct.officialSourceUrl || feeDirectoryUrl,
          note: `USM publishes an international full-time rate of ${fee.currency} ${fee.fullTimePerSemester.toLocaleString("en-US")} per semester, but no numeric official duration is available to calculate a total tuition amount.`
        };
      }
      const minimum = fee.fullTimePerSemester * duration.min;
      const maximum = fee.fullTimePerSemester * duration.max;
      const totalDisplay = minimum === maximum
        ? `${fee.currency} ${minimum.toLocaleString("en-US")} total tuition`
        : `${fee.currency} ${minimum.toLocaleString("en-US")}-${maximum.toLocaleString("en-US")} total tuition`;
      return {
        amount: minimum === maximum ? minimum : null,
        currency: fee.currency,
        display: totalDisplay,
        status: "matched-official" as const,
        sourceUrl: direct.officialSourceUrl || feeDirectoryUrl,
        note: `StudyMY calculation from USM official ${direct.academicSession || "current"} international full-time tuition of ${fee.currency} ${fee.fullTimePerSemester.toLocaleString("en-US")} per semester and the official ${duration.min}-${duration.max} semester full-time duration. The displayed total excludes registration, bond, methodology, thesis evaluation, graduation and other separate fees. Duration source: ${duration.source}.`
      };
    }
    if (!fee.amount) {
      return {
        amount: null,
        currency: "UNKNOWN" as const,
        display: "",
        status: "not-published" as const,
        sourceUrl: direct.officialSourceUrl || feeDirectoryUrl,
        note: direct.effectiveNote || direct.reason || "The current official fee schedule refers applicants to the programme website and does not publish a numeric total."
      };
    }
    return {
      amount: fee.amount,
      currency: fee.currency,
      display: `${fee.currency} ${fee.amount.toLocaleString("en-US")} total tuition`,
      status: "matched-official" as const,
      sourceUrl: direct.officialSourceUrl || feeDirectoryUrl,
      note: `Official ${direct.academicSession || "current"} total programme fee. Malaysian fee: MYR ${direct.malaysian?.amount?.toLocaleString("en-US") || "not published"}.${direct.effectiveNote ? ` ${direct.effectiveNote}` : ""}`
    };
  }
  if (variants.length) {
    const amounts = variants.map((fee) => Number(fee.international?.amount || 0)).filter(Boolean);
    if (!amounts.length) {
      return {
        amount: null,
        currency: "UNKNOWN" as const,
        display: "",
        status: "not-published" as const,
        sourceUrl: variants[0].officialSourceUrl || feeDirectoryUrl,
        note: "The official track rows do not publish a numeric international total."
      };
    }
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    return {
      amount: min === max ? min : null,
      currency: "USD" as const,
      display: min === max ? `USD ${min.toLocaleString("en-US")} total` : `USD ${min.toLocaleString("en-US")}-${max.toLocaleString("en-US")} total, varies by track`,
      status: "matched-official" as const,
      sourceUrl: variants[0].officialSourceUrl || feeDirectoryUrl,
      note: `Official fee varies by track. ${variants.map((fee) => `${fee.officialFeeName}: USD ${fee.international?.amount?.toLocaleString("en-US")}`).join("; ")}`
    };
  }
  return {
    amount: null,
    currency: "UNKNOWN" as const,
    display: "",
    status: "not-published" as const,
    sourceUrl: feeDirectoryUrl,
    note: record.fee.reason || "No unique current official fee is published for this directory entry."
  };
}

function applicationDocuments(source: MasterCommercialSource, mode: StudyMode) {
  const translations: Record<string, [string, string, string]> = {
    passport: ["Passport for international applicants", "Pasport pemohon antarabangsa", "国际申请人护照"],
    photo: ["Passport-size photograph", "Gambar berukuran pasport", "护照尺寸照片"],
    "bachelor-certificate": ["Bachelor degree certificate and official English translation", "Sijil ijazah sarjana muda dan terjemahan rasmi bahasa Inggeris", "本科学位证书及官方英文翻译"],
    "academic-transcripts": ["Academic transcripts and official English translation", "Transkrip akademik dan terjemahan rasmi bahasa Inggeris", "成绩单及官方英文翻译"],
    "graduation-certificate": ["Graduation certificate, where applicable", "Sijil tamat pengajian jika berkenaan", "毕业证书（如适用）"],
    "grading-scheme": ["Official grading scheme", "Skema pemarkahan rasmi", "官方评分制度说明"],
    "english-result": ["Accepted English-language test result or exemption evidence", "Keputusan ujian bahasa Inggeris atau bukti pengecualian", "认可的英语考试成绩或豁免证明"],
    "research-proposal": ["Research proposal", "Cadangan penyelidikan", "研究计划"],
    referees: ["Referee details", "Maklumat pemberi rujukan", "推荐人信息"],
    "scholarship-letter": ["Scholarship letter, if available", "Surat biasiswa jika ada", "奖学金证明（如有）"]
  };
  const allowed = source.applicationDocuments.items.filter((item) => {
    if (item.conditional === "research") return mode === "research";
    if (item.conditional === "research-or-master-of-medicine") return mode === "research" || mode === "clinical";
    return true;
  });
  const en = allowed.map((item) => translations[item.id]?.[0] || item.nameEn);
  const ms = allowed.map((item) => translations[item.id]?.[1] || item.nameEn);
  const zh = allowed.map((item) => translations[item.id]?.[2] || item.nameEn);
  return localizedArray(en, ms, zh, zh.map(toTraditional));
}

function localizedSpecializations(record: CandidateRecord) {
  const en = record.specialisationOrVariantFees.map((fee) =>
    (fee.officialFeeName || "").replace(record.officialName, "").replace(/^[\s:–—-]+/, "").trim()
  ).filter(Boolean);
  if (!en.length) return localizedArray([], [], [], []);
  const zh = en.map(translatedSubject);
  return localizedArray(en, en, zh, zh.map(toTraditional));
}

export function buildUsmMasterRows(source: MasterCommercialSource): Array<DeepPartial<ProgramEntity>> {
  return source.records.map((record) => {
    const duration = normalizeMasterDuration(record.duration.textEnOfficial, record.studyMode);
    const fee = feePresentation(record);
    const name = localizeProgrammeName(record.officialName, record.faculty);
    const faculty = localizeFaculty(record.faculty);
    const months = extractIntakeMonths(record.intake.textEnOfficial);
    const sourceLinks: OfficialSourceLink[] = [
      {
        title: "USM official programme page",
        url: record.evidence.officialDirectoryUrl,
        sourceType: "admission",
        verifiedAt: "2026-06-14",
        status: "official-verified"
      },
      {
        title: "USM postgraduate fee schedule",
        url: fee.sourceUrl,
        sourceType: "fee",
        verifiedAt: "2026-06-14",
        status: "official-verified"
      },
      {
        title: "USM OnlineIPS application guide",
        url: applicationGuideUrl,
        sourceType: "entry-requirement",
        verifiedAt: "2026-06-14",
        status: "official-verified"
      }
    ];
    const localOnly =
      record.internationalEligibility === "not-eligible-malaysian-candidate-only" ||
      record.internationalEligibility === "malaysian-candidate-only" ||
      /Malaysian Candidate Only/i.test(record.officialName);
    const eligibilityUnconfirmed = record.internationalEligibility === "not-explicitly-confirmed-on-public-detail";
    const publicDisplayStatus = localOnly
      ? "not-available-for-international" as const
      : eligibilityUnconfirmed
        ? "needs-review" as const
        : "ready" as const;
    const descriptionZh = `${record.faculty}开设的${record.studyMode === "research" ? "研究型" : record.studyMode === "coursework" ? "授课型" : record.studyMode === "mixed" ? "混合型" : "临床型"}硕士项目。申请、学制与费用以所列 USM 官方来源为准。`;
    return {
      slug: stableSlug(record),
      code: stableCode(record.code),
      name,
      nameEnOfficial: record.officialName,
      level: "master",
      category: categoryFor(record),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: record.studyMode,
      campus: record.campus.name || "USM",
      durationYears: duration.durationYears,
      durationOfficial: duration.durationOfficial,
      annualTuitionCny: 0,
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: null,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: feeDirectoryUrl,
      officialFeeAuditStatus: fee.status,
      officialFeeAuditedAt: "2026-06-14",
      intakeMonths: months,
      officialIntake: normalizeEvidenceText(record.intake.textEnOfficial).slice(0, 255),
      officialIntakeNote: `USM official intake schedule verified; source status: ${record.intake.status}.`,
      languageRequirement: {
        ielts: extractIelts(record.languageRequirement.textEnOfficial),
        toefl: 0,
        muet: 0,
        pte: 0
      },
      officialLanguageRequirement: sanitizeOfficialText(record.languageRequirement.textEnOfficial),
      requirement: {
        gpa: extractCgpa(record.academicRequirement.textEnOfficial),
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          sanitizeOfficialText(record.academicRequirement.textEnOfficial),
          "Ijazah sarjana muda yang berkaitan atau setaraf; rujuk syarat rasmi program.",
          "相关本科学位或同等学历；具体要求以官方项目页为准。",
          "相關本科學位或同等學歷；具體要求以官方項目頁為準。"
        )
      },
      officialAcademicRequirement: sanitizeOfficialText(record.academicRequirement.textEnOfficial),
      chinaStudentRequirement: localOnly
        ? "该项目官方标注仅限马来西亚申请人，不适用于中国及其他国际学生申请。"
        : eligibilityUnconfirmed
          ? "该项目公开详情页未明确确认国际学生申请资格，暂不作为中国学生可申请项目展示。"
          : "中国学历、成绩单及非英文材料须按 OnlineIPS 指南提交官方英文翻译；最终资格由 USM 审核。",
      specialRequirementsNote: localOnly
        ? "Official directory marks this programme as Malaysian Candidate Only; it is retained for catalogue completeness and is not available to international applicants."
        : eligibilityUnconfirmed
          ? "The public programme detail does not explicitly confirm international eligibility; retained for review and excluded from the ready international catalogue."
          : `International eligibility status: ${record.internationalEligibility}.`,
      applicationDocs: applicationDocuments(source, record.studyMode),
      curriculum: localizedArray(
        [sanitizeOfficialText(record.overviewOfficial) || "Refer to the official programme page for curriculum details."],
        ["Rujuk halaman rasmi program untuk struktur kurikulum."],
        ["课程与研究方向以 USM 官方项目页为准。"],
        ["課程與研究方向以 USM 官方項目頁為準。"]
      ),
      careers: localizedArray(
        ["USM does not publish a structured career list for this programme."],
        ["USM tidak menerbitkan senarai kerjaya berstruktur untuk program ini."],
        ["USM 官方未公布该项目的结构化职业方向列表。"],
        ["USM 官方未公布該項目的結構化職業方向列表。"]
      ),
      specializations: localizedSpecializations(record),
      description: t(
        `${record.officialName} is a ${record.studyMode}-mode master's programme offered by ${record.faculty}. Refer to the linked USM sources for current admission, duration and fee terms.`,
        `${record.officialName} ialah program sarjana mod ${record.studyMode} yang ditawarkan oleh ${record.faculty}. Rujuk sumber rasmi USM untuk syarat semasa.`,
        descriptionZh,
        toTraditional(descriptionZh)
      ),
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
      officialSourceUrl: record.evidence.officialDirectoryUrl,
      officialEntryRequirementSourceUrl: record.academicRequirement.officialSourceUrl || record.evidence.officialDirectoryUrl,
      officialAccreditationSourceUrl: record.evidence.officialDirectoryUrl,
      sourceUrls: sourceLinks,
      officialVerifiedAt: "2026-06-14",
      officialSourceStatus: localOnly ? "official-page-verified-international-not-available" : "official-verified",
      publicDisplayStatus,
      publicDisplayNote: localOnly
        ? "USM official directory marks this programme as Malaysian Candidate Only; retained for audit and excluded from the international application list."
        : eligibilityUnconfirmed
          ? "International eligibility is not explicitly confirmed on the public detail page; retained for audit and excluded pending confirmation."
          : "Published from the audited USM public postgraduate directory; StudyMY localisations are non-official.",
      reviewReason: localOnly
        ? "Not available to international applicants."
        : eligibilityUnconfirmed
          ? "International eligibility requires official confirmation."
          : null,
      auditNote: `StudyMY audit verified USM directory record ${record.code} on 2026-06-14. Original duration: ${duration.rawOfficial}. Fee status: ${record.fee.status}. Evidence hash: ${record.evidence.detailSha256.slice(0, 16)}.`,
      listTuitionText: fee.display || "Official fee not published",
      isPublished: publicDisplayStatus === "ready"
    };
  });
}

export function validateUsmMasterSource(source: MasterCommercialSource) {
  const errors: string[] = [];
  if (source.universityCode !== "USM") errors.push("universityCode must be USM.");
  if (source.level !== "master") errors.push("level must be master.");
  if (source.records.length !== 274) errors.push(`Expected 274 records, received ${source.records.length}.`);
  if (source.audit.recordCount !== 274) errors.push("Audit record count must be 274.");
  if (source.catalogueDecision.officialDirectoryEntryCount !== 274) errors.push("Directory count must be 274.");
  if (new Set(source.records.map((record) => record.code)).size !== source.records.length) errors.push("Candidate codes must be unique.");
  if (new Set(source.records.map(stableSlug)).size !== source.records.length) errors.push("Generated slugs must be unique.");
  if (source.audit.currentNamedFeeRowsAccountedFor !== 110) errors.push("Expected 110 accounted named fee rows.");
  if (source.audit.exceptionCount !== 0) errors.push("Candidate audit contains unresolved exceptions.");
  return errors;
}

export function summarizeUsmMasterRows(rows: Array<DeepPartial<ProgramEntity>>) {
  return {
    rows: rows.length,
    ready: rows.filter((row) => row.publicDisplayStatus === "ready" && row.isPublished).length,
    notAvailableForInternational: rows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length,
    needsReview: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    yearDuration: rows.filter((row) => /years?/i.test(String(row.durationOfficial))).length,
    feeMatched: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    feeNotPublished: rows.filter((row) => row.officialFeeAuditStatus === "not-published").length,
    modes: rows.reduce<Record<string, number>>((result, row) => {
      result[String(row.studyMode)] = (result[String(row.studyMode)] || 0) + 1;
      return result;
    }, {})
  };
}

async function verifyRows(manager: EntityManager | DataSource, universityId: number) {
  const repository = manager.getRepository(ProgramEntity);
  const canonical = await repository.find({ where: { universityId, level: "master" } });
  const publicMaster = canonical.filter((row) => row.isPublished && row.publicDisplayStatus === "ready");
  const publishedBachelor = await repository.count({
    where: { universityId, level: "bachelor", isPublished: true, publicDisplayStatus: "ready" }
  });
  const commercial = canonical.filter((row) => row.slug.startsWith(USM_MASTER_SLUG_PREFIX));
  const notAvailableForInternational = commercial.filter((row) => row.publicDisplayStatus === "not-available-for-international");
  const needsReview = commercial.filter((row) => row.publicDisplayStatus === "needs-review");
  const leakedLegacy = publicMaster.filter((row) => !row.slug.startsWith(USM_MASTER_SLUG_PREFIX));
  const convertedDurations = commercial.filter((row) => /years?/i.test(row.durationOfficial)).length;
  if (
    commercial.length !== 274 ||
    publicMaster.length !== 270 ||
    notAvailableForInternational.length !== 1 ||
    needsReview.length !== 3 ||
    leakedLegacy.length !== 0 ||
    publishedBachelor !== 63
  ) {
    throw new Error(
      `USM master verification failed: canonical=${commercial.length}, publicMaster=${publicMaster.length}, leakedLegacy=${leakedLegacy.length}, bachelor=${publishedBachelor}.`
    );
  }
  return {
    canonicalRows: commercial.length,
    publicMasterRows: publicMaster.length,
    publicBachelorRows: publishedBachelor,
    totalPublicRows: publicMaster.length + publishedBachelor,
    notAvailableForInternationalRows: notAvailableForInternational.length,
    needsReviewRows: needsReview.length,
    leakedLegacyRows: leakedLegacy.length,
    durationDisplayedInYears: convertedDurations,
    feeMatchedRows: commercial.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    feeNotPublishedRows: commercial.filter((row) => row.officialFeeAuditStatus === "not-published").length
  };
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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
  const sourcePath = resolve(readArgValue("--source") || DEFAULT_USM_MASTER_SOURCE_PATH);
  if (!existsSync(sourcePath)) throw new Error(`USM master source not found: ${sourcePath}`);
  const source = JSON.parse(readFileSync(sourcePath, "utf8")) as MasterCommercialSource;
  const errors = validateUsmMasterSource(source);
  if (errors.length) throw new Error(`USM master source validation failed:\n${errors.join("\n")}`);
  const rows = buildUsmMasterRows(source);
  const summary = summarizeUsmMasterRows(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const backupPath = resolve(
    readArgValue("--backup-output") ||
      `tmp/backups/usm-master-commercial-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  if (!verifyOnly && !confirm) {
    console.log(JSON.stringify({
      mode: "dry-run",
      sourcePath,
      summary,
      writePolicy: {
        university: "USM",
        level: "master",
        canonicalRows: 274,
        archiveLegacyPublicMasterRows: true,
        preserveBachelorAndDoctoralRows: true,
        programmeCountAfterImport: 333
      }
    }, null, 2));
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
    const university = await dataSource.getRepository(UniversityEntity).findOne({ where: { code: "USM" } });
    if (!university) throw new Error("USM university row not found.");
    if (verifyOnly) {
      console.log(JSON.stringify({
        mode: "verified",
        universityId: university.id,
        summary,
        verification: await verifyRows(dataSource, university.id)
      }, null, 2));
      return;
    }

    const currentPrograms = await dataSource.getRepository(ProgramEntity).find({ where: { universityId: university.id } });
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );
    let verification: Awaited<ReturnType<typeof verifyRows>> | null = null;
    await dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ProgramEntity);
      const currentMaster = await repository.find({ where: { universityId: university.id, level: "master" } });
      for (const existing of currentMaster) {
        if (existing.slug.startsWith(USM_MASTER_SLUG_PREFIX)) continue;
        existing.isPublished = false;
        existing.publicDisplayStatus = "archived";
        existing.publicDisplayNote = "Superseded by the audited USM public master directory dataset.";
        existing.reviewReason = "Archived to prevent duplicate public display after canonical USM master publication.";
        await repository.save(existing);
      }
      for (const row of rows) {
        const existing = await repository.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await repository.save(repository.create({ ...row, id: existing?.id, universityId: university.id }));
      }
      university.programCount = 333;
      university.officialProfile = {
        ...(university.officialProfile || {}),
        catalogStatusSummary: {
          all: {
            total: 337,
            ready: 333,
            needsReview: 3,
            notAvailableForInternational: 1
          },
          byLevel: {
            bachelor: {
              total: 63,
              ready: 63,
              needsReview: 0,
              notAvailableForInternational: 0
            },
            master: {
              total: 274,
              ready: 270,
              needsReview: 3,
              notAvailableForInternational: 1
            },
            phd: {
              total: 0,
              ready: 0,
              needsReview: 0,
              notAvailableForInternational: 0
            }
          }
        }
      };
      await manager.getRepository(UniversityEntity).save(university);
      verification = await verifyRows(manager, university.id);
    });
    const catalogCacheCleared = await clearCatalogCache();
    console.log(JSON.stringify({
      mode: "imported",
      universityId: university.id,
      backupPath,
      catalogCacheCleared,
      summary,
      verification
    }, null, 2));
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
