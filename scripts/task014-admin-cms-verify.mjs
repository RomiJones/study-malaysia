import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const apiDist = join(process.cwd(), "apps", "api", "dist");

if (!existsSync(apiDist)) {
  throw new Error("API dist is missing. Run npm --workspace @studymy/api run build first.");
}

const [{ AdminCmsService }, { AdminPermissionGuard }] = await Promise.all([
  import(pathToFileURL(join(apiDist, "admin", "admin-cms.service.js"))),
  import(pathToFileURL(join(apiDist, "common", "guards.js")))
]);

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

    const entity = {
      ...payload,
      id: payload.id || this.nextId++,
      createdAt: payload.createdAt || new Date("2026-05-23T00:00:00.000Z"),
      updatedAt: new Date("2026-05-23T00:00:00.000Z")
    };
    const index = this.rows.findIndex((row) => row.id === entity.id);
    if (index >= 0) {
      this.rows[index] = { ...this.rows[index], ...entity };
    } else {
      this.rows.push(entity);
    }
    return this.clone(entity);
  }

  async findOne(options = {}) {
    return (await this.find(options))[0] || null;
  }

  async findOneBy(where = {}) {
    return this.findOne({ where });
  }

  async find(options = {}) {
    return this.rows.filter((row) => matchesWhere(row, options.where)).map((row) => this.clone(row));
  }

  async count(options = {}) {
    return (await this.find(options)).length;
  }

  async delete(where = {}) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matchesWhere(row, where));
    return { affected: before - this.rows.length };
  }

  clone(row) {
    return JSON.parse(JSON.stringify(row));
  }
}

class FakeLogService {
  constructor() {
    this.logs = [];
  }

  async write(adminUser, module, action, targetType, targetId, summary, detail) {
    this.logs.push({ adminUser, module, action, targetType, targetId, summary, detail });
  }
}

class FakeCache {
  constructor() {
    this.clearedPrefixes = [];
  }

  async clearByPrefix(prefix) {
    this.clearedPrefixes.push(prefix);
  }
}

function matchesWhere(row, where = {}) {
  if (!where) return true;
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function text(en) {
  return { en, ms: en, "zh-CN": en, "zh-TW": en };
}

function list(values) {
  return { en: values, ms: values, "zh-CN": values, "zh-TW": values };
}

function baseUniversity(overrides = {}) {
  return {
    slug: "verified-university",
    code: "VU",
    name: text("Verified University"),
    shortName: "VU",
    logoUrl: "https://example.edu.my/logo.png",
    imageUrl: "https://example.edu.my/cover.png",
    color: "#0C0E1A",
    qsRank: 120,
    qsAsiaRank: null,
    location: text("Kuala Lumpur"),
    region: text("Klang Valley"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1960,
    students: 20000,
    intlStudents: 3000,
    csrCertified: true,
    description: text("Verified university profile"),
    website: "https://example.edu.my",
    admissionEmail: "admission@example.edu.my",
    nameEnOfficial: "Verified University",
    officialWebsite: "https://example.edu.my",
    studyPortalUrl: "https://example.edu.my/study",
    internationalPageUrl: "https://example.edu.my/international",
    applicationPortalUrl: "https://example.edu.my/apply",
    officialAddress: "Kuala Lumpur",
    applicationPeriods: ["February", "September"],
    applicationFees: ["RM 300"],
    applicationDocuments: list(["Passport"]),
    chinaStudentRequirements: list(["Graduation certificate"]),
    officialProfile: { country: "Malaysia" },
    officialSources: [{ title: "Official website", url: "https://example.edu.my", sourceType: "official-website" }],
    officialVerifiedAt: "2026-05-22",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "Verified from official website.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "Estimated by official guidance.",
    tuitionMinCny: 30000,
    tuitionMaxCny: 60000,
    livingCostCny: 30000,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: list(["Library"]),
    highlights: list(["Research university"]),
    isPublished: true,
    ...overrides
  };
}

function baseProgram(overrides = {}) {
  return {
    universityId: 1,
    slug: "verified-program",
    code: "VP-001",
    name: text("Master of Verified Data"),
    nameEnOfficial: "Master of Verified Data",
    level: "master",
    category: "data-science",
    faculty: text("Faculty of Computing"),
    facultyZh: "Faculty of Computing",
    studyMode: "coursework",
    campus: "main",
    durationYears: 1,
    durationOfficial: "1 year",
    annualTuitionCny: 50000,
    tuitionAmount: 45000,
    tuitionCurrency: "MYR",
    tuitionDisplay: "RM 45,000 total",
    officialTuitionMYR: 45000,
    officialTuitionNote: "Total international tuition.",
    officialFeeSourceUrl: "https://example.edu.my/fees",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: "2026-05-22",
    intakeMonths: ["September"],
    officialIntake: "September",
    officialIntakeNote: "Subject to faculty confirmation.",
    languageRequirement: { ielts: 6, toefl: null, pte: null, muet: null },
    officialLanguageRequirement: "IELTS 6.0",
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: text("Bachelor degree") },
    officialAcademicRequirement: "Relevant bachelor degree",
    chinaStudentRequirement: "Degree certificate and transcript",
    specialRequirementsNote: "",
    applicationDocs: list(["Passport", "Transcript"]),
    curriculum: list(["Research methods"]),
    careers: list(["Data analyst"]),
    specializations: list(["Analytics"]),
    description: text("Verified program profile"),
    officialAccreditationNote: "MQA listed",
    officialSourceUrl: "https://example.edu.my/program",
    officialEntryRequirementSourceUrl: "https://example.edu.my/entry",
    officialAccreditationSourceUrl: "https://example.edu.my/accreditation",
    sourceUrls: [{ title: "Official program page", url: "https://example.edu.my/program", sourceType: "profile" }],
    officialVerifiedAt: "2026-05-22",
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote: "Ready for public display.",
    reviewReason: "",
    auditNote: "Initial verification complete.",
    listTuitionText: "RM 45,000 total",
    isPublished: true,
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
    },
    getHandler() {
      return "handler";
    },
    getClass() {
      return "class";
    }
  };
}

const permissionGuard = new AdminPermissionGuard({
  getAllAndOverride() {
    return ["program:update"];
  }
});

assert.equal(
  permissionGuard.canActivate(requestContext({ adminUser: { permissions: ["program:update"] } })),
  true
);
assert.throws(
  () => permissionGuard.canActivate(requestContext({ adminUser: { permissions: ["program:view"] } })),
  (error) => error.status === 403 && error.message === "Permission denied"
);
assert.throws(
  () => permissionGuard.canActivate(requestContext({})),
  (error) => error.status === 401 && error.message === "Admin user missing"
);

const universitiesRepository = new FakeRepository([baseUniversity({ id: 1 })]);
const programsRepository = new FakeRepository([]);
const contentRepository = new FakeRepository([]);
const applicationsRepository = new FakeRepository([]);
const cache = new FakeCache();
const logService = new FakeLogService();
const cmsService = new AdminCmsService(
  universitiesRepository,
  programsRepository,
  contentRepository,
  applicationsRepository,
  cache,
  logService
);
const actor = {
  id: 7,
  username: "admin",
  displayName: "Admin",
  dataScope: "all",
  permissions: ["school:update", "program:update"],
  roleCodes: ["super-admin"],
  managedUniversityIds: []
};

await assert.rejects(
  () => cmsService.saveUniversity(actor, baseUniversity({ publicDisplayStatus: "invalid-status" })),
  (error) => error.status === 400 && error.message === "Invalid publicDisplayStatus"
);
await assert.rejects(
  () => cmsService.saveUniversity(actor, baseUniversity({ tuitionMinCny: 70000, tuitionMaxCny: 60000 })),
  (error) => error.status === 400 && error.message.includes("tuitionMaxCny")
);
await assert.rejects(
  () => cmsService.saveProgram(actor, baseProgram({ publicDisplayStatus: "ready", officialSourceUrl: "", officialEntryRequirementSourceUrl: "", officialAccreditationSourceUrl: "", sourceUrls: [] })),
  (error) => error.status === 400 && error.message === "Ready program requires an official source URL"
);
await assert.rejects(
  () => cmsService.saveProgram(actor, baseProgram({ officialTuitionMYR: -1 })),
  (error) => error.status === 400 && error.message.includes("officialTuitionMYR")
);
await assert.rejects(
  () => cmsService.saveProgram(actor, baseProgram({ officialFeeAuditStatus: "matched-official", officialFeeSourceUrl: "" })),
  (error) => error.status === 400 && error.message === "Matched official fee audit requires officialFeeSourceUrl"
);

const savedUniversity = await cmsService.saveUniversity(actor, baseUniversity({ code: "NU", slug: "new-university", shortName: "NU" }));
assert.equal(savedUniversity.publicDisplayStatus, "ready");
assert.equal(logService.logs.at(-1).module, "school");
assert.equal(logService.logs.at(-1).detail.mode, "create");
assert.equal(logService.logs.at(-1).detail.officialFields.publicDisplayStatus, "ready");

const savedProgram = await cmsService.saveProgram(actor, baseProgram());
assert.equal(savedProgram.publicDisplayStatus, "ready");
assert.equal(logService.logs.at(-1).module, "program");
assert.equal(logService.logs.at(-1).detail.mode, "create");
assert.equal(logService.logs.at(-1).detail.officialFields.officialFeeAuditStatus, "matched-official");

const updatedProgram = await cmsService.saveProgram(actor, {
  ...savedProgram,
  publicDisplayStatus: "hidden-unverified",
  auditNote: "Hidden until the latest official page is rechecked."
});
const updateLog = logService.logs.at(-1);
assert.equal(updatedProgram.publicDisplayStatus, "hidden-unverified");
assert.deepEqual(updateLog.detail.changedFields.sort(), ["auditNote", "publicDisplayStatus"].sort());
assert.equal(updateLog.detail.changes.publicDisplayStatus.from, "ready");
assert.equal(updateLog.detail.changes.publicDisplayStatus.to, "hidden-unverified");

const universityDetail = await cmsService.getUniversity(savedUniversity.id);
const programDetail = await cmsService.getProgram(savedProgram.id);
assert.equal(universityDetail.code, "NU");
assert.equal(programDetail.code, "VP-001");
assert.ok(cache.clearedPrefixes.every((prefix) => prefix === "catalog:"));
assert.ok(logService.logs.length >= 3);

console.log("TASK-014 管理端 API 验证通过。");
