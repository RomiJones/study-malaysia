import { defineStore } from "pinia";
import { ref } from "vue";
import { apiFetch } from "../api/client";
import { useSessionStore } from "./session";

export interface StudentApplicationMaterial {
  key: string;
  title: string;
  note?: string;
  category?: string;
  group?: string;
  groupLabel?: string;
  requirementLevel?: "required" | "recommended" | "conditional";
  requirementLevelLabel?: string;
  source?: "school" | "degree" | "language" | "scholarship" | "visa" | "profile" | "staff";
  sourceLabel?: string;
  reason?: string;
  triggers?: string[];
  uploadTips?: string[];
  allowMultipleFiles?: boolean;
  status: "draft" | "wait" | "progress" | "done";
  reviewStatus: "not-uploaded" | "pending-review" | "approved" | "needs-revision" | "rejected";
  fileName?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  reviewNote?: string | null;
  reviewedAt?: string;
  reviewedByAdminName?: string;
  isWaived?: boolean;
  waiverReason?: string;
  waivedAt?: string;
  waivedByAdminName?: string;
  linkedFromLibrary?: boolean;
  libraryMaterialId?: number;
  libraryVersionId?: string;
  libraryVersion?: number;
  libraryTitle?: string;
  hasFile?: boolean;
  currentVersionId?: string;
  versions?: Array<{
    id: string;
    version: number;
    fileName: string;
    mimeType?: string;
    size?: number;
    uploadedAt: string;
    reviewStatus: "not-uploaded" | "pending-review" | "approved" | "needs-revision" | "rejected";
    reviewNote?: string | null;
    reviewedAt?: string;
    reviewedByAdminName?: string;
    linkedFromLibrary?: boolean;
    libraryMaterialId?: number;
    libraryVersionId?: string;
    libraryVersion?: number;
    hasFile?: boolean;
  }>;
}

export interface StudentMaterialLibraryItem {
  id: number;
  materialType: string;
  title: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  currentVersionId: string;
  version: number;
  hasFile?: boolean;
  versions: Array<{
    id: string;
    version: number;
    fileName: string;
    mimeType?: string;
    size?: number;
    uploadedAt: string;
    hasFile?: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface StudentApplicationMessage {
  id: number;
  senderType: "student" | "admin" | "system";
  messageType: "message" | "revision-request" | "material-upload" | "system";
  senderName: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface StudentApplicationWorkflow {
  status: string;
  label: string;
  stage: string;
  stageLabel: string;
  progress: number;
  nextStudentAction: string;
  nextStaffAction: string;
  terminal?: boolean;
  allowedTransitions?: Array<{
    status: string;
    label: string;
    stage: string;
    stageLabel: string;
    progress: number;
    nextStudentAction: string;
    nextStaffAction: string;
  }>;
}

export interface StudentApplicationTodo {
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

export interface StudentApplicationProfileSnapshot {
  snapshotAt?: string;
  profileVersion?: number;
  level?: string;
  targetCategory?: string;
  budgetCny?: number | null;
  gpa?: number | null;
  ielts?: number | null;
  experience?: string;
  acceptNoLanguage?: boolean;
  contactInfo?: Record<string, unknown>;
  academicBackground?: Record<string, unknown>;
  languageProfile?: Record<string, unknown>;
  studyPreferences?: Record<string, unknown>;
  serviceNeeds?: Record<string, unknown>;
}

export interface StudentApplicationProfileSummary {
  completion: number;
  status: "complete" | "insufficient" | "missing-language" | "missing-budget" | "missing-contact";
  statusLabel: string;
  missingFields: string[];
  missingLabels: string[];
}

export interface StudentApplicationItem {
  id: number;
  applicationNo: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  universityId: number;
  universityName: string;
  programId: number;
  programName: string;
  applicationStatus: string;
  currentStage: string;
  materialStatus: string;
  visaStatus: string;
  priority: string;
  intake: string;
  assignedAdminName: string;
  submittedAt: string | null;
  expectedDecisionDate: string | null;
  lastFollowUpAt: string | null;
  notes: string | null;
  materialSummary: {
    total: number;
    uploaded: number;
    approved: number;
    needRevision: number;
    pendingReview: number;
    waived?: number;
  };
  materials: StudentApplicationMaterial[];
  applicationProfileSnapshot?: StudentApplicationProfileSnapshot | null;
  applicationProfileSummary?: StudentApplicationProfileSummary;
  messages?: StudentApplicationMessage[];
  workflow?: StudentApplicationWorkflow;
  todos?: StudentApplicationTodo[];
  createdAt: string;
  updatedAt: string;
}

export const useApplicationsStore = defineStore("applications", () => {
  const session = useSessionStore();
  const items = ref<StudentApplicationItem[]>([]);
  const materialLibraryItems = ref<StudentMaterialLibraryItem[]>([]);
  const loading = ref(false);
  const errorMessage = ref("");
  const current = ref<StudentApplicationItem | null>(null);

  async function load() {
    if (!session.token) return;
    loading.value = true;
    try {
      const response = await apiFetch<{ items: StudentApplicationItem[] }>("/applications", {}, session.token);
      items.value = response.items || [];
      errorMessage.value = "";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "申请案件加载失败";
    } finally {
      loading.value = false;
    }
  }

  async function loadMaterialLibrary() {
    if (!session.token) return;
    const response = await apiFetch<{ items: StudentMaterialLibraryItem[] }>("/applications/material-library", {}, session.token);
    materialLibraryItems.value = response.items || [];
    return materialLibraryItems.value;
  }

  async function uploadMaterialLibrary(payload: { materialType: string; title?: string; file: File }) {
    if (!session.token) throw new Error("请先登录");
    const formData = new FormData();
    formData.append("materialType", payload.materialType);
    if (payload.title) formData.append("title", payload.title);
    formData.append("file", payload.file);
    const item = await apiFetch<StudentMaterialLibraryItem>(
      "/applications/material-library/upload",
      {
        method: "POST",
        body: formData
      },
      session.token
    );
    await loadMaterialLibrary();
    return item;
  }

  async function submit(payload: { universityId: number; programId: number; intake?: string; studentPhone?: string; notes?: string }) {
    if (!session.token) throw new Error("请先登录");
    loading.value = true;
    try {
      const application = await apiFetch<StudentApplicationItem>(
        "/applications",
        {
          method: "POST",
          body: JSON.stringify(payload)
        },
        session.token
      );
      await load();
      return application;
    } finally {
      loading.value = false;
    }
  }

  async function detail(applicationId: number) {
    if (!session.token) throw new Error("请先登录");
    current.value = await apiFetch<StudentApplicationItem>(`/applications/${applicationId}`, {}, session.token);
    const index = items.value.findIndex((item) => item.id === current.value?.id);
    if (current.value && index >= 0) items.value[index] = current.value;
    return current.value;
  }

  async function sendMessage(applicationId: number, content: string) {
    if (!session.token) throw new Error("请先登录");
    await apiFetch(`/applications/${applicationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content })
    }, session.token);
    return detail(applicationId);
  }

  async function uploadMaterial(applicationId: number, key: string, file: File) {
    if (!session.token) throw new Error("请先登录");
    const formData = new FormData();
    formData.append("file", file);
    const application = await apiFetch<StudentApplicationItem>(
      `/applications/${applicationId}/materials/${encodeURIComponent(key)}/upload`,
      {
        method: "POST",
        body: formData
      },
      session.token
    );
    const index = items.value.findIndex((item) => item.id === application.id);
    if (index >= 0) items.value[index] = application;
    if (current.value?.id === application.id) current.value = application;
    return application;
  }

  async function linkMaterialFromLibrary(applicationId: number, key: string, libraryMaterialId: number) {
    if (!session.token) throw new Error("请先登录");
    const application = await apiFetch<StudentApplicationItem>(
      `/applications/${applicationId}/materials/${encodeURIComponent(key)}/link-library`,
      {
        method: "POST",
        body: JSON.stringify({ libraryMaterialId })
      },
      session.token
    );
    const index = items.value.findIndex((item) => item.id === application.id);
    if (index >= 0) items.value[index] = application;
    if (current.value?.id === application.id) current.value = application;
    return application;
  }

  return {
    items,
    materialLibraryItems,
    current,
    loading,
    errorMessage,
    load,
    loadMaterialLibrary,
    detail,
    sendMessage,
    submit,
    uploadMaterial,
    uploadMaterialLibrary,
    linkMaterialFromLibrary
  };
});
