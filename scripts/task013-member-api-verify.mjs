import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const apiDist = join(process.cwd(), "apps", "api", "dist");

if (!existsSync(apiDist)) {
  throw new Error("API dist is missing. Run npm --workspace @studymy/api run build first.");
}

const [{ FavoritesService }, { CompareService }, { PlannerService }, { AuthGuard }] = await Promise.all([
  import(pathToFileURL(join(apiDist, "favorites", "favorites.service.js"))),
  import(pathToFileURL(join(apiDist, "compare", "compare.service.js"))),
  import(pathToFileURL(join(apiDist, "planner", "planner.service.js"))),
  import(pathToFileURL(join(apiDist, "common", "guards.js")))
]);

class FakeCache {
  constructor() {
    this.items = new Map();
  }

  async getJson(key) {
    return this.items.get(key) || null;
  }

  async setJson(key, value) {
    this.items.set(key, value);
  }

  async del(key) {
    this.items.delete(key);
  }
}

class FakeRepository {
  constructor(rows = []) {
    this.rows = rows;
    this.nextId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1;
  }

  create(payload) {
    return { ...payload };
  }

  async save(payload) {
    if (Array.isArray(payload)) {
      return Promise.all(payload.map((item) => this.save(item)));
    }

    const now = new Date("2026-05-23T00:00:00.000Z");
    const entity = {
      ...payload,
      id: payload.id || this.nextId++,
      createdAt: payload.createdAt || now,
      updatedAt: now
    };
    const index = this.rows.findIndex((row) => row.id === entity.id);
    if (index >= 0) {
      this.rows[index] = { ...this.rows[index], ...entity };
    } else {
      this.rows.push(entity);
    }
    return entity;
  }

  async remove(payload) {
    const items = Array.isArray(payload) ? payload : [payload];
    const ids = new Set(items.map((item) => item.id));
    this.rows = this.rows.filter((row) => !ids.has(row.id));
    return payload;
  }

  async find(options = {}) {
    let rows = this.rows.filter((row) => matchesWhere(row, options.where));
    if (options.order) {
      const orderEntries = Object.entries(options.order);
      rows = [...rows].sort((left, right) => {
        for (const [key, direction] of orderEntries) {
          const result = compareValue(left[key], right[key]);
          if (result !== 0) return direction === "DESC" ? -result : result;
        }
        return 0;
      });
    }
    return rows.map((row) => ({ ...row }));
  }

  async findBy(where = {}) {
    return this.find({ where });
  }

  async findOne(options = {}) {
    return (await this.find(options))[0] || null;
  }

  async findOneBy(where = {}) {
    return (await this.find({ where }))[0] || null;
  }
}

class CompareRepository extends FakeRepository {
  constructor(rows, universitiesRepository) {
    super(rows);
    this.universitiesRepository = universitiesRepository;
  }

  async find(options = {}) {
    const rows = await super.find(options);
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        university: await this.universitiesRepository.findOneBy({ id: row.universityId })
      }))
    );
  }
}

function compareValue(left, right) {
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

function matchesWhere(row, where = {}) {
  if (Array.isArray(where)) {
    return where.some((item) => matchesWhere(row, item));
  }
  return Object.entries(where || {}).every(([key, value]) => matchesValue(row[key], value));
}

function matchesValue(rowValue, expected) {
  if (expected && typeof expected === "object" && expected._type === "in") {
    return expected._value.includes(rowValue);
  }
  return expected === undefined || rowValue === expected;
}

function text(en) {
  return { en, ms: en, "zh-CN": en, "zh-TW": en };
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

function requestContext(request) {
  return {
    switchToHttp() {
      return {
        getRequest() {
          return request;
        }
      };
    }
  };
}

const universities = [
  baseUniversity({ id: 1, slug: "um", code: "UM", shortName: "UM", qsRank: 60, acceptNoLanguage: true }),
  baseUniversity({ id: 2, slug: "taylors", code: "TAYLORS", shortName: "Taylor's", qsRank: 280 }),
  baseUniversity({ id: 3, slug: "monash-malaysia", code: "MONASH", shortName: "Monash", qsRank: 42 }),
  baseUniversity({ id: 4, slug: "sunway", code: "SUNWAY", shortName: "Sunway", qsRank: 520 })
];

const programs = [
  baseProgram({ id: 101, universityId: 1, slug: "um-cs", code: "UM-CS", name: text("Master of Computer Science") }),
  baseProgram({ id: 201, universityId: 2, slug: "taylors-business", code: "TAY-BIZ", name: text("Bachelor of Business"), level: "bachelor", category: "business" }),
  baseProgram({ id: 301, universityId: 3, slug: "monash-data", code: "MON-DATA", name: text("Master of Data Science") })
];

const usersRepository = new FakeRepository([{ id: 10, role: "student", method: "email", account: "student@example.com", displayName: "Student" }]);
const universitiesRepository = new FakeRepository(universities);
const programsRepository = new FakeRepository(programs);
const favoritesRepository = new FakeRepository([]);
const compareRepository = new CompareRepository([], universitiesRepository);
const profilesRepository = new FakeRepository([]);
const tasksRepository = new FakeRepository([]);
const cache = new FakeCache();

const favoritesService = new FavoritesService(favoritesRepository, universitiesRepository, programsRepository, cache);
const compareService = new CompareService(compareRepository, universitiesRepository);
const plannerService = new PlannerService(profilesRepository, tasksRepository, programsRepository, universitiesRepository, usersRepository);

const missingGuard = new AuthGuard({ verifyAsync: async () => ({ sub: 10, tokenType: "student" }) }, usersRepository);
await assert.rejects(
  () => missingGuard.canActivate(requestContext({ headers: {} })),
  (error) => error.status === 401 && error.message === "Missing bearer token"
);

const invalidTypeGuard = new AuthGuard({ verifyAsync: async () => ({ sub: 10, tokenType: "admin" }) }, usersRepository);
await assert.rejects(
  () => invalidTypeGuard.canActivate(requestContext({ headers: { authorization: "Bearer token" } })),
  (error) => error.status === 401 && error.message === "Invalid token type"
);

let favorites = await favoritesService.add(10, "university", 1);
assert.deepEqual(favorites.universityIds, [1]);
favorites = await favoritesService.add(10, "program", 101);
assert.deepEqual(favorites.programIds, [101]);
favorites = await favoritesService.add(10, "program", 101);
assert.equal(favorites.programIds.length, 1);
await assert.rejects(() => favoritesService.add(10, "program", 999), /Program not found/);
favorites = await favoritesService.remove(10, "university", 1);
assert.deepEqual(favorites.universityIds, []);
favorites = await favoritesService.merge(10, { universityIds: [1, 2, 999, 1], programIds: [101, 999] });
assert.deepEqual(favorites.universityIds.sort((a, b) => a - b), [1, 2]);
assert.deepEqual(favorites.skippedUniversityIds, [999]);
assert.deepEqual(favorites.skippedProgramIds, [999]);
assert.equal(favorites.mergeStrategy, "server-first-union");

let compare = await compareService.add(10, 1);
assert.deepEqual(compare.universityIds, [1]);
compare = await compareService.add(10, 2);
compare = await compareService.add(10, 3);
assert.deepEqual(compare.universityIds, [1, 2, 3]);
await assert.rejects(() => compareService.add(10, 4), /Compare list supports up to 3 universities/);
await assert.rejects(() => compareService.add(10, 999), /University not found/);
compare = await compareService.remove(10, 2);
assert.deepEqual(compare.universityIds, [1, 3]);
compare = await compareService.merge(10, [2, 999, 2]);
assert.deepEqual(compare.universityIds, [1, 3, 2]);
assert.deepEqual(compare.skippedUniversityIds, [999]);

let dashboard = await plannerService.getDashboard(10);
assert.equal(dashboard.profile.level, "master");
dashboard = await plannerService.updateProfile(10, { level: "bachelor", targetCategory: "business", gpa: 3.6 });
assert.equal(dashboard.profile.level, "bachelor");
assert.equal(Number(dashboard.profile.gpa), 3.6);
dashboard = await plannerService.saveMaterials(10, { passport: "done", english: "progress", invalid: "bad-status" });
assert.equal(dashboard.materials.find((item) => item.key === "english").status, "progress");
dashboard = await plannerService.updateMaterialStatus(10, "photo", "done");
assert.equal(dashboard.materials.find((item) => item.key === "photo").status, "done");
dashboard = await plannerService.saveVisa(10, { offerAccepted: true, depositPaid: true });
assert.equal(dashboard.visaChecklist.offerAccepted, true);
assert.equal(dashboard.visaChecklist.visaDocsReady, false);

dashboard = await plannerService.addTask(10, 1, 101);
assert.equal(dashboard.tasks.length, 1);
await assert.rejects(() => plannerService.addTask(10, 1, 101), /Task already exists/);
await assert.rejects(() => plannerService.addTask(10, 1, 999), /Program not found/);
const taskId = dashboard.tasks[0].id;
dashboard = await plannerService.updateTask(10, taskId, { stage: "materials", progress: 45 });
assert.equal(dashboard.tasks[0].stage, "materials");
assert.equal(dashboard.tasks[0].progress, 45);

dashboard = await plannerService.saveTasks(10, [
  { universityId: 1, programId: 101, stage: "ready", progress: 70 },
  { universityId: 2, programId: 201, stage: "draft", progress: 10 },
  { universityId: 2, programId: 201, stage: "visa", progress: 100 }
]);
assert.equal(dashboard.tasks.length, 2);
assert.equal(dashboard.tasks.find((task) => task.programId === 201).stage, "draft");

const taskToDelete = dashboard.tasks.find((task) => task.programId === 201).id;
dashboard = await plannerService.deleteTask(10, taskToDelete);
assert.equal(dashboard.tasks.length, 1);

const mergedPlanner = await plannerService.mergeLocalState(10, {
  profile: { ielts: 6.5 },
  materialProgress: { transcript: "done" },
  visaChecklist: { visaDocsReady: true },
  tasks: [
    { universityId: 1, programId: 101 },
    { universityId: 3, programId: 301, stage: "draft", progress: 12 },
    { universityId: 99, programId: 999 }
  ]
});
assert.equal(Number(mergedPlanner.dashboard.profile.ielts), 6.5);
assert.equal(mergedPlanner.dashboard.visaChecklist.visaDocsReady, true);
assert.equal(mergedPlanner.dashboard.tasks.some((task) => task.programId === 301), true);
assert.deepEqual(mergedPlanner.skippedTasks, [{ universityId: 99, programId: 999, reason: "Target university or program not found" }]);
assert.equal(mergedPlanner.mergeStrategy.tasks, "Server tasks are kept first and local tasks are appended by universityId + programId.");

console.log("TASK-013 member API verification passed.");
