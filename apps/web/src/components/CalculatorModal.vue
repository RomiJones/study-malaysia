<template>
  <div class="modal-backdrop">
    <div class="modal-panel section-card">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{{ t('calculator.title') }}</div>
          <h3 class="mt-2 text-2xl font-black text-slate-900">{{ t('calculator.title') }}</h3>
        </div>
        <button class="ghost-action !rounded-full !px-4" @click="$emit('close')">{{ t('common.close') }}</button>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-2">
        <label class="field-shell">
          <span>{{ t('calculator.school') }}</span>
          <select v-model.number="selectedUniversityId" @change="resetProgram">
            <option :value="0">{{ t('common.select') }}</option>
            <option v-for="item in catalog.universities" :key="item.id" :value="item.id">{{ text(item.name) }}</option>
          </select>
        </label>
        <label class="field-shell">
          <span>{{ t('calculator.program') }}</span>
          <select v-model.number="selectedProgramId">
            <option :value="0">{{ t('common.select') }}</option>
            <option v-for="item in availablePrograms" :key="item.id" :value="item.id">{{ text(item.name) }}</option>
          </select>
        </label>
      </div>

      <button class="primary-action mt-6" @click="loadEstimate">{{ t('calculator.start') }}</button>

      <div v-if="estimate" class="mt-6 grid gap-4 md:grid-cols-3">
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('calculator.duration') }}</div>
          <div class="mt-3 text-3xl font-black text-slate-900">{{ estimate.durationYears }} {{ t('calculator.years') }}</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('calculator.tuition') }}</div>
          <div class="mt-3 text-3xl font-black text-slate-900">CNY {{ formatCurrency(estimate.tuitionTotal) }}</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('calculator.total') }}</div>
          <div class="mt-3 text-3xl font-black text-slate-900">CNY {{ formatCurrency(estimate.grandTotal) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { apiFetch } from "../api/client";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { formatCurrency } from "../utils/format";

const catalog = useCatalogStore();
const { t } = useI18n();
const { text } = useLocaleText();
const selectedUniversityId = ref(0);
const selectedProgramId = ref(0);
const estimate = ref<any>(null);

const availablePrograms = computed(() => catalog.universityDetail?.id === selectedUniversityId.value
  ? catalog.universityDetail.programs
  : []);

async function resetProgram() {
  selectedProgramId.value = 0;
  estimate.value = null;
  const target = catalog.universities.find((item) => item.id === selectedUniversityId.value);
  if (target) {
    await catalog.loadUniversity(target.slug);
  }
}

async function loadEstimate() {
  if (!selectedProgramId.value) return;
  estimate.value = await apiFetch(`/programs/cost-estimate/${selectedProgramId.value}`);
}
</script>