import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  ProgramCatalogDetail,
  ProgramListItem,
  SearchSuggestionItem,
  UniversityListItem
} from "@studymy/shared";
import { apiFetch } from "../api/client";
import { useSessionStore } from "./session";

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

interface FavoriteSyncResponse {
  universityIds?: number[];
  programIds?: number[];
}

interface CompareSyncResponse {
  universityIds?: number[];
}

export const useCatalogStore = defineStore("catalog", () => {
  const session = useSessionStore();
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
  const syncLoading = ref(false);
  const errorMessage = ref("");
  const syncMessage = ref("");
  const syncError = ref("");
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
  const favoriteState = ref<{ universities: number[]; programs: number[] }>(
    normalizeFavoriteState(readStorage(FAVORITES_KEY, DEFAULT_FAVORITES))
  );
  const compareIds = ref<number[]>(normalizeIds(readStorage(COMPARE_KEY, DEFAULT_COMPARE)));

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

  async function loadUserCollections() {
    if (!session.token) return;
    syncLoading.value = true;
    try {
      const [favorites, compare] = await Promise.all([
        apiFetch<FavoriteSyncResponse>("/favorites", {}, session.token),
        apiFetch<CompareSyncResponse>("/compare", {}, session.token)
      ]);
      applyFavoriteResponse(favorites);
      compareIds.value = normalizeIds(compare.universityIds || []);
      persistCompare();
      syncMessage.value = "已读取账户收藏和对比清单。";
      syncError.value = "";
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : "账户状态读取失败";
    } finally {
      syncLoading.value = false;
    }
  }

  async function mergeLocalState() {
    if (!session.token) return;
    syncLoading.value = true;
    try {
      const [favorites, compare] = await Promise.all([
        apiFetch<FavoriteSyncResponse>(
          "/favorites/merge",
          {
            method: "POST",
            body: JSON.stringify({
              universityIds: favoriteState.value.universities,
              programIds: favoriteState.value.programs
            })
          },
          session.token
        ),
        apiFetch<CompareSyncResponse>(
          "/compare/merge",
          {
            method: "POST",
            body: JSON.stringify({ universityIds: compareIds.value })
          },
          session.token
        )
      ]);
      applyFavoriteResponse(favorites);
      compareIds.value = normalizeIds(compare.universityIds || compareIds.value);
      persistCompare();
      syncMessage.value = "已同步本地收藏、专业收藏和对比清单。";
      syncError.value = "";
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : "收藏同步失败，本地数据已保留";
    } finally {
      syncLoading.value = false;
    }
  }

  function applyFavoriteResponse(response: FavoriteSyncResponse) {
    favoriteState.value = {
      universities: normalizeIds(response.universityIds || favoriteState.value.universities),
      programs: normalizeIds(response.programIds || favoriteState.value.programs)
    };
    persistFavorites();
  }

  function persistFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteState.value));
  }

  function persistCompare() {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds.value));
  }

  async function toggleFavoriteUniversity(id: number) {
    await toggleFavorite("university", id);
  }

  async function toggleFavoriteProgram(id: number) {
    await toggleFavorite("program", id);
  }

  async function toggleFavorite(type: "university" | "program", id: number) {
    const key = type === "university" ? "universities" : "programs";
    const previous = {
      universities: [...favoriteState.value.universities],
      programs: [...favoriteState.value.programs]
    };
    const list = favoriteState.value[key];
    const index = list.indexOf(id);
    const nextIsActive = index < 0;

    if (index >= 0) list.splice(index, 1);
    else list.push(id);
    favoriteState.value[key] = normalizeIds(list);
    persistFavorites();

    if (!session.token) return;

    try {
      const response = await apiFetch<FavoriteSyncResponse>(
        `/favorites/${key}/${id}`,
        { method: nextIsActive ? "POST" : "DELETE" },
        session.token
      );
      applyFavoriteResponse(response);
      syncError.value = "";
    } catch (error) {
      favoriteState.value = previous;
      persistFavorites();
      syncError.value = error instanceof Error ? error.message : "收藏保存失败";
    }
  }

  async function toggleCompare(id: number) {
    compareMessage.value = "";
    const previous = [...compareIds.value];
    const index = compareIds.value.indexOf(id);
    const nextIsActive = index < 0;
    if (index >= 0) compareIds.value.splice(index, 1);
    else if (compareIds.value.length < 4) compareIds.value.push(id);
    else {
      compareMessage.value = "最多只能同时对比 4 所院校";
      return false;
    }
    compareIds.value = normalizeIds(compareIds.value).slice(0, 4);
    persistCompare();

    if (session.token) {
      try {
        const response = await apiFetch<CompareSyncResponse>(
          nextIsActive ? `/compare/universities/${id}` : `/compare/universities/${id}`,
          { method: nextIsActive ? "POST" : "DELETE" },
          session.token
        );
        compareIds.value = normalizeIds(response.universityIds || compareIds.value).slice(0, 4);
        persistCompare();
        syncError.value = "";
      } catch (error) {
        compareIds.value = previous;
        persistCompare();
        syncError.value = error instanceof Error ? error.message : "对比清单保存失败";
      }
    }
    return true;
  }

  async function clearCompare() {
    const previous = [...compareIds.value];
    compareIds.value = [];
    compareMessage.value = "";
    persistCompare();

    if (!session.token) return;
    try {
      const response = await apiFetch<CompareSyncResponse>("/compare", { method: "DELETE" }, session.token);
      compareIds.value = normalizeIds(response.universityIds || []);
      persistCompare();
    } catch (error) {
      compareIds.value = previous;
      persistCompare();
      syncError.value = error instanceof Error ? error.message : "清空对比清单失败";
    }
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
    syncLoading,
    errorMessage,
    syncMessage,
    syncError,
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
    loadUserCollections,
    mergeLocalState,
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

function normalizeFavoriteState(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as { universities?: unknown; programs?: unknown }
    : DEFAULT_FAVORITES;
  return {
    universities: normalizeIds(source.universities),
    programs: normalizeIds(source.programs)
  };
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
}

function compareUniversities(a: UniversityListItem, b: UniversityListItem) {
  const aIndex = FEATURED_ORDER.indexOf(a.code);
  const bIndex = FEATURED_ORDER.indexOf(b.code);

  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
  if (aIndex >= 0) return -1;
  if (bIndex >= 0) return 1;

  return a.qsRank - b.qsRank;
}
