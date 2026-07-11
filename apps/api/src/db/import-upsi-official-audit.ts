import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, type DeepPartial } from "typeorm";
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
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEFAULT_UPSI_CANDIDATE_PATH = resolve(repositoryRoot, "data/imports/upsi/2026-07-07/candidate-dataset.json");
const UPSI_PROGRAM_SLUG_PREFIX = "upsi-";
const UPSI_UNIVERSITY_SLUG = "universiti-pendidikan-sultan-idris";
const verifiedAt = "2026-07-07";
const feeSourceUrl = "https://www.upsi.edu.my/wp-content/uploads/2025/07/IMC.pdf";
const programmeListUrl = "https://bhea.upsi.edu.my/landing-page/";
const postgraduateListUrl = "https://ips.upsi.edu.my/list-of/";
const postgraduateFeeUrl = "https://ips.upsi.edu.my/wp-content/uploads/2025/05/Terkini_Kadar-Yuran-Pelajar-Antarabangsa_MAC-2026-INTAKE.pdf";
const requirementUrl = "https://ips.upsi.edu.my/future-students/requirement/";

interface UpsIUniversity {
  code: string;
  nameEnOfficial: string;
  localizedName: LocalizedText;
  shortName: string;
  officialWebsite: string;
  officialSourceStatus: OfficialSourceStatus;
  officialVerifiedAt: string;
  publicDisplayStatus: PublicDisplayStatus;
  ownership: InstitutionOwnership;
  institutionType: string;
  foundedYear: number;
  legacySince?: number;
  campuses: string[];
  location: string;
  region: string;
  website: string;
  admissionEmail: string;
  description: Partial<LocalizedText>;
  qsRank?: {
    year: number;
    display: string;
    sourceUrl: string;
  };
  theRank?: {
    display: string;
    sourceUrl: string;
  };
  activeStudents?: number;
  internationalStudents?: number;
  alumni?: number;
  facilities?: string[];
  highlights?: string[];
}

interface UpsIProgramme {
  code: string;
  slug: string;
  nameEnOfficial: string;
  localizedName: LocalizedText;
  level: DegreeLevel;
  category?: ProgramCategoryCode;
  domain?: string;
  universityCode: string;
  facultyEn: string;
  facultyLocalized?: LocalizedText;
  campus?: string;
  studyMode?: string;
  durationYears?: number | null;
  durationOfficial?: string;
  officialIntake?: string;
  intakeMonths?: Array<string | number>;
  tuitionAmount?: number | null;
  tuitionCurrency?: TuitionCurrency;
  annualTuitionCny?: number | null;
  fee?: {
    amountMYR?: number | null;
    status?: string;
    officialFeeSourceUrl?: string | null;
    academicYear?: string;
  };
  officialAcademicRequirement?: string;
  officialLanguageRequirement?: string;
  languageRequirement?: {
    ielts?: number;
    toefl?: number | null;
    toeflIbt?: number | null;
    pte?: number | null;
    muet?: string | number | null;
  };
  applicationDocuments?: string[];
  curriculum?: string[];
  specializations?: string[];
  careerDirections?: string[];
  description?: string | Partial<LocalizedText>;
  tuitionDisplay?: string;
  officialSourceUrl?: string;
  officialSourceStatus?: OfficialSourceStatus;
  officialFeeAuditStatus?: string;
  publicDisplayStatus?: PublicDisplayStatus;
  auditNote?: string;
}

interface UpsIDataset {
  schemaVersion: number;
  universityCode: string;
  officialDomains: string[];
  collectionScope: string;
  levels: DegreeLevel[];
  applicantScope: string;
  academicSession: string;
  retrievedAt: string;
  safeToImport: boolean;
  declaredProgrammeCount: Record<string, unknown>;
  university: UpsIUniversity;
  sources: Array<{
    id: string;
    url: string;
    sourceType?: string;
    role?: string;
    fields?: string[];
    retrievedAt?: string;
    academicSession?: string;
    status?: string;
  }>;
  programmeBaseline?: Record<string, unknown>;
  tuitionModel?: Record<string, unknown>;
  gate1DryRun?: Record<string, unknown>;
  gate2ThreeLayerVerification?: Record<string, unknown>;
  qualityScoreDraft?: Record<string, unknown>;
  programmes: UpsIProgramme[];
}

interface ImportSummary {
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function ensureLocalizedText(value: Partial<LocalizedText> | string | undefined | null): LocalizedText {
  if (typeof value === "string") return t(value);
  const en = value?.en ?? "";
  const ms = value?.ms ?? en;
  const zhCN = value?.["zh-CN"] ?? en;
  const zhTW = value?.["zh-TW"] ?? zhCN;
  return { en, ms, "zh-CN": zhCN, "zh-TW": zhTW };
}

function normalizeText(value: unknown, maxLength = 500): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeLongText(value: unknown): string {
  return normalizeText(value, 4000);
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function dateOnly(value: unknown): string {
  const text = String(value || verifiedAt);
  return text.slice(0, 10);
}

function mapSourceType(sourceType: string | undefined, url: string): OfficialSourceType {
  if (sourceType === "official-website") return "official-website";
  if (sourceType === "admission") return "admission";
  if (sourceType === "fee" || /fee|yuran|IMC\.pdf/i.test(url)) return "fee";
  if (sourceType === "entry-requirement" || /requirement|admission/i.test(url)) return "entry-requirement";
  if (sourceType === "profile" || /about|topuniversities|list-of|landing-page/i.test(url)) return "profile";
  return "other";
}

function mapSourceStatus(status: string | undefined): OfficialSourceStatus {
  if (status === "source-conflict") return "source-conflict";
  if (status === "missing-source") return "missing-source";
  if (status === "needs-review") return "needs-review";
  return "official-verified";
}

function normalizeInstitutionType(value: string): InstitutionType {
  if (value === "research" || value === "applied" || value === "comprehensive") return value;
  return "comprehensive";
}

function normalizeCategory(candidate: UpsIProgramme): ProgramCategoryCode {
  if (candidate.domain) {
    if (["business", "it", "engineering", "science", "arts", "medicine", "law"].includes(candidate.domain)) {
      return candidate.domain;
    }
  }
  if (candidate.category && candidate.category !== "education") return candidate.category;
  const value = `${candidate.nameEnOfficial} ${candidate.facultyEn}`.toLowerCase();
  if (/accounting|business|management|entrepreneurship|economics|finance/.test(value)) return "business";
  if (/software|computer|information technology|multimedia|data/.test(value)) return "it";
  if (/science|biology|chemistry|physics|mathematics|agriculture|sports science/.test(value)) return "science";
  if (/counselling|health|medicine|nursing/.test(value)) return "medicine";
  if (/law/.test(value)) return "law";
  if (/design|music|performing|language|communication|history|geography|education|tesl|malay|tamil/.test(value)) return "arts";
  return "arts";
}

function normalizeIntakeMonths(value: Array<string | number> | undefined): string[] {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  if (!value?.length) return ["March", "October"];
  return value
    .map((item) => {
      if (typeof item === "number") return monthNames[item - 1] || String(item);
      return String(item);
    })
    .filter(Boolean);
}

function normalizeFeeAuditStatus(value: string | undefined, fallback: FeeAuditStatus): FeeAuditStatus {
  const allowed: FeeAuditStatus[] = [
    "matched-official",
    "fee-sheet-verified",
    "official-approximate",
    "calculated-from-official-rate",
    "official-rate-verified",
    "official-non-scalar",
    "conflict",
    "source-conflict",
    "pending-review",
    "not-published"
  ];
  return allowed.includes(value as FeeAuditStatus) ? (value as FeeAuditStatus) : fallback;
}

function normalizeLanguageRequirement(candidate: UpsIProgramme): LanguageRequirement {
  return {
    ielts: Number(candidate.languageRequirement?.ielts || 5),
    toefl: candidate.languageRequirement?.toefl ?? candidate.languageRequirement?.toeflIbt ?? 40,
    pte: candidate.languageRequirement?.pte ?? null,
    muet: candidate.languageRequirement?.muet == null
      ? 3.5
      : Number(String(candidate.languageRequirement.muet).replace(/[^0-9.]/g, "")) || null
  };
}

function buildSourceLinks(candidate?: UpsIProgramme): OfficialSourceLink[] {
  const candidateHasPublishedFee =
    candidate == null ||
    (Number.isFinite(Number(candidate.tuitionAmount)) && Number(candidate.tuitionAmount) > 0);
  const links: OfficialSourceLink[] = [
    {
      title: "UPSI IMAC international undergraduate fee and requirement PDF",
      url: feeSourceUrl,
      sourceType: "fee",
      verifiedAt,
      status: "official-verified",
      note: candidateHasPublishedFee
        ? "Official international bachelor fee list effective January 2026."
        : "Current IMAC international undergraduate fee sheet was checked; this candidate programme is not listed with a fee amount."
    },
    {
      title: "UPSI BHEA undergraduate programme count",
      url: programmeListUrl,
      sourceType: "profile",
      verifiedAt,
      status: "official-verified",
      note: "BHEA states 54 bachelor and 14 diploma programmes; current IMAC fee sheet lists 46 international bachelor fee rows."
    }
  ];
  if (candidate) {
    if (candidate.officialSourceUrl) {
      links.push({
        title: "UPSI official programme or faculty source",
        url: candidate.officialSourceUrl,
        sourceType: "profile",
        verifiedAt,
        status: candidate.officialSourceStatus || "official-verified",
        note: "Official UPSI source used to confirm the programme exists in the bachelor catalogue."
      });
    }
    links.push({
      title: "UPSI bachelor entry requirement source",
      url: feeSourceUrl,
      sourceType: "entry-requirement",
      verifiedAt,
      status: candidate.officialSourceStatus || "official-verified",
      note: candidate.officialLanguageRequirement || null
    });
  }
  return links;
}

function buildUniversitySources(dataset: UpsIDataset): OfficialSourceLink[] {
  const links = dataset.sources
    .filter((source) => source.url)
    .map<OfficialSourceLink>((source) => ({
      title: source.role || source.url,
      url: source.url,
      sourceType: mapSourceType(source.sourceType, source.url),
      verifiedAt: dateOnly(source.retrievedAt),
      status: mapSourceStatus(source.status),
      note: source.fields?.join(", ") || null
    }));
  return links;
}

function validateDataset(dataset: UpsIDataset): string[] {
  const errors: string[] = [];
  if (dataset.universityCode !== "UPSI") errors.push("Dataset universityCode must be UPSI.");
  if (dataset.university?.code !== "UPSI") errors.push("University code must be UPSI.");
  if (dataset.applicantScope !== "international") errors.push("UPSI import expects international applicant scope.");
  if (!dataset.officialDomains?.includes("upsi.edu.my")) errors.push("Official domain upsi.edu.my is required.");
  if (!dataset.gate1DryRun?.tsCompileZeroErrors) errors.push("GATE 1 TS compile/build result is not marked as passed.");
  if (!dataset.gate1DryRun?.slugUnique) errors.push("GATE 1 slug uniqueness is not marked as passed.");
  if (!dataset.gate1DryRun?.institutionTypeMax20) errors.push("GATE 1 institutionType length is not marked as passed.");
  if (!dataset.gate1DryRun?.fourLanguageProgrammeNameNonEmpty) errors.push("GATE 1 four-language programme names are not marked as passed.");
  if (!dataset.gate1DryRun?.tuitionPositiveForFeeListedProgrammes && !dataset.gate1DryRun?.tuitionPositiveForModelledProgrammes) {
    errors.push("GATE 1 positive tuition check for fee-listed programmes is not marked as passed.");
  }

  dataset.programmes.forEach((row, index) => {
    const ordinal = index + 1;
    const feeStatus = row.officialFeeAuditStatus || row.fee?.status || "";
    const hasPublishedFee = Number.isFinite(Number(row.tuitionAmount)) && Number(row.tuitionAmount) > 0;
    if (row.universityCode !== "UPSI") errors.push(`Row ${ordinal} universityCode is not UPSI.`);
    if (!row.slug?.startsWith(UPSI_PROGRAM_SLUG_PREFIX)) errors.push(`Row ${ordinal} slug must start with upsi-.`);
    if (!row.nameEnOfficial) errors.push(`Row ${ordinal} has no official English name.`);
    if (!row.facultyEn) errors.push(`Row ${ordinal} has no faculty.`);
    if (!row.level) errors.push(`Row ${ordinal} has no level.`);
    if (!hasPublishedFee && feeStatus !== "not-published") errors.push(`Row ${ordinal} has invalid tuition without not-published fee status.`);
    if (!hasPublishedFee && !row.officialSourceUrl) errors.push(`Row ${ordinal} missing official programme source for unpublished fee exception.`);
    for (const locale of ["en", "ms", "zh-CN", "zh-TW"] as const) {
      if (!row.localizedName?.[locale]) errors.push(`Row ${ordinal} missing localizedName.${locale}.`);
    }
  });
  return errors;
}

function buildProgrammeRows(dataset: UpsIDataset): Array<DeepPartial<ProgramEntity>> {
  return dataset.programmes.map((candidate) => {
    const durationYears = candidate.durationYears || 4;
    const rawTuitionAmount = candidate.tuitionAmount == null ? null : Number(candidate.tuitionAmount);
    const hasPublishedFee = Number.isFinite(rawTuitionAmount) && Number(rawTuitionAmount) > 0;
    const totalTuitionMYR = hasPublishedFee ? Number(rawTuitionAmount) : null;
    const annualTuitionMYR = totalTuitionMYR == null ? null : Math.round(totalTuitionMYR / durationYears);
    const annualTuitionCny = candidate.annualTuitionCny ?? (annualTuitionMYR == null ? 0 : Math.round(annualTuitionMYR * 1.7));
    const feeAuditStatus = hasPublishedFee
      ? normalizeFeeAuditStatus(candidate.officialFeeAuditStatus, "fee-sheet-verified")
      : ("not-published" satisfies FeeAuditStatus);
    const officialFeeSourceUrl = candidate.fee?.officialFeeSourceUrl || feeSourceUrl;
    const isFacultyBrochureFee = feeAuditStatus === "official-approximate";
    const totalTuitionDisplay = totalTuitionMYR?.toLocaleString("en-US") || "";
    const annualTuitionDisplay = annualTuitionMYR?.toLocaleString("en-US") || "";
    const tuitionDisplay = candidate.tuitionDisplay || (hasPublishedFee
      ? `RM ${totalTuitionDisplay} total programme fee`
      : "Official international tuition not published in current UPSI IMAC fee sheet");
    const name = ensureLocalizedText(candidate.localizedName);
    const faculty = ensureLocalizedText(candidate.facultyLocalized || t(candidate.facultyEn));
    const intakeMonths = normalizeIntakeMonths(candidate.intakeMonths);
    const officialAcademicRequirement = normalizeLongText(candidate.officialAcademicRequirement);
    const officialLanguageRequirement = normalizeLongText(candidate.officialLanguageRequirement);
    const requirement: ProgramRequirement = {
      gpa: 2.5,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: t(
        officialAcademicRequirement,
        officialAcademicRequirement,
        "国际本科申请通常需完成 A-Level/同等学历三门 C 等级，或 12 年高中毕业证书，或受认可文凭且 CGPA 2.50；部分专业需面试或特定科目要求。",
        "國際本科申請通常需完成 A-Level/同等學歷三門 C 等級，或 12 年高中畢業證書，或受認可文憑且 CGPA 2.50；部分專業需面試或特定科目要求。"
      )
    };
    const description = ensureLocalizedText(candidate.description || (hasPublishedFee
      ? {
          en: isFacultyBrochureFee
            ? `${candidate.nameEnOfficial} is listed in UPSI official faculty brochure material with a MYR ${totalTuitionDisplay} total fee for the bachelor education category over the stated study duration. The source does not separately label this as international-student tuition.`
            : `${candidate.nameEnOfficial} is listed in UPSI's official IMAC international undergraduate fee sheet with a MYR ${totalTuitionDisplay} total programme fee effective January 2026.`,
          "zh-CN": isFacultyBrochureFee
            ? `${name["zh-CN"]} 已在 UPSI 官方学院宣传册费用页列入本科教育类学制总费用 RM ${totalTuitionDisplay}；该来源未单独标注为国际学生学费。`
            : `${name["zh-CN"]} 已列入 UPSI 官方 IMAC 国际本科费用表，国际生项目总学费为 RM ${totalTuitionDisplay}，2026 年 1 月起生效。`,
          "zh-TW": isFacultyBrochureFee
            ? `${name["zh-TW"]} 已在 UPSI 官方學院宣傳冊費用頁列入本科教育類學制總費用 RM ${totalTuitionDisplay}；該來源未單獨標註為國際學生學費。`
            : `${name["zh-TW"]} 已列入 UPSI 官方 IMAC 國際本科費用表，國際生項目總學費為 RM ${totalTuitionDisplay}，2026 年 1 月起生效。`
        }
      : {
          en: `${candidate.nameEnOfficial} is confirmed by UPSI official programme or faculty sources. The current UPSI IMAC international undergraduate fee sheet does not publish a fee amount for this programme.`,
          "zh-CN": `${name["zh-CN"]} 已由 UPSI 官方专业或学院页面确认存在；当前 UPSI IMAC 国际本科费用表未公布该专业学费金额。`,
          "zh-TW": `${name["zh-TW"]} 已由 UPSI 官方專業或學院頁面確認存在；當前 UPSI IMAC 國際本科費用表未公布該專業學費金額。`
        }));
    const applicationDocs = candidate.applicationDocuments || [
      "application form",
      "academic transcripts/certificates",
      "passport copy",
      "English test result where required",
      "processing fee receipt"
    ];
    const auditNote = [
      `UPSI review publish import from candidate row ${candidate.code}.`,
      hasPublishedFee
        ? (isFacultyBrochureFee
            ? "Published for Ian review from UPSI official faculty brochure total-fee row; source does not separately label international-student tuition."
            : "Published for Ian review from current IMAC fee-listed row.")
        : "Published for Ian review as a BHEA 54-bachelor reconciliation row; official programme exists but current IMAC international fee sheet does not publish a matching fee.",
      candidate.auditNote || "Programme detail page, curriculum and programme-specific duration remain pending review."
    ].join(" ");

    return {
      slug: candidate.slug,
      code: candidate.code,
      name,
      nameEnOfficial: candidate.nameEnOfficial,
      level: candidate.level,
      category: normalizeCategory(candidate),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: normalizeText(candidate.studyMode || "full-time", 80),
      campus: normalizeText(candidate.campus || "Tanjong Malim, Perak", 120),
      durationYears,
      durationOfficial: candidate.durationOfficial
        ? normalizeText(candidate.durationOfficial)
        : `${durationYears} years (programme-specific duration pending official detail verification)`,
      annualTuitionCny,
      tuitionAmount: totalTuitionMYR,
      tuitionCurrency: hasPublishedFee ? ((candidate.tuitionCurrency || "MYR") as TuitionCurrency) : "UNKNOWN",
      tuitionDisplay,
      officialTuitionMYR: totalTuitionMYR,
      officialTuitionNote: hasPublishedFee
        ? (isFacultyBrochureFee
            ? `${candidate.fee?.academicYear || "UPSI official faculty brochure lists this bachelor education category total fee for the stated study duration."} Annual comparison value is derived separately as RM ${annualTuitionDisplay} per year over ${durationYears} years for catalogue display only.`
            : `UPSI IMAC PDF lists RM ${totalTuitionDisplay} total international programme fee effective January 2026. Annual filter value is derived separately as RM ${annualTuitionDisplay} per year over ${durationYears} years for catalogue comparison only.`)
        : "UPSI official programme/faculty source confirms the programme; the current IMAC international undergraduate fee sheet does not list a matching fee amount for this programme.",
      officialFeeSourceUrl,
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: feeAuditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths,
      officialIntake: normalizeText(candidate.officialIntake || intakeMonths.join(", "), 255),
      officialIntakeNote: "IMAC/BHEA intake text captured at catalogue level; programme-specific intake remains pending detail-page review.",
      languageRequirement: normalizeLanguageRequirement(candidate),
      officialLanguageRequirement,
      requirement,
      officialAcademicRequirement,
      chinaStudentRequirement: "UPSI publishes international applicant requirements; Chinese credential equivalence follows MQA/senate assessment and must be confirmed during application review.",
      specialRequirementsNote: "Programme-specific interview, portfolio, subject or faculty requirement may apply; not marked final until programme detail page review is complete.",
      applicationDocs: arr(applicationDocs),
      curriculum: arr(candidate.curriculum || []),
      careers: arr(candidate.careerDirections || []),
      specializations: arr(candidate.specializations || []),
      description,
      officialAccreditationNote: "No programme-level accreditation claim is made in this review import without a dedicated official accreditation source.",
      officialSourceUrl: candidate.officialSourceUrl || feeSourceUrl,
      officialEntryRequirementSourceUrl: feeSourceUrl,
      officialAccreditationSourceUrl: feeSourceUrl,
      sourceUrls: buildSourceLinks(candidate),
      officialVerifiedAt: verifiedAt,
      officialSourceStatus: candidate.officialSourceStatus || "official-verified",
      publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
      publicDisplayNote: hasPublishedFee
        ? (isFacultyBrochureFee
            ? "Published for Ian review from UPSI official faculty brochure fee material; international-student fee label remains not separately stated by the source."
            : "Published for Ian review from UPSI official sources; not final until full reconciliation and GATE 2 browser verification are complete.")
        : "Published for Ian review to complete the official BHEA bachelor count; current IMAC fee sheet does not publish this programme's international tuition.",
      reviewReason: hasPublishedFee
        ? (isFacultyBrochureFee
            ? "Review publish: faculty brochure total fee displayed by user instruction; not treated as IMAC international fee-sheet verification."
            : "Review publish: undergraduate fee rows are official, but programme detail pages/curriculum/duration remain pending.")
        : "Review publish: official programme row added to reconcile BHEA 54-bachelor count; fee remains not published in current IMAC fee sheet.",
      auditNote,
      listTuitionText: tuitionDisplay,
      isPublished: true
    };
  });
}

function summarize(rows: Array<DeepPartial<ProgramEntity>>): ImportSummary {
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

function buildUniversityRow(
  dataset: UpsIDataset,
  summary: ImportSummary,
  existingOfficialProfile?: Record<string, unknown> | null
): DeepPartial<UniversityEntity> {
  const uni = dataset.university;
  const existingProfile = asRecord(existingOfficialProfile);
  const qsRankDisplay = uni.qsRank?.display || "851-900";
  const qsRank = Number(qsRankDisplay.match(/\d+/)?.[0] || 851);
  const description = ensureLocalizedText({
    en: uni.description.en || "UPSI is Malaysia's education-focused public university, tracing its roots to SITC in 1922 and formally established as a university in 1997.",
    ms: uni.description.ms || uni.description.en || "Universiti Pendidikan Sultan Idris is a public university in Tanjong Malim, Perak.",
    "zh-CN": uni.description["zh-CN"] || "UPSI 是马来西亚以教育为核心的公立大学，源自 1922 年 Sultan Idris Training College，1997 年正式升格为大学，位于霹雳州丹绒马林。",
    "zh-TW": uni.description["zh-TW"] || uni.description["zh-CN"] || "UPSI 是馬來西亞以教育為核心的公立大學，源自 1922 年 Sultan Idris Training College，1997 年正式升格為大學，位於霹靂州丹絨馬林。"
  });
  const facilities = uni.facilities || ["two campuses", "accommodation", "international centre", "library", "MOOC", "campus VR tour"];
  const highlights = uni.highlights || ["education-focused public university", "10 faculties", "century-long education legacy", "QS WUR 2027 band 851-900"];

  return {
    slug: UPSI_UNIVERSITY_SLUG,
    code: uni.code,
    name: uni.localizedName,
    shortName: uni.shortName,
    logoUrl: "",
    imageUrl: "",
    color: "#B9852C",
    qsRank,
    qsAsiaRank: 156,
    location: t("Tanjong Malim, Perak", "Tanjong Malim, Perak", "霹雳州丹绒马林", "霹靂州丹絨馬林"),
    region: t("Perak", "Perak", "霹雳州", "霹靂州"),
    ownership: uni.ownership,
    institutionType: normalizeInstitutionType(uni.institutionType),
    foundedYear: uni.foundedYear,
    students: uni.activeStudents || 25901,
    intlStudents: uni.internationalStudents || 1406,
    csrCertified: false,
    description,
    website: uni.website,
    admissionEmail: uni.admissionEmail,
    nameEnOfficial: uni.nameEnOfficial,
    officialWebsite: uni.officialWebsite,
    studyPortalUrl: programmeListUrl,
    internationalPageUrl: "https://www.upsi.edu.my/international/",
    applicationPortalUrl: "https://kemasukan.upsi.edu.my/",
    officialAddress: "Universiti Pendidikan Sultan Idris, 35900 Tanjong Malim, Perak Darul Ridzuan, Malaysia",
    applicationPeriods: ["March intake", "October intake"],
    applicationFees: ["Undergraduate international processing fee RM120 / USD30"],
    applicationDocuments: arr([
      "application form",
      "academic transcripts/certificates",
      "passport copy",
      "English test result where required",
      "processing fee receipt"
    ]),
    chinaStudentRequirements: arr([
      "Chinese qualifications are assessed against UPSI/MQA-recognized equivalent qualifications during application review."
    ]),
    officialProfile: {
      ...existingProfile,
      collectionMethod: "new five-phase two-gate workflow",
      reviewPublish: true,
      applicantScope: dataset.applicantScope,
      academicSession: dataset.academicSession,
      retrievedAt: dataset.retrievedAt,
      sourceUniversityCode: dataset.universityCode,
      officialDomains: dataset.officialDomains,
      levels: dataset.levels,
      declaredProgrammeCount: dataset.declaredProgrammeCount,
      programmeBaseline: dataset.programmeBaseline || null,
      tuitionModel: dataset.tuitionModel || null,
      gate1DryRun: dataset.gate1DryRun || null,
      gate2ThreeLayerVerification: dataset.gate2ThreeLayerVerification || null,
      qualityScoreDraft: dataset.qualityScoreDraft || null,
      rankings: {
        qsWorld: {
          status: "ranked",
          context: "malaysia-institution",
          year: uni.qsRank?.year || 2027,
          rankDisplay: qsRankDisplay,
          sourceUrl: uni.qsRank?.sourceUrl || "https://www.topuniversities.com/universities/universiti-pendidikan-sultan-idris-upsi"
        },
        theWorld: {
          rankDisplay: uni.theRank?.display || "601-800",
          sourceUrl: uni.theRank?.sourceUrl || uni.officialWebsite
        }
      },
      postgraduateBaseline: {
        listUrl: postgraduateListUrl,
        feeUrl: postgraduateFeeUrl,
        requirementUrl,
        note: "Master and doctoral baseline is retained in officialProfile only; no postgraduate programme rows are imported until per-programme fee category mapping is complete."
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
          master: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 },
          phd: { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 }
        }
      }
    },
    officialSources: buildUniversitySources(dataset),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified",
    officialAuditSummary: "UPSI review publish import: 54 official bachelor rows are published for Ian review; 46 have current IMAC international fee amounts and 8 use official 2025-07 faculty-brochure total-fee display values marked official-approximate.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: null,
    tuitionMinCny: 18700,
    tuitionMaxCny: 18700,
    livingCostCny: 24000,
    minIelts: 5,
    acceptNoLanguage: false,
    facilities: arr(facilities),
    highlights: arr(highlights),
    programCount: summary.importRows,
    isPublished: true
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
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_UPSI_CANDIDATE_PATH);
  if (!existsSync(candidatePath)) throw new Error(`UPSI candidate dataset not found: ${candidatePath}`);
  const dataset = loadJson<UpsIDataset>(candidatePath);
  const validationErrors = validateDataset(dataset);
  if (validationErrors.length) throw new Error(`UPSI candidate validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildProgrammeRows(dataset);
  const summary = summarize(rows);
  if (summary.uniqueSlugs !== rows.length) {
    throw new Error(`Duplicate slugs detected in UPSI import rows.`);
  }

  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const backupPath = resolve(
    readArgValue("--backup-output") ||
    `tmp/backups/upsi-official-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  if (!confirm) {
    console.log(JSON.stringify({
      mode: verifyOnly ? "verify-only" : "dry-run",
      universityCode: "UPSI",
      candidatePath,
      writePolicy: {
        university: { slug: UPSI_UNIVERSITY_SLUG, isPublished: true, publicDisplayStatus: "ready" },
        programmes: { rows: rows.length, isPublished: true, publicDisplayStatus: "ready" },
        scope: "54 UPSI official bachelor candidates; 46 current IMAC fee-listed rows plus 8 official faculty-brochure total-fee display rows.",
        notImported: "Master/doctoral baseline retained in officialProfile; no postgraduate rows are written."
      },
      summary,
      slugSamples: rows.slice(0, 5).map((row) => ({ slug: row.slug, code: row.code, name: row.nameEnOfficial }))
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  let university: UniversityEntity | null = null;
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    university =
      (await universityRepo.findOne({ where: { code: "UPSI" } })) ||
      (await universityRepo.findOne({ where: { slug: UPSI_UNIVERSITY_SLUG } }));

    const slugConflict = await universityRepo.findOne({ where: { slug: UPSI_UNIVERSITY_SLUG } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug ${UPSI_UNIVERSITY_SLUG} belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

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

      const existingUniversity = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await txUniversityRepo.findOne({ where: { code: "UPSI" } });
      const universitySeed = buildUniversityRow(dataset, summary, existingUniversity?.officialProfile || null);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: existingUniversity?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousUpsIRows = await txProgramRepo.find({
        where: { universityId: university.id }
      });
      for (const previous of previousUpsIRows) {
        if (!incomingSlugs.has(previous.slug)) {
          previous.isPublished = false;
          previous.publicDisplayStatus = "archived";
          await txProgramRepo.save(previous);
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
      universitySlug: university?.slug,
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
