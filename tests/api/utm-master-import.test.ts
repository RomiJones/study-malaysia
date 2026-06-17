import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_UTM_MASTER_CANDIDATE_PATH,
  buildUtmMasterProgramRows,
  summarizeUtmMasterImport,
  validateUtmMasterCandidate,
  type UTMMasterCandidateDataset
} from "../../apps/api/src/db/import-utm-master-official.ts";

const source = JSON.parse(readFileSync(DEFAULT_UTM_MASTER_CANDIDATE_PATH, "utf8")) as UTMMasterCandidateDataset;

test("UTM master import keeps all official rows and preserves fee-status boundaries", () => {
  assert.deepEqual(validateUtmMasterCandidate(source), []);

  const rows = buildUtmMasterProgramRows(source);
  const summary = summarizeUtmMasterImport(source, rows);
  const officialTotalRows = rows.filter((row) => row.officialFeeAuditStatus === "matched-official");
  const calculatedRows = rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate");
  const rateOnlyRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified");
  const conflictRows = rows.filter((row) => row.officialFeeAuditStatus === "not-published");
  const chineseNames = rows.map((row) => String(row.name?.["zh-CN"] || ""));
  const chineseFaculties = rows.map((row) => String(row.faculty?.["zh-CN"] || ""));

  assert.equal(source.programmes.length, 153);
  assert.equal(rows.length, 153);
  assert.equal(summary.candidateRows, 153);
  assert.equal(summary.importRows, 153);
  assert.equal(summary.readyRows, 153);
  assert.equal(summary.uniqueSlugs, 153);
  assert.equal(summary.academicRequirementGpaRows, 153);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 153 });
  assert.equal(officialTotalRows.length, 132);
  assert.equal(calculatedRows.length, 14);
  assert.equal(rateOnlyRows.length, 0);
  assert.equal(conflictRows.length, 7);
  assert.ok(rows.every((row) => row.isPublished));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => (row.sourceUrls || []).length >= 5));
  assert.ok(rows.every((row) => Number(row.requirement?.gpa || 0) > 0));
  assert.ok(rows.every((row) => /CPA|CGPA/i.test(String(row.officialAcademicRequirement))));
  assert.ok(officialTotalRows.every((row) => row.officialTuitionMYR != null && row.tuitionAmount != null));
  assert.ok(calculatedRows.every((row) => row.officialTuitionMYR === 34650 && row.tuitionAmount === 34650));
  assert.ok(calculatedRows.every((row) => /MYR 34,650 calculated total tuition/i.test(String(row.tuitionDisplay))));
  assert.ok(calculatedRows.every((row) => /2,670.*1,470.*4.*580.*45.*34,650/i.test(String(row.officialTuitionNote))));
  assert.ok(conflictRows.every((row) => row.officialTuitionMYR == null && row.tuitionAmount == null));
  assert.ok(conflictRows.every((row) => /Official fee variants: MYR/i.test(String(row.tuitionDisplay))));
  assert.ok(chineseNames.every((name) => !/Master of|Master in|Field of Research|Official master/i.test(name)));
  assert.ok(chineseFaculties.every((faculty) => !/Faculty of|School of|Academy|Institute|Programmes/i.test(faculty)));
  assert.equal(rows.find((row) => row.code === "UTM-M-107")?.name?.["zh-CN"], "数据科学硕士");
  assert.equal(rows.find((row) => row.code === "UTM-M-107")?.requirement?.gpa, 2.5);
  assert.equal(rows.find((row) => row.code === "UTM-M-107")?.faculty?.["zh-CN"], "计算学院");
  assert.equal(rows.find((row) => row.code === "UTM-M-113")?.name?.["zh-CN"], "哲学硕士（研究领域：软件工程）");
  assert.equal(rows.find((row) => row.code === "UTM-M-113")?.requirement?.gpa, 2.75);
  assert.equal(rows.find((row) => row.code === "UTM-M-129")?.name?.["zh-CN"], "工商管理硕士（MBA）");
  assert.equal(rows.find((row) => row.code === "UTM-M-129")?.requirement?.gpa, 3.5);
  assert.equal(rows.find((row) => row.code === "UTM-M-131")?.requirement?.gpa, 2.5);
  assert.equal(rows.find((row) => row.code === "UTM-M-095")?.requirement?.gpa, 2.3);
});
