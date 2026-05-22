import { defineStore } from "pinia";
import { ref } from "vue";
import type { RecommendationResult } from "@studymy/shared";
import { apiFetch } from "../api/client";
import { useSessionStore } from "./session";

interface PlannerDashboard {
  profile: {
    level: "bachelor" | "master" | "phd";
    targetCategory: "business" | "it" | "engineering" | "science" | "arts" | "medicine" | "law";
    budgetCny: number;
    gpa: number;
    ielts: number;
    experience: string;
    acceptNoLanguage: boolean;
  };
  materials: Array<{ key: string; name: Record<string, string>; note: Record<string, string>; status: "draft" | "wait" | "progress" | "done" }>;
  tasks: Array<{ id: number; universityId: number; programId: number; tier: Record<string, string>; stage: string; progress: number; deadlineNote: Record<string, string>; nextAction: Record<string, string> }>;
  visaChecklist: Record<string, boolean>;
  summary: {
    readinessScore: number;
    materialCompletion: number;
    profileCompleteness: number;
    recommendationCount: number;
    activeTaskCount: number;
    visaDoneCount: number;
  };
  recommendations: RecommendationResult[];
}

export const usePlannerStore = defineStore("planner", () => {
  const dashboard = ref<PlannerDashboard | null>(null);
  const loading = ref(false);
  const session = useSessionStore();

  async function load() {
    if (!session.token) return;
    loading.value = true;
    try {
      dashboard.value = await apiFetch<PlannerDashboard>("/planner", {}, session.token);
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(payload: Partial<PlannerDashboard["profile"]>) {
    if (!session.token) return;
    dashboard.value = await apiFetch<PlannerDashboard>("/planner/profile", { method: "PATCH", body: JSON.stringify(payload) }, session.token);
  }

  async function updateMaterial(key: string, status: "draft" | "wait" | "progress" | "done") {
    if (!session.token) return;
    dashboard.value = await apiFetch<PlannerDashboard>(`/planner/materials/${key}`, { method: "PATCH", body: JSON.stringify({ status }) }, session.token);
  }

  async function addTask(universityId: number, programId: number) {
    if (!session.token) return;
    dashboard.value = await apiFetch<PlannerDashboard>("/planner/tasks", { method: "POST", body: JSON.stringify({ universityId, programId }) }, session.token);
  }

  async function advanceTask(id: number) {
    if (!session.token) return;
    dashboard.value = await apiFetch<PlannerDashboard>(`/planner/tasks/${id}/advance`, { method: "PATCH" }, session.token);
  }

  async function updateVisa(payload: Record<string, boolean>) {
    if (!session.token) return;
    dashboard.value = await apiFetch<PlannerDashboard>("/planner/visa", { method: "PATCH", body: JSON.stringify(payload) }, session.token);
  }

  return {
    dashboard,
    loading,
    load,
    updateProfile,
    updateMaterial,
    addTask,
    advanceTask,
    updateVisa
  };
});
