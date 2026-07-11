import "reflect-metadata";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AdminRecommendationsService } from "../../apps/api/src/admin/admin-recommendations.service.ts";

function localized(value: string) {
  return { en: value, ms: value, "zh-CN": value, "zh-TW": value };
}

function profileHash(profile: Record<string, unknown>) {
  const source = {
    level: profile.level,
    targetCategory: profile.targetCategory,
    budgetCny: Number(profile.budgetCny),
    gpa: Number(profile.gpa),
    ielts: Number(profile.ielts),
    experience: profile.experience,
    acceptNoLanguage: profile.acceptNoLanguage,
    profileVersion: profile.profileVersion
  };
  return createHash("sha256").update(JSON.stringify(source)).digest("hex").slice(0, 32);
}

function queryBuilder(runs: unknown[], summaryRows: unknown[]) {
  const builder = {
    leftJoinAndSelect: () => builder,
    orderBy: () => builder,
    addOrderBy: () => builder,
    skip: () => builder,
    take: () => builder,
    andWhere: () => builder,
    select: () => builder,
    addSelect: () => builder,
    groupBy: () => builder,
    getManyAndCount: async () => [runs, runs.length],
    getRawMany: async () => summaryRows
  };
  return builder;
}

function makeService(input: {
  runs: unknown[];
  programs?: unknown[];
  universities?: unknown[];
  cachePayload?: unknown;
  summaryRows?: unknown[];
}) {
  return new AdminRecommendationsService(
    { createQueryBuilder: () => queryBuilder(input.runs, input.summaryRows || []) } as any,
    { find: async () => input.programs || [] } as any,
    { find: async () => input.universities || [] } as any,
    { getJson: async () => input.cachePayload || null } as any
  );
}

function currentProfile(overrides: Record<string, unknown> = {}) {
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
    contactInfo: { phone: "should-not-leak" },
    academicBackground: { school: "should-not-leak" },
    languageProfile: { note: "should-not-leak" },
    studyPreferences: { city: "should-not-leak" },
    serviceNeeds: { urgent: true },
    ...overrides
  };
}

function university(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: localized("马来亚大学"),
    nameEnOfficial: "Universiti Malaya",
    shortName: "UM",
    publicDisplayStatus: "ready",
    officialSourceStatus: "official-verified",
    livingCostCny: 24000,
    acceptNoLanguage: true,
    qsRank: 60,
    ...overrides
  };
}

function program(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    universityId: 1,
    code: "UMP1",
    name: localized("信息技术硕士"),
    nameEnOfficial: "Master of Information Technology",
    publicDisplayStatus: "ready",
    officialSourceStatus: "official-verified",
    annualTuitionCny: 45000,
    tuitionAmount: null,
    tuitionCurrency: "CNY",
    tuitionDisplay: "",
    officialTuitionMYR: null,
    officialTuitionNote: "Official fee table",
    officialFeeAuditStatus: "matched-official",
    officialFeeSourceUrl: "https://example.edu/fees",
    secondaryOfficialFeeSourceUrl: "",
    listTuitionText: "",
    durationYears: 2,
    languageRequirement: { ielts: 6 },
    officialLanguageRequirement: "IELTS 6.0",
    officialEntryRequirementSourceUrl: "https://example.edu/entry",
    requirement: { gpa: 3 },
    ...overrides
  };
}

function generatedRun(profile: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const generatedAt = new Date("2026-05-25T00:00:00.000Z");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  return {
    id: 101,
    userId: 7,
    profileId: 5,
    user: {
      id: 7,
      account: "student@example.com",
      displayName: "Student Demo",
      preferredLocale: "zh-CN"
    },
    profile,
    profileVersion: 3,
    status: "generated",
    cacheKey: `recommendation:profile:7:3:${profileHash(profile)}:all`,
    profileSnapshot: {
      level: "master",
      targetCategory: "it",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6.5,
      experience: "1-3 years",
      acceptNoLanguage: true
    },
    requiredProfileFields: ["level", "targetCategory", "budgetCny", "gpa", "ielts", "acceptNoLanguage"],
    missingProfileFields: [],
    results: [
      {
        universityId: 1,
        programId: 11,
        score: 91,
        annualCostCny: 69000,
        tier: "target",
        publicDisplayStatus: "ready",
        reasons: { en: ["Budget"], ms: ["Budget"], "zh-CN": ["预算匹配"], "zh-TW": ["預算匹配"] },
        reasonsDetailed: [
          {
            code: "budget-within-range",
            profileField: "budgetCny",
            publicDataField: "program.annualTuitionCny",
            message: localized("预算可覆盖预计首年学费和生活费。"),
            profileValue: 90000,
            publicDataValue: 69000
          }
        ],
        risks: [
          {
            code: "source-needs-review",
            severity: "warning",
            profileField: "targetCategory",
            publicDataField: "program.publicDisplayStatus",
            message: localized("官方来源仍需核验。"),
            suggestion: localized("请复核画像或调整筛选条件。")
          }
        ],
        trace: {
          userId: 7,
          profileVersion: "3",
          profileFields: ["level", "targetCategory", "budgetCny", "gpa", "ielts", "experience", "acceptNoLanguage"],
          publicDataFields: [
            "program.level",
            "program.category",
            "program.annualTuitionCny",
            "program.requirement.gpa",
            "program.languageRequirement.ielts",
            "program.publicDisplayStatus",
            "university.livingCostCny",
            "university.acceptNoLanguage",
            "university.qsRank",
            "university.publicDisplayStatus"
          ],
          universityId: 1,
          programId: 11,
          generatedAt: generatedAt.toISOString()
        }
      }
    ],
    resultCount: 1,
    generatedAt,
    expiresAt,
    createdAt: generatedAt,
    auditNote: "Generated from saved student profile and public catalog data.",
    ...overrides
  };
}

describe("admin recommendations trace service", () => {
  test("serializes recommendation runs with profile fields, public data sources and privacy boundary", async () => {
    const profile = currentProfile();
    const service = makeService({
      runs: [generatedRun(profile)],
      programs: [program()],
      universities: [university()],
      cachePayload: { status: "ready" },
      summaryRows: [{ status: "generated", count: "1" }]
    });

    const response = await service.listRuns({});
    const [item] = response.items;
    const [result] = item.results;

    assert.equal(response.centerPositioning.includes("不是前端会员中心"), true);
    assert.equal(item.student.accountMasked, "st***@example.com");
    assert.equal(item.cache.state, "hit-eligible");
    assert.equal(item.profileDrift.profileChanged, false);
    assert.equal(item.profileSnapshot.find((field) => field.field === "budgetCny")?.value, 90000);
    assert.equal(result.feeSource.filterableTuitionCny, 45000);
    assert.equal(result.feeSource.officialFeeSourceUrl, "https://example.edu/fees");
    assert.equal(result.languageSource.ielts, 6);
    assert.equal(result.reasonSources[0].profileFieldLabel, "预算");
    assert.equal(result.reasonSources[0].publicDataFieldLabel, "专业年度学费");
    assert.equal(result.riskSources[0].message, "官方来源仍需核验。");
    assert.equal(result.publicDataFields.some((field) => field.field === "program.annualTuitionCny" && field.currentValue === 45000), true);
    assert.equal(JSON.stringify(item).includes("should-not-leak"), false);
  });

  test("marks cached recommendations stale when the current profile changes", async () => {
    const originalProfile = currentProfile();
    const changedProfile = currentProfile({ profileVersion: 4, budgetCny: 120000 });
    const service = makeService({
      runs: [generatedRun(originalProfile, { profile: changedProfile })],
      programs: [program()],
      universities: [university()]
    });

    const response = await service.listRuns({});
    const [item] = response.items;

    assert.equal(item.profileDrift.versionChanged, true);
    assert.equal(item.profileDrift.hashChanged, true);
    assert.deepEqual(item.profileDrift.invalidationTriggers.includes("profile-updated"), true);
    assert.equal(item.cache.state, "profile-stale");
  });

  test("keeps blocked incomplete-profile runs non-cacheable and exposes missing fields", async () => {
    const profile = currentProfile({ profileVersion: 2 });
    const service = makeService({
      runs: [
        generatedRun(profile, {
          status: "blocked-profile-incomplete",
          cacheKey: "",
          profileVersion: 2,
          profileSnapshot: null,
          missingProfileFields: ["gpa", "ielts"],
          results: null,
          resultCount: 0,
          generatedAt: null,
          expiresAt: null
        })
      ]
    });

    const response = await service.listRuns({});
    const [item] = response.items;

    assert.equal(item.cache.state, "not-cacheable");
    assert.deepEqual(item.missingProfileFields.map((field) => field.label), ["GPA", "IELTS"]);
    assert.equal(item.results.length, 0);
  });
});
