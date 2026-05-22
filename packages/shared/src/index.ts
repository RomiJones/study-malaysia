export const SUPPORTED_LOCALES = ["en", "ms", "zh-CN", "zh-TW"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type LocalizedText = Record<SupportedLocale, string>;
export type LocalizedStringArray = Record<SupportedLocale, string[]>;

export type DegreeLevel = "bachelor" | "master" | "phd";
export type ProgramCategory =
  | "business"
  | "it"
  | "engineering"
  | "science"
  | "arts"
  | "medicine"
  | "law";
export type InstitutionOwnership = "public" | "private";
export type InstitutionType = "research" | "comprehensive" | "applied";
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

export interface ProgramRequirement {
  gpa: number;
  gaokaoRequired: boolean;
  huikaoRequired: boolean;
  note: LocalizedText;
}

export interface UniversityListItem {
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
  minIelts: number;
  acceptNoLanguage: boolean;
  facilities: LocalizedStringArray;
  highlights: LocalizedStringArray;
  programCount: number;
}

export interface ProgramListItem {
  id: number;
  universityId: number;
  slug: string;
  code: string;
  name: LocalizedText;
  nameEn: string;
  level: DegreeLevel;
  category: ProgramCategory;
  faculty: LocalizedText;
  durationYears: number;
  annualTuitionCny: number;
  intakeMonths: string[];
  languageRequirement: LanguageRequirement;
  requirement: ProgramRequirement;
  applicationDocs: LocalizedStringArray;
  curriculum: LocalizedStringArray;
  careers: LocalizedStringArray;
  specializations: LocalizedStringArray;
  description: LocalizedText;
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
  annualCostCny: number;
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
  phd: {
    en: "PhD",
    ms: "Doktor Falsafah",
    "zh-CN": "博士",
    "zh-TW": "博士"
  }
};

export const CATEGORY_LABELS: Record<ProgramCategory, LocalizedText> = {
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
