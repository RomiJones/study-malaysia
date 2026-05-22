import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  ProgramCatalogDetail,
  ProgramListItem,
  SearchSuggestionItem,
  UniversityListItem
} from "@studymy/shared";
import { apiFetch } from "../api/client";

const FAVORITES_KEY = "studymy_favorites";
const COMPARE_KEY = "studymy_compare";
const FEATURED_ORDER = ["UM", "UPM", "UKM", "USM", "UTM", "TAYLORS", "SUNWAY", "UCSI", "APU", "MONASH"];
const DEFAULT_FAVORITES = { universities: [] as number[], programs: [] as number[] };
const DEFAULT_COMPARE: number[] = [];

interface HomeMeta {
  stats: {
    universityCount: number;
    programCount: number;
    bestQsRank: number;
  };
  contentBlocks: Array<{ id: number; key: string; title: Record<string, string>; body: Record<string, string> }>;
}

export const useCatalogStore = defineStore("catalog", () => {
  const homeMeta = ref<HomeMeta | null>(null);
  const universities = ref<UniversityListItem[]>([]);
  const programs = ref<ProgramListItem[]>([]);
  const universityDetail = ref<(UniversityListItem & { programs: ProgramListItem[] }) | null>(null);
  const programDetail = ref<(ProgramListItem & { university: UniversityListItem }) | null>(null);
  const selectedProgramDetail = ref<ProgramCatalogDetail | null>(null);
  const searchSuggestions = ref<SearchSuggestionItem[]>([]);
  const loading = ref(false);
  const searchLoading = ref(false);
  const programLoading = ref(false);
  const errorMessage = ref("");
  const compareMessage = ref("");
  const search = ref("");
  const ownerships = ref<string[]>([]);
  const categories = ref<string[]>([]);
  const levels = ref<string[]>([]);
  const acceptNoLanguage = ref(false);
  const qsRankMax = ref<number | null>(null);
  const tuitionMin = ref<number | null>(null);
  const tuitionMax = ref<number | null>(null);
  const homePage = ref(1);
  const pageSize = ref(8);
  const favoriteState = ref<{ universities: number[]; programs: number[] }>(readStorage(FAVORITES_KEY, DEFAULT_FAVORITES));
  const compareIds = ref<number[]>(readStorage(COMPARE_KEY, DEFAULT_COMPARE));

  const filteredUniversities = computed(() =>
    [...universities.value]
      .filter((item) => {
        const query = search.value.trim().toLowerCase();
        const relatedPrograms = programs.value.filter((program) => program.universityId === item.id);

        if (query) {
          const source = `${JSON.stringify(item)} ${JSON.stringify(relatedPrograms)}`.toLowerCase();
          if (!source.includes(query)) return false;
        }
        if (ownerships.value.length && !ownerships.value.includes(item.ownership)) return false;
        if (categories.value.length && !relatedPrograms.some((program) => categories.value.includes(program.category))) return false;
        if (levels.value.length && !relatedPrograms.some((program) => levels.value.includes(program.level))) return false;
        if (acceptNoLanguage.value && !item.acceptNoLanguage) return false;
        if (qsRankMax.value && item.qsRank > qsRankMax.value) return false;
        if (tuitionMin.value && item.tuitionMaxCny < tuitionMin.value) return false;
        if (tuitionMax.value && item.tuitionMinCny > tuitionMax.value) return false;
        return true;
      })
      .sort(compareUniversities)
  );

  async function loadHomeMeta() {
    try {
      homeMeta.value = await apiFetch<HomeMeta>("/universities/meta/home");
      errorMessage.value = "";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Failed to load home metadata";
      homeMeta.value = null;
      throw error;
    }
  }

  async function loadUniversities() {
    loading.value = true;
    try {
      const [universityList, programList] = await Promise.all([
        apiFetch<UniversityListItem[]>("/universities"),
        apiFetch<ProgramListItem[]>("/programs")
      ]);
      universities.value = universityList;
      programs.value = programList;
      errorMessage.value = "";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Failed to load university catalog";
      universities.value = [];
      programs.value = [];
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function loadUniversity(slug: string) {
    universityDetail.value = await apiFetch<UniversityListItem & { programs: ProgramListItem[] }>(`/universities/${slug}`);
  }

  async function loadProgram(slug: string) {
    programDetail.value = await apiFetch<ProgramListItem & { university: UniversityListItem }>(`/programs/${slug}`);
  }

  async function loadSearchSuggestions(query = search.value) {
    const value = query.trim();
    if (!value) {
      searchSuggestions.value = [];
      return;
    }

    searchLoading.value = true;
    try {
      searchSuggestions.value = await apiFetch<SearchSuggestionItem[]>(`/search/suggestions?q=${encodeURIComponent(value)}&limit=8`);
    } catch {
      searchSuggestions.value = [];
    } finally {
      searchLoading.value = false;
    }
  }

  function clearSearchSuggestions() {
    searchSuggestions.value = [];
  }

  async function openProgramDetail(identifier: number | string) {
    programLoading.value = true;
    try {
      selectedProgramDetail.value = await apiFetch<ProgramCatalogDetail>(`/programs/detail/${encodeURIComponent(String(identifier))}`);
      errorMessage.value = "";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "Failed to load program detail";
      selectedProgramDetail.value = null;
      throw error;
    } finally {
      programLoading.value = false;
    }
  }

  function closeProgramDetail() {
    selectedProgramDetail.value = null;
  }

  function toggleFavoriteUniversity(id: number) {
    const index = favoriteState.value.universities.indexOf(id);
    if (index >= 0) favoriteState.value.universities.splice(index, 1);
    else favoriteState.value.universities.push(id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteState.value));
  }

  function toggleFavoriteProgram(id: number) {
    const index = favoriteState.value.programs.indexOf(id);
    if (index >= 0) favoriteState.value.programs.splice(index, 1);
    else favoriteState.value.programs.push(id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteState.value));
  }

  function toggleCompare(id: number) {
    compareMessage.value = "";
    const index = compareIds.value.indexOf(id);
    if (index >= 0) compareIds.value.splice(index, 1);
    else if (compareIds.value.length < 4) compareIds.value.push(id);
    else {
      compareMessage.value = "最多只能同时对比 4 所院校";
      return false;
    }
    localStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds.value));
    return true;
  }

  function clearCompare() {
    compareIds.value = [];
    compareMessage.value = "";
    localStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds.value));
  }

  function setHomePage(value: number) {
    homePage.value = Math.max(1, value);
  }

  function resetHomePage() {
    homePage.value = 1;
  }

  return {
    homeMeta,
    universities,
    programs,
    universityDetail,
    programDetail,
    selectedProgramDetail,
    searchSuggestions,
    loading,
    searchLoading,
    programLoading,
    errorMessage,
    compareMessage,
    search,
    ownerships,
    categories,
    levels,
    acceptNoLanguage,
    qsRankMax,
    tuitionMin,
    tuitionMax,
    homePage,
    pageSize,
    favoriteState,
    compareIds,
    filteredUniversities,
    loadHomeMeta,
    loadUniversities,
    loadUniversity,
    loadProgram,
    loadSearchSuggestions,
    clearSearchSuggestions,
    openProgramDetail,
    closeProgramDetail,
    toggleFavoriteUniversity,
    toggleFavoriteProgram,
    toggleCompare,
    clearCompare,
    setHomePage,
    resetHomePage
  };
});

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function compareUniversities(a: UniversityListItem, b: UniversityListItem) {
  const aIndex = FEATURED_ORDER.indexOf(a.code);
  const bIndex = FEATURED_ORDER.indexOf(b.code);

  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
  if (aIndex >= 0) return -1;
  if (bIndex >= 0) return 1;

  return a.qsRank - b.qsRank;
}
