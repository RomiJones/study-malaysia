import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_USM_MASTER_SOURCE_PATH,
  buildUsmMasterRows,
  type MasterCommercialSource
} from "../../apps/api/src/db/import-usm-master-commercial.ts";
import {
  DEFAULT_UTM_MASTER_CANDIDATE_PATH,
  buildUtmMasterProgramRows,
  type UTMMasterCandidateDataset
} from "../../apps/api/src/db/import-utm-master-official.ts";
import {
  DEFAULT_UTM_UNDERGRADUATE_CANDIDATE_PATH,
  type UTMCandidateDataset
} from "../../apps/api/src/db/import-utm-undergraduate-official.ts";

test("Gate 3: USM master official programme-content evidence is complete", () => {
  const source = JSON.parse(readFileSync(DEFAULT_USM_MASTER_SOURCE_PATH, "utf8")) as MasterCommercialSource;
  const rows = buildUsmMasterRows(source);
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
  assert.ok(
    source.records
      .filter((row) => row.fee.international?.fullTimePerSemester)
      .every((row) => row.fee.status === "official-rate-only")
  );
});

test("Gate 3: UTM master programme-specific language requirements are verified", () => {
  const source = JSON.parse(readFileSync(DEFAULT_UTM_MASTER_CANDIDATE_PATH, "utf8")) as UTMMasterCandidateDataset;
  const rows = buildUtmMasterProgramRows(source);
  assert.deepEqual(rows.find((row) => row.code === "UTM-M-107")?.languageRequirement, { ielts: 6, toefl: 60, pte: 59, muet: 4 });
  assert.equal(source.programmes.filter((row) => row.languageRequirement.status === "official-tesl-rule").length, 3);
  assert.deepEqual(rows.find((row) => row.code === "UTM-M-060")?.languageRequirement, { ielts: 7, toefl: 95, pte: 76, muet: 5 });
  assert.match(String(rows.find((row) => row.code === "UTM-M-060")?.officialLanguageRequirement), /TESL postgraduate programmes/i);
});

test("Gate 3: UTM undergraduate rows have programme-specific duration evidence", () => {
  const source = JSON.parse(readFileSync(DEFAULT_UTM_UNDERGRADUATE_CANDIDATE_PATH, "utf8")) as UTMCandidateDataset;
  const missing = source.programmes.filter((programme) => programme.programmeDetail?.duration?.status !== "programme-specific");
  assert.deepEqual(missing.map((programme) => programme.ordinal), []);
});
