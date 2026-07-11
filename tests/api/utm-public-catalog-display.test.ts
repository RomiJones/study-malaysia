import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ProgramsService } from "../../apps/api/src/programs/programs.service.ts";
import { UniversitiesService } from "../../apps/api/src/universities/universities.service.ts";

function text(en: string, zh = en) {
  return { en, ms: en, "zh-CN": zh, "zh-TW": zh };
}

function list(values: string[] = []) {
  return { en: values, ms: values, "zh-CN": values, "zh-TW": values };
}

function university(overrides: Record<string, unknown> = {}) {
  return {
    id: 8,
    slug: "utm",
    code: "UTM",
    name: text("Universiti Teknologi Malaysia", "马来西亚理工大学"),
    shortName: "UTM",
    nameEnOfficial: "Universiti Teknologi Malaysia",
    logoUrl: "",
    imageUrl: "",
    color: "#c0182f",
    qsRank: 181,
    qsAsiaRank: 37,
    location: text("Johor Bahru", "新山"),
    region: text("Johor", "柔佛"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1972,
    students: 24000,
    intlStudents: 5000,
    csrCertified: true,
    description: text("Official UTM profile"),
    website: "https://www.utm.my",
    admissionEmail: "admission@utm.my",
    officialWebsite: "https://www.utm.my",
    studyPortalUrl: "",
    internationalPageUrl: "https://admission.utm.my/entry-requirements-ug-international/",
    applicationPortalUrl: "",
    officialAddress: "",
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: list(),
    chinaStudentRequirements: list(),
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: "2026-06-17",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "",
    publicDisplayStatus: "ready",
    isPublished: true,
    livingCostOfficialNote: "",
    tuitionMinCny: 30000,
    tuitionMaxCny: 90000,
    livingCostCny: 24000,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: list(["Library"]),
    highlights: list(["Engineering"]),
    programCount: 44,
    ...overrides
  };
}

function program(overrides: Record<string, unknown> = {}) {
  return {
    id: 801,
    universityId: 8,
    slug: "utm-bachelor-software-engineering",
    code: "UTM-UG-001",
    name: text("Bachelor of Computer Science (Software Engineering) with Honours", "软件工程荣誉学士"),
    nameEnOfficial: "Bachelor of Computer Science (Software Engineering) with Honours",
    level: "bachelor",
    category: "computer-science",
    faculty: text("Faculty of Computing", "计算学院"),
    facultyZh: "计算学院",
    studyMode: "Full-time",
    campus: "Johor Bahru",
    durationYears: 4,
    durationOfficial: "4 years",
    annualTuitionCny: 45000,
    tuitionAmount: null,
    tuitionCurrency: "CNY",
    tuitionDisplay: "",
    officialTuitionMYR: null,
    officialTuitionNote: "",
    officialFeeSourceUrl: "",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "official-total-verified",
    officialFeeAuditedAt: null,
    intakeMonths: ["September"],
    officialIntake: "September",
    officialIntakeNote: "",
    languageRequirement: { ielts: 5.5, toefl: null, pte: null, muet: null },
    officialLanguageRequirement: "IELTS 5.5",
    requirement: { gpa: null, gaokaoRequired: false, huikaoRequired: false, note: text("Official requirement") },
    officialAcademicRequirement: "Senior high school qualification",
    chinaStudentRequirement: "",
    specialRequirementsNote: "",
    applicationDocs: list(["Passport"]),
    curriculum: list(),
    careers: list(),
    specializations: list(),
    description: text("Official programme description"),
    officialAccreditationNote: "",
    officialSourceUrl: "https://admission.utm.my/",
    officialEntryRequirementSourceUrl: "",
    officialAccreditationSourceUrl: "",
    sourceUrls: [],
    officialVerifiedAt: "2026-06-17",
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "",
    listTuitionText: "",
    isPublished: true,
    ...overrides
  };
}

test("UTM public catalog exposes official bachelor rows whose current cycle is not open", async () => {
  const readyUniversity = university();
  const readyProgram = program({ university: readyUniversity });
  const currentCycleProgram = program({
    id: 802,
    slug: "utm-bachelor-management",
    code: "UTM-UG-041",
    name: text("Bachelor of Management with Honours", "管理荣誉学士"),
    nameEnOfficial: "Bachelor of Management with Honours",
    faculty: text("Faculty of Management", "管理学院"),
    facultyZh: "管理学院",
    officialIntake: "Not offered for both the September and February intakes for the 2026/2027 academic session",
    durationOfficial: "Study Duration: Minimum 3 years for full-time study; 6 years for part-time study.",
    officialSourceStatus: "official-page-verified-current-cycle-not-open",
    publicDisplayStatus: "current-cycle-not-open",
    publicDisplayNote: "Published for official catalogue completeness. UTM marks this programme as not offered for both September and February intakes in the 2026/2027 academic session; official country-specific international entry requirements remain published separately.",
    reviewReason: "Official UTM current-cycle intake status: Not offered for both the September and February intakes for the 2026/2027 academic session.",
    chinaStudentRequirement: "中国申请路径：高中毕业证书；社科类要求任意 3 门认可科目成绩不低于 70%。 / China qualification route: scores of at least 70% in any three accepted subjects.",
    university: readyUniversity
  });

  const programsService = new ProgramsService(
    { find: async () => [readyProgram, currentCycleProgram] } as any,
    { find: async () => [readyUniversity], findOneBy: async () => readyUniversity } as any,
    { getJson: async () => null, setJson: async () => undefined } as any
  );

  const listResult = await programsService.list({ universityId: 8, levels: ["bachelor"] }) as any[];

  assert.deepEqual(listResult.map((item) => item.id), [801, 802]);
  assert.equal(listResult[1].publicDisplayStatus, "current-cycle-not-open");
  assert.equal(listResult[1].officialSourceStatus, "official-page-verified-current-cycle-not-open");
  assert.match(listResult[1].publicDisplayNote, /country-specific international entry requirements/i);
});

test("UTM university detail keeps current-cycle not-open rows in the bachelor group", async () => {
  const readyProgram = program();
  const currentCycleProgram = program({
    id: 802,
    slug: "utm-bachelor-management",
    code: "UTM-UG-041",
    name: text("Bachelor of Management with Honours", "管理荣誉学士"),
    nameEnOfficial: "Bachelor of Management with Honours",
    publicDisplayStatus: "current-cycle-not-open",
    officialSourceStatus: "official-page-verified-current-cycle-not-open",
    officialIntake: "Not offered for both the September and February intakes for the 2026/2027 academic session",
    publicDisplayNote: "Published for official catalogue completeness. UTM marks this programme as not offered for both September and February intakes in the 2026/2027 academic session; official country-specific international entry requirements remain published separately."
  });
  const readyUniversity = university({
    programs: [readyProgram, currentCycleProgram],
    officialProfile: {
      catalogStatusSummary: {
        all: { total: 44, ready: 40, currentCycleNotOpen: 4, needsReview: 0, notAvailableForInternational: 0 },
        byLevel: {
          bachelor: { total: 44, ready: 40, currentCycleNotOpen: 4, needsReview: 0, notAvailableForInternational: 0 },
          master: { total: 0, ready: 0, currentCycleNotOpen: 0, needsReview: 0, notAvailableForInternational: 0 },
          phd: { total: 0, ready: 0, currentCycleNotOpen: 0, needsReview: 0, notAvailableForInternational: 0 }
        }
      }
    }
  });

  const universitiesService = new UniversitiesService(
    { findOne: async () => readyUniversity } as any,
    {} as any,
    {} as any,
    { getJson: async () => null, setJson: async () => undefined } as any
  );

  const detail = await universitiesService.getBySlug("utm") as any;

  assert.equal(detail.programCount, 2);
  assert.deepEqual(detail.programs.map((item: any) => item.id), [801, 802]);
  assert.equal(detail.programGroups.find((group: any) => group.level === "bachelor").count, 2);
  assert.equal(detail.catalogStatusSummary.byLevel.bachelor.total, 44);
  assert.equal(detail.catalogStatusSummary.byLevel.bachelor.currentCycleNotOpen, 4);
  assert.equal(detail.catalogStatusSummary.byLevel.bachelor.notAvailableForInternational, 0);
  assert.equal(detail.programs[1].publicDisplayStatus, "current-cycle-not-open");
  assert.match(detail.programs[1].publicDisplayNote, /country-specific international entry requirements/i);
});
