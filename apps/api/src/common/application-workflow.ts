import type { ApplicationMaterialItem } from "./application-materials.js";
import type { StudentApplicationEntity } from "../db/entities.js";

export type ApplicationWorkflowStatus =
  | "draft"
  | "submitted"
  | "reviewing"
  | "need-info"
  | "platform-approved"
  | "school-submitted"
  | "school-reviewing"
  | "offered"
  | "rejected"
  | "visa"
  | "done"
  | "closed";

export interface ApplicationWorkflowDefinition {
  status: ApplicationWorkflowStatus;
  label: string;
  stage: string;
  stageLabel: string;
  progress: number;
  nextStudentAction: string;
  nextStaffAction: string;
  terminal?: boolean;
}

export interface ApplicationTodo {
  id: string;
  type: "material" | "message" | "status" | "visa" | "offer";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "waiting" | "done";
  actionLabel?: string;
  materialKey?: string;
  dueAt?: string | null;
}

export const APPLICATION_WORKFLOW: ApplicationWorkflowDefinition[] = [
  {
    status: "draft",
    label: "待整理",
    stage: "draft",
    stageLabel: "申请准备",
    progress: 5,
    nextStudentAction: "确认目标院校和专业后提交申请。",
    nextStaffAction: "等待学生正式提交申请。"
  },
  {
    status: "submitted",
    label: "已提交平台",
    stage: "materials",
    stageLabel: "材料准备",
    progress: 15,
    nextStudentAction: "按材料清单上传申请材料。",
    nextStaffAction: "分配负责人并检查学生材料完整度。"
  },
  {
    status: "reviewing",
    label: "平台审核中",
    stage: "review",
    stageLabel: "平台材料审核",
    progress: 30,
    nextStudentAction: "等待顾问审核，如有补件会收到通知。",
    nextStaffAction: "审核学生上传材料并给出通过或补件意见。"
  },
  {
    status: "need-info",
    label: "需补件",
    stage: "materials",
    stageLabel: "补件处理中",
    progress: 35,
    nextStudentAction: "查看补件说明并上传新版材料。",
    nextStaffAction: "等待学生补件，必要时留言说明。"
  },
  {
    status: "platform-approved",
    label: "平台审核通过",
    stage: "ready",
    stageLabel: "递交准备",
    progress: 45,
    nextStudentAction: "等待顾问递交院校申请。",
    nextStaffAction: "整理申请包并递交给目标院校。"
  },
  {
    status: "school-submitted",
    label: "已递交院校",
    stage: "school",
    stageLabel: "院校递交",
    progress: 60,
    nextStudentAction: "等待院校受理结果，保持联系方式可用。",
    nextStaffAction: "更新院校递交凭证和受理信息。"
  },
  {
    status: "school-reviewing",
    label: "院校审核中",
    stage: "school",
    stageLabel: "院校审核",
    progress: 72,
    nextStudentAction: "等待院校审核结果，如需补充材料会收到通知。",
    nextStaffAction: "跟进院校审核进展并记录下一次跟进时间。"
  },
  {
    status: "offered",
    label: "获 Offer",
    stage: "conditional-offer",
    stageLabel: "Offer 处理",
    progress: 84,
    nextStudentAction: "确认 Offer 条件、押金和下一步签证准备。",
    nextStaffAction: "协助学生确认 Offer 条件并启动签证准备。"
  },
  {
    status: "rejected",
    label: "拒录",
    stage: "closed",
    stageLabel: "结果处理",
    progress: 84,
    nextStudentAction: "联系顾问确认替代方案或重新申请。",
    nextStaffAction: "记录拒录原因并给出替代申请建议。"
  },
  {
    status: "visa",
    label: "签证处理中",
    stage: "visa",
    stageLabel: "签证准备",
    progress: 92,
    nextStudentAction: "按顾问要求准备签证材料和行前信息。",
    nextStaffAction: "跟进签证材料、递签和获批状态。"
  },
  {
    status: "done",
    label: "已完成",
    stage: "done",
    stageLabel: "办理完成",
    progress: 100,
    nextStudentAction: "申请流程已完成，可查看历史记录。",
    nextStaffAction: "案件可归档或进入后续服务。",
    terminal: true
  },
  {
    status: "closed",
    label: "已关闭",
    stage: "closed",
    stageLabel: "案件关闭",
    progress: 100,
    nextStudentAction: "案件已关闭，如需继续办理请重新联系顾问。",
    nextStaffAction: "案件已关闭。",
    terminal: true
  }
];

const WORKFLOW_BY_STATUS = new Map(APPLICATION_WORKFLOW.map((item) => [item.status, item]));
const STATUS_ORDER = APPLICATION_WORKFLOW.map((item) => item.status);

export function normalizeApplicationStatus(status: unknown): ApplicationWorkflowStatus {
  const value = String(status || "").trim().toLowerCase().replace(/_/g, "-");
  if (value === "in-review") return "reviewing";
  if (value === "need-info" || value === "needinfo") return "need-info";
  if (value === "approved-by-platform" || value === "platform-approved") return "platform-approved";
  if (value === "submitted-to-school" || value === "school-submitted") return "school-submitted";
  if (value === "school-reviewing") return "school-reviewing";
  if (value === "offer" || value === "offered") return "offered";
  if (value === "visa-processing" || value === "visa") return "visa";
  if (value === "completed" || value === "done") return "done";
  if (WORKFLOW_BY_STATUS.has(value as ApplicationWorkflowStatus)) return value as ApplicationWorkflowStatus;
  return "submitted";
}

export function getApplicationWorkflow(status: unknown) {
  const normalized = normalizeApplicationStatus(status);
  const definition = WORKFLOW_BY_STATUS.get(normalized) || WORKFLOW_BY_STATUS.get("submitted")!;
  return {
    ...definition,
    status: normalized,
    allowedTransitions: getAllowedStatusTransitions(normalized).map((nextStatus) => WORKFLOW_BY_STATUS.get(nextStatus)!)
  };
}

export function getAllowedStatusTransitions(status: unknown): ApplicationWorkflowStatus[] {
  const normalized = normalizeApplicationStatus(status);
  if (normalized === "closed") return [];
  if (normalized === "done") return ["closed"];
  if (normalized === "rejected") return ["closed", "need-info"];
  if (normalized === "reviewing") return ["need-info", "platform-approved"];
  if (normalized === "need-info") return ["reviewing", "platform-approved"];
  const currentIndex = STATUS_ORDER.indexOf(normalized);
  const next = STATUS_ORDER[currentIndex + 1];
  const transitions = next && next !== "closed" ? [next] : [];
  if (!["draft", "need-info", "done"].includes(normalized)) transitions.push("need-info");
  return Array.from(new Set(transitions));
}

export function assertApplicationStatusTransition(from: unknown, to: unknown): ApplicationWorkflowStatus {
  const normalizedFrom = normalizeApplicationStatus(from);
  const normalizedTo = normalizeApplicationStatus(to);
  if (normalizedFrom === normalizedTo) return normalizedTo;
  const allowed = getAllowedStatusTransitions(normalizedFrom);
  if (!allowed.includes(normalizedTo)) {
    throw new Error(`Invalid application status transition: ${normalizedFrom} -> ${normalizedTo}`);
  }
  return normalizedTo;
}

export function stageForApplicationStatus(status: unknown) {
  return getApplicationWorkflow(status).stage;
}

export function buildStudentApplicationTodos(
  application: Pick<StudentApplicationEntity, "applicationStatus" | "expectedDecisionDate" | "assignedAdminId">,
  materials: ApplicationMaterialItem[]
): ApplicationTodo[] {
  const workflow = getApplicationWorkflow(application.applicationStatus);
  const todos: ApplicationTodo[] = [];
  const activeMaterials = materials.filter((item) => !item.isWaived);
  const revisionMaterials = activeMaterials.filter((item) => item.reviewStatus === "needs-revision" || item.reviewStatus === "rejected");
  const missingMaterials = activeMaterials.filter((item) => item.reviewStatus === "not-uploaded" || !item.fileName);

  for (const material of revisionMaterials) {
    todos.push({
      id: `material-revision-${material.key}`,
      type: "material",
      title: `补交材料：${material.title}`,
      description: material.reviewNote || "顾问已要求补件，请上传新版材料。",
      priority: "high",
      status: "todo",
      actionLabel: "上传补件",
      materialKey: material.key,
      dueAt: application.expectedDecisionDate || null
    });
  }

  if (!revisionMaterials.length) {
    for (const material of missingMaterials.slice(0, 3)) {
      todos.push({
        id: `material-upload-${material.key}`,
        type: "material",
        title: `上传材料：${material.title}`,
        description: material.note || "该材料尚未上传，请按清单准备。",
        priority: "medium",
        status: "todo",
        actionLabel: "上传材料",
        materialKey: material.key,
        dueAt: application.expectedDecisionDate || null
      });
    }
  }

  if (workflow.status === "offered") {
    todos.push({
      id: "offer-confirm",
      type: "offer",
      title: "确认 Offer 后续安排",
      description: "请确认 Offer 条件、押金和是否进入签证准备。",
      priority: "high",
      status: "todo",
      actionLabel: "联系顾问"
    });
  }

  if (workflow.status === "visa") {
    todos.push({
      id: "visa-documents",
      type: "visa",
      title: "准备签证材料",
      description: "根据顾问要求准备签证材料、资金证明和行前信息。",
      priority: "high",
      status: "todo",
      actionLabel: "查看要求"
    });
  }

  if (!todos.length && !workflow.terminal) {
    todos.push({
      id: `waiting-${workflow.status}`,
      type: "status",
      title: workflow.nextStudentAction,
      description: application.assignedAdminId ? "当前步骤由负责顾问处理中。" : "案件正在等待后台分配负责人。",
      priority: "low",
      status: "waiting"
    });
  }

  return todos;
}

export function deriveStatusFromMaterialReview(
  currentStatus: unknown,
  materials: ApplicationMaterialItem[],
  reviewedStatus: string
): ApplicationWorkflowStatus {
  if (reviewedStatus === "needs-revision" || reviewedStatus === "rejected") return "need-info";
  const normalizedCurrent = normalizeApplicationStatus(currentStatus);
  if (STATUS_ORDER.indexOf(normalizedCurrent) > STATUS_ORDER.indexOf("platform-approved")) return normalizedCurrent;
  const activeMaterials = materials.filter((item) => !item.isWaived);
  if (activeMaterials.length && activeMaterials.every((item) => item.reviewStatus === "approved")) return "platform-approved";
  if (activeMaterials.some((item) => item.reviewStatus === "pending-review")) return "reviewing";
  return normalizedCurrent;
}
