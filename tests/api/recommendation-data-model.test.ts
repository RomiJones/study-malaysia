import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getMetadataArgsStorage } from "typeorm";
import {
  PlannerProfileEntity,
  PlannerTaskEntity,
  RecommendationRunEntity,
  RECOMMENDATION_REQUIRED_PROFILE_FIELDS
} from "../../apps/api/src/db/entities.ts";

function columnNames(target: Function) {
  return getMetadataArgsStorage()
    .columns
    .filter((column) => column.target === target)
    .map((column) => String(column.propertyName));
}

describe("recommendation data model", () => {
  test("defines the required profile fields for gated recommendations", () => {
    assert.deepEqual(RECOMMENDATION_REQUIRED_PROFILE_FIELDS, [
      "level",
      "targetCategory",
      "budgetCny",
      "gpa",
      "ielts",
      "experience",
      "acceptNoLanguage"
    ]);
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

  test("planner tasks have a database unique constraint for user and target program", () => {
    const uniqueConstraint = getMetadataArgsStorage()
      .uniques
      .find((unique) => unique.target === PlannerTaskEntity);

    assert.deepEqual(uniqueConstraint?.columns, ["userId", "universityId", "programId"]);
  });
});
