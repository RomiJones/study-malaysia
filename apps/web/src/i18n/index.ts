import { createI18n } from "vue-i18n";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@studymy/shared";
import { messages } from "./messages";

const DEFAULT_LOCALE: SupportedLocale = "zh-CN";

function isSupportedLocale(value: string | null): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

function readInitialLocale(): SupportedLocale {
  const storedLocale = localStorage.getItem("studymy_locale");
  return isSupportedLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE;
}

const locale = readInitialLocale();
document.documentElement.lang = locale;

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: "en",
  messages
});
