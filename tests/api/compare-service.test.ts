import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CompareService } from "../../apps/api/src/compare/compare.service.ts";

function text(en: string, zh = en) {
  return { en, ms: en, "zh-CN": zh, "zh-TW": zh };
}

function list(values: string[] = []) {
  return { en: values, ms: values, "zh-CN": values, "zh-TW": values };
}

function university(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `university-${id}`,
    code: `UNI${id}`,
    name: text(`University ${id}`),
    shortName: `U${id}`,
    logoUrl: "",
    imageUrl: "",
    color: "#1B7A72",
    qsRank: 100 + id,
    qsAsiaRank: null,
    location: text("Kuala Lumpur"),
    region: text("Kuala Lumpur"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1900,
    students: 10000,
    intlStudents: 1000,
    csrCertified: false,
    description: text("Public university"),
    website: `https://university-${id}.example.edu`,
    admissionEmail: "",
    nameEnOfficial: `University ${id}`,
    officialWebsite: `https://university-${id}.example.edu`,
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
    officialVerifiedAt: null,
    officialSourceStatus: "official-verified",
    officialAuditSummary: "",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "",
    tuitionMinCny: 30000,
    tuitionMaxCny: 70000,
    livingCostCny: 24000,
    minIelts: 5.5,
    acceptNoLanguage: true,
    facilities: list(),
    highlights: list(),
    programCount: 0,
    isPublished: true,
    ...overrides
  };
}

function findOperatorValues(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number);
  if (value && typeof value === "object" && "_value" in value) {
    return findOperatorValues((value as { _value: unknown })._value);
  }
  return [Number(value)].filter((item) => Number.isInteger(item));
}

function matchesWhere(item: Record<string, unknown>, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, value]) => {
    const values = findOperatorValues(value);
    if (values.length && values.every((entry) => Number.isInteger(entry))) {
      return values.includes(Number(item[key]));
    }
    return item[key] === value;
  });
}

function createService(options: { universities?: any[]; initialItems?: any[] } = {}) {
  const universities = options.universities ?? [1, 2, 3, 4, 5].map(university);
  let nextId = 1;
  const items: any[] = (options.initialItems || []).map((item) => ({
    id: nextId++,
    createdAt: new Date(),
    sortOrder: 0,
    ...item
  }));
  const compareRepository = {
    find: async ({ where }: { where: { userId: number } }) =>
      items
        .filter((item) => item.userId === where.userId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        .map((item) => ({ ...item, university: universities.find((entry) => entry.id === item.universityId) })),
    findOne: async ({ where }: { where: { userId: number; universityId: number } }) =>
      items.find((item) => item.userId === where.userId && item.universityId === where.universityId) || null,
    create: (data: Record<string, unknown>) => ({ id: 0, createdAt: new Date(), ...data }),
    save: async (value: any) => {
      if (Array.isArray(value)) {
        return Promise.all(value.map((item) => compareRepository.save(item)));
      }
      if (!value.id) {
        value.id = nextId;
        nextId += 1;
        items.push(value);
        return value;
      }
      const index = items.findIndex((item) => item.id === value.id);
      if (index >= 0) items[index] = value;
      return value;
    },
    remove: async (value: any) => {
      const index = items.findIndex((item) => item.id === value.id);
      if (index >= 0) items.splice(index, 1);
      return value;
    }
  };
  const universitiesRepository = {
    findOneBy: async (where: Record<string, unknown>) => universities.find((item) => matchesWhere(item, where)) || null,
    findBy: async (where: Record<string, unknown>) => universities.filter((item) => matchesWhere(item, where))
  };

  return new CompareService(compareRepository as any, universitiesRepository as any);
}

describe("compare service", () => {
  test("allows the fourth university and rejects the fifth", async () => {
    const service = createService();

    await service.add(7, 1);
    await service.add(7, 2);
    await service.add(7, 3);
    const afterFourth = await service.add(7, 4);

    assert.deepEqual(afterFourth.universityIds, [1, 2, 3, 4]);
    assert.equal(afterFourth.maxItems, 4);
    await assert.rejects(() => service.add(7, 5), /up to 4 universities/);
  });

  test("merge keeps at most four universities and reports maxItems as four", async () => {
    const service = createService();

    const result = await service.merge(7, [1, 2, 3, 4, 5]);

    assert.deepEqual(result.universityIds, [1, 2, 3, 4]);
    assert.equal(result.maxItems, 4);
    assert.equal(result.universities.length, 4);
  });

  test("rejects hidden or unpublished universities when adding to compare list", async () => {
    const service = createService({
      universities: [
        university(1),
        university(2, { isPublished: false, publicDisplayStatus: "hidden-unverified" })
      ]
    });

    await assert.rejects(() => service.add(7, 2), /University not found/);
    const result = await service.list(7);

    assert.deepEqual(result.universityIds, []);
  });

  test("merge skips hidden universities", async () => {
    const service = createService({
      universities: [
        university(1),
        university(2, { isPublished: false, publicDisplayStatus: "hidden-unverified" }),
        university(3)
      ]
    });

    const result = await service.merge(7, [1, 2, 3]);

    assert.deepEqual(result.universityIds, [1, 3]);
    assert.deepEqual(result.skippedUniversityIds, [2]);
  });

  test("list does not expose previously saved hidden universities", async () => {
    const service = createService({
      universities: [
        university(1),
        university(2, { isPublished: false, publicDisplayStatus: "hidden-unverified" })
      ],
      initialItems: [
        { userId: 7, universityId: 1, sortOrder: 0 },
        { userId: 7, universityId: 2, sortOrder: 1 }
      ]
    });

    const result = await service.list(7);

    assert.deepEqual(result.universityIds, [1]);
    assert.equal(result.universities.length, 1);
    assert.equal(result.universities[0].publicDisplayStatus, "ready");
  });
});
