import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_PAGE_FALLBACK,
  cleanDisplayText,
  formatCategoryLabel,
  formatOfficialSourceStatus,
  formatProgramIntake,
  formatProgramLanguage,
  formatProgramTuition,
  pickLocaleArray,
  pickLocaleText
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

  test("localizes raw backend category values without dynamic i18n keys", () => {
    assert.equal(formatCategoryLabel("Clinical Medicine", "zh-CN"), "临床医学");
    assert.equal(formatCategoryLabel("Clinical Medicine", "zh-TW"), "臨床醫學");
    assert.equal(formatCategoryLabel("Education", "ms"), "Pendidikan");
    assert.equal(formatCategoryLabel("Arts and Social Sciences", "en"), "Arts and Social Sciences");
    assert.equal(formatCategoryLabel("Arts and Social Sciences", "zh-CN"), "文学与社会科学");
  });

  test("prevents Chinese dynamic text on English and Malay pages", () => {
    const localizedText = {
      en: "申请要求以官方页面为准",
      ms: "Permohonan bergantung pada halaman rasmi",
      "zh-CN": "申请要求以官方页面为准",
      "zh-TW": "申請要求以官方頁面為準"
    };
    assert.equal(pickLocaleText(localizedText, "en"), "");
    assert.equal(pickLocaleText(localizedText, "ms"), "Permohonan bergantung pada halaman rasmi");
    assert.deepEqual(pickLocaleArray({
      en: ["临床训练"],
      ms: ["Latihan klinikal"],
      "zh-CN": ["临床训练"],
      "zh-TW": ["臨床訓練"]
    }, "en"), []);
    assert.equal(cleanDisplayText("吉隆坡", "fallback", "en"), "fallback");
  });

  test("converts real simplified dynamic samples on Traditional Chinese pages", () => {
    assert.equal(cleanDisplayText("心胸外科学临床型硕士", "", "zh-TW"), "心胸外科學臨床型碩士");
    assert.equal(cleanDisplayText("医学执业注册资格", "", "zh-TW"), "醫學執業註冊資格");
  });
});
