import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_LUC_OFFICIAL_AUDIT_PATH,
  LUC_OFFICIAL_AUDIT_SLUG_PREFIX,
  buildLucOfficialAuditRows,
  buildLucUniversityRow,
  summarizeLucOfficialAuditImport,
  validateLucOfficialAudit
} from "../../apps/api/src/db/import-luc-official-audit.ts";
import { ProgramsService } from "../../apps/api/src/programs/programs.service.ts";
import { UniversitiesService } from "../../apps/api/src/universities/universities.service.ts";

const source = JSON.parse(readFileSync(DEFAULT_LUC_OFFICIAL_AUDIT_PATH, "utf8"));

test("LUC undergraduate audit import keeps all rows in non-public review status", () => {
  assert.deepEqual(validateLucOfficialAudit(source), []);

  const rows = buildLucOfficialAuditRows(source);
  const summary = summarizeLucOfficialAuditImport(rows);

  assert.equal(rows.length, 57);
  assert.deepEqual(summary.byLevel, { bachelor: 57 });
  assert.equal(summary.readyRows, 0);
  assert.equal(summary.needsReviewRows, 57);
  assert.equal(summary.publishedRows, 0);
  assert.equal(summary.uniqueSlugs, 57);
  assert.equal(summary.missingFeeRows, 57);
  assert.equal(summary.directIeltsRows, 52);
  assert.equal(summary.noDirectIeltsRows, 5);
  assert.equal(summary.curriculumRows, 1);
  assert.equal(summary.emptyCurriculumRows, 56);
  assert.equal(summary.careerRows, 53);
  assert.equal(summary.emptyCareerRows, 4);
  assert.deepEqual(summary.publicDisplayStatusCounts, { "needs-review": 57 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "needs-review": 57 });
  assert.deepEqual(summary.feeAuditStatusCounts, { "not-published": 57 });

  assert.ok(rows.every((row) => String(row.slug).startsWith(LUC_OFFICIAL_AUDIT_SLUG_PREFIX)));
  assert.ok(rows.every((row) => row.isPublished === false));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "needs-review"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "needs-review"));
  assert.ok(rows.every((row) => row.officialFeeAuditStatus === "not-published"));
  assert.ok(rows.every((row) => row.tuitionAmount === null));
  assert.ok(rows.every((row) => row.officialTuitionMYR === null));
  assert.ok(rows.every((row) => row.tuitionCurrency === "MYR"));
  assert.ok(rows.every((row) => String(row.tuitionDisplay).includes("not published")));
  assert.ok(rows.every((row) => String(row.officialSourceUrl).includes("lincoln.edu.my")));
  assert.ok(rows.every((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 2));

  const md = rows.find((row) => row.nameEnOfficial === "Doctor of Medicine (MD)");
  const dds = rows.find((row) => row.nameEnOfficial === "Doctor of Dental Surgery");
  assert.equal(md?.level, "bachelor");
  assert.equal(dds?.level, "bachelor");
  assert.match(String(md?.reviewReason), /mapping requires Ian decision/i);
  assert.match(String(dds?.reviewReason), /mapping requires Ian decision/i);
});

test("LUC review import university row is hidden and carries review-only controls", () => {
  const rows = buildLucOfficialAuditRows(source);
  const summary = summarizeLucOfficialAuditImport(rows);
  const university = buildLucUniversityRow(source, summary);

  assert.equal(university.code, "LUC");
  assert.equal(university.slug, "lincoln-university-college");
  assert.equal(university.nameEnOfficial, "Lincoln University College");
  assert.equal(university.isPublished, false);
  assert.equal(university.publicDisplayStatus, "needs-review");
  assert.equal(university.officialSourceStatus, "needs-review");
  assert.equal(university.programCount, 57);
  assert.equal((university.officialProfile as any)?.lucReviewImport?.workflowAcceptance?.importedReviewRows, 57);
  assert.equal((university.officialProfile as any)?.lucReviewImport?.reviewOnlyControls?.publicLeakageExpected, 0);
  assert.ok(Array.isArray(university.officialSources));
  assert.ok(university.officialSources?.some((sourceLink) => sourceLink.url === "https://www.lincoln.edu.my/"));
  assert.ok(university.officialSources?.some((sourceLink) => sourceLink.url === "https://www.lincoln.edu.my/category/bachelor/"));
});

test("LUC review rows stay out of the default public university and programme surfaces", async () => {
  const rows = buildLucOfficialAuditRows(source).map((row, index) => ({
    ...row,
    id: index + 1,
    universityId: 77
  }));
  const summary = summarizeLucOfficialAuditImport(rows);
  const hiddenUniversity = {
    ...buildLucUniversityRow(source, summary),
    id: 77,
    programs: rows,
    programCount: rows.length
  };
  const universitiesService = new UniversitiesService(
    {
      findOne: async (options: { where?: { isPublished?: boolean; publicDisplayStatus?: string } }) => {
        assert.equal(options.where?.isPublished, true);
        assert.equal(options.where?.publicDisplayStatus, "ready");
        return null;
      }
    } as any,
    { find: async () => rows } as any,
    { find: async () => [] } as any,
    { getJson: async () => null, setJson: async () => undefined } as any
  );
  const programsService = new ProgramsService(
    {
      findOne: async (options: { where?: { isPublished?: boolean } }) => {
        assert.equal(options.where?.isPublished, true);
        return null;
      }
    } as any,
    { findOneBy: async () => hiddenUniversity } as any,
    { getJson: async () => null, setJson: async () => undefined } as any
  );

  await assert.rejects(
    () => universitiesService.getBySlug("lincoln-university-college"),
    /University not found/
  );
  await assert.rejects(
    () => programsService.getByIdentifier(String(rows[0].slug)),
    /Program not found/
  );
  assert.ok(rows.every((row) => row.publicDisplayStatus === "needs-review"));
  assert.ok(rows.every((row) => row.isPublished === false));
});

test("LUC review preview university endpoint exposes hidden rows only with the LUC key", async () => {
  const rows = buildLucOfficialAuditRows(source).map((row, index) => ({
    ...row,
    id: index + 1,
    universityId: 77
  }));
  const summary = summarizeLucOfficialAuditImport(rows);
  const hiddenUniversity = {
    ...buildLucUniversityRow(source, summary),
    id: 77,
    programs: rows,
    programCount: rows.length
  };
  const universitiesService = new UniversitiesService(
    {
      findOne: async (options: { where?: { code?: string } }) => {
        assert.equal(options.where?.code, "LUC");
        return hiddenUniversity;
      }
    } as any,
    {
      find: async (options: { where?: { universityId?: number } }) => {
        assert.equal(options.where?.universityId, hiddenUniversity.id);
        return rows;
      }
    } as any,
    { find: async () => [] } as any,
    { getJson: async () => null, setJson: async () => undefined } as any
  );

  const preview = await universitiesService.getReviewPreview("lincoln-university-college", "luc-official-audit-2026") as any;

  assert.equal(preview.slug, "lincoln-university-college");
  assert.equal(preview.programs.length, 57);
  assert.equal(preview.reviewPreview.scope, "LUC official audit review");
  assert.equal(preview.reviewPreview.programmeCount, 57);
  assert.equal(preview.catalogStatusSummary.all.total, 57);
  assert.equal(preview.catalogStatusSummary.all.ready, 0);
  assert.equal(preview.catalogStatusSummary.all.needsReview, 57);
  assert.ok(preview.programs.every((program: { slug: string; publicDisplayStatus: string }) =>
    program.slug.startsWith(LUC_OFFICIAL_AUDIT_SLUG_PREFIX) && program.publicDisplayStatus === "needs-review"
  ));

  await assert.rejects(
    () => universitiesService.getReviewPreview("lincoln-university-college", "msu-official-audit-2026"),
    /University not found/
  );
  await assert.rejects(
    () => universitiesService.getReviewPreview("management-and-science-university", "luc-official-audit-2026"),
    /University not found/
  );
});

test("LUC review preview programme endpoint exposes hidden rows only with the LUC key", async () => {
  const rows = buildLucOfficialAuditRows(source).map((row, index) => ({
    ...row,
    id: index + 1,
    universityId: 77
  }));
  const summary = summarizeLucOfficialAuditImport(rows);
  const hiddenUniversity = {
    ...buildLucUniversityRow(source, summary),
    id: 77,
    programs: rows,
    programCount: rows.length
  };
  const selectedProgram = {
    ...rows[0],
    university: hiddenUniversity
  };
  const programsService = new ProgramsService(
    {
      findOne: async () => selectedProgram
    } as any,
    { findOneBy: async () => hiddenUniversity } as any,
    { getJson: async () => null, setJson: async () => undefined } as any
  );

  const preview = await programsService.getReviewPreviewByIdentifier(String(selectedProgram.slug), "luc-official-audit-2026") as any;

  assert.equal(preview.slug, selectedProgram.slug);
  assert.equal(preview.publicDisplayStatus, "needs-review");
  assert.equal(preview.officialFeeAuditStatus, "not-published");
  assert.equal(preview.reviewPreview.scope, "LUC official audit review");
  assert.equal(preview.directTarget.universitySlug, "lincoln-university-college");

  await assert.rejects(
    () => programsService.getReviewPreviewByIdentifier(String(selectedProgram.slug), "msu-official-audit-2026"),
    /Program not found/
  );
});
