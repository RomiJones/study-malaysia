import type {
  ActiveFilterItem,
  DegreeLevel,
  FilterFacet,
  FilterFacetOption,
  InstitutionOwnership,
  InstitutionType,
  LocalizedStringArray,
  LocalizedText,
  ProgramCatalogItem,
  ProgramListItem,
  PublicCatalogListResponse,
  PublicCatalogPagination,
  UniversityListItem,
  UniversityProgramGroup
} from "@studymy/shared";
import { DEGREE_LEVEL_LABELS } from "@studymy/shared";
import { ProgramEntity, UniversityEntity } from "../db/entities.js";
import { isReadyForPublicCatalog, mapProgram, mapUniversity } from "./mappers.js";

export interface PublicCatalogQuery {
  search?: string;
  categories?: string[];
  levels?: DegreeLevel[];
  ownerships?: InstitutionOwnership[];
  institutionTypes?: InstitutionType[];
  acceptNoLanguage?: boolean;
  qsRankMax?: number;
  tuitionMin?: number;
  tuitionMax?: number;
  budgetCny?: number;
  ieltsMax?: number;
  page?: number;
  pageSize?: number;
  includeMeta?: boolean;
}

const rankOptions = [100, 200, 300, 500, 800];
const tuitionOptions = [30000, 50000, 80000, 120000];
const languageOptions = ["accept-no-language", "ielts-5.5", "ielts-6.0", "ielts-6.5"];
const degreeOrder: DegreeLevel[] = ["bachelor", "master", "phd"];

export function textLabel(value: string): LocalizedText {
  return { en: value, ms: value, "zh-CN": value, "zh-TW": value };
}

export function normalizeSearch(value?: string) {
  return (value || "").trim().toLowerCase();
}

function localizedTextValues(value: LocalizedText | LocalizedStringArray | null | undefined): string[] {
  if (!value) return [];
  return Object.values(value).flatMap((item) => Array.isArray(item) ? item : [item]).filter(Boolean);
}

export function buildUniversitySearchText(university: UniversityEntity): string {
  return [
    university.slug,
    university.code,
    university.shortName,
    university.nameEnOfficial,
    university.website,
    ...localizedTextValues(university.name),
    ...localizedTextValues(university.location),
    ...localizedTextValues(university.region),
    ...localizedTextValues(university.description),
    ...localizedTextValues(university.highlights)
  ].join(" ").toLowerCase();
}

export function buildProgramSearchText(program: ProgramEntity): string {
  return [
    program.slug,
    program.code,
    program.nameEnOfficial,
    program.level,
    program.category,
    program.facultyZh,
    program.studyMode,
    program.campus,
    ...localizedTextValues(program.name),
    ...localizedTextValues(program.faculty),
    ...localizedTextValues(program.description),
    ...localizedTextValues(program.specializations),
    ...localizedTextValues(program.careers)
  ].join(" ").toLowerCase();
}

function queryBudgetMax(query: PublicCatalogQuery): number | undefined {
  return query.budgetCny ?? query.tuitionMax;
}

function hasProgramSpecificFilters(query: PublicCatalogQuery): boolean {
  return Boolean(query.categories?.length || query.levels?.length || query.tuitionMin || query.tuitionMax || query.budgetCny || query.ieltsMax);
}

export function publicReadyUniversities(universities: UniversityEntity[]): UniversityEntity[] {
  return universities.filter(isReadyForPublicCatalog);
}

export function publicReadyPrograms(programs: ProgramEntity[], universityMap?: Map<number, UniversityEntity>): ProgramEntity[] {
  return programs.filter((program) => {
    if (!isReadyForPublicCatalog(program)) return false;
    const university = universityMap?.get(program.universityId) ?? program.university;
    return !university || isReadyForPublicCatalog(university);
  });
}

export function matchesProgramSpecificFilters(program: ProgramEntity, query: PublicCatalogQuery): boolean {
  const budgetMax = queryBudgetMax(query);
  if (query.categories?.length && !query.categories.includes(program.category)) return false;
  if (query.levels?.length && !query.levels.includes(program.level)) return false;
  if (query.tuitionMin && program.annualTuitionCny < query.tuitionMin) return false;
  if (budgetMax && program.annualTuitionCny > budgetMax) return false;
  if (query.ieltsMax && Number(program.languageRequirement?.ielts ?? 0) > query.ieltsMax) return false;
  return true;
}

export function matchesProgramFilters(program: ProgramEntity, university: UniversityEntity, query: PublicCatalogQuery): boolean {
  const search = normalizeSearch(query.search);
  if (!isReadyForPublicCatalog(program) || !isReadyForPublicCatalog(university)) return false;
  if (search && !`${buildProgramSearchText(program)} ${buildUniversitySearchText(university)}`.includes(search)) return false;
  if (query.ownerships?.length && !query.ownerships.includes(university.ownership)) return false;
  if (query.institutionTypes?.length && !query.institutionTypes.includes(university.institutionType)) return false;
  if (query.acceptNoLanguage === true && !university.acceptNoLanguage) return false;
  if (query.qsRankMax && university.qsRank > query.qsRankMax) return false;
  return matchesProgramSpecificFilters(program, query);
}

export function matchesUniversityFilters(university: UniversityEntity, readyPrograms: ProgramEntity[], query: PublicCatalogQuery): boolean {
  const search = normalizeSearch(query.search);
  const budgetMax = queryBudgetMax(query);

  if (!isReadyForPublicCatalog(university)) return false;
  if (search && !`${buildUniversitySearchText(university)} ${readyPrograms.map(buildProgramSearchText).join(" ")}`.includes(search)) return false;
  if (query.ownerships?.length && !query.ownerships.includes(university.ownership)) return false;
  if (query.institutionTypes?.length && !query.institutionTypes.includes(university.institutionType)) return false;
  if (query.acceptNoLanguage === true && !university.acceptNoLanguage) return false;
  if (query.qsRankMax && university.qsRank > query.qsRankMax) return false;
  if (query.ieltsMax && Number(university.minIelts) > query.ieltsMax) return false;

  if (hasProgramSpecificFilters(query)) {
    return readyPrograms.some((program) => matchesProgramSpecificFilters(program, query));
  }

  if (query.tuitionMin && university.tuitionMaxCny < query.tuitionMin) return false;
  if (budgetMax && university.tuitionMinCny > budgetMax) return false;
  return true;
}

export function mapUniversityCatalogItem(university: UniversityEntity, readyPrograms: ProgramEntity[]): UniversityListItem {
  const item = mapUniversity(university);
  return { ...item, programCount: readyPrograms.length };
}

export function mapProgramCatalogItem(program: ProgramEntity, university: UniversityEntity): ProgramCatalogItem {
  return {
    ...mapProgram(program),
    university: mapUniversity(university),
    annualCostCny: program.annualTuitionCny + university.livingCostCny
  };
}

export function buildProgramGroups(programs: ProgramEntity[]): UniversityProgramGroup[] {
  return degreeOrder.map((level) => {
    const items = programs.filter((program) => program.level === level).map(mapProgram);
    return {
      level,
      label: DEGREE_LEVEL_LABELS[level],
      items,
      count: items.length
    };
  });
}

export function paginate<T>(items: T[], query: PublicCatalogQuery): { items: T[]; pagination: PublicCatalogPagination } {
  const pageSize = Math.max(1, Math.min(Number(query.pageSize || items.length || 1), 100));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(Number(query.page || 1), totalPages));
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    pagination: { page, pageSize, total, totalPages }
  };
}

export function toListResponse<T>(items: T[], query: PublicCatalogQuery, facets: FilterFacet[], activeFilters: ActiveFilterItem[]): PublicCatalogListResponse<T> {
  const paginated = paginate(items, query);
  return {
    items: paginated.items,
    pagination: paginated.pagination,
    facets,
    activeFilters,
    total: paginated.pagination.total
  };
}

function increment(map: Map<string, number>, key: string | number | null | undefined) {
  if (key == null || key === "") return;
  const normalized = String(key);
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function optionsFromCounts(counts: Map<string, number>, labels = new Map<string, LocalizedText>()): FilterFacetOption[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, label: labels.get(value) || textLabel(value) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function makeFacet(key: string, label: string, options: FilterFacetOption[]): FilterFacet {
  return { key, label: textLabel(label), options };
}

export function buildCatalogFacets(
  universities: UniversityEntity[],
  programs: ProgramEntity[],
  query: PublicCatalogQuery,
  resultUniversities: UniversityEntity[],
  resultPrograms: ProgramEntity[]
) {
  const ownershipCounts = new Map<string, number>();
  const institutionTypeCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const levelCounts = new Map<string, number>();

  for (const university of universities) {
    increment(ownershipCounts, university.ownership);
    increment(institutionTypeCounts, university.institutionType);
  }

  for (const program of programs) {
    increment(categoryCounts, program.category);
    increment(levelCounts, program.level);
  }

  const rankFacet = makeFacet(
    "qsRankMax",
    "QS ranking",
    rankOptions.map((value) => ({
      value: String(value),
      label: textLabel(`Top ${value}`),
      count: universities.filter((university) => university.qsRank <= value).length
    }))
  );
  const tuitionFacet = makeFacet(
    "tuitionMax",
    "Annual tuition budget",
    tuitionOptions.map((value) => ({
      value: String(value),
      label: textLabel(`Under ${value} CNY`),
      count: programs.filter((program) => program.annualTuitionCny <= value).length
    }))
  );
  const languageFacet = makeFacet(
    "language",
    "Language requirement",
    languageOptions.map((value) => ({
      value,
      label: textLabel(value),
      count: value === "accept-no-language"
        ? universities.filter((university) => university.acceptNoLanguage).length
        : programs.filter((program) => program.languageRequirement.ielts <= Number(value.replace("ielts-", ""))).length
    }))
  );

  return {
    resultCount: resultUniversities.length,
    universityResultCount: resultUniversities.length,
    programResultCount: resultPrograms.length,
    facets: [
      makeFacet("ownerships", "Institution ownership", optionsFromCounts(ownershipCounts)),
      makeFacet("institutionTypes", "Institution type", optionsFromCounts(institutionTypeCounts)),
      makeFacet("levels", "Degree level", optionsFromCounts(levelCounts, new Map(degreeOrder.map((level) => [level, DEGREE_LEVEL_LABELS[level]])))),
      makeFacet("categories", "Program category", optionsFromCounts(categoryCounts)),
      rankFacet,
      tuitionFacet,
      languageFacet
    ],
    activeFilters: buildActiveFilters(query)
  };
}

export function buildActiveFilters(query: PublicCatalogQuery): ActiveFilterItem[] {
  const items: ActiveFilterItem[] = [];
  const push = (key: string, value: string, label = value) => {
    items.push({ key, value, label: textLabel(label) });
  };

  if (query.search) push("search", query.search, query.search);
  query.ownerships?.forEach((value) => push("ownerships", value));
  query.institutionTypes?.forEach((value) => push("institutionTypes", value));
  query.levels?.forEach((value) => push("levels", value, DEGREE_LEVEL_LABELS[value].en));
  query.categories?.forEach((value) => push("categories", value));
  if (query.acceptNoLanguage) push("acceptNoLanguage", "true", "Accepts no-language applications");
  if (query.qsRankMax) push("qsRankMax", String(query.qsRankMax), `QS Top ${query.qsRankMax}`);
  if (query.tuitionMin) push("tuitionMin", String(query.tuitionMin), `From ${query.tuitionMin} CNY`);
  if (query.tuitionMax) push("tuitionMax", String(query.tuitionMax), `Under ${query.tuitionMax} CNY`);
  if (query.budgetCny) push("budgetCny", String(query.budgetCny), `Budget ${query.budgetCny} CNY`);
  if (query.ieltsMax) push("ieltsMax", String(query.ieltsMax), `IELTS up to ${query.ieltsMax}`);
  return items;
}
