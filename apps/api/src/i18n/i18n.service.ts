import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { LocalizedText, SupportedLocale } from "@studymy/shared";
import {
  I18N_DEFAULT_LOCALE,
  I18N_FALLBACK_LOCALE,
  I18N_HEADER_NAVIGATION_CONTRACT,
  I18N_LANGUAGE_SWITCHER_CONTRACT,
  I18N_LANGUAGE_SWITCHER_OPTIONS,
  I18N_LOCALE_QUERY_PARAM,
  I18N_LOCALE_REQUEST_HEADER,
  I18N_LOCALE_STORAGE_KEY,
  I18N_SUPPORTED_LOCALES,
  type LocalePersistenceScope,
  type LocalePreferenceDto,
  type LocalePreferenceSource,
  type LocaleSwitchResponseDto,
  type LocaleSwitchStatus,
  type LocaleSwitchTrigger
} from "./i18n.contracts.js";
import { UserEntity } from "../db/entities.js";

export interface LocaleSwitchInput {
  locale?: unknown;
  source?: unknown;
  currentRoutePath?: unknown;
  preserveRoute?: unknown;
}

const LOCALE_ALIASES: Record<string, SupportedLocale> = {
  en: "en",
  "en-US": "en",
  "en-GB": "en",
  ms: "ms",
  "ms-MY": "ms",
  zh: "zh-CN",
  "zh-CN": "zh-CN",
  "zh-SG": "zh-CN",
  "zh-TW": "zh-TW",
  "zh-HK": "zh-TW",
  "zh-MO": "zh-TW"
};

const SWITCH_TRIGGERS = new Set<LocaleSwitchTrigger>([
  "header",
  "mobile-menu",
  "account-settings",
  "system"
]);

const ERROR_MESSAGES = {
  missingLocale: {
    en: "Locale is required.",
    ms: "Bahasa diperlukan.",
    "zh-CN": "必须提供语言代码。",
    "zh-TW": "必須提供語言代碼。"
  },
  unsupportedLocale: {
    en: "Unsupported locale. Choose zh-CN, zh-TW, en, or ms.",
    ms: "Bahasa tidak disokong. Pilih zh-CN, zh-TW, en atau ms.",
    "zh-CN": "不支持的语言，请选择 zh-CN、zh-TW、en 或 ms。",
    "zh-TW": "不支援的語言，請選擇 zh-CN、zh-TW、en 或 ms。"
  },
  invalidSource: {
    en: "Unsupported locale switch source.",
    ms: "Sumber pertukaran bahasa tidak disokong.",
    "zh-CN": "不支持的语言切换来源。",
    "zh-TW": "不支援的語言切換來源。"
  },
  invalidRoute: {
    en: "Route path must be a safe relative path.",
    ms: "Laluan mesti laluan relatif yang selamat.",
    "zh-CN": "路由路径必须是安全的相对路径。",
    "zh-TW": "路由路徑必須是安全的相對路徑。"
  },
  invalidPayload: {
    en: "Invalid locale switch payload.",
    ms: "Payload pertukaran bahasa tidak sah.",
    "zh-CN": "语言切换请求参数无效。",
    "zh-TW": "語言切換請求參數無效。"
  },
  userNotFound: {
    en: "User not found.",
    ms: "Pengguna tidak ditemui.",
    "zh-CN": "用户不存在。",
    "zh-TW": "使用者不存在。"
  }
} as const satisfies Record<string, LocalizedText>;

const SWITCH_MESSAGES = {
  accepted: {
    en: "Language preference updated.",
    ms: "Keutamaan bahasa telah dikemas kini.",
    "zh-CN": "语言偏好已更新。",
    "zh-TW": "語言偏好已更新。"
  },
  "fallback-applied": {
    en: "Language preference updated with the closest supported locale.",
    ms: "Keutamaan bahasa dikemas kini kepada bahasa disokong yang paling hampir.",
    "zh-CN": "已使用最接近的受支持语言更新偏好。",
    "zh-TW": "已使用最接近的支援語言更新偏好。"
  },
  "unsupported-locale": ERROR_MESSAGES.unsupportedLocale
} as const satisfies Record<LocaleSwitchStatus, LocalizedText>;

@Injectable()
export class I18nService {
  constructor(@InjectRepository(UserEntity) private readonly usersRepository: Repository<UserEntity>) {}

  getOptions(requestedLocale?: unknown) {
    const resolved = this.resolveOptionalLocale(requestedLocale);
    return {
      switcher: {
        ...I18N_LANGUAGE_SWITCHER_CONTRACT,
        currentLocale: resolved.locale
      },
      preference: this.buildPreference({
        locale: resolved.locale,
        source: resolved.source,
        scope: "device",
        persisted: false
      }),
      navigation: I18N_HEADER_NAVIGATION_CONTRACT,
      request: {
        header: I18N_LOCALE_REQUEST_HEADER,
        queryParam: I18N_LOCALE_QUERY_PARAM,
        storageKey: I18N_LOCALE_STORAGE_KEY
      }
    };
  }

  switchLocale(input: LocaleSwitchInput): LocaleSwitchResponseDto {
    const source = this.resolveSwitchSource(input.source, "header");
    const resolved = this.resolveRequiredLocale(input.locale);
    const preserveRoute = this.resolvePreserveRoute(input.preserveRoute);
    const preservedRoutePath = preserveRoute ? this.resolveRoutePath(input.currentRoutePath) : undefined;

    return this.buildSwitchResponse({
      locale: resolved.locale,
      status: resolved.status,
      source: resolved.status === "fallback-applied" ? "browser" : "local-storage",
      scope: "device",
      persisted: false,
      preservedRoutePath,
      switchSource: source
    });
  }

  async getUserPreference(userId: number): Promise<LocalePreferenceDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw this.localizedError("USER_NOT_FOUND", ERROR_MESSAGES.userNotFound);
    }

    const resolved = this.resolveOptionalLocale(user.preferredLocale);
    const persisted = user.localePreferenceSource === "user-account";
    return this.buildPreference({
      locale: resolved.locale,
      source: persisted ? "user-account" : user.localePreferenceSource || "default",
      scope: "user-account",
      persisted,
      updatedAt: this.formatDate(user.localePreferenceUpdatedAt)
    });
  }

  async saveUserPreference(userId: number, input: LocaleSwitchInput): Promise<LocaleSwitchResponseDto> {
    const source = this.resolveSwitchSource(input.source, "account-settings");
    const resolved = this.resolveRequiredLocale(input.locale);
    const preserveRoute = this.resolvePreserveRoute(input.preserveRoute);
    const preservedRoutePath = preserveRoute ? this.resolveRoutePath(input.currentRoutePath) : undefined;
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw this.localizedError("USER_NOT_FOUND", ERROR_MESSAGES.userNotFound);
    }

    user.preferredLocale = resolved.locale;
    user.localePreferenceSource = "user-account";
    user.localePreferenceUpdatedAt = new Date();
    const saved = await this.usersRepository.save(user);

    return this.buildSwitchResponse({
      locale: saved.preferredLocale,
      status: resolved.status,
      source: "user-account",
      scope: "user-account",
      persisted: true,
      updatedAt: this.formatDate(saved.localePreferenceUpdatedAt),
      preservedRoutePath,
      switchSource: source
    });
  }

  private buildSwitchResponse(input: {
    locale: SupportedLocale;
    status: LocaleSwitchStatus;
    source: LocalePreferenceSource;
    scope: LocalePersistenceScope;
    persisted: boolean;
    updatedAt?: string | null;
    preservedRoutePath?: string;
    switchSource: LocaleSwitchTrigger;
  }): LocaleSwitchResponseDto & { switchSource: LocaleSwitchTrigger } {
    return {
      status: input.status,
      preference: this.buildPreference(input),
      options: I18N_LANGUAGE_SWITCHER_OPTIONS,
      preservedRoutePath: input.preservedRoutePath,
      message: SWITCH_MESSAGES[input.status],
      switchSource: input.switchSource
    };
  }

  private buildPreference(input: {
    locale: SupportedLocale;
    source: LocalePreferenceSource;
    scope: LocalePersistenceScope;
    persisted: boolean;
    updatedAt?: string | null;
  }): LocalePreferenceDto {
    return {
      locale: input.locale,
      fallbackLocale: I18N_FALLBACK_LOCALE,
      source: input.source,
      persistenceScope: input.scope,
      persisted: input.persisted,
      updatedAt: input.updatedAt ?? null
    };
  }

  private resolveOptionalLocale(value: unknown): {
    locale: SupportedLocale;
    source: LocalePreferenceSource;
    status: LocaleSwitchStatus;
  } {
    if (value == null || value === "") {
      return { locale: I18N_DEFAULT_LOCALE, source: "default", status: "accepted" };
    }

    const resolved = this.resolveLocale(value);
    return {
      ...resolved,
      source: resolved.status === "fallback-applied" ? "browser" : "query-param"
    };
  }

  private resolveRequiredLocale(value: unknown): { locale: SupportedLocale; status: LocaleSwitchStatus } {
    if (value == null || value === "") {
      throw this.localizedError("MISSING_LOCALE", ERROR_MESSAGES.missingLocale);
    }
    return this.resolveLocale(value);
  }

  private resolveLocale(value: unknown): { locale: SupportedLocale; status: LocaleSwitchStatus } {
    if (typeof value !== "string") {
      throw this.localizedError("INVALID_PAYLOAD", ERROR_MESSAGES.invalidPayload, { field: "locale" });
    }

    const requested = value.trim();
    const locale = LOCALE_ALIASES[requested];
    if (!locale) {
      throw this.localizedError("UNSUPPORTED_LOCALE", ERROR_MESSAGES.unsupportedLocale, {
        requestedLocale: requested,
        supportedLocales: [...I18N_SUPPORTED_LOCALES]
      });
    }

    return {
      locale,
      status: locale === requested ? "accepted" : "fallback-applied"
    };
  }

  private resolveSwitchSource(value: unknown, fallback: LocaleSwitchTrigger): LocaleSwitchTrigger {
    if (value == null || value === "") return fallback;
    if (typeof value !== "string") {
      throw this.localizedError("INVALID_PAYLOAD", ERROR_MESSAGES.invalidPayload, { field: "source" });
    }

    const source = value.trim() as LocaleSwitchTrigger;
    if (!SWITCH_TRIGGERS.has(source)) {
      throw this.localizedError("INVALID_SOURCE", ERROR_MESSAGES.invalidSource, {
        supportedSources: [...SWITCH_TRIGGERS]
      });
    }
    return source;
  }

  private resolvePreserveRoute(value: unknown): boolean {
    if (value == null || value === "") return true;
    if (typeof value !== "boolean") {
      throw this.localizedError("INVALID_PAYLOAD", ERROR_MESSAGES.invalidPayload, { field: "preserveRoute" });
    }
    return value;
  }

  private resolveRoutePath(value: unknown): string | undefined {
    if (value == null || value === "") return undefined;
    if (typeof value !== "string") {
      throw this.localizedError("INVALID_PAYLOAD", ERROR_MESSAGES.invalidPayload, { field: "currentRoutePath" });
    }

    const routePath = value.trim();
    const isSafe =
      routePath.startsWith("/") &&
      !routePath.startsWith("//") &&
      routePath.length <= 300 &&
      !/[\r\n]/.test(routePath);

    if (!isSafe) {
      throw this.localizedError("INVALID_ROUTE_PATH", ERROR_MESSAGES.invalidRoute);
    }

    return routePath;
  }

  private localizedError(code: string, message: LocalizedText, details: Record<string, unknown> = {}) {
    const status = code === "USER_NOT_FOUND" ? "not-found" : "bad-request";
    const errorPayload = {
      code,
      message,
      details
    };
    return status === "not-found" ? new NotFoundException(errorPayload) : new BadRequestException(errorPayload);
  }

  private formatDate(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
}
