import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Repository } from "typeorm";
import type { AdminRequestUser } from "../common/guards.js";
import { CacheService } from "../common/cache.service.js";
import { ContentBlockEntity, ProgramEntity, StudentApplicationEntity, UniversityEntity } from "../db/entities.js";
import { AdminLogService } from "./admin-log.service.js";
import { normalizePagination, type AdminListQuery } from "./admin.helpers.js";

@Injectable()
export class AdminCmsService {
  constructor(
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @InjectRepository(ContentBlockEntity) private readonly contentRepository: Repository<ContentBlockEntity>,
    @InjectRepository(StudentApplicationEntity) private readonly applicationsRepository: Repository<StudentApplicationEntity>,
    @Inject(CacheService) private readonly cacheService: CacheService,
    @Inject(AdminLogService) private readonly logService: AdminLogService
  ) {}

  async dashboard() {
    const [schoolCount, programCount, applicationCount, pendingCount, contentCount] = await Promise.all([
      this.universitiesRepository.count(),
      this.programsRepository.count(),
      this.applicationsRepository.count(),
      this.applicationsRepository.count({ where: [{ applicationStatus: "draft" }, { applicationStatus: "submitted" }, { applicationStatus: "reviewing" }] }),
      this.contentRepository.count()
    ]);

    const stageBoard = await this.applicationsRepository
      .createQueryBuilder("application")
      .select("application.applicationStatus", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("application.applicationStatus")
      .getRawMany<{ status: string; count: string }>();

    return {
      overview: { schoolCount, programCount, applicationCount, pendingCount, contentCount },
      stageBoard: stageBoard.map((item) => ({ status: item.status, count: Number(item.count) }))
    };
  }

  async listUniversities(query: AdminListQuery & { ownership?: string; published?: string; publicDisplayStatus?: string; officialSourceStatus?: string }) {
    const { page, pageSize, skip } = normalizePagination(query);
    const qb = this.universitiesRepository.createQueryBuilder("university");
    if (query.search) {
      qb.andWhere(
        "university.code LIKE :search OR university.shortName LIKE :search OR JSON_UNQUOTE(JSON_EXTRACT(university.name, '$.en')) LIKE :search OR JSON_UNQUOTE(JSON_EXTRACT(university.name, '$.zh-CN')) LIKE :search",
        { search: `%${query.search}%` }
      );
    }
    if (query.ownership) qb.andWhere("university.ownership = :ownership", { ownership: query.ownership });
    if (query.published === "true" || query.published === "false") qb.andWhere("university.isPublished = :published", { published: query.published === "true" });
    if (query.publicDisplayStatus) qb.andWhere("university.publicDisplayStatus = :publicDisplayStatus", { publicDisplayStatus: query.publicDisplayStatus });
    if (query.officialSourceStatus) qb.andWhere("university.officialSourceStatus = :officialSourceStatus", { officialSourceStatus: query.officialSourceStatus });
    const [items, total] = await qb.orderBy("university.qsRank", "ASC").skip(skip).take(pageSize).getManyAndCount();
    return { items, total, page, pageSize };
  }

  async saveUniversity(actor: AdminRequestUser, payload: Partial<UniversityEntity> & { id?: number }) {
    let entity: UniversityEntity;
    if (payload.id) {
      const existing = await this.universitiesRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("University not found");
      entity = existing;
      Object.assign(entity, payload);
    } else {
      entity = this.universitiesRepository.create({
        ...payload,
        programCount: payload.programCount || 0,
        isPublished: payload.isPublished ?? true,
        publicDisplayStatus: payload.publicDisplayStatus ?? "ready",
        officialSourceStatus: payload.officialSourceStatus ?? "needs-review"
      } as UniversityEntity);
    }
    const saved = await this.universitiesRepository.save(entity);
    await this.invalidateCatalog();
    await this.logService.write(actor, "school", payload.id ? "update" : "create", "school", String(saved.id), `${payload.id ? "Update" : "Create"} university ${saved.shortName}`);
    return saved;
  }

  async deleteUniversity(actor: AdminRequestUser, id: number) {
    await this.universitiesRepository.delete({ id });
    await this.invalidateCatalog();
    await this.logService.write(actor, "school", "delete", "school", String(id), `Delete university ${id}`);
    return true;
  }

  async listPrograms(query: AdminListQuery & { universityId?: number; level?: string; category?: string; published?: string; publicDisplayStatus?: string; officialSourceStatus?: string; feeAuditStatus?: string }) {
    const { page, pageSize, skip } = normalizePagination(query);
    const qb = this.programsRepository.createQueryBuilder("program").leftJoinAndSelect("program.university", "university");
    if (query.search) {
      qb.andWhere(
        "program.code LIKE :search OR JSON_UNQUOTE(JSON_EXTRACT(program.name, '$.en')) LIKE :search OR JSON_UNQUOTE(JSON_EXTRACT(program.name, '$.zh-CN')) LIKE :search",
        { search: `%${query.search}%` }
      );
    }
    if (query.universityId) qb.andWhere("program.universityId = :universityId", { universityId: query.universityId });
    if (query.level) qb.andWhere("program.level = :level", { level: query.level });
    if (query.category) qb.andWhere("program.category = :category", { category: query.category });
    if (query.published === "true" || query.published === "false") qb.andWhere("program.isPublished = :published", { published: query.published === "true" });
    if (query.publicDisplayStatus) qb.andWhere("program.publicDisplayStatus = :publicDisplayStatus", { publicDisplayStatus: query.publicDisplayStatus });
    if (query.officialSourceStatus) qb.andWhere("program.officialSourceStatus = :officialSourceStatus", { officialSourceStatus: query.officialSourceStatus });
    if (query.feeAuditStatus) qb.andWhere("program.officialFeeAuditStatus = :feeAuditStatus", { feeAuditStatus: query.feeAuditStatus });
    const [items, total] = await qb.orderBy("program.createdAt", "DESC").skip(skip).take(pageSize).getManyAndCount();
    return { items, total, page, pageSize };
  }

  async saveProgram(actor: AdminRequestUser, payload: Partial<ProgramEntity> & { id?: number }) {
    let entity: ProgramEntity;
    if (payload.id) {
      const existing = await this.programsRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Program not found");
      entity = existing;
      Object.assign(entity, payload);
    } else {
      entity = this.programsRepository.create({
        ...payload,
        isPublished: payload.isPublished ?? true,
        publicDisplayStatus: payload.publicDisplayStatus ?? "ready",
        officialSourceStatus: payload.officialSourceStatus ?? "needs-review",
        officialFeeAuditStatus: payload.officialFeeAuditStatus ?? "pending-review"
      } as ProgramEntity);
    }
    const saved = await this.programsRepository.save(entity);
    await this.refreshProgramCount(saved.universityId);
    await this.invalidateCatalog();
    await this.logService.write(actor, "program", payload.id ? "update" : "create", "program", String(saved.id), `${payload.id ? "Update" : "Create"} program ${saved.code}`);
    return saved;
  }

  async deleteProgram(actor: AdminRequestUser, id: number) {
    const entity = await this.programsRepository.findOneBy({ id });
    await this.programsRepository.delete({ id });
    if (entity) await this.refreshProgramCount(entity.universityId);
    await this.invalidateCatalog();
    await this.logService.write(actor, "program", "delete", "program", String(id), `Delete program ${id}`);
    return true;
  }

  async listContent(query: AdminListQuery) {
    return this.contentRepository.find({ where: query.search ? { key: Like(`%${query.search}%`) } : undefined, order: { key: "ASC" } });
  }

  async saveContent(actor: AdminRequestUser, key: string, payload: Partial<ContentBlockEntity>) {
    let entity = await this.contentRepository.findOne({ where: { key } });
    const isUpdate = Boolean(entity);
    if (!entity) {
      entity = this.contentRepository.create({ key, title: payload.title!, body: payload.body! });
    } else {
      Object.assign(entity, payload);
    }
    const saved = await this.contentRepository.save(entity);
    await this.invalidateCatalog();
    await this.logService.write(actor, "content", isUpdate ? "update" : "create", "content", String(saved.id), `Save content block ${saved.key}`);
    return saved;
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
