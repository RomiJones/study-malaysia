import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, Not, type DeepPartial, type EntityManager } from "typeorm";
import type {
  FeeAuditStatus,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  OfficialSourceStatus,
  ProgramCategoryCode,
  PublicDisplayStatus
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

export const UTM_UNDERGRADUATE_IMPORT_SLUG_PREFIX = "utm-ug-official-2026-row-";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const DEFAULT_UTM_UNDERGRADUATE_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/utm/2026-06-16/undergraduate/candidate-dataset.json"
);
const verifiedAt = "2026-06-17";
const cnyPerMyr = 1.55;

type UTMCurrentCycleStatus =
  | "ready-for-detail-enrichment"
  | "current-cycle-not-open"
  | "international-unavailable-current-cycle";

export interface UTMProgrammeCandidate {
  ordinal: number;
  nameEnOfficial: string;
  facultyEn: string;
  intakeText: string;
  intakeMonths: string[];
  applicationStatus: string;
  detailUrl: string;
  applicationUrl: string;
  slug: string;
  level: "bachelor";
  applicantScope: "international";
  canonicalDecision: {
    isCanonicalProgramme: boolean;
    currentCycleStatus: UTMCurrentCycleStatus;
    campuses: string[];
    pdfSourcePages?: number[];
  };
  tuition: {
    feeCategory: string;
    semester1MYR: number;
    semester2To8MYR: number;
    totalTuitionMYR: number;
    sourceRole: string;
  };
  generalRequirements: {
    academicRequirementSummary: string;
    languageRequirementStatus: string;
    countryRequirementStatus: string;
    healthRequirementStatus: string;
  };
  languageRequirements: {
    status: string;
    sourceText: string;
    scores: {
      MUET?: number;
      IELTS?: number;
      TOEFL_iBT?: number;
      PTE_Academic?: number;
      Cambridge_Linguaskill?: number;
      ELS_CIEP?: number;
    };
  };
  sourceUrls: Record<string, string>;
  fieldCoverage: Record<string, string>;
  programmeDetail?: {
    status: string;
    sourceUrl?: string;
    sourcePath?: string;
    officialDetailTitle?: string;
    overviewText?: string | null;
    duration?: {
      status: string;
      officialText?: string;
      semesters?: number;
      minYears?: number;
      maxYears?: number;
      sourceId?: string;
      sourceUrl?: string;
      sourcePath?: string;
    };
    supplementalDurationEvidence?: {
      sourceId: string;
      sourceUrl: string;
      sourcePath?: string;
      sourceRole: string;
    };
    studyMode?: string;
    languageOfInstruction?: string;
    mqaCodes?: string[];
    accreditation?: string[];
    entryRequirementText?: string | null;
    curriculumText?: string | null;
    careerText?: string | null;
    evidenceText?: string | null;
  };
}

export interface UTMCandidateDataset {
  universityCode: "UTM";
  institutionNameOfficial: string;
  level: "bachelor";
  applicantScope: "international";
  academicSession: string;
  officialDomains: string[];
  programmeCount: number;
  programmes: UTMProgrammeCandidate[];
}

interface UTMImportSummary {
  candidateRows: number;
  readyRows: number;
  currentCycleNotOpenRows: number;
  unavailableCurrentCycleRows: number;
  importRows: number;
  uniqueSlugs: number;
  officialTotalFeeRows: number;
  officialDurationRows: number;
  detailParsedRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UTMImportVerification {
  importedRows: number;
  readyRows: number;
  currentCycleNotOpenRows: number;
  publishedRows: number;
  notAvailableForInternationalRows: number;
  legacyBachelorPublicRows: number;
  officialTotalFeeRows: number;
  officialDurationRows: number;
  levelRows: number;
  languageRows: number;
  sourceLinkedRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

const t = (en: string, zhCN = en, zhTW = zhCN, ms = en): LocalizedText => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], zhCN = en, zhTW = zhCN, ms = en): LocalizedStringArray => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

type LocalizedArraySeed = {
  en: string[];
  zhCN: string[];
  zhTW?: string[];
  ms?: string[];
};

const traditionalCharacterMap = Object.fromEntries(
  [
    ["学", "學"], ["课", "課"], ["设", "設"], ["习", "習"], ["与", "與"], ["业", "業"], ["专", "專"],
    ["业", "業"], ["职", "職"], ["程", "程"], ["项", "項"], ["实", "實"], ["践", "踐"], ["训", "訓"],
    ["计", "計"], ["划", "劃"], ["筑", "築"], ["构", "構"], ["测", "測"], ["绘", "繪"], ["术", "術"],
    ["电", "電"], ["脑", "腦"], ["软", "軟"], ["网", "網"], ["络", "絡"], ["发", "發"], ["开", "開"],
    ["数", "數"], ["据", "據"], ["质", "質"], ["量", "量"], ["营", "營"], ["销", "銷"], ["会", "會"],
    ["审", "審"], ["计", "計"], ["务", "務"], ["税", "稅"], ["顾", "顧"], ["问", "問"], ["险", "險"],
    ["经", "經"], ["济", "濟"], ["产", "產"], ["动", "動"], ["类", "類"], ["应", "應"], ["用", "用"],
    ["医", "醫"], ["疗", "療"], ["创", "創"], ["导", "導"], ["际", "際"], ["机", "機"], ["械", "械"],
    ["说", "說"], ["该", "該"], ["论", "論"], ["咨", "諮"], ["询", "詢"],
    ["环", "環"], ["境", "境"], ["处", "處"], ["业", "業"], ["变", "變"], ["资", "資"], ["源", "源"],
    ["开", "開"], ["发", "發"], ["马", "馬"], ["来", "來"], ["亚", "亞"], ["国", "國"], ["际", "際"]
  ] as Array<[string, string]>
);

function toTraditional(value: string) {
  return Array.from(value).map((char) => traditionalCharacterMap[char] || char).join("");
}

function localizedArray(seed: LocalizedArraySeed | undefined): LocalizedStringArray {
  if (!seed) return arr([]);
  return arr(seed.en, seed.zhCN, seed.zhTW || seed.zhCN.map(toTraditional), seed.ms || seed.en);
}

const undergraduateInterviewProgrammeNames = new Set([
  "Bachelor of Science in Architecture with Honours",
  "Bachelor of Science with Honours (Industrial Design)"
]);

function requiresUtmUndergraduateInterview(candidate: UTMProgrammeCandidate): boolean {
  return undergraduateInterviewProgrammeNames.has(candidate.nameEnOfficial);
}

function undergraduateAcademicRequirementText(candidate: UTMProgrammeCandidate): string {
  const base = "A Senior High School Certificate or equivalent pre-university qualifications; and Pass the English Proficiency requirements.";
  if (!requiresUtmUndergraduateInterview(candidate)) return base;
  return `${base} Pass the UTM interview, as required for Bachelor of Architecture and Bachelor of Science Industrial Design.`;
}

function undergraduateSpecialRequirementsNote(candidate: UTMProgrammeCandidate): string | null {
  return requiresUtmUndergraduateInterview(candidate)
    ? "Interview required: UTM undergraduate entry requirements state that Bachelor of Architecture and Bachelor of Science Industrial Design must pass the UTM interview."
    : null;
}

const facultyTranslations: Record<string, LocalizedText> = {
  "Faculty of Artificial Intelligence": t("Faculty of Artificial Intelligence", "人工智能学院", "人工智慧學院", "Fakulti Kecerdasan Buatan"),
  "Faculty of Built Environment and Surveying": t(
    "Faculty of Built Environment and Surveying",
    "建成环境与测量学院",
    "建成環境與測量學院",
    "Fakulti Alam Bina dan Ukur"
  ),
  "Faculty of Chemical and Energy Engineering": t(
    "Faculty of Chemical and Energy Engineering",
    "化学与能源工程学院",
    "化學與能源工程學院",
    "Fakulti Kejuruteraan Kimia dan Tenaga"
  ),
  "Faculty of Civil Engineering": t("Faculty of Civil Engineering", "土木工程学院", "土木工程學院", "Fakulti Kejuruteraan Awam"),
  "Faculty of Computing": t("Faculty of Computing", "计算机学院", "電腦學院", "Fakulti Komputeran"),
  "Faculty of Electrical Engineering": t("Faculty of Electrical Engineering", "电气工程学院", "電機工程學院", "Fakulti Kejuruteraan Elektrik"),
  "Faculty of Mechanical Engineering": t("Faculty of Mechanical Engineering", "机械工程学院", "機械工程學院", "Fakulti Kejuruteraan Mekanikal"),
  "Faculty of Management": t("Faculty of Management", "管理学院", "管理學院", "Fakulti Pengurusan"),
  "Faculty of Science": t("Faculty of Science", "理学院", "理學院", "Fakulti Sains"),
  "Faculty of Social Science and Humanities": t("Faculty of Social Science and Humanities", "社会科学与人文学院", "社會科學與人文學院", "Fakulti Sains Sosial dan Kemanusiaan"),
  "Malaysia-Japan International Institute of Technology": t(
    "Malaysia-Japan International Institute of Technology",
    "马来西亚-日本国际技术学院",
    "馬來西亞-日本國際技術學院",
    "Institut Teknologi Antarabangsa Malaysia-Jepun"
  )
};

const programmeNameTranslations: Record<string, { zhCN: string; zhTW: string }> = {
  "Bachelor of Biomedical Engineering with Honours": { zhCN: "生物医学工程荣誉学士", zhTW: "生物醫學工程榮譽學士" },
  "Bachelor of Chemical Engineering with Honours": { zhCN: "化学工程荣誉学士", zhTW: "化學工程榮譽學士" },
  "Bachelor of Nuclear Engineering with Honours": { zhCN: "核工程荣誉学士", zhTW: "核工程榮譽學士" },
  "Bachelor of Chemical Engineering (Bioprocess) with Honours": { zhCN: "化学工程（生物过程）荣誉学士", zhTW: "化學工程（生物製程）榮譽學士" },
  "Bachelor of Chemical Engineering (Gas) with Honours": { zhCN: "化学工程（气体）荣誉学士", zhTW: "化學工程（氣體）榮譽學士" },
  "Bachelor of Petroleum Engineering with Honours": { zhCN: "石油工程荣誉学士", zhTW: "石油工程榮譽學士" },
  "Bachelor of Civil Engineering with Honours": { zhCN: "土木工程荣誉学士", zhTW: "土木工程榮譽學士" },
  "Bachelor in Software Engineering with Honours": { zhCN: "软件工程荣誉学士", zhTW: "軟體工程榮譽學士" },
  "Bachelor of Computer Science (Computer Networks and Security) with Honours": {
    zhCN: "计算机科学（计算机网络与安全）荣誉学士",
    zhTW: "電腦科學（電腦網路與安全）榮譽學士"
  },
  "Bachelor of Computer Science (Graphics and Multimedia Software) with Honours": {
    zhCN: "计算机科学（图形与多媒体软件）荣誉学士",
    zhTW: "電腦科學（圖形與多媒體軟體）榮譽學士"
  },
  "Bachelor of Electronic Engineering with Honours": { zhCN: "电子工程荣誉学士", zhTW: "電子工程榮譽學士" },
  "Bachelor of Electrical Engineering with Honours": { zhCN: "电气工程荣誉学士", zhTW: "電機工程榮譽學士" },
  "Bachelor of Engineering (Electrical-Mechatronics) with Honours": { zhCN: "工程（电气-机电一体化）荣誉学士", zhTW: "工程（電機-機電整合）榮譽學士" },
  "Bachelor of Mechanical Engineering with Honours": { zhCN: "机械工程荣誉学士", zhTW: "機械工程榮譽學士" },
  "Bachelor of Mechanical Engineering (Manufacturing) with Honours": { zhCN: "机械工程（制造）荣誉学士", zhTW: "機械工程（製造）榮譽學士" },
  "Bachelor of Naval Architecture & Offshore Engineering with Honours": { zhCN: "船舶建筑与海洋工程荣誉学士", zhTW: "船舶建築與海洋工程榮譽學士" },
  "Bachelor of Mechanical Engineering (Aeronautics) with Honours": { zhCN: "机械工程（航空）荣誉学士", zhTW: "機械工程（航空）榮譽學士" },
  "Bachelor of Science in Architecture with Honours": { zhCN: "建筑科学荣誉学士", zhTW: "建築科學榮譽學士" },
  "Bachelor of Quantity Surveying with Honours": { zhCN: "工料测量荣誉学士", zhTW: "工料測量榮譽學士" },
  "Bachelor of Science in Construction with Honours": { zhCN: "建造科学荣誉学士", zhTW: "建造科學榮譽學士" },
  "Bachelor of Urban and Regional Planning with Honours": { zhCN: "城市与区域规划荣誉学士", zhTW: "城市與區域規劃榮譽學士" },
  "Bachelor of Landscape Architecture with Honours": { zhCN: "景观建筑荣誉学士", zhTW: "景觀建築榮譽學士" },
  "Bachelor of Geomatics Engineering with Honours": { zhCN: "测绘工程荣誉学士", zhTW: "測繪工程榮譽學士" },
  "Bachelor of Science in Geoinformatics with Honours": { zhCN: "地理信息科学荣誉学士", zhTW: "地理資訊科學榮譽學士" },
  "Bachelor of Science in Land Administration and Development with Honours": { zhCN: "土地行政与发展科学荣誉学士", zhTW: "土地行政與發展科學榮譽學士" },
  "Bachelor of Real Estate with Honours": { zhCN: "房地产荣誉学士", zhTW: "房地產榮譽學士" },
  "Bachelor in Accounting with Honours": { zhCN: "会计荣誉学士", zhTW: "會計榮譽學士" },
  "Bachelor in Digital Marketing with Honours": { zhCN: "数字营销荣誉学士", zhTW: "數位行銷榮譽學士" },
  "Bachelor of Management with Honours": { zhCN: "管理荣誉学士", zhTW: "管理榮譽學士" },
  "Bachelor in Artificial Intelligence with Honours": { zhCN: "人工智能荣誉学士", zhTW: "人工智慧榮譽學士" },
  "Bachelor of Science (Physics) with Honours": { zhCN: "物理科学荣誉学士", zhTW: "物理科學榮譽學士" },
  "Bachelor of Science (Industrial Physics) with Honours": { zhCN: "工业物理科学荣誉学士", zhTW: "工業物理科學榮譽學士" },
  "Bachelor of Science (Chemistry) with Honours": { zhCN: "化学科学荣誉学士", zhTW: "化學科學榮譽學士" },
  "Bachelor of Science (Industrial Chemistry) with Honours": { zhCN: "工业化学科学荣誉学士", zhTW: "工業化學科學榮譽學士" },
  "Bachelor of Science (Mathematics) with Honours": { zhCN: "数学科学荣誉学士", zhTW: "數學科學榮譽學士" },
  "Bachelor of Science (Industrial Mathematics) with Honours": { zhCN: "工业数学科学荣誉学士", zhTW: "工業數學科學榮譽學士" },
  "Bachelor of Science (Biology) with Honours": { zhCN: "生物科学荣誉学士", zhTW: "生物科學榮譽學士" },
  "Bachelor of Science in Biotechnology with Honours": { zhCN: "生物技术科学荣誉学士", zhTW: "生物技術科學榮譽學士" },
  "Bachelor in Human Resource Development with Honours": { zhCN: "人力资源发展荣誉学士", zhTW: "人力資源發展榮譽學士" },
  "Bachelor of Psychology with Human Resource Development with Honours": { zhCN: "心理学与人力资源发展荣誉学士", zhTW: "心理學與人力資源發展榮譽學士" },
  "Bachelor of Science with Honours (Industrial Design)": { zhCN: "工业设计科学荣誉学士", zhTW: "工業設計科學榮譽學士" },
  "Bachelor of Electronic Systems Engineering with Honours": { zhCN: "电子系统工程荣誉学士", zhTW: "電子系統工程榮譽學士" },
  "Bachelor of Mechanical Precision Engineering with Honours": { zhCN: "机械精密工程荣誉学士", zhTW: "機械精密工程榮譽學士" },
  "Bachelor of Chemical Process Engineering with Honours": { zhCN: "化学过程工程荣誉学士", zhTW: "化學製程工程榮譽學士" }
};

const undergraduateCourseSettingItems: Record<string, LocalizedArraySeed> = {
  "Bachelor of Biomedical Engineering with Honours": {
    en: [
      "Official course menu includes Introduction to Biomedical Engineering, Human Anatomy and Physiology, Electrical Circuit Analysis, Digital Electronic Systems, Engineering Mathematics I and C Programming for Engineers.",
      "Year 2-3 courses include Signals and Systems, Solid Mechanics, Microprocessor, Biomedical Materials, Clinical Engineering I/II, Biomedical Communications, Biomedical Imaging, Biomedical Signal Processing, Instrumentation and Measurement in Biomedical, Integrated Design Project and Industrial Training.",
      "Year 4 and electives include Engineering Management Principles, Methodology of Research and Development, Biochemistry for Biomedical Engineers, Biomedical Artificial Intelligence, Biomedical Image Processing, Biomedical Devices, Cell and Tissue Engineering, Rehabilitation Engineering, Bio-Fabrication, Biosensor and Transducers."
    ],
    zhCN: [
      "官方课程表包括：生物医学工程导论（Introduction to Biomedical Engineering）、人体解剖与生理学（Human Anatomy and Physiology）、电路分析（Electrical Circuit Analysis）、数字电子系统（Digital Electronic Systems）、工程数学 I（Engineering Mathematics I）和工程师 C 编程（C Programming for Engineers）。",
      "二至三年级课程包括：信号与系统（Signals and Systems）、固体力学（Solid Mechanics）、微处理器（Microprocessor）、生物医学材料（Biomedical Materials）、临床工程 I/II（Clinical Engineering I/II）、生物医学通信（Biomedical Communications）、生物医学成像（Biomedical Imaging）、生物医学信号处理（Biomedical Signal Processing）、生物医学仪器与测量（Instrumentation and Measurement in Biomedical）、综合设计项目（Integrated Design Project）和工业训练（Industrial Training）。",
      "四年级及选修课程包括：工程管理原理（Engineering Management Principles）、研究与开发方法论（Methodology of Research and Development）、生物医学工程师生物化学（Biochemistry for Biomedical Engineers）、生物医学人工智能（Biomedical Artificial Intelligence）、生物医学图像处理（Biomedical Image Processing）、生物医学设备（Biomedical Devices）、细胞与组织工程（Cell and Tissue Engineering）、康复工程（Rehabilitation Engineering）、生物制造（Bio-Fabrication）、生物传感器与换能器（Biosensor and Transducers）。"
    ]
  },
  "Bachelor of Chemical Engineering with Honours": {
    en: [
      "Official FKT course menu includes Engineering Drawings, Statics and Mechanics of Material, Industrial Seminar and Profession, Introduction to Engineering, Introduction to Computer Programming, Engineering Mathematics I/II, Mass Balance, Materials Science for Engineers and Thermodynamics.",
      "Middle-year courses include Energy Balance, Fluid Mechanics, Chemical Engineering Simulation, Chemical Engineering Thermodynamics, Chemical Reaction Engineering, Heat and Mass Transfer, Numerical Method and Optimization, Analytical Chemistry for Engineering and Separation Processes.",
      "Advanced courses include Process Control and Instrumentation, Unit Operation and Industrial Processes, Environmental Engineering and Sustainability, Process Design, Occupational Safety and Health in Industry, Plant Design, Plant Design Project I/II, Final Year Project I/II and Industrial Training."
    ],
    zhCN: [
      "FKT 官方课程表包括：工程制图（Engineering Drawings）、静力学与材料力学（Statics and Mechanics of Material）、工业研讨与专业实践（Industrial Seminar and Profession）、工程导论（Introduction to Engineering）、计算机编程导论（Introduction to Computer Programming）、工程数学 I/II（Engineering Mathematics I/II）、质量衡算（Mass Balance）、工程师材料科学（Materials Science for Engineers）和热力学（Thermodynamics）。",
      "中期课程包括：能量衡算（Energy Balance）、流体力学（Fluid Mechanics）、化学工程模拟（Chemical Engineering Simulation）、化学工程热力学（Chemical Engineering Thermodynamics）、化学反应工程（Chemical Reaction Engineering）、热与质传递（Heat and Mass Transfer）、数值方法与优化（Numerical Method and Optimization）、工程分析化学（Analytical Chemistry for Engineering）和分离过程（Separation Processes）。",
      "高年级课程包括：过程控制与仪表（Process Control and Instrumentation）、单元操作与工业过程（Unit Operation and Industrial Processes）、环境工程与可持续性（Environmental Engineering and Sustainability）、过程设计（Process Design）、工业职业安全与健康（Occupational Safety and Health in Industry）、工厂设计（Plant Design）、工厂设计项目 I/II（Plant Design Project I/II）、最终年项目 I/II（Final Year Project I/II）和工业训练（Industrial Training）。"
    ]
  },
  "Bachelor of Chemical Engineering (Bioprocess) with Honours": {
    en: [
      "Official FKT course menu includes Microbiology for Engineers, Engineering Drawing, Introduction to Chemical and Bioprocess Engineering, Statics and Biomaterials, Engineering Mathematics I/II, Mass Balance, Thermodynamics, Fundamental of Electrical Technology and Organic Chemistry and Analytical Chemistry for Engineers.",
      "Middle-year courses include Programming and Robotics for Bioprocess Engineering, Energy Balance, Fluid Mechanics, Biochemistry and Bioinformatics, Chemical Engineering Computation, Chemical Engineering Thermodynamics, Mass and Heat Transfer, Bioengineering Molecular Systems and Chemical Reaction Engineering.",
      "Advanced courses include Bioreactor Design and Analysis, Bioprocess Engineering Laboratory: Upstream/Downstream, Bioseparation Technology, Plant Design, Plant Design Project, Quality Management in Biomanufacturing, Industrial and Career Seminar and Industrial Training.",
      "Bioprocess electives include Food Process Engineering, Environmental Biotechnology for Engineers, Bioproduct Development and Processing, Biopharmaceutical Engineering, Green Energy Engineering, Tissue Culture and Cell Engineering and Science and Engineering of Biopolymer."
    ],
    zhCN: [
      "FKT 官方课程表包括：工程师微生物学（Microbiology for Engineers）、工程制图（Engineering Drawing）、化学与生物过程工程导论（Introduction to Chemical and Bioprocess Engineering）、静力学与生物材料（Statics and Biomaterials）、工程数学 I/II（Engineering Mathematics I/II）、质量衡算（Mass Balance）、热力学（Thermodynamics）、电气技术基础（Fundamental of Electrical Technology）以及工程师有机化学与分析化学（Organic Chemistry and Analytical Chemistry for Engineers）。",
      "中期课程包括：生物过程工程编程与机器人（Programming and Robotics for Bioprocess Engineering）、能量衡算（Energy Balance）、流体力学（Fluid Mechanics）、生物化学与生物信息学（Biochemistry and Bioinformatics）、化学工程计算（Chemical Engineering Computation）、化学工程热力学（Chemical Engineering Thermodynamics）、质热传递（Mass and Heat Transfer）、生物工程分子系统（Bioengineering Molecular Systems）和化学反应工程（Chemical Reaction Engineering）。",
      "高年级课程包括：生物反应器设计与分析（Bioreactor Design and Analysis）、生物过程工程实验室：上游/下游（Bioprocess Engineering Laboratory: Upstream/Downstream）、生物分离技术（Bioseparation Technology）、工厂设计（Plant Design）、工厂设计项目（Plant Design Project）、生物制造质量管理（Quality Management in Biomanufacturing）、工业与职业研讨（Industrial and Career Seminar）和工业训练（Industrial Training）。",
      "生物过程选修课程包括：食品过程工程（Food Process Engineering）、工程师环境生物技术（Environmental Biotechnology for Engineers）、生物产品开发与加工（Bioproduct Development and Processing）、生物制药工程（Biopharmaceutical Engineering）、绿色能源工程（Green Energy Engineering）、组织培养与细胞工程（Tissue Culture and Cell Engineering）以及生物聚合物科学与工程（Science and Engineering of Biopolymer）。"
    ]
  },
  "Bachelor of Chemical Engineering (Gas) with Honours": {
    en: [
      "Official FKT course menu includes Introduction to Chemical and Gas Engineering, Engineering Mechanics, Fundamental of Electrical Technology, Organic and Analytical Chemistry for Engineers, Engineering Mathematics I/II, Engineering Drawing, Thermodynamics, Mass Balance and Mechanics of Materials.",
      "Middle-year courses include Combustion Engineering and Gas Utilisation, Fluid Mechanics, Energy Balance, Chemical Engineering Thermodynamics, Simulation and Programming, Mass and Heat Transfer, Environmental Engineering and Sustainability, Gas Storage System and Asset Integrity, Chemical Engineering Computation and Chemical Reaction Engineering.",
      "Advanced courses include Gas Pipeline System, Process Control and Instrumentation, Safety and Health in Chemical and Related Industries, Pollution Control and Chemical Reaction Engineering Laboratory, Gas Production, Processing and Liquefaction, Plant Design, Gas Flow System Laboratory, Safety Instrumented Systems, Gas Engineering Seminar and Industrial Training."
    ],
    zhCN: [
      "FKT 官方课程表包括：化学与燃气工程导论（Introduction to Chemical and Gas Engineering）、工程力学（Engineering Mechanics）、电气技术基础（Fundamental of Electrical Technology）、工程师有机与分析化学（Organic and Analytical Chemistry for Engineers）、工程数学 I/II（Engineering Mathematics I/II）、工程制图（Engineering Drawing）、热力学（Thermodynamics）、质量衡算（Mass Balance）和材料力学（Mechanics of Materials）。",
      "中期课程包括：燃烧工程与燃气利用（Combustion Engineering and Gas Utilisation）、流体力学（Fluid Mechanics）、能量衡算（Energy Balance）、化学工程热力学（Chemical Engineering Thermodynamics）、模拟与编程（Simulation and Programming）、质热传递（Mass and Heat Transfer）、环境工程与可持续性（Environmental Engineering and Sustainability）、燃气储存系统与资产完整性（Gas Storage System and Asset Integrity）、化学工程计算（Chemical Engineering Computation）和化学反应工程（Chemical Reaction Engineering）。",
      "高年级课程包括：燃气管道系统（Gas Pipeline System）、过程控制与仪表（Process Control and Instrumentation）、化学及相关行业安全与健康（Safety and Health in Chemical and Related Industries）、污染控制与化学反应工程实验室（Pollution Control and Chemical Reaction Engineering Laboratory）、燃气生产、处理与液化（Gas Production, Processing and Liquefaction）、工厂设计（Plant Design）、燃气流动系统实验室（Gas Flow System Laboratory）、安全仪表系统（Safety Instrumented Systems）、燃气工程研讨（Gas Engineering Seminar）和工业训练（Industrial Training）。"
    ]
  },
  "Bachelor of Nuclear Engineering with Honours": {
    en: [
      "Official FKT course menu includes Introduction to Engineering, Nuclear Physics, Engineering Drawing, Engineering Mechanics, Engineering Mathematics I/II, Electrical Engineering Fundamentals with Laboratory, Nuclear Engineering Fundamentals, Thermodynamics and Fluid Mechanics.",
      "Middle-year courses include Radiation Detection and Measurement, Programming for Engineers, Heat Transfer, Mechanics of Materials, Instrumentation and Control Engineering, Numerical Methods for Nuclear Engineers, Nuclear Engineering Laboratory, Engineering Economics and Project Management and Engineering Statistics.",
      "Advanced courses include Nuclear Reactor Theory, Nuclear Fuel Cycle and Waste Management, Nuclear Radiation Protection, Thermal Hydraulics, Nuclear Engineering System and Design, Nuclear Safety, Safeguard, Security and Regulation, Nuclear Engineering Materials, Radiation Technology and Application, Artificial Intelligence Application in Nuclear Engineering, Energy and Power Plant System and Radiographic Testing.",
      "Electives include Ultrasonic Testing, Chemistry in Nuclear Engineering and Radiation Application in Medicine."
    ],
    zhCN: [
      "FKT 官方课程表包括：工程导论（Introduction to Engineering）、核物理（Nuclear Physics）、工程制图（Engineering Drawing）、工程力学（Engineering Mechanics）、工程数学 I/II（Engineering Mathematics I/II）、电气工程基础及实验室（Electrical Engineering Fundamentals with Laboratory）、核工程基础（Nuclear Engineering Fundamentals）、热力学（Thermodynamics）和流体力学（Fluid Mechanics）。",
      "中期课程包括：辐射探测与测量（Radiation Detection and Measurement）、工程师编程（Programming for Engineers）、传热（Heat Transfer）、材料力学（Mechanics of Materials）、仪表与控制工程（Instrumentation and Control Engineering）、核工程数值方法（Numerical Methods for Nuclear Engineers）、核工程实验室（Nuclear Engineering Laboratory）、工程经济与项目管理（Engineering Economics and Project Management）和工程统计（Engineering Statistics）。",
      "高年级课程包括：核反应堆理论（Nuclear Reactor Theory）、核燃料循环与废物管理（Nuclear Fuel Cycle and Waste Management）、核辐射防护（Nuclear Radiation Protection）、热工水力学（Thermal Hydraulics）、核工程系统与设计（Nuclear Engineering System and Design）、核安全、保障、安保与法规（Nuclear Safety, Safeguard, Security and Regulation）、核工程材料（Nuclear Engineering Materials）、辐射技术与应用（Radiation Technology and Application）、核工程人工智能应用（Artificial Intelligence Application in Nuclear Engineering）、能源与电厂系统（Energy and Power Plant System）和射线检测（Radiographic Testing）。",
      "选修课程包括：超声检测（Ultrasonic Testing）、核工程化学（Chemistry in Nuclear Engineering）和医学辐射应用（Radiation Application in Medicine）。"
    ]
  },
  "Bachelor of Petroleum Engineering with Honours": {
    en: [
      "Official FKT course menu includes Engineering Mathematics, Programming Technique, Introduction to Petroleum Engineering, Engineering Mechanics, Thermodynamics, Analytical Chemistry for Engineers, Electrical Technology, Fluid Mechanics, Mechanics of Material, Engineering Drawing and Basic Geoscience.",
      "Middle-year courses include Reservoir Rock and Fluids Properties, Formation Evaluation, Petroleum Geology, Health, Safety, and Environment in Petroleum Engineering, Drilling Engineering, Drilling Fluid Analysis Laboratory, Reservoir Engineering, Reservoir Analysis Laboratory, Geology Field Work and Petroleum Production Engineering.",
      "Advanced courses include Well Completion, Well Test Analysis, Gas Engineering, Research Methodology, Reservoir Simulation, Secondary and Tertiary Oil Recovery, Petroleum Economic and Project Evaluation, Petroleum Seminar, Field Development Project and Industrial Training.",
      "Petroleum electives include Petroleum Refining Technology, Geophysics, Advanced Drilling Engineering, Advanced Well Completion and Well Diagnosis and Treatment."
    ],
    zhCN: [
      "FKT 官方课程表包括：工程数学（Engineering Mathematics）、编程技术（Programming Technique）、石油工程导论（Introduction to Petroleum Engineering）、工程力学（Engineering Mechanics）、热力学（Thermodynamics）、工程师分析化学（Analytical Chemistry for Engineers）、电气技术（Electrical Technology）、流体力学（Fluid Mechanics）、材料力学（Mechanics of Material）、工程制图（Engineering Drawing）和基础地球科学（Basic Geoscience）。",
      "中期课程包括：储层岩石与流体性质（Reservoir Rock and Fluids Properties）、地层评价（Formation Evaluation）、石油地质（Petroleum Geology）、石油工程健康、安全与环境（Health, Safety, and Environment in Petroleum Engineering）、钻井工程（Drilling Engineering）、钻井液分析实验室（Drilling Fluid Analysis Laboratory）、油藏工程（Reservoir Engineering）、油藏分析实验室（Reservoir Analysis Laboratory）、地质野外实习（Geology Field Work）和石油生产工程（Petroleum Production Engineering）。",
      "高年级课程包括：完井（Well Completion）、试井分析（Well Test Analysis）、燃气工程（Gas Engineering）、研究方法论（Research Methodology）、油藏模拟（Reservoir Simulation）、二次与三次采油（Secondary and Tertiary Oil Recovery）、石油经济与项目评估（Petroleum Economic and Project Evaluation）、石油研讨（Petroleum Seminar）、油田开发项目（Field Development Project）和工业训练（Industrial Training）。",
      "石油工程选修课程包括：石油炼制技术（Petroleum Refining Technology）、地球物理（Geophysics）、高级钻井工程（Advanced Drilling Engineering）、高级完井（Advanced Well Completion）和井诊断与处理（Well Diagnosis and Treatment）。"
    ]
  },
  "Bachelor of Computer Science (Graphics and Multimedia Software) with Honours": {
    en: [
      "The programme is delivered full-time across two-semester academic years with courses delivered and assessed each semester.",
      "Assessment combines 30-50% examination and 50-70% coursework.",
      "Graduation requires 130 credit hours, industrial training and final-year projects with dissertation."
    ],
    zhCN: [
      "课程以全日制方式按两学期制学年开展，每学期安排课程学习与考核。",
      "考核由 30%-50% 考试和 50%-70% 课程作业组成。",
      "毕业要求包括完成 130 学分、工业训练以及含论文的最终年项目。"
    ]
  },
  "Bachelor of Electrical Engineering with Honours": {
    en: [
      "Official SKEEH study plan includes Engineering Mathematics I/II, Introduction to Electrical Engineering, Electrical Circuit Analysis, Scientific Programming, Digital Electronic Systems, C Programming for Engineers, Electronic Devices and Circuits, Electronic Instrumentation and Measurement and Signal and Systems.",
      "Middle-year courses include Microprocessor, Principles of Electrical Power Systems, Electronic Design Laboratory, Electromagnetic Field Theory, System Modelling and Analysis, Electrical Machines, Control System Design, Communication Principles and Power System Analysis.",
      "Advanced courses include Common Third Year Laboratory, Specialized Third Year Laboratory, Integrated Design Project, Power Electronic and Drives, Power System Protection, High Voltage Technology, Electrical Energy Utilization, Methodology of Research and Development, Professional Engineering Practice, Final Year Project and Industrial Training."
    ],
    zhCN: [
      "SKEEH 官方学习计划包括：工程数学 I/II（Engineering Mathematics I/II）、电气工程导论（Introduction to Electrical Engineering）、电路分析（Electrical Circuit Analysis）、科学编程（Scientific Programming）、数字电子系统（Digital Electronic Systems）、工程师 C 编程（C Programming for Engineers）、电子器件与电路（Electronic Devices and Circuits）、电子仪表与测量（Electronic Instrumentation and Measurement）以及信号与系统（Signal and Systems）。",
      "中期课程包括：微处理器（Microprocessor）、电力系统原理（Principles of Electrical Power Systems）、电子设计实验室（Electronic Design Laboratory）、电磁场理论（Electromagnetic Field Theory）、系统建模与分析（System Modelling and Analysis）、电机（Electrical Machines）、控制系统设计（Control System Design）、通信原理（Communication Principles）和电力系统分析（Power System Analysis）。",
      "高年级课程包括：三年级通用实验室（Common Third Year Laboratory）、三年级专项实验室（Specialized Third Year Laboratory）、综合设计项目（Integrated Design Project）、电力电子与驱动（Power Electronic and Drives）、电力系统保护（Power System Protection）、高电压技术（High Voltage Technology）、电能利用（Electrical Energy Utilization）、研究与开发方法论（Methodology of Research and Development）、专业工程实践（Professional Engineering Practice）、最终年项目（Final Year Project）和工业训练（Industrial Training）。"
    ]
  },
  "Bachelor of Electronic Engineering with Honours": {
    en: [
      "Official SKELH course menu includes Introduction to Electrical Engineering, Electrical Circuit Analysis, Scientific Programming, Digital Electronic Systems, C Programming for Engineers, Electronic Devices and Circuits, Electronic Instrumentation and Measurement and Engineering Mathematics.",
      "Middle-year courses include Signals and Systems, Microprocessor, Principles of Electrical Power Systems, Electronic Systems, Electronic Design Laboratory, Electromagnetic Field Theory, System Modelling and Analysis, Digital Signal Processing and Control System Design.",
      "Advanced courses include Communication Principles, Common Third Year Laboratory, Integrated Design Project, RTL Design, Specialized Third Year Laboratory, Engineering Management Principles, Methodology of Research and Development, Professional Engineering Practice, Final Year Project, field electives and Industrial Training."
    ],
    zhCN: [
      "SKELH 官方课程表包括：电气工程导论（Introduction to Electrical Engineering）、电路分析（Electrical Circuit Analysis）、科学编程（Scientific Programming）、数字电子系统（Digital Electronic Systems）、工程师 C 编程（C Programming for Engineers）、电子器件与电路（Electronic Devices and Circuits）、电子仪表与测量（Electronic Instrumentation and Measurement）和工程数学（Engineering Mathematics）。",
      "中期课程包括：信号与系统（Signals and Systems）、微处理器（Microprocessor）、电力系统原理（Principles of Electrical Power Systems）、电子系统（Electronic Systems）、电子设计实验室（Electronic Design Laboratory）、电磁场理论（Electromagnetic Field Theory）、系统建模与分析（System Modelling and Analysis）、数字信号处理（Digital Signal Processing）和控制系统设计（Control System Design）。",
      "高年级课程包括：通信原理（Communication Principles）、三年级通用实验室（Common Third Year Laboratory）、综合设计项目（Integrated Design Project）、RTL 设计（RTL Design）、三年级专项实验室（Specialized Third Year Laboratory）、工程管理原理（Engineering Management Principles）、研究与开发方法论（Methodology of Research and Development）、专业工程实践（Professional Engineering Practice）、最终年项目（Final Year Project）、领域选修课和工业训练（Industrial Training）。"
    ]
  },
  "Bachelor of Engineering (Electrical-Mechatronics) with Honours": {
    en: [
      "Official SKEMH study plan includes Introduction to Electrical Engineering, Electrical Circuit Analysis, Scientific Programming, Digital Electronic Systems, Engineering Mechanics, C Programming for Engineers, Electronic Devices and Circuits and Computer Aided Engineering Design.",
      "Middle-year courses include Signals and Systems, Electronic Instrumentation and Measurement, Principles of Electrical Power Systems, Electronic Design Laboratory, Microprocessor, Electromagnetic Field Theory, Numerical Methods, Mechanics of Materials and Mechanical System Design.",
      "Advanced courses include System Modeling and Analysis, Communication Principles, Electronic Systems, Control System Design, Electrical Motors and Drives, Integrated Design Project, Digital Signal Processing, Robotics, Hydraulic and Pneumatic Systems, Mechatronics System Design, Final Year Project and Industrial Training."
    ],
    zhCN: [
      "SKEMH 官方学习计划包括：电气工程导论（Introduction to Electrical Engineering）、电路分析（Electrical Circuit Analysis）、科学编程（Scientific Programming）、数字电子系统（Digital Electronic Systems）、工程力学（Engineering Mechanics）、工程师 C 编程（C Programming for Engineers）、电子器件与电路（Electronic Devices and Circuits）和计算机辅助工程设计（Computer Aided Engineering Design）。",
      "中期课程包括：信号与系统（Signals and Systems）、电子仪表与测量（Electronic Instrumentation and Measurement）、电力系统原理（Principles of Electrical Power Systems）、电子设计实验室（Electronic Design Laboratory）、微处理器（Microprocessor）、电磁场理论（Electromagnetic Field Theory）、数值方法（Numerical Methods）、材料力学（Mechanics of Materials）和机械系统设计（Mechanical System Design）。",
      "高年级课程包括：系统建模与分析（System Modeling and Analysis）、通信原理（Communication Principles）、电子系统（Electronic Systems）、控制系统设计（Control System Design）、电机与驱动（Electrical Motors and Drives）、综合设计项目（Integrated Design Project）、数字信号处理（Digital Signal Processing）、机器人学（Robotics）、液压与气动系统（Hydraulic and Pneumatic Systems）、机电一体化系统设计（Mechatronics System Design）、最终年项目（Final Year Project）和工业训练（Industrial Training）。"
    ]
  },
  "Bachelor in Accounting with Honours": {
    en: [
      "Official Faculty of Management handbook lists accounting core courses such as Financial Accounting and Reporting, Accounting Information System, Management Accounting, Taxation, Audit, Corporate Accounting, Advanced Financial Accounting, Public Sector Accounting and Accounting for Islamic Financial Transactions.",
      "Common business courses include Economics, Principles of Management, Principles of Marketing, Statistics for Accounting, Basic Computerised Accounting, Business Law, Corporate Law, Finance, Business Communication, Business Ethics and Corporate Governance.",
      "The study plan includes Undergraduate Project, Industrial Training, elective accounting courses such as Internal Audit, Cases in Management Accounting, Advanced Taxation and Accounting for Specialised Industries, plus university and communication courses."
    ],
    zhCN: [
      "管理学院官方手册列出的会计核心课程包括：财务会计与报告（Financial Accounting and Reporting）、会计信息系统（Accounting Information System）、管理会计（Management Accounting）、税务（Taxation）、审计（Audit）、公司会计（Corporate Accounting）、高级财务会计（Advanced Financial Accounting）、公共部门会计（Public Sector Accounting）和伊斯兰金融交易会计（Accounting for Islamic Financial Transactions）。",
      "通用商科课程包括：经济学（Economics）、管理原理（Principles of Management）、市场营销原理（Principles of Marketing）、会计统计（Statistics for Accounting）、基础电脑化会计（Basic Computerised Accounting）、商业法（Business Law）、公司法（Corporate Law）、金融（Finance）、商务沟通（Business Communication）、商业伦理与公司治理（Business Ethics and Corporate Governance）。",
      "学习计划还包括本科项目（Undergraduate Project）、工业训练（Industrial Training），以及内部审计（Internal Audit）、管理会计案例（Cases in Management Accounting）、高级税务（Advanced Taxation）、特殊行业会计（Accounting for Specialised Industries）等会计选修课，并配套大学通识与沟通课程。"
    ]
  },
  "Bachelor in Digital Marketing with Honours": {
    en: [
      "Official Faculty of Management handbook lists core marketing and business courses such as Principles of Marketing, Principles of Microeconomics, Principles of Management, Principles of Macroeconomics, Business Mathematics, Business Accounting, Integrated Marketing Communication and Marketing Information System.",
      "Digital-marketing field courses include Consumer Behaviour, Business Statistics, Human Resource Management, Business Communication, Technology Management, Digital Marketing, Marketing Strategy, Marketing Research, Customer Relationship Management, Retail Marketing and Undergraduate Project.",
      "Electives include Marketing For Innovative Products, Supply Chain Management, IP Management and Cyber Law, Tourism Marketing, Islamic Marketing, Sports and Leisure Marketing, Healthcare Marketing, Brand Management, Social Marketing, Logistic Management and Sustainability Marketing."
    ],
    zhCN: [
      "管理学院官方手册列出的核心营销与商科课程包括：市场营销原理（Principles of Marketing）、微观经济学原理（Principles of Microeconomics）、管理原理（Principles of Management）、宏观经济学原理（Principles of Macroeconomics）、商业数学（Business Mathematics）、商业会计（Business Accounting）、整合营销传播（Integrated Marketing Communication）和营销信息系统（Marketing Information System）。",
      "数字营销领域课程包括：消费者行为（Consumer Behaviour）、商业统计（Business Statistics）、人力资源管理（Human Resource Management）、商务沟通（Business Communication）、技术管理（Technology Management）、数字营销（Digital Marketing）、营销战略（Marketing Strategy）、营销研究（Marketing Research）、客户关系管理（Customer Relationship Management）、零售营销（Retail Marketing）和本科项目（Undergraduate Project）。",
      "选修课程包括：创新产品营销（Marketing For Innovative Products）、供应链管理（Supply Chain Management）、知识产权管理与网络法（IP Management and Cyber Law）、旅游营销（Tourism Marketing）、伊斯兰营销（Islamic Marketing）、体育与休闲营销（Sports and Leisure Marketing）、医疗健康营销（Healthcare Marketing）、品牌管理（Brand Management）、社会营销（Social Marketing）、物流管理（Logistic Management）和可持续营销（Sustainability Marketing）。"
    ]
  },
  "Bachelor of Management with Honours": {
    en: [
      "Official Faculty of Management handbook lists core courses such as Principles of Microeconomics, Principles of Management, Business Accounting, Principles of Marketing, Organizational Behaviour, Principles of Macroeconomics, Business Mathematics, Technology Management and Business Statistics.",
      "Management field courses include Human Resource Management, Business Communication, Research Methods, Undergraduate Project, Business Ethics and Corporate Governance, Industrial Training, Professional Communication Skills and Service Learning and Community Engagement.",
      "Innovation and operation concentration electives include Manufacturing Technology, Business Intelligence and Analytic, Financial Risk Management, Lean Six Sigma, Business Data Analytics, Technology Commercialization, Intellectual Property Law, Quality Management, Operations Management and Procurement Management."
    ],
    zhCN: [
      "管理学院官方手册列出的核心课程包括：微观经济学原理（Principles of Microeconomics）、管理原理（Principles of Management）、商业会计（Business Accounting）、市场营销原理（Principles of Marketing）、组织行为学（Organizational Behaviour）、宏观经济学原理（Principles of Macroeconomics）、商业数学（Business Mathematics）、技术管理（Technology Management）和商业统计（Business Statistics）。",
      "管理领域课程包括：人力资源管理（Human Resource Management）、商务沟通（Business Communication）、研究方法（Research Methods）、本科项目（Undergraduate Project）、商业伦理与公司治理（Business Ethics and Corporate Governance）、工业训练（Industrial Training）、专业沟通技能（Professional Communication Skills）和服务学习与社区参与（Service Learning and Community Engagement）。",
      "创新与运营方向选修课程包括：制造技术（Manufacturing Technology）、商业智能与分析（Business Intelligence and Analytic）、金融风险管理（Financial Risk Management）、精益六西格玛（Lean Six Sigma）、商业数据分析（Business Data Analytics）、技术商业化（Technology Commercialization）、知识产权法（Intellectual Property Law）、质量管理（Quality Management）、运营管理（Operations Management）和采购管理（Procurement Management）。"
    ]
  },
  "Bachelor of Mechanical Engineering with Honours": {
    en: [
      "Official Mechanical Engineering handbook course menu includes Programming for Engineers, Statics, Engineering Drawing, Experimental Methods, Introduction to Mechanical Engineering, Dynamics, Mechanics of Solids I/II and Engineering Mathematics.",
      "Middle-year courses include Mechanics of Machines and Vibration, Mechanics of Fluids I/II, Thermodynamics, Applied Thermodynamics and Heat Transfer, Materials Science, Manufacturing Processes, Applied Numerical Methods, Control Engineering, Instrumentation and Mechanical Design.",
      "Advanced courses include Materials Engineering, Industrial Training, Laboratory II/III, Engineering Professional Practice, Final Year Project, Plant Design, Elective I-IV and PRISMS elective options."
    ],
    zhCN: [
      "机械工程学院官方手册课程表包括：工程师编程（Programming for Engineers）、静力学（Statics）、工程制图（Engineering Drawing）、实验方法（Experimental Methods）、机械工程导论（Introduction to Mechanical Engineering）、动力学（Dynamics）、固体力学 I/II（Mechanics of Solids I/II）和工程数学（Engineering Mathematics）。",
      "中期课程包括：机械与振动力学（Mechanics of Machines and Vibration）、流体力学 I/II（Mechanics of Fluids I/II）、热力学（Thermodynamics）、应用热力学与传热（Applied Thermodynamics and Heat Transfer）、材料科学（Materials Science）、制造过程（Manufacturing Processes）、应用数值方法（Applied Numerical Methods）、控制工程（Control Engineering）、仪器仪表（Instrumentation）和机械设计（Mechanical Design）。",
      "高年级课程包括：材料工程（Materials Engineering）、工业训练（Industrial Training）、实验室 II/III（Laboratory II/III）、工程专业实践（Engineering Professional Practice）、最终年项目（Final Year Project）、工厂设计（Plant Design）、选修 I-IV 和 PRISMS 选修课程。"
    ]
  },
  "Bachelor of Mechanical Engineering (Manufacturing) with Honours": {
    en: [
      "Official Mechanical Engineering handbook course menu includes Programming for Engineers, Statics, Engineering Drawing, Experimental Methods, Introduction to Mechanical Engineering, Dynamics, Mechanics of Solids I/II, Thermodynamics and Manufacturing Processes.",
      "Manufacturing-focused courses include CAD/CAM, Production Planning and Control, Work Design and Productivity, Facility Design and Material Handling, Engineering Management and Economics, Materials Engineering, Laboratory II/III and Industrial Training.",
      "Advanced and elective courses include Additive Manufacturing, Modern Manufacturing, Advanced Machine Manufacturing, Surface Engineering, Advanced and Functional Materials, Materials Processing, Nanomaterials and Engineering Professional Practice."
    ],
    zhCN: [
      "机械工程学院官方手册课程表包括：工程师编程（Programming for Engineers）、静力学（Statics）、工程制图（Engineering Drawing）、实验方法（Experimental Methods）、机械工程导论（Introduction to Mechanical Engineering）、动力学（Dynamics）、固体力学 I/II（Mechanics of Solids I/II）、热力学（Thermodynamics）和制造过程（Manufacturing Processes）。",
      "制造方向课程包括：CAD/CAM、生产计划与控制（Production Planning and Control）、工作设计与生产率（Work Design and Productivity）、设施设计与物料搬运（Facility Design and Material Handling）、工程管理与经济（Engineering Management and Economics）、材料工程（Materials Engineering）、实验室 II/III（Laboratory II/III）和工业训练（Industrial Training）。",
      "高年级与选修课程包括：增材制造（Additive Manufacturing）、现代制造（Modern Manufacturing）、先进机器制造（Advanced Machine Manufacturing）、表面工程（Surface Engineering）、先进与功能材料（Advanced and Functional Materials）、材料加工（Materials Processing）、纳米材料（Nanomaterials）和工程专业实践（Engineering Professional Practice）。"
    ]
  },
  "Bachelor of Naval Architecture & Offshore Engineering with Honours": {
    en: [
      "Official Mechanical Engineering handbook course menu includes Statics, Ship Engineering Drawing, Experimental Methods, Introduction to Naval Architecture and Offshore Engineering, Engineering Mathematics, Mechanics of Solids, Mechanics of Fluids, Thermodynamics and Materials Science.",
      "Naval and offshore courses include Ship and Offshore Production Technology, Ship and Offshore Design, Naval Architecture II, Computational Methods in Ocean Engineering, Marine Laboratory I/II and Ocean Engineering courses.",
      "Advanced courses include Industrial Training, Engineering Professional Practice, Final Year Project, offshore and marine electives and professional practice preparation."
    ],
    zhCN: [
      "机械工程学院官方手册课程表包括：静力学（Statics）、船舶工程制图（Ship Engineering Drawing）、实验方法（Experimental Methods）、船舶建筑与海洋工程导论（Introduction to Naval Architecture and Offshore Engineering）、工程数学（Engineering Mathematics）、固体力学（Mechanics of Solids）、流体力学（Mechanics of Fluids）、热力学（Thermodynamics）和材料科学（Materials Science）。",
      "船舶与海洋方向课程包括：船舶与海洋生产技术（Ship and Offshore Production Technology）、船舶与海洋设计（Ship and Offshore Design）、船舶建筑 II（Naval Architecture II）、海洋工程计算方法（Computational Methods in Ocean Engineering）、海洋实验室 I/II（Marine Laboratory I/II）和海洋工程相关课程。",
      "高年级课程包括：工业训练（Industrial Training）、工程专业实践（Engineering Professional Practice）、最终年项目（Final Year Project）、海洋与离岸方向选修课程，以及专业实践准备。"
    ]
  },
  "Bachelor of Mechanical Engineering (Aeronautics) with Honours": {
    en: [
      "Official Mechanical Engineering handbook course menu includes Statics, Engineering Drawing, Experimental Methods, Introduction to Mechanical Engineering, Engineering Mathematics, Mechanics of Solids, Mechanics of Fluids, Thermodynamics, Materials Science and Manufacturing Processes.",
      "Aeronautics courses include Aerodynamics, Flight Mechanics, Aircraft Structures, Aerospace-related design courses, Finite Element Methods, Control Engineering and Laboratory II/III.",
      "Advanced courses include Flight Dynamics and Control, Industrial Training, Engineering Professional Practice, Final Year Project, aeronautics electives and PRISMS elective options."
    ],
    zhCN: [
      "机械工程学院官方手册课程表包括：静力学（Statics）、工程制图（Engineering Drawing）、实验方法（Experimental Methods）、机械工程导论（Introduction to Mechanical Engineering）、工程数学（Engineering Mathematics）、固体力学（Mechanics of Solids）、流体力学（Mechanics of Fluids）、热力学（Thermodynamics）、材料科学（Materials Science）和制造过程（Manufacturing Processes）。",
      "航空方向课程包括：空气动力学（Aerodynamics）、飞行力学（Flight Mechanics）、飞机结构（Aircraft Structures）、航空航天相关设计课程、有限元方法（Finite Element Methods）、控制工程（Control Engineering）和实验室 II/III（Laboratory II/III）。",
      "高年级课程包括：飞行动力学与控制（Flight Dynamics and Control）、工业训练（Industrial Training）、工程专业实践（Engineering Professional Practice）、最终年项目（Final Year Project）、航空方向选修课程和 PRISMS 选修课程。"
    ]
  },
  "Bachelor of Science in Architecture with Honours": {
    en: [
      "Graduation requires at least 120 credit hours and a minimum CGPA of 2.0.",
      "Core design courses use project-based learning in a studio environment.",
      "The programme also uses practice learning environments, theory input, testing and simulation, workshops, seminars and exhibitions."
    ],
    zhCN: [
      "毕业要求至少完成 120 学分并达到最低 CGPA 2.0。",
      "核心设计课程采用设计工作室环境中的项目式学习。",
      "课程还包含实践学习环境、理论输入、测试与模拟、工作坊、研讨会和展览等学习形式。"
    ]
  },
  "Bachelor of Quantity Surveying with Honours": {
    en: [
      "Graduation requires at least 128 credit hours and a minimum CGPA of 2.0.",
      "Learning activities include lectures, tutorials, studio work, laboratory and field work, and problem-based learning.",
      "Third-year students complete 24 weeks of industrial training at quantity surveying establishments.",
      "Final-year students undertake a supervised study in a quantity surveying area or specialised field."
    ],
    zhCN: [
      "毕业要求至少完成 128 学分并达到最低 CGPA 2.0。",
      "学习活动包括讲座、辅导课、工作室、实验与实地工作，以及问题导向学习。",
      "三年级学生需在工料测量机构完成 24 周工业训练。",
      "最终年学生需在工料测量领域或专项领域完成导师指导的研究。"
    ]
  },
  "Bachelor of Science in Construction with Honours": {
    en: [
      "The programme combines engineering technology, construction techniques and management.",
      "Students study and practise construction technology and management to prepare for construction project management and contracting roles."
    ],
    zhCN: [
      "课程结合工程技术、建造技术与管理内容。",
      "学生会学习并实践建造技术与管理，为建筑项目管理和承包相关岗位做准备。"
    ]
  },
  "Bachelor of Urban and Regional Planning with Honours": {
    en: [
      "Graduation requires at least 133 credit hours and a minimum CGPA of 2.0.",
      "Courses follow student-centred learning and use student learning time as the credit basis.",
      "Learning activities include lectures, tutorials, studio work, laboratory and field work, and problem-based learning.",
      "Students complete 24 weeks of industrial training and an undergraduate final-year project."
    ],
    zhCN: [
      "毕业要求至少完成 133 学分并达到最低 CGPA 2.0。",
      "课程采用以学生为中心的学习原则，并以学生学习时间作为学分基础。",
      "学习活动包括讲座、辅导课、工作室、实验与实地工作，以及问题导向学习。",
      "学生需完成 24 周工业训练和本科最终年项目。"
    ]
  },
  "Bachelor of Landscape Architecture with Honours": {
    en: [
      "Graduation requires at least 131 credit hours and a minimum CGPA of 2.0.",
      "The programme uses the official course classification scheme and landscape architecture studio-based learning.",
      "Students complete practical design work and professional learning activities as part of the programme structure."
    ],
    zhCN: [
      "毕业要求至少完成 131 学分并达到最低 CGPA 2.0。",
      "课程采用官方课程分类结构，并以景观建筑工作室式学习为重要组成部分。",
      "学生会完成实践设计任务和专业学习活动。"
    ]
  },
  "Bachelor of Geomatics Engineering with Honours": {
    en: [
      "Official FABU course list includes Mathematics for Surveyors I/II, Physics Theory for Surveyors, Fundamental of Survey & Mapping, Computer Programming, Applied Physics for Surveyors, Cartography, Engineering Surveying, Statistic for Surveyors, Mathematics for Surveyors III - Survey Computation and Engineering Surveying Technology.",
      "Middle-year courses include Geodesy I/II, Survey Camp I/II/III, Introduction to Adjustment Computation, Satellite Positioning I, Photogrammetry I, Hydrographic Surveying, Field Astronomy, Cadastral Survey, Geographical Information System and Technical Writing.",
      "Advanced courses include Land Law and Survey Regulation, Project Management for Surveyors, Professional Practice, Undergraduate Project I/II and Industrial Training.",
      "Electives include Satellite Positioning II, Least Squares Adjustment, Photogrammetry II, Remote Sensing, Hydrographic Surveying Technology, Map Projection, Cadastre Survey Practice, Marine Geodesy, Underground Utility Mapping, Deformation Survey, Terrestrial Laser Scanning, Geospatial Data Analysis and Airborne Survey."
    ],
    zhCN: [
      "FABU 官方课程清单包括：测量数学 I/II（Mathematics for Surveyors I/II）、测量物理理论（Physics Theory for Surveyors）、测量与制图基础（Fundamental of Survey & Mapping）、计算机编程（Computer Programming）、测量应用物理（Applied Physics for Surveyors）、地图学（Cartography）、工程测量（Engineering Surveying）、测量统计（Statistic for Surveyors）、测量数学 III - 测量计算（Mathematics for Surveyors III - Survey Computation）和工程测量技术（Engineering Surveying Technology）。",
      "中期课程包括：大地测量 I/II（Geodesy I/II）、测量实习营 I/II/III（Survey Camp I/II/III）、平差计算导论（Introduction to Adjustment Computation）、卫星定位 I（Satellite Positioning I）、摄影测量 I（Photogrammetry I）、水道测量（Hydrographic Surveying）、实地天文学（Field Astronomy）、地籍测量（Cadastral Survey）、地理信息系统（Geographical Information System）和技术写作（Technical Writing）。",
      "高年级课程包括：土地法与测量法规（Land Law and Survey Regulation）、测量项目管理（Project Management for Surveyors）、专业实践（Professional Practice）、本科项目 I/II（Undergraduate Project I/II）和工业训练（Industrial Training）。",
      "选修课程包括：卫星定位 II（Satellite Positioning II）、最小二乘平差（Least Squares Adjustment）、摄影测量 II（Photogrammetry II）、遥感（Remote Sensing）、水道测量技术（Hydrographic Surveying Technology）、地图投影（Map Projection）、地籍测量实践（Cadastre Survey Practice）、海洋大地测量（Marine Geodesy）、地下管线测绘（Underground Utility Mapping）、变形监测（Deformation Survey）、地面激光扫描（Terrestrial Laser Scanning）、地理空间数据分析（Geospatial Data Analysis）和航空测量（Airborne Survey）。"
    ]
  },
  "Bachelor of Real Estate with Honours": {
    en: [
      "The programme is offered in full-time and part-time modes based on two-semester academic sessions.",
      "Assessment is based on coursework, final examination and final-year project.",
      "Students complete the official course requirements for real estate professional preparation."
    ],
    zhCN: [
      "课程提供全日制与非全日制学习安排，并按两学期制学年开展。",
      "考核包括课程作业、期末考试和最终年项目。",
      "学生需完成官方房地产专业培养所要求的课程。"
    ]
  },
  "Bachelor in Artificial Intelligence with Honours": {
    en: [
      "Official programme structure includes Introduction to AI, Data Management, Discrete Mathematics, Mathematics for Machine Learning, Computer Systems and Networks, Python Programming, Probability and Statistics, Data Structure & Algorithm, Computational Intelligence, Responsible AI and Ethics and AI and Its Application.",
      "Core AI courses include Machine Learning, Reinforcement Learning, Computer Vision, Data Wrangling and Visualization, Deep Learning, Natural Language Processing, Generative AI, AI Engineering, Expert System, Advanced Deep Learning, Advanced NLP and Evolutionary Computing.",
      "Advanced/elective AI courses include Algorithm for Optimization, AI in Metaverse, Intelligent Digital Twin, Advanced Vision System, Industrial Automation, Machine Learning for IoT, Data Fusion, Robotics, Intelligent Robotic Process Automation, AI in Operation Management, AI for Digital Transformation, AI Strategy and Business Models, AI in Supply Chain Management, AI-Powered Talent Management and AI in Financial."
    ],
    zhCN: [
      "官方课程结构包括：人工智能导论（Introduction to AI）、数据管理（Data Management）、离散数学（Discrete Mathematics）、机器学习数学（Mathematics for Machine Learning）、计算机系统与网络（Computer Systems and Networks）、Python 编程（Python Programming）、概率与统计（Probability and Statistics）、数据结构与算法（Data Structure & Algorithm）、计算智能（Computational Intelligence）、负责任 AI 与伦理（Responsible AI and Ethics）以及 AI 及其应用（AI and Its Application）。",
      "人工智能核心课程包括：机器学习（Machine Learning）、强化学习（Reinforcement Learning）、计算机视觉（Computer Vision）、数据整理与可视化（Data Wrangling and Visualization）、深度学习（Deep Learning）、自然语言处理（Natural Language Processing）、生成式 AI（Generative AI）、AI 工程（AI Engineering）、专家系统（Expert System）、高级深度学习（Advanced Deep Learning）、高级 NLP（Advanced NLP）和进化计算（Evolutionary Computing）。",
      "进阶/选修 AI 课程包括：优化算法（Algorithm for Optimization）、元宇宙 AI（AI in Metaverse）、智能数字孪生（Intelligent Digital Twin）、高级视觉系统（Advanced Vision System）、工业自动化（Industrial Automation）、物联网机器学习（Machine Learning for IoT）、数据融合（Data Fusion）、机器人学（Robotics）、智能机器人流程自动化（Intelligent Robotic Process Automation）、运营管理 AI（AI in Operation Management）、数字化转型 AI（AI for Digital Transformation）、AI 战略与商业模式（AI Strategy and Business Models）、供应链管理 AI（AI in Supply Chain Management）、AI 驱动人才管理（AI-Powered Talent Management）和金融 AI（AI in Financial）。"
    ]
  },
  "Bachelor of Science (Physics) with Honours": {
    en: [
      "Official Faculty of Science handbook lists physics courses such as Mathematical Methods I, Mechanics, Electricity and Magnetism, Waves and Optics, Modern Physics, Nuclear Physics, Basics Electronic, Computer Programming, Solid State Physics and Mathematical Physics.",
      "Advanced/elective courses include Astrophysics, Electronics and Instrumentation, Signal Processing, Semiconductor Physics, Condensed Matter Physics, Quantum Mechanics, Optoelectronics, Spectroscopy, Medical Physics and Radiobiology.",
      "The structure also includes Practical Physics, Research Training, Undergraduate Project, Industrial Training or research training components, university general courses and communication courses."
    ],
    zhCN: [
      "理学院官方手册列出的物理课程包括：数学方法 I（Mathematical Methods I）、力学（Mechanics）、电与磁（Electricity and Magnetism）、波与光学（Waves and Optics）、近代物理（Modern Physics）、核物理（Nuclear Physics）、基础电子学（Basics Electronic）、计算机编程（Computer Programming）、固体物理（Solid State Physics）和数学物理（Mathematical Physics）。",
      "进阶/选修课程包括：天体物理（Astrophysics）、电子与仪器（Electronics and Instrumentation）、信号处理（Signal Processing）、半导体物理（Semiconductor Physics）、凝聚态物理（Condensed Matter Physics）、量子力学（Quantum Mechanics）、光电子学（Optoelectronics）、光谱学（Spectroscopy）、医学物理（Medical Physics）和放射生物学（Radiobiology）。",
      "课程结构还包括：物理实验（Practical Physics）、研究训练（Research Training）、本科项目（Undergraduate Project）、工业训练或研究训练模块、大学通识课程和沟通课程。"
    ]
  },
  "Bachelor of Science (Industrial Physics) with Honours": {
    en: [
      "Official Faculty of Science handbook lists industrial physics courses such as Mathematical Methods I, Mechanics, Electricity and Magnetism, Waves and Optics, Computer Programming, Solid State Physics, Mathematical Physics and Practical Physics.",
      "Industrial/applied courses include Non-destructive Testing and Evaluation, Data Processing, Radiation Detection, Radiation Protection, Medical Physics, Occupational Health and Safety, Nuclear Energy, Industrial Instrumentation and Process Control.",
      "The programme structure includes Undergraduate Project, Industrial Training, research-oriented practical work, management elective courses and university general courses."
    ],
    zhCN: [
      "理学院官方手册列出的工业物理课程包括：数学方法 I（Mathematical Methods I）、力学（Mechanics）、电与磁（Electricity and Magnetism）、波与光学（Waves and Optics）、计算机编程（Computer Programming）、固体物理（Solid State Physics）、数学物理（Mathematical Physics）和物理实验（Practical Physics）。",
      "工业/应用课程包括：无损检测与评价（Non-destructive Testing and Evaluation）、数据处理（Data Processing）、辐射探测（Radiation Detection）、辐射防护（Radiation Protection）、医学物理（Medical Physics）、职业健康与安全（Occupational Health and Safety）、核能（Nuclear Energy）、工业仪器仪表与过程控制（Industrial Instrumentation and Process Control）。",
      "课程结构包括：本科项目（Undergraduate Project）、工业训练（Industrial Training）、研究型实践、管理选修课程和大学通识课程。"
    ]
  },
  "Bachelor of Science (Chemistry) with Honours": {
    en: [
      "Official Faculty of Science handbook lists chemistry courses such as Organic Chemistry, Analytical Chemistry, Basic Laboratory Skills, Analytical Chemistry Practical, Inorganic Chemistry, Physical Chemistry, Environmental Chemistry and Computer-Aided Chemistry.",
      "Advanced/elective courses include Separation Methods, Chemical Reactions Process, Quality Management System, Medicinal Chemistry, Green Chemistry, Inorganic and Organometallic Chemistry, Chemistry of Biomolecules, Polymer Chemistry, Surface Chemistry, Forensic Analytical Instrumentation and Forensic Chemistry.",
      "The structure includes undergraduate research project, laboratory courses, research training or industrial training components and university general courses."
    ],
    zhCN: [
      "理学院官方手册列出的化学课程包括：有机化学（Organic Chemistry）、分析化学（Analytical Chemistry）、基础实验技能（Basic Laboratory Skills）、分析化学实验（Analytical Chemistry Practical）、无机化学（Inorganic Chemistry）、物理化学（Physical Chemistry）、环境化学（Environmental Chemistry）和计算机辅助化学（Computer-Aided Chemistry）。",
      "进阶/选修课程包括：分离方法（Separation Methods）、化学反应过程（Chemical Reactions Process）、质量管理体系（Quality Management System）、药物化学（Medicinal Chemistry）、绿色化学（Green Chemistry）、无机与有机金属化学（Inorganic and Organometallic Chemistry）、生物分子化学（Chemistry of Biomolecules）、聚合物化学（Polymer Chemistry）、表面化学（Surface Chemistry）、法医分析仪器（Forensic Analytical Instrumentation）和法医化学（Forensic Chemistry）。",
      "课程结构包括本科研究项目、实验课程、研究训练或工业训练模块以及大学通识课程。"
    ]
  },
  "Bachelor of Science (Industrial Chemistry) with Honours": {
    en: [
      "Official Faculty of Science handbook lists industrial chemistry courses such as Analytical Chemistry, Organic Chemistry, Spectrometric Methods of Analysis, Industrial Chemical Process, Quality Management System, Petrochemistry and Radioanalytical Chemistry.",
      "Advanced/elective courses include Coordination Chemistry, Environmental Chemistry, Extraction and Chromatographic Techniques, Polymer Processing, Surface Chemistry, Chemical Sensors, Special Topics in Industrial Chemistry, Advanced Organic Chemistry, Advanced Analytical Chemistry and Forensic Analytical Instrumentation.",
      "The programme includes Industrial Training, Undergraduate Project, practical chemistry/laboratory work, management courses and university general courses."
    ],
    zhCN: [
      "理学院官方手册列出的工业化学课程包括：分析化学（Analytical Chemistry）、有机化学（Organic Chemistry）、光谱分析方法（Spectrometric Methods of Analysis）、工业化学过程（Industrial Chemical Process）、质量管理体系（Quality Management System）、石油化学（Petrochemistry）和放射分析化学（Radioanalytical Chemistry）。",
      "进阶/选修课程包括：配位化学（Coordination Chemistry）、环境化学（Environmental Chemistry）、萃取与色谱技术（Extraction and Chromatographic Techniques）、聚合物加工（Polymer Processing）、表面化学（Surface Chemistry）、化学传感器（Chemical Sensors）、工业化学专题（Special Topics in Industrial Chemistry）、高级有机化学（Advanced Organic Chemistry）、高级分析化学（Advanced Analytical Chemistry）和法医分析仪器（Forensic Analytical Instrumentation）。",
      "课程包括工业训练（Industrial Training）、本科项目（Undergraduate Project）、化学实验/实践、管理类课程和大学通识课程。"
    ]
  },
  "Bachelor of Science (Mathematics) with Honours": {
    en: [
      "Official Faculty of Science handbook lists mathematics courses such as Mathematical Methods I, Logic and Set Theory, Differential Equations I/II, Mathematical Statistics, Numerical Methods I/II, Vector Calculus and Mathematical Analysis.",
      "Advanced/elective courses include Functional Analysis, Fluid Mechanics, Introduction to Stochastic Models, Fuzzy Set Theory, Applied Abstract Algebra, Complex Variables, Multi-Objective Decision Making, Optimal Control and Advanced Partial Differential Equation.",
      "The programme structure includes Research Training, Undergraduate Project, Industrial Training or research training report, university general courses and communication courses."
    ],
    zhCN: [
      "理学院官方手册列出的数学课程包括：数学方法 I（Mathematical Methods I）、逻辑与集合论（Logic and Set Theory）、微分方程 I/II（Differential Equations I/II）、数理统计（Mathematical Statistics）、数值方法 I/II（Numerical Methods I/II）、向量微积分（Vector Calculus）和数学分析（Mathematical Analysis）。",
      "进阶/选修课程包括：泛函分析（Functional Analysis）、流体力学（Fluid Mechanics）、随机模型导论（Introduction to Stochastic Models）、模糊集理论（Fuzzy Set Theory）、应用抽象代数（Applied Abstract Algebra）、复变函数（Complex Variables）、多目标决策（Multi-Objective Decision Making）、最优控制（Optimal Control）和高级偏微分方程（Advanced Partial Differential Equation）。",
      "课程结构包括研究训练（Research Training）、本科项目（Undergraduate Project）、工业训练或研究训练报告、大学通识课程和沟通课程。"
    ]
  },
  "Bachelor of Science (Industrial Mathematics) with Honours": {
    en: [
      "Official Faculty of Science/MJIIT handbook lists industrial mathematics courses such as Linear Algebra, Mathematical Methods I, Statistics, Computer Literacy, Differential Equations, Mathematical Statistics, Numerical Methods and Vector Calculus.",
      "Industrial/applied courses include Multivariate Analysis, Research Methodology and Information Retrieval, Design of Experiments, Scheduling, Time Series, Regression Modelling, Scientific Computing using Structured Programming and Computational Mathematics.",
      "Electives include Complex Variables, Multi-Objective Decision Making, Advanced Partial Differential Equation, Advanced Mathematical Methods I, Mathematical Analysis and Methods of Engineering Mathematics; the structure also includes Industrial Training and Industrial Training Report."
    ],
    zhCN: [
      "理学院/MJIIT 官方手册列出的工业数学课程包括：线性代数（Linear Algebra）、数学方法 I（Mathematical Methods I）、统计学（Statistics）、计算机素养（Computer Literacy）、微分方程（Differential Equations）、数理统计（Mathematical Statistics）、数值方法（Numerical Methods）和向量微积分（Vector Calculus）。",
      "工业/应用课程包括：多元分析（Multivariate Analysis）、研究方法与信息检索（Research Methodology and Information Retrieval）、实验设计（Design of Experiments）、调度（Scheduling）、时间序列（Time Series）、回归建模（Regression Modelling）、结构化编程科学计算（Scientific Computing using Structured Programming）和计算数学（Computational Mathematics）。",
      "选修课程包括：复变函数（Complex Variables）、多目标决策（Multi-Objective Decision Making）、高级偏微分方程（Advanced Partial Differential Equation）、高级数学方法 I（Advanced Mathematical Methods I）、数学分析（Mathematical Analysis）和工程数学方法（Methods of Engineering Mathematics）；课程结构还包括工业训练（Industrial Training）与工业训练报告（Industrial Training Report）。"
    ]
  },
  "Bachelor of Science (Biology) with Honours": {
    en: [
      "Official Faculty of Science handbook lists biology courses such as Microbiology, Biochemistry and Metabolism, Cellular and Molecular Biology, Biostatistics, Mycology, Genetics, Virology and Genetic Engineering.",
      "Advanced/elective courses include Genetic Engineering Lab, Bioinformatics, Extremophiles, Phycology, Bioremediation and Biodegradation, Biological Control and Bioconservation, Green Technology for Sustainable Environment and Bioprospecting of Industrial Microorganism.",
      "The structure includes Undergraduate Project, Industrial Training or research components, laboratory/practical biology courses and university general courses."
    ],
    zhCN: [
      "理学院官方手册列出的生物课程包括：微生物学（Microbiology）、生物化学与代谢（Biochemistry and Metabolism）、细胞与分子生物学（Cellular and Molecular Biology）、生物统计（Biostatistics）、真菌学（Mycology）、遗传学（Genetics）、病毒学（Virology）和基因工程（Genetic Engineering）。",
      "进阶/选修课程包括：基因工程实验（Genetic Engineering Lab）、生物信息学（Bioinformatics）、极端微生物（Extremophiles）、藻类学（Phycology）、生物修复与生物降解（Bioremediation and Biodegradation）、生物防治与生物保护（Biological Control and Bioconservation）、可持续环境绿色技术（Green Technology for Sustainable Environment）和工业微生物生物勘探（Bioprospecting of Industrial Microorganism）。",
      "课程结构包括本科项目（Undergraduate Project）、工业训练或研究模块、生物实验/实践课程和大学通识课程。"
    ]
  },
  "Bachelor of Science in Biotechnology with Honours": {
    en: [
      "Official Faculty of Science handbook lists biotechnology courses such as Introduction to Biotechnology, Microbiology, Bioorganic Chemistry, Bioinformatics, Trends in Biotechnology, Animal Tissue Culture Technology, Plant Tissue Culture Technology and Tissue Culture Technology Lab.",
      "Advanced/elective courses include Gene Therapy, Drug Design and Discovery, Stem Cells and Tissue Engineering, Medical Virology, Nanobiotechnology, Fungal Biotechnology, Microbial Biotechnology, Environmental Bioengineering and Bioreactor Design.",
      "The structure includes Industrial Training, Undergraduate Project, biotechnology laboratory work, module electives in medical/agricultural/industrial biotechnology and university general courses."
    ],
    zhCN: [
      "理学院官方手册列出的生物技术课程包括：生物技术导论（Introduction to Biotechnology）、微生物学（Microbiology）、生物有机化学（Bioorganic Chemistry）、生物信息学（Bioinformatics）、生物技术趋势（Trends in Biotechnology）、动物组织培养技术（Animal Tissue Culture Technology）、植物组织培养技术（Plant Tissue Culture Technology）和组织培养技术实验（Tissue Culture Technology Lab）。",
      "进阶/选修课程包括：基因治疗（Gene Therapy）、药物设计与发现（Drug Design and Discovery）、干细胞与组织工程（Stem Cells and Tissue Engineering）、医学病毒学（Medical Virology）、纳米生物技术（Nanobiotechnology）、真菌生物技术（Fungal Biotechnology）、微生物生物技术（Microbial Biotechnology）、环境生物工程（Environmental Bioengineering）和生物反应器设计（Bioreactor Design）。",
      "课程结构包括工业训练（Industrial Training）、本科项目（Undergraduate Project）、生物技术实验课程、医学/农业/工业生物技术模块选修以及大学通识课程。"
    ]
  },
  "Bachelor in Human Resource Development with Honours": {
    en: [
      "Official SHMRH study plan includes Principles of HRD, Introduction to Management, Introduction to Organizational Behaviour, Introduction to Human Resource Management, Adult Learning, Human Resource Planning, Organizational Communication, Needs Assessment in HRD and Learning & Development Technologies.",
      "Middle-year courses include Instructional Design, Career Development, Industrial Relations Law, Statistic for Social Science, Safety And Health at Work, Employee Relations, Cross-cultural Management, Program Evaluation, Introduction to Research Methods and Human Resource Information System.",
      "Advanced courses include Performance Management System and Employee Development, Finance for HRD, Undergraduate Project (Proposal/Report), Ethics and Social Responsibility, Organizational Development, Consultancy for HRD, Compensation and Benefit, Training Management and Industrial Training."
    ],
    zhCN: [
      "SHMRH 官方学习计划包括：人力资源发展原理（Principles of HRD）、管理导论（Introduction to Management）、组织行为学导论（Introduction to Organizational Behaviour）、人力资源管理导论（Introduction to Human Resource Management）、成人学习（Adult Learning）、人力资源规划（Human Resource Planning）、组织沟通（Organizational Communication）、人力资源发展需求评估（Needs Assessment in HRD）和学习与发展技术（Learning & Development Technologies）。",
      "中期课程包括：教学设计（Instructional Design）、职业发展（Career Development）、劳资关系法（Industrial Relations Law）、社会科学统计（Statistic for Social Science）、工作场所安全与健康（Safety And Health at Work）、员工关系（Employee Relations）、跨文化管理（Cross-cultural Management）、项目评估（Program Evaluation）、研究方法导论（Introduction to Research Methods）和人力资源信息系统（Human Resource Information System）。",
      "高年级课程包括：绩效管理系统与员工发展（Performance Management System and Employee Development）、HRD 财务（Finance for HRD）、本科项目提案/报告（Undergraduate Project Proposal/Report）、伦理与社会责任（Ethics and Social Responsibility）、组织发展（Organizational Development）、HRD 咨询（Consultancy for HRD）、薪酬与福利（Compensation and Benefit）、培训管理（Training Management）和工业训练（Industrial Training）。"
    ]
  },
  "Bachelor of Psychology with Human Resource Development with Honours": {
    en: [
      "Official psychology with HRD page lists HRD-related courses such as Principles of HRD, Introduction to Management, Introduction to Organizational Behaviour, Introduction to HRM, Needs Assessment in HRD, Adult Learning, Human Resource Planning and Organizational Communication.",
      "Psychology and HRD course synopses include Group Counselling, Clinical Psychology, Consumer Psychology, Group Communication, Conflict Management, Health Psychology, Safety And Health at Work and Cross-cultural Management.",
      "The curriculum structure includes industrial training in semester eight, undergraduate final-year project, university general courses and elective psychology/HRD subjects."
    ],
    zhCN: [
      "心理学与人力资源发展官方页面列出的 HRD 相关课程包括：人力资源发展原理（Principles of HRD）、管理导论（Introduction to Management）、组织行为学导论（Introduction to Organizational Behaviour）、人力资源管理导论（Introduction to HRM）、HRD 需求评估（Needs Assessment in HRD）、成人学习（Adult Learning）、人力资源规划（Human Resource Planning）和组织沟通（Organizational Communication）。",
      "心理学与 HRD 课程简介包括：团体辅导（Group Counselling）、临床心理学（Clinical Psychology）、消费者心理学（Consumer Psychology）、团体沟通（Group Communication）、冲突管理（Conflict Management）、健康心理学（Health Psychology）、工作场所安全与健康（Safety And Health at Work）和跨文化管理（Cross-cultural Management）。",
      "课程结构包括第八学期工业训练（Industrial Training）、本科最终年项目（Undergraduate Final-Year Project）、大学通识课程以及心理学/HRD 选修科目。"
    ]
  },
  "Bachelor of Science with Honours (Industrial Design)": {
    en: [
      "The curriculum integrates aesthetics, technology, ergonomics and marketing know-how into new product design.",
      "Students learn through design projects as the core of the curriculum.",
      "The programme includes an internship in the third year and uses a simulated professional design environment.",
      "About 80% of student time is spent on core courses and about 20% on university compulsory courses."
    ],
    zhCN: [
      "课程把美学、技术、人因工程和市场营销知识整合到新产品设计中。",
      "学生以设计项目作为课程核心进行学习。",
      "课程在第三年安排实习，并采用模拟专业设计环境。",
      "学生约 80% 的学习时间用于核心课程，约 20% 用于大学必修课程。"
    ]
  },
  "Bachelor of Electronic Systems Engineering with Honours": {
    en: [
      "Official MJIIT programme structure includes Programming for Engineer, Fundamental of Electrical Circuits, Introduction to Electronic System, Digital Electronics, Measurement and Instrumentation, Circuits and Signals and Engineering Mathematics.",
      "Middle-year courses include Electronic Systems, Electronic Devices and Circuits, Signals and Systems, Microprocessor, Control Systems, Electronic Instrumentation, Embedded Systems and Integrated Design Project.",
      "Advanced/elective courses include Industrial Hydraulics and Pneumatics, Control Systems Design, Power Electronic and Drives, Computer Integrated Manufacturing, Industrial Automation, Robotics, Advanced Programming, Real Time Systems, Mechatronic System Design, Semiconductor Material Engineering, Semiconductor Device Engineering and Solid State Electronics."
    ],
    zhCN: [
      "MJIIT 官方课程结构包括：工程师编程（Programming for Engineer）、电路基础（Fundamental of Electrical Circuits）、电子系统导论（Introduction to Electronic System）、数字电子学（Digital Electronics）、测量与仪表（Measurement and Instrumentation）、电路与信号（Circuits and Signals）和工程数学（Engineering Mathematics）。",
      "中期课程包括：电子系统（Electronic Systems）、电子器件与电路（Electronic Devices and Circuits）、信号与系统（Signals and Systems）、微处理器（Microprocessor）、控制系统（Control Systems）、电子仪表（Electronic Instrumentation）、嵌入式系统（Embedded Systems）和综合设计项目（Integrated Design Project）。",
      "高年级/选修课程包括：工业液压与气动（Industrial Hydraulics and Pneumatics）、控制系统设计（Control Systems Design）、电力电子与驱动（Power Electronic and Drives）、计算机集成制造（Computer Integrated Manufacturing）、工业自动化（Industrial Automation）、机器人学（Robotics）、高级编程（Advanced Programming）、实时系统（Real Time Systems）、机电系统设计（Mechatronic System Design）、半导体材料工程（Semiconductor Material Engineering）、半导体器件工程（Semiconductor Device Engineering）和固态电子学（Solid State Electronics）。"
    ]
  },
  "Bachelor of Mechanical Precision Engineering with Honours": {
    en: [
      "Official MJIIT programme structure includes Engineering Drawing with CAD, Experimental Method, Statics, Engineering Mathematics, Programming for Engineers, Thermodynamics, Materials Science, Manufacturing Processes, Workshop Practice and Introduction to Design.",
      "Middle-year courses include Fluid Mechanics, Fundamental of Electrical Engineering, Applied Solid Mechanics, Engineering Mathematics III, Computer Aided Engineering Design, Dynamics, Mechanics of Materials and Laboratory courses.",
      "Advanced/elective courses include Sub Micrometre and Nanometre Technology, Micromachining Processes, Welding Engineering, Non-Destructive Test Technology, CNC CAD/CAM, Advanced Machine Manufacturing, Robotics-related manufacturing courses and Industrial Training."
    ],
    zhCN: [
      "MJIIT 官方课程结构包括：CAD 工程制图（Engineering Drawing with CAD）、实验方法（Experimental Method）、静力学（Statics）、工程数学（Engineering Mathematics）、工程师编程（Programming for Engineers）、热力学（Thermodynamics）、材料科学（Materials Science）、制造过程（Manufacturing Processes）、工坊实践（Workshop Practice）和设计导论（Introduction to Design）。",
      "中期课程包括：流体力学（Fluid Mechanics）、电气工程基础（Fundamental of Electrical Engineering）、应用固体力学（Applied Solid Mechanics）、工程数学 III（Engineering Mathematics III）、计算机辅助工程设计（Computer Aided Engineering Design）、动力学（Dynamics）、材料力学（Mechanics of Materials）和实验室课程。",
      "高年级/选修课程包括：亚微米与纳米技术（Sub Micrometre and Nanometre Technology）、微加工过程（Micromachining Processes）、焊接工程（Welding Engineering）、无损检测技术（Non-Destructive Test Technology）、CNC CAD/CAM、高级机械制造（Advanced Machine Manufacturing）、机器人相关制造课程和工业训练（Industrial Training）。"
    ]
  },
  "Bachelor of Chemical Process Engineering with Honours": {
    en: [
      "Official MJIIT programme structure includes Introduction to Chemical Process Engineering, Engineering Mathematics I/II/III, Engineering Drawing with CAD, Programming for Chemical Engineers, Organic Chemistry, Thermodynamics, Physical Chemistry for Chemical Engineers, Analytical Chemistry and Fluid Mechanics.",
      "Middle-year courses include Mass and Energy Balance, Chemical Engineering Thermodynamics, Transport Phenomena, Materials Science, Chemical Kinetics & Reactor Design, Process Control and Instrumentation, Numerical Methods for Chemical Engineer and Chemical Process Engineering Laboratory.",
      "Advanced courses include Chemical Process Design, Process Economics & Project Management, Fundamentals of Microbiology, Process Safety and Health, Industrial Training, Final Year Project, Chemical Process Engineering Laboratory 3/4 and capstone/design courses.",
      "Electives include Fine Chemicals Technology, Polymer Science and Engineering, Biotechnology and Bio-Processing, Fundamentals and Application of Biosensors, Solid and Hazardous Waste Management and related sustainable resources courses."
    ],
    zhCN: [
      "MJIIT 官方课程结构包括：化学过程工程导论（Introduction to Chemical Process Engineering）、工程数学 I/II/III（Engineering Mathematics I/II/III）、CAD 工程制图（Engineering Drawing with CAD）、化学工程师编程（Programming for Chemical Engineers）、有机化学（Organic Chemistry）、热力学（Thermodynamics）、化学工程师物理化学（Physical Chemistry for Chemical Engineers）、分析化学（Analytical Chemistry）和流体力学（Fluid Mechanics）。",
      "中期课程包括：质量与能量衡算（Mass and Energy Balance）、化学工程热力学（Chemical Engineering Thermodynamics）、传递现象（Transport Phenomena）、材料科学（Materials Science）、化学动力学与反应器设计（Chemical Kinetics & Reactor Design）、过程控制与仪表（Process Control and Instrumentation）、化学工程师数值方法（Numerical Methods for Chemical Engineer）和化学过程工程实验室（Chemical Process Engineering Laboratory）。",
      "高年级课程包括：化学过程设计（Chemical Process Design）、过程经济与项目管理（Process Economics & Project Management）、微生物学基础（Fundamentals of Microbiology）、过程安全与健康（Process Safety and Health）、工业训练（Industrial Training）、最终年项目（Final Year Project）、化学过程工程实验室 3/4 以及顶点/设计课程。",
      "选修课程包括：精细化学品技术（Fine Chemicals Technology）、聚合物科学与工程（Polymer Science and Engineering）、生物技术与生物加工（Biotechnology and Bio-Processing）、生物传感器基础与应用（Fundamentals and Application of Biosensors）、固体与危险废物管理（Solid and Hazardous Waste Management）及可持续资源相关课程。"
    ]
  }
};

const undergraduateCourseSourceLinks: Record<string, Array<{ title: string; url: string }>> = {
  "Bachelor of Biomedical Engineering with Honours": [
    {
      title: "UTM FKE official SKEB course menu handbook 2025/2026",
      url: "https://fke.utm.my/wp-content/uploads/2025/09/SKEB-Booklet-20252026-Both-Intake.pdf"
    }
  ],
  "Bachelor of Chemical Engineering with Honours": [
    {
      title: "UTM FKT official undergraduate guidebook 2025/2026",
      url: "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf"
    }
  ],
  "Bachelor of Chemical Engineering (Bioprocess) with Honours": [
    {
      title: "UTM FKT official undergraduate guidebook 2025/2026",
      url: "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf"
    }
  ],
  "Bachelor of Chemical Engineering (Gas) with Honours": [
    {
      title: "UTM FKT official undergraduate guidebook 2025/2026",
      url: "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf"
    }
  ],
  "Bachelor of Nuclear Engineering with Honours": [
    {
      title: "UTM FKT official undergraduate guidebook 2025/2026",
      url: "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf"
    }
  ],
  "Bachelor of Petroleum Engineering with Honours": [
    {
      title: "UTM FKT official undergraduate guidebook 2025/2026",
      url: "https://fkt.utm.my/wp-content/uploads/2026/01/GUIDEBOOK-UG-FKT-2025-2026-1.pdf"
    }
  ],
  "Bachelor of Electrical Engineering with Honours": [
    {
      title: "UTM FKE official SKEEH course menu handbook 2025/2026",
      url: "https://fke.utm.my/wp-content/uploads/2025/09/SKEEH-Booklet-20252026-50825.pdf"
    }
  ],
  "Bachelor of Electronic Engineering with Honours": [
    {
      title: "UTM FKE official SKELH course menu handbook 2025/2026",
      url: "https://fke.utm.my/wp-content/uploads/2025/10/Booklet-SKELH-20252026_REV1.pdf"
    }
  ],
  "Bachelor of Engineering (Electrical-Mechatronics) with Honours": [
    {
      title: "UTM FKE official SKEMH course menu handbook 2025/2026",
      url: "https://fke.utm.my/wp-content/uploads/2026/05/SKEMH-Handbook-20252026-22-May-2026.pdf"
    }
  ],
  "Bachelor of Mechanical Engineering with Honours": [
    {
      title: "UTM FKM official undergraduate handbook 2023/2024",
      url: "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf"
    }
  ],
  "Bachelor of Mechanical Engineering (Manufacturing) with Honours": [
    {
      title: "UTM FKM official undergraduate handbook 2023/2024",
      url: "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf"
    }
  ],
  "Bachelor of Naval Architecture & Offshore Engineering with Honours": [
    {
      title: "UTM FKM official undergraduate handbook 2023/2024",
      url: "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf"
    }
  ],
  "Bachelor of Mechanical Engineering (Aeronautics) with Honours": [
    {
      title: "UTM FKM official undergraduate handbook 2023/2024",
      url: "https://mech.utm.my/wp-content/uploads/2023/10/UNDERGRADUATE-HANDBOOK-FACULTY-OF-MECHANICAL-ENGINEERING-SESSION-20232024.pdf"
    }
  ],
  "Bachelor in Accounting with Honours": [
    {
      title: "UTM Faculty of Management official undergraduate handbook 2025/2026",
      url: "https://management.utm.my/wp-content/uploads/2025/09/UG-Academic-Hand-Book-FM-2025_2026_update-040925.pdf"
    }
  ],
  "Bachelor in Digital Marketing with Honours": [
    {
      title: "UTM Faculty of Management official undergraduate handbook 2025/2026",
      url: "https://management.utm.my/wp-content/uploads/2025/09/UG-Academic-Hand-Book-FM-2025_2026_update-040925.pdf"
    }
  ],
  "Bachelor of Management with Honours": [
    {
      title: "UTM Faculty of Management official undergraduate handbook 2025/2026",
      url: "https://management.utm.my/wp-content/uploads/2025/09/UG-Academic-Hand-Book-FM-2025_2026_update-040925.pdf"
    }
  ],
  "Bachelor of Geomatics Engineering with Honours": [
    {
      title: "UTM FABU official Geomatics course list by semester",
      url: "https://builtsurvey.utm.my/wp-content/uploads/2021/11/List_of_Courses_According_to_Semester_SBEUH.pdf"
    }
  ],
  "Bachelor in Artificial Intelligence with Honours": [
    {
      title: "UTM FAI official AI programme structure PDF",
      url: "https://fai.utm.my/wp-content/uploads/2024/05/PS-Bachelor-of-Artificial-Intelligence-with-Honours.pdf"
    },
    {
      title: "UTM FAI official AI curriculum structure PDF",
      url: "https://fai.utm.my/wp-content/uploads/2024/09/Curriculum-Structure_Bachelor-of-Artificial-Intelligence-with-Honours.pdf"
    }
  ],
  "Bachelor of Science (Physics) with Honours": [
    {
      title: "UTM Faculty of Science official academic handbook 2025/2026",
      url: "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf"
    }
  ],
  "Bachelor of Science (Industrial Physics) with Honours": [
    {
      title: "UTM Faculty of Science official academic handbook 2025/2026",
      url: "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf"
    }
  ],
  "Bachelor of Science (Chemistry) with Honours": [
    {
      title: "UTM Faculty of Science official academic handbook 2025/2026",
      url: "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf"
    }
  ],
  "Bachelor of Science (Industrial Chemistry) with Honours": [
    {
      title: "UTM Faculty of Science official academic handbook 2025/2026",
      url: "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf"
    }
  ],
  "Bachelor of Science (Mathematics) with Honours": [
    {
      title: "UTM Faculty of Science official academic handbook 2025/2026",
      url: "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf"
    }
  ],
  "Bachelor of Science (Industrial Mathematics) with Honours": [
    {
      title: "UTM Faculty of Science official academic handbook 2025/2026",
      url: "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf"
    },
    {
      title: "UTM MJIIT official undergraduate guideline 2025/2026",
      url: "https://mjiit.utm.my/wp-content/uploads/2025/09/Final-Guideline-Book-UG-20252026.pdf"
    }
  ],
  "Bachelor of Science (Biology) with Honours": [
    {
      title: "UTM Faculty of Science official academic handbook 2025/2026",
      url: "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf"
    }
  ],
  "Bachelor of Science in Biotechnology with Honours": [
    {
      title: "UTM Faculty of Science official academic handbook 2025/2026",
      url: "https://science.utm.my/undergraduate/wp-content/uploads/sites/584/2025/09/UGFS-Academic-Handbook-20252026-v2.pdf"
    }
  ],
  "Bachelor of Electronic Systems Engineering with Honours": [
    {
      title: "UTM MJIIT official undergraduate guideline 2025/2026",
      url: "https://mjiit.utm.my/wp-content/uploads/2025/09/Final-Guideline-Book-UG-20252026.pdf"
    }
  ],
  "Bachelor of Mechanical Precision Engineering with Honours": [
    {
      title: "UTM MJIIT official undergraduate guideline 2025/2026",
      url: "https://mjiit.utm.my/wp-content/uploads/2025/09/Final-Guideline-Book-UG-20252026.pdf"
    }
  ],
  "Bachelor of Chemical Process Engineering with Honours": [
    {
      title: "UTM MJIIT official undergraduate guideline 2025/2026",
      url: "https://mjiit.utm.my/wp-content/uploads/2025/09/Final-Guideline-Book-UG-20252026.pdf"
    }
  ]
};

const undergraduateCareerDirectionItems: Record<string, LocalizedArraySeed> = {
  "Bachelor of Biomedical Engineering with Honours": {
    en: [
      "Graduates may continue to PhD study or build careers in clinical engineering, biomechanics, prosthetics, tissue engineering and medical devices."
    ],
    zhCN: [
      "毕业生可继续攻读博士，也可在临床工程、生物力学、假肢、组织工程和医疗器械等相关领域发展。"
    ]
  },
  "Bachelor in Accounting with Honours": {
    en: [
      "Graduates may work as accountants, auditors, finance officers, tax officers, tax consultants, entrepreneurs, business consultants, insurance advisors, company secretaries, bank officers, risk managers, chief executive officers and related roles."
    ],
    zhCN: [
      "毕业生可从事会计师、审计师、财务人员、税务人员、税务顾问、创业者、商业顾问、保险顾问、公司秘书、银行职员、风险经理、首席执行官等相关岗位。"
    ]
  },
  "Bachelor in Digital Marketing with Honours": {
    en: [
      "Graduates may work as product marketing managers, marketing assistants or executives, purchasing and administration executives, or management and marketing personnel in ICT environments and ICT-based organisations."
    ],
    zhCN: [
      "毕业生可从事产品营销经理、营销助理或主管、采购与行政主管，或在 ICT 环境及 ICT 型组织中担任管理与营销相关岗位。"
    ]
  },
  "Bachelor of Management with Honours": {
    en: [
      "Graduates may work in technology commercialisation, technology transfer, technology licensing, venture capital investment analysis, production control, logistics, procurement, supply chain, operations, quality control, project management, customer service, corporate planning and business consulting."
    ],
    zhCN: [
      "毕业生可在技术商业化、技术转移、技术许可、风险投资分析、生产控制、物流、采购、供应链、运营、质量控制、项目管理、客户服务、企业规划和商业咨询等方向发展。"
    ]
  },
  "Bachelor of Science in Architecture with Honours": {
    en: [
      "Graduates are prepared for public and private sector roles such as architectural officer, assistant architect, building designer, project architect, project supervisor, design consultant and other architecture-design related work."
    ],
    zhCN: [
      "毕业生可在公共或私营部门担任建筑事务人员、助理建筑师、建筑设计师、项目建筑师、项目主管、设计顾问及其他建筑设计相关岗位。"
    ]
  },
  "Bachelor of Quantity Surveying with Honours": {
    en: [
      "Graduates are eligible to register with the Board of Quantity Surveyors Malaysia as registered graduate Quantity Surveyors and may continue to higher degrees."
    ],
    zhCN: [
      "毕业生可向马来西亚工料测量师委员会注册成为毕业工料测量师，也可继续攻读更高学位。"
    ]
  },
  "Bachelor of Science in Construction with Honours": {
    en: [
      "The programme prepares graduates for managerial positions in the construction industry, including construction project manager and construction contractor pathways."
    ],
    zhCN: [
      "课程培养毕业生进入建筑行业管理岗位，包括建筑项目经理和建筑承包相关发展方向。"
    ]
  },
  "Bachelor of Geomatics Engineering with Honours": {
    en: [
      "Official career prospects include hydrographer, astronomer or Islamic astronomer, offshore and onshore positioning specialist, marine hydrographic survey and oceanography-related roles."
    ],
    zhCN: [
      "官方列出的职业前景包括水道测量师、天文学/伊斯兰天文学相关岗位、离岸与陆上定位专员、海洋水道测量和海洋学相关岗位。"
    ]
  },
  "Bachelor of Real Estate with Honours": {
    en: [
      "Graduates may seek employment as real estate professionals in the public or private sector, locally or overseas."
    ],
    zhCN: [
      "毕业生可在本地或海外公共及私营部门从事房地产专业相关工作。"
    ]
  },
  "Bachelor in Artificial Intelligence with Honours": {
    en: [
      "Graduates may work across technology, healthcare, finance, manufacturing and other sectors.",
      "Career directions include AI engineer, data scientist, machine learning specialist, research scientist and AI consultant, or further graduate study."
    ],
    zhCN: [
      "毕业生可在科技、医疗健康、金融、制造等行业发展。",
      "职业方向包括人工智能工程师、数据科学家、机器学习专家、研究科学家、人工智能顾问，或继续攻读研究生。"
    ]
  },
  "Bachelor in Human Resource Development with Honours": {
    en: [
      "The programme aims to produce HRD practitioners, potential managers or leaders, competent communicators and negotiators, and organisational change agents."
    ],
    zhCN: [
      "课程目标是培养人力资源开发从业者、具备管理者或领导者潜力的人才、跨文化沟通与谈判人才，以及组织变革推动者。"
    ]
  },
  "Bachelor of Science with Honours (Industrial Design)": {
    en: [
      "Graduates are prepared to manage design projects, solve design problems creatively and ethically, pursue career advancement and explore entrepreneurship opportunities in industrial design and related creative fields."
    ],
    zhCN: [
      "毕业生可面向设计项目管理、创新且合乎伦理的设计问题解决、职业进阶，以及工业设计和相关创意领域的创业机会发展。"
    ]
  },
  "Bachelor of Electronic Systems Engineering with Honours": {
    en: [
      "Official career directions include electrical or electronics engineer, automation system developer and E&E product sales or marketing engineer."
    ],
    zhCN: [
      "官方职业方向包括电气/电子工程师、自动化系统开发人员，以及电气电子产品销售或营销工程师。"
    ]
  },
  "Bachelor of Chemical Process Engineering with Honours": {
    en: [
      "Graduates may seek employment as technical sales engineers and in chemical, biochemical, water treatment and wastewater treatment industries."
    ],
    zhCN: [
      "毕业生可从事技术销售工程师等岗位，并进入化学、生物化学、水处理和废水处理等行业。"
    ]
  }
};

function undergraduateCourseSetting(candidate: UTMProgrammeCandidate): LocalizedStringArray {
  return localizedArray(undergraduateCourseSettingItems[candidate.nameEnOfficial]);
}

function undergraduateCareerDirections(candidate: UTMProgrammeCandidate): LocalizedStringArray {
  return localizedArray(undergraduateCareerDirectionItems[candidate.nameEnOfficial]);
}

function resolvedUndergraduateFieldCoverage(
  candidate: UTMProgrammeCandidate,
  curriculum: LocalizedStringArray,
  careers: LocalizedStringArray
) {
  const coverage = { ...candidate.fieldCoverage };
  if ((curriculum.en || []).length) coverage.curriculum = "official-value";
  if ((careers.en || []).length) coverage.careers = "official-value";
  if (coverage.localization === "pending-after-fact-lock") coverage.localization = "localized-from-official-facts";
  return coverage;
}

function readArgValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function countBy<T>(items: T[], readKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = readKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function localizedProgrammeName(name: string): LocalizedText {
  const translated = programmeNameTranslations[name];
  return t(name, translated?.zhCN || name, translated?.zhTW || translated?.zhCN || name, name);
}

function facultyText(faculty: string): LocalizedText {
  return facultyTranslations[faculty] || t(faculty);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 84);
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const haystack = `${name} ${faculty}`.toLowerCase();
  if (/computer|software|artificial intelligence|network|multimedia/.test(haystack)) return "it";
  if (/architecture|planning|design|human resource|psychology|landscape|real estate|quantity surveying/.test(haystack)) return "arts";
  if (/engineering|geomatics|chemical|mechanical|electrical|electronic|petroleum|nuclear|naval|offshore/.test(haystack)) return "engineering";
  if (/business|management|accounting|finance|economics/.test(haystack)) return "business";
  return "science";
}

function normalizeText(value: string | null | undefined, maxLength = 1800) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function splitOfficialText(value: string | null | undefined, maxItems = 8) {
  const text = normalizeText(value, 1400);
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 24)
    .slice(0, maxItems);
}

function isCurrentCycleReady(candidate: UTMProgrammeCandidate) {
  return candidate.canonicalDecision.currentCycleStatus === "ready-for-detail-enrichment";
}

function isCurrentCycleNotOpen(candidate: UTMProgrammeCandidate) {
  return ["current-cycle-not-open", "international-unavailable-current-cycle"].includes(
    candidate.canonicalDecision.currentCycleStatus
  );
}

function chinaRequirementForCandidate(candidate: UTMProgrammeCandidate) {
  const haystack = `${candidate.nameEnOfficial} ${candidate.facultyEn}`;
  if (/Engineering|Mechanical|Electrical|Chemical|Petroleum|Nuclear|Naval|Offshore/i.test(haystack)) {
    return {
      field: "Engineering",
      en: "China qualification route: Senior Secondary School Graduation Certificate, or Graduation Certificate from a Vocational / Technical Secondary School (Zhixiao / Zhigao) or Skilled Worker School (Jixiao); Engineering requires scores of at least 70% in Mathematics and Physics, plus Chemistry or Biology.",
      zhCN:
        "中国申请路径：高中毕业证书，或职业/技术中学毕业证书（职校/职高）或技工学校毕业证书；工程类要求数学和物理成绩不低于 70%，并满足化学或生物其一。",
      zhTW:
        "中國申請路徑：高中畢業證書，或職業/技術中學畢業證書（職校/職高）或技工學校畢業證書；工程類要求數學和物理成績不低於 70%，並滿足化學或生物其一。"
    };
  }
  return {
    field: "Social Science",
    en: "China qualification route: Senior Secondary School Graduation Certificate, or Graduation Certificate from a Vocational / Technical Secondary School (Zhixiao / Zhigao) or Skilled Worker School (Jixiao); Social Science requires scores of at least 70% in any three accepted subjects such as Mathematics, Physics, Biology, Chemistry, Geography, Economy, Accounting, Business Management, ICT, Computer Science, Programming, Computing, Art and Design, or Visual Arts.",
    zhCN:
      "中国申请路径：高中毕业证书，或职业/技术中学毕业证书（职校/职高）或技工学校毕业证书；社科类要求任意 3 门认可科目成绩不低于 70%，科目包括数学、物理、生物、化学、地理、经济、会计、商业管理、信息与通信技术、计算机科学、编程、计算、艺术设计或视觉艺术等。",
    zhTW:
      "中國申請路徑：高中畢業證書，或職業/技術中學畢業證書（職校/職高）或技工學校畢業證書；社科類要求任意 3 門認可科目成績不低於 70%，科目包括數學、物理、生物、化學、地理、經濟、會計、商業管理、資訊與通訊技術、電腦科學、程式設計、計算、藝術設計或視覺藝術等。"
  };
}

function formatYears(value: number) {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} years`;
}

function durationEvidence(candidate: UTMProgrammeCandidate) {
  const detailDuration = candidate.programmeDetail?.duration;
  if (detailDuration?.status !== "programme-specific") {
    throw new Error(`UTM undergraduate row ${candidate.ordinal} has no official programme-specific duration evidence.`);
  }
  const officialText = detailDuration.officialText;
  if (!officialText) {
    throw new Error(`UTM undergraduate row ${candidate.ordinal} has no official duration text.`);
  }
  const yearsFromSemesters =
    typeof detailDuration.semesters === "number" && detailDuration.semesters >= 6 && detailDuration.semesters <= 12
      ? detailDuration.semesters / 2
      : null;
  const years =
    typeof detailDuration.minYears === "number" && detailDuration.minYears >= 3 && detailDuration.minYears <= 6
      ? detailDuration.minYears
      : yearsFromSemesters;
  if (years == null || !Number.isFinite(years)) {
    throw new Error(`UTM undergraduate row ${candidate.ordinal} has invalid official duration evidence.`);
  }
  if (yearsFromSemesters != null && detailDuration.minYears != null && Math.abs(detailDuration.minYears - yearsFromSemesters) > 0.01) {
    throw new Error(
      `UTM undergraduate row ${candidate.ordinal} has conflicting duration years and semesters: ${detailDuration.minYears} years vs ${detailDuration.semesters} semesters.`
    );
  }
  return { detailDuration, officialText, years };
}

function durationYears(candidate: UTMProgrammeCandidate) {
  return durationEvidence(candidate).years;
}

function durationOfficial(candidate: UTMProgrammeCandidate) {
  const { detailDuration, officialText, years } = durationEvidence(candidate);
  const semesterNote = detailDuration.semesters ? ` (${detailDuration.semesters} semesters)` : "";
  const notes = [`Standardized duration: ${formatYears(years)}${semesterNote}.`];
  if (detailDuration.maxYears) notes.push(`Official maximum duration: ${formatYears(detailDuration.maxYears)}.`);
  notes.push(`Official source: ${officialText.trim()}`);
  return notes.join(" ");
}

function durationOfficialHasStandardizedYear(value: unknown) {
  return /^Standardized duration:\s*\d+(?:\.\d+)?\s+years\b/i.test(String(value || ""));
}

function tuitionDisplay(value: number) {
  return `MYR ${value.toLocaleString("en-US")} total programme tuition`;
}

function annualTuitionCny(totalMyr: number, years: number) {
  return Math.round((totalMyr / Math.max(years, 1)) * cnyPerMyr);
}

function sourceLinks(candidate: UTMProgrammeCandidate): OfficialSourceLink[] {
  const links: OfficialSourceLink[] = [];
  const detailUrl = candidate.programmeDetail?.sourceUrl || candidate.sourceUrls.detail || candidate.detailUrl;
  if (detailUrl) {
    links.push({
      title: "UTM official programme detail",
      url: detailUrl,
      sourceType: "profile",
      verifiedAt,
      status: "official-verified"
    });
  }
  const supplementalDurationEvidence = candidate.programmeDetail?.supplementalDurationEvidence;
  if (supplementalDurationEvidence?.sourceUrl && supplementalDurationEvidence.sourceUrl !== detailUrl) {
    links.push({
      title: "UTM official supplemental programme duration evidence",
      url: supplementalDurationEvidence.sourceUrl,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified"
    });
  }
  for (const courseSource of undergraduateCourseSourceLinks[candidate.nameEnOfficial] || []) {
    links.push({
      title: courseSource.title,
      url: courseSource.url,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified"
    });
  }
  const sourceMap: Array<[string, string, OfficialSourceLink["sourceType"]]> = [
    ["UTM international undergraduate catalogue", candidate.sourceUrls.catalogue, "admission"],
    ["UTM September 2026 international undergraduate intake PDF", candidate.sourceUrls.currentIntakePdf, "official-website"],
    ["UTM international undergraduate programme fees", candidate.sourceUrls.fees, "fee"],
    ["UTM international undergraduate entry requirements", candidate.sourceUrls.entryRequirements, "entry-requirement"],
    ["UTM undergraduate English language requirements", candidate.sourceUrls.languageRequirements, "entry-requirement"]
  ];
  for (const [title, url, sourceType] of sourceMap) {
    if (!url) continue;
    links.push({ title, url, sourceType, verifiedAt, status: "official-verified" });
  }
  return links.filter(
    (link, index, allLinks) => allLinks.findIndex((candidateLink) => candidateLink.title === link.title && candidateLink.url === link.url) === index
  );
}

export function validateUtmUndergraduateCandidate(dataset: UTMCandidateDataset) {
  const errors: string[] = [];
  if (dataset.universityCode !== "UTM") errors.push("Candidate universityCode must be UTM.");
  if (dataset.level !== "bachelor") errors.push("Candidate level must be bachelor.");
  if (dataset.applicantScope !== "international") errors.push("Candidate applicantScope must be international.");
  if (dataset.programmeCount !== dataset.programmes.length) errors.push("programmeCount must match programmes length.");
  const ready = dataset.programmes.filter(isCurrentCycleReady);
  const currentCycleNotOpen = dataset.programmes.filter(isCurrentCycleNotOpen);
  if (dataset.programmes.length !== 44) errors.push(`Expected 44 canonical UTM undergraduate rows; got ${dataset.programmes.length}.`);
  if (ready.length !== 40) errors.push(`Expected 40 ready UTM undergraduate rows; got ${ready.length}.`);
  if (currentCycleNotOpen.length !== 4) errors.push(`Expected 4 current-cycle not-open rows; got ${currentCycleNotOpen.length}.`);
  for (const record of dataset.programmes) {
    try {
      durationEvidence(record);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Row ${record.ordinal} has invalid duration evidence.`);
    }
  }
  for (const record of ready) {
    if (record.level !== "bachelor") errors.push(`Row ${record.ordinal} is not bachelor level.`);
    if (record.applicantScope !== "international") errors.push(`Row ${record.ordinal} is not international applicant scope.`);
    if (!record.nameEnOfficial) errors.push(`Row ${record.ordinal} has no official English name.`);
    if (!record.facultyEn) errors.push(`Row ${record.ordinal} has no faculty.`);
    if (!record.tuition?.totalTuitionMYR) errors.push(`Row ${record.ordinal} has no official total tuition MYR.`);
    if (record.languageRequirements?.scores?.IELTS == null) errors.push(`Row ${record.ordinal} has no IELTS route.`);
    if (record.programmeDetail?.status !== "official-detail-parsed") errors.push(`Row ${record.ordinal} has no parsed official detail page.`);
  }
  for (const record of currentCycleNotOpen) {
    if (record.level !== "bachelor") errors.push(`Row ${record.ordinal} is not bachelor level.`);
    if (record.applicantScope !== "international") errors.push(`Row ${record.ordinal} is not international applicant scope.`);
    if (!record.tuition?.totalTuitionMYR) errors.push(`Row ${record.ordinal} has no official total tuition MYR.`);
    if (!record.intakeText || !/not offered/i.test(record.intakeText)) errors.push(`Row ${record.ordinal} has no official current-cycle not-open intake text.`);
    if (record.languageRequirements?.scores?.IELTS == null) errors.push(`Row ${record.ordinal} has no IELTS route.`);
  }
  return errors;
}

function buildUniversityRow(readyProgramCount: number, canonicalProgramCount: number, currentCycleNotOpenRows: number): DeepPartial<UniversityEntity> {
  const officialSources: OfficialSourceLink[] = [
    {
      title: "UTM international undergraduate catalogue",
      url: "https://admission.utm.my/offered-allcourses-international/",
      sourceType: "admission",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international undergraduate programme fees",
      url: "https://admission.utm.my/programme-fees-ug-international/",
      sourceType: "fee",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international undergraduate entry requirements",
      url: "https://admission.utm.my/entry-requirements-ug-international/",
      sourceType: "entry-requirement",
      verifiedAt,
      status: "official-verified"
    }
  ];
  return {
    slug: "utm",
    code: "UTM",
    name: t("Universiti Teknologi Malaysia", "马来西亚理工大学", "馬來西亞理工大學", "Universiti Teknologi Malaysia"),
    shortName: "UTM",
    logoUrl: "https://www.utm.my/wp-content/uploads/2020/12/cropped-logo-utm-512.png",
    imageUrl: "https://www.utm.my/wp-content/uploads/2020/12/cropped-logo-utm-512.png",
    color: "#8A1538",
    qsRank: 158,
    qsAsiaRank: null,
    location: t("Johor Bahru, Johor and Kuala Lumpur", "柔佛新山及吉隆坡", "柔佛新山及吉隆坡", "Johor Bahru, Johor dan Kuala Lumpur"),
    region: t("Johor / Kuala Lumpur", "柔佛 / 吉隆坡", "柔佛 / 吉隆坡", "Johor / Kuala Lumpur"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1972,
    students: 0,
    intlStudents: 0,
    csrCertified: false,
    description: t(
      "Universiti Teknologi Malaysia is a Malaysian public research university with official international undergraduate admissions through UTM Admission.",
      "马来西亚理工大学是马来西亚公立研究型大学，本科国际招生以 UTM Admission 官方页面为准。",
      "馬來西亞理工大學是馬來西亞公立研究型大學，本科國際招生以 UTM Admission 官方頁面為準。",
      "Universiti Teknologi Malaysia ialah universiti penyelidikan awam Malaysia; kemasukan antarabangsa prasiswazah dirujuk kepada halaman rasmi UTM Admission."
    ),
    website: "https://www.utm.my/",
    admissionEmail: "admission@utm.my",
    nameEnOfficial: "Universiti Teknologi Malaysia",
    officialWebsite: "https://www.utm.my/",
    studyPortalUrl: "https://admission.utm.my/",
    internationalPageUrl: "https://admission.utm.my/undergraduate-international/",
    applicationPortalUrl: "http://smart.utm.my/admission/",
    officialAddress: "Universiti Teknologi Malaysia, 81310 UTM Johor Bahru, Johor, Malaysia",
    applicationPeriods: ["February", "September"],
    applicationFees: null,
    applicationDocuments: arr(
      [
        "Academic certificate and transcript",
        "Passport biodata page",
        "English language result",
        "Programme-specific supporting documents when required"
      ],
      ["学历证书与成绩单", "护照资料页", "英语语言成绩", "如项目要求，提交专项补充材料"],
      ["學歷證書與成績單", "護照資料頁", "英語語言成績", "如課程要求，提交專項補充材料"]
    ),
    chinaStudentRequirements: arr([
      "China undergraduate applicants use UTM's country-specific table. For Engineering, China requires at least 70% in Mathematics and Physics plus Chemistry or Biology; for Social Science, China requires at least 70% in any three accepted subjects."
    ]),
    officialProfile: {
      collectionScope: "UTM undergraduate international candidate import",
      academicSession: "September 2026 intake candidate plus current UTM undergraduate admission pages",
      cnyDisplayRateNote: `CNY display uses internal review conversion ${cnyPerMyr} CNY/MYR and is not an official UTM amount.`,
      catalogStatusSummary: {
        all: {
          total: canonicalProgramCount,
          ready: readyProgramCount,
          currentCycleNotOpen: currentCycleNotOpenRows,
          needsReview: 0,
          notAvailableForInternational: 0
        },
        byLevel: {
          bachelor: {
            total: canonicalProgramCount,
            ready: readyProgramCount,
            currentCycleNotOpen: currentCycleNotOpenRows,
            needsReview: 0,
            notAvailableForInternational: 0
          },
          master: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 },
          phd: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 }
        }
      }
    },
    officialSources,
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified",
    officialAuditSummary: `UTM undergraduate official import: ${canonicalProgramCount} canonical bachelor programmes are published from official UTM sources; ${readyProgramCount} are current-cycle open rows and ${currentCycleNotOpenRows} are official catalogue rows whose 2026/2027 September and February intakes are not open in the current cycle.`,
    publicDisplayStatus: "ready",
    livingCostOfficialNote: null,
    tuitionMinCny: 0,
    tuitionMaxCny: 0,
    livingCostCny: 0,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: arr([]),
    highlights: arr(
      ["Official UTM international undergraduate catalogue", "Official UTM international undergraduate fee table"],
      ["UTM 国际本科官方目录", "UTM 国际本科官方学费表"],
      ["UTM 國際本科官方目錄", "UTM 國際本科官方學費表"]
    ),
    programCount: canonicalProgramCount,
    isPublished: true
  };
}

export function buildUtmUndergraduateProgramRows(dataset: UTMCandidateDataset): DeepPartial<ProgramEntity>[] {
  const applicationDocs = [
    "Academic certificate and transcript",
    "Passport biodata page",
    "English language result",
    "Programme-specific supporting documents when required"
  ];
  return dataset.programmes
    .map((candidate) => {
      const isReady = isCurrentCycleReady(candidate);
      const years = durationYears(candidate);
      const totalMyr = candidate.tuition.totalTuitionMYR;
      const translatedFaculty = facultyText(candidate.facultyEn);
      const detail = candidate.programmeDetail;
      const mqaCodes = detail?.mqaCodes || [];
      const sourceStatus: OfficialSourceStatus = isReady
        ? "official-verified"
        : "official-page-verified-current-cycle-not-open";
      const publicDisplayStatus: PublicDisplayStatus = isReady ? "ready" : "current-cycle-not-open";
      const feeStatus: FeeAuditStatus = "matched-official";
      const curriculum = undergraduateCourseSetting(candidate);
      const careers = undergraduateCareerDirections(candidate);
      const overview = normalizeText(detail?.overviewText, 650);
      const durationNote = durationOfficial(candidate);
      const programmeAcademicRequirement = normalizeText(detail?.entryRequirementText, 900);
      const chinaRequirement = chinaRequirementForCandidate(candidate);
      const fieldCoverage = resolvedUndergraduateFieldCoverage(candidate, curriculum, careers);
      const auditFlags = Object.entries(fieldCoverage)
        .filter(([, status]) => ["not-confirmed", "pending-after-fact-lock"].includes(status))
        .map(([field, status]) => `${field}:${status}`);

      return {
        slug: `${UTM_UNDERGRADUATE_IMPORT_SLUG_PREFIX}${String(candidate.ordinal).padStart(3, "0")}-${slugify(
          candidate.nameEnOfficial
        )}`,
        code: `UTM-UG-${String(candidate.ordinal).padStart(3, "0")}`,
        name: localizedProgrammeName(candidate.nameEnOfficial),
        nameEnOfficial: candidate.nameEnOfficial,
        level: "bachelor",
        category: inferCategory(candidate.nameEnOfficial, candidate.facultyEn),
        faculty: translatedFaculty,
        facultyZh: translatedFaculty["zh-CN"],
        studyMode: detail?.studyMode && detail.studyMode !== "not-confirmed" ? detail.studyMode : "full-time",
        campus: (candidate.canonicalDecision.campuses || []).join(" / ") || "UTM Johor Bahru",
        durationYears: years,
        durationOfficial: durationNote,
        annualTuitionCny: annualTuitionCny(totalMyr, years),
        tuitionAmount: totalMyr,
        tuitionCurrency: "MYR",
        tuitionDisplay: tuitionDisplay(totalMyr),
        officialTuitionMYR: totalMyr,
        officialTuitionNote: `Official UTM international undergraduate fee table total for ${candidate.tuition.feeCategory}: semester 1 MYR ${candidate.tuition.semester1MYR.toLocaleString(
          "en-US"
        )}; semesters 2-8 MYR ${candidate.tuition.semester2To8MYR.toLocaleString("en-US")}; total MYR ${totalMyr.toLocaleString(
          "en-US"
        )}.`,
        officialFeeSourceUrl: candidate.sourceUrls.fees,
        secondaryOfficialFeeSourceUrl: candidate.sourceUrls.currentIntakePdf,
        officialFeeAuditStatus: feeStatus,
        officialFeeAuditedAt: verifiedAt,
        intakeMonths: candidate.intakeMonths,
        officialIntake: candidate.intakeText,
        officialIntakeNote: isReady
          ? "Intake captured from the UTM international programme directory and cross-checked against the September 2026 intake PDF where present."
          : "UTM official international undergraduate directory marks this programme as not offered for both September and February in the 2026/2027 academic session; this is a current-cycle intake status, not a permanent international-ineligibility rule.",
        languageRequirement: {
          ielts: candidate.languageRequirements.scores.IELTS ?? 5.5,
          toefl: candidate.languageRequirements.scores.TOEFL_iBT ?? null,
          pte: candidate.languageRequirements.scores.PTE_Academic ?? null,
          muet: candidate.languageRequirements.scores.MUET ?? null
        },
        officialLanguageRequirement: `${candidate.languageRequirements.sourceText} Parsed routes: IELTS ${
          candidate.languageRequirements.scores.IELTS ?? "N/A"
        }, TOEFL iBT ${candidate.languageRequirements.scores.TOEFL_iBT ?? "N/A"}, MUET ${
          candidate.languageRequirements.scores.MUET ?? "N/A"
        }, PTE Academic ${candidate.languageRequirements.scores.PTE_Academic ?? "N/A"}, Cambridge/Linguaskill ${
          candidate.languageRequirements.scores.Cambridge_Linguaskill ?? "N/A"
        }, ELS CIEP ${candidate.languageRequirements.scores.ELS_CIEP ?? "N/A"}.`,
        requirement: {
          gpa: 0,
          gaokaoRequired: false,
          huikaoRequired: false,
          note: t(
            `${undergraduateAcademicRequirementText(candidate)} ${chinaRequirement.en}`,
            `需具备高中毕业证书或同等大学预科资格，并满足英语要求。${requiresUtmUndergraduateInterview(candidate) ? "该专业需通过 UTM 面试。" : ""}${chinaRequirement.zhCN}`,
            `需具備高中畢業證書或同等大學預科資格，並滿足英語要求。${requiresUtmUndergraduateInterview(candidate) ? "該專業需通過 UTM 面試。" : ""}${chinaRequirement.zhTW}`
          )
        },
        officialAcademicRequirement: `${undergraduateAcademicRequirementText(candidate)} China ${chinaRequirement.field}: ${chinaRequirement.en}`,
        chinaStudentRequirement: `${chinaRequirement.zhCN} / ${chinaRequirement.en}`,
        specialRequirementsNote: undergraduateSpecialRequirementsNote(candidate),
        applicationDocs: arr(
          applicationDocs,
          ["学历证书与成绩单", "护照资料页", "英语语言成绩", "如项目要求，提交专项补充材料"],
          ["學歷證書與成績單", "護照資料頁", "英語語言成績", "如課程要求，提交專項補充材料"]
        ),
        curriculum,
        careers,
        specializations: arr([]),
        description: t(
          overview || `${candidate.nameEnOfficial} is listed by UTM for international undergraduate admission under ${candidate.facultyEn}.`,
          `${candidate.nameEnOfficial} 已列入 UTM 国际本科招生目录，隶属${translatedFaculty["zh-CN"]}。`,
          `${candidate.nameEnOfficial} 已列入 UTM 國際本科招生目錄，隸屬${translatedFaculty["zh-TW"]}。`
        ),
        officialAccreditationNote: [...(detail?.accreditation || []), ...mqaCodes].join("; ") || null,
        officialSourceUrl: detail?.sourceUrl || candidate.sourceUrls.detail || candidate.detailUrl,
        officialEntryRequirementSourceUrl: candidate.sourceUrls.entryRequirements,
        officialAccreditationSourceUrl: detail?.sourceUrl || "",
        sourceUrls: sourceLinks(candidate),
        officialVerifiedAt: verifiedAt,
        officialSourceStatus: sourceStatus,
        publicDisplayStatus,
        publicDisplayNote: isReady
          ? "Published from official UTM sources. Official-unpublished detail fields are retained in audit coverage and are not inferred."
          : "Published for official catalogue completeness. UTM marks this programme as not offered for both September and February intakes in the 2026/2027 academic session; official country-specific international entry requirements remain published separately.",
        reviewReason: isReady
          ? auditFlags.length ? `Weak-field follow-up: ${auditFlags.join(", ")}.` : null
          : `Official UTM current-cycle intake status: ${candidate.intakeText}`,
        auditNote: [
          `Imported from UTM undergraduate official candidate ordinal ${candidate.ordinal}.`,
          `Canonical current-cycle status: ${candidate.canonicalDecision.currentCycleStatus}.`,
          `Detail status: ${detail?.status || "missing"}.`,
          `Duration display note: ${durationNote}`,
          `Supplemental duration evidence: ${JSON.stringify(detail?.supplementalDurationEvidence || null)}.`,
          `Programme academic requirement detail evidence: ${programmeAcademicRequirement || "n/a"}.`,
          `Local source path: ${detail?.sourcePath || "n/a"}.`,
          `Resolved import field coverage: ${JSON.stringify(fieldCoverage)}.`,
          `Original field coverage: ${JSON.stringify(candidate.fieldCoverage)}.`
        ].join(" "),
        listTuitionText: tuitionDisplay(totalMyr),
        isPublished: true
      };
    });
}

export function summarizeUtmUndergraduateImport(dataset: UTMCandidateDataset, rows: DeepPartial<ProgramEntity>[]): UTMImportSummary {
  const currentCycleNotOpenRows = dataset.programmes.filter(isCurrentCycleNotOpen).length;
  return {
    candidateRows: dataset.programmes.length,
    readyRows: dataset.programmes.filter(isCurrentCycleReady).length,
    currentCycleNotOpenRows,
    unavailableCurrentCycleRows: currentCycleNotOpenRows,
    importRows: rows.length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialTotalFeeRows: rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official").length,
    officialDurationRows: rows.filter((row) => Number(row.durationYears || 0) > 0 && durationOfficialHasStandardizedYear(row.durationOfficial)).length,
    detailParsedRows: dataset.programmes.filter(
      (item) =>
        isCurrentCycleReady(item) &&
        item.programmeDetail?.status === "official-detail-parsed"
    ).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

function verifyUtmUndergraduateImportedRecordSet(
  rows: ProgramEntity[],
  legacyBachelorPublicRows: number,
  expectedRows: number
): UTMImportVerification {
  const readyRows = rows.filter((row) => row.publicDisplayStatus === "ready");
  const currentCycleNotOpenRows = rows.filter((row) => row.publicDisplayStatus === "current-cycle-not-open");
  const publishedRows = rows.filter((row) => row.isPublished);
  const notAvailableForInternationalRows = rows.filter((row) => row.publicDisplayStatus === "not-available-for-international");
  const officialTotalFeeRows = rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official");
  const levelRows = rows.filter((row) => row.level === "bachelor");
  const languageRows = rows.filter((row) => Number(row.languageRequirement?.ielts || 0) >= 5.5);
  const sourceLinkedRows = rows.filter((row) => (row.sourceUrls || []).length >= 5);
  const officialDurationRows = rows.filter(
    (row) =>
      Number(row.durationYears || 0) > 0 &&
      !!row.durationOfficial &&
      durationOfficialHasStandardizedYear(row.durationOfficial) &&
      !/Displayed as 4 years|not applicable|not open to international applicants/i.test(String(row.durationOfficial))
  );
  if (
    rows.length !== expectedRows ||
    readyRows.length !== 40 ||
    currentCycleNotOpenRows.length !== 4 ||
    publishedRows.length !== expectedRows ||
    notAvailableForInternationalRows.length !== 0 ||
    officialTotalFeeRows.length !== expectedRows ||
    officialDurationRows.length !== expectedRows ||
    levelRows.length !== expectedRows ||
    languageRows.length !== expectedRows ||
    sourceLinkedRows.length !== expectedRows ||
    legacyBachelorPublicRows !== 0
  ) {
    throw new Error(
      `UTM import verification failed: expected=${expectedRows}, actual=${rows.length}, ready=${readyRows.length}, currentCycleNotOpen=${currentCycleNotOpenRows.length}, published=${publishedRows.length}, notAvailable=${notAvailableForInternationalRows.length}, officialFees=${officialTotalFeeRows.length}, officialDurations=${officialDurationRows.length}, level=${levelRows.length}, language=${languageRows.length}, sourceLinks=${sourceLinkedRows.length}, legacyPublic=${legacyBachelorPublicRows}.`
    );
  }
  return {
    importedRows: rows.length,
    readyRows: readyRows.length,
    currentCycleNotOpenRows: currentCycleNotOpenRows.length,
    publishedRows: publishedRows.length,
    notAvailableForInternationalRows: notAvailableForInternationalRows.length,
    legacyBachelorPublicRows,
    officialTotalFeeRows: officialTotalFeeRows.length,
    officialDurationRows: officialDurationRows.length,
    levelRows: levelRows.length,
    languageRows: languageRows.length,
    sourceLinkedRows: sourceLinkedRows.length,
    publicDisplayStatusCounts: countBy(rows, (row) => row.publicDisplayStatus),
    officialSourceStatusCounts: countBy(rows, (row) => row.officialSourceStatus),
    feeAuditStatusCounts: countBy(rows, (row) => row.officialFeeAuditStatus)
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number, expectedRows: number) {
  const repository = manager.getRepository(ProgramEntity);
  const rows = await repository.find({
    where: { universityId, slug: Like(`${UTM_UNDERGRADUATE_IMPORT_SLUG_PREFIX}%`) }
  });
  const legacyBachelorPublicRows = await repository.count({
    where: {
      universityId,
      level: "bachelor",
      isPublished: true,
      publicDisplayStatus: "ready",
      slug: Not(Like(`${UTM_UNDERGRADUATE_IMPORT_SLUG_PREFIX}%`))
    }
  });
  return verifyUtmUndergraduateImportedRecordSet(rows, legacyBachelorPublicRows, expectedRows);
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

async function updateUniversityAfterUndergraduateImport(manager: EntityManager, university: UniversityEntity, summary: UTMImportSummary) {
  const programRepo = manager.getRepository(ProgramEntity);
  const universityRepo = manager.getRepository(UniversityEntity);
  const bachelor = {
    total: summary.importRows,
    ready: summary.readyRows,
    currentCycleNotOpen: summary.currentCycleNotOpenRows,
    needsReview: 0,
    notAvailableForInternational: 0
  };
  const master = await visibleLevelSummary(programRepo, university.id, "master");
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
    collectionScope: "UTM official international bachelor, master and doctoral catalogue import",
    undergraduateCollectionScope: "UTM official international undergraduate candidate import",
    undergraduateAcademicSession: "September 2026 intake candidate plus current UTM undergraduate admission pages",
    cnyDisplayRateNote: `CNY display uses internal review conversion ${cnyPerMyr} CNY/MYR and is not an official UTM amount.`,
    catalogStatusSummary: {
      all,
      byLevel: { bachelor, master, phd }
    }
  };
  university.officialAuditSummary = `UTM official catalogue import: ${bachelor.total} bachelor rows, ${master.total} master rows, and ${phd.total} doctoral rows are public-visible from official UTM sources. Undergraduate fees include ${summary.officialTotalFeeRows} official total rows; ${summary.readyRows} rows are current-cycle open and ${summary.currentCycleNotOpenRows} rows are official catalogue rows whose 2026/2027 September and February intakes are not open in the current cycle.`;
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
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_UTM_UNDERGRADUATE_CANDIDATE_PATH);
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/utm-undergraduate-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const dataset = loadJson<UTMCandidateDataset>(candidatePath);
  const errors = validateUtmUndergraduateCandidate(dataset);
  if (errors.length) throw new Error(`UTM undergraduate candidate validation failed:\n${errors.join("\n")}`);
  const rows = buildUtmUndergraduateProgramRows(dataset);
  const summary = summarizeUtmUndergraduateImport(dataset, rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const dryRun = !verifyOnly && !process.argv.includes("--confirm-import");

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          universityCode: "UTM",
          scope: "undergraduate",
          candidatePath,
          writePolicy: {
            upsertPrefix: UTM_UNDERGRADUATE_IMPORT_SLUG_PREFIX,
            importRows: rows.length,
            publicVisibleRows: rows.length,
            publicReadyRows: 40,
            currentCycleNotOpenRows: 4,
            notAvailableForInternationalRows: 0,
            archiveLegacyPublicBachelorRows: true,
            currentCycleNotOpenRowsPublishedWithOfficialClosedStatus: true,
            readyRows: { isPublished: true, publicDisplayStatus: "ready" },
            currentCycleNotOpenRowsPolicy: { isPublished: true, publicDisplayStatus: "current-cycle-not-open" },
            cnyDisplayRateNote: `CNY display uses internal review conversion ${cnyPerMyr} CNY/MYR and is not an official UTM amount.`
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
    let university = await universityRepository.findOne({ where: { code: "UTM" } });
    if (verifyOnly) {
      if (!university) throw new Error("UTM university row not found.");
      const verification = await verifyImportedRows(dataSource, university.id, rows.length);
      console.log(
        JSON.stringify(
          {
            mode: "verified",
            universityId: university.id,
            summary,
            verification,
            universityProgramCount: university.programCount
          },
          null,
          2
        )
      );
      return;
    }

    const currentPrograms = university ? await dataSource.getRepository(ProgramEntity).find({ where: { universityId: university.id } }) : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );

    let verification: UTMImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const universityRepo = manager.getRepository(UniversityEntity);
      const programRepo = manager.getRepository(ProgramEntity);
      university = await universityRepo.findOne({ where: { code: "UTM" } });
      const readyProgramCount = dataset.programmes.filter(isCurrentCycleReady).length;
      const currentCycleNotOpenRows = dataset.programmes.filter(isCurrentCycleNotOpen).length;
      const universitySeed = buildUniversityRow(readyProgramCount, dataset.programmes.length, currentCycleNotOpenRows);
      university = await universityRepo.save(universityRepo.create({ ...universitySeed, id: university?.id }));

      await programRepo.update(
        {
          universityId: university.id,
          level: "bachelor",
          isPublished: true,
          publicDisplayStatus: "ready",
          slug: Not(Like(`${UTM_UNDERGRADUATE_IMPORT_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: "Archived by UTM undergraduate official import to prevent legacy public-list leakage."
        }
      );

      for (const row of rows) {
        const existing = await programRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await programRepo.save(programRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }
      verification = await verifyImportedRows(manager, university.id, rows.length);
      await updateUniversityAfterUndergraduateImport(manager, university, summary);
    });
    const cacheCleared = await clearCatalogCache();
    university = await universityRepository.findOne({ where: { code: "UTM" } });

    console.log(
      JSON.stringify(
        {
          mode: "imported",
          universityId: university?.id,
          backupPath,
          summary,
          verification,
          universityProgramCount: university?.programCount,
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
