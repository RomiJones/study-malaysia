import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIiumMasterRows,
  loadIiumMasterAudit,
  summarizeIiumMasterImport,
  validateIiumMasterAudit
} from "../../apps/api/src/db/import-iium-master-official.ts";

const audit = loadIiumMasterAudit();

test("IIUM master review import maps all official rows into public review records", () => {
  assert.deepEqual(validateIiumMasterAudit(audit), []);

  const rows = buildIiumMasterRows(audit);
  const summary = summarizeIiumMasterImport(rows);

  assert.equal(audit.programmes.length, 81);
  assert.equal(rows.length, 81);
  assert.equal(summary.importRows, 81);
  assert.deepEqual(summary.byLevel, { bachelor: 0, master: 81, phd: 0 });
  assert.equal(summary.readyRows, 81);
  assert.equal(summary.publishedRows, 81);
  assert.equal(summary.uniqueSlugs, 81);
  assert.equal(summary.officialFeeRows, 81);
  assert.equal(summary.directIeltsRows, 81);
  assert.equal(summary.languageCoverageRows, 81);
  assert.equal(summary.eptMentionRows, 81);
  assert.equal(summary.chineseNameRows, 81);
  assert.equal(summary.chineseFacultyRows, 81);
  assert.equal(summary.curriculumDisplayRows, 81);
  assert.equal(summary.officialCurriculumRows, 6);
  assert.equal(summary.careerDisplayRows, 81);
  assert.equal(summary.officialCareerRows, 5);
  assert.equal(summary.inferredCareerRows, 76);
  assert.equal(summary.sourceRows, 81);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 81 });
  assert.deepEqual(summary.feeAuditStatusCounts, { "matched-official": 81 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 81 });

  assert.ok(rows.every((row) => row.level === "master"));
  assert.ok(rows.every((row) => row.isPublished));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => (row.sourceUrls || []).length >= 5));
  assert.ok(rows.every((row) => row.officialLanguageRequirement?.includes("IIUM-administered English Proficiency Test")));
  assert.ok(rows.every((row) => row.officialIntake?.includes("throughout the year")));
  assert.ok(rows.every((row) => Array.isArray(row.intakeMonths) && row.intakeMonths.length === 0));

  const comparativeLaws = rows.find((row) => row.code === "IIUM-MAST-001");
  assert.equal(comparativeLaws?.name?.["zh-CN"], "比较法硕士（Master of Comparative Laws）");
  assert.equal(comparativeLaws?.tuitionAmount, 26270);
  assert.equal(comparativeLaws?.languageRequirement?.ielts, 6);
  assert.match(String(comparativeLaws?.officialLanguageRequirement), /EPT/);

  const architecture = rows.find((row) => row.code === "IIUM-MAST-035");
  assert.equal(architecture?.tuitionAmount, 42551);
  assert.deepEqual(architecture?.careers?.["zh-CN"], [
    "专业建筑师路径",
    "建筑与建造行业从业者",
    "城市规划与发展相关岗位",
    "学术机构岗位",
    "政府或半政府部门岗位"
  ]);

  const dental = rows.find((row) => row.code === "IIUM-MAST-078");
  assert.equal(dental?.tuitionAmount, 39030);
  assert.equal(dental?.languageRequirement?.toefl, 550);
  assert.match(String(dental?.officialLanguageRequirement), /IIUM-administered English Proficiency Test/);

  const healthAllied = rows.find((row) => row.code === "IIUM-MAST-061");
  const healthMedicine = rows.find((row) => row.code === "IIUM-MAST-072");
  assert.equal(healthAllied?.nameEnOfficial, "Master of Health Sciences");
  assert.equal(healthMedicine?.nameEnOfficial, "Master of Health Sciences");
  assert.notEqual(healthAllied?.slug, healthMedicine?.slug);
  assert.equal(healthAllied?.tuitionAmount, 33030);
  assert.equal(healthMedicine?.tuitionAmount, 34230);
});
