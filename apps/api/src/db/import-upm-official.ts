import "reflect-metadata";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { DataSource } from "typeorm";
import type { DegreeLevel, ProgramCategoryCode } from "@studymy/shared";
import { ProgramEntity, UniversityEntity, ALL_ENTITIES } from "./entities.js";

const verifiedAt = "2026-06-01";

const undergradSource = "https://tppa.upm.edu.my/admission/programmes/undergraduate-75800";
const undergradFeeSource =
  "https://akademik.upm.edu.my/upload/dokumen/menul320250417184027Undergraduate_Programmes_Brochure_for_International_Students.pdf";
const courseworkSource = "https://sgs.upm.edu.my/programme_of_study/programme_by_coursework-4574";
const researchSource = "https://sgs.upm.edu.my/programme_of_study/programme_by_research_phd_master-4568";
const pgEnglishRequirementSource = "https://sgs.upm.edu.my/content/english_language_requirements-40581?L=en";
const pgGuideSource = "https://sgs.upm.edu.my/upload/dokumen/20250821150314UPM_Postgraduate_Application_Guidelines.pdf";
const pgHandbookSource = "https://sgs.upm.edu.my/upload/dokumen/20260408095929Postgraduate_Student_Handbook_2026_-_with_cover_compressed.pdf";
const notPublished = {
  en: "Not published by official source",
  ms: "Tidak diterbitkan oleh sumber rasmi",
  "zh-CN": "官方未公布",
  "zh-TW": "官方未公布"
};

type UPMProgramSeed = {
  code: string;
  name: string;
  level: DegreeLevel;
  faculty: string;
  studyMode?: string;
  category?: ProgramCategoryCode;
  durationYears: number;
  durationOfficial: string;
  semesters?: number;
  tuitionPerSemesterMYR?: number | null;
  tuitionMYR?: number | null;
  tuitionDisplayOverride?: string | null;
  officialTuitionNoteOverride?: string | null;
  feeStatus?: "matched-official" | "pending-review" | "not-published";
  sourceUrl: string;
  feeSourceUrl?: string;
  feeSourceLabel?: string;
  intake?: string[];
  intakeNote?: string;
  publicDisplayStatus?: "ready" | "needs-review" | "not-available-for-international";
  sourceStatus?: "official-verified" | "needs-review" | "official-page-verified-international-not-available";
  reviewReason?: string | null;
  auditNote?: string | null;
  specializations?: string[];
};

const t = (en: string, zhCN = en, zhTW = zhCN, ms = en) => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], zhCN = en, zhTW = zhCN, ms = en) => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

function loadEnvFiles() {
  for (const candidate of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
    if (existsSync(candidate)) loadDotenv({ path: candidate, override: false });
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 92);
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const haystack = `${name} ${faculty}`.toLowerCase();
  if (/agriculture|agricultural|agronomy|horticulture|aquaculture|plantation|soil|food security|land resource|forestry|environment|veterinary/.test(haystack)) return "science";
  if (/business|economics|accounting|finance|entrepreneurship|management|mba|human resource/.test(haystack)) return "business";
  if (/computer|software|information security|network|data science/.test(haystack)) return "it";
  if (/engineering|aerospace|manufacturing|process|construction|highway|water|remote sensing|gis|digital agriculture/.test(haystack)) return "engineering";
  if (/medicine|medical|health|nursing|nutrition|dietetic|veterinary|surgery|pathology|clinical psychology|public health/.test(haystack)) return "medicine";
  if (/language|literature|communication|education|counselling|music|arts|design|architecture|landscape|human development|politics|community/.test(haystack)) return "arts";
  return "science";
}

function normalizeTitle(value: string) {
  return value.replace(/#/g, "").replace(/\s+/g, " ").trim();
}

const facultyTranslations: Record<string, ReturnType<typeof t>> = {
  "Faculty of Agriculture": t("Faculty of Agriculture", "农业学院", "農業學院", "Fakulti Pertanian"),
  "Faculty of Biotechnology and Biomolecular Sciences": t(
    "Faculty of Biotechnology and Biomolecular Sciences",
    "生物技术与生物分子科学学院",
    "生物技術與生物分子科學學院",
    "Fakulti Bioteknologi dan Sains Biomolekul"
  ),
  "Faculty of Computer Science and Information Technology": t(
    "Faculty of Computer Science and Information Technology",
    "计算机科学与信息技术学院",
    "電腦科學與資訊技術學院",
    "Fakulti Sains Komputer dan Teknologi Maklumat"
  ),
  "Faculty of Design and Architecture": t("Faculty of Design and Architecture", "设计与建筑学院", "設計與建築學院", "Fakulti Rekabentuk dan Senibina"),
  "Faculty of Educational Studies": t("Faculty of Educational Studies", "教育研究学院", "教育研究學院", "Fakulti Pengajian Pendidikan"),
  "Faculty of Engineering": t("Faculty of Engineering", "工程学院", "工程學院", "Fakulti Kejuruteraan"),
  "Faculty of Food Science and Technology": t("Faculty of Food Science and Technology", "食品科学与技术学院", "食品科學與技術學院", "Fakulti Sains dan Teknologi Makanan"),
  "Faculty of Forestry and Environment": t("Faculty of Forestry and Environment", "林业与环境学院", "林業與環境學院", "Fakulti Perhutanan dan Alam Sekitar"),
  "Faculty of Human Ecology": t("Faculty of Human Ecology", "人类生态学院", "人類生態學院", "Fakulti Ekologi Manusia"),
  "Faculty of Medicine and Health Science": t("Faculty of Medicine and Health Science", "医学与健康科学学院", "醫學與健康科學學院", "Fakulti Perubatan dan Sains Kesihatan"),
  "Faculty of Medicine and Health Sciences": t("Faculty of Medicine and Health Sciences", "医学与健康科学学院", "醫學與健康科學學院", "Fakulti Perubatan dan Sains Kesihatan"),
  "Faculty of Modern Languages and Communication": t("Faculty of Modern Languages and Communication", "现代语言与传播学院", "現代語言與傳播學院", "Fakulti Bahasa Moden dan Komunikasi"),
  "Faculty of Science": t("Faculty of Science", "理学院", "理學院", "Fakulti Sains"),
  "Faculty of Veterinary Medicine": t("Faculty of Veterinary Medicine", "兽医学院", "獸醫學院", "Fakulti Perubatan Veterinar"),
  "School of Business and Economics": t("School of Business and Economics", "商业与经济学院", "商業與經濟學院", "Sekolah Perniagaan dan Ekonomi"),
  "Faculty of Agricultural Science and Forestry (UPMS)": t(
    "Faculty of Agricultural Science and Forestry (UPMS)",
    "农业科学与林业学院（UPM 沙捞越）",
    "農業科學與林業學院（UPM 砂拉越）",
    "Fakulti Sains Pertanian dan Perhutanan (UPMS)"
  ),
  "Faculty of Humanities, Management and Science": t(
    "Faculty of Humanities, Management and Science",
    "人文、管理与科学学院",
    "人文、管理與科學學院",
    "Fakulti Kemanusiaan, Pengurusan dan Sains"
  ),
  "Faculty of Humanities, Management and Science (UPMS)": t(
    "Faculty of Humanities, Management and Science (UPMS)",
    "人文、管理与科学学院（UPM 沙捞越）",
    "人文、管理與科學學院（UPM 砂拉越）",
    "Fakulti Kemanusiaan, Pengurusan dan Sains (UPMS)"
  ),
  "Programme by Research": t("Programme by Research", "研究型课程", "研究型課程", "Program Penyelidikan")
};

const nounTranslations: Array<[RegExp, string, string, string]> = [
  [/\bBachelor of Science in Agriculture with Honours\b/gi, "农业科学荣誉学士", "農業科學榮譽學士", "Sarjana Muda Sains Pertanian dengan Kepujian"],
  [/\bBachelor of Science in Horticulture with Honours\b/gi, "园艺科学荣誉学士", "園藝科學榮譽學士", "Sarjana Muda Sains Hortikultur dengan Kepujian"],
  [/\bBachelor of Agribusiness Science with Honours\b/gi, "农业商务科学荣誉学士", "農業商務科學榮譽學士", "Sarjana Muda Sains Perniagaan Tani dengan Kepujian"],
  [/\bBachelor of Science in Aquaculture with Honours\b/gi, "水产养殖科学荣誉学士", "水產養殖科學榮譽學士", "Sarjana Muda Sains Akuakultur dengan Kepujian"],
  [/\bBachelor of Science in Animal Science with Honours\b/gi, "动物科学荣誉学士", "動物科學榮譽學士", "Sarjana Muda Sains Haiwan dengan Kepujian"],
  [/\bBachelor of Smart Agricultural Technology with Honours\b/gi, "智慧农业技术荣誉学士", "智慧農業技術榮譽學士", "Sarjana Muda Teknologi Pertanian Pintar dengan Kepujian"],
  [/\bBachelor of Computer Science\b/gi, "计算机科学学士", "電腦科學學士", "Sarjana Muda Sains Komputer"],
  [/\bBachelor of Software Engineering\b/gi, "软件工程学士", "軟體工程學士", "Sarjana Muda Kejuruteraan Perisian"],
  [/\bBachelor of Civil Engineering\b/gi, "土木工程学士", "土木工程學士", "Sarjana Muda Kejuruteraan Awam"],
  [/\bBachelor of Mechanical Engineering\b/gi, "机械工程学士", "機械工程學士", "Sarjana Muda Kejuruteraan Mekanikal"],
  [/\bBachelor of Chemical Engineering\b/gi, "化学工程学士", "化學工程學士", "Sarjana Muda Kejuruteraan Kimia"],
  [/\bBachelor of Aerospace Engineering\b/gi, "航空航天工程学士", "航空航天工程學士", "Sarjana Muda Kejuruteraan Aeroangkasa"],
  [/\bBachelor of Accounting\b/gi, "会计学士", "會計學士", "Sarjana Muda Perakaunan"],
  [/\bBachelor of Business Administration\b/gi, "工商管理学士", "工商管理學士", "Sarjana Muda Pentadbiran Perniagaan"],
  [/\bBachelor of Economics\b/gi, "经济学学士", "經濟學學士", "Sarjana Muda Ekonomi"],
  [/\bDoctor of Medicine\b/gi, "医学学士（专业学位）", "醫學學士（專業學位）", "Doktor Perubatan"],
  [/\bDoctor of Veterinary Medicine\b/gi, "兽医医学学士（专业学位）", "獸醫醫學學士（專業學位）", "Doktor Perubatan Veterinar"],
  [/\bMaster of Computer Science\b/gi, "计算机科学硕士", "電腦科學碩士", "Sarjana Sains Komputer"],
  [/\bMaster of Software Engineering\b/gi, "软件工程硕士", "軟體工程碩士", "Sarjana Kejuruteraan Perisian"],
  [/\bMaster of Information Security\b/gi, "信息安全硕士", "資訊安全碩士", "Sarjana Keselamatan Maklumat"],
  [/\bMaster of Business Administration\b/gi, "工商管理硕士", "工商管理碩士", "Sarjana Pentadbiran Perniagaan"],
  [/\bMaster of Finance\b/gi, "金融硕士", "金融碩士", "Sarjana Kewangan"],
  [/\bMaster of Economics\b/gi, "经济学硕士", "經濟學碩士", "Sarjana Ekonomi"],
  [/\bMaster of Education\b/gi, "教育硕士", "教育碩士", "Sarjana Pendidikan"],
  [/\bMaster of Public Health\b/gi, "公共卫生硕士", "公共衛生碩士", "Sarjana Kesihatan Awam"],
  [/\bMaster of Science\b/gi, "理学硕士", "理學碩士", "Sarjana Sains"],
  [/\bMaster of Arts\b/gi, "文学硕士", "文學碩士", "Sarjana Sastera"],
  [/\bMaster of Veterinary Science\b/gi, "兽医科学硕士", "獸醫科學碩士", "Sarjana Sains Veterinar"],
  [/\bDoctor of Philosophy\b/gi, "哲学博士", "哲學博士", "Doktor Falsafah"],
  [/\bDoctor of Engineering\b/gi, "工程博士", "工程博士", "Doktor Kejuruteraan"],
  [/\bwith Honours\b/gi, "荣誉", "榮譽", "dengan Kepujian"],
  [/\bHonours\b/gi, "荣誉", "榮譽", "Kepujian"],
  [/\bBachelor\b/gi, "学士", "學士", "Sarjana Muda"],
  [/\bMaster\b/gi, "硕士", "碩士", "Sarjana"],
  [/\bDoctor\b/gi, "博士", "博士", "Doktor"],
  [/\bScience\b/gi, "科学", "科學", "Sains"],
  [/\bEngineering\b/gi, "工程", "工程", "Kejuruteraan"],
  [/\bArchitecture\b/gi, "建筑", "建築", "Senibina"],
  [/\bEducation\b/gi, "教育", "教育", "Pendidikan"],
  [/\bCounselling\b/gi, "辅导", "輔導", "Kaunseling"],
  [/\bCommunication\b/gi, "传播", "傳播", "Komunikasi"],
  [/\bLanguage\b/gi, "语言", "語言", "Bahasa"],
  [/\bLiterature\b/gi, "文学", "文學", "Kesusasteraan"],
  [/\bAgriculture\b/gi, "农业", "農業", "Pertanian"],
  [/\bForestry\b/gi, "林业", "林業", "Perhutanan"],
  [/\bEnvironment\b/gi, "环境", "環境", "Alam Sekitar"],
  [/\bManagement\b/gi, "管理", "管理", "Pengurusan"],
  [/\bTechnology\b/gi, "技术", "技術", "Teknologi"],
  [/\bMedicine\b/gi, "医学", "醫學", "Perubatan"],
  [/\bNursing\b/gi, "护理", "護理", "Kejururawatan"],
  [/\bNutrition\b/gi, "营养", "營養", "Pemakanan"]
];

const bachelorNameTranslations: Record<string, { zhCN: string; zhTW: string }> = {
  "Bachelor of Science in Agriculture with Honours": { zhCN: "农业科学荣誉学士", zhTW: "農業科學榮譽學士" },
  "Bachelor of Science in Horticulture with Honours": { zhCN: "园艺科学荣誉学士", zhTW: "園藝科學榮譽學士" },
  "Bachelor of Agribusiness Science with Honours": { zhCN: "农业商务科学荣誉学士", zhTW: "農業商務科學榮譽學士" },
  "Bachelor of Science in Aquaculture with Honours": { zhCN: "水产养殖科学荣誉学士", zhTW: "水產養殖科學榮譽學士" },
  "Bachelor of Science in Animal Science with Honours": { zhCN: "动物科学荣誉学士", zhTW: "動物科學榮譽學士" },
  "Bachelor of Science in Plantation Management with Honours": { zhCN: "种植园管理科学荣誉学士", zhTW: "種植園管理科學榮譽學士" },
  "Bachelor of Smart Agricultural Technology with Honours": { zhCN: "智慧农业技术荣誉学士", zhTW: "智慧農業技術榮譽學士" },
  "Bachelor of Computer Science with Honours": { zhCN: "计算机科学荣誉学士", zhTW: "電腦科學榮譽學士" },
  "Bachelor of Computer Science (Multimedia Computing) with Honours": { zhCN: "计算机科学（多媒体计算）荣誉学士", zhTW: "電腦科學（多媒體計算）榮譽學士" },
  "Bachelor of Computer Science (Computer Network) with Honours": { zhCN: "计算机科学（计算机网络）荣誉学士", zhTW: "電腦科學（電腦網路）榮譽學士" },
  "Bachelor of Software Engineering with Honours": { zhCN: "软件工程荣誉学士", zhTW: "軟體工程榮譽學士" },
  "Bachelor of Landscape Architecture with Honours": { zhCN: "景观建筑荣誉学士", zhTW: "景觀建築榮譽學士" },
  "Bachelor of Science in Architecture with Honours": { zhCN: "建筑科学荣誉学士", zhTW: "建築科學榮譽學士" },
  "Bachelor of Industrial Design with Honours": { zhCN: "工业设计荣誉学士", zhTW: "工業設計榮譽學士" },
  "Bachelor of Education in Agricultural Science with Honours": { zhCN: "农业科学教育荣誉学士", zhTW: "農業科學教育榮譽學士" },
  "Bachelor of Education in Home Science with Honours": { zhCN: "家政科学教育荣誉学士", zhTW: "家政科學教育榮譽學士" },
  "Bachelor of Education in Physical Education with Honours": { zhCN: "体育教育荣誉学士", zhTW: "體育教育榮譽學士" },
  "Bachelor of Education in Malay Language with Honours": { zhCN: "马来语教育荣誉学士", zhTW: "馬來語教育榮譽學士" },
  "Bachelor of Education in Teaching English as a Second Language [TESL] With Honours": { zhCN: "英语作为第二语言教学教育荣誉学士（TESL）", zhTW: "英語作為第二語言教學教育榮譽學士（TESL）" },
  "Bachelor of Education in Guidance and Counselling with Honours": { zhCN: "指导与辅导教育荣誉学士", zhTW: "指導與輔導教育榮譽學士" },
  "Bachelor of Science Human Resource Development with Honours": { zhCN: "人力资源发展科学荣誉学士", zhTW: "人力資源發展科學榮譽學士" },
  "Bachelor of Counselling with Honours": { zhCN: "辅导荣誉学士", zhTW: "輔導榮譽學士" },
  "Bachelor of Aerospace Engineering with Honours": { zhCN: "航空航天工程荣誉学士", zhTW: "航空航天工程榮譽學士" },
  "Bachelor of Civil Engineering with Honours": { zhCN: "土木工程荣誉学士", zhTW: "土木工程榮譽學士" },
  "Bachelor of Agricultural and Biosystems Engineering with Honours": { zhCN: "农业与生物系统工程荣誉学士", zhTW: "農業與生物系統工程榮譽學士" },
  "Bachelor of Electrical and Electronic Engineering with Honours": { zhCN: "电气与电子工程荣誉学士", zhTW: "電機與電子工程榮譽學士" },
  "Bachelor of Chemical Engineering with Honours": { zhCN: "化学工程荣誉学士", zhTW: "化學工程榮譽學士" },
  "Bachelor of Computer and Communication Systems Engineering with Honours": { zhCN: "计算机与通信系统工程荣誉学士", zhTW: "電腦與通訊系統工程榮譽學士" },
  "Bachelor of Mechanical Engineering with Honours": { zhCN: "机械工程荣誉学士", zhTW: "機械工程榮譽學士" },
  "Bachelor of Process and Food Engineering with Honours": { zhCN: "过程与食品工程荣誉学士", zhTW: "製程與食品工程榮譽學士" },
  "Bachelor of Forestry Science with Honours": { zhCN: "林业科学荣誉学士", zhTW: "林業科學榮譽學士" },
  "Bachelor of Wood Science and Technology with Honours": { zhCN: "木材科学与技术荣誉学士", zhTW: "木材科學與技術榮譽學士" },
  "Bachelor of Parks & Recreation Science with Honours": { zhCN: "公园与休闲科学荣誉学士", zhTW: "公園與休閒科學榮譽學士" },
  "Bachelor of Environmental Management with Honours": { zhCN: "环境管理荣誉学士", zhTW: "環境管理榮譽學士" },
  "Bachelor of Environmental Science and Technology with Honours": { zhCN: "环境科学与技术荣誉学士", zhTW: "環境科學與技術榮譽學士" },
  "Bachelor of Food Science and Technology with Honours": { zhCN: "食品科学与技术荣誉学士", zhTW: "食品科學與技術榮譽學士" },
  "Bachelor of Science in Food Studies with Honours": { zhCN: "食品研究科学荣誉学士", zhTW: "食品研究科學榮譽學士" },
  "Bachelor of Science in Food Service Management with Honours": { zhCN: "食品服务管理科学荣誉学士", zhTW: "食品服務管理科學榮譽學士" },
  "Bachelor of Science in Food Manufacturing Operations with Honours": { zhCN: "食品制造运营科学荣誉学士", zhTW: "食品製造營運科學榮譽學士" },
  "Doctor of Medicine": { zhCN: "医学学士（专业学位）", zhTW: "醫學學士（專業學位）" },
  "Bachelor of Science Biomedical Science with Honours": { zhCN: "生物医学科学荣誉学士", zhTW: "生物醫學科學榮譽學士" },
  "Bachelor of Science Dietetics with Honours": { zhCN: "营养与饮食治疗科学荣誉学士", zhTW: "營養與飲食治療科學榮譽學士" },
  "Bachelor of Science Nutrition and Community Health with Honours": { zhCN: "营养与社区健康科学荣誉学士", zhTW: "營養與社區健康科學榮譽學士" },
  "Bachelor of Science Environmental & Occupational Health with Honours": { zhCN: "环境与职业健康科学荣誉学士", zhTW: "環境與職業健康科學榮譽學士" },
  "Bachelor of Nursing with Honours": { zhCN: "护理荣誉学士", zhTW: "護理榮譽學士" },
  "Bachelor of Communication with Honours": { zhCN: "传播学荣誉学士", zhTW: "傳播學榮譽學士" },
  "Bachelor of Arts in Malay Literature with Honours": { zhCN: "马来文学荣誉文学士", zhTW: "馬來文學榮譽文學士" },
  "Bachelor of Arts in Malay Language And Linguistics with Honours": { zhCN: "马来语与语言学荣誉文学士", zhTW: "馬來語與語言學榮譽文學士" },
  "Bachelor of Arts in French Language Studies with Honours": { zhCN: "法语语言研究荣誉文学士", zhTW: "法語語言研究榮譽文學士" },
  "Bachelor of Arts in German Language Studies with Honours": { zhCN: "德语语言研究荣誉文学士", zhTW: "德語語言研究榮譽文學士" },
  "Bachelor of Arts in Arabic Language with Honours": { zhCN: "阿拉伯语荣誉文学士", zhTW: "阿拉伯語榮譽文學士" },
  "Bachelor of Arts in Chinese Language Studies with Honours": { zhCN: "汉语语言研究荣誉文学士", zhTW: "漢語語言研究榮譽文學士" },
  "Bachelor of Arts in English Language And Linguistics with Honours": { zhCN: "英语语言与语言学荣誉文学士", zhTW: "英語語言與語言學榮譽文學士" },
  "Bachelor of Arts in English Literature with Honours": { zhCN: "英语文学荣誉文学士", zhTW: "英語文學榮譽文學士" },
  "Bachelor of Science in Biology with Honours": { zhCN: "生物学理学荣誉学士", zhTW: "生物學理學榮譽學士" },
  "Bachelor of Science in Physics with Honours": { zhCN: "物理学理学荣誉学士", zhTW: "物理學理學榮譽學士" },
  "Bachelor of Science in Material Physics with Honours": { zhCN: "材料物理学理学荣誉学士", zhTW: "材料物理學理學榮譽學士" },
  "Bachelor of Science in Instrumentation Physics with Honours": { zhCN: "仪器物理学理学荣誉学士", zhTW: "儀器物理學理學榮譽學士" },
  "Bachelor of Science in Chemistry with Honours": { zhCN: "化学理学荣誉学士", zhTW: "化學理學榮譽學士" },
  "Bachelor of Science in Petroleum Chemistry with Honours": { zhCN: "石油化学理学荣誉学士", zhTW: "石油化學理學榮譽學士" },
  "Bachelor of Science in Industrial Chemistry with Honours": { zhCN: "工业化学理学荣誉学士", zhTW: "工業化學理學榮譽學士" },
  "Bachelor of Science in Mathematics with Honours": { zhCN: "数学理学荣誉学士", zhTW: "數學理學榮譽學士" },
  "Bachelor of Science in Statistics with Honours": { zhCN: "统计学理学荣誉学士", zhTW: "統計學理學榮譽學士" },
  "Bachelor of Science in Biology with Education (Honours)": { zhCN: "生物学教育理学荣誉学士", zhTW: "生物學教育理學榮譽學士" },
  "Bachelor of Science in Physics with Education (Honours)": { zhCN: "物理学教育理学荣誉学士", zhTW: "物理學教育理學榮譽學士" },
  "Bachelor of Science in Chemistry with Education (Honours)": { zhCN: "化学教育理学荣誉学士", zhTW: "化學教育理學榮譽學士" },
  "Bachelor of Science in Mathematics with Education (Honours)": { zhCN: "数学教育理学荣誉学士", zhTW: "數學教育理學榮譽學士" },
  "Bachelor of Science in Statistics with Education (Honours)": { zhCN: "统计学教育理学荣誉学士", zhTW: "統計學教育理學榮譽學士" },
  "Doctor of Veterinary Medicine": { zhCN: "兽医医学学士（专业学位）", zhTW: "獸醫醫學學士（專業學位）" },
  "Bachelor of Science in Biochemistry with Honours": { zhCN: "生物化学理学荣誉学士", zhTW: "生物化學理學榮譽學士" },
  "Bachelor of Science in Microbiology with Honours": { zhCN: "微生物学理学荣誉学士", zhTW: "微生物學理學榮譽學士" },
  "Bachelor of Science in Biotechnology with Honours": { zhCN: "生物技术理学荣誉学士", zhTW: "生物技術理學榮譽學士" },
  "Bachelor of Science in Cell and Molecular Biology with Honours": { zhCN: "细胞与分子生物学理学荣誉学士", zhTW: "細胞與分子生物學理學榮譽學士" },
  "Bachelor of Economics with Honours": { zhCN: "经济学荣誉学士", zhTW: "經濟學榮譽學士" },
  "Bachelor of Accounting (Honours)": { zhCN: "会计学荣誉学士", zhTW: "會計學榮譽學士" },
  "Bachelor of Business Administration with Honours": { zhCN: "工商管理荣誉学士", zhTW: "工商管理榮譽學士" },
  "Bachelor of Human Development Science with Honours": { zhCN: "人类发展科学荣誉学士", zhTW: "人類發展科學榮譽學士" },
  "Bachelor of Human Development Science with Management (Honours)": { zhCN: "人类发展科学与管理荣誉学士", zhTW: "人類發展科學與管理榮譽學士" },
  "Bachelor of Human Development Science with Information Technology (Honours)": { zhCN: "人类发展科学与信息技术荣誉学士", zhTW: "人類發展科學與資訊科技榮譽學士" },
  "Bachelor of Consumer Studies with Honours": { zhCN: "消费者研究荣誉学士", zhTW: "消費者研究榮譽學士" },
  "Bachelor of Music with Honours": { zhCN: "音乐荣誉学士", zhTW: "音樂榮譽學士" },
  "Bachelor of Bioindustry Science with Honours": { zhCN: "生物产业科学荣誉学士", zhTW: "生物產業科學榮譽學士" },
  "Bachelor Of Human Development Science with Management Honours": { zhCN: "人类发展科学与管理荣誉学士", zhTW: "人類發展科學與管理榮譽學士" },
  "Bachelor of Science Honours In Industrial Chemistry": { zhCN: "工业化学理学荣誉学士", zhTW: "工業化學理學榮譽學士" }
};

const masterNameTranslations: Record<string, { zhCN: string; zhTW: string }> = {
  "Master in Land Resource Management": { zhCN: "土地资源管理硕士", zhTW: "土地資源管理碩士" },
  "Master in Plantation Management": { zhCN: "种植园管理硕士", zhTW: "種植園管理碩士" },
  "Master in Tropical Soil Science": { zhCN: "热带土壤科学硕士", zhTW: "熱帶土壤科學碩士" },
  "Master in Food Security": { zhCN: "粮食安全硕士", zhTW: "糧食安全碩士" },
  "Master in Biotechnology with Bioentrepreneurship": { zhCN: "生物技术与生物创业硕士", zhTW: "生物技術與生物創業碩士" },
  "Master of Science in Biotechnology with Bioentrepreneurship": { zhCN: "生物技术与生物创业理学硕士", zhTW: "生物技術與生物創業理學碩士" },
  "Master of Computer Science": { zhCN: "计算机科学硕士", zhTW: "電腦科學碩士" },
  "Master of Information Security": { zhCN: "信息安全硕士", zhTW: "資訊安全碩士" },
  "Master of Software Engineering": { zhCN: "软件工程硕士", zhTW: "軟體工程碩士" },
  "Master in Computer Network": { zhCN: "计算机网络硕士", zhTW: "電腦網路碩士" },
  "Master in Data Science": { zhCN: "数据科学硕士", zhTW: "資料科學碩士" },
  "Master in Intelligent System": { zhCN: "智能系统硕士", zhTW: "智慧系統碩士" },
  "Master of Architecture": { zhCN: "建筑学硕士", zhTW: "建築學碩士" },
  "Master of Landscape Architecture": { zhCN: "景观建筑硕士", zhTW: "景觀建築碩士" },
  "Master in Tropical Urban Design": { zhCN: "热带城市设计硕士", zhTW: "熱帶城市設計碩士" },
  "Master in Sustainable Landscape Management": { zhCN: "可持续景观管理硕士", zhTW: "永續景觀管理碩士" },
  "Master in Industrial Design Innovation": { zhCN: "工业设计创新硕士", zhTW: "工業設計創新碩士" },
  "Master in Construction Technology Management": { zhCN: "建筑技术管理硕士", zhTW: "建築技術管理碩士" },
  "Master of Education in Curriculum and Instruction": { zhCN: "课程与教学教育硕士", zhTW: "課程與教學教育碩士" },
  "Master of Education in Sport Science": { zhCN: "运动科学教育硕士", zhTW: "運動科學教育碩士" },
  "Master of Education in Physical Education and Health": { zhCN: "体育与健康教育硕士", zhTW: "體育與健康教育碩士" },
  "Master of Education in Educational Administration": { zhCN: "教育行政教育硕士", zhTW: "教育行政教育碩士" },
  "Master of Education in Teaching of English as a Second Language": { zhCN: "英语作为第二语言教学教育硕士", zhTW: "英語作為第二語言教學教育碩士" },
  "Master of Education in Instructional Technology and Innovation": { zhCN: "教学技术与创新教育硕士", zhTW: "教學技術與創新教育碩士" },
  "Master of Education in Educational Psychology": { zhCN: "教育心理学教育硕士", zhTW: "教育心理學教育碩士" },
  "Master of Education in Malay Language Education": { zhCN: "马来语教育硕士", zhTW: "馬來語教育碩士" },
  "Master of Education in Technical and Vocational Education": { zhCN: "技术与职业教育硕士", zhTW: "技術與職業教育碩士" },
  "Master of Counselling": { zhCN: "辅导硕士", zhTW: "輔導碩士" },
  "Master of Human Resource Development": { zhCN: "人力资源发展硕士", zhTW: "人力資源發展碩士" },
  "Master in Emergency Response and Planning": { zhCN: "应急响应与规划硕士", zhTW: "應急應變與規劃碩士" },
  "Master in Engineering Management": { zhCN: "工程管理硕士", zhTW: "工程管理碩士" },
  "Master in Environmental Engineering": { zhCN: "环境工程硕士", zhTW: "環境工程碩士" },
  "Master in Environmental Technology Management": { zhCN: "环境技术管理硕士", zhTW: "環境技術管理碩士" },
  "Master in Highway and Transportation Engineering": { zhCN: "公路与交通工程硕士", zhTW: "公路與交通工程碩士" },
  "Master in Innovation and Engineering Design": { zhCN: "创新与工程设计硕士", zhTW: "創新與工程設計碩士" },
  "Master in Manufacturing Systems Engineering": { zhCN: "制造系统工程硕士", zhTW: "製造系統工程碩士" },
  "Master in Process Safety and Loss Prevention": { zhCN: "过程安全与损失预防硕士", zhTW: "製程安全與損失預防碩士" },
  "Master in Remote Sensing and GIS": { zhCN: "遥感与地理信息系统硕士", zhTW: "遙測與地理資訊系統碩士" },
  "Master in Structural Engineering and Construction": { zhCN: "结构工程与建筑施工硕士", zhTW: "結構工程與建築施工碩士" },
  "Master in Water Engineering": { zhCN: "水工程硕士", zhTW: "水工程碩士" },
  "Master in Communication Engineering": { zhCN: "通信工程硕士", zhTW: "通訊工程碩士" },
  "Master in Electrical Power Engineering": { zhCN: "电力工程硕士", zhTW: "電力工程碩士" },
  "Master in Aerospace System Design Engineering": { zhCN: "航空航天系统设计工程硕士", zhTW: "航空航天系統設計工程碩士" },
  "Master in Microelectronic System Engineering": { zhCN: "微电子系统工程硕士", zhTW: "微電子系統工程碩士" },
  "Master in Food Process and Packaging Engineering": { zhCN: "食品加工与包装工程硕士", zhTW: "食品加工與包裝工程碩士" },
  "Master in Control System Engineering": { zhCN: "控制系统工程硕士", zhTW: "控制系統工程碩士" },
  "Master in Digital Agriculture": { zhCN: "数字农业硕士", zhTW: "數位農業碩士" },
  "Master in Computer Engineering with Technopreneurship": { zhCN: "计算机工程与科技创业硕士", zhTW: "電腦工程與科技創業碩士" },
  "Master of Food Technology": { zhCN: "食品技术硕士", zhTW: "食品技術碩士" },
  "Master of Food Safety and Quality Assurance": { zhCN: "食品安全与质量保证硕士", zhTW: "食品安全與品質保證碩士" },
  "Master in Functional Food Design": { zhCN: "功能性食品设计硕士", zhTW: "功能性食品設計碩士" },
  "Master of Environment": { zhCN: "环境硕士", zhTW: "環境碩士" },
  "Master in Politics and Government": { zhCN: "政治与政府硕士", zhTW: "政治與政府碩士" },
  "Master in Community Development": { zhCN: "社区发展硕士", zhTW: "社區發展碩士" },
  "Master in Personal Financial Planning": { zhCN: "个人财务规划硕士", zhTW: "個人財務規劃碩士" },
  "Master of Surgery (General Surgery)": { zhCN: "外科学硕士（普通外科）", zhTW: "外科學碩士（普通外科）" },
  "Master of Public Health": { zhCN: "公共卫生硕士", zhTW: "公共衛生碩士" },
  "Master of Pathology": { zhCN: "病理学硕士", zhTW: "病理學碩士" },
  "Master of Family Medicine": { zhCN: "家庭医学硕士", zhTW: "家庭醫學碩士" },
  "Master of Medicine (Pediatrics)": { zhCN: "医学硕士（儿科）", zhTW: "醫學碩士（兒科）" },
  "Master of Medicine (Psychiatry)": { zhCN: "医学硕士（精神病学）", zhTW: "醫學碩士（精神病學）" },
  "Master of Medicine (Radiology)": { zhCN: "医学硕士（放射学）", zhTW: "醫學碩士（放射學）" },
  "Master of Medicine (Internal Medicine)": { zhCN: "医学硕士（内科学）", zhTW: "醫學碩士（內科學）" },
  "Master of Medicine (Anesthesiology)": { zhCN: "医学硕士（麻醉学）", zhTW: "醫學碩士（麻醉學）" },
  "Master of Surgery (Orthopedics)": { zhCN: "外科学硕士（骨科）", zhTW: "外科學碩士（骨科）" },
  "Master in Nutritional Sciences": { zhCN: "营养科学硕士", zhTW: "營養科學碩士" },
  "Master in Clinical Psychology": { zhCN: "临床心理学硕士", zhTW: "臨床心理學碩士" },
  "Master in Environmental and Occupational Health": { zhCN: "环境与职业健康硕士", zhTW: "環境與職業健康碩士" },
  "Master in Applied English Linguistics": { zhCN: "应用英语语言学硕士", zhTW: "應用英語語言學碩士" },
  "Master in Corporate Communication": { zhCN: "企业传播硕士", zhTW: "企業傳播碩士" },
  "Master of World Literature": { zhCN: "世界文学硕士", zhTW: "世界文學碩士" },
  "Master of Malay Language and Linguistics": { zhCN: "马来语与语言学硕士", zhTW: "馬來語與語言學碩士" },
  "Master in Applied Statistics": { zhCN: "应用统计学硕士", zhTW: "應用統計學碩士" },
  "Master in Analytical Chemistry": { zhCN: "分析化学硕士", zhTW: "分析化學碩士" },
  "Master in Materials Physics": { zhCN: "材料物理学硕士", zhTW: "材料物理學碩士" },
  "Master in Tropical Biology": { zhCN: "热带生物学硕士", zhTW: "熱帶生物學碩士" },
  "Master in Mathematical Sciences": { zhCN: "数学科学硕士", zhTW: "數學科學碩士" },
  "Master of Veterinary Science": { zhCN: "兽医科学硕士", zhTW: "獸醫科學碩士" },
  "Master of Veterinary Medicine": { zhCN: "兽医学硕士", zhTW: "獸醫學碩士" },
  "Master of Economics": { zhCN: "经济学硕士", zhTW: "經濟學碩士" },
  "Master in Entrepreneurship": { zhCN: "创业学硕士", zhTW: "創業學碩士" },
  "Master of Finance": { zhCN: "金融硕士", zhTW: "金融碩士" },
  "Master of Business Administration": { zhCN: "工商管理硕士", zhTW: "工商管理碩士" },
  "Master in Human Resource Management and Organization": { zhCN: "人力资源管理与组织硕士", zhTW: "人力資源管理與組織碩士" },
  "Master in Renewable Energy": { zhCN: "可再生能源硕士", zhTW: "再生能源碩士" },
  "Master of Science (M.S.)": { zhCN: "理学硕士（M.S.）", zhTW: "理學碩士（M.S.）" },
  "Master of Arts (M.A)": { zhCN: "文学硕士（M.A）", zhTW: "文學碩士（M.A）" },
  "Master of Veterinary Science (M.V.Sc.)": { zhCN: "兽医科学硕士（M.V.Sc.）", zhTW: "獸醫科學碩士（M.V.Sc.）" }
};

const phdNameTranslations: Record<string, { zhCN: string; zhTW: string }> = {
  "Doctor of Public Health": { zhCN: "公共卫生博士", zhTW: "公共衛生博士" },
  "Doctor of Philosophy (PhD)": { zhCN: "哲学博士（PhD）", zhTW: "哲學博士（PhD）" },
  "Doctor of Engineering (Deng)": { zhCN: "工程博士（Deng）", zhTW: "工程博士（Deng）" },
  "Doctor of Philosophy (PhD) by Publication": { zhCN: "以出版成果申请哲学博士（PhD）", zhTW: "以出版成果申請哲學博士（PhD）" },
  "Doktor Falsafah (PhD) by Retrospective": { zhCN: "追溯认定哲学博士（PhD）", zhTW: "追溯認定哲學博士（PhD）" }
};

function translateText(en: string) {
  let zhCN = en;
  let zhTW = en;
  let ms = en;
  for (const [pattern, cn, tw, my] of nounTranslations) {
    zhCN = zhCN.replace(pattern, cn);
    zhTW = zhTW.replace(pattern, tw);
    ms = ms.replace(pattern, my);
  }
  return t(en, zhCN, zhTW, ms);
}

function hasUntranslatedEnglish(value: string) {
  return value
    .replace(/\b(UPM|PhD|MBA|TESL|MBBS|IELTS|TOEFL|MUET|CIEP|PTE)\b/g, "")
    .replace(/\bM\.?\s?(S|A|V\.?Sc)\.?\b/g, "")
    .replace(/[A-Za-z]{2,}/g, "")
    .length !== value.length;
}

function hasEnglishGlueWords(value: string) {
  return /\b(of|in|with|and|for|by|the)\b/i.test(value);
}

function cleanChineseProgramTitle(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/学士荣誉/g, "荣誉学士")
    .replace(/學士榮譽/g, "榮譽學士");
}

function localizedProgramName(en: string) {
  const translated = translateText(en);
  const manual = bachelorNameTranslations[en] ?? masterNameTranslations[en] ?? phdNameTranslations[en];
  const publicEn = en === "Doctor of Medicine"
    ? "Bachelor of Medicine (Professional Degree)"
    : en === "Doctor of Veterinary Medicine"
      ? "Bachelor of Veterinary Medicine (Professional Degree)"
      : en;
  const zhCN = manual?.zhCN ?? (hasUntranslatedEnglish(translated["zh-CN"]) ? en : cleanChineseProgramTitle(translated["zh-CN"]));
  const zhTW = manual?.zhTW ?? (hasUntranslatedEnglish(translated["zh-TW"]) ? en : cleanChineseProgramTitle(translated["zh-TW"]));
  return {
    en: publicEn,
    ms: hasEnglishGlueWords(translated.ms) ? en : translated.ms,
    "zh-CN": zhCN,
    "zh-TW": zhTW
  };
}

function publicEnglishProgramName(en: string) {
  if (en === "Doctor of Medicine") return "Bachelor of Medicine (Professional Degree)";
  if (en === "Doctor of Veterinary Medicine") return "Bachelor of Veterinary Medicine (Professional Degree)";
  return en;
}

function translateArray(items: string[]) {
  return {
    en: items,
    ms: items.map((item) => translateText(item).ms),
    "zh-CN": items.map((item) => translateText(item)["zh-CN"]),
    "zh-TW": items.map((item) => translateText(item)["zh-TW"])
  };
}

function localizedFaculty(faculty: string) {
  return facultyTranslations[faculty] ?? translateText(faculty);
}

function localizedDescription(seed: UPMProgramSeed) {
  const mode = seed.studyMode ?? (seed.level === "bachelor" ? "Full-time" : seed.sourceUrl === researchSource ? "Research" : "Coursework");
  const programName = localizedProgramName(seed.name);
  return t(
    `${seed.name} is offered by ${seed.faculty} at Universiti Putra Malaysia (UPM). Study mode: ${mode}.`,
    `${programName["zh-CN"]}由马来西亚博特拉大学${localizedFaculty(seed.faculty)["zh-CN"]}开设。学习模式：${mode === "Research" ? "研究型" : mode === "Coursework" ? "授课型" : mode === "Full-time" ? "全日制" : mode}。`,
    `${programName["zh-TW"]}由馬來西亞博特拉大學${localizedFaculty(seed.faculty)["zh-TW"]}開設。學習模式：${mode === "Research" ? "研究型" : mode === "Coursework" ? "授課型" : mode === "Full-time" ? "全日制" : mode}。`,
    `${programName.ms} ditawarkan oleh ${localizedFaculty(seed.faculty).ms} di Universiti Putra Malaysia (UPM). Mod pengajian: ${mode === "Research" ? "Penyelidikan" : mode === "Coursework" ? "Kerja kursus" : mode === "Full-time" ? "Sepenuh masa" : mode}.`
  );
}

function localizedRequirementNote(level: DegreeLevel) {
  return level === "bachelor"
    ? t(
        "National Higher School Certificate/A Level equivalent with minimum grade 80% and above, or recognised diploma with CGPA 3.00; programme-specific requirements may apply.",
        "高中毕业证书、A Level 或同等学历通常需达到 80% 及以上，或认可文凭 CGPA 3.00；不同专业可能有额外要求。",
        "高中畢業證書、A Level 或同等學歷通常需達到 80% 及以上，或認可文憑 CGPA 3.00；不同專業可能有額外要求。",
        "Sijil sekolah menengah tinggi/A Level atau setara biasanya memerlukan pencapaian minimum 80% ke atas, atau diploma diiktiraf dengan CGPA 3.00; syarat khusus program mungkin dikenakan."
      )
    : t(
        "Bachelor's/Master's degree and programme-specific requirements according to UPM postgraduate admission rules.",
        "需符合 UPM 研究生招生规则中的本科或硕士学位要求，具体条件以专业或学院要求为准。",
        "需符合 UPM 研究生招生規則中的本科或碩士學位要求，具體條件以專業或學院要求為準。",
        "Memerlukan ijazah sarjana muda/sarjana dan syarat khusus program menurut peraturan kemasukan pascasiswazah UPM."
      );
}

function languageRequirementForSeed(seed: UPMProgramSeed) {
  if (seed.level === "bachelor") return { ielts: 5.5, toefl: 60, pte: 43, muet: 3 };
  if (seed.level === "master" && seed.name === "Master of Malay Language and Linguistics") {
    return { ielts: 5, toefl: 44, pte: 47, muet: 3.5 };
  }
  return { ielts: 6, toefl: 72, pte: 59, muet: 4 };
}

function officialLanguageRequirementForSeed(seed: UPMProgramSeed) {
  if (seed.level === "bachelor") {
    return "IELTS 5.5+, TOEFL iBT 60+, MUET Band 3+, CIEP 107+, PTE 43+, or Cambridge English score 154+.";
  }
  if (seed.level === "master" && seed.name === "Master in Applied English Linguistics") {
    return "UPM SGS English Language Requirements (updated 13/05/2026): applicants for programmes under the English Department, Faculty of Modern Languages and Communication must submit a full-offer score at application. Accepted full-offer scores include IELTS Academic Band 6.0, TOEFL iBT/Home Edition 72+, PTE Academic 59+, MUET Band 4.0 (score 211-257), Cambridge Linguaskill at CALC UPM 169-175, or CIEP/PTEST 110. Provisional English offer is not available for English Department programmes.";
  }
  if (seed.level === "master" && seed.name === "Master of Malay Language and Linguistics") {
    return "UPM SGS English Language Requirements (updated 13/05/2026): for Malay Language Studies, Arabic, Chinese Literature, cross-departmental language fields, or programmes that allow thesis writing in the language of instruction, direct full-offer scores include IELTS Academic Band 5.0, TOEFL iBT/Home Edition 44+, PTE Academic 47+, MUET Band 3.5 (score 123-163), Cambridge Linguaskill at CALC UPM 140-159, or CIEP/PTEST 107. Provisional English offer is not issued for this route.";
  }
  return "UPM SGS English Language Requirements (updated 13/05/2026): international postgraduate applicants may apply without an English score and receive a provisional offer if successful, but must provide an accepted valid score upon registration. Full-offer scores include IELTS Academic Band 6.0, TOEFL iBT/Home Edition 72+, PTE Academic 59+, MUET Band 4.0 (score 211-257), Cambridge Linguaskill at CALC UPM 169-175, or CIEP/PTEST 110. IELTS Indicator, APTIS, Duolingo, TOEFL ITP and Medium of Instruction letters are not accepted; score validity must not exceed two years.";
}

function yearDurationLabel(years: number) {
  const value = Number.isInteger(years) ? years : Number(years.toFixed(1));
  return `${value} ${value === 1 ? "year" : "years"}`;
}

function intakeMonthsForSeed(seed: UPMProgramSeed) {
  if (seed.publicDisplayStatus === "not-available-for-international") return [];
  const raw = seed.intake ?? [];
  const months = raw
    .flatMap((item) => item.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi) ?? [])
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase());
  return [...new Set(months)];
}

function courseworkIntakeMonths(name: string, faculty: string, intakeNote: string | undefined, fee: PostgraduateFeeRow | undefined) {
  const officialNote = `${intakeNote ?? ""} ${fee?.note ?? ""}`.toLowerCase();
  if (fee?.feeSystem === "trimester") {
    return officialNote.includes("first trimester") ? ["July"] : ["July", "November", "March"];
  }
  if (name === "Master of Public Health") return ["October", "March"];
  if (
    name === "Master of Pathology" ||
    name === "Master of Medicine (Pediatrics)" ||
    name === "Master of Medicine (Psychiatry)" ||
    name === "Master of Medicine (Radiology)" ||
    name === "Master of Medicine (Internal Medicine)" ||
    name === "Master of Family Medicine" ||
    name === "Master of Medicine (Anesthesiology)" ||
    name === "Master of Surgery (Orthopedics)" ||
    name === "Master of Surgery (General Surgery)"
  ) {
    return ["June", "December"];
  }
  if (/first semester (intake )?only|intake is every first semester/.test(officialNote)) return ["September"];
  if (/second semester (intake )?only|intake is every second semester/.test(officialNote)) return ["March"];
  return ["September", "March"];
}

type UndergraduateFeeRow = {
  code: string;
  semesters: number;
  years: number;
  perSemesterMYR: number;
  totalMYR: number;
  note?: string;
};

type PostgraduateFeeRow = {
  years: number;
  totalMYR: number;
  feeSystem: "dual-semester" | "trimester" | "medicine" | "research";
  sourceUrl: string;
  sourceLabel: string;
  note: string;
  tuitionDisplay?: string;
};

function feeKey(name: string, faculty: string) {
  return `${normalizeTitle(name).toLowerCase()}|${faculty.toLowerCase()}`;
}

const localUndergraduateFeeSource = "/Users/ian/Desktop/未命名文件夹/博特拉大学/UPM_Tuition_Fees_International_2026_official.pdf";
const localPostgraduateDualSemesterFeeSource = "/Users/ian/Desktop/未命名文件夹/博特拉大学/UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf";
const localPostgraduateTrimesterFeeSource = "/Users/ian/Desktop/未命名文件夹/博特拉大学/UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf";
const localPostgraduateMedicineFeeSource = "/Users/ian/Desktop/未命名文件夹/博特拉大学/UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf";
const applicationDocuments = arr(
  ["Passport", "Academic certificate and transcript", "English proficiency evidence", "Financial support evidence", "Application fee receipt"],
  ["护照", "学历证书和成绩单", "英语能力证明", "资金支持证明", "申请费收据"],
  ["護照", "學歷證書和成績單", "英語能力證明", "資金支持證明", "申請費收據"],
  ["Pasport", "Sijil akademik dan transkrip", "Bukti kemahiran bahasa Inggeris", "Bukti sokongan kewangan", "Resit yuran permohonan"]
);

const undergraduateFeeRows = new Map<string, UndergraduateFeeRow>(
  [
    ["Bachelor of Science in Agriculture with Honours", "Faculty of Agriculture", "UP6621001", 8, 4, 12000, 96000, "PDF title: Bachelor of Agricultural Science with Honours."],
    ["Bachelor of Science in Horticulture with Honours", "Faculty of Agriculture", "UP6622001", 8, 4, 12000, 96000, "PDF title: Bachelor of Horticultural Science with Honours."],
    ["Bachelor of Science in Aquaculture with Honours", "Faculty of Agriculture", "UP6624001", 8, 4, 12000, 96000],
    ["Bachelor of Science in Animal Science with Honours", "Faculty of Agriculture", "UP6621004", 8, 4, 12000, 96000, "PDF title: Bachelor of Agriculture in Animal Science with Honours."],
    ["Bachelor of Agribusiness Science with Honours", "Faculty of Agriculture", "UP6621005", 8, 4, 12000, 96000, "PDF title: Bachelor of Science in Agribusiness with Honours."],
    ["Bachelor of Science in Biotechnology with Honours", "Faculty of Biotechnology and Biomolecular Sciences", "UP6545001", 8, 4, 12000, 96000],
    ["Bachelor of Science in Biochemistry with Honours", "Faculty of Biotechnology and Biomolecular Sciences", "UP6421003", 8, 4, 12000, 96000],
    ["Bachelor of Science in Microbiology with Honours", "Faculty of Biotechnology and Biomolecular Sciences", "UP6421004", 8, 4, 12000, 96000],
    ["Bachelor of Science in Cell and Molecular Biology with Honours", "Faculty of Biotechnology and Biomolecular Sciences", "UP6421005", 8, 4, 12000, 96000],
    ["Bachelor of Economics with Honours", "School of Business and Economics", "UP6314001", 7, 3.5, 10000, 70000],
    ["Bachelor of Accounting (Honours)", "School of Business and Economics", "UP6344001", 8, 4, 12000, 96000],
    ["Bachelor of Business Administration with Honours", "School of Business and Economics", "UP6345001", 8, 4, 11000, 88000],
    ["Bachelor of Computer Science with Honours", "Faculty of Computer Science and Information Technology", "UP6481001", 8, 4, 12000, 96000],
    ["Bachelor of Computer Science (Multimedia Computing) with Honours", "Faculty of Computer Science and Information Technology", "UP6481002", 8, 4, 12000, 96000, "PDF title: Bachelor of Computer Science (Multimedia) with Honours."],
    ["Bachelor of Software Engineering with Honours", "Faculty of Computer Science and Information Technology", "UP6481003", 8, 4, 12000, 96000],
    ["Bachelor of Computer Science (Computer Network) with Honours", "Faculty of Computer Science and Information Technology", "UP6481004", 8, 4, 12000, 96000],
    ["Bachelor of Landscape Architecture with Honours", "Faculty of Design and Architecture", "UP6581001", 8, 4, 12000, 96000],
    ["Bachelor of Science in Architecture with Honours", "Faculty of Design and Architecture", "UP6581002", 7, 3.5, 12000, 84000],
    ["Bachelor of Industrial Design with Honours", "Faculty of Design and Architecture", "UUP6214001", 8, 4, 12000, 96000],
    ["Bachelor of Counselling with Honours", "Faculty of Educational Studies", "UP6762001", 8, 4, 9000, 72000],
    ["Bachelor of Science Human Resource Development with Honours", "Faculty of Educational Studies", "UP6345002", 8, 4, 9000, 72000, "PDF title: Bachelor of Science in Human Resource Development with Honours."],
    ["Bachelor of Education in Guidance and Counselling with Honours", "Faculty of Educational Studies", "UP6145002", 8, 4, 9000, 72000],
    ["Bachelor of Education in Malay Language with Honours", "Faculty of Educational Studies", "UP6145003", 8, 4, 9000, 72000],
    ["Bachelor of Education in Teaching English as a Second Language [TESL] With Honours", "Faculty of Educational Studies", "UP6145004", 8, 4, 9000, 72000, "PDF title: Bachelor of Education in Teaching of English as a Second Language with Honours."],
    ["Bachelor of Education in Home Science with Honours", "Faculty of Educational Studies", "UP6145005", 8, 4, 9000, 72000],
    ["Bachelor of Civil Engineering with Honours", "Faculty of Engineering", "UP6526001", 8, 4, 13000, 104000],
    ["Bachelor of Electrical and Electronic Engineering with Honours", "Faculty of Engineering", "UP6523001", 8, 4, 13000, 104000, "PDF title: Bachelor of Electrical and Electronics Engineering with Honours."],
    ["Bachelor of Chemical Engineering with Honours", "Faculty of Engineering", "UP6524001", 8, 4, 13000, 104000],
    ["Bachelor of Agricultural and Biosystems Engineering with Honours", "Faculty of Engineering", "UP6524002", 8, 4, 13000, 104000, "PDF title: Bachelor of Agricultural and Biosystem Engineering with Honours."],
    ["Bachelor of Mechanical Engineering with Honours", "Faculty of Engineering", "UP6521001", 8, 4, 13000, 104000],
    ["Bachelor of Aerospace Engineering with Honours", "Faculty of Engineering", "UP6525001", 8, 4, 13000, 104000],
    ["Bachelor of Process and Food Engineering with Honours", "Faculty of Engineering", "UP6541004", 8, 4, 13000, 104000],
    ["Bachelor of Computer and Communication Systems Engineering with Honours", "Faculty of Engineering", "UP6523002", 8, 4, 13000, 104000, "PDF title: Bachelor of Computer and Communication System Engineering with Honours."],
    ["Bachelor of Food Science and Technology with Honours", "Faculty of Food Science and Technology", "UP6541001", 8, 4, 12000, 96000],
    ["Bachelor of Science in Food Service Management with Honours", "Faculty of Food Science and Technology", "UP6541003", 8, 4, 12000, 96000],
    ["Bachelor of Science in Food Manufacturing Operations with Honours", "Faculty of Food Science and Technology", "UP6541005", 8, 4, 12000, 96000],
    ["Bachelor of Forestry Science with Honours", "Faculty of Forestry and Environment", "UP6623001", 8, 4, 12000, 96000],
    ["Bachelor of Wood Science and Technology with Honours", "Faculty of Forestry and Environment", "UP6623003", 8, 4, 12000, 96000, "PDF title: Bachelor of Science in Timber Industry with Honours."],
    ["Bachelor of Parks & Recreation Science with Honours", "Faculty of Forestry and Environment", "UP6812001", 8, 4, 12000, 96000],
    ["Bachelor of Environmental Science and Technology with Honours", "Faculty of Forestry and Environment", "UP6422001", 8, 4, 12000, 96000],
    ["Bachelor of Environmental Management with Honours", "Faculty of Forestry and Environment", "UP6345007", 8, 4, 12000, 96000],
    ["Bachelor of Music with Honours", "Faculty of Human Ecology", "UP6212001", 8, 4, 11000, 88000],
    ["Bachelor of Human Development Science with Honours", "Faculty of Human Ecology", "UP6312001", 8, 4, 12000, 96000],
    ["Bachelor of Consumer Studies with Honours", "Faculty of Human Ecology", "UP6345003", 8, 4, 12000, 96000],
    ["Bachelor of Human Development Science with Management (Honours)", "Faculty of Human Ecology", "UP6345004", 8, 4, 12000, 96000],
    ["Bachelor of Human Development Science with Information Technology (Honours)", "Faculty of Human Ecology", "UP6345005", 8, 4, 12000, 96000],
    ["Bachelor of Communication with Honours", "Faculty of Modern Languages and Communication", "UP6321001", 7, 3.5, 8000, 56000],
    ["Bachelor of Arts in Malay Language And Linguistics with Honours", "Faculty of Modern Languages and Communication", "UP6222001", 7, 3.5, 8000, 56000],
    ["Bachelor of Arts in Malay Literature with Honours", "Faculty of Modern Languages and Communication", "UP6223001", 7, 3.5, 8000, 56000],
    ["Bachelor of Arts in English Language And Linguistics with Honours", "Faculty of Modern Languages and Communication", "UP6224001", 7, 3.5, 8000, 56000],
    ["Bachelor of Arts in English Literature with Honours", "Faculty of Modern Languages and Communication", "UP6224004", 7, 3.5, 8000, 56000],
    ["Bachelor of Arts in Chinese Language Studies with Honours", "Faculty of Modern Languages and Communication", "UP6224002", 7, 3.5, 8000, 56000],
    ["Bachelor of Arts in Arabic Language with Honours", "Faculty of Modern Languages and Communication", "UP6224003", 7, 3.5, 8000, 56000, "PDF title: Bachelor of Arts in Arabic Language Studies with Honours."],
    ["Bachelor of Arts in French Language Studies with Honours", "Faculty of Modern Languages and Communication", "UP6224005", 7, 3.5, 8000, 56000],
    ["Bachelor of Arts in German Language Studies with Honours", "Faculty of Modern Languages and Communication", "UP6224006", 7, 3.5, 8000, 56000],
    ["Doctor of Medicine", "Faculty of Medicine and Health Science", "UP6721001", 10, 5, 52000, 520000],
    ["Bachelor of Science Biomedical Science with Honours", "Faculty of Medicine and Health Science", "UP6421001", 8, 4, 12000, 96000, "PDF title: Bachelor of Biomedical Science with Honours."],
    ["Bachelor of Science Dietetics with Honours", "Faculty of Medicine and Health Science", "UP6726001", 8, 4, 12000, 96000, "PDF title: Bachelor of Science in Dietetic with Honours."],
    ["Bachelor of Science Nutrition and Community Health with Honours", "Faculty of Medicine and Health Science", "UP6726002", 8, 4, 12000, 96000, "PDF title: Bachelor of Science in Nutrition and Community Health with Honours."],
    ["Bachelor of Nursing with Honours", "Faculty of Medicine and Health Science", "UP6723001", 8, 4, 14000, 112000],
    ["Bachelor of Science in Biology with Honours", "Faculty of Science", "UP6421002", 8, 4, 12000, 96000, "PDF title: Bachelor of Biology with Honours."],
    ["Bachelor of Science in Mathematics with Honours", "Faculty of Science", "UP6461001", 8, 4, 12000, 96000],
    ["Bachelor of Science in Statistics with Honours", "Faculty of Science", "UP6462001", 8, 4, 12000, 96000],
    ["Bachelor of Science in Physics with Honours", "Faculty of Science", "UP6441001", 8, 4, 12000, 96000, "The PDF also contains a later duplicate lower-fee row for this same code; the complete Bachelor Degree Programmes main table value is used."],
    ["Bachelor of Science in Chemistry with Honours", "Faculty of Science", "UP6442001", 8, 4, 12000, 96000, "The PDF also contains a later duplicate lower-fee row for this same code; the complete Bachelor Degree Programmes main table value is used."],
    ["Bachelor of Science in Industrial Chemistry with Honours", "Faculty of Science", "UP6442002", 8, 4, 12000, 96000, "The PDF also contains a later duplicate lower-fee row for this same code; the complete Bachelor Degree Programmes main table value is used."],
    ["Bachelor of Science in Petroleum Chemistry with Honours", "Faculty of Science", "UP6442003", 8, 4, 12000, 96000, "The PDF also contains a later duplicate lower-fee row for this same code; the complete Bachelor Degree Programmes main table value is used."],
    ["Bachelor of Science in Material Physics with Honours", "Faculty of Science", "UP6440001", 8, 4, 12000, 96000, "PDF title: Bachelor of Science in Material Physics with Honours. The PDF also contains a later duplicate lower-fee row for this same code; the complete Bachelor Degree Programmes main table value is used."],
    ["Bachelor of Science in Instrumentation Physics with Honours", "Faculty of Science", "UP6440002", 8, 4, 12000, 96000, "PDF title: Bachelor of Science in Instrumentation Physics with Honours. The PDF also contains a later duplicate lower-fee row for this same code; the complete Bachelor Degree Programmes main table value is used."],
    ["Doctor of Veterinary Medicine", "Faculty of Veterinary Medicine", "UP6640001", 10, 5, 34500, 345000, "The PDF also contains a later duplicate lower-fee row with code UP664001; the complete Bachelor Degree Programmes main table value is used."],
    ["Bachelor of Bioindustry Science with Honours", "Faculty of Agricultural Science and Forestry (UPMS)", "UP6621003", 8, 4, 8225, 65800, "PDF title: Bachelor of Bioindustrial Science with Honours, UPM Bintulu campus."],
    ["Bachelor of Forestry Science with Honours", "Faculty of Agricultural Science and Forestry (UPMS)", "UP6623002", 8, 4, 8225, 65800, "UPM Bintulu campus."],
    ["Bachelor of Science in Aquaculture with Honours", "Faculty of Agricultural Science and Forestry (UPMS)", "UP6624002", 8, 4, 8225, 65800, "UPM Bintulu campus."],
    ["Bachelor Of Human Development Science with Management Honours", "Faculty of Humanities, Management and Science (UPMS)", "UP6345006", 8, 4, 8225, 65800, "UPM Bintulu campus."],
    ["Bachelor of Science Honours In Industrial Chemistry", "Faculty of Humanities, Management and Science (UPMS)", "UP6442004", 8, 4, 8225, 65800, "UPM Bintulu campus. Code is not clearly extracted from the PDF row; retained for audit review."]
  ].map(([name, faculty, code, semesters, years, perSemesterMYR, totalMYR, note]) => [
    feeKey(String(name), String(faculty)),
    {
      code: String(code),
      semesters: Number(semesters),
      years: Number(years),
      perSemesterMYR: Number(perSemesterMYR),
      totalMYR: Number(totalMYR),
      note: note ? String(note) : undefined
    }
  ])
);

function postgraduateFeeRow(
  years: number,
  totalMYR: number,
  feeSystem: PostgraduateFeeRow["feeSystem"],
  sourceUrl: string,
  sourceLabel: string,
  note: string,
  tuitionDisplay?: string
): PostgraduateFeeRow {
  return { years, totalMYR, feeSystem, sourceUrl, sourceLabel, note, tuitionDisplay };
}

const postgraduateCourseworkFeeRows = new Map<string, PostgraduateFeeRow>(
  [
    ["Master in Land Resource Management", "Faculty of Agriculture", 2, 36850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table uses the spelling MASTER OF LAND RESOURSE MANAGEMENT; StudyMY keeps the programme title normalized to Land Resource Management."],
    ["Master in Plantation Management", "Faculty of Agriculture", 2, 36850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Tropical Soil Science", "Faculty of Agriculture", 2, 38250, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Food Security", "Faculty of Agriculture", 2, 28590, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF FOOD SECURITY."],
    ["Master of Science in Biotechnology with Bioentrepreneurship", "Faculty of Biotechnology and Biomolecular Sciences", 1, 31550, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master of Computer Science", "Faculty of Computer Science and Information Technology", 2, 24850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Computer Network", "Faculty of Computer Science and Information Technology", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF COMPUTER NETWORK."],
    ["Master of Information Security", "Faculty of Computer Science and Information Technology", 2, 24850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Software Engineering", "Faculty of Computer Science and Information Technology", 2, 24850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Data Science", "Faculty of Computer Science and Information Technology", 2, 34050, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "New programme starting Second Semester 2025/2026 in Dual Semester fee table."],
    ["Master in Intelligent System", "Faculty of Computer Science and Information Technology", 2, 32850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "New programme starting Second Semester 2025/2026 in Dual Semester fee table."],
    ["Master of Architecture", "Faculty of Design and Architecture", 2, 38100, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; 2-year study cost from Dual Semester table."],
    ["Master in Industrial Design Innovation", "Faculty of Design and Architecture", 2, 34850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; Dual Semester table title: MASTER IN INDUSTRIAL DESIGN INNOVATION."],
    ["Master in Sustainable Landscape Management", "Faculty of Design and Architecture", 2, 34850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; Dual Semester table title: MASTER OF SUSTAINABLE LANDSCAPE MANAGEMENT."],
    ["Master in Tropical Urban Design", "Faculty of Design and Architecture", 2, 27750, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; Dual Semester table title: MASTER OF TROPICAL URBAN DESIGN."],
    ["Master of Landscape Architecture", "Faculty of Design and Architecture", 2, 36750, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Second Semester intake only; 2-year study cost from Dual Semester table."],
    ["Master in Construction Technology Management", "Faculty of Design and Architecture", 1, 38550, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table exposes a 1-year study cost for this programme."],
    ["Master of Education in Curriculum and Instruction", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Education in Sport Science", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Education in Physical Education and Health", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER IN PHYSICAL EDUCATION AND HEALTH EDUCATION."],
    ["Master of Education in Educational Administration", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Education in Teaching of English as a Second Language", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Education in Instructional Technology and Innovation", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Education in Educational Psychology", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Education in Malay Language Education", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF EDUCATION IN MALAY LANGUAGE."],
    ["Master of Education in Technical and Vocational Education", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Counselling", "Faculty of Educational Studies", 2, 34350, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Human Resource Development", "Faculty of Educational Studies", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Emergency Response and Planning", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF EMERGENCY RESPONSE AND PLANNING."],
    ["Master in Engineering Management", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF ENGINEERING MANAGEMENT."],
    ["Master in Environmental Engineering", "Faculty of Engineering", 2, 27300, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF ENVIRONMENTAL ENGINEERING."],
    ["Master in Environmental Technology Management", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF ENVIRONMENT TECHNOLOGY MANAGEMENT."],
    ["Master in Highway and Transportation Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF HIGHWAY AND TRANSPORTATION ENGINEERING."],
    ["Master in Innovation and Engineering Design", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF INNOVATION AND ENGINEERING DESIGN."],
    ["Master in Manufacturing Systems Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF MANUFACTURING SYSTEMS ENGINEERING."],
    ["Master in Process Safety and Loss Prevention", "Faculty of Engineering", 2, 27750, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Remote Sensing and GIS", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF REMOTE SENSING AND GIS."],
    ["Master in Structural Engineering and Construction", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Water Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF WATER ENGINEERING."],
    ["Master in Communication Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF COMMUNICATION ENGINEERING."],
    ["Master in Electrical Power Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Aerospace System Design Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Microelectronic System Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Food Process and Packaging Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Control System Engineering", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Digital Agriculture", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Computer Engineering with Technopreneurship", "Faculty of Engineering", 2, 26850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Food Technology", "Faculty of Food Science and Technology", 2, 29350, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; 2-year study cost from Dual Semester table."],
    ["Master of Food Safety and Quality Assurance", "Faculty of Food Science and Technology", 2, 29850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; 2-year study cost from Dual Semester table."],
    ["Master in Functional Food Design", "Faculty of Food Science and Technology", 2, 29850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; 2-year study cost from Dual Semester table."],
    ["Master of Environment", "Faculty of Forestry and Environment", 2, 25300, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Politics and Government", "Faculty of Human Ecology", 2, 31950, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Community Development", "Faculty of Human Ecology", 2, 31950, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Personal Financial Planning", "Faculty of Human Ecology", 2, 32500, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Environmental and Occupational Health", "Faculty of Medicine and Health Sciences", 2, 32500, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Nutritional Sciences", "Faculty of Medicine and Health Sciences", 2, 30850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; 2-year study cost from Dual Semester table."],
    ["Master in Clinical Psychology", "Faculty of Medicine and Health Sciences", 2, 71250, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; 2-year study cost from Dual Semester table."],
    ["Master in Applied English Linguistics", "Faculty of Modern Languages and Communication", 2, 30850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Corporate Communication", "Faculty of Modern Languages and Communication", 2, 30850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of World Literature", "Faculty of Modern Languages and Communication", 2, 30850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Malay Language and Linguistics", "Faculty of Modern Languages and Communication", 2, 30850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Applied Statistics", "Faculty of Science", 2, 30850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF APPLIED STATISTICS."],
    ["Master in Analytical Chemistry", "Faculty of Science", 2, 29010, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "First Semester intake only; 2-year study cost from Dual Semester table."],
    ["Master in Materials Physics", "Faculty of Science", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master in Tropical Biology", "Faculty of Science", 2, 24850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "Dual Semester table title: MASTER OF TROPICAL BIOLOGY."],
    ["Master in Mathematical Sciences", "Faculty of Science", 2, 28850, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Economics", "School of Business and Economics", 1, 31550, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master in Entrepreneurship", "School of Business and Economics", 1, 33575, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master of Finance", "School of Business and Economics", 1, 31550, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master of Business Administration", "School of Business and Economics", 1, 36050, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master in Human Resource Management and Organization", "School of Business and Economics", 1, 41100, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master of Economics", "Faculty of Humanities, Management and Science", 1, 31550, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master in Entrepreneurship", "Faculty of Humanities, Management and Science", 1, 33575, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master of Business Administration", "Faculty of Humanities, Management and Science", 1, 31550, "trimester", localPostgraduateTrimesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Trimester_official.pdf", "1-year study cost from Trimester international fee table."],
    ["Master in Renewable Energy", "Faculty of Humanities, Management and Science", 2, 27750, "dual-semester", localPostgraduateDualSemesterFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf", "2-year study cost from Dual Semester international fee table."],
    ["Master of Public Health", "Faculty of Medicine and Health Sciences", 1, 41500, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 1-year study cost from Medicine local/international fee table."],
    ["Master of Pathology", "Faculty of Medicine and Health Sciences", 4, 411300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Medical group."],
    ["Master of Medicine (Pediatrics)", "Faculty of Medicine and Health Sciences", 4, 411300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Medical group uses spelling Paediatrics."],
    ["Master of Medicine (Psychiatry)", "Faculty of Medicine and Health Sciences", 4, 411300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Medical group."],
    ["Master of Medicine (Radiology)", "Faculty of Medicine and Health Sciences", 4, 411300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Medical group."],
    ["Master of Medicine (Internal Medicine)", "Faculty of Medicine and Health Sciences", 4, 411300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Medical group."],
    ["Master of Family Medicine", "Faculty of Medicine and Health Sciences", 4, 459300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Surgical group."],
    ["Master of Medicine (Anesthesiology)", "Faculty of Medicine and Health Sciences", 4, 459300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Surgical group uses spelling Anaesthesiology."],
    ["Master of Surgery (Orthopedics)", "Faculty of Medicine and Health Sciences", 4, 459300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Surgical group."],
    ["Master of Surgery (General Surgery)", "Faculty of Medicine and Health Sciences", 4, 459300, "medicine", localPostgraduateMedicineFeeSource, "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf", "International category 4-year study cost from Medicine local/international fee table; Surgical group."]
  ].map(([name, faculty, years, totalMYR, feeSystem, sourceUrl, sourceLabel, note]) => [
    feeKey(String(name), String(faculty)),
    postgraduateFeeRow(Number(years), Number(totalMYR), feeSystem as PostgraduateFeeRow["feeSystem"], String(sourceUrl), String(sourceLabel), String(note))
  ])
);

const bachelorProgrammes: Array<[string, string]> = [
  ["Bachelor of Science in Agriculture with Honours", "Faculty of Agriculture"],
  ["Bachelor of Science in Horticulture with Honours", "Faculty of Agriculture"],
  ["Bachelor of Agribusiness Science with Honours", "Faculty of Agriculture"],
  ["Bachelor of Science in Aquaculture with Honours", "Faculty of Agriculture"],
  ["Bachelor of Science in Animal Science with Honours", "Faculty of Agriculture"],
  ["Bachelor of Science in Plantation Management with Honours", "Faculty of Agriculture"],
  ["Bachelor of Smart Agricultural Technology with Honours", "Faculty of Agriculture"],
  ["Bachelor of Computer Science with Honours", "Faculty of Computer Science and Information Technology"],
  ["Bachelor of Computer Science (Multimedia Computing) with Honours", "Faculty of Computer Science and Information Technology"],
  ["Bachelor of Computer Science (Computer Network) with Honours", "Faculty of Computer Science and Information Technology"],
  ["Bachelor of Software Engineering with Honours", "Faculty of Computer Science and Information Technology"],
  ["Bachelor of Landscape Architecture with Honours", "Faculty of Design and Architecture"],
  ["Bachelor of Science in Architecture with Honours", "Faculty of Design and Architecture"],
  ["Bachelor of Industrial Design with Honours", "Faculty of Design and Architecture"],
  ["Bachelor of Education in Agricultural Science with Honours", "Faculty of Educational Studies"],
  ["Bachelor of Education in Home Science with Honours", "Faculty of Educational Studies"],
  ["Bachelor of Education in Physical Education with Honours", "Faculty of Educational Studies"],
  ["Bachelor of Education in Malay Language with Honours", "Faculty of Educational Studies"],
  ["Bachelor of Education in Teaching English as a Second Language [TESL] With Honours", "Faculty of Educational Studies"],
  ["Bachelor of Education in Guidance and Counselling with Honours", "Faculty of Educational Studies"],
  ["Bachelor of Science Human Resource Development with Honours", "Faculty of Educational Studies"],
  ["Bachelor of Counselling with Honours", "Faculty of Educational Studies"],
  ["Bachelor of Aerospace Engineering with Honours", "Faculty of Engineering"],
  ["Bachelor of Civil Engineering with Honours", "Faculty of Engineering"],
  ["Bachelor of Agricultural and Biosystems Engineering with Honours", "Faculty of Engineering"],
  ["Bachelor of Electrical and Electronic Engineering with Honours", "Faculty of Engineering"],
  ["Bachelor of Chemical Engineering with Honours", "Faculty of Engineering"],
  ["Bachelor of Computer and Communication Systems Engineering with Honours", "Faculty of Engineering"],
  ["Bachelor of Mechanical Engineering with Honours", "Faculty of Engineering"],
  ["Bachelor of Process and Food Engineering with Honours", "Faculty of Engineering"],
  ["Bachelor of Forestry Science with Honours", "Faculty of Forestry and Environment"],
  ["Bachelor of Wood Science and Technology with Honours", "Faculty of Forestry and Environment"],
  ["Bachelor of Parks & Recreation Science with Honours", "Faculty of Forestry and Environment"],
  ["Bachelor of Environmental Management with Honours", "Faculty of Forestry and Environment"],
  ["Bachelor of Environmental Science and Technology with Honours", "Faculty of Forestry and Environment"],
  ["Bachelor of Food Science and Technology with Honours", "Faculty of Food Science and Technology"],
  ["Bachelor of Science in Food Studies with Honours", "Faculty of Food Science and Technology"],
  ["Bachelor of Science in Food Service Management with Honours", "Faculty of Food Science and Technology"],
  ["Bachelor of Science in Food Manufacturing Operations with Honours", "Faculty of Food Science and Technology"],
  ["Doctor of Medicine", "Faculty of Medicine and Health Science"],
  ["Bachelor of Science Biomedical Science with Honours", "Faculty of Medicine and Health Science"],
  ["Bachelor of Science Dietetics with Honours", "Faculty of Medicine and Health Science"],
  ["Bachelor of Science Nutrition and Community Health with Honours", "Faculty of Medicine and Health Science"],
  ["Bachelor of Science Environmental & Occupational Health with Honours", "Faculty of Medicine and Health Science"],
  ["Bachelor of Nursing with Honours", "Faculty of Medicine and Health Science"],
  ["Bachelor of Communication with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Arts in Malay Literature with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Arts in Malay Language And Linguistics with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Arts in French Language Studies with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Arts in German Language Studies with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Arts in Arabic Language with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Arts in Chinese Language Studies with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Arts in English Language And Linguistics with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Arts in English Literature with Honours", "Faculty of Modern Languages and Communication"],
  ["Bachelor of Science in Biology with Honours", "Faculty of Science"],
  ["Bachelor of Science in Physics with Honours", "Faculty of Science"],
  ["Bachelor of Science in Material Physics with Honours", "Faculty of Science"],
  ["Bachelor of Science in Instrumentation Physics with Honours", "Faculty of Science"],
  ["Bachelor of Science in Chemistry with Honours", "Faculty of Science"],
  ["Bachelor of Science in Petroleum Chemistry with Honours", "Faculty of Science"],
  ["Bachelor of Science in Industrial Chemistry with Honours", "Faculty of Science"],
  ["Bachelor of Science in Mathematics with Honours", "Faculty of Science"],
  ["Bachelor of Science in Statistics with Honours", "Faculty of Science"],
  ["Bachelor of Science in Biology with Education (Honours)", "Faculty of Science"],
  ["Bachelor of Science in Physics with Education (Honours)", "Faculty of Science"],
  ["Bachelor of Science in Chemistry with Education (Honours)", "Faculty of Science"],
  ["Bachelor of Science in Mathematics with Education (Honours)", "Faculty of Science"],
  ["Bachelor of Science in Statistics with Education (Honours)", "Faculty of Science"],
  ["Doctor of Veterinary Medicine", "Faculty of Veterinary Medicine"],
  ["Bachelor of Science in Biochemistry with Honours", "Faculty of Biotechnology and Biomolecular Sciences"],
  ["Bachelor of Science in Microbiology with Honours", "Faculty of Biotechnology and Biomolecular Sciences"],
  ["Bachelor of Science in Biotechnology with Honours", "Faculty of Biotechnology and Biomolecular Sciences"],
  ["Bachelor of Science in Cell and Molecular Biology with Honours", "Faculty of Biotechnology and Biomolecular Sciences"],
  ["Bachelor of Economics with Honours", "School of Business and Economics"],
  ["Bachelor of Accounting (Honours)", "School of Business and Economics"],
  ["Bachelor of Business Administration with Honours", "School of Business and Economics"],
  ["Bachelor of Human Development Science with Honours", "Faculty of Human Ecology"],
  ["Bachelor of Human Development Science with Management (Honours)", "Faculty of Human Ecology"],
  ["Bachelor of Human Development Science with Information Technology (Honours)", "Faculty of Human Ecology"],
  ["Bachelor of Consumer Studies with Honours", "Faculty of Human Ecology"],
  ["Bachelor of Music with Honours", "Faculty of Human Ecology"],
  ["Bachelor of Bioindustry Science with Honours", "Faculty of Agricultural Science and Forestry (UPMS)"],
  ["Bachelor of Forestry Science with Honours", "Faculty of Agricultural Science and Forestry (UPMS)"],
  ["Bachelor of Science in Aquaculture with Honours", "Faculty of Agricultural Science and Forestry (UPMS)"],
  ["Bachelor Of Human Development Science with Management Honours", "Faculty of Humanities, Management and Science (UPMS)"],
  ["Bachelor of Science Honours In Industrial Chemistry", "Faculty of Humanities, Management and Science (UPMS)"]
];

const courseworkProgrammes: Array<[string, string, string?]> = [
  ["Master in Land Resource Management", "Faculty of Agriculture"],
  ["Master in Plantation Management", "Faculty of Agriculture"],
  ["Master in Tropical Soil Science", "Faculty of Agriculture"],
  ["Master in Food Security", "Faculty of Agriculture"],
  ["Master of Science in Biotechnology with Bioentrepreneurship", "Faculty of Biotechnology and Biomolecular Sciences", "First Trimester intake only"],
  ["Master of Computer Science", "Faculty of Computer Science and Information Technology"],
  ["Master of Information Security", "Faculty of Computer Science and Information Technology"],
  ["Master of Software Engineering", "Faculty of Computer Science and Information Technology"],
  ["Master in Computer Network", "Faculty of Computer Science and Information Technology"],
  ["Master in Data Science", "Faculty of Computer Science and Information Technology"],
  ["Master in Intelligent System", "Faculty of Computer Science and Information Technology"],
  ["Master of Architecture", "Faculty of Design and Architecture"],
  ["Master of Landscape Architecture", "Faculty of Design and Architecture"],
  ["Master in Tropical Urban Design", "Faculty of Design and Architecture"],
  ["Master in Sustainable Landscape Management", "Faculty of Design and Architecture"],
  ["Master in Industrial Design Innovation", "Faculty of Design and Architecture"],
  ["Master in Construction Technology Management", "Faculty of Design and Architecture"],
  ["Master of Education in Curriculum and Instruction", "Faculty of Educational Studies"],
  ["Master of Education in Sport Science", "Faculty of Educational Studies"],
  ["Master of Education in Physical Education and Health", "Faculty of Educational Studies"],
  ["Master of Education in Educational Administration", "Faculty of Educational Studies"],
  ["Master of Education in Teaching of English as a Second Language", "Faculty of Educational Studies"],
  ["Master of Education in Instructional Technology and Innovation", "Faculty of Educational Studies"],
  ["Master of Education in Educational Psychology", "Faculty of Educational Studies"],
  ["Master of Education in Malay Language Education", "Faculty of Educational Studies"],
  ["Master of Education in Technical and Vocational Education", "Faculty of Educational Studies"],
  ["Master of Counselling", "Faculty of Educational Studies"],
  ["Master of Human Resource Development", "Faculty of Educational Studies"],
  ["Master in Emergency Response and Planning", "Faculty of Engineering"],
  ["Master in Engineering Management", "Faculty of Engineering"],
  ["Master in Environmental Engineering", "Faculty of Engineering"],
  ["Master in Environmental Technology Management", "Faculty of Engineering"],
  ["Master in Highway and Transportation Engineering", "Faculty of Engineering"],
  ["Master in Innovation and Engineering Design", "Faculty of Engineering"],
  ["Master in Manufacturing Systems Engineering", "Faculty of Engineering"],
  ["Master in Process Safety and Loss Prevention", "Faculty of Engineering"],
  ["Master in Remote Sensing and GIS", "Faculty of Engineering"],
  ["Master in Structural Engineering and Construction", "Faculty of Engineering"],
  ["Master in Water Engineering", "Faculty of Engineering"],
  ["Master in Communication Engineering", "Faculty of Engineering"],
  ["Master in Electrical Power Engineering", "Faculty of Engineering"],
  ["Master in Aerospace System Design Engineering", "Faculty of Engineering"],
  ["Master in Microelectronic System Engineering", "Faculty of Engineering"],
  ["Master in Food Process and Packaging Engineering", "Faculty of Engineering"],
  ["Master in Control System Engineering", "Faculty of Engineering"],
  ["Master in Digital Agriculture", "Faculty of Engineering"],
  ["Master in Computer Engineering with Technopreneurship", "Faculty of Engineering"],
  ["Master of Food Technology", "Faculty of Food Science and Technology", "First Semester intake only"],
  ["Master of Food Safety and Quality Assurance", "Faculty of Food Science and Technology", "First Semester intake only"],
  ["Master in Functional Food Design", "Faculty of Food Science and Technology", "First Semester intake only"],
  ["Master of Environment", "Faculty of Forestry and Environment"],
  ["Master in Politics and Government", "Faculty of Human Ecology"],
  ["Master in Community Development", "Faculty of Human Ecology"],
  ["Master in Personal Financial Planning", "Faculty of Human Ecology"],
  ["Master of Surgery (General Surgery)", "Faculty of Medicine and Health Sciences"],
  ["Doctor of Public Health", "Faculty of Medicine and Health Sciences"],
  ["Master of Public Health", "Faculty of Medicine and Health Sciences"],
  ["Master of Pathology", "Faculty of Medicine and Health Sciences"],
  ["Master of Family Medicine", "Faculty of Medicine and Health Sciences"],
  ["Master of Medicine (Pediatrics)", "Faculty of Medicine and Health Sciences"],
  ["Master of Medicine (Psychiatry)", "Faculty of Medicine and Health Sciences"],
  ["Master of Medicine (Radiology)", "Faculty of Medicine and Health Sciences"],
  ["Master of Medicine (Internal Medicine)", "Faculty of Medicine and Health Sciences"],
  ["Master of Medicine (Anesthesiology)", "Faculty of Medicine and Health Sciences"],
  ["Master of Surgery (Orthopedics)", "Faculty of Medicine and Health Sciences"],
  ["Master in Nutritional Sciences", "Faculty of Medicine and Health Sciences"],
  ["Master in Clinical Psychology", "Faculty of Medicine and Health Sciences"],
  ["Master in Environmental and Occupational Health", "Faculty of Medicine and Health Sciences"],
  ["Master in Applied English Linguistics", "Faculty of Modern Languages and Communication"],
  ["Master in Corporate Communication", "Faculty of Modern Languages and Communication"],
  ["Master of World Literature", "Faculty of Modern Languages and Communication"],
  ["Master of Malay Language and Linguistics", "Faculty of Modern Languages and Communication"],
  ["Master in Applied Statistics", "Faculty of Science"],
  ["Master in Analytical Chemistry", "Faculty of Science"],
  ["Master in Materials Physics", "Faculty of Science"],
  ["Master in Tropical Biology", "Faculty of Science"],
  ["Master in Mathematical Sciences", "Faculty of Science"],
  ["Master of Veterinary Science", "Faculty of Veterinary Medicine"],
  ["Master of Veterinary Medicine", "Faculty of Veterinary Medicine", "First Semester intake only"],
  ["Master of Economics", "School of Business and Economics"],
  ["Master in Entrepreneurship", "School of Business and Economics"],
  ["Master of Finance", "School of Business and Economics"],
  ["Master of Business Administration", "School of Business and Economics"],
  ["Master in Human Resource Management and Organization", "School of Business and Economics"],
  ["Master of Economics", "Faculty of Humanities, Management and Science"],
  ["Master in Entrepreneurship", "Faculty of Humanities, Management and Science"],
  ["Master of Business Administration", "Faculty of Humanities, Management and Science"],
  ["Master in Renewable Energy", "Faculty of Humanities, Management and Science"]
];

const medicineLocalOnly = new Set<string>();

const temporarilyClosedProgrammes = new Set<string>();

const officialCourseworkMasterCount = 87;
const officialResearchMasterDegreeCount = 3;

const researchFields = [
  "Accounting", "Agribusiness", "Agricultural Economics", "Agronomy", "Aquaculture", "Biochemistry", "Biotechnology with Bio-entrepreneurship",
  "Business Economics", "Chemical Engineering", "Computer Networks", "Data Science", "Economics", "Education in Malay Language",
  "Electrical Power Engineering", "English Language", "Environmental Engineering", "Food Science", "Forestry", "Human Development",
  "Management", "Malay Literature", "Microbiology", "Plant Pathology", "Public Health", "Sustainable Recreation and Ecotourism"
];

function makeBachelorPrograms(): UPMProgramSeed[] {
  return bachelorProgrammes.map(([name, faculty], index) => {
    const fee = undergraduateFeeRows.get(feeKey(name, faculty));
    return {
      code: fee?.code ?? `UPM-UG-${String(index + 1).padStart(3, "0")}`,
      name: normalizeTitle(name),
      faculty,
      level: "bachelor",
      category: inferCategory(name, faculty),
      durationYears: fee?.years ?? (/Doctor of Medicine|Doctor of Veterinary Medicine/.test(name) ? 5 : 4),
      durationOfficial: fee
        ? yearDurationLabel(fee.years)
        : yearDurationLabel(/Doctor of Medicine|Doctor of Veterinary Medicine/.test(name) ? 5 : 4),
      semesters: fee?.semesters,
      tuitionPerSemesterMYR: fee?.perSemesterMYR ?? null,
      tuitionMYR: fee?.totalMYR ?? null,
      feeStatus: fee ? "matched-official" : "not-published",
      sourceUrl: undergradSource,
      feeSourceUrl: localUndergraduateFeeSource,
      feeSourceLabel: "UPM_Tuition_Fees_International_2026_official.pdf",
      intake: ["October", "March"],
      intakeNote: "UPM international undergraduate admission materials publish Bachelor intakes in October and March. StudyMY stores only the official intake months for list display.",
      auditNote: fee
        ? [
            "Programme title and faculty are taken from current UPM undergraduate admission page updated 26/03/2026.",
            `International tuition is calibrated from UPM_Tuition_Fees_International_2026_official.pdf: MYR ${fee.perSemesterMYR.toLocaleString("en-MY")} per semester, MYR ${fee.totalMYR.toLocaleString("en-MY")} overall total.`,
            `Official fee table duration basis: ${fee.semesters} semesters / ${yearDurationLabel(fee.years)}.`,
            fee.note
          ].filter(Boolean).join(" ")
        : "Programme title and faculty are taken from current UPM undergraduate admission page updated 26/03/2026. The provided UPM 2026 international tuition PDF does not expose a matching fee row for this current programme title; no adjacent-faculty fee is applied."
    };
  });
}

function makeCourseworkPrograms(): UPMProgramSeed[] {
  return courseworkProgrammes.map(([name, faculty, intakeNote], index) => {
    const isProfessionalDoctorate = name === "Doctor of Public Health";
    const isLocalOnly = medicineLocalOnly.has(name);
    const isTemporarilyClosed = temporarilyClosedProgrammes.has(name);
    const fee = isProfessionalDoctorate
      ? postgraduateFeeRow(
          3,
          150750,
          "medicine",
          localPostgraduateMedicineFeeSource,
          "UPM_2026_Postgraduate_Tuition_Fee_Medicine_Local_International_official.pdf",
          "International category 3-year study cost from Medicine local/international fee table."
        )
      : postgraduateCourseworkFeeRows.get(feeKey(name, faculty));
    const durationYears = fee?.years ?? (isProfessionalDoctorate ? 3 : 2);
    const intake = isProfessionalDoctorate
      ? ["October", "March"]
      : courseworkIntakeMonths(name, faculty, intakeNote, fee);
    return {
      code: `${isProfessionalDoctorate ? "UPM-DCW" : "UPM-MCW"}-${String(index + 1).padStart(3, "0")}`,
      name,
      faculty,
      level: isProfessionalDoctorate ? "phd" as const : "master" as const,
      studyMode: isProfessionalDoctorate ? "Mixed-Mode" : "Coursework",
      category: inferCategory(name, faculty),
      durationYears,
      durationOfficial: yearDurationLabel(durationYears),
      tuitionMYR: fee?.totalMYR ?? null,
      feeStatus: fee ? "matched-official" as const : "not-published" as const,
      sourceUrl: pgHandbookSource,
      feeSourceUrl: fee?.sourceUrl ?? pgHandbookSource,
      feeSourceLabel: fee?.sourceLabel,
      intake: isLocalOnly
        ? []
        : isTemporarilyClosed
          ? []
          : intake,
      intakeNote: isLocalOnly
        ? "UPM postgraduate application guidelines state this medicine category is only open for local citizens of Malaysia."
        : isTemporarilyClosed
          ? "UPM SGS faculty page states this programme is temporarily closed for new intake."
          : intakeNote
            ? `${intakeNote}. Official postgraduate academic calendar is converted to month-only display.`
            : "UPM postgraduate academic calendar publishes the applicable intake months; StudyMY stores only months for list display.",
      publicDisplayStatus: isLocalOnly || isTemporarilyClosed ? "not-available-for-international" as const : "ready" as const,
      sourceStatus: isLocalOnly || isTemporarilyClosed
        ? "official-page-verified-international-not-available" as const
        : "official-verified" as const,
      reviewReason: isLocalOnly
        ? "Official UPM postgraduate guideline marks this medicine category as local-citizen only."
        : isTemporarilyClosed
          ? "Official UPM faculty page marks this programme as temporarily closed for new intake."
          : null,
      auditNote:
        [
          "Coursework programme title is taken from UPM Postgraduate Student Handbook 2026 and cross-checked against UPM 2026 postgraduate tuition fee PDFs.",
          fee
            ? `International postgraduate tuition is calibrated from ${fee.sourceLabel}: MYR ${fee.totalMYR.toLocaleString("en-MY")} total / ${yearDurationLabel(fee.years)} (${fee.feeSystem}). ${fee.note}`
            : "No matching programme fee row was found in the three provided postgraduate tuition PDFs; fee remains official-not-published."
        ].join(" ")
    };
  });
}

function makeResearchPrograms(): UPMProgramSeed[] {
  const researchFee = (level: DegreeLevel) => level === "master"
    ? {
        years: 2,
        totalMYR: 17600,
        display: "MYR 17,600-19,600 total (2 years, by research cluster)",
        note:
          "UPM Dual Semester research fee table charges Master by Research by cluster: Medical MYR 19,600, Science & Technology MYR 19,550, Social Science MYR 17,600 for maximum 2 years."
      }
    : {
        years: 4,
        totalMYR: 33900,
        display: "MYR 33,900-48,050 total (4 years, by research cluster)",
        note:
          "UPM Dual Semester research fee table charges PhD by Research by cluster: Medical MYR 48,050, Science & Technology MYR 43,600, Social Science MYR 33,900 for maximum 4 years."
      };
  const masterResearch = [
    ["UPM-MRES-MS", "Master of Science (M.S.)", "Programme by Research"],
    ["UPM-MRES-MA", "Master of Arts (M.A)", "Programme by Research"],
    ["UPM-MRES-MVSC", "Master of Veterinary Science (M.V.Sc.)", "Programme by Research"]
  ];
  const phdResearch = [
    ["UPM-PHD", "Doctor of Philosophy (PhD)", "Programme by Research"],
    ["UPM-DENG", "Doctor of Engineering (Deng)", "Programme by Research"],
    ["UPM-PHD-PUB", "Doctor of Philosophy (PhD) by Publication", "Programme by Research"],
    ["UPM-PHD-RETRO", "Doktor Falsafah (PhD) by Retrospective", "Programme by Research"]
  ];
  const mk = ([code, name, faculty]: string[], level: DegreeLevel): UPMProgramSeed => {
    const fee = researchFee(level);
    return {
      code,
      name,
      faculty,
      level,
      studyMode: "Research",
      category: inferCategory(name, faculty),
      durationYears: fee.years,
      durationOfficial: yearDurationLabel(fee.years),
      tuitionMYR: fee.totalMYR,
      tuitionDisplayOverride: fee.display,
      officialTuitionNoteOverride: fee.note,
      feeStatus: "matched-official",
      sourceUrl: researchSource,
      feeSourceUrl: localPostgraduateDualSemesterFeeSource,
      feeSourceLabel: "UPM_2026_Postgraduate_Tuition_Fee_International_Dual_Semester_official.pdf",
      intake: ["September", "March"],
      intakeNote: "UPM postgraduate application guidelines publish Dual-Semester intakes for Master by Research and PhD as First Semester (September) and Second Semester (March); applications are open throughout the year and assigned by deadline.",
      auditNote:
        `UPM publishes 300+ research fields; fields are stored as specializations and are not counted as separate programmes. ${fee.note}`,
      specializations: researchFields
    };
  };
  return [
    ...masterResearch.map((item) => mk(item, "master")),
    ...phdResearch.map((item) => mk(item, "phd"))
  ];
}

function toProgramEntity(seed: UPMProgramSeed, universityId: number) {
  const published = seed.publicDisplayStatus !== "not-available-for-international";
  const publicDisplayStatus = seed.publicDisplayStatus ?? (seed.feeStatus === "pending-review" ? "needs-review" : "ready");
  const reviewReason = seed.reviewReason ?? (seed.feeStatus === "pending-review" ? "Official amount needs manual visual confirmation from PDF row." : null);
  const tuitionDisplay = seed.tuitionDisplayOverride ?? (seed.tuitionMYR == null
    ? "Not published by official source"
    : seed.tuitionPerSemesterMYR
      ? `MYR ${seed.tuitionMYR.toLocaleString("en-MY")} total (${seed.tuitionPerSemesterMYR.toLocaleString("en-MY")}/sem)`
      : `MYR ${seed.tuitionMYR.toLocaleString("en-MY")}`);
  const tuitionCurrency = seed.tuitionMYR == null ? ("UNKNOWN" as const) : ("MYR" as const);
  const displayIntakeMonths = intakeMonthsForSeed(seed);
  const officialIntake = displayIntakeMonths.length ? displayIntakeMonths.join(", ") : notPublished.en;
  return {
    universityId,
    slug: `upm-${slugify(seed.name)}-${slugify(seed.code)}`,
    code: seed.code,
    name: localizedProgramName(seed.name),
    nameEnOfficial: publicEnglishProgramName(seed.name),
    level: seed.level,
    category: seed.category ?? inferCategory(seed.name, seed.faculty),
    faculty: localizedFaculty(seed.faculty),
    facultyZh: seed.faculty,
    studyMode: seed.studyMode ?? (seed.level === "bachelor" ? "Full-time" : seed.sourceUrl === researchSource ? "Research" : "Coursework"),
    campus: "UPM Main Campus (Serdang, Selangor)",
    durationYears: seed.durationYears,
    durationOfficial: seed.durationOfficial,
    annualTuitionCny: seed.tuitionMYR == null ? 0 : Math.round((seed.tuitionMYR / Math.max(seed.durationYears, 1)) * 1.55),
    tuitionAmount: seed.tuitionMYR,
    tuitionCurrency,
    tuitionDisplay,
    officialTuitionMYR: seed.tuitionMYR ?? null,
    officialTuitionNote: seed.officialTuitionNoteOverride ?? (seed.tuitionMYR == null
      ? "Not published by official source"
      : seed.tuitionPerSemesterMYR
        ? `Official UPM international tuition: MYR ${seed.tuitionPerSemesterMYR.toLocaleString("en-MY")} per semester, overall total MYR ${seed.tuitionMYR.toLocaleString("en-MY")}.`
        : "Official international fee from UPM source."),
    officialFeeSourceUrl: seed.feeSourceUrl ?? seed.sourceUrl,
    secondaryOfficialFeeSourceUrl: seed.level === "bachelor" ? "" : pgGuideSource,
    officialFeeAuditStatus: seed.feeStatus ?? "not-published",
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: displayIntakeMonths,
    officialIntake,
    officialIntakeNote: seed.intakeNote ?? null,
    languageRequirement: languageRequirementForSeed(seed),
    officialLanguageRequirement: officialLanguageRequirementForSeed(seed),
    requirement: {
      gpa: seed.level === "bachelor" ? 3 : 2.75,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: localizedRequirementNote(seed.level)
    },
    officialAcademicRequirement:
      seed.level === "bachelor"
        ? "Official booklet: A Level/equivalent 12 years of basic education with minimum 80% and above, or recognised diploma CGPA 3.00; specific programme requirements may apply."
        : "Official SGS postgraduate application guidelines and programme pages apply; specific requirements vary by programme.",
    chinaStudentRequirement: "Not published by official source",
    specialRequirementsNote: seed.publicDisplayStatus === "not-available-for-international" ? "Not open to international applicants." : null,
    applicationDocs: applicationDocuments,
    curriculum: arr([], [], [], []),
    careers: arr([], [], [], []),
    specializations: seed.specializations ? translateArray(seed.specializations) : arr([], [], [], []),
    description: localizedDescription(seed),
    officialAccreditationNote: "UPM official programme listing verified; programme accreditation details are not normalised in this import.",
    officialSourceUrl: seed.sourceUrl,
    officialEntryRequirementSourceUrl: seed.level === "bachelor" ? undergradSource : pgGuideSource,
    officialAccreditationSourceUrl: seed.sourceUrl,
    sourceUrls: [
      { title: "UPM official programme source", url: seed.sourceUrl, sourceType: "official-website" as const, verifiedAt, status: seed.sourceStatus ?? "official-verified" },
      { title: seed.feeSourceLabel ?? "UPM official fee/admission source", url: seed.feeSourceUrl ?? seed.sourceUrl, sourceType: "fee" as const, verifiedAt, status: seed.sourceStatus ?? "official-verified" }
    ],
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: seed.sourceStatus ?? "official-verified",
    publicDisplayStatus,
    publicDisplayNote: publicDisplayStatus === "ready" ? null : "Retained for audit but not treated as ready international display.",
    reviewReason,
    auditNote: seed.auditNote ?? null,
    listTuitionText: tuitionDisplay,
    isPublished: published
  };
}

function readArgValue(name: string) {
  const prefixed = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefixed));
  if (inline) return inline.slice(prefixed.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeLevelFilter(value: string | undefined): DegreeLevel | "all" {
  if (!value || value === "all") return "all";
  if (value === "bachelor" || value === "master" || value === "phd") return value;
  throw new Error(`Unsupported --level value: ${value}. Use bachelor, master, phd, or all.`);
}

async function main() {
  loadEnvFiles();
  const levelFilter = normalizeLevelFilter(readArgValue("--level"));
  const seedsAll = [...makeBachelorPrograms(), ...makeCourseworkPrograms(), ...makeResearchPrograms()];
  const seeds = levelFilter === "all" ? seedsAll : seedsAll.filter((seed) => seed.level === levelFilter);
  const masterSeeds = seedsAll.filter((seed) => seed.level === "master");
  const bachelorSeeds = seedsAll.filter((seed) => seed.level === "bachelor");
  const courseworkMasterSeeds = masterSeeds.filter((seed) => seed.studyMode === "Coursework");
  const researchMasterSeeds = masterSeeds.filter((seed) => seed.studyMode === "Research");
  const totalByLevel = seeds.reduce<Record<string, number>>((acc, seed) => {
    acc[seed.level] = (acc[seed.level] ?? 0) + 1;
    return acc;
  }, {});
  const totalByStatus = seeds.reduce<Record<string, number>>((acc, seed) => {
    const status = seed.publicDisplayStatus ?? (seed.feeStatus === "pending-review" ? "needs-review" : "ready");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--confirm-import");
  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          universityCode: "UPM",
          verifiedAt,
          sources: {
            undergraduateProgrammes: undergradSource,
            undergraduateFees: undergradFeeSource,
            postgraduateCoursework: courseworkSource,
            postgraduateResearch: researchSource,
            postgraduateHandbook: pgHandbookSource,
            postgraduateGuide: pgGuideSource,
            postgraduateEnglishRequirements: pgEnglishRequirementSource,
            postgraduateDualSemesterFees: localPostgraduateDualSemesterFeeSource,
            postgraduateTrimesterFees: localPostgraduateTrimesterFeeSource,
            postgraduateMedicineFees: localPostgraduateMedicineFeeSource
          },
          officialDisplayModel: {
            undergraduate:
              "UPM publishes the current undergraduate catalogue as faculty-grouped programme-title lists; StudyMY stores each programme title as a row and keeps missing duration/tuition/intake as official-not-published notes.",
            coursework:
              "UPM publishes coursework postgraduate programmes through SGS faculty/programme pages and the 2026 handbook; StudyMY stores programme titles as rows.",
            research:
              "UPM publishes research mode as a small number of degree titles with 300+ fields of study; StudyMY stores degree titles as rows and fields as specializations, not separate programmes."
          },
          counts: {
            totalProgrammes: seeds.length,
            scopeLevel: levelFilter,
            byLevel: totalByLevel,
            byStatus: totalByStatus,
            undergraduateProgrammes: bachelorProgrammes.length,
            courseworkProgrammes: courseworkProgrammes.length,
            researchProgrammeTitles: makeResearchPrograms().length
          },
          tuitionScope: {
            officialFeeSource: localUndergraduateFeeSource,
            postgraduateFeeSources: [
              localPostgraduateDualSemesterFeeSource,
              localPostgraduateTrimesterFeeSource,
              localPostgraduateMedicineFeeSource
            ],
            calibratedProgrammesInScope: seeds.filter((seed) => seed.tuitionMYR != null).length,
            notPublishedInScope: seeds.filter((seed) => seed.tuitionMYR == null).length,
            bachelorProgrammes: bachelorSeeds.length,
            bachelorFeeRowsMatched: bachelorSeeds.filter((seed) => seed.tuitionMYR != null).length,
            bachelorFeeRowsNotPublished: bachelorSeeds.filter((seed) => seed.tuitionMYR == null).length,
            postgraduateProgrammes: seedsAll.filter((seed) => seed.level === "master" || seed.level === "phd").length,
            postgraduateFeeRowsMatched: seedsAll.filter((seed) => (seed.level === "master" || seed.level === "phd") && seed.tuitionMYR != null).length,
            postgraduateFeeRowsNotPublished: seedsAll.filter((seed) => (seed.level === "master" || seed.level === "phd") && seed.tuitionMYR == null).length,
            rule:
              "Undergraduate fees use the provided undergraduate PDF. Postgraduate fees use the provided Dual Semester, Trimester, and Medicine official PDFs; research-mode fees are displayed as official cluster ranges."
          },
          masterScope: {
            totalMasterProgrammes: masterSeeds.length,
            courseworkMasters: courseworkMasterSeeds.length,
            researchMasterDegreeTitles: researchMasterSeeds.length,
            officialCourseworkMasterCount,
            officialResearchMasterDegreeCount,
            countClosed: courseworkMasterSeeds.length === officialCourseworkMasterCount &&
              researchMasterSeeds.length === officialResearchMasterDegreeCount,
            notAvailableForInternational: masterSeeds.filter((seed) => seed.publicDisplayStatus === "not-available-for-international").length,
            readyForPublicList: masterSeeds.filter((seed) => (seed.publicDisplayStatus ?? "ready") === "ready").length,
            rule:
              "StudyMY counts official Master programme titles only. Research fields are stored under specializations and are not counted as separate master programmes."
          },
          firstFiveProgrammes: seeds.slice(0, 5).map((seed) => ({
            code: seed.code,
            name: seed.name,
            level: seed.level,
            faculty: seed.faculty,
            publicDisplayStatus: seed.publicDisplayStatus ?? "ready"
          })),
          nextStep:
            "Run with --level master --confirm-import to write only UPM master programmes into the configured database, or --confirm-import for the full UPM catalogue."
        },
        null,
        2
      )
    );
    return;
  }
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
  const universityRepo = dataSource.getRepository(UniversityEntity);
  const programRepo = dataSource.getRepository(ProgramEntity);

  await dataSource.transaction(async (manager) => {
    const university = await manager.getRepository(UniversityEntity).findOne({ where: { code: "UPM" } });
    if (!university) throw new Error("UPM university row not found.");

    Object.assign(university, {
      slug: "universiti-putra-malaysia-upm",
      name: t("Universiti Putra Malaysia (UPM)", "马来西亚博特拉大学 (UPM)"),
      shortName: "UPM",
      nameEnOfficial: "Universiti Putra Malaysia",
      officialWebsite: "https://www.upm.edu.my/",
      studyPortalUrl: "https://sgs.upm.edu.my/programme_of_study-1872",
      internationalPageUrl: "https://akademik.upm.edu.my/international_student_admission-3955",
      applicationPortalUrl: "https://sgsportal.upm.edu.my:8080/sgsportal/",
      officialAddress: "Universiti Putra Malaysia, 43400 UPM Serdang, Selangor",
      location: t("Serdang, Selangor", "雪兰莪沙登", "雪蘭莪沙登", "Serdang, Selangor"),
      region: t("Selangor", "雪兰莪", "雪蘭莪", "Selangor"),
      ownership: "public",
      institutionType: "research",
      description: t(
        "Universiti Putra Malaysia is a Malaysian public research university with official undergraduate, coursework postgraduate and research postgraduate pathways.",
        "马来西亚博特拉大学是马来西亚公立研究型大学，官方提供本科、授课型硕士与研究型硕博项目。",
        "馬來西亞博特拉大學是馬來西亞公立研究型大學，官方提供本科、授課型碩士與研究型碩博項目。",
        "Universiti Putra Malaysia ialah universiti penyelidikan awam di Malaysia yang menawarkan laluan sarjana muda, pascasiswazah kerja kursus dan pascasiswazah penyelidikan."
      ),
      officialProfile: {
        undergraduateSource: undergradSource,
        courseworkSource,
        researchSource,
        postgraduateHandbook: pgHandbookSource,
        postgraduateGuide: pgGuideSource,
        auditPolicy: "Official UPM sources only; research fields are not counted as separate programmes."
      },
      officialSources: [
        { title: "International Undergraduate Programmes Booklet", url: undergradSource, sourceType: "official-website", verifiedAt, status: "official-verified" },
        { title: "Programme by Coursework", url: courseworkSource, sourceType: "official-website", verifiedAt, status: "official-verified" },
        { title: "Postgraduate Student Handbook 2026", url: pgHandbookSource, sourceType: "official-website", verifiedAt, status: "official-verified" },
        { title: "Programme by Research (PhD/Master)", url: researchSource, sourceType: "official-website", verifiedAt, status: "official-verified" },
        { title: "Postgraduate Application Guidelines", url: pgGuideSource, sourceType: "admission", verifiedAt, status: "official-verified" }
      ],
      officialVerifiedAt: verifiedAt,
      officialSourceStatus: "official-verified",
      officialAuditSummary:
        "UPM refreshed from official undergraduate booklet, Postgraduate Student Handbook 2026 coursework list, SGS research page, and postgraduate application guidelines. Research fields are stored as specializations rather than separate programmes.",
      publicDisplayStatus: "ready",
      minIelts: 5.5,
      acceptNoLanguage: false
    });
    await manager.getRepository(UniversityEntity).save(university);

    if (levelFilter === "all") {
      await manager.getRepository(ProgramEntity).delete({ universityId: university.id });
    } else {
      await manager.getRepository(ProgramEntity).delete({ universityId: university.id, level: levelFilter });
    }
    const rows = seeds.map((seed) => manager.getRepository(ProgramEntity).create(toProgramEntity(seed, university.id)));
    await manager.getRepository(ProgramEntity).save(rows);
    university.programCount = await manager.getRepository(ProgramEntity).count({
      where: { universityId: university.id, publicDisplayStatus: "ready", isPublished: true }
    });
    await manager.getRepository(UniversityEntity).save(university);
  });

  const upm = await universityRepo.findOneOrFail({ where: { code: "UPM" } });
  const grouped = await programRepo
    .createQueryBuilder("program")
    .select("program.level", "level")
    .addSelect("program.publicDisplayStatus", "status")
    .addSelect("COUNT(*)", "count")
    .where("program.universityId = :id", { id: upm.id })
    .groupBy("program.level")
    .addGroupBy("program.publicDisplayStatus")
    .orderBy("program.level")
    .addOrderBy("program.publicDisplayStatus")
    .getRawMany();
  const missing = await programRepo
    .createQueryBuilder("program")
    .select("SUM(CASE WHEN program.officialSourceUrl = '' THEN 1 ELSE 0 END)", "missingSource")
    .addSelect("SUM(CASE WHEN program.officialFeeSourceUrl = '' THEN 1 ELSE 0 END)", "missingFeeSource")
    .addSelect("SUM(CASE WHEN program.officialIntake = '' THEN 1 ELSE 0 END)", "missingIntake")
    .addSelect("SUM(CASE WHEN program.officialTuitionMYR IS NULL THEN 1 ELSE 0 END)", "missingTuition")
    .where("program.universityId = :id", { id: upm.id })
    .getRawOne();

  console.log(JSON.stringify({ universityId: upm.id, programCount: upm.programCount, grouped, missing }, null, 2));
  await dataSource.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
