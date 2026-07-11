import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AdminRequestUser } from "../../apps/api/src/common/guards.ts";
import {
  applicationStatusScopeForActor,
  canAssignApplications,
  canReviewApplicationMaterials,
  canSeeAllApplications,
  canUpdateApplicationStatus
} from "../../apps/api/src/admin/admin-applications.service.ts";

function actor(overrides: Partial<AdminRequestUser>): AdminRequestUser {
  return {
    id: 1,
    username: "tester",
    displayName: "Tester",
    dataScope: "assigned",
    managedUniversityIds: [],
    permissions: ["application:view", "application:followup"],
    roleCodes: [],
    ...overrides
  };
}

describe("admin application access rules", () => {
  test("allows super admin and application manager to assign cases", () => {
    const superAdmin = actor({ dataScope: "all", roleCodes: ["super-admin"] });
    const manager = actor({ roleCodes: ["application-manager"] });

    assert.equal(canSeeAllApplications(superAdmin), true);
    assert.equal(canAssignApplications(superAdmin), true);
    assert.equal(canAssignApplications(manager), true);
  });

  test("keeps consultants assigned-only and out of assignment authority", () => {
    const consultant = actor({ roleCodes: ["counselor"], permissions: ["application:view", "application:followup", "application:update"] });

    assert.equal(canSeeAllApplications(consultant), false);
    assert.equal(canAssignApplications(consultant), false);
    assert.equal(canReviewApplicationMaterials(consultant), true);
    assert.equal(applicationStatusScopeForActor(consultant), null);
    assert.equal(canUpdateApplicationStatus(consultant, "school-submitted"), true);
  });

  test("limits material auditors and visa specialists to their case stages", () => {
    const auditor = actor({ roleCodes: ["material-auditor"] });
    const visa = actor({ roleCodes: ["visa-specialist"] });

    assert.deepEqual(applicationStatusScopeForActor(auditor), ["submitted", "reviewing", "need-info"]);
    assert.equal(canReviewApplicationMaterials(auditor), true);
    assert.equal(canUpdateApplicationStatus(auditor, "platform-approved"), true);
    assert.equal(canUpdateApplicationStatus(auditor, "school-submitted"), false);

    assert.deepEqual(applicationStatusScopeForActor(visa), ["visa", "done"]);
    assert.equal(canReviewApplicationMaterials(visa), false);
    assert.equal(canUpdateApplicationStatus(visa, "visa"), true);
    assert.equal(canUpdateApplicationStatus(visa, "need-info"), false);
  });
});
