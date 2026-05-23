import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AuthController } from "../../apps/api/src/auth/auth.controller.ts";
import { ProgramsController } from "../../apps/api/src/programs/programs.controller.ts";
import { ProgramsService } from "../../apps/api/src/programs/programs.service.ts";
import { UniversitiesService } from "../../apps/api/src/universities/universities.service.ts";

function text(en: string, zh = en) {
  return { en, ms: en, "zh-CN": zh, "zh-TW": zh };
}

function list(values: string[] = []) {
  return { en: values, ms: values, "zh-CN": values, "zh-TW": values };
}

function university(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "university-of-malaya",
    code: "UM",
    name: text("University of Malaya", "马来亚大学"),
    shortName: "UM",
    nameEnOfficial: "University of Malaya",
    logoUrl: "",
    imageUrl: "",
    color: "#1B7A72",
    qsRank: 60,
    qsAsiaRank: 12,
    location: text("Kuala Lumpur", "吉隆坡"),
    region: text("Kuala Lumpur", "吉隆坡"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1905,
    students: 30000,
    intlStudents: 4000,
    csrCertified: true,
    description: text("Research university"),
    website: "https://www.um.edu.my",
    admissionEmail: "admission@example.edu",
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
    officialVerifiedAt: "2026-01-10",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "",
    publicDisplayStatus: "ready",
    isPublished: true,
    livingCostOfficialNote: "",
    tuitionMinCny: 30000,
    tuitionMaxCny: 70000,
    livingCostCny: 24000,
    minIelts: 5.5,
    acceptNoLanguage: true,
    facilities: list(["Library"]),
    highlights: list(["QS Top 100"]),
    programCount: 1,
    ...overrides
  };
}

function program(overrides: Record<string, unknown> = {}) {
  return {
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
    tuitionCurrency: "CNY",
    tuitionDisplay: "",
    officialTuitionMYR: null,
    officialTuitionNote: "",
    officialFeeSourceUrl: "",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "pending-review",
    officialFeeAuditedAt: null,
    intakeMonths: ["September"],
    officialIntake: "September",
    officialIntakeNote: "",
    languageRequirement: { ielts: 6, toefl: null, pte: null, muet: null },
    officialLanguageRequirement: "IELTS 6.0",
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: text("Good standing") },
    officialAcademicRequirement: "Bachelor degree",
    chinaStudentRequirement: "",
    specialRequirementsNote: "",
    applicationDocs: list(["Passport"]),
    curriculum: list(["Research methods"]),
    careers: list(["Product manager"]),
    specializations: list(["Data analytics"]),
    description: text("Official program description"),
    officialAccreditationNote: "",
    officialSourceUrl: "https://example.edu/program",
    officialEntryRequirementSourceUrl: "",
    officialAccreditationSourceUrl: "",
    sourceUrls: [],
    officialVerifiedAt: "2026-01-10",
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "",
    listTuitionText: "",
    isPublished: true,
    ...overrides
  };
}

describe("public API services and controllers", () => {
  test("program recommendations filter public catalog data and cache the result", async () => {
    const cacheWrites: Array<{ key: string; value: unknown }> = [];
    const service = new ProgramsService(
      { find: async () => [program(), program({ id: 12, level: "phd", slug: "um-phd-law", code: "UMP2", category: "law" })] } as any,
      { find: async () => [university()] } as any,
      {
        getJson: async () => null,
        setJson: async (key: string, value: unknown) => cacheWrites.push({ key, value })
      } as any
    );

    const result = await service.recommend({
      level: "master",
      targetCategory: "it",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6.5,
      acceptNoLanguage: true
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].program.slug, "um-master-it");
    assert.equal(result[0].annualCostCny, 69000);
    assert.equal(result[0].reasons["zh-CN"].includes("学术门槛匹配"), true);
    assert.equal(cacheWrites.length, 1);
    assert.match(cacheWrites[0].key, /^catalog:recommend:/);
  });

  test("program controller delegates list and recommendation queries", async () => {
    const calls: string[] = [];
    const controller = new ProgramsController({
      list: async (query: unknown) => {
        calls.push(`list:${JSON.stringify(query)}`);
        return [{ id: 1 }];
      },
      getFacets: async () => ({}),
      getByIdentifier: async () => ({}),
      recommend: async (query: unknown) => {
        calls.push(`recommend:${JSON.stringify(query)}`);
        return [];
      },
      costEstimate: async () => ({})
    } as any);

    assert.deepEqual(await controller.list({ search: "um", includeMeta: true } as any), [{ id: 1 }]);
    assert.deepEqual(await controller.recommend({ level: "master", targetCategory: "it" } as any), []);
    assert.deepEqual(calls, [
      'list:{"search":"um","includeMeta":true}',
      'recommend:{"level":"master","targetCategory":"it"}'
    ]);
  });

  test("home metadata uses the same public catalog scope as public lists", async () => {
    const hiddenUniversity = university({
      id: 2,
      slug: "hidden-university",
      code: "HID",
      isPublished: false,
      publicDisplayStatus: "hidden-unverified",
      officialSourceStatus: "missing-source"
    });
    const service = new UniversitiesService(
      { find: async () => [university()] } as any,
      { find: async () => [program(), program({ id: 12, universityId: 2, university: hiddenUniversity })] } as any,
      { find: async () => [] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const result = await service.getHomeMeta() as any;

    assert.equal(result.stats.universityCount, 1);
    assert.equal(result.stats.programCount, 1);
    assert.equal(result.stats.readyProgramCount, 1);
    assert.equal(result.stats.officialVerifiedCount, 1);
  });

  test("auth controller exposes the current user state endpoint", async () => {
    const controller = new AuthController({
      me: async (id: number) => ({ id, role: "student", displayName: "Student", method: "email", account: "student@example.com" })
    } as any);

    assert.deepEqual(await controller.me({ user: { id: 7 } }), {
      id: 7,
      role: "student",
      displayName: "Student",
      method: "email",
      account: "student@example.com"
    });
  });
});
