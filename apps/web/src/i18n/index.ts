import { createI18n } from "vue-i18n";
import { messages } from "./messages";

const locale = (localStorage.getItem("studymy_locale") || "zh-CN") as keyof typeof messages;

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: "en",
  messages
});
