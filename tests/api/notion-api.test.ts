import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdminAuthGuard } from "../../apps/api/src/common/guards.ts";
import { NotionController, NotionTaskListQueryDto } from "../../apps/api/src/notion/notion.controller.ts";
import { NotionService, type NotionTaskContract } from "../../apps/api/src/notion/notion.service.ts";

function validationInput(contract: NotionTaskContract) {
  return {
    taskId: contract.taskId,
    title: contract.title,
    status: contract.status,
    taskType: contract.taskType
  };
}

function useSnapshotRoot(service: NotionService, snapshotRoot: string): void {
  (service as any).snapshotRoot = snapshotRoot;
  (service as any).taskRoot = join(snapshotRoot, "tasks");
}

function getExceptionResponse(error: unknown) {
  assert.ok(error instanceof UnprocessableEntityException);
  return error.getResponse() as Record<string, any>;
}

function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false
  });
}

describe("notion governance API contract", () => {
  test("controller endpoints require admin authentication", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, NotionController);

    assert.ok(Array.isArray(guards));
    assert.ok(guards.includes(AdminAuthGuard));
  });

  test("service parses TASK-076 contract and dependency plan from the snapshot", async () => {
    const service = new NotionService();

    const envelope = await service.getTaskContract("TASK-076");
    const contract = envelope.payload;
    const dependencyPlan = await service.getDependencyPlan("TASK-076");

    assert.equal(envelope.source, "notion-snapshot");
    assert.equal(contract.taskId, "TASK-076");
    assert.ok(contract.title.length > 0);
    assert.ok(contract.status.length > 0);
    assert.ok(contract.taskType.length > 0);
    assert.ok(contract.acceptanceCriteria.length > 0);
    assert.equal(dependencyPlan.parallelGroup, "api-endpoints");
    assert.deepEqual(dependencyPlan.impactScope.affectedApps, ["apps/api"]);
    assert.deepEqual(dependencyPlan.impactScope.affectedModules, ["apps/api:Notion"]);
    assert.equal(dependencyPlan.lockScope.lockScopeHint, "module_scope");
    assert.equal(dependencyPlan.lockScope.riskLevel, "medium");
  });

  test("service list supports task planning filters", async () => {
    const service = new NotionService();

    const result = await service.listTasks({
      parallelGroup: "api-endpoints",
      parentTaskId: "TASK-059",
      limit: 20
    });

    assert.ok(result.items.some((item) => item.taskId === "TASK-076"));
    assert.ok(result.items.every((item) => item.parallelGroup === "api-endpoints"));
    assert.ok(result.items.every((item) => item.parentTaskId === "TASK-059"));
  });

  test("controller list query rejects invalid limit values", async () => {
    const pipe = createValidationPipe();

    const valid = await pipe.transform(
      { limit: "20" },
      { type: "query", metatype: NotionTaskListQueryDto }
    );
    assert.equal(valid.limit, 20);

    for (const limit of ["abc", "1.5", "0", "201"]) {
      await assert.rejects(
        () => pipe.transform({ limit }, { type: "query", metatype: NotionTaskListQueryDto }),
        (error) => error instanceof BadRequestException
      );
    }
  });

  test("service maps invalid and missing task IDs to structured errors", async () => {
    const service = new NotionService();

    await assert.rejects(
      () => service.getTaskContract("TASK-76"),
      (error) => error instanceof BadRequestException
    );

    await assert.rejects(
      () => service.getTaskContract("TASK-999999"),
      (error) => error instanceof NotFoundException
    );
  });

  test("validate checks the real snapshot contract instead of returning a fixed success", async () => {
    const service = new NotionService();
    const contract = (await service.getTaskContract("TASK-076")).payload;
    const input = validationInput(contract);

    const valid = await service.validateTaskContract(input);

    assert.equal(valid.valid, true);
    assert.equal(valid.taskId, "TASK-076");
    assert.equal(valid.constraints.runtimeBusinessDatabase, false);
    assert.equal(valid.constraints.adminAuthRequired, true);

    await assert.rejects(
      () => service.validateTaskContract({ ...input, taskId: "TASK-999999" }),
      (error) => error instanceof NotFoundException
    );

    await assert.rejects(
      () => service.validateTaskContract({ ...input, title: "Mismatched title" }),
      (error) => {
        const response = getExceptionResponse(error);
        assert.equal(response.code, "NOTION_TASK_CONTRACT_INVALID");
        assert.ok(
          response.violations.some(
            (violation: any) => violation.field === "title" && violation.code === "payload-mismatch"
          )
        );
        return true;
      }
    );
  });

  test("validate returns 422 when a snapshot contract is missing required planning fields", async () => {
    const source = await readFile("docs/notion-snapshot/tasks/TASK-076.md", "utf8");
    const broken = source.replace(/## 验收标准[\s\S]*?(?=\r?\n## )/, "## 验收标准\n");
    assert.notEqual(broken, source);

    const snapshotRoot = await mkdtemp(join(tmpdir(), "studymy-notion-"));
    try {
      await mkdir(join(snapshotRoot, "tasks"));
      await writeFile(join(snapshotRoot, "tasks", "TASK-777.md"), broken, "utf8");
      const service = new NotionService();
      useSnapshotRoot(service, snapshotRoot);
      const contract = (await service.getTaskContract("TASK-777")).payload;

      await assert.rejects(
        () => service.validateTaskContract(validationInput(contract)),
        (error) => {
          const response = getExceptionResponse(error);
          assert.equal(response.code, "NOTION_TASK_CONTRACT_INVALID");
          assert.ok(
            response.violations.some(
              (violation: any) =>
                violation.field === "acceptanceCriteria" && violation.code === "missing-required-field"
            )
          );
          return true;
        }
      );
    } finally {
      await rm(snapshotRoot, { recursive: true, force: true });
    }
  });

  test("controller delegates validation to the service", async () => {
    const calls: unknown[] = [];
    const result = { valid: true, taskId: "TASK-076" };
    const controller = new NotionController({
      health: () => ({}),
      listTasks: async () => ({ items: [] }),
      getTaskContract: async () => ({}),
      getDependencyPlan: async () => ({}),
      validateTaskContract: async (input: unknown) => {
        calls.push(input);
        return result;
      }
    } as any);
    const body = {
      taskId: "TASK-076",
      title: "Task title",
      status: "Pending review",
      taskType: "Backend"
    };

    assert.deepEqual(await controller.validateTaskContract(body), result);
    assert.deepEqual(calls, [body]);
  });
});
