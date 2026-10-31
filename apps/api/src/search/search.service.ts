import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { SearchSuggestionItem } from "@studymy/shared";
import { Repository } from "typeorm";
import { CacheService } from "../common/cache.service.js";
import { isReadyForPublicCatalog } from "../common/mappers.js";
import { buildProgramSuggestionSearchFields, buildUniversitySearchText, normalizeSearch, publicReadyPrograms } from "../common/public-catalog.js";
import { ProgramEntity, UniversityEntity } from "../db/entities.js";

export interface SearchSuggestionQuery {
  q?: string;
  limit?: number;
}

const CITY_ALIAS_GROUPS = [
  { displayTitle: "Kuala Lumpur", aliases: ["kuala lumpur", "吉隆坡"] }
];

function displayText(value: Record<string, string> | null | undefined, fallback = "") {
  if (!value) return fallback;
  return value["zh-CN"] || value.en || Object.values(value).find(Boolean) || fallback;
}

function scoreFields(query: string, fields: string[]) {
  let bestScore = 0;
  let bestField = "";
  for (const rawField of fields) {
    const field = rawField.trim();
    const normalized = field.toLowerCase();
    if (!field) continue;
    let score = 0;
    if (normalized === query) score = 100;
    else if (normalized.startsWith(query)) score = 80;
    else if (normalized.includes(query)) score = 50;
    if (score > bestScore) {
      bestScore = score;
      bestField = field;
    }
  }
  return { score: bestScore, highlight: bestField };
}

function scoreCityField(query: string, field: string) {
  const direct = scoreFields(query, [field]);
  if (direct.score > 0) return { ...direct, title: field };

  const aliasGroup = CITY_ALIAS_GROUPS.find((group) => group.aliases.includes(query));
  if (!aliasGroup) return { ...direct, title: field };

  for (const alias of aliasGroup.aliases) {
    const aliasScore = scoreFields(alias, [field]);
    if (aliasScore.score > 0) {
      return { score: aliasScore.score, highlight: aliasGroup.displayTitle, title: aliasGroup.displayTitle };
    }
  }

  return { ...direct, title: field };
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @Inject(CacheService) private readonly cacheService: CacheService
  ) {}

  async suggest(query: SearchSuggestionQuery): Promise<SearchSuggestionItem[]> {
    const search = normalizeSearch(query.q);
    const limit = Math.max(1, Math.min(Number(query.limit || 8), 20));
    if (!search) return [];

    const cacheKey = `catalog:search-suggest:v4:${JSON.stringify({ search, limit })}`;
    const cached = await this.cacheService.getJson<SearchSuggestionItem[]>(cacheKey);
    if (cached) return cached;

    const universities = await this.universitiesRepository.find({
      where: { isPublished: true, publicDisplayStatus: "ready" },
      relations: { programs: true },
      order: { qsRank: "ASC" }
    });
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const readyPrograms = publicReadyPrograms(universities.flatMap((university) => university.programs || []), universityMap);
    const suggestions: SearchSuggestionItem[] = [];
    const cityCounts = new Map<string, { universityIds: Set<number>; score: number; highlight: string }>();

    for (const university of universities) {
      const locationFields = [...Object.values(university.location), ...Object.values(university.region)].filter(Boolean);
      const identityScore = scoreFields(search, [
        university.shortName,
        university.nameEnOfficial,
        university.code,
        ...Object.values(university.name)
      ]);
      const locationScore = scoreFields(search, locationFields);

      if (identityScore.score > 0 || locationScore.score > 0 || buildUniversitySearchText(university).includes(search)) {
        suggestions.push({
          type: "university",
          id: `university:${university.id}`,
          universityId: university.id,
          universitySlug: university.slug,
          title: displayText(university.name, university.shortName),
          subtitle: `${university.shortName} · ${displayText(university.location)}`,
          highlight: identityScore.highlight || locationScore.highlight || university.shortName,
          score: identityScore.score ? identityScore.score + 200 : Math.max(locationScore.score - 20, 25)
        });
      }

      for (const field of locationFields) {
        const cityScore = scoreCityField(search, field);
        if (cityScore.score <= 0) continue;
        const current = cityCounts.get(cityScore.title) || { universityIds: new Set<number>(), score: 0, highlight: cityScore.title };
        current.universityIds.add(university.id);
        cityCounts.set(cityScore.title, {
          universityIds: current.universityIds,
          score: Math.max(current.score, cityScore.score),
          highlight: cityScore.highlight || cityScore.title
        });
      }
    }

    for (const program of readyPrograms) {
      const university = universityMap.get(program.universityId);
      if (!university || !isReadyForPublicCatalog(university)) continue;
      const programScore = scoreFields(search, buildProgramSuggestionSearchFields(program));

      if (programScore.score <= 0) continue;
      suggestions.push({
        type: "program",
        id: `program:${program.id}`,
        universityId: university.id,
        universitySlug: university.slug,
        programId: program.id,
        programSlug: program.slug,
        title: displayText(program.name, program.nameEnOfficial),
        subtitle: `${university.shortName} · ${program.level} · ${program.category}`,
        highlight: programScore.highlight || program.category,
        score: (programScore.score || 35) + 120
      });
    }

    for (const [city, item] of cityCounts.entries()) {
      suggestions.push({
        type: "city",
        id: `city:${city}`,
        title: city,
        subtitle: "",
        highlight: item.highlight,
        score: item.score,
        count: item.universityIds.size,
        countType: "university"
      });
    }

    const deduped = new Map<string, SearchSuggestionItem>();
    for (const item of suggestions) {
      const current = deduped.get(item.id);
      if (!current || item.score > current.score) deduped.set(item.id, item);
    }

    const payload = [...deduped.values()]
      .sort((a, b) => b.score - a.score || suggestionTypePriority(b.type) - suggestionTypePriority(a.type) || a.title.localeCompare(b.title))
      .slice(0, limit);
    await this.cacheService.setJson(cacheKey, payload, 300);
    return payload;
  }
}

function suggestionTypePriority(type: SearchSuggestionItem["type"]) {
  if (type === "university") return 3;
  if (type === "program") return 2;
  return 1;
}
