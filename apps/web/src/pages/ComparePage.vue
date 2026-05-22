<template>
  <section class="grid gap-6">
    <div class="section-card rounded-[32px] p-6 md:p-8">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('nav.compare') }}</div>
          <h1 class="section-title mt-2">{{ t('comparePage.title') }}</h1>
        </div>
        <button class="secondary-action" @click="catalog.clearCompare">{{ t('comparePage.clear') }}</button>
      </div>
    </div>

    <div v-if="!compareUniversities.length" class="empty-state section-card rounded-[28px] p-8 text-center text-slate-500">
      {{ t('comparePage.empty') }}
    </div>

    <div v-else class="grid gap-6">
      <div class="compare-grid">
        <div v-for="item in compareUniversities" :key="item.id" class="compare-card rounded-[28px] p-6">
          <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ item.shortName }}</div>
          <h2 class="mt-2 text-2xl font-black leading-tight text-slate-900">{{ text(item.name) }}</h2>
          <div class="mt-4 flex flex-wrap gap-2">
            <span class="info-chip badge-contrast">QS #{{ item.qsRank }}</span>
            <span class="info-chip bg-slate-100 text-slate-700">{{ t(`ownership.${item.ownership}`) }}</span>
          </div>
          <div class="mt-5 grid gap-3 text-sm text-slate-600">
            <div>{{ t('common.location') }}: {{ text(item.location) }}</div>
            <div>{{ t('common.tuitionRange') }}: CNY {{ formatCurrency(item.tuitionMinCny) }} - CNY {{ formatCurrency(item.tuitionMaxCny) }}</div>
            <div>{{ t('comparePage.livingCost') }}: CNY {{ formatCurrency(item.livingCostCny) }}{{ t('common.perYear') }}</div>
            <div>{{ t('common.languageRequirement') }}: IELTS {{ item.minIelts }}+</div>
            <div>{{ t('common.programCount') }}: {{ item.programCount }}</div>
          </div>
          <p class="muted mt-5 text-sm">{{ text(item.description) }}</p>
          <div class="mt-5 flex flex-wrap gap-2">
            <span v-for="highlight in array(item.highlights).slice(0, 3)" :key="highlight" class="filter-chip">{{ highlight }}</span>
          </div>
        </div>
      </div>

      <div class="section-card rounded-[28px] overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse text-left text-sm">
            <thead class="bg-slate-50 text-slate-500">
              <tr>
                <th class="px-5 py-4 font-bold">{{ t('comparePage.dimension') }}</th>
                <th v-for="item in compareUniversities" :key="item.id" class="px-5 py-4 font-bold">{{ item.shortName }}</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-t border-slate-100">
                <td class="px-5 py-4 font-semibold text-slate-500">{{ t('common.foundedYear') }}</td>
                <td v-for="item in compareUniversities" :key="`${item.id}-founded`" class="px-5 py-4">{{ item.foundedYear }}</td>
              </tr>
              <tr class="border-t border-slate-100">
                <td class="px-5 py-4 font-semibold text-slate-500">{{ t('comparePage.region') }}</td>
                <td v-for="item in compareUniversities" :key="`${item.id}-region`" class="px-5 py-4">{{ text(item.region) }}</td>
              </tr>
              <tr class="border-t border-slate-100">
                <td class="px-5 py-4 font-semibold text-slate-500">{{ t('comparePage.admissionMode') }}</td>
                <td v-for="item in compareUniversities" :key="`${item.id}-lang`" class="px-5 py-4">{{ item.acceptNoLanguage ? t('comparePage.conditional') : t('comparePage.direct') }}</td>
              </tr>
              <tr class="border-t border-slate-100">
                <td class="px-5 py-4 font-semibold text-slate-500">{{ t('comparePage.website') }}</td>
                <td v-for="item in compareUniversities" :key="`${item.id}-site`" class="px-5 py-4">
                  <a :href="item.website" target="_blank" rel="noreferrer" class="font-semibold text-purple-700">{{ item.shortName }}</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { formatCurrency } from "../utils/format";

const catalog = useCatalogStore();
const { t } = useI18n();
const { text, array } = useLocaleText();
const compareUniversities = computed(() => catalog.universities.filter((item) => catalog.compareIds.includes(item.id)));
</script>