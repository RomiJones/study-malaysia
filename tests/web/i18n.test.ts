import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { SupportedLocale } from "@studymy/shared";
import { SUPPORTED_LOCALES } from "@studymy/shared";
import { messages } from "../../apps/web/src/i18n/messages.ts";
import { runtimeText } from "../../apps/web/src/i18n/runtimeText.ts";

const originalLocalStorage = globalThis.localStorage;

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

before(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true
  });
});

after(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: originalLocalStorage,
    configurable: true
  });
});

describe("web i18n message contracts", () => {
  test("keeps the same message key structure across four locales", () => {
    const baseline = collectLeafPaths(messages.en);
    for (const locale of SUPPORTED_LOCALES) {
      assert.deepEqual(collectLeafPaths(messages[locale]), baseline, `${locale} message keys must match English baseline`);
    }
  });

  test("resolves runtime store messages from the active locale", () => {
    const expected: Record<SupportedLocale, string> = {
      en: messages.en.sync.catalogLoaded,
      ms: messages.ms.sync.catalogLoaded,
      "zh-CN": messages["zh-CN"].sync.catalogLoaded,
      "zh-TW": messages["zh-TW"].sync.catalogLoaded
    };

    for (const locale of SUPPORTED_LOCALES) {
      localStorage.setItem("studymy_locale", locale);
      assert.equal(runtimeText("catalogLoaded"), expected[locale]);
    }
  });
});

function collectLeafPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [prefix];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => collectLeafPaths(item, prefix ? `${prefix}.${key}` : key))
      .sort();
  }
  return [prefix];
}
