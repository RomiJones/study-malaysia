import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { compareDbStats, shouldPruneStaticCatalog } from "../../apps/api/src/db/static-html-importer.ts";
import {
  STATIC_HTML_EXPECTED_UM_BASE_STATS,
  STATIC_HTML_EXPECTED_LAYER_STATS,
  STATIC_HTML_EXPECTED_STATS,
  validateStaticCatalog
} from "../../apps/api/src/db/static-html-catalog.ts";

describe("static HTML import statistics", () => {
  test("passes when database statistics match the static HTML baseline", () => {
    assert.deepEqual(compareDbStats({ ...STATIC_HTML_EXPECTED_STATS }), []);
  });

  test("tracks supplement expected stats as mapped import candidates", () => {
    assert.equal(STATIC_HTML_EXPECTED_LAYER_STATS.supplement.universityCount, 104);
    assert.equal(STATIC_HTML_EXPECTED_LAYER_STATS.supplement.programCount, 256);
  });

  test("keeps confirmed supplement imports additive unless prune is explicitly confirmed", () => {
    assert.equal(shouldPruneStaticCatalog("base"), true);
    assert.equal(shouldPruneStaticCatalog("base", { noPrune: true }), false);
    assert.equal(shouldPruneStaticCatalog("base", { scopeActive: true }), false);
    assert.equal(shouldPruneStaticCatalog("base", { scopeActive: true, confirmPrune: true }), true);
    assert.equal(shouldPruneStaticCatalog("supplement"), false);
    assert.equal(shouldPruneStaticCatalog("supplement", { confirmPrune: true }), true);
    assert.equal(shouldPruneStaticCatalog("supplement", { noPrune: true, confirmPrune: true }), false);
    assert.equal(shouldPruneStaticCatalog("merged"), false);
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
    assert.deepEqual(validation.stats.programsByLevel, { master: 1, phd: 1 });
    assert.deepEqual(validation.stats.readyByLevel, { master: 1 });
    assert.deepEqual(validation.stats.readyCategories, ["it"]);
  });

  test("tracks the UM scoped baseline separately from the full base catalog", () => {
    assert.deepEqual(STATIC_HTML_EXPECTED_UM_BASE_STATS, {
      universityCount: 1,
      programCount: 248,
      readyProgramCount: 239,
      officialTuitionMYRCount: 240,
      officialFeeSourceUrlCount: 248,
      officialIntakeCount: 245
    });
  });

  test("fails validation when a requested static catalog scope has no matching university", () => {
    const validation = validateStaticCatalog({
      layer: "base",
      sourceHtmlPath: "fixture.html",
      universities: [],
      programs: [],
      stats: {
        sourceHtmlPath: "fixture.html",
        fileBytes: 100,
        universityCount: 0,
        programCount: 0,
        readyProgramCount: 0,
        officialTuitionMYRCount: 0,
        officialFeeSourceUrlCount: 0,
        officialIntakeCount: 0,
        publicDisplayStatusCounts: {},
        programsByLevel: {},
        readyByLevel: {},
        readyCategoryCount: 0,
        readyCategories: []
      },
      expectedStats: STATIC_HTML_EXPECTED_UM_BASE_STATS,
      layerReports: {} as any,
      scope: {
        universityCode: "UM",
        universitySlug: null,
        matchedUniversityCodes: [],
        matchedUniversitySlugs: []
      },
      warnings: []
    }, true);

    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /scope matched no universities/);
    assert.match(validation.errors.join("\n"), /Expected base universityCount=1, got 0/);
  });
});
