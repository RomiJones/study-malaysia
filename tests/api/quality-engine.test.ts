import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { QualityEngineService } from "../../apps/api/src/admin/quality-engine.service.ts";

function localized(overrides: Record<string, string> = {}) {
  return { en: "Program", ms: "Program", "zh-CN": "专业", "zh-TW": "專業", ...overrides };
}

function repository<T extends { id?: number }>(items: T[] = []) {
  let nextId = Math.max(0, ...items.map((item) => item.id || 0)) + 1;
  return {
    items,
    create: (payload: Partial<T> | Partial<T>[]) => Array.isArray(payload) ? payload.map((item) => ({ ...item })) : { ...payload },
    save: async (payload: T | T[]) => {
      const values = Array.isArray(payload) ? payload : [payload];
      const saved = values.map((item) => {
        if (!item.id) item.id = nextId++;
        const index = items.findIndex((existing) => existing.id === item.id);
        if (index >= 0) items[index] = item;
        else items.push(item);
        return item;
      });
      return Array.isArray(payload) ? saved : saved[0];
    },
    find: async (options?: any) => filterItems(items, options?.where),
    findOne: async (options?: any) => filterItems(items, options?.where)[0] || null,
    findOneBy: async (where: any) => filterItems(items, where)[0] || null,
    delete: async (where: any) => {
      const removeIds = new Set(filterItems(items, where).map((item) => item.id));
      for (let index = items.length - 1; index >= 0; index -= 1) {
        if (removeIds.has(items[index].id)) items.splice(index, 1);
      }
    },
    count: async (options?: any) => filterItems(items, options?.where).length
  };
}

function filterItems<T>(items: T[], where?: any): T[] {
  if (!where || !Object.keys(where).length) return [...items];
  const branches = Array.isArray(where) ? where : [where];
  return items.filter((item) => branches.some((branch) => Object.entries(branch).every(([key, value]) => (item as any)[key] === value)));
}

describe("quality engine", () => {
  test("initializes rules and persists high and medium quality issues", async () => {
    const university = {
      id: 1,
      code: "UM",
      shortName: "UM",
      name: localized(),
      website: "",
      officialWebsite: "",
      officialSources: [],
      isPublished: true,
      publicDisplayStatus: "ready",
      officialSourceStatus: "needs-review"
    };
    const program = {
      id: 11,
      universityId: 1,
      name: localized({ ms: "" }),
      nameEnOfficial: "Master",
      code: "P1",
      category: "unknown",
      officialTuitionMYR: 20000,
      officialFeeSourceUrl: "",
      officialFeeAuditStatus: "conflict",
      tuitionCurrency: "MYR",
      publicDisplayStatus: "ready",
      isPublished: true,
      university
    };
    const rulesRepo = repository<any>([]);
    const issuesRepo = repository<any>([]);
    const service = new QualityEngineService(
      repository<any>([university]) as any,
      repository<any>([program]) as any,
      repository<any>([{ id: 1, dictType: "program_category", code: "it", status: "enabled" }]) as any,
      rulesRepo as any,
      issuesRepo as any
    );

    const result = await service.runFullCheck();
    const ruleIds = rulesRepo.items.map((rule) => rule.ruleId);
    const issueRuleIds = issuesRepo.items.map((issue) => issue.ruleId);

    assert.deepEqual(ruleIds, ["R001", "R002", "R003", "R004", "R005", "R006"]);
    assert.equal(result.generated >= 5, true);
    assert.equal(issueRuleIds.includes("R001"), true);
    assert.equal(issueRuleIds.includes("R002"), true);
    assert.equal(issueRuleIds.includes("R003"), true);
    assert.equal(issueRuleIds.includes("R004"), true);
    assert.equal(issueRuleIds.includes("R005"), true);
    assert.equal(result.summary.highSeverity >= 2, true);
    assert.equal(result.summary.mediumSeverity >= 2, true);
  });
});
