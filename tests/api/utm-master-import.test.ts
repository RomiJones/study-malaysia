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
  const calculatedRows = rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate");
  const rateOnlyRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified");
  const conflictRows = rows.filter((row) => row.officialFeeAuditStatus === "official-non-scalar");
  const odlRows = rows.filter((row) => /open\s+and\s+distance\s+learning/i.test(String(row.studyMode)));
  const scheduleOnlyRows = rows.filter(
    (row) => /open\s+and\s+distance\s+learning|online|distance/i.test(String(row.studyMode)) && !/(coursework|mixed|research)/i.test(String(row.studyMode))
  );
  const courseSettingRows = rows.filter((row) => (row.curriculum?.en || []).length > 0);
  const chineseNames = rows.map((row) => String(row.name?.["zh-CN"] || ""));
  const chineseFaculties = rows.map((row) => String(row.faculty?.["zh-CN"] || ""));

  assert.equal(source.programmes.length, 153);
  assert.equal(rows.length, 153);
  assert.equal(summary.candidateRows, 153);
  assert.equal(summary.importRows, 153);
  assert.equal(summary.readyRows, 153);
  assert.equal(summary.uniqueSlugs, 153);
  assert.equal(summary.officialDurationRows, 153);
  assert.equal(summary.academicRequirementGpaRows, 153);
  assert.ok(rows.every((row) => row.level === "master"));
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 153 });
  assert.equal(officialTotalRows.length, 138);
  assert.equal(calculatedRows.length, 14);
  assert.equal(rateOnlyRows.length, 0);
  assert.equal(conflictRows.length, 1);
  assert.equal(odlRows.length, 24);
  assert.equal(scheduleOnlyRows.length, 0);
  assert.ok(rows.every((row) => row.isPublished));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => (row.sourceUrls || []).length >= 5));
  assert.ok(rows.every((row) => row.durationYears === 1.5));
  assert.ok(rows.every((row) => /^Standardized duration: 1\.5 years \(3 semesters\)/i.test(String(row.durationOfficial))));
  assert.ok(rows.every((row) => Number(row.requirement?.gpa || 0) > 0));
  assert.ok(rows.every((row) => /CPA|CGPA/i.test(String(row.officialAcademicRequirement))));
  assert.equal(courseSettingRows.length, 52);
  assert.ok(rows.every((row) => (row.careers?.en || []).length === 0));
  assert.ok(officialTotalRows.every((row) => row.officialTuitionMYR != null && row.tuitionAmount != null));
  assert.ok(calculatedRows.every((row) => row.officialTuitionMYR === 34650 && row.tuitionAmount === 34650));
  assert.ok(calculatedRows.every((row) => /MYR 34,650 calculated total tuition/i.test(String(row.tuitionDisplay))));
  assert.ok(calculatedRows.every((row) => /2,670.*1,470.*4.*580.*45.*34,650/i.test(String(row.officialTuitionNote))));
  assert.ok(conflictRows.every((row) => row.officialTuitionMYR == null && row.tuitionAmount == null));
  assert.ok(conflictRows.every((row) => /Official fee variants: MYR/i.test(String(row.tuitionDisplay))));
  const technicalEducationOdl = rows.find((row) => row.code === "UTM-M-062");
  const cyberSecurityOdl = rows.find((row) => row.code === "UTM-M-115");
  assert.equal(technicalEducationOdl?.studyMode, "Coursework / Open and Distance Learning");
  assert.equal(technicalEducationOdl?.tuitionAmount, 34650);
  assert.equal(technicalEducationOdl?.officialTuitionMYR, 34650);
  assert.equal(technicalEducationOdl?.tuitionDisplay, "MYR 34,650 standard ODL total tuition");
  assert.match(String(technicalEducationOdl?.officialTuitionNote), /with-prerequisite variant is MYR 36,390/i);
  assert.equal(cyberSecurityOdl?.studyMode, "Coursework / Open and Distance Learning");
  assert.equal(cyberSecurityOdl?.tuitionAmount, 34650);
  assert.match(String(cyberSecurityOdl?.officialTuitionNote), /with-prerequisite variant is MYR 38,130/i);
  const sustainableSystemsOdl = rows.find((row) => row.code === "UTM-M-153");
  assert.equal(sustainableSystemsOdl?.nameEnOfficial, "Master in Sustainable Systems");
  assert.equal(sustainableSystemsOdl?.studyMode, "Coursework / Open and Distance Learning");
  assert.equal(sustainableSystemsOdl?.officialFeeAuditStatus, "official-non-scalar");
  assert.equal(sustainableSystemsOdl?.tuitionAmount, null);
  assert.equal(sustainableSystemsOdl?.officialTuitionMYR, null);
  assert.match(String(sustainableSystemsOdl?.tuitionDisplay), /MYR 31,440.*MYR 38,790/);
  assert.match(String(sustainableSystemsOdl?.officialTuitionNote), /official.*range.*RM31,440.*RM38,790/i);
  assert.ok(chineseNames.every((name) => !/Master of|Master in|Field of Research|Official master/i.test(name)));
  assert.ok(chineseFaculties.every((faculty) => !/Faculty of|School of|Academy|Institute|Programmes/i.test(faculty)));
  assert.equal(rows.find((row) => row.code === "UTM-M-107")?.name?.["zh-CN"], "数据科学硕士");
  assert.equal(rows.find((row) => row.code === "UTM-M-107")?.requirement?.gpa, 2.5);
  assert.equal(rows.find((row) => row.code === "UTM-M-107")?.faculty?.["zh-CN"], "计算学院");
  assert.deepEqual(rows.find((row) => row.code === "UTM-M-107")?.languageRequirement, { ielts: 6, toefl: 60, pte: 59, muet: 4 });
  assert.equal(rows.find((row) => row.code === "UTM-M-113")?.name?.["zh-CN"], "哲学硕士（研究领域：软件工程）");
  assert.deepEqual(rows.find((row) => row.code === "UTM-M-113")?.curriculum?.["zh-CN"], ["研究领域：软件工程"]);
  assert.equal(rows.find((row) => row.code === "UTM-M-113")?.requirement?.gpa, 2.75);
  assert.deepEqual(rows.find((row) => row.code === "UTM-M-066")?.curriculum?.["zh-CN"], ["官方专业方向：管理与行政"]);
  assert.deepEqual(rows.find((row) => row.code === "UTM-M-003")?.curriculum?.["zh-CN"], []);
  assert.equal(rows.find((row) => row.code === "UTM-M-129")?.name?.["zh-CN"], "工商管理硕士（MBA）");
  assert.equal(rows.find((row) => row.code === "UTM-M-129")?.requirement?.gpa, 3.5);
  assert.equal(rows.find((row) => row.code === "UTM-M-131")?.requirement?.gpa, 2.5);
  assert.equal(rows.find((row) => row.code === "UTM-M-095")?.requirement?.gpa, 2.3);
  assert.equal(source.programmes.filter((row) => row.languageRequirement.status === "official-tesl-rule").length, 3);
  assert.deepEqual(rows.find((row) => row.code === "UTM-M-060")?.languageRequirement, { ielts: 7, toefl: 95, pte: 76, muet: 5 });
  assert.match(String(rows.find((row) => row.code === "UTM-M-060")?.officialLanguageRequirement), /TESL postgraduate programmes/i);
});
