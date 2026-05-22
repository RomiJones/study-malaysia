import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { DegreeLevel, ProgramCategoryCode, RecommendationResult } from "@studymy/shared";
import { CacheService } from "../common/cache.service.js";
import { ProgramEntity, UniversityEntity } from "../db/entities.js";
import { buildRecommendation, isReadyForPublicCatalog, mapProgram, mapUniversity } from "../common/mappers.js";
import {
  buildCatalogFacets,
  mapProgramCatalogItem,
  matchesProgramFilters,
  publicReadyPrograms,
  toListResponse,
  type PublicCatalogQuery
} from "../common/public-catalog.js";

export interface ProgramQuery {
  search?: string;
  categories?: string[];
  levels?: string[];
  ownerships?: string[];
  types?: string[];
  institutionTypes?: string[];
  universityId?: number;
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

function normalizeQuery(query: ProgramQuery): PublicCatalogQuery {
  const typeValues = query.types || [];
  const ownershipValues = new Set([...(query.ownerships || []), ...typeValues.filter((value) => value === "public" || value === "private")]);
  const institutionTypeValues = new Set([
    ...(query.institutionTypes || []),
    ...typeValues.filter((value) => value === "research" || value === "comprehensive" || value === "applied")
  ]);

  return {
    ...query,
    ownerships: [...ownershipValues] as PublicCatalogQuery["ownerships"],
    institutionTypes: [...institutionTypeValues] as PublicCatalogQuery["institutionTypes"],
    levels: query.levels as PublicCatalogQuery["levels"]
  };
}

export interface RecommendationQuery {
  level?: DegreeLevel;
  targetCategory?: ProgramCategoryCode;
  budgetCny?: number;
  gpa?: number;
  ielts?: number;
  acceptNoLanguage?: boolean;
}

@Injectable()
export class ProgramsService {
  private readonly programsRepository: Repository<ProgramEntity>;
  private readonly universitiesRepository: Repository<UniversityEntity>;
  private readonly cacheService: CacheService;

  constructor(
    @InjectRepository(ProgramEntity) programsRepository: Repository<ProgramEntity>,
    @InjectRepository(UniversityEntity) universitiesRepository: Repository<UniversityEntity>,
    @Inject(CacheService) cacheService: CacheService
  ) {
    this.programsRepository = programsRepository;
    this.universitiesRepository = universitiesRepository;
    this.cacheService = cacheService;
  }

  async list(query: ProgramQuery = {}) {
    const normalizedQuery = normalizeQuery(query);
    const cacheKey = `catalog:programs:${JSON.stringify({ ...normalizedQuery, universityId: query.universityId })}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const [programs, universities] = await Promise.all([
      this.programsRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" }, relations: { university: true }, order: { createdAt: "DESC" } }),
      this.universitiesRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } })
    ]);
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    for (const program of programs) {
      if (program.university) universityMap.set(program.universityId, program.university);
    }

    const readyPrograms = publicReadyPrograms(programs, universityMap);
    const filtered = readyPrograms.filter((program) => {
      const university = universityMap.get(program.universityId);
      if (!university) return false;
      if (query.universityId && program.universityId !== query.universityId) return false;
      return matchesProgramFilters(program, university, normalizedQuery);
    });
    const filteredUniversities = [...new Set(filtered.map((program) => program.universityId))]
      .map((id) => universityMap.get(id))
      .filter((university): university is UniversityEntity => Boolean(university));
    const facetPayload = buildCatalogFacets(universities, readyPrograms, normalizedQuery, filteredUniversities, filtered);
    const payload = filtered.map((program) => mapProgramCatalogItem(program, universityMap.get(program.universityId)!));
    const response = normalizedQuery.includeMeta || normalizedQuery.page || normalizedQuery.pageSize
      ? toListResponse(payload, normalizedQuery, facetPayload.facets, facetPayload.activeFilters)
      : payload;
    await this.cacheService.setJson(cacheKey, response, 600);
    return response;
  }

  async getFacets(query: ProgramQuery = {}) {
    const normalizedQuery = normalizeQuery(query);
    const cacheKey = `catalog:program-facets:${JSON.stringify({ ...normalizedQuery, universityId: query.universityId })}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const [programs, universities] = await Promise.all([
      this.programsRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" }, relations: { university: true } }),
      this.universitiesRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } })
    ]);
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    for (const program of programs) {
      if (program.university) universityMap.set(program.universityId, program.university);
    }
    const readyPrograms = publicReadyPrograms(programs, universityMap);
    const filteredPrograms = readyPrograms.filter((program) => {
      const university = universityMap.get(program.universityId);
      if (!university) return false;
      if (query.universityId && program.universityId !== query.universityId) return false;
      return matchesProgramFilters(program, university, normalizedQuery);
    });
    const filteredUniversities = [...new Set(filteredPrograms.map((program) => program.universityId))]
      .map((id) => universityMap.get(id))
      .filter((university): university is UniversityEntity => Boolean(university));
    const payload = buildCatalogFacets(universities, readyPrograms, normalizedQuery, filteredUniversities, filteredPrograms);
    await this.cacheService.setJson(cacheKey, payload, 300);
    return payload;
  }

  async getBySlug(slug: string) {
    return this.getByIdentifier(slug);
  }

  async getByIdentifier(identifier: string) {
    const cacheKey = `catalog:program:${identifier}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const numericId = /^\d+$/.test(identifier) ? Number(identifier) : null;
    const program = await this.programsRepository.findOne({
      where: numericId
        ? { id: numericId, isPublished: true, publicDisplayStatus: "ready" }
        : { slug: identifier, isPublished: true, publicDisplayStatus: "ready" },
      relations: { university: true }
    });
    if (!program) {
      throw new NotFoundException("Program not found");
    }

    const university = program.university || await this.universitiesRepository.findOneBy({ id: program.universityId, isPublished: true, publicDisplayStatus: "ready" });
    if (!university) {
      throw new NotFoundException("University not found");
    }

    const payload = {
      ...mapProgramCatalogItem(program, university),
      directTarget: {
        universityId: university.id,
        universitySlug: university.slug,
        programId: program.id,
        programSlug: program.slug
      }
    };
    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }

  async costEstimate(programId: number) {
    const cacheKey = `catalog:cost:${programId}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const program = await this.programsRepository.findOneBy({ id: programId, isPublished: true, publicDisplayStatus: "ready" });
    if (!program) {
      throw new NotFoundException("Program not found");
    }
    const university = await this.universitiesRepository.findOneBy({ id: program.universityId, isPublished: true, publicDisplayStatus: "ready" });
    if (!university) {
      throw new NotFoundException("University not found");
    }

    const tuitionTotal = Math.round(program.annualTuitionCny * Number(program.durationYears));
    const livingTotal = Math.round(university.livingCostCny * Number(program.durationYears));
    const payload = {
      tuitionTotal,
      livingTotal,
      grandTotal: tuitionTotal + livingTotal,
      durationYears: Number(program.durationYears),
      university: mapUniversity(university),
      program: mapProgram(program)
    };

    await this.cacheService.setJson(cacheKey, payload, 300);
    return payload;
  }

  async recommend(query: RecommendationQuery): Promise<RecommendationResult[]> {
    const cacheKey = `catalog:recommend:${JSON.stringify(query)}`;
    const cached = await this.cacheService.getJson<RecommendationResult[]>(cacheKey);
    if (cached) return cached;

    const universities = await this.universitiesRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } });
    const programs = await this.programsRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } });
    const universityMap = new Map(universities.map((item) => [item.id, item]));
    const results: RecommendationResult[] = [];

    for (const program of programs) {
      const university = universityMap.get(program.universityId);
      if (!university) continue;
      if (!isReadyForPublicCatalog(program) || !isReadyForPublicCatalog(university)) continue;
      if (query.level && program.level !== query.level) continue;
      if (query.targetCategory && program.category !== query.targetCategory) continue;

      const annualCost = program.annualTuitionCny + university.livingCostCny;
      let score = 0;
      const reasons = { en: [] as string[], ms: [] as string[], "zh-CN": [] as string[], "zh-TW": [] as string[] };

      if ((query.gpa ?? 0) >= program.requirement.gpa) {
        score += 30;
        reasons.en.push("Academic threshold matched");
        reasons.ms.push("Kelayakan akademik dipenuhi");
        reasons["zh-CN"].push("学术门槛匹配");
        reasons["zh-TW"].push("學術門檻匹配");
      }
      if ((query.ielts ?? 0) >= program.languageRequirement.ielts) {
        score += 24;
        reasons.en.push("Language score matched");
        reasons.ms.push("Skor bahasa memenuhi syarat");
        reasons["zh-CN"].push("语言成绩达标");
        reasons["zh-TW"].push("語言成績達標");
      } else if (query.acceptNoLanguage && university.acceptNoLanguage) {
        score += 14;
        reasons.en.push("Conditional or language pathway available");
        reasons.ms.push("Laluan conditional atau bahasa tersedia");
        reasons["zh-CN"].push("支持条件录取或语言衔接");
        reasons["zh-TW"].push("支援條件錄取或語言銜接");
      }
      if ((query.budgetCny ?? 0) >= annualCost) {
        score += 22;
        reasons.en.push("Budget covers first-year cost");
        reasons.ms.push("Bajet meliputi kos tahun pertama");
        reasons["zh-CN"].push("预算可覆盖首年成本");
        reasons["zh-TW"].push("預算可覆蓋首年成本");
      }
      if (university.qsRank <= 100) {
        score += 15;
      } else if (university.qsRank <= 300) {
        score += 9;
      }

      if (score >= 28) {
        results.push(buildRecommendation(university, program, score, reasons));
      }
    }

    const payload = results.sort((a, b) => b.score - a.score).slice(0, 8);
    await this.cacheService.setJson(cacheKey, payload, 300);
    return payload;
  }
}
