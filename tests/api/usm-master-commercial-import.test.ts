import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_USM_MASTER_SOURCE_PATH,
  buildUsmMasterRows,
  normalizeMasterDuration,
  summarizeUsmMasterRows,
  validateUsmMasterSource,
  type MasterCommercialSource
} from "../../apps/api/src/db/import-usm-master-commercial.ts";

const source = JSON.parse(readFileSync(DEFAULT_USM_MASTER_SOURCE_PATH, "utf8")) as MasterCommercialSource;

test("USM master commercial source is complete and produces 274 ready rows", () => {
  assert.deepEqual(validateUsmMasterSource(source), []);
  const rows = buildUsmMasterRows(source);
  const summary = summarizeUsmMasterRows(rows);
  assert.equal(rows.length, 274);
  assert.equal(summary.ready, 274);
  assert.deepEqual(summary.modes, { research: 176, mixed: 40, coursework: 51, clinical: 7 });
  assert.equal(summary.feeMatched + summary.feeNotPublished, 274);
  assert.equal(new Set(rows.map((row) => row.slug)).size, 274);
  assert.ok(rows.every((row) => row.name && row.faculty && row.description && row.officialSourceUrl));
  const malformedLocalizedNames = rows.filter((row) => {
    const name = row.name as Record<string, string>;
    return !(name["zh-CN"].includes("硕士")
      && name["zh-TW"].includes("碩士")
      && (name["zh-CN"].match(/\(/g)?.length || 0) === (name["zh-CN"].match(/\)/g)?.length || 0)
      && (name["zh-CN"].match(/（/g)?.length || 0) === (name["zh-CN"].match(/）/g)?.length || 0));
  });
  assert.deepEqual(malformedLocalizedNames.map((row) => row.name), []);
  const namesContainingOrganisationSuffix = rows.filter((row) => {
    const name = row.name as Record<string, string>;
    return /(School|Centre|Center|Institute|University)/.test(name["zh-CN"]);
  });
  assert.deepEqual(namesContainingOrganisationSuffix.map((row) => row.name), []);
  assert.deepEqual(rows[0].intakeMonths, ["September", "March"]);
  const invalidIelts = rows.filter((row) => {
    const ielts = Number(row.languageRequirement?.ielts || 0);
    return ielts > 0 && ielts < 4;
  });
  assert.deepEqual(invalidIelts.map((row) => ({ name: row.nameEnOfficial, ielts: row.languageRequirement?.ielts })), []);
});

test("USM master duration converts semesters and months to years", () => {
  assert.deepEqual(
    normalizeMasterDuration(
      "Full-time: Min 2 semesters / Max 6 semesters Part-time: Min 4 semesters / Max 12 semesters",
      "research"
    ),
    {
      durationYears: 1,
      durationOfficial: "Full-time: 1-3 years; Part-time: 2-6 years",
      rawOfficial: "Full-time: Min 2 semesters / Max 6 semesters Part-time: Min 4 semesters / Max 12 semesters",
      numeric: true
    }
  );
  assert.equal(
    normalizeMasterDuration("Full-time: Min 18 months / Max 24 months", "coursework").durationOfficial,
    "Full-time: 1.5-2 years"
  );
  assert.equal(normalizeMasterDuration("6 semesters", "coursework").durationOfficial, "3 years");
  assert.equal(
    normalizeMasterDuration("Subject to the published programme structure", "coursework").durationYears,
    0
  );
});

test("USM master rows preserve official fee basis and unpublished status", () => {
  const rows = buildUsmMasterRows(source);
  const research = rows.find((row) => String(row.tuitionDisplay).includes("per semester"));
  const total = rows.find((row) => String(row.tuitionDisplay).includes("total"));
  const unpublished = rows.find((row) => row.officialFeeAuditStatus === "not-published");
  assert.ok(research);
  assert.equal(research?.tuitionAmount, null);
  assert.ok(total);
  assert.ok(unpublished);
  assert.equal(unpublished?.tuitionAmount, null);
  assert.equal(unpublished?.tuitionCurrency, "UNKNOWN");
});
