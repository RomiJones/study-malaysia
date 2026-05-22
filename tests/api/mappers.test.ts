import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isReadyForPublicCatalog, mapProgram, normalizePublicDisplayStatus } from "../../apps/api/src/common/mappers.ts";

function text(en: string, zh = en) {
  return { en, ms: en, "zh-CN": zh, "zh-TW": zh };
}

function list(values: string[] = []) {
  return { en: values, ms: values, "zh-CN": values, "zh-TW": values };
}

describe("API mappers", () => {
  test("normalizes public display status for hidden unpublished records", () => {
    assert.equal(normalizePublicDisplayStatus(null, false), "hidden-unverified");
    assert.equal(normalizePublicDisplayStatus("ready", false), "hidden-unverified");
    assert.equal(normalizePublicDisplayStatus("needs-review", false), "needs-review");
    assert.equal(isReadyForPublicCatalog({ isPublished: false, publicDisplayStatus: "ready" }), false);
    assert.equal(isReadyForPublicCatalog({ isPublished: true, publicDisplayStatus: "ready" }), true);
  });

  test("maps program fee, requirement and source fields for public API payloads", () => {
    const mapped = mapProgram({
      id: 11,
      universityId: 1,
      slug: "um-master-it",
      code: "UMP1",
      name: text("Master of Information Technology", "信息技术硕士"),
      nameEnOfficial: "Master of Information Technology",
      level: "master",
      category: "it",
      faculty: text("Faculty of Computer Science", "计算机学院"),
      facultyZh: "计算机学院",
      studyMode: "Full-time",
      campus: "Kuala Lumpur",
      durationYears: 2,
      durationOfficial: "2 years",
      annualTuitionCny: 45000,
      tuitionAmount: null,
      tuitionCurrency: "MYR",
      tuitionDisplay: "",
      officialTuitionMYR: 62000,
      officialTuitionNote: "Official postgraduate fee schedule.",
      officialFeeSourceUrl: "https://example.edu/fees",
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: "matched-official",
      officialFeeAuditedAt: new Date("2026-01-15T00:00:00Z"),
      intakeMonths: ["September"],
      officialIntake: "September",
      officialIntakeNote: "",
      languageRequirement: { ielts: 6, toefl: 80, pte: null, muet: null },
      officialLanguageRequirement: "IELTS 6.0",
      requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: text("Good standing") },
      officialAcademicRequirement: "Bachelor degree",
      chinaStudentRequirement: "Bachelor diploma and transcript",
      specialRequirementsNote: "",
      applicationDocs: list(["Passport"]),
      curriculum: list(["Research methods"]),
      careers: list(["Product manager"]),
      specializations: list(["Data analytics"]),
      description: text("Official program description"),
      officialAccreditationNote: "",
      officialSourceUrl: "https://example.edu/program",
      officialEntryRequirementSourceUrl: "https://example.edu/entry",
      officialAccreditationSourceUrl: "",
      sourceUrls: [{ title: "Official fee source", url: "https://example.edu/fees", sourceType: "fee", status: "official-verified" }],
      officialVerifiedAt: "2026-01-10",
      officialSourceStatus: "official-verified",
      publicDisplayStatus: "ready",
      publicDisplayNote: "",
      reviewReason: "",
      auditNote: "",
      listTuitionText: "",
      isPublished: true
    } as any);

    assert.equal(mapped.tuitionCurrency, "MYR");
    assert.equal(mapped.tuitionDisplay, "RM 62,000");
    assert.equal(mapped.tuitionInfo.officialAmountMYR, 62000);
    assert.equal(mapped.tuitionInfo.sourceUrl, "https://example.edu/fees");
    assert.equal(mapped.requirementInfo.chinaStudentRequirement, "Bachelor diploma and transcript");
    assert.equal(mapped.sourceUrls.filter((item) => item.url === "https://example.edu/fees").length, 1);
    assert.equal(mapped.sourceUrls.some((item) => item.url === "https://example.edu/program"), true);
  });
});
