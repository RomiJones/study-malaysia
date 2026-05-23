<template>
  <article class="university-card">
    <div class="university-card__media">
      <img
        v-if="university.imageUrl && !hasImageError"
        :src="university.imageUrl"
        :alt="text(university.name)"
        class="university-card__image"
        @error="handleMediaError"
      />
      <div v-else class="university-card__image university-card__image--placeholder" aria-hidden="true"></div>
      <div class="university-card__overlay"></div>
      <div class="university-card__badges">
        <span class="info-chip info-chip--light">QS #{{ university.qsRank }}</span>
      </div>
    </div>

    <div class="university-card__body">
      <div class="university-card__top">
        <div class="university-card__identity">
          <div v-if="university.logoUrl && !hasLogoError" class="university-card__logo-wrap">
            <img :src="university.logoUrl" :alt="university.shortName" class="university-card__logo" @error="hideBrokenLogo" />
          </div>
          <div class="university-card__info">
            <div class="university-card__code">{{ university.shortName }} / {{ university.code }}</div>
            <div class="university-card__meta-row">
              <span class="info-chip info-chip--blue">{{ t(`ownership.${university.ownership}`) }}</span>
              <span class="university-card__meta-dot">{{ text(university.location) }} · {{ t('common.foundedYear') }} {{ university.foundedYear }}</span>
            </div>
            <h3 class="university-card__title" @click="router.push(`/universities/${university.slug}`)">{{ text(university.name) }}</h3>
            <p class="university-card__subtitle">{{ university.nameEn }}</p>
            <p class="university-card__description">{{ text(university.description) }}</p>
          </div>
        </div>
      </div>

      <div class="university-card__meta">
        <span class="info-chip">Asia #{{ university.qsAsiaRank ?? '--' }}</span>
        <span v-if="university.acceptNoLanguage" class="info-chip info-chip--accent">{{ t('common.noLanguageApply') }}</span>
        <span v-if="university.csrCertified" class="info-chip info-chip--success">{{ t('common.certified') }}</span>
        <span class="info-chip">IELTS {{ university.minIelts }}+</span>
      </div>

      <div class="university-card__metrics">
        <div class="university-metric">
          <div class="university-metric__label">{{ t('common.annualTuition') }}</div>
          <div class="university-metric__value">{{ tuitionDisplay }}</div>
        </div>
        <div class="university-metric">
          <div class="university-metric__label">{{ t('common.minIelts') }}</div>
          <div class="university-metric__value">{{ university.minIelts }}</div>
        </div>
        <div class="university-metric">
          <div class="university-metric__label">{{ t('common.programCount') }}</div>
          <div class="university-metric__value">{{ university.programCount }}</div>
        </div>
        <div class="university-metric">
          <div class="university-metric__label">{{ t('common.intlStudents') }}</div>
          <div class="university-metric__value">{{ shortNumber(university.intlStudents) }}</div>
        </div>
      </div>

      <div v-if="topPrograms.length" class="university-card__programs">
        <button
          v-for="program in topPrograms"
          :key="program.id"
          class="program-chip"
          @click="router.push({ path: `/universities/${university.slug}`, query: { program: String(program.id) } })"
        >
          {{ text(program.name) }}
        </button>
        <span v-if="relatedPrograms.length > topPrograms.length" class="program-chip program-chip--count">+{{ relatedPrograms.length - topPrograms.length }}</span>
      </div>

      <div class="university-card__footer">
        <div class="university-card__highlights">
          <span>{{ t('common.officialSource') }}：{{ sourceStatusLabel }}</span>
          <span v-for="highlight in array(university.highlights).slice(0, 2)" :key="highlight">{{ highlight }}</span>
        </div>
        <div class="university-card__right">
          <div class="university-card__tuition">
            <strong>{{ tuitionDisplay }}</strong>
            <span>{{ t('common.annualTuition') }}</span>
          </div>
          <div class="university-card__actions">
            <button class="icon-action" :aria-label="t('common.favorite')" @click.stop="catalog.toggleFavoriteUniversity(university.id)">
              {{ catalog.favoriteState.universities.includes(university.id) ? "♥" : "♡" }}
            </button>
            <button class="icon-action" :class="{ active: catalog.compareIds.includes(university.id) }" :aria-label="t('common.compare')" @click.stop="catalog.toggleCompare(university.id)">
              ⛶
            </button>
          </div>
          <RouterLink class="primary-action" :to="`/universities/${university.slug}`">{{ t('common.viewDetails') }}</RouterLink>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DegreeLevel, ProgramListItem, UniversityListItem } from "@studymy/shared";
import { RouterLink, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { formatOfficialSourceStatus, officialPageFallback } from "../utils/format";

const props = defineProps<{ university: UniversityListItem }>();
const catalog = useCatalogStore();
const router = useRouter();
const { t } = useI18n();
const { currentLocale, text, array } = useLocaleText();
const university = props.university;

const levelOrder: Record<DegreeLevel, number> = {
  bachelor: 0,
  master: 1,
  phd: 2
};

const categoryOrder: Record<string, number> = {
  business: 0,
  it: 1,
  engineering: 2,
  science: 3,
  medicine: 4,
  arts: 5,
  law: 6
};

const relatedPrograms = computed(() =>
  [...catalog.programs.filter((program) => program.universityId === university.id)].sort(comparePrograms)
);
const topPrograms = computed(() => relatedPrograms.value.slice(0, 4));
const tuitionDisplay = computed(() => university.tuitionMinCny > 0 ? `CNY ${shortPrice(university.tuitionMinCny)}+` : officialPageFallback(currentLocale.value));
const sourceStatusLabel = computed(() => formatOfficialSourceStatus(university.officialSourceStatus, currentLocale.value));
const hasImageError = ref(false);
const hasLogoError = ref(false);

watch(
  () => [university.imageUrl, university.logoUrl],
  () => {
    hasImageError.value = false;
    hasLogoError.value = false;
  }
);

function comparePrograms(a: ProgramListItem, b: ProgramListItem) {
  const levelDiff = levelOrder[a.level] - levelOrder[b.level];
  if (levelDiff !== 0) return levelDiff;

  const categoryDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
  if (categoryDiff !== 0) return categoryDiff;

  return a.nameEn.localeCompare(b.nameEn);
}

function shortPrice(value: number) {
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

function shortNumber(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}k+`;
  return `${value}+`;
}

function handleMediaError() {
  hasImageError.value = true;
}

function hideBrokenLogo() {
  hasLogoError.value = true;
}
</script>
