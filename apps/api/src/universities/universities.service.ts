import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CacheService } from "../common/cache.service.js";
import { ContentBlockEntity, ProgramEntity, UniversityEntity } from "../db/entities.js";
import { mapContentBlock, mapProgram } from "../common/mappers.js";
import {
  buildCatalogFacets,
  buildProgramGroups,
  mapUniversityCatalogItem,
  matchesProgramFilters,
  matchesUniversityFilters,
  publicReadyPrograms,
  textLabel,
  toListResponse,
  type PublicCatalogQuery
} from "../common/public-catalog.js";

export interface UniversityQuery {
  search?: string;
  categories?: string[];
  levels?: string[];
  ownerships?: string[];
  types?: string[];
  institutionTypes?: string[];
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

function normalizeQuery(query: UniversityQuery): PublicCatalogQuery {
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

function buildCatalogStatusSummary(university: UniversityEntity, programs: ProgramEntity[]) {
  const profile = university.officialProfile;
  if (profile && typeof profile === "object" && "catalogStatusSummary" in profile) {
    const summary = profile.catalogStatusSummary;
    if (summary && typeof summary === "object") return summary;
  }
  const summarize = (items: ProgramEntity[]) => ({
    total: items.length,
    ready: items.filter((program) => program.isPublished && program.publicDisplayStatus === "ready").length,
    needsReview: items.filter((program) => program.publicDisplayStatus === "needs-review").length,
    notAvailableForInternational: items.filter(
      (program) => program.publicDisplayStatus === "not-available-for-international"
    ).length
  });
  return {
    all: summarize(programs),
    byLevel: {
      bachelor: summarize(programs.filter((program) => program.level === "bachelor")),
      master: summarize(programs.filter((program) => program.level === "master")),
      phd: summarize(programs.filter((program) => program.level === "phd"))
    }
  };
}

@Injectable()
export class UniversitiesService {
  private readonly universitiesRepository: Repository<UniversityEntity>;
  private readonly programsRepository: Repository<ProgramEntity>;
  private readonly contentRepository: Repository<ContentBlockEntity>;
  private readonly cacheService: CacheService;

  constructor(
    @InjectRepository(UniversityEntity) universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) programsRepository: Repository<ProgramEntity>,
    @InjectRepository(ContentBlockEntity) contentRepository: Repository<ContentBlockEntity>,
    @Inject(CacheService) cacheService: CacheService
  ) {
    this.universitiesRepository = universitiesRepository;
    this.programsRepository = programsRepository;
    this.contentRepository = contentRepository;
    this.cacheService = cacheService;
  }

  async getHomeMeta() {
    const cacheKey = "catalog:home-meta";
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const [universities, programs, content] = await Promise.all([
      this.universitiesRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } }),
      this.programsRepository.find({
        where: { isPublished: true, publicDisplayStatus: In(["ready", "not-available-for-international"]) },
        relations: { university: true }
      }),
      this.contentRepository.find()
    ]);
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const readyPrograms = publicReadyPrograms(programs, universityMap);

    const payload = {
      stats: {
        universityCount: universities.length,
        programCount: readyPrograms.length,
        readyProgramCount: readyPrograms.length,
        bestQsRank: universities.length ? universities.reduce((min, item) => Math.min(min, item.qsRank), Number.POSITIVE_INFINITY) : null,
        officialVerifiedCount: universities.filter((item) => item.officialSourceStatus === "official-verified").length
      },
      contentBlocks: content.map(mapContentBlock)
    };

    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }

  async list(query: UniversityQuery) {
    const normalizedQuery = normalizeQuery(query);
    const cacheKey = `catalog:list:${JSON.stringify(normalizedQuery)}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const universities = await this.universitiesRepository.find({
      where: { isPublished: true, publicDisplayStatus: "ready" },
      relations: { programs: true },
      order: { qsRank: "ASC" }
    });
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const readyPrograms = publicReadyPrograms(universities.flatMap((university) => university.programs || []), universityMap);

    const filtered = universities.filter((university) => {
      const universityReadyPrograms = readyPrograms.filter((program) => program.universityId === university.id);
      return matchesUniversityFilters(university, universityReadyPrograms, normalizedQuery);
    });
    const filteredIds = new Set(filtered.map((university) => university.id));
    const filteredPrograms = readyPrograms.filter((program) => {
      const university = universityMap.get(program.universityId);
      return Boolean(university && filteredIds.has(university.id) && matchesProgramFilters(program, university, normalizedQuery));
    });
    const facetPayload = buildCatalogFacets(universities, readyPrograms, normalizedQuery, filtered, filteredPrograms);

    const payload = filtered.map((university) => ({
      ...mapUniversityCatalogItem(university, readyPrograms.filter((program) => program.universityId === university.id))
    }));
    const response = normalizedQuery.includeMeta || normalizedQuery.page || normalizedQuery.pageSize
      ? toListResponse(payload, normalizedQuery, facetPayload.facets, facetPayload.activeFilters)
      : payload;
    await this.cacheService.setJson(cacheKey, response, 300);
    return response;
  }

  async getFacets(query: UniversityQuery) {
    const normalizedQuery = normalizeQuery(query);
    const cacheKey = `catalog:university-facets:${JSON.stringify(normalizedQuery)}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const universities = await this.universitiesRepository.find({
      where: { isPublished: true, publicDisplayStatus: "ready" },
      relations: { programs: true },
      order: { qsRank: "ASC" }
    });
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const readyPrograms = publicReadyPrograms(universities.flatMap((university) => university.programs || []), universityMap);
    const filteredUniversities = universities.filter((university) =>
      matchesUniversityFilters(university, readyPrograms.filter((program) => program.universityId === university.id), normalizedQuery)
    );
    const filteredIds = new Set(filteredUniversities.map((university) => university.id));
    const filteredPrograms = readyPrograms.filter((program) => {
      const university = universityMap.get(program.universityId);
      return Boolean(university && filteredIds.has(university.id) && matchesProgramFilters(program, university, normalizedQuery));
    });
    const payload = buildCatalogFacets(universities, readyPrograms, normalizedQuery, filteredUniversities, filteredPrograms);
    await this.cacheService.setJson(cacheKey, payload, 300);
    return payload;
  }

  async getBySlug(slug: string) {
    const cacheKey = `catalog:detail:${slug}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    let university = await this.universitiesRepository.findOne({
      where: { slug, isPublished: true, publicDisplayStatus: "ready" },
      relations: { programs: true }
    });

    const slugAliases: Record<string, string> = {
      "universiti-malaya-um": "UM",
      um: "UM"
    };

    if (!university && slugAliases[slug]) {
      university = await this.universitiesRepository.findOne({
        where: { code: slugAliases[slug], isPublished: true, publicDisplayStatus: "ready" },
        relations: { programs: true }
      });
    }

    if (!university) {
      throw new NotFoundException("University not found");
    }

    const allPrograms = university.programs || [];
    const publicPrograms = publicReadyPrograms(allPrograms, new Map<number, UniversityEntity>([[university.id, university]]));
    const payload = {
      ...mapUniversityCatalogItem(university, publicPrograms),
      programs: publicPrograms.map(mapProgram),
      programGroups: buildProgramGroups(publicPrograms),
      catalogStatusSummary: buildCatalogStatusSummary(university, allPrograms),
      applicationInfo: {
        applicationPortalUrl: university.applicationPortalUrl || "",
        applicationPeriods: university.applicationPeriods || [],
        applicationFees: university.applicationFees || [],
        applicationDocuments: university.applicationDocuments || { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
        chinaStudentRequirements: university.chinaStudentRequirements || { en: [], ms: [], "zh-CN": [], "zh-TW": [] }
      },
      compareFields: [
        { key: "qsRank", label: textLabel("QS ranking"), value: university.qsRank },
        { key: "institutionType", label: textLabel("Institution type"), value: university.institutionType },
        { key: "ownership", label: textLabel("Ownership"), value: university.ownership },
        { key: "tuitionRange", label: textLabel("Tuition range"), value: [university.tuitionMinCny, university.tuitionMaxCny] },
        { key: "livingCostCny", label: textLabel("Living cost"), value: university.livingCostCny },
        { key: "minIelts", label: textLabel("Minimum IELTS"), value: university.minIelts },
        { key: "programCount", label: textLabel("Ready programs"), value: publicPrograms.length }
      ]
    };
    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }
}
