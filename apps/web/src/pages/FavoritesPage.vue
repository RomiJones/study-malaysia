<template>
  <section class="grid gap-6">
    <div class="section-card rounded-[32px] p-6 md:p-8">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('nav.favorites') }}</div>
          <h1 class="section-title mt-2">{{ t('favorites.title') }}</h1>
        </div>
        <div class="text-sm text-slate-500">{{ t('favorites.summary', { universities: favoriteUniversities.length, programs: favoritePrograms.length }) }}</div>
      </div>
    </div>

    <div v-if="!favoriteUniversities.length && !favoritePrograms.length" class="empty-state section-card rounded-[28px] p-8 text-center text-slate-500">
      {{ t('favorites.empty') }}
    </div>

    <template v-else>
      <div v-if="favoriteUniversities.length" class="grid gap-4">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('favorites.universities') }}</div>
        <div class="university-grid">
          <UniversityCard v-for="item in favoriteUniversities" :key="item.id" :university="item" />
        </div>
      </div>

      <div v-if="favoritePrograms.length" class="grid gap-4">
        <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('favorites.programs') }}</div>
        <div class="program-grid">
          <RouterLink v-for="item in favoritePrograms" :key="item.id" :to="`/programs/${item.slug}`" class="data-card rounded-[24px] p-5 card-hover">
            <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ item.code }}</div>
            <h3 class="mt-2 text-xl font-black text-slate-900">{{ text(item.name) }}</h3>
            <p class="mt-2 text-sm text-slate-500">{{ text(item.faculty) }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <span class="filter-chip">CNY {{ formatCurrency(item.annualTuitionCny) }}{{ t('common.perYear') }}</span>
              <span class="filter-chip">IELTS {{ item.languageRequirement.ielts }}+</span>
            </div>
          </RouterLink>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import UniversityCard from "../components/UniversityCard.vue";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { formatCurrency } from "../utils/format";

const catalog = useCatalogStore();
const { t } = useI18n();
const { text } = useLocaleText();

const favoriteUniversities = computed(() => catalog.universities.filter((item) => catalog.favoriteState.universities.includes(item.id)));
const favoritePrograms = computed(() => catalog.programs.filter((item) => catalog.favoriteState.programs.includes(item.id)));
</script>