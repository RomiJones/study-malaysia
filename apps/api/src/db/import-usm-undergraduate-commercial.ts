import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DataSource, Not, type DeepPartial, type EntityManager } from "typeorm";
import type { LocalizedStringArray, LocalizedText, OfficialSourceLink } from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const USM_COMMERCIAL_SLUG_PREFIX = "usm-ug-commercial-2025-2026-";
export const DEFAULT_USM_COMMERCIAL_SOURCE_PATH = resolve(
  repositoryRoot,
  "data/imports/usm/2026-06-13/undergraduate-commercial-source.json"
);
const prospectusUrl =
  "https://admission.usm.my/images/00uginternational/download_2025/PROSPECTUS_FOR_FIRST_DEGREE_2025-2026.pdf";
const summaryUrl =
  "https://admission.usm.my/images/00uginternational/download_2025/SUMMARY_OF_PROGRAMME.pdf";
const feeUrl =
  "https://admission.usm.my/images/00uginternational/fee_2025/UNDERGRADUATE_INTERNATIONAL_TUITION_FEES_PER_SEMESTER.pdf";
const csvUrl = "https://admission.usm.my/images/data/antarbangsa.csv";

export interface CommercialSource {
  universityCode: "USM";
  officialDomains: string[];
  level: "bachelor";
  applicantScope: "international";
  academicSession: string;
  retrievedAt: string;
  verifiedAt: string;
  programmeCount: number;
  sources: Array<{ title: string; url: string; sha256?: string; pages?: number; role: string }>;
  programmes: CommercialProgramme[];
}

export interface CommercialProgramme {
  ordinal: number;
  code: string;
  nameEnOfficial: string;
  nameMs: string;
  schoolEn: string;
  summaryPage: number;
  requirementsPage: number;
  feePage: number;
  category: string;
  campus: string;
  studyMode: string;
  durationSemesters: number;
  durationYears: number;
  durationOfficial: string;
  intakeMonths: string[];
  interviewRequired: boolean;
  offshore: boolean;
  mediumInstruction: string;
  tuitionPerSemesterUSD: number;
  totalTuitionUSD: number;
  recurrentFeePerSemesterUSD: number;
  registrationFeeUSD: number;
  feeNote: string | null;
  generalRequirementEn: string;
  highSchoolRequirementEn: string;
  alternativeQualificationRequirementEn: string;
  ieltsMinimum: number;
  careersEn: string[];
  specializationsEn: string[];
  officialSourceUrl: string;
}

const nameZh: Record<string, [string, string]> = {
  US6721001: ["医学专业学位（MD）", "醫學專業學位（MD）"],
  "0006": ["国际医学课程（IMP，USM-KLE）", "國際醫學課程（IMP，USM-KLE）"],
  US6724001: ["牙科专业学位（DDS）", "牙科專業學位（DDS）"],
  US6545005: ["法医科学荣誉学士", "法醫科學榮譽學士"],
  US6725001: ["生物医学科学荣誉学士", "生物醫學科學榮譽學士"],
  US6725002: ["医学放射学荣誉学士", "醫學放射學榮譽學士"],
  US6726002: ["营养学荣誉学士", "營養學榮譽學士"],
  US6813001: ["运动与体育科学健康科学荣誉学士", "運動與體育科學健康科學榮譽學士"],
  US6862001: ["环境与职业健康荣誉学士", "環境與職業健康榮譽學士"],
  US6214003: ["室内建筑荣誉学士", "室內建築榮譽學士"],
  US6526001: ["工料测量科学荣誉学士", "工料測量科學榮譽學士"],
  US6581001: ["建筑学科学荣誉学士", "建築學科學榮譽學士"],
  US6581002: ["城市与区域规划荣誉学士", "城市與區域規劃榮譽學士"],
  US6582001: ["建筑测量荣誉学士", "建築測量榮譽學士"],
  US6582004: ["建设项目管理科学荣誉学士", "建設專案管理科學榮譽學士"],
  US6582003: ["建筑工程技术荣誉学士", "建築工程技術榮譽學士"],
  US6421001: ["应用科学荣誉学士（农业生物学／生物技术／环境生物学／昆虫学与寄生虫学）", "應用科學榮譽學士（農業生物學／生物技術／環境生物學／昆蟲學與寄生蟲學）"],
  US6421002: ["科学荣誉学士（动植物多样性／微生物学）", "科學榮譽學士（動植物多樣性／微生物學）"],
  US6524005: ["环境技术荣誉学士", "環境技術榮譽學士"],
  US6541001: ["食品技术荣誉学士", "食品技術榮譽學士"],
  US6543001: ["生物资源技术荣誉学士", "生物資源技術榮譽學士"],
  US6524006: ["生物过程工程技术荣誉学士", "生物過程工程技術榮譽學士"],
  US6441001: ["物理学科学荣誉学士", "物理學科學榮譽學士"],
  US6443001: ["地球物理学应用科学荣誉学士", "地球物理學應用科學榮譽學士"],
  US6545003: ["医学物理学应用科学荣誉学士", "醫學物理學應用科學榮譽學士"],
  US6442001: ["分析化学应用科学荣誉学士", "分析化學應用科學榮譽學士"],
  US6442002: ["化学科学荣誉学士", "化學科學榮譽學士"],
  US6545002: ["工业化学应用科学荣誉学士", "工業化學應用科學榮譽學士"],
  US6461004: ["数学科学荣誉学士", "數學科學榮譽學士"],
  US6462001: ["应用统计学应用科学荣誉学士", "應用統計學應用科學榮譽學士"],
  US6481002: ["软件工程荣誉学士", "軟體工程榮譽學士"],
  US6481003: ["计算机科学荣誉学士（计算基础设施）", "電腦科學榮譽學士（運算基礎設施）"],
  US6481004: ["计算机科学荣誉学士（智能计算）", "電腦科學榮譽學士（智慧運算）"],
  "0101": ["软件工程荣誉学士（USM-UOWKDUPG）", "軟體工程榮譽學士（USM-UOWKDUPG）"],
  "0102": ["计算机科学荣誉学士（智能计算，USM-UOWKDUPG）", "電腦科學榮譽學士（智慧運算，USM-UOWKDUPG）"],
  US6145004: ["英语教学教育荣誉学士", "英語教學教育榮譽學士"],
  US6211001: ["美术文学荣誉学士", "美術文學榮譽學士"],
  US6212001: ["音乐荣誉学士", "音樂榮譽學士"],
  US6212002: ["表演与导演美术荣誉学士", "表演與導演美術榮譽學士"],
  US6213001: ["新媒体设计与技术美术荣誉学士", "新媒體設計與技術美術榮譽學士"],
  US6214001: ["图形传播美术荣誉学士", "圖形傳播美術榮譽學士"],
  US6214002: ["产品设计美术荣誉学士", "產品設計美術榮譽學士"],
  US6220001: ["马来语语言学文学荣誉学士", "馬來語語言學文學榮譽學士"],
  US6222001: ["翻译与口译文学荣誉学士", "翻譯與口譯文學榮譽學士"],
  US6224001: ["英语语言与文学研究文学荣誉学士", "英語語言與文學研究文學榮譽學士"],
  US6222002: ["专业英语文学荣誉学士", "專業英語文學榮譽學士"],
  US6310001: ["社会科学荣誉学士", "社會科學榮譽學士"],
  US6314001: ["经济学荣誉学士", "經濟學榮譽學士"],
  US6321001: ["传播学荣誉学士", "傳播學榮譽學士"],
  US6344001: ["会计学荣誉学士", "會計學榮譽學士"],
  US6345001: ["管理学荣誉学士", "管理學榮譽學士"],
  "0020": ["管理学荣誉学士（USM 国际学院，RECSAM）", "管理學榮譽學士（USM 國際學院，RECSAM）"],
  US6521001: ["机械工程荣誉学士", "機械工程榮譽學士"],
  US6540001: ["制造工程与管理荣誉学士", "製造工程與管理榮譽學士"],
  US6522001: ["电气工程荣誉学士", "電機工程榮譽學士"],
  US6523001: ["机电一体化工程荣誉学士", "機電整合工程榮譽學士"],
  US6523002: ["电子工程荣誉学士", "電子工程榮譽學士"],
  US6524001: ["化学工程荣誉学士", "化學工程榮譽學士"],
  US6524002: ["矿产资源工程荣誉学士", "礦產資源工程榮譽學士"],
  US6524003: ["高分子工程荣誉学士", "高分子工程榮譽學士"],
  US6527001: ["材料工程荣誉学士", "材料工程榮譽學士"],
  US6525001: ["航空航天工程荣誉学士", "航空航太工程榮譽學士"],
  US6526002: ["土木工程荣誉学士", "土木工程榮譽學士"]
};

const facultyTranslations: Record<string, [string, string, string]> = {
  "School of Medical Sciences": ["医学科学学院", "醫學科學學院", "Pusat Pengajian Sains Perubatan"],
  "School of Dental Sciences": ["牙科科学学院", "牙科科學學院", "Pusat Pengajian Sains Pergigian"],
  "School of Health Sciences": ["健康科学学院", "健康科學學院", "Pusat Pengajian Sains Kesihatan"],
  "School of Housing, Building and Planning": ["住房、建筑与规划学院", "住宅、建築與規劃學院", "Pusat Pengajian Perumahan, Bangunan dan Perancangan"],
  "School of Biological Sciences": ["生物科学学院", "生物科學學院", "Pusat Pengajian Sains Kajihayat"],
  "School of Industrial Technology": ["工业技术学院", "工業技術學院", "Pusat Pengajian Teknologi Industri"],
  "School of Physics": ["物理学院", "物理學院", "Pusat Pengajian Sains Fizik"],
  "School of Chemical Sciences": ["化学科学学院", "化學科學學院", "Pusat Pengajian Sains Kimia"],
  "School of Mathematical Sciences": ["数学科学学院", "數學科學學院", "Pusat Pengajian Sains Matematik"],
  "School of Computer Sciences": ["计算机科学学院", "電腦科學學院", "Pusat Pengajian Sains Komputer"],
  "School of Educational Studies": ["教育研究学院", "教育研究學院", "Pusat Pengajian Ilmu Pendidikan"],
  "School of Arts": ["艺术学院", "藝術學院", "Pusat Pengajian Seni"],
  "School of Humanities": ["人文学院", "人文學院", "Pusat Pengajian Ilmu Kemanusiaan"],
  "School of Languages, Literacies & Translation": ["语言、读写与翻译学院", "語言、讀寫與翻譯學院", "Pusat Pengajian Bahasa, Literasi dan Terjemahan"],
  "School of Social Sciences": ["社会科学学院", "社會科學學院", "Pusat Pengajian Sains Kemasyarakatan"],
  "School of Communication": ["传播学院", "傳播學院", "Pusat Pengajian Komunikasi"],
  "School of Management": ["管理学院", "管理學院", "Pusat Pengajian Pengurusan"],
  "School of Mechanical Engineering": ["机械工程学院", "機械工程學院", "Pusat Pengajian Kejuruteraan Mekanik"],
  "School of Electrical & Electronic Engineering": ["电气与电子工程学院", "電機與電子工程學院", "Pusat Pengajian Kejuruteraan Elektrik dan Elektronik"],
  "School of Chemical Engineering": ["化学工程学院", "化學工程學院", "Pusat Pengajian Kejuruteraan Kimia"],
  "School of Materials and Mineral Resources Engineering": ["材料与矿产资源工程学院", "材料與礦產資源工程學院", "Pusat Pengajian Kejuruteraan Bahan dan Sumber Mineral"],
  "School of Aerospace Engineering": ["航空航天工程学院", "航空航太工程學院", "Pusat Pengajian Kejuruteraan Aeroangkasa"],
  "School of Civil Engineering": ["土木工程学院", "土木工程學院", "Pusat Pengajian Kejuruteraan Awam"]
};

const roleTranslations: Array<[RegExp, string, string, string]> = [
  [/Official prospectus does not list a separate career section for this programme\./i, "官方简章未为本专业单列职业方向。", "官方簡章未為本專業單列職業方向。", "Prospektus rasmi tidak menyenaraikan bahagian kerjaya khusus untuk program ini."],
  [/Medical Doctor/i, "医生", "醫師", "Doktor Perubatan"],
  [/Dentist/i, "牙医", "牙醫", "Doktor Gigi"],
  [/Software Engineer/i, "软件工程师", "軟體工程師", "Jurutera Perisian"],
  [/Data Scientist/i, "数据科学家", "資料科學家", "Saintis Data"],
  [/Business Analyst/i, "商业分析师", "商業分析師", "Penganalisis Perniagaan"],
  [/Financial Analyst/i, "金融分析师", "金融分析師", "Penganalisis Kewangan"],
  [/Data Analyst/i, "数据分析师", "資料分析師", "Penganalisis Data"],
  [/Engineer/i, "工程师", "工程師", "Jurutera"],
  [/Officer/i, "专业官员", "專業官員", "Pegawai"],
  [/Researcher/i, "研究人员", "研究人員", "Penyelidik"],
  [/Lecturer/i, "讲师", "講師", "Pensyarah"],
  [/Teacher/i, "教师", "教師", "Guru"],
  [/Consultant/i, "顾问", "顧問", "Perunding"],
  [/Manager/i, "经理", "經理", "Pengurus"],
  [/Architect/i, "建筑师", "建築師", "Arkitek"],
  [/Designer/i, "设计师", "設計師", "Pereka"],
  [/Surveyor/i, "测量师", "測量師", "Juruukur"],
  [/Accountant/i, "会计师", "會計師", "Akauntan"],
  [/Auditor/i, "审计师", "稽核師", "Juruaudit"],
  [/Translator/i, "翻译员", "翻譯員", "Penterjemah"],
  [/Interpreter/i, "口译员", "口譯員", "Jurubahasa"],
  [/Editor/i, "编辑", "編輯", "Editor"],
  [/Writer/i, "作家／撰稿人", "作家／撰稿人", "Penulis"],
  [/Journalist/i, "记者", "記者", "Wartawan"],
  [/Musician/i, "音乐家", "音樂家", "Pemuzik"],
  [/Actor/i, "演员", "演員", "Pelakon"],
  [/Director/i, "导演", "導演", "Pengarah"],
  [/Producer/i, "制作人", "製作人", "Penerbit"],
  [/Statistician/i, "统计师", "統計師", "Ahli Statistik"],
  [/Economist/i, "经济学家", "經濟學家", "Ahli Ekonomi"],
  [/Chemist/i, "化学师", "化學師", "Ahli Kimia"],
  [/Geophysicist/i, "地球物理学家", "地球物理學家", "Ahli Geofizik"],
  [/Meteorologist/i, "气象学家", "氣象學家", "Ahli Meteorologi"],
  [/Biotechnologist/i, "生物技术专家", "生物技術專家", "Ahli Bioteknologi"],
  [/Bioinformatician/i, "生物信息学专家", "生物資訊學專家", "Ahli Bioinformatik"],
  [/Technologist/i, "技术专家", "技術專家", "Ahli Teknologi"],
  [/Specialist/i, "专业人员", "專業人員", "Pakar"],
  [/Executive/i, "专员", "專員", "Eksekutif"],
  [/Advisor/i, "顾问", "顧問", "Penasihat"],
  [/Coach/i, "教练", "教練", "Jurulatih"],
  [/Physiotherapist/i, "物理治疗师", "物理治療師", "Ahli Fisioterapi"],
  [/Programmer/i, "程序员", "程式設計師", "Pengatur Cara"],
  [/Arbitrator/i, "仲裁员", "仲裁員", "Penimbang Tara"],
  [/Contractor/i, "承包商", "承包商", "Kontraktor"],
  [/Government Officer/i, "政府官员", "政府官員", "Pegawai Kerajaan"]
];

const specializationTranslations: Record<string, [string, string, string]> = {
  Agrobiology: ["农业生物学", "農業生物學", "Agrobiologi"],
  Biotechnology: ["生物技术", "生物技術", "Bioteknologi"],
  "Environmental Biology": ["环境生物学", "環境生物學", "Biologi Persekitaran"],
  "Entomology and Parasitology": ["昆虫学与寄生虫学", "昆蟲學與寄生蟲學", "Entomologi dan Parasitologi"],
  "Animal Biology": ["动物生物学", "動物生物學", "Biologi Haiwan"],
  "Plant Biology": ["植物生物学", "植物生物學", "Biologi Tumbuhan"],
  Microbiology: ["微生物学", "微生物學", "Mikrobiologi"],
  "Anthropology and Sociology": ["人类学与社会学", "人類學與社會學", "Antropologi dan Sosiologi"],
  "Development Planning and Management": ["发展规划与管理", "發展規劃與管理", "Perancangan dan Pengurusan Pembangunan"],
  Economics: ["经济学", "經濟學", "Ekonomi"],
  "Political Science": ["政治学", "政治學", "Sains Politik"],
  "Digital Communication": ["数字传播", "數位傳播", "Komunikasi Digital"],
  Journalism: ["新闻学", "新聞學", "Kewartawanan"],
  "Strategic Communication": ["策略传播", "策略傳播", "Komunikasi Strategik"],
  "Creative Screen": ["创意影视", "創意影視", "Skrin Kreatif"],
  Finance: ["金融", "金融", "Kewangan"],
  "International Business": ["国际商务", "國際商務", "Perniagaan Antarabangsa"],
  Marketing: ["市场营销", "市場行銷", "Pemasaran"],
  "Operations Management": ["运营管理", "營運管理", "Pengurusan Operasi"],
  "Strategy and Organisational Management": ["战略与组织管理", "策略與組織管理", "Pengurusan Strategi dan Organisasi"],
  "Islamic Finance": ["伊斯兰金融", "伊斯蘭金融", "Kewangan Islam"],
  "Business Analytics": ["商业分析", "商業分析", "Analitik Perniagaan"]
};

const t = (en: string, ms: string, zhCN: string, zhTW: string): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const a = (en: string[], ms: string[], zhCN: string[], zhTW: string[]): LocalizedStringArray => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

function readArgValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pageUrl(page: number) {
  return `${prospectusUrl}#page=${page}`;
}

function localizedName(programme: CommercialProgramme): LocalizedText {
  const translated = nameZh[programme.code];
  if (!translated) throw new Error(`Missing Chinese programme translation for ${programme.code}.`);
  return t(programme.nameEnOfficial, programme.nameMs, translated[0], translated[1]);
}

function localizedFaculty(value: string): LocalizedText {
  const translated = facultyTranslations[value];
  if (!translated) throw new Error(`Missing faculty translation for ${value}.`);
  return t(value, translated[2], translated[0], translated[1]);
}

function translateRole(value: string) {
  for (const [pattern, zhCN, zhTW, ms] of roleTranslations) {
    if (pattern.test(value)) return { en: value, ms, zhCN, zhTW };
  }
  return {
    en: value,
    ms: `Kerjaya rasmi: ${value}`,
    zhCN: `官方职业方向：${value}`,
    zhTW: `官方職業方向：${value}`
  };
}

function localizedArray(values: string[]): LocalizedStringArray {
  const translated = values.map(translateRole);
  return a(
    translated.map((item) => item.en),
    translated.map((item) => item.ms),
    translated.map((item) => item.zhCN),
    translated.map((item) => item.zhTW)
  );
}

function localizedSpecializations(values: string[]): LocalizedStringArray {
  const translated = values.map((value) => {
    const item = specializationTranslations[value];
    if (!item) throw new Error(`Missing specialization translation for ${value}.`);
    return { en: value, ms: item[2], zhCN: item[0], zhTW: item[1] };
  });
  return a(
    translated.map((item) => item.en),
    translated.map((item) => item.ms),
    translated.map((item) => item.zhCN),
    translated.map((item) => item.zhTW)
  );
}

function parseRequirementNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function requirementNote(programme: CommercialProgramme): LocalizedText {
  const source = `${programme.highSchoolRequirementEn} ${programme.alternativeQualificationRequirementEn}`;
  const cgpa = parseRequirementNumber(source, /CGPA\s+(\d+(?:\.\d+)?)/i);
  const grade = source.match(/minimum grade\s+([A-C][+-]?)/i)?.[1] ?? null;
  const en = `Official programme requirements apply. ${cgpa ? `Minimum stated CGPA: ${cgpa.toFixed(2)}. ` : ""}${grade ? `Minimum stated subject grade: ${grade}. ` : ""}See prospectus page ${programme.requirementsPage} for accepted High School, Diploma, A-Level, IB, AUSMAT and SAM routes.`;
  const ms = `Syarat rasmi program terpakai. ${cgpa ? `PNGK minimum yang dinyatakan: ${cgpa.toFixed(2)}. ` : ""}${grade ? `Gred minimum subjek yang dinyatakan: ${grade}. ` : ""}Rujuk halaman ${programme.requirementsPage} prospektus untuk laluan High School, Diploma, A-Level, IB, AUSMAT dan SAM.`;
  const zhCN = `适用官方专业入学要求。${cgpa ? `公布的最低 CGPA 为 ${cgpa.toFixed(2)}。` : ""}${grade ? `公布的科目最低成绩为 ${grade}。` : ""}高中、文凭、A-Level、IB、AUSMAT 和 SAM 路径详见简章第 ${programme.requirementsPage} 页。`;
  const zhTW = `適用官方專業入學要求。${cgpa ? `公布的最低 CGPA 為 ${cgpa.toFixed(2)}。` : ""}${grade ? `公布的科目最低成績為 ${grade}。` : ""}高中、文憑、A-Level、IB、AUSMAT 和 SAM 路徑詳見簡章第 ${programme.requirementsPage} 頁。`;
  return t(en, ms, zhCN, zhTW);
}

function description(programme: CommercialProgramme): LocalizedText {
  const name = localizedName(programme);
  const faculty = localizedFaculty(programme.schoolEn);
  return t(
    `${programme.nameEnOfficial} is a full-time USM undergraduate programme offered by ${programme.schoolEn} for the ${programme.durationOfficial} official duration.`,
    `${name.ms} ialah program prasiswazah sepenuh masa USM yang ditawarkan oleh ${faculty.ms} dengan tempoh rasmi ${programme.durationOfficial}.`,
    `${name["zh-CN"]}是由 USM ${faculty["zh-CN"]}开设的全日制本科项目，官方学制为 ${programme.durationSemesters} 个学期（${programme.durationYears} 年）。`,
    `${name["zh-TW"]}是由 USM ${faculty["zh-TW"]}開設的全日制本科項目，官方學制為 ${programme.durationSemesters} 個學期（${programme.durationYears} 年）。`
  );
}

function sourceLinks(programme: CommercialProgramme, verifiedAt: string): OfficialSourceLink[] {
  return [
    {
      title: "USM official programme summary",
      url: pageUrl(programme.summaryPage),
      sourceType: "admission",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "USM official programme requirements",
      url: pageUrl(programme.requirementsPage),
      sourceType: "entry-requirement",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "USM official international fee table",
      url: pageUrl(programme.feePage),
      sourceType: "fee",
      verifiedAt,
      status: "official-verified",
      note: programme.feeNote
    },
    {
      title: "USM official 2025/2026 programme summary PDF",
      url: summaryUrl,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "USM official undergraduate fee cross-check PDF",
      url: feeUrl,
      sourceType: "fee",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "USM current international undergraduate CSV",
      url: csvUrl,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified",
      note: "Used for change detection only; the prospectus is the canonical programme directory."
    }
  ];
}

function officialLanguageRequirement(programme: CommercialProgramme) {
  return programme.generalRequirementEn.match(/ENGLISH\s+(.+?)(?:Without any|INTERVIEW|Note:)/i)?.[1]?.trim()
    || `IELTS minimum Band ${programme.ieltsMinimum}; see official prospectus page ${programme.requirementsPage} for alternatives.`;
}

function toProgramRow(programme: CommercialProgramme, verifiedAt: string): DeepPartial<ProgramEntity> {
  const feeNote = [
    `Official tuition: USD ${money(programme.tuitionPerSemesterUSD)} per semester; USD ${money(programme.totalTuitionUSD)} total programme tuition.`,
    `Official recurrent fee: USD ${money(programme.recurrentFeePerSemesterUSD)} per semester.`,
    `Official registration fee: USD ${money(programme.registrationFeeUSD)} payable upon registration.`,
    programme.feeNote,
    "Fees are subject to change without prior notice; welfare and facility fees are charged each semester."
  ].filter(Boolean).join(" ");
  const intake = programme.intakeMonths.join(", ");
  const applicationDocs = a(
    [
      "Official certificates, transcripts, mark sheets or school reports",
      "Official English translations when documents are not in English or Malay",
      "Accepted English proficiency result or medium-of-instruction evidence",
      "Passport details page",
      "Employment Pass when working in Malaysia",
      "Student Pass when studying in Malaysia",
      "Scholarship letter when sponsored",
      "Processing fee receipt"
    ],
    [
      "Sijil rasmi, transkrip, lembaran markah atau laporan sekolah",
      "Terjemahan rasmi bahasa Inggeris jika dokumen bukan dalam bahasa Inggeris atau Melayu",
      "Keputusan kecekapan bahasa Inggeris atau bukti bahasa pengantar yang diterima",
      "Halaman butiran pasport",
      "Pas Penggajian jika bekerja di Malaysia",
      "Pas Pelajar jika belajar di Malaysia",
      "Surat biasiswa jika ditaja",
      "Resit yuran pemprosesan"
    ],
    [
      "官方证书、成绩单、分数表或学校报告",
      "非英语或马来语文件的官方英文译本",
      "认可的英语成绩或授课语言证明",
      "护照信息页",
      "在马来西亚工作时提供就业准证",
      "在马来西亚学习时提供学生准证",
      "受资助时提供奖学金证明",
      "申请处理费收据"
    ],
    [
      "官方證書、成績單、分數表或學校報告",
      "非英語或馬來語文件的官方英文譯本",
      "認可的英語成績或授課語言證明",
      "護照資料頁",
      "在馬來西亞工作時提供就業准證",
      "在馬來西亞學習時提供學生准證",
      "受資助時提供獎學金證明",
      "申請處理費收據"
    ]
  );
  const specializations = localizedSpecializations(programme.specializationsEn);
  return {
    slug: `${USM_COMMERCIAL_SLUG_PREFIX}${slugify(programme.code)}-${slugify(programme.nameEnOfficial).slice(0, 60)}`,
    code: programme.code,
    name: localizedName(programme),
    nameEnOfficial: programme.nameEnOfficial,
    level: "bachelor",
    category: programme.category,
    faculty: localizedFaculty(programme.schoolEn),
    facultyZh: localizedFaculty(programme.schoolEn)["zh-CN"],
    studyMode: programme.studyMode,
    campus: programme.campus,
    durationYears: programme.durationYears,
    durationOfficial: programme.durationOfficial,
    annualTuitionCny: 0,
    tuitionAmount: programme.totalTuitionUSD,
    tuitionCurrency: "USD",
    tuitionDisplay: `USD ${money(programme.totalTuitionUSD)} total tuition`,
    officialTuitionMYR: null,
    officialTuitionNote: feeNote,
    officialFeeSourceUrl: pageUrl(programme.feePage),
    secondaryOfficialFeeSourceUrl: feeUrl,
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: programme.intakeMonths,
    officialIntake: `${intake} (${programme.intakeMonths.length === 2 ? "Semester I and Semester II" : "Semester I"})`,
    officialIntakeNote:
      `Official 2025/2026 prospectus intake. Semester I is October; the listed Semester II programmes are March. Historical application cut-off dates in the source have passed and are not presented as current deadlines.`,
    languageRequirement: {
      ielts: programme.ieltsMinimum,
      toefl: parseRequirementNumber(programme.generalRequirementEn, /TOEFL iBT minimum score of\s*(\d+(?:\.\d+)?)/i),
      pte: parseRequirementNumber(programme.generalRequirementEn, /PTE Academic[\s\S]{0,50}?minimum score of\s*(\d+(?:\.\d+)?)/i),
      muet: parseRequirementNumber(programme.generalRequirementEn, /Malaysian University English Test minimum Band\s*(\d+(?:\.\d+)?)/i)
    },
    officialLanguageRequirement: officialLanguageRequirement(programme),
    requirement: {
      gpa: parseRequirementNumber(programme.highSchoolRequirementEn, /CGPA\s+(\d+(?:\.\d+)?)/i) || 0,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: requirementNote(programme)
    },
    officialAcademicRequirement:
      `GENERAL: ${programme.generalRequirementEn}\n\nHIGH SCHOOL: ${programme.highSchoolRequirementEn}\n\nDIPLOMA / A-LEVEL / IB / AUSMAT / SAM: ${programme.alternativeQualificationRequirementEn}`,
    chinaStudentRequirement:
      "USM does not publish a China-specific route in this prospectus. Applicants should use the accepted High School, A-Level, IB, AUSMAT, SAM, Diploma or equivalent qualification route and obtain case-specific confirmation from USM.",
    specialRequirementsNote: [
      programme.interviewRequired ? "Official programme summary marks this as an interview programme." : null,
      programme.mediumInstruction === "Malay" ? "Official programme summary marks Malay as the medium of instruction." : null,
      programme.offshore ? `Official offshore programme at ${programme.campus}.` : null
    ].filter(Boolean).join(" ") || null,
    applicationDocs,
    curriculum: a(
      ["Official prospectus does not publish the full course list; use the programme page or school handbook."],
      ["Prospektus rasmi tidak menerbitkan senarai kursus penuh; rujuk halaman program atau buku panduan pusat pengajian."],
      ["官方简章未公布完整课程清单，请以专业页面或学院手册为准。"],
      ["官方簡章未公布完整課程清單，請以專業頁面或學院手冊為準。"]
    ),
    careers: localizedArray(programme.careersEn),
    specializations,
    description: description(programme),
    officialAccreditationNote:
      "Programme accreditation details are not published in the collected USM international prospectus and are not inferred.",
    officialSourceUrl: pageUrl(programme.summaryPage),
    officialEntryRequirementSourceUrl: pageUrl(programme.requirementsPage),
    officialAccreditationSourceUrl: "",
    sourceUrls: sourceLinks(programme, verifiedAt),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote:
      `Official USM international undergraduate catalogue snapshot for academic session 2025/2026, verified ${verifiedAt}. Chinese and Traditional Chinese titles are StudyMY localizations; official English and Malay names are retained.`,
    reviewReason: null,
    auditNote:
      `Canonical programme ${programme.ordinal}/63. Summary page ${programme.summaryPage}; requirements page ${programme.requirementsPage}; fee page ${programme.feePage}. ${programme.feeNote || "No internal fee arithmetic conflict detected."}`,
    listTuitionText: `USD ${money(programme.totalTuitionUSD)} total`,
    isPublished: true
  };
}

export function validateUsmCommercialSource(source: CommercialSource) {
  const errors: string[] = [];
  if (source.universityCode !== "USM") errors.push("Source universityCode must be USM.");
  if (!source.officialDomains.includes("usm.my") || !source.officialDomains.includes("admission.usm.my")) {
    errors.push("Source officialDomains must include USM and admission domains.");
  }
  if (source.level !== "bachelor" || source.applicantScope !== "international") {
    errors.push("Source scope must be international bachelor.");
  }
  if (source.academicSession !== "2025/2026" || !source.retrievedAt || !source.verifiedAt) {
    errors.push("Source session, retrieval date, and verification date are required.");
  }
  if (
    !source.sources.some((item) => item.role === "canonical" && /^[a-f0-9]{64}$/i.test(item.sha256 || "")) ||
    !source.sources.some((item) => item.role === "field-authority" && /^[a-f0-9]{64}$/i.test(item.sha256 || ""))
  ) {
    errors.push("Canonical and fee-authority sources require SHA-256 evidence.");
  }
  if (source.programmeCount !== 63 || source.programmes.length !== 63) {
    errors.push(`Expected 63 programmes, got declared=${source.programmeCount}, actual=${source.programmes.length}.`);
  }
  const codes = new Set<string>();
  for (const programme of source.programmes) {
    if (codes.has(programme.code)) errors.push(`Duplicate programme code ${programme.code}.`);
    codes.add(programme.code);
    if (!programme.nameEnOfficial || !programme.nameMs) errors.push(`Missing official name for ${programme.code}.`);
    if (!programme.generalRequirementEn || !programme.highSchoolRequirementEn || !programme.alternativeQualificationRequirementEn) {
      errors.push(`Incomplete requirement evidence for ${programme.code}.`);
    }
    if (
      programme.durationYears <= 0 ||
      programme.totalTuitionUSD <= 0 ||
      programme.tuitionPerSemesterUSD <= 0 ||
      programme.recurrentFeePerSemesterUSD <= 0 ||
      programme.registrationFeeUSD <= 0
    ) {
      errors.push(`Incomplete duration or fee values for ${programme.code}.`);
    }
    if (!programme.intakeMonths.length || !programme.careersEn.length) {
      errors.push(`Incomplete intake or career display for ${programme.code}.`);
    }
    if (!nameZh[programme.code]) errors.push(`Missing Chinese translation for ${programme.code}.`);
    if (!facultyTranslations[programme.schoolEn]) errors.push(`Missing faculty translation for ${programme.schoolEn}.`);
  }
  return errors;
}

export function buildUsmCommercialRows(source: CommercialSource): DeepPartial<ProgramEntity>[] {
  return source.programmes.map((programme) => toProgramRow(programme, source.verifiedAt));
}

export function summarizeUsmCommercialRows(rows: DeepPartial<ProgramEntity>[]) {
  return {
    rows: rows.length,
    uniqueCodes: new Set(rows.map((row) => row.code)).size,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    published: rows.filter((row) => row.isPublished).length,
    ready: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    officialVerified: rows.filter((row) => row.officialSourceStatus === "official-verified").length,
    feeMatched: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    localized: rows.filter((row) => {
      const name = row.name as LocalizedText;
      return Boolean(name?.en && name?.ms && name?.["zh-CN"] && name?.["zh-TW"]);
    }).length
  };
}

async function verifyRows(manager: EntityManager | DataSource, universityId: number) {
  const repository = manager.getRepository(ProgramEntity);
  const commercialRows = await repository.find({
    where: { universityId, level: "bachelor", slug: Not("") }
  });
  const canonical = commercialRows.filter((row) => row.slug.startsWith(USM_COMMERCIAL_SLUG_PREFIX));
  const publicBachelor = commercialRows.filter((row) => row.isPublished && row.publicDisplayStatus === "ready");
  const leakedLegacy = publicBachelor.filter((row) => !row.slug.startsWith(USM_COMMERCIAL_SLUG_PREFIX));
  if (
    canonical.length !== 63 ||
    publicBachelor.length !== 63 ||
    leakedLegacy.length ||
    canonical.some(
      (row) =>
        !row.isPublished ||
        row.publicDisplayStatus !== "ready" ||
        row.officialSourceStatus !== "official-verified" ||
        row.officialFeeAuditStatus !== "matched-official"
    )
  ) {
    throw new Error(
      `USM commercial verification failed: canonical=${canonical.length}, publicBachelor=${publicBachelor.length}, leakedLegacy=${leakedLegacy.length}.`
    );
  }
  return {
    canonicalRows: canonical.length,
    publicBachelorRows: publicBachelor.length,
    leakedLegacyRows: leakedLegacy.length,
    archivedOrReviewRows: commercialRows.length - publicBachelor.length
  };
}

async function ensureDecimalTuitionColumn(dataSource: DataSource) {
  const rows = await dataSource.query(
    `SELECT DATA_TYPE AS dataType, NUMERIC_PRECISION AS numericPrecision, NUMERIC_SCALE AS numericScale
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'programs' AND COLUMN_NAME = 'tuitionAmount'`
  ) as Array<{ dataType: string; numericPrecision: number | null; numericScale: number | null }>;
  const current = rows[0];
  if (!current) throw new Error("programs.tuitionAmount column not found.");
  if (current.dataType === "decimal" && Number(current.numericScale) === 2) return false;
  await dataSource.query("ALTER TABLE programs MODIFY tuitionAmount DECIMAL(12,2) NULL");
  return true;
}

async function main() {
  const sourcePath = resolve(readArgValue("--source") || DEFAULT_USM_COMMERCIAL_SOURCE_PATH);
  if (!existsSync(sourcePath)) throw new Error(`USM commercial source not found: ${sourcePath}`);
  const source = JSON.parse(readFileSync(sourcePath, "utf8")) as CommercialSource;
  const errors = validateUsmCommercialSource(source);
  if (errors.length) throw new Error(`USM commercial source validation failed:\n${errors.join("\n")}`);
  const rows = buildUsmCommercialRows(source);
  const summary = summarizeUsmCommercialRows(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const backupPath = resolve(
    readArgValue("--backup-output") ||
      `tmp/backups/usm-undergraduate-commercial-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  if (!verifyOnly && !confirm) {
    console.log(JSON.stringify({ mode: "dry-run", sourcePath, summary, writePolicy: {
      university: "USM",
      level: "bachelor",
      canonicalRows: 63,
      archiveLegacyPublicBachelorRows: true,
      preserveReviewRows: true,
      preserveOtherUniversitiesAndUserData: true,
      tuitionColumn: "DECIMAL(12,2)"
    } }, null, 2));
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
      console.log(JSON.stringify({ mode: "verified", universityId: university.id, summary, verification: await verifyRows(dataSource, university.id) }, null, 2));
      return;
    }

    const currentPrograms = await dataSource.getRepository(ProgramEntity).find({ where: { universityId: university.id } });
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );
    const schemaChanged = await ensureDecimalTuitionColumn(dataSource);
    let verification: Awaited<ReturnType<typeof verifyRows>> | null = null;
    await dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ProgramEntity);
      const currentBachelor = await repository.find({ where: { universityId: university.id, level: "bachelor" } });
      for (const existing of currentBachelor) {
        if (existing.slug.startsWith(USM_COMMERCIAL_SLUG_PREFIX)) continue;
        if (existing.isPublished || existing.publicDisplayStatus === "ready") {
          existing.isPublished = false;
          existing.publicDisplayStatus = "archived";
          existing.publicDisplayNote = "Superseded by the audited USM 2025/2026 international undergraduate canonical dataset.";
          existing.reviewReason = "Archived to prevent duplicate public display after canonical USM undergraduate publication.";
          await repository.save(existing);
        }
      }
      for (const row of rows) {
        const existing = await repository.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await repository.save(repository.create({ ...row, id: existing?.id, universityId: university.id }));
      }
      university.programCount = await repository.count({
        where: {
          universityId: university.id,
          isPublished: true,
          publicDisplayStatus: "ready"
        }
      });
      await manager.getRepository(UniversityEntity).save(university);
      verification = await verifyRows(manager, university.id);
    });
    console.log(JSON.stringify({ mode: "imported", universityId: university.id, backupPath, schemaChanged, summary, verification }, null, 2));
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
