import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_UTP_OFFICIAL_AUDIT_CANDIDATE_PATH,
  buildUtpOfficialAuditRows,
  buildUtpUniversityRow,
  summarizeUtpOfficialAuditImport,
  validateUtpOfficialAuditDataset
} from "../../apps/api/src/db/import-utp-official-audit.ts";

const source = JSON.parse(readFileSync(DEFAULT_UTP_OFFICIAL_AUDIT_CANDIDATE_PATH, "utf8"));

test("UTP official audit import keeps all bachelor/master/phd rows in review-only status", () => {
  assert.deepEqual(validateUtpOfficialAuditDataset(source), []);

  const rows = buildUtpOfficialAuditRows(source);
  const summary = summarizeUtpOfficialAuditImport(rows);

  assert.equal(rows.length, 63);
  assert.deepEqual(summary.byLevel, { bachelor: 15, master: 37, phd: 11 });
  assert.equal(summary.readyRows, 0);
  assert.equal(summary.needsReviewRows, 63);
  assert.equal(summary.publishedRows, 0);
  assert.equal(summary.uniqueSlugs, 63);
  assert.equal(summary.officialTotalRows, 41);
  assert.equal(summary.officialRateRows, 22);
  assert.equal(summary.calculatedFromOfficialRateRows, 0);
  assert.equal(summary.pendingFeeRows, 0);
  assert.deepEqual(summary.publicDisplayStatusCounts, { "needs-review": 63 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "needs-review": 63 });
  assert.deepEqual(summary.feeAuditStatusCounts, {
    "matched-official": 41,
    "official-rate-verified": 22
  });

  assert.ok(rows.every((row) => row.isPublished === false));
  assert.ok(rows.every((row) => row.code && String(row.code).length <= 50));
  assert.ok(rows.every((row) => row.slug && String(row.slug).startsWith("utp-official-2026-row-")));
  assert.ok(rows.every((row) => Number(row.durationYears) > 0));
  assert.ok(rows.every((row) => row.tuitionCurrency === "MYR"));
  assert.ok(rows.every((row) => Number(row.officialTuitionMYR) > 0));
  assert.ok(rows.every((row) => Number(row.annualTuitionCny) > 0));
  assert.ok(rows.every((row) => row.officialFeeSourceUrl?.includes("utp.edu.my")));
  assert.ok(rows.every((row) => row.name?.["zh-CN"] && row.name["zh-CN"] !== row.name?.en));
  assert.ok(rows.every((row) => row.name?.["zh-TW"] && row.name["zh-TW"] !== row.name?.en));
  const numericCgpaRows = rows.filter(
    (row) => row.level !== "phd" && /CGPA/i.test(String(row.officialAcademicRequirement))
  );
  assert.equal(numericCgpaRows.length, 52);
  assert.ok(numericCgpaRows.every((row) => Number(row.requirement?.gpa || 0) > 0));
  assert.equal(
    Number(rows.find((row) => row.nameEnOfficial === "MSc in Corrosion Engineering ODL")?.requirement?.gpa),
    2.5
  );
  assert.equal(
    Number(rows.find((row) => row.nameEnOfficial === "MSc in Electronic Systems Engineering (ODL)")?.requirement?.gpa),
    2.5
  );
  assert.equal(
    Number(rows.find((row) => row.nameEnOfficial === "Bachelor of Integrated Engineering with Honours")?.requirement?.gpa),
    3
  );
  const phdEee = rows.find((row) => row.nameEnOfficial === "PhD in Electrical and Electronic Engineering");
  assert.equal(Number(phdEee?.requirement?.gpa), 0);
  assert.match(String(phdEee?.officialAcademicRequirement), /Master's Degree/);

  const electronicSystemsOdl = rows.find((row) => row.nameEnOfficial === "MSc in Electronic Systems Engineering (ODL)");
  assert.doesNotMatch(String(electronicSystemsOdl?.careers?.en?.join(" ")), /Core Courses/i);
  assert.match(String(electronicSystemsOdl?.curriculum?.en?.join(" ")), /Advanced Engineering Mathematics/i);

  const officialTotalRows = rows.filter((row) => row.officialFeeAuditStatus === "matched-official");
  const rateRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified");

  assert.ok(officialTotalRows.every((row) => row.tuitionAmount != null && /total programme/i.test(String(row.tuitionDisplay))));
  assert.ok(rateRows.every((row) => row.tuitionAmount == null && Number(row.officialTuitionMYR) > 0));
  assert.ok(rateRows.every((row) => Number(row.annualTuitionCny) > 0 && /not full programme total/i.test(String(row.tuitionDisplay))));
  assert.ok(rateRows.every((row) => /must not display this as full-duration total tuition/i.test(String(row.officialTuitionNote))));
  assert.ok(rows.filter((row) => row.level === "phd").every((row) => Number(row.durationYears) === 3));
});

test("UTP official audit import can publish authorized research rate-derived tuition rows", () => {
  const options = { publish: true, allowRateDerived: true };
  assert.deepEqual(validateUtpOfficialAuditDataset(source), []);

  const rows = buildUtpOfficialAuditRows(source, options);
  const summary = summarizeUtpOfficialAuditImport(rows);

  assert.equal(rows.length, 63);
  assert.deepEqual(summary.byLevel, { bachelor: 15, master: 37, phd: 11 });
  assert.equal(summary.readyRows, 63);
  assert.equal(summary.needsReviewRows, 0);
  assert.equal(summary.publishedRows, 63);
  assert.equal(summary.uniqueSlugs, 63);
  assert.equal(summary.officialTotalRows, 41);
  assert.equal(summary.officialRateRows, 0);
  assert.equal(summary.calculatedFromOfficialRateRows, 22);
  assert.equal(summary.pendingFeeRows, 0);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 63 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 63 });
  assert.deepEqual(summary.feeAuditStatusCounts, {
    "calculated-from-official-rate": 22,
    "matched-official": 41
  });

  const calculatedRows = rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate");
  const phdRows = calculatedRows.filter((row) => row.level === "phd");
  const mphilRows = calculatedRows.filter((row) => row.nameEnOfficial === "Master of Philosophy");

  assert.ok(rows.every((row) => row.isPublished === true));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => Number(row.durationYears) > 0 && Number(row.durationYears) < 10));
  assert.ok(rows.every((row) => Number(row.annualTuitionCny) > 0));
  assert.ok(rows.every((row) => Number(row.officialTuitionMYR) > 0));
  assert.ok(rows.every((row) => row.name?.["zh-CN"] && row.name["zh-CN"] !== row.name?.en));
  assert.ok(calculatedRows.every((row) => Number(row.tuitionAmount) > 0));
  assert.ok(calculatedRows.every((row) => /Formula:/i.test(String(row.officialTuitionNote))));
  assert.ok(calculatedRows.every((row) => /official annual international fee/i.test(String(row.officialTuitionNote))));
  assert.ok(calculatedRows.every((row) => /calculated total tuition/i.test(String(row.tuitionDisplay))));
  assert.ok(phdRows.every((row) => Number(row.durationYears) === 3));
  assert.equal(phdRows.find((row) => row.nameEnOfficial === "PhD in Chemical Engineering")?.tuitionAmount, 57000);
  assert.equal(mphilRows[0]?.durationYears, 2);
  assert.equal(mphilRows[0]?.tuitionAmount, 19800);

  const university = buildUtpUniversityRow(source, summary, null, options);
  assert.equal(university.qsRank, 261);
  assert.equal(university.officialProfile?.rankings?.qsWorld?.rankDisplay, "=261");
  assert.equal(university.officialProfile?.rankings?.qsWorld?.year, 2027);
  assert.equal(university.officialProfile?.rankings?.qsWorld?.status, "ranked");
});
