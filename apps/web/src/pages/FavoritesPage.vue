<template>
  <section class="favorites-page">
    <div class="section-card favorites-head">
      <div class="favorites-head__row">
        <div>
          <div class="section-kicker">{{ t('nav.favorites') }}</div>
          <h1 class="section-title">{{ t('favorites.title') }}</h1>
        </div>
        <div class="favorites-summary">{{ t('favorites.summary', { universities: favoriteUniversities.length, programs: favoritePrograms.length }) }}</div>
      </div>
    </div>

    <div v-if="catalog.syncLoading" class="inline-alert">{{ t('common.loading') }}</div>
    <div v-if="catalog.syncError" class="inline-alert inline-alert--error">{{ catalog.syncError }}</div>

    <div v-if="!favoriteUniversities.length && !favoritePrograms.length" class="fav-empty section-card">
      <div class="fav-empty-icon">藏</div>
      <strong>{{ t('favorites.empty') }}</strong>
      <RouterLink class="btn btn-gold" to="/">{{ t('home.browseUniversities') }}</RouterLink>
    </div>

    <template v-else>
      <div v-if="favoriteUniversities.length" class="favorites-section">
        <div class="section-kicker">{{ t('favorites.universities') }}</div>
        <div class="favorite-university-grid">
          <article v-for="item in favoriteUniversities" :key="item.id" class="favorite-university-card">
            <div class="favorite-university-card__top">
              <img class="favorite-university-card__logo" :src="item.logoUrl" :alt="text(item.name)" />
              <div class="favorite-university-card__copy">
                <h3>{{ text(item.name) }}</h3>
                <p>QS #{{ item.qsRank }} · {{ text(item.location) }}</p>
              </div>
            </div>
            <div class="favorite-university-card__actions">
              <RouterLink class="btn btn-primary btn-sm" :to="`/universities/${item.slug}`">{{ t('common.viewDetails') }}</RouterLink>
              <button class="btn btn-outline btn-sm favorite-remove" type="button" @click="catalog.toggleFavoriteUniversity(item.id)">移除</button>
            </div>
          </article>
        </div>
      </div>

      <div v-if="favoritePrograms.length" class="favorites-section">
        <div class="section-kicker">{{ t('favorites.programs') }}</div>
        <div class="favorite-program-grid">
          <article v-for="item in favoritePrograms" :key="item.id" class="favorite-program-card">
            <RouterLink :to="`/programs/${item.slug}`">
              <div class="section-kicker">{{ item.code }}</div>
              <h3>{{ text(item.name) }}</h3>
              <p>{{ text(item.faculty) }}</p>
              <div class="favorite-program-card__chips">
                <span class="chip chip-ink">CNY {{ formatCurrency(item.annualTuitionCny) }}{{ t('common.perYear') }}</span>
                <span class="chip chip-teal">IELTS {{ item.languageRequirement.ielts }}+</span>
              </div>
            </RouterLink>
            <div class="favorite-program-card__actions">
              <button class="btn btn-outline" type="button" @click="catalog.toggleFavoriteProgram(item.id)">移除收藏</button>
            </div>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { formatCurrency } from "../utils/format";

const catalog = useCatalogStore();
const { t } = useI18n();
const { text } = useLocaleText();

const favoriteUniversities = computed(() => catalog.universities.filter((item) => catalog.favoriteState.universities.includes(item.id)));
const favoritePrograms = computed(() => catalog.programs.filter((item) => catalog.favoriteState.programs.includes(item.id)));

onMounted(async () => {
  if (!catalog.universities.length || !catalog.programs.length) await catalog.loadUniversities();
});
</script>
