import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AdminRequestUser } from "../common/guards.js";
import { DictionaryItemEntity, OperationLogEntity, SystemConfigEntity } from "../db/entities.js";
import { AdminLogService } from "./admin-log.service.js";
import { normalizePagination, type AdminListQuery } from "./admin.helpers.js";

@Injectable()
export class AdminSettingsService {
  constructor(
    @InjectRepository(SystemConfigEntity) private readonly configsRepository: Repository<SystemConfigEntity>,
    @InjectRepository(DictionaryItemEntity) private readonly dictionariesRepository: Repository<DictionaryItemEntity>,
    @InjectRepository(OperationLogEntity) private readonly logsRepository: Repository<OperationLogEntity>,
    @Inject(AdminLogService) private readonly logService: AdminLogService
  ) {}

  async listConfigs(category?: string) {
    return this.configsRepository.find({ where: category ? { category } : undefined, order: { category: "ASC", sortOrder: "ASC" } });
  }

  async saveConfig(actor: AdminRequestUser, payload: Partial<SystemConfigEntity> & { id?: number }) {
    let entity: SystemConfigEntity;
    if (payload.id) {
      const existing = await this.configsRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Config not found");
      entity = existing;
      Object.assign(entity, payload);
    } else {
      entity = this.configsRepository.create({
        category: payload.category!,
        configKey: payload.configKey!,
        label: payload.label!,
        value: payload.value!,
        description: payload.description || "",
        sortOrder: payload.sortOrder || 0,
        isPublic: payload.isPublic ?? false
      });
    }
    const saved = await this.configsRepository.save(entity);
    await this.logService.write(actor, "settings", payload.id ? "update" : "create", "config", String(saved.id), `Save config ${saved.label}`);
    return saved;
  }

  async listDictionaries(dictType?: string) {
    return this.dictionariesRepository.find({ where: dictType ? { dictType } : undefined, order: { dictType: "ASC", sortOrder: "ASC" } });
  }

  async saveDictionary(actor: AdminRequestUser, payload: Partial<DictionaryItemEntity> & { id?: number }) {
    let entity: DictionaryItemEntity;
    if (payload.id) {
      const existing = await this.dictionariesRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Dictionary item not found");
      entity = existing;
      Object.assign(entity, payload);
    } else {
      entity = this.dictionariesRepository.create({
        dictType: payload.dictType!,
        code: payload.code!,
        label: payload.label!,
        status: payload.status || "enabled",
        sortOrder: payload.sortOrder || 0,
        extra: payload.extra || null
      });
    }
    const saved = await this.dictionariesRepository.save(entity);
    await this.logService.write(actor, "settings", payload.id ? "update" : "create", "dictionary", String(saved.id), `Save dictionary ${saved.label}`);
    return saved;
  }

  async listLogs(query: AdminListQuery & { module?: string }) {
    const { page, pageSize, skip } = normalizePagination(query);
    const qb = this.logsRepository.createQueryBuilder("log").leftJoinAndSelect("log.adminUser", "adminUser");
    if (query.search) qb.andWhere("log.summary LIKE :search OR log.targetType LIKE :search", { search: `%${query.search}%` });
    if (query.module) qb.andWhere("log.module = :module", { module: query.module });
    const [items, total] = await qb.orderBy("log.createdAt", "DESC").skip(skip).take(pageSize).getManyAndCount();
    return { items, total, page, pageSize };
  }
}
