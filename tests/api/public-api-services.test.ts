import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS } from "@studymy/shared";
import { AuthController } from "../../apps/api/src/auth/auth.controller.ts";
import { AuthService } from "../../apps/api/src/auth/auth.service.ts";
import { FavoritesService } from "../../apps/api/src/favorites/favorites.service.ts";
import { PlannerService } from "../../apps/api/src/planner/planner.service.ts";
import { ProgramsController } from "../../apps/api/src/programs/programs.controller.ts";
import { ProgramsService } from "../../apps/api/src/programs/programs.service.ts";
import { SearchService } from "../../apps/api/src/search/search.service.ts";
import { ToolsController } from "../../apps/api/src/tools/tools.controller.ts";
import { ToolsService } from "../../apps/api/src/tools/tools.service.ts";
import { UniversitiesController } from "../../apps/api/src/universities/universities.controller.ts";
import { UniversitiesService } from "../../apps/api/src/universities/universities.service.ts";

function text(en: string, zh = en) {
  return { en, ms: en, "zh-CN": zh, "zh-TW": zh };
}

function list(values: string[] = []) {
  return { en: values, ms: values, "zh-CN": values, "zh-TW": values };
}

function university(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "university-of-malaya",
    code: "UM",
    name: text("University of Malaya", "马来亚大学"),
    shortName: "UM",
    nameEnOfficial: "University of Malaya",
    logoUrl: "",
    imageUrl: "",
    color: "#1B7A72",
    qsRank: 60,
    qsAsiaRank: 12,
    location: text("Kuala Lumpur", "吉隆坡"),
    region: text("Kuala Lumpur", "吉隆坡"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1905,
    students: 30000,
    intlStudents: 4000,
    csrCertified: true,
    description: text("Research university"),
    website: "https://www.um.edu.my",
    admissionEmail: "admission@example.edu",
    officialWebsite: "https://www.um.edu.my",
    studyPortalUrl: "",
    internationalPageUrl: "",
    applicationPortalUrl: "",
    officialAddress: "",
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: list(),
    chinaStudentRequirements: list(),
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: "2026-01-10",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "",
    publicDisplayStatus: "ready",
    isPublished: true,
    livingCostOfficialNote: "",
    tuitionMinCny: 30000,
    tuitionMaxCny: 70000,
    livingCostCny: 24000,
    minIelts: 5.5,
    acceptNoLanguage: true,
    facilities: list(["Library"]),
    highlights: list(["QS Top 100"]),
    programCount: 1,
    ...overrides
  };
}

function program(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    universityId: 1,
    slug: "um-master-it",
    code: "UMP1",
    name: text("Master of Information Technology", "信息技术硕士"),
    nameEnOfficial: "Master of Information Technology",
    level: "master",
    category: "it",
    faculty: text("Faculty of Computer Science", "计算机学院"),
    facultyZh: "计算机学院",
    studyMode: "Full-time",
    campus: "Kuala Lumpur",
    durationYears: 2,
    durationOfficial: "2 years",
    annualTuitionCny: 45000,
    tuitionAmount: null,
    tuitionCurrency: "CNY",
    tuitionDisplay: "",
    officialTuitionMYR: null,
    officialTuitionNote: "",
    officialFeeSourceUrl: "",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: null,
    intakeMonths: ["September"],
    officialIntake: "September",
    officialIntakeNote: "",
    languageRequirement: { ielts: 6, toefl: null, pte: null, muet: null },
    officialLanguageRequirement: "IELTS 6.0",
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: text("Good standing") },
    officialAcademicRequirement: "Bachelor degree",
    chinaStudentRequirement: "",
    specialRequirementsNote: "",
    applicationDocs: list(["Passport"]),
    curriculum: list(["Research methods"]),
    careers: list(["Product manager"]),
    specializations: list(["Data analytics"]),
    description: text("Official program description"),
    officialAccreditationNote: "",
    officialSourceUrl: "https://example.edu/program",
    officialEntryRequirementSourceUrl: "",
    officialAccreditationSourceUrl: "",
    sourceUrls: [],
    officialVerifiedAt: "2026-01-10",
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

function plannerProfile(overrides: Record<string, unknown> = {}) {
  return {
    userId: 7,
    level: "master",
    targetCategory: "it",
    budgetCny: 90000,
    gpa: 3.2,
    ielts: 6.5,
    experience: "0-1 years",
    acceptNoLanguage: true,
    profileVersion: 1,
    completenessStatus: "incomplete",
    requiredProfileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS],
    missingProfileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS],
    profileSnapshotHash: "",
    profileCompletedAt: null,
    recommendationRefreshedAt: null,
    materialProgress: {},
    visaChecklist: {},
    ...overrides
  };
}

function plannerServiceWithProfile(profileValue: Record<string, unknown>) {
  return new PlannerService(
    {
      findOneBy: async () => profileValue,
      save: async (payload: unknown) => payload,
      create: (payload: unknown) => payload
    } as any,
    {
      find: async () => [],
      findOne: async () => null,
      create: (payload: unknown) => payload,
      save: async (payload: unknown) => payload,
      remove: async () => undefined
    } as any,
    {
      find: async () => [program()],
      findOneBy: async (where: any) => where.id === 11 && where.universityId === 1 ? program() : null
    } as any,
    {
      find: async () => [university()],
      findOneBy: async (where: any) => where.id === 1 ? university() : null
    } as any,
    { findOneBy: async () => ({ id: 7 }) } as any
  );
}

describe("public API services and controllers", () => {
  test("auth registration creates an incomplete planner profile for recommendation gating", async () => {
    const savedProfiles: unknown[] = [];
    const service = new AuthService(
      {
        findOne: async () => null,
        create: (payload: unknown) => payload,
        save: async (payload: any) => ({ id: 7, ...payload })
      } as any,
      {
        create: (payload: unknown) => payload,
        save: async (payload: unknown) => {
          savedProfiles.push(payload);
          return payload;
        }
      } as any,
      { signAsync: async () => "token" } as any
    );

    const result = await service.register({
      method: "email",
      account: "student@example.com",
      password: "password123",
      displayName: "Student"
    });

    assert.equal(result.accessToken, "token");
    assert.equal(savedProfiles.length, 1);
    assert.equal((savedProfiles[0] as any).completenessStatus, "incomplete");
    assert.deepEqual((savedProfiles[0] as any).requiredProfileFields, [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS]);
    assert.deepEqual((savedProfiles[0] as any).missingProfileFields, [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS]);
    assert.equal((savedProfiles[0] as any).profileCompletedAt, null);
  });

  test("search suggestions do not use campus fields for program matches", async () => {
    const searchProgram = program({
      id: 21,
      slug: "performing-arts",
      code: "PA1",
      name: text("Performing Arts", "Performing Arts"),
      nameEnOfficial: "Performing Arts",
      category: "arts",
      campus: "Kuala Lumpur"
    });
    const searchUniversity = university({
      location: text("Kuala Lumpur", "\u5409\u9686\u5761"),
      region: text("Kuala Lumpur", "\u5409\u9686\u5761"),
      programs: [searchProgram]
    });
    const service = new SearchService(
      { find: async () => [searchUniversity] } as any,
      {} as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const englishCity = await service.suggest({ q: "Kuala Lumpur", limit: 8 });
    const chineseCity = await service.suggest({ q: "\u5409\u9686\u5761", limit: 8 });
    const programName = await service.suggest({ q: "Performing", limit: 8 });

    assert.deepEqual(englishCity.filter((item) => item.type === "program"), []);
    assert.deepEqual(chineseCity.filter((item) => item.type === "program"), []);
    assert.equal(englishCity.some((item) => item.type === "city"), true);
    assert.equal(chineseCity.some((item) => item.type === "city"), true);
    assert.equal(programName.some((item) => item.type === "program" && item.programId === 21), true);
  });

  test("search suggestions rank exact university identity above city matches", async () => {
    const sunway = university({
      id: 31,
      slug: "sunway-university",
      code: "SUNWAY",
      name: text("Sunway University", "\u53cc\u5a01\u5927\u5b66"),
      shortName: "Sunway",
      nameEnOfficial: "Sunway University",
      qsRank: 9999,
      location: text("Bandar Sunway", "\u96ea\u5170\u83aa\u53cc\u5a01\u57ce"),
      region: text("Selangor", "\u96ea\u5170\u83aa")
    });
    const monash = university({
      id: 32,
      slug: "monash-university-malaysia",
      code: "MONASH",
      name: text("Monash University Malaysia", "\u83ab\u7eb3\u4ec0\u5927\u5b66\u9a6c\u6765\u897f\u4e9a\u6821\u533a"),
      shortName: "Monash",
      nameEnOfficial: "Monash University Malaysia",
      qsRank: 31,
      location: text("Bandar Sunway", "\u96ea\u5170\u83aa\u53cc\u5a01\u9547"),
      region: text("Selangor", "\u96ea\u5170\u83aa")
    });
    const service = new SearchService(
      { find: async () => [monash, sunway] } as any,
      {} as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const result = await service.suggest({ q: "\u53cc\u5a01", limit: 8 });

    assert.equal(result[0].type, "university");
    assert.equal(result[0].universitySlug, "sunway-university");
  });

  test("program recommendations filter public catalog data and cache the result", async () => {
    const cacheWrites: Array<{ key: string; value: unknown }> = [];
    const service = new ProgramsService(
      { find: async () => [program(), program({ id: 12, level: "phd", slug: "um-phd-law", code: "UMP2", category: "law" })] } as any,
      { find: async () => [university()] } as any,
      {
        getJson: async () => null,
        setJson: async (key: string, value: unknown) => cacheWrites.push({ key, value })
      } as any
    );

    const result = await service.recommend({
      level: "master",
      targetCategory: "it",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6.5,
      acceptNoLanguage: true
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].program.slug, "um-master-it");
    assert.equal(result[0].annualCostCny, 69000);
    assert.equal(result[0].reasons["zh-CN"].includes("学术门槛匹配"), true);
    assert.equal(cacheWrites.length, 1);
    assert.match(cacheWrites[0].key, /^catalog:recommend:/);
  });

  test("program list excludes ready programs attached to hidden universities", async () => {
    const readyUniversity = university();
    const hiddenUniversity = university({
      id: 2,
      slug: "hidden-university",
      code: "HID",
      isPublished: false,
      publicDisplayStatus: "hidden-unverified"
    });
    const service = new ProgramsService(
      {
        find: async () => [
          program({ university: readyUniversity }),
          program({
            id: 12,
            universityId: 2,
            slug: "hidden-ready-program",
            code: "HIDP",
            university: hiddenUniversity
          })
        ]
      } as any,
      { find: async () => [readyUniversity] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const result = await service.list() as any[];

    assert.deepEqual(result.map((item) => item.id), [11]);
  });

  test("program facets resultCount tracks filtered programs instead of universities", async () => {
    const readyUniversity = university();
    const firstProgram = program({ university: readyUniversity });
    const secondProgram = program({
      id: 12,
      slug: "um-master-data-science",
      code: "UMP2",
      name: text("Master of Data Science"),
      nameEnOfficial: "Master of Data Science",
      university: readyUniversity
    });
    const service = new ProgramsService(
      { find: async () => [firstProgram, secondProgram] } as any,
      { find: async () => [readyUniversity] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const result = await service.getFacets({ categories: ["it"] }) as any;

    assert.equal(result.resultCount, 2);
    assert.equal(result.programResultCount, 2);
    assert.equal(result.universityResultCount, 1);
  });

  test("program detail rejects ready programs attached to hidden university relations", async () => {
    const hiddenUniversity = university({
      id: 2,
      slug: "hidden-university",
      code: "HID",
      isPublished: false,
      publicDisplayStatus: "hidden-unverified"
    });
    let universityLookups = 0;
    const service = new ProgramsService(
      {
        findOne: async () => program({
          id: 12,
          universityId: 2,
          slug: "hidden-ready-program",
          code: "HIDP",
          university: hiddenUniversity
        })
      } as any,
      {
        findOneBy: async () => {
          universityLookups += 1;
          return null;
        }
      } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    await assert.rejects(
      () => service.getByIdentifier("hidden-ready-program"),
      (error) => error instanceof NotFoundException && error.message === "University not found"
    );
    assert.equal(universityLookups, 1);
  });

  test("university list and detail ignore hidden programs for search and count", async () => {
    const visibleProgram = program();
    const hiddenProgram = program({
      id: 12,
      slug: "hidden-quantum-medicine",
      code: "HIDP",
      name: text("Hidden Quantum Medicine"),
      nameEnOfficial: "Hidden Quantum Medicine",
      isPublished: false,
      publicDisplayStatus: "hidden-unverified"
    });
    const readyUniversity = university({
      programs: [visibleProgram, hiddenProgram],
      programCount: 2
    });
    const service = new UniversitiesService(
      {
        find: async () => [readyUniversity],
        findOne: async () => readyUniversity
      } as any,
      {} as any,
      { find: async () => [] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const searchResult = await service.list({ search: "Hidden Quantum Medicine" }) as any[];
    const detail = await service.getBySlug("university-of-malaya") as any;

    assert.equal(searchResult.length, 0);
    assert.equal(detail.programCount, 1);
    assert.deepEqual(detail.programs.map((item: any) => item.id), [11]);
    assert.equal(detail.compareFields.find((item: any) => item.key === "programCount").value, 1);
    assert.deepEqual(detail.catalogStatusSummary.all, {
      total: 1,
      ready: 1,
      needsReview: 0,
      notAvailableForInternational: 0
    });
    assert.deepEqual(detail.catalogStatusSummary.byLevel.master, {
      total: 1,
      ready: 1,
      needsReview: 0,
      notAvailableForInternational: 0
    });
  });

  test("university detail does not expose review-only summary counts on public API", async () => {
    const reviewProgram = program({
      id: 12,
      slug: "sunway-official-2026-row-001-accounting",
      code: "SUNWAY-BACHELOR-001",
      level: "bachelor",
      isPublished: false,
      publicDisplayStatus: "needs-review"
    });
    const publicSunway = university({
      id: 9,
      slug: "sunway-university",
      code: "SUNWAY",
      shortName: "Sunway",
      name: text("Sunway University", "双威大学"),
      programs: [reviewProgram],
      officialProfile: {
        catalogStatusSummary: {
          all: { total: 97, ready: 0, needsReview: 97, notAvailableForInternational: 0 },
          byLevel: {
            bachelor: { total: 48, ready: 0, needsReview: 48, notAvailableForInternational: 0 },
            master: { total: 33, ready: 0, needsReview: 33, notAvailableForInternational: 0 },
            phd: { total: 16, ready: 0, needsReview: 16, notAvailableForInternational: 0 }
          }
        }
      }
    });
    const service = new UniversitiesService(
      {
        find: async () => [publicSunway],
        findOne: async () => publicSunway
      } as any,
      {} as any,
      { find: async () => [] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const detail = await service.getBySlug("sunway-university") as any;

    assert.equal(detail.programCount, 0);
    assert.equal(detail.programs.length, 0);
    assert.deepEqual(detail.catalogStatusSummary.all, {
      total: 0,
      ready: 0,
      needsReview: 0,
      notAvailableForInternational: 0
    });
    assert.equal(detail.catalogStatusSummary.byLevel.bachelor.needsReview, 0);
    assert.equal(detail.catalogStatusSummary.byLevel.master.needsReview, 0);
    assert.equal(detail.catalogStatusSummary.byLevel.phd.needsReview, 0);
  });

  test("university detail resolves APU legacy short slug aliases", async () => {
    const apuProgram = program({
      id: 77,
      universityId: 4,
      slug: "apu-public-20260627-001-information-technology",
      code: "APU-BACHELOR-001",
      university: null
    });
    const apuUniversity = university({
      id: 4,
      slug: "asia-pacific-university-of-technology-and-innovation-apu",
      code: "APU",
      shortName: "APU",
      name: text("Asia Pacific University of Technology & Innovation", "亚太科技大学"),
      programs: [apuProgram],
      programCount: 1
    });
    const service = new UniversitiesService(
      {
        findOne: async (options: any) => {
          if (options?.where?.slug === "asia-pacific-university") return null;
          if (options?.where?.code === "APU") return apuUniversity;
          return null;
        }
      } as any,
      {} as any,
      { find: async () => [] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const detail = await service.getBySlug("asia-pacific-university") as any;

    assert.equal(detail.code, "APU");
    assert.equal(detail.slug, "asia-pacific-university-of-technology-and-innovation-apu");
    assert.equal(detail.programCount, 1);
  });

  test("university list is locked to QS WUR ascending order before pagination", async () => {
    const makeUniversityWithProgram = (overrides: Record<string, unknown>) => {
      const item = university(overrides) as any;
      return {
        ...item,
        programs: [
          program({
            id: Number(item.id) * 10 + 1,
            universityId: item.id,
            slug: `${item.slug}-program`,
            code: `${item.code}-P1`,
            university: item
          })
        ]
      };
    };
    const monash = makeUniversityWithProgram({
      id: 2,
      slug: "monash-university-malaysia",
      code: "MONASH",
      name: text("Monash University Malaysia", "莫纳什大学马来西亚校区"),
      qsRank: 31
    });
    const um = makeUniversityWithProgram({
      id: 1,
      slug: "universiti-malaya",
      code: "UM",
      name: text("Universiti Malaya", "马来亚大学"),
      qsRank: 56
    });
    const usm = makeUniversityWithProgram({
      id: 3,
      slug: "universiti-sains-malaysia",
      code: "USM",
      name: text("Universiti Sains Malaysia", "马来西亚理科大学"),
      qsRank: 128
    });
    const aimst = makeUniversityWithProgram({
      id: 4,
      slug: "aimst-university",
      code: "AIMST",
      name: text("AIMST University", "亚洲医药科技大学"),
      qsRank: 9999
    });
    const service = new UniversitiesService(
      {
        find: async () => [um, aimst, usm, monash],
        findOne: async () => monash
      } as any,
      {} as any,
      { find: async () => [] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const result = await service.list({ includeMeta: true, pageSize: 2 }) as any;

    assert.deepEqual(result.items.map((item: any) => item.code), ["MONASH", "UM"]);
    assert.equal(result.total, 4);
    assert.equal(result.pagination.totalPages, 2);
  });

  test("university list keeps QS WUR order even when search matches multiple universities", async () => {
    const monash = university({
      id: 41,
      slug: "monash-university-malaysia",
      code: "MONASH",
      name: text("Monash University Malaysia", "\u83ab\u7eb3\u4ec0\u5927\u5b66\u9a6c\u6765\u897f\u4e9a\u6821\u533a"),
      shortName: "Monash",
      nameEnOfficial: "Monash University Malaysia",
      qsRank: 31,
      location: text("Bandar Sunway", "\u96ea\u5170\u83aa\u53cc\u5a01\u9547"),
      region: text("Selangor", "\u96ea\u5170\u83aa"),
      programs: []
    });
    const sunway = university({
      id: 42,
      slug: "sunway-university",
      code: "SUNWAY",
      name: text("Sunway University", "\u53cc\u5a01\u5927\u5b66"),
      shortName: "Sunway",
      nameEnOfficial: "Sunway University",
      qsRank: 9999,
      location: text("Bandar Sunway", "\u96ea\u5170\u83aa\u53cc\u5a01\u57ce"),
      region: text("Selangor", "\u96ea\u5170\u83aa"),
      programs: []
    });
    const service = new UniversitiesService(
      {
        find: async () => [monash, sunway],
        findOne: async () => sunway
      } as any,
      {} as any,
      { find: async () => [] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const result = await service.list({ search: "\u53cc\u5a01" }) as any[];

    assert.deepEqual(result.map((item) => item.code), ["MONASH", "SUNWAY"]);
  });

  test("university list applies search and program filters to the same ready program", async () => {
    const computerScience = program({
      id: 21,
      slug: "um-computer-science",
      code: "UM-CS",
      name: text("Computer Science"),
      nameEnOfficial: "Computer Science",
      category: "it",
      level: "master",
      annualTuitionCny: 45000
    });
    const businessProgram = program({
      id: 22,
      slug: "um-business-management",
      code: "UM-BIZ",
      name: text("Business Management"),
      nameEnOfficial: "Business Management",
      category: "business",
      level: "bachelor",
      faculty: text("Business School"),
      facultyZh: "Business School",
      description: text("Business program description"),
      specializations: list(["Management"]),
      careers: list(["Business analyst"]),
      annualTuitionCny: 90000
    });
    const readyUniversity = university({
      programs: [computerScience, businessProgram],
      tuitionMinCny: 45000,
      tuitionMaxCny: 90000
    });
    const service = new UniversitiesService(
      {
        find: async () => [readyUniversity],
        findOne: async () => readyUniversity
      } as any,
      {} as any,
      { find: async () => [] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const categoryResult = await service.list({ search: "Computer", categories: ["business"], includeMeta: true }) as any;
    const levelResult = await service.list({ search: "Computer", levels: ["bachelor"], includeMeta: true }) as any;
    const tuitionResult = await service.list({ search: "Computer", tuitionMin: 80000, includeMeta: true }) as any;
    const universitySearchResult = await service.list({ search: "University of Malaya", categories: ["business"], includeMeta: true }) as any;

    assert.equal(categoryResult.items.length, 0);
    assert.equal(levelResult.items.length, 0);
    assert.equal(tuitionResult.items.length, 0);
    assert.equal(universitySearchResult.items.length, 1);
  });

  test("program controller delegates list and recommendation queries", async () => {
    const calls: string[] = [];
    const controller = new ProgramsController({
      list: async (query: unknown) => {
        calls.push(`list:${JSON.stringify(query)}`);
        return [{ id: 1 }];
      },
      getFacets: async () => ({}),
      getByIdentifier: async () => ({}),
      recommend: async (query: unknown) => {
        calls.push(`recommend:${JSON.stringify(query)}`);
        return [];
      },
      costEstimate: async () => ({})
    } as any);

    assert.deepEqual(await controller.list({ search: "um", includeMeta: true } as any), [{ id: 1 }]);
    assert.deepEqual(await controller.recommend({ level: "master", targetCategory: "it" } as any), []);
    assert.deepEqual(calls, [
      'list:{"search":"um","includeMeta":true}',
      'recommend:{"level":"master","targetCategory":"it"}'
    ]);
  });

  test("public controllers normalize string and bracket array query filters", async () => {
    const programCalls: unknown[] = [];
    const programsController = new ProgramsController({
      list: async (query: unknown) => {
        programCalls.push(query);
        return [];
      },
      getFacets: async (query: unknown) => {
        programCalls.push(query);
        return {};
      },
      getByIdentifier: async () => ({}),
      recommend: async () => [],
      costEstimate: async () => ({})
    } as any);
    const universityCalls: unknown[] = [];
    const universitiesController = new UniversitiesController({
      getHomeMeta: async () => ({}),
      getFacets: async (query: unknown) => {
        universityCalls.push(query);
        return {};
      },
      list: async (query: unknown) => {
        universityCalls.push(query);
        return [];
      },
      getBySlug: async () => ({})
    } as any);

    await programsController.list({
      categories: "medicine",
      levels: "bachelor,master",
      "ownerships[]": "public",
      pageSize: "5",
      includeMeta: "true"
    });
    await programsController.filters({
      "categories[]": ["Clinical Medicine", "Dentistry"],
      levels: "phd",
      pageSize: "5"
    });
    await universitiesController.list({
      categories: "medicine",
      levels: "bachelor",
      pageSize: "5"
    });
    await universitiesController.filters({
      "categories[]": "medicine",
      "institutionTypes[]": "research",
      includeMeta: "true"
    });

    assert.deepEqual(programCalls[0], {
      search: undefined,
      categories: ["medicine"],
      levels: ["bachelor", "master"],
      ownerships: ["public"],
      types: undefined,
      institutionTypes: undefined,
      universityId: undefined,
      acceptNoLanguage: undefined,
      qsRankMax: undefined,
      tuitionMin: undefined,
      tuitionMax: undefined,
      budgetCny: undefined,
      ieltsMax: undefined,
      page: undefined,
      pageSize: 5,
      includeMeta: true
    });
    assert.deepEqual((programCalls[1] as any).categories, ["Clinical Medicine", "Dentistry"]);
    assert.deepEqual((programCalls[1] as any).levels, ["phd"]);
    assert.deepEqual((universityCalls[0] as any).categories, ["medicine"]);
    assert.deepEqual((universityCalls[0] as any).levels, ["bachelor"]);
    assert.equal((universityCalls[0] as any).pageSize, 5);
    assert.deepEqual((universityCalls[1] as any).categories, ["medicine"]);
    assert.deepEqual((universityCalls[1] as any).institutionTypes, ["research"]);
    assert.equal((universityCalls[1] as any).includeMeta, true);
  });

  test("tools cost estimate prefers official MYR program tuition when programId is provided", async () => {
    const service = new ToolsService(
      {
        findOne: async () => program({
          officialTuitionMYR: 62000,
          officialFeeSourceUrl: "https://example.edu/fees",
          officialFeeAuditStatus: "matched-official",
          officialSourceStatus: "official-verified",
          university: university({ livingCostCny: 30000 })
        })
      } as any,
      { findOneBy: async () => university() } as any
    );

    const result = await service.costEstimate({
      programId: 11,
      tuition: 12000,
      currency: "MYR",
      duration: 2,
      livingCost: 10000,
      miscCost: 3000
    });

    assert.equal(result.currency, "MYR");
    assert.equal(result.tuitionTotal, 62000);
    assert.equal(result.livingTotal, 20000);
    assert.equal(result.miscTotal, 3000);
    assert.equal(result.total, 85000);
    assert.equal(result.source.tuitionSource, "official-myr-total");
    assert.equal(result.source.officialFeeSourceUrl, "https://example.edu/fees");
  });

  test("tools cost estimate rejects ready programs attached to hidden universities", async () => {
    const hiddenUniversity = university({
      isPublished: false,
      publicDisplayStatus: "hidden-unverified"
    });
    const service = new ToolsService(
      {
        findOne: async () => program({ university: hiddenUniversity })
      } as any,
      { findOneBy: async () => null } as any
    );

    await assert.rejects(
      () => service.costEstimate({ programId: 11 }),
      (error) => error instanceof NotFoundException && error.message === "University not found"
    );
  });

  test("tools cost estimate supports manual input without a program", async () => {
    const service = new ToolsService({} as any, {} as any);

    const result = await service.costEstimate({
      tuition: 15000,
      currency: "CNY",
      duration: 2,
      livingCost: 8000,
      miscCost: 1200
    });

    assert.equal(result.currency, "CNY");
    assert.equal(result.tuitionTotal, 30000);
    assert.equal(result.livingTotal, 16000);
    assert.equal(result.miscTotal, 1200);
    assert.equal(result.total, 47200);
    assert.equal(result.source.tuitionSource, "manual-input");
    assert.equal(result.program, null);
  });

  test("tools controller exposes the cost estimate endpoint contract", async () => {
    const calls: unknown[] = [];
    const controller = new ToolsController({
      costEstimate: async (input: unknown) => {
        calls.push(input);
        return { total: 100, currency: "CNY", breakdown: [] };
      }
    } as any);

    assert.deepEqual(await controller.costEstimate({ tuition: 100, currency: "CNY" } as any), {
      total: 100,
      currency: "CNY",
      breakdown: []
    });
    assert.deepEqual(calls, [{ tuition: 100, currency: "CNY" }]);
  });

  test("favorites only expose and merge public catalog targets", async () => {
    const hiddenUniversity = university({
      id: 2,
      slug: "hidden-university",
      code: "HID",
      isPublished: false,
      publicDisplayStatus: "hidden-unverified"
    });
    const readyProgram = program({ university: university() });
    const hiddenProgram = program({
      id: 12,
      universityId: 2,
      slug: "hidden-program",
      code: "HIDP",
      university: hiddenUniversity,
      isPublished: false,
      publicDisplayStatus: "hidden-unverified"
    });
    const favorites = [
      { userId: 7, favoriteType: "university", targetId: 1, createdAt: new Date("2026-01-04") },
      { userId: 7, favoriteType: "university", targetId: 2, createdAt: new Date("2026-01-03") },
      { userId: 7, favoriteType: "program", targetId: 11, createdAt: new Date("2026-01-02") },
      { userId: 7, favoriteType: "program", targetId: 12, createdAt: new Date("2026-01-01") }
    ];
    const savedFavorites: unknown[] = [];
    const service = new FavoritesService(
      {
        find: async () => favorites,
        findOne: async ({ where }: any) => favorites.find((item) => item.userId === where.userId && item.favoriteType === where.favoriteType && item.targetId === where.targetId) || null,
        create: (payload: unknown) => payload,
        save: async (payload: unknown) => {
          savedFavorites.push(payload);
          return payload;
        },
        remove: async () => undefined
      } as any,
      {
        findBy: async () => [university()],
        findOneBy: async (where: any) => where.id === 1 ? university() : null
      } as any,
      {
        find: async () => [readyProgram],
        findOne: async ({ where }: any) => where.id === 11 ? readyProgram : null
      } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined,
        del: async () => undefined
      } as any
    );

    const listResult = await service.list(7) as any;
    assert.deepEqual(listResult.universityIds, [1]);
    assert.deepEqual(listResult.programIds, [11]);
    assert.equal(listResult.universities.length, 1);
    assert.equal(listResult.programs.length, 1);

    await assert.rejects(
      () => service.add(7, "university", 2),
      (error) => error instanceof NotFoundException && error.message === "University not found"
    );

    const mergeResult = await service.merge(7, { universityIds: [1, 2], programIds: [11, 12] }) as any;
    assert.deepEqual(mergeResult.skippedUniversityIds, [2]);
    assert.deepEqual(mergeResult.skippedProgramIds, [12]);
    assert.equal(savedFavorites.flat().some((item: any) => item.targetId === hiddenUniversity.id || item.targetId === hiddenProgram.id), false);
  });

  test("planner hides saved private targets and rejects private task targets", async () => {
    const readyUniversity = university();
    const hiddenUniversity = university({
      id: 2,
      slug: "hidden-university",
      code: "HID",
      isPublished: false,
      publicDisplayStatus: "hidden-unverified"
    });
    const readyProgram = program({ university: readyUniversity });
    const hiddenProgram = program({
      id: 12,
      universityId: 2,
      slug: "hidden-program",
      code: "HIDP",
      university: hiddenUniversity,
      isPublished: true,
      publicDisplayStatus: "ready"
    });
    const defaultTask = {
      tier: text("New"),
      stage: "draft",
      progress: 18,
      deadlineNote: text("Confirm shortlist"),
      nextAction: text("Prepare package"),
      createdAt: new Date("2026-01-01")
    };
    const savedTasks = [
      { id: 31, userId: 7, universityId: 1, programId: 11, university: readyUniversity, program: readyProgram, ...defaultTask },
      { id: 32, userId: 7, universityId: 2, programId: 12, university: hiddenUniversity, program: hiddenProgram, ...defaultTask }
    ];
    const profile = plannerProfile({
      completenessStatus: "complete",
      missingProfileFields: [],
      profileCompletedAt: new Date("2026-05-25T00:00:00.000Z")
    });
    const service = new PlannerService(
      {
        findOneBy: async () => profile,
        save: async (payload: unknown) => payload,
        create: (payload: unknown) => payload
      } as any,
      {
        find: async () => savedTasks,
        findOne: async () => null,
        create: (payload: unknown) => payload,
        save: async (payload: unknown) => payload,
        remove: async () => undefined
      } as any,
      {
        find: async () => [readyProgram, hiddenProgram],
        findOneBy: async (where: any) => where.id === 11 && where.universityId === 1 ? readyProgram : null
      } as any,
      {
        find: async () => [readyUniversity],
        findOneBy: async (where: any) => where.id === 1 ? readyUniversity : null
      } as any,
      { findOneBy: async () => ({ id: 7 }) } as any
    );

    const dashboard = await service.getDashboard(7) as any;
    assert.deepEqual(dashboard.tasks.map((item: any) => item.id), [31]);
    assert.equal(dashboard.summary.activeTaskCount, 1);
    assert.equal(dashboard.summary.recommendationCount, 1);
    assert.deepEqual(dashboard.recommendations.map((item: any) => item.program.id), [11]);

    await assert.rejects(
      () => service.addTask(7, 2, 12),
      (error) => error instanceof NotFoundException && error.message === "University not found"
    );

    const mergeResult = await service.mergeLocalState(7, { tasks: [{ universityId: 2, programId: 12 }] }) as any;
    assert.deepEqual(mergeResult.skippedTasks, [
      { universityId: 2, programId: 12, reason: "Target university or program not found" }
    ]);
    assert.deepEqual(mergeResult.dashboard.tasks.map((item: any) => item.id), [31]);
  });

  test("planner dashboard does not expose recommendations for default incomplete profiles", async () => {
    const profile = plannerProfile();
    const service = plannerServiceWithProfile(profile);

    const dashboard = await service.getDashboard(7) as any;

    assert.deepEqual(dashboard.recommendations, []);
    assert.equal(dashboard.summary.recommendationCount, 0);
    assert.equal(dashboard.profile.level, "master");
  });

  test("planner profile patch does not complete recommendation state from default values", async () => {
    const profile = plannerProfile();
    const service = plannerServiceWithProfile(profile);

    const dashboard = await service.updateProfile(7, { gpa: 3.8 }) as any;

    assert.equal(profile.completenessStatus, "incomplete");
    assert.equal(profile.profileCompletedAt, null);
    assert.equal(profile.profileSnapshotHash, "");
    assert.equal(profile.missingProfileFields.includes("gpa"), false);
    assert.equal(profile.missingProfileFields.includes("level"), true);
    assert.equal(profile.missingProfileFields.includes("targetCategory"), true);
    assert.deepEqual(dashboard.recommendations, []);
    assert.equal(dashboard.summary.recommendationCount, 0);
  });

  test("planner full profile update enables gated recommendations", async () => {
    const profile = plannerProfile();
    const service = plannerServiceWithProfile(profile);

    const dashboard = await service.updateProfile(7, {
      level: "master",
      targetCategory: "it",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6.5,
      acceptNoLanguage: true
    }) as any;

    assert.equal(profile.completenessStatus, "complete");
    assert.deepEqual(profile.missingProfileFields, []);
    assert.equal(profile.profileCompletedAt instanceof Date, true);
    assert.notEqual(profile.profileSnapshotHash, "");
    assert.equal(dashboard.summary.recommendationCount, 1);
    assert.deepEqual(dashboard.recommendations.map((item: any) => item.program.id), [11]);
  });

  test("home metadata uses the same public catalog scope as public lists", async () => {
    const hiddenUniversity = university({
      id: 2,
      slug: "hidden-university",
      code: "HID",
      isPublished: false,
      publicDisplayStatus: "hidden-unverified",
      officialSourceStatus: "missing-source"
    });
    const service = new UniversitiesService(
      { find: async () => [university()] } as any,
      { find: async () => [program(), program({ id: 12, universityId: 2, university: hiddenUniversity })] } as any,
      { find: async () => [] } as any,
      {
        getJson: async () => null,
        setJson: async () => undefined
      } as any
    );

    const result = await service.getHomeMeta() as any;

    assert.equal(result.stats.universityCount, 1);
    assert.equal(result.stats.programCount, 1);
    assert.equal(result.stats.readyProgramCount, 1);
    assert.equal(result.stats.officialVerifiedCount, 1);
  });

  test("auth controller exposes the current user state endpoint", async () => {
    const controller = new AuthController({
      me: async (id: number) => ({ id, role: "student", displayName: "Student", method: "email", account: "student@example.com" })
    } as any);

    assert.deepEqual(await controller.me({ user: { id: 7 } }), {
      id: 7,
      role: "student",
      displayName: "Student",
      method: "email",
      account: "student@example.com"
    });
  });
});
