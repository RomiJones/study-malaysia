import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

type UTMCurrentCycleStatus = "ready-for-detail-enrichment" | "international-unavailable-current-cycle";

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
  unavailableCurrentCycleRows: number;
  importRows: number;
  uniqueSlugs: number;
  officialTotalFeeRows: number;
  detailParsedRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UTMImportVerification {
  importedRows: number;
  readyRows: number;
  publishedRows: number;
  notAvailableForInternationalRows: number;
  legacyBachelorPublicRows: number;
  officialTotalFeeRows: number;
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

function durationYears(candidate: UTMProgrammeCandidate) {
  if (candidate.canonicalDecision.currentCycleStatus === "international-unavailable-current-cycle") {
    const detailDuration = candidate.programmeDetail?.duration;
    if (detailDuration?.minYears && detailDuration.minYears >= 3 && detailDuration.minYears <= 6) return detailDuration.minYears;
    if (detailDuration?.semesters && detailDuration.semesters >= 6 && detailDuration.semesters <= 12) return detailDuration.semesters / 2;
    return 0;
  }
  const detailDuration = candidate.programmeDetail?.duration;
  if (detailDuration?.minYears && detailDuration.minYears >= 3 && detailDuration.minYears <= 6) return detailDuration.minYears;
  if (detailDuration?.semesters && detailDuration.semesters >= 6 && detailDuration.semesters <= 12) return detailDuration.semesters / 2;
  return 4;
}

function durationOfficial(candidate: UTMProgrammeCandidate) {
  if (candidate.canonicalDecision.currentCycleStatus === "international-unavailable-current-cycle") {
    return `UTM official international undergraduate directory marks this programme as not open to international applicants for the current cycle: ${candidate.intakeText}`;
  }
  const detailDuration = candidate.programmeDetail?.duration;
  if (detailDuration?.officialText && durationYears(candidate) !== 4) return detailDuration.officialText;
  if (detailDuration?.officialText && /four|4|8 semesters?/i.test(detailDuration.officialText)) return detailDuration.officialText;
  return "Displayed as 4 years for undergraduate review based on UTM current international fee table semester structure (semester 1 plus semesters 2-8); programme-detail duration remains flagged where not explicitly published.";
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
  return links;
}

export function validateUtmUndergraduateCandidate(dataset: UTMCandidateDataset) {
  const errors: string[] = [];
  if (dataset.universityCode !== "UTM") errors.push("Candidate universityCode must be UTM.");
  if (dataset.level !== "bachelor") errors.push("Candidate level must be bachelor.");
  if (dataset.applicantScope !== "international") errors.push("Candidate applicantScope must be international.");
  if (dataset.programmeCount !== dataset.programmes.length) errors.push("programmeCount must match programmes length.");
  const ready = dataset.programmes.filter((item) => item.canonicalDecision.currentCycleStatus === "ready-for-detail-enrichment");
  const unavailable = dataset.programmes.filter(
    (item) => item.canonicalDecision.currentCycleStatus === "international-unavailable-current-cycle"
  );
  if (dataset.programmes.length !== 44) errors.push(`Expected 44 canonical UTM undergraduate rows; got ${dataset.programmes.length}.`);
  if (ready.length !== 40) errors.push(`Expected 40 ready UTM undergraduate rows; got ${ready.length}.`);
  if (unavailable.length !== 4) errors.push(`Expected 4 current-cycle unavailable rows; got ${unavailable.length}.`);
  for (const record of ready) {
    if (record.level !== "bachelor") errors.push(`Row ${record.ordinal} is not bachelor level.`);
    if (record.applicantScope !== "international") errors.push(`Row ${record.ordinal} is not international applicant scope.`);
    if (!record.nameEnOfficial) errors.push(`Row ${record.ordinal} has no official English name.`);
    if (!record.facultyEn) errors.push(`Row ${record.ordinal} has no faculty.`);
    if (!record.tuition?.totalTuitionMYR) errors.push(`Row ${record.ordinal} has no official total tuition MYR.`);
    if (record.languageRequirements?.scores?.IELTS == null) errors.push(`Row ${record.ordinal} has no IELTS route.`);
    if (record.programmeDetail?.status !== "official-detail-parsed") errors.push(`Row ${record.ordinal} has no parsed official detail page.`);
  }
  return errors;
}

function buildUniversityRow(readyProgramCount: number, canonicalProgramCount: number, unavailableCurrentCycleRows: number): DeepPartial<UniversityEntity> {
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
    qsRank: 0,
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
      "UTM publishes general international undergraduate entry requirements and country-specific requirement tables; China-specific values remain in the official country table for reviewer confirmation."
    ]),
    officialProfile: {
      collectionScope: "UTM undergraduate international candidate import",
      academicSession: "September 2026 intake candidate plus current UTM undergraduate admission pages",
      cnyDisplayRateNote: `CNY display uses internal review conversion ${cnyPerMyr} CNY/MYR and is not an official UTM amount.`,
      catalogStatusSummary: {
        all: {
          total: canonicalProgramCount,
          ready: readyProgramCount,
          needsReview: 0,
          notAvailableForInternational: unavailableCurrentCycleRows
        },
        byLevel: {
          bachelor: {
            total: canonicalProgramCount,
            ready: readyProgramCount,
            needsReview: 0,
            notAvailableForInternational: unavailableCurrentCycleRows
          },
          master: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 },
          phd: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 }
        }
      }
    },
    officialSources,
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified",
    officialAuditSummary: `UTM undergraduate official import: ${canonicalProgramCount} canonical bachelor programmes are published from official UTM sources; ${readyProgramCount} are current international-ready rows and ${unavailableCurrentCycleRows} are published with official current-cycle not-open-to-international status.`,
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
      const isReady = candidate.canonicalDecision.currentCycleStatus === "ready-for-detail-enrichment";
      const years = durationYears(candidate);
      const totalMyr = candidate.tuition.totalTuitionMYR;
      const translatedFaculty = facultyText(candidate.facultyEn);
      const detail = candidate.programmeDetail;
      const mqaCodes = detail?.mqaCodes || [];
      const sourceStatus: OfficialSourceStatus = isReady
        ? "official-verified"
        : "official-page-verified-international-not-available";
      const publicDisplayStatus: PublicDisplayStatus = isReady ? "ready" : "not-available-for-international";
      const feeStatus: FeeAuditStatus = "matched-official";
      const curriculum = splitOfficialText(detail?.curriculumText);
      const careers = splitOfficialText(detail?.careerText);
      const overview = normalizeText(detail?.overviewText, 650);
      const durationNote = durationOfficial(candidate);
      const programmeAcademicRequirement = normalizeText(detail?.entryRequirementText, 900);
      const auditFlags = Object.entries(candidate.fieldCoverage)
        .filter(([, status]) => ["not-confirmed", "official-unpublished", "pending-after-fact-lock"].includes(status))
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
        annualTuitionCny: isReady ? annualTuitionCny(totalMyr, years) : 0,
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
          : "UTM official international undergraduate directory marks this programme as not offered for both September and February in the 2026/2027 academic session.",
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
            candidate.generalRequirements.academicRequirementSummary,
            "需具备高中毕业证书或同等大学预科资格，并满足英语要求；建筑学与工业设计需通过 UTM 面试。具体国家要求以 UTM 官方国家表为准。",
            "需具備高中畢業證書或同等大學預科資格，並滿足英語要求；建築學與工業設計需通過 UTM 面試。具體國家要求以 UTM 官方國家表為準。"
          )
        },
        officialAcademicRequirement: candidate.generalRequirements.academicRequirementSummary,
        chinaStudentRequirement:
          "UTM publishes country-specific international undergraduate entry requirement tables; China-specific values require reviewer confirmation from the official table.",
        specialRequirementsNote: /Architecture|Industrial Design/i.test(candidate.nameEnOfficial)
          ? "UTM general undergraduate requirements state that Bachelor of Architecture and Bachelor of Science Industrial Design require passing the UTM interview."
          : null,
        applicationDocs: arr(
          applicationDocs,
          ["学历证书与成绩单", "护照资料页", "英语语言成绩", "如项目要求，提交专项补充材料"],
          ["學歷證書與成績單", "護照資料頁", "英語語言成績", "如課程要求，提交專項補充材料"]
        ),
        curriculum: arr(curriculum),
        careers: arr(careers),
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
          ? "Local review import from official UTM sources. Remaining weak fields are retained in audit notes for reviewer follow-up."
          : "Published for official catalogue completeness. UTM marks this programme as not offered to international applicants for both September and February intakes in the 2026/2027 academic session.",
        reviewReason: isReady
          ? auditFlags.length ? `Weak-field follow-up: ${auditFlags.join(", ")}.` : null
          : `Official UTM current-cycle status: ${candidate.intakeText}`,
        auditNote: [
          `Imported from UTM undergraduate official candidate ordinal ${candidate.ordinal}.`,
          `Canonical current-cycle status: ${candidate.canonicalDecision.currentCycleStatus}.`,
          `Detail status: ${detail?.status || "missing"}.`,
          `Duration display note: ${durationNote}`,
          `Supplemental duration evidence: ${JSON.stringify(detail?.supplementalDurationEvidence || null)}.`,
          `Programme academic requirement detail evidence: ${programmeAcademicRequirement || "n/a"}.`,
          `Local source path: ${detail?.sourcePath || "n/a"}.`,
          `Original field coverage: ${JSON.stringify(candidate.fieldCoverage)}.`
        ].join(" "),
        listTuitionText: tuitionDisplay(totalMyr),
        isPublished: true
      };
    });
}

export function summarizeUtmUndergraduateImport(dataset: UTMCandidateDataset, rows: DeepPartial<ProgramEntity>[]): UTMImportSummary {
  return {
    candidateRows: dataset.programmes.length,
    readyRows: dataset.programmes.filter((item) => item.canonicalDecision.currentCycleStatus === "ready-for-detail-enrichment").length,
    unavailableCurrentCycleRows: dataset.programmes.filter(
      (item) => item.canonicalDecision.currentCycleStatus === "international-unavailable-current-cycle"
    ).length,
    importRows: rows.length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialTotalFeeRows: rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official").length,
    detailParsedRows: dataset.programmes.filter(
      (item) =>
        item.canonicalDecision.currentCycleStatus === "ready-for-detail-enrichment" &&
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
  const publishedRows = rows.filter((row) => row.isPublished);
  const notAvailableForInternationalRows = rows.filter((row) => row.publicDisplayStatus === "not-available-for-international");
  const officialTotalFeeRows = rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official");
  const languageRows = rows.filter((row) => Number(row.languageRequirement?.ielts || 0) >= 5.5);
  const sourceLinkedRows = rows.filter((row) => (row.sourceUrls || []).length >= 5);
  if (
    rows.length !== expectedRows ||
    readyRows.length !== 40 ||
    publishedRows.length !== expectedRows ||
    notAvailableForInternationalRows.length !== 4 ||
    officialTotalFeeRows.length !== expectedRows ||
    languageRows.length !== expectedRows ||
    sourceLinkedRows.length !== expectedRows ||
    legacyBachelorPublicRows !== 0
  ) {
    throw new Error(
      `UTM import verification failed: expected=${expectedRows}, actual=${rows.length}, ready=${readyRows.length}, published=${publishedRows.length}, notAvailable=${notAvailableForInternationalRows.length}, officialFees=${officialTotalFeeRows.length}, language=${languageRows.length}, sourceLinks=${sourceLinkedRows.length}, legacyPublic=${legacyBachelorPublicRows}.`
    );
  }
  return {
    importedRows: rows.length,
    readyRows: readyRows.length,
    publishedRows: publishedRows.length,
    notAvailableForInternationalRows: notAvailableForInternationalRows.length,
    legacyBachelorPublicRows,
    officialTotalFeeRows: officialTotalFeeRows.length,
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
            notAvailableForInternationalRows: 4,
            archiveLegacyPublicBachelorRows: true,
            unavailableCurrentCycleRowsPublishedWithOfficialClosedStatus: true,
            readyRows: { isPublished: true, publicDisplayStatus: "ready" },
            unavailableRows: { isPublished: true, publicDisplayStatus: "not-available-for-international" },
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
      const readyProgramCount = dataset.programmes.filter(
        (item) => item.canonicalDecision.currentCycleStatus === "ready-for-detail-enrichment"
      ).length;
      const unavailableCurrentCycleRows = dataset.programmes.filter(
        (item) => item.canonicalDecision.currentCycleStatus === "international-unavailable-current-cycle"
      ).length;
      const universitySeed = buildUniversityRow(readyProgramCount, dataset.programmes.length, unavailableCurrentCycleRows);
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
      university.programCount = await programRepo.count({
        where: { universityId: university.id, isPublished: true, publicDisplayStatus: In(["ready", "not-available-for-international"]) }
      });
      await universityRepo.save(university);
    });

    console.log(
      JSON.stringify(
        {
          mode: "imported",
          universityId: university?.id,
          backupPath,
          summary,
          verification,
          universityProgramCount: university?.programCount
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
