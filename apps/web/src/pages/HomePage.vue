<template>
  <section class="home-page">
    <section class="hero-panel">
      <div class="hero-noise"></div>
      <div class="hero-dots"></div>
      <div class="hero-glow"></div>

      <div class="hero-panel__content">
        <div class="hero-panel__main">
          <div class="eyebrow-pill">{{ t('home.badge') }}</div>
          <h1 class="hero-title">
            {{ t('home.title') }}
            <span class="hero-accent">{{ t('home.accent') }}</span>
          </h1>
          <p class="hero-description">{{ t('home.subtitle') }}</p>
          <p class="hero-data-note">{{ heroDataNote }}</p>

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
            <button v-for="tag in quickTags" :key="`${tag.type}-${tag.value}`" class="tag-pill" @click="applyQuickTag(tag)">
              {{ tag.label }}
            </button>
          </div>

          <div class="hero-metrics">
            <article v-for="stat in heroStats" :key="stat.label" class="hero-metric-card">
              <div class="hero-metric-card__value">{{ stat.value }}</div>
              <div class="hero-metric-card__label">{{ stat.label }}</div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section class="home-layout" ref="catalogSectionRef">
      <aside class="filter-panel section-card">
        <div class="filter-panel__header">
          <div class="filter-panel__title">
            <span class="filter-panel__icon">▾</span>
            <span>{{ t('home.filtersTitle') }}</span>
            <span v-if="activeFilters.length" class="filter-panel__count">{{ activeFilters.length }} {{ t('common.itemCount') }}</span>
          </div>
          <button class="ghost-action" @click="resetFilters">{{ activeFilters.length ? t('common.clearAll') : t('common.reset') }}</button>
        </div>

        <div v-if="activeFilters.length" class="active-strip">
          <span v-for="item in activeFilters" :key="item.key" class="active-tag">
            {{ item.label }}
            <button class="active-tag-x" @click="removeFilter(item.key)">×</button>
          </span>
          <button class="clear-all-btn" @click="resetFilters">{{ t('common.clearAll') }}</button>
        </div>

        <div class="filter-stack">
          <div v-for="group in filterGroups" :key="group.key" class="filter-group">
            <button class="filter-group-head" type="button" @click="toggleFilterGroup(group.key)">
              <span class="filter-group-label">
                <span class="filter-group-icon">{{ group.icon }}</span>
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
                  <div class="budget-display">
                    <div class="budget-val">≤ CNY {{ budgetRangeLabel }}</div>
                    <div class="budget-sub">{{ t('home.tuition') }}</div>
                  </div>
                  <input
                    class="budget-range"
                    type="range"
                    min="30000"
                    max="120000"
                    step="10000"
                    :value="budgetRangeValue"
                    @input="setBudgetRange"
                  />
                  <div class="budget-labels">
                    <span>30k</span>
                    <span>120k</span>
                  </div>
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
                  <button class="toggle-row" :class="{ active: catalog.acceptNoLanguage }" @click="toggleNoLanguage">
                    <span>{{ t('home.noLanguage') }}</span>
                    <span class="toggle-switch-ui"><span></span></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
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
          {{ catalog.errorMessage || t('home.loadFailed') }}
        </div>
        <div v-else-if="!catalog.filteredUniversities.length" class="section-card empty-state empty-state--action">
          <div>{{ t('home.empty') }}</div>
          <button class="primary-action" @click="resetFilters">{{ t('common.reset') }}</button>
        </div>
        <div v-else class="results-list">
          <UniversityCard v-for="item in pagedUniversities" :key="item.id" :university="item" />
        </div>

        <nav v-if="totalPages > 1" class="pagination-bar" aria-label="Pagination">
          <button class="page-btn" :disabled="catalog.homePage <= 1" @click="catalog.setHomePage(catalog.homePage - 1)">←</button>
          <button
            v-for="page in visiblePages"
            :key="page"
            class="page-btn"
            :class="{ active: catalog.homePage === page }"
            @click="catalog.setHomePage(page)"
          >
            {{ page }}
          </button>
          <span v-if="showPageGap" class="pagination-gap">...</span>
          <button v-if="showLastPage" class="page-btn" :class="{ active: catalog.homePage === totalPages }" @click="catalog.setHomePage(totalPages)">
            {{ totalPages }}
          </button>
          <button class="page-btn" :disabled="catalog.homePage >= totalPages" @click="catalog.setHomePage(catalog.homePage + 1)">→</button>
        </nav>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { SearchSuggestionItem, SupportedLocale } from "@studymy/shared";
import UniversityCard from "../components/UniversityCard.vue";
import { useCatalogStore } from "../stores/catalog";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { formatCategoryLabel, formatPublicCount } from "../utils/format";

const catalog = useCatalogStore();
const { t, locale } = useI18n();
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
  { type: "category", value: "medicine", label: t('category.medicine') },
  { type: "category", value: "engineering", label: t('category.engineering') },
  { type: "category", value: "hospitality", label: t('category.hospitality') }
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
    items.push({ key: `category:${value}`, label: categoryLabels.get(value) || categoryLabel(value) });
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
  { key: "type", icon: "▣", label: t('home.ownership'), active: Boolean(ownership.value) },
  { key: "level", icon: "◈", label: t('home.level'), active: Boolean(catalog.levels.length) },
  { key: "rank", icon: "♛", label: t('home.qsTop'), active: Boolean(catalog.qsRankMax) },
  { key: "budget", icon: "◉", label: t('home.tuition'), active: Boolean(catalog.tuitionMin || catalog.tuitionMax) },
  { key: "category", icon: "▥", label: t('home.category'), active: Boolean(catalog.categories.length) },
  { key: "special", icon: "✦", label: t('home.language'), active: catalog.acceptNoLanguage }
]);

const totalPages = computed(() => Math.max(1, Math.ceil(catalog.filteredUniversities.length / catalog.pageSize)));
const pagedUniversities = computed(() => {
  const start = (catalog.homePage - 1) * catalog.pageSize;
  return catalog.filteredUniversities.slice(start, start + catalog.pageSize);
});
const publicStats = computed(() => {
  const stats = catalog.homeMeta?.stats;
  return {
    universityCount: stats?.universityCount ?? catalog.universities.length,
    programCount: stats?.programCount ?? catalog.programs.length,
    readyProgramCount: stats?.readyProgramCount ?? stats?.programCount ?? catalog.programs.length,
    officialVerifiedCount: stats?.officialVerifiedCount ?? catalog.universities.filter((item) => item.officialSourceStatus === "official-verified").length
  };
});
const heroStats = computed(() => [
  { value: formatPublicCount(publicStats.value.universityCount), label: t('home.statsUniversities') },
  { value: formatPublicCount(publicStats.value.programCount), label: t('home.statsPrograms') },
  { value: formatPublicCount(publicStats.value.readyProgramCount), label: t('home.statsReadyPrograms') },
  { value: formatPublicCount(publicStats.value.officialVerifiedCount), label: t('home.statsSource') }
]);
const heroDataNote = computed(() => t('home.publicScope', {
  universities: formatPublicCount(publicStats.value.universityCount),
  programs: formatPublicCount(publicStats.value.programCount),
  readyPrograms: formatPublicCount(publicStats.value.readyProgramCount)
}));
const budgetRangeValue = computed(() => catalog.tuitionMax ?? 120000);
const budgetRangeLabel = computed(() => shortBudget(budgetRangeValue.value));
const visiblePages = computed(() => {
  const pages = new Set([1, catalog.homePage, catalog.homePage + 1].filter((page) => page >= 1 && page <= totalPages.value));
  return [...pages].sort((a, b) => a - b).slice(0, 3);
});
const showLastPage = computed(() => totalPages.value > 1 && !visiblePages.value.includes(totalPages.value));
const showPageGap = computed(() => showLastPage.value && visiblePages.value[visiblePages.value.length - 1] < totalPages.value - 1);

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

function setBudgetRange(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  catalog.tuitionMin = null;
  catalog.tuitionMax = value;
  catalog.resetHomePage();
}

function shortBudget(value: number) {
  return `${Math.round(value / 1000)}k`;
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
  return formatCategoryLabel(value, locale.value as SupportedLocale);
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
