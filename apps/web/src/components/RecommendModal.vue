<template>
  <div class="modal-backdrop">
    <div class="modal-panel section-card">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{{ t('recommend.title') }}</div>
          <h3 class="mt-2 text-2xl font-black text-slate-900">{{ t('recommend.title') }}</h3>
        </div>
        <button class="ghost-action !rounded-full !px-4" @click="$emit('close')">{{ t('common.close') }}</button>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <label class="field-shell">
          <span>{{ t('recommend.level') }}</span>
          <select v-model="form.level">
            <option v-for="item in levelOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-shell">
          <span>{{ t('recommend.category') }}</span>
          <select v-model="form.targetCategory">
            <option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-shell">
          <span>{{ t('common.budget') }}</span>
          <input v-model.number="form.budgetCny" type="number" />
        </label>
        <label class="field-shell">
          <span>{{ t('common.gpa') }}</span>
          <input v-model.number="form.gpa" type="number" step="0.1" />
        </label>
        <label class="field-shell">
          <span>{{ t('common.ielts') }}</span>
          <input v-model.number="form.ielts" type="number" step="0.5" />
        </label>
        <label class="field-shell">
          <span>{{ t('recommend.acceptNoLanguage') }}</span>
          <select v-model="acceptNoLanguageText">
            <option value="yes">{{ t('common.yes') }}</option>
            <option value="no">{{ t('common.no') }}</option>
          </select>
        </label>
      </div>

      <button class="primary-action mt-6" @click="loadRecommendations">{{ t('recommend.start') }}</button>

      <div v-if="results.length" class="program-grid mt-6">
        <RouterLink v-for="item in results" :key="item.program.id" :to="`/programs/${item.program.slug}`" class="data-card rounded-[24px] p-5 card-hover" @click="$emit('close')">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ item.program.code }}</div>
              <h4 class="mt-2 text-xl font-black text-slate-900">{{ text(item.program.name) }}</h4>
            </div>
            <span class="info-chip badge-contrast">{{ item.score }}</span>
          </div>
          <p class="mt-2 text-sm text-slate-500">{{ text(item.university.name) }} · QS #{{ item.university.qsRank }}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <span class="filter-chip">CNY {{ formatCurrency(item.annualCostCny) }}{{ t('common.perYear') }}</span>
            <span class="filter-chip">IELTS {{ item.program.languageRequirement.ielts }}+</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import type { RecommendationResult } from "@studymy/shared";
import { apiFetch } from "../api/client";
import { useLocaleText } from "../composables/useLocaleText";
import { formatCurrency } from "../utils/format";

const { t } = useI18n();
const { text } = useLocaleText();
const results = ref<RecommendationResult[]>([]);
const form = reactive({
  level: "master",
  targetCategory: "it",
  budgetCny: 80000,
  gpa: 3,
  ielts: 5.5,
  acceptNoLanguage: true
});

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

const acceptNoLanguageText = computed({
  get: () => (form.acceptNoLanguage ? 'yes' : 'no'),
  set: (value: string) => {
    form.acceptNoLanguage = value === 'yes';
  }
});

async function loadRecommendations() {
  const query = new URLSearchParams({
    level: form.level,
    targetCategory: form.targetCategory,
    budgetCny: String(form.budgetCny),
    gpa: String(form.gpa),
    ielts: String(form.ielts),
    acceptNoLanguage: String(form.acceptNoLanguage)
  });
  results.value = await apiFetch<RecommendationResult[]>(`/programs/recommendations?${query.toString()}`);
}
</script>
