import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { DegreeLevel, ProgramCategory, RecommendationResult } from "@studymy/shared";
import { CacheService } from "../common/cache.service.js";
import { ProgramEntity, UniversityEntity } from "../db/entities.js";
import { buildRecommendation, mapProgram, mapUniversity } from "../common/mappers.js";

export interface RecommendationQuery {
  level?: DegreeLevel;
  targetCategory?: ProgramCategory;
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

  async list() {
    const cacheKey = "catalog:programs";
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const programs = await this.programsRepository.find({ where: { isPublished: true }, order: { createdAt: "DESC" } });
    const payload = programs.map(mapProgram);
    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }

  async getBySlug(slug: string) {
    const cacheKey = `catalog:program:${slug}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const program = await this.programsRepository.findOne({ where: { slug, isPublished: true } });
    if (!program) {
      throw new NotFoundException("Program not found");
    }

    const university = await this.universitiesRepository.findOneBy({ id: program.universityId, isPublished: true });
    if (!university) {
      throw new NotFoundException("University not found");
    }

    const payload = {
      ...mapProgram(program),
      university: mapUniversity(university)
    };
    await this.cacheService.setJson(cacheKey, payload, 600);
    return payload;
  }

  async costEstimate(programId: number) {
    const cacheKey = `catalog:cost:${programId}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const program = await this.programsRepository.findOneBy({ id: programId, isPublished: true });
    if (!program) {
      throw new NotFoundException("Program not found");
    }
    const university = await this.universitiesRepository.findOneBy({ id: program.universityId, isPublished: true });
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

    const universities = await this.universitiesRepository.find({ where: { isPublished: true } });
    const programs = await this.programsRepository.find({ where: { isPublished: true } });
    const universityMap = new Map(universities.map((item) => [item.id, item]));
    const results: RecommendationResult[] = [];

    for (const program of programs) {
      const university = universityMap.get(program.universityId);
      if (!university) continue;
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
