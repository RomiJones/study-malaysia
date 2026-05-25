import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getMetadataArgsStorage } from "typeorm";
import {
  SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS,
  SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS
} from "@studymy/shared";
import {
  PlannerProfileEntity,
  PlannerTaskEntity,
  RecommendationRunEntity,
  RECOMMENDATION_OPTIONAL_PROFILE_FIELDS,
  RECOMMENDATION_REQUIRED_PROFILE_FIELDS
} from "../../apps/api/src/db/entities.ts";
import { buildDemoRecommendationSeedPayload } from "../../apps/api/src/db/seed.ts";
import { seedPrograms, seedUniversities } from "../../apps/api/src/db/seed-data.ts";

function columnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target)
    .map((column) => String(column.propertyName));
}

describe("recommendation data model", () => {
  test("derives profile fields from the shared smart recommendation contract", () => {
    assert.deepEqual(RECOMMENDATION_REQUIRED_PROFILE_FIELDS, [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS]);
    assert.deepEqual(RECOMMENDATION_OPTIONAL_PROFILE_FIELDS, [...SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS]);
    assert.equal((RECOMMENDATION_REQUIRED_PROFILE_FIELDS as readonly string[]).includes("experience"), false);
    assert.equal(RECOMMENDATION_OPTIONAL_PROFILE_FIELDS.includes("experience"), true);
  });

  test("planner profiles persist completeness and profile-version state", () => {
    const columns = columnNames(PlannerProfileEntity);

    assert.equal(columns.includes("profileVersion"), true);
    assert.equal(columns.includes("completenessStatus"), true);
    assert.equal(columns.includes("requiredProfileFields"), true);
    assert.equal(columns.includes("missingProfileFields"), true);
    assert.equal(columns.includes("profileSnapshotHash"), true);
    assert.equal(columns.includes("profileCompletedAt"), true);
    assert.equal(columns.includes("recommendationRefreshedAt"), true);
  });

  test("recommendation runs persist profile snapshots, missing fields and result snapshots", () => {
    const tables = getMetadataArgsStorage().tables;
    const table = tables.find((item) => item.target === RecommendationRunEntity);
    const columns = columnNames(RecommendationRunEntity);

    assert.equal(table?.name, "recommendation_runs");
    assert.deepEqual(
      [
        "userId",
        "profileId",
        "profileVersion",
        "status",
        "cacheKey",
        "profileSnapshot",
        "requiredProfileFields",
        "missingProfileFields",
        "results",
        "resultCount",
        "generatedAt",
        "expiresAt",
        "auditNote"
      ].every((name) => columns.includes(name)),
      true
    );
  });

  test("builds one traceable demo recommendation seed run from current seed data", () => {
    const demoProgram = seedPrograms.find((program) => program.level === "master" && program.category === "it");
    assert.ok(demoProgram);

    const demoUniversity = seedUniversities.find((university) => university.code === demoProgram.universityCode);
    assert.ok(demoUniversity);

    const payload = buildDemoRecommendationSeedPayload({
      student: { id: 101 },
      profile: {
        id: 202,
        level: "master",
        targetCategory: "it",
        budgetCny: 80000,
        gpa: 3,
        ielts: 5.5,
        experience: "0-1 years",
        acceptNoLanguage: true,
        profileVersion: 1
      },
      program: {
        id: 303,
        level: demoProgram.level,
        category: demoProgram.category,
        annualTuitionCny: demoProgram.annualTuitionCny
      },
      university: {
        id: 404,
        livingCostCny: demoUniversity.livingCostCny
      },
      generatedAt: new Date("2026-05-25T00:00:00.000Z"),
      expiresAt: new Date("2026-06-24T00:00:00.000Z")
    });

    assert.equal(payload.status, "generated");
    assert.equal(payload.userId, 101);
    assert.equal(payload.profileId, 202);
    assert.equal(payload.resultCount, 1);
    assert.deepEqual(payload.requiredProfileFields, [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS]);
    assert.deepEqual(payload.missingProfileFields, []);
    assert.equal(payload.profileSnapshot.experience, "0-1 years");

    const [result] = payload.results;
    assert.equal(result.universityId, 404);
    assert.equal(result.programId, 303);
    assert.equal(result.tier, "target");
    assert.equal(result.publicDisplayStatus, "ready");
    assert.equal(result.annualCostCny, demoProgram.annualTuitionCny + demoUniversity.livingCostCny);
    assert.equal(result.reasonsDetailed.length >= 2, true);
    assert.deepEqual(result.risks, []);
    assert.equal(result.trace.userId, 101);
    assert.equal(result.trace.profileVersion, "1");
    assert.deepEqual(result.trace.profileFields, [
      ...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS,
      ...SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS
    ]);
    assert.equal(result.trace.generatedAt, "2026-05-25T00:00:00.000Z");
  });

  test("planner tasks have a database unique constraint for user and target program", () => {
    const uniqueConstraint = getMetadataArgsStorage()
      .uniques
      .find((unique) => unique.target === PlannerTaskEntity);

    assert.deepEqual(uniqueConstraint?.columns, ["userId", "universityId", "programId"]);
  });
});
