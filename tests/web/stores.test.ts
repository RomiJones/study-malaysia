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
