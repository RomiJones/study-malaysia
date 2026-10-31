import "reflect-metadata";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DataSource } from "typeorm";
import type {
  DegreeLevel,
  FeeAuditStatus,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  ProgramCategoryCode,
  TuitionCurrency
} from "@studymy/shared";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";
import { loadEnvFiles } from "../config/env.js";

const verifiedAt = "2026-06-17";
const officialAuditDir = "data/imports/segi/2026-06-16/official-audit";
const feeSheetHash = "sha256:205ad0382161d445a2f849a8dae6df08ac6300594aaaebf074d1c2358eb094db";
const myrToCny = 1.55;

type OfficialCandidate = {
  title: string;
  courseId: string;
  fieldOfInterest: string;
  campus: string;
  detailUrl: string;
  standardLevel: DegreeLevel;
  deliveryMode: string;
  detail: {
    detailTitle: string;
    detailInfo: Record<string, string>;
    accordionSections?: Record<string, string>;
    overviewText?: string;
    entryRequirementsText: string;
    englishRequirementsText?: string;
    programmeStructureText?: string;
    careerText?: string;
    intakeText: string;
    accreditationText: string;
    mqaLinks: string[];
    hasTuitionOnPage: boolean;
  };
};

type ExistingFeeEvidence = {
  tuitionAmount: number | null;
  officialTuitionMYR: number | null;
  annualTuitionCny: number;
  tuitionDisplay: string;
  listTuitionText: string;
  officialTuitionNote: string | null;
  officialFeeAuditStatus: FeeAuditStatus;
  officialFeeAuditedAt: string | null;
};

type FeeSheetBackfill = {
  detailUrl: string;
  feeSheetCode: string;
  feeSheetName: string;
  totalMYR: number;
  durationYears: number;
  matchBasis: string;
};

type OfficialFeeGapEvidence = {
  brochureTitle: string;
  brochureUrl: string;
  brochureHash: string;
  note: string;
};

const t = (en: string, zhCN = en, zhTW = zhCN, ms = en): LocalizedText => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], zhCN = en, zhTW = zhCN, ms = en): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

const feeSheetBackfills: FeeSheetBackfill[] = [
  {
    detailUrl: "https://university.segi.edu.my/course/doctor-of-philosophy-information-technology-by-research-odl/",
    feeSheetCode: "SEGI-PHD-IT",
    feeSheetName: "Doctor of Philosophy in Information Technology",
    totalMYR: 77619.9,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet main PhD Information Technology row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/doctor-of-philosophy-education-by-research-odl/",
    feeSheetCode: "SEGI-PHD-EDU",
    feeSheetName: "Doctor of Philosophy in Education",
    totalMYR: 86301.3,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet main PhD Education row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/doctor-of-philosophy-management-by-research-odl/",
    feeSheetCode: "SEGI-PHD-MGMT",
    feeSheetName: "Doctor of Philosophy in Management",
    totalMYR: 77619.9,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet main PhD Management row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/msc-information-technology-by-research-odl/",
    feeSheetCode: "SEGI-MIT-RES",
    feeSheetName: "Master of Information Technology (By Research)",
    totalMYR: 59474.4,
    durationYears: 2,
    matchBasis: "ODL official URL is the research-mode MSc Information Technology page; mapped to the research fee-sheet row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-education-by-research-odl/",
    feeSheetCode: "SEGI-MED-RES",
    feeSheetName: "Master of Education (By Research)",
    totalMYR: 56135.4,
    durationYears: 2,
    matchBasis: "ODL official URL is the research-mode Master of Education page; mapped to the research fee-sheet row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-education-by-coursework-odl/",
    feeSheetCode: "SEGI-MED-CW",
    feeSheetName: "Master of Education (Coursework)",
    totalMYR: 52013.7,
    durationYears: 1,
    matchBasis: "ODL official URL is the coursework-mode Master of Education page; mapped to the coursework fee-sheet row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-business-administration-marketing/",
    feeSheetCode: "SEGI-MBA",
    feeSheetName: "Master of Business Administration",
    totalMYR: 59916,
    durationYears: 1,
    matchBasis: "MBA emphasis page maps to the 2026 fee-sheet MBA row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-business-administration-human-resource-management/",
    feeSheetCode: "SEGI-MBA",
    feeSheetName: "Master of Business Administration",
    totalMYR: 59916,
    durationYears: 1,
    matchBasis: "MBA emphasis page maps to the 2026 fee-sheet MBA row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-business-administration-global-business-2/",
    feeSheetCode: "SEGI-MBA",
    feeSheetName: "Master of Business Administration",
    totalMYR: 59916,
    durationYears: 1,
    matchBasis: "MBA emphasis page maps to the 2026 fee-sheet MBA row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-business-administration-global-business-odl/",
    feeSheetCode: "SEGI-MBA",
    feeSheetName: "Master of Business Administration",
    totalMYR: 59916,
    durationYears: 1,
    matchBasis: "MBA ODL emphasis page maps to the 2026 fee-sheet MBA row; no separate ODL total is published in the structured fee-sheet data."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-business-administration-general-management-odl/",
    feeSheetCode: "SEGI-MBA",
    feeSheetName: "Master of Business Administration",
    totalMYR: 59916,
    durationYears: 1,
    matchBasis: "MBA ODL emphasis page maps to the 2026 fee-sheet MBA row; no separate ODL total is published in the structured fee-sheet data."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-business-administration-general-management-2/",
    feeSheetCode: "SEGI-MBA",
    feeSheetName: "Master of Business Administration",
    totalMYR: 59916,
    durationYears: 1,
    matchBasis: "MBA emphasis page maps to the 2026 fee-sheet MBA row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/mba-finance/",
    feeSheetCode: "SEGI-MBA",
    feeSheetName: "Master of Business Administration",
    totalMYR: 59916,
    durationYears: 1,
    matchBasis: "MBA Finance page maps to the 2026 fee-sheet MBA row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/master-of-accountancy-odl/",
    feeSheetCode: "SEGI-MA",
    feeSheetName: "Master of Accounting",
    totalMYR: 63032.4,
    durationYears: 1,
    matchBasis: "ODL official title uses Accountancy and matches the fee-sheet Master of Accounting row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-psychology-honours-odl/",
    feeSheetCode: "SEGI-BPSY",
    feeSheetName: "Bachelor of Psychology (Hons)",
    totalMYR: 104713.5,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet Bachelor of Psychology row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-science-hons-optometry/",
    feeSheetCode: "SEGI-BOPTO",
    feeSheetName: "Bachelor of Optometry (Hons)",
    totalMYR: 141324.2,
    durationYears: 4,
    matchBasis: "Official title variant Bachelor of Science (Hons) Optometry maps to the fee-sheet Bachelor of Optometry row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-mass-communication-hons-odl/",
    feeSheetCode: "SEGI-BMC",
    feeSheetName: "Bachelor of Mass Communication (Hons)",
    totalMYR: 97648.6,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet Bachelor of Mass Communication row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-information-technology-hons-odl/",
    feeSheetCode: "SEGI-BIT",
    feeSheetName: "Bachelor of Information Technology (Hons)",
    totalMYR: 94558.7,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet Bachelor of Information Technology row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-hospitality-management-honours-odl/",
    feeSheetCode: "SEGI-BAHM",
    feeSheetName: "Bachelor of Hospitality and Tourism Management (Hons)",
    totalMYR: 94558.7,
    durationYears: 3,
    matchBasis: "ODL official Hospitality Management title maps to the fee-sheet Hospitality and Tourism Management row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-education-hons-odl/",
    feeSheetCode: "SEGI-BED",
    feeSheetName: "Bachelor of Education (Hons)",
    totalMYR: 98676.8,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet Bachelor of Education row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-computer-science-honours-odl/",
    feeSheetCode: "SEGI-BCS",
    feeSheetName: "Bachelor of Computer Science (Hons)",
    totalMYR: 102376.2,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet Bachelor of Computer Science row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-business-management-honours-odl/",
    feeSheetCode: "SEGI-BBM",
    feeSheetName: "Bachelor of Business Management (Hons)",
    totalMYR: 94558.7,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet Bachelor of Business Management row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-arts-hons-visual-communication-design-odl/",
    feeSheetCode: "SEGI-BVCD",
    feeSheetName: "Bachelor of Arts (Hons) in Visual Communication Design",
    totalMYR: 95253,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet Visual Communication Design row after removing delivery mode."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-in-multimedia-design-honours-odl/",
    feeSheetCode: "SEGI-BMMD",
    feeSheetName: "Bachelor of Arts (Hons) in Multimedia Design",
    totalMYR: 95253,
    durationYears: 3,
    matchBasis: "ODL official title maps to the 2026 fee-sheet Multimedia Design row."
  },
  {
    detailUrl: "https://university.segi.edu.my/course/bachelor-of-accounting-and-finance-honours-odl/",
    feeSheetCode: "SEGI-BAF",
    feeSheetName: "Bachelor of Accounting and Finance (Hons)",
    totalMYR: 89550.2,
    durationYears: 3,
    matchBasis: "ODL official title matches the 2026 fee-sheet Bachelor of Accounting and Finance row after removing delivery mode."
  }
];

const feeSheetBackfillByUrl = new Map(feeSheetBackfills.map((item) => [item.detailUrl, item]));

const officialFeeGapEvidenceByUrl = new Map<string, OfficialFeeGapEvidence>([
  [
    "https://university.segi.edu.my/course/master-of-science-in-environmental-sustainability-with-artificial-intelligence/",
    {
      brochureTitle: "SEGi official Postgraduate Studies brochure",
      brochureUrl: "https://www.segi.edu.my/brochures/Postgraduate%20Studies.pdf",
      brochureHash: "sha256:73b3957880f8164e29908ac89b52bb4052aa522e30d765ca4edbff9881d9a609",
      note: "Official programme page and official Postgraduate Studies brochure confirm programme identity and curriculum, but neither publishes a unique total tuition amount. The SEGi international-student page only publishes application and visa fees, not programme tuition."
    }
  ],
  [
    "https://university.segi.edu.my/course/doctor-of-philosophy-in-medical-science/",
    {
      brochureTitle: "SEGi official Postgraduate Studies brochure",
      brochureUrl: "https://www.segi.edu.my/brochures/Postgraduate%20Studies.pdf",
      brochureHash: "sha256:73b3957880f8164e29908ac89b52bb4052aa522e30d765ca4edbff9881d9a609",
      note: "Official programme page and official Postgraduate Studies brochure confirm programme identity, duration and research scope, but neither publishes a unique total tuition amount. The SEGi international-student page only publishes application and visa fees, not programme tuition."
    }
  ],
  [
    "https://university.segi.edu.my/course/bachelor-of-business-analytics-odl/",
    {
      brochureTitle: "SEGi official Business & Accounting brochure",
      brochureUrl: "https://www.segi.edu.my/brochures/Business%20%26%20Accounting.pdf",
      brochureHash: "sha256:85f405207cc6efc9ce05a9d21eb4de95537157f11ffcc10cf60dc49cbc164c87",
      note: "Official programme page and official Business & Accounting brochure confirm the ODL programme identity and curriculum, but neither publishes a unique total tuition amount. The SEGi international-student page only publishes application and visa fees, not programme tuition."
    }
  ]
]);

const programTitleZhByEn = new Map<string, string>([
  ["Doctor of Philosophy (Engineering)", "工程哲学博士"],
  ["Doctor of Philosophy in Information Technology (Online Mode)", "信息技术哲学博士（在线模式）"],
  ["Doctor of Philosophy (Information Technology)", "信息技术哲学博士"],
  ["Doctor of Philosophy (Education)", "教育哲学博士"],
  ["Doctor of Philosophy (Management)", "管理学哲学博士"],
  ["Doctor of Philosophy (Education) – ODL (Online Mode)", "教育哲学博士（开放远程学习/在线模式）"],
  ["Doctor of Business Administration", "工商管理博士"],
  ["PhD (Management) (Online Mode)", "管理学哲学博士（在线模式）"],
  ["Master of Science (Engineering)", "工程理学硕士"],
  ["Master of Science (Vision Science)", "视觉科学理学硕士"],
  ["Master of Science in Environmental Sustainability with Artificial Intelligence", "环境可持续发展与人工智能理学硕士"],
  ["Master of Science in Information Technology", "信息技术理学硕士"],
  ["Master of Science in Information Technology (Online Mode)", "信息技术理学硕士（在线模式）"],
  ["Master of Science (Information Technology)", "信息技术理学硕士"],
  ["Master of Science (Management)", "管理学理学硕士"],
  ["Master of Financial Planning", "金融规划硕士"],
  ["Master of Science (Pharmaceutical Sciences)", "药剂科学理学硕士"],
  ["Master of Laws (LL.M) in Advanced Legal Practice", "高级法律实务法学硕士（LL.M）"],
  ["Master of Education", "教育硕士"],
  ["Master of Education by Research", "研究型教育硕士"],
  ["Master of Education by Research – ODL (Online Mode)", "研究型教育硕士（开放远程学习/在线模式）"],
  ["Master of Education – ODL (Online Mode)", "教育硕士（开放远程学习/在线模式）"],
  ["Master of Business Administration (Marketing)", "工商管理硕士（市场营销）"],
  ["Master of Business Administration (Human Resource Management)", "工商管理硕士（人力资源管理）"],
  ["Master of Business Administration (Global Business)", "工商管理硕士（全球商务）"],
  ["Master of Business Administration (Global Business) – ODL (Online Mode)", "工商管理硕士（全球商务，开放远程学习/在线模式）"],
  ["Master of Business Administration (General Management) – ODL (Online Mode)", "工商管理硕士（综合管理，开放远程学习/在线模式）"],
  ["Master of Business Administration (with 11 emphasis to choose from)", "工商管理硕士（11 个方向可选）"],
  ["Master of Business Administration (General Management)", "工商管理硕士（综合管理）"],
  ["Master of Business Administration (Finance)", "工商管理硕士（金融）"],
  ["Master of Arts in Corporate Communications", "企业传播文学硕士"],
  ["Master of Accountancy", "会计学硕士"],
  ["Master of Accountancy – ODL (Online Mode)", "会计学硕士（开放远程学习/在线模式）"],
  ["Master of Social Science in Psychology", "心理学社会科学硕士"],
  ["Bachelor of Music (Honours)", "音乐荣誉学士"],
  ["Bachelor of Physiotherapy (Honours)", "物理治疗荣誉学士"],
  ["Bachelor in Quantity Surveying", "工料测量学士"],
  ["Bachelor of Science (Hons) Architecture", "建筑学理学荣誉学士"],
  ["Bachelor of Psychology (Honours) – ODL (Online Mode)", "心理学荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Psychology (Honours)", "心理学荣誉学士"],
  ["Bachelor of Pharmacy with Honours", "药剂学荣誉学士"],
  ["Bachelor of Science (Hons) Optometry", "视光学理学荣誉学士"],
  ["Bachelor of Optometry (Hons)", "视光学荣誉学士"],
  ["Bachelor of Medicine and Bachelor of Surgery (MBBS)", "医学与外科学士（MBBS）"],
  ["Doctor of Philosophy in Medical Science", "医学科学哲学博士"],
  ["Master of Medical Science", "医学科学硕士"],
  ["Bachelor of Mechatronics Engineering with Honours", "机电工程荣誉学士"],
  ["Bachelor of Mechanical Engineering with Honours", "机械工程荣誉学士"],
  ["Bachelor of Mass Communication (Hons) – ODL (Online Mode)", "大众传播荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Mass Communication (Hons)", "大众传播荣誉学士"],
  ["Bachelor of Information Technology (Hons) – ODL (Online Mode)", "信息技术荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Information Technology (Honours)", "信息技术荣誉学士"],
  ["Bachelor of Hospitality Management (Honours) – ODL (Online Mode)", "酒店管理荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Hospitality Management (Honours)", "酒店管理荣誉学士"],
  ["Bachelor of Electrical and Electronics Engineering with Honours", "电气与电子工程荣誉学士"],
  ["Bachelor of Education (Hons)", "教育荣誉学士"],
  ["Bachelor of Education (Hons) – ODL (Online Mode)", "教育荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Dental Surgery (BDS)", "牙科学士（BDS）"],
  ["Bachelor of Computer Science (Honours) – ODL (Online Mode)", "计算机科学荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Computer Science (Honours)", "计算机科学荣誉学士"],
  ["Bachelor of Civil Engineering with Honours", "土木工程荣誉学士"],
  ["Bachelor of Chemical Engineering with Honours", "化学工程荣誉学士"],
  ["Bachelor of Biomedical Sciences (Hons)", "生物医学科学荣誉学士"],
  ["Bachelor of Business Analytics (Online Mode)", "商业分析学士（在线模式）"],
  ["Bachelor of Business Management (Honours) – ODL (Online Mode)", "商业管理荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Business Management (Honours)", "商业管理荣誉学士"],
  ["Bachelor of International Business (Honours)", "国际商务荣誉学士"],
  ["Bachelor of Arts (Honours) Visual Communication Design – ODL (Online Mode)", "视觉传达设计文学荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Arts (Hons) Visual Communication Design", "视觉传达设计文学荣誉学士"],
  ["Bachelor in Multimedia Design (Honours) – ODL (Online Mode)", "多媒体设计荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Arts (Hons) Multimedia Design", "多媒体设计文学荣誉学士"],
  ["Master of Creative Design Management", "创意设计管理硕士"],
  ["Bachelor of Arts (Hons) in English and Public Relations", "英语与公共关系文学荣誉学士"],
  ["Bachelor of Arts (Honours) in Interior Architecture", "室内建筑文学荣誉学士"],
  ["Bachelor of Accounting and Finance (Honours) – ODL (Online Mode)", "会计与金融荣誉学士（开放远程学习/在线模式）"],
  ["Bachelor of Accounting and Finance (Honours)", "会计与金融荣誉学士"]
]);

const facultyZhByEn = new Map<string, string>([
  ["Accounting & Finance", "会计与金融"],
  ["Architecture", "建筑"],
  ["Biomedical Science", "生物医学科学"],
  ["Business", "商科"],
  ["Communication Studies", "传播学"],
  ["Creative Arts & Design", "创意艺术与设计"],
  ["Dentistry", "牙科"],
  ["Education", "教育"],
  ["Engineering", "工程"],
  ["Hospitality & Tourism", "酒店与旅游"],
  ["Information Technology", "信息技术"],
  ["Interior Architecture", "室内建筑"],
  ["Law", "法律"],
  ["Medicine", "医学"],
  ["Music", "音乐"],
  ["Optometry", "视光学"],
  ["Pharmacy", "药剂学"],
  ["Physiotherapy", "物理治疗"],
  ["Postgraduate Studies, Psychology", "研究生院，心理学"],
  ["Psychology", "心理学"],
  ["Quantity Surveying", "工料测量"]
]);

function repoRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function loadCandidates() {
  const path = join(repoRoot(), officialAuditDir, "candidate_dataset.json");
  return JSON.parse(readFileSync(path, "utf8")) as OfficialCandidate[];
}

function compact(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function urlSlug(url: string) {
  return new URL(url).pathname.split("/").filter(Boolean).pop() || "programme";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 92);
}

function codeFor(candidate: OfficialCandidate, index: number) {
  const slug = urlSlug(candidate.detailUrl).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toUpperCase();
  return `SEGI-O-${String(index + 1).padStart(2, "0")}-${slug}`.slice(0, 50);
}

function categoryFor(candidate: OfficialCandidate): ProgramCategoryCode {
  const value = `${candidate.title} ${candidate.fieldOfInterest}`.toLowerCase();
  if (/law|legal/.test(value)) return "law";
  if (/medicine|medical|dentistry|dental|pharmacy|pharmaceutical|optometry|vision|physiotherapy|biomedical/.test(value)) return "medicine";
  if (/engineering|quantity surveying/.test(value)) return "engineering";
  if (/information technology|computer|computing|artificial intelligence|business analytics/.test(value)) return "it";
  if (/business|accounting|finance|management|hospitality|tourism/.test(value)) return "business";
  if (/psychology|science/.test(value)) return "science";
  return "arts";
}

function facultyFor(candidate: OfficialCandidate) {
  const field = compact(candidate.fieldOfInterest).replace(/,\s*SEGi University Online/gi, "").replace(/,\s*Postgraduate Studies/gi, "");
  return field || candidate.detail.detailInfo["Level of Study"] || candidate.standardLevel;
}

function localizedProgramName(title: string) {
  const zhCN = programTitleZhByEn.get(title) || title;
  return t(title, zhCN, zhCN);
}

function localizedFaculty(faculty: string) {
  const zhCN = facultyZhByEn.get(faculty) || faculty;
  return t(faculty, zhCN, zhCN);
}

function facultyZhLabel(faculty: string) {
  return facultyZhByEn.get(faculty) || faculty;
}

function normalizedDuration(candidate: OfficialCandidate) {
  const title = candidate.title.toLowerCase();
  if (/medicine and bachelor of surgery|dental surgery/.test(title)) return 5;
  if (/pharmacy|physiotherapy|optometry|engineering|architecture/.test(title) && candidate.standardLevel === "bachelor") return 4;
  if (candidate.standardLevel === "bachelor") return 3;
  if (candidate.standardLevel === "master" && /(research|science \(engineering\)|science \(management\)|science \(information technology\)|vision science|pharmaceutical sciences|medical science)/i.test(candidate.title)) return 2;
  if (candidate.standardLevel === "master") return 1;
  return 3;
}

function durationOfficial(candidate: OfficialCandidate) {
  if (candidate.detail.accordionSections?.["Duration"]) return candidate.detail.accordionSections["Duration"];
  return `Official page did not publish a single parsed duration value; StudyMY uses ${normalizedDuration(candidate)} year(s) for filtering and keeps the official page as the duration authority.`;
}

function feeEvidenceFromBackfill(backfill: FeeSheetBackfill): ExistingFeeEvidence {
  const amountDisplay = backfill.totalMYR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    tuitionAmount: backfill.totalMYR,
    officialTuitionMYR: Math.round(backfill.totalMYR),
    annualTuitionCny: Math.round((backfill.totalMYR / Math.max(backfill.durationYears, 1)) * myrToCny),
    tuitionDisplay: `MYR ${amountDisplay} total 2026 fee sheet amount`,
    listTuitionText: `MYR ${amountDisplay} total`,
    officialTuitionNote: `Backfilled from provided 2026 SEGi fee-sheet row ${backfill.feeSheetCode} (${backfill.feeSheetName}). ${backfill.matchBasis} Source hash: ${feeSheetHash}.`,
    officialFeeAuditStatus: "fee-sheet-verified",
    officialFeeAuditedAt: verifiedAt
  };
}

function intakeMonths(text: string): string[] {
  const value = text.toLowerCase();
  const months = [
    ["January", /jan|1\/|13\/1|12\/1|3\/1/],
    ["February", /feb|24\/2|23\/2|28\/2/],
    ["March", /mar|7\/3/],
    ["May", /may|12\/5|11\/5|9\/5/],
    ["June", /jun|23\/6|22\/6|27\/6|3\/6|2\/6/],
    ["July", /jul|11\/7/],
    ["September", /sep|sept|15\/9|14\/9|22\/9|21\/9|13\/9/],
    ["October", /oct|27\/10|26\/10|31\/10/],
    ["November", /nov|14\/11/]
  ] as const;
  return months.filter(([, pattern]) => pattern.test(value)).map(([month]) => month);
}

function uniqueValues(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function extractDates(text: string) {
  return uniqueValues([...text.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)].map((match) => match[0]));
}

function normalizeOfficialIntake(candidate: OfficialCandidate) {
  const raw = compact(candidate.detail.intakeText);
  if (/september\s+only/i.test(raw)) return "September Only";

  const fullTimeStart = raw.search(/Full Time Mode/i);
  const weekendStart = raw.search(/Weekend Mode/i);
  if (fullTimeStart >= 0 || weekendStart >= 0) {
    const fullPart = fullTimeStart >= 0
      ? raw.slice(fullTimeStart, weekendStart >= 0 ? weekendStart : undefined)
      : "";
    const weekendPart = weekendStart >= 0 ? raw.slice(weekendStart) : "";
    const parts = [
      extractDates(fullPart).length ? `Full Time Mode: ${extractDates(fullPart).join(", ")}` : "",
      extractDates(weekendPart).length ? `Weekend Mode: ${extractDates(weekendPart).join(", ")}` : ""
    ].filter(Boolean);
    if (parts.length) return parts.join("; ");
  }

  const dates = extractDates(raw.split(/Orientation Dates/i)[0] || raw);
  if (dates.length) return `Intakes: ${dates.join(", ")}`;
  return "official-intake-unpublished";
}

function extractNumber(pattern: RegExp, text: string) {
  const match = text.match(pattern);
  if (!match) return null;
  return Number(match[1]);
}

function extractFirstNumber(patterns: RegExp[], text: string) {
  for (const pattern of patterns) {
    const value = extractNumber(pattern, text);
    if (value != null) return value;
  }
  return null;
}

function languageRequirement(candidate: OfficialCandidate): LanguageRequirement {
  const text = `${candidate.detail.englishRequirementsText || ""} ${candidate.detail.entryRequirementsText || ""}`;
  return {
    ielts: extractNumber(/IELTS(?:\s+score\s+of|\s+with\s+minimum\s+of\s+score)?\s*(?:minimum\s+of\s*)?([0-9]+(?:\.[0-9]+)?)/i, text) ?? 0,
    toefl: extractNumber(/TOEFL(?:\s+score\s+of)?\s*([0-9]+)/i, text),
    pte: extractNumber(/PTE(?:\s+Academic)?(?:\s+score\s+of)?\s*([0-9]+)/i, text),
    muet: extractFirstNumber([
      /MUET(?:\s+Band)?\s*([0-9]+(?:\.[0-9]+)?)/i,
      /Band\s*([0-9]+(?:\.[0-9]+)?)\s+in\s+MUET/i,
      /Band\s*([0-9]+(?:\.[0-9]+)?)\s+for\s+MUET/i
    ], text)
  };
}

function officialLanguageText(candidate: OfficialCandidate) {
  const explicit = compact(candidate.detail.englishRequirementsText);
  if (explicit) return explicit;
  const entry = compact(candidate.detail.entryRequirementsText);
  const sentence = entry.match(/(?:For international students|English Requirement|English proficiency requirement|IELTS|TOEFL|MUET)[^.。]{0,420}/i)?.[0];
  return compact(sentence) || "Official programme page does not publish a separate English-language requirement section; language-related text, if any, is included in the official academic requirement text.";
}

function gpaRequirement(candidate: OfficialCandidate) {
  const text = candidate.detail.entryRequirementsText || "";
  return extractNumber(/CGPA(?:\s+of\s+at\s+least|\s+minimum\s+of|\s+with\s+a\s+minimum\s+of|\s*)\s*([0-9]+(?:\.[0-9]+)?)/i, text)
    ?? extractNumber(/minimum\s+CGPA\s+of\s+([0-9]+(?:\.[0-9]+)?)/i, text)
    ?? (candidate.standardLevel === "bachelor" ? 2 : 2.75);
}

function splitOfficialText(text: string) {
  const clean = compact(text);
  if (!clean) return [];
  const parts = clean
    .split(/(?<=[.;])\s+(?=[A-Z(])|(?:\s+OR\s+)/)
    .map((item) => compact(item))
    .filter((item) => item.length > 12);
  return parts.length > 1 ? parts.slice(0, 30) : [clean];
}

function sourceLinks(candidate: OfficialCandidate, fee: ExistingFeeEvidence | undefined): OfficialSourceLink[] {
  const feeGap = officialFeeGapEvidenceByUrl.get(candidate.detailUrl);
  const links: OfficialSourceLink[] = [
    {
      title: `SEGi official programme page - ${candidate.title}`,
      url: candidate.detailUrl,
      sourceType: "profile",
      verifiedAt,
      status: "official-verified",
      note: "Canonical official programme identity, requirements, intake, curriculum and career source."
    },
    {
      title: `SEGi official entry requirement source - ${candidate.title}`,
      url: candidate.detailUrl,
      sourceType: "entry-requirement",
      verifiedAt,
      status: "official-verified",
      note: "Entry and language requirements are parsed from this official programme page."
    }
  ];
  if (feeGap) {
    links.push({
      title: `${feeGap.brochureTitle} - fee gap checked`,
      url: feeGap.brochureUrl,
      sourceType: "fee",
      verifiedAt,
      status: "official-verified",
      note: `${feeGap.note} Evidence hash: ${feeGap.brochureHash}.`
    });
    links.push({
      title: "SEGi official international-student application fee page",
      url: "https://university.segi.edu.my/international-students/",
      sourceType: "admission",
      verifiedAt,
      status: "official-verified",
      note: "Checked as an official payment source. It publishes application and visa fees only, so it is not used as programme tuition evidence."
    });
  }
  if (candidate.detail.mqaLinks?.[0]) {
    links.push({
      title: `MQA certificate - ${candidate.title}`,
      url: candidate.detail.mqaLinks[0],
      sourceType: "accreditation",
      verifiedAt,
      status: "official-verified",
      note: "Official MQA certificate linked from the SEGi programme page."
    });
  }
  return links;
}

function payloadFor(candidate: OfficialCandidate, index: number, universityId: number, fee: ExistingFeeEvidence | undefined) {
  const years = normalizedDuration(candidate);
  const officialIntake = normalizeOfficialIntake(candidate);
  const months = intakeMonths(officialIntake);
  const category = categoryFor(candidate);
  const faculty = facultyFor(candidate);
  const feeGap = officialFeeGapEvidenceByUrl.get(candidate.detailUrl);
  const feeStatus: FeeAuditStatus = fee ? "fee-sheet-verified" : "not-published";
  const tuitionCurrency: TuitionCurrency = fee ? "MYR" : "UNKNOWN";
  const tuitionAmount = fee?.tuitionAmount ?? null;
  const officialTuitionMYR = fee?.officialTuitionMYR ?? null;
  const annualTuitionCny = fee?.annualTuitionCny ?? 0;
  const tuitionDisplay = fee?.tuitionDisplay || fee?.listTuitionText || "Official fee not published";
  const sourceStatus = "official-verified" as const;
  const curriculumItems = splitOfficialText(candidate.detail.programmeStructureText || "");
  const careerItems = splitOfficialText(candidate.detail.careerText || "");
  const overview = compact(candidate.detail.overviewText) || `Official SEGi programme page for ${candidate.title}.`;
  const officialAccreditationNote = candidate.detail.mqaLinks?.[0]
    ? `MQA certificate linked from the official SEGi programme page: ${candidate.detail.mqaLinks[0]}`
    : compact(candidate.detail.accreditationText) || "Official programme page does not publish a separate accreditation document link.";

  return {
    universityId,
    slug: `segi-official-${slugify(urlSlug(candidate.detailUrl))}`,
    code: codeFor(candidate, index),
    name: localizedProgramName(candidate.title),
    nameEnOfficial: candidate.title,
    level: candidate.standardLevel,
    category,
    faculty: localizedFaculty(faculty),
    facultyZh: facultyZhLabel(faculty),
    studyMode: candidate.deliveryMode === "online-or-odl"
      ? "Online / ODL"
      : candidate.standardLevel === "phd" || /research/i.test(candidate.title)
        ? "Research"
        : candidate.standardLevel === "master"
          ? "Coursework"
          : "Full-time",
    campus: candidate.campus || "SEGi University",
    durationYears: years,
    durationOfficial: durationOfficial(candidate),
    annualTuitionCny,
    tuitionAmount,
    tuitionCurrency,
    tuitionDisplay,
    officialTuitionMYR,
    officialTuitionNote: fee
      ? fee.officialTuitionNote || "Displayed from matched 2026 SEGi fee-sheet evidence. SEGi public programme pages do not publish a separate total tuition link for this programme."
      : feeGap
        ? `${feeGap.note} Checked official brochure: ${feeGap.brochureUrl}. Evidence hash: ${feeGap.brochureHash}.`
        : "SEGi public programme pages do not publish a total tuition amount for this programme in the 2026-06-17 audit.",
    officialFeeSourceUrl: "",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: feeStatus,
    officialFeeAuditedAt: fee?.officialFeeAuditedAt || verifiedAt,
    intakeMonths: months,
    officialIntake: officialIntake || "Official programme page does not publish concrete intake dates in the parsed section.",
    officialIntakeNote: officialIntake === "official-intake-unpublished"
      ? "SEGi official programme page has no concrete intake dates in its published intake section."
      : "Parsed from the official SEGi programme detail page.",
    languageRequirement: languageRequirement(candidate),
    officialLanguageRequirement: officialLanguageText(candidate),
    requirement: {
      gpa: gpaRequirement(candidate),
      gaokaoRequired: false,
      huikaoRequired: false,
      note: t(candidate.detail.entryRequirementsText)
    },
    officialAcademicRequirement: compact(candidate.detail.entryRequirementsText),
    chinaStudentRequirement: "Official page does not publish China-specific academic requirements; use the official academic requirement and admissions assessment.",
    specialRequirementsNote: "",
    applicationDocs: arr(
      candidate.standardLevel === "bachelor"
        ? ["Passport", "Academic transcript", "Graduation certificate", "English proficiency evidence where required"]
        : ["Passport", "Academic transcript", "Degree certificate", "English proficiency evidence where required", "Research proposal where required"]
    ),
    curriculum: arr(curriculumItems),
    careers: arr(careerItems),
    specializations: arr([]),
    description: t(overview),
    officialAccreditationNote,
    officialSourceUrl: candidate.detailUrl,
    officialEntryRequirementSourceUrl: candidate.detailUrl,
    officialAccreditationSourceUrl: candidate.detail.mqaLinks?.[0] || candidate.detailUrl,
    sourceUrls: sourceLinks(candidate, fee),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: sourceStatus,
    publicDisplayStatus: "ready" as const,
    publicDisplayNote: fee
      ? "Official programme identity and details are from SEGi official pages. Tuition amount is shown from matched 2026 SEGi fee-sheet evidence because official programme pages do not publish a separate total tuition link."
      : feeGap
        ? "Official programme identity and details are from SEGi official pages. Tuition is marked as not published after checking the official programme page, official brochure and official international-student payment page; no unique programme total tuition is published."
        : "Official programme identity and details are from SEGi official pages. Tuition is marked as not published because official programme pages do not publish total tuition and no exact fee-sheet row is mapped.",
    reviewReason: "",
    auditNote: `Published from SEGi official catalogue candidate ${index + 1}/76. Course ID: ${candidate.courseId || "not published"}. Fee sheet hash, where matched: ${fee ? feeSheetHash : "not matched"}.`,
    listTuitionText: fee?.listTuitionText || "Official fee not published",
    isPublished: true
  };
}

function backupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(repoRoot(), "apps/api/tmp/backups", `segi-before-official-catalog-publish-${stamp}.json`);
}

async function backupCurrentState(dataSource: DataSource) {
  const universityRepo = dataSource.getRepository(UniversityEntity);
  const programRepo = dataSource.getRepository(ProgramEntity);
  const university = await universityRepo.findOne({ where: { code: "SEGI" } });
  const programmes = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
  const out = backupPath();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ backedUpAt: new Date().toISOString(), university, programmes }, null, 2));
  return out;
}

function feeEvidenceFrom(program: ProgramEntity): ExistingFeeEvidence | undefined {
  if (!program.tuitionAmount && !program.officialTuitionMYR) return undefined;
  return {
    tuitionAmount: program.tuitionAmount == null ? null : Number(program.tuitionAmount),
    officialTuitionMYR: program.officialTuitionMYR,
    annualTuitionCny: program.annualTuitionCny,
    tuitionDisplay: program.tuitionDisplay,
    listTuitionText: program.listTuitionText,
    officialTuitionNote: program.officialTuitionNote,
    officialFeeAuditStatus: program.officialFeeAuditStatus,
    officialFeeAuditedAt: typeof program.officialFeeAuditedAt === "string" ? program.officialFeeAuditedAt : null
  };
}

async function verify(dataSource: DataSource) {
  const rows = await dataSource.getRepository(ProgramEntity).find({
    where: { university: { code: "SEGI" }, publicDisplayStatus: "ready", isPublished: true },
    relations: { university: true }
  });
  const byLevel = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.level] = (acc[row.level] || 0) + 1;
    return acc;
  }, {});
  const localLeak = rows.some((row) => JSON.stringify(row).includes("/Users/") || JSON.stringify(row).includes("世纪大学学费单2026.pdf"));
  const report = {
    verifiedAt,
    readyRows: rows.length,
    byLevel,
    officialSourceRows: rows.filter((row) => row.officialSourceUrl.startsWith("https://university.segi.edu.my/course/")).length,
    academicRequirementRows: rows.filter((row) => Boolean(row.officialAcademicRequirement)).length,
    languageRequirementRows: rows.filter((row) => Boolean(row.officialLanguageRequirement)).length,
    curriculumRows: rows.filter((row) => row.curriculum?.en?.length).length,
    careerRows: rows.filter((row) => row.careers?.en?.length).length,
    feeMatchedRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    feeSheetEvidenceRows: rows.filter((row) => row.tuitionAmount != null && row.officialFeeAuditStatus === "fee-sheet-verified" && !row.officialFeeSourceUrl).length,
    feeSheetBackfilledRows: rows.filter((row) => row.officialTuitionNote?.includes("Backfilled from provided 2026 SEGi fee-sheet row")).length,
    feePendingOfficialPublicationRows: rows.filter((row) => row.officialFeeAuditStatus === "pending-review").length,
    feeNotPublishedRows: rows.filter((row) => row.officialFeeAuditStatus === "not-published").length,
    intakeConcreteRows: rows.filter((row) => row.officialIntake && row.officialIntake !== "official-intake-unpublished").length,
    intakeOfficialUnpublishedRows: rows.filter((row) => row.officialIntake === "official-intake-unpublished").length,
    publicLocalPathLeak: localLeak
  };
  return report;
}

async function run() {
  loadEnvFiles();
  const verifyOnly = process.argv.includes("--verify-only");
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
    if (verifyOnly) {
      console.log(JSON.stringify(await verify(dataSource), null, 2));
      return;
    }

    const candidates = loadCandidates();
    if (candidates.length !== 76) {
      throw new Error(`Expected 76 SEGi official degree candidates, got ${candidates.length}`);
    }
    const backup = await backupCurrentState(dataSource);

    await dataSource.transaction(async (manager) => {
      const universityRepo = manager.getRepository(UniversityEntity);
      const programRepo = manager.getRepository(ProgramEntity);
      const university = await universityRepo.findOne({ where: { code: "SEGI" } });
      if (!university) throw new Error("SEGI university row is missing");

      const currentPrograms = await programRepo.find({ where: { universityId: university.id } });
      const feeByOfficialUrl = new Map<string, ExistingFeeEvidence>();
      for (const program of currentPrograms) {
        if (program.publicDisplayStatus !== "ready") continue;
        if (!program.officialSourceUrl) continue;
        const evidence = feeEvidenceFrom(program);
        if (evidence && !feeByOfficialUrl.has(program.officialSourceUrl)) {
          feeByOfficialUrl.set(program.officialSourceUrl, evidence);
        }
      }

      await programRepo.update(
        { universityId: university.id },
        {
          publicDisplayStatus: "archived",
          officialSourceStatus: "hidden-duplicate-superseded",
          reviewReason: "Archived before publishing the SEGi official 76-programme catalogue.",
          isPublished: false
        }
      );

      for (const [index, candidate] of candidates.entries()) {
        const fee = feeByOfficialUrl.get(candidate.detailUrl)
          || (feeSheetBackfillByUrl.has(candidate.detailUrl)
            ? feeEvidenceFromBackfill(feeSheetBackfillByUrl.get(candidate.detailUrl)!)
            : undefined);
        const payload = payloadFor(candidate, index, university.id, fee);
        const existing = await programRepo.findOne({ where: { slug: payload.slug } });
        await programRepo.save(programRepo.create(existing ? { ...existing, ...payload } : payload));
      }

      const ready = await programRepo.find({ where: { universityId: university.id, publicDisplayStatus: "ready", isPublished: true } });
      const positiveTuition = ready.map((program) => program.annualTuitionCny).filter((value) => value > 0);
      university.programCount = ready.length;
      university.tuitionMinCny = positiveTuition.length ? Math.min(...positiveTuition) : 0;
      university.tuitionMaxCny = positiveTuition.length ? Math.max(...positiveTuition) : 0;
      university.officialWebsite = "https://university.segi.edu.my/";
      university.studyPortalUrl = "https://university.segi.edu.my/course-search/";
      university.officialVerifiedAt = verifiedAt;
      university.officialSourceStatus = "official-verified";
      university.officialSources = [
        { title: "SEGi University official website", url: "https://university.segi.edu.my/", sourceType: "official-website", verifiedAt, status: "official-verified" },
        { title: "SEGi University programme search", url: "https://university.segi.edu.my/course-search/", sourceType: "study-portal", verifiedAt, status: "official-verified" }
      ];
      university.description = t(
        "SEGi University official bachelor, master and doctoral catalogue has been reconciled against the current SEGi programme directory. Programme detail pages govern names, requirements, curriculum, careers, intake status and source links.",
        "世纪大学（SEGi University）本硕博专业目录已按 SEGi 官方课程目录完成校对。专业名称、入学要求、课程结构、就业方向、开学状态和来源链接均以官方课程页为准。",
        "世紀大學（SEGi University）本碩博專業目錄已按 SEGi 官方課程目錄完成校對。專業名稱、入學要求、課程結構、就業方向、開學狀態和來源連結均以官方課程頁為準。",
        "Katalog sarjana muda, sarjana dan kedoktoran SEGi University telah diselaraskan dengan direktori program rasmi SEGi. Halaman program rasmi menjadi sumber untuk nama, syarat kemasukan, struktur kurikulum, kerjaya, status ambilan dan pautan sumber."
      );
      university.highlights = arr(
        ["Official SEGi catalogue verified", "Bachelor/Master/PhD catalogue published", "Official programme sources linked"],
        ["SEGi 官方目录已核验", "本硕博专业目录已发布", "专业来源链接已校准"],
        ["SEGi 官方目錄已核驗", "本碩博專業目錄已發布", "專業來源連結已校準"],
        ["Katalog rasmi SEGi disahkan", "Katalog sarjana muda/sarjana/kedoktoran diterbitkan", "Pautan sumber program diselaraskan"]
      );
      university.facilities = arr([]);
      university.admissionEmail = "";
      university.officialAuditSummary = "Published SEGi University official bachelor/master/phd catalogue with 76 ready programmes from the current SEGi official course directory. Tuition is displayed from matched 2026 SEGi fee-sheet evidence where available; programmes without a mapped fee-sheet amount remain marked as official fee not published.";
      university.publicDisplayStatus = "ready";
      university.isPublished = true;
      await universityRepo.save(university);
    });

    const verification = await verify(dataSource);
    const postImportPath = join(repoRoot(), officialAuditDir, "post_import_display_audit.json");
    const envelope = {
      schemaVersion: 2,
      decision: verification.readyRows === 76 && !verification.publicLocalPathLeak ? "published-with-fee-unpublished-exceptions" : "blocked",
      backupPath: backup,
      verification
    };
    writeFileSync(postImportPath, JSON.stringify(envelope, null, 2));
    console.log(JSON.stringify(envelope, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
