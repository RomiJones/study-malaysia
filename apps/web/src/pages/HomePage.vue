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

          <div class="search-wrap" ref="searchWrapRef">
            <div class="search-inner">
              <span class="search-icon">⌕</span>
              <input
                v-model="catalog.search"
                class="search-input"
                :placeholder="t('home.searchLead')"
                @focus="handleSearchFocus"
                @input="handleSearchInput"
                @keydown.enter="submitSearch"
                @keydown.escape="closeSuggestions"
              />
              <button class="search-btn" @click="scrollToCatalog">{{ t('common.searchAction') }}</button>
            </div>
            <div v-if="showSuggestions" class="search-suggest">
              <button
                v-for="suggestion in catalog.searchSuggestions"
                :key="suggestion.id"
                class="search-suggest-item"
                type="button"
                @click="selectSuggestion(suggestion)"
              >
                <div class="search-suggest-title">
                  <span class="search-suggest-type">{{ suggestionTypeLabel(suggestion.type) }}</span>
                  {{ suggestion.title }}
                </div>
                <div class="search-suggest-sub">{{ suggestion.subtitle }}</div>
              </button>
              <div v-if="catalog.searchLoading" class="search-suggest-empty">{{ t('common.loading') }}</div>
              <div v-else-if="catalog.search.trim() && !catalog.searchSuggestions.length" class="search-suggest-empty">{{ t('common.noData') }}</div>
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
          <div v-for="group in filterGroups" :key="group.key" class="filter-group">
            <button class="filter-group-head" type="button" @click="toggleFilterGroup(group.key)">
              <span class="filter-group-label">
                <span>{{ group.label }}</span>
                <span v-if="group.active" class="filter-group-active-dot"></span>
              </span>
              <span class="filter-group-arrow" :class="{ open: openGroups.includes(group.key) }">⌄</span>
            </button>

            <div class="filter-group-body" :class="{ open: openGroups.includes(group.key) }">
              <div class="filter-group-inner">
                <div v-if="group.key === 'type'" class="chip-row">
                  <button class="filter-chip" :class="{ active: ownership === 'public' }" @click="setOwnership('public')">
                    {{ t('ownership.public') }}
                  </button>
                  <button class="filter-chip" :class="{ active: ownership === 'private' }" @click="setOwnership('private')">
                    {{ t('ownership.private') }}
                  </button>
                </div>

                <div v-if="group.key === 'level'" class="chip-row">
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

                <div v-if="group.key === 'rank'" class="chip-row">
                  <button
                    v-for="rank in rankOptions"
                    :key="rank.value ?? 'all'"
                    class="filter-chip filter-chip--rank"
                    :class="{ active: catalog.qsRankMax === rank.value }"
                    @click="setRank(rank.value)"
                  >
                    {{ rank.label }}
                  </button>
                </div>

                <div v-if="group.key === 'budget'" class="budget-filter">
                  <div class="range-row">
                    <input v-model.number="catalog.tuitionMin" type="number" :placeholder="t('home.tuitionMin')" @input="catalog.resetHomePage" />
                    <input v-model.number="catalog.tuitionMax" type="number" :placeholder="t('home.tuitionMax')" @input="catalog.resetHomePage" />
                  </div>
                  <div class="chip-row">
                    <button
                      v-for="budget in budgetOptions"
                      :key="budget.value"
                      class="filter-chip filter-chip--budget"
                      :class="{ active: catalog.tuitionMax === budget.value && !catalog.tuitionMin }"
                      @click="setBudget(budget.value)"
                    >
                      {{ budget.label }}
                    </button>
                  </div>
                </div>

                <div v-if="group.key === 'category'" class="category-grid">
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

                <div v-if="group.key === 'special'" class="chip-row">
                  <button class="filter-chip filter-chip--block" :class="{ active: catalog.acceptNoLanguage }" @click="toggleNoLanguage">
                    {{ t('home.noLanguage') }}
                  </button>
                </div>
              </div>
            </div>
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

        <div v-if="activeFilters.length" class="active-filter-tags">
          <span v-for="item in activeFilters" :key="item.key" class="active-filter-tag">
            {{ item.label }}
            <button @click="removeFilter(item.key)">×</button>
          </span>
        </div>

        <div v-if="catalog.loading" class="section-card empty-state">{{ t('common.loading') }}</div>
        <div v-else-if="catalog.errorMessage && !catalog.filteredUniversities.length" class="section-card empty-state empty-state--warning">
          {{ t('home.loadFailed') }}: {{ catalog.errorMessage }}
        </div>
        <div v-else-if="!catalog.filteredUniversities.length" class="section-card empty-state empty-state--action">
          <div>{{ t('home.empty') }}</div>
          <button class="primary-action" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>
        <div v-else class="results-list">
          <UniversityCard v-for="item in pagedUniversities" :key="item.id" :university="item" />
        </div>

        <nav v-if="totalPages > 1" class="pagination-bar" aria-label="Pagination">
          <button class="secondary-action" :disabled="catalog.homePage <= 1" @click="catalog.setHomePage(catalog.homePage - 1)">上一页</button>
          <span>{{ catalog.homePage }} / {{ totalPages }}</span>
          <button class="secondary-action" :disabled="catalog.homePage >= totalPages" @click="catalog.setHomePage(catalog.homePage + 1)">下一页</button>
        </nav>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { SearchSuggestionItem } from "@studymy/shared";
import UniversityCard from "../components/UniversityCard.vue";
import { useCatalogStore } from "../stores/catalog";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const catalog = useCatalogStore();
const { t } = useI18n();
const router = useRouter();
const catalogSectionRef = ref<HTMLElement | null>(null);
const searchWrapRef = ref<HTMLElement | null>(null);
const showSuggestions = ref(false);
const openGroups = ref(["type", "level", "rank", "budget", "category", "special"]);
let searchTimer: ReturnType<typeof window.setTimeout> | undefined;

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

const categoryOptions = computed(() => {
  const counts = new Map<string, number>();
  for (const program of catalog.programs) {
    counts.set(program.category, (counts.get(program.category) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: `${categoryLabel(value)} (${count})` }));
});

const rankOptions = [
  { value: null, label: t('home.unlimited') },
  { value: 100, label: "Top 100" },
  { value: 200, label: "Top 200" },
  { value: 300, label: "Top 300" },
  { value: 500, label: "Top 500" },
  { value: 800, label: "Top 800" }
] as const;

const budgetOptions = [
  { value: 30000, label: "≤ CNY 30k" },
  { value: 50000, label: "≤ CNY 50k" },
  { value: 80000, label: "≤ CNY 80k" },
  { value: 120000, label: "≤ CNY 120k" }
] as const;

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

const filterGroups = computed(() => [
  { key: "type", label: t('home.ownership'), active: Boolean(ownership.value) },
  { key: "level", label: t('home.level'), active: Boolean(catalog.levels.length) },
  { key: "rank", label: t('home.qsTop'), active: Boolean(catalog.qsRankMax) },
  { key: "budget", label: t('home.tuition'), active: Boolean(catalog.tuitionMin || catalog.tuitionMax) },
  { key: "category", label: t('home.category'), active: Boolean(catalog.categories.length) },
  { key: "special", label: t('home.language'), active: catalog.acceptNoLanguage }
]);

const totalPages = computed(() => Math.max(1, Math.ceil(catalog.filteredUniversities.length / catalog.pageSize)));
const pagedUniversities = computed(() => {
  const start = (catalog.homePage - 1) * catalog.pageSize;
  return catalog.filteredUniversities.slice(start, start + catalog.pageSize);
});

watch(totalPages, (value) => {
  if (catalog.homePage > value) catalog.setHomePage(value);
});

function toggleArrayFilter(target: string[], value: string) {
  const index = target.indexOf(value);
  if (index >= 0) target.splice(index, 1);
  else target.push(value);
  catalog.resetHomePage();
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

function setOwnership(value: string) {
  ownership.value = ownership.value === value ? "" : value;
  catalog.resetHomePage();
}

function setRank(value: number | null) {
  catalog.qsRankMax = catalog.qsRankMax === value ? null : value;
  catalog.resetHomePage();
}

function setBudget(value: number) {
  if (catalog.tuitionMax === value && !catalog.tuitionMin) {
    catalog.tuitionMax = null;
  } else {
    catalog.tuitionMin = null;
    catalog.tuitionMax = value;
  }
  catalog.resetHomePage();
}

function toggleNoLanguage() {
  catalog.acceptNoLanguage = !catalog.acceptNoLanguage;
  catalog.resetHomePage();
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
  catalog.resetHomePage();
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
  catalog.resetHomePage();
}

function scrollToCatalog() {
  closeSuggestions();
  catalogSectionRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function submitSearch() {
  closeSuggestions();
  scrollToCatalog();
}

function handleSearchFocus() {
  if (catalog.search.trim()) {
    showSuggestions.value = true;
    void catalog.loadSearchSuggestions();
  }
}

function handleSearchInput() {
  catalog.resetHomePage();
  showSuggestions.value = true;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    void catalog.loadSearchSuggestions();
  }, 160);
}

function closeSuggestions() {
  showSuggestions.value = false;
}

async function selectSuggestion(suggestion: SearchSuggestionItem) {
  closeSuggestions();
  catalog.search = suggestion.type === "city" ? suggestion.title : suggestion.highlight || suggestion.title;
  catalog.resetHomePage();

  if (suggestion.type === "program" && suggestion.universitySlug && suggestion.programId) {
    await router.push({ path: `/universities/${suggestion.universitySlug}`, query: { program: String(suggestion.programId) } });
    return;
  }

  if (suggestion.type === "university" && suggestion.universitySlug) {
    await router.push(`/universities/${suggestion.universitySlug}`);
    return;
  }

  scrollToCatalog();
}

function suggestionTypeLabel(type: SearchSuggestionItem["type"]) {
  if (type === "program") return t('common.program');
  if (type === "city") return t('common.city');
  return t('common.university');
}

function toggleFilterGroup(key: string) {
  if (openGroups.value.includes(key)) {
    openGroups.value = openGroups.value.filter((item) => item !== key);
  } else {
    openGroups.value = [...openGroups.value, key];
  }
}

function categoryLabel(value: string) {
  const known: Record<string, string> = {
    business: t('category.business'),
    it: t('category.it'),
    engineering: t('category.engineering'),
    science: t('category.science'),
    arts: t('category.arts'),
    medicine: t('category.medicine'),
    law: t('category.law')
  };
  return known[value] || value.replace(/[-_]/g, " ");
}

function handleDocumentClick(event: MouseEvent) {
  if (!searchWrapRef.value?.contains(event.target as Node)) closeSuggestions();
}

onMounted(() => document.addEventListener("click", handleDocumentClick));

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
  window.clearTimeout(searchTimer);
});
</script>
