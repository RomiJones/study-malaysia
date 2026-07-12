import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_USM_MASTER_SOURCE_PATH,
  type MasterCommercialSource
} from "../../apps/api/src/db/import-usm-master-commercial.ts";
import {
  DEFAULT_UTM_UNDERGRADUATE_CANDIDATE_PATH,
  type UTMCandidateDataset
} from "../../apps/api/src/db/import-utm-undergraduate-official.ts";

test("Gate 3: USM master official programme-content evidence is complete", () => {
  const source = JSON.parse(readFileSync(DEFAULT_USM_MASTER_SOURCE_PATH, "utf8")) as MasterCommercialSource;
  assert.equal(source.records.filter((row) => row.programmeContent?.status === "official-programme-detail-markdown").length, 305);
  assert.equal(source.records.filter((row) => row.programmeContent?.overviewText).length, 291);
  assert.equal(source.records.filter((row) => row.programmeContent?.curriculumStructure?.length).length, 52);
  assert.equal(source.records.filter((row) => row.programmeContent?.researchAreas?.length).length, 114);
  assert.equal(source.records.filter((row) => row.programmeContent?.specializations?.length).length, 29);
  assert.equal(source.records.filter((row) => row.academicRequirement.status === "official-general-rule").length, 9);
  assert.equal(source.records.filter((row) => row.languageRequirement.status === "official-general-rule").length, 9);
  assert.equal(source.records.filter((row) => row.academicRequirement.status === "official-programme-page-refreshed-2026-06-16").length, 229);
  assert.equal(source.records.filter((row) => row.languageRequirement.status === "official-programme-page-refreshed-2026-06-16").length, 229);
  assert.ok(source.records.every((row) => row.academicRequirement.textEnOfficial));
  assert.ok(source.records.every((row) => row.languageRequirement.textEnOfficial));
  assert.equal(source.records.filter((row) => row.intake.status === "official-programme-page-refreshed-2026-06-16").length, 107);
  assert.equal(source.records.filter((row) => row.intake.status === "official-unpublished").length, 13);
  assert.ok(
    source.records
      .filter((row) => row.fee.international?.fullTimePerSemester)
      .every((row) => row.fee.status === "official-rate-only")
  );
});

test("Gate 3: UTM undergraduate rows have programme-specific duration evidence", () => {
  const source = JSON.parse(readFileSync(DEFAULT_UTM_UNDERGRADUATE_CANDIDATE_PATH, "utf8")) as UTMCandidateDataset;
  const missing = source.programmes.filter((programme) => programme.programmeDetail?.duration?.status !== "programme-specific");
  assert.deepEqual(missing.map((programme) => programme.ordinal), []);
});
