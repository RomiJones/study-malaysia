import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository, SelectQueryBuilder } from "typeorm";
import type { FeeAuditStatus } from "@studymy/shared";
import { CacheService } from "../common/cache.service.js";
import {
  DISPLAY_ONLY_FEE_AUDIT_STATUSES,
  FILTERABLE_FEE_AUDIT_STATUSES,
  REVIEW_REQUIRED_FEE_AUDIT_STATUSES,
  resolveProgramFee
} from "../common/fee-strategy.helper.js";
import type { AdminRequestUser } from "../common/guards.js";
import { ProgramEntity, QualityIssueEntity } from "../db/entities.js";
import { AdminLogService } from "./admin-log.service.js";
import { QualityEngineService } from "./quality-engine.service.js";

const FEE_REVIEW_RULE_IDS = ["R002", "R003"] as const;
const SOURCE_REQUIRED_STATUSES = [
  "matched-official",
  "fee-sheet-verified",
  "official-approximate",
  "official-rate-verified",
  "calculated-from-official-rate",
  "official-non-scalar"
] as const;
const ALL_FEE_AUDIT_STATUSES = [
  ...FILTERABLE_FEE_AUDIT_STATUSES,
  ...DISPLAY_ONLY_FEE_AUDIT_STATUSES,
  ...REVIEW_REQUIRED_FEE_AUDIT_STATUSES
] as readonly FeeAuditStatus[];
const REVIEWABLE_STATUSES = [
  "matched-official",
  "fee-sheet-verified",
  "calculated-from-official-rate",
  "official-approximate",
  "official-rate-verified",
  "official-non-scalar",
  "not-published"
] as const satisfies readonly FeeAuditStatus[];
const BATCH_LIMIT = 100;

export type FeeReviewIssueType = "missing_source" | "pending" | "conflict" | "unverified";

interface FeeReviewListQuery {
  search?: string;
  programId?: string | number;
  universityId?: string | number;
  category?: string;
  issueType?: FeeReviewIssueType | "all";
  page?: string | number;
  pageSize?: string | number;
}

interface BatchFeeReviewPayload {
  programIds?: number[];
  feeAuditStatus?: string;
  feeSourceUrl?: string;
  reviewNote?: string;
}

interface FeeReviewDetailPayload {
  officialTuitionMYR?: number | null;
  tuitionDisplay?: string | null;
  feeAuditStatus?: string;
  feeSourceUrl?: string | null;
  feeSourceNote?: string | null;
  reviewNote?: string | null;
}

@Injectable()
export class FeeReviewService {
  constructor(
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @InjectRepository(QualityIssueEntity) private readonly issuesRepository: Repository<QualityIssueEntity>,
    private readonly qualityEngine: QualityEngineService,
    private readonly logService: AdminLogService,
    private readonly cacheService: CacheService
  ) {}

  async listPrograms(query: FeeReviewListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 20)));
    const skip = (page - 1) * pageSize;
    const issueType = this.normalizeIssueType(query.issueType);
    const qb = this.programsRepository
      .createQueryBuilder("program")
      .leftJoinAndSelect("program.university", "university")
      .orderBy("program.updatedAt", "DESC")
      .addOrderBy("program.id", "ASC")
      .skip(skip)
      .take(pageSize);

    if (query.search) {
      const search = `%${String(query.search).trim()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where("program.nameEnOfficial LIKE :search", { search })
            .orWhere("program.code LIKE :search", { search })
            .orWhere("program.slug LIKE :search", { search })
            .orWhere("program.name LIKE :search", { search })
            .orWhere("university.shortName LIKE :search", { search })
            .orWhere("university.nameEnOfficial LIKE :search", { search });
        })
      );
    }
    if (query.universityId) {
      qb.andWhere("program.universityId = :universityId", { universityId: Number(query.universityId) });
    }
    if (query.programId) {
      qb.andWhere("program.id = :programId", { programId: Number(query.programId) });
    }
    if (query.category) {
      qb.andWhere("program.category = :category", { category: query.category });
    }

    this.applyIssueTypeWhere(qb, issueType);

    const [programs, total] = await qb.getManyAndCount();
    const summary = await this.summary();

    return {
      items: programs.map((program) => this.mapListItem(program)),
      total,
      page,
      pageSize,
      summary
    };
  }

  async getFeeDetail(id: number) {
    const program = await this.findProgram(id);
    return this.mapDetail(program);
  }

  async updateFeeDetail(adminUser: AdminRequestUser, id: number, payload: FeeReviewDetailPayload) {
    const program = await this.findProgram(id);
    const status = payload.feeAuditStatus || program.officialFeeAuditStatus || "";
    this.assertKnownFeeAuditStatus(status);
    this.assertReviewableStatus(status);

    const nextOfficialTuitionMYR = this.normalizeNullableNumber(payload.officialTuitionMYR, program.officialTuitionMYR);
    const nextFeeSourceUrl = this.normalizeNullableString(payload.feeSourceUrl, program.officialFeeSourceUrl);

    this.assertTrustedFeeInput(status, nextOfficialTuitionMYR, nextFeeSourceUrl);

    program.officialTuitionMYR = nextOfficialTuitionMYR;
    if (payload.tuitionDisplay !== undefined) program.tuitionDisplay = this.trimToNull(payload.tuitionDisplay) || "";
    program.officialFeeAuditStatus = status;
    program.officialFeeSourceUrl = nextFeeSourceUrl || "";
    if (payload.feeSourceNote !== undefined) program.officialTuitionNote = this.trimToNull(payload.feeSourceNote);
    program.officialFeeAuditedAt = this.today();

    await this.resolveCurrentFeeIssues(adminUser, program.id);
    await this.programsRepository.save(program);
    await this.qualityEngine.runEntityCheck("program", program.id);
    await this.cacheService.clearByPrefix("catalog:");
    await this.logService.write(
      adminUser,
      "program",
      "fee_review_update",
      "program",
      String(program.id),
      `复核专业费用：${this.programLabel(program)}`,
      {
        feeAuditStatus: status,
        officialFeeSourceUrl: program.officialFeeSourceUrl,
        officialTuitionMYR: program.officialTuitionMYR,
        reviewNote: this.trimToNull(payload.reviewNote)
      }
    );

    return this.mapDetail(await this.findProgram(program.id));
  }

  async batchReview(adminUser: AdminRequestUser, payload: BatchFeeReviewPayload) {
    const ids = [...new Set((payload.programIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) throw new BadRequestException("请选择需要复核的专业");
    if (ids.length > BATCH_LIMIT) throw new BadRequestException(`单次最多批量处理 ${BATCH_LIMIT} 个专业`);

    const status = payload.feeAuditStatus || "";
    this.assertKnownFeeAuditStatus(status);
    this.assertReviewableStatus(status);
    const feeSourceUrl = this.trimToNull(payload.feeSourceUrl);

    const programs = await this.programsRepository.find({
      where: { id: In(ids) },
      relations: { university: true }
    });
    const programMap = new Map(programs.map((program) => [program.id, program]));
    const result = {
      updated: 0,
      skipped: [] as Array<{ id: number; reason: string }>,
      errors: [] as Array<{ id: number; reason: string }>
    };

    for (const id of ids) {
      const program = programMap.get(id);
      if (!program) {
        result.errors.push({ id, reason: "专业不存在" });
        continue;
      }

      const nextFeeSourceUrl = feeSourceUrl || this.trimToNull(program.officialFeeSourceUrl);
      const nextOfficialTuitionMYR = this.normalizeNullableNumber(undefined, program.officialTuitionMYR);

      try {
        this.assertTrustedFeeInput(status, nextOfficialTuitionMYR, nextFeeSourceUrl);
      } catch (error) {
        result.skipped.push({ id, reason: error instanceof Error ? error.message : "费用复核条件不足" });
        continue;
      }

      program.officialFeeAuditStatus = status;
      if (feeSourceUrl) program.officialFeeSourceUrl = feeSourceUrl;
      program.officialFeeAuditedAt = this.today();

      try {
        await this.resolveCurrentFeeIssues(adminUser, program.id);
        await this.programsRepository.save(program);
        await this.qualityEngine.runEntityCheck("program", program.id);
        result.updated += 1;
      } catch (error) {
        result.errors.push({ id, reason: error instanceof Error ? error.message : "保存失败" });
      }
    }

    if (result.updated > 0) {
      await this.cacheService.clearByPrefix("catalog:");
      await this.logService.write(
        adminUser,
        "program",
        "fee_review_batch",
        "program",
        ids.join(","),
        `批量复核专业费用：${result.updated} 条成功`,
        {
          feeAuditStatus: status,
          officialFeeSourceUrl: feeSourceUrl,
          reviewNote: this.trimToNull(payload.reviewNote),
          skipped: result.skipped,
          errors: result.errors
        }
      );
    }

    return result;
  }

  private async summary() {
    const programs = await this.programsRepository.find();
    const summary = {
      total: programs.length,
      missingSource: 0,
      pending: 0,
      conflict: 0,
      unverified: 0,
      verified: 0
    };

    for (const program of programs) {
      const issueTypes = feeReviewIssueTypes(program);
      if (issueTypes.includes("missing_source")) summary.missingSource += 1;
      if (issueTypes.includes("pending")) summary.pending += 1;
      if (issueTypes.includes("conflict")) summary.conflict += 1;
      if (issueTypes.includes("unverified")) summary.unverified += 1;
      if (resolveProgramFee(program).hasVerifiedFee) summary.verified += 1;
    }

    return summary;
  }

  private applyIssueTypeWhere(qb: SelectQueryBuilder<ProgramEntity>, issueType: FeeReviewIssueType | "all") {
    const params = {
      sourceRequiredStatuses: SOURCE_REQUIRED_STATUSES,
      filterableStatuses: FILTERABLE_FEE_AUDIT_STATUSES,
      pendingStatus: "pending-review",
      conflictStatuses: ["conflict", "source-conflict"]
    };
    const missingSourceWhere =
      "(program.officialFeeSourceUrl IS NULL OR program.officialFeeSourceUrl = '') AND " +
      "(program.officialFeeAuditStatus IN (:...sourceRequiredStatuses) OR program.officialTuitionMYR IS NOT NULL OR program.tuitionCurrency = 'MYR')";
    const pendingWhere = "program.officialFeeAuditStatus = :pendingStatus";
    const conflictWhere = "program.officialFeeAuditStatus IN (:...conflictStatuses)";
    const unverifiedWhere = "(program.officialFeeAuditStatus IS NULL OR program.officialFeeAuditStatus NOT IN (:...filterableStatuses))";

    if (issueType === "missing_source") qb.andWhere(missingSourceWhere, params);
    if (issueType === "pending") qb.andWhere(pendingWhere, params);
    if (issueType === "conflict") qb.andWhere(conflictWhere, params);
    if (issueType === "unverified") qb.andWhere(unverifiedWhere, params);
    if (issueType === "all") {
      qb.andWhere(
        new Brackets((sub) => {
          sub.where(missingSourceWhere).orWhere(pendingWhere).orWhere(conflictWhere).orWhere(unverifiedWhere);
        }),
        params
      );
    }
  }

  private mapListItem(program: ProgramEntity) {
    const fee = resolveProgramFee(program);
    return {
      id: program.id,
      code: program.code,
      name: program.name,
      nameEnOfficial: program.nameEnOfficial,
      universityId: program.universityId,
      universityName: program.university?.shortName || program.university?.nameEnOfficial || "",
      category: program.category,
      publicDisplayStatus: program.publicDisplayStatus,
      isPublished: program.isPublished,
      annualTuitionCny: program.annualTuitionCny,
      officialTuitionMYR: program.officialTuitionMYR,
      tuitionDisplay: program.tuitionDisplay,
      officialFeeSourceUrl: program.officialFeeSourceUrl,
      officialFeeAuditStatus: program.officialFeeAuditStatus,
      officialFeeAuditedAt: program.officialFeeAuditedAt,
      filterableTuitionCny: fee.filterableTuitionCny,
      hasVerifiedFee: fee.hasVerifiedFee,
      feeConfidence: fee.confidence,
      issueTypes: feeReviewIssueTypes(program),
      updatedAt: program.updatedAt?.toISOString?.() || null
    };
  }

  private mapDetail(program: ProgramEntity) {
    const fee = resolveProgramFee(program);
    return {
      ...this.mapListItem(program),
      tuitionAmount: program.tuitionAmount,
      tuitionCurrency: program.tuitionCurrency,
      listTuitionText: program.listTuitionText,
      officialTuitionNote: program.officialTuitionNote,
      feeSourceNote: program.officialTuitionNote,
      intakePeriods: program.officialIntake || (Array.isArray(program.intakeMonths) ? program.intakeMonths.join(", ") : ""),
      durationOfficial: program.durationOfficial,
      officialSourceUrl: program.officialSourceUrl,
      feeDisplayText: fee.displayText
    };
  }

  private async findProgram(id: number) {
    const program = await this.programsRepository.findOne({ where: { id }, relations: { university: true } });
    if (!program) throw new NotFoundException("Program not found");
    return program;
  }

  private async resolveCurrentFeeIssues(adminUser: AdminRequestUser, programId: number) {
    await this.issuesRepository.update(
      { entityType: "program", entityId: programId, ruleId: In([...FEE_REVIEW_RULE_IDS]), status: "open" },
      { status: "resolved", resolvedAt: new Date(), resolvedBy: String(adminUser.id) }
    );
  }

  private assertKnownFeeAuditStatus(status: string): asserts status is FeeAuditStatus {
    if (!ALL_FEE_AUDIT_STATUSES.includes(status as FeeAuditStatus)) {
      throw new BadRequestException("费用审计状态无效");
    }
  }

  private assertReviewableStatus(status: string) {
    if (!REVIEWABLE_STATUSES.includes(status as typeof REVIEWABLE_STATUSES[number])) {
      throw new BadRequestException("该状态不能作为费用复核完成状态");
    }
  }

  private assertTrustedFeeInput(status: string, officialTuitionMYR: number | null, feeSourceUrl: string | null) {
    if (FILTERABLE_FEE_AUDIT_STATUSES.includes(status as typeof FILTERABLE_FEE_AUDIT_STATUSES[number]) && officialTuitionMYR === null) {
      throw new BadRequestException("官方核验费用需要填写 officialTuitionMYR");
    }
    if (SOURCE_REQUIRED_STATUSES.includes(status as typeof SOURCE_REQUIRED_STATUSES[number]) && !feeSourceUrl) {
      throw new BadRequestException("该费用状态需要填写 officialFeeSourceUrl");
    }
  }

  private normalizeIssueType(issueType?: string): FeeReviewIssueType | "all" {
    if (issueType === "missing_source" || issueType === "pending" || issueType === "conflict" || issueType === "unverified") return issueType;
    return "all";
  }

  private normalizeNullableNumber(nextValue: unknown, fallback: number | null | undefined) {
    if (nextValue === undefined) return typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0 ? fallback : null;
    if (nextValue === null || nextValue === "") return null;
    const value = Number(nextValue);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private normalizeNullableString(nextValue: unknown, fallback: string | null | undefined) {
    if (nextValue === undefined) return this.trimToNull(fallback);
    return this.trimToNull(nextValue);
  }

  private trimToNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private programLabel(program: ProgramEntity) {
    return program.nameEnOfficial || program.name?.["zh-CN"] || program.code || String(program.id);
  }
}

export function feeReviewIssueTypes(program: Pick<ProgramEntity, "officialFeeAuditStatus" | "officialFeeSourceUrl" | "officialTuitionMYR" | "tuitionCurrency">): FeeReviewIssueType[] {
  const types: FeeReviewIssueType[] = [];
  const status = program.officialFeeAuditStatus || "";
  if (requiresFeeSource(program) && !isFilledString(program.officialFeeSourceUrl)) types.push("missing_source");
  if (status === "pending-review") types.push("pending");
  if (status === "conflict" || status === "source-conflict") types.push("conflict");
  if (!FILTERABLE_FEE_AUDIT_STATUSES.includes(status as typeof FILTERABLE_FEE_AUDIT_STATUSES[number])) types.push("unverified");
  return types;
}

function requiresFeeSource(program: Pick<ProgramEntity, "officialFeeAuditStatus" | "officialTuitionMYR" | "tuitionCurrency">) {
  return (
    SOURCE_REQUIRED_STATUSES.includes(program.officialFeeAuditStatus as typeof SOURCE_REQUIRED_STATUSES[number]) ||
    (program.officialTuitionMYR !== undefined && program.officialTuitionMYR !== null) ||
    program.tuitionCurrency === "MYR"
  );
}

function isFilledString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}
