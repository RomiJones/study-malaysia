export const SUPPORTED_LOCALES = ["en", "ms", "zh-CN", "zh-TW"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type LocalizedText = Record<SupportedLocale, string>;
export type LocalizedStringArray = Record<SupportedLocale, string[]>;

export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";
export const FALLBACK_LOCALE: SupportedLocale = "en";
export const LOCALE_STORAGE_KEY = "studymy_locale";
export const LOCALE_REQUEST_HEADER = "x-studymy-locale";
export const LOCALE_QUERY_PARAM = "locale";

export type LocaleTextDirection = "ltr";
export type LocalePreferenceSource =
  | "default"
  | "browser"
  | "local-storage"
  | "query-param"
  | "user-account";
export type LocalePersistenceScope = "device" | "user-account";
export type LocaleSwitchTrigger =
  | "header"
  | "mobile-menu"
  | "account-settings"
  | "system";
export type LocaleSwitchStatus =
  | "accepted"
  | "fallback-applied"
  | "unsupported-locale";
export type HeaderNavigationLayoutMode =
  | "expanded"
  | "wrapped"
  | "compact"
  | "drawer";
export type HeaderNavigationOverflowStrategy =
  | "wrap"
  | "compact-labels"
  | "move-secondary-actions"
  | "drawer";
export type HeaderNavigationRegion = "brand" | "primary" | "tool" | "account" | "mobile";
export type HeaderNavigationItemId =
  | "home"
  | "universities"
  | "programs"
  | "planner"
  | "favorites"
  | "compare"
  | "cost-calculator"
  | "recommendations";
export type HeaderNavigationActionId =
  | "language-switcher"
  | "auth-entry"
  | "member-entry"
  | "favorites-indicator"
  | "compare-indicator"
  | "mobile-menu-toggle";
export type HeaderNavigationBadgeKind = "none" | "count" | "status";
export type HeaderNavigationBreakpointName =
  | "desktop"
  | "laptop"
  | "tablet"
  | "mobile";
export type LanguageSwitcherPlacement =
  | "header-actions"
  | "mobile-drawer"
  | "account-settings";

export interface LocaleOptionContract {
  value: SupportedLocale;
  label: LocalizedText;
  nativeLabel: string;
  shortLabel: string;
  direction: LocaleTextDirection;
  enabled: boolean;
  sortOrder: number;
}

export interface LocalePreferenceDto {
  locale: SupportedLocale;
  fallbackLocale: SupportedLocale;
  source: LocalePreferenceSource;
  persistenceScope: LocalePersistenceScope;
  persisted: boolean;
  updatedAt?: string | null;
}

export interface LocaleSwitchRequestDto {
  locale: SupportedLocale;
  source: LocaleSwitchTrigger;
  currentRoutePath?: string;
  preserveRoute: boolean;
}

export interface LocaleSwitchResponseDto {
  status: LocaleSwitchStatus;
  preference: LocalePreferenceDto;
  options: readonly LocaleOptionContract[];
  preservedRoutePath?: string;
  message?: LocalizedText;
}

export interface UserLocalePreferenceDto {
  userId: number;
  preference: LocalePreferenceDto;
}

export interface HeaderNavigationI18nLayoutContract {
  locale: SupportedLocale;
  layoutMode: HeaderNavigationLayoutMode;
  overflowStrategy: HeaderNavigationOverflowStrategy;
  preservePrimaryNavigation: boolean;
  minActionTapTargetPx: number;
  maxPrimaryItemsBeforeOverflow?: number;
}

export interface HeaderNavigationItemContract {
  id: HeaderNavigationItemId;
  label: LocalizedText;
  routePath: string;
  region: HeaderNavigationRegion;
  priority: number;
  required: boolean;
  desktopVisible: boolean;
  mobileVisible: boolean;
  longLabelBehavior: HeaderNavigationOverflowStrategy;
}

export interface HeaderNavigationActionContract {
  id: HeaderNavigationActionId;
  label: LocalizedText;
  region: HeaderNavigationRegion;
  priority: number;
  badgeKind: HeaderNavigationBadgeKind;
  minTapTargetPx: number;
  desktopVisible: boolean;
  mobileVisible: boolean;
  preservesLocaleState: boolean;
}

export interface HeaderNavigationBreakpointContract {
  name: HeaderNavigationBreakpointName;
  minWidthPx: number;
  maxWidthPx?: number;
  layoutMode: HeaderNavigationLayoutMode;
  overflowStrategy: HeaderNavigationOverflowStrategy;
  primaryGapPx: number;
  actionGapPx: number;
  allowWrapping: boolean;
  languageSwitcherPlacement: LanguageSwitcherPlacement;
}

export interface HeaderNavigationContract {
  items: readonly HeaderNavigationItemContract[];
  actions: readonly HeaderNavigationActionContract[];
  breakpoints: readonly HeaderNavigationBreakpointContract[];
  localeLayouts: Record<SupportedLocale, HeaderNavigationI18nLayoutContract>;
}

export interface LanguageSwitcherContract {
  options: readonly LocaleOptionContract[];
  currentLocale: SupportedLocale;
  defaultLocale: SupportedLocale;
  fallbackLocale: SupportedLocale;
  storageKey: string;
  requestHeader: string;
  queryParam: string;
  preserveRouteOnSwitch: boolean;
  supportedPersistenceScopes: readonly LocalePersistenceScope[];
}

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function normalizeSupportedLocale(
  value: string | null | undefined,
  fallback: SupportedLocale = DEFAULT_LOCALE
): SupportedLocale {
  if (value === "zh-TW" || value === "zh-HK" || value === "zh-MO") return "zh-TW";
  if (value === "zh-CN" || value === "zh" || value === "zh-SG") return "zh-CN";
  if (value === "ms" || value === "ms-MY") return "ms";
  if (value === "en" || value === "en-US" || value === "en-GB") return "en";
  return fallback;
}

export const LANGUAGE_SWITCHER_OPTIONS = [
  {
    value: "zh-CN",
    label: {
      en: "Simplified Chinese",
      ms: "Bahasa Cina Ringkas",
      "zh-CN": "\u7b80\u4f53\u4e2d\u6587",
      "zh-TW": "\u7c21\u9ad4\u4e2d\u6587"
    },
    nativeLabel: "\u7b80\u4f53\u4e2d\u6587",
    shortLabel: "\u7b80",
    direction: "ltr",
    enabled: true,
    sortOrder: 1
  },
  {
    value: "zh-TW",
    label: {
      en: "Traditional Chinese",
      ms: "Bahasa Cina Tradisional",
      "zh-CN": "\u7e41\u4f53\u4e2d\u6587",
      "zh-TW": "\u7e41\u9ad4\u4e2d\u6587"
    },
    nativeLabel: "\u7e41\u9ad4\u4e2d\u6587",
    shortLabel: "\u7e41",
    direction: "ltr",
    enabled: true,
    sortOrder: 2
  },
  {
    value: "en",
    label: {
      en: "English",
      ms: "Bahasa Inggeris",
      "zh-CN": "\u82f1\u6587",
      "zh-TW": "\u82f1\u6587"
    },
    nativeLabel: "English",
    shortLabel: "EN",
    direction: "ltr",
    enabled: true,
    sortOrder: 3
  },
  {
    value: "ms",
    label: {
      en: "Malay",
      ms: "Bahasa Melayu",
      "zh-CN": "\u9a6c\u6765\u6587",
      "zh-TW": "\u99ac\u4f86\u6587"
    },
    nativeLabel: "Bahasa Melayu",
    shortLabel: "BM",
    direction: "ltr",
    enabled: true,
    sortOrder: 4
  }
] as const satisfies readonly LocaleOptionContract[];

export const LANGUAGE_SWITCHER_CONTRACT = {
  options: LANGUAGE_SWITCHER_OPTIONS,
  currentLocale: DEFAULT_LOCALE,
  defaultLocale: DEFAULT_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  storageKey: LOCALE_STORAGE_KEY,
  requestHeader: LOCALE_REQUEST_HEADER,
  queryParam: LOCALE_QUERY_PARAM,
  preserveRouteOnSwitch: true,
  supportedPersistenceScopes: ["device", "user-account"]
} as const satisfies LanguageSwitcherContract;

export const HEADER_I18N_LAYOUT_CONTRACT_BY_LOCALE = {
  en: {
    locale: "en",
    layoutMode: "compact",
    overflowStrategy: "compact-labels",
    preservePrimaryNavigation: true,
    minActionTapTargetPx: 44,
    maxPrimaryItemsBeforeOverflow: 6
  },
  ms: {
    locale: "ms",
    layoutMode: "compact",
    overflowStrategy: "compact-labels",
    preservePrimaryNavigation: true,
    minActionTapTargetPx: 44,
    maxPrimaryItemsBeforeOverflow: 6
  },
  "zh-CN": {
    locale: "zh-CN",
    layoutMode: "expanded",
    overflowStrategy: "wrap",
    preservePrimaryNavigation: true,
    minActionTapTargetPx: 44,
    maxPrimaryItemsBeforeOverflow: 6
  },
  "zh-TW": {
    locale: "zh-TW",
    layoutMode: "expanded",
    overflowStrategy: "wrap",
    preservePrimaryNavigation: true,
    minActionTapTargetPx: 44,
    maxPrimaryItemsBeforeOverflow: 6
  }
} as const satisfies Record<SupportedLocale, HeaderNavigationI18nLayoutContract>;

export const HEADER_NAVIGATION_ITEMS = [
  {
    id: "home",
    label: {
      en: "Home",
      ms: "Laman utama",
      "zh-CN": "\u9996\u9875",
      "zh-TW": "\u9996\u9801"
    },
    routePath: "/",
    region: "primary",
    priority: 10,
    required: true,
    desktopVisible: true,
    mobileVisible: true,
    longLabelBehavior: "wrap"
  },
  {
    id: "universities",
    label: {
      en: "Universities",
      ms: "Universiti",
      "zh-CN": "\u9662\u6821\u5e93",
      "zh-TW": "\u9662\u6821\u5eab"
    },
    routePath: "/universities",
    region: "primary",
    priority: 20,
    required: true,
    desktopVisible: true,
    mobileVisible: true,
    longLabelBehavior: "wrap"
  },
  {
    id: "programs",
    label: {
      en: "Programs",
      ms: "Program",
      "zh-CN": "\u4e13\u4e1a\u5e93",
      "zh-TW": "\u5c08\u696d\u5eab"
    },
    routePath: "/programs",
    region: "primary",
    priority: 30,
    required: true,
    desktopVisible: true,
    mobileVisible: true,
    longLabelBehavior: "wrap"
  },
  {
    id: "planner",
    label: {
      en: "Planner",
      ms: "Perancang",
      "zh-CN": "\u89c4\u5212",
      "zh-TW": "\u898f\u5283"
    },
    routePath: "/planner",
    region: "primary",
    priority: 40,
    required: true,
    desktopVisible: true,
    mobileVisible: true,
    longLabelBehavior: "wrap"
  },
  {
    id: "favorites",
    label: {
      en: "Favorites",
      ms: "Kegemaran",
      "zh-CN": "\u6536\u85cf",
      "zh-TW": "\u6536\u85cf"
    },
    routePath: "/favorites",
    region: "tool",
    priority: 50,
    required: true,
    desktopVisible: true,
    mobileVisible: true,
    longLabelBehavior: "compact-labels"
  },
  {
    id: "compare",
    label: {
      en: "Compare",
      ms: "Banding",
      "zh-CN": "\u5bf9\u6bd4",
      "zh-TW": "\u5c0d\u6bd4"
    },
    routePath: "/compare",
    region: "tool",
    priority: 60,
    required: true,
    desktopVisible: true,
    mobileVisible: true,
    longLabelBehavior: "compact-labels"
  },
  {
    id: "cost-calculator",
    label: {
      en: "Cost Calculator",
      ms: "Kalkulator kos",
      "zh-CN": "\u8d39\u7528\u4f30\u7b97",
      "zh-TW": "\u8cbb\u7528\u4f30\u7b97"
    },
    routePath: "/planner#cost",
    region: "tool",
    priority: 70,
    required: false,
    desktopVisible: true,
    mobileVisible: true,
    longLabelBehavior: "move-secondary-actions"
  },
  {
    id: "recommendations",
    label: {
      en: "Smart Recommendations",
      ms: "Cadangan pintar",
      "zh-CN": "\u667a\u80fd\u63a8\u8350",
      "zh-TW": "\u667a\u80fd\u63a8\u85a6"
    },
    routePath: "/planner#recommendations",
    region: "tool",
    priority: 80,
    required: false,
    desktopVisible: true,
    mobileVisible: true,
    longLabelBehavior: "move-secondary-actions"
  }
] as const satisfies readonly HeaderNavigationItemContract[];

export const HEADER_NAVIGATION_ACTIONS = [
  {
    id: "language-switcher",
    label: {
      en: "Language",
      ms: "Bahasa",
      "zh-CN": "\u8bed\u8a00",
      "zh-TW": "\u8a9e\u8a00"
    },
    region: "account",
    priority: 10,
    badgeKind: "none",
    minTapTargetPx: 44,
    desktopVisible: true,
    mobileVisible: true,
    preservesLocaleState: true
  },
  {
    id: "auth-entry",
    label: {
      en: "Sign in",
      ms: "Log masuk",
      "zh-CN": "\u767b\u5f55",
      "zh-TW": "\u767b\u5165"
    },
    region: "account",
    priority: 20,
    badgeKind: "none",
    minTapTargetPx: 44,
    desktopVisible: true,
    mobileVisible: true,
    preservesLocaleState: true
  },
  {
    id: "member-entry",
    label: {
      en: "Member Center",
      ms: "Pusat ahli",
      "zh-CN": "\u4f1a\u5458\u4e2d\u5fc3",
      "zh-TW": "\u6703\u54e1\u4e2d\u5fc3"
    },
    region: "account",
    priority: 30,
    badgeKind: "status",
    minTapTargetPx: 44,
    desktopVisible: true,
    mobileVisible: true,
    preservesLocaleState: true
  },
  {
    id: "favorites-indicator",
    label: {
      en: "Favorite count",
      ms: "Bilangan kegemaran",
      "zh-CN": "\u6536\u85cf\u6570\u91cf",
      "zh-TW": "\u6536\u85cf\u6578\u91cf"
    },
    region: "tool",
    priority: 40,
    badgeKind: "count",
    minTapTargetPx: 44,
    desktopVisible: true,
    mobileVisible: true,
    preservesLocaleState: true
  },
  {
    id: "compare-indicator",
    label: {
      en: "Compare count",
      ms: "Bilangan bandingan",
      "zh-CN": "\u5bf9\u6bd4\u6570\u91cf",
      "zh-TW": "\u5c0d\u6bd4\u6578\u91cf"
    },
    region: "tool",
    priority: 50,
    badgeKind: "count",
    minTapTargetPx: 44,
    desktopVisible: true,
    mobileVisible: true,
    preservesLocaleState: true
  },
  {
    id: "mobile-menu-toggle",
    label: {
      en: "Menu",
      ms: "Menu",
      "zh-CN": "\u83dc\u5355",
      "zh-TW": "\u9078\u55ae"
    },
    region: "mobile",
    priority: 60,
    badgeKind: "none",
    minTapTargetPx: 44,
    desktopVisible: false,
    mobileVisible: true,
    preservesLocaleState: true
  }
] as const satisfies readonly HeaderNavigationActionContract[];

export const HEADER_NAVIGATION_BREAKPOINTS = [
  {
    name: "desktop",
    minWidthPx: 1180,
    layoutMode: "expanded",
    overflowStrategy: "wrap",
    primaryGapPx: 24,
    actionGapPx: 12,
    allowWrapping: false,
    languageSwitcherPlacement: "header-actions"
  },
  {
    name: "laptop",
    minWidthPx: 900,
    maxWidthPx: 1179,
    layoutMode: "compact",
    overflowStrategy: "compact-labels",
    primaryGapPx: 18,
    actionGapPx: 10,
    allowWrapping: true,
    languageSwitcherPlacement: "header-actions"
  },
  {
    name: "tablet",
    minWidthPx: 760,
    maxWidthPx: 899,
    layoutMode: "wrapped",
    overflowStrategy: "move-secondary-actions",
    primaryGapPx: 14,
    actionGapPx: 8,
    allowWrapping: true,
    languageSwitcherPlacement: "header-actions"
  },
  {
    name: "mobile",
    minWidthPx: 0,
    maxWidthPx: 759,
    layoutMode: "drawer",
    overflowStrategy: "drawer",
    primaryGapPx: 12,
    actionGapPx: 8,
    allowWrapping: false,
    languageSwitcherPlacement: "mobile-drawer"
  }
] as const satisfies readonly HeaderNavigationBreakpointContract[];

export const HEADER_NAVIGATION_CONTRACT = {
  items: HEADER_NAVIGATION_ITEMS,
  actions: HEADER_NAVIGATION_ACTIONS,
  breakpoints: HEADER_NAVIGATION_BREAKPOINTS,
  localeLayouts: HEADER_I18N_LAYOUT_CONTRACT_BY_LOCALE
} as const satisfies HeaderNavigationContract;
