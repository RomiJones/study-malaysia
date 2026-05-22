import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CacheService } from "../common/cache.service.js";
import { FavoriteEntity, ProgramEntity, UniversityEntity } from "../db/entities.js";
import { mapProgram, mapUniversity } from "../common/mappers.js";

@Injectable()
export class FavoritesService {
  private readonly favoritesRepository: Repository<FavoriteEntity>;
  private readonly universitiesRepository: Repository<UniversityEntity>;
  private readonly programsRepository: Repository<ProgramEntity>;
  private readonly cacheService: CacheService;

  constructor(
    @InjectRepository(FavoriteEntity) favoritesRepository: Repository<FavoriteEntity>,
    @InjectRepository(UniversityEntity) universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) programsRepository: Repository<ProgramEntity>,
    @Inject(CacheService) cacheService: CacheService
  ) {
    this.favoritesRepository = favoritesRepository;
    this.universitiesRepository = universitiesRepository;
    this.programsRepository = programsRepository;
    this.cacheService = cacheService;
  }

  async list(userId: number) {
    const cacheKey = `favorite:list:${userId}`;
    const cached = await this.cacheService.getJson(cacheKey);
    if (cached) return cached;

    const favorites = await this.favoritesRepository.find({ where: { userId }, order: { createdAt: "DESC" } });
    const universityIds = favorites.filter((item) => item.favoriteType === "university").map((item) => item.targetId);
    const programIds = favorites.filter((item) => item.favoriteType === "program").map((item) => item.targetId);

    const [universities, programs] = await Promise.all([
      universityIds.length ? this.universitiesRepository.findBy({ id: In(universityIds) }) : [],
      programIds.length ? this.programsRepository.findBy({ id: In(programIds) }) : []
    ]);

    const payload = {
      universities: universities.map(mapUniversity),
      programs: programs.map(mapProgram)
    };

    await this.cacheService.setJson(cacheKey, payload, 180);
    return payload;
  }

  async toggle(userId: number, favoriteType: "university" | "program", targetId: number) {
    const existing = await this.favoritesRepository.findOne({ where: { userId, favoriteType, targetId } });
    if (existing) {
      await this.favoritesRepository.remove(existing);
      await this.cacheService.del(`favorite:list:${userId}`);
      return this.list(userId);
    }

    if (favoriteType === "university") {
      const target = await this.universitiesRepository.findOneBy({ id: targetId });
      if (!target) throw new NotFoundException("University not found");
    } else {
      const target = await this.programsRepository.findOneBy({ id: targetId });
      if (!target) throw new NotFoundException("Program not found");
    }

    await this.favoritesRepository.save(this.favoritesRepository.create({ userId, favoriteType, targetId }));
    await this.cacheService.del(`favorite:list:${userId}`);
    return this.list(userId);
  }

  async remove(userId: number, favoriteType: "university" | "program", targetId: number) {
    const existing = await this.favoritesRepository.findOne({ where: { userId, favoriteType, targetId } });
    if (existing) {
      await this.favoritesRepository.remove(existing);
    }
    await this.cacheService.del(`favorite:list:${userId}`);
    return this.list(userId);
  }
}
