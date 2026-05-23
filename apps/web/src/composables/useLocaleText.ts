import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { LocalizedStringArray, LocalizedText, SupportedLocale } from "@studymy/shared";
import { officialPageFallback, pickLocaleArray, pickLocaleText } from "../utils/format";

export function useLocaleText() {
  const { locale } = useI18n();

  const currentLocale = computed(() => locale.value as SupportedLocale);

  function text(value: LocalizedText) {
    return pickLocaleText(value, currentLocale.value) || officialPageFallback(currentLocale.value);
  }

  function array(value: LocalizedStringArray) {
    return pickLocaleArray(value, currentLocale.value);
  }

  return {
    currentLocale,
    text,
    array
  };
}
