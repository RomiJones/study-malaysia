import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_USM_PHD_SOURCE_PATH,
  buildUsmPhdRows,
  summarizeUsmPhdRows,
  validateUsmPhdSource,
  type PhdCommercialSource
} from "../../apps/api/src/db/import-usm-phd-commercial.ts";

const source = JSON.parse(readFileSync(DEFAULT_USM_PHD_SOURCE_PATH, "utf8")) as PhdCommercialSource;

test("USM doctoral source keeps all 95 official identities and publishes the audited international catalogue", () => {
  assert.deepEqual(validateUsmPhdSource(source), []);
  const rows = buildUsmPhdRows(source);
  const summary = summarizeUsmPhdRows(rows);
  assert.equal(rows.length, 95);
  assert.equal(summary.ready, 93);
  assert.equal(summary.needsReview, 0);
  assert.equal(summary.notAvailableForInternational, 2);
  assert.equal(summary.feeMatched, 13);
  assert.equal(summary.feeNotPublished, 82);
  assert.deepEqual(summary.modes, {
    mixed: 6,
    online: 1,
    coursework: 6,
    research: 82
  });
  assert.equal(new Set(rows.map((row) => row.slug)).size, 95);
  assert.ok(rows.every((row) => row.name && row.faculty && row.description && row.officialSourceUrl));
  assert.ok(rows.every((row) => {
    const name = row.name as Record<string, string>;
    return name["zh-CN"].includes("博士") && name["zh-TW"].includes("博士");
  }));
  assert.ok(rows.every((row) => {
    const name = row.name as Record<string, string>;
    const normalized = name["zh-CN"].replace(/\b(?:USM|KL|KANITA|DBA)\b/gi, "");
    return !/[A-Za-z]{3,}/.test(normalized);
  }));
  assert.ok(rows.filter((row) => row.publicDisplayStatus !== "ready").every((row) => row.isPublished === false));
});

test("USM doctoral importer preserves unpublished fields without inventing values", () => {
  const rows = buildUsmPhdRows(source);
  const dba = rows.find((row) => row.nameEnOfficial?.includes("BUSINESS ADMINISTRATION (DBA)"));
  const neuroscience = rows.find((row) => row.nameEnOfficial === "DOCTOR OF NEUROSCIENCE");
  const research = rows.find((row) => row.studyMode === "research" && row.tuitionCurrency === "USD");
  const offshore = rows.find((row) => String(row.nameEnOfficial).includes("OFFSHORE"));
  assert.equal(dba?.durationYears, 3.5);
  assert.equal(dba?.durationOfficial, "Full-Time Duration: 3.5-5 years; Part-Time Duration: 4.5-7 years");
  assert.equal(dba?.publicDisplayStatus, "ready");
  assert.equal(neuroscience?.durationYears, 3);
  assert.equal(neuroscience?.publicDisplayStatus, "ready");
  assert.equal(dba?.tuitionAmount, 16200);
  assert.equal(dba?.tuitionDisplay, "USD 16,200 total tuition");
  assert.equal(research?.officialFeeAuditStatus, "not-published");
  assert.equal(research?.tuitionAmount, null);
  assert.equal(research?.tuitionDisplay, "");
  assert.match(String(research?.officialTuitionNote), /does not calculate a total/i);
  assert.equal(offshore?.officialFeeAuditStatus, "not-published");
  assert.equal(offshore?.publicDisplayStatus, "ready");
  assert.ok(rows.every((row) => !/[\d,]+-[\d,]+.*tuition/i.test(String(row.tuitionDisplay))));
});
