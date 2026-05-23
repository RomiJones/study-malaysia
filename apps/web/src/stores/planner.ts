import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  ApplicationStage,
  DegreeLevel,
  LocalizedStringArray,
  LocalizedText,
  MaterialStatus,
  PlannerApplicationItem,
  PlannerMaterialItem,
  PlannerProfile,
  PlannerVisaChecklist,
  ProgramCategoryCode,
  ProgramListItem,
  RecommendationResult,
  UniversityListItem
} from "@studymy/shared";
import { apiFetch } from "../api/client";
import { runtimeText } from "../i18n/runtimeText";
import { useCatalogStore } from "./catalog";
import { useSessionStore } from "./session";

const PROFILE_KEY = "studymy_profile";
const MATERIAL_KEY = "studymy_material_progress";
const TASK_KEY = "studymy_application_tasks";
const VISA_KEY = "studymy_visa_checklist";

type PlannerProfileState = Omit<PlannerProfile, "targetCategory"> & { targetCategory: ProgramCategoryCode | string };

interface PlannerDashboard {
  profile: PlannerProfileState;
  materials: PlannerMaterialItem[];
  tasks: PlannerApplicationItem[];
  visaChecklist: PlannerVisaChecklist;
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

const DEFAULT_PROFILE: PlannerProfileState = {
  level: "master",
  targetCategory: "IT",
  budgetCny: 80000,
  gpa: 2.9,
  ielts: 5.5,
  experience: "0-1 years",
  acceptNoLanguage: true
};

const DEFAULT_VISA: PlannerVisaChecklist = {
  offerAccepted: false,
  depositPaid: false,
  visaDocsReady: false,
  preDeparture: false,
  arrivalReady: false
};

const MATERIAL_STATUS_WEIGHT: Record<MaterialStatus, number> = {
  draft: 0,
  wait: 1,
  progress: 2,
  done: 3
};

export const usePlannerStore = defineStore("planner", () => {
  const dashboard = ref<PlannerDashboard | null>(null);
  const loading = ref(false);
  const syncMessage = ref("");
  const syncError = ref("");
  const session = useSessionStore();

  const isLocalMode = computed(() => !session.token);

  async function load() {
    loading.value = true;
    try {
      await ensureCatalogData();
      if (session.token) {
        dashboard.value = normalizeDashboard(await apiFetch<PlannerDashboard>("/planner", {}, session.token));
        persistDashboard(dashboard.value);
        syncMessage.value = runtimeText("plannerLoaded");
      } else {
        dashboard.value = buildLocalDashboard();
        syncMessage.value = runtimeText("plannerLocalSaved");
      }
      syncError.value = "";
    } catch (error) {
      dashboard.value = buildLocalDashboard();
      syncError.value = error instanceof Error ? error.message : runtimeText("plannerLoadFailed");
    } finally {
      loading.value = false;
    }
  }

  async function mergeLocalState() {
    if (!session.token) return;
    loading.value = true;
    try {
      await ensureCatalogData();
      const response = await apiFetch<{ dashboard: PlannerDashboard }>(
        "/planner/merge-local-state",
        {
          method: "POST",
          body: JSON.stringify(readLocalState())
        },
        session.token
      );
      dashboard.value = normalizeDashboard(response.dashboard);
      persistDashboard(dashboard.value);
      syncMessage.value = runtimeText("plannerMerged");
      syncError.value = "";
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : runtimeText("plannerMergeFailed");
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(payload: Partial<PlannerProfileState>) {
    const nextProfile = normalizeProfile({ ...readProfile(), ...(dashboard.value?.profile || {}), ...payload });
    saveProfile(nextProfile);

    if (!session.token) {
      dashboard.value = buildLocalDashboard();
      syncMessage.value = runtimeText("profileLocalSaved");
      return;
    }

    try {
      dashboard.value = normalizeDashboard(await apiFetch<PlannerDashboard>(
        "/planner/profile",
        { method: "PATCH", body: JSON.stringify(serializeProfileForApi(nextProfile)) },
        session.token
      ));
      persistDashboard(dashboard.value);
      syncMessage.value = runtimeText("profileSynced");
      syncError.value = "";
    } catch (error) {
      dashboard.value = buildLocalDashboard();
      syncError.value = error instanceof Error ? error.message : runtimeText("profileSyncFailed");
    }
  }

  async function updateMaterial(key: string, status: MaterialStatus) {
    const materialProgress = { ...readMaterialProgress(), [key]: status };
    saveMaterialProgress(materialProgress);

    if (!session.token) {
      dashboard.value = buildLocalDashboard();
      syncMessage.value = runtimeText("materialLocalSaved");
      return;
    }

    try {
      dashboard.value = normalizeDashboard(await apiFetch<PlannerDashboard>(
        `/planner/materials/${key}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        session.token
      ));
      persistDashboard(dashboard.value);
      syncMessage.value = runtimeText("materialSynced");
      syncError.value = "";
    } catch (error) {
      dashboard.value = buildLocalDashboard();
      syncError.value = error instanceof Error ? error.message : runtimeText("materialSyncFailed");
    }
  }

  async function addTask(universityId: number, programId: number) {
    const current = readLocalTasks();
    if (!current.some((item) => item.universityId === universityId && item.programId === programId)) {
      saveLocalTasks([
        ...current,
        buildTask({ universityId, programId, index: current.length, tier: tierText("target"), stage: "draft", progress: 20 })
      ]);
    }

    if (!session.token) {
      dashboard.value = buildLocalDashboard();
      syncMessage.value = runtimeText("taskLocalAdded");
      return;
    }

    try {
      dashboard.value = normalizeDashboard(await apiFetch<PlannerDashboard>(
        "/planner/tasks",
        { method: "POST", body: JSON.stringify({ universityId, programId }) },
        session.token
      ));
      persistDashboard(dashboard.value);
      syncMessage.value = runtimeText("taskSynced");
      syncError.value = "";
    } catch (error) {
      dashboard.value = buildLocalDashboard();
      syncError.value = error instanceof Error ? error.message : runtimeText("taskSyncFailed");
    }
  }

  async function advanceTask(id: number) {
    if (!session.token) {
      saveLocalTasks(readLocalTasks().map((item) => item.id === id ? advanceLocalTask(item) : item));
      dashboard.value = buildLocalDashboard();
      syncMessage.value = runtimeText("taskProgressLocalSaved");
      return;
    }

    try {
      dashboard.value = normalizeDashboard(await apiFetch<PlannerDashboard>(`/planner/tasks/${id}/advance`, { method: "PATCH" }, session.token));
      persistDashboard(dashboard.value);
      syncMessage.value = runtimeText("taskProgressSynced");
      syncError.value = "";
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : runtimeText("taskAdvanceFailed");
    }
  }

  async function updateVisa(payload: Partial<PlannerVisaChecklist>) {
    const visaChecklist = { ...readVisaChecklist(), ...payload };
    saveVisaChecklist(visaChecklist);

    if (!session.token) {
      dashboard.value = buildLocalDashboard();
      syncMessage.value = runtimeText("visaLocalSaved");
      return;
    }

    try {
      dashboard.value = normalizeDashboard(await apiFetch<PlannerDashboard>("/planner/visa", { method: "PATCH", body: JSON.stringify(payload) }, session.token));
      persistDashboard(dashboard.value);
      syncMessage.value = runtimeText("visaSynced");
      syncError.value = "";
    } catch (error) {
      dashboard.value = buildLocalDashboard();
      syncError.value = error instanceof Error ? error.message : runtimeText("visaSyncFailed");
    }
  }

  function buildLocalDashboard(): PlannerDashboard {
    const profile = readProfile();
    const materialProgress = readMaterialProgress();
    const visaChecklist = readVisaChecklist();
    const materials = buildMaterials(profile, materialProgress);
    const recommendations = buildRecommendations(profile);
    const savedTasks = readLocalTasks();
    const tasks = savedTasks.length ? savedTasks : buildDefaultTasks(recommendations);
    if (!savedTasks.length && tasks.length) saveLocalTasks(tasks);
    const doneMaterials = materials.filter((item) => item.status === "done").length;
    const materialCompletion = materials.length ? Math.round((doneMaterials / materials.length) * 100) : 0;

    return {
      profile,
      materials,
      tasks,
      visaChecklist,
      summary: {
        readinessScore: getReadiness(profile, materialCompletion, recommendations.length),
        materialCompletion,
        profileCompleteness: getProfileCompleteness(profile),
        recommendationCount: recommendations.length,
        activeTaskCount: tasks.length,
        visaDoneCount: Object.values(visaChecklist).filter(Boolean).length
      },
      recommendations
    };
  }

  function readLocalState() {
    const currentDashboard = dashboard.value || buildLocalDashboard();
    return {
      profile: serializeProfileForApi(readProfile()),
      materialProgress: readMaterialProgress(),
      visaChecklist: readVisaChecklist(),
      tasks: currentDashboard.tasks.map((task) => ({
        universityId: task.universityId,
        programId: task.programId,
        tier: task.tier,
        stage: task.stage,
        progress: task.progress,
        deadlineNote: task.deadlineNote,
        nextAction: task.nextAction
      }))
    };
  }

  async function ensureCatalogData() {
    const catalog = useCatalogStore();
    if (catalog.universities.length && catalog.programs.length) return;
    await catalog.loadUniversities();
  }

  return {
    dashboard,
    loading,
    syncMessage,
    syncError,
    isLocalMode,
    load,
    mergeLocalState,
    updateProfile,
    updateMaterial,
    addTask,
    advanceTask,
    updateVisa
  };
});

function buildMaterials(profile: PlannerProfileState, progress: Record<string, MaterialStatus>): PlannerMaterialItem[] {
  const base = [
    material("passport", "Passport bio page", "护照首页扫描件", "Clear scan with at least six months validity."),
    material("photo", "ID photo", "白底证件照", "Use recent white-background ID photos."),
    material("transcript", "Academic transcript", "英文版成绩单", "Official or school-issued English transcript."),
    material("language", "Language score", "英语成绩证明", "IELTS, TOEFL or accepted conditional-language route.")
  ];
  const levelMaterials: Record<DegreeLevel, PlannerMaterialItem[]> = {
    bachelor: [
      material("high_school", "High school certificate", "高中毕业证或在读证明", "Graduation certificate or enrollment certificate."),
      material("personal_statement", "Personal statement", "个人陈述", "Draft your study motivation and academic fit.")
    ],
    master: [
      material("degree_certificate", "Bachelor degree documents", "本科毕业证与学位证", "Degree certificate and graduation certificate."),
      material("study_plan", "Study plan", "个人陈述或 Study Plan", "Explain academic background and study plan."),
      material("recommendation", "Recommendation letter", "推荐信 1-2 封", "Academic or professional references.")
    ],
    phd: [
      material("master_degree", "Master degree documents", "硕士学位材料", "Master transcript and degree certificate."),
      material("research_proposal", "Research proposal", "研究计划书", "Research topic, method and supervisor fit."),
      material("academic_cv", "Academic CV", "学术简历或论文成果", "Include publications, research projects and awards.")
    ]
  };

  return [...base, ...levelMaterials[profile.level]].map((item) => ({
    ...item,
    status: progress[item.key] || item.status
  }));
}

function buildRecommendations(profile: PlannerProfileState): RecommendationResult[] {
  const catalog = useCatalogStore();
  const universitiesById = new Map(catalog.universities.map((item) => [item.id, item]));
  const results: RecommendationResult[] = [];

  for (const program of catalog.programs) {
    const university = universitiesById.get(program.universityId);
    if (!university) continue;
    if (program.publicDisplayStatus && program.publicDisplayStatus !== "ready") continue;
    if (program.level !== profile.level) continue;
    if (profile.targetCategory && !sameCategory(program.category, profile.targetCategory)) continue;

    const annualCostCny = program.annualTuitionCny + university.livingCostCny;
    const score = scoreProgram(profile, program, university, annualCostCny);
    if (score.score < 22) continue;
    results.push({
      score: score.score,
      reasons: score.reasons,
      university,
      program,
      annualCostCny
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 8);
}

function scoreProgram(profile: PlannerProfileState, program: ProgramListItem, university: UniversityListItem, annualCostCny: number) {
  let score = 0;
  const reasons: LocalizedStringArray = { en: [], ms: [], "zh-CN": [], "zh-TW": [] };

  if (profile.gpa >= program.requirement.gpa) {
    score += 28;
    pushReason(reasons, "Academic background fits", "学术背景匹配");
  } else if (profile.gpa + 0.3 >= program.requirement.gpa) {
    score += 16;
    pushReason(reasons, "Academic background is close", "学术背景接近要求");
  }

  if (profile.ielts >= program.languageRequirement.ielts) {
    score += 24;
    pushReason(reasons, "Language score already meets the requirement", "语言成绩已达标");
  } else if (profile.acceptNoLanguage && university.acceptNoLanguage) {
    score += 14;
    pushReason(reasons, "Conditional language pathway is available", "支持先申请后补语言");
  }

  if (annualCostCny <= profile.budgetCny) {
    score += 20;
    pushReason(reasons, "First-year cost fits the budget", "首年成本在预算内");
  } else if (annualCostCny <= profile.budgetCny * 1.2) {
    score += 10;
    pushReason(reasons, "First-year cost is close to the budget", "首年成本接近预算");
  }

  if (university.qsRank <= 200) score += 12;
  else if (university.qsRank <= 500) score += 7;

  return { score, reasons };
}

function buildDefaultTasks(recommendations: RecommendationResult[]) {
  return recommendations.slice(0, 4).map((item, index) => buildTask({
    universityId: item.university.id,
    programId: item.program.id,
    index,
    tier: tierText(index === 0 ? "reach" : index < 3 ? "target" : "safe"),
    stage: ["draft", "materials", "ready", "review"][index] as ApplicationStage,
    progress: [20, 45, 70, 82][index]
  }));
}

function buildTask(input: {
  universityId: number;
  programId: number;
  index: number;
  tier: LocalizedText;
  stage: ApplicationStage;
  progress: number;
}): PlannerApplicationItem {
  const id = Number(`-${input.universityId}${input.programId}${input.index + 1}`);
  return {
    id,
    universityId: input.universityId,
    programId: input.programId,
    tier: input.tier,
    stage: input.stage,
    progress: input.progress,
    deadlineNote: stageDeadline(input.stage),
    nextAction: stageNextAction(input.stage)
  };
}

function advanceLocalTask(task: PlannerApplicationItem): PlannerApplicationItem {
  const stages: Array<{ stage: ApplicationStage; progress: number }> = [
    { stage: "draft", progress: 20 },
    { stage: "materials", progress: 45 },
    { stage: "ready", progress: 70 },
    { stage: "review", progress: 82 },
    { stage: "conditional-offer", progress: 92 },
    { stage: "visa", progress: 100 }
  ];
  const currentIndex = stages.findIndex((item) => item.stage === task.stage);
  const next = stages[Math.min(currentIndex + 1, stages.length - 1)];
  return {
    ...task,
    stage: next.stage,
    progress: next.progress,
    deadlineNote: stageDeadline(next.stage),
    nextAction: stageNextAction(next.stage)
  };
}

function material(key: string, en: string, zh: string, noteEn: string): PlannerMaterialItem {
  return {
    key,
    name: text(en, zh),
    note: text(noteEn, zh),
    status: "wait"
  };
}

function readProfile(): PlannerProfileState {
  return normalizeProfile(readStorage(PROFILE_KEY, DEFAULT_PROFILE));
}

function saveProfile(profile: PlannerProfileState) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function readMaterialProgress() {
  const raw = readStorage<Record<string, MaterialStatus>>(MATERIAL_KEY, {});
  return normalizeMaterialProgress(raw);
}

function saveMaterialProgress(materialProgress: Record<string, MaterialStatus>) {
  localStorage.setItem(MATERIAL_KEY, JSON.stringify(normalizeMaterialProgress(materialProgress)));
}

function readVisaChecklist(): PlannerVisaChecklist {
  return { ...DEFAULT_VISA, ...readStorage<Partial<PlannerVisaChecklist>>(VISA_KEY, {}) };
}

function saveVisaChecklist(visaChecklist: PlannerVisaChecklist) {
  localStorage.setItem(VISA_KEY, JSON.stringify({ ...DEFAULT_VISA, ...visaChecklist }));
}

function readLocalTasks() {
  return normalizeTasks(readStorage<unknown[]>(TASK_KEY, []));
}

function saveLocalTasks(tasks: PlannerApplicationItem[]) {
  localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
}

function normalizeDashboard(value: PlannerDashboard): PlannerDashboard {
  const profile = normalizeProfile(value.profile);
  const materials = value.materials.map((item) => ({
    ...item,
    status: normalizeMaterialStatus(item.status)
  }));
  const tasks = normalizeTasks(value.tasks);
  const visaChecklist = { ...DEFAULT_VISA, ...value.visaChecklist };
  const recommendations = value.recommendations.length ? value.recommendations : buildRecommendations(profile);
  const doneMaterials = materials.filter((item) => item.status === "done").length;
  const materialCompletion = materials.length ? Math.round((doneMaterials / materials.length) * 100) : 0;

  return {
    profile,
    materials,
    tasks,
    visaChecklist,
    summary: {
      ...value.summary,
      readinessScore: getReadiness(profile, materialCompletion, recommendations.length),
      materialCompletion,
      profileCompleteness: getProfileCompleteness(profile),
      recommendationCount: recommendations.length,
      activeTaskCount: tasks.length,
      visaDoneCount: Object.values(visaChecklist).filter(Boolean).length
    },
    recommendations
  };
}

function persistDashboard(value: PlannerDashboard) {
  saveProfile(value.profile);
  saveMaterialProgress(Object.fromEntries(value.materials.map((item) => [item.key, item.status])));
  saveVisaChecklist(value.visaChecklist);
  saveLocalTasks(value.tasks);
}

function normalizeProfile(value: unknown): PlannerProfileState {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    level: normalizeLevel(source.level),
    targetCategory: normalizeCategory(source.targetCategory),
    budgetCny: normalizeNumber(source.budgetCny ?? source.budget, DEFAULT_PROFILE.budgetCny),
    gpa: normalizeNumber(source.gpa, DEFAULT_PROFILE.gpa),
    ielts: normalizeNumber(source.ielts, DEFAULT_PROFILE.ielts),
    experience: typeof source.experience === "string" && source.experience ? source.experience : DEFAULT_PROFILE.experience,
    acceptNoLanguage: typeof source.acceptNoLanguage === "boolean" ? source.acceptNoLanguage : DEFAULT_PROFILE.acceptNoLanguage
  };
}

function normalizeMaterialProgress(raw: Record<string, MaterialStatus>) {
  const output: Record<string, MaterialStatus> = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const status = normalizeMaterialStatus(value);
    if (status) output[key] = status;
  }
  return output;
}

function normalizeMaterialStatus(value: unknown): MaterialStatus {
  if (value === "draft" || value === "wait" || value === "progress" || value === "done") return value;
  return "wait";
}

function normalizeTasks(raw: unknown[]): PlannerApplicationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => normalizeTask(item, index))
    .filter((item): item is PlannerApplicationItem => Boolean(item));
}

function normalizeTask(item: unknown, index: number): PlannerApplicationItem | null {
  if (!item || typeof item !== "object") return null;
  const source = item as Record<string, unknown>;
  const universityId = normalizeNumber(source.universityId ?? source.uniId, 0);
  const programId = normalizeNumber(source.programId ?? source.progId, 0);
  if (!universityId || !programId) return null;
  const stage = normalizeStage(source.stage);
  return {
    id: normalizeNumber(source.id, Number(`-${universityId}${programId}${index + 1}`)),
    universityId,
    programId,
    tier: normalizeLocalizedText(source.tier, tierText(index === 0 ? "reach" : index < 3 ? "target" : "safe")),
    stage,
    progress: Math.min(100, Math.max(0, normalizeNumber(source.progress, [20, 45, 70, 82][index] || 20))),
    deadlineNote: normalizeLocalizedText(source.deadlineNote, stageDeadline(stage)),
    nextAction: normalizeLocalizedText(source.nextAction, stageNextAction(stage))
  };
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function normalizeNumber(value: unknown, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeLevel(value: unknown): DegreeLevel {
  if (value === "bachelor" || value === "本科") return "bachelor";
  if (value === "master" || value === "硕士") return "master";
  if (value === "phd" || value === "博士") return "phd";
  return DEFAULT_PROFILE.level;
}

function normalizeCategory(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_PROFILE.targetCategory;
  const map: Record<string, string> = {
    it: "IT",
    IT: "IT",
    "计算机 / IT": "IT",
    商科: "business",
    工科: "engineering",
    工程: "engineering",
    理科: "science",
    艺术: "arts",
    医学: "medicine",
    法学: "law"
  };
  return map[value] || value;
}

function serializeProfileForApi(profile: PlannerProfileState): PlannerProfile {
  const targetCategory = normalizeCoreCategory(profile.targetCategory);
  return {
    ...profile,
    targetCategory: isCoreCategory(targetCategory) ? targetCategory : "it"
  } as PlannerProfile;
}

function normalizeCoreCategory(value: string) {
  const map: Record<string, string> = {
    IT: "it",
    "计算机 / IT": "it",
    商科: "business",
    工科: "engineering",
    工程: "engineering",
    理科: "science",
    艺术: "arts",
    医学: "medicine",
    法学: "law"
  };
  return map[value] || value;
}

function isCoreCategory(value: string) {
  return value === "business" || value === "it" || value === "engineering" || value === "science" || value === "arts" || value === "medicine" || value === "law";
}

function sameCategory(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function normalizeStage(value: unknown): ApplicationStage {
  if (value === "draft" || value === "待创建") return "draft";
  if (value === "materials" || value === "材料准备中") return "materials";
  if (value === "ready" || value === "待递交") return "ready";
  if (value === "review" || value === "院校审核中") return "review";
  if (value === "conditional-offer") return "conditional-offer";
  if (value === "visa") return "visa";
  return "draft";
}

function normalizeLocalizedText(value: unknown, fallback: LocalizedText): LocalizedText {
  if (typeof value === "string") return text(value, value);
  if (!value || typeof value !== "object") return fallback;
  const source = value as Record<string, string>;
  return {
    en: source.en || fallback.en,
    ms: source.ms || fallback.ms,
    "zh-CN": source["zh-CN"] || fallback["zh-CN"],
    "zh-TW": source["zh-TW"] || fallback["zh-TW"]
  };
}

function getProfileCompleteness(profile: PlannerProfileState) {
  let score = 0;
  if (profile.level) score += 16;
  if (profile.targetCategory) score += 16;
  if (profile.budgetCny > 0) score += 16;
  if (profile.gpa > 0) score += 18;
  if (profile.ielts > 0) score += 16;
  if (profile.experience) score += 8;
  if (typeof profile.acceptNoLanguage === "boolean") score += 10;
  return Math.min(100, score);
}

function getReadiness(profile: PlannerProfileState, materialCompletion: number, recommendationCount: number) {
  return Math.min(
    96,
    Math.max(
      32,
      Math.round(
        materialCompletion * 0.34 +
          Math.min(profile.gpa / 3.5, 1) * 24 +
          Math.min(profile.ielts / 6.5, 1) * 18 +
          (recommendationCount ? 14 : 6)
      )
    )
  );
}

function pushReason(target: LocalizedStringArray, en: string, zh: string) {
  target.en.push(en);
  target.ms.push(en);
  target["zh-CN"].push(zh);
  target["zh-TW"].push(zh);
}

function tierText(tier: "reach" | "target" | "safe"): LocalizedText {
  if (tier === "reach") return text("Reach", "冲刺");
  if (tier === "target") return text("Target", "主申");
  return text("Safe", "保底");
}

function stageDeadline(stage: ApplicationStage): LocalizedText {
  const map: Record<ApplicationStage, LocalizedText> = {
    draft: text("Within 7 days", "建议 7 天内确认"),
    materials: text("Within 10 days", "建议 10 天内补齐"),
    ready: text("Within 14 days", "建议 14 天内递交"),
    review: text("Keep following up", "保持跟进"),
    "conditional-offer": text("Follow offer timeline", "按 offer 节点推进"),
    visa: text("Per visa requirement", "按签证要求推进")
  };
  return map[stage];
}

function stageNextAction(stage: ApplicationStage): LocalizedText {
  const map: Record<ApplicationStage, LocalizedText> = {
    draft: text("Confirm shortlist and required materials.", "确认目标名单与材料包。"),
    materials: text("Complete language, recommendation and degree documents.", "补齐语言、推荐信和学历材料。"),
    ready: text("Submit form and fee package.", "完成表单与申请费准备。"),
    review: text("Track review feedback and missing documents.", "跟进审核反馈与补件。"),
    "conditional-offer": text("Close offer conditions and deposit steps.", "完成 conditional offer 条件与押金步骤。"),
    visa: text("Move into visa and pre-departure workflow.", "转入签证与行前流程。")
  };
  return map[stage];
}

function text(en: string, zh: string): LocalizedText {
  return {
    en,
    ms: en,
    "zh-CN": zh,
    "zh-TW": zh
  };
}
