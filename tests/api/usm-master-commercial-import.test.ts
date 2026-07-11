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

test("USM master commercial source keeps 305 canonical rows and publishes officially reviewed international programmes", () => {
  assert.deepEqual(validateUsmMasterSource(source), []);
  const rows = buildUsmMasterRows(source);
  const summary = summarizeUsmMasterRows(rows);
  assert.equal(rows.length, 305);
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
  assert.equal(summary.ready, 304);
  assert.equal(summary.notAvailableForInternational, 1);
  assert.equal(summary.needsReview, 0);
  assert.deepEqual(summary.modes, {
    research: 170,
    mixed: 51,
    coursework: 57,
    online: 5,
    clinical: 22
  });
  assert.equal(summary.feeMatched, 121);
  assert.equal(summary.feeRateVerified, 0);
  assert.equal(summary.feeCalculated, 151);
  assert.equal(summary.feeNotPublished, 33);
  assert.equal(summary.feeMatched + summary.feeCalculated + summary.feeNotPublished, 305);
  assert.equal(new Set(rows.map((row) => row.slug)).size, 305);
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
  const namesContainingOrdinaryEnglish = rows.filter((row) => {
    const name = row.name as Record<string, string>;
    const normalized = name["zh-CN"].replace(/\b(?:USM|KL|TESOL|MPA|MBA|MSc|EMPM|EMBIZ)\b/gi, "");
    return /[A-Za-z]{3,}/.test(normalized);
  });
  assert.deepEqual(namesContainingOrdinaryEnglish.map((row) => row.name), []);
  const researchRows = rows.filter((row) => row.studyMode === "research");
  assert.ok(researchRows.length > 0);
  const yearRoundResearchRows = researchRows.filter((row) => row.officialIntake === "Open year-round application");
  assert.ok(yearRoundResearchRows.length > 0);
  assert.ok(yearRoundResearchRows.every((row) => row.intakeMonths?.length === 0));
  assert.ok(yearRoundResearchRows.every((row) => /open year-round/i.test(String(row.officialIntakeNote))));
  assert.ok(
    rows.some(
      (row) => row.studyMode !== "research" && row.intakeMonths?.includes("October")
    )
  );
  const globalIslamicFinance = rows.find((row) => row.nameEnOfficial === "MASTER IN GLOBAL ISLAMIC FINANCE");
  assert.equal(globalIslamicFinance?.officialIntake, "April & October");
  assert.deepEqual(globalIslamicFinance?.intakeMonths, ["April", "October"]);
  const architecture = rows.find((row) => row.nameEnOfficial === "MASTER OF ARCHITECTURE");
  assert.equal(architecture?.officialIntake, "October");
  assert.deepEqual(architecture?.intakeMonths, ["October"]);
  const researchComputerScience = rows.find((row) => row.code === "USM-M-ARTICLE-185-36AA5C56");
  assert.equal(researchComputerScience?.officialIntake, "April & October");
  assert.deepEqual(researchComputerScience?.intakeMonths, ["April", "October"]);
  assert.equal(source.records.filter((row) => row.intake.status === "official-programme-page-refreshed-2026-06-16").length, 107);
  assert.equal(source.records.filter((row) => row.intake.status === "official-unpublished").length, 13);
  const counseling = rows.find((row) => row.nameEnOfficial === "MASTER IN COUNSELING");
  assert.equal(counseling?.officialIntake, "October");
  assert.deepEqual(counseling?.intakeMonths, ["October"]);
  assert.equal(counseling?.officialEntryRequirementSourceUrl, "https://admission.usm.my/index.php/postgraduate/programmes?view=article&id=342&catid=53");
  assert.equal(counseling?.requirement?.gpa, 2.75);
  assert.equal(counseling?.languageRequirement?.ielts, 5);
  assert.equal(counseling?.languageRequirement?.toefl, 40);
  assert.equal(counseling?.languageRequirement?.pte, 47);
  assert.equal(counseling?.languageRequirement?.muet, 3.5);
  const counselingNote = counseling?.requirement?.note as Record<string, string>;
  assert.match(counselingNote["zh-CN"], /入学要求/);
  assert.match(counselingNote["zh-CN"], /CGPA 不低于 2\.75\/4\.00/);
  assert.match(counselingNote["zh-CN"], /录取前需参加面试/);
  assert.match(counselingNote["zh-CN"], /语言要求/);
  assert.match(counselingNote["zh-CN"], /IELTS 5、TOEFL iBT 40/);
  assert.match(counselingNote["zh-CN"], /材料不完整将被拒/);
  const counselingDescription = counseling?.description as Record<string, string>;
  assert.match(counselingDescription["zh-CN"], /提供四个辅导专修方向/);
  const counselingCurriculum = counseling?.curriculum as Record<string, string[]>;
  assert.ok(counselingCurriculum["zh-CN"].includes("专修课程：学生可在儿童与青少年、婚姻与家庭、危机、组织四个方向中选择 2 门，共 6 学分。"));
  assert.ok(counselingCurriculum["zh-CN"].includes("个人辅导：过程、策略与技巧"));
  assert.ok(counselingCurriculum["zh-CN"].some((item) => item.startsWith("实习：学生需在指定机构进行个人与团体辅导")));
  assert.ok(counselingCurriculum["zh-CN"].some((item) => item.startsWith("项目：学生需运用研究方法")));
  assert.ok(counselingCurriculum["zh-CN"].includes("开设学院：教育研究学院（School of Educational Studies）。"));
  const counselingSpecializations = counseling?.specializations as Record<string, string[]>;
  assert.deepEqual(counselingSpecializations["zh-CN"], ["儿童与青少年", "婚姻与家庭", "危机辅导", "组织辅导"]);
  const biomedical = rows.find((row) => row.nameEnOfficial === "MASTER IN BIOMEDICAL SCIENCE");
  const biomedicalCurriculum = biomedical?.curriculum as Record<string, string[]>;
  assert.ok(biomedicalCurriculum["zh-CN"].includes("课程结构：Taught courses - 20 units"));
  assert.ok(biomedicalCurriculum["zh-CN"].includes("课程：Qualitative and Quantitative Research Methods"));
  const bioprocess = rows.find((row) => row.nameEnOfficial === "MASTER IN BIOPROCESS TECHNOLOGY");
  const bioprocessSpecializations = bioprocess?.specializations as Record<string, string[]>;
  assert.ok(bioprocessSpecializations["zh-CN"].includes("生物过程技术"));
  assert.ok(bioprocessSpecializations["zh-CN"].includes("发酵技术"));
  const education = rows.find((row) => row.nameEnOfficial === "MASTER OF ARTS (EDUCATION) - CURRICULUM STUDIES");
  const educationSpecializations = education?.specializations as Record<string, string[]>;
  assert.ok(educationSpecializations["zh-CN"].includes("课程研究"));
  assert.ok(educationSpecializations["zh-CN"].some((item) => /英语教育[／/]TESOL/.test(item)));
  const invalidIelts = rows.filter((row) => {
    const ielts = Number(row.languageRequirement?.ielts || 0);
    return ielts > 0 && ielts < 4;
  });
  assert.deepEqual(invalidIelts.map((row) => ({ name: row.nameEnOfficial, ielts: row.languageRequirement?.ielts })), []);
  assert.ok(rows.some((row) =>
    row.languageRequirement?.ielts === 5 &&
    row.languageRequirement?.toefl === 40 &&
    row.languageRequirement?.pte === 47 &&
    row.languageRequirement?.muet === 3.5
  ));
  assert.ok(rows.some((row) =>
    row.languageRequirement?.ielts === 6 &&
    row.languageRequirement?.toefl === 60 &&
    row.languageRequirement?.pte === 59 &&
    row.languageRequirement?.muet === 4
  ));
  const localOnly = rows.find((row) => /Malaysian(?:\s+Candidate)?\s+Only/i.test(String(row.nameEnOfficial)));
  assert.equal(localOnly?.publicDisplayStatus, "not-available-for-international");
  assert.equal(localOnly?.isPublished, false);
  assert.equal(localOnly?.officialSourceStatus, "official-page-verified-international-not-available");
  assert.equal(rows.filter((row) => row.publicDisplayStatus === "needs-review").length, 0);
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
  assert.equal(normalizeMasterDuration("Full-time: Min 3 semesters / Max 6 semesters", "coursework").durationYears, 1.5);
  assert.deepEqual(
    normalizeMasterDuration("Research areas are listed without a numeric duration", "research"),
    {
      durationYears: 1,
      durationOfficial: "Full-time: 1-3 years; Part-time: 2-6 years",
      rawOfficial: "Research areas are listed without a numeric duration",
      numeric: true
    }
  );
});

test("USM master rows show official totals or totals calculated from official rates and durations", () => {
  const rows = buildUsmMasterRows(source);
  const research = rows.find((row) => row.officialFeeAuditStatus === "calculated-from-official-rate");
  const total = rows.find((row) => String(row.tuitionDisplay).includes("total"));
  const unpublished = rows.find((row) => row.officialFeeAuditStatus === "not-published");
  assert.ok(research);
  assert.equal(research?.officialFeeAuditStatus, "calculated-from-official-rate");
  assert.match(String(research?.tuitionDisplay), /^USD [\d,]+ total tuition$/);
  assert.ok(Number(research?.tuitionAmount) > 0);
  assert.equal(research?.tuitionCurrency, "USD");
  assert.match(String(research?.officialTuitionNote), /per semester × \d+ official minimum semesters/i);
  assert.match(String(research?.officialTuitionNote), /part-time rate: USD [\d,]+ per semester/i);
  assert.ok(total);
  assert.match(String(total?.tuitionDisplay), /^(USD|MYR) [\d,]+ total tuition$/);
  assert.ok(unpublished);
  assert.equal(unpublished?.tuitionAmount, null);
  assert.ok(rows.every((row) => !/[\d,]+-[\d,]+.*tuition/i.test(String(row.tuitionDisplay))));
  assert.ok(rows.every((row) => !/estimated total/i.test(String(row.tuitionDisplay))));
  assert.ok(rows.every((row) => Number(row.durationYears) > 0));
  assert.equal(
    source.records
      .filter((row) => row.fee.international?.fullTimePerSemester)
      .every((row) => row.fee.status === "official-rate-only"),
    true
  );
});
