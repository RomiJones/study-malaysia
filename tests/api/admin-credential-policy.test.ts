import assert from "node:assert/strict";
import test from "node:test";
import { requireSeedAdminPassword, seedAdminUsers } from "../../apps/api/src/db/admin-seed.ts";

test("admin seed identities do not contain committed passwords", () => {
  assert.ok(seedAdminUsers.length > 0);
  assert.ok(seedAdminUsers.every((user) => !("password" in user)));
});

test("admin seed requires an explicit strong bootstrap password", () => {
  assert.throws(() => requireSeedAdminPassword({}), /must be set/);
  assert.throws(() => requireSeedAdminPassword({ STUDYMY_SEED_ADMIN_PASSWORD: "short" }), /at least 12/);
  assert.equal(
    requireSeedAdminPassword({ STUDYMY_SEED_ADMIN_PASSWORD: "unique-test-bootstrap" }),
    "unique-test-bootstrap"
  );
});
