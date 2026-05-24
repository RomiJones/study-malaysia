import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_PAGE_FALLBACK,
  cleanDisplayText,
  formatCategoryLabel,
  formatOfficialNote,
  formatOfficialSourceStatus,
  formatProgramFacultyLabel,
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

  test("localizes official dynamic notes and hides unknown English notes outside English", () => {
    assert.equal(
      formatOfficialNote("Accommodation and personal expenses are not included.", "fallback", "ms"),
      "Penginapan dan perbelanjaan peribadi tidak termasuk."
    );
    assert.equal(
      formatOfficialNote("Relevant academic background required.", "fallback", "zh-CN"),
      "需具备相关学术背景。"
    );
    assert.equal(
      formatOfficialNote("Refer to programme page and MQA record.", "fallback", "zh-TW"),
      "以專業頁面和 MQA 記錄為準。"
    );
    assert.equal(
      formatOfficialNote("Official source verified.", "fallback", "zh-CN"),
      "官方来源已核验。"
    );
    assert.equal(
      formatOfficialNote("Unknown official note should not leak directly.", "fallback", "ms"),
      "fallback"
    );
    assert.equal(
      formatOfficialNote("Unknown official note should not leak directly.", "fallback", "zh-TW"),
      "fallback"
    );
    assert.equal(
      formatOfficialNote("Unknown official note should not leak directly.", "fallback", "en"),
      "Unknown official note should not leak directly."
    );
  });

  test("localizes raw backend category values without dynamic i18n keys", () => {
    assert.equal(formatCategoryLabel("Clinical Medicine", "zh-CN"), "临床医学");
    assert.equal(formatCategoryLabel("Clinical Medicine", "zh-TW"), "臨床醫學");
    assert.equal(formatCategoryLabel("Education", "ms"), "Pendidikan");
    assert.equal(formatCategoryLabel("Arts and Social Sciences", "en"), "Arts and Social Sciences");
    assert.equal(formatCategoryLabel("Arts and Social Sciences", "zh-CN"), "文学与社会科学");
    assert.equal(formatCategoryLabel("理科", "en"), "Science");
    assert.equal(formatCategoryLabel("商科", "ms"), "Perniagaan");
    assert.equal(formatCategoryLabel("建筑与建成环境", "zh-TW"), "建築與建成環境");
    assert.equal(formatCategoryLabel("医学 / 护理", "en"), "Medicine");
    assert.equal(formatCategoryLabel("计算机 / IT", "ms"), "Teknologi Maklumat");
    assert.equal(formatCategoryLabel("未知分类", "en"), "Other programmes");
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
    assert.equal(pickLocaleText({ ...localizedText, ms: "" }, "ms"), "");
    assert.equal(pickLocaleText({ ...localizedText, "zh-TW": "" }, "zh-TW"), "申請要求以官方頁面為準");
    assert.deepEqual(pickLocaleArray({
      en: ["临床训练"],
      ms: ["Latihan klinikal"],
      "zh-CN": ["临床训练"],
      "zh-TW": ["臨床訓練"]
    }, "en"), []);
    assert.deepEqual(pickLocaleArray({
      en: ["Official English fallback"],
      ms: [],
      "zh-CN": ["申请规划"],
      "zh-TW": []
    }, "ms"), []);
    assert.deepEqual(pickLocaleArray({
      en: ["Official English fallback"],
      ms: [],
      "zh-CN": ["申请规划"],
      "zh-TW": []
    }, "zh-TW"), ["申請規劃"]);
    assert.equal(cleanDisplayText("吉隆坡", "fallback", "en"), "fallback");
  });

  test("converts real simplified dynamic samples on Traditional Chinese pages", () => {
    assert.equal(cleanDisplayText("心胸外科学临床型硕士", "", "zh-TW"), "心胸外科學臨床型碩士");
    assert.equal(cleanDisplayText("医学执业注册资格", "", "zh-TW"), "醫學執業註冊資格");
    assert.equal(cleanDisplayText("软件工程硕士（软件技术）", "", "zh-TW"), "軟體工程碩士（軟體技術）");
    assert.equal(cleanDisplayText("管理责任与农业生物安全公开信息", "", "zh-TW"), "管理責任與農業生物安全公開資訊");
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
