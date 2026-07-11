import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_UTM_PHD_CANDIDATE_PATH,
  DEFAULT_UTM_PHD_ROW_DISPOSAL_PATH,
  buildUtmPhdProgramRows,
  summarizeUtmPhdImport,
  validateUtmPhdCandidate,
  type UTMPhdCandidateDataset,
  type UTMPhdOfficialRowDisposal
} from "../../apps/api/src/db/import-utm-phd-official.ts";

const source = JSON.parse(readFileSync(DEFAULT_UTM_PHD_CANDIDATE_PATH, "utf8")) as UTMPhdCandidateDataset;
const rowDisposal = JSON.parse(readFileSync(DEFAULT_UTM_PHD_ROW_DISPOSAL_PATH, "utf8")) as UTMPhdOfficialRowDisposal[];

test("UTM doctoral import publishes 55 canonical rows and preserves DPP cross-faculty evidence", () => {
  assert.deepEqual(validateUtmPhdCandidate(source, rowDisposal), []);

  const rows = buildUtmPhdProgramRows(source, rowDisposal);
  const summary = summarizeUtmPhdImport(source, rows, rowDisposal);
  const officialTotalRows = rows.filter((row) => row.officialFeeAuditStatus === "matched-official");
  const calculatedRows = rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate");
  const rateOnlyRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified");
  const nonScalarRows = rows.filter((row) => row.officialFeeAuditStatus === "official-non-scalar");
  const dpp = rows.find((row) => row.code === "UTM-PHD-005");
  const edd = rows.find((row) => row.code === "UTM-PHD-023");
  const tesl = rows.find((row) => row.code === "UTM-PHD-036");
  const courseSettingRows = rows.filter((row) => (row.curriculum?.en || []).length > 0);

  assert.equal(source.programmes.length, 55);
  assert.equal(rows.length, 55);
  assert.equal(summary.candidateRows, 55);
  assert.equal(summary.importRows, 55);
  assert.equal(summary.readyRows, 55);
  assert.equal(summary.uniqueSlugs, 55);
  assert.equal(summary.officialDurationRows, 55);
  assert.equal(summary.officialTotalFeeRows, 54);
  assert.equal(summary.calculatedFromOfficialRateRows, 1);
  assert.equal(summary.officialRateOnlyRows, 0);
  assert.equal(summary.officialNonScalarRows, 0);
  assert.equal(summary.noScalarTotalRows, 0);
  assert.equal(summary.officialAcademicRequirementRows, 55);
  assert.equal(summary.dppOfficialOccurrenceRows, 8);
  assert.ok(rows.every((row) => row.level === "phd"));
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 55 });
  assert.deepEqual(summary.feeAuditStatusCounts, { "matched-official": 54, "calculated-from-official-rate": 1 });
  assert.ok(rows.every((row) => String(row.slug).startsWith("utm-phd-official-2026-")));
  assert.ok(rows.every((row) => row.isPublished));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => (row.sourceUrls || []).length >= 5));
  assert.ok(rows.every((row) => Number(row.durationYears || 0) > 0));
  assert.ok(rows.every((row) => /^Standardized duration:\s*(?:3 years|3-8 years)\b/i.test(String(row.durationOfficial))));
  assert.ok(rows.every((row) => Number(row.languageRequirement?.ielts || 0) >= 6));
  assert.ok(rows.every((row) => /Master's Degree|master's degree|硕士|碩士/i.test(String(row.officialAcademicRequirement))));
  assert.equal(courseSettingRows.length, 42);
  assert.ok(rows.every((row) => (row.careers?.en || []).length === 0));
  assert.equal(officialTotalRows.length, 54);
  assert.ok(officialTotalRows.every((row) => row.officialTuitionMYR != null && row.tuitionAmount != null));
  assert.equal(calculatedRows.length, 1);
  assert.equal(calculatedRows[0].code, "UTM-PHD-005");
  assert.equal(calculatedRows[0].tuitionAmount, 71490);
  assert.equal(calculatedRows[0].officialTuitionMYR, 71490);
  assert.equal(calculatedRows[0].tuitionDisplay, "MYR 71,490 calculated standard minimum total tuition");
  assert.match(String(calculatedRows[0].officialTuitionNote), /2,670 registration fee/i);
  assert.match(String(calculatedRows[0].officialTuitionNote), /1,470 service fee x 6/i);
  assert.match(String(calculatedRows[0].officialTuitionNote), /750 study fee x 80 credits/i);
  assert.match(String(calculatedRows[0].officialTuitionNote), /RM 71,490 - RM 86,190/i);
  assert.equal(rateOnlyRows.length, 0);
  assert.equal(nonScalarRows.length, 0);
  assert.equal(rows.filter((row) => row.nameEnOfficial === "Doctor of Professional Practice (DPP)").length, 1);
  assert.equal(dpp?.faculty?.["zh-CN"], "跨学院 ODL 协作项目");
  assert.equal(dpp?.faculty?.["zh-TW"], "跨學院 ODL 協作項目");
  assert.equal(dpp?.durationYears, 3);
  assert.match(String(dpp?.durationOfficial), /^Standardized duration: 3-8 years \(6-16 semesters\)/i);
  assert.equal(dpp?.specializations?.en.length, 8);
  assert.ok(dpp?.specializations?.["zh-TW"].every((item) => !/[现协]/.test(item)));
  assert.equal((dpp?.sourceUrls || []).filter((link) => /^UTM official DPP occurrence:/.test(link.title)).length, 8);
  assert.equal((dpp?.sourceUrls || []).filter((link) => link.title === "UTM ODL DPP per-credit fee structure").length, 1);
  assert.match(String(dpp?.specialRequirementsNote), /8 UTM faculty pages/i);
  assert.match(String(dpp?.description?.["zh-CN"]), /8 个学院页面/);
  assert.equal(edd?.studyMode, "Mixed Mode / Full-Time / Part-Time");
  assert.equal(edd?.tuitionAmount, 49100);
  assert.equal(edd?.officialTuitionMYR, 49100);
  assert.equal(edd?.tuitionDisplay, "MYR 49,100 total programme fee");
  assert.match(String(edd?.officialTuitionNote), /programme-specific EdD international tuition total/i);
  assert.deepEqual(edd?.intakeMonths, ["March", "October"]);
  assert.equal(edd?.specializations?.en.length, 9);
  assert.ok(edd?.specializations?.en.includes("STEM Education"));
  assert.match(String(edd?.curriculum?.["zh-CN"]?.[0]), /课程学习与论文/);
  assert.match(String(edd?.curriculum?.["zh-CN"]?.[1]), /STEM 教育/);
  assert.match(String(edd?.specialRequirementsNote), /multiple concentrations/i);
  assert.match(String(edd?.officialAcademicRequirement), /two \(2\) years of work experience/i);
  assert.equal((edd?.sourceUrls || []).filter((link) => link.title === "UTM FEST EdD official programme detail").length, 1);
  assert.equal((edd?.sourceUrls || []).some((link) => /^UTM official DPP occurrence:/.test(link.title)), false);
  assert.deepEqual(tesl?.languageRequirement, { ielts: 7, toefl: 95, pte: 76, muet: 5 });
  assert.match(String(tesl?.officialLanguageRequirement), /TESL postgraduate programmes/i);
  assert.deepEqual(rows.find((row) => row.code === "UTM-PHD-003")?.curriculum?.["zh-CN"], ["博士专业方向：建筑技术与管理"]);
  assert.deepEqual(rows.find((row) => row.code === "UTM-PHD-007")?.curriculum?.["zh-CN"], ["研究领域：化学工程"]);
  assert.equal(rows.find((row) => row.code === "UTM-PHD-050")?.name?.["zh-CN"], "工商管理博士（DBA）");
  assert.equal(rows.find((row) => row.code === "UTM-PHD-052")?.name?.["zh-CN"], "工程博士（工程商业管理）");
});
