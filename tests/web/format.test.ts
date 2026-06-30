import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_PAGE_FALLBACK,
  cleanDisplayText,
  formatCategoryLabel,
  formatFeeAuditStatus,
  formatOfficialSourceStatus,
  formatProgramDuration,
  formatProgramDurationDisplay,
  formatProgramFacultyLabel,
  formatProgramFeeVerifiedLabel,
  formatProgramIntake,
  formatProgramLanguage,
  formatProgramListTuition,
  formatProgramTuition,
  formatRuntimeDisplayText,
  hasVerifiedProgramFee,
  normalizeAcademicText,
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
  test("filters invalid and locale-unsafe field values before rendering", () => {
    assert.equal(cleanDisplayText("undefined", "fallback"), "fallback");
    assert.equal(cleanDisplayText("[]", "fallback"), "fallback");
    assert.equal(cleanDisplayText("[object Object]", "fallback"), "fallback");
    assert.equal(cleanDisplayText("吉隆坡", "fallback", "en"), "fallback");
  });

  test("does not expose exact unverified tuition while showing verified official fees", () => {
    assert.equal(formatProgramTuition(program({ officialTuitionMYR: 62000 }), undefined, "zh-CN"), OFFICIAL_PAGE_FALLBACK);
    assert.equal(
      formatProgramTuition(program({
        officialTuitionMYR: 62000,
        officialFeeAuditStatus: "matched-official",
        officialFeeSourceUrl: "https://example.edu/fee"
      }), undefined, "zh-CN"),
      "RM 62,000"
    );
    assert.equal(
      formatProgramListTuition(program({
        tuitionAmount: 62000,
        tuitionCurrency: "MYR",
        officialFeeAuditStatus: "matched-official",
        officialFeeSourceUrl: "https://example.edu/fee"
      }), undefined, "zh-CN"),
      "RM 62,000"
    );
    assert.equal(formatProgramTuition(program({ officialFeeAuditStatus: "not-published" }), undefined, "zh-CN"), "官方未公布");
  });

  test("formats fee trust labels from the current audit status contract", () => {
    assert.equal(formatFeeAuditStatus("matched-official", "ready", "zh-CN"), "官方已核验");
    assert.equal(formatFeeAuditStatus("official-rate-verified", "ready", "zh-CN"), "官方费率已核验");
    assert.equal(formatFeeAuditStatus("pending-review", "ready", "zh-CN"), "待官方确认");
    assert.equal(formatProgramFeeVerifiedLabel("zh-CN"), "官方核验");
    assert.equal(hasVerifiedProgramFee(program({ hasVerifiedFee: true, filterableTuitionCny: 50000 })), true);
    assert.equal(hasVerifiedProgramFee(program({ officialFeeAuditStatus: "pending-review", annualTuitionCny: 50000 })), false);
  });

  test("formats intake and language fallbacks without undefined text", () => {
    assert.equal(formatProgramIntake(program(), undefined, "zh-CN"), OFFICIAL_PAGE_FALLBACK);
    assert.equal(formatProgramIntake(program({ officialIntake: "September" }), "fallback", "zh-CN"), "9月");
    assert.equal(
      formatProgramIntake(program({ intakeMonths: ["January", "May", "September"] }), "fallback", "zh-CN"),
      "1月 / 5月 / 9月"
    );
    assert.equal(formatProgramLanguage(program(), undefined, "zh-CN"), OFFICIAL_PAGE_FALLBACK);
    assert.equal(
      formatProgramLanguage(program({ officialLanguageRequirement: "IELTS (Academic) Band 6.0" }), "fallback", "zh-CN"),
      "IELTS 6.0+"
    );
  });

  test("builds compact duration displays from numeric duration fields", () => {
    const threeYear = formatProgramDurationDisplay(program({ durationYears: 3, durationOfficial: "" }), "zh-CN");
    assert.equal(threeYear.summary, "3年");
    assert.equal(threeYear.detail, "");
    assert.equal(threeYear.hasDetail, false);

    const pending = formatProgramDurationDisplay(program({ durationYears: 0, durationOfficial: "" }), "zh-CN");
    assert.equal(pending.summary, "待官方确认");
    assert.equal(pending.hasDetail, false);

    assert.equal(formatProgramDuration(program({ durationYears: 3.5, durationOfficial: "" }), "zh-CN"), "3.5年");
  });

  test("formats official source labels using the current public labels", () => {
    assert.equal(formatOfficialSourceStatus("official-verified", "zh-CN"), "官方来源已核验");
    assert.equal(formatOfficialSourceStatus("missing-source", "zh-CN"), "缺少官方来源");
    assert.equal(formatOfficialSourceStatus("official-page-verified-current-cycle-not-open", "zh-CN"), "待官方确认");
    assert.equal(formatOfficialSourceStatus(null, "zh-CN"), "待官方确认");
  });

  test("localizes runtime display text and academic snippets conservatively", () => {
    assert.equal(formatRuntimeDisplayText("Rolling", "fallback", "ms"), "Ambilan bergilir");
    assert.equal(formatRuntimeDisplayText("Research", "fallback", "zh-CN"), "研究型");
    assert.equal(formatRuntimeDisplayText("Unknown runtime display note should not leak directly.", "fallback", "zh-TW"), "fallback");
    assert.equal(normalizeAcademicText("6 Semesters (Clinical)", "fallback", "zh-TW"), "6 個學期 (臨床)");
    assert.equal(normalizeAcademicText("March requirements are subject to change.", "fallback", "zh-CN"), "fallback");
  });

  test("localizes raw backend category values without dynamic i18n keys", () => {
    assert.equal(formatCategoryLabel("Clinical Medicine", "zh-CN"), "临床医学");
    assert.equal(formatCategoryLabel("Clinical Medicine", "zh-TW"), "臨床醫學");
    assert.equal(formatCategoryLabel("Education", "ms"), "Pendidikan");
    assert.equal(formatCategoryLabel("理科", "en"), "Science");
    assert.equal(formatCategoryLabel("未知分类", "en"), "Other programmes");
  });

  test("prevents Chinese dynamic text from leaking into English and Malay pages", () => {
    const localizedText = {
      en: "申请要求以官方页面为准",
      ms: "Permohonan bergantung pada halaman rasmi",
      "zh-CN": "申请要求以官方页面为准",
      "zh-TW": "申請要求以官方頁面為準"
    };
    assert.equal(pickLocaleText(localizedText, "en"), "");
    assert.equal(pickLocaleText({ ...localizedText, "zh-TW": "" }, "zh-TW"), "申請要求以官方頁面為準");
    assert.deepEqual(pickLocaleArray({
      en: ["临床训练"],
      ms: ["Latihan klinikal"],
      "zh-CN": ["临床训练"],
      "zh-TW": ["臨床訓練"]
    }, "en"), []);
  });

  test("formats programme faculty without leaking Chinese fallback across locales", () => {
    const facultyProgram = program({
      category: "medicine",
      facultyZh: "医学院",
      faculty: {
        en: "医学院",
        ms: "",
        "zh-CN": "",
        "zh-TW": ""
      }
    });

    assert.equal(formatProgramFacultyLabel(facultyProgram, "en"), "Medicine");
    assert.equal(formatProgramFacultyLabel(facultyProgram, "ms"), "Perubatan");
    assert.equal(formatProgramFacultyLabel(facultyProgram, "zh-CN"), "医学院");
    assert.equal(formatProgramFacultyLabel(facultyProgram, "zh-TW"), "醫學院");
  });
});
