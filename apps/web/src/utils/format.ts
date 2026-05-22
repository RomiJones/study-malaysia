import type { LocalizedStringArray, LocalizedText, SupportedLocale } from "@studymy/shared";

export function pickLocaleText(value: LocalizedText, locale: SupportedLocale): string {
  return value[locale] || value.en || value["zh-CN"];
}

export function pickLocaleArray(value: LocalizedStringArray, locale: SupportedLocale): string[] {
  return value[locale] || value.en || value["zh-CN"];
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
