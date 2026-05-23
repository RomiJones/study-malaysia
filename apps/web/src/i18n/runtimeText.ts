import type { SupportedLocale } from "@studymy/shared";
import { messages } from "./messages";

const runtimeMessages = {
  en: messages.en.sync,
  ms: messages.ms.sync,
  "zh-CN": messages["zh-CN"].sync,
  "zh-TW": messages["zh-TW"].sync
} satisfies Record<SupportedLocale, typeof messages.en.sync>;

export type RuntimeMessageKey = keyof typeof messages.en.sync;

export function runtimeText(key: RuntimeMessageKey): string {
  return runtimeMessages[currentLocale()][key];
}

function currentLocale(): SupportedLocale {
  try {
    const locale = localStorage.getItem("studymy_locale") as SupportedLocale | null;
    return locale && locale in runtimeMessages ? locale : "zh-CN";
  } catch {
    return "zh-CN";
  }
}
