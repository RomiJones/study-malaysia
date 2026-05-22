import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { SearchSuggestionItem } from "@studymy/shared";
import { Repository } from "typeorm";
import { CacheService } from "../common/cache.service.js";
import { isReadyForPublicCatalog } from "../common/mappers.js";
import { buildProgramSearchText, buildUniversitySearchText, normalizeSearch, publicReadyPrograms } from "../common/public-catalog.js";
import { ProgramEntity, UniversityEntity } from "../db/entities.js";

export interface SearchSuggestionQuery {
  q?: string;
  limit?: number;
}

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

    const cacheKey = `catalog:search-suggest:${JSON.stringify({ search, limit })}`;
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
    const cityCounts = new Map<string, { count: number; score: number; highlight: string }>();

    for (const university of universities) {
      const locationFields = [...Object.values(university.location), ...Object.values(university.region)].filter(Boolean);
      const universityScore = scoreFields(search, [
        university.shortName,
        university.nameEnOfficial,
        university.code,
        ...Object.values(university.name),
        ...locationFields
      ]);

      if (universityScore.score > 0 || buildUniversitySearchText(university).includes(search)) {
        suggestions.push({
          type: "university",
          id: `university:${university.id}`,
          universityId: university.id,
          universitySlug: university.slug,
          title: displayText(university.name, university.shortName),
          subtitle: `${university.shortName} · ${displayText(university.location)}`,
          highlight: universityScore.highlight || university.shortName,
          score: universityScore.score || 35
        });
      }

      for (const field of locationFields) {
        const cityScore = scoreFields(search, [field]);
        if (cityScore.score <= 0) continue;
        const current = cityCounts.get(field) || { count: 0, score: 0, highlight: field };
        cityCounts.set(field, {
          count: current.count + 1,
          score: Math.max(current.score, cityScore.score),
          highlight: cityScore.highlight || field
        });
      }
    }

    for (const program of readyPrograms) {
      const university = universityMap.get(program.universityId);
      if (!university || !isReadyForPublicCatalog(university)) continue;
      const programScore = scoreFields(search, [
        program.nameEnOfficial,
        program.category,
        program.facultyZh,
        ...Object.values(program.name),
        ...Object.values(program.faculty)
      ]);

      if (programScore.score <= 0 && !buildProgramSearchText(program).includes(search)) continue;
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
        score: (programScore.score || 35) + 5
      });
    }

    for (const [city, item] of cityCounts.entries()) {
      suggestions.push({
        type: "city",
        id: `city:${city}`,
        title: city,
        subtitle: `${item.count} universities`,
        highlight: item.highlight,
        score: item.score - 5
      });
    }

    const deduped = new Map<string, SearchSuggestionItem>();
    for (const item of suggestions) {
      const current = deduped.get(item.id);
      if (!current || item.score > current.score) deduped.set(item.id, item);
    }

    const payload = [...deduped.values()]
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, limit);
    await this.cacheService.setJson(cacheKey, payload, 300);
    return payload;
  }
}
