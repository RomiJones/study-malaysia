import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { LocalizedStringArray, LocalizedText, SupportedLocale } from "@studymy/shared";

export function useLocaleText() {
  const { locale } = useI18n();

  const currentLocale = computed(() => locale.value as SupportedLocale);

  function text(value: LocalizedText) {
    return value[currentLocale.value] || value.en || value["zh-CN"];
  }

  function array(value: LocalizedStringArray) {
    return value[currentLocale.value] || value.en || value["zh-CN"];
  }

  return {
    currentLocale,
    text,
    array
  };
}
