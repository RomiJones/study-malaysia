<template>
  <section v-if="catalog.programDetail" class="grid gap-6">
    <div class="section-card rounded-[32px] p-6 md:p-8">
      <div class="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ catalog.programDetail.code }}</div>
          <h1 class="mt-3 text-3xl font-black leading-tight text-slate-900 md:text-4xl">{{ text(catalog.programDetail.name) }}</h1>
          <p class="mt-4 text-lg font-semibold text-purple-700">{{ text(catalog.programDetail.university.name) }}</p>
          <p class="muted mt-4 text-sm md:text-base">{{ text(catalog.programDetail.description) }}</p>
          <div class="mt-5 flex flex-wrap gap-2">
            <span class="filter-chip active">{{ levelLabel }}</span>
            <span class="filter-chip">{{ categoryLabel }}</span>
            <span class="filter-chip">{{ durationLabel }}</span>
            <span class="filter-chip">{{ languageLabel }}</span>
          </div>
          <p v-if="planner.syncMessage" class="inline-alert mt-5">{{ planner.syncMessage }}</p>
        </div>

        <div class="grid gap-4">
          <div class="stat-card rounded-[24px] p-5">
            <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.annualTuition') }}</div>
            <div class="mt-3 text-3xl font-black text-slate-900">{{ tuitionLabel }}</div>
          </div>
          <div class="stat-card rounded-[24px] p-5">
            <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.faculty') }}</div>
            <div class="mt-3 text-lg font-bold text-slate-900">{{ text(catalog.programDetail.faculty) }}</div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button class="primary-action" @click="planner.addTask(catalog.programDetail.university.id, catalog.programDetail.id)">{{ t('program.addToPlanner') }}</button>
            <button class="secondary-action" @click="catalog.toggleFavoriteProgram(catalog.programDetail.id)">{{ t('program.favoriteProgram') }}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="overview-grid">
      <div class="section-card rounded-[28px] p-6">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('program.requirementsTitle') }}</div>
        <h2 class="section-title mt-2">{{ t('program.requirementsTitle') }}</h2>
        <div class="mt-5 grid gap-4 text-sm leading-7 text-slate-600">
          <div>{{ t('common.languageRequirement') }}: {{ languageLabel }}</div>
          <div>{{ t('program.suggestedGpa') }}: {{ gpaLabel }}</div>
          <div>{{ requirementNote }}</div>
          <div>{{ t('program.startMonth') }}: {{ intakeLabel }}</div>
        </div>
      </div>
      <div class="section-card rounded-[28px] p-6">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('program.documentsTitle') }}</div>
        <h2 class="section-title mt-2">{{ t('program.documentsTitle') }}</h2>
        <ul class="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
          <li v-for="item in documentRows" :key="item">{{ item }}</li>
        </ul>
      </div>
    </div>

    <div class="overview-grid">
      <div class="section-card rounded-[28px] p-6">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('program.curriculumTitle') }}</div>
        <h2 class="section-title mt-2">{{ t('program.curriculumTitle') }}</h2>
        <ul class="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
          <li v-for="item in curriculumRows" :key="item">{{ item }}</li>
        </ul>
      </div>
      <div class="section-card rounded-[28px] p-6">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('program.careersTitle') }}</div>
        <h2 class="section-title mt-2">{{ t('program.careersTitle') }}</h2>
        <ul class="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
          <li v-for="item in careerRows" :key="item">{{ item }}</li>
        </ul>
        <div class="mt-5 flex flex-wrap gap-2">
          <span v-for="item in specializationRows" :key="item" class="filter-chip">{{ item }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useCatalogStore } from "../stores/catalog";
import { usePlannerStore } from "../stores/planner";
import { useLocaleText } from "../composables/useLocaleText";
import {
  OFFICIAL_CONFIRMATION_FALLBACK,
  OFFICIAL_PAGE_FALLBACK,
  cleanDisplayText,
  formatProgramDuration,
  formatProgramIntake,
  formatProgramLanguage,
  formatProgramTuition
} from "../utils/format";

const props = defineProps<{ slug: string }>();
const catalog = useCatalogStore();
const planner = usePlannerStore();
const { t } = useI18n();
const { text, array } = useLocaleText();

const levelLabel = computed(() => catalog.programDetail ? t(`degree.${catalog.programDetail.level}`) : "");
const categoryLabel = computed(() => catalog.programDetail ? t(`category.${catalog.programDetail.category}`) : "");
const durationLabel = computed(() => catalog.programDetail ? formatProgramDuration(catalog.programDetail) : OFFICIAL_CONFIRMATION_FALLBACK);
const languageLabel = computed(() => catalog.programDetail ? formatProgramLanguage(catalog.programDetail) : OFFICIAL_PAGE_FALLBACK);
const tuitionLabel = computed(() => catalog.programDetail ? formatProgramTuition(catalog.programDetail) : OFFICIAL_PAGE_FALLBACK);
const intakeLabel = computed(() => catalog.programDetail ? formatProgramIntake(catalog.programDetail) : OFFICIAL_PAGE_FALLBACK);
const gpaLabel = computed(() => {
  const gpa = Number(catalog.programDetail?.requirement?.gpa);
  return Number.isFinite(gpa) && gpa > 0 ? `${gpa}+` : OFFICIAL_CONFIRMATION_FALLBACK;
});
const requirementNote = computed(() => catalog.programDetail
  ? cleanDisplayText(text(catalog.programDetail.requirement.note), OFFICIAL_PAGE_FALLBACK)
  : OFFICIAL_PAGE_FALLBACK);
const documentRows = computed(() => {
  const rows = catalog.programDetail ? array(catalog.programDetail.applicationDocs).filter(Boolean) : [];
  return rows.length ? rows : [OFFICIAL_PAGE_FALLBACK];
});
const curriculumRows = computed(() => {
  const rows = catalog.programDetail ? array(catalog.programDetail.curriculum).filter(Boolean) : [];
  return rows.length ? rows : [OFFICIAL_CONFIRMATION_FALLBACK];
});
const careerRows = computed(() => {
  const rows = catalog.programDetail ? array(catalog.programDetail.careers).filter(Boolean) : [];
  return rows.length ? rows : [OFFICIAL_CONFIRMATION_FALLBACK];
});
const specializationRows = computed(() => {
  const rows = catalog.programDetail ? array(catalog.programDetail.specializations).filter(Boolean) : [];
  return rows.length ? rows : [OFFICIAL_CONFIRMATION_FALLBACK];
});

onMounted(() => catalog.loadProgram(props.slug));
</script>
