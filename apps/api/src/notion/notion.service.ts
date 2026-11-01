import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const TASK_ID_PATTERN = /^TASK-\d{3,}$/;
const SNAPSHOT_SCHEMA_VERSION = "2026-05-25";

export interface NotionTaskListQuery {
  status?: string;
  taskType?: string;
  parallelGroup?: string;
  parentTaskId?: string;
  limit?: number;
}

export interface NotionTaskContractValidationInput {
  taskId: string;
  title: string;
  status: string;
  taskType: string;
}

interface NotionTaskContractViolation {
  field: string;
  code: "missing-required-field" | "payload-mismatch";
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface NotionTaskDependency {
  taskId: string;
  reason: string;
}

export interface NotionTaskImpactScope {
  affectedApps: string[];
  affectedModules: string[];
  likelyFiles: string[];
}

export interface NotionTaskLockScope {
  lockScopeHint: string;
  riskLevel: string;
}

export interface NotionTaskSplitMetadata {
  parentTaskId: string | null;
  childTaskIds: string[];
  splitDepth: number;
  splitReason: string | null;
  splitStatus: string;
  taskSize: string;
  taskSizeScore: number;
  taskSizeReasons: string[];
  shouldRunAsParent: boolean;
  childCompletionPolicy: string;
}

export interface NotionTaskExecutionRecord {
  recordedAt: string;
  status: string;
  summary: string;
  runId: string | null;
  validationResult: string | null;
  blockerNote: string | null;
}

export interface NotionTaskContract {
  taskId: string;
  title: string;
  status: string;
  priority: string;
  taskType: string;
  owner: string;
  linkedRequirement: string | null;
  linkedTechnicalDesign: string | null;
  implementationNotes: string;
  testPlan: string;
  acceptanceCriteria: string[];
  validationResult: string | null;
  blockerNote: string | null;
  dependencies: NotionTaskDependency[];
  parallelGroup: string | null;
  impactScope: NotionTaskImpactScope;
  lockScope: NotionTaskLockScope;
  split: NotionTaskSplitMetadata;
  relatedCommits: string[];
  executionRecords: NotionTaskExecutionRecord[];
}

export interface NotionTaskContractEnvelope {
  source: "notion-snapshot";
  schemaVersion: string;
  payload: NotionTaskContract;
}

export interface NotionTaskListItem {
  taskId: string;
  title: string;
  status: string;
  priority: string;
  taskType: string;
  owner: string;
  parallelGroup: string | null;
  parentTaskId: string | null;
  lockScopeHint: string;
  riskLevel: string;
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "none" || trimmed === "无") return null;
  return trimmed;
}

function parseBoolean(value: string | null | undefined): boolean {
  return value?.trim() === "true";
}

function parseNumber(value: string | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsv(value: string | null | undefined): string[] {
  const normalized = normalizeOptional(value);
  if (!normalized) return [];
  return normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripInlineCode(value: string): string {
  return value.replace(/`([^`]+)`/g, "$1").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readField(markdown: string, label: string): string | null {
  const match = markdown.match(new RegExp(`^- \\*\\*${escapeRegExp(label)}\\*\\*: ?(.*)$`, "m"));
  return normalizeOptional(match?.[1]);
}

function readSection(markdown: string, title: string): string {
  const marker = `## ${title}`;
  const start = markdown.indexOf(marker);
  if (start < 0) return "";
  const body = markdown.slice(start + marker.length);
  const next = body.search(/\n## /);
  return next >= 0 ? body.slice(0, next) : body;
}

function parseBulletList(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => stripInlineCode(line.slice(2)))
    .filter(Boolean);
}

function parseKeyValueSection(section: string): Record<string, string> {
  return Object.fromEntries(
    parseBulletList(section)
      .map((line) => {
        const index = line.indexOf(":");
        if (index < 0) return null;
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );
}

function parseDependencies(section: string): NotionTaskDependency[] {
  return parseBulletList(section)
    .map((line) => {
      const match = line.match(/^(TASK-\d{3,})(?:[:：-]\s*)?(.*)$/);
      if (!match) return null;
      return {
        taskId: match[1],
        reason: match[2]?.trim() || "未记录依赖原因"
      };
    })
    .filter((item): item is NotionTaskDependency => Boolean(item));
}

function parseExecutionRecords(section: string): NotionTaskExecutionRecord[] {
  const records: NotionTaskExecutionRecord[] = [];
  const matches = Array.from(section.matchAll(/^###\s+(.+?)(?:\s+-\s+(.+))?$/gm));
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const start = (match.index || 0) + match[0].length;
    const end = nextMatch?.index ?? section.length;
    const body = section.slice(start, end);
    records.push({
      recordedAt: match[1].trim(),
      status: readField(body, "状态") || "",
      summary: readField(body, "说明") || readField(body, "摘要") || "",
      runId: body.match(/(TASK-\d{3}-[0-9T-]+Z)/)?.[1] || null,
      validationResult: readField(body, "验证结果"),
      blockerNote: readField(body, "阻塞说明")
    });
  }
  return records;
}

function buildContract(taskId: string, markdown: string): NotionTaskContract {
  const titleMatch = markdown.match(/^#\s+任务：(.+)$/m);
  const impactScope = parseKeyValueSection(readSection(markdown, "影响范围"));
  const lockScope = parseKeyValueSection(readSection(markdown, "锁范围建议"));
  const split = {
    ...parseKeyValueSection(readSection(markdown, "父子任务")),
    ...parseKeyValueSection(readSection(markdown, "任务粒度")),
    ...parseKeyValueSection(readSection(markdown, "执行提示"))
  };

  const title = readField(markdown, "任务标题") || titleMatch?.[1]?.trim();
  if (!title) {
    throw new UnprocessableEntityException(`Task snapshot ${taskId} is missing a title`);
  }

  return {
    taskId,
    title,
    status: readField(markdown, "状态") || "",
    priority: readField(markdown, "优先级") || "",
    taskType: readField(markdown, "任务类型") || "",
    owner: readField(markdown, "负责人") || "",
    linkedRequirement: readField(markdown, "关联需求"),
    linkedTechnicalDesign: readField(markdown, "关联技术方案"),
    implementationNotes: readField(markdown, "实现说明") || "",
    testPlan: readField(markdown, "测试计划") || "",
    acceptanceCriteria: parseBulletList(readSection(markdown, "验收标准")),
    validationResult: readField(markdown, "验证结果"),
    blockerNote: readField(markdown, "阻塞说明"),
    dependencies: parseDependencies(readSection(markdown, "依赖任务")),
    parallelGroup: normalizeOptional(parseKeyValueSection(readSection(markdown, "并行分组")).parallelGroup),
    impactScope: {
      affectedApps: parseCsv(impactScope.affectedApps),
      affectedModules: parseCsv(impactScope.affectedModules),
      likelyFiles: parseCsv(impactScope.likelyFiles)
    },
    lockScope: {
      lockScopeHint: lockScope.lockScopeHint || "",
      riskLevel: lockScope.riskLevel || ""
    },
    split: {
      parentTaskId: normalizeOptional(split.parentTaskId),
      childTaskIds: parseCsv(split.childTaskIds),
      splitDepth: parseNumber(split.splitDepth),
      splitReason: normalizeOptional(split.splitReason),
      splitStatus: split.splitStatus || "",
      taskSize: split.taskSize || "",
      taskSizeScore: parseNumber(split.taskSizeScore),
      taskSizeReasons: parseCsv(split.taskSizeReasons),
      shouldRunAsParent: parseBoolean(split.shouldRunAsParent),
      childCompletionPolicy: split.childCompletionPolicy || ""
    },
    relatedCommits: parseBulletList(readSection(markdown, "关联 Commit")),
    executionRecords: parseExecutionRecords(readSection(markdown, "执行记录"))
  };
}

@Injectable()
export class NotionService {
  private readonly snapshotRoot: string;
  private readonly taskRoot: string;

  constructor() {
    this.snapshotRoot = this.resolveSnapshotRoot();
    this.taskRoot = resolve(this.snapshotRoot, "tasks");
  }

  health() {
    return {
      source: "notion-snapshot",
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      available: existsSync(this.taskRoot),
      endpoints: [
        "GET /notion/health",
        "GET /notion/tasks",
        "GET /notion/tasks/:taskId",
        "GET /notion/tasks/:taskId/dependency-plan",
        "POST /notion/tasks/validate"
      ],
      constraints: {
        readOnly: true,
        adminAuthRequired: true,
        internalGovernanceApi: true,
        runtimeBusinessDatabase: false,
        taskIdPattern: TASK_ID_PATTERN.source
      }
    };
  }

  async listTasks(query: NotionTaskListQuery = {}) {
    this.assertSnapshotAvailable();
    this.validateOptionalTaskId(query.parentTaskId, "parentTaskId");
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const contracts = await this.readAllContracts();
    const filtered = contracts.filter((contract) => {
      if (query.status && contract.status !== query.status) return false;
      if (query.taskType && contract.taskType !== query.taskType) return false;
      if (query.parallelGroup && contract.parallelGroup !== query.parallelGroup) return false;
      if (query.parentTaskId && contract.split.parentTaskId !== query.parentTaskId) return false;
      return true;
    });

    return {
      source: "notion-snapshot",
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      total: filtered.length,
      items: filtered.slice(0, limit).map((contract): NotionTaskListItem => ({
        taskId: contract.taskId,
        title: contract.title,
        status: contract.status,
        priority: contract.priority,
        taskType: contract.taskType,
        owner: contract.owner,
        parallelGroup: contract.parallelGroup,
        parentTaskId: contract.split.parentTaskId,
        lockScopeHint: contract.lockScope.lockScopeHint,
        riskLevel: contract.lockScope.riskLevel
      }))
    };
  }

  async getTaskContract(taskId: string): Promise<NotionTaskContractEnvelope> {
    const normalizedTaskId = this.normalizeTaskId(taskId);
    const markdown = await this.readTaskSnapshot(normalizedTaskId);
    return {
      source: "notion-snapshot",
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      payload: buildContract(normalizedTaskId, markdown)
    };
  }

  async getDependencyPlan(taskId: string) {
    const envelope = await this.getTaskContract(taskId);
    const contract = envelope.payload;
    return {
      source: envelope.source,
      schemaVersion: envelope.schemaVersion,
      taskId: contract.taskId,
      dependencies: contract.dependencies,
      parallelGroup: contract.parallelGroup,
      impactScope: contract.impactScope,
      lockScope: contract.lockScope,
      split: contract.split
    };
  }

  async validateTaskContract(input: NotionTaskContractValidationInput) {
    const envelope = await this.getTaskContract(input.taskId);
    const contract = envelope.payload;
    const violations: NotionTaskContractViolation[] = [];

    this.addMismatchViolation(violations, "title", contract.title, input.title);
    this.addMismatchViolation(violations, "status", contract.status, input.status);
    this.addMismatchViolation(violations, "taskType", contract.taskType, input.taskType);

    this.addMissingViolation(violations, "title", contract.title);
    this.addMissingViolation(violations, "status", contract.status);
    this.addMissingViolation(violations, "taskType", contract.taskType);
    this.addMissingViolation(violations, "acceptanceCriteria", contract.acceptanceCriteria);
    this.addMissingViolation(violations, "impactScope.affectedApps", contract.impactScope.affectedApps);
    this.addMissingViolation(violations, "impactScope.affectedModules", contract.impactScope.affectedModules);
    this.addMissingViolation(violations, "lockScope.lockScopeHint", contract.lockScope.lockScopeHint);
    this.addMissingViolation(violations, "lockScope.riskLevel", contract.lockScope.riskLevel);
    this.addMissingViolation(violations, "parallelGroup", contract.parallelGroup);

    if (violations.length) {
      throw new UnprocessableEntityException({
        code: "NOTION_TASK_CONTRACT_INVALID",
        message: "Notion task contract validation failed",
        taskId: contract.taskId,
        violations
      });
    }

    return {
      valid: true,
      source: envelope.source,
      schemaVersion: envelope.schemaVersion,
      taskId: contract.taskId,
      requiredFields: [
        "taskId",
        "title",
        "status",
        "taskType",
        "acceptanceCriteria",
        "impactScope.affectedApps",
        "impactScope.affectedModules",
        "lockScope.lockScopeHint",
        "lockScope.riskLevel",
        "parallelGroup"
      ],
      validatedFields: [
        "snapshotExists",
        "requestMatchesSnapshot",
        "acceptanceCriteria",
        "impactScope",
        "lockScope",
        "dependencyPlanningScope",
        "notionIsNotRuntimeBusinessDatabase"
      ],
      constraints: {
        readOnly: true,
        adminAuthRequired: true,
        internalGovernanceApi: true,
        runtimeBusinessDatabase: false
      }
    };
  }

  private resolveSnapshotRoot(): string {
    const candidates = [
      resolve(process.cwd(), "docs", "notion-snapshot"),
      resolve(process.cwd(), "..", "..", "docs", "notion-snapshot")
    ];
    return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
  }

  private assertSnapshotAvailable(): void {
    if (!existsSync(this.taskRoot)) {
      throw new ServiceUnavailableException("Notion task snapshot directory is not available");
    }
  }

  private normalizeTaskId(taskId: string): string {
    const normalized = taskId?.trim().toUpperCase();
    if (!TASK_ID_PATTERN.test(normalized)) {
      throw new BadRequestException("taskId must match TASK- followed by digits");
    }
    return normalized;
  }

  private validateOptionalTaskId(taskId: string | undefined, fieldName: string): void {
    if (!taskId) return;
    if (!TASK_ID_PATTERN.test(taskId.trim().toUpperCase())) {
      throw new BadRequestException(`${fieldName} must match TASK- followed by digits`);
    }
  }

  private addMissingViolation(violations: NotionTaskContractViolation[], field: string, value: unknown): void {
    const missing = Array.isArray(value) ? value.length === 0 : value == null || String(value).trim() === "";
    if (!missing) return;
    violations.push({
      field,
      code: "missing-required-field",
      message: `${field} is required in the Notion task contract`
    });
  }

  private addMismatchViolation(
    violations: NotionTaskContractViolation[],
    field: keyof NotionTaskContractValidationInput,
    expected: string,
    actual: string
  ): void {
    if (expected === actual.trim()) return;
    violations.push({
      field,
      code: "payload-mismatch",
      message: `${field} must match the Notion task snapshot`,
      expected,
      actual
    });
  }

  private async readTaskSnapshot(taskId: string): Promise<string> {
    this.assertSnapshotAvailable();
    const path = resolve(this.taskRoot, `${taskId}.md`);
    if (!path.startsWith(this.taskRoot) || !existsSync(path)) {
      throw new NotFoundException("Notion task snapshot not found");
    }
    return readFile(path, "utf8");
  }

  private async readAllContracts(): Promise<NotionTaskContract[]> {
    const files = (await readdir(this.taskRoot)).filter((file) => /^TASK-\d{3,}\.md$/.test(file)).sort();
    return Promise.all(
      files.map(async (file) => {
        const taskId = basename(file, ".md");
        const markdown = await readFile(resolve(this.taskRoot, file), "utf8");
        return buildContract(taskId, markdown);
      })
    );
  }
}
