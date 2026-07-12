import assert from "node:assert/strict";
import test from "node:test";
import { allocateLoopbackPort, buildIsolatedDatabaseName } from "../../scripts/e2e-isolation.mjs";

test("E2E isolation creates run-specific database names", () => {
  assert.equal(buildIsolatedDatabaseName("2026-07-12T01:02:03Z"), "study_malaysia_e2e_20260712t010203z");
  assert.throws(() => buildIsolatedDatabaseName("---"), /non-empty/);
});

test("E2E isolation allocates distinct available loopback ports", async () => {
  const [first, second] = await Promise.all([allocateLoopbackPort(), allocateLoopbackPort()]);
  assert.ok(first > 0);
  assert.ok(second > 0);
  assert.notEqual(first, second);
});
