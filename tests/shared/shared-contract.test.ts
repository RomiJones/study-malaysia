import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_LABELS,
  CORE_PROGRAM_CATEGORIES,
  DEFAULT_PROGRAM_CATEGORY_OPTIONS,
  FEE_AUDIT_STATUS_LABELS,
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
  });
});
