import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const apiDist = join(process.cwd(), "apps", "api", "dist");

if (!existsSync(apiDist)) {
  throw new Error("API dist is missing. Run npm --workspace @studymy/api run build first.");
}

const [{ ProgramsService }, { UniversitiesService }, { SearchService }] = await Promise.all([
  import(pathToFileURL(join(apiDist, "programs", "programs.service.js"))),
  import(pathToFileURL(join(apiDist, "universities", "universities.service.js"))),
  import(pathToFileURL(join(apiDist, "search", "search.service.js")))
]);

class FakeCache {
  async getJson() {
    return null;
  }

  async setJson() {}
}

class FakeRepository {
  constructor(rows) {
    this.rows = rows;
  }

  async find(options = {}) {
    let rows = this.rows.filter((row) => matchesWhere(row, options.where));
    if (options.order) {
      const entries = Object.entries(options.order);
      rows = [...rows].sort((left, right) => {
        for (const [key, direction] of entries) {
          const value = compareValue(left[key], right[key]);
          if (value !== 0) return direction === "DESC" ? -value : value;
        }
        return 0;
      });
    }
    return rows;
  }

  async findOne(options = {}) {
    return (await this.find(options))[0] || null;
  }

  async findOneBy(where = {}) {
    return this.rows.find((row) => matchesWhere(row, where)) || null;
  }
}

function compareValue(left, right) {
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([key, value]) => value === undefined || row[key] === value);
}

function text(en, zh = en) {
  return { en, ms: en, "zh-CN": zh, "zh-TW": zh };
}

function list(values) {
  return { en: values, ms: values, "zh-CN": values, "zh-TW": values };
}

function baseUniversity(overrides) {
  return {
    id: 0,
    slug: "",
    code: "",
    name: text("University"),
    shortName: "",
    logoUrl: "",
    imageUrl: "",
    color: "#000000",
    qsRank: 999,
    qsAsiaRank: null,
    location: text("Kuala Lumpur"),
    region: text("Klang Valley"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1900,
    students: 0,
    intlStudents: 0,
    csrCertified: true,
    description: text("A public university"),
    website: "https://example.edu.my",
    admissionEmail: "admission@example.edu.my",
    nameEnOfficial: "",
    officialWebsite: "https://example.edu.my",
    studyPortalUrl: "",
    internationalPageUrl: "",
    applicationPortalUrl: "",
    officialAddress: "",
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: list([]),
    chinaStudentRequirements: list([]),
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: null,
    officialSourceStatus: "official-verified",
    officialAuditSummary: "",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "",
    tuitionMinCny: 30000,
    tuitionMaxCny: 80000,
    livingCostCny: 30000,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: list([]),
    highlights: list([]),
    programCount: 0,
    isPublished: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    programs: [],
    ...overrides
  };
}

function baseProgram(overrides) {
  return {
    id: 0,
    universityId: 0,
    slug: "",
    code: "",
    name: text("Program"),
    nameEnOfficial: "",
    level: "master",
    category: "it",
    faculty: text("Faculty"),
    facultyZh: "Faculty",
    studyMode: "coursework",
    campus: "main",
    durationYears: 1,
    durationOfficial: "1 year",
    annualTuitionCny: 50000,
    tuitionAmount: null,
    tuitionCurrency: "CNY",
    tuitionDisplay: "CNY 50,000 / year",
    officialTuitionMYR: null,
    officialTuitionNote: null,
    officialFeeSourceUrl: "https://example.edu.my/fees",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: null,
    intakeMonths: ["September"],
    officialIntake: "September",
    officialIntakeNote: null,
    languageRequirement: { ielts: 6, toefl: null, pte: null, muet: null },
    officialLanguageRequirement: "IELTS 6.0",
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: text("GPA 3.0") },
    officialAcademicRequirement: "Bachelor degree",
    chinaStudentRequirement: "Degree certificate",
    specialRequirementsNote: null,
    applicationDocs: list(["Passport"]),
    curriculum: list(["Core course"]),
    careers: list(["Analyst"]),
    specializations: list([]),
    description: text("Program description"),
    officialAccreditationNote: "",
    officialSourceUrl: "https://example.edu.my/program",
    officialEntryRequirementSourceUrl: "https://example.edu.my/entry",
    officialAccreditationSourceUrl: "",
    sourceUrls: [],
    officialVerifiedAt: null,
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "",
    listTuitionText: "CNY 50,000 / year",
    isPublished: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides
  };
}

const um = baseUniversity({
  id: 1,
  slug: "universiti-malaya-um",
  code: "UM",
  name: text("Universiti Malaya", "马来亚大学"),
  shortName: "UM",
  qsRank: 60,
  ownership: "public",
  institutionType: "research",
  tuitionMinCny: 28000,
  tuitionMaxCny: 65000,
  acceptNoLanguage: true
});

const taylor = baseUniversity({
  id: 2,
  slug: "taylors-university",
  code: "TAYLORS",
  name: text("Taylor's University", "泰莱大学"),
  shortName: "Taylor's",
  qsRank: 280,
  ownership: "private",
  institutionType: "comprehensive",
  tuitionMinCny: 90000,
  tuitionMaxCny: 140000,
  minIelts: 6.5
});

const computerScience = baseProgram({
  id: 101,
  universityId: 1,
  slug: "um-master-computer-science",
  code: "UM-CS-M",
  name: text("Master of Computer Science", "计算机科学硕士"),
  nameEnOfficial: "Master of Computer Science",
  level: "master",
  category: "it",
  annualTuitionCny: 42000,
  languageRequirement: { ielts: 6, toefl: 80, pte: null, muet: null },
  university: um
});

const hiddenProgram = baseProgram({
  id: 102,
  universityId: 1,
  slug: "um-hidden-program",
  code: "UM-HIDDEN",
  name: text("Hidden Computer Programme", "隐藏计算机专业"),
  nameEnOfficial: "Hidden Computer Programme",
  publicDisplayStatus: "hidden-unverified",
  annualTuitionCny: 30000,
  university: um
});

const business = baseProgram({
  id: 201,
  universityId: 2,
  slug: "taylors-business-bachelor",
  code: "TAY-BIZ-B",
  name: text("Bachelor of Business", "商学本科"),
  nameEnOfficial: "Bachelor of Business",
  level: "bachelor",
  category: "business",
  annualTuitionCny: 95000,
  languageRequirement: { ielts: 6.5, toefl: 90, pte: null, muet: null },
  university: taylor
});

um.programs = [computerScience, hiddenProgram];
taylor.programs = [business];
um.programCount = um.programs.length;
taylor.programCount = taylor.programs.length;

const universities = [um, taylor];
const programs = [computerScience, hiddenProgram, business];
const cache = new FakeCache();
const universitiesRepository = new FakeRepository(universities);
const programsRepository = new FakeRepository(programs);
const contentRepository = new FakeRepository([]);

const programsService = new ProgramsService(programsRepository, universitiesRepository, cache);
const universitiesService = new UniversitiesService(universitiesRepository, programsRepository, contentRepository, cache);
const searchService = new SearchService(universitiesRepository, programsRepository, cache);

const programList = await programsService.list();
assert.equal(Array.isArray(programList), true);
assert.equal(programList.length, 2);
assert.equal(programList.some((item) => item.id === hiddenProgram.id), false);
assert.equal(programList.every((item) => item.publicDisplayStatus === "ready"), true);

const filteredPrograms = await programsService.list({
  search: "Computer",
  levels: ["master"],
  categories: ["it"],
  ownerships: ["public"],
  institutionTypes: ["research"],
  tuitionMax: 50000,
  ieltsMax: 6,
  includeMeta: true,
  page: 1,
  pageSize: 5
});
assert.equal(filteredPrograms.items.length, 1);
assert.equal(filteredPrograms.items[0].id, computerScience.id);
assert.equal(filteredPrograms.items[0].university.slug, um.slug);
assert.equal(filteredPrograms.facets.some((facet) => facet.key === "categories"), true);

const filteredUniversities = await universitiesService.list({
  search: "Computer",
  levels: ["master"],
  categories: ["it"],
  ownerships: ["public"],
  institutionTypes: ["research"],
  tuitionMax: 50000,
  acceptNoLanguage: true,
  qsRankMax: 100,
  includeMeta: true
});
assert.equal(filteredUniversities.items.length, 1);
assert.equal(filteredUniversities.items[0].id, um.id);
assert.equal(filteredUniversities.items[0].programCount, 1);

const universityDetail = await universitiesService.getBySlug(um.slug);
assert.equal(universityDetail.programs.length, 1);
assert.equal(universityDetail.programs[0].id, computerScience.id);
assert.equal(universityDetail.programGroups.find((group) => group.level === "master").count, 1);
assert.equal(universityDetail.compareFields.some((field) => field.key === "qsRank"), true);

const programDetail = await programsService.getByIdentifier(String(computerScience.id));
assert.equal(programDetail.id, computerScience.id);
assert.equal(programDetail.directTarget.universitySlug, um.slug);
assert.equal(programDetail.tuitionInfo.displayText.length > 0, true);

const suggestions = await searchService.suggest({ q: "Computer", limit: 8 });
assert.equal(suggestions.some((item) => item.type === "program" && item.programId === computerScience.id), true);
assert.equal(suggestions.some((item) => item.programId === hiddenProgram.id), false);

const facets = await universitiesService.getFacets({ categories: ["it"] });
assert.equal(facets.resultCount, 1);
assert.equal(facets.facets.some((facet) => facet.key === "levels"), true);
assert.equal(facets.activeFilters.some((filter) => filter.key === "categories" && filter.value === "it"), true);

console.log("TASK-012 public API verification passed.");
