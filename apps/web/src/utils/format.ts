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

const localizedFormatText = {
  en: {
    officialPageFallback: "Refer to the official university page",
    officialConfirmationFallback: "Pending official confirmation",
    notAvailableForInternational: "Not applicable to international students",
    yes: "Yes",
    no: "No",
    years: "years",
    detailPageNote: "See detail page notes",
    feeMatchedOfficial: "Officially verified",
    feeNotPublished: "Not published officially",
    feeSourceReview: "Fee source needs review",
    sourceOfficialVerified: "Official source verified",
    sourceNotAvailable: "Official page verified but not open",
    sourceMissing: "Official source missing",
    sourceConflict: "Source needs review",
    sourceHidden: "Not included in public display",
    sourceNeedsReview: "Pending review"
  },
  ms: {
    officialPageFallback: "Refer to the official university page",
    officialConfirmationFallback: "Pending official confirmation",
    notAvailableForInternational: "Not applicable to international students",
    yes: "Yes",
    no: "No",
    years: "years",
    detailPageNote: "See detail page notes",
    feeMatchedOfficial: "Officially verified",
    feeNotPublished: "Not published officially",
    feeSourceReview: "Fee source needs review",
    sourceOfficialVerified: "Official source verified",
    sourceNotAvailable: "Official page verified but not open",
    sourceMissing: "Official source missing",
    sourceConflict: "Source needs review",
    sourceHidden: "Not included in public display",
    sourceNeedsReview: "Pending review"
  },
  "zh-CN": {
    officialPageFallback: OFFICIAL_PAGE_FALLBACK,
    officialConfirmationFallback: OFFICIAL_CONFIRMATION_FALLBACK,
    notAvailableForInternational: NOT_AVAILABLE_FOR_INTERNATIONAL,
    yes: "是",
    no: "否",
    years: "年",
    detailPageNote: "详情页查看说明",
    feeMatchedOfficial: "官方已核验",
    feeNotPublished: "官方未公布",
    feeSourceReview: "费用来源需复核",
    sourceOfficialVerified: "官方来源已核验",
    sourceNotAvailable: "官方页已核验但暂不开放",
    sourceMissing: "缺少官方来源",
    sourceConflict: "来源需复核",
    sourceHidden: "未进入公开展示",
    sourceNeedsReview: "待复核"
  },
  "zh-TW": {
    officialPageFallback: "以學校官方頁面為準",
    officialConfirmationFallback: "待官方確認",
    notAvailableForInternational: "不適用國際學生",
    yes: "是",
    no: "否",
    years: "年",
    detailPageNote: "詳情頁查看說明",
    feeMatchedOfficial: "官方已核驗",
    feeNotPublished: "官方未公布",
    feeSourceReview: "費用來源需複核",
    sourceOfficialVerified: "官方來源已核驗",
    sourceNotAvailable: "官方頁已核驗但暫不開放",
    sourceMissing: "缺少官方來源",
    sourceConflict: "來源需複核",
    sourceHidden: "未進入公開展示",
    sourceNeedsReview: "待複核"
  }
} satisfies Record<SupportedLocale, Record<string, string>>;

type FormatTextKey = keyof typeof localizedFormatText.en;

function normalizeLocale(locale?: SupportedLocale): SupportedLocale {
  return locale && localizedFormatText[locale] ? locale : "zh-CN";
}

function isChineseLocale(locale?: SupportedLocale) {
  const normalized = normalizeLocale(locale);
  return normalized === "zh-CN" || normalized === "zh-TW";
}

function formatText(key: FormatTextKey, locale?: SupportedLocale) {
  return localizedFormatText[normalizeLocale(locale)][key];
}

export function officialPageFallback(locale?: SupportedLocale): string {
  return formatText("officialPageFallback", locale);
}

export function officialConfirmationFallback(locale?: SupportedLocale): string {
  return formatText("officialConfirmationFallback", locale);
}

export function notAvailableForInternational(locale?: SupportedLocale): string {
  return formatText("notAvailableForInternational", locale);
}

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

function rawDisplayText(value: unknown, locale?: SupportedLocale): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? formatText("yes", locale) : formatText("no", locale);
  if (Array.isArray(value)) return value.map((item) => rawDisplayText(item, locale)).filter(Boolean).join(" / ");
  return "";
}

export function cleanDisplayText(
  value: unknown,
  fallback = OFFICIAL_CONFIRMATION_FALLBACK,
  locale?: SupportedLocale
): string {
  const text = rawDisplayText(value, locale).replace(/\s+/g, " ").trim();
  return missingDisplayValues.has(text.toLowerCase()) ? fallback : text;
}

export function hasDisplayText(value: unknown): boolean {
  return cleanDisplayText(value, "") !== "";
}

export function normalizeAcademicText(value: unknown, fallback?: string, locale?: SupportedLocale): string {
  const actualFallback = fallback ?? officialPageFallback(locale);
  const text = cleanDisplayText(value, "", locale);
  if (!text) return actualFallback;
  const normalized = isChineseLocale(locale)
    ? text
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
      .trim()
    : text
      .replace(/Not offered for the Academic Session 2026\/2027/gi, "Not offered for the 2026/2027 academic year")
      .replace(/\s+\/\s+year/gi, " / year")
      .trim();
  return cleanDisplayText(normalized, actualFallback, locale);
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

export function formatProgramTuition(program: ProgramDisplayFields, fallback?: string, locale?: SupportedLocale): string {
  const actualFallback = fallback ?? officialPageFallback(locale);
  if (program.publicDisplayStatus === "not-available-for-international") return notAvailableForInternational(locale);

  const explicitDisplay = cleanDisplayText(program.tuitionDisplay || program.listTuitionText || program.tuitionInfo?.displayText, "", locale);
  const officialMyr = finitePositiveNumber(program.officialTuitionMYR ?? program.tuitionInfo?.officialAmountMYR);
  if (officialMyr) return `RM ${formatCurrency(officialMyr)}`;

  const amount = finitePositiveNumber(program.tuitionAmount ?? program.tuitionInfo?.amount);
  const currency = program.tuitionCurrency || program.tuitionInfo?.currency;
  const prefix = currencyPrefix(currency);
  if (amount && prefix) return `${prefix} ${formatCurrency(amount)}`;

  if (explicitDisplay && hasOfficialFeeEvidence(program)) {
    return normalizeAcademicText(explicitDisplay, actualFallback, locale);
  }

  return actualFallback;
}

export function formatProgramDuration(program: ProgramDisplayFields, locale?: SupportedLocale): string {
  if (hasDisplayText(program.durationOfficial)) return normalizeAcademicText(program.durationOfficial, undefined, locale);
  const years = finitePositiveNumber(program.durationYears);
  return years ? `${years} ${formatText("years", locale)}` : officialConfirmationFallback(locale);
}

function formatIelts(language?: LanguageRequirement | null): string {
  const ielts = finitePositiveNumber(language?.ielts);
  return ielts ? `IELTS ${ielts}+` : "";
}

export function formatProgramLanguage(program: ProgramDisplayFields, fallback?: string, locale?: SupportedLocale): string {
  const actualFallback = fallback ?? officialPageFallback(locale);
  if (program.publicDisplayStatus === "not-available-for-international") return notAvailableForInternational(locale);
  const officialText = cleanDisplayText(program.officialLanguageRequirement, "", locale);
  const match = officialText.match(/IELTS(?:\s*\(Academic\)|\s+Academic)?(?:\s*Band)?\s*(\d+(?:\.\d+)?)/i);
  if (match) return `IELTS ${match[1]}+`;
  if (officialText) return normalizeAcademicText(officialText, actualFallback, locale);
  return formatIelts(program.languageRequirement) || actualFallback;
}

export function formatProgramIntake(program: ProgramDisplayFields, fallback?: string, locale?: SupportedLocale): string {
  const officialIntake = cleanDisplayText(program.officialIntake, "", locale);
  const intakeMonths = Array.isArray(program.intakeMonths)
    ? program.intakeMonths.map((item) => cleanDisplayText(item, "", locale)).filter(Boolean)
    : [];
  return normalizeAcademicText(officialIntake || intakeMonths.join(" / "), fallback, locale);
}

export function formatFeeAuditStatus(
  status?: FeeAuditStatus | null,
  publicDisplayStatus?: PublicDisplayStatus | null,
  locale?: SupportedLocale
): string {
  if (publicDisplayStatus === "not-available-for-international") return formatText("detailPageNote", locale);
  if (status === "matched-official") return formatText("feeMatchedOfficial", locale);
  if (status === "not-published") return formatText("feeNotPublished", locale);
  if (status === "conflict" || status === "source-conflict") return formatText("feeSourceReview", locale);
  return officialConfirmationFallback(locale);
}

export function formatOfficialSourceStatus(status?: OfficialSourceStatus | string | null, locale?: SupportedLocale): string {
  if (status === "official-verified") return formatText("sourceOfficialVerified", locale);
  if (status?.includes("not-available")) return formatText("sourceNotAvailable", locale);
  if (status?.includes("missing")) return formatText("sourceMissing", locale);
  if (status?.includes("conflict")) return formatText("sourceConflict", locale);
  if (status?.includes("hidden")) return formatText("sourceHidden", locale);
  if (status === "needs-review") return formatText("sourceNeedsReview", locale);
  return officialConfirmationFallback(locale);
}

export function formatPublicCount(value: unknown, fallback = "0"): string {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? formatCurrency(count) : fallback;
}
