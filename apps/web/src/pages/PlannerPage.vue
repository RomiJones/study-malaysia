<template>
  <section class="planner-page">
    <div v-if="planner.loading && !dashboard" class="section-card empty-state">{{ t('common.loading') }}</div>

    <template v-else-if="dashboard">
      <div class="planner-hero">
        <div>
          <div class="planner-hero__badge">{{ t('planner.heroBadge') }}</div>
          <h1 class="planner-hero__title">{{ t('planner.title') }}</h1>
          <p class="planner-hero__subtitle">{{ t('planner.subtitle') }}</p>
        </div>
        <div class="planner-hero__stats">
          <div class="planner-hero__stat">
            <span>{{ t('planner.readiness') }}</span>
            <strong>{{ dashboard.summary.readinessScore }}%</strong>
          </div>
          <div class="planner-hero__stat">
            <span>{{ t('planner.activeTasks') }}</span>
            <strong>{{ dashboard.summary.activeTaskCount }}</strong>
          </div>
        </div>
      </div>

      <div class="planner-status-row">
        <div class="inline-alert" :class="{ 'inline-alert--local': planner.isLocalMode }">
          {{ planner.isLocalMode ? '访客模式：收藏、画像、材料、申请任务和签证清单会保存在本机，登录后会同步到服务端。' : (planner.syncMessage || '账户模式：规划状态会保存到服务端。') }}
        </div>
        <div v-if="planner.syncError" class="inline-alert inline-alert--error">{{ planner.syncError }}</div>
      </div>

      <div class="planner-summary-grid">
        <article class="planner-summary-card">
          <span>{{ t('common.profile') }}</span>
          <strong>{{ dashboard.summary.profileCompleteness }}%</strong>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: `${dashboard.summary.profileCompleteness}%` }"></div></div>
        </article>
        <article class="planner-summary-card">
          <span>{{ t('common.materials') }}</span>
          <strong>{{ dashboard.summary.materialCompletion }}%</strong>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: `${dashboard.summary.materialCompletion}%` }"></div></div>
        </article>
        <article class="planner-summary-card">
          <span>{{ t('common.visa') }}</span>
          <strong>{{ dashboard.summary.visaDoneCount }}/5</strong>
          <div class="progress-bar"><div class="progress-fill" :style="{ width: `${dashboard.summary.visaDoneCount / 5 * 100}%` }"></div></div>
        </article>
        <article class="planner-summary-card">
          <span>{{ t('common.budget') }}</span>
          <strong>CNY {{ formatCurrency(dashboard.profile.budgetCny) }}</strong>
          <small>GPA {{ dashboard.profile.gpa }} · IELTS {{ dashboard.profile.ielts }}</small>
        </article>
      </div>

      <div class="planner-tabs" role="tablist">
        <button v-for="item in tabs" :key="item.key" class="planner-tab" :class="{ active: activeTab === item.key }" type="button" @click="activeTab = item.key">
          {{ item.label }}
        </button>
      </div>

      <section v-if="activeTab === 'overview'" class="planner-panel">
        <div class="planner-panel__head">
          <div>
            <div class="section-kicker">{{ t('common.recommendations') }}</div>
            <h2 class="section-title">{{ t('planner.recommendationTitle') }}</h2>
          </div>
          <button class="btn btn-outline" type="button" @click="activeTab = 'profile'">{{ t('planner.saveProfile') }}</button>
        </div>

        <div v-if="dashboard.recommendations.length" class="recommendation-list">
          <RouterLink
            v-for="(item, index) in dashboard.recommendations.slice(0, 4)"
            :key="item.program.id"
            class="rec-card"
            :to="`/universities/${item.university.slug}?program=${item.program.id}`"
          >
            <div class="rec-score">{{ item.score }}</div>
            <div class="rec-card__body">
              <div class="rec-card__title">{{ text(item.program.name) }}</div>
              <div class="rec-card__meta">{{ text(item.university.name) }} · QS #{{ item.university.qsRank }}</div>
              <div class="rec-card__chips">
                <span class="chip" :class="tierChipClass(index)">{{ tierLabel(index) }}</span>
                <span class="chip chip-ink">CNY {{ formatCurrency(item.annualCostCny) }}{{ t('common.perYear') }}</span>
                <span class="chip chip-teal">IELTS {{ item.program.languageRequirement.ielts }}+</span>
              </div>
            </div>
          </RouterLink>
        </div>

        <div v-else class="fav-empty section-card">
          <div class="fav-empty-icon">荐</div>
          <strong>暂无匹配推荐</strong>
          <span>调整申请层次、专业方向、预算、GPA 或 IELTS 后再查看。</span>
          <button class="btn btn-gold" type="button" @click="activeTab = 'profile'">完善学生画像</button>
        </div>
      </section>

      <section v-if="activeTab === 'profile'" class="planner-panel">
        <div class="planner-panel__head">
          <div>
            <div class="section-kicker">{{ t('planner.eligibilityTitle') }}</div>
            <h2 class="section-title">学生基本画像</h2>
          </div>
        </div>
        <div class="planner-form">
          <label class="field-shell">
            <span>{{ t('recommend.level') }}</span>
            <select v-model="profile.level">
              <option v-for="item in levelOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="field-shell">
            <span>{{ t('recommend.category') }}</span>
            <select v-model="profile.targetCategory">
              <option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="field-shell">
            <span>{{ t('common.gpa') }}</span>
            <input v-model.number="profile.gpa" type="number" min="0" max="4" step="0.1" />
          </label>
          <label class="field-shell">
            <span>{{ t('common.ielts') }}</span>
            <input v-model.number="profile.ielts" type="number" min="0" max="9" step="0.5" />
          </label>
          <label class="field-shell">
            <span>{{ t('common.budget') }}</span>
            <input v-model.number="profile.budgetCny" type="number" min="0" step="5000" />
          </label>
          <label class="field-shell">
            <span>{{ t('common.experience') }}</span>
            <select v-model="profile.experience">
              <option value="0-1 years">0-1 年</option>
              <option value="1-3 years">1-3 年</option>
              <option value="3-5 years">3-5 年</option>
              <option value="5+ years">5 年以上</option>
            </select>
          </label>
          <label class="planner-toggle">
            <input v-model="profile.acceptNoLanguage" type="checkbox" />
            <span>接受先申请、后补语言成绩的方案</span>
          </label>
        </div>
        <button class="btn btn-gold planner-save" type="button" @click="saveProfile">{{ t('planner.saveProfile') }}</button>
      </section>

      <section v-if="activeTab === 'materials'" class="planner-panel">
        <div class="planner-panel__head">
          <div>
            <div class="section-kicker">{{ t('planner.tabs.materials') }}</div>
            <h2 class="section-title">{{ t('common.materials') }}</h2>
          </div>
        </div>
        <div class="material-list">
          <article v-for="item in dashboard.materials" :key="item.key" class="material-item">
            <div class="material-status" :class="`material-status--${item.status}`">{{ statusIcon(item.status) }}</div>
            <div class="material-item__body">
              <strong>{{ text(item.name) }}</strong>
              <span>{{ text(item.note) }}</span>
            </div>
            <select class="material-select" :value="item.status" @change="updateMaterial(item.key, $event)">
              <option v-for="status in statuses" :key="status" :value="status">{{ statusLabel(status) }}</option>
            </select>
          </article>
        </div>
      </section>

      <section v-if="activeTab === 'applications'" class="planner-panel">
        <div class="planner-panel__head">
          <div>
            <div class="section-kicker">{{ t('planner.applicationTask') }}</div>
            <h2 class="section-title">{{ t('planner.tabs.applications') }}</h2>
          </div>
        </div>

        <div v-if="dashboard.tasks.length" class="task-list">
          <article v-for="item in dashboard.tasks" :key="item.id" class="app-task-card">
            <div class="app-task-card__top">
              <div>
                <div class="app-task-card__chips">
                  <span class="app-task-tier" :class="taskTierClass(item)">{{ text(item.tier as any) }}</span>
                  <span class="chip chip-ink">{{ stageLabel(item.stage) }}</span>
                </div>
                <strong>{{ programName(item.programId) }}</strong>
                <span>{{ universityName(item.universityId) }} · {{ annualCost(item.universityId, item.programId) }}</span>
              </div>
              <div class="task-progress-number">
                <strong>{{ item.progress }}%</strong>
                <span>进度</span>
              </div>
            </div>
            <div class="progress-bar"><div class="progress-fill" :style="{ width: `${item.progress}%` }"></div></div>
            <p>{{ text(item.nextAction as any) }}</p>
            <button class="btn btn-primary" type="button" @click="planner.advanceTask(item.id)">{{ t('planner.advance') }}</button>
          </article>
        </div>

        <div v-else class="fav-empty section-card">
          <div class="fav-empty-icon">任</div>
          <strong>暂无申请任务</strong>
          <span>完善画像后，系统会根据推荐结果自动生成冲刺、主申和保底任务。</span>
          <button class="btn btn-gold" type="button" @click="activeTab = 'profile'">完善学生画像</button>
        </div>
      </section>

      <section v-if="activeTab === 'visa'" class="planner-panel">
        <div class="planner-panel__head">
          <div>
            <div class="section-kicker">{{ t('planner.visaChecklist') }}</div>
            <h2 class="section-title">{{ t('planner.tabs.visa') }}</h2>
          </div>
        </div>
        <div class="visa-list">
          <button v-for="item in visaKeys" :key="item.key" class="visa-step" :class="{ done: dashboard.visaChecklist[item.key] }" type="button" @click="planner.updateVisa({ [item.key]: !dashboard.visaChecklist[item.key] })">
            <span class="visa-check">{{ dashboard.visaChecklist[item.key] ? '✓' : '' }}</span>
            <span>
              <strong>{{ item.label }}</strong>
              <small>{{ item.note }}</small>
            </span>
          </button>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import type { ApplicationStage, DegreeLevel, MaterialStatus } from "@studymy/shared";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { usePlannerStore } from "../stores/planner";
import { formatCurrency } from "../utils/format";

const planner = usePlannerStore();
const catalog = useCatalogStore();
const { t } = useI18n();
const { text } = useLocaleText();
const activeTab = ref<"overview" | "profile" | "materials" | "applications" | "visa">("overview");
const statuses: MaterialStatus[] = ["draft", "wait", "progress", "done"];
const profile = reactive({
  level: "master" as DegreeLevel,
  targetCategory: "it",
  budgetCny: 80000,
  gpa: 2.9,
  ielts: 5.5,
  experience: "0-1 years",
  acceptNoLanguage: true
});

const dashboard = computed(() => planner.dashboard);
const tabs = computed(() => [
  { key: "overview", label: "申请概览" },
  { key: "profile", label: "学生画像" },
  { key: "materials", label: "材料清单" },
  { key: "applications", label: "申请管理" },
  { key: "visa", label: "签证清单" }
] as const);
const levelOptions = computed(() => [
  { value: "bachelor", label: t('degree.bachelor') },
  { value: "master", label: t('degree.master') },
  { value: "phd", label: t('degree.phd') }
]);
const categoryOptions = computed(() => {
  const categories = Array.from(new Set(catalog.programs.map((item) => item.category))).sort();
  return categories.length
    ? categories.map((value) => ({ value, label: categoryLabel(value) }))
    : ["business", "it", "engineering", "science", "arts", "medicine", "law"].map((value) => ({ value, label: categoryLabel(value) }));
});
const visaKeys = computed(() => [
  { key: "offerAccepted", label: "收到正式录取通知书（Offer Letter）", note: "确认所有录取条件已满足" },
  { key: "depositPaid", label: "缴纳入学押金（Acceptance Deposit）", note: "按院校要求时间节点完成" },
  { key: "visaDocsReady", label: "准备签证申请材料", note: "护照、照片、财务证明、录取信、健康证明" },
  { key: "preDeparture", label: "完成签证申请并获批", note: "通过 eVAL 系统或使馆流程" },
  { key: "arrivalReady", label: "出发前准备就绪", note: "机票、住宿、保险、外币等" }
] as const);

onMounted(() => {
  void planner.load();
});

watch(dashboard, (value) => {
  if (value) Object.assign(profile, value.profile);
}, { immediate: true });

async function saveProfile() {
  await planner.updateProfile(profile);
  activeTab.value = "overview";
}

function categoryLabel(value: string) {
  const coreLabels: Record<string, string> = {
    business: t('category.business'),
    it: t('category.it'),
    engineering: t('category.engineering'),
    science: t('category.science'),
    arts: t('category.arts'),
    medicine: t('category.medicine'),
    law: t('category.law')
  };
  return coreLabels[value] || value;
}

function statusLabel(status: MaterialStatus) {
  return t(`status.${status}`);
}

function statusIcon(status: MaterialStatus) {
  if (status === "done") return "✓";
  if (status === "progress") return "◑";
  if (status === "draft") return "✎";
  return "○";
}

function updateMaterial(key: string, event: Event) {
  const status = (event.target as HTMLSelectElement).value as MaterialStatus;
  void planner.updateMaterial(key, status);
}

function tierLabel(index: number) {
  if (index === 0) return "冲刺";
  if (index < 3) return "主申";
  return "保底";
}

function tierChipClass(index: number) {
  if (index === 0) return "chip-gold";
  if (index < 3) return "chip-teal";
  return "chip-blue";
}

function taskTierClass(item: { tier: Record<string, string> }) {
  const value = text(item.tier as any);
  if (value.includes("冲刺") || value.toLowerCase().includes("reach")) return "tier-sprint";
  if (value.includes("主申") || value.toLowerCase().includes("target")) return "tier-main";
  return "tier-safe";
}

function stageLabel(stage: ApplicationStage) {
  const labels: Record<ApplicationStage, string> = {
    draft: "待创建",
    materials: "材料准备中",
    ready: "待递交",
    review: "院校审核中",
    "conditional-offer": "条件录取",
    visa: "签证阶段"
  };
  return labels[stage] || stage;
}

function programName(programId: number) {
  const program = catalog.programs.find((item) => item.id === programId);
  return program ? text(program.name) : `Program #${programId}`;
}

function universityName(universityId: number) {
  const university = catalog.universities.find((item) => item.id === universityId);
  return university ? text(university.name) : `University #${universityId}`;
}

function annualCost(universityId: number, programId: number) {
  const university = catalog.universities.find((item) => item.id === universityId);
  const program = catalog.programs.find((item) => item.id === programId);
  if (!university || !program) return "年总成本待确认";
  return `CNY ${formatCurrency(university.livingCostCny + program.annualTuitionCny)} / 年`;
}
</script>
