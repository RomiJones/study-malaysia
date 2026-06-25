import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, type DeepPartial, type EntityManager } from "typeorm";
import type {
  DegreeLevel,
  FeeAuditStatus,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  OfficialSourceStatus,
  ProgramCategoryCode,
  PublicDisplayStatus,
  TuitionCurrency
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const INTI_OFFICIAL_AUDIT_SLUG_PREFIX = "inti-official-2026-programme-";
const INTI_LEGACY_REVIEW_SLUG_PREFIX = "inti-official-2026-review-row-";
export const DEFAULT_INTI_OFFICIAL_AUDIT_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/iiu/2026-06-20/iiu-20260620/08_candidate_dataset.json"
);
export const DEFAULT_INTI_OFFICIAL_SOURCE_REGISTRY_PATH = resolve(
  repositoryRoot,
  "data/imports/iiu/2026-06-20/iiu-20260620/02_official_source_registry.json"
);
export const DEFAULT_INTI_REVIEWED_AUDIT_PATHS = [
  resolve(repositoryRoot, "audits/INTI_audit_undergraduate_20260625_reviewed_v3.json"),
  resolve(repositoryRoot, "audits/INTI_audit_master_20260625_reviewed_v3.json"),
  resolve(repositoryRoot, "audits/INTI_audit_doctoral_20260625_reviewed_v3.json")
];

const verifiedAt = "2026-06-21";
const cnyPerMyr = 1.55;
const publicCatalogProgramStatuses = ["ready", "current-cycle-not-open", "not-available-for-international"] as const;
const officialWebsite = "https://newinti.edu.my/";
const internationalPageUrl = "https://newinti.edu.my/international-students/";
const entryRequirementsUrl = "https://newinti.edu.my/international-students/entry-requirements/";
const howToApplyUrl = "https://newinti.edu.my/international-students/how-to-apply/";

type IntiLevel = Extract<DegreeLevel, "bachelor" | "master" | "phd">;
type IntiCandidateFeeStatus = "official-approximate-excluding-sst" | "official-non-scalar-approximate-excluding-sst";

interface IntiSourceRegistry {
  sources?: Array<{
    id: string;
    url: string;
    finalUrl?: string;
    sourceType: string;
    role: string;
    fields: string[];
    retrievedAt: string;
    academicSession: string;
    status: string;
    localPath?: string;
    extractedTextPath?: string;
    sha256?: string;
  }>;
}

interface IntiCandidateDataset {
  schemaVersion: number;
  universityCode: "INTI";
  officialDomains: string[];
  collectionScope: "full";
  levels: IntiLevel[];
  applicantScope: "international";
  academicSession: string;
  retrievedAt: string;
  programmeCount: number;
  readyCount: number;
  needsReviewCount: number;
  notAvailableForInternationalCount: number;
  countsByLevel: Record<IntiLevel, number>;
  institution: {
    code: "INTI";
    shortName: "INTI";
    nameEnOfficial: string;
    officialWebsite: string;
    officialAddress: string;
    officialSources: string[];
    officialVerifiedAt: string;
    officialSourceStatus: string;
    publicDisplayStatus: "needs-review";
  };
  programmes: IntiCandidateProgramme[];
}

interface IntiCandidateProgramme {
  code: string;
  slug: string;
  nameEnOfficial: string;
  name?: LocalizedText;
  universityCode: "INTI";
  level: IntiLevel;
  officialLevelRaw: string;
  facultyEn: string;
  faculty?: LocalizedText;
  campus: string[] | string;
  studyMode: string;
  studyType: string;
  studyArrangement: string;
  applicantScope: "international";
  academicSession: string;
  durationOfficial: string;
  durationYears: number | null;
  durationStructured?: {
    status: string;
    years: number | null;
    display: string;
    reason?: string;
  };
  officialIntake: string;
  intake?: {
    months?: string[];
    officialText?: string;
  };
  fee: {
    tuitionAmount: number | null;
    approximateTuitionAmount: number | null;
    tuitionCurrency: string;
    approximateTuitionCurrency: string;
    tuitionBasis: string;
    status: IntiCandidateFeeStatus;
    tuitionDisplay: string;
    approximateTuitionDisplay: string;
    officialFeeSourceUrl: string;
    feeOptions?: Array<{
      row: number;
      label: string;
      internationalFeeText: string;
      amount: number | null;
      currency: string;
    }>;
    isApproximate: boolean;
    excludesSst: boolean;
    notes: string;
  };
  tuitionAmount: number | null;
  officialFeeSourceUrl: string;
  officialFeeAuditStatus: IntiCandidateFeeStatus;
  officialAcademicRequirement: string;
  academicRequirement?: {
    officialText?: string;
    sourceUrl?: string;
  };
  officialLanguageRequirement: string;
  languageRequirement?: {
    officialText?: string;
    ieltsSummary?: string;
    tests?: Record<string, { score?: string; band?: string; summary?: string }>;
    sourceUrl?: string;
    sourceType?: string;
  };
  routeSpecificRequirements?: {
    status: string;
    items?: Array<{ type: string; evidenceText: string }>;
  };
  chinaSpecificRequirement?: {
    status: string;
    sourceUrl: string;
    items: string[];
    officialText: string;
  };
  applicationDocuments?: {
    status: string;
    sourceUrl: string;
    items: string[];
  };
  description: string;
  programmeContent?: {
    overviewText?: string;
    courseSettingText?: string;
    courseSettingStatus?: string;
    careerText?: string;
    careerStatus?: string;
  };
  officialSourceUrl: string;
  sourceUrls: string[];
  supplementalSourceUrls?: string[];
  officialVerifiedAt: string;
  officialSourceStatus: string;
  publicDisplayStatus: "needs-review";
  reviewReason: string;
  fieldEvidence?: Array<{
    field: string;
    sourceId: string;
    sourceUrl: string;
    sourceText?: string;
    retrievedAt?: string;
    confidence?: number;
  }>;
  sourceHash?: string;
}

interface IntiReviewedProgrammeLocalization {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string;
}

interface IntiReviewedAudit {
  programmes?: IntiReviewedProgrammeLocalization[];
}

export interface IntiImportSummary {
  candidateRows: number;
  importRows: number;
  byLevel: Record<IntiLevel, number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  pendingFeeRows: number;
  officialApproximateFeeRows: number;
  approximateFeeRows: number;
  nonScalarApproximateFeeRows: number;
  rowsWithApproximateFeeEvidence: number;
  rowsWithOfficialSourceUrl: number;
  rowsWithLanguageSummary: number;
  rowsWithDurationYears: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface IntiImportVerification extends IntiImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  reviewRows: number;
  publicLeakageRows: number;
  beforeUniversityPublicState: PublicVisibilityState | null;
  afterUniversityPublicState: PublicVisibilityState;
  existingPublicInstitutionPreserved: boolean;
}

interface PublicVisibilityState {
  exists: boolean;
  isPublished: boolean;
  publicDisplayStatus: PublicDisplayStatus | null;
  slug: string | null;
  publicProgrammeCount: number;
}

interface IntiImportOptions {
  dbCode?: string;
  shortName?: string;
  existingUniversity?: Partial<UniversityEntity> | null;
  beforeUniversityPublicState?: PublicVisibilityState | null;
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

export function validateIntiOfficialAuditDataset(dataset: IntiCandidateDataset, sourceRegistry?: IntiSourceRegistry | null): string[] {
  const errors: string[] = [];
  if (dataset.universityCode !== "INTI") errors.push("Dataset universityCode must be INTI.");
  if (dataset.institution?.code !== "INTI") errors.push("Institution code must be INTI.");
  if (dataset.collectionScope !== "full") errors.push("INTI import expects full collection scope.");
  if (dataset.applicantScope !== "international") errors.push("INTI import expects international applicant scope.");
  if (dataset.academicSession !== "Current official programme pages rechecked 2026-06-21") {
    errors.push(`INTI academicSession must be current rechecked 2026-06-21; got ${dataset.academicSession}.`);
  }
  if (!dataset.officialDomains?.includes("newinti.edu.my")) errors.push("Official domain newinti.edu.my is required.");
  if (dataset.programmeCount !== 107) errors.push(`Programme count must be 107; got ${dataset.programmeCount}.`);
  if (dataset.programmes.length !== 107) errors.push(`Candidate programme count must be 107; got ${dataset.programmes.length}.`);
  if (dataset.readyCount !== 0) errors.push(`INTI readyCount must be 0 for review-only import; got ${dataset.readyCount}.`);
  if (dataset.needsReviewCount !== 107) errors.push(`INTI needsReviewCount must be 107; got ${dataset.needsReviewCount}.`);
  if (dataset.countsByLevel?.bachelor !== 74) errors.push(`Expected 74 bachelor rows; got ${dataset.countsByLevel?.bachelor || 0}.`);
  if (dataset.countsByLevel?.master !== 23) errors.push(`Expected 23 master rows; got ${dataset.countsByLevel?.master || 0}.`);
  if (dataset.countsByLevel?.phd !== 10) errors.push(`Expected 10 phd rows; got ${dataset.countsByLevel?.phd || 0}.`);

  const sourceCount = sourceRegistry?.sources?.length || 0;
  if (sourceRegistry && sourceCount !== 146) errors.push(`Expected 146 official sources; got ${sourceCount}.`);
  if (sourceRegistry && !(sourceRegistry.sources || []).some((source) => source.sourceType === "official-pdf")) {
    errors.push("INTI source registry must retain official PDF evidence.");
  }

  dataset.programmes.forEach((row, index) => {
    const ordinal = index + 1;
    if (row.universityCode !== "INTI") errors.push(`Row ${ordinal} universityCode is not INTI.`);
    if (row.applicantScope !== "international") errors.push(`Row ${ordinal} applicant scope is not international.`);
    if (row.publicDisplayStatus !== "needs-review") errors.push(`Row ${ordinal} must remain needs-review.`);
    if (!row.code) errors.push(`Row ${ordinal} has no candidate code.`);
    if (!row.nameEnOfficial) errors.push(`Row ${ordinal} has no official English name.`);
    if (!row.facultyEn) errors.push(`Row ${ordinal} has no faculty.`);
    if (!["bachelor", "master", "phd"].includes(row.level)) errors.push(`Row ${ordinal} has unsupported level ${row.level}.`);
    if (!row.officialSourceUrl?.includes("newinti.edu.my")) errors.push(`Row ${ordinal} has no INTI official source URL.`);
    if (!row.fee?.officialFeeSourceUrl?.includes("newinti.edu.my")) errors.push(`Row ${ordinal} has no INTI official fee source URL.`);
    if (row.tuitionAmount !== null || row.fee?.tuitionAmount !== null) errors.push(`Row ${ordinal} must not store approximate fee as tuitionAmount.`);
    if (!["official-approximate-excluding-sst", "official-non-scalar-approximate-excluding-sst"].includes(row.fee?.status)) {
      errors.push(`Row ${ordinal} has unsupported INTI fee status ${row.fee?.status}.`);
    }
    if (!row.fee?.isApproximate || !row.fee?.excludesSst) errors.push(`Row ${ordinal} must retain approximate fee and SST exclusion flags.`);
    if (!row.applicationDocuments?.items?.length) errors.push(`Row ${ordinal} has no application document rule.`);
  });

  return errors;
}

export function buildIntiOfficialAuditRows(
  dataset: IntiCandidateDataset,
  reviewedLocalizations = loadIntiReviewedLocalizations()
): Array<DeepPartial<ProgramEntity>> {
  return dataset.programmes.map((candidate, index) => {
    const ordinal = index + 1;
    const fee = feePresentation(candidate);
    const reviewed = reviewedLocalizations.get(candidate.nameEnOfficial);
    const name = localizedValue(candidate.nameEnOfficial, candidate.name, reviewed?.name);
    const faculty = localizedValue(candidate.facultyEn, candidate.faculty, reviewed?.facultyZh);
    const sourceStatus: OfficialSourceStatus = "official-verified";
    const publicDisplayStatus: PublicDisplayStatus = "ready";
    const durationYears = normalizedDurationYears(candidate);
    const officialLanguageRequirement = normalizeLongText(candidate.officialLanguageRequirement);
    const officialAcademicRequirement = normalizeLongText(candidate.officialAcademicRequirement);
    const applicationDocs = candidate.applicationDocuments?.items || [];
    const curriculum = courseSettingItems(candidate);
    const careers = careerItems(candidate);
    const routeRequirementNote = routeSpecificNote(candidate);
    const chinaRequirement = chinaRequirementText(candidate);

    return {
      slug: `${INTI_OFFICIAL_AUDIT_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: candidate.code,
      name,
      nameEnOfficial: candidate.nameEnOfficial,
      level: candidate.level,
      category: inferCategory(candidate.nameEnOfficial, candidate.facultyEn),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: studyModeDisplay(candidate),
      campus: campusDisplay(candidate.campus),
      durationYears,
      durationOfficial: normalizeText(candidate.durationOfficial || "Official duration requires review.", 500),
      annualTuitionCny: fee.annualTuitionCny,
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: null,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: candidate.intake?.months || parseIntakeMonths(candidate.officialIntake),
      officialIntake: normalizeText(candidate.officialIntake, 255),
      officialIntakeNote: "Captured from INTI official programme page.",
      languageRequirement: languageRequirementFor(candidate),
      officialLanguageRequirement,
      requirement: {
        gpa: extractCgpaRequirement(officialAcademicRequirement),
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          officialAcademicRequirement || "INTI official academic requirement requires review.",
          officialAcademicRequirement || "INTI official academic requirement requires review.",
          "该专业学术要求来自 INTI 官方页面；具体个案以学校最终审核为准。",
          "該專業學術要求來自 INTI 官方頁面；具體個案以學校最終審核為準。"
        )
      },
      officialAcademicRequirement,
      chinaStudentRequirement: chinaRequirement,
      specialRequirementsNote: routeRequirementNote,
      applicationDocs: arr(applicationDocs),
      curriculum: arr(curriculum),
      careers: arr(careers),
      specializations: arr([]),
      description: t(
        normalizeLongText(candidate.description || candidate.programmeContent?.overviewText || `${candidate.nameEnOfficial} is an INTI official review candidate.`),
        normalizeLongText(candidate.description || candidate.programmeContent?.overviewText || `${candidate.nameEnOfficial} is an INTI official review candidate.`),
        `这是 INTI 英迪 ${candidate.level} 层级的官方专业。学费按 INTI 官网公布的 Approx. RM 预估费用展示，最终金额以学校确认为准。`,
        `這是 INTI 英迪 ${candidate.level} 層級的官方專業。學費按 INTI 官網公布的 Approx. RM 預估費用展示，最終金額以學校確認為準。`
      ),
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
      officialSourceUrl: candidate.officialSourceUrl,
      officialEntryRequirementSourceUrl: entryRequirementsUrl,
      officialAccreditationSourceUrl: candidate.officialSourceUrl,
      sourceUrls: sourceLinks(candidate, fee),
      officialVerifiedAt: verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: "Public catalogue row based on INTI official programme evidence. Tuition is an official approximate fee and excludes 6% SST for international students.",
      reviewReason: "",
      auditNote: [
        `Original INTI candidate code: ${candidate.code}.`,
        `Official raw level: ${candidate.officialLevelRaw}.`,
        `Study type: ${candidate.studyType}; study arrangement: ${candidate.studyArrangement}.`,
        `Fee source status: ${candidate.fee.status}; approximate=${candidate.fee.isApproximate}; excludesSst=${candidate.fee.excludesSst}.`,
        `Approximate fee evidence: ${fee.evidenceText}.`,
        `Field evidence count: ${(candidate.fieldEvidence || []).length}.`
      ].join(" "),
      listTuitionText: fee.display,
      isPublished: true
    };
  });
}

export function buildIntiUniversityRow(
  dataset: IntiCandidateDataset,
  summary: IntiImportSummary,
  sourceRegistry: IntiSourceRegistry | null,
  options: IntiImportOptions = {}
): DeepPartial<UniversityEntity> {
  const existing = options.existingUniversity || null;
  const preservePublic = Boolean(existing?.isPublished && existing.publicDisplayStatus === "ready");
  const officialSources = [
    ...institutionSources(dataset),
    ...(sourceRegistry?.sources || []).slice(0, 16).map<OfficialSourceLink>((source) => ({
      title: source.id,
      url: source.finalUrl || source.url,
      sourceType: sourceLinkType(source.fields || [], source.role),
      verifiedAt,
      status: "official-verified",
      note: `${source.role}; ${source.sourceType}; source status ${source.status}; sha256 ${source.sha256 || "not-recorded"}`
    }))
  ];

  return {
    slug: existing?.slug || "inti-international-university",
    code: options.dbCode || existing?.code || "INTI",
    name: (existing?.name as LocalizedText | undefined) || t("INTI International University & Colleges", "INTI International University & Colleges", "英迪国际大学与学院", "英迪國際大學與學院"),
    shortName: options.shortName || existing?.shortName || "INTI",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#E1251B",
    qsRank: existing?.qsRank ?? 0,
    qsAsiaRank: existing?.qsAsiaRank ?? null,
    location: (existing?.location as LocalizedText | undefined) || t("Nilai, Negeri Sembilan, Malaysia", "Nilai, Negeri Sembilan, Malaysia", "马来西亚森美兰州汝来", "馬來西亞森美蘭州汝來"),
    region: (existing?.region as LocalizedText | undefined) || t("Negeri Sembilan", "Negeri Sembilan", "森美兰州", "森美蘭州"),
    ownership: existing?.ownership || "private",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 1986,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: preservePublic && existing?.description
      ? existing.description
      : t(
          "INTI International University & Colleges programmes are published from official INTI programme pages. Tuition is shown as official approximate fees where INTI publishes Approx. RM amounts.",
          "INTI International University & Colleges programmes are published from official INTI programme pages. Tuition is shown as official approximate fees where INTI publishes Approx. RM amounts.",
          "英迪国际大学与学院专业已按 INTI 官方专业页面发布；INTI 公布 Approx. RM 时，学费按官方预估费用展示。",
          "英迪國際大學與學院專業已按 INTI 官方專業頁面發布；INTI 公布 Approx. RM 時，學費按官方預估費用展示。"
        ),
    website: dataset.institution.officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: dataset.institution.nameEnOfficial,
    officialWebsite: dataset.institution.officialWebsite,
    studyPortalUrl: officialWebsite,
    internationalPageUrl,
    applicationPortalUrl: howToApplyUrl,
    officialAddress: dataset.institution.officialAddress,
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: preservePublic && existing?.applicationDocuments ? existing.applicationDocuments as LocalizedStringArray : arr([
      "Original passport with required validity",
      "Original High School/Pre-University/Diploma certificates and transcripts",
      "e-Visa Approval Letter and Single-Entry Visa where required",
      "Yellow Fever Vaccination Certificate for applicable African nationalities"
    ]),
    chinaStudentRequirements: preservePublic && existing?.chinaStudentRequirements ? existing.chinaStudentRequirements as LocalizedStringArray : arr([
      "Senior Secondary School Graduation Certificate (SM3 / Year 12)",
      "Graduation Certificate from a Vocational / Technical Secondary School (Zhixiao / Zhigao)",
      "Specialised College (Zhong Zhuan) or Skilled Worker School (Jixiao)",
      "Zhejiang Secondary Specialised School"
    ]),
    officialProfile: preservePublic ? existing?.officialProfile || {} : {
      collectionScope: "INTI official bachelor, master and doctoral review import",
      applicantScope: dataset.applicantScope,
      academicSession: dataset.academicSession,
      retrievedAt: dataset.retrievedAt,
      officialDomains: dataset.officialDomains,
      sourceUniversityCode: dataset.universityCode,
      authorization: "official-approximate-fee-publication",
      publicationPolicy: {
        importRows: summary.importRows,
        publicReadyRows: summary.readyRows,
        publicLeakageExpected: 107,
        allRowsPublished: true,
        preserveExistingPublicInstitution: true,
        feePolicy: "INTI official Approx. RM fees are accepted as official approximate tuition for public display. SST exclusion is displayed on programme detail pages."
      },
      catalogStatusSummary: {
        all: {
          total: summary.importRows,
          ready: summary.readyRows,
          needsReview: 0,
          notAvailableForInternational: 0
        },
        byLevel: {
          bachelor: { total: summary.byLevel.bachelor, ready: summary.byLevel.bachelor, needsReview: 0, notAvailableForInternational: 0 },
          master: { total: summary.byLevel.master, ready: summary.byLevel.master, needsReview: 0, notAvailableForInternational: 0 },
          phd: { total: summary.byLevel.phd, ready: summary.byLevel.phd, needsReview: 0, notAvailableForInternational: 0 }
        }
      }
    },
    officialSources: preservePublic && existing?.officialSources ? existing.officialSources as OfficialSourceLink[] : officialSources,
    officialVerifiedAt: preservePublic ? existing?.officialVerifiedAt || null : verifiedAt,
    officialSourceStatus: preservePublic ? existing?.officialSourceStatus || "official-verified" : "official-verified",
    officialAuditSummary: preservePublic
      ? existing?.officialAuditSummary || null
      : "INTI public import: 107 official bachelor/master/phd programmes published from INTI official pages. Fees are shown as official approximate Approx. RM values; SST exclusion is shown on programme detail pages.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: existing?.tuitionMinCny || 0,
    tuitionMaxCny: existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 0,
    minIelts: existing?.minIelts || 0,
    acceptNoLanguage: existing?.acceptNoLanguage || false,
    facilities: (existing?.facilities as LocalizedStringArray | undefined) || arr([]),
    highlights: preservePublic && existing?.highlights
      ? existing.highlights
      : arr(["Official INTI programme pages", "Official approximate fee display"], ["Official INTI programme pages", "Official approximate fee display"], ["INTI 官方专业页面", "官方预估学费展示"], ["INTI 官方專業頁面", "官方預估學費展示"]),
    programCount: preservePublic ? existing?.programCount || 0 : summary.importRows,
    isPublished: true
  };
}

export function summarizeIntiOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): IntiImportSummary {
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
    pendingFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "pending-review").length,
    officialApproximateFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "official-approximate").length,
    approximateFeeRows: rows.filter((row) => /approx/i.test(String(row.officialTuitionNote)) && !/Multiple official approximate fee options/i.test(String(row.officialTuitionNote))).length,
    nonScalarApproximateFeeRows: rows.filter((row) => /Multiple official approximate fee options/i.test(String(row.officialTuitionNote))).length,
    rowsWithApproximateFeeEvidence: rows.filter((row) => /Approx\.|Approximate/i.test(String(row.officialTuitionNote))).length,
    rowsWithOfficialSourceUrl: rows.filter((row) => String(row.officialSourceUrl || "").includes("newinti.edu.my")).length,
    rowsWithLanguageSummary: rows.filter((row) => Number(row.languageRequirement?.ielts || 0) > 0).length,
    rowsWithDurationYears: rows.filter((row) => Number(row.durationYears || 0) > 0).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

function verifyIntiImportedRecordSet(
  university: UniversityEntity,
  rows: ProgramEntity[],
  options: IntiImportOptions = {}
): IntiImportVerification {
  const summary = summarizeIntiOfficialAuditImport(rows);
  const languageIsolationIssues = intiLanguageIsolationIssues(rows);
  const publicLeakageRows = rows.filter((row) => row.isPublished && row.publicDisplayStatus === "ready").length;
  const before = options.beforeUniversityPublicState || null;
  const after = publicVisibilityState(university, rows);
  const existingPublicInstitutionPreserved = !before?.exists || !before.isPublished || before.publicDisplayStatus !== "ready"
    ? true
    : university.isPublished === true && university.publicDisplayStatus === "ready" && university.slug === before.slug;

  if (
    rows.length !== 107 ||
    summary.byLevel.bachelor !== 74 ||
    summary.byLevel.master !== 23 ||
    summary.byLevel.phd !== 10 ||
    summary.readyRows !== 107 ||
    summary.needsReviewRows !== 0 ||
    summary.publishedRows !== 107 ||
    summary.pendingFeeRows !== 0 ||
    summary.officialApproximateFeeRows !== 91 ||
    summary.nonScalarApproximateFeeRows !== 16 ||
    summary.rowsWithApproximateFeeEvidence !== 107 ||
    summary.rowsWithOfficialSourceUrl !== 107 ||
    summary.rowsWithDurationYears !== 107 ||
    languageIsolationIssues.length > 0 ||
    publicLeakageRows !== 107 ||
    !existingPublicInstitutionPreserved
  ) {
    throw new Error(
      `INTI official approximate-fee public import verification failed: ${JSON.stringify({
        summary,
        publicLeakageRows,
        before,
        after,
        languageIsolationIssues: languageIsolationIssues.slice(0, 12),
        existingPublicInstitutionPreserved,
        universityStatus: university.publicDisplayStatus,
        universityPublished: university.isPublished
      })}`
    );
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    reviewRows: rows.length,
    publicLeakageRows,
    beforeUniversityPublicState: before,
    afterUniversityPublicState: after,
    existingPublicInstitutionPreserved
  };
}

function intiLanguageIsolationIssues(rows: Array<DeepPartial<ProgramEntity>>) {
  const issues: Array<{ slug: unknown; field: string; value: unknown }> = [];
  for (const row of rows) {
    const name = row.name as LocalizedText | undefined;
    const faculty = row.faculty as LocalizedText | undefined;
    const slug = row.slug;
    for (const locale of ["zh-CN", "zh-TW"] as const) {
      if (!hasChinese(name?.[locale]) || looksLikeEnglishProgrammeTitle(name?.[locale])) {
        issues.push({ slug, field: `name.${locale}`, value: name?.[locale] });
      }
      if (!hasChinese(faculty?.[locale]) || looksLikeEnglishProgrammeTitle(faculty?.[locale])) {
        issues.push({ slug, field: `faculty.${locale}`, value: faculty?.[locale] });
      }
    }
    for (const locale of ["en", "ms"] as const) {
      if (hasChinese(name?.[locale])) issues.push({ slug, field: `name.${locale}`, value: name?.[locale] });
      if (hasChinese(faculty?.[locale])) issues.push({ slug, field: `faculty.${locale}`, value: faculty?.[locale] });
    }
  }
  return issues;
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number, options: IntiImportOptions = {}): Promise<IntiImportVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("INTI university row not found during verification.");
  const rows = await manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${INTI_OFFICIAL_AUDIT_SLUG_PREFIX}%`) }
  });
  return verifyIntiImportedRecordSet(university, rows, options);
}

function feePresentation(candidate: IntiCandidateProgramme): {
  currency: TuitionCurrency;
  amount: number | null;
  annualTuitionCny: number;
  display: string;
  sourceUrl: string;
  auditStatus: FeeAuditStatus;
  note: string;
  evidenceText: string;
} {
  const options = candidate.fee.feeOptions || [];
  const amounts = options
    .map((option) => Number(option.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const uniqueAmounts = [...new Set(amounts)].sort((a, b) => a - b);
  const nonScalar = candidate.fee.status === "official-non-scalar-approximate-excluding-sst" && uniqueAmounts.length > 1;
  const selectedAmount = uniqueAmounts.length === 1
    ? uniqueAmounts[0]
    : Number(candidate.fee.approximateTuitionAmount || 0) > 0
      ? Number(candidate.fee.approximateTuitionAmount)
      : null;
  const rangeDisplay = uniqueAmounts.length > 1
    ? `Approx. RM ${uniqueAmounts[0].toLocaleString("en-US")} - ${uniqueAmounts[uniqueAmounts.length - 1].toLocaleString("en-US")}`
    : "";
  const evidenceText = options.length
    ? options.map((option) => `${option.label}: ${option.internationalFeeText}`).join(" / ")
    : candidate.fee.approximateTuitionDisplay || "Approximate official fee";
  const display = normalizeText(
    rangeDisplay ||
    candidate.fee.approximateTuitionDisplay ||
    (selectedAmount ? `Approx. RM ${selectedAmount.toLocaleString("en-US")}` : evidenceText || "Approximate official fee"),
    255
  );
  const annualTuitionCny = Math.round(((selectedAmount || uniqueAmounts[0] || 0) * cnyPerMyr) / Math.max(normalizedDurationYears(candidate), 0.5));
  return {
    currency: "MYR",
    amount: nonScalar ? null : selectedAmount,
    annualTuitionCny,
    display,
    sourceUrl: candidate.fee.officialFeeSourceUrl,
    auditStatus: nonScalar ? "official-non-scalar" : "official-approximate",
    evidenceText,
    note: normalizeLongText(
      [
        nonScalar ? "Multiple official approximate fee options are published for this candidate." : "Official approximate fee evidence is published for this candidate.",
        candidate.fee.notes,
        `Evidence: ${evidenceText}.`,
        "StudyMY displays the official approximate fee published by INTI; international student fees exclude 6% SST and the final payable amount should be confirmed with INTI."
      ].join(" ")
    )
  };
}

function sourceLinks(candidate: IntiCandidateProgramme, fee: ReturnType<typeof feePresentation>): OfficialSourceLink[] {
  const urls = new Set([
    candidate.officialSourceUrl,
    fee.sourceUrl,
    candidate.languageRequirement?.sourceUrl,
    candidate.academicRequirement?.sourceUrl,
    candidate.chinaSpecificRequirement?.sourceUrl,
    candidate.applicationDocuments?.sourceUrl,
    ...(candidate.sourceUrls || []),
    ...(candidate.supplementalSourceUrls || [])
  ].filter(Boolean));
  return Array.from(urls).map((url) => ({
    title: url === candidate.officialSourceUrl
      ? "Official programme page"
      : url === fee.sourceUrl
        ? "Official fee source"
        : /entry-requirements/i.test(String(url))
          ? "Official entry requirement source"
          : /how-to-apply/i.test(String(url))
            ? "Official application guide"
            : /\.pdf(?:$|\?)/i.test(String(url))
              ? "Official brochure PDF"
              : "Official source",
    url: String(url),
    sourceType: url === fee.sourceUrl ? "fee" : /entry-requirements|language/i.test(String(url)) ? "entry-requirement" : /how-to-apply|apply/i.test(String(url)) ? "admission" : "other",
    verifiedAt,
    status: "official-verified",
    note: url === fee.sourceUrl ? fee.note : "Captured in the INTI official audit batch for public programme display."
  }));
}

function institutionSources(dataset: IntiCandidateDataset): OfficialSourceLink[] {
  return [
    {
      title: "INTI official website",
      url: dataset.institution.officialWebsite,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified",
      note: "Institution authority source captured in the INTI official audit batch."
    },
    {
      title: "INTI international students",
      url: internationalPageUrl,
      sourceType: "admission",
      verifiedAt,
      status: "official-verified",
      note: "International applicant authority source."
    },
    {
      title: "INTI international entry requirements",
      url: entryRequirementsUrl,
      sourceType: "entry-requirement",
      verifiedAt,
      status: "official-verified",
      note: "China general-rule and international entry requirement source."
    }
  ];
}

function sourceLinkType(fields: string[], role: string): OfficialSourceLink["sourceType"] {
  const value = `${fields.join(" ")} ${role}`.toLowerCase();
  if (/fee|tuition/.test(value)) return "fee";
  if (/entry|language|requirement/.test(value)) return "entry-requirement";
  if (/admission|apply|application/.test(value)) return "admission";
  if (/institution|profile|home/.test(value)) return "profile";
  return "other";
}

function languageRequirementFor(candidate: IntiCandidateProgramme): LanguageRequirement {
  const tests = candidate.languageRequirement?.tests || {};
  const text = [
    candidate.languageRequirement?.ieltsSummary,
    candidate.officialLanguageRequirement,
    ...Object.values(tests).map((item) => `${item.score || ""} ${item.band || ""} ${item.summary || ""}`)
  ].join(" ");
  return {
    ielts: scoreFromTest(tests.ielts) || numberFromPattern(text, /IELTS[^\d]*(\d+(?:\.\d+)?)/i) || 0,
    toefl: scoreFromTest(tests.toefl) || numberFromPattern(text, /TOEFL[^\d]*(\d+)/i),
    pte: scoreFromTest(tests.pte) || numberFromPattern(text, /PTE[^\d]*(\d+)/i),
    muet: scoreFromTest(tests.muet) || numberFromPattern(text, /MUET[^\d]*(\d+(?:\.\d+)?)/i)
  };
}

function scoreFromTest(value?: { score?: string; band?: string }) {
  const raw = value?.score || value?.band || "";
  const parsed = Number(String(raw).match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function numberFromPattern(text: string, pattern: RegExp) {
  const parsed = Number(text.match(pattern)?.[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractCgpaRequirement(value: string) {
  const text = normalizeLongText(value || "");
  if (!/\b(?:CGPA|GPA)\b/i.test(text)) return 0;
  const match =
    text.match(/\b(?:minimum\s+)?(?:CGPA|GPA)(?:\s+of)?\s*(\d(?:\.\d+)?)/i) ||
    text.match(/\bCGPA\s*(\d(?:\.\d+)?)/i);
  const parsed = Number(match?.[1]);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 4 ? parsed : 0;
}

function normalizedDurationYears(candidate: IntiCandidateProgramme) {
  const structuredYears = candidate.durationStructured?.years;
  if (typeof structuredYears === "number" && Number.isFinite(structuredYears) && structuredYears > 0) return structuredYears;
  if (typeof candidate.durationYears === "number" && Number.isFinite(candidate.durationYears) && candidate.durationYears > 0) return candidate.durationYears;
  return parseDurationYears(candidate.durationOfficial);
}

function parseDurationYears(value: string) {
  const text = String(value || "");
  const addParts = text.match(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/);
  if (addParts) return Number(addParts[1]) + Number(addParts[2]);
  const yearsWithMonths = text.match(/(\d+(?:\.\d+)?)\s*years?\s*(\d+(?:\.\d+)?)?\s*months?/i);
  if (yearsWithMonths) return Number(yearsWithMonths[1]) + (yearsWithMonths[2] ? Number(yearsWithMonths[2]) / 12 : 0);
  const range = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*years?/i);
  if (range) return Number(range[1]);
  const years = text.match(/(\d+(?:\.\d+)?)\s*years?/i);
  if (years) return Number(years[1]);
  const semesters = text.match(/(\d+(?:\.\d+)?)\s*semesters?/i);
  if (semesters) return Number(semesters[1]) / 2;
  return 1;
}

function parseIntakeMonths(value: string) {
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
  return months.filter((month) => new RegExp(`\\b${month}\\b`, "i").test(value || ""));
}

function routeSpecificNote(candidate: IntiCandidateProgramme) {
  const items = candidate.routeSpecificRequirements?.items || [];
  const counts = countBy(items, (item) => item.type);
  const summary = Object.entries(counts).map(([key, count]) => `${key}: ${count}`).join("; ");
  return normalizeLongText(
    [
      "Published from INTI official programme evidence.",
      summary ? `Route-specific official evidence captured: ${summary}.` : "No additional route-specific item was structured for this candidate."
    ].join(" ")
  );
}

function chinaRequirementText(candidate: IntiCandidateProgramme) {
  const items = candidate.chinaSpecificRequirement?.items || [];
  if (!items.length) return "INTI China-specific route was not confirmed for this programme; applicants should confirm case-specific equivalency with INTI.";
  return normalizeLongText(`INTI China general-rule (${candidate.chinaSpecificRequirement?.sourceUrl || entryRequirementsUrl}): ${items.join("; ")}`);
}

function courseSettingItems(candidate: IntiCandidateProgramme) {
  const status = candidate.programmeContent?.courseSettingStatus;
  if (status !== "official-value") return [];
  return splitEvidenceList(candidate.programmeContent?.courseSettingText || "");
}

function careerItems(candidate: IntiCandidateProgramme) {
  const status = candidate.programmeContent?.careerStatus;
  if (status !== "official-value") return [];
  return splitEvidenceList(candidate.programmeContent?.careerText || "");
}

function splitEvidenceList(value: string) {
  const text = normalizeLongText(value);
  if (!text) return [];
  const parts = text.split(/\s+\*\s+|\n+-\s+|\n+\s*|(?<=\.)\s+(?=[A-Z])/);
  const cleaned = parts.map((item) => normalizeText(item, 240)).filter((item) => item.length > 8);
  return (cleaned.length ? cleaned : [normalizeText(text, 240)]).slice(0, 12);
}

function loadIntiReviewedLocalizations(paths = DEFAULT_INTI_REVIEWED_AUDIT_PATHS) {
  const rows = new Map<string, IntiReviewedProgrammeLocalization>();
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const audit = loadJson<IntiReviewedAudit>(path);
    for (const programme of audit.programmes || []) {
      if (!programme.nameEn) continue;
      rows.set(programme.nameEn, programme);
    }
  }
  return rows;
}

function localizedValue(en: string, existing?: LocalizedText, zhCNOverride?: string): LocalizedText {
  const zhCN = normalizeText(zhCNOverride || existing?.["zh-CN"] || "", 255);
  const existingZhTW = normalizeText(existing?.["zh-TW"] || "", 255);
  const zhTW = hasChinese(existingZhTW) && !looksLikeEnglishProgrammeTitle(existingZhTW) ? existingZhTW : zhCN;
  return {
    en: existing?.en || en,
    ms: existing?.ms || en,
    "zh-CN": zhCN || en,
    "zh-TW": zhTW || zhCN || en
  };
}

function campusDisplay(value: string[] | string) {
  return normalizeText(Array.isArray(value) ? value.join(" / ") : value, 120);
}

function studyModeDisplay(candidate: IntiCandidateProgramme) {
  const type = candidate.studyType || candidate.studyMode || "coursework";
  const arrangement = candidate.studyArrangement || "";
  return normalizeText(arrangement && arrangement !== type ? `${type} / ${arrangement}` : type, 80);
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|account|finance|marketing|management|economics|mba|banking|entrepreneurship|analytics/.test(value)) return "business";
  if (/computer|software|information|data|digital|cyber|technology|it\b/.test(value)) return "it";
  if (/engineering|quantity surveying|construction|civil|mechanical|electrical|electronic/.test(value)) return "engineering";
  if (/health|physio|medicine|pharmacy|medical|biotech|traditional chinese medicine|nursing/.test(value)) return "medicine";
  if (/law/.test(value)) return "law";
  if (/science|actuarial|biology|biotechnology|mathematics/.test(value)) return "science";
  return "arts";
}

function normalizeLongText(value: unknown) {
  return normalizeText(String(value || ""), 4000);
}

function normalizeText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function looksLikeEnglishProgrammeTitle(value: unknown) {
  return /\b(Bachelor|Master|Doctor|Diploma|Foundation|Certificate|Programme|Program|Degree|PhD|MBA|MSc|BSc|BA|Honours|Engineering|Management|Science|Arts|Medicine|Pharmacy|Nursing|Accounting|Finance|Education|Technology|Business)\b/i.test(String(value || ""));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function publicVisibilityState(university: UniversityEntity | null, programs: ProgramEntity[]): PublicVisibilityState {
  return {
    exists: Boolean(university),
    isPublished: Boolean(university?.isPublished),
    publicDisplayStatus: university?.publicDisplayStatus || null,
    slug: university?.slug || null,
    publicProgrammeCount: programs.filter((program) => program.isPublished && program.publicDisplayStatus === "ready").length
  };
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
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

async function main() {
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_INTI_OFFICIAL_AUDIT_CANDIDATE_PATH);
  const sourceRegistryPath = resolve(readArgValue("--source-registry") || DEFAULT_INTI_OFFICIAL_SOURCE_REGISTRY_PATH);
  if (!existsSync(candidatePath)) throw new Error(`INTI candidate dataset not found: ${candidatePath}`);
  const dataset = loadJson<IntiCandidateDataset>(candidatePath);
  const sourceRegistry = existsSync(sourceRegistryPath) ? loadJson<IntiSourceRegistry>(sourceRegistryPath) : null;
  const errors = validateIntiOfficialAuditDataset(dataset, sourceRegistry);
  if (errors.length) throw new Error(`INTI official audit candidate validation failed:\n${errors.join("\n")}`);

  const rows = buildIntiOfficialAuditRows(dataset);
  const summary = summarizeIntiOfficialAuditImport(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import") || process.argv.includes("--confirm-publish") || process.argv.includes("--publish");
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/inti-official-audit-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportOutput = readArgValue("--report-output");

  if (!verifyOnly && !confirm) {
    const report = {
      mode: "dry-run",
      universityCode: "INTI",
      candidatePath,
      sourceRegistryPath: sourceRegistry ? sourceRegistryPath : null,
      decision: "ready-for-public-import",
      writePolicy: {
        authorization: "official-approximate-fee-publication",
        requestedMode: "public-import",
        upsertPrefix: INTI_OFFICIAL_AUDIT_SLUG_PREFIX,
        importRows: 107,
        university: {
          preserveExistingPublicInstitution: true,
          newInstitutionFallback: { isPublished: true, publicDisplayStatus: "ready" }
        },
        programmes: { isPublished: true, publicDisplayStatus: "ready", officialFeeAuditStatus: "official-approximate-or-official-non-scalar" },
        archiveLegacyRows: "Yes. Previous INTI review slug rows are removed when no longer part of the public programme set.",
        publicReadyRowsExpected: 107,
        feePolicy: "INTI Approx. RM amounts are imported as official approximate tuition. SST exclusion stays in programme detail notes, not list labels.",
        rollbackTarget: backupPath,
        nextStep: "Review this dry-run, then rerun with --confirm-import to create a scoped backup and write transactionally."
      },
      summary
    };
    if (reportOutput) {
      mkdirSync(dirname(resolve(reportOutput)), { recursive: true });
      writeFileSync(resolve(reportOutput), JSON.stringify(report, null, 2), "utf8");
    }
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "INTI" } })) ||
      (await universityRepo.findOne({ where: { slug: "inti-international-university" } }));
    if (verifyOnly) {
      if (!university) throw new Error("INTI university row not found.");
      const allPrograms = await programRepo.find({ where: { universityId: university.id } });
      const report = {
        mode: "verified",
        universityId: university.id,
        databaseUniversityCode: university.code,
        publicVisibility: publicVisibilityState(university, allPrograms),
        summary,
        verification: await verifyImportedRows(dataSource, university.id)
      };
      if (reportOutput) {
        mkdirSync(dirname(resolve(reportOutput)), { recursive: true });
        writeFileSync(resolve(reportOutput), JSON.stringify(report, null, 2), "utf8");
      }
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const targetUniversityCode = university?.code || "INTI";
    const targetShortName = university?.shortName || "INTI";
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    const beforeVisibility = publicVisibilityState(university || null, currentPrograms);
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms, beforeVisibility }, null, 2),
      "utf8"
    );

    let verification: IntiImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : await txUniversityRepo.findOne({ where: { code: targetUniversityCode } });
      const universitySeed = buildIntiUniversityRow(dataset, summary, sourceRegistry, {
        dbCode: targetUniversityCode,
        shortName: targetShortName,
        existingUniversity: university,
        beforeUniversityPublicState: beforeVisibility
      });
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousReviewRows = await txProgramRepo.find({
        where: [
          { universityId: university.id, slug: Like(`${INTI_OFFICIAL_AUDIT_SLUG_PREFIX}%`) },
          { universityId: university.id, slug: Like(`${INTI_LEGACY_REVIEW_SLUG_PREFIX}%`) }
        ]
      });
      for (const previous of previousReviewRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      const publicVisibleProgramCount = await txProgramRepo.count({
        where: {
          universityId: university.id,
          isPublished: true,
          publicDisplayStatus: In([...publicCatalogProgramStatuses])
        }
      });
      university.programCount = university.isPublished && university.publicDisplayStatus === "ready"
        ? publicVisibleProgramCount
        : summary.importRows;
      await txUniversityRepo.save(university);
      verification = await verifyImportedRows(manager, university.id, { beforeUniversityPublicState: beforeVisibility });
    });

    const catalogCacheCleared = await clearCatalogCache();
    const report = {
      mode: "public-imported",
      universityId: university?.id,
      backupPath,
      catalogCacheCleared,
      publicVisibilityBefore: beforeVisibility,
      summary,
      verification
    };
    if (reportOutput) {
      mkdirSync(dirname(resolve(reportOutput)), { recursive: true });
      writeFileSync(resolve(reportOutput), JSON.stringify(report, null, 2), "utf8");
    }
    console.log(JSON.stringify(report, null, 2));
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
