import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Like, Repository } from "typeorm";
import { hasValidQsWorldRank, type DegreeLevel, type ProgramCategoryCode, type RecommendationResult } from "@studymy/shared";
import { CacheService } from "../common/cache.service.js";
import { getFilterableTuitionCny } from "../common/fee-strategy.helper.js";
import { ProgramEntity, UniversityEntity } from "../db/entities.js";
import { buildRecommendation, isReadyForPublicCatalog, mapProgram, mapUniversity } from "../common/mappers.js";
import {
  buildCatalogFacets,
  compareProgramsForPublicCatalog,
  mapProgramCatalogItem,
  matchesProgramFilters,
  publicReadyPrograms,
  toListResponse,
  type PublicCatalogQuery
} from "../common/public-catalog.js";

const visibleProgramStatuses = [
  "ready",
  "current-cycle-not-open",
  "official-language-requirement-not-published",
  "not-available-for-international"
] as const;
const reviewPreviewConfigs = [
  {
    key: "msu-official-audit-2026",
    querySlugPrefix: "msu-review-",
    allowedSlugPrefixes: ["msu-review-"],
    universityCode: "MSU",
    scope: "MSU official audit review"
  },
  {
    key: "luc-official-audit-2026",
    querySlugPrefix: "luc-",
    allowedSlugPrefixes: ["luc-official-20260630-row-", "luc-postgraduate-20260705-row-"],
    universityCode: "LUC",
    scope: "LUC official audit review"
  },
  {
    key: "umt-undergraduate-audit-2026",
    querySlugPrefix: "umt-",
    allowedSlugPrefixes: ["umt-undergraduate-20260706-row-"],
    universityCode: "UMT",
    scope: "UMT undergraduate official audit review"
  }
] as const;

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

function getReviewPreviewConfig(key?: string | null) {
  const config = reviewPreviewConfigs.find((item) => item.key === key);
  if (!config) throw new NotFoundException("Program not found");
  return config;
}

function isReviewPreviewSlug(config: typeof reviewPreviewConfigs[number], slug: string) {
  return config.allowedSlugPrefixes.some((slugPrefix) => slug.startsWith(slugPrefix));
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
      this.programsRepository.find({
        where: { isPublished: true, publicDisplayStatus: In(visibleProgramStatuses) },
        relations: { university: true },
        order: { createdAt: "DESC" }
      }),
      this.universitiesRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } })
    ]);
    const universityMap = new Map(universities.map((university) => [university.id, university]));

    const readyPrograms = publicReadyPrograms(programs, universityMap).filter((program) => universityMap.has(program.universityId));
    const filtered = readyPrograms.filter((program) => {
      const university = universityMap.get(program.universityId);
      if (!university) return false;
      if (query.universityId && program.universityId !== query.universityId) return false;
      return matchesProgramFilters(program, university, normalizedQuery);
    });
    const filteredUniversities = [...new Set(filtered.map((program) => program.universityId))]
      .map((id) => universityMap.get(id))
      .filter((university): university is UniversityEntity => Boolean(university));
    const sorted = [...filtered].sort(compareProgramsForPublicCatalog);
    const facetPayload = buildCatalogFacets(universities, readyPrograms, normalizedQuery, filteredUniversities, filtered);
    const payload = sorted.map((program) => mapProgramCatalogItem(program, universityMap.get(program.universityId)!));
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
      this.programsRepository.find({
        where: { isPublished: true, publicDisplayStatus: In(visibleProgramStatuses) },
        relations: { university: true }
      }),
      this.universitiesRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } })
    ]);
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const readyPrograms = publicReadyPrograms(programs, universityMap).filter((program) => universityMap.has(program.universityId));
    const filteredPrograms = readyPrograms.filter((program) => {
      const university = universityMap.get(program.universityId);
      if (!university) return false;
      if (query.universityId && program.universityId !== query.universityId) return false;
      return matchesProgramFilters(program, university, normalizedQuery);
    });
    const filteredUniversities = [...new Set(filteredPrograms.map((program) => program.universityId))]
      .map((id) => universityMap.get(id))
      .filter((university): university is UniversityEntity => Boolean(university));
    const payload = buildCatalogFacets(universities, readyPrograms, normalizedQuery, filteredUniversities, filteredPrograms, "program");
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
        ? { id: numericId, isPublished: true, publicDisplayStatus: In(visibleProgramStatuses) }
        : { slug: identifier, isPublished: true, publicDisplayStatus: In(visibleProgramStatuses) },
      relations: { university: true }
    });
    if (!program) {
      throw new NotFoundException("Program not found");
    }

    const university = await this.universitiesRepository.findOneBy({ id: program.universityId, isPublished: true, publicDisplayStatus: "ready" });
    if (!university || !isReadyForPublicCatalog(university)) {
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

  async getReviewPreviewByIdentifier(identifier: string, key?: string | null) {
    const config = getReviewPreviewConfig(key);
    const numericId = /^\d+$/.test(identifier) ? Number(identifier) : null;
    const program = await this.programsRepository.findOne({
      where: numericId
        ? { id: numericId, slug: Like(`${config.querySlugPrefix}%`) }
        : { slug: identifier },
      relations: { university: true }
    });
    if (
      !program ||
      !isReviewPreviewSlug(config, program.slug) ||
      program.university?.code !== config.universityCode ||
      !["needs-review", "ready"].includes(String(program.publicDisplayStatus))
    ) {
      throw new NotFoundException("Program not found");
    }

    const university = program.university || await this.universitiesRepository.findOneBy({ id: program.universityId, code: config.universityCode });
    if (!university) throw new NotFoundException("University not found");

    return {
      ...mapProgramCatalogItem(program, university),
      directTarget: {
        universityId: university.id,
        universitySlug: university.slug,
        programId: program.id,
        programSlug: program.slug
      },
      reviewPreview: {
        scope: config.scope
      }
    };
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

    const filterableTuitionCny = getFilterableTuitionCny(program);
    if (filterableTuitionCny == null) {
      throw new BadRequestException("Program fee is not verified for cost estimate");
    }
    const tuitionTotal = Math.round(filterableTuitionCny * Number(program.durationYears));
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

      const filterableTuitionCny = getFilterableTuitionCny(program);
      const annualCost = filterableTuitionCny == null ? null : filterableTuitionCny + university.livingCostCny;
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
      if (annualCost != null && (query.budgetCny ?? 0) >= annualCost) {
        score += 22;
        reasons.en.push("Budget covers first-year cost");
        reasons.ms.push("Bajet meliputi kos tahun pertama");
        reasons["zh-CN"].push("预算可覆盖首年成本");
        reasons["zh-TW"].push("預算可覆蓋首年成本");
      }
      if (hasValidQsWorldRank(university.qsRank) && university.qsRank <= 100) {
        score += 15;
      } else if (hasValidQsWorldRank(university.qsRank) && university.qsRank <= 300) {
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
