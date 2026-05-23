<template>
  <section class="planner-page">
    <div v-if="planner.loading && !dashboard" class="section-card empty-state">{{ t('common.loading') }}</div>

    <template v-else-if="dashboard">
      <div class="planner-page-head">
        <div>
          <h1 class="section-title">{{ t('planner.title') }}</h1>
          <p class="section-copy mt-1">{{ t('planner.subtitle') }}</p>
        </div>
        <div class="planner-head-chips">
          <span class="chip chip-gold">{{ t('planner.readiness') }} {{ dashboard.summary.readinessScore }}%</span>
          <span class="chip chip-teal">{{ t('planner.activeTasks') }} {{ dashboard.summary.activeTaskCount }}</span>
        </div>
      </div>

      <div class="planner-status-row">
        <div class="inline-alert" :class="{ 'inline-alert--local': planner.isLocalMode }">
          {{ planner.isLocalMode ? t('planner.localModeNotice') : (planner.syncMessage || t('planner.accountModeNotice')) }}
        </div>
        <div v-if="planner.syncError" class="inline-alert inline-alert--error">{{ planner.syncError }}</div>
      </div>

      <div class="planner-tabs" role="tablist">
        <button v-for="item in tabs" :key="item.key" class="planner-tab" :class="{ active: activeTab === item.key }" type="button" @click="activeTab = item.key">
          {{ item.label }}
        </button>
      </div>

      <section v-if="activeTab === 'overview'" class="planner-panel">
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

        <div class="planner-panel__head">
          <div>
            <div class="section-kicker">{{ t('common.recommendations') }}</div>
            <h2 class="section-title">{{ t('planner.recommendationTitle') }}</h2>
          </div>
          <button class="btn btn-outline" type="button" @click="activeTab = 'profile'">{{ t('planner.saveProfile') }}</button>
        </div>

        <div v-if="dashboard.recommendations.length" class="recommendation-list">
          <RouterLink
            v-for="(item, index) in dashboard.recommendations.slice(0, 3)"
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
          <div class="fav-empty-icon">✦</div>
          <strong>{{ t('planner.noRecommendationsTitle') }}</strong>
          <span>{{ t('planner.noRecommendationsBody') }}</span>
          <button class="btn btn-gold" type="button" @click="activeTab = 'profile'">{{ t('planner.improveProfile') }}</button>
        </div>
      </section>

      <section v-if="activeTab === 'profile'" class="planner-panel">
        <div class="planner-panel__head">
          <div>
            <div class="section-kicker">{{ t('planner.eligibilityTitle') }}</div>
            <h2 class="section-title">{{ t('planner.studentProfileTitle') }}</h2>
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
              <option v-for="item in experienceOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="planner-toggle">
            <input v-model="profile.acceptNoLanguage" type="checkbox" />
            <span>{{ t('planner.conditionalDescription') }}</span>
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
                <span>{{ t('planner.progressNow') }}</span>
              </div>
            </div>
            <div class="progress-bar"><div class="progress-fill" :style="{ width: `${item.progress}%` }"></div></div>
            <p>{{ text(item.nextAction as any) }}</p>
            <button class="btn btn-primary" type="button" @click="planner.advanceTask(item.id)">{{ t('planner.advance') }}</button>
          </article>
        </div>

        <div v-else class="fav-empty section-card">
          <div class="fav-empty-icon">✓</div>
          <strong>{{ t('planner.noTasksTitle') }}</strong>
          <span>{{ t('planner.noTasksBody') }}</span>
          <button class="btn btn-gold" type="button" @click="activeTab = 'profile'">{{ t('planner.improveProfile') }}</button>
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
import { formatCurrency, officialConfirmationFallback } from "../utils/format";

const planner = usePlannerStore();
const catalog = useCatalogStore();
const { t } = useI18n();
const { currentLocale, text } = useLocaleText();
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
  { key: "overview", label: t('planner.tabs.overview') },
  { key: "profile", label: t('planner.tabs.profile') },
  { key: "materials", label: t('planner.tabs.materials') },
  { key: "applications", label: t('planner.tabs.applications') },
  { key: "visa", label: t('planner.tabs.visa') }
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
const experienceOptions = computed(() => [
  { value: "0-1 years", label: t('planner.experience.zeroOne') },
  { value: "1-3 years", label: t('planner.experience.oneThree') },
  { value: "3-5 years", label: t('planner.experience.threeFive') },
  { value: "5+ years", label: t('planner.experience.fivePlus') }
]);
const visaKeys = computed(() => [
  { key: "offerAccepted", label: t('planner.visaSteps.offerAccepted'), note: t('planner.visaSteps.offerAcceptedNote') },
  { key: "depositPaid", label: t('planner.visaSteps.depositPaid'), note: t('planner.visaSteps.depositPaidNote') },
  { key: "visaDocsReady", label: t('planner.visaSteps.visaDocsReady'), note: t('planner.visaSteps.visaDocsReadyNote') },
  { key: "preDeparture", label: t('planner.visaSteps.preDeparture'), note: t('planner.visaSteps.preDepartureNote') },
  { key: "arrivalReady", label: t('planner.visaSteps.arrivalReady'), note: t('planner.visaSteps.arrivalReadyNote') }
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
  if (index === 0) return t('planner.tiers.reach');
  if (index < 3) return t('planner.tiers.target');
  return t('planner.tiers.safe');
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
  return t(`planner.stages.${stage}`);
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
  if (!university || !program) return officialConfirmationFallback(currentLocale.value);
  return `CNY ${formatCurrency(university.livingCostCny + program.annualTuitionCny)}${t('common.perYear')}`;
}
</script>
