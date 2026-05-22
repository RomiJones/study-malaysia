import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { compareDbStats } from "../../apps/api/src/db/static-html-importer.ts";
import { STATIC_HTML_EXPECTED_STATS, validateStaticCatalog } from "../../apps/api/src/db/static-html-catalog.ts";

describe("static HTML import statistics", () => {
  test("passes when database statistics match the static HTML baseline", () => {
    assert.deepEqual(compareDbStats({ ...STATIC_HTML_EXPECTED_STATS }), []);
  });

  test("reports every database statistic mismatch with machine-readable text", () => {
    const errors = compareDbStats({
      ...STATIC_HTML_EXPECTED_STATS,
      programCount: STATIC_HTML_EXPECTED_STATS.programCount + 1,
      readyProgramCount: STATIC_HTML_EXPECTED_STATS.readyProgramCount - 1
    });

    assert.deepEqual(errors, [
      `Expected database programCount=${STATIC_HTML_EXPECTED_STATS.programCount}, got ${STATIC_HTML_EXPECTED_STATS.programCount + 1}`,
      `Expected database readyProgramCount=${STATIC_HTML_EXPECTED_STATS.readyProgramCount}, got ${STATIC_HTML_EXPECTED_STATS.readyProgramCount - 1}`
    ]);
  });

  test("calculates catalog validation stats from mapped records", () => {
    const validation = validateStaticCatalog({
      sourceHtmlPath: "fixture.html",
      universities: [{ code: "UM", slug: "university-of-malaya" }],
      programs: [
        {
          code: "UMP1",
          slug: "um-master-it",
          universityCode: "UM",
          publicDisplayStatus: "ready",
          level: "master",
          category: "it",
          officialTuitionMYR: 62000,
          officialFeeSourceUrl: "https://example.edu/fees",
          officialIntake: "September"
        },
        {
          code: "UMP2",
          slug: "um-hidden-law",
          universityCode: "UM",
          publicDisplayStatus: "needs-review",
          level: "phd",
          category: "law",
          officialTuitionMYR: null,
          officialFeeSourceUrl: "",
          officialIntake: ""
        }
      ],
      stats: { fileBytes: 100 },
      warnings: []
    } as any, false);

    assert.equal(validation.ok, true);
    assert.equal(validation.stats.universityCount, 1);
    assert.equal(validation.stats.programCount, 2);
    assert.equal(validation.stats.readyProgramCount, 1);
    assert.equal(validation.stats.officialTuitionMYRCount, 1);
    assert.equal(validation.stats.officialFeeSourceUrlCount, 1);
    assert.equal(validation.stats.officialIntakeCount, 1);
    assert.deepEqual(validation.stats.readyByLevel, { master: 1 });
    assert.deepEqual(validation.stats.readyCategories, ["it"]);
  });
});
