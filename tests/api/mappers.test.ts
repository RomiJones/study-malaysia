import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_UNIVERSITY_COVER_FALLBACK,
  LOCAL_UNIVERSITY_LOGO_FALLBACK,
  getLocalUniversityCoverByCode,
  getLocalUniversityLogoByCode
} from "../../packages/shared/src/index.ts";
import { isReadyForPublicCatalog, mapProgram, mapUniversity, normalizePublicDisplayStatus } from "../../apps/api/src/common/mappers.ts";

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

  test("keeps verified rates out of total tuition amount fields", () => {
    const mapped = mapProgram({
      id: 12,
      universityId: 2,
      slug: "usm-master-arts",
      code: "USM-M-ARTS",
      name: text("Master of Arts", "文学硕士"),
      nameEnOfficial: "Master of Arts",
      level: "master",
      category: "arts",
      faculty: text("School of Humanities", "人文学院"),
      facultyZh: "人文学院",
      studyMode: "research",
      campus: "Main Campus, Penang",
      durationYears: 1,
      durationOfficial: "Full-time: 1-3 years; Part-time: 2-6 years",
      annualTuitionCny: 0,
      tuitionAmount: null,
      tuitionCurrency: "USD",
      tuitionDisplay: "Official fee not published",
      officialTuitionMYR: null,
      officialTuitionNote: "USM official 2025/2026 international tuition rates: full-time USD 1,400 per semester; part-time USD 1,190 per semester.",
      officialFeeSourceUrl: "https://admission.usm.my/index.php/postgraduate/fee-pg",
      secondaryOfficialFeeSourceUrl: "",
      officialFeeAuditStatus: "official-rate-verified",
      officialFeeAuditedAt: new Date("2026-06-15T00:00:00Z"),
      intakeMonths: ["September", "March"],
      officialIntake: "September / March",
      officialIntakeNote: "",
      languageRequirement: { ielts: 5, toefl: null, pte: null, muet: null },
      officialLanguageRequirement: "IELTS 5.0",
      requirement: { gpa: 2.75, gaokaoRequired: false, huikaoRequired: false, note: text("Bachelor degree") },
      officialAcademicRequirement: "Bachelor degree",
      chinaStudentRequirement: "",
      specialRequirementsNote: "",
      applicationDocs: list(),
      curriculum: list(),
      careers: list(),
      specializations: list(),
      description: text("Research programme"),
      officialAccreditationNote: "",
      officialSourceUrl: "https://admission.usm.my/programme",
      officialEntryRequirementSourceUrl: "",
      officialAccreditationSourceUrl: "",
      sourceUrls: [],
      officialVerifiedAt: "2026-06-15",
      officialSourceStatus: "official-verified",
      publicDisplayStatus: "ready",
      publicDisplayNote: "",
      reviewReason: "",
      auditNote: "",
      listTuitionText: "Official fee not published",
      isPublished: true
    } as any);

    assert.equal(mapped.tuitionAmount, null);
    assert.equal(mapped.tuitionInfo.amount, null);
    assert.equal(mapped.tuitionInfo.auditStatus, "official-rate-verified");
    assert.match(String(mapped.tuitionInfo.note), /full-time USD 1,400 per semester/);
  });

  test("localizes public university image fields before API responses", () => {
    const mapped = mapUniversity({
      id: 1,
      slug: "universiti-malaya",
      code: "UM",
      name: text("Universiti Malaya", "马来亚大学"),
      shortName: "UM",
      nameEnOfficial: "Universiti Malaya",
      logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/University_of_Malaya_coat_of_arms.svg/200px-University_of_Malaya_coat_of_arms.svg.png",
      imageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&h=800&fit=crop",
      color: "#003DA5",
      qsRank: 60,
      qsAsiaRank: 12,
      location: text("Kuala Lumpur", "吉隆坡"),
      region: text("Kuala Lumpur", "吉隆坡"),
      ownership: "public",
      institutionType: "research",
      foundedYear: 1905,
      students: 30000,
      intlStudents: 6200,
      csrCertified: true,
      description: text("Research university", "研究型大学"),
      website: "https://www.um.edu.my",
      admissionEmail: "study@um.edu.my",
      officialWebsite: "https://www.um.edu.my",
      studyPortalUrl: "",
      internationalPageUrl: "",
      applicationPortalUrl: "",
      officialAddress: "",
      applicationPeriods: [],
      applicationFees: [],
      applicationDocuments: list(),
      chinaStudentRequirements: list(),
      officialProfile: null,
      officialSources: [],
      officialVerifiedAt: "2026-05-23",
      officialSourceStatus: "official-verified",
      officialAuditSummary: "",
      publicDisplayStatus: "ready",
      livingCostOfficialNote: "",
      tuitionMinCny: 30000,
      tuitionMaxCny: 90000,
      livingCostCny: 30000,
      minIelts: 5.5,
      acceptNoLanguage: false,
      facilities: list(["Library"]),
      highlights: list(["Official source verified"]),
      programCount: 0,
      isPublished: true
    } as any);

    assert.equal(mapped.logoUrl, getLocalUniversityLogoByCode("UM"));
    assert.equal(mapped.imageUrl, getLocalUniversityCoverByCode("UM"));
    assert.match(mapped.imageUrl, /^\/assets\/static-html\/university-covers\/um-/);
    assert.equal(mapped.imageUrl.startsWith("https://"), false);
  });

  test("falls back failed static html image fields to local cover asset", () => {
    const mapped = mapUniversity({
      id: 2,
      slug: "taylors-university",
      code: "NO_COVER",
      name: text("Taylor's University", "泰莱大学"),
      shortName: "Taylor's",
      logoUrl: "",
      imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=800&fit=crop",
      color: "#E91E63",
      qsRank: 253,
      qsAsiaRank: 41,
      location: text("Subang Jaya", "梳邦再也"),
      region: text("Selangor", "雪兰莪"),
      ownership: "private",
      institutionType: "comprehensive",
      foundedYear: 1969,
      students: 20000,
      intlStudents: 6000,
      csrCertified: true,
      description: text("Private university", "私立大学"),
      website: "https://university.taylors.edu.my",
      admissionEmail: "admissions@taylors.edu.my",
      nameEnOfficial: "Taylor's University",
      officialWebsite: "https://university.taylors.edu.my",
      studyPortalUrl: "",
      internationalPageUrl: "",
      applicationPortalUrl: "",
      officialAddress: "",
      applicationPeriods: [],
      applicationFees: [],
      applicationDocuments: list(),
      chinaStudentRequirements: list(),
      officialProfile: null,
      officialSources: [],
      officialVerifiedAt: "2026-05-23",
      officialSourceStatus: "official-verified",
      officialAuditSummary: "",
      publicDisplayStatus: "ready",
      livingCostOfficialNote: "",
      tuitionMinCny: 42000,
      tuitionMaxCny: 108000,
      livingCostCny: 32000,
      minIelts: 5,
      acceptNoLanguage: true,
      facilities: list(["Campus"]),
      highlights: list(["Private university"]),
      programCount: 0,
      isPublished: true
    } as any);

    assert.equal(mapped.logoUrl, LOCAL_UNIVERSITY_LOGO_FALLBACK);
    assert.equal(mapped.imageUrl, LOCAL_UNIVERSITY_COVER_FALLBACK);
  });
});
