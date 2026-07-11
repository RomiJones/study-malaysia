import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_UNM_OFFICIAL_AUDIT_CANDIDATE_PATH,
  buildUnmUniversityRow,
  buildUnmOfficialProgramRows,
  summarizeUnmOfficialAuditImport,
  validateUnmOfficialAuditDataset,
  type UNMCandidateDataset
} from "../../apps/api/src/db/import-unm-official-audit.ts";

const source = JSON.parse(readFileSync(DEFAULT_UNM_OFFICIAL_AUDIT_CANDIDATE_PATH, "utf8")) as UNMCandidateDataset;

test("UNM official audit import publishes all official rows without merging PGCert or PGDip", () => {
  assert.deepEqual(validateUnmOfficialAuditDataset(source), []);

  const rows = buildUnmOfficialProgramRows(source);
  const summary = summarizeUnmOfficialAuditImport(rows);
  const universityRow = buildUnmUniversityRow(source, summary);
  const officialTotalRows = rows.filter((row) => row.officialFeeAuditStatus === "matched-official");
  const calculatedRows = rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate");
  const pgCertRows = rows.filter((row) => row.level === "postgraduate-certificate");
  const pgDipRows = rows.filter((row) => row.level === "postgraduate-diploma");
  const chineseNames = rows.map((row) => String(row.name?.["zh-CN"] || ""));
  const chineseFaculties = rows.map((row) => String(row.faculty?.["zh-CN"] || ""));

  assert.equal(source.programmes.length, 81);
  assert.equal(rows.length, 81);
  assert.equal(summary.candidateRows, 81);
  assert.equal(summary.importRows, 81);
  assert.deepEqual(summary.byLevel, {
    bachelor: 36,
    master: 28,
    "postgraduate-certificate": 1,
    "postgraduate-diploma": 1,
    phd: 15
  });
  assert.equal(summary.readyRows, 81);
  assert.equal(summary.needsReviewRows, 0);
  assert.equal(summary.publishedRows, 81);
  assert.equal(summary.uniqueSlugs, 81);
  assert.equal(summary.officialTotalRows, 13);
  assert.equal(summary.calculatedFromOfficialRateRows, 68);
  assert.equal(summary.officialDurationRows, 81);
  assert.equal(summary.applicationDocumentRows, 81);
  assert.equal(summary.localizedNameRows, 81);
  assert.equal(summary.localizedFacultyRows, 81);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 81 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 81 });
  assert.deepEqual(summary.feeAuditStatusCounts, {
    "calculated-from-official-rate": 68,
    "matched-official": 13
  });

  assert.equal(pgCertRows.length, 1);
  assert.equal(pgDipRows.length, 1);
  assert.equal(pgCertRows[0].nameEnOfficial, "Postgraduate Certificate in Education");
  assert.equal(pgDipRows[0].nameEnOfficial, "Postgraduate Diploma in Education");
  assert.equal(pgCertRows[0].tuitionAmount, 26000);
  assert.equal(pgDipRows[0].tuitionAmount, 40000);
  assert.notEqual(pgCertRows[0].slug, pgDipRows[0].slug);
  assert.notEqual(pgCertRows[0].code, pgDipRows[0].code);

  assert.ok(rows.every((row) => String(row.slug).startsWith("unm-official-2026-row-")));
  assert.ok(rows.every((row) => row.isPublished));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => row.code && String(row.code).length <= 50));
  assert.ok(rows.every((row) => row.tuitionCurrency === "MYR"));
  assert.ok(rows.every((row) => row.tuitionAmount != null && Number(row.tuitionAmount) > 0));
  assert.ok(rows.every((row) => row.officialTuitionMYR != null && Number(row.officialTuitionMYR) > 0));
  assert.ok(rows.every((row) => row.officialFeeSourceUrl?.includes("nottingham.edu.my")));
  assert.ok(rows.every((row) => row.officialSourceUrl?.includes("nottingham.edu.my")));
  assert.ok(rows.every((row) => (row.sourceUrls || []).some((source) => source.url.includes("checklist-for-applications"))));
  assert.ok(rows.every((row) => (row.applicationDocs?.en || []).some((doc) => /certificates, transcripts/i.test(doc))));
  assert.ok(rows.every((row) => (row.applicationDocs?.["zh-CN"] || []).some((doc) => /证书|成績|成绩/.test(doc))));
  assert.ok(calculatedRows.every((row) => /calculated the standard full-duration total/i.test(String(row.officialTuitionNote))));
  assert.ok(calculatedRows.every((row) => /official annual rate/i.test(String(row.officialTuitionNote))));
  assert.ok(officialTotalRows.every((row) => /per-programme total/i.test(String(row.officialTuitionNote))));
  assert.ok(chineseNames.every((name) => !/Bachelor|Master of|Master in|Postgraduate Certificate|Postgraduate Diploma|School of|Department of/i.test(name)));
  assert.ok(chineseFaculties.every((faculty) => !/School of|Department of|Faculty of|Institute of/i.test(faculty)));

  assert.equal(rows.find((row) => row.nameEnOfficial === "BSc (Hons) Computer Science with Artificial Intelligence")?.name?.["zh-CN"], "计算机科学与人工智能理学荣誉学士");
  assert.equal(rows.find((row) => row.nameEnOfficial === "Business and Management PhD")?.name?.["zh-CN"], "商业与管理博士");
  assert.equal(rows.find((row) => row.nameEnOfficial === "Postgraduate Certificate in Education")?.name?.["zh-CN"], "教育研究生证书");
  assert.equal(rows.find((row) => row.nameEnOfficial === "Postgraduate Diploma in Education")?.name?.["zh-CN"], "教育研究生文凭");
  assert.equal((universityRow.officialProfile as any).catalogStatusSummary.all.currentCycleNotOpen, 0);
  assert.equal((universityRow.officialProfile as any).catalogStatusSummary.byLevel["postgraduate-certificate"].currentCycleNotOpen, 0);
  assert.equal((universityRow.officialProfile as any).catalogStatusSummary.byLevel["postgraduate-diploma"].currentCycleNotOpen, 0);
});
