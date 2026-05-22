import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { apiFetch, API_BASE_URL } from "../../apps/web/src/api/client.ts";

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
});

describe("web API client", () => {
  test("merges JSON headers, custom headers and bearer token", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const result = await apiFetch<{ ok: boolean }>("/planner", {
      method: "PATCH",
      headers: { "X-Trace-Id": "trace-1" },
      body: JSON.stringify({ level: "master" })
    }, "token-1");

    assert.deepEqual(result, { ok: true });
    assert.equal(String(requests[0].input), `${API_BASE_URL}/planner`);
    assert.equal(requests[0].init?.method, "PATCH");
    assert.equal((requests[0].init?.headers as Record<string, string>)["Content-Type"], "application/json");
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, "Bearer token-1");
    assert.equal((requests[0].init?.headers as Record<string, string>)["X-Trace-Id"], "trace-1");
  });

  test("formats API validation errors for automation logs", async () => {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ message: ["account must be an email", "password is too short"] }),
      { status: 400 }
    );

    await assert.rejects(
      () => apiFetch("/auth/login", { method: "POST" }),
      /account must be an email; password is too short/
    );
  });
});
