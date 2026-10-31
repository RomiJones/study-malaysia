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
            <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('university.officialTuition') }}</div>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-3xl font-black text-slate-900">
              <span>{{ tuitionLabel }}</span>
              <span v-if="catalog.programDetail && hasVerifiedProgramFee(catalog.programDetail)" class="fee-verified-badge">
                {{ formatProgramFeeVerifiedLabel(currentLocale) }}
              </span>
            </div>
            <p v-if="tuitionNote" class="mt-3 text-sm leading-6 text-slate-600">{{ tuitionNote }}</p>
          </div>
          <div class="stat-card rounded-[24px] p-5">
            <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.faculty') }}</div>
            <div class="mt-3 text-lg font-bold text-slate-900">{{ text(catalog.programDetail.faculty) }}</div>
          </div>
          <div v-if="programApplicationReady" class="flex flex-wrap gap-3">
            <button class="primary-action" @click="addProgramToPlanner">{{ t('program.addToPlanner') }}</button>
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
          <div v-if="officialLanguageDetail">{{ t('program.officialLanguageRequirement') }}: {{ officialLanguageDetail }}</div>
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

  <section v-else class="container detail-loading">
    <div class="section-card empty-state" :class="{ 'empty-state--warning': catalog.errorMessage && !catalog.loading }">
      {{ catalog.loading ? t("common.loading") : catalog.errorMessage || t("common.noData") }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useCatalogStore } from "../stores/catalog";
import { usePlannerStore } from "../stores/planner";
import { useLocaleText } from "../composables/useLocaleText";
import {
  cleanDisplayText,
  formatCategoryLabel,
  officialConfirmationFallback,
  officialPageFallback,
  formatProgramDuration,
  formatProgramIntake,
  formatProgramLanguage,
  formatProgramFeeVerifiedLabel,
  formatProgramTuition,
  hasVerifiedProgramFee
} from "../utils/format";

type ReviewPreview = "msu" | "luc";

const props = defineProps<{ slug: string }>();
const catalog = useCatalogStore();
const planner = usePlannerStore();
const route = useRoute();
const { t } = useI18n();
const { currentLocale, text, array } = useLocaleText();
const reviewPreview = computed<ReviewPreview | undefined>(() => {
  if (route.query.review === "msu") return "msu";
  if (route.query.review === "luc") return "luc";
  if (props.slug.startsWith("luc-official-20260630-row-")) return "luc";
  if (props.slug.startsWith("luc-postgraduate-20260705-row-")) return "luc";
  return undefined;
});
const programApplicationReady = computed(() => {
  const program = catalog.programDetail;
  return Boolean(program && program.publicDisplayStatus === "ready" && !isReviewPreviewProgram(program));
});

const levelLabel = computed(() => catalog.programDetail ? t(`degree.${catalog.programDetail.level}`) : "");
const categoryLabel = computed(() => catalog.programDetail ? formatCategoryLabel(catalog.programDetail.category, currentLocale.value) : "");
const durationLabel = computed(() => catalog.programDetail ? formatProgramDuration(catalog.programDetail, currentLocale.value) : officialConfirmationFallback(currentLocale.value));
const languageLabel = computed(() => catalog.programDetail ? formatProgramLanguage(catalog.programDetail, undefined, currentLocale.value) : officialPageFallback(currentLocale.value));
const tuitionLabel = computed(() => catalog.programDetail ? formatProgramTuition(catalog.programDetail, undefined, currentLocale.value) : officialPageFallback(currentLocale.value));
const tuitionNote = computed(() => {
  const program = catalog.programDetail;
  if (!program || program.officialFeeAuditStatus !== "calculated-from-official-rate") return "";
  const match = String(program.tuitionInfo?.note || "").match(
    /calculated the standard full-time tuition as (USD|MYR) ([\d,]+(?:\.\d+)?) per semester × (\d+) official minimum semesters = (?:USD|MYR) ([\d,]+(?:\.\d+)?).*part-time rate: (?:USD|MYR) ([\d,]+(?:\.\d+)?) per semester/i
  );
  if (!match) return "";
  return t("program.calculatedTotalTuitionNote", {
    currency: match[1].toUpperCase(),
    fullTime: match[2],
    semesters: match[3],
    total: match[4],
    partTime: match[5]
  });
});
const intakeLabel = computed(() => catalog.programDetail ? formatProgramIntake(catalog.programDetail, undefined, currentLocale.value) : officialPageFallback(currentLocale.value));
const gpaLabel = computed(() => {
  const gpa = Number(catalog.programDetail?.requirement?.gpa);
  return Number.isFinite(gpa) && gpa > 0 ? `${gpa}+` : officialConfirmationFallback(currentLocale.value);
});
const requirementNote = computed(() => catalog.programDetail
  ? cleanDisplayText(text(catalog.programDetail.requirement.note), officialPageFallback(currentLocale.value), currentLocale.value)
  : officialPageFallback(currentLocale.value));
const officialLanguageDetail = computed(() => catalog.programDetail
  ? cleanDisplayText(catalog.programDetail.officialLanguageRequirement, "", currentLocale.value)
  : "");
const documentRows = computed(() => {
  const rows = catalog.programDetail ? array(catalog.programDetail.applicationDocs).filter(Boolean) : [];
  return rows.length ? rows : [officialPageFallback(currentLocale.value)];
});
const curriculumRows = computed(() => {
  const rows = catalog.programDetail ? array(catalog.programDetail.curriculum).filter(Boolean) : [];
  return rows.length ? rows : [officialConfirmationFallback(currentLocale.value)];
});
const careerRows = computed(() => {
  const rows = catalog.programDetail ? array(catalog.programDetail.careers).filter(Boolean) : [];
  return rows.length ? rows : [officialConfirmationFallback(currentLocale.value)];
});
const specializationRows = computed(() => {
  const rows = catalog.programDetail ? array(catalog.programDetail.specializations).filter(Boolean) : [];
  return rows.length ? rows : [officialConfirmationFallback(currentLocale.value)];
});

function loadDetail() {
  void catalog.loadProgram(props.slug, reviewPreview.value ? { review: reviewPreview.value } : {}).catch(() => undefined);
}

function isReviewPreviewProgram(program: NonNullable<typeof catalog.programDetail>) {
  return Boolean((program as typeof catalog.programDetail & { reviewPreview?: unknown }).reviewPreview) ||
    program.slug.startsWith("luc-official-20260630-row-") ||
    program.slug.startsWith("luc-postgraduate-20260705-row-") ||
    program.slug.startsWith("msu-review-");
}

function addProgramToPlanner() {
  if (!catalog.programDetail || !programApplicationReady.value) return;
  void planner.addTask(catalog.programDetail.university.id, catalog.programDetail.id);
}

onMounted(loadDetail);

watch(() => [props.slug, route.query.review], loadDetail);
</script>
