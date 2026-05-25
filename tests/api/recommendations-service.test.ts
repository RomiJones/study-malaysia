import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { SMART_RECOMMENDATION_CONTRACT } from "@studymy/shared";
import { RecommendationsController } from "../../apps/api/src/recommendations/recommendations.controller.ts";
import { RecommendationsService } from "../../apps/api/src/recommendations/recommendations.service.ts";

function text(en: string, zh = en) {
  return { en, ms: en, "zh-CN": zh, "zh-TW": zh };
}

function list(values: string[] = []) {
  return { en: values, ms: values, "zh-CN": values, "zh-TW": values };
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    userId: 7,
    level: "master",
    targetCategory: "it",
    budgetCny: 90000,
    gpa: 3.2,
    ielts: 6.5,
    experience: "1-3 years",
    acceptNoLanguage: true,
    profileVersion: 3,
    completenessStatus: "complete",
    requiredProfileFields: ["level", "targetCategory", "budgetCny", "gpa", "ielts", "acceptNoLanguage"],
    missingProfileFields: [],
    profileSnapshotHash: "hash",
    profileCompletedAt: new Date("2026-05-25T00:00:00.000Z"),
    recommendationRefreshedAt: null,
    materialProgress: {},
    visaChecklist: {},
    updatedAt: new Date("2026-05-25T00:01:00.000Z"),
    ...overrides
  };
}

function university(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "universiti-malaya",
    code: "UM",
    name: text("Universiti Malaya", "马来亚大学"),
    shortName: "UM",
    nameEnOfficial: "Universiti Malaya",
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

function makeService(input: {
  profileValue?: unknown;
  universities?: unknown[];
  programs?: unknown[];
  cached?: unknown;
  savedRuns?: unknown[];
  savedProfiles?: unknown[];
  cacheWrites?: Array<{ key: string; value: unknown }>;
}) {
  const savedRuns = input.savedRuns || [];
  const savedProfiles = input.savedProfiles || [];
  const cacheWrites = input.cacheWrites || [];
  return new RecommendationsService(
    { findOneBy: async () => input.profileValue, save: async (value: unknown) => { savedProfiles.push(value); return value; } } as any,
    { create: (value: unknown) => value, save: async (value: unknown) => { savedRuns.push(value); return value; } } as any,
    { find: async () => input.programs || [] } as any,
    { find: async () => input.universities || [] } as any,
    {
      getJson: async () => input.cached || null,
      setJson: async (key: string, value: unknown) => {
        cacheWrites.push({ key, value });
      }
    } as any
  );
}

describe("smart recommendations API and service", () => {
  test("controller exposes the contract and delegates authenticated requests", async () => {
    const calls: unknown[] = [];
    const controller = new RecommendationsController({
      getContract: () => SMART_RECOMMENDATION_CONTRACT,
      getPersonalizedRecommendations: async (userId: number, input: unknown) => {
        calls.push({ type: "get", userId, input });
        return { status: "ready", recommendations: [] };
      },
      refreshPersonalizedRecommendations: async (userId: number, input: unknown) => {
        calls.push({ type: "refresh", userId, input });
        return { status: "ready", recommendations: [] };
      }
    } as any);

    assert.equal(controller.contract().personalizationRequiresAuthentication, true);
    await controller.currentUserRecommendations({ user: { id: 7 } }, { locale: "zh-CN" } as any);
    await controller.refresh({ user: { id: 7 } }, { profileVersion: "3" } as any);

    assert.deepEqual(calls, [
      { type: "get", userId: 7, input: { mode: "personalized-profile-match", locale: "zh-CN" } },
      { type: "refresh", userId: 7, input: { mode: "personalized-profile-match", profileVersion: "3" } }
    ]);
  });

  test("blocks personalized recommendations when the saved profile has not been completed", async () => {
    const savedRuns: unknown[] = [];
    const service = makeService({
      profileValue: profile({
        completenessStatus: "incomplete",
        profileCompletedAt: null,
        missingProfileFields: ["gpa"]
      }),
      savedRuns
    });

    const result = await service.getPersonalizedRecommendations(7, { mode: "personalized-profile-match" });

    assert.equal(result.status, "profile-incomplete");
    assert.equal(result.gate.canShowRecommendations, false);
    assert.deepEqual(result.recommendations, []);
    assert.equal((savedRuns[0] as any).status, "blocked-profile-incomplete");
  });

  test("generates explainable personalized recommendations from the saved profile", async () => {
    const savedRuns: unknown[] = [];
    const savedProfiles: unknown[] = [];
    const cacheWrites: Array<{ key: string; value: unknown }> = [];
    const service = makeService({
      profileValue: profile(),
      universities: [university()],
      programs: [program(), program({ id: 12, slug: "um-phd-law", level: "phd", category: "law" })],
      savedRuns,
      savedProfiles,
      cacheWrites
    });

    const result = await service.refreshPersonalizedRecommendations(7, {
      mode: "personalized-profile-match",
      locale: "zh-CN",
      profileVersion: "3"
    });

    assert.equal(result.status, "ready");
    assert.equal(result.gate.canShowRecommendations, true);
    assert.equal(result.recommendations.length, 1);
    assert.equal(result.recommendations[0].program.id, 11);
    assert.equal(result.recommendations[0].trace.userId, 7);
    assert.equal(result.recommendations[0].reasonsDetailed.some((item) => item.profileField === "gpa"), true);
    assert.equal(result.recommendations[0].risks.length, 0);
    assert.equal((savedRuns[0] as any).status, "generated");
    assert.equal((savedRuns[0] as any).resultCount, 1);
    assert.equal((savedProfiles[0] as any).recommendationRefreshedAt instanceof Date, true);
    assert.equal(cacheWrites.length, 1);
    assert.match(cacheWrites[0].key, /^recommendation:profile:7:3:/);
  });

  test("rejects stale profile versions before using cached recommendations", async () => {
    const service = makeService({
      profileValue: profile({ profileVersion: 4 }),
      cached: { status: "ready", recommendations: [{ id: "cached" }] }
    });

    await assert.rejects(
      () => service.getPersonalizedRecommendations(7, { mode: "personalized-profile-match", profileVersion: "3" }),
      (error) =>
        error instanceof BadRequestException &&
        (error.getResponse() as any).code === "SMART_RECOMMENDATION_PROFILE_STALE"
    );
  });

  test("returns no-match without falling back to default recommendations", async () => {
    const savedRuns: unknown[] = [];
    const service = makeService({
      profileValue: profile({ targetCategory: "medicine" }),
      universities: [university()],
      programs: [program()],
      savedRuns
    });

    const result = await service.refreshPersonalizedRecommendations(7, { mode: "personalized-profile-match" });

    assert.equal(result.status, "no-match");
    assert.equal(result.gate.primaryAction, "adjust-profile");
    assert.deepEqual(result.recommendations, []);
    assert.equal((savedRuns[0] as any).status, "no-match");
  });
});
