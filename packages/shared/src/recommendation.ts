import type { ApplicationTier, DegreeLevel, ProgramCategoryCode, PublicDisplayStatus, RecommendationResult } from "./index.js";
import type { LocalizedText, SupportedLocale } from "./i18n.js";

export const SMART_RECOMMENDATION_CONTRACT_SCHEMA_VERSION = "2026-05-25" as const;

export interface SmartRecommendationStudentProfile {
  level: DegreeLevel | null;
  targetCategory: ProgramCategoryCode | null;
  budgetCny: number | null;
  gpa: number | null;
  ielts: number | null;
  experience?: string | null;
  acceptNoLanguage: boolean | null;
}

export type SmartRecommendationProfileField = keyof SmartRecommendationStudentProfile;

export const SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS = [
  "level",
  "targetCategory",
  "budgetCny",
  "gpa",
  "ielts",
  "acceptNoLanguage"
] as const satisfies readonly SmartRecommendationProfileField[];

export const SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS = [
  "experience"
] as const satisfies readonly SmartRecommendationProfileField[];

export const SMART_RECOMMENDATION_CACHE_INVALIDATION_TRIGGERS = [
  "profile-updated",
  "sign-out",
  "account-switched",
  "rule-version-changed",
  "public-program-data-updated"
] as const;

export type SmartRecommendationRequiredProfileField = (typeof SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS)[number];
export type SmartRecommendationOptionalProfileField = (typeof SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS)[number];
export type SmartRecommendationCacheInvalidationTrigger =
  (typeof SMART_RECOMMENDATION_CACHE_INVALIDATION_TRIGGERS)[number];

export const SMART_RECOMMENDATION_PROFILE_COMPLETENESS_THRESHOLD = 90;

export const SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS = {
  level: 16,
  targetCategory: 16,
  budgetCny: 16,
  gpa: 18,
  ielts: 16,
  experience: 8,
  acceptNoLanguage: 10
} as const satisfies Record<SmartRecommendationProfileField, number>;

export type SmartRecommendationMode = "public-catalog-suggestion" | "personalized-profile-match";
export type SmartRecommendationProfileSource = "saved-user-profile" | "local-draft-profile";
export type SmartRecommendationAccessStatus =
  | "login-required"
  | "profile-incomplete"
  | "ready"
  | "no-match"
  | "error";
export type SmartRecommendationBlockReason =
  | "login-required"
  | "profile-required"
  | "profile-incomplete"
  | "profile-stale"
  | "anonymous-personalization-not-allowed"
  | "profile-source-untrusted";
export type SmartRecommendationAction =
  | "open-login"
  | "open-profile"
  | "refresh-recommendations"
  | "adjust-profile"
  | "retry";
export type SmartRecommendationRiskSeverity = "info" | "warning" | "critical";
export type SmartRecommendationRiskCode =
  | "budget-over-limit"
  | "gpa-below-requirement"
  | "language-below-requirement"
  | "conditional-language-required"
  | "limited-public-data"
  | "source-needs-review";
export type SmartRecommendationReasonCode =
  | "level-match"
  | "category-match"
  | "budget-within-range"
  | "budget-close"
  | "gpa-meets-requirement"
  | "gpa-close"
  | "language-meets-requirement"
  | "conditional-language-available"
  | "ranking-fit";
export type SmartRecommendationPublicDataField =
  | "program.level"
  | "program.category"
  | "program.annualTuitionCny"
  | "program.requirement.gpa"
  | "program.languageRequirement.ielts"
  | "program.publicDisplayStatus"
  | "university.livingCostCny"
  | "university.acceptNoLanguage"
  | "university.qsRank"
  | "university.publicDisplayStatus";
export type SmartRecommendationCacheScope = "none" | "user-profile";
export type SmartRecommendationPublicDisplayStatus = Extract<PublicDisplayStatus, "ready">;

export interface SmartRecommendationProfileSnapshotDto extends SmartRecommendationStudentProfile {
  userId?: number | null;
  source: SmartRecommendationProfileSource;
  profileVersion?: string | null;
  updatedAt?: string | null;
}

export interface SmartRecommendationSavedProfileDto extends SmartRecommendationProfileSnapshotDto {
  userId: number;
  source: "saved-user-profile";
  profileVersion: string;
  updatedAt: string;
}

export type SmartRecommendationProfilePatchDto = Partial<SmartRecommendationStudentProfile>;

export interface SmartRecommendationProfileCompletenessDto {
  score: number;
  threshold: number;
  isComplete: boolean;
  requiredFields: SmartRecommendationRequiredProfileField[];
  optionalFields: SmartRecommendationOptionalProfileField[];
  completedFields: SmartRecommendationProfileField[];
  missingRequiredFields: SmartRecommendationRequiredProfileField[];
  missingOptionalFields: SmartRecommendationOptionalProfileField[];
}

export interface SmartRecommendationGateDto {
  status: SmartRecommendationAccessStatus;
  mode: SmartRecommendationMode;
  canShowRecommendations: boolean;
  requiresAuthentication: boolean;
  requiresCompleteProfile: boolean;
  primaryAction: SmartRecommendationAction;
  message: LocalizedText;
  blockReasons: SmartRecommendationBlockReason[];
  missingProfileFields: SmartRecommendationRequiredProfileField[];
}

export interface SmartRecommendationRequestDto {
  mode: "personalized-profile-match";
  locale?: SupportedLocale;
  profileVersion?: string;
  requestedAt?: string;
}

export interface PublicCatalogSuggestionRequestDto {
  mode: "public-catalog-suggestion";
  level?: DegreeLevel;
  targetCategory?: ProgramCategoryCode;
  budgetCny?: number;
  gpa?: number;
  ielts?: number;
  acceptNoLanguage?: boolean;
  locale?: SupportedLocale;
}

export interface SmartRecommendationReasonDto {
  code: SmartRecommendationReasonCode;
  profileField?: SmartRecommendationProfileField;
  publicDataField?: SmartRecommendationPublicDataField;
  message: LocalizedText;
  profileValue?: string | number | boolean | null;
  publicDataValue?: string | number | boolean | null;
}

export interface SmartRecommendationRiskDto {
  code: SmartRecommendationRiskCode;
  severity: SmartRecommendationRiskSeverity;
  profileField?: SmartRecommendationProfileField;
  publicDataField?: SmartRecommendationPublicDataField;
  message: LocalizedText;
  suggestion?: LocalizedText;
}

export interface SmartRecommendationTraceDto {
  userId: number;
  profileVersion: string;
  profileFields: SmartRecommendationProfileField[];
  publicDataFields: SmartRecommendationPublicDataField[];
  universityId: number;
  programId: number;
  generatedAt: string;
}

export interface SmartRecommendationResultDto extends RecommendationResult {
  tier: ApplicationTier;
  publicDisplayStatus: SmartRecommendationPublicDisplayStatus;
  reasonsDetailed: SmartRecommendationReasonDto[];
  risks: SmartRecommendationRiskDto[];
  trace: SmartRecommendationTraceDto;
}

export interface SmartRecommendationCacheKeyDto {
  userId: number;
  profileVersion: string;
  profileHash: string;
  locale?: SupportedLocale;
}

export interface SmartRecommendationCachePolicyDto {
  scope: SmartRecommendationCacheScope;
  profileVersion?: string;
  ruleVersion?: string;
  expiresAt?: string;
  invalidationTriggers: SmartRecommendationCacheInvalidationTrigger[];
}

export interface SmartRecommendationResponseDto {
  schemaVersion: typeof SMART_RECOMMENDATION_CONTRACT_SCHEMA_VERSION;
  status: SmartRecommendationAccessStatus;
  gate: SmartRecommendationGateDto;
  profile: SmartRecommendationSavedProfileDto | null;
  profileCompleteness: SmartRecommendationProfileCompletenessDto | null;
  recommendations: SmartRecommendationResultDto[];
  cacheKey?: SmartRecommendationCacheKeyDto;
  cachePolicy?: SmartRecommendationCachePolicyDto;
  generatedAt?: string;
}

export interface SmartRecommendationContract {
  schemaVersion: typeof SMART_RECOMMENDATION_CONTRACT_SCHEMA_VERSION;
  personalizedMode: Extract<SmartRecommendationMode, "personalized-profile-match">;
  publicSuggestionMode: Extract<SmartRecommendationMode, "public-catalog-suggestion">;
  personalizationRequiresAuthentication: true;
  personalizationProfileSource: Extract<SmartRecommendationProfileSource, "saved-user-profile">;
  requiredProfileFields: readonly SmartRecommendationRequiredProfileField[];
  optionalProfileFields: readonly SmartRecommendationOptionalProfileField[];
  completenessThreshold: number;
  publicResultStatus: SmartRecommendationPublicDisplayStatus;
  maxResults: number;
  resultTiers: readonly ApplicationTier[];
  cacheInvalidationTriggers: readonly SmartRecommendationCacheInvalidationTrigger[];
}

export const SMART_RECOMMENDATION_CONTRACT = {
  schemaVersion: SMART_RECOMMENDATION_CONTRACT_SCHEMA_VERSION,
  personalizedMode: "personalized-profile-match",
  publicSuggestionMode: "public-catalog-suggestion",
  personalizationRequiresAuthentication: true,
  personalizationProfileSource: "saved-user-profile",
  requiredProfileFields: SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS,
  optionalProfileFields: SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS,
  completenessThreshold: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_THRESHOLD,
  publicResultStatus: "ready",
  maxResults: 8,
  resultTiers: ["reach", "target", "safe"],
  cacheInvalidationTriggers: SMART_RECOMMENDATION_CACHE_INVALIDATION_TRIGGERS
} as const satisfies SmartRecommendationContract;
