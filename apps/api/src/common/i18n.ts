import type { LocalizedStringArray, LocalizedText, SupportedLocale } from "@studymy/shared";

export function normalizeLocale(locale?: string): SupportedLocale {
  if (locale === "zh-TW" || locale === "zh-HK") return "zh-TW";
  if (locale === "ms" || locale === "ms-MY") return "ms";
  if (locale === "en" || locale === "en-US") return "en";
  return "zh-CN";
}

export function translateText(value: LocalizedText, locale?: string): string {
  const normalized = normalizeLocale(locale);
  return value[normalized] || value["en"] || value["zh-CN"];
}

export function translateArray(value: LocalizedStringArray, locale?: string): string[] {
  const normalized = normalizeLocale(locale);
  return value[normalized] || value["en"] || value["zh-CN"];
}
