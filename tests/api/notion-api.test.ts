import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AdminAuthGuard } from "../../apps/api/src/common/guards.ts";
import { NotionController, NotionTaskListQueryDto } from "../../apps/api/src/notion/notion.controller.ts";
import { NotionService, type NotionTaskContract } from "../../apps/api/src/notion/notion.service.ts";

const task076Snapshot = `# 任务：新增需求边界和验收标准补充：Notion 后端 API 和服务拆分

- **任务编号**: TASK-076
- **任务标题**: 新增需求边界和验收标准补充：Notion 后端 API 和服务拆分
- **状态**: 待评审
- **优先级**: 高
- **任务类型**: 后端
- **负责人**: Codex
- **关联需求**: 产品需求文档
- **关联技术方案**: 技术方案
- **实现说明**: 从父任务 TASK-059 中拆出 Notion 后端 API、服务、校验和错误处理，只处理后端可测试接口能力。
- **测试计划**: 运行后端构建、单元测试或接口验证命令。
- **验证结果**: Codex 已完成实现并返回完成状态。
- **阻塞说明**:

## 依赖任务

## 并行分组
- parallelGroup: api-endpoints

## 影响范围
- affectedApps: apps/api
- affectedModules: apps/api:Notion
- likelyFiles: none

## 锁范围建议
- lockScopeHint: module_scope
- riskLevel: medium

## 父子任务
- parentTaskId: TASK-059
- childTaskIds: none
- splitDepth: 1
- splitReason: 由父任务 TASK-059 拆分生成。
- splitStatus: not_split

## 任务粒度
- taskSize: medium
- taskSizeScore: 0
- taskSizeReasons: 后端 API 可独立验证。

## 执行提示
- shouldRunAsParent: true
- childCompletionPolicy: all_children_passed

## 依赖说明
- 当前子任务没有真实前置任务；如锁范围不冲突，可作为并行候选。

## 验收标准
- API 契约清晰，输入校验和错误处理完整。
- 后端构建、单测或接口验证通过。

## 关联 Commit

## 执行记录

### 2026-05-25T15:07:13.149Z - 自动状态更新

- **状态**: 进行中
- **说明**: 自动化运行 TASK-076-2026-05-25T15-07-13-135Z 已领取该任务。
`;

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

async function withSnapshotService<T>(
  snapshots: Record<string, string>,
  run: (service: NotionService) => Promise<T>
): Promise<T> {
  const snapshotRoot = await mkdtemp(join(tmpdir(), "studymy-notion-"));
  try {
    const taskRoot = join(snapshotRoot, "tasks");
    await mkdir(taskRoot, { recursive: true });
    await Promise.all(
      Object.entries(snapshots).map(([taskId, markdown]) => writeFile(join(taskRoot, `${taskId}.md`), markdown, "utf8"))
    );
    const service = new NotionService();
    useSnapshotRoot(service, snapshotRoot);
    return await run(service);
  } finally {
    await rm(snapshotRoot, { recursive: true, force: true });
  }
}

async function withTask076Service<T>(run: (service: NotionService) => Promise<T>): Promise<T> {
  return withSnapshotService({ "TASK-076": task076Snapshot }, run);
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
    await withTask076Service(async (service) => {
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
  });

  test("service list supports task planning filters", async () => {
    await withTask076Service(async (service) => {
      const result = await service.listTasks({
        parallelGroup: "api-endpoints",
        parentTaskId: "TASK-059",
        limit: 20
      });

      assert.ok(result.items.some((item) => item.taskId === "TASK-076"));
      assert.ok(result.items.every((item) => item.parallelGroup === "api-endpoints"));
      assert.ok(result.items.every((item) => item.parentTaskId === "TASK-059"));
    });
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
    await withTask076Service(async (service) => {
      await assert.rejects(
        () => service.getTaskContract("TASK-76"),
        (error) => error instanceof BadRequestException
      );

      await assert.rejects(
        () => service.getTaskContract("TASK-999999"),
        (error) => error instanceof NotFoundException
      );
    });
  });

  test("validate checks the real snapshot contract instead of returning a fixed success", async () => {
    await withTask076Service(async (service) => {
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
  });

  test("validate returns 422 when a snapshot contract is missing required planning fields", async () => {
    const broken = task076Snapshot.replace(/## 验收标准[\s\S]*?(?=\r?\n## )/, "## 验收标准\n");
    assert.notEqual(broken, task076Snapshot);

    await withSnapshotService({ "TASK-777": broken }, async (service) => {
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
    });
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
