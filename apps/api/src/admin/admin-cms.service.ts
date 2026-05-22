import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, Repository } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import type { AdminRequestUser } from "../common/guards.js";
import { CacheService } from "../common/cache.service.js";
import { ContentBlockEntity, ProgramEntity, StudentApplicationEntity, UniversityEntity } from "../db/entities.js";
import { AdminLogService } from "./admin-log.service.js";
import { normalizePagination, type AdminListQuery } from "./admin.helpers.js";

const PUBLIC_DISPLAY_STATUSES = new Set([
  "ready",
  "not-available-for-international",
  "needs-review",
  "hidden-unverified",
  "archived"
]);

const OFFICIAL_SOURCE_STATUSES = new Set([
  "official-verified",
  "official-page-verified-international-not-available",
  "needs-review",
  "source-conflict",
  "missing-source",
  "hidden-duplicate-superseded"
]);

const FEE_AUDIT_STATUSES = new Set(["matched-official", "conflict", "source-conflict", "pending-review", "not-published"]);
const TUITION_CURRENCIES = new Set(["MYR", "CNY", "USD", "UNKNOWN"]);

const UNIVERSITY_AUDIT_FIELDS = [
  "nameEnOfficial",
  "officialWebsite",
  "studyPortalUrl",
  "internationalPageUrl",
  "applicationPortalUrl",
  "officialAddress",
  "applicationPeriods",
  "applicationFees",
  "applicationDocuments",
  "chinaStudentRequirements",
  "officialProfile",
  "officialSources",
  "officialVerifiedAt",
  "officialSourceStatus",
  "officialAuditSummary",
  "publicDisplayStatus",
  "livingCostOfficialNote",
  "tuitionMinCny",
  "tuitionMaxCny"
] as const;

const PROGRAM_AUDIT_FIELDS = [
  "nameEnOfficial",
  "facultyZh",
  "studyMode",
  "campus",
  "durationOfficial",
  "tuitionAmount",
  "tuitionCurrency",
  "tuitionDisplay",
  "officialTuitionMYR",
  "officialTuitionNote",
  "officialFeeSourceUrl",
  "secondaryOfficialFeeSourceUrl",
  "officialFeeAuditStatus",
  "officialFeeAuditedAt",
  "officialIntake",
  "officialIntakeNote",
  "officialLanguageRequirement",
  "officialAcademicRequirement",
  "chinaStudentRequirement",
  "specialRequirementsNote",
  "officialAccreditationNote",
  "officialSourceUrl",
  "officialEntryRequirementSourceUrl",
  "officialAccreditationSourceUrl",
  "sourceUrls",
  "officialVerifiedAt",
  "officialSourceStatus",
  "publicDisplayStatus",
  "publicDisplayNote",
  "reviewReason",
  "auditNote",
  "listTuitionText"
] as const;

type AuditField = (typeof UNIVERSITY_AUDIT_FIELDS)[number] | (typeof PROGRAM_AUDIT_FIELDS)[number];

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

  async getUniversity(id: number) {
    const entity = await this.universitiesRepository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException("University not found");
    return entity;
  }

  async saveUniversity(actor: AdminRequestUser, payload: Partial<UniversityEntity> & { id?: number }) {
    let entity: UniversityEntity;
    let previous: UniversityEntity | null = null;
    if (payload.id) {
      const existing = await this.universitiesRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("University not found");
      previous = { ...existing };
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
    this.validateUniversityPayload(entity);
    const saved = await this.universitiesRepository.save(entity);
    await this.invalidateCatalog();
    await this.logService.write(
      actor,
      "school",
      payload.id ? "update" : "create",
      "school",
      String(saved.id),
      `${payload.id ? "Update" : "Create"} university ${saved.shortName}`,
      buildAuditDetail(previous, saved, UNIVERSITY_AUDIT_FIELDS)
    );
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

  async getProgram(id: number) {
    const entity = await this.programsRepository.findOne({ where: { id }, relations: { university: true } });
    if (!entity) throw new NotFoundException("Program not found");
    return entity;
  }

  async saveProgram(actor: AdminRequestUser, payload: Partial<ProgramEntity> & { id?: number }) {
    let entity: ProgramEntity;
    let previous: ProgramEntity | null = null;
    if (payload.id) {
      const existing = await this.programsRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Program not found");
      previous = { ...existing };
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
    this.validateProgramPayload(entity);
    const saved = await this.programsRepository.save(entity);
    await this.refreshProgramCount(saved.universityId);
    await this.invalidateCatalog();
    await this.logService.write(
      actor,
      "program",
      payload.id ? "update" : "create",
      "program",
      String(saved.id),
      `${payload.id ? "Update" : "Create"} program ${saved.code}`,
      buildAuditDetail(previous, saved, PROGRAM_AUDIT_FIELDS)
    );
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

  private validateUniversityPayload(payload: Partial<UniversityEntity>) {
    assertEnum("publicDisplayStatus", payload.publicDisplayStatus, PUBLIC_DISPLAY_STATUSES);
    assertEnum("officialSourceStatus", payload.officialSourceStatus, OFFICIAL_SOURCE_STATUSES);
    assertOptionalDate("officialVerifiedAt", payload.officialVerifiedAt);
    assertNonNegativeNumber("tuitionMinCny", payload.tuitionMinCny);
    assertNonNegativeNumber("tuitionMaxCny", payload.tuitionMaxCny);
    assertNonNegativeNumber("livingCostCny", payload.livingCostCny);

    if (payload.tuitionMinCny !== undefined && payload.tuitionMaxCny !== undefined && payload.tuitionMaxCny < payload.tuitionMinCny) {
      throw new BadRequestException("University tuitionMaxCny must be greater than or equal to tuitionMinCny");
    }

    if (payload.minIelts !== undefined && (Number(payload.minIelts) < 0 || Number(payload.minIelts) > 9)) {
      throw new BadRequestException("University minIelts must be between 0 and 9");
    }

    if (payload.publicDisplayStatus === "ready" && !hasUniversityOfficialSource(payload)) {
      throw new BadRequestException("Ready university requires at least one official source URL");
    }

    if (payload.officialSourceStatus === "official-verified" && !hasUniversityOfficialSource(payload)) {
      throw new BadRequestException("Official verified university requires an official source URL");
    }
  }

  private validateProgramPayload(payload: Partial<ProgramEntity>) {
    assertEnum("publicDisplayStatus", payload.publicDisplayStatus, PUBLIC_DISPLAY_STATUSES);
    assertEnum("officialSourceStatus", payload.officialSourceStatus, OFFICIAL_SOURCE_STATUSES);
    assertEnum("officialFeeAuditStatus", payload.officialFeeAuditStatus, FEE_AUDIT_STATUSES);
    assertEnum("tuitionCurrency", payload.tuitionCurrency, TUITION_CURRENCIES);
    assertOptionalDate("officialVerifiedAt", payload.officialVerifiedAt);
    assertOptionalDate("officialFeeAuditedAt", payload.officialFeeAuditedAt);
    assertPositiveNumber("durationYears", payload.durationYears);
    assertNonNegativeNumber("annualTuitionCny", payload.annualTuitionCny);
    assertNonNegativeNumber("tuitionAmount", payload.tuitionAmount);
    assertNonNegativeNumber("officialTuitionMYR", payload.officialTuitionMYR);

    if (payload.publicDisplayStatus === "ready" && !hasProgramOfficialSource(payload)) {
      throw new BadRequestException("Ready program requires an official source URL");
    }

    if (payload.officialSourceStatus === "official-verified" && !hasProgramOfficialSource(payload)) {
      throw new BadRequestException("Official verified program requires an official source URL");
    }

    if (payload.officialFeeAuditStatus === "matched-official" && !isFilledString(payload.officialFeeSourceUrl)) {
      throw new BadRequestException("Matched official fee audit requires officialFeeSourceUrl");
    }

    if (((payload.officialTuitionMYR !== undefined && payload.officialTuitionMYR !== null) || payload.tuitionCurrency === "MYR") && !isFilledString(payload.officialFeeSourceUrl)) {
      throw new BadRequestException("Official tuition fields require officialFeeSourceUrl");
    }
  }
}

function assertEnum(field: string, value: unknown, allowed: Set<string>) {
  if (value === undefined || value === null || value === "") return;
  if (!allowed.has(String(value))) {
    throw new BadRequestException(`Invalid ${field}`);
  }
}

function assertOptionalDate(field: string, value: Date | string | null | undefined) {
  if (value === undefined || value === null || value === "") return;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new BadRequestException(`Invalid ${field}`);
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(String(value)))) {
    throw new BadRequestException(`Invalid ${field}`);
  }
}

function assertNonNegativeNumber(field: string, value: number | string | null | undefined) {
  if (value === undefined || value === null) return;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new BadRequestException(`${field} must be a non-negative number`);
  }
}

function assertPositiveNumber(field: string, value: number | string | null | undefined) {
  if (value === undefined || value === null) return;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new BadRequestException(`${field} must be greater than 0`);
  }
}

function hasUniversityOfficialSource(payload: Partial<UniversityEntity>) {
  return isFilledString(payload.officialWebsite) || isFilledString(payload.website) || hasSourceLinks(payload.officialSources);
}

function hasProgramOfficialSource(payload: Partial<ProgramEntity>) {
  return (
    isFilledString(payload.officialSourceUrl) ||
    isFilledString(payload.officialEntryRequirementSourceUrl) ||
    isFilledString(payload.officialAccreditationSourceUrl) ||
    hasSourceLinks(payload.sourceUrls)
  );
}

function hasSourceLinks(value: unknown) {
  return Array.isArray(value) && value.some((item) => item && typeof item === "object" && isFilledString((item as { url?: string }).url));
}

function isFilledString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function buildAuditDetail(previous: object | null, current: object, fields: readonly AuditField[]) {
  if (!previous) {
    return {
      mode: "create",
      officialFields: pickFields(current, fields)
    };
  }

  const changes = fields.reduce<Record<string, { from: unknown; to: unknown }>>((result, field) => {
    const from = getFieldValue(previous, field);
    const to = getFieldValue(current, field);
    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) {
      result[field] = { from: from ?? null, to: to ?? null };
    }
    return result;
  }, {});

  return {
    mode: "update",
    changedFields: Object.keys(changes),
    changes
  };
}

function pickFields(source: object, fields: readonly AuditField[]) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    result[field] = getFieldValue(source, field) ?? null;
    return result;
  }, {});
}

function getFieldValue(source: object, field: AuditField) {
  return (source as Record<string, unknown>)[field];
}
