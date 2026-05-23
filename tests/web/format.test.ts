import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_PAGE_FALLBACK,
  cleanDisplayText,
  formatOfficialSourceStatus,
  formatProgramIntake,
  formatProgramLanguage,
  formatProgramTuition
} from "../../apps/web/src/utils/format.ts";

function program(overrides: Record<string, unknown> = {}) {
  return {
    publicDisplayStatus: "ready",
    durationOfficial: "",
    durationYears: 2,
    tuitionAmount: null,
    tuitionCurrency: "CNY",
    tuitionDisplay: "",
    officialTuitionMYR: null,
    officialFeeSourceUrl: "",
    officialFeeAuditStatus: "pending-review",
    intakeMonths: [],
    officialIntake: "",
    languageRequirement: { ielts: null },
    officialLanguageRequirement: "",
    tuitionInfo: {
      amount: null,
      currency: "UNKNOWN",
      displayText: "",
      officialAmountMYR: null,
      sourceUrl: null,
      auditStatus: "pending-review"
    },
    listTuitionText: "",
    ...overrides
  } as any;
}

describe("web display format helpers", () => {
  test("filters invalid field values before rendering", () => {
    assert.equal(cleanDisplayText("undefined", "fallback"), "fallback");
    assert.equal(cleanDisplayText("[]", "fallback"), "fallback");
    assert.equal(cleanDisplayText("[object Object]", "fallback"), "fallback");
  });

  test("uses official MYR tuition and avoids generated CNY fallback without source evidence", () => {
    assert.equal(formatProgramTuition(program({ officialTuitionMYR: 62000 })), "RM 62,000");
    assert.equal(formatProgramTuition(program({ tuitionDisplay: "CNY 45,000 / year" })), OFFICIAL_PAGE_FALLBACK);
  });

  test("falls back for missing intake and language fields without undefined text", () => {
    assert.equal(formatProgramIntake(program()), OFFICIAL_PAGE_FALLBACK);
    assert.equal(formatProgramLanguage(program()), OFFICIAL_PAGE_FALLBACK);
    assert.equal(formatProgramLanguage(program({ officialLanguageRequirement: "IELTS (Academic) Band 6.0" })), "IELTS 6.0+");
  });

  test("formats official source status labels for public pages", () => {
    assert.equal(formatOfficialSourceStatus("official-verified"), "官方来源已核验");
    assert.equal(formatOfficialSourceStatus("missing-source"), "缺少官方来源");
    assert.equal(formatOfficialSourceStatus(null), "待官方确认");
  });
});
