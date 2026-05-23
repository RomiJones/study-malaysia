import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { LocalizedStringArray, LocalizedText, SupportedLocale } from "@studymy/shared";
import { toTraditionalText } from "../i18n/localeTransforms";

export function useLocaleText() {
  const { locale } = useI18n();

  const currentLocale = computed(() => locale.value as SupportedLocale);

  function text(value: LocalizedText) {
    if (currentLocale.value === "zh-TW") {
      return toTraditionalText(value["zh-TW"] || value["zh-CN"] || value.en);
    }
    return value[currentLocale.value] || value.en || value["zh-CN"];
  }

  function array(value: LocalizedStringArray) {
    if (currentLocale.value === "zh-TW") {
      const items = value["zh-TW"]?.length ? value["zh-TW"] : value["zh-CN"];
      return (items || value.en || []).map(toTraditionalText);
    }
    return value[currentLocale.value] || value.en || value["zh-CN"];
  }

  return {
    currentLocale,
    text,
    array
  };
}
