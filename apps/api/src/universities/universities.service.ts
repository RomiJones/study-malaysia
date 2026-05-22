import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CacheService } from "../common/cache.service.js";
import { ContentBlockEntity, ProgramEntity, UniversityEntity } from "../db/entities.js";
import { mapContentBlock, mapProgram, mapUniversity, textContains } from "../common/mappers.js";

export interface UniversityQuery {
  search?: string;
  categories?: string[];
  levels?: string[];
  ownerships?: string[];
  acceptNoLanguage?: boolean;
  qsRankMax?: number;
  tuitionMax?: number;
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
      this.universitiesRepository.find({ where: { isPublished: true } }),
      this.programsRepository.find({ where: { isPublished: true } }),
      this.contentRepository.find()
    ]);

    const payload = {
      stats: {
        universityCount: universities.length,
        programCount: programs.length,
        bestQsRank: universities.reduce((min, item) => Math.min(min, item.qsRank), Number.POSITIVE_INFINITY)
      },
      contentBlocks: content.map(mapContentBlock)
    };

    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }

  async list(query: UniversityQuery) {
    const cacheKey = `catalog:list:${JSON.stringify(query)}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const universities = await this.universitiesRepository.find({
      where: { isPublished: true },
      relations: { programs: true },
      order: { qsRank: "ASC" }
    });

    const filtered = universities.filter((university) => {
      const publishedPrograms = (university.programs || []).filter((program) => program.isPublished);
      if (query.search && !textContains(university, query.search) && !publishedPrograms.some((program) => textContains(program, query.search!))) {
        return false;
      }
      if (query.ownerships?.length && !query.ownerships.includes(university.ownership)) {
        return false;
      }
      if (query.acceptNoLanguage === true && !university.acceptNoLanguage) {
        return false;
      }
      if (query.qsRankMax && university.qsRank > query.qsRankMax) {
        return false;
      }
      if (query.tuitionMax && university.tuitionMinCny > query.tuitionMax) {
        return false;
      }
      if (query.categories?.length && !publishedPrograms.some((program) => query.categories!.includes(program.category))) {
        return false;
      }
      if (query.levels?.length && !publishedPrograms.some((program) => query.levels!.includes(program.level))) {
        return false;
      }
      return true;
    });

    const payload = filtered.map((university) => ({
      ...mapUniversity(university),
      programCount: (university.programs || []).filter((program) => program.isPublished).length || university.programCount
    }));
    await this.cacheService.setJson(cacheKey, payload, 300);
    return payload;
  }

  async getBySlug(slug: string) {
    const cacheKey = `catalog:detail:${slug}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const university = await this.universitiesRepository.findOne({
      where: { slug, isPublished: true },
      relations: { programs: true }
    });

    if (!university) {
      throw new NotFoundException("University not found");
    }

    const payload = {
      ...mapUniversity(university),
      programs: (university.programs || []).filter((program) => program.isPublished).map(mapProgram)
    };
    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }
}
