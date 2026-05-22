<template>
  <section class="home-page">
    <section class="hero-panel">
      <div class="hero-noise"></div>
      <div class="hero-dots"></div>
      <div class="hero-glow"></div>

      <div class="hero-panel__content">
        <div class="hero-panel__main">
          <div class="eyebrow-pill">{{ t('home.badge', { count: catalog.homeMeta?.stats.universityCount ?? 0 }) }}</div>
          <h1 class="hero-title">
            {{ t('home.title') }}
            <span class="hero-accent">{{ t('home.accent') }}</span>
          </h1>
          <p class="hero-description">{{ t('home.subtitle') }}</p>

          <div class="search-wrap">
            <div class="search-inner">
              <span class="search-icon">⌕</span>
              <input
                v-model="catalog.search"
                class="search-input"
                :placeholder="t('home.searchLead')"
                @keydown.enter="scrollToCatalog"
              />
              <button class="search-btn" @click="scrollToCatalog">{{ t('common.searchAction') }}</button>
            </div>
          </div>

          <div class="quick-picks">
            <span class="quick-picks__label">{{ t('home.quickPick') }}</span>
            <button v-for="tag in quickTags" :key="`${tag.type}-${tag.value}`" class="tag-pill" @click="applyQuickTag(tag)">
              {{ tag.label }}
            </button>
          </div>

          <div class="hero-metrics">
            <article class="hero-metric-card">
              <div class="hero-metric-card__value">{{ catalog.homeMeta?.stats.universityCount ?? 0 }}</div>
              <div class="hero-metric-card__label">{{ t('home.statsUniversities') }}</div>
            </article>
            <article class="hero-metric-card">
              <div class="hero-metric-card__value">{{ catalog.homeMeta?.stats.programCount ?? 0 }}</div>
              <div class="hero-metric-card__label">{{ t('home.statsPrograms') }}</div>
            </article>
            <article class="hero-metric-card">
              <div class="hero-metric-card__value">QS {{ catalog.homeMeta?.stats.bestQsRank ?? '--' }}</div>
              <div class="hero-metric-card__label">{{ t('home.statsBestRank') }}</div>
            </article>
            <article class="hero-metric-card">
              <div class="hero-metric-card__value">{{ t('common.official') }}</div>
              <div class="hero-metric-card__label">{{ t('home.statsSource') }}</div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section class="home-layout" ref="catalogSectionRef">
      <aside class="filter-panel section-card">
        <div class="filter-panel__header">
          <div class="filter-panel__title">
            <span class="filter-panel__icon">F</span>
            <span>{{ t('home.filtersTitle') }}</span>
          </div>
          <button class="ghost-action" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>

        <div class="filter-stack">
          <div class="field-shell">
            <span>{{ t('home.ownership') }}</span>
            <div class="chip-row">
              <button class="filter-chip" :class="{ active: ownership === 'public' }" @click="ownership = ownership === 'public' ? '' : 'public'">
                {{ t('ownership.public') }}
              </button>
              <button class="filter-chip" :class="{ active: ownership === 'private' }" @click="ownership = ownership === 'private' ? '' : 'private'">
                {{ t('ownership.private') }}
              </button>
            </div>
          </div>

          <div class="field-shell">
            <span>{{ t('home.level') }}</span>
            <div class="chip-row">
              <button
                v-for="level in levelOptions"
                :key="level.value"
                class="filter-chip filter-chip--level"
                :class="{ active: catalog.levels.includes(level.value) }"
                @click="toggleArrayFilter(catalog.levels, level.value)"
              >
                {{ level.label }}
              </button>
            </div>
          </div>

          <label class="field-shell">
            <span>{{ t('home.qsTop') }}</span>
            <select v-model.number="catalog.qsRankMax">
              <option :value="null">{{ t('home.unlimited') }}</option>
              <option :value="100">Top 100</option>
              <option :value="200">Top 200</option>
              <option :value="300">Top 300</option>
              <option :value="500">Top 500</option>
              <option :value="800">Top 800</option>
              <option :value="1200">Top 1200</option>
            </select>
          </label>

          <label class="field-shell">
            <span>{{ t('home.tuition') }}</span>
            <div class="range-row">
              <input v-model.number="catalog.tuitionMin" type="number" :placeholder="t('home.tuitionMin')" />
              <input v-model.number="catalog.tuitionMax" type="number" :placeholder="t('home.tuitionMax')" />
            </div>
          </label>

          <div class="field-shell">
            <span>{{ t('home.category') }}</span>
            <div class="chip-row">
              <button
                v-for="category in categoryOptions"
                :key="category.value"
                class="filter-chip filter-chip--category"
                :class="{ active: catalog.categories.includes(category.value) }"
                @click="toggleArrayFilter(catalog.categories, category.value)"
              >
                {{ category.label }}
              </button>
            </div>
          </div>

          <div class="field-shell">
            <span>{{ t('home.language') }}</span>
            <button class="filter-chip filter-chip--block" :class="{ active: catalog.acceptNoLanguage }" @click="catalog.acceptNoLanguage = !catalog.acceptNoLanguage">
              {{ t('home.noLanguage') }}
            </button>
          </div>
        </div>

        <div v-if="activeFilters.length" class="active-strip">
          <span v-for="item in activeFilters" :key="item.key" class="active-tag">
            {{ item.label }}
            <button class="active-tag-x" @click="removeFilter(item.key)">×</button>
          </span>
          <button class="clear-all-btn" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>

        <div class="filter-summary">
          <div class="filter-summary__count">{{ catalog.filteredUniversities.length }}</div>
          <div class="filter-summary__label">{{ t('home.matchCount', { count: catalog.filteredUniversities.length }) }}</div>
        </div>
      </aside>

      <div class="results-panel">
        <div class="results-header section-card">
          <div>
            <div class="section-kicker">{{ t('common.shortlist') }}</div>
            <h2 class="section-title">{{ t('home.overviewTitle') }}</h2>
          </div>
          <p class="section-copy">{{ t('home.trustIntro') }}</p>
        </div>

        <div v-if="catalog.loading" class="section-card empty-state">{{ t('common.loading') }}</div>
        <div v-else-if="catalog.errorMessage && !catalog.filteredUniversities.length" class="section-card empty-state empty-state--warning">
          {{ t('home.loadFailed') }}: {{ catalog.errorMessage }}
        </div>
        <div v-else-if="!catalog.filteredUniversities.length" class="section-card empty-state">{{ t('home.empty') }}</div>
        <div v-else class="results-list">
          <UniversityCard v-for="item in catalog.filteredUniversities" :key="item.id" :university="item" />
        </div>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import UniversityCard from "../components/UniversityCard.vue";
import { useCatalogStore } from "../stores/catalog";
import { useI18n } from "vue-i18n";

const catalog = useCatalogStore();
const { t } = useI18n();
const catalogSectionRef = ref<HTMLElement | null>(null);

const ownership = computed({
  get: () => catalog.ownerships[0] || "",
  set: (value: string) => {
    catalog.ownerships = value ? [value] : [];
  }
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

const quickTags = computed(() => [
  { type: "category", value: "business", label: t('category.business') },
  { type: "category", value: "it", label: t('category.it') },
  { type: "category", value: "engineering", label: t('category.engineering') },
  { type: "category", value: "medicine", label: t('category.medicine') },
  { type: "level", value: "master", label: t('degree.master') },
  { type: "level", value: "phd", label: t('degree.phd') }
] as const);

const activeFilters = computed(() => {
  const categoryLabels = new Map(categoryOptions.value.map((item) => [item.value, item.label]));
  const levelLabels = new Map(levelOptions.value.map((item) => [item.value, item.label]));
  const items: Array<{ key: string; label: string }> = [];

  if (ownership.value) {
    items.push({ key: `ownership:${ownership.value}`, label: ownership.value === "public" ? t('ownership.public') : t('ownership.private') });
  }
  for (const value of catalog.levels) {
    items.push({ key: `level:${value}`, label: levelLabels.get(value) || value });
  }
  for (const value of catalog.categories) {
    items.push({ key: `category:${value}`, label: categoryLabels.get(value) || value });
  }
  if (catalog.qsRankMax) {
    items.push({ key: "qs", label: `Top ${catalog.qsRankMax}` });
  }
  if (catalog.tuitionMin || catalog.tuitionMax) {
    items.push({
      key: "tuition",
      label: `${catalog.tuitionMin || 0} - ${catalog.tuitionMax || t('home.unlimited')} CNY`
    });
  }
  if (catalog.acceptNoLanguage) {
    items.push({ key: "language", label: t('home.noLanguage') });
  }
  if (catalog.search.trim()) {
    items.push({ key: "search", label: catalog.search.trim() });
  }

  return items;
});

function toggleArrayFilter(target: string[], value: string) {
  const index = target.indexOf(value);
  if (index >= 0) target.splice(index, 1);
  else target.push(value);
}

function applyQuickTag(tag: (typeof quickTags.value)[number]) {
  if (tag.type === "category") {
    catalog.categories = [tag.value];
    catalog.levels = [];
  } else {
    catalog.levels = [tag.value];
  }
  scrollToCatalog();
}

function removeFilter(key: string) {
  const [type, value] = key.split(":");
  if (type === "ownership") catalog.ownerships = [];
  if (type === "level") catalog.levels = catalog.levels.filter((item) => item !== value);
  if (type === "category") catalog.categories = catalog.categories.filter((item) => item !== value);
  if (type === "qs") catalog.qsRankMax = null;
  if (type === "tuition") {
    catalog.tuitionMin = null;
    catalog.tuitionMax = null;
  }
  if (type === "language") catalog.acceptNoLanguage = false;
  if (type === "search") catalog.search = "";
}

function resetFilters() {
  catalog.search = "";
  catalog.ownerships = [];
  catalog.categories = [];
  catalog.levels = [];
  catalog.acceptNoLanguage = false;
  catalog.qsRankMax = null;
  catalog.tuitionMin = null;
  catalog.tuitionMax = null;
}

function scrollToCatalog() {
  catalogSectionRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>
