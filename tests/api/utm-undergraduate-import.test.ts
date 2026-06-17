import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_UTM_UNDERGRADUATE_CANDIDATE_PATH,
  buildUtmUndergraduateProgramRows,
  summarizeUtmUndergraduateImport,
  validateUtmUndergraduateCandidate,
  type UTMCandidateDataset
} from "../../apps/api/src/db/import-utm-undergraduate-official.ts";

const source = JSON.parse(readFileSync(DEFAULT_UTM_UNDERGRADUATE_CANDIDATE_PATH, "utf8")) as UTMCandidateDataset;

test("UTM undergraduate import publishes all official programmes and marks closed international rows", () => {
  assert.deepEqual(validateUtmUndergraduateCandidate(source), []);

  const rows = buildUtmUndergraduateProgramRows(source);
  const summary = summarizeUtmUndergraduateImport(source, rows);
  const readyRows = rows.filter((row) => row.publicDisplayStatus === "ready");
  const unavailableRows = rows.filter((row) => row.publicDisplayStatus === "not-available-for-international");

  assert.equal(source.programmes.length, 44);
  assert.equal(rows.length, 44);
  assert.equal(summary.readyRows, 40);
  assert.equal(summary.unavailableCurrentCycleRows, 4);
  assert.equal(summary.importRows, 44);
  assert.deepEqual(summary.publicDisplayStatusCounts, {
    ready: 40,
    "not-available-for-international": 4
  });
  assert.deepEqual(summary.officialSourceStatusCounts, {
    "official-verified": 40,
    "official-page-verified-international-not-available": 4
  });
  assert.equal(readyRows.filter((row) => row.isPublished).length, 40);
  assert.equal(unavailableRows.filter((row) => row.isPublished).length, 4);
  assert.equal(new Set(rows.map((row) => row.slug)).size, 44);
  assert.deepEqual(
    unavailableRows.map((row) => row.nameEnOfficial).sort(),
    [
      "Bachelor in Accounting with Honours",
      "Bachelor in Digital Marketing with Honours",
      "Bachelor of Management with Honours",
      "Bachelor of Mechanical Engineering (Manufacturing) with Honours"
    ].sort()
  );
  assert.ok(unavailableRows.every((row) => /not offered/i.test(String(row.officialIntake))));
  assert.ok(unavailableRows.every((row) => /not open to international applicants/i.test(String(row.durationOfficial))));
  assert.ok(unavailableRows.every((row) => /Published for official catalogue completeness/i.test(String(row.publicDisplayNote))));
  assert.ok(unavailableRows.every((row) => /Official UTM current-cycle status/i.test(String(row.reviewReason))));
});
