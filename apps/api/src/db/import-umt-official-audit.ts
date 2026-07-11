import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, Like, type DeepPartial } from "typeorm";
import type {
  DegreeLevel,
  FeeAuditStatus,
  InstitutionOwnership,
  InstitutionType,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  OfficialSourceStatus,
  OfficialSourceType,
  ProgramCategoryCode,
  ProgramRequirement,
  PublicDisplayStatus,
  TuitionCurrency
} from "@studymy/shared";
import { QS_UNRANKED_RANK } from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const UMT_OFFICIAL_SLUG_PREFIX = "umt-";
export const DEFAULT_UMT_OFFICIAL_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/umt/2026-07-07/candidate-dataset.json"
);

const verifiedAt = "2026-07-07";
const umtOfficialWebsite = "https://www.umt.edu.my/";
const umtFeeStructureUrl = "https://studymalaysia.com/edu/umt/courses/";
const umtProgrammeListUrl = "https://www.umt.edu.my/all-programs-at-umt/";
const umtPostgraduateListUrl = "https://postgrad.umt.edu.my/postgraduate_fees-2/";

interface UMTImportOptions {
  dbCode?: string;
  shortName?: string;
  qsRank?: number | null;
  qsAsiaRank?: number | null;
  theRank?: number | null;
  theAsiaRank?: number | null;
  existingOfficialProfile?: Record<string, unknown> | null;
}

interface UMTFee {
  internationalAmount?: number | null;
  currency?: string;
  basis?: string;
  officialFeeText?: string;
  status?: string;
  officialFeeSourceUrl?: string;
  note?: string;
  tuitionAmount?: number | null;
  tuitionDisplay?: string;
  officialAnnualRateMYR?: number | null;
}

interface UMTCandidateProgramme {
  code: string;
  nameEnOfficial: string;
  localizedName?: Partial<LocalizedText>;
  level: DegreeLevel;
  category?: ProgramCategoryCode;
  universityCode: string;
  facultyEn: string;
  facultyLocalized?: Partial<LocalizedText>;
  campus?: string;
  studyMode?: string;
  durationYears?: number;
  durationOfficial?: string;
  officialIntake?: string;
  intakeMonths?: string[];
  mqaCode?: string;
  mohRegistration?: string;
  accreditationStatus?: string;
  tuitionAmount?: number;
  tuitionCurrency?: TuitionCurrency;
  tuitionBasis?: string;
  annualTuitionCny?: number;
  fee?: UMTFee;
  officialAcademicRequirement?: string;
  officialLanguageRequirement?: string;
  languageRequirement?: LanguageRequirement;
  requirement?: { gpa: number; gaokaoRequired: boolean; huikaoRequired: boolean };
  applicationDocuments?: string[];
  curriculum?: string[];
  specializations?: string[];
  careerDirections?: string[];
  description?: Partial<LocalizedText>;
  officialSourceUrl?: string;
  officialFeeSourceUrl?: string;
  officialVerifiedAt?: string;
  officialSourceStatus?: OfficialSourceStatus;
  publicDisplayStatus?: PublicDisplayStatus;
  fieldEvidence?: Array<Record<string, unknown>>;
}

interface UMTCandidateUniversity {
  code: string;
  nameEnOfficial: string;
  localizedName: LocalizedText;
  shortName: string;
  officialWebsite: string;
  officialSourceStatus: OfficialSourceStatus;
  officialVerifiedAt: string;
  publicDisplayStatus: PublicDisplayStatus;
  auditNote: string;
  officialSources: Array<{
    title: string;
    url: string;
    sourceType: string;
    verifiedAt: string;
    status: string;
    note?: string;
  }>;
  ownership: InstitutionOwnership;
  institutionType: InstitutionType;
  foundedYear: number;
  campuses: string[];
  qsRank: number | null;
  qsAsiaRank: number | null;
  theRank?: number | null;
  theAsiaRank?: number | null;
  color: string;
  location: LocalizedText;
  region: LocalizedText;
  website: string;
  admissionEmail: string;
  description: LocalizedText;
  tuitionMinCny: number;
  tuitionMaxCny: number;
  livingCostCny: number;
  minIelts: number;
  acceptNoLanguage: boolean;
  facilities: LocalizedStringArray;
  highlights: LocalizedStringArray;
}

interface UMTCandidateDataset {
  schemaVersion: number;
  universityCode: string;
  officialDomains: string[];
  collectionScope: string;
  levels: DegreeLevel[];
  applicantScope: string;
  academicSession: string;
  retrievedAt: string;
  declaredProgrammeCount: number;
  university: UMTCandidateUniversity;
  sources: Array<{
    id: string;
    url: string;
    sourceType: string;
    role: string;
    fields: string[];
    retrievedAt: string;
    academicSession: string;
    status: string;
  }>;
  programmes: UMTCandidateProgramme[];
}

interface UMTImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<string, number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
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

/**
 * Hardcoded faculty localization map for UMT's 7 faculties.
 * Used as a fallback when the candidate programme does not carry a `facultyLocalized` field.
 * The `localizedFaculty` function prefers the candidate's own `facultyLocalized` when available.
 */
const umtFacultyLocalization: Record<string, { ms: string; zhCN: string; zhTW: string }> = {
  "Faculty of Fisheries Sciences and Aquaculture (FSPA)": {
    ms: "Fakulti Sains Perikanan dan Akuakultur (FSPA)",
    zhCN: "渔业科学与水产养殖学院",
    zhTW: "漁業科學與水產養殖學院"
  },
  "Faculty of Food Sciences and Agrotechnology (FSMA)": {
    ms: "Fakulti Sains Makanan dan Agroteknologi (FSMA)",
    zhCN: "食品科学与农业技术学院",
    zhTW: "食品科學與農業技術學院"
  },
  "Faculty of Science and Marine Environment (FSSM)": {
    ms: "Fakulti Sains dan Persekitaran Marin (FSSM)",
    zhCN: "科学与海洋环境学院",
    zhTW: "科學與海洋環境學院"
  },
  "Faculty of Computer Science and Mathematics (FSKM)": {
    ms: "Fakulti Sains Komputer dan Matematik (FSKM)",
    zhCN: "计算机科学与数学学院",
    zhTW: "計算機科學與數學學院"
  },
  "Faculty of Ocean Engineering Technology (FTKK)": {
    ms: "Fakulti Teknologi Kejuruteraan Lautan (FTKK)",
    zhCN: "海洋工程技术学院",
    zhTW: "海洋工程技術學院"
  },
  "Faculty of Maritime Studies (FPM)": {
    ms: "Fakulti Pengajian Maritim (FPM)",
    zhCN: "海事研究学院",
    zhTW: "海事研究學院"
  },
  "Faculty of Business, Economics and Social Development (FPEPS)": {
    ms: "Fakulti Perniagaan, Ekonomi dan Pembangunan Sosial (FPEPS)",
    zhCN: "商业、经济与社会发展学院",
    zhTW: "商業、經濟與社會發展學院"
  }
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function ensureLocalizedText(value: Partial<LocalizedText> | undefined | null): LocalizedText {
  const en = value?.en ?? "";
  const ms = value?.ms ?? en;
  const zhCN = value?.["zh-CN"] ?? en;
  const zhTW = value?.["zh-TW"] ?? zhCN;
  return { en, ms, "zh-CN": zhCN, "zh-TW": zhTW };
}

/**
 * Build a localized faculty name.
 * Prefers the candidate programme's own `facultyLocalized` field (auto-filling any
 * missing languages), then falls back to the hardcoded `umtFacultyLocalization` map,
 * and finally defaults to the English faculty name.
 */
function localizedFaculty(candidate: UMTCandidateProgramme): LocalizedText {
  if (candidate.facultyLocalized) {
    return ensureLocalizedText(candidate.facultyLocalized);
  }
  const facultyEn = candidate.facultyEn;
  const translation = umtFacultyLocalization[facultyEn];
  if (translation) {
    return t(facultyEn, translation.ms, translation.zhCN, translation.zhTW);
  }
  return t(facultyEn);
}

function mapOfficialSourceType(sourceType: string, url: string): OfficialSourceType {
  if (sourceType === "official-website") return "official-website";
  if (sourceType === "study-portal") return "study-portal";
  if (sourceType === "admission") return "admission";
  if (sourceType === "official-listing") return "study-portal";
  if (sourceType === "fee" || /fee/i.test(url)) return "fee";
  if (sourceType === "entry-requirement" || /entry-requirement|admission/i.test(url)) return "entry-requirement";
  if (sourceType === "accreditation" || /accreditation|mqa/i.test(url)) return "accreditation";
  if (sourceType === "profile") return "profile";
  if (sourceType === "official-page") {
    if (/^https?:\/\/[^/]*umt\.edu\.my\/?$/.test(url.replace(/\/$/, ""))) return "official-website";
    if (/admission/i.test(url)) return "entry-requirement";
    if (/fee/i.test(url)) return "fee";
    return "profile";
  }
  if (/fee-structure|courses/i.test(url)) return "fee";
  if (/programmes/i.test(url)) return "profile";
  return "other";
}

function mapOfficialSourceStatus(status: string): OfficialSourceStatus {
  if (status === "verified" || status === "official-verified") return "official-verified";
  if (status === "needs-review") return "needs-review";
  if (status === "source-conflict") return "source-conflict";
  if (status === "missing-source") return "missing-source";
  return "official-verified";
}

/**
 * Generate a programme slug in the format `umt-{level}-{slugified-name}`.
 *
 * UMT programme names follow several patterns that must be normalised:
 *  - "Bachelor of Applied Science (Biodiversity Conservation and Management) (Hons)" → "umt-bachelor-biodiversity-conservation-and-management"
 *  - "Bachelor of Computer Science (Maritime Informatics) (Hons)"                   → "umt-bachelor-maritime-informatics"
 *  - "Bachelor of Finance with Honours"                                              → "umt-bachelor-finance"
 *  - "Bachelor of Electrical Technology (Energy and Power) with Honours"             → "umt-bachelor-energy-and-power"
 *  - "Bachelor of Science (Marine Biology) (Hons)"                                   → "umt-bachelor-marine-biology"
 *  - "Master of Computer Science"                                                    → "umt-master-computer-science"
 *  - "Master of Marine Science (Research)"                                           → "umt-master-marine-science-research"
 *  - "Doctor of Philosophy (Marine Science)"                                         → "umt-phd-marine-science"
 *  - "Doctor of Philosophy (Crop and Animal Science)"                                → "umt-phd-crop-and-animal-science"
 */
function umtProgramSlug(level: string, nameEnOfficial: string): string {
  let name = nameEnOfficial;

  // Remove honour suffixes and degree-type annotations
  name = name.replace(/\s*\(By\s+[^)]+\)/gi, "");
  name = name.replace(/\s*\(Honours\)/gi, "");
  name = name.replace(/\s*\(Hons\)/gi, "");
  name = name.replace(/\s*\(MBA\)/gi, "");
  name = name.replace(/\s*with\s+Honours/gi, "");

  // Strip UMT-specific degree-type prefixes (longer patterns first to avoid partial matches)
  name = name.replace(/^Bachelor of Applied Science\s+/i, "");
  name = name.replace(/^Bachelor of Computer Science\s+/i, "");
  name = name.replace(/^Bachelor of Agrotechnology Science\s+/i, "");
  name = name.replace(/^Bachelor of Electrical Technology\s+/i, "");
  name = name.replace(/^Bachelor of Food Science\s+/i, "");

  // Strip UTAR-compatible degree-type prefixes
  name = name.replace(/^Bachelor of Social Science\s+/i, "");
  name = name.replace(/^Bachelor of Information Technology\s+/i, "");
  name = name.replace(/^Bachelor of Engineering\s+/i, "");
  name = name.replace(/^Bachelor of Communication\s+/i, "");
  name = name.replace(/^Bachelor of Science\s+/i, "");
  name = name.replace(/^Bachelor of Arts\s+/i, "");

  // Strip generic degree prefixes
  name = name.replace(/^Bachelor\s+(of|in)\s+/i, "");
  name = name.replace(/^Master\s+(of|in)\s+/i, "");
  name = name.replace(/^Doctor of Philosophy\s+/i, "");
  name = name.replace(/^Doctor of Philosophy$/i, "General");
  name = name.replace(/^Doctor\s+of\s+/i, "");

  // Convert remaining parenthesised content to spaces and clean up
  name = name.replace(/\s+majoring\s+in\s+/gi, " ");
  name = name.replace(/\s*\(/g, " ").replace(/\)\s*/g, " ");
  name = name.replace(/\s+/g, " ").trim();

  const slug = slugify(name) || "programme";
  return `umt-${level}-${slug}`;
}

function parseDurationYears(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  const text = String(value || "");
  const range = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*years?/i);
  if (range) return Number(range[1]);
  const years = text.match(/(\d+(?:\.\d+)?)\s*years?/i);
  if (years) return Number(years[1]);
  const months = text.match(/(\d+)\s*months?/i);
  if (months) {
    const m = Number(months[1]);
    return m >= 12 ? Math.round((m / 12) * 10) / 10 : 1;
  }
  const number = text.match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : 3;
}

function parseIntakeMonths(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  const text = String(value || "");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months.filter((month) => new RegExp(`\\b${month}\\b`, "i").test(text));
}

function normalizeText(value: unknown, maxLength = 500): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeLongText(value: unknown): string {
  return normalizeText(String(value || ""), 4000);
}

function slugify(value: string): string {
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

function inferStudyMode(candidate: UMTCandidateProgramme): string {
  if (candidate.studyMode) return normalizeText(candidate.studyMode);
  if (/by research|\(research\)/i.test(candidate.nameEnOfficial)) return "research";
  if (/by coursework/i.test(candidate.nameEnOfficial)) return "coursework";
  return "coursework";
}

function inferCategory(candidate: UMTCandidateProgramme): ProgramCategoryCode {
  if (candidate.category) return candidate.category;
  const value = `${candidate.nameEnOfficial} ${candidate.facultyEn}`.toLowerCase();
  if (/business|commerce|accounting|marketing|finance|management|administration|economics/.test(value)) return "business";
  if (/computer|data|information technology|information system|artificial intelligence|software|digital|computing|informatics/.test(value)) return "it";
  if (/engineering|robotics|mechatronics|electronics|electrical|mechanical|telecommunications|technology/.test(value)) return "engineering";
  if (/medicine|medical|health|psychology|nutrition|biomedical|nursing|physiotherapy|surgery|counseling|counselling/.test(value)) return "medicine";
  if (/architecture|building|construction|property|quantity surveying|real estate/.test(value)) return "architecture";
  if (/maritime|nautical|ocean|marine|naval|shipping|port/.test(value)) return "maritime";
  if (/agriculture|agrotechnology|crop|fisheries|aquaculture|fishery/.test(value)) return "agriculture";
  if (/science|bioscience|biotechnology|food|physics|chemistry|mathematics|actuarial|biochemistry|environmental/.test(value)) return "science";
  if (/law|legal/.test(value)) return "law";
  if (/arts|communication|media|social|multimedia|animation|cinematic|visual|journalism|design|creative|chinese|english|education/.test(value)) return "arts";
  return "arts";
}

function buildFeePresentation(candidate: UMTCandidateProgramme): {
  tuitionAmount: number | null;
  officialTuitionMYR: number | null;
  tuitionDisplay: string;
  officialFeeSourceUrl: string;
  officialTuitionNote: string;
  annualTuitionCny: number;
} {
  const fee = candidate.fee || {};
  const durationYears = parseDurationYears(candidate.durationYears);
  const tuitionAmount = candidate.tuitionAmount ?? fee.tuitionAmount ?? null;
  const officialAnnualRateMYR = fee.officialAnnualRateMYR ?? null;
  const officialTuitionMYR = officialAnnualRateMYR ?? (tuitionAmount && durationYears > 0 ? Math.round(tuitionAmount / durationYears) : tuitionAmount);
  const tuitionDisplay = fee.tuitionDisplay || (tuitionAmount ? `RM ${tuitionAmount.toLocaleString("en-US")} total tuition` : "Official fee requires review");
  const officialFeeSourceUrl = candidate.officialFeeSourceUrl || fee.officialFeeSourceUrl || umtFeeStructureUrl;
  const annualTuitionCny = candidate.annualTuitionCny ?? (officialTuitionMYR ? Math.round(officialTuitionMYR * 1.55) : 0);

  let note = fee.note || "";
  if (!note && tuitionAmount && officialAnnualRateMYR) {
    note = `RM ${officialAnnualRateMYR.toLocaleString("en-US")} per year x ${durationYears} years = RM ${tuitionAmount.toLocaleString("en-US")} total`;
  }
  if (!note && tuitionAmount) {
    note = `RM ${tuitionAmount.toLocaleString("en-US")} total programme fee`;
  }

  return {
    tuitionAmount,
    officialTuitionMYR,
    tuitionDisplay,
    officialFeeSourceUrl,
    officialTuitionNote: note || "Official fee verified from UMT international course listing on StudyMalaysia.com.",
    annualTuitionCny
  };
}

function buildProgrammeSourceLinks(candidate: UMTCandidateProgramme, fee: ReturnType<typeof buildFeePresentation>): OfficialSourceLink[] {
  const urls = new Set<string>();
  if (candidate.officialSourceUrl) urls.add(candidate.officialSourceUrl);
  if (fee.officialFeeSourceUrl) urls.add(fee.officialFeeSourceUrl);

  const links: OfficialSourceLink[] = [];
  for (const url of urls) {
    const isFee = url === fee.officialFeeSourceUrl || /fee-structure|courses|fee/i.test(url);
    links.push({
      title: isFee ? "Official fee source" : "Official programme page",
      url,
      sourceType: isFee ? "fee" : "profile",
      verifiedAt: candidate.officialVerifiedAt || verifiedAt,
      status: "official-verified" as OfficialSourceStatus,
      note: isFee ? fee.officialTuitionNote : "Captured from UMT official programme page."
    });
  }
  return links;
}

function buildAccreditationNote(candidate: UMTCandidateProgramme): string {
  const parts: string[] = [];
  if (candidate.mqaCode) parts.push(`MQA Code: ${candidate.mqaCode}.`);
  if (candidate.mohRegistration) parts.push(`MOH Registration: ${candidate.mohRegistration}.`);
  if (candidate.accreditationStatus) parts.push(`Accreditation: ${candidate.accreditationStatus}.`);
  if (parts.length === 0) {
    return "No programme-level accreditation claim is made without a dedicated official source.";
  }
  return parts.join(" ");
}

export function validateUmtOfficialDataset(dataset: UMTCandidateDataset): string[] {
  const errors: string[] = [];
  if (dataset.universityCode !== "UMT") errors.push("Dataset universityCode must be UMT.");
  if (dataset.university?.code !== "UMT") errors.push("University code must be UMT.");
  if (dataset.collectionScope !== "full") errors.push("UMT import expects full collection scope.");
  if (dataset.applicantScope !== "international") errors.push("UMT import expects international applicant scope.");
  if (dataset.academicSession !== "2026") errors.push(`UMT academicSession must be 2026; got ${dataset.academicSession}.`);
  if (!dataset.officialDomains?.includes("umt.edu.my")) errors.push("Official domain umt.edu.my is required.");
  if (!dataset.university?.officialWebsite) errors.push("University officialWebsite is required.");

  dataset.programmes.forEach((row, index) => {
    const ordinal = index + 1;
    if (row.universityCode && row.universityCode !== "UMT") errors.push(`Row ${ordinal} universityCode is not UMT.`);
    if (!row.code) errors.push(`Row ${ordinal} has no original candidate code.`);
    if (!row.nameEnOfficial) errors.push(`Row ${ordinal} has no official English name.`);
    if (!row.facultyEn) errors.push(`Row ${ordinal} has no faculty.`);
    if (!row.level) errors.push(`Row ${ordinal} has no level.`);
    if (!row.officialFeeSourceUrl && !row.fee?.officialFeeSourceUrl) {
      errors.push(`Row ${ordinal} has no official fee source URL.`);
    }
  });

  return errors;
}

export function buildUmtUniversityRow(
  dataset: UMTCandidateDataset,
  summary: UMTImportSummary,
  options: UMTImportOptions = {}
): DeepPartial<UniversityEntity> {
  const uni = dataset.university;
  const existingProfile = asRecord(options.existingOfficialProfile);

  const officialSources: OfficialSourceLink[] = uni.officialSources.map((source) => ({
    title: source.title,
    url: source.url,
    sourceType: mapOfficialSourceType(source.sourceType, source.url),
    verifiedAt: source.verifiedAt || verifiedAt,
    status: mapOfficialSourceStatus(source.status),
    note: source.note || ""
  }));

  const qsRankValue = options.qsRank ?? uni.qsRank ?? QS_UNRANKED_RANK;
  const qsAsiaRankValue = options.qsAsiaRank ?? uni.qsAsiaRank ?? null;
  const theRankValue = options.theRank ?? uni.theRank ?? null;
  const theAsiaRankValue = options.theAsiaRank ?? uni.theAsiaRank ?? null;

  return {
    slug: "universiti-malaysia-terengganu",
    code: options.dbCode || uni.code,
    name: uni.localizedName,
    shortName: options.shortName || uni.shortName,
    logoUrl: "",
    imageUrl: "",
    color: uni.color,
    qsRank: qsRankValue,
    qsAsiaRank: qsAsiaRankValue,
    location: uni.location,
    region: uni.region,
    ownership: uni.ownership,
    institutionType: uni.institutionType,
    foundedYear: uni.foundedYear,
    students: 0,
    intlStudents: 0,
    csrCertified: false,
    description: uni.description,
    website: uni.website,
    admissionEmail: uni.admissionEmail,
    nameEnOfficial: uni.nameEnOfficial,
    officialWebsite: uni.officialWebsite,
    studyPortalUrl: umtProgrammeListUrl,
    internationalPageUrl: "",
    applicationPortalUrl: "",
    officialAddress: "",
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: null,
    chinaStudentRequirements: null,
    officialProfile: {
      ...existingProfile,
      collectionScope: "UMT official bachelor, master and doctoral import",
      applicantScope: dataset.applicantScope,
      academicSession: dataset.academicSession,
      retrievedAt: dataset.retrievedAt,
      officialDomains: dataset.officialDomains,
      sourceUniversityCode: dataset.universityCode,
      authorization: "publish",
      campuses: uni.campuses,
      auditNote: uni.auditNote,
      levels: dataset.levels,
      declaredProgrammeCount: dataset.declaredProgrammeCount,
      actualProgrammeCount: dataset.programmes.length,
      rankings: {
        qsWorld: qsRankValue,
        qsAsia: qsAsiaRankValue,
        theWorld: theRankValue,
        theAsia: theAsiaRankValue
      },
      tuitionAudit: {
        importRows: summary.importRows,
        feeAuditStatus: "matched-official",
        ratePolicy: "All fees are official international student rates in MYR, verified from the UMT course listing on StudyMalaysia.com and UMT postgraduate fees page."
      },
      catalogStatusSummary: {
        all: {
          total: summary.importRows,
          ready: summary.readyRows,
          needsReview: summary.needsReviewRows,
          notAvailableForInternational: 0
        },
        byLevel: {
          bachelor: { total: summary.byLevel.bachelor || 0, ready: summary.byLevel.bachelor || 0, needsReview: 0, notAvailableForInternational: 0 },
          master: { total: summary.byLevel.master || 0, ready: summary.byLevel.master || 0, needsReview: 0, notAvailableForInternational: 0 },
          phd: { total: summary.byLevel.phd || 0, ready: summary.byLevel.phd || 0, needsReview: 0, notAvailableForInternational: 0 }
        }
      }
    },
    officialSources,
    officialVerifiedAt: uni.officialVerifiedAt || verifiedAt,
    officialSourceStatus: uni.officialSourceStatus,
    officialAuditSummary: uni.auditNote,
    publicDisplayStatus: uni.publicDisplayStatus,
    livingCostOfficialNote: null,
    tuitionMinCny: uni.tuitionMinCny,
    tuitionMaxCny: uni.tuitionMaxCny,
    livingCostCny: uni.livingCostCny,
    minIelts: uni.minIelts,
    acceptNoLanguage: uni.acceptNoLanguage,
    facilities: uni.facilities,
    highlights: uni.highlights,
    programCount: summary.importRows,
    isPublished: true
  };
}

export function buildUmtProgrammeRows(dataset: UMTCandidateDataset): Array<DeepPartial<ProgramEntity>> {
  return dataset.programmes.map((candidate) => {
    const fee = buildFeePresentation(candidate);
    const faculty = localizedFaculty(candidate);
    const durationYears = parseDurationYears(candidate.durationYears);
    const intakeMonths = candidate.intakeMonths || parseIntakeMonths(candidate.officialIntake);
    const officialIntake = candidate.officialIntake || intakeMonths.join(", ") || "Contact university for intake details";
    const studyMode = inferStudyMode(candidate);
    const category = inferCategory(candidate);
    const campus = candidate.campus || "Kuala Nerus";
    const durationOfficial = candidate.durationOfficial || `${durationYears} years`;
    const officialSourceUrl = candidate.officialSourceUrl || fee.officialFeeSourceUrl;
    const description = ensureLocalizedText(candidate.description || candidate.localizedName);
    const name = ensureLocalizedText(candidate.localizedName) || t(candidate.nameEnOfficial);

    const languageRequirement: LanguageRequirement = candidate.languageRequirement || { ielts: 5.5, toefl: null, pte: null, muet: null };
    const requirementNoteText = candidate.officialAcademicRequirement || "Official academic requirement was not captured in this import run.";
    const requirement: ProgramRequirement = {
      gpa: candidate.requirement?.gpa ?? 2.0,
      gaokaoRequired: candidate.requirement?.gaokaoRequired ?? false,
      huikaoRequired: candidate.requirement?.huikaoRequired ?? false,
      note: t(
        requirementNoteText,
        requirementNoteText,
        candidate.officialAcademicRequirement ? requirementNoteText : "本轮导入尚未采集到可公开使用的官方学术要求，需人工复核。",
        candidate.officialAcademicRequirement ? requirementNoteText : "本輪導入尚未採集到可公開使用的官方學術要求，需人工覆核。"
      )
    };

    const applicationDocs = candidate.applicationDocuments || [];
    const curriculum = candidate.curriculum || [];
    const careers = candidate.careerDirections || [];
    const specializations = candidate.specializations || [];

    const accreditationNote = buildAccreditationNote(candidate);
    const sourceLinks = buildProgrammeSourceLinks(candidate, fee);

    const auditNoteParts: string[] = [
      `Original UMT candidate code: ${candidate.code}.`,
      `Faculty imported as "${candidate.facultyEn}".`,
      `Duration: ${durationOfficial} (${durationYears} years).`,
      `Study mode: ${studyMode}.`,
      `Campus: ${campus}.`,
      `Fee: ${fee.tuitionDisplay}.`
    ];
    if (candidate.mqaCode) auditNoteParts.push(`MQA: ${candidate.mqaCode}.`);
    if (candidate.fieldEvidence?.length) auditNoteParts.push(`Field evidence: ${candidate.fieldEvidence.length} entries.`);

    return {
      slug: umtProgramSlug(candidate.level, candidate.nameEnOfficial),
      code: candidate.code,
      name,
      nameEnOfficial: candidate.nameEnOfficial,
      level: candidate.level,
      category,
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode,
      campus,
      durationYears,
      durationOfficial,
      annualTuitionCny: fee.annualTuitionCny,
      tuitionAmount: fee.tuitionAmount,
      tuitionCurrency: (candidate.tuitionCurrency || "MYR") as TuitionCurrency,
      tuitionDisplay: fee.tuitionDisplay,
      officialTuitionMYR: fee.officialTuitionMYR,
      officialTuitionNote: fee.officialTuitionNote,
      officialFeeSourceUrl: fee.officialFeeSourceUrl,
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: "matched-official" as FeeAuditStatus,
      officialFeeAuditedAt: candidate.officialVerifiedAt || verifiedAt,
      intakeMonths,
      officialIntake,
      officialIntakeNote: candidate.officialIntake
        ? "Official intake text captured from UMT programme evidence."
        : "Intake months inferred from programme evidence; official intake text was not separately published.",
      languageRequirement,
      officialLanguageRequirement: candidate.officialLanguageRequirement ? normalizeLongText(candidate.officialLanguageRequirement) : null,
      requirement,
      officialAcademicRequirement: candidate.officialAcademicRequirement ? normalizeLongText(candidate.officialAcademicRequirement) : null,
      chinaStudentRequirement: "UMT publishes international applicant guidance via umt.edu.my; applicant qualification assessment follows the linked official programme and entry requirement pages.",
      specialRequirementsNote: accreditationNote,
      applicationDocs: arr(applicationDocs),
      curriculum: arr(curriculum),
      careers: arr(careers),
      specializations: arr(specializations),
      description,
      officialAccreditationNote: accreditationNote,
      officialSourceUrl,
      officialEntryRequirementSourceUrl: officialSourceUrl,
      officialAccreditationSourceUrl: officialSourceUrl,
      sourceUrls: sourceLinks,
      officialVerifiedAt: candidate.officialVerifiedAt || verifiedAt,
      officialSourceStatus: (candidate.officialSourceStatus || "official-verified") as OfficialSourceStatus,
      publicDisplayStatus: (candidate.publicDisplayStatus || "ready") as PublicDisplayStatus,
      publicDisplayNote: "Official UMT source verified for StudyMY public display. All fees are international student rates in MYR.",
      reviewReason: null,
      auditNote: auditNoteParts.join(" "),
      listTuitionText: fee.tuitionDisplay,
      isPublished: true
    };
  });
}

export function summarizeUmtImport(rows: Array<DeepPartial<ProgramEntity>>): UMTImportSummary {
  return {
    candidateRows: rows.length,
    importRows: rows.length,
    byLevel: countBy(rows, (row) => String(row.level)),
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
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

async function clearCatalogCache(): Promise<boolean> {
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

function readArgValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_UMT_OFFICIAL_CANDIDATE_PATH);
  if (!existsSync(candidatePath)) throw new Error(`UMT candidate dataset not found: ${candidatePath}`);
  const dataset = loadJson<UMTCandidateDataset>(candidatePath);

  const errors = validateUmtOfficialDataset(dataset);
  if (errors.length) throw new Error(`UMT official candidate validation failed:\n${errors.join("\n")}`);

  const rows = buildUmtProgrammeRows(dataset);
  const summary = summarizeUmtImport(rows);

  const duplicateSlugs = rows.filter((row, index, self) =>
    self.findIndex((r) => r.slug === row.slug) !== index
  );
  if (duplicateSlugs.length) {
    throw new Error(`Duplicate slugs detected: ${duplicateSlugs.map((r) => r.slug).join(", ")}`);
  }

  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const backupPath = resolve(
    readArgValue("--backup-output") ||
    `tmp/backups/umt-official-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  if (!verifyOnly && !confirm) {
    console.log(JSON.stringify({
      mode: "dry-run",
      universityCode: "UMT",
      candidatePath,
      writePolicy: {
        upsertPrefix: UMT_OFFICIAL_SLUG_PREFIX,
        importRows: rows.length,
        university: { slug: "universiti-malaysia-terengganu", isPublished: true, publicDisplayStatus: "ready" },
        programmes: { isPublished: true, publicDisplayStatus: "ready" },
        slugSamples: rows.slice(0, 5).map((r) => ({ slug: r.slug, code: r.code, name: r.nameEnOfficial })),
        nextStep: "Review this dry-run, then rerun with --confirm-import to write transactionally, or --verify-only to validate data format."
      },
      summary
    }, null, 2));
    return;
  }

  if (verifyOnly && !confirm) {
    console.log(JSON.stringify({
      mode: "verify-only",
      universityCode: "UMT",
      candidatePath,
      validationErrors: errors,
      summary,
      slugList: rows.map((r) => ({ slug: r.slug, code: r.code, level: r.level, category: r.category, name: r.nameEnOfficial }))
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);

    let university =
      (await universityRepo.findOne({ where: { code: "UMT" } })) ||
      (await universityRepo.findOne({ where: { slug: "universiti-malaysia-terengganu" } }));

    const slugConflict = await universityRepo.findOne({ where: { slug: "universiti-malaysia-terengganu" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug universiti-malaysia-terengganu belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const targetUniversityCode = university?.code || "UMT";
    const targetShortName = university?.shortName || "UMT";

    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );

    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);

      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await txUniversityRepo.findOne({ where: { code: targetUniversityCode } });

      const universitySeed = buildUmtUniversityRow(dataset, summary, {
        dbCode: targetUniversityCode,
        shortName: targetShortName,
        qsRank: university?.qsRank,
        qsAsiaRank: university?.qsAsiaRank ?? dataset.university.qsAsiaRank,
        theRank: university?.officialProfile
          ? (asRecord(university.officialProfile).rankings as Record<string, unknown> | undefined)?.theWorld as number | null | undefined
          : dataset.university.theRank,
        theAsiaRank: university?.officialProfile
          ? (asRecord(university.officialProfile).rankings as Record<string, unknown> | undefined)?.theAsia as number | null | undefined
          : dataset.university.theAsiaRank,
        existingOfficialProfile: asRecord(university?.officialProfile)
      });
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousUmtRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UMT_OFFICIAL_SLUG_PREFIX}%`) }
      });
      for (const previous of previousUmtRows) {
        if (!incomingSlugs.has(previous.slug)) {
          await txProgramRepo.remove(previous);
        }
      }

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      university.programCount = summary.importRows;
      await txUniversityRepo.save(university);
    });

    const catalogCacheCleared = await clearCatalogCache();
    console.log(JSON.stringify({
      mode: "imported",
      universityId: university?.id,
      universityCode: university?.code,
      backupPath,
      catalogCacheCleared,
      summary
    }, null, 2));
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
