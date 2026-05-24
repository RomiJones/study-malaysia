import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  compareDbStats,
  createCatalogDataSource,
  getStaticCatalogDbStatsOptions,
  previewStaticCatalogImport,
  shouldPruneStaticCatalog
} from "../../apps/api/src/db/static-html-importer.ts";
import { ProgramEntity, UniversityEntity } from "../../apps/api/src/db/entities.ts";
import {
  STATIC_HTML_EXPECTED_UM_BASE_STATS,
  STATIC_HTML_EXPECTED_LAYER_STATS,
  STATIC_HTML_EXPECTED_STATS,
  validateStaticCatalog
} from "../../apps/api/src/db/static-html-catalog.ts";

describe("static HTML import statistics", () => {
  test("can disable TypeORM schema synchronization for read-only checks", () => {
    assert.equal(createCatalogDataSource().options.synchronize, true);
    assert.equal(createCatalogDataSource({ synchronize: false }).options.synchronize, false);
  });

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

  test("builds layer-aware database statistics options", () => {
    const universities = [{ code: "UM" }, { code: "UKM" }];
    const programs = [{ code: "UMP1" }, { code: "UKMP1" }];

    assert.deepEqual(getStaticCatalogDbStatsOptions({ layer: "base", universities, programs } as any), {
      universityCodes: ["UM", "UKM"],
      programCodes: ["UMP1", "UKMP1"]
    });
    assert.deepEqual(getStaticCatalogDbStatsOptions({ layer: "supplement", universities, programs } as any), {
      universityCodes: ["UM", "UKM"],
      programCodes: ["UMP1", "UKMP1"]
    });
    assert.deepEqual(getStaticCatalogDbStatsOptions({ layer: "merged", universities, programs } as any), {});
    assert.deepEqual(
      getStaticCatalogDbStatsOptions({
        layer: "merged",
        universities: [{ code: "UM" }],
        programs: [{ code: "UMP1" }],
        scope: {
          universityCode: "UM",
          universitySlug: null,
          matchedUniversityCodes: ["UM"],
          matchedUniversitySlugs: ["university-of-malaya"]
        }
      } as any),
      { universityCodes: ["UM"] }
    );
  });

  test("reports cross-university program code collisions in scoped import preview", async () => {
    const existingUniversity = { id: 10, code: "UM", slug: "university-of-malaya" };
    const foreignProgram = { id: 20, code: "UMP1", slug: "foreign-program", universityId: 99 };

    const universityRepository = {
      findOne: async ({ where }: any) =>
        where.code === existingUniversity.code || where.slug === existingUniversity.slug ? existingUniversity : null,
      count: async () => 1
    };
    const programRepository = {
      find: async ({ where }: any) => (where.code === foreignProgram.code ? [foreignProgram] : []),
      findOne: async ({ where }: any) => (where.slug === foreignProgram.slug ? foreignProgram : null),
      createQueryBuilder: () => ({
        innerJoin() {
          return this;
        },
        where() {
          return this;
        },
        andWhere() {
          return this;
        },
        getCount: async () => 0
      })
    };
    const dataSource = {
      getRepository: (entity: any) => {
        if (entity === UniversityEntity) return universityRepository;
        if (entity === ProgramEntity) return programRepository;
        throw new Error("Unexpected repository requested.");
      }
    };

    const plan = await previewStaticCatalogImport(
      dataSource as any,
      {
        layer: "base",
        sourceHtmlPath: "fixture.html",
        universities: [{ code: "UM", slug: "university-of-malaya" }],
        programs: [{ code: "UMP1", slug: "um-target-program", universityCode: "UM" }],
        stats: {
          publicDisplayStatusCounts: {},
          programsByLevel: {},
          readyByLevel: {},
          readyCategoryCount: 0
        },
        expectedStats: STATIC_HTML_EXPECTED_UM_BASE_STATS,
        warnings: [],
        scope: {
          universityCode: "UM",
          universitySlug: null,
          matchedUniversityCodes: ["UM"],
          matchedUniversitySlugs: ["university-of-malaya"]
        }
      } as any,
      { pruneCatalog: false }
    );

    assert.equal(plan.createdPrograms, 0);
    assert.equal(plan.updatedPrograms, 0);
    assert.deepEqual(plan.conflicts, [
      {
        entity: "program",
        code: "UMP1",
        slug: "um-target-program",
        codeMatchId: 20,
        slugMatchId: null,
        targetUniversityId: 10,
        codeMatchUniversityId: 99,
        slugMatchUniversityId: null,
        reason: "cross-university-match"
      }
    ]);
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
