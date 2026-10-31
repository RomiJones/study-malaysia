import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_MUM_OFFICIAL_AUDIT_CANDIDATE_PATH,
  buildMumOfficialAuditRows,
  buildMumUniversityRow,
  summarizeMumOfficialAuditImport,
  validateMumOfficialAuditDataset
} from "../../apps/api/src/db/import-mum-official-audit.ts";

const source = JSON.parse(readFileSync(DEFAULT_MUM_OFFICIAL_AUDIT_CANDIDATE_PATH, "utf8"));
const monashGraduateResearchAdmissionCriteriaUrl = "https://www.monash.edu/graduate-research/study/apply/admission-criteria";
const monashOfficialAddress = "Monash University Malaysia, Jalan Lagoon Selatan, 47500 Bandar Sunway, Selangor Darul Ehsan, Malaysia";

test("MUM official audit import keeps all bachelor/master/phd rows in review-only status", () => {
  assert.deepEqual(validateMumOfficialAuditDataset(source), []);

  const rows = buildMumOfficialAuditRows(source);
  const summary = summarizeMumOfficialAuditImport(rows);

  assert.equal(rows.length, 60);
  assert.deepEqual(summary.byLevel, { bachelor: 36, master: 17, phd: 7 });
  assert.equal(summary.readyRows, 0);
  assert.equal(summary.needsReviewRows, 60);
  assert.equal(summary.publishedRows, 0);
  assert.equal(summary.uniqueSlugs, 60);
  assert.equal(summary.officialRateRows, 51);
  assert.equal(summary.officialTotalRows, 9);
  assert.deepEqual(summary.publicDisplayStatusCounts, { "needs-review": 60 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "needs-review": 60 });
  assert.deepEqual(summary.feeAuditStatusCounts, {
    "official-rate-verified": 51,
    "matched-official": 9
  });

  assert.ok(rows.every((row) => row.isPublished === false));
  assert.ok(rows.every((row) => row.code && String(row.code).length <= 50));
  assert.ok(rows.every((row) => !/\|\s*Course\s*\|/i.test(String(row.faculty?.en || ""))));
  assert.ok(rows.every((row) => Number(row.durationYears) > 0));
  assert.ok(rows.every((row) => row.tuitionCurrency === "MYR"));
  assert.ok(rows.every((row) => row.officialFeeSourceUrl?.includes("monash.edu.my")));

  const fullCourseRows = rows.filter((row) => row.officialFeeAuditStatus === "matched-official");
  const rateRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified");
  assert.ok(fullCourseRows.every((row) => row.tuitionAmount != null && /full course/i.test(String(row.tuitionDisplay))));
  assert.ok(rateRows.every((row) => row.tuitionAmount == null && /per year/i.test(String(row.tuitionDisplay))));
  assert.ok(rateRows.every((row) => /must not display this as full-duration total tuition/i.test(String(row.officialTuitionNote))));
});

test("MUM official audit import can publish authorized rate-derived tuition rows", () => {
  const options = { publish: true, allowRateDerived: true };
  assert.deepEqual(validateMumOfficialAuditDataset(source, options), []);

  const rows = buildMumOfficialAuditRows(source, options);
  const summary = summarizeMumOfficialAuditImport(rows);

  assert.equal(rows.length, 60);
  assert.deepEqual(summary.byLevel, { bachelor: 36, master: 17, phd: 7 });
  assert.equal(summary.readyRows, 60);
  assert.equal(summary.needsReviewRows, 0);
  assert.equal(summary.publishedRows, 60);
  assert.equal(summary.officialRateRows, 0);
  assert.equal(summary.officialTotalRows, 9);
  assert.equal(summary.calculatedFromOfficialRateRows, 51);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 60 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 60 });
  assert.deepEqual(summary.feeAuditStatusCounts, {
    "calculated-from-official-rate": 51,
    "matched-official": 9
  });

  const calculatedRows = rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate");
  assert.ok(rows.every((row) => row.isPublished === true));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => Number(row.durationYears) > 0));
  assert.ok(rows.every((row) => Number(row.annualTuitionCny) > 0));
  assert.ok(rows.every((row) => Number(row.tuitionAmount) > 0));
  assert.ok(calculatedRows.every((row) => /Formula:/i.test(String(row.officialTuitionNote))));
  assert.ok(calculatedRows.every((row) => /official annual/i.test(String(row.officialTuitionNote))));

  const phdRows = rows.filter((row) => row.level === "phd");
  assert.equal(phdRows.length, 7);
  assert.ok(phdRows.every((row) => row.officialEntryRequirementSourceUrl === monashGraduateResearchAdmissionCriteriaUrl));
  assert.ok(phdRows.every((row) => /Second Class Honours Division A|honours 1 or 2A|honours 2A/i.test(String(row.officialAcademicRequirement))));
  assert.ok(phdRows.every((row) => Number(row.requirement?.gpa || 0) === 0));
  assert.ok(phdRows.every((row) => JSON.stringify(row.sourceUrls).includes(monashGraduateResearchAdmissionCriteriaUrl)));
});

test("MUM publication keeps Monash parent QS WUR 2027 ranking for list sorting", () => {
  const options = { publish: true, allowRateDerived: true };
  const rows = buildMumOfficialAuditRows(source, options);
  const summary = summarizeMumOfficialAuditImport(rows);
  const university = buildMumUniversityRow(source, summary, { ...options, dbCode: "MONASH", shortName: "Monash", qsRank: 9999 });
  const qsWorld = (university.officialProfile as any)?.rankings?.qsWorld;

  assert.equal(university.qsRank, 31);
  assert.equal(university.students, 13800);
  assert.equal(university.intlStudents, 0);
  assert.equal(university.officialAddress, monashOfficialAddress);
  assert.equal(qsWorld?.year, 2027);
  assert.equal(qsWorld?.rankDisplay, "31");
  assert.equal(qsWorld?.context, "parent-institution");
  assert.ok(JSON.stringify((university.officialProfile as any)?.scale).includes("91 countries"));
});
