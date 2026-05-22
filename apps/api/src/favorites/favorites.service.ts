import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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

    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const programMap = new Map(programs.map((program) => [program.id, program]));
    const payload = {
      universityIds,
      programIds,
      universities: favorites
        .filter((item) => item.favoriteType === "university")
        .map((item) => universityMap.get(item.targetId))
        .filter((university): university is UniversityEntity => Boolean(university))
        .map(mapUniversity),
      programs: favorites
        .filter((item) => item.favoriteType === "program")
        .map((item) => programMap.get(item.targetId))
        .filter((program): program is ProgramEntity => Boolean(program))
        .map(mapProgram)
    };

    await this.cacheService.setJson(cacheKey, payload, 180);
    return payload;
  }

  async add(userId: number, favoriteType: "university" | "program", targetId: number) {
    this.assertFavoriteInput(favoriteType, targetId);
    await this.ensureTargetExists(favoriteType, targetId);

    const existing = await this.favoritesRepository.findOne({ where: { userId, favoriteType, targetId } });
    if (!existing) {
      await this.favoritesRepository.save(this.favoritesRepository.create({ userId, favoriteType, targetId }));
      await this.cacheService.del(`favorite:list:${userId}`);
    }

    return this.list(userId);
  }

  async toggle(userId: number, favoriteType: "university" | "program", targetId: number) {
    this.assertFavoriteInput(favoriteType, targetId);
    const existing = await this.favoritesRepository.findOne({ where: { userId, favoriteType, targetId } });
    if (existing) {
      await this.favoritesRepository.remove(existing);
      await this.cacheService.del(`favorite:list:${userId}`);
      return this.list(userId);
    }

    return this.add(userId, favoriteType, targetId);
  }

  async remove(userId: number, favoriteType: "university" | "program", targetId: number) {
    this.assertFavoriteInput(favoriteType, targetId);
    const existing = await this.favoritesRepository.findOne({ where: { userId, favoriteType, targetId } });
    if (existing) {
      await this.favoritesRepository.remove(existing);
    }
    await this.cacheService.del(`favorite:list:${userId}`);
    return this.list(userId);
  }

  async merge(userId: number, payload: { universityIds?: number[]; programIds?: number[] }) {
    const universityIds = this.normalizeIds(payload.universityIds || []);
    const programIds = this.normalizeIds(payload.programIds || []);
    const [universities, programs, currentFavorites] = await Promise.all([
      universityIds.length ? this.universitiesRepository.findBy({ id: In(universityIds) }) : [],
      programIds.length ? this.programsRepository.findBy({ id: In(programIds) }) : [],
      this.favoritesRepository.find({ where: { userId } })
    ]);

    const validUniversityIds = new Set(universities.map((university) => university.id));
    const validProgramIds = new Set(programs.map((program) => program.id));
    const existingKeys = new Set(currentFavorites.map((favorite) => `${favorite.favoriteType}:${favorite.targetId}`));
    const additions: FavoriteEntity[] = [];

    for (const targetId of universityIds) {
      if (!validUniversityIds.has(targetId) || existingKeys.has(`university:${targetId}`)) continue;
      additions.push(this.favoritesRepository.create({ userId, favoriteType: "university", targetId }));
      existingKeys.add(`university:${targetId}`);
    }

    for (const targetId of programIds) {
      if (!validProgramIds.has(targetId) || existingKeys.has(`program:${targetId}`)) continue;
      additions.push(this.favoritesRepository.create({ userId, favoriteType: "program", targetId }));
      existingKeys.add(`program:${targetId}`);
    }

    if (additions.length) {
      await this.favoritesRepository.save(additions);
      await this.cacheService.del(`favorite:list:${userId}`);
    }

    return {
      ...(await this.list(userId)),
      skippedUniversityIds: universityIds.filter((id) => !validUniversityIds.has(id)),
      skippedProgramIds: programIds.filter((id) => !validProgramIds.has(id)),
      mergeStrategy: "server-first-union"
    };
  }

  private async ensureTargetExists(favoriteType: "university" | "program", targetId: number) {
    if (favoriteType === "university") {
      const target = await this.universitiesRepository.findOneBy({ id: targetId });
      if (!target) throw new NotFoundException("University not found");
      return;
    }

    const target = await this.programsRepository.findOneBy({ id: targetId });
    if (!target) throw new NotFoundException("Program not found");
  }

  private assertFavoriteInput(favoriteType: "university" | "program", targetId: number) {
    if (favoriteType !== "university" && favoriteType !== "program") {
      throw new BadRequestException("Invalid favorite type");
    }
    if (!Number.isInteger(targetId) || targetId <= 0) {
      throw new BadRequestException("Favorite target id is required");
    }
  }

  private normalizeIds(ids: number[]) {
    return Array.from(new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
  }
}
