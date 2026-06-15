import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_PAGE_FALLBACK,
  cleanDisplayText,
  formatCategoryLabel,
  formatOfficialNote,
  formatOfficialSourceStatus,
  formatFeeAuditStatus,
  formatProgramDuration,
  formatProgramFacultyLabel,
  formatProgramIntake,
  formatProgramLanguage,
  formatProgramListTuition,
  formatProgramTuition,
  formatVerifiedOfficialText,
  formatRuntimeDisplayText,
  normalizeAcademicText,
  officialPageFallback,
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
    assert.equal(formatProgramTuition(program({ officialFeeAuditStatus: "not-published" }), undefined, "zh-CN"), "官方未公布");
    assert.equal(formatProgramTuition(program({ officialFeeAuditStatus: "official-rate-verified" }), undefined, "zh-CN"), "官方未公布");
    assert.equal(formatFeeAuditStatus("official-rate-verified", "ready", "zh-CN"), "官方费率已核验");
    assert.equal(
      formatProgramTuition(program({
        tuitionDisplay: "USD 1,800 per semester (full-time)",
        officialFeeAuditStatus: "matched-official",
        officialFeeSourceUrl: "https://example.edu/fee"
      }), undefined, "zh-CN"),
      "USD 1,800 / 学期 (全日制)"
    );
    assert.equal(
      formatProgramListTuition(program({
        tuitionDisplay: "USD 3,600-10,800 total tuition",
        officialFeeAuditStatus: "matched-official",
        officialFeeSourceUrl: "https://example.edu/fee"
      }), undefined, "zh-CN"),
      "USD 3,600 - 10,800"
    );
    assert.equal(
      formatProgramListTuition(program({
        tuitionDisplay: "USD 6,300-9,380 total, varies by track",
        officialFeeAuditStatus: "matched-official",
        officialFeeSourceUrl: "https://example.edu/fee"
      }), undefined, "zh-CN"),
      "USD 6,300 - 9,380"
    );
    assert.equal(
      formatProgramListTuition(program({
        tuitionDisplay: "USD 6,300 total (track A); USD 9,380 total (track B)",
        officialFeeAuditStatus: "matched-official",
        officialFeeSourceUrl: "https://example.edu/fee"
      }), undefined, "zh-CN"),
      "USD 6,300 - 9,380"
    );
  });

  test("falls back for missing intake and language fields without undefined text", () => {
    assert.equal(formatProgramIntake(program()), OFFICIAL_PAGE_FALLBACK);
    assert.equal(formatProgramLanguage(program()), OFFICIAL_PAGE_FALLBACK);
    assert.equal(formatProgramLanguage(program({ officialLanguageRequirement: "IELTS (Academic) Band 6.0" })), "IELTS 6.0+");
    assert.equal(formatProgramLanguage(program({ officialLanguageRequirement: "IELTS/IELTS Online minimum Band 5.0" }), "fallback", "zh-CN"), "IELTS 5.0+");
    assert.equal(formatProgramLanguage(program({
      officialLanguageRequirement: "A minimum of Band 5 for IELTS",
      languageRequirement: { ielts: 5 }
    }), "fallback", "zh-CN"), "IELTS 5+");
  });

  test("shows verified official source text instead of discarding untranslated evidence", () => {
    assert.equal(
      formatVerifiedOfficialText("Minimum CGPA 3.00.", "official-verified", "fallback", "zh-CN"),
      "官方来源原文: Minimum CGPA 3.00."
    );
    assert.equal(
      formatVerifiedOfficialText("Minimum CGPA 3.00.", "needs-review", "fallback", "zh-CN"),
      "fallback"
    );
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

  test("localizes runtime application text and hides unknown English outside English", () => {
    assert.equal(cleanDisplayText("October intake", "fallback", "zh-CN"), "10月入学");
    assert.equal(cleanDisplayText("Refer to official portal", "fallback", "ms"), "Rujuk portal rasmi.");
    assert.equal(formatRuntimeDisplayText("February", "fallback", "zh-CN"), "2月");
    assert.equal(formatRuntimeDisplayText("February / September", "fallback", "zh-CN"), "2月 / 9月");
    assert.equal(formatRuntimeDisplayText("February / September", "fallback", "ms"), "Februari / September");
    assert.equal(formatRuntimeDisplayText("Multiple intakes", "fallback", "zh-TW"), "多批次入學");
    assert.equal(formatRuntimeDisplayText("October intake", "fallback", "zh-CN"), "10月入学");
    assert.equal(formatRuntimeDisplayText("October intake", "fallback", "zh-TW"), "10月入學");
    assert.equal(formatRuntimeDisplayText("October intake", "fallback", "ms"), "Ambilan Oktober");
    assert.equal(formatRuntimeDisplayText("Refer to official portal", "fallback", "zh-CN"), "以官方申请入口为准。");
    assert.equal(formatRuntimeDisplayText("Refer to official system", "fallback", "ms"), "Rujuk sistem rasmi.");
    assert.equal(formatRuntimeDisplayText("Rolling", "fallback", "ms"), "Ambilan bergilir");
    assert.equal(formatRuntimeDisplayText("Research", "fallback", "zh-CN"), "研究型");
    assert.equal(formatRuntimeDisplayText("Clinical", "fallback", "zh-TW"), "臨床");
    assert.equal(formatRuntimeDisplayText("Coursework", "fallback", "ms"), "Kerja kursus");
    assert.equal(formatRuntimeDisplayText("Mixed-Mode", "fallback", "zh-CN"), "混合模式");
    assert.equal(formatRuntimeDisplayText("Applications may be submitted through the official system.", "fallback", "zh-CN"), "fallback");
    assert.equal(formatRuntimeDisplayText("May be submitted through the official system.", "fallback", "ms"), "fallback");
    assert.equal(formatRuntimeDisplayText("March requirements are subject to change.", "fallback", "zh-TW"), "fallback");
    assert.equal(formatRuntimeDisplayText("Unknown runtime display note should not leak directly.", "fallback", "zh-TW"), "fallback");
    assert.equal(formatRuntimeDisplayText("Unknown runtime display note should not leak directly.", "fallback", "ms"), "fallback");
    assert.equal(formatRuntimeDisplayText("Unknown runtime display note should not leak directly.", "fallback", "en"), "Unknown runtime display note should not leak directly.");
    assert.equal(normalizeAcademicText("March requirements are subject to change.", "fallback", "zh-CN"), "fallback");
    assert.equal(normalizeAcademicText("6 Semesters (Clinical)", "fallback", "zh-CN"), "6 个学期 (临床)");
    assert.equal(normalizeAcademicText("6 Semesters (Clinical)", "fallback", "zh-TW"), "6 個學期 (臨床)");
    assert.equal(normalizeAcademicText("6 Semesters (Clinical)", "fallback", "ms"), "6 semester (Klinikal)");
    assert.equal(normalizeAcademicText("Full-Time Duration: 6 Semesters, (Clinical) — official page title is Doctor of Public Health (Mixed-Mode)", "fallback", "zh-TW"), "fallback");
    assert.equal(formatProgramIntake(program({ officialIntake: "March requirements are subject to change." }), "fallback", "ms"), "fallback");
    assert.equal(formatProgramDuration(program({ durationOfficial: "6 Semesters (Clinical)" }), "zh-CN"), "6 个学期 (临床)");
    assert.equal(formatProgramDuration(program({ durationOfficial: "Full-Time Duration: 6 Semesters, (Clinical) — official page title is Doctor of Public Health (Mixed-Mode)" }), "zh-CN"), officialPageFallback("zh-CN"));
    assert.equal(formatProgramLanguage(program({ officialLanguageRequirement: "Language requirements are subject to official review." }), "fallback", "zh-CN"), "fallback");
    assert.equal(
      formatProgramDuration(program({
        durationOfficial: "Official duration in years is not published; refer to the programme structure",
        durationYears: 0
      }), "zh-CN"),
      "待官方确认"
    );
    assert.equal(
      formatRuntimeDisplayText("中国学生需按具体专业核对高中 / 本科成绩、语言要求、公证翻译和补充材料。", "fallback", "zh-TW"),
      "中國學生需按具體專業核對高中 / 本科成績、語言要求、公證翻譯和補充材料。"
    );
    assert.equal(formatProgramIntake(program({ intakeMonths: ["February", "September"] }), "fallback", "zh-CN"), "2月 / 9月");
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
