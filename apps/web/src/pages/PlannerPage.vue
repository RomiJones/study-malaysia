<template>
  <section v-if="dashboard" class="grid gap-6">
    <div class="hero-bg rounded-[32px] px-6 py-8 text-white md:px-8">
      <div class="relative z-[1] grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-end">
        <div>
          <div class="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">{{ t('planner.heroBadge') }}</div>
          <h1 class="mt-4 text-4xl font-black leading-tight md:text-5xl">{{ t('planner.title') }}</h1>
          <p class="mt-4 max-w-3xl text-sm leading-8 text-white/80 md:text-base">{{ t('planner.subtitle') }}</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-[24px] bg-white/10 p-5">
            <div class="text-xs font-bold uppercase tracking-[0.16em] text-white/70">{{ t('planner.readiness') }}</div>
            <div class="mt-3 text-4xl font-black">{{ dashboard.summary.readinessScore }}</div>
          </div>
          <div class="rounded-[24px] bg-white/10 p-5">
            <div class="text-xs font-bold uppercase tracking-[0.16em] text-white/70">{{ t('planner.activeTasks') }}</div>
            <div class="mt-3 text-4xl font-black">{{ dashboard.summary.activeTaskCount }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="feature-grid">
      <div class="stat-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.profile') }}</div>
        <div class="mt-3 text-3xl font-black text-slate-900">{{ dashboard.summary.profileCompleteness }}%</div>
      </div>
      <div class="stat-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.materials') }}</div>
        <div class="mt-3 text-3xl font-black text-slate-900">{{ dashboard.summary.materialCompletion }}%</div>
      </div>
      <div class="stat-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.visa') }}</div>
        <div class="mt-3 text-3xl font-black text-slate-900">{{ dashboard.summary.visaDoneCount }}/5</div>
      </div>
      <div class="stat-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.activeTasks') }}</div>
        <div class="mt-3 text-3xl font-black text-slate-900">{{ dashboard.tasks.length }}</div>
      </div>
    </div>

    <div class="section-card rounded-[28px] p-4 md:p-5">
      <div class="flex flex-wrap gap-3">
        <button v-for="item in tabs" :key="item.key" class="secondary-action" :class="{ 'primary-action': activeTab === item.key }" @click="activeTab = item.key">{{ item.label }}</button>
      </div>
    </div>

    <div v-if="activeTab === 'overview'" class="grid gap-6">
      <div class="section-card rounded-[28px] p-6 md:p-7">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('common.recommendations') }}</div>
        <h2 class="section-title mt-2">{{ t('planner.recommendationTitle') }}</h2>
        <div class="program-grid mt-6">
          <RouterLink v-for="item in dashboard.recommendations" :key="item.program.id" :to="`/programs/${item.program.slug}`" class="data-card rounded-[24px] p-5 card-hover">
            <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ item.program.code }}</div>
            <h3 class="mt-2 text-xl font-black text-slate-900">{{ text(item.program.name) }}</h3>
            <p class="mt-2 text-sm text-slate-500">{{ text(item.university.name) }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <span class="filter-chip">{{ t('common.score') }} {{ item.score }}</span>
              <span class="filter-chip">CNY {{ formatCurrency(item.annualCostCny) }}{{ t('common.perYear') }}</span>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'eligibility'" class="section-card rounded-[28px] p-6 md:p-7">
      <div class="grid gap-4 md:grid-cols-3">
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
          <span>{{ t('common.budget') }}</span>
          <input v-model.number="profile.budgetCny" type="number" />
        </label>
        <label class="field-shell">
          <span>{{ t('common.gpa') }}</span>
          <input v-model.number="profile.gpa" type="number" step="0.1" />
        </label>
        <label class="field-shell">
          <span>{{ t('common.ielts') }}</span>
          <input v-model.number="profile.ielts" type="number" step="0.5" />
        </label>
        <label class="field-shell">
          <span>{{ t('common.experience') }}</span>
          <input v-model="profile.experience" />
        </label>
      </div>
      <div class="mt-6 flex flex-wrap gap-3">
        <button class="primary-action" @click="planner.updateProfile(profile)">{{ t('planner.saveProfile') }}</button>
        <button class="secondary-action" @click="profile.acceptNoLanguage = !profile.acceptNoLanguage">
          {{ profile.acceptNoLanguage ? t('planner.disableConditional') : t('planner.enableConditional') }}
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'materials'" class="program-grid">
      <div v-for="item in dashboard.materials" :key="item.key" class="section-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ item.key }}</div>
        <h3 class="mt-2 text-xl font-black text-slate-900">{{ text(item.name as any) }}</h3>
        <p class="muted mt-3 text-sm">{{ text(item.note as any) }}</p>
        <div class="mt-5 flex flex-wrap gap-2">
          <button v-for="status in statuses" :key="status" class="secondary-action !rounded-full !px-4 !py-2 !text-sm" :class="{ 'primary-action': item.status === status }" @click="planner.updateMaterial(item.key, status)">{{ statusLabel(status) }}</button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'applications'" class="program-grid">
      <div v-for="item in dashboard.tasks" :key="item.id" class="section-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('planner.applicationTask') }}</div>
        <h3 class="mt-2 text-xl font-black text-slate-900">{{ text(item.tier as any) }}</h3>
        <p class="muted mt-3 text-sm">{{ text(item.nextAction as any) }}</p>
        <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-gradient-to-r from-purple-500 to-orange-500" :style="{ width: `${item.progress}%` }"></div>
        </div>
        <div class="mt-2 text-sm text-slate-500">{{ t('planner.progressNow') }} {{ item.progress }}%</div>
        <button class="primary-action mt-5" @click="planner.advanceTask(item.id)">{{ t('planner.advance') }}</button>
      </div>
    </div>

    <div v-if="activeTab === 'visa'" class="program-grid">
      <div v-for="item in visaKeys" :key="item.key" class="section-card rounded-[24px] p-5">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('planner.visaChecklist') }}</div>
        <h3 class="mt-2 text-xl font-black text-slate-900">{{ item.label }}</h3>
        <p class="mt-3 text-sm text-slate-500">{{ dashboard.visaChecklist[item.key] ? t('planner.done') : t('planner.pending') }}</p>
        <button class="primary-action mt-5" @click="planner.updateVisa({ [item.key]: !dashboard.visaChecklist[item.key] })">
          {{ dashboard.visaChecklist[item.key] ? t('planner.undoDone') : t('planner.markDone') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { PlannerProfile } from "@studymy/shared";
import { useLocaleText } from "../composables/useLocaleText";
import { usePlannerStore } from "../stores/planner";
import { useSessionStore } from "../stores/session";
import { formatCurrency } from "../utils/format";

const planner = usePlannerStore();
const session = useSessionStore();
const router = useRouter();
const { t } = useI18n();
const { text } = useLocaleText();
const activeTab = ref<"overview" | "eligibility" | "materials" | "applications" | "visa">("overview");
const statuses: Array<"draft" | "wait" | "progress" | "done"> = ["draft", "wait", "progress", "done"];
const tabs = computed(() => [
  { key: "overview", label: t('planner.tabs.overview') },
  { key: "eligibility", label: t('planner.tabs.eligibility') },
  { key: "materials", label: t('planner.tabs.materials') },
  { key: "applications", label: t('planner.tabs.applications') },
  { key: "visa", label: t('planner.tabs.visa') }
] as const);
const visaKeys = computed(() => [
  { key: "offerAccepted", label: t('planner.offerAccepted') },
  { key: "depositPaid", label: t('planner.depositPaid') },
  { key: "visaDocsReady", label: t('common.materials') },
  { key: "preDeparture", label: t('planner.preDeparture') },
  { key: "arrivalReady", label: t('planner.arrivalReady') }
] as const);
const levelOptions = computed(() => [
  { value: "bachelor", label: t('degree.bachelor') },
  { value: "master", label: t('degree.master') },
  { value: "phd", label: t('degree.phd') }
]);
const categoryOptions = computed(() => [
  { value: "business", label: t('category.business') },
  { value: "it", label: t('category.it') },
  { value: "engineering", label: t('category.engineering') },
  { value: "science", label: t('category.science') },
  { value: "arts", label: t('category.arts') },
  { value: "medicine", label: t('category.medicine') },
  { value: "law", label: t('category.law') }
]);

const dashboard = computed(() => planner.dashboard);
const profile = reactive<PlannerProfile>({ level: "master", targetCategory: "it", budgetCny: 80000, gpa: 3, ielts: 5.5, experience: "0-1 years", acceptNoLanguage: true });

onMounted(async () => {
  if (!session.isLoggedIn) {
    session.openAuth("login");
    router.push("/");
    return;
  }
  await planner.load();
});

watch(dashboard, (value) => {
  if (value) Object.assign(profile, value.profile);
}, { immediate: true });

function statusLabel(status: typeof statuses[number]) {
  return t(`status.${status}`);
}
</script>