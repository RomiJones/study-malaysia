import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createPinia, setActivePinia } from "pinia";
import { API_BASE_URL } from "../../apps/web/src/api/client.ts";
import { useSmartRecommendationsStore } from "../../apps/web/src/stores/recommendations.ts";
import { useSessionStore } from "../../apps/web/src/stores/session.ts";

const originalFetch = globalThis.fetch;

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

function createDeferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function createReadyResponse(userId: number) {
  return {
    schemaVersion: "2026-05-25",
    status: "ready",
    gate: {
      status: "ready",
      mode: "personalized-profile-match",
      canShowRecommendations: true,
      requiresAuthentication: false,
      requiresCompleteProfile: false,
      primaryAction: "view-results",
      message: { en: "Ready", ms: "Ready", "zh-CN": "Ready", "zh-TW": "Ready" },
      blockReasons: [],
      missingProfileFields: []
    },
    profile: {
      userId,
      source: "saved-user-profile",
      profileVersion: `profile-${userId}`,
      updatedAt: "2026-05-25T00:00:00.000Z",
      level: "master",
      targetCategory: "business",
      budgetCny: 120000,
      gpa: 3.4,
      ielts: 6.5,
      acceptNoLanguage: false
    },
    profileCompleteness: null,
    recommendations: [
      { score: 91, program: { id: 101 }, university: { id: 1 } }
    ]
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStorage(),
    configurable: true
  });
  globalThis.fetch = originalFetch;
  setActivePinia(createPinia());
});

after(() => {
  globalThis.fetch = originalFetch;
});

describe("smart recommendation store", () => {
  test("keeps anonymous users behind the login gate without calling the API", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response("{}", { status: 200 });
    };

    const smart = useSmartRecommendationsStore();
    await smart.load("en");

    assert.equal(called, false);
    assert.equal(smart.status, "login-required");
    assert.equal(smart.gate?.requiresAuthentication, true);
    assert.deepEqual(smart.recommendations, []);
  });

  test("loads personalized recommendations with the current bearer token and locale", async () => {
    localStorage.setItem("studymy_token", "token-1");
    localStorage.setItem("studymy_user", JSON.stringify({ id: 7, role: "student", account: "student@example.com" }));
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({
        schemaVersion: "2026-05-25",
        status: "profile-incomplete",
        gate: {
          status: "profile-incomplete",
          mode: "personalized-profile-match",
          canShowRecommendations: false,
          requiresAuthentication: false,
          requiresCompleteProfile: true,
          primaryAction: "open-profile",
          message: { en: "Complete profile", ms: "Complete profile", "zh-CN": "完善画像", "zh-TW": "完善画像" },
          blockReasons: ["profile-incomplete"],
          missingProfileFields: ["gpa", "ielts"]
        },
        profile: null,
        profileCompleteness: {
          score: 66,
          threshold: 90,
          isComplete: false,
          requiredFields: ["level", "targetCategory", "budgetCny", "gpa", "ielts", "acceptNoLanguage"],
          optionalFields: ["experience"],
          completedFields: ["level", "targetCategory", "budgetCny", "acceptNoLanguage"],
          missingRequiredFields: ["gpa", "ielts"],
          missingOptionalFields: ["experience"]
        },
        recommendations: []
      }), { status: 200 });
    };

    const smart = useSmartRecommendationsStore();
    await smart.load("en");

    assert.equal(String(requests[0].input), `${API_BASE_URL}/recommendations/me?locale=en`);
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, "Bearer token-1");
    assert.equal(smart.status, "profile-incomplete");
    assert.deepEqual(smart.gate?.missingProfileFields, ["gpa", "ielts"]);
  });

  test("refreshes through the protected recommendation refresh endpoint", async () => {
    localStorage.setItem("studymy_token", "token-2");
    localStorage.setItem("studymy_user", JSON.stringify({ id: 8, role: "student", account: "student2@example.com" }));
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({
        schemaVersion: "2026-05-25",
        status: "no-match",
        gate: {
          status: "no-match",
          mode: "personalized-profile-match",
          canShowRecommendations: true,
          requiresAuthentication: false,
          requiresCompleteProfile: false,
          primaryAction: "adjust-profile",
          message: { en: "No match", ms: "No match", "zh-CN": "暂无匹配", "zh-TW": "暂无匹配" },
          blockReasons: [],
          missingProfileFields: []
        },
        profile: null,
        profileCompleteness: null,
        recommendations: []
      }), { status: 200 });
    };

    const smart = useSmartRecommendationsStore();
    await smart.refresh("zh-CN");

    assert.equal(String(requests[0].input), `${API_BASE_URL}/recommendations/refresh`);
    assert.equal(requests[0].init?.method, "POST");
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, "Bearer token-2");
    assert.match(String(requests[0].init?.body), /personalized-profile-match/);
    assert.equal(smart.status, "no-match");
  });

  test("discards an in-flight load response after account switch", async () => {
    localStorage.setItem("studymy_token", "token-a");
    localStorage.setItem("studymy_user", JSON.stringify({ id: 1, role: "student", account: "student-a@example.com" }));
    const pending = createDeferredResponse();
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return pending.promise;
    };

    const smart = useSmartRecommendationsStore();
    const session = useSessionStore();

    const loadPromise = smart.load("en");
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, "Bearer token-a");

    session.token = "token-b";
    session.user = { id: 2, role: "student", account: "student-b@example.com" };
    pending.resolve(new Response(JSON.stringify(createReadyResponse(1)), { status: 200 }));
    await loadPromise;

    assert.equal(session.token, "token-b");
    assert.equal(smart.status, "login-required");
    assert.deepEqual(smart.recommendations, []);
    assert.equal(smart.response, null);
    assert.equal(smart.loading, false);
  });

  test("discards an in-flight refresh response after account switch", async () => {
    localStorage.setItem("studymy_token", "token-a");
    localStorage.setItem("studymy_user", JSON.stringify({ id: 1, role: "student", account: "student-a@example.com" }));
    const pending = createDeferredResponse();
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return pending.promise;
    };

    const smart = useSmartRecommendationsStore();
    const session = useSessionStore();

    const refreshPromise = smart.refresh("en");
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, "Bearer token-a");

    session.token = "token-b";
    session.user = { id: 2, role: "student", account: "student-b@example.com" };
    pending.resolve(new Response(JSON.stringify(createReadyResponse(1)), { status: 200 }));
    await refreshPromise;

    assert.equal(session.token, "token-b");
    assert.equal(smart.status, "login-required");
    assert.deepEqual(smart.recommendations, []);
    assert.equal(smart.response, null);
    assert.equal(smart.loading, false);
  });

  test("keeps the newest response when same-session requests finish out of order", async () => {
    localStorage.setItem("studymy_token", "token-a");
    localStorage.setItem("studymy_user", JSON.stringify({ id: 1, role: "student", account: "student-a@example.com" }));
    const firstPending = createDeferredResponse();
    const secondPending = createDeferredResponse();
    const pendingResponses = [firstPending, secondPending];
    let requestIndex = 0;
    globalThis.fetch = async () => pendingResponses[requestIndex++].promise;

    const smart = useSmartRecommendationsStore();
    const firstLoad = smart.load("en");
    const secondLoad = smart.load("en", { force: true });

    secondPending.resolve(new Response(JSON.stringify(createReadyResponse(2)), { status: 200 }));
    await secondLoad;
    assert.equal(smart.response?.profile?.userId, 2);
    assert.equal(smart.loading, false);

    firstPending.resolve(new Response(JSON.stringify(createReadyResponse(1)), { status: 200 }));
    await firstLoad;

    assert.equal(smart.response?.profile?.userId, 2);
    assert.equal(smart.loading, false);
  });

  test("hides cached recommendations after logout or account switch", async () => {
    localStorage.setItem("studymy_token", "token-3");
    localStorage.setItem("studymy_user", JSON.stringify({ id: 9, role: "student", account: "student3@example.com" }));
    globalThis.fetch = async () => new Response(JSON.stringify({
      schemaVersion: "2026-05-25",
      status: "ready",
      gate: {
        status: "ready",
        mode: "personalized-profile-match",
        canShowRecommendations: true,
        requiresAuthentication: false,
        requiresCompleteProfile: false,
        primaryAction: "view-results",
        message: { en: "Ready", ms: "Ready", "zh-CN": "已生成", "zh-TW": "已生成" },
        blockReasons: [],
        missingProfileFields: []
      },
      profile: null,
      profileCompleteness: null,
      recommendations: [
        { score: 91, program: { id: 101 }, university: { id: 1 } }
      ]
    }), { status: 200 });

    const smart = useSmartRecommendationsStore();
    const session = useSessionStore();

    await smart.load("en");
    assert.equal(smart.recommendations.length, 1);

    session.token = "token-4";
    assert.equal(smart.status, "login-required");
    assert.deepEqual(smart.recommendations, []);

    session.logout();
    assert.equal(smart.status, "login-required");
    assert.deepEqual(smart.recommendations, []);
  });
});
