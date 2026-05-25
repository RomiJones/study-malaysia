import type { LocalizedText, SupportedLocale } from "@studymy/shared";

export const I18N_SUPPORTED_LOCALES = ["en", "ms", "zh-CN", "zh-TW"] as const satisfies readonly SupportedLocale[];
export const I18N_DEFAULT_LOCALE: SupportedLocale = "zh-CN";
export const I18N_FALLBACK_LOCALE: SupportedLocale = "en";
export const I18N_LOCALE_STORAGE_KEY = "studymy_locale";
export const I18N_LOCALE_REQUEST_HEADER = "x-studymy-locale";
export const I18N_LOCALE_QUERY_PARAM = "locale";

export type LocaleTextDirection = "ltr";
export type LocalePreferenceSource = "default" | "browser" | "local-storage" | "query-param" | "user-account";
export type LocalePersistenceScope = "device" | "user-account";
export type LocaleSwitchTrigger = "header" | "mobile-menu" | "account-settings" | "system";
export type LocaleSwitchStatus = "accepted" | "fallback-applied" | "unsupported-locale";
export type HeaderNavigationLayoutMode = "expanded" | "wrapped" | "compact" | "drawer";
export type HeaderNavigationOverflowStrategy = "wrap" | "compact-labels" | "move-secondary-actions" | "drawer";
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
export type HeaderNavigationBreakpointName = "desktop" | "laptop" | "tablet" | "mobile";
export type LanguageSwitcherPlacement = "header-actions" | "mobile-drawer" | "account-settings";

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

export interface LocaleSwitchResponseDto {
  status: LocaleSwitchStatus;
  preference: LocalePreferenceDto;
  options: readonly LocaleOptionContract[];
  preservedRoutePath?: string;
  message?: LocalizedText;
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

export const I18N_LANGUAGE_SWITCHER_OPTIONS = [
  {
    value: "zh-CN",
    label: {
      en: "Simplified Chinese",
      ms: "Bahasa Cina Ringkas",
      "zh-CN": "简体中文",
      "zh-TW": "簡體中文"
    },
    nativeLabel: "简体中文",
    shortLabel: "简",
    direction: "ltr",
    enabled: true,
    sortOrder: 1
  },
  {
    value: "zh-TW",
    label: {
      en: "Traditional Chinese",
      ms: "Bahasa Cina Tradisional",
      "zh-CN": "繁体中文",
      "zh-TW": "繁體中文"
    },
    nativeLabel: "繁體中文",
    shortLabel: "繁",
    direction: "ltr",
    enabled: true,
    sortOrder: 2
  },
  {
    value: "en",
    label: {
      en: "English",
      ms: "Bahasa Inggeris",
      "zh-CN": "英文",
      "zh-TW": "英文"
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
      "zh-CN": "马来文",
      "zh-TW": "馬來文"
    },
    nativeLabel: "Bahasa Melayu",
    shortLabel: "BM",
    direction: "ltr",
    enabled: true,
    sortOrder: 4
  }
] as const satisfies readonly LocaleOptionContract[];

export const I18N_LANGUAGE_SWITCHER_CONTRACT = {
  options: I18N_LANGUAGE_SWITCHER_OPTIONS,
  currentLocale: I18N_DEFAULT_LOCALE,
  defaultLocale: I18N_DEFAULT_LOCALE,
  fallbackLocale: I18N_FALLBACK_LOCALE,
  storageKey: I18N_LOCALE_STORAGE_KEY,
  requestHeader: I18N_LOCALE_REQUEST_HEADER,
  queryParam: I18N_LOCALE_QUERY_PARAM,
  preserveRouteOnSwitch: true,
  supportedPersistenceScopes: ["device", "user-account"]
} as const satisfies LanguageSwitcherContract;

export const I18N_HEADER_LAYOUTS = {
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

export const I18N_HEADER_NAVIGATION_CONTRACT = {
  items: [
    {
      id: "home",
      label: { en: "Home", ms: "Laman utama", "zh-CN": "首页", "zh-TW": "首頁" },
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
      label: { en: "Universities", ms: "Universiti", "zh-CN": "院校库", "zh-TW": "院校庫" },
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
      label: { en: "Programs", ms: "Program", "zh-CN": "专业库", "zh-TW": "專業庫" },
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
      label: { en: "Planner", ms: "Perancang", "zh-CN": "规划", "zh-TW": "規劃" },
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
      label: { en: "Favorites", ms: "Kegemaran", "zh-CN": "收藏", "zh-TW": "收藏" },
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
      label: { en: "Compare", ms: "Banding", "zh-CN": "对比", "zh-TW": "對比" },
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
      label: { en: "Cost Calculator", ms: "Kalkulator kos", "zh-CN": "费用估算", "zh-TW": "費用估算" },
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
      label: { en: "Smart Recommendations", ms: "Cadangan pintar", "zh-CN": "智能推荐", "zh-TW": "智能推薦" },
      routePath: "/planner#recommendations",
      region: "tool",
      priority: 80,
      required: false,
      desktopVisible: true,
      mobileVisible: true,
      longLabelBehavior: "move-secondary-actions"
    }
  ],
  actions: [
    {
      id: "language-switcher",
      label: { en: "Language", ms: "Bahasa", "zh-CN": "语言", "zh-TW": "語言" },
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
      label: { en: "Sign in", ms: "Log masuk", "zh-CN": "登录", "zh-TW": "登入" },
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
      label: { en: "Member Center", ms: "Pusat ahli", "zh-CN": "会员中心", "zh-TW": "會員中心" },
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
      label: { en: "Favorite count", ms: "Bilangan kegemaran", "zh-CN": "收藏数量", "zh-TW": "收藏數量" },
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
      label: { en: "Compare count", ms: "Bilangan bandingan", "zh-CN": "对比数量", "zh-TW": "對比數量" },
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
      label: { en: "Menu", ms: "Menu", "zh-CN": "菜单", "zh-TW": "選單" },
      region: "mobile",
      priority: 60,
      badgeKind: "none",
      minTapTargetPx: 44,
      desktopVisible: false,
      mobileVisible: true,
      preservesLocaleState: true
    }
  ],
  breakpoints: [
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
  ],
  localeLayouts: I18N_HEADER_LAYOUTS
} as const satisfies HeaderNavigationContract;
