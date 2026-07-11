import "reflect-metadata";
import { DataSource } from "typeorm";
import type {
  DegreeLevel,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  ProgramCategoryCode
} from "@studymy/shared";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";
import { loadEnvFiles } from "../config/env.js";

const verifiedAt = "2026-06-16";
const feeSheetSource =
  "/Users/ian/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_fuzvc3f0qbm521_40c0/temp/drag/世纪大学学费单2026.pdf";
const feeSheetHash = "sha256:205ad0382161d445a2f849a8dae6df08ac6300594aaaebf074d1c2358eb094db";
const myrToCny = 1.55;

type SegiOfficialProgramPage = {
  title: string;
  url: string;
  status?: "official-verified" | "needs-review";
  note?: string;
};

export const segiOfficialProgramPages: Record<string, SegiOfficialProgramPage> = {
  "SEGI-BBM": { title: "Bachelor of Business Management (Honours)", url: "https://university.segi.edu.my/course/bachelor-of-business-management-honours/" },
  "SEGI-BAF": { title: "Bachelor of Accounting and Finance (Honours)", url: "https://university.segi.edu.my/course/bachelor-of-accounting-and-finance-honours/" },
  "SEGI-BIB": { title: "Bachelor of International Business (Honours)", url: "https://university.segi.edu.my/course/bachelor-of-international-business-honours/" },
  "SEGI-BED": { title: "Bachelor of Education (Hons)", url: "https://university.segi.edu.my/course/bachelor-of-education-hons/" },
  "SEGI-BMUSIC": { title: "Bachelor of Music (Honours)", url: "https://university.segi.edu.my/course/bachelor-of-music-honours/" },
  "SEGI-BEPR": {
    title: "Bachelor of Arts (Hons) in English and Public Relations",
    url: "https://university.segi.edu.my/course/bachelor-of-arts-hons-in-english-and-public-relations/",
    status: "needs-review",
    note: "Official title differs from the 2026 fee-sheet title; mapped for public source-link correction."
  },
  "SEGI-BPSY": { title: "Bachelor of Psychology (Honours)", url: "https://university.segi.edu.my/course/bachelor-of-psychology-honours/" },
  "SEGI-BMC": { title: "Bachelor of Mass Communication (Hons)", url: "https://university.segi.edu.my/course/bachelor-of-mass-communication-hons/" },
  "SEGI-BVCD": { title: "Bachelor of Arts (Hons) Visual Communication Design", url: "https://university.segi.edu.my/course/bachelor-of-arts-hons-visual-communication-design/" },
  "SEGI-BMMD": { title: "Bachelor of Arts (Hons) Multimedia Design", url: "https://university.segi.edu.my/course/bachelor-of-arts-hons-multimedia-design/" },
  "SEGI-BAHM": {
    title: "Bachelor of Hospitality Management (Honours)",
    url: "https://university.segi.edu.my/course/bachelor-of-hospitality-management-hons/",
    status: "needs-review",
    note: "Official title omits Tourism compared with the 2026 fee-sheet title; mapped for public source-link correction."
  },
  "SEGI-BIT": { title: "Bachelor of Information Technology (Honours)", url: "https://university.segi.edu.my/course/bachelor-of-information-technology-hons/" },
  "SEGI-BCS": { title: "Bachelor of Computer Science (Honours)", url: "https://university.segi.edu.my/course/bachelor-of-computer-science-hons/" },
  "SEGI-BME": { title: "Bachelor of Mechanical Engineering with Honours", url: "https://university.segi.edu.my/course/bachelor-of-mechanical-engineering-hons/" },
  "SEGI-BEE": { title: "Bachelor of Electrical and Electronics Engineering with Honours", url: "https://university.segi.edu.my/course/bachelor-of-electrical-and-electronics-engineering-hons/" },
  "SEGI-BMH": { title: "Bachelor of Mechatronics Engineering with Honours", url: "https://university.segi.edu.my/course/bachelor-of-mechatronics-engineering-hons/" },
  "SEGI-BCHEM": { title: "Bachelor of Chemical Engineering with Honours", url: "https://university.segi.edu.my/course/bachelor-of-chemical-engineering-hons/" },
  "SEGI-BCE": { title: "Bachelor of Civil Engineering with Honours", url: "https://university.segi.edu.my/course/bachelor-of-civil-engineering-hons/" },
  "SEGI-BSCAR": { title: "Bachelor of Science (Hons) Architecture", url: "https://university.segi.edu.my/course/bachelor-of-science-in-architecture-hons/" },
  "SEGI-BIA": { title: "Bachelor of Arts (Honours) in Interior Architecture", url: "https://university.segi.edu.my/course/bachelor-of-art-in-interior-architecture-hons/" },
  "SEGI-BQS": {
    title: "Bachelor in Quantity Surveying",
    url: "https://university.segi.edu.my/course/bachelor-in-quantity-surveying/",
    status: "needs-review",
    note: "Official title differs from the 2026 fee-sheet title; mapped for public source-link correction."
  },
  "SEGI-BMMS": { title: "Bachelor of Biomedical Sciences (Hons)", url: "https://university.segi.edu.my/course/bachelor-of-biomedical-science-hons/" },
  "SEGI-BOPTO": { title: "Bachelor of Optometry (Hons)", url: "https://university.segi.edu.my/course/bachelor-of-optometry-hons/" },
  "SEGI-BPHARM": {
    title: "Bachelor of Pharmacy with Honours",
    url: "https://university.segi.edu.my/course/bachelor-of-pharmacy-hons/",
    status: "needs-review",
    note: "Official title includes Honours while the 2026 fee-sheet title is shorter; mapped for public source-link correction."
  },
  "SEGI-BPHYSIO": { title: "Bachelor of Physiotherapy (Honours)", url: "https://university.segi.edu.my/course/bachelor-of-physiotherapy-hons/" },
  "SEGI-MBBS": { title: "Bachelor of Medicine and Bachelor of Surgery (MBBS)", url: "https://university.segi.edu.my/course/bachelor-of-medicine-bachelor-of-surgery-mbbs/" },
  "SEGI-BDS": { title: "Bachelor of Dental Surgery (BDS)", url: "https://university.segi.edu.my/course/bachelor-of-dental-surgery-bds/" },
  "SEGI-MBA": { title: "Master of Business Administration (with 11 emphasis to choose from)", url: "https://university.segi.edu.my/course/master-of-business-administration/" },
  "SEGI-MBA-5PLUS1": {
    title: "Master of Business Administration (with 11 emphasis to choose from)",
    url: "https://university.segi.edu.my/course/master-of-business-administration/",
    status: "needs-review",
    note: "The 5+1 fee-sheet row does not have a separate official programme page; mapped to the official MBA page for source display."
  },
  "SEGI-MED-CW": {
    title: "Master of Education",
    url: "https://university.segi.edu.my/course/master-of-education/",
    status: "needs-review",
    note: "Official page title does not include Coursework; mapped for public source-link correction."
  },
  "SEGI-MA": {
    title: "Master of Accountancy",
    url: "https://university.segi.edu.my/course/master-of-accountancy/",
    status: "needs-review",
    note: "Official title uses Accountancy while the 2026 fee-sheet title uses Accounting; mapped for public source-link correction."
  },
  "SEGI-MFP": { title: "Master of Financial Planning", url: "https://university.segi.edu.my/course/master-in-financial-planning/" },
  "SEGI-MACC": { title: "Master of Arts in Corporate Communications", url: "https://university.segi.edu.my/course/master-of-arts-in-corporate-communications/" },
  "SEGI-MIL": {
    title: "Master of Laws (LL.M) in Advanced Legal Practice",
    url: "https://university.segi.edu.my/course/master-of-laws/",
    status: "needs-review",
    note: "Official title differs from the 2026 fee-sheet title; mapped for public source-link correction."
  },
  "SEGI-MIT-CW": {
    title: "Master of Science in Information Technology",
    url: "https://university.segi.edu.my/course/msc-in-information-technology-coursework/",
    status: "needs-review",
    note: "Official title uses Master of Science in Information Technology; mapped to the coursework page."
  },
  "SEGI-MSSP": { title: "Master of Social Science in Psychology", url: "https://university.segi.edu.my/course/master-of-social-science-in-psychology/" },
  "SEGI-MCDM": { title: "Master of Creative Design Management", url: "https://university.segi.edu.my/course/master-of-creative-design-management/" },
  "SEGI-MSC-MGMT": {
    title: "Master of Science (Management)",
    url: "https://university.segi.edu.my/course/master-of-science-in-management/",
    status: "needs-review",
    note: "Official title omits By Research compared with the 2026 fee-sheet title; mapped for public source-link correction."
  },
  "SEGI-MED-RES": { title: "Master of Education by Research", url: "https://university.segi.edu.my/course/master-of-education-by-research/" },
  "SEGI-MIT-RES": {
    title: "Master of Science (Information Technology)",
    url: "https://university.segi.edu.my/course/msc-information-technology-by-research/",
    status: "needs-review",
    note: "Official title uses Master of Science (Information Technology); mapped to the research page."
  },
  "SEGI-MENG-RES": {
    title: "Master of Science (Engineering)",
    url: "https://university.segi.edu.my/course/msc-engineering-by-research/",
    status: "needs-review",
    note: "Official title uses Master of Science (Engineering); mapped to the research page."
  },
  "SEGI-MSC-VS": { title: "Master of Science (Vision Science)", url: "https://university.segi.edu.my/course/master-of-science-in-vision-science-by-research/" },
  "SEGI-MSPS": { title: "Master of Science (Pharmaceutical Sciences)", url: "https://university.segi.edu.my/course/master-of-science-pharmaceutical-sciences/" },
  "SEGI-MMED": {
    title: "Master of Medical Science",
    url: "https://university.segi.edu.my/course/master-of-medical-science-by-research/",
    status: "needs-review",
    note: "Official title uses Master of Medical Science; mapped for public source-link correction."
  },
  "SEGI-PHD-MGMT": { title: "Doctor of Philosophy (Management)", url: "https://university.segi.edu.my/course/doctor-of-philosophy-in-management/" },
  "SEGI-PHD-EDU": { title: "Doctor of Philosophy (Education)", url: "https://university.segi.edu.my/course/phd-education-by-research/" },
  "SEGI-PHD-IT": { title: "Doctor of Philosophy (Information Technology)", url: "https://university.segi.edu.my/course/phd-information-technology-by-research/" },
  "SEGI-PHD-ENG": { title: "Doctor of Philosophy (Engineering)", url: "https://university.segi.edu.my/course/phd-engineering-by-research/" },
  "SEGI-DRBA": { title: "Doctor of Business Administration", url: "https://university.segi.edu.my/course/doctor-of-business-administration/" }
};

type SegiProgramFee = {
  code: string;
  nameEn: string;
  nameZhCN: string;
  nameZhTW?: string;
  level: DegreeLevel;
  category: ProgramCategoryCode;
  facultyEn: string;
  facultyZhCN: string;
  durationYears: number;
  durationOfficial: string;
  totalMYR: number;
  tuitionComponentMYR: number;
  sstMYR: number;
  intakeMonths: string[];
  officialIntake: string;
  specializations?: string[];
  languageRequirement?: LanguageRequirement;
};

const t = (en: string, zhCN = en, zhTW = zhCN, ms = en): LocalizedText => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], zhCN = en, zhTW = zhCN, ms = en): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

const commonBachelorIntake = ["January", "May", "September"];
const commonBachelorIntakeText = "January 12, May 11, September 14";
const commonHealthIntake = ["May", "September"];
const commonHealthIntakeText = "May 11, September 21";
const commonPgIntake = ["January", "May", "September"];
const commonPgIntakeText = "January 12, May 11, September 14";
const mbaIntake = ["January", "April", "June", "September", "November"];
const mbaIntakeText = "January 12, April 6, June 22, September 14, November 30";

export const segi2026ProgramFees: SegiProgramFee[] = [
  {
    code: "SEGI-BBM",
    nameEn: "Bachelor of Business Management (Hons)",
    nameZhCN: "商务管理（荣誉）学士学位",
    level: "bachelor",
    category: "business",
    facultyEn: "Business and Accounting",
    facultyZhCN: "工商管理、会计",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 94558.7,
    tuitionComponentMYR: 63295,
    sstMYR: 5063.7,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BAF",
    nameEn: "Bachelor of Accounting and Finance (Hons)",
    nameZhCN: "会计与金融（荣誉）学士学位",
    level: "bachelor",
    category: "business",
    facultyEn: "Business and Accounting",
    facultyZhCN: "工商管理、会计",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 89550.2,
    tuitionComponentMYR: 58570,
    sstMYR: 4780.2,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BIB",
    nameEn: "Bachelor of International Business (Hons)",
    nameZhCN: "国际商务（荣誉）学士学位",
    level: "bachelor",
    category: "business",
    facultyEn: "Business and Accounting",
    facultyZhCN: "工商管理、会计",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 94558.7,
    tuitionComponentMYR: 63295,
    sstMYR: 5063.7,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BED",
    nameEn: "Bachelor of Education (Hons)",
    nameZhCN: "教育学（荣誉）学士学位",
    level: "bachelor",
    category: "arts",
    facultyEn: "Education",
    facultyZhCN: "教育系",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 98676.8,
    tuitionComponentMYR: 67180,
    sstMYR: 5296.8,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BMUSIC",
    nameEn: "Bachelor of Music (Hons)",
    nameZhCN: "音乐学（荣誉）学士学位",
    level: "bachelor",
    category: "arts",
    facultyEn: "Education",
    facultyZhCN: "教育系",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 95253,
    tuitionComponentMYR: 63950,
    sstMYR: 5103,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BEPR",
    nameEn: "Bachelor of English and Public Relations (Hons)",
    nameZhCN: "英语与社会关系学（荣誉）学士学位",
    level: "bachelor",
    category: "arts",
    facultyEn: "Education",
    facultyZhCN: "教育系",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 92083.6,
    tuitionComponentMYR: 60960,
    sstMYR: 4923.6,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BPSY",
    nameEn: "Bachelor of Psychology (Hons)",
    nameZhCN: "心理学（荣誉）学士学位",
    level: "bachelor",
    category: "science",
    facultyEn: "Education",
    facultyZhCN: "教育系",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 104713.5,
    tuitionComponentMYR: 72875,
    sstMYR: 5638.5,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BMC",
    nameEn: "Bachelor of Mass Communication (Hons)",
    nameZhCN: "大众传媒（荣誉）学士学位",
    level: "bachelor",
    category: "arts",
    facultyEn: "Mass Communication and Arts",
    facultyZhCN: "大众传媒、艺术",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 97648.6,
    tuitionComponentMYR: 66210,
    sstMYR: 5238.6,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BVCD",
    nameEn: "Bachelor of Arts (Hons) in Visual Communication Design",
    nameZhCN: "视觉艺术设计（荣誉）文学士学位",
    level: "bachelor",
    category: "arts",
    facultyEn: "Mass Communication and Arts",
    facultyZhCN: "大众传媒、艺术",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 95253,
    tuitionComponentMYR: 63950,
    sstMYR: 5103,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BMMD",
    nameEn: "Bachelor of Arts (Hons) in Multimedia Design",
    nameZhCN: "多媒体设计（荣誉）文学士学位",
    level: "bachelor",
    category: "arts",
    facultyEn: "Mass Communication and Arts",
    facultyZhCN: "大众传媒、艺术",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 95253,
    tuitionComponentMYR: 63950,
    sstMYR: 5103,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BAHM",
    nameEn: "Bachelor of Hospitality and Tourism Management (Hons)",
    nameZhCN: "酒店与旅游管理（荣誉）学士学位",
    level: "bachelor",
    category: "business",
    facultyEn: "Mass Communication and Arts",
    facultyZhCN: "大众传媒、艺术",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 94558.7,
    tuitionComponentMYR: 63295,
    sstMYR: 5063.7,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  },
  {
    code: "SEGI-BIT",
    nameEn: "Bachelor of Information Technology (Hons)",
    nameZhCN: "信息与科技（荣誉）学士学位",
    level: "bachelor",
    category: "it",
    facultyEn: "Computing",
    facultyZhCN: "计算机",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 94558.7,
    tuitionComponentMYR: 63295,
    sstMYR: 5063.7,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText,
    specializations: ["Business Systems Design", "Computer Networks", "Software Engineering"]
  },
  {
    code: "SEGI-BCS",
    nameEn: "Bachelor of Computer Science (Hons)",
    nameZhCN: "电脑科学（荣誉）学士学位",
    level: "bachelor",
    category: "it",
    facultyEn: "Computing",
    facultyZhCN: "计算机",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 102376.2,
    tuitionComponentMYR: 70670,
    sstMYR: 5506.2,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText,
    specializations: ["Artificial Intelligence", "Digital Transformation", "Network Transformation", "Data Science"]
  },
  ...[
    ["SEGI-BME", "Bachelor of Mechanical Engineering (Hons)", "机械工程（荣誉）学士学位"],
    ["SEGI-BEE", "Bachelor of Electrical and Electronic Engineering (Hons)", "电气与电子工程（荣誉）学士学位"],
    ["SEGI-BMH", "Bachelor of Mechatronics Engineering (Hons)", "机电工程（荣誉）学士学位"],
    ["SEGI-BCHEM", "Bachelor of Chemical Engineering (Hons)", "化学工程（荣誉）学士学位"],
    ["SEGI-BCE", "Bachelor of Civil Engineering (Hons)", "土木工程（荣誉）学士学位"]
  ].map(([code, nameEn, nameZhCN]) => ({
    code,
    nameEn,
    nameZhCN,
    level: "bachelor" as const,
    category: "engineering",
    facultyEn: "Engineering",
    facultyZhCN: "工程",
    durationYears: 4,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 4 years for engineering display pending programme-page verification.",
    totalMYR: 125191,
    tuitionComponentMYR: 89650,
    sstMYR: 6741,
    intakeMonths: commonBachelorIntake,
    officialIntake: commonBachelorIntakeText
  })),
  {
    code: "SEGI-BSCAR",
    nameEn: "Bachelor of Science (Hons) in Architecture",
    nameZhCN: "建筑学（荣誉）学士学位",
    level: "bachelor",
    category: "arts",
    facultyEn: "Architecture",
    facultyZhCN: "建筑",
    durationYears: 4,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 4 years for display pending programme-page verification.",
    totalMYR: 115287,
    tuitionComponentMYR: 82850,
    sstMYR: 6237,
    intakeMonths: ["January", "June", "August"],
    officialIntake: "January 5, June 1, August 17"
  },
  {
    code: "SEGI-BIA",
    nameEn: "Bachelor of Arts (Hons) in Interior Architecture",
    nameZhCN: "室内建筑（荣誉）文学士学位",
    level: "bachelor",
    category: "arts",
    facultyEn: "Architecture",
    facultyZhCN: "建筑",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 105114.6,
    tuitionComponentMYR: 71510,
    sstMYR: 5604.6,
    intakeMonths: ["January", "June", "August"],
    officialIntake: "January 5, June 1, August 17"
  },
  {
    code: "SEGI-BQS",
    nameEn: "Bachelor of Arts (Hons) in Quantity Surveying",
    nameZhCN: "工程测量学（荣誉）文学士学位",
    level: "bachelor",
    category: "engineering",
    facultyEn: "Architecture",
    facultyZhCN: "建筑",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 92452.9,
    tuitionComponentMYR: 59565,
    sstMYR: 4887.9,
    intakeMonths: ["January", "June", "August"],
    officialIntake: "January 5, June 1, August 17"
  },
  {
    code: "SEGI-BMMS",
    nameEn: "Bachelor of Biomedical Science (Hons)",
    nameZhCN: "生物医药科学（荣誉）学士学位",
    level: "bachelor",
    category: "medicine",
    facultyEn: "Health and Medical Sciences",
    facultyZhCN: "健康医学",
    durationYears: 3,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 3 years for display pending programme-page verification.",
    totalMYR: 131833.6,
    tuitionComponentMYR: 95660,
    sstMYR: 7173.6,
    intakeMonths: commonHealthIntake,
    officialIntake: commonHealthIntakeText
  },
  {
    code: "SEGI-BOPTO",
    nameEn: "Bachelor of Optometry (Hons)",
    nameZhCN: "验光学（荣誉）学士学位",
    level: "bachelor",
    category: "medicine",
    facultyEn: "Health and Medical Sciences",
    facultyZhCN: "健康医学",
    durationYears: 4,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 4 years for display pending programme-page verification.",
    totalMYR: 141324.2,
    tuitionComponentMYR: 102670,
    sstMYR: 7654.2,
    intakeMonths: commonHealthIntake,
    officialIntake: commonHealthIntakeText
  },
  {
    code: "SEGI-BPHARM",
    nameEn: "Bachelor of Pharmacy",
    nameZhCN: "药剂学学士学位",
    level: "bachelor",
    category: "medicine",
    facultyEn: "Health and Medical Sciences",
    facultyZhCN: "健康医学",
    durationYears: 4,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 4 years for display pending programme-page verification.",
    totalMYR: 174714.2,
    tuitionComponentMYR: 134170,
    sstMYR: 9544.2,
    intakeMonths: ["September"],
    officialIntake: "September 21"
  },
  {
    code: "SEGI-BPHYSIO",
    nameEn: "Bachelor of Physiotherapy (Hons)",
    nameZhCN: "物理治疗（荣誉）学士学位",
    level: "bachelor",
    category: "medicine",
    facultyEn: "Health and Medical Sciences",
    facultyZhCN: "健康医学",
    durationYears: 4,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 4 years for display pending programme-page verification.",
    totalMYR: 131667.6,
    tuitionComponentMYR: 93560,
    sstMYR: 7107.6,
    intakeMonths: commonHealthIntake,
    officialIntake: commonHealthIntakeText
  },
  {
    code: "SEGI-MBBS",
    nameEn: "Bachelor of Medicine and Bachelor of Surgery (MBBS)",
    nameZhCN: "医学和外科学士学位 (MBBS)",
    level: "bachelor",
    category: "medicine",
    facultyEn: "Health and Medical Sciences",
    facultyZhCN: "健康医学",
    durationYears: 5,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 5 years for display pending programme-page verification.",
    totalMYR: 419864,
    tuitionComponentMYR: 358500,
    sstMYR: 23364,
    intakeMonths: commonHealthIntake,
    officialIntake: commonHealthIntakeText,
    languageRequirement: { ielts: 7, toefl: 100, pte: 50, muet: 3 }
  },
  {
    code: "SEGI-BDS",
    nameEn: "Bachelor of Dental Surgery",
    nameZhCN: "口腔学学士学位",
    level: "bachelor",
    category: "medicine",
    facultyEn: "Health and Medical Sciences",
    facultyZhCN: "健康医学",
    durationYears: 5,
    durationOfficial: "Not published in the provided 2026 fee sheet; StudyMY stores 5 years for display pending programme-page verification.",
    totalMYR: 423012.2,
    tuitionComponentMYR: 352470,
    sstMYR: 23542.2,
    intakeMonths: ["September"],
    officialIntake: "September 21"
  },
  {
    code: "SEGI-MBA",
    nameEn: "Master of Business Administration",
    nameZhCN: "工商管理硕士学位",
    level: "master",
    category: "business",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "1 year",
    totalMYR: 59916,
    tuitionComponentMYR: 35700,
    sstMYR: 3216,
    intakeMonths: mbaIntake,
    officialIntake: mbaIntakeText,
    specializations: ["Global Business", "General Management", "Marketing", "Finance", "Human Resource"]
  },
  {
    code: "SEGI-MBA-5PLUS1",
    nameEn: "Master of Business Administration (5+1)",
    nameZhCN: "工商管理硕士学位 (MBA) (5+1)",
    level: "master",
    category: "business",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "1 year",
    totalMYR: 49676.4,
    tuitionComponentMYR: 26040,
    sstMYR: 2636.4,
    intakeMonths: mbaIntake,
    officialIntake: mbaIntakeText
  },
  {
    code: "SEGI-MED-CW",
    nameEn: "Master of Education (Coursework)",
    nameZhCN: "教育学硕士学位",
    level: "master",
    category: "arts",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "1 year",
    totalMYR: 52013.7,
    tuitionComponentMYR: 28245,
    sstMYR: 2768.7,
    intakeMonths: ["February", "June", "October"],
    officialIntake: "February 23, June 22, October 26"
  },
  {
    code: "SEGI-MA",
    nameEn: "Master of Accounting",
    nameZhCN: "会计硕士学位",
    level: "master",
    category: "business",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "1 year",
    totalMYR: 63032.4,
    tuitionComponentMYR: 38640,
    sstMYR: 3392.4,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MFP",
    nameEn: "Master of Financial Planning",
    nameZhCN: "财务规划硕士学位",
    level: "master",
    category: "business",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "1 year",
    totalMYR: 59804.7,
    tuitionComponentMYR: 35595,
    sstMYR: 3209.7,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MACC",
    nameEn: "Master of Arts in Corporate Communication",
    nameZhCN: "企业传媒硕士学位",
    level: "master",
    category: "arts",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1.5,
    durationOfficial: "1.5 years",
    totalMYR: 54465.9,
    tuitionComponentMYR: 27615,
    sstMYR: 2850.9,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MIL",
    nameEn: "Master of International Law (LL.M)",
    nameZhCN: "法学硕士学位",
    level: "master",
    category: "law",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "1 year",
    totalMYR: 59804.7,
    tuitionComponentMYR: 35595,
    sstMYR: 3209.7,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MIT-CW",
    nameEn: "Master of Information Technology (Coursework)",
    nameZhCN: "资讯科技理硕士学位",
    level: "master",
    category: "it",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "Not explicitly shown next to this row in the provided 2026 fee sheet; StudyMY stores 1 year for display pending programme-page verification.",
    totalMYR: 52999.5,
    tuitionComponentMYR: 29175,
    sstMYR: 2824.5,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MSSP",
    nameEn: "Master of Science in Psychology",
    nameZhCN: "心理学硕士学位",
    level: "master",
    category: "science",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "1 year",
    totalMYR: 55411,
    tuitionComponentMYR: 31450,
    sstMYR: 2961,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MCDM",
    nameEn: "Master of Arts in Creative Design Management",
    nameZhCN: "创意设计管理艺术硕士学位",
    level: "master",
    category: "arts",
    facultyEn: "Coursework Master's Programmes",
    facultyZhCN: "硕士（授课型）",
    durationYears: 1,
    durationOfficial: "1 year",
    totalMYR: 55411,
    tuitionComponentMYR: 31450,
    sstMYR: 2961,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MSC-MGMT",
    nameEn: "Master of Science in Management (By Research)",
    nameZhCN: "管理学硕士学位",
    level: "master",
    category: "business",
    facultyEn: "Research Master's Programmes",
    facultyZhCN: "硕士（研究型）",
    durationYears: 2,
    durationOfficial: "2 years",
    totalMYR: 60534.4,
    tuitionComponentMYR: 33340,
    sstMYR: 3194.4,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MED-RES",
    nameEn: "Master of Education (By Research)",
    nameZhCN: "教育学硕士学位",
    level: "master",
    category: "arts",
    facultyEn: "Research Master's Programmes",
    facultyZhCN: "硕士（研究型）",
    durationYears: 2,
    durationOfficial: "2 years",
    totalMYR: 56135.4,
    tuitionComponentMYR: 29190,
    sstMYR: 2945.4,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MIT-RES",
    nameEn: "Master of Information Technology (By Research)",
    nameZhCN: "信息与科技硕士学位",
    level: "master",
    category: "it",
    facultyEn: "Research Master's Programmes",
    facultyZhCN: "硕士（研究型）",
    durationYears: 2,
    durationOfficial: "2 years",
    totalMYR: 59474.4,
    tuitionComponentMYR: 33340,
    sstMYR: 3134.4,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MENG-RES",
    nameEn: "Master of Engineering (By Research)",
    nameZhCN: "工程硕士学位",
    level: "master",
    category: "engineering",
    facultyEn: "Research Master's Programmes",
    facultyZhCN: "硕士（研究型）",
    durationYears: 2,
    durationOfficial: "2 years",
    totalMYR: 65929.8,
    tuitionComponentMYR: 38430,
    sstMYR: 3499.8,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MSC-VS",
    nameEn: "Master of Science in Vision Science",
    nameZhCN: "验光与视觉硕士学位",
    level: "master",
    category: "medicine",
    facultyEn: "Research Master's Programmes",
    facultyZhCN: "硕士（研究型）",
    durationYears: 2,
    durationOfficial: "2 years",
    totalMYR: 63258.6,
    tuitionComponentMYR: 35910,
    sstMYR: 3348.6,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MSPS",
    nameEn: "Master of Science in Pharmaceutical Sciences",
    nameZhCN: "药物科学硕士学位",
    level: "master",
    category: "medicine",
    facultyEn: "Research Master's Programmes",
    facultyZhCN: "硕士（研究型）",
    durationYears: 2,
    durationOfficial: "2 years",
    totalMYR: 57025.8,
    tuitionComponentMYR: 30030,
    sstMYR: 2995.8,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-MMED",
    nameEn: "Master in Medicine",
    nameZhCN: "医学硕士学位",
    level: "master",
    category: "medicine",
    facultyEn: "Research Master's Programmes",
    facultyZhCN: "硕士（研究型）",
    durationYears: 2,
    durationOfficial: "2 years",
    totalMYR: 57025.8,
    tuitionComponentMYR: 30030,
    sstMYR: 2995.8,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-PHD-MGMT",
    nameEn: "Doctor of Philosophy in Management",
    nameZhCN: "管理学哲学博士学位",
    level: "phd",
    category: "business",
    facultyEn: "Research Doctoral Programmes",
    facultyZhCN: "博士（研究型）",
    durationYears: 3,
    durationOfficial: "3 years",
    totalMYR: 77619.9,
    tuitionComponentMYR: 46515,
    sstMYR: 4104.9,
    intakeMonths: ["January", "July"],
    officialIntake: "Intensive class: January 12, July 6"
  },
  {
    code: "SEGI-PHD-EDU",
    nameEn: "Doctor of Philosophy in Education",
    nameZhCN: "教育学哲学博士学位",
    level: "phd",
    category: "arts",
    facultyEn: "Research Doctoral Programmes",
    facultyZhCN: "博士（研究型）",
    durationYears: 3,
    durationOfficial: "3 years",
    totalMYR: 86301.3,
    tuitionComponentMYR: 54705,
    sstMYR: 4596.3,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-PHD-IT",
    nameEn: "Doctor of Philosophy in Information Technology",
    nameZhCN: "信息科技哲学博士学位",
    level: "phd",
    category: "it",
    facultyEn: "Research Doctoral Programmes",
    facultyZhCN: "博士（研究型）",
    durationYears: 3,
    durationOfficial: "3 years",
    totalMYR: 77619.9,
    tuitionComponentMYR: 46515,
    sstMYR: 4104.9,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-PHD-ENG",
    nameEn: "Doctor of Philosophy in Engineering",
    nameZhCN: "工程学哲学博士学位",
    level: "phd",
    category: "engineering",
    facultyEn: "Research Doctoral Programmes",
    facultyZhCN: "博士（研究型）",
    durationYears: 3,
    durationOfficial: "3 years",
    totalMYR: 86301.3,
    tuitionComponentMYR: 54705,
    sstMYR: 4596.3,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  },
  {
    code: "SEGI-DRBA",
    nameEn: "Doctor of Business Administration",
    nameZhCN: "工商管理博士学位",
    level: "phd",
    category: "business",
    facultyEn: "Coursework Doctoral Programmes",
    facultyZhCN: "博士（授课型）",
    durationYears: 3,
    durationOfficial: "3 years",
    totalMYR: 90085.5,
    tuitionComponentMYR: 58275,
    sstMYR: 4810.5,
    intakeMonths: commonPgIntake,
    officialIntake: commonPgIntakeText
  }
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 92);
}

function languageForProgram(program: SegiProgramFee): LanguageRequirement {
  if (program.languageRequirement) return program.languageRequirement;
  if (program.level === "bachelor") return { ielts: program.category === "medicine" ? 6 : 5.5, toefl: 60, pte: 50, muet: 3 };
  return { ielts: 6, toefl: 79, pte: 50, muet: 3 };
}

function requirementForProgram(program: SegiProgramFee) {
  return {
    gpa: program.level === "bachelor" ? (program.category === "medicine" ? 3 : 2.5) : 2.75,
    gaokaoRequired: program.level === "bachelor" && program.category !== "medicine",
    huikaoRequired: false,
    note: t(
      "Academic entry requirements are not published in the provided 2026 fee sheet; verify against SEGi programme pages before counselling use.",
      "本次 2026 学费单未公布学术入学要求；正式咨询前需用 SEGi 专业页面复核。",
      "本次 2026 學費單未公布學術入學要求；正式諮詢前需用 SEGi 專業頁面覆核。",
      "Syarat akademik tidak diterbitkan dalam jadual yuran 2026 yang diberikan; sahkan melalui halaman program SEGi sebelum digunakan."
    )
  };
}

function annualTuitionCny(program: SegiProgramFee) {
  return Math.round((program.totalMYR / Math.max(program.durationYears, 1)) * myrToCny);
}

function toProgramPayload(program: SegiProgramFee, universityId: number) {
  const amountDisplay = program.totalMYR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const specializations = program.specializations || [];
  const officialPage = segiOfficialProgramPages[program.code];
  const officialProgramUrl = officialPage?.url || "";
  const officialSourceStatus = officialPage?.status || "official-verified";
  const sourceCorrectionNote = officialPage?.note || "Official SEGi programme detail page verified in the 2026-06-16 source-link audit.";
  return {
    universityId,
    slug: `segi-${slugify(program.nameEn)}-${slugify(program.code)}`,
    code: program.code,
    name: t(program.nameEn, program.nameZhCN, program.nameZhTW || program.nameZhCN),
    nameEnOfficial: program.nameEn,
    level: program.level,
    category: program.category,
    faculty: t(program.facultyEn, program.facultyZhCN, program.facultyZhCN),
    facultyZh: program.facultyZhCN,
    studyMode: program.level === "bachelor" ? "Full-time" : program.facultyEn.includes("Research") ? "Research" : "Coursework",
    campus: "SEGi University",
    durationYears: program.durationYears,
    durationOfficial: program.durationOfficial,
    annualTuitionCny: annualTuitionCny(program),
    tuitionAmount: program.totalMYR,
    tuitionCurrency: "MYR" as const,
    tuitionDisplay: `MYR ${amountDisplay} total 2026 fee sheet amount`,
    officialTuitionMYR: Math.round(program.totalMYR),
    officialTuitionNote: `Provided 2026 SEGi fee sheet total is MYR ${amountDisplay}, including the tuition component MYR ${program.tuitionComponentMYR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, 6% SST MYR ${program.sstMYR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, and listed non-tuition charges. Accommodation is excluded. The official SEGi programme detail page did not publish a public tuition link during the 2026-06-16 audit; the local fee-sheet path is retained only in the internal audit note.`,
    officialFeeSourceUrl: "",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official" as const,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: program.intakeMonths,
    officialIntake: program.officialIntake,
    officialIntakeNote: "Dates transcribed from the provided 2026 SEGi fee sheet.",
    languageRequirement: languageForProgram(program),
    officialLanguageRequirement: "Not published in the provided 2026 fee sheet.",
    requirement: requirementForProgram(program),
    officialAcademicRequirement: "Not published in the provided 2026 fee sheet.",
    chinaStudentRequirement: "Not published in the provided 2026 fee sheet.",
    specialRequirementsNote: null,
    applicationDocs: arr(["Passport", "Academic transcript", "English score report"], ["护照", "成绩单", "英语成绩单"], ["護照", "成績單", "英語成績單"], ["Pasport", "Transkrip akademik", "Keputusan bahasa Inggeris"]),
    curriculum: arr([], [], [], []),
    careers: arr([], [], [], []),
    specializations: arr(specializations, specializations, specializations, specializations),
    description: t(
      `${program.nameEn} is listed in the provided 2026 SEGi University fee sheet. StudyMY stores the fee total, tuition component, SST, intake dates, and source hash from that PDF.`,
      `${program.nameZhCN}已列入本次提供的世纪大学 2026 学费单；StudyMY 已保存该 PDF 中的总额、学费组成、SST、开课日期和来源哈希。`,
      `${program.nameZhTW || program.nameZhCN}已列入本次提供的世紀大學 2026 學費單；StudyMY 已保存該 PDF 中的總額、學費組成、SST、開課日期和來源雜湊。`,
      `${program.nameEn} disenaraikan dalam jadual yuran SEGi University 2026 yang diberikan. StudyMY menyimpan jumlah yuran, komponen tuisyen, SST, tarikh ambilan dan hash sumber daripada PDF tersebut.`
    ),
    officialAccreditationNote: "Accreditation details should be verified from the linked SEGi programme detail page or its MQA certificate where available.",
    officialSourceUrl: officialProgramUrl,
    officialEntryRequirementSourceUrl: officialProgramUrl,
    officialAccreditationSourceUrl: officialProgramUrl,
    sourceUrls: officialProgramUrl ? [
      {
        url: officialProgramUrl,
        title: `SEGi official programme page - ${officialPage.title}`,
        sourceType: "profile" as const,
        verifiedAt,
        status: officialSourceStatus,
        note: sourceCorrectionNote
      }
    ] : null,
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: officialSourceStatus,
    publicDisplayStatus: "ready" as const,
    publicDisplayNote: "Programme source link is calibrated to the official SEGi detail page. Fee amount is retained from the provided 2026 fee sheet because the official detail page did not publish a public tuition link in the source-link audit.",
    reviewReason: null,
    auditNote: `Imported from provided 2026 SEGi fee sheet. Source hash: ${feeSheetHash}. Official programme source calibrated to ${officialProgramUrl || "missing official programme URL"} on 2026-06-17.`,
    listTuitionText: `MYR ${amountDisplay} total`,
    isPublished: true
  };
}

function levelCounts() {
  return segi2026ProgramFees.reduce<Record<DegreeLevel, number>>((acc, program) => {
    acc[program.level] += 1;
    return acc;
  }, { bachelor: 0, master: 0, "postgraduate-certificate": 0, "postgraduate-diploma": 0, phd: 0, diploma: 0 } as Record<DegreeLevel, number>);
}

async function run() {
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
    await dataSource.transaction(async (manager) => {
      const universities = manager.getRepository(UniversityEntity);
      const programs = manager.getRepository(ProgramEntity);
      let university = await universities.findOne({ where: { code: "SEGI" } });
      if (!university) {
        university = universities.create({
          slug: "segi-university",
          code: "SEGI",
          name: t("SEGi University", "世纪大学", "世紀大學", "SEGi University"),
          shortName: "SEGi",
          logoUrl: "/assets/university-logo-placeholder.svg",
          imageUrl: "/assets/university-cover-placeholder.svg",
          color: "#7C3AED",
          qsRank: 701,
          qsAsiaRank: 999,
          location: t("Petaling Jaya", "八打灵再也", "八打靈再也", "Petaling Jaya"),
          region: t("Selangor", "雪兰莪州", "雪蘭莪州", "Selangor"),
          ownership: "private",
          institutionType: "comprehensive",
          foundedYear: 1977,
          students: 0,
          intlStudents: 0,
          csrCertified: true,
          description: t(
            "SEGi University is represented with programme fee records from the provided 2026 fee sheet.",
            "世纪大学已根据本次提供的 2026 学费单补齐专业费用记录。",
            "世紀大學已根據本次提供的 2026 學費單補齊專業費用記錄。",
            "SEGi University direkodkan dengan yuran program daripada jadual yuran 2026 yang diberikan."
          ),
          website: "https://www.segi.edu.my",
          admissionEmail: "pending-update@studymy.local",
          tuitionMinCny: 0,
          tuitionMaxCny: 0,
          livingCostCny: 26000,
          minIelts: 5.5,
          acceptNoLanguage: true,
          facilities: arr(["Pending official detail-page verification"], ["待官方详情页复核"], ["待官方詳情頁覆核"], ["Menunggu pengesahan halaman rasmi"]),
          highlights: arr(["2026 fee sheet imported"], ["已导入 2026 学费单"], ["已匯入 2026 學費單"], ["Jadual yuran 2026 telah diimport"]),
          nameEnOfficial: "SEGi University",
          officialWebsite: "https://www.segi.edu.my",
          officialSources: [
            { title: "SEGi University official website", url: "https://university.segi.edu.my/", sourceType: "official-website", verifiedAt, status: "official-verified" },
            { title: "SEGi University programme search", url: "https://university.segi.edu.my/course-search/", sourceType: "study-portal", verifiedAt, status: "official-verified" }
          ],
          officialVerifiedAt: verifiedAt,
          officialSourceStatus: "needs-review",
          publicDisplayStatus: "ready",
          officialAuditSummary: "Programme fees imported from user-provided 2026 fee sheet.",
          programCount: 0,
          isPublished: true
        });
        university = await universities.save(university);
      }

      await programs.update({ universityId: university.id }, {
        publicDisplayStatus: "needs-review",
        reviewReason: "Superseded by controlled SEGi 2026 fee-sheet import or absent from the provided fee sheet.",
        isPublished: true
      });

      for (const program of segi2026ProgramFees) {
        const payload = toProgramPayload(program, university.id);
        const existing = await programs.findOne({ where: { universityId: university.id, code: program.code } });
        await programs.save(programs.create(existing ? { ...existing, ...payload } : payload));
      }

      const importedPrograms = await programs.find({ where: { universityId: university.id, publicDisplayStatus: "ready", isPublished: true } });
      university.programCount = importedPrograms.length;
      university.tuitionMinCny = Math.min(...importedPrograms.map((program) => program.annualTuitionCny));
      university.tuitionMaxCny = Math.max(...importedPrograms.map((program) => program.annualTuitionCny));
      university.officialVerifiedAt = verifiedAt;
      university.officialSourceStatus = "official-verified";
      university.officialSources = [
        { title: "SEGi University official website", url: "https://university.segi.edu.my/", sourceType: "official-website", verifiedAt, status: "official-verified" },
        { title: "SEGi University programme search", url: "https://university.segi.edu.my/course-search/", sourceType: "study-portal", verifiedAt, status: "official-verified" }
      ];
      university.officialAuditSummary = `Imported ${importedPrograms.length} degree programmes from the provided 2026 SEGi fee sheet and calibrated public programme source links to official SEGi detail pages. English intensive and foundation rows are outside the current public degree-level schema.`;
      await universities.save(university);
    });

    console.log(JSON.stringify({
      institution: "SEGI",
      imported: segi2026ProgramFees.length,
      levelCounts: levelCounts(),
      source: feeSheetSource,
      sourceHash: feeSheetHash,
      verifiedAt
    }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

if (process.argv[1]?.endsWith("import-segi-2026-fee-sheet.ts")) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
