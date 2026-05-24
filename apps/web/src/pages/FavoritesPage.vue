<template>
  <section class="favorites-page">
    <div class="favorites-head">
      <div class="favorites-head__row">
        <h1 class="section-title">{{ t('favorites.title') }}</h1>
        <div class="favorites-summary">{{ t('favorites.summary', { universities: favoriteUniversities.length, programs: favoritePrograms.length }) }}</div>
      </div>
    </div>

    <div v-if="catalog.syncLoading" class="inline-alert">{{ t('common.loading') }}</div>
    <div v-if="catalog.syncError" class="inline-alert inline-alert--error">{{ catalog.syncError }}</div>

    <div v-if="!favoriteUniversities.length && !favoritePrograms.length" class="fav-empty section-card">
      <div class="fav-empty-icon" aria-hidden="true">
        <span class="ui-icon ui-icon--heart-filled"></span>
      </div>
      <strong>{{ t('favorites.empty') }}</strong>
      <span>{{ session.isLoggedIn ? t('favorites.emptyAccount') : t('favorites.emptyGuest') }}</span>
      <RouterLink class="btn btn-gold" to="/">{{ t('home.browseUniversities') }}</RouterLink>
    </div>

    <template v-else>
      <div v-if="favoriteUniversities.length" class="favorites-section">
        <h2 class="favorites-section-title">
          {{ t('favorites.universities') }}
          <span>{{ favoriteUniversities.length }}</span>
        </h2>
        <div class="favorite-university-grid">
          <article v-for="item in favoriteUniversities" :key="item.id" class="favorite-university-card">
            <div class="favorite-university-card__top">
              <img
                v-if="item.logoUrl && !brokenLogoIds.has(item.id)"
                class="favorite-university-card__logo"
                :src="item.logoUrl"
                :alt="text(item.name)"
                @error="markBrokenLogo(item.id)"
              />
              <div v-else class="favorite-university-card__logo favorite-university-card__logo--fallback" aria-hidden="true">
                {{ item.shortName.slice(0, 3) }}
              </div>
              <div class="favorite-university-card__copy">
                <h3>{{ text(item.name) }}</h3>
                <p>QS #{{ item.qsRank }} · {{ text(item.location) }}</p>
              </div>
            </div>
            <div class="favorite-university-card__actions">
              <RouterLink class="btn btn-primary btn-sm" :to="`/universities/${item.slug}`">{{ t('common.viewDetails') }}</RouterLink>
              <button class="btn btn-outline btn-sm favorite-remove" type="button" @click="catalog.toggleFavoriteUniversity(item.id)">{{ t('common.remove') }}</button>
            </div>
          </article>
        </div>
      </div>

      <div v-if="favoritePrograms.length" class="favorites-section">
        <h2 class="favorites-section-title">
          {{ t('favorites.programs') }}
          <span>{{ favoritePrograms.length }}</span>
        </h2>
        <div class="favorite-program-grid">
          <article v-for="item in favoritePrograms" :key="item.id" class="favorite-program-card">
            <div class="favorite-program-card__body">
              <div class="section-kicker">{{ item.code }}</div>
              <h3>{{ text(item.name) }}</h3>
              <p>{{ text(item.faculty) }}</p>
              <div class="favorite-program-card__chips">
                <span class="chip chip-ink">CNY {{ formatCurrency(item.annualTuitionCny) }}{{ t('common.perYear') }}</span>
                <span class="chip chip-teal">IELTS {{ item.languageRequirement.ielts }}+</span>
              </div>
            </div>
            <div class="favorite-program-card__actions">
              <RouterLink class="btn btn-primary" :to="`/programs/${item.slug}`">{{ t('common.viewDetails') }}</RouterLink>
              <button class="btn btn-outline favorite-remove" type="button" @click="catalog.toggleFavoriteProgram(item.id)">{{ t('common.remove') }}</button>
            </div>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { useSessionStore } from "../stores/session";
import { formatCurrency } from "../utils/format";

const catalog = useCatalogStore();
const session = useSessionStore();
const { t } = useI18n();
const { text } = useLocaleText();
const brokenLogoIds = ref(new Set<number>());

const favoriteUniversities = computed(() => catalog.universities.filter((item) => catalog.favoriteState.universities.includes(item.id)));
const favoritePrograms = computed(() => catalog.programs.filter((item) => catalog.favoriteState.programs.includes(item.id)));

onMounted(async () => {
  if (!catalog.universities.length || !catalog.programs.length) await catalog.loadUniversities().catch(() => undefined);
});

function markBrokenLogo(id: number) {
  brokenLogoIds.value = new Set([...brokenLogoIds.value, id]);
}
</script>
