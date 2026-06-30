export * from "./notion.js";

export * from "./i18n.js";
export * from "./recommendation.js";

import type { LocalizedStringArray, LocalizedText, SupportedLocale } from "./i18n.js";

export const LOCAL_STATIC_HTML_ASSET_ROOT = "/assets/static-html";
export const LOCAL_UNIVERSITY_LOGO_FALLBACK = `${LOCAL_STATIC_HTML_ASSET_ROOT}/fallback-university-logo.svg`;
export const LOCAL_UNIVERSITY_COVER_PLACEHOLDER = `${LOCAL_STATIC_HTML_ASSET_ROOT}/fallback-university-cover.svg`;
export const LOCAL_UNIVERSITY_COVER_FALLBACK = `${LOCAL_STATIC_HTML_ASSET_ROOT}/image-photo-1562774053-701939374585-3a3ba5b0250f.jpg`;
export const QS_WORLD_RANKING_NAME = "QS World University Rankings";
export const QS_WORLD_RANKING_YEAR = 2027;
export const QS_UNRANKED_RANK = 9999;

export const LOCAL_UNIVERSITY_LOGO_BY_CODE: Record<string, string> = {
  UM: `${LOCAL_STATIC_HTML_ASSET_ROOT}/university-logos/um-universiti-malaya-um.svg`
};

export const LOCAL_UNIVERSITY_COVER_BY_CODE: Record<string, string> = {
  UM: `${LOCAL_STATIC_HTML_ASSET_ROOT}/university-covers/um-universiti-malaya-um-299d955410.jpg`
};

export type QsWorldRankStatus = "ranked" | "not-ranked";
export type QsWorldRankContext = "malaysia-institution" | "parent-institution" | "not-ranked";

export function hasValidQsWorldRank(rank: number | null | undefined): rank is number {
  return typeof rank === "number" && Number.isFinite(rank) && rank > 0 && rank < QS_UNRANKED_RANK;
}

export function qsRankSortValue(rank: number | null | undefined): number {
  return hasValidQsWorldRank(rank) ? rank : Number.MAX_SAFE_INTEGER;
}

export interface QsWorldRankedItem {
  qsRank?: number | null;
  code?: string | null;
  name?: Partial<LocalizedText> | null;
}

export function compareByQsWorldRank(a: QsWorldRankedItem, b: QsWorldRankedItem): number {
  const rankDifference = qsRankSortValue(a.qsRank) - qsRankSortValue(b.qsRank);
  if (rankDifference !== 0) return rankDifference;

  const aName = a.name?.["zh-CN"] || a.name?.en || a.code || "";
  const bName = b.name?.["zh-CN"] || b.name?.en || b.code || "";
  return aName.localeCompare(bName, "zh-Hans") || String(a.code || "").localeCompare(String(b.code || ""));
}

export function normalizeQsRankDisplay(rank: number | null | undefined, display?: string | null): string | null {
  if (!hasValidQsWorldRank(rank)) return null;
  const value = String(display || "").trim();
  return value || String(rank);
}

const LOCAL_CARD_IMAGE_BY_UNSPLASH_KEY: Record<string, string> = {
  "photo-1492538368677-f6e0afe31dcc": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1492538368677-f6e0afe31dcc-884806738b15.jpg`,
  "photo-1498243691581-b145c3f54a5a": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1498243691581-b145c3f54a5a-35fe71643bf3.jpg`,
  "photo-1518611012118-696072aa579a": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1518611012118-696072aa579a-68870b6b05cf.jpg`,
  "photo-1519494026892-80bbd2d6fd0d": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1519494026892-80bbd2d6fd0d-5e203eb940f2.jpg`,
  "photo-1523240795612-9a054b0db644": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1523240795612-9a054b0db644-5ad455ba6f2e.jpg`,
  "photo-1541339907198-e08756dedf3f": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1541339907198-e08756dedf3f-8421a6bf5c1a.jpg`,
  "photo-1541339907198-e08756dedf3f|hue=200": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1541339907198-e08756dedf3f-b620ee0533d9.jpg`,
  "photo-1562774053-701939374585": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1562774053-701939374585-81c45bbca274.jpg`,
  "photo-1568792923760-d70635a89fdc": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1568792923760-d70635a89fdc-73d28b5b6ef9.jpg`,
  "photo-1576091160550-2173dba999ef": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1576091160550-2173dba999ef-c0a784d5b331.jpg`,
  "photo-1580582932707-520aed937b7b": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1580582932707-520aed937b7b-4b277f493eec.jpg`,
  "photo-1580582932707-520aed937b7b|brightness=80": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1580582932707-520aed937b7b-e8fb83c01fc9.jpg`,
  "photo-1580582932707-520aed937b7b|hue=120": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1580582932707-520aed937b7b-ce76cc39bd61.jpg`,
  "photo-1581091226825-a6a2a5aee158": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1581091226825-a6a2a5aee158-6352f726081d.jpg`,
  "photo-1593079831268-3381b0db4a77": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1593079831268-3381b0db4a77-076cab005287.jpg`,
  "photo-1607237138185-eedd9c632b0b": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1607237138185-eedd9c632b0b-8554be173a93.jpg`,
  "photo-1607237138185-eedd9c632b0b|sat=-20": `${LOCAL_STATIC_HTML_ASSET_ROOT}/card-image-photo-1607237138185-eedd9c632b0b-a31f29138620.jpg`
};

export function isLocalPublicAssetUrl(value: string | null | undefined): boolean {
  const url = String(value || "").trim();
  return url.startsWith(`${LOCAL_STATIC_HTML_ASSET_ROOT}/`) || url.startsWith("data:image/");
}

export function isExternalImageUrl(value: string | null | undefined): boolean {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url);
}

export function getLocalUniversityLogoByCode(code: string | null | undefined): string {
  return LOCAL_UNIVERSITY_LOGO_BY_CODE[String(code || "").trim().toUpperCase()] || "";
}

export function getLocalUniversityCoverByCode(code: string | null | undefined): string {
  return LOCAL_UNIVERSITY_COVER_BY_CODE[String(code || "").trim().toUpperCase()] || "";
}

export function localizeUniversityLogoUrl(value: string | null | undefined, code?: string | null): string {
  const url = String(value || "").trim();
  if (isLocalPublicAssetUrl(url)) return url;
  const codeAsset = getLocalUniversityLogoByCode(code);
  if (codeAsset) return codeAsset;
  return LOCAL_UNIVERSITY_LOGO_FALLBACK;
}

export function localizeUniversityImageUrl(value: string | null | undefined, code?: string | null): string {
  const url = String(value || "").trim();
  if (isLocalPublicAssetUrl(url)) return url;

  const codeAsset = getLocalUniversityCoverByCode(code);
  if (codeAsset) return codeAsset;

  const unsplashKey = getUnsplashAssetKey(url);
  if (unsplashKey) {
    return LOCAL_CARD_IMAGE_BY_UNSPLASH_KEY[unsplashKey] ||
      LOCAL_CARD_IMAGE_BY_UNSPLASH_KEY[unsplashKey.split("|")[0]] ||
      LOCAL_UNIVERSITY_COVER_FALLBACK;
  }

  return LOCAL_UNIVERSITY_COVER_FALLBACK;
}

export function localizeUniversityImageFields<T extends { logoUrl?: string; imageUrl?: string }>(item: T): T {
  return {
    ...item,
    logoUrl: localizeUniversityLogoUrl(item.logoUrl),
    imageUrl: localizeUniversityImageUrl(item.imageUrl)
  };
}

export type ProgramDetailTextKind = "document" | "curriculum" | "career" | "specialization" | "description" | "note";

const PROGRAM_DETAIL_FALLBACKS: Record<ProgramDetailTextKind, LocalizedText> = {
  document: {
    en: "Official document list collected; localization pending. Refer to the official source.",
    ms: "Senarai dokumen rasmi telah dikumpulkan; penyetempatan belum lengkap. Rujuk sumber rasmi.",
    "zh-CN": "官网未公布具体申请材料清单",
    "zh-TW": "官網未公布具體申請材料清單"
  },
  curriculum: {
    en: "Official course-setting content collected; localization pending. Refer to the official source.",
    ms: "Kandungan struktur kursus rasmi telah dikumpulkan; penyetempatan belum lengkap. Rujuk sumber rasmi.",
    "zh-CN": "官网未公布课程设置",
    "zh-TW": "官網未公布課程設定"
  },
  career: {
    en: "Official career content collected; localization pending. Refer to the official source.",
    ms: "Kandungan kerjaya rasmi telah dikumpulkan; penyetempatan belum lengkap. Rujuk sumber rasmi.",
    "zh-CN": "官网未公布就业方向",
    "zh-TW": "官網未公布就業方向"
  },
  specialization: {
    en: "Official specialization content collected; localization pending. Refer to the official source.",
    ms: "Kandungan pengkhususan rasmi telah dikumpulkan; penyetempatan belum lengkap. Rujuk sumber rasmi.",
    "zh-CN": "官网未公布专业方向",
    "zh-TW": "官網未公布專業方向"
  },
  description: {
    en: "Official programme overview collected; localization pending. Refer to the official source.",
    ms: "Gambaran program rasmi telah dikumpulkan; penyetempatan belum lengkap. Rujuk sumber rasmi.",
    "zh-CN": "该专业简介已根据官方资料收录，中文简介待补充；请结合课程设置、入学要求及官方来源查看。",
    "zh-TW": "該專業簡介已根據官方資料收錄，中文簡介待補充；請結合課程設定、入學要求及官方來源查看。"
  },
  note: {
    en: "Official note collected; localization pending. Refer to the official source.",
    ms: "Nota rasmi telah dikumpulkan; penyetempatan belum lengkap. Rujuk sumber rasmi.",
    "zh-CN": "官网未公布具体说明",
    "zh-TW": "官網未公布具體說明"
  }
};

export function isEnglishLikeProgramDetailText(value: string): boolean {
  const text = value.trim();
  return Boolean(text) && /[A-Za-z]/.test(text) && !/[\u4e00-\u9fff]/.test(text);
}

export function localizeProgramDetailText(
  value: unknown,
  locale: SupportedLocale,
  kind: ProgramDetailTextKind
): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return PROGRAM_DETAIL_FALLBACKS[kind][locale];
  return text;
}

export function localizeProgramDetailArray(
  value: LocalizedStringArray,
  locale: SupportedLocale,
  kind: ProgramDetailTextKind,
  fallback?: string[]
): string[] {
  const items = value?.[locale]?.filter(Boolean) || [];
  if (items.length > 0) return items;
  if (fallback?.length) return fallback;
  return [PROGRAM_DETAIL_FALLBACKS[kind][locale]];
}

export function normalizeProgramDetailLocalizedArray(
  value: LocalizedStringArray | null | undefined,
  kind: ProgramDetailTextKind
): LocalizedStringArray {
  return {
    en: value?.en?.filter(Boolean).length ? value.en.filter(Boolean) : [PROGRAM_DETAIL_FALLBACKS[kind].en],
    ms: value?.ms?.filter(Boolean).length ? value.ms.filter(Boolean) : [PROGRAM_DETAIL_FALLBACKS[kind].ms],
    "zh-CN": value?.["zh-CN"]?.filter(Boolean).length
      ? value["zh-CN"].filter(Boolean)
      : [PROGRAM_DETAIL_FALLBACKS[kind]["zh-CN"]],
    "zh-TW": value?.["zh-TW"]?.filter(Boolean).length
      ? value["zh-TW"].filter(Boolean)
      : [PROGRAM_DETAIL_FALLBACKS[kind]["zh-TW"]]
  };
}

export function normalizeProgramDetailLocalizedText(
  value: LocalizedText | null | undefined,
  kind: ProgramDetailTextKind
): LocalizedText {
  return {
    en: value?.en?.trim() || PROGRAM_DETAIL_FALLBACKS[kind].en,
    ms: value?.ms?.trim() || PROGRAM_DETAIL_FALLBACKS[kind].ms,
    "zh-CN": value?.["zh-CN"]?.trim() || PROGRAM_DETAIL_FALLBACKS[kind]["zh-CN"],
    "zh-TW": value?.["zh-TW"]?.trim() || PROGRAM_DETAIL_FALLBACKS[kind]["zh-TW"]
  };
}

function getUnsplashAssetKey(value: string): string {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/\/(photo-[a-z0-9-]+)/i);
    if (!match) return "";
    const variant = ["sat", "hue", "brightness"]
      .map((key) => {
        const param = url.searchParams.get(key);
        return param ? `${key}=${param}` : "";
      })
      .filter(Boolean)
      .join("&");
    return variant ? `${match[1]}|${variant}` : match[1];
  } catch {
    const match = value.match(/photo-[a-z0-9-]+/i);
    return match?.[0] || "";
  }
}

export type DegreeLevel = "bachelor" | "master" | "phd" | "postgraduate-certificate" | "postgraduate-diploma";
export const DEGREE_LEVEL_ORDER = [
  "bachelor",
  "master",
  "postgraduate-certificate",
  "postgraduate-diploma",
  "phd"
] as const satisfies readonly DegreeLevel[];
export type CoreProgramCategory =
  | "business"
  | "it"
  | "engineering"
  | "science"
  | "arts"
  | "medicine"
  | "law";
export type ProgramCategory = CoreProgramCategory;
export type ProgramCategoryCode = CoreProgramCategory | (string & {});
export type InstitutionOwnership = "public" | "private";
export type InstitutionType = "research" | "comprehensive" | "applied";
export type PublicDisplayStatus =
  | "ready"
  | "current-cycle-not-open"
  | "official-language-requirement-not-published"
  | "not-available-for-international"
  | "needs-review"
  | "hidden-unverified"
  | "archived";
export type OfficialSourceStatus =
  | "official-verified"
  | "official-page-verified-current-cycle-not-open"
  | "official-page-verified-international-not-available"
  | "needs-review"
  | "source-conflict"
  | "missing-source"
  | "hidden-duplicate-superseded";
export type TuitionCurrency = "MYR" | "CNY" | "USD" | "GBP" | "UNKNOWN";
export type FeeAuditStatus =
  | "matched-official"
  | "fee-sheet-verified"
  | "official-approximate"
  | "calculated-from-official-rate"
  | "official-rate-verified"
  | "official-non-scalar"
  | "conflict"
  | "source-conflict"
  | "pending-review"
  | "not-published";
export type ApplicationTier = "reach" | "target" | "safe";
export type OfficialSourceType =
  | "official-website"
  | "study-portal"
  | "admission"
  | "fee"
  | "entry-requirement"
  | "accreditation"
  | "profile"
  | "other";
export type AuthMethod = "phone" | "email" | "wechat" | "qq";
export type MaterialStatus = "draft" | "wait" | "progress" | "done";
export type ApplicationStage =
  | "draft"
  | "materials"
  | "ready"
  | "review"
  | "conditional-offer"
  | "visa";

export interface LanguageRequirement {
  ielts: number;
  toefl?: number | null;
  pte?: number | null;
  muet?: number | null;
}

export const MUET_TO_IELTS_EQUIVALENT: Record<string, number> = {
  "3": 5.0,
  "3.0": 5.0,
  "3.5": 5.0,
  "4": 6.0,
  "4.0": 6.0,
  "4.5": 6.5,
  "5": 6.5,
  "5.0": 6.5
};

export function muetBandToIeltsEquivalent(value: unknown): number | null {
  const muet = Number(value);
  if (!Number.isFinite(muet) || muet <= 0) return null;
  const normalized = Number.isInteger(muet) ? String(muet) : String(muet);
  return MUET_TO_IELTS_EQUIVALENT[normalized] ?? null;
}

export interface ProgramRequirement {
  gpa: number;
  gaokaoRequired: boolean;
  huikaoRequired: boolean;
  note: LocalizedText;
}

export interface ProgramCategoryOption {
  code: ProgramCategoryCode;
  label: LocalizedText;
  sortOrder: number;
  enabled: boolean;
  visibleOnPublic: boolean;
  legacyCategory?: CoreProgramCategory;
}

export interface OfficialSourceLink {
  title: string;
  url: string;
  sourceType: OfficialSourceType;
  verifiedAt?: string | null;
  status?: OfficialSourceStatus;
  note?: string | null;
}

export interface TuitionInfo {
  amount?: number | null;
  currency: TuitionCurrency;
  displayText: string;
  filterableTuitionCny?: number | null;
  officialAmountMYR?: number | null;
  sourceUrl?: string | null;
  secondarySourceUrl?: string | null;
  auditStatus: FeeAuditStatus;
  auditedAt?: string | null;
  note?: string | null;
}

export interface RequirementInfo {
  language: LanguageRequirement;
  officialLanguageRequirement?: string | null;
  academic: ProgramRequirement;
  officialAcademicRequirement?: string | null;
  chinaStudentRequirement?: string | null;
  specialRequirementsNote?: string | null;
}

export interface UniversityOfficialProfile {
  nameEnOfficial: string;
  officialWebsite: string;
  studyPortalUrl: string;
  internationalPageUrl: string;
  applicationPortalUrl: string;
  officialAddress: string;
  applicationPeriods: string[];
  applicationFees: string[];
  applicationDocuments: LocalizedStringArray;
  chinaStudentRequirements: LocalizedStringArray;
  officialProfile: Record<string, unknown> | null;
  officialSources: OfficialSourceLink[];
  officialVerifiedAt: string | null;
  officialSourceStatus: OfficialSourceStatus;
  officialAuditSummary: string;
  publicDisplayStatus: PublicDisplayStatus;
}

export interface ProgramOfficialProfile {
  nameEnOfficial: string;
  facultyZh: string;
  studyMode: string;
  campus: string;
  durationOfficial: string;
  officialIntake: string;
  officialIntakeNote: string;
  tuitionInfo: TuitionInfo;
  requirements: RequirementInfo;
  officialAccreditationNote: string;
  officialSourceUrl: string;
  officialEntryRequirementSourceUrl: string;
  officialAccreditationSourceUrl: string;
  sourceUrls: OfficialSourceLink[];
  officialVerifiedAt: string | null;
  officialSourceStatus: OfficialSourceStatus;
  publicDisplayStatus: PublicDisplayStatus;
  publicDisplayNote: string;
  reviewReason: string;
  auditNote: string;
}

export interface UniversityListItem extends UniversityOfficialProfile {
  id: number;
  slug: string;
  code: string;
  name: LocalizedText;
  shortName: string;
  nameEn: string;
  logoUrl: string;
  imageUrl: string;
  color: string;
  qsRank: number;
  qsRankDisplay?: string | null;
  qsRankYear?: number | null;
  qsRankStatus?: QsWorldRankStatus;
  qsRankContext?: QsWorldRankContext;
  qsRankSourceUrl?: string | null;
  qsAsiaRank?: number | null;
  location: LocalizedText;
  region: LocalizedText;
  ownership: InstitutionOwnership;
  institutionType: InstitutionType;
  foundedYear: number;
  students: number;
  intlStudents: number;
  csrCertified: boolean;
  description: LocalizedText;
  website: string;
  admissionEmail: string;
  tuitionMinCny: number;
  tuitionMaxCny: number;
  livingCostCny: number;
  livingCostOfficialNote: string;
  minIelts: number;
  acceptNoLanguage: boolean;
  facilities: LocalizedStringArray;
  highlights: LocalizedStringArray;
  programCount: number;
}

export interface ProgramListItem extends ProgramOfficialProfile {
  id: number;
  universityId: number;
  slug: string;
  code: string;
  name: LocalizedText;
  nameEn: string;
  level: DegreeLevel;
  category: ProgramCategoryCode;
  faculty: LocalizedText;
  durationYears: number;
  annualTuitionCny: number;
  filterableTuitionCny: number | null;
  hasVerifiedFee: boolean;
  feeConfidence: "verified" | "display-only" | "unavailable";
  tuitionAmount: number | null;
  tuitionCurrency: TuitionCurrency;
  tuitionDisplay: string;
  officialTuitionMYR: number | null;
  officialFeeSourceUrl: string;
  secondaryOfficialFeeSourceUrl: string;
  officialFeeAuditStatus: FeeAuditStatus;
  officialFeeAuditedAt: string | null;
  intakeMonths: string[];
  languageRequirement: LanguageRequirement;
  officialLanguageRequirement: string;
  requirement: ProgramRequirement;
  officialAcademicRequirement: string;
  chinaStudentRequirement: string;
  applicationDocs: LocalizedStringArray;
  curriculum: LocalizedStringArray;
  careers: LocalizedStringArray;
  specializations: LocalizedStringArray;
  description: LocalizedText;
  listTuitionText: string;
  requirementInfo: RequirementInfo;
}

export interface PlannerProfile {
  level: DegreeLevel;
  targetCategory: ProgramCategory;
  budgetCny: number;
  gpa: number;
  ielts: number;
  experience: string;
  acceptNoLanguage: boolean;
}

export interface PlannerMaterialItem {
  key: string;
  name: LocalizedText;
  note: LocalizedText;
  status: MaterialStatus;
}

export interface PlannerApplicationItem {
  id: number;
  universityId: number;
  programId: number;
  tier: LocalizedText;
  stage: ApplicationStage;
  progress: number;
  deadlineNote: LocalizedText;
  nextAction: LocalizedText;
}

export interface PlannerVisaChecklist {
  offerAccepted: boolean;
  depositPaid: boolean;
  visaDocsReady: boolean;
  preDeparture: boolean;
  arrivalReady: boolean;
}

export interface RecommendationResult {
  score: number;
  reasons: LocalizedStringArray;
  university: UniversityListItem;
  program: ProgramListItem;
  annualCostCny: number | null;
}

export type SearchSuggestionType = "university" | "program" | "city";

export interface SearchSuggestionItem {
  type: SearchSuggestionType;
  id: string;
  title: string;
  subtitle: string;
  highlight: string;
  score: number;
  universityId?: number;
  universitySlug?: string;
  programId?: number;
  programSlug?: string;
  count?: number;
  countType?: "university" | "program";
}

export interface FilterFacetOption {
  value: string;
  label: LocalizedText;
  count: number;
}

export interface FilterFacet {
  key: string;
  label: LocalizedText;
  options: FilterFacetOption[];
}

export interface ActiveFilterItem {
  key: string;
  value: string;
  label: LocalizedText;
}

export interface PublicCatalogPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PublicCatalogFacets {
  resultCount: number;
  universityResultCount: number;
  programResultCount: number;
  facets: FilterFacet[];
  activeFilters: ActiveFilterItem[];
}

export interface UniversityProgramGroup {
  level: DegreeLevel;
  label: LocalizedText;
  items: ProgramListItem[];
  count: number;
}

export interface UniversityCatalogDetail extends UniversityListItem {
  programs: ProgramListItem[];
  programGroups: UniversityProgramGroup[];
}

export interface ProgramCatalogItem extends ProgramListItem {
  university: UniversityListItem;
  annualCostCny: number | null;
}

export interface ProgramCatalogDetail extends ProgramCatalogItem {}

export interface PublicCatalogListResponse<T> {
  items: T[];
  pagination: PublicCatalogPagination;
  facets: FilterFacet[];
  activeFilters: ActiveFilterItem[];
  total: number;
}

export interface AuthPayload {
  method: AuthMethod;
  account: string;
  password: string;
  displayName?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: number;
    role: "student" | "admin";
    displayName: string;
    method: AuthMethod;
    account: string;
  };
}

export const DEGREE_LEVEL_LABELS: Record<DegreeLevel, LocalizedText> = {
  bachelor: {
    en: "Bachelor",
    ms: "Ijazah Sarjana Muda",
    "zh-CN": "本科",
    "zh-TW": "本科"
  },
  master: {
    en: "Master",
    ms: "Sarjana",
    "zh-CN": "硕士",
    "zh-TW": "碩士"
  },
  "postgraduate-certificate": {
    en: "Postgraduate Certificate",
    ms: "Sijil Pascasiswazah",
    "zh-CN": "研究生证书",
    "zh-TW": "研究生證書"
  },
  "postgraduate-diploma": {
    en: "Postgraduate Diploma",
    ms: "Diploma Pascasiswazah",
    "zh-CN": "研究生文凭",
    "zh-TW": "研究生文憑"
  },
  phd: {
    en: "PhD",
    ms: "Doktor Falsafah",
    "zh-CN": "博士",
    "zh-TW": "博士"
  }
};

export const CORE_PROGRAM_CATEGORIES = [
  "business",
  "it",
  "engineering",
  "science",
  "arts",
  "medicine",
  "law"
] as const satisfies readonly CoreProgramCategory[];

export const CATEGORY_LABELS: Record<CoreProgramCategory, LocalizedText> = {
  business: {
    en: "Business",
    ms: "Perniagaan",
    "zh-CN": "商科",
    "zh-TW": "商科"
  },
  it: {
    en: "Information Technology",
    ms: "Teknologi Maklumat",
    "zh-CN": "IT",
    "zh-TW": "IT"
  },
  engineering: {
    en: "Engineering",
    ms: "Kejuruteraan",
    "zh-CN": "工科",
    "zh-TW": "工科"
  },
  science: {
    en: "Science",
    ms: "Sains",
    "zh-CN": "理科",
    "zh-TW": "理科"
  },
  arts: {
    en: "Arts & Design",
    ms: "Seni & Reka Bentuk",
    "zh-CN": "艺术",
    "zh-TW": "藝術"
  },
  medicine: {
    en: "Medicine",
    ms: "Perubatan",
    "zh-CN": "医学",
    "zh-TW": "醫學"
  },
  law: {
    en: "Law",
    ms: "Undang-undang",
    "zh-CN": "法学",
    "zh-TW": "法學"
  }
};

export const DEFAULT_PROGRAM_CATEGORY_OPTIONS: ProgramCategoryOption[] = CORE_PROGRAM_CATEGORIES.map((code, index) => ({
  code,
  label: CATEGORY_LABELS[code],
  sortOrder: index + 1,
  enabled: true,
  visibleOnPublic: true,
  legacyCategory: code
}));

export const PUBLIC_DISPLAY_STATUS_LABELS: Record<PublicDisplayStatus, LocalizedText> = {
  ready: {
    en: "Ready for public display",
    ms: "Sedia untuk paparan awam",
    "zh-CN": "可公开展示",
    "zh-TW": "可公開展示"
  },
  "current-cycle-not-open": {
    en: "Current cycle not open",
    ms: "Kitaran semasa belum dibuka",
    "zh-CN": "当前申请周期未开放",
    "zh-TW": "目前申請週期未開放"
  },
  "official-language-requirement-not-published": {
    en: "Official IELTS requirement not published",
    ms: "Syarat IELTS rasmi belum diterbitkan",
    "zh-CN": "官网未公布雅思",
    "zh-TW": "官網未公布雅思"
  },
  "not-available-for-international": {
    en: "Not available for international applicants",
    ms: "Tidak tersedia untuk pemohon antarabangsa",
    "zh-CN": "不开放国际学生",
    "zh-TW": "不開放國際學生"
  },
  "needs-review": {
    en: "Needs review",
    ms: "Perlu semakan",
    "zh-CN": "待复核",
    "zh-TW": "待複核"
  },
  "hidden-unverified": {
    en: "Hidden until verified",
    ms: "Disembunyikan sehingga disahkan",
    "zh-CN": "未核验隐藏",
    "zh-TW": "未核驗隱藏"
  },
  archived: {
    en: "Archived",
    ms: "Diarkibkan",
    "zh-CN": "已归档",
    "zh-TW": "已歸檔"
  }
};

export const OFFICIAL_SOURCE_STATUS_LABELS: Record<OfficialSourceStatus, LocalizedText> = {
  "official-verified": {
    en: "Official source verified",
    ms: "Sumber rasmi disahkan",
    "zh-CN": "官方来源已核验",
    "zh-TW": "官方來源已核驗"
  },
  "official-page-verified-current-cycle-not-open": {
    en: "Official page verified, current cycle not open",
    ms: "Halaman rasmi disahkan, kitaran semasa belum dibuka",
    "zh-CN": "官方页已核验但当前周期未开放",
    "zh-TW": "官方頁已核驗但目前週期未開放"
  },
  "official-page-verified-international-not-available": {
    en: "Official page verified, international admission unavailable",
    ms: "Halaman rasmi disahkan, kemasukan antarabangsa tidak tersedia",
    "zh-CN": "官方页已核验但不开放国际学生",
    "zh-TW": "官方頁已核驗但不開放國際學生"
  },
  "needs-review": {
    en: "Needs review",
    ms: "Perlu semakan",
    "zh-CN": "待复核",
    "zh-TW": "待複核"
  },
  "source-conflict": {
    en: "Source conflict",
    ms: "Konflik sumber",
    "zh-CN": "来源冲突",
    "zh-TW": "來源衝突"
  },
  "missing-source": {
    en: "Missing official source",
    ms: "Sumber rasmi tiada",
    "zh-CN": "缺少官方来源",
    "zh-TW": "缺少官方來源"
  },
  "hidden-duplicate-superseded": {
    en: "Hidden duplicate or superseded",
    ms: "Duplikasi atau digantikan",
    "zh-CN": "重复或已被替代隐藏",
    "zh-TW": "重複或已被替代隱藏"
  }
};

export const FEE_AUDIT_STATUS_LABELS: Record<FeeAuditStatus, LocalizedText> = {
  "matched-official": {
    en: "Official total fee matched",
    ms: "Jumlah yuran rasmi sepadan",
    "zh-CN": "官方总学费一致",
    "zh-TW": "官方總學費一致"
  },
  "fee-sheet-verified": {
    en: "Fee sheet verified",
    ms: "Jadual yuran disahkan",
    "zh-CN": "官方费用表已核验",
    "zh-TW": "官方費用表已核驗"
  },
  "official-approximate": {
    en: "Official approximate fee",
    ms: "Anggaran yuran rasmi",
    "zh-CN": "官方近似金额",
    "zh-TW": "官方近似金額"
  },
  "official-rate-verified": {
    en: "Official rate verified only",
    ms: "Kadar rasmi sahaja disahkan",
    "zh-CN": "仅官方费率已核验",
    "zh-TW": "僅官方費率已核驗"
  },
  "calculated-from-official-rate": {
    en: "Calculated from official rate and duration",
    ms: "Dikira daripada kadar dan tempoh rasmi",
    "zh-CN": "按官方费率计算总额",
    "zh-TW": "按官方費率計算總額"
  },
  "official-non-scalar": {
    en: "Official non-scalar fee",
    ms: "Yuran rasmi bukan nilai tunggal",
    "zh-CN": "官方非单一金额",
    "zh-TW": "官方非單一金額"
  },
  conflict: {
    en: "Conflict",
    ms: "Konflik",
    "zh-CN": "冲突",
    "zh-TW": "衝突"
  },
  "source-conflict": {
    en: "Fee source conflict",
    ms: "Konflik sumber yuran",
    "zh-CN": "费用来源冲突",
    "zh-TW": "費用來源衝突"
  },
  "pending-review": {
    en: "Fee pending review",
    ms: "Yuran menunggu semakan",
    "zh-CN": "费用待复核",
    "zh-TW": "費用待複核"
  },
  "not-published": {
    en: "Fee not published",
    ms: "Yuran tidak diterbitkan",
    "zh-CN": "官网未公布费用",
    "zh-TW": "官網未公布費用"
  }
};
