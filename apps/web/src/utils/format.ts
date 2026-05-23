import type {
  FeeAuditStatus,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceStatus,
  ProgramCatalogDetail,
  ProgramListItem,
  PublicDisplayStatus,
  SupportedLocale,
  TuitionCurrency
} from "@studymy/shared";

export const OFFICIAL_PAGE_FALLBACK = "以学校官方页面为准";
export const OFFICIAL_CONFIRMATION_FALLBACK = "待官方确认";
export const NOT_AVAILABLE_FOR_INTERNATIONAL = "不适用国际学生";

export function pickLocaleText(value: LocalizedText, locale: SupportedLocale): string {
  return value[locale] || value.en || value["zh-CN"];
}

export function pickLocaleArray(value: LocalizedStringArray, locale: SupportedLocale): string[] {
  return value[locale] || value.en || value["zh-CN"];
}

export function formatCurrency(value: number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

type ProgramDisplayFields = ProgramListItem | ProgramCatalogDetail;

const missingDisplayValues = new Set(["", "-", "--", "n/a", "na", "null", "undefined", "[]", "{}", "[object object]"]);

function finitePositiveNumber(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function rawDisplayText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.map(rawDisplayText).filter(Boolean).join(" / ");
  return "";
}

export function cleanDisplayText(value: unknown, fallback = OFFICIAL_CONFIRMATION_FALLBACK): string {
  const text = rawDisplayText(value).replace(/\s+/g, " ").trim();
  return missingDisplayValues.has(text.toLowerCase()) ? fallback : text;
}

export function hasDisplayText(value: unknown): boolean {
  return cleanDisplayText(value, "") !== "";
}

export function normalizeAcademicText(value: unknown, fallback = OFFICIAL_PAGE_FALLBACK): string {
  const text = cleanDisplayText(value, "");
  if (!text) return fallback;
  const normalized = text
    .replace(/Not offered for the Academic Session 2026\/2027/gi, "2026/2027 学年不开放")
    .replace(/Not offered/gi, "暂不开放")
    .replace(/Semester 1 \(October\) Intake/gi, "第一学期（10月）")
    .replace(/Semester 2 \(March\) Intake/gi, "第二学期（3月）")
    .replace(/October Intake/gi, "10月")
    .replace(/March Intake/gi, "3月")
    .replace(/October/gi, "10月")
    .replace(/March/gi, "3月")
    .replace(/September/gi, "9月")
    .replace(/Rolling/gi, "滚动开放")
    .replace(/Years?/gi, "年")
    .replace(/Semesters?/gi, "个学期")
    .replace(/Full time/gi, "全日制")
    .replace(/Coursework/gi, "授课型")
    .replace(/\band\b/gi, "及")
    .replace(/\s+\/\s+year/gi, " / 年")
    .trim();
  return cleanDisplayText(normalized, fallback);
}

function currencyPrefix(currency?: TuitionCurrency | null): string {
  if (currency === "MYR") return "RM";
  if (currency === "CNY") return "CNY";
  if (currency === "USD") return "USD";
  return "";
}

function hasOfficialFeeEvidence(program: ProgramDisplayFields): boolean {
  return Boolean(
    finitePositiveNumber(program.officialTuitionMYR) ||
    hasDisplayText(program.officialFeeSourceUrl) ||
    hasDisplayText(program.tuitionInfo?.sourceUrl) ||
    program.officialFeeAuditStatus === "matched-official"
  );
}

export function formatProgramTuition(program: ProgramDisplayFields, fallback = OFFICIAL_PAGE_FALLBACK): string {
  if (program.publicDisplayStatus === "not-available-for-international") return NOT_AVAILABLE_FOR_INTERNATIONAL;

  const explicitDisplay = cleanDisplayText(program.tuitionDisplay || program.listTuitionText || program.tuitionInfo?.displayText, "");
  const officialMyr = finitePositiveNumber(program.officialTuitionMYR ?? program.tuitionInfo?.officialAmountMYR);
  if (officialMyr) return `RM ${formatCurrency(officialMyr)}`;

  const amount = finitePositiveNumber(program.tuitionAmount ?? program.tuitionInfo?.amount);
  const currency = program.tuitionCurrency || program.tuitionInfo?.currency;
  const prefix = currencyPrefix(currency);
  if (amount && prefix) return `${prefix} ${formatCurrency(amount)}`;

  if (explicitDisplay && hasOfficialFeeEvidence(program)) {
    return normalizeAcademicText(explicitDisplay, fallback);
  }

  return fallback;
}

export function formatProgramDuration(program: ProgramDisplayFields): string {
  if (hasDisplayText(program.durationOfficial)) return normalizeAcademicText(program.durationOfficial);
  const years = finitePositiveNumber(program.durationYears);
  return years ? `${years} 年` : OFFICIAL_CONFIRMATION_FALLBACK;
}

function formatIelts(language?: LanguageRequirement | null): string {
  const ielts = finitePositiveNumber(language?.ielts);
  return ielts ? `IELTS ${ielts}+` : "";
}

export function formatProgramLanguage(program: ProgramDisplayFields, fallback = OFFICIAL_PAGE_FALLBACK): string {
  if (program.publicDisplayStatus === "not-available-for-international") return NOT_AVAILABLE_FOR_INTERNATIONAL;
  const officialText = cleanDisplayText(program.officialLanguageRequirement, "");
  const match = officialText.match(/IELTS(?:\s*\(Academic\)|\s+Academic)?(?:\s*Band)?\s*(\d+(?:\.\d+)?)/i);
  if (match) return `IELTS ${match[1]}+`;
  if (officialText) return normalizeAcademicText(officialText, fallback);
  return formatIelts(program.languageRequirement) || fallback;
}

export function formatProgramIntake(program: ProgramDisplayFields, fallback = OFFICIAL_PAGE_FALLBACK): string {
  const officialIntake = cleanDisplayText(program.officialIntake, "");
  const intakeMonths = Array.isArray(program.intakeMonths)
    ? program.intakeMonths.map((item) => cleanDisplayText(item, "")).filter(Boolean)
    : [];
  return normalizeAcademicText(officialIntake || intakeMonths.join(" / "), fallback);
}

export function formatFeeAuditStatus(status?: FeeAuditStatus | null, publicDisplayStatus?: PublicDisplayStatus | null): string {
  if (publicDisplayStatus === "not-available-for-international") return "详情页查看说明";
  if (status === "matched-official") return "官方已核验";
  if (status === "not-published") return "官方未公布";
  if (status === "conflict" || status === "source-conflict") return "费用来源需复核";
  return OFFICIAL_CONFIRMATION_FALLBACK;
}

export function formatOfficialSourceStatus(status?: OfficialSourceStatus | string | null): string {
  if (status === "official-verified") return "官方来源已核验";
  if (status?.includes("not-available")) return "官方页已核验但暂不开放";
  if (status?.includes("missing")) return "缺少官方来源";
  if (status?.includes("conflict")) return "来源需复核";
  if (status?.includes("hidden")) return "未进入公开展示";
  if (status === "needs-review") return "待复核";
  return OFFICIAL_CONFIRMATION_FALLBACK;
}

export function formatPublicCount(value: unknown, fallback = "0"): string {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? formatCurrency(count) : fallback;
}
