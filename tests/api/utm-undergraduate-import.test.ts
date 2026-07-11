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

test("UTM undergraduate import publishes all official programmes and marks current-cycle not-open rows", () => {
  assert.deepEqual(validateUtmUndergraduateCandidate(source), []);

  const rows = buildUtmUndergraduateProgramRows(source);
  const summary = summarizeUtmUndergraduateImport(source, rows);
  const readyRows = rows.filter((row) => row.publicDisplayStatus === "ready");
  const currentCycleRows = rows.filter((row) => row.publicDisplayStatus === "current-cycle-not-open");
  const manufacturing = rows.find(
    (row) => row.nameEnOfficial === "Bachelor of Mechanical Engineering (Manufacturing) with Honours"
  );
  const accounting = rows.find((row) => row.nameEnOfficial === "Bachelor in Accounting with Honours");
  const artificialIntelligence = rows.find((row) => row.nameEnOfficial === "Bachelor in Artificial Intelligence with Honours");
  const biomedical = rows.find((row) => row.nameEnOfficial === "Bachelor of Biomedical Engineering with Honours");
  const geomatics = rows.find((row) => row.nameEnOfficial === "Bachelor of Geomatics Engineering with Honours");
  const chemicalProcess = rows.find((row) => row.nameEnOfficial === "Bachelor of Chemical Process Engineering with Honours");
  const interviewRows = rows.filter((row) => /interview required/i.test(String(row.specialRequirementsNote || "")));
  const courseSettingRows = rows.filter((row) => (row.curriculum?.en || []).length > 0);

  assert.equal(source.programmes.length, 44);
  assert.equal(rows.length, 44);
  assert.equal(summary.readyRows, 40);
  assert.equal(summary.currentCycleNotOpenRows, 4);
  assert.equal(summary.unavailableCurrentCycleRows, 4);
  assert.equal(summary.importRows, 44);
  assert.equal(summary.officialDurationRows, 44);
  assert.ok(rows.every((row) => row.level === "bachelor"));
  assert.deepEqual(summary.publicDisplayStatusCounts, {
    ready: 40,
    "current-cycle-not-open": 4
  });
  assert.deepEqual(summary.officialSourceStatusCounts, {
    "official-verified": 40,
    "official-page-verified-current-cycle-not-open": 4
  });
  assert.equal(readyRows.filter((row) => row.isPublished).length, 40);
  assert.equal(currentCycleRows.filter((row) => row.isPublished).length, 4);
  assert.equal(new Set(rows.map((row) => row.slug)).size, 44);
  assert.ok(rows.every((row) => Number(row.durationYears) > 0));
  assert.ok(rows.every((row) => /^Standardized duration:\s*\d+(?:\.\d+)?\s+years\b/i.test(String(row.durationOfficial))));
  assert.ok(rows.every((row) => !/Displayed as 4 years|not applicable|not open to international applicants/i.test(String(row.durationOfficial))));
  assert.ok(rows.every((row) => Number(row.officialTuitionMYR) > 0));
  assert.deepEqual(
    currentCycleRows.map((row) => row.nameEnOfficial).sort(),
    [
      "Bachelor in Accounting with Honours",
      "Bachelor in Digital Marketing with Honours",
      "Bachelor of Management with Honours",
      "Bachelor of Mechanical Engineering (Manufacturing) with Honours"
    ].sort()
  );
  assert.ok(currentCycleRows.every((row) => /not offered/i.test(String(row.officialIntake))));
  assert.ok(currentCycleRows.every((row) => !/not open to international applicants/i.test(String(row.durationOfficial))));
  assert.ok(currentCycleRows.every((row) => Number(row.officialTuitionMYR) > 0));
  assert.ok(currentCycleRows.every((row) => !/not applicable|n\/a/i.test(String(row.tuitionDisplay))));
  assert.ok(currentCycleRows.every((row) => /country-specific international entry requirements/i.test(String(row.publicDisplayNote))));
  assert.ok(currentCycleRows.every((row) => /70%/.test(String(row.chinaStudentRequirement))));
  assert.ok(currentCycleRows.every((row) => /China/.test(String(row.officialAcademicRequirement))));
  assert.ok(currentCycleRows.every((row) => /Official UTM current-cycle intake status/i.test(String(row.reviewReason))));
  assert.equal(rows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length, 0);
  assert.deepEqual(
    interviewRows.map((row) => row.nameEnOfficial).sort(),
    [
      "Bachelor of Science in Architecture with Honours",
      "Bachelor of Science with Honours (Industrial Design)"
    ].sort()
  );
  assert.equal(rows.find((row) => row.nameEnOfficial === "Bachelor of Naval Architecture & Offshore Engineering with Honours")?.specialRequirementsNote, null);
  assert.equal(rows.find((row) => row.nameEnOfficial === "Bachelor of Landscape Architecture with Honours")?.specialRequirementsNote, null);
  assert.ok(!/面试|interview/i.test(JSON.stringify(manufacturing?.requirement?.note)));
  assert.ok(!/interview/i.test(String(manufacturing?.officialAcademicRequirement)));
  assert.equal(manufacturing?.durationYears, 4);
  assert.match(String(manufacturing?.durationOfficial), /^Standardized duration: 4 years \(8 semesters\)/i);
  assert.match(String(manufacturing?.durationOfficial), /Normal 8 semesters/i);
  assert.equal(manufacturing?.officialTuitionMYR, 75000);
  assert.ok(artificialIntelligence?.curriculum?.["zh-CN"].some((item) => /机器学习|生成式人工智能/.test(item)));
  assert.ok(artificialIntelligence?.careers?.["zh-CN"].some((item) => /人工智能工程师|数据科学家/.test(item)));
  assert.ok(courseSettingRows.length >= 31);
  assert.ok(biomedical?.curriculum?.["zh-CN"].some((item) => /生物医学工程导论|临床工程/.test(item)));
  assert.equal(biomedical?.reviewReason, null);
  assert.match(String(biomedical?.auditNote), /Resolved import field coverage: .*"curriculum":"official-value"/);
  assert.match(String(biomedical?.auditNote), /Resolved import field coverage: .*"careers":"official-value"/);
  assert.ok(accounting?.curriculum?.["zh-CN"].some((item) => /财务会计与报告|内部审计/.test(item)));
  assert.ok(geomatics?.curriculum?.["zh-CN"].some((item) => /测量与制图基础|遥感/.test(item)));
  assert.ok(chemicalProcess?.curriculum?.["zh-CN"].some((item) => /质量与能量衡算|化学过程设计/.test(item)));
  assert.ok(chemicalProcess?.careers?.["zh-CN"].some((item) => /废水处理/.test(item)));
  assert.ok(
    (accounting?.sourceUrls || []).some((link) => link.url.includes("UG-Academic-Hand-Book-FM-2025_2026_update-040925.pdf"))
  );
  assert.ok(
    (geomatics?.sourceUrls || []).some((link) => link.url.includes("List_of_Courses_According_to_Semester_SBEUH.pdf"))
  );
});
