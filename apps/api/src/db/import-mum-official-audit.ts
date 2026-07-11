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
  PublicDisplayStatus,
  TuitionCurrency
} from "@studymy/shared";
import { QS_UNRANKED_RANK, QS_WORLD_RANKING_NAME, QS_WORLD_RANKING_YEAR } from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const MUM_OFFICIAL_AUDIT_SLUG_PREFIX = "mum-official-2026-row-";
export const DEFAULT_MUM_OFFICIAL_AUDIT_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/mum/2026-06-19/official-audit/08_candidate_dataset.json"
);

const verifiedAt = "2026-06-20";
const cnyPerMyr = 1.55;
const englishRequirementsUrl = "https://www.monash.edu.my/study/entry-requirements/english/tests";
const researchAdmissionCriteriaUrl = "https://www.monash.edu/graduate-research/study/apply/admission-criteria";
const researchEnglishRequirementsUrl = "https://www.monash.edu/graduate-research/study/apply/english-language-proficiency-requirements-for-admission";
const monashParentQsProfileUrl = "https://www.topuniversities.com/universities/monash-university";
const monashParentQsRank = 31;
const monashWelcomeUrl = "https://www.monash.edu.my/about/welcome";
const monashMapsTransportUrl = "https://www.monash.edu.my/about/maps-and-transport";
const monashStudentCount = 13800;
const monashStudentCountries = 91;
const monashOfficialAddress = "Monash University Malaysia, Jalan Lagoon Selatan, 47500 Bandar Sunway, Selangor Darul Ehsan, Malaysia";

type MUMLevel = "bachelor" | "master" | "phd";
type MUMFeeStatus = "official-rate-only" | "verified-official-total" | "calculated-from-official-rate";

interface MUMImportOptions {
  publish?: boolean;
  allowRateDerived?: boolean;
  dbCode?: string;
  shortName?: string;
  qsRank?: number;
  qsAsiaRank?: number | null;
  existingOfficialProfile?: Record<string, unknown> | null;
}

interface MUMFee {
  internationalAmount: number | null;
  currency: "RM" | "MYR";
  basis: "per-year" | "full-course" | string;
  officialFeeText: string;
  status: MUMFeeStatus;
  officialFeeSourceUrl: string;
  note: string;
  tuitionAmount?: number | null;
  tuitionDisplay?: string;
  officialAnnualRateMYR?: number;
  calculatedDurationYears?: number;
  formula?: string;
  rateDerived?: boolean;
}

interface MUMCandidateProgramme {
  code: string;
  nameEnOfficial: string;
  localizedName?: LocalizedText;
  level: MUMLevel;
  universityCode: "MUM";
  facultyEn: string;
  campus: string;
  studyMode: string;
  studyType?: string;
  studyArrangement?: string;
  applicantScope: "international";
  academicSession: string;
  durationOfficial: string;
  officialIntake: string;
  tuitionCurrency: "RM" | "MYR";
  fee: MUMFee;
  officialAcademicRequirement: string;
  officialLanguageRequirement:
    | string
    | {
        state?: string;
        sourceUrl?: string;
        note?: string;
      };
  applicationDocuments: string;
  courseSetting: string;
  careerDirections: string;
  officialSourceUrl: string;
  officialEntryRequirementSourceUrl?: string | null;
  officialVerifiedAt: string;
  publicDisplayStatus: "needs-review" | "ready";
  auditReason: string;
  sourceUrls: string[];
  fieldEvidence?: Array<{
    field: string;
    sourceId: string;
    sourceUrl: string;
    sourceText?: string;
    retrievedAt?: string;
    confidence?: number;
  }>;
}

interface MUMCandidateDataset {
  schemaVersion: number;
  universityCode: "MUM";
  university: {
    code: "MUM";
    nameEnOfficial: string;
    localizedName: LocalizedText;
    officialWebsite: string;
    officialVerifiedAt: string;
    publicDisplayStatus: "needs-review" | "ready";
    auditNote: string;
  };
  collectionScope: "full";
  applicantScope: "international";
  academicSession: string;
  levels: MUMLevel[];
  declaredProgrammeCount: number;
  officialDomains: string[];
  retrievedAt: string;
  sources: Array<{
    id: string;
    url: string;
    sourceType: string;
    role: string;
    fields: string[];
    retrievedAt: string;
    academicSession: string;
    status: string;
    localPath?: string;
    sha256?: string;
  }>;
  programmes: MUMCandidateProgramme[];
}

interface MUMImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<MUMLevel, number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialRateRows: number;
  officialTotalRows: number;
  calculatedFromOfficialRateRows: number;
  cleanedFacultyRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface MUMImportVerification extends MUMImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  publicLeakageRows: number;
  adminNeedsReviewRows: number;
  legacyActiveRows: number;
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
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasValidQsRank(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < QS_UNRANKED_RANK;
}

function monashQsRank(options: MUMImportOptions) {
  return hasValidQsRank(options.qsRank) ? options.qsRank : monashParentQsRank;
}

function monashQsWorldProfile(options: MUMImportOptions) {
  const profile = asRecord(options.existingOfficialProfile);
  const rankings = asRecord(profile.rankings);
  const existingQsWorld = asRecord(rankings.qsWorld);
  if (existingQsWorld.status === "ranked" && existingQsWorld.year === QS_WORLD_RANKING_YEAR) return existingQsWorld;
  return {
    name: QS_WORLD_RANKING_NAME,
    year: QS_WORLD_RANKING_YEAR,
    status: "ranked",
    context: "parent-institution",
    rankDisplay: String(monashParentQsRank),
    rankSort: monashParentQsRank,
    officialSortRank: monashParentQsRank,
    overallScore: "87",
    sourceUrl: monashParentQsProfileUrl,
    profileUrl: monashParentQsProfileUrl,
    qsTitle: "Monash University",
    qsCountry: "Australia",
    qsCity: "Melbourne",
    publishedAt: "2026-06-18",
    retrievedAt: "2026-06-19"
  };
}

const facultyLocalization: Record<string, { zhCN: string; zhTW: string }> = {
  "School of Arts & Social Sciences": { zhCN: "艺术与社会科学学院", zhTW: "藝術與社會科學學院" },
  "School of Arts and Social Sciences": { zhCN: "艺术与社会科学学院", zhTW: "藝術與社會科學學院" },
  "School of Business": { zhCN: "商学院", zhTW: "商學院" },
  "School of Engineering": { zhCN: "工程学院", zhTW: "工程學院" },
  "School of Information Technology": { zhCN: "信息技术学院", zhTW: "資訊科技學院" },
  "Jeffrey Cheah School of Medicine and Health Sciences": { zhCN: "谢富年医学与健康科学学院", zhTW: "謝富年醫學與健康科學學院" },
  "School of Pharmacy": { zhCN: "药学院", zhTW: "藥學院" },
  "School of Science": { zhCN: "理学院", zhTW: "理學院" }
};

export function validateMumOfficialAuditDataset(dataset: MUMCandidateDataset, options: MUMImportOptions = {}): string[] {
  const errors: string[] = [];
  const publish = Boolean(options.publish);
  if (dataset.universityCode !== "MUM") errors.push("Dataset universityCode must be MUM.");
  if (dataset.university?.code !== "MUM") errors.push("University code must be MUM.");
  if (dataset.collectionScope !== "full") errors.push("MUM import expects full collection scope.");
  if (dataset.applicantScope !== "international") errors.push("MUM import expects international applicant scope.");
  if (dataset.academicSession !== "2026") errors.push(`MUM academicSession must be 2026; got ${dataset.academicSession}.`);
  if (!dataset.officialDomains?.includes("monash.edu.my")) errors.push("Official domain monash.edu.my is required.");
  if (dataset.declaredProgrammeCount !== 60) errors.push(`Declared programme count must be 60; got ${dataset.declaredProgrammeCount}.`);
  if (dataset.programmes.length !== 60) errors.push(`Candidate programme count must be 60; got ${dataset.programmes.length}.`);

  const levelCounts = countBy(dataset.programmes, (row) => row.level);
  if (levelCounts.bachelor !== 36) errors.push(`Expected 36 bachelor rows; got ${levelCounts.bachelor || 0}.`);
  if (levelCounts.master !== 17) errors.push(`Expected 17 master rows; got ${levelCounts.master || 0}.`);
  if (levelCounts.phd !== 7) errors.push(`Expected 7 phd rows; got ${levelCounts.phd || 0}.`);

  dataset.programmes.forEach((row, index) => {
    const ordinal = index + 1;
    if (row.universityCode !== "MUM") errors.push(`Row ${ordinal} universityCode is not MUM.`);
    if (row.applicantScope !== "international") errors.push(`Row ${ordinal} applicant scope is not international.`);
    if (publish && row.publicDisplayStatus !== "ready") errors.push(`Row ${ordinal} must be ready for publish import.`);
    if (!publish && !["needs-review", "ready"].includes(row.publicDisplayStatus)) errors.push(`Row ${ordinal} has unsupported publicDisplayStatus ${row.publicDisplayStatus}.`);
    if (!row.code) errors.push(`Row ${ordinal} has no original candidate code.`);
    if (!row.nameEnOfficial) errors.push(`Row ${ordinal} has no official English name.`);
    if (!row.facultyEn) errors.push(`Row ${ordinal} has no faculty.`);
    if (!row.officialSourceUrl) errors.push(`Row ${ordinal} has no official source URL.`);
    if (!row.fee?.officialFeeSourceUrl) errors.push(`Row ${ordinal} has no official fee source URL.`);
    if (!["official-rate-only", "verified-official-total", "calculated-from-official-rate"].includes(row.fee?.status)) {
      errors.push(`Row ${ordinal} has unsupported fee status ${row.fee?.status}.`);
    }
    if (publish) {
      if (!options.allowRateDerived && row.fee?.status === "calculated-from-official-rate") {
        errors.push(`Row ${ordinal} uses rate-derived tuition without --allow-rate-derived.`);
      }
      if (!["verified-official-total", "calculated-from-official-rate"].includes(row.fee?.status)) {
        errors.push(`Row ${ordinal} has no publishable fee status ${row.fee?.status}.`);
      }
      if (!row.fee?.tuitionAmount || row.fee.tuitionAmount <= 0) errors.push(`Row ${ordinal} has no publishable total tuition amount.`);
      if (row.fee?.status === "calculated-from-official-rate" && !row.fee.formula) {
        errors.push(`Row ${ordinal} rate-derived tuition has no formula note.`);
      }
      if (!row.officialAcademicRequirement) errors.push(`Row ${ordinal} has no official academic requirement.`);
      if (!languageRequirementText(row.officialLanguageRequirement)) errors.push(`Row ${ordinal} has no official language requirement.`);
      if (!row.applicationDocuments) errors.push(`Row ${ordinal} has no application documents.`);
    }
  });

  return errors;
}

export function buildMumOfficialAuditRows(dataset: MUMCandidateDataset, options: MUMImportOptions = {}): Array<DeepPartial<ProgramEntity>> {
  const publish = Boolean(options.publish);
  return dataset.programmes.map((candidate, index) => {
    const ordinal = index + 1;
    const fee = feePresentation(candidate, options);
    const facultyEn = cleanFaculty(candidate.facultyEn);
    const faculty = localizedFaculty(facultyEn);
    const durationYears = parseDurationYears(candidate.durationOfficial);
    const intakeMonths = parseIntakeMonths(candidate.officialIntake);
    const officialLanguageRequirement = languageRequirementText(candidate.officialLanguageRequirement);
    const applicationDocs = applicationDocumentItems(candidate.applicationDocuments);
    const courseSetting = normalizeLongText(candidate.courseSetting);
    const careers = splitEvidenceList(candidate.careerDirections);
    const sourceStatus: OfficialSourceStatus = publish ? "official-verified" : "needs-review";
    const publicDisplayStatus: PublicDisplayStatus = publish ? "ready" : "needs-review";
    const reviewReason = publish ? null : normalizeText(candidate.auditReason || fee.note || "MUM row requires Ian/data review before public display.");
    const originalCodeNote = `Original MUM candidate code: ${candidate.code}.`;
    const curriculum = courseSetting
      ? [courseSetting]
      : publish
        ? ["Official Monash programme page did not publish a separate course-setting block for this programme after tab/panel inventory."]
        : [];
    const careerRows = careers.length
      ? careers
      : publish
        ? ["Official Monash programme page did not publish a separate career-direction block for this programme after tab/panel inventory."]
        : [];
    const requirementNote = candidate.officialAcademicRequirement || "Official academic requirement was not captured in this audit run.";
    const description = publish
      ? t(
          `${candidate.nameEnOfficial} is a Monash University Malaysia ${candidate.level} programme for international applicants, published from audited official Monash sources.`,
          `${candidate.nameEnOfficial} is a Monash University Malaysia ${candidate.level} programme for international applicants, published from audited official Monash sources.`,
          `${candidate.nameEnOfficial} 是莫纳什大学马来西亚校区面向国际申请人的 ${candidate.level} 专业，依据 Monash 官方来源审核后展示。`,
          `${candidate.nameEnOfficial} 是蒙納士大學馬來西亞校區面向國際申請人的 ${candidate.level} 專業，依據 Monash 官方來源審核後展示。`
        )
      : t(
          `${candidate.nameEnOfficial} is an audited Monash University Malaysia ${candidate.level} candidate for international applicants. It remains in StudyMY review status until fee, requirement, language and localization gates pass.`,
          `${candidate.nameEnOfficial} is an audited Monash University Malaysia ${candidate.level} candidate for international applicants. It remains in StudyMY review status until fee, requirement, language and localization gates pass.`,
          `这是莫纳什大学马来西亚校区 ${candidate.level} 层级的国际申请审核候选专业。费用、要求、语言和本地化门禁通过前不得公开展示。`,
          `這是蒙納士大學馬來西亞校區 ${candidate.level} 層級的國際申請審核候選專業。費用、要求、語言和本地化門禁通過前不得公開展示。`
        );

    return {
      slug: `${MUM_OFFICIAL_AUDIT_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: mumShortCode(candidate.level, ordinal),
      name: candidate.localizedName || t(candidate.nameEnOfficial),
      nameEnOfficial: candidate.nameEnOfficial,
      level: candidate.level,
      category: inferCategory(candidate.nameEnOfficial, facultyEn),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: studyModeDisplay(candidate),
      campus: candidate.campus || "Monash University Malaysia, Bandar Sunway",
      durationYears,
      durationOfficial: normalizeText(candidate.durationOfficial || "Official duration requires review."),
      annualTuitionCny: fee.annualAmount ? Math.round(fee.annualAmount * cnyPerMyr) : 0,
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: fee.officialTuitionMYR,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths,
      officialIntake: normalizeText(candidate.officialIntake, 255),
      officialIntakeNote: candidate.officialIntake
        ? publish
          ? "Official intake text captured from Monash Malaysia programme evidence."
          : "Official intake text captured from Monash Malaysia programme evidence; remains review-required before public display."
        : publish
          ? "Official intake was not published separately in the captured programme evidence."
          : "Official intake was not found in the captured programme evidence and remains needs-review.",
      languageRequirement: publish ? languageRequirementFor(candidate) : { ielts: 0, toefl: null, pte: null, muet: null },
      officialLanguageRequirement,
      requirement: {
        gpa: 0,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          requirementNote,
          requirementNote,
          publish ? requirementNote : "本轮审计尚未采集到可公开使用的官方学术要求，需人工复核。",
          publish ? requirementNote : "本輪審計尚未採集到可公開使用的官方學術要求，需人工覆核。"
        )
      },
      officialAcademicRequirement: normalizeLongText(candidate.officialAcademicRequirement),
      chinaStudentRequirement: publish
        ? "Monash University Malaysia publishes international applicant guidance; applicant qualification assessment follows the linked official programme and entry requirement pages."
        : "China-specific route was not confirmed in this MUM audit run; keep as needs-review before public display.",
      specialRequirementsNote: publish
        ? [
            candidate.studyArrangement ? `Official study arrangement: ${candidate.studyArrangement}.` : "",
            fee.auditStatus === "calculated-from-official-rate" ? fee.note : ""
          ].filter(Boolean).join(" ")
        : "Imported for backend/admin review only. Do not publish until per-record ready gate is completed.",
      applicationDocs: arr(applicationDocs),
      curriculum: arr(curriculum),
      careers: arr(careerRows),
      specializations: arr([]),
      description,
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
      officialSourceUrl: candidate.officialSourceUrl,
      officialEntryRequirementSourceUrl: academicSourceUrl(candidate),
      officialAccreditationSourceUrl: candidate.officialSourceUrl,
      sourceUrls: sourceLinks(candidate, fee, publish),
      officialVerifiedAt: candidate.officialVerifiedAt || verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: publish
        ? "Official Monash source verified for StudyMY public display. Rate-derived fee rows are labelled with formula and exclusions where applicable."
        : "Review-only database import. Hidden from public catalogue until Ian approves ready conversion.",
      reviewReason,
      auditNote: [
        originalCodeNote,
        `Faculty imported as "${facultyEn}" from "${candidate.facultyEn}".`,
        `Fee candidate status: ${candidate.fee.status}; fee basis: ${candidate.fee.basis}.`,
        `Study type: ${candidate.studyType || candidate.studyMode}; study arrangement: ${candidate.studyArrangement || "not captured"}.`,
        publish
          ? "Evidence retained in data/imports/mum/2026-06-19/official-audit/99_integrity_manifest.json."
          : `Field evidence: ${JSON.stringify(candidate.fieldEvidence || [])}.`
      ].join(" "),
      listTuitionText: fee.display,
      isPublished: publish
    };
  });
}

export function buildMumUniversityRow(
  dataset: MUMCandidateDataset,
  summary: MUMImportSummary,
  options: MUMImportOptions = {}
): DeepPartial<UniversityEntity> {
  const publish = Boolean(options.publish);
  const existingProfile = asRecord(options.existingOfficialProfile);
  const existingRankings = asRecord(existingProfile.rankings);
  const qsWorldProfile = publish ? monashQsWorldProfile(options) : asRecord(existingRankings.qsWorld);
  const applicationDocs = applicationDocumentItems(dataset.programmes.find((item) => item.applicationDocuments)?.applicationDocuments || "");
  const annualCnyValues = dataset.programmes
    .map((programme) => {
      const fee = feePresentation(programme, { publish: true, allowRateDerived: true });
      return fee.annualAmount ? Math.round(fee.annualAmount * cnyPerMyr) : 0;
    })
    .filter((value) => value > 0);
  const officialSources: OfficialSourceLink[] = [
    {
      title: "Monash Malaysia welcome",
      url: monashWelcomeUrl,
      sourceType: "official-website",
      verifiedAt,
      status: publish ? "official-verified" : "needs-review",
      note: `Institution profile source for approximately ${monashStudentCount.toLocaleString("en-US")} students from ${monashStudentCountries} countries.`
    },
    {
      title: "Monash Malaysia maps and transport",
      url: monashMapsTransportUrl,
      sourceType: "official-website",
      verifiedAt,
      status: publish ? "official-verified" : "needs-review",
      note: "Institution profile source for the official Bandar Sunway campus address."
    },
    ...dataset.sources.slice(0, 10).map<OfficialSourceLink>((source) => ({
      title: source.id,
      url: source.url,
      sourceType: source.role === "field-authority" && /fee/i.test((source.fields || []).join(" ")) ? "fee" : "other",
      verifiedAt,
      status: publish ? "official-verified" : "needs-review",
      note: publish
        ? `${source.role}; source status ${source.status}; sha256 ${source.sha256 || "not-recorded"}`
        : `${source.role}; source status ${source.status}; sha256 ${source.sha256 || "not-recorded"}`
    }))
  ];

  return {
    slug: "monash-university-malaysia",
    code: options.dbCode || "MUM",
    name: dataset.university.localizedName,
    shortName: options.shortName || "MUM",
    logoUrl: "",
    imageUrl: "",
    color: "#006DAE",
    qsRank: publish ? monashQsRank(options) : options.qsRank ?? QS_UNRANKED_RANK,
    qsAsiaRank: options.qsAsiaRank ?? null,
    location: t("Bandar Sunway, Selangor", "Bandar Sunway, Selangor", "雪兰莪双威镇", "雪蘭莪雙威鎮"),
    region: t("Selangor", "Selangor", "雪兰莪", "雪蘭莪"),
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 1998,
    students: publish ? monashStudentCount : 0,
    intlStudents: 0,
    csrCertified: false,
    description: publish
      ? t(
          "Monash University Malaysia is the Malaysian campus of Monash University, with the StudyMY public catalogue populated from audited official bachelor, master and doctoral programme sources.",
          "Monash University Malaysia is the Malaysian campus of Monash University, with the StudyMY public catalogue populated from audited official bachelor, master and doctoral programme sources.",
          "莫纳什大学马来西亚校区是 Monash University 的马来西亚校区；StudyMY 公开目录已依据官方本硕博专业来源审核展示。",
          "蒙納士大學馬來西亞校區是 Monash University 的馬來西亞校區；StudyMY 公開目錄已依據官方本碩博專業來源審核展示。"
        )
      : t(
          "Monash University Malaysia is an official StudyMY review candidate. Public display is disabled until the imported MUM audit records pass the ready gate.",
          "Monash University Malaysia is an official StudyMY review candidate. Public display is disabled until the imported MUM audit records pass the ready gate.",
          "莫纳什大学马来西亚校区已作为 StudyMY 官方审核候选入库；在审核通过前不会进入公开目录。",
          "蒙納士大學馬來西亞校區已作為 StudyMY 官方審核候選入庫；在審核通過前不會進入公開目錄。"
        ),
    website: dataset.university.officialWebsite,
    admissionEmail: "",
    nameEnOfficial: dataset.university.nameEnOfficial,
    officialWebsite: dataset.university.officialWebsite,
    studyPortalUrl: "https://www.monash.edu.my/study",
    internationalPageUrl: "https://www.monash.edu.my/study/entry-requirements/international-students2",
    applicationPortalUrl: "https://www.monash.edu.my/study/apply/application-form",
    officialAddress: publish ? monashOfficialAddress : "",
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: arr(applicationDocs),
    chinaStudentRequirements: arr([]),
    officialProfile: {
      ...existingProfile,
      collectionScope: "MUM official bachelor, master and doctoral review import",
      applicantScope: dataset.applicantScope,
      academicSession: dataset.academicSession,
      retrievedAt: dataset.retrievedAt,
      officialDomains: dataset.officialDomains,
      sourceUniversityCode: dataset.universityCode,
      authorization: publish ? "publish" : "review-import",
      address: publish ? monashOfficialAddress : undefined,
      city: "Bandar Sunway",
      country: "Malaysia",
      scale: publish
        ? [
            {
              label: t("Student total", "Jumlah pelajar", "在校学生", "在校學生"),
              value: t(
                "Approximately 13,800 students",
                "Approximately 13,800 students",
                "约 13,800 名学生",
                "約 13,800 名學生"
              )
            },
            {
              label: t("International students", "Pelajar antarabangsa", "国际学生", "國際學生"),
              value: t(
                "Students from 91 countries; specific international-student headcount is not published on the official page.",
                "Students from 91 countries; specific international-student headcount is not published on the official page.",
                "学生来自 91 个国家；官网未公布具体国际学生人数。",
                "學生來自 91 個國家；官網未公布具體國際學生人數。"
              )
            }
          ]
        : undefined,
      officialLinks: publish
        ? [
            { label: "Institution profile", url: monashWelcomeUrl },
            { label: "Maps and transport", url: monashMapsTransportUrl },
            { label: "QS World University Rankings 2027", url: monashParentQsProfileUrl }
          ]
        : undefined,
      rankings: {
        ...existingRankings,
        qsWorld: qsWorldProfile
      },
      tuitionAudit: {
        officialTotalRows: summary.officialTotalRows,
        calculatedFromOfficialRateRows: summary.calculatedFromOfficialRateRows,
        rateDerivedPolicy: publish
          ? "Authorized official annual international fee x official standard/minimum full-time duration. Formula and exclusions are retained on programme fee notes."
          : "Rate-only rows remain hidden from public display."
      },
      catalogStatusSummary: {
        all: {
          total: summary.importRows,
          ready: publish ? summary.readyRows : 0,
          needsReview: publish ? 0 : summary.needsReviewRows,
          notAvailableForInternational: 0
        },
        byLevel: {
          bachelor: { total: summary.byLevel.bachelor, ready: publish ? summary.byLevel.bachelor : 0, needsReview: publish ? 0 : summary.byLevel.bachelor, notAvailableForInternational: 0 },
          master: { total: summary.byLevel.master, ready: publish ? summary.byLevel.master : 0, needsReview: publish ? 0 : summary.byLevel.master, notAvailableForInternational: 0 },
          phd: { total: summary.byLevel.phd, ready: publish ? summary.byLevel.phd : 0, needsReview: publish ? 0 : summary.byLevel.phd, notAvailableForInternational: 0 }
        }
      }
    },
    officialSources,
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: publish ? "official-verified" : "needs-review",
    officialAuditSummary: publish
      ? "MUM official publication import: official source baseline 65 rows reconciled; 60 bachelor/master/phd programmes published as ready. English course, Diploma and Postgraduate Certificate/Diploma rows are excluded from this scope."
      : "MUM review-only import: official source baseline 65 rows; 60 bachelor/master/phd candidates imported as needs-review; English course, Diploma and Postgraduate Certificate/Diploma rows are excluded from this scope.",
    publicDisplayStatus: publish ? "ready" : "needs-review",
    livingCostOfficialNote: null,
    tuitionMinCny: annualCnyValues.length ? Math.min(...annualCnyValues) : 0,
    tuitionMaxCny: annualCnyValues.length ? Math.max(...annualCnyValues) : 0,
    livingCostCny: 0,
    minIelts: publish ? 6.5 : 0,
    acceptNoLanguage: false,
    facilities: arr([]),
    highlights: publish
      ? arr(
          ["Official bachelor/master/doctoral catalogue verified", "International applicant scope", "2026 fee schedule audited"],
          ["Official bachelor/master/doctoral catalogue verified", "International applicant scope", "2026 fee schedule audited"],
          ["本硕博官方目录已核验", "国际申请人范围", "2026 学费表已审计"],
          ["本碩博官方目錄已核驗", "國際申請人範圍", "2026 學費表已審計"]
        )
      : arr(["Official review import only"], ["Official review import only"], ["仅限后台审核"], ["僅限後台審核"]),
    programCount: summary.importRows,
    isPublished: publish
  };
}

export function summarizeMumOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): MUMImportSummary {
  return {
    candidateRows: rows.length,
    importRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length,
      master: rows.filter((row) => row.level === "master").length,
      phd: rows.filter((row) => row.level === "phd").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialRateRows: rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified").length,
    officialTotalRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    calculatedFromOfficialRateRows: rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate").length,
    cleanedFacultyRows: rows.filter((row) => !/\|\s*Course\s*\|/i.test(String(row.faculty?.en || ""))).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

function verifyMumImportedRecordSet(university: UniversityEntity, rows: ProgramEntity[], allUniversityRows: ProgramEntity[], options: MUMImportOptions = {}): MUMImportVerification {
  const summary = summarizeMumOfficialAuditImport(rows);
  const publish = Boolean(options.publish);
  const publicLeakageRows = publish ? 0 : rows.filter((row) => row.isPublished || row.publicDisplayStatus === "ready").length;
  const adminNeedsReviewRows = allUniversityRows.filter((row) => row.publicDisplayStatus === "needs-review").length;
  const legacyActiveRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(MUM_OFFICIAL_AUDIT_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  ).length;
  const expectedReadyRows = publish ? 60 : 0;
  const expectedNeedsReviewRows = publish ? 0 : 60;
  const expectedPublishedRows = publish ? 60 : 0;
  const expectedOfficialRateRows = publish ? 0 : 51;
  const expectedCalculatedRows = publish ? 51 : 0;
  const expectedPublicLeakageRows = publish ? 0 : 0;
  const expectedAdminNeedsReviewRows = publish ? 0 : 60;
  const expectedUniversityPublished = publish;
  const expectedUniversityStatus: PublicDisplayStatus = publish ? "ready" : "needs-review";
  if (
    rows.length !== 60 ||
    summary.byLevel.bachelor !== 36 ||
    summary.byLevel.master !== 17 ||
    summary.byLevel.phd !== 7 ||
    summary.readyRows !== expectedReadyRows ||
    summary.needsReviewRows !== expectedNeedsReviewRows ||
    summary.publishedRows !== expectedPublishedRows ||
    summary.officialRateRows !== expectedOfficialRateRows ||
    summary.officialTotalRows !== 9 ||
    summary.calculatedFromOfficialRateRows !== expectedCalculatedRows ||
    publicLeakageRows !== expectedPublicLeakageRows ||
    adminNeedsReviewRows !== expectedAdminNeedsReviewRows ||
    legacyActiveRows !== 0 ||
    university.isPublished !== expectedUniversityPublished ||
    university.publicDisplayStatus !== expectedUniversityStatus ||
    (publish && university.students !== monashStudentCount) ||
    (publish && university.officialAddress !== monashOfficialAddress)
  ) {
    throw new Error(`MUM import verification failed: ${JSON.stringify({ summary, publicLeakageRows, adminNeedsReviewRows, legacyActiveRows, universityStatus: university.publicDisplayStatus, universityPublished: university.isPublished })}`);
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    publicLeakageRows,
    adminNeedsReviewRows,
    legacyActiveRows
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number, options: MUMImportOptions = {}): Promise<MUMImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("MUM university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${MUM_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
  });
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifyMumImportedRecordSet(university, rows, allUniversityRows, options);
}

function feePresentation(candidate: MUMCandidateProgramme, options: MUMImportOptions = {}): {
  amount: number | null;
  officialTuitionMYR: number | null;
  annualAmount: number | null;
  currency: TuitionCurrency;
  display: string;
  sourceUrl: string;
  auditStatus: FeeAuditStatus;
  note: string;
} {
  const publish = Boolean(options.publish);
  const amount = candidate.fee.internationalAmount;
  const durationYears = parseDurationYears(candidate.durationOfficial);
  const formatted = amount == null ? "RM official amount needs review" : `RM ${amount.toLocaleString("en-US")}`;
  if (candidate.fee.status === "verified-official-total" && candidate.fee.basis === "full-course" && amount != null) {
    return {
      amount,
      officialTuitionMYR: amount,
      annualAmount: durationYears > 0 ? amount / Math.max(durationYears, 1) : amount,
      currency: "MYR",
      display: publish ? `${formatted} total tuition` : `${formatted} full course`,
      sourceUrl: candidate.fee.officialFeeSourceUrl,
      auditStatus: "matched-official",
      note: publish
        ? candidate.fee.note
        : `${candidate.fee.note} Imported as needs-review until non-fee ready gates pass.`
    };
  }

  if (publish && options.allowRateDerived && amount != null) {
    const total = candidate.fee.tuitionAmount || Math.round(amount * Math.max(durationYears, 1));
    const formula =
      candidate.fee.formula ||
      `RM ${amount.toLocaleString("en-US")} per year x ${formatNumber(durationYears)} official standard/minimum full-time year(s) = RM ${total.toLocaleString("en-US")}`;
    return {
      amount: total,
      officialTuitionMYR: total,
      annualAmount: candidate.fee.officialAnnualRateMYR || amount,
      currency: "MYR",
      display: candidate.fee.tuitionDisplay || `RM ${total.toLocaleString("en-US")} total tuition`,
      sourceUrl: candidate.fee.officialFeeSourceUrl,
      auditStatus: "calculated-from-official-rate",
      note: candidate.fee.note || `StudyMY calculated full-duration tuition from Monash Malaysia official annual international fee and official duration. Formula: ${formula}.`
    };
  }

  return {
    amount: null,
    officialTuitionMYR: amount,
    annualAmount: amount,
    currency: "MYR",
    display: amount == null ? "Official fee requires review" : `${formatted} per year (official rate, not total)`,
    sourceUrl: candidate.fee.officialFeeSourceUrl,
    auditStatus: "official-rate-verified",
    note: `${candidate.fee.note} StudyMY must not display this as full-duration total tuition without a separate approved calculation gate.`
  };
}

function sourceLinks(candidate: MUMCandidateProgramme, fee: ReturnType<typeof feePresentation>, publish = false): OfficialSourceLink[] {
  const academicUrl = academicSourceUrl(candidate);
  const languageUrl = languageSourceUrl(candidate);
  const urls = new Set([candidate.officialSourceUrl, academicUrl, candidate.fee.officialFeeSourceUrl, languageUrl, ...(candidate.sourceUrls || [])].filter(Boolean));
  return Array.from(urls).map((url) => ({
    title: url === candidate.officialSourceUrl
      ? "Official programme page"
      : url === candidate.fee.officialFeeSourceUrl
        ? "Official fee source"
        : url === academicUrl
          ? "Official entry requirement source"
          : url === languageUrl
            ? "Official language requirement source"
            : "Official source",
    url: String(url),
    sourceType: url === candidate.fee.officialFeeSourceUrl ? "fee" : url === academicUrl || url === languageUrl ? "entry-requirement" : "profile",
    verifiedAt,
    status: publish ? "official-verified" : "needs-review",
    note: url === candidate.fee.officialFeeSourceUrl
      ? fee.note
      : url === academicUrl && academicUrl === researchAdmissionCriteriaUrl
        ? "Monash Graduate Research admission criteria: PhD standard entry includes official academic performance thresholds; numeric GPA/CGPA is not separately published."
      : publish
        ? "Captured in the MUM official publication audit batch."
        : "Captured in MUM official audit batch; remains review-only."
  }));
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

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function mumShortCode(level: MUMLevel, ordinal: number) {
  const prefix = level === "bachelor" ? "UG" : level === "master" ? "MA" : "PHD";
  return `MUM-${prefix}-${String(ordinal).padStart(3, "0")}`;
}

function cleanFaculty(value: string) {
  return normalizeText(value.replace(/\s*\|\s*Course\s*\|.*$/i, ""));
}

function localizedFaculty(facultyEn: string): LocalizedText {
  const translation = facultyLocalization[facultyEn];
  return t(facultyEn, facultyEn, translation?.zhCN || facultyEn, translation?.zhTW || translation?.zhCN || facultyEn);
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|commerce|accounting|marketing|finance|management/.test(value)) return "business";
  if (/computer|data|information technology|artificial intelligence|software|digital/.test(value)) return "it";
  if (/engineering|robotics|mechatronics/.test(value)) return "engineering";
  if (/medicine|medical|health|psychology|nutrition|biomedical|counselling|clinical/.test(value)) return "medicine";
  if (/pharmacy|pharmaceutical/.test(value)) return "medicine";
  if (/science|bioscience|biotechnology|food/.test(value)) return "science";
  if (/arts|communication|media|social/.test(value)) return "arts";
  return "arts";
}

function parseDurationYears(value: string) {
  const text = String(value || "");
  const range = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*years?/i);
  if (range) return Number(range[1]);
  const years = text.match(/(\d+(?:\.\d+)?)\s*years?/i);
  if (years) return Number(years[1]);
  const number = text.match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : 1;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, "");
}

function studyModeDisplay(candidate: MUMCandidateProgramme) {
  const type = candidate.studyType || candidate.studyMode;
  const arrangement = String(candidate.studyArrangement || "").trim();
  if (!arrangement || /^\d+(?:\.\d+)?$/.test(arrangement)) return normalizeText(type);
  if (arrangement.length > 60 || /normal length of candidature|full-time\s*:/i.test(arrangement)) return normalizeText(type);
  if (arrangement.toLowerCase() === type.toLowerCase()) return normalizeText(type);
  return normalizeText(`${type} / ${arrangement}`, 80);
}

function parseIntakeMonths(value: string) {
  const text = String(value || "");
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  return months.filter((month) => new RegExp(`\\b${month}\\b`, "i").test(text));
}

function languageRequirementText(value: MUMCandidateProgramme["officialLanguageRequirement"]) {
  if (typeof value === "string") return normalizeLongText(value);
  return normalizeLongText(
    [
      value.state ? `State: ${value.state}.` : "",
      value.note || "Official Monash English requirements were collected as a general rule and require per-programme review.",
      value.sourceUrl ? `Source: ${value.sourceUrl}` : `Source: ${englishRequirementsUrl}`
    ].filter(Boolean).join(" ")
  );
}

function languageRequirementFor(candidate: MUMCandidateProgramme) {
  const text = languageRequirementText(candidate.officialLanguageRequirement);
  const match = text.match(/IELTS(?:\/IELTS One Skill Retake)? overall\s+(\d+(?:\.\d+)?)/i);
  return { ielts: match ? Number(match[1]) : 6.5, toefl: null, pte: null, muet: null };
}

function languageSourceUrl(candidate: MUMCandidateProgramme) {
  const text = languageRequirementText(candidate.officialLanguageRequirement);
  return /Graduate Research English language proficiency requirements/i.test(text)
    ? researchEnglishRequirementsUrl
    : englishRequirementsUrl;
}

function academicSourceUrl(candidate: MUMCandidateProgramme) {
  if (candidate.officialEntryRequirementSourceUrl) return candidate.officialEntryRequirementSourceUrl;
  const text = normalizeLongText(candidate.officialAcademicRequirement);
  if (
    candidate.level === "phd" ||
    /PhD|doctoral|Graduate Research Committee|Second Class Honours Division A|honours\s*(?:1|I|2A)/i.test(text)
  ) {
    return researchAdmissionCriteriaUrl;
  }
  return candidate.officialSourceUrl;
}

function splitEvidenceList(value: string) {
  const text = normalizeLongText(value);
  if (!text) return [];
  return text
    .split(/\s+\*\s+|\n+-\s+|\n+\s*/)
    .map((item) => normalizeText(item, 240))
    .filter((item) => item.length > 20)
    .slice(0, 8);
}

function applicationDocumentItems(value: string) {
  const text = normalizeLongText(value);
  if (!text) return [];
  const markers = [
    "A valid email address",
    "Details of the courses (title and course code) you intend to apply for",
    "All academic documents in a file format suitable for upload",
    "Evidence that you meet the English language requirements (eg. IELTS test scores) in a file format suitable for upload",
    "Documents that support any application for credit for prior learning (including all official transcripts or academic results from previous studies, and copies of the subject syllabuses) in a file format suitable for upload.",
    "Payment of the application fee"
  ];
  const matched = markers.filter((item) => text.includes(item.replace(/\.$/, "")));
  if (matched.length >= 3) return matched;
  return splitEvidenceList(text);
}

function normalizeLongText(value: unknown) {
  return normalizeText(String(value || ""), 4000);
}

function normalizeText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function slugify(value: string) {
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

async function main() {
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_MUM_OFFICIAL_AUDIT_CANDIDATE_PATH);
  if (!existsSync(candidatePath)) throw new Error(`MUM candidate dataset not found: ${candidatePath}`);
  const dataset = loadJson<MUMCandidateDataset>(candidatePath);
  const publish = process.argv.includes("--publish") || process.argv.includes("--confirm-publish");
  const allowRateDerived = process.argv.includes("--allow-rate-derived") || process.argv.includes("--allow-official-rate-calculation");
  const importOptions: MUMImportOptions = { publish, allowRateDerived };
  const errors = validateMumOfficialAuditDataset(dataset, importOptions);
  if (errors.length) throw new Error(`MUM official audit candidate validation failed:\n${errors.join("\n")}`);

  const rows = buildMumOfficialAuditRows(dataset, importOptions);
  const summary = summarizeMumOfficialAuditImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import") || process.argv.includes("--confirm-publish");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/mum-official-audit-${publish ? "publish" : "review"}-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  if (!verifyOnly && !confirm) {
    console.log(JSON.stringify({
      mode: "dry-run",
      universityCode: "MUM",
      candidatePath,
      writePolicy: {
        authorization: publish ? "publish" : "review-import",
        requestedMode: publish ? "publish" : "review-import",
        rateDerivedFeePolicy: publish
          ? "Authorized by --allow-rate-derived; calculated rows display official annual international fee x official standard/minimum full-time duration with formula notes."
          : "Rate-only rows are not displayed as full-duration totals.",
        upsertPrefix: MUM_OFFICIAL_AUDIT_SLUG_PREFIX,
        importRows: 60,
        university: { isPublished: publish, publicDisplayStatus: publish ? "ready" : "needs-review" },
        programmes: { isPublished: publish, publicDisplayStatus: publish ? "ready" : "needs-review" },
        universityAliasPolicy: "Use existing monash-university-malaysia / MONASH row when present; keep sourceUniversityCode=MUM in officialProfile.",
        archiveLegacyRows: "Archive existing Monash bachelor/master/phd rows outside the MUM official-audit slug prefix so the current 60-row official baseline is the only active bachelor/master/phd set.",
        publicLeakageExpected: 0,
        nextStep: publish
          ? "Review this dry-run, then rerun with --confirm-publish --publish --allow-rate-derived to create a scoped backup and write transactionally."
          : "Review this dry-run, then rerun with --confirm-import to create a scoped backup and write transactionally."
      },
      summary
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "MUM" } })) ||
      (await universityRepo.findOne({ where: { slug: "monash-university-malaysia" } })) ||
      (await universityRepo.findOne({ where: { code: "MONASH" } }));
    if (verifyOnly) {
      if (!university) throw new Error("MUM/MONASH university row not found.");
      console.log(JSON.stringify({
        mode: "verified",
        universityId: university.id,
        databaseUniversityCode: university.code,
        summary,
        verification: await verifyImportedRows(dataSource, university.id, importOptions)
      }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: "monash-university-malaysia" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug monash-university-malaysia belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const targetUniversityCode = university?.code || "MUM";
    const targetShortName = university?.shortName || (targetUniversityCode === "MONASH" ? "Monash" : "MUM");

    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );

    let verification: MUMImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await txUniversityRepo.findOne({ where: { code: targetUniversityCode } });
      const universitySeed = buildMumUniversityRow(dataset, summary, {
        ...importOptions,
        dbCode: targetUniversityCode,
        shortName: targetShortName,
        qsRank: university?.qsRank,
        qsAsiaRank: university?.qsAsiaRank,
        existingOfficialProfile: asRecord(university?.officialProfile)
      });
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousOfficialAuditRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${MUM_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
      });
      for (const previous of previousOfficialAuditRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }
      await txProgramRepo.update(
        {
          universityId: university.id,
          level: In(["bachelor", "master", "phd"]),
          slug: Not(Like(`${MUM_OFFICIAL_AUDIT_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: publish
            ? "Archived by the MUM official publication import to prevent stale Monash rows from mixing with the current 60-row official baseline."
            : "Archived by the MUM official-audit review import to prevent stale Monash review rows from mixing with the current 60-row official baseline.",
          reviewReason: "Superseded by the 2026-06-20 MUM official bachelor/master/phd publication import."
        }
      );

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      university.programCount = summary.importRows;
      await txUniversityRepo.save(university);
      verification = await verifyImportedRows(manager, university.id, importOptions);
    });

    const catalogCacheCleared = await clearCatalogCache();
    console.log(JSON.stringify({
      mode: "imported",
      universityId: university?.id,
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
    process.exit(1);
  });
}
