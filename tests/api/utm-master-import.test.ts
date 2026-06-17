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
  const rateOnlyRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified");
  const conflictRows = rows.filter((row) => row.officialFeeAuditStatus === "not-published");
  const nonScalarRows = [...rateOnlyRows, ...conflictRows];

  assert.equal(source.programmes.length, 153);
  assert.equal(rows.length, 153);
  assert.equal(summary.candidateRows, 153);
  assert.equal(summary.importRows, 153);
  assert.equal(summary.readyRows, 153);
  assert.equal(summary.uniqueSlugs, 153);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 153 });
  assert.equal(officialTotalRows.length, 132);
  assert.equal(rateOnlyRows.length, 14);
  assert.equal(conflictRows.length, 7);
  assert.equal(nonScalarRows.length, 21);
  assert.ok(rows.every((row) => row.isPublished));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => (row.sourceUrls || []).length >= 5));
  assert.ok(officialTotalRows.every((row) => row.officialTuitionMYR != null && row.tuitionAmount != null));
  assert.ok(nonScalarRows.every((row) => row.officialTuitionMYR == null && row.tuitionAmount == null));
  assert.ok(nonScalarRows.every((row) => /no single total|no single scalar/i.test(String(row.tuitionDisplay))));
});
