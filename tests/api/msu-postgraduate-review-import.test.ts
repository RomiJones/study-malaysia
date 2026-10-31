import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMsuPostgraduateReviewRows,
  loadMsuPostgraduateCandidateDataset,
  MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX,
  summarizeMsuPostgraduateReviewImport,
  validateMsuPostgraduateCandidateDataset,
  verifyMsuPostgraduateRecordSet
} from "../../apps/api/src/db/import-msu-postgraduate-review.ts";
import type { LocalizedText } from "@studymy/shared";

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

describe("MSU postgraduate authorized non-official fee review import", () => {
  const dataset = loadMsuPostgraduateCandidateDataset();

  test("validates the MSU-only postgraduate candidate dataset", () => {
    assert.deepEqual(validateMsuPostgraduateCandidateDataset(dataset), []);
    assert.equal(dataset.sourceCoverage.officialUniquePostgraduateProgrammes, 30);
    assert.equal(dataset.sourceCoverage.master, 20);
    assert.equal(dataset.sourceCoverage.phd, 10);
    assert.equal(dataset.sourceCoverage.matchedAnnualTuitionRows, 27);
    assert.equal(dataset.sourceCoverage.missingAnnualTuitionRows, 3);
    assert.equal(dataset.sourceCoverage.easyUniPostgraduateRows, 0);
    assert.match(String(dataset.scope.authorization), /MSU-only/);
  });

  test("builds 30 hidden MSU postgraduate review rows with authorized annual fee candidates", () => {
    const rows = buildMsuPostgraduateReviewRows(dataset);
    const summary = summarizeMsuPostgraduateReviewImport(rows);

    assert.equal(rows.length, 30);
    assert.deepEqual(summary.byLevel, { bachelor: 0, master: 20, phd: 10 });
    assert.equal(summary.readyRows, 0);
    assert.equal(summary.needsReviewRows, 30);
    assert.equal(summary.publishedRows, 0);
    assert.equal(summary.uniqueSlugs, 30);
    assert.equal(summary.officialFeeRows, 0);
    assert.equal(summary.nonOfficialCandidateFeeRows, 27);
    assert.equal(summary.missingNonOfficialCandidateFeeRows, 3);
    assert.equal(summary.sourceConflictFeeRows, 0);
    assert.equal(summary.pendingFeeRows, 30);
    assert.equal(summary.directIeltsRows, 4);
    assert.equal(summary.missingDirectIeltsRows, 26);
    assert.equal(summary.durationReviewRows, 3);
    assert.equal(summary.sourceRows, 30);
    assert.deepEqual(summary.publicDisplayStatusCounts, { "needs-review": 30 });
    assert.deepEqual(summary.officialSourceStatusCounts, { "needs-review": 30 });
    assert.deepEqual(summary.feeAuditStatusCounts, { "pending-review": 30 });

    assert.ok(rows.every((row) => String(row.slug).startsWith(MSU_REVIEW_POSTGRADUATE_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.isPublished === false));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "needs-review"));
    assert.ok(rows.every((row) => row.officialSourceStatus === "needs-review"));
    assert.ok(rows.every((row) => row.officialTuitionMYR == null));
    assert.equal(rows.filter((row) => Number(row.tuitionAmount || 0) > 0).length, 27);
    assert.equal(rows.filter((row) => String(row.officialFeeSourceUrl || "").includes("your-uni.com")).length, 27);
    assert.ok(rows.every((row) => hasChinese((row.name as LocalizedText)?.["zh-CN"])));
  });

  test("keeps missing and directly evidenced postgraduate fee/language cases explicit", () => {
    const rows = buildMsuPostgraduateReviewRows(dataset);
    const byName = new Map(rows.map((row) => [row.nameEnOfficial, row]));

    const mba = byName.get("Master in Business Administration");
    assert.equal(mba?.tuitionAmount, 22117);
    assert.equal(mba?.tuitionDisplay, "RM 22,117 / year");
    assert.match(String(mba?.officialTuitionNote), /non-official 2026 annual tuition candidates/i);

    const fashion = byName.get("Master in Fashion Business");
    assert.equal(fashion?.tuitionAmount, null);
    assert.equal(fashion?.officialFeeSourceUrl, "");
    assert.equal(fashion?.languageRequirement?.ielts, 6);
    assert.equal(fashion?.languageRequirement?.toefl, 550);
    assert.match(String(fashion?.reviewReason), /annual tuition candidate not matched/i);

    const engineeringPhd = byName.get("Doctor of Philosophy in Engineering");
    assert.equal(engineeringPhd?.languageRequirement?.ielts, 5);
    assert.equal(engineeringPhd?.languageRequirement?.toefl, 500);
  });

  test("verifies the postgraduate review set and rejects active stale MSU postgraduate rows", () => {
    const rows = buildMsuPostgraduateReviewRows(dataset).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 77
    }));
    const university = {
      id: 77,
      programCount: 110,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;

    const verification = verifyMsuPostgraduateRecordSet(university, rows as any, rows as any);
    assert.equal(verification.importRows, 30);
    assert.equal(verification.publicLeakageRows, 0);
    assert.equal(verification.adminNeedsReviewRows, 30);
    assert.equal(verification.activeSupersededRows, 0);

    const stale = {
      ...rows[0],
      id: 999,
      slug: "msu-old-master-row",
      level: "master",
      isPublished: true,
      publicDisplayStatus: "ready"
    };
    assert.throws(
      () => verifyMsuPostgraduateRecordSet(university, rows as any, [...rows, stale] as any),
      /MSU postgraduate review import verification failed/
    );
  });
});
