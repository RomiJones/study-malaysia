export const NOTION_CONTRACT_SCHEMA_VERSION = "2026-05-25" as const;

export const NOTION_TASK_STATUSES = [
  "可开始",
  "进行中",
  "待评审",
  "待评审 / 验收有风险",
  "待评审 / 发布前可复核",
  "已完成",
  "已阻塞",
  "已失败"
] as const;
export const NOTION_TASK_PRIORITIES = ["低", "中", "高"] as const;
export const NOTION_TASK_TYPES = [
  "产品",
  "前端",
  "后端",
  "数据库",
  "管理端",
  "测试",
  "文档",
  "架构",
  "运维",
  "配置",
  "修复",
  "Review"
] as const;

export const NOTION_LOCK_SCOPE_HINTS = ["task", "module_scope", "global_project"] as const;
export const NOTION_RISK_LEVELS = ["low", "medium", "high"] as const;
export const NOTION_TASK_SIZES = ["small", "medium", "large", "xlarge"] as const;
export const NOTION_SPLIT_STATUSES = ["not_split", "split_requested", "split", "split_done", "blocked"] as const;
export const NOTION_CHILD_COMPLETION_POLICIES = ["none", "all_children_passed", "selected_children_passed"] as const;
export const NOTION_DOCUMENT_SOURCES = ["notion", "notion-snapshot"] as const;
export const NOTION_PARALLEL_GROUPS = [
  "docs",
  "architecture",
  "shared-contracts",
  "data-models",
  "api-endpoints",
  "admin-pages",
  "frontend-pages",
  "i18n",
  "tests"
] as const;

export type NotionContractSchemaVersion = typeof NOTION_CONTRACT_SCHEMA_VERSION;
export type NotionDocumentSource = (typeof NOTION_DOCUMENT_SOURCES)[number];
export type NotionTaskStatus = (typeof NOTION_TASK_STATUSES)[number];
export type NotionTaskPriority = (typeof NOTION_TASK_PRIORITIES)[number];
export type NotionTaskType = (typeof NOTION_TASK_TYPES)[number];
export type NotionLockScopeHint = (typeof NOTION_LOCK_SCOPE_HINTS)[number];
export type NotionRiskLevel = (typeof NOTION_RISK_LEVELS)[number];
export type NotionTaskSize = (typeof NOTION_TASK_SIZES)[number];
export type NotionSplitStatus = (typeof NOTION_SPLIT_STATUSES)[number];
export type NotionChildCompletionPolicy = (typeof NOTION_CHILD_COMPLETION_POLICIES)[number];
export type NotionParallelGroup = (typeof NOTION_PARALLEL_GROUPS)[number];
export type NotionTaskId = `TASK-${string}`;
export type NotionRequirementId = `REQ-${string}`;
export type NotionRunId = `${string}-${string}`;

export interface NotionContractEnvelope<TPayload> {
  source: NotionDocumentSource;
  schemaVersion: NotionContractSchemaVersion;
  syncedAt?: string | null;
  payload: TPayload;
}

export interface NotionTaskDependency {
  taskId: NotionTaskId;
  reason: string;
}

export interface NotionTaskImpactScope {
  affectedApps: string[];
  affectedModules: string[];
  likelyFiles: string[];
}

export interface NotionTaskLockScope {
  lockScopeHint: NotionLockScopeHint;
  riskLevel: NotionRiskLevel;
}

export interface NotionTaskSplitMetadata {
  parentTaskId?: NotionTaskId | null;
  childTaskIds: NotionTaskId[];
  splitDepth: number;
  splitReason?: string | null;
  splitStatus: NotionSplitStatus;
  taskSize: NotionTaskSize;
  taskSizeScore: number;
  taskSizeReasons: string[];
  shouldRunAsParent: boolean;
  childCompletionPolicy: NotionChildCompletionPolicy;
}

export interface NotionTaskExecutionRecord {
  recordedAt: string;
  status: NotionTaskStatus;
  runId?: NotionRunId | null;
  summary: string;
  validationResult?: string | null;
  blockerNote?: string | null;
  testsRun?: string[];
  commit?: string | null;
}

export interface NotionTaskContract {
  taskId: NotionTaskId;
  title: string;
  status: NotionTaskStatus;
  priority: NotionTaskPriority;
  taskType: NotionTaskType;
  owner: string;
  linkedRequirement?: string | null;
  linkedTechnicalDesign?: string | null;
  implementationNotes: string;
  testPlan: string;
  acceptanceCriteria: string[];
  validationResult?: string | null;
  blockerNote?: string | null;
  dependencies: NotionTaskDependency[];
  parallelGroup?: NotionParallelGroup | null;
  impactScope: NotionTaskImpactScope;
  lockScope: NotionTaskLockScope;
  split: NotionTaskSplitMetadata;
  relatedCommits: string[];
  executionRecords: NotionTaskExecutionRecord[];
}

export interface NotionRequirementBoundary {
  requirementId: NotionRequirementId;
  createdAt: string;
  description: string;
  referenceSource: string;
  taskScope: NotionTaskId[];
  acceptanceNotes: string[];
  nonGoals: string[];
  blockers: string[];
}

export interface NotionProjectDocumentReference {
  title: string;
  source: NotionDocumentSource;
  localSnapshotPath?: string | null;
  notionPageId?: string | null;
  lastSyncedAt?: string | null;
}
