import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIiumDoctoralRows,
  loadIiumDoctoralAudit,
  summarizeIiumDoctoralImport,
  validateIiumDoctoralAudit
} from "../../apps/api/src/db/import-iium-doctoral-official.ts";

const audit = loadIiumDoctoralAudit();

test("IIUM doctoral review import maps all official rows into public review records", () => {
  assert.deepEqual(validateIiumDoctoralAudit(audit), []);

  const rows = buildIiumDoctoralRows(audit);
  const summary = summarizeIiumDoctoralImport(rows);

  assert.equal(audit.programmes.length, 35);
  assert.equal(rows.length, 35);
  assert.equal(summary.importRows, 35);
  assert.deepEqual(summary.byLevel, { bachelor: 0, master: 0, phd: 35 });
  assert.equal(summary.readyRows, 35);
  assert.equal(summary.publishedRows, 35);
  assert.equal(summary.uniqueSlugs, 35);
  assert.equal(summary.officialFeeRows, 35);
  assert.equal(summary.directIeltsRows, 35);
  assert.equal(summary.languageCoverageRows, 35);
  assert.equal(summary.eptMentionRows, 35);
  assert.equal(summary.chineseNameRows, 35);
  assert.equal(summary.chineseFacultyRows, 35);
  assert.equal(summary.curriculumDisplayRows, 35);
  assert.equal(summary.careerDisplayRows, 35);
  assert.equal(summary.sourceRows, 35);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 35 });
  assert.deepEqual(summary.feeAuditStatusCounts, { "matched-official": 35 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 35 });

  assert.ok(rows.every((row) => row.level === "phd"));
  assert.ok(rows.every((row) => row.isPublished));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => (row.sourceUrls || []).length >= 5));
  assert.ok(rows.every((row) => row.officialLanguageRequirement?.includes("IIUM-administered English Proficiency Test")));
  assert.ok(rows.every((row) => row.officialIntake?.includes("throughout the year")));
  assert.ok(rows.every((row) => Array.isArray(row.intakeMonths) && row.intakeMonths.length === 0));

  const law = rows.find((row) => row.code === "IIUM-PHD-001");
  assert.equal(law?.name?.["zh-CN"], "法学哲学博士（Doctor of Philosophy (Law) - Research Only）");
  assert.equal(law?.tuitionAmount, 51538);
  assert.equal(law?.languageRequirement?.ielts, 6);
  assert.match(String(law?.officialTuitionNote), /RM 51,537\.50/);
  assert.match(String(law?.officialLanguageRequirement), /EPT/);

  const doctoralGeneric = rows.find((row) => row.code === "IIUM-PHD-003");
  assert.equal(doctoralGeneric?.nameEnOfficial, "Doctor of Philosophy");
  assert.equal(doctoralGeneric?.tuitionAmount, 43298);

  const orthodontics = rows.find((row) => row.code === "IIUM-PHD-030");
  assert.equal(orthodontics?.nameEnOfficial, "Doctor in Orthodontics");
  assert.equal(orthodontics?.tuitionAmount, 540250);
  assert.equal(orthodontics?.languageRequirement?.ielts, 6);

  const istac = rows.find((row) => row.code === "IIUM-PHD-035");
  assert.equal(istac?.nameEnOfficial, "Doctor of Philosophy in Islamic Thought and Civilization");
  assert.equal(istac?.tuitionAmount, 53450);
});
