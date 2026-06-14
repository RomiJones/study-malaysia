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
import { CATEGORY_LABELS } from "@studymy/shared";
import { toTraditionalText } from "../i18n/localeTransforms";

export const OFFICIAL_PAGE_FALLBACK = "以院校官方页面为准";
export const OFFICIAL_CONFIRMATION_FALLBACK = "待官方确认";
export const NOT_AVAILABLE_FOR_INTERNATIONAL = "不适用国际学生";

const localizedFormatText = {
  en: {
    officialPageFallback: "Refer to the official university page",
    officialConfirmationFallback: "Pending official confirmation",
    officialSourceOriginal: "Official source text",
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
    officialPageFallback: "Rujuk halaman rasmi universiti",
    officialConfirmationFallback: "Menunggu pengesahan rasmi",
    officialSourceOriginal: "Teks sumber rasmi",
    notAvailableForInternational: "Tidak terpakai untuk pelajar antarabangsa",
    yes: "Ya",
    no: "Tidak",
    years: "tahun",
    detailPageNote: "Lihat nota halaman butiran",
    feeMatchedOfficial: "Disahkan rasmi",
    feeNotPublished: "Belum diterbitkan secara rasmi",
    feeSourceReview: "Sumber yuran perlu disemak",
    sourceOfficialVerified: "Sumber rasmi disahkan",
    sourceNotAvailable: "Halaman rasmi disahkan tetapi belum dibuka",
    sourceMissing: "Sumber rasmi tiada",
    sourceConflict: "Sumber perlu disemak",
    sourceHidden: "Tidak termasuk dalam paparan awam",
    sourceNeedsReview: "Menunggu semakan"
  },
  "zh-CN": {
    officialPageFallback: OFFICIAL_PAGE_FALLBACK,
    officialConfirmationFallback: OFFICIAL_CONFIRMATION_FALLBACK,
    officialSourceOriginal: "官方来源原文",
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
    officialPageFallback: "以院校官方頁面為準",
    officialConfirmationFallback: "待官方確認",
    officialSourceOriginal: "官方來源原文",
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

const officialNoteLabels = {
  "official source verified": {
    en: "Official source verified.",
    ms: "Sumber rasmi disahkan.",
    "zh-CN": "官方来源已核验。",
    "zh-TW": "官方來源已核驗。"
  },
  "accommodation and personal expenses are not included": {
    en: "Accommodation and personal expenses are not included.",
    ms: "Penginapan dan perbelanjaan peribadi tidak termasuk.",
    "zh-CN": "不包含住宿和个人开销。",
    "zh-TW": "不包含住宿和個人開銷。"
  },
  "relevant academic background required": {
    en: "Relevant academic background required.",
    ms: "Latar akademik berkaitan diperlukan.",
    "zh-CN": "需具备相关学术背景。",
    "zh-TW": "需具備相關學術背景。"
  },
  "refer to programme page and mqa record": {
    en: "Refer to programme page and MQA record.",
    ms: "Rujuk halaman program dan rekod MQA.",
    "zh-CN": "以专业页面和 MQA 记录为准。",
    "zh-TW": "以專業頁面和 MQA 記錄為準。"
  },
  "fee follows the latest official page": {
    en: "Fee follows the latest official page.",
    ms: "Yuran mengikut halaman rasmi terkini.",
    "zh-CN": "费用以最新官方页面为准。",
    "zh-TW": "費用以最新官方頁面為準。"
  },
  "subject to official intake availability": {
    en: "Subject to official intake availability.",
    ms: "Tertakluk kepada ketersediaan ambilan rasmi.",
    "zh-CN": "以官方开放的入学批次为准。",
    "zh-TW": "以官方開放的入學批次為準。"
  },
  "living cost depends on accommodation": {
    en: "Living cost depends on accommodation.",
    ms: "Kos sara hidup bergantung pada penginapan.",
    "zh-CN": "生活费取决于住宿安排。",
    "zh-TW": "生活費取決於住宿安排。"
  }
} satisfies Record<string, LocalizedText>;

const officialNoteLabelMap = officialNoteLabels as Record<string, LocalizedText>;

const monthNameLabels = {
  january: {
    labels: { en: "January", ms: "Januari", "zh-CN": "1月", "zh-TW": "1月" }
  },
  february: {
    labels: { en: "February", ms: "Februari", "zh-CN": "2月", "zh-TW": "2月" }
  },
  march: {
    labels: { en: "March", ms: "Mac", "zh-CN": "3月", "zh-TW": "3月" }
  },
  april: {
    labels: { en: "April", ms: "April", "zh-CN": "4月", "zh-TW": "4月" }
  },
  may: {
    labels: { en: "May", ms: "Mei", "zh-CN": "5月", "zh-TW": "5月" }
  },
  june: {
    labels: { en: "June", ms: "Jun", "zh-CN": "6月", "zh-TW": "6月" }
  },
  july: {
    labels: { en: "July", ms: "Julai", "zh-CN": "7月", "zh-TW": "7月" }
  },
  august: {
    labels: { en: "August", ms: "Ogos", "zh-CN": "8月", "zh-TW": "8月" }
  },
  september: {
    labels: { en: "September", ms: "September", "zh-CN": "9月", "zh-TW": "9月" }
  },
  october: {
    labels: { en: "October", ms: "Oktober", "zh-CN": "10月", "zh-TW": "10月" }
  },
  november: {
    labels: { en: "November", ms: "November", "zh-CN": "11月", "zh-TW": "11月" }
  },
  december: {
    labels: { en: "December", ms: "Disember", "zh-CN": "12月", "zh-TW": "12月" }
  }
} satisfies Record<string, { labels: LocalizedText }>;

type MonthNameKey = keyof typeof monthNameLabels;

const monthNameAlternation = Object.keys(monthNameLabels).join("|");
const monthNamePattern = new RegExp(`\\b(${monthNameAlternation})\\b`, "gi");
const monthIntakePattern = new RegExp(`\\b(${monthNameAlternation})\\s+intakes?\\b`, "gi");
const semesterIntakePattern = new RegExp(`\\bsemester\\s+(\\d+)\\s*\\(\\s*(${monthNameAlternation})\\s*\\)\\s+intake\\b`, "gi");
const monthExpressionItem = `(?:${monthNameAlternation})(?:\\s+intakes?)?|semester\\s+\\d+\\s*\\(\\s*(?:${monthNameAlternation})\\s*\\)\\s+intake|multiple\\s+intakes?`;
const monthExpressionSeparator = `\\s*(?:/|,|;|&|\\band\\b|\\bor\\b|、|，)\\s*`;
const monthExpressionPattern = new RegExp(`^\\s*(?:${monthExpressionItem})(?:${monthExpressionSeparator}(?:${monthExpressionItem}))*\\s*$`, "i");

const multipleIntakesLabels = {
  en: "Multiple intakes",
  ms: "Beberapa ambilan",
  "zh-CN": "多批次入学",
  "zh-TW": "多批次入學"
} satisfies LocalizedText;

function monthKey(value: string): MonthNameKey | null {
  const normalized = value.toLowerCase();
  return normalized in monthNameLabels ? normalized as MonthNameKey : null;
}

function monthNameLabel(value: string, locale: SupportedLocale): string {
  const key = monthKey(value);
  return key ? monthNameLabels[key].labels[locale] : value;
}

function monthIntakeLabel(value: string, locale: SupportedLocale): string {
  const month = monthNameLabel(value, locale);
  if (locale === "zh-CN") return `${month}入学`;
  if (locale === "zh-TW") return `${month}入學`;
  if (locale === "ms") return `Ambilan ${month}`;
  return `${month} intake`;
}

function semesterIntakeLabel(term: string, month: string, locale: SupportedLocale): string {
  const monthLabel = monthNameLabel(month, locale);
  if (locale === "zh-CN") return `第${term}学期（${monthLabel}）`;
  if (locale === "zh-TW") return `第${term}學期（${monthLabel}）`;
  if (locale === "ms") return `Ambilan Semester ${term} (${monthLabel})`;
  return `Semester ${term} (${monthLabel}) intake`;
}

function isExplicitMonthExpression(value: string): boolean {
  return monthExpressionPattern.test(value);
}

function normalizeRuntimeMonthText(value: string, locale: SupportedLocale): { text: string; changed: boolean } {
  const explicitMonthExpression = isExplicitMonthExpression(value);
  let changed = false;
  let text = value.replace(semesterIntakePattern, (_match, term: string, month: string) => {
    changed = true;
    return semesterIntakeLabel(term, month, locale);
  });

  text = text.replace(/\bmultiple\s+intakes?\b/gi, () => {
    changed = true;
    return multipleIntakesLabels[locale];
  });

  text = text.replace(monthIntakePattern, (_match, month: string) => {
    changed = true;
    return monthIntakeLabel(month, locale);
  });

  if (explicitMonthExpression) {
    text = text.replace(monthNamePattern, (_match, month: string) => {
      changed = true;
      return monthNameLabel(month, locale);
    });

    if (locale === "zh-CN" || locale === "zh-TW") {
      text = text.replace(/\band\b/gi, () => {
        changed = true;
        return "及";
      }).replace(/\bor\b/gi, () => {
        changed = true;
        return "或";
      });
    } else if (locale === "ms") {
      text = text.replace(/\band\b/gi, () => {
        changed = true;
        return "dan";
      }).replace(/\bor\b/gi, () => {
        changed = true;
        return "atau";
      });
    }
  }

  return { text, changed };
}

function formatRuntimeMonthDisplayText(value: string, fallback: string, locale: SupportedLocale): string {
  const normalized = normalizeRuntimeMonthText(value, locale);
  if (!normalized.changed) return "";
  if (!isExplicitMonthExpression(value)) return "";
  const text = normalized.text.replace(/\s+/g, " ").trim();
  if (missingDisplayValues.has(text.toLowerCase())) return fallback;
  if ((locale === "en" || locale === "ms") && containsCjkText(text)) return fallback;
  return (locale === "zh-TW" ? toTraditionalText(text) : text) || fallback;
}

const runtimeDynamicTextLabels = {
  "october intake": {
    en: "October intake",
    ms: "Ambilan Oktober",
    "zh-CN": "10月入学",
    "zh-TW": "10月入學"
  },
  "march intake": {
    en: "March intake",
    ms: "Ambilan Mac",
    "zh-CN": "3月入学",
    "zh-TW": "3月入學"
  },
  "september intake": {
    en: "September intake",
    ms: "Ambilan September",
    "zh-CN": "9月入学",
    "zh-TW": "9月入學"
  },
  "refer to official portal": {
    en: "Refer to official portal.",
    ms: "Rujuk portal rasmi.",
    "zh-CN": "以官方申请入口为准。",
    "zh-TW": "以官方申請入口為準。"
  },
  "refer to official system": {
    en: "Refer to official system.",
    ms: "Rujuk sistem rasmi.",
    "zh-CN": "以官方申请系统为准。",
    "zh-TW": "以官方申請系統為準。"
  }
} satisfies Record<string, LocalizedText>;

const runtimeDynamicTextLabelMap = runtimeDynamicTextLabels as Record<string, LocalizedText>;

const academicTermLabels = {
  rolling: {
    en: "Rolling",
    ms: "Ambilan bergilir",
    "zh-CN": "滚动开放",
    "zh-TW": "滾動開放"
  },
  research: {
    en: "Research",
    ms: "Penyelidikan",
    "zh-CN": "研究型",
    "zh-TW": "研究型"
  },
  coursework: {
    en: "Coursework",
    ms: "Kerja kursus",
    "zh-CN": "授课型",
    "zh-TW": "授課型"
  },
  clinical: {
    en: "Clinical",
    ms: "Klinikal",
    "zh-CN": "临床",
    "zh-TW": "臨床"
  },
  "mixed-mode": {
    en: "Mixed-Mode",
    ms: "Mod campuran",
    "zh-CN": "混合模式",
    "zh-TW": "混合模式"
  },
  "mixed mode": {
    en: "Mixed Mode",
    ms: "Mod campuran",
    "zh-CN": "混合模式",
    "zh-TW": "混合模式"
  },
  "full-time": {
    en: "Full-Time",
    ms: "Sepenuh masa",
    "zh-CN": "全日制",
    "zh-TW": "全日制"
  },
  "full time": {
    en: "Full Time",
    ms: "Sepenuh masa",
    "zh-CN": "全日制",
    "zh-TW": "全日制"
  },
  "part-time": {
    en: "Part-Time",
    ms: "Separuh masa",
    "zh-CN": "非全日制",
    "zh-TW": "非全日制"
  },
  "part time": {
    en: "Part Time",
    ms: "Separuh masa",
    "zh-CN": "非全日制",
    "zh-TW": "非全日制"
  },
  duration: {
    en: "Duration",
    ms: "Tempoh",
    "zh-CN": "学制",
    "zh-TW": "學制"
  },
  "full-time duration": {
    en: "Full-Time Duration",
    ms: "Tempoh sepenuh masa",
    "zh-CN": "全日制学制",
    "zh-TW": "全日制學制"
  },
  "part-time duration": {
    en: "Part-Time Duration",
    ms: "Tempoh separuh masa",
    "zh-CN": "非全日制学制",
    "zh-TW": "非全日制學制"
  }
} satisfies Record<string, LocalizedText>;

const academicTermLabelMap = academicTermLabels as Record<string, LocalizedText>;

const academicTermReplacements: Array<{ pattern: RegExp; labelKey: keyof typeof academicTermLabels }> = [
  { pattern: /\bfull[-\s]?time\s+duration\b/gi, labelKey: "full-time duration" },
  { pattern: /\bpart[-\s]?time\s+duration\b/gi, labelKey: "part-time duration" },
  { pattern: /\bmixed[-\s]?mode\b/gi, labelKey: "mixed-mode" },
  { pattern: /\bfull[-\s]?time\b/gi, labelKey: "full-time" },
  { pattern: /\bpart[-\s]?time\b/gi, labelKey: "part-time" },
  { pattern: /\bcoursework\b/gi, labelKey: "coursework" },
  { pattern: /\bresearch\b/gi, labelKey: "research" },
  { pattern: /\bclinical\b/gi, labelKey: "clinical" },
  { pattern: /\brolling\b/gi, labelKey: "rolling" },
  { pattern: /\bduration\b/gi, labelKey: "duration" }
];

const extraCategoryLabels = {
  hospitality: {
    en: "Hospitality",
    ms: "Hospitaliti",
    "zh-CN": "酒店与旅游",
    "zh-TW": "酒店與旅遊"
  },
  education: {
    en: "Education",
    ms: "Pendidikan",
    "zh-CN": "教育",
    "zh-TW": "教育"
  },
  "clinical medicine": {
    en: "Clinical Medicine",
    ms: "Perubatan klinikal",
    "zh-CN": "临床医学",
    "zh-TW": "臨床醫學"
  },
  "arts and social sciences": {
    en: "Arts and Social Sciences",
    ms: "Sastera dan Sains Sosial",
    "zh-CN": "文学与社会科学",
    "zh-TW": "文學與社會科學"
  },
  "business and economics": {
    en: "Business and Economics",
    ms: "Perniagaan dan Ekonomi",
    "zh-CN": "商科与经济",
    "zh-TW": "商科與經濟"
  },
  "computer science": {
    en: "Computer Science",
    ms: "Sains Komputer",
    "zh-CN": "计算机科学",
    "zh-TW": "電腦科學"
  },
  "architecture and built environment": {
    en: "Architecture and Built Environment",
    ms: "Seni Bina dan Alam Bina",
    "zh-CN": "建筑与建成环境",
    "zh-TW": "建築與建成環境"
  },
  pharmacy: {
    en: "Pharmacy",
    ms: "Farmasi",
    "zh-CN": "药学",
    "zh-TW": "藥學"
  },
  dentistry: {
    en: "Dentistry",
    ms: "Pergigian",
    "zh-CN": "牙科",
    "zh-TW": "牙科"
  }
} satisfies Record<string, LocalizedText>;

const unknownCategoryLabels = {
  en: "Other programmes",
  ms: "Program lain",
  "zh-CN": "其他专业",
  "zh-TW": "其他專業"
} satisfies LocalizedText;

const extraCategoryLabelMap = extraCategoryLabels as Record<string, LocalizedText>;

const categoryAliasLabels = {
  商科: CATEGORY_LABELS.business,
  商学: CATEGORY_LABELS.business,
  商業: CATEGORY_LABELS.business,
  工科: CATEGORY_LABELS.engineering,
  工程: CATEGORY_LABELS.engineering,
  工程学: CATEGORY_LABELS.engineering,
  工程學: CATEGORY_LABELS.engineering,
  理科: CATEGORY_LABELS.science,
  科学: CATEGORY_LABELS.science,
  科學: CATEGORY_LABELS.science,
  医学: CATEGORY_LABELS.medicine,
  醫學: CATEGORY_LABELS.medicine,
  医科: CATEGORY_LABELS.medicine,
  醫科: CATEGORY_LABELS.medicine,
  文科: CATEGORY_LABELS.arts,
  艺术: CATEGORY_LABELS.arts,
  藝術: CATEGORY_LABELS.arts,
  法学: CATEGORY_LABELS.law,
  法學: CATEGORY_LABELS.law,
  法律: CATEGORY_LABELS.law,
  教育: extraCategoryLabels.education,
  酒店: extraCategoryLabels.hospitality,
  旅游: extraCategoryLabels.hospitality,
  旅遊: extraCategoryLabels.hospitality,
  酒店与旅游: extraCategoryLabels.hospitality,
  酒店與旅遊: extraCategoryLabels.hospitality,
  计算机: extraCategoryLabels["computer science"],
  電腦: extraCategoryLabels["computer science"],
  计算机科学: extraCategoryLabels["computer science"],
  電腦科學: extraCategoryLabels["computer science"],
  信息技术: CATEGORY_LABELS.it,
  資訊技術: CATEGORY_LABELS.it,
  人文社科: extraCategoryLabels["arts and social sciences"],
  社会科学: extraCategoryLabels["arts and social sciences"],
  社會科學: extraCategoryLabels["arts and social sciences"],
  建筑: extraCategoryLabels["architecture and built environment"],
  建築: extraCategoryLabels["architecture and built environment"],
  建筑与建成环境: extraCategoryLabels["architecture and built environment"],
  建築與建成環境: extraCategoryLabels["architecture and built environment"]
} satisfies Record<string, LocalizedText>;

const categoryAliasLabelMap = categoryAliasLabels as Record<string, LocalizedText>;

const categoryKeywordLabels: Array<[RegExp, LocalizedText]> = [
  [/clinical\s+medicine/i, extraCategoryLabels["clinical medicine"]],
  [/arts?.*social|social.*arts|social sciences?/i, extraCategoryLabels["arts and social sciences"]],
  [/商|管理|会计|會計|金融|经济|經濟/i, CATEGORY_LABELS.business],
  [/business|account|finance|economic|management|marketing/i, CATEGORY_LABELS.business],
  [/计算机|計算機|电脑|電腦|信息技术|資訊技術|软件|軟體|数据|資料|网络|網路|人工智能|人工智慧/i, CATEGORY_LABELS.it],
  [/information technology|computer|software|data|digital|cyber|artificial intelligence|\bit\b/i, CATEGORY_LABELS.it],
  [/工程|工科|建筑|建築|建成环境|建成環境/i, CATEGORY_LABELS.engineering],
  [/engineer|built environment|architecture|construction|quantity survey|urban/i, CATEGORY_LABELS.engineering],
  [/医学|醫學|医科|醫科|临床|臨床|药学|藥學|牙科|护理|護理|健康/i, CATEGORY_LABELS.medicine],
  [/medicine|medical|health|pharmacy|dentistry|nursing|clinical/i, CATEGORY_LABELS.medicine],
  [/教育|教学|教學/i, extraCategoryLabels.education],
  [/education|tesl|teaching|pedagogy/i, extraCategoryLabels.education],
  [/法律|法学|法學/i, CATEGORY_LABELS.law],
  [/law|legal/i, CATEGORY_LABELS.law],
  [/酒店|旅游|旅遊/i, extraCategoryLabels.hospitality],
  [/hospitality|tourism|event/i, extraCategoryLabels.hospitality],
  [/科学|科學|理科|生物|化学|化學|物理|数学|數學|统计|統計/i, CATEGORY_LABELS.science],
  [/science|biology|chemistry|physics|mathematics|statistics/i, CATEGORY_LABELS.science],
  [/艺术|藝術|设计|設計|媒体|媒體|传播|傳播|语言|語言|文学|文學|社会科学|社會科學|人文/i, CATEGORY_LABELS.arts],
  [/art|design|media|communication|language|linguistics/i, CATEGORY_LABELS.arts]
];

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

export function containsCjkText(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function normalizeCategoryKey(value: unknown): string {
  return typeof value === "string"
    ? value
      .trim()
      .replace(/&/g, "and")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase()
    : "";
}

function titleCaseCategory(value: string): string {
  return value.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

export function formatCategoryLabel(value: unknown, locale?: SupportedLocale): string {
  const normalizedLocale = normalizeLocale(locale);
  const key = normalizeCategoryKey(value);
  if (!key) return unknownCategoryLabels[normalizedLocale];

  const coreLabels = CATEGORY_LABELS as Record<string, LocalizedText>;
  const exactLabel = coreLabels[key] || extraCategoryLabelMap[key] || categoryAliasLabelMap[key];
  const keywordLabel = exactLabel || categoryKeywordLabels.find(([pattern]) => pattern.test(key))?.[1];
  if (keywordLabel) {
    return cleanDisplayText(
      keywordLabel[normalizedLocale] || keywordLabel.en,
      unknownCategoryLabels[normalizedLocale],
      normalizedLocale
    );
  }

  const displayText = String(value).trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (normalizedLocale === "en" && !containsCjkText(displayText)) return titleCaseCategory(displayText);
  if (isChineseLocale(normalizedLocale) && containsCjkText(displayText)) {
    return cleanDisplayText(displayText, unknownCategoryLabels[normalizedLocale], normalizedLocale);
  }
  return unknownCategoryLabels[normalizedLocale];
}

export function officialPageFallback(locale?: SupportedLocale): string {
  return formatText("officialPageFallback", locale);
}

export function officialConfirmationFallback(locale?: SupportedLocale): string {
  return formatText("officialConfirmationFallback", locale);
}

export function formatVerifiedOfficialText(
  value: unknown,
  status?: OfficialSourceStatus | null,
  fallback?: string,
  locale?: SupportedLocale
): string {
  const normalizedLocale = normalizeLocale(locale);
  const actualFallback = fallback ?? officialPageFallback(normalizedLocale);
  const formatted = formatOfficialNote(value, actualFallback, normalizedLocale);
  if (formatted !== actualFallback) return formatted;
  if (status !== "official-verified") return actualFallback;
  const original = cleanDisplayText(value, "", "en");
  return original ? `${formatText("officialSourceOriginal", normalizedLocale)}: ${original}` : actualFallback;
}

export function notAvailableForInternational(locale?: SupportedLocale): string {
  return formatText("notAvailableForInternational", locale);
}

export function pickLocaleText(value: LocalizedText, locale: SupportedLocale): string {
  const normalizedLocale = normalizeLocale(locale);
  const candidates: SupportedLocale[] = normalizedLocale === "zh-TW"
    ? ["zh-TW", "zh-CN"]
    : normalizedLocale === "zh-CN"
      ? ["zh-CN"]
      : normalizedLocale === "ms"
        ? ["ms"]
        : ["en"];

  for (const candidate of candidates) {
    const text = cleanDisplayText(value[candidate], "", normalizedLocale);
    if (text) return text;
  }
  return "";
}

export function pickLocaleArray(value: LocalizedStringArray, locale: SupportedLocale): string[] {
  const normalizedLocale = normalizeLocale(locale);
  const candidates: SupportedLocale[] = normalizedLocale === "zh-TW"
    ? ["zh-TW", "zh-CN"]
    : normalizedLocale === "zh-CN"
      ? ["zh-CN"]
      : normalizedLocale === "ms"
        ? ["ms"]
        : ["en"];

  for (const candidate of candidates) {
    const rows = value[candidate] || [];
    const safeRows = rows.map((item) => cleanDisplayText(item, "", normalizedLocale)).filter(Boolean);
    if (safeRows.length) return safeRows;
  }
  return [];
}

export function formatCurrency(value: number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

type ProgramDisplayFields = ProgramListItem | ProgramCatalogDetail;
type ProgramFacultyDisplayFields = Pick<ProgramListItem, "category" | "faculty" | "facultyZh">;

const missingDisplayValues = new Set(["", "-", "--", "n/a", "na", "null", "undefined", "[]", "{}", "[object object]"]);

function normalizeOfficialNoteKey(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!。]+$/g, "")
    .toLowerCase();
}

function isEnglishLikeOfficialNote(value: string): boolean {
  const words = value.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  return !containsCjkText(value) && words.length >= 2;
}

function hasUnknownAcademicEnglish(value: string): boolean {
  if (isExplicitMonthExpression(value)) return false;

  const stripped = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(?:RM|CNY|USD|IELTS|TOEFL|GPA|QS|MQA|MUET|PTE)\b/gi, " ")
    .replace(/\bnot\s+offered\s+for\s+the\s+academic\s+session\s+\d{4}\/\d{4}\b/gi, " ")
    .replace(/\bnot\s+offered\b/gi, " ")
    .replace(/\bsemester\s+\d+\s*\(\s*[A-Za-z]+\s*\)\s+intakes?\b/gi, " ")
    .replace(/\bmultiple\s+intakes?\b/gi, " ")
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, " ")
    .replace(/\b(?:full[-\s]?time|part[-\s]?time|mixed[-\s]?mode|coursework|research|clinical|rolling|duration|years?|semesters?|intakes?|academic|session|band|and|or|per|year)\b/gi, " ")
    .replace(/[0-9.,:+/()&\-–—\s]+/g, " ")
    .trim();

  return /[A-Za-z][A-Za-z'-]*/.test(stripped);
}

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

function normalizedRawDisplayText(value: unknown, locale?: SupportedLocale): string {
  return rawDisplayText(value, locale).replace(/\s+/g, " ").trim();
}

function formatLocalizedLabel(label: LocalizedText, fallback: string, locale: SupportedLocale): string {
  const text = rawDisplayText(label[locale] || label.en, locale).replace(/\s+/g, " ").trim();
  if (missingDisplayValues.has(text.toLowerCase())) return fallback;
  if ((locale === "en" || locale === "ms") && containsCjkText(text)) return fallback;
  return (locale === "zh-TW" ? toTraditionalText(text) : text) || fallback;
}

function formatAcademicTermText(value: string, fallback: string, locale: SupportedLocale): string {
  const label = academicTermLabelMap[normalizeOfficialNoteKey(value)];
  return label ? formatLocalizedLabel(label, fallback, locale) : "";
}

function replaceAcademicTerms(value: string, locale: SupportedLocale): string {
  return academicTermReplacements.reduce(
    (text, replacement) => text.replace(replacement.pattern, () => academicTermLabels[replacement.labelKey][locale]),
    value
  );
}

export function cleanDisplayText(
  value: unknown,
  fallback?: string,
  locale?: SupportedLocale
): string {
  const actualFallback = fallback ?? officialConfirmationFallback(locale);
  const text = rawDisplayText(value, locale).replace(/\s+/g, " ").trim();
  if (missingDisplayValues.has(text.toLowerCase())) return actualFallback;
  const normalizedLocale = normalizeLocale(locale);
  const monthText = formatRuntimeMonthDisplayText(text, actualFallback, normalizedLocale);
  if (monthText) return monthText;
  const runtimeLabel = runtimeDynamicTextLabelMap[normalizeOfficialNoteKey(text)];
  if (runtimeLabel) return formatLocalizedLabel(runtimeLabel, actualFallback, normalizedLocale);
  const academicTermLabel = formatAcademicTermText(text, "", normalizedLocale);
  if (academicTermLabel) return academicTermLabel;
  if ((normalizedLocale === "en" || normalizedLocale === "ms") && containsCjkText(text)) return actualFallback;
  const localizedText = normalizedLocale === "zh-TW" ? toTraditionalText(text) : text;
  return localizedText || actualFallback;
}

export function formatOfficialNote(
  value: unknown,
  fallback?: string,
  locale?: SupportedLocale
): string {
  const normalizedLocale = normalizeLocale(locale);
  const actualFallback = fallback ?? officialConfirmationFallback(normalizedLocale);
  const rawText = normalizedRawDisplayText(value, normalizedLocale);
  if (missingDisplayValues.has(rawText.toLowerCase())) return actualFallback;

  const normalizedKey = normalizeOfficialNoteKey(rawText);
  const label = officialNoteLabelMap[normalizedKey] || runtimeDynamicTextLabelMap[normalizedKey];
  if (label) {
    return formatLocalizedLabel(label, actualFallback, normalizedLocale);
  }

  const text = cleanDisplayText(rawText, "", normalizedLocale);
  if (!text) return actualFallback;

  if (normalizedLocale !== "en" && isEnglishLikeOfficialNote(text)) {
    return actualFallback;
  }

  return cleanDisplayText(text, actualFallback, normalizedLocale);
}

export function formatRuntimeDisplayText(
  value: unknown,
  fallback?: string,
  locale?: SupportedLocale
): string {
  const normalizedLocale = normalizeLocale(locale);
  const actualFallback = fallback ?? officialPageFallback(normalizedLocale);
  const rawText = normalizedRawDisplayText(value, normalizedLocale);
  if (missingDisplayValues.has(rawText.toLowerCase())) return actualFallback;

  const normalizedKey = normalizeOfficialNoteKey(rawText);
  const label = runtimeDynamicTextLabelMap[normalizedKey] || officialNoteLabelMap[normalizedKey];
  if (label) {
    return formatLocalizedLabel(label, actualFallback, normalizedLocale);
  }
  const academicTermLabel = formatAcademicTermText(rawText, actualFallback, normalizedLocale);
  if (academicTermLabel) return academicTermLabel;
  const monthText = formatRuntimeMonthDisplayText(rawText, actualFallback, normalizedLocale);
  if (monthText) return monthText;

  const text = cleanDisplayText(rawText, "", normalizedLocale);
  if (!text) return actualFallback;

  if (normalizedLocale !== "en" && isEnglishLikeOfficialNote(text)) {
    return actualFallback;
  }

  return cleanDisplayText(text, actualFallback, normalizedLocale);
}

export function hasDisplayText(value: unknown): boolean {
  return cleanDisplayText(value, "") !== "";
}

export function formatProgramFacultyLabel(program: ProgramFacultyDisplayFields, locale?: SupportedLocale): string {
  const normalizedLocale = normalizeLocale(locale);
  const localizedFaculty = pickLocaleText(program.faculty, normalizedLocale);
  if (localizedFaculty) return localizedFaculty;

  const chineseFaculty = isChineseLocale(normalizedLocale)
    ? cleanDisplayText(program.facultyZh, "", normalizedLocale)
    : "";
  return chineseFaculty || formatCategoryLabel(program.category, normalizedLocale);
}

export function normalizeAcademicText(value: unknown, fallback?: string, locale?: SupportedLocale): string {
  const normalizedLocale = normalizeLocale(locale);
  const actualFallback = fallback ?? officialPageFallback(normalizedLocale);
  const rawText = normalizedRawDisplayText(value, normalizedLocale);
  if (missingDisplayValues.has(rawText.toLowerCase())) return actualFallback;

  const rawAcademicTermLabel = formatAcademicTermText(rawText, actualFallback, normalizedLocale);
  if (rawAcademicTermLabel) return rawAcademicTermLabel;
  const rawMonthText = formatRuntimeMonthDisplayText(rawText, actualFallback, normalizedLocale);
  if (rawMonthText) return rawMonthText;

  const text = cleanDisplayText(rawText, "", normalizedLocale);
  if (!text) return actualFallback;
  const academicTermLabel = formatAcademicTermText(text, actualFallback, normalizedLocale);
  if (academicTermLabel) return academicTermLabel;
  if (normalizedLocale !== "en" && hasUnknownAcademicEnglish(text)) return actualFallback;
  const monthNormalizedText = replaceAcademicTerms(normalizeRuntimeMonthText(text, normalizedLocale).text, normalizedLocale);
  const normalized = isChineseLocale(locale)
    ? (normalizedLocale === "zh-TW" ? toTraditionalText(monthNormalizedText) : monthNormalizedText)
      .replace(/Not offered for the Academic Session 2026\/2027/gi, "2026/2027 学年不开放")
      .replace(/Not offered/gi, "暂不开放")
      .replace(/Rolling/gi, "滚动开放")
      .replace(/Mixed[-\s]?Mode/gi, "混合模式")
      .replace(/Research/gi, "研究型")
      .replace(/Clinical/gi, "临床")
      .replace(/Years?/gi, "年")
      .replace(/Semesters?/gi, "个学期")
      .replace(/Full[-\s]?Time/gi, "全日制")
      .replace(/Part[-\s]?Time/gi, "非全日制")
      .replace(/Duration/gi, "学制")
      .replace(/Coursework/gi, "授课型")
      .replace(/\band\b/gi, "及")
      .replace(/\s+\/\s+year/gi, " / 年")
      .trim()
    : normalizedLocale === "ms"
      ? monthNormalizedText
        .replace(/Not offered for the Academic Session 2026\/2027/gi, "Tidak ditawarkan untuk tahun akademik 2026/2027")
        .replace(/Not offered/gi, "Tidak ditawarkan")
        .replace(/Rolling/gi, "Ambilan bergilir")
        .replace(/Mixed[-\s]?Mode/gi, "Mod campuran")
        .replace(/Research/gi, "Penyelidikan")
        .replace(/Clinical/gi, "Klinikal")
        .replace(/Years?/gi, "tahun")
        .replace(/Semesters?/gi, "semester")
        .replace(/Full[-\s]?Time/gi, "sepenuh masa")
        .replace(/Part[-\s]?Time/gi, "separuh masa")
        .replace(/Duration/gi, "tempoh")
        .replace(/Coursework/gi, "kerja kursus")
        .replace(/\band\b/gi, "dan")
        .replace(/\s+\/\s+year/gi, " / tahun")
        .trim()
    : monthNormalizedText
      .replace(/Not offered for the Academic Session 2026\/2027/gi, "Not offered for the 2026/2027 academic year")
      .replace(/\s+\/\s+year/gi, " / year")
      .trim();
  return cleanDisplayText(normalizedLocale === "zh-TW" ? toTraditionalText(normalized) : normalized, actualFallback, locale);
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
  if (program.officialFeeAuditStatus === "not-published") return formatText("feeNotPublished", locale);

  const explicitDisplay = cleanDisplayText(program.tuitionDisplay || program.listTuitionText || program.tuitionInfo?.displayText, "", locale);
  const officialMyr = finitePositiveNumber(program.officialTuitionMYR ?? program.tuitionInfo?.officialAmountMYR);
  if (officialMyr) return `RM ${formatCurrency(officialMyr)}`;

  const amount = finitePositiveNumber(program.tuitionAmount ?? program.tuitionInfo?.amount);
  const currency = program.tuitionCurrency || program.tuitionInfo?.currency;
  const prefix = currencyPrefix(currency);
  if (amount && prefix) return `${prefix} ${formatCurrency(amount)}`;

  if (explicitDisplay && hasOfficialFeeEvidence(program)) {
    const normalized = normalizeAcademicText(explicitDisplay, actualFallback, locale);
    if (locale === "zh-CN") return normalized.replace(/\bper\s+个学期/gi, "/ 学期").replace(/\bper\s+学期/gi, "/ 学期");
    if (locale === "zh-TW") return normalized.replace(/\bper\s+個學期/gi, "/ 學期").replace(/\bper\s+學期/gi, "/ 學期");
    if (locale === "ms") return normalized.replace(/\bper\s+semester/gi, "/ semester");
    return normalized;
  }

  return actualFallback;
}

export function formatProgramListTuition(
  program: ProgramDisplayFields,
  fallback?: string,
  locale?: SupportedLocale
): string {
  const detailed = formatProgramTuition(program, fallback, locale);
  const explicitDisplay = String(
    program.tuitionDisplay || program.listTuitionText || program.tuitionInfo?.displayText || ""
  ).trim();
  if (!explicitDisplay || program.officialFeeAuditStatus === "not-published") return detailed;

  const rangeMatch = explicitDisplay.match(
    /\b(USD|CNY|MYR|RM)\s*([\d,]+(?:\.\d+)?)\s*[-–—]\s*([\d,]+(?:\.\d+)?)/i
  );
  if (rangeMatch) {
    const prefix = rangeMatch[1].toUpperCase() === "MYR" ? "RM" : rangeMatch[1].toUpperCase();
    return `${prefix} ${rangeMatch[2]} - ${rangeMatch[3]}`;
  }

  const feeMatches = [...explicitDisplay.matchAll(/\b(USD|CNY|MYR|RM)\s*([\d,]+(?:\.\d+)?)/gi)];
  if (feeMatches.length < 2) return detailed;
  const prefixes = new Set(feeMatches.map((match) => match[1].toUpperCase() === "MYR" ? "RM" : match[1].toUpperCase()));
  if (prefixes.size !== 1) return detailed;

  const amounts = feeMatches
    .map((match) => Number(match[2].replace(/,/g, "")))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  if (!amounts.length) return detailed;

  const minimum = Math.min(...amounts);
  const maximum = Math.max(...amounts);
  const amountLabel = minimum === maximum
    ? formatCurrency(minimum)
    : `${formatCurrency(minimum)} - ${formatCurrency(maximum)}`;
  const prefix = [...prefixes][0];
  const isPerSemester = /(?:\bper\s+semester\b|\/\s*semester\b|每\s*(?:个)?学期|每\s*(?:個)?學期|\/\s*(?:学期|學期))/i.test(explicitDisplay);
  if (isPerSemester) {
    const semesterLabel = locale === "zh-CN"
      ? "学期"
      : locale === "zh-TW"
        ? "學期"
        : "semester";
    return `${prefix} ${amountLabel} / ${semesterLabel}`;
  }

  const isPerYear = /(?:\bper\s+year\b|\/\s*year\b|每年|\/\s*年)/i.test(explicitDisplay);
  if (isPerYear) {
    const yearLabel = locale === "ms" ? "tahun" : locale === "en" ? "year" : "年";
    return `${prefix} ${amountLabel} / ${yearLabel}`;
  }

  return `${prefix} ${amountLabel}`;
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
  const match = officialText.match(/IELTS(?:\/IELTS Online|\s*\(Academic\)|\s+Academic)?(?:\s+minimum)?(?:\s*Band)?\s*(\d+(?:\.\d+)?)/i);
  if (match) return `IELTS ${match[1]}+`;
  const compactRequirement = formatIelts(program.languageRequirement);
  if (compactRequirement) return compactRequirement;
  if (officialText) return normalizeAcademicText(officialText, actualFallback, locale);
  return formatIelts(program.languageRequirement) || actualFallback;
}

export function formatProgramIntake(program: ProgramDisplayFields, fallback?: string, locale?: SupportedLocale): string {
  const officialIntakeText = normalizedRawDisplayText(program.officialIntake, locale);
  const officialIntake = missingDisplayValues.has(officialIntakeText.toLowerCase()) ? "" : officialIntakeText;
  const intakeMonths = Array.isArray(program.intakeMonths)
    ? program.intakeMonths
      .map((item) => normalizedRawDisplayText(item, locale))
      .filter((item) => item && !missingDisplayValues.has(item.toLowerCase()))
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
