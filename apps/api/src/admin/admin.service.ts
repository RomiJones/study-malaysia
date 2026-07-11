import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CacheService } from "../common/cache.service.js";
import { ContentBlockEntity, ProgramEntity, UniversityEntity, UserEntity } from "../db/entities.js";
import { mapContentBlock, mapProgram, mapUniversity } from "../common/mappers.js";

@Injectable()
export class AdminService {
  private readonly usersRepository: Repository<UserEntity>;
  private readonly universitiesRepository: Repository<UniversityEntity>;
  private readonly programsRepository: Repository<ProgramEntity>;
  private readonly contentRepository: Repository<ContentBlockEntity>;
  private readonly cacheService: CacheService;

  constructor(
    @InjectRepository(UserEntity) usersRepository: Repository<UserEntity>,
    @InjectRepository(UniversityEntity) universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) programsRepository: Repository<ProgramEntity>,
    @InjectRepository(ContentBlockEntity) contentRepository: Repository<ContentBlockEntity>,
    @Inject(CacheService) cacheService: CacheService
  ) {
    this.usersRepository = usersRepository;
    this.universitiesRepository = universitiesRepository;
    this.programsRepository = programsRepository;
    this.contentRepository = contentRepository;
    this.cacheService = cacheService;
  }

  async dashboard() {
    const [users, universities, programs, contentBlocks] = await Promise.all([
      this.usersRepository.count(),
      this.universitiesRepository.count(),
      this.programsRepository.count(),
      this.contentRepository.count()
    ]);

    return {
      users,
      universities,
      programs,
      contentBlocks
    };
  }

  async listUniversities() {
    const universities = await this.universitiesRepository.find({ order: { qsRank: "ASC" } });
    return universities.map(mapUniversity);
  }

  async createUniversity(payload: Partial<UniversityEntity>) {
    const entity = this.universitiesRepository.create({ ...payload, programCount: 0 });
    const saved = await this.universitiesRepository.save(entity);
    await this.invalidateCatalog();
    return mapUniversity(saved);
  }

  async updateUniversity(id: number, payload: Partial<UniversityEntity>) {
    const entity = await this.universitiesRepository.findOneBy({ id });
    if (!entity) throw new NotFoundException("University not found");
    Object.assign(entity, payload);
    const saved = await this.universitiesRepository.save(entity);
    await this.invalidateCatalog();
    return mapUniversity(saved);
  }

  async listPrograms() {
    const programs = await this.programsRepository.find({ order: { createdAt: "DESC" } });
    return programs.map(mapProgram);
  }

  async createProgram(payload: Partial<ProgramEntity>) {
    const entity = this.programsRepository.create(payload);
    const saved = await this.programsRepository.save(entity);
    await this.refreshProgramCount(saved.universityId);
    await this.invalidateCatalog();
    return mapProgram(saved);
  }

  async updateProgram(id: number, payload: Partial<ProgramEntity>) {
    const entity = await this.programsRepository.findOneBy({ id });
    if (!entity) throw new NotFoundException("Program not found");
    Object.assign(entity, payload);
    const saved = await this.programsRepository.save(entity);
    await this.refreshProgramCount(saved.universityId);
    await this.invalidateCatalog();
    return mapProgram(saved);
  }

  async listContent() {
    const blocks = await this.contentRepository.find({ order: { key: "ASC" } });
    return blocks.map(mapContentBlock);
  }

  async upsertContent(key: string, payload: Partial<ContentBlockEntity>) {
    let entity = await this.contentRepository.findOne({ where: { key } });
    if (!entity) {
      entity = this.contentRepository.create({ key, title: payload.title!, body: payload.body! });
    } else {
      Object.assign(entity, payload);
    }
    const saved = await this.contentRepository.save(entity);
    await this.invalidateCatalog();
    return mapContentBlock(saved);
  }

  private async refreshProgramCount(universityId: number) {
    const university = await this.universitiesRepository.findOneBy({ id: universityId });
    if (!university) return;
    university.programCount = await this.programsRepository.count({ where: { universityId } });
    await this.universitiesRepository.save(university);
  }

  private async invalidateCatalog() {
    await this.cacheService.clearByPrefix("catalog:");
  }
}
