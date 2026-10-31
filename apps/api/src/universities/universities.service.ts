import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Like, Repository } from "typeorm";
import { DEGREE_LEVEL_ORDER, compareByQsWorldRank, hasValidQsWorldRank } from "@studymy/shared";
import { CacheService } from "../common/cache.service.js";
import { ContentBlockEntity, ProgramEntity, UniversityEntity } from "../db/entities.js";
import { mapContentBlock, mapProgram } from "../common/mappers.js";
import {
  buildCatalogFacets,
  buildProgramGroups,
  compareProgramsForPublicCatalog,
  mapUniversityCatalogItem,
  matchesProgramFilters,
  matchesUniversityFilters,
  publicReadyPrograms,
  textLabel,
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
    scope: "MSU official audit review",
    aliases: ["management-and-science-university", "management-and-science-university-msu", "msu"]
  },
  {
    key: "luc-official-audit-2026",
    querySlugPrefix: "luc-",
    allowedSlugPrefixes: ["luc-official-20260630-row-", "luc-postgraduate-20260705-row-"],
    universityCode: "LUC",
    scope: "LUC official audit review",
    aliases: ["lincoln-university-college", "lincoln-university-college-malaysia", "lincoln-university", "luc"]
  }
] as const;

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

function mapProgramForUniversityDetail(program: ProgramEntity) {
  const item = mapProgram(program);
  return {
    id: item.id,
    universityId: item.universityId,
    slug: item.slug,
    code: item.code,
    name: item.name,
    nameEn: item.nameEn,
    nameEnOfficial: item.nameEnOfficial,
    level: item.level,
    category: item.category,
    faculty: item.faculty,
    facultyZh: item.facultyZh,
    studyMode: item.studyMode,
    campus: item.campus,
    durationYears: item.durationYears,
    durationOfficial: item.durationOfficial,
    annualTuitionCny: item.annualTuitionCny,
    tuitionAmount: item.tuitionAmount,
    tuitionCurrency: item.tuitionCurrency,
    tuitionDisplay: item.tuitionDisplay,
    officialTuitionMYR: item.officialTuitionMYR,
    officialFeeSourceUrl: item.officialFeeSourceUrl,
    secondaryOfficialFeeSourceUrl: item.secondaryOfficialFeeSourceUrl,
    officialFeeAuditStatus: item.officialFeeAuditStatus,
    officialFeeAuditedAt: item.officialFeeAuditedAt,
    tuitionInfo: item.tuitionInfo,
    intakeMonths: item.intakeMonths,
    officialIntake: item.officialIntake,
    officialIntakeNote: item.officialIntakeNote,
    languageRequirement: item.languageRequirement,
    officialLanguageRequirement: item.officialLanguageRequirement,
    requirement: item.requirement,
    officialAcademicRequirement: item.officialAcademicRequirement,
    chinaStudentRequirement: item.chinaStudentRequirement,
    specialRequirementsNote: item.requirementInfo.specialRequirementsNote,
    applicationDocs: item.applicationDocs,
    curriculum: item.curriculum,
    careers: item.careers,
    specializations: item.specializations,
    description: item.description,
    officialAccreditationNote: item.officialAccreditationNote,
    officialSourceUrl: item.officialSourceUrl,
    officialEntryRequirementSourceUrl: item.officialEntryRequirementSourceUrl,
    officialAccreditationSourceUrl: item.officialAccreditationSourceUrl,
    sourceUrls: item.sourceUrls,
    officialVerifiedAt: item.officialVerifiedAt,
    officialSourceStatus: item.officialSourceStatus,
    publicDisplayStatus: item.publicDisplayStatus,
    publicDisplayNote: item.publicDisplayNote,
    reviewReason: item.reviewReason,
    auditNote: item.auditNote,
    listTuitionText: item.listTuitionText,
    requirements: item.requirements,
    requirementInfo: item.requirementInfo
  };
}

function buildCompactProgramGroups(programs: ProgramEntity[]) {
  return buildProgramGroups(programs).map((group) => ({
    level: group.level,
    label: group.label,
    count: group.count,
    items: []
  }));
}

function buildCatalogStatusSummary(programs: ProgramEntity[]) {
  const summarize = (items: ProgramEntity[]) => {
    const currentCycleNotOpen = items.filter((program) => program.publicDisplayStatus === "current-cycle-not-open").length;
    const officialLanguageRequirementNotPublished = items.filter(
      (program) => program.publicDisplayStatus === "official-language-requirement-not-published"
    ).length;
    const summary: Record<string, number> = {
      total: items.length,
      ready: items.filter((program) => program.isPublished && program.publicDisplayStatus === "ready").length,
      needsReview: items.filter((program) => program.publicDisplayStatus === "needs-review").length,
      notAvailableForInternational: items.filter(
      (program) => program.publicDisplayStatus === "not-available-for-international"
      ).length
    };
    if (currentCycleNotOpen > 0) summary.currentCycleNotOpen = currentCycleNotOpen;
    if (officialLanguageRequirementNotPublished > 0) {
      summary.officialLanguageRequirementNotPublished = officialLanguageRequirementNotPublished;
    }
    return summary;
  };
  return {
    all: summarize(programs),
    byLevel: Object.fromEntries(
      DEGREE_LEVEL_ORDER.map((level) => [level, summarize(programs.filter((program) => program.level === level))])
    )
  };
}

function officialCatalogStatusSummary(university: UniversityEntity, publicPrograms: ProgramEntity[]) {
  const profile = university.officialProfile;
  if (profile && typeof profile === "object" && "catalogStatusSummary" in profile) {
    const summary = profile.catalogStatusSummary as {
      all?: { total?: number; needsReview?: number };
      byLevel?: Record<string, { total?: number; needsReview?: number }>;
    };
    if (summary && typeof summary === "object") {
      const profileTotal = Number(summary.all?.total ?? 0);
      const profileNeedsReview = Number(summary.all?.needsReview ?? 0);
      const hasVisibleLevelGap = DEGREE_LEVEL_ORDER.some((level) => {
        const actual = publicPrograms.filter((program) => program.level === level).length;
        const profiled = Number(summary.byLevel?.[level]?.total ?? 0);
        return actual > 0 && profiled === 0;
      });
      const hasReviewSummary = profileNeedsReview > 0 || DEGREE_LEVEL_ORDER.some((level) => Number(summary.byLevel?.[level]?.needsReview ?? 0) > 0);
      if (profileTotal >= publicPrograms.length && !hasVisibleLevelGap && !hasReviewSummary) return summary;
    }
    return buildCatalogStatusSummary(publicPrograms);
  }
  return buildCatalogStatusSummary(publicPrograms);
}

function compareUniversitiesForPublicList(
  a: UniversityEntity,
  b: UniversityEntity
) {
  return compareByQsWorldRank(a, b);
}

function getReviewPreviewConfig(slug: string, key?: string | null) {
  const config = reviewPreviewConfigs.find((item) => item.key === key && (item.aliases as readonly string[]).includes(slug));
  if (!config) throw new NotFoundException("University not found");
  return config;
}

function isReviewPreviewSlug(config: typeof reviewPreviewConfigs[number], slug: string) {
  return config.allowedSlugPrefixes.some((slugPrefix) => slug.startsWith(slugPrefix));
}

function buildUniversityDetailPayload(university: UniversityEntity, publicPrograms: ProgramEntity[]) {
  const mappedUniversity = mapUniversityCatalogItem(university, publicPrograms);
  const qsRankValue = mappedUniversity.qsRankDisplay
    ? `QS WUR ${mappedUniversity.qsRankYear || 2027} #${mappedUniversity.qsRankDisplay}`
    : "Not ranked in QS WUR 2027";

  return {
    ...mappedUniversity,
    programs: publicPrograms.map(mapProgramForUniversityDetail),
    programGroups: buildCompactProgramGroups(publicPrograms),
    catalogStatusSummary: officialCatalogStatusSummary(university, publicPrograms),
    applicationInfo: {
      applicationPortalUrl: university.applicationPortalUrl || "",
      applicationPeriods: university.applicationPeriods || [],
      applicationFees: university.applicationFees || [],
      applicationDocuments: university.applicationDocuments || { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
      chinaStudentRequirements: university.chinaStudentRequirements || { en: [], ms: [], "zh-CN": [], "zh-TW": [] }
    },
    compareFields: [
      { key: "qsRank", label: textLabel("QS World University Rankings 2027"), value: qsRankValue },
      { key: "institutionType", label: textLabel("Institution type"), value: university.institutionType },
      { key: "ownership", label: textLabel("Ownership"), value: university.ownership },
      { key: "tuitionRange", label: textLabel("Tuition range"), value: [university.tuitionMinCny, university.tuitionMaxCny] },
      { key: "livingCostCny", label: textLabel("Living cost"), value: university.livingCostCny },
      { key: "minIelts", label: textLabel("Minimum IELTS"), value: university.minIelts },
      { key: "programCount", label: textLabel("Ready programs"), value: publicPrograms.length }
    ]
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
        where: { isPublished: true, publicDisplayStatus: In(visibleProgramStatuses) },
        relations: { university: true }
      }),
      this.contentRepository.find()
    ]);
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const readyPrograms = publicReadyPrograms(programs, universityMap);
    const rankedQsValues = universities.map((item) => item.qsRank).filter(hasValidQsWorldRank);

    const payload = {
      stats: {
        universityCount: universities.length,
        programCount: readyPrograms.length,
        readyProgramCount: readyPrograms.length,
        bestQsRank: rankedQsValues.length ? Math.min(...rankedQsValues) : null,
        officialVerifiedCount: universities.filter((item) => item.officialSourceStatus === "official-verified").length
      },
      contentBlocks: content.map(mapContentBlock)
    };

    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }

  async list(query: UniversityQuery = {}) {
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
    const sortedFiltered = [...filtered].sort(compareUniversitiesForPublicList);

    const payload = sortedFiltered.map((university) => ({
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
      "asia-pacific-university": "APU",
      "asia-pacific-university-of-technology-and-innovation": "APU",
      "asia-pacific-university-of-technology-and-innovation-apu": "APU",
      apu: "APU",
      "universiti-malaya-um": "UM",
      "universiti-putra-malaysia": "UPM",
      "universiti-putra-malaysia-upm": "UPM",
      upm: "UPM",
      um: "UM",
      "universiti-utara-malaysia": "UUM",
      "universiti-utara-malaysia-uum": "UUM",
      uum: "UUM",
      "universiti-malaysia-pahang-al-sultan-abdullah": "UMPSA",
      "universiti-malaysia-pahang-al-sultan-abdullah-umpsa": "UMPSA",
      umpsa: "UMPSA"
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

    const universityMap = new Map<number, UniversityEntity>([[university.id, university]]);
    const allPrograms = university.programs || [];
    const publicPrograms = publicReadyPrograms(allPrograms, universityMap).sort(compareProgramsForPublicCatalog);
    const payload = buildUniversityDetailPayload(university, publicPrograms);
    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }

  async getReviewPreview(slug: string, key?: string | null) {
    const config = getReviewPreviewConfig(slug, key);
    const university = await this.universitiesRepository.findOne({
      where: { code: config.universityCode },
      relations: { programs: true }
    });
    if (!university) throw new NotFoundException("University not found");

    const candidatePrograms = await this.programsRepository.find({
      where: {
        universityId: university.id,
        slug: Like(`${config.querySlugPrefix}%`),
        publicDisplayStatus: In(["needs-review", "ready"])
      },
      order: { code: "ASC" }
    });
    const reviewPrograms = candidatePrograms.filter((program) => isReviewPreviewSlug(config, program.slug));
    return {
      ...buildUniversityDetailPayload(university, reviewPrograms),
      reviewPreview: {
        scope: config.scope,
        programmeCount: reviewPrograms.length
      }
    };
  }

}
