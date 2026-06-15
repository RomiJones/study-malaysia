import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_LABELS,
  CORE_PROGRAM_CATEGORIES,
  DEFAULT_PROGRAM_CATEGORY_OPTIONS,
  FEE_AUDIT_STATUS_LABELS,
  HEADER_NAVIGATION_CONTRACT,
  LANGUAGE_SWITCHER_CONTRACT,
  OFFICIAL_SOURCE_STATUS_LABELS,
  PUBLIC_DISPLAY_STATUS_LABELS,
  SUPPORTED_LOCALES
} from "../../packages/shared/src/index.ts";

describe("shared catalog contracts", () => {
  test("keeps the required locale order and localized category labels", () => {
    assert.deepEqual(SUPPORTED_LOCALES, ["en", "ms", "zh-CN", "zh-TW"]);

    for (const category of CORE_PROGRAM_CATEGORIES) {
      assert.equal(typeof CATEGORY_LABELS[category].en, "string");
      assert.equal(typeof CATEGORY_LABELS[category].ms, "string");
      assert.equal(typeof CATEGORY_LABELS[category]["zh-CN"], "string");
      assert.equal(typeof CATEGORY_LABELS[category]["zh-TW"], "string");
    }
  });

  test("exposes public category options in the same order as core categories", () => {
    assert.deepEqual(DEFAULT_PROGRAM_CATEGORY_OPTIONS.map((item) => item.code), [...CORE_PROGRAM_CATEGORIES]);
    assert.equal(DEFAULT_PROGRAM_CATEGORY_OPTIONS.every((item) => item.enabled && item.visibleOnPublic), true);
    assert.deepEqual(DEFAULT_PROGRAM_CATEGORY_OPTIONS.map((item) => item.sortOrder), [1, 2, 3, 4, 5, 6, 7]);
  });

  test("keeps Chinese labels for public status and audit status values", () => {
    assert.equal(PUBLIC_DISPLAY_STATUS_LABELS.ready["zh-CN"], "可公开展示");
    assert.equal(OFFICIAL_SOURCE_STATUS_LABELS["missing-source"]["zh-CN"], "缺少官方来源");
    assert.equal(FEE_AUDIT_STATUS_LABELS["matched-official"]["zh-CN"], "与官方来源一致");
    assert.equal(FEE_AUDIT_STATUS_LABELS["official-rate-verified"]["zh-CN"], "官方费率已核验");
    assert.equal(FEE_AUDIT_STATUS_LABELS["calculated-from-official-rate"]["zh-CN"], "按官方费率与学制计算");
  });

  test("exposes the language switcher contract for every supported locale", () => {
    assert.equal(LANGUAGE_SWITCHER_CONTRACT.defaultLocale, "zh-CN");
    assert.equal(LANGUAGE_SWITCHER_CONTRACT.fallbackLocale, "en");
    assert.equal(LANGUAGE_SWITCHER_CONTRACT.preserveRouteOnSwitch, true);
    assert.deepEqual([...LANGUAGE_SWITCHER_CONTRACT.supportedPersistenceScopes], ["device", "user-account"]);
    assert.deepEqual(
      [...LANGUAGE_SWITCHER_CONTRACT.options].map((option) => option.value).sort(),
      [...SUPPORTED_LOCALES].sort()
    );

    for (const option of LANGUAGE_SWITCHER_CONTRACT.options) {
      assert.equal(option.enabled, true);
      assert.equal(option.direction, "ltr");
      assert.equal(typeof option.nativeLabel, "string");
      assert.equal(typeof option.shortLabel, "string");

      for (const locale of SUPPORTED_LOCALES) {
        assert.equal(typeof option.label[locale], "string");
        assert.notEqual(option.label[locale].trim(), "");
      }
    }
  });

  test("exposes header navigation labels and layouts for every supported locale", () => {
    assert.deepEqual(Object.keys(HEADER_NAVIGATION_CONTRACT.localeLayouts).sort(), [...SUPPORTED_LOCALES].sort());
    assert.equal(HEADER_NAVIGATION_CONTRACT.items.length > 0, true);
    assert.equal(HEADER_NAVIGATION_CONTRACT.actions.length > 0, true);
    assert.deepEqual(
      HEADER_NAVIGATION_CONTRACT.breakpoints.map((breakpoint) => breakpoint.name),
      ["desktop", "laptop", "tablet", "mobile"]
    );

    for (const locale of SUPPORTED_LOCALES) {
      assert.equal(HEADER_NAVIGATION_CONTRACT.localeLayouts[locale].locale, locale);
      assert.equal(HEADER_NAVIGATION_CONTRACT.localeLayouts[locale].preservePrimaryNavigation, true);
      assert.equal(HEADER_NAVIGATION_CONTRACT.localeLayouts[locale].minActionTapTargetPx >= 44, true);
    }

    for (const item of HEADER_NAVIGATION_CONTRACT.items) {
      assert.equal(item.routePath.startsWith("/"), true);

      for (const locale of SUPPORTED_LOCALES) {
        assert.equal(typeof item.label[locale], "string");
        assert.notEqual(item.label[locale].trim(), "");
      }
    }

    for (const action of HEADER_NAVIGATION_CONTRACT.actions) {
      assert.equal(action.minTapTargetPx >= 44, true);
      assert.equal(action.preservesLocaleState, true);

      for (const locale of SUPPORTED_LOCALES) {
        assert.equal(typeof action.label[locale], "string");
        assert.notEqual(action.label[locale].trim(), "");
      }
    }
  });
});
