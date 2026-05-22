import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AdminPermissionGuard } from "../../apps/api/src/common/guards.ts";

function makeContext(adminUser?: { permissions: string[] }) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ adminUser })
    })
  } as any;
}

describe("admin permission guard", () => {
  test("allows routes without permission metadata", () => {
    const guard = new AdminPermissionGuard({ getAllAndOverride: () => undefined } as any);
    assert.equal(guard.canActivate(makeContext()), true);
  });

  test("allows users that have every required permission", () => {
    const guard = new AdminPermissionGuard({ getAllAndOverride: () => ["program:view", "program:update"] } as any);
    assert.equal(guard.canActivate(makeContext({ permissions: ["program:view", "program:update", "university:view"] })), true);
  });

  test("rejects missing admin user and incomplete permission sets", () => {
    const guard = new AdminPermissionGuard({ getAllAndOverride: () => ["program:update"] } as any);
    assert.throws(() => guard.canActivate(makeContext()), UnauthorizedException);
    assert.throws(() => guard.canActivate(makeContext({ permissions: ["program:view"] })), ForbiddenException);
  });
});
