import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { useCatalogStore } from "../../apps/web/src/stores/catalog.ts";
import { useSessionStore } from "../../apps/web/src/stores/session.ts";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    }
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStorage(),
    configurable: true
  });
  setActivePinia(createPinia());
});

describe("web stores", () => {
  test("catalog store sorts universities by QS WUR rank by default", () => {
    const catalog = useCatalogStore();

    catalog.universities = [
      university({ id: 1, code: "UM", qsRank: 56, name: { en: "Universiti Malaya", "zh-CN": "马来亚大学" } }),
      university({ id: 2, code: "MONASH", qsRank: 31, name: { en: "Monash University Malaysia", "zh-CN": "莫纳什大学马来西亚校区" } }),
      university({ id: 3, code: "AIMST", qsRank: 9999, name: { en: "AIMST University", "zh-CN": "亚洲医药科技大学" } }),
      university({ id: 4, code: "USM", qsRank: 128, name: { en: "Universiti Sains Malaysia", "zh-CN": "马来西亚理科大学" } }),
      university({ id: 5, code: "UKM", qsRank: 130, name: { en: "Universiti Kebangsaan Malaysia", "zh-CN": "马来西亚国民大学" } }),
      university({ id: 6, code: "UPM", qsRank: 138, name: { en: "Universiti Putra Malaysia", "zh-CN": "博特拉大学" } })
    ];

    assert.deepEqual(
      catalog.filteredUniversities.map((item) => item.code),
      ["MONASH", "UM", "USM", "UKM", "UPM", "AIMST"]
    );
  });

  test("catalog store keeps QS WUR order after search filtering", () => {
    const catalog = useCatalogStore();

    catalog.universities = [
      university({
        id: 1,
        code: "MONASH",
        shortName: "Monash",
        nameEnOfficial: "Monash University Malaysia",
        qsRank: 31,
        name: { en: "Monash University Malaysia", "zh-CN": "\u83ab\u7eb3\u4ec0\u5927\u5b66\u9a6c\u6765\u897f\u4e9a\u6821\u533a" },
        location: { en: "Bandar Sunway", "zh-CN": "\u96ea\u5170\u83aa\u53cc\u5a01\u9547" },
        region: { en: "Selangor", "zh-CN": "\u96ea\u5170\u83aa" }
      }),
      university({
        id: 2,
        code: "SUNWAY",
        shortName: "Sunway",
        nameEnOfficial: "Sunway University",
        qsRank: 354,
        name: { en: "Sunway University", "zh-CN": "\u53cc\u5a01\u5927\u5b66" },
        location: { en: "Bandar Sunway", "zh-CN": "\u96ea\u5170\u83aa\u53cc\u5a01\u57ce" },
        region: { en: "Selangor", "zh-CN": "\u96ea\u5170\u83aa" }
      })
    ];
    catalog.search = "\u53cc\u5a01";

    assert.deepEqual(
      catalog.filteredUniversities.map((item) => item.code),
      ["MONASH", "SUNWAY"]
    );
  });

  test("session store persists login state from the user API", async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      accessToken: "token-1",
      user: {
        id: 3,
        role: "student",
        displayName: "Student",
        method: "email",
        account: "student@example.com"
      }
    }), { status: 200 });

    const session = useSessionStore();
    const user = await session.submitAuth("login", {
      method: "email",
      account: "student@example.com",
      password: "secret123"
    });

    assert.equal(user.id, 3);
    assert.equal(session.isLoggedIn, true);
    assert.equal(localStorage.getItem("studymy_token"), "token-1");
    assert.match(localStorage.getItem("studymy_user") || "", /student@example.com/);

    session.logout();
    assert.equal(session.isLoggedIn, false);
    assert.equal(localStorage.getItem("studymy_token"), null);
  });

  test("catalog store keeps compare state local and enforces the four-school limit", async () => {
    const catalog = useCatalogStore();

    assert.equal(await catalog.toggleCompare(1), true);
    assert.equal(await catalog.toggleCompare(2), true);
    assert.equal(await catalog.toggleCompare(3), true);
    assert.equal(await catalog.toggleCompare(4), true);
    assert.equal(await catalog.toggleCompare(5), false);
    assert.deepEqual(catalog.compareIds, [1, 2, 3, 4]);
    assert.equal(catalog.compareMessage, "最多只能同时对比 4 所院校");
    assert.equal(localStorage.getItem("studymy_compare"), "[1,2,3,4]");

    assert.equal(await catalog.toggleCompare(2), true);
    assert.deepEqual(catalog.compareIds, [1, 3, 4]);
  });
});

function university(overrides: Record<string, unknown>) {
  return {
    id: 0,
    code: "",
    name: { en: "", ms: "", "zh-CN": "", "zh-TW": "" },
    ownership: "public",
    qsRank: 9999,
    tuitionMinCny: 0,
    tuitionMaxCny: 0,
    acceptNoLanguage: false,
    ...overrides
  } as any;
}
