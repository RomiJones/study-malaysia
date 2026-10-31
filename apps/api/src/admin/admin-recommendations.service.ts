import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import type {
  SmartRecommendationProfileField,
  SmartRecommendationPublicDataField,
  SmartRecommendationReasonDto,
  SmartRecommendationRiskDto
} from "@studymy/shared";
import { resolveProgramFee } from "../common/fee-strategy.helper.js";
import { CacheService } from "../common/cache.service.js";
import {
  PlannerProfileEntity,
  ProgramEntity,
  RecommendationRunEntity,
  type RecommendationProfileSnapshot,
  type RecommendationRunStatus,
  type RecommendationResultSnapshot,
  UniversityEntity,
  UserEntity
} from "../db/entities.js";
import { normalizePagination, type AdminListQuery } from "./admin.helpers.js";

type CacheTraceState = "hit-eligible" | "payload-missing" | "expired" | "profile-stale" | "not-cacheable";

interface RecommendationRunQuery extends AdminListQuery {
  status?: string;
}

interface CatalogContext {
  programs: Map<number, ProgramEntity>;
  universities: Map<number, UniversityEntity>;
}

const PROFILE_FIELD_LABELS: Record<SmartRecommendationProfileField, string> = {
  level: "目标学历",
  targetCategory: "目标专业方向",
  budgetCny: "预算",
  gpa: "GPA",
  ielts: "IELTS",
  experience: "工作或研究经验",
  acceptNoLanguage: "是否接受后补语言"
};

const PUBLIC_DATA_FIELD_LABELS: Record<SmartRecommendationPublicDataField, string> = {
  "program.level": "专业层级",
  "program.category": "专业分类",
  "program.annualTuitionCny": "专业年度学费",
  "program.requirement.gpa": "专业 GPA 要求",
  "program.languageRequirement.ielts": "专业 IELTS 要求",
  "program.publicDisplayStatus": "专业公开展示状态",
  "university.livingCostCny": "学校生活费",
  "university.acceptNoLanguage": "学校是否接受后补语言",
  "university.qsRank": "学校 QS 排名",
  "university.publicDisplayStatus": "学校公开展示状态"
};

const RUN_STATUSES = new Set<RecommendationRunStatus>([
  "blocked-profile-incomplete",
  "generated",
  "no-match",
  "expired"
]);

const PROFILE_FIELD_ORDER: SmartRecommendationProfileField[] = [
  "level",
  "targetCategory",
  "budgetCny",
  "gpa",
  "ielts",
  "experience",
  "acceptNoLanguage"
];

@Injectable()
export class AdminRecommendationsService {
  constructor(
    @InjectRepository(RecommendationRunEntity) private readonly runsRepository: Repository<RecommendationRunEntity>,
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>,
    private readonly cacheService: CacheService
  ) {}

  async listRuns(query: RecommendationRunQuery) {
    const { page, pageSize, skip } = normalizePagination({ ...query, pageSize: query.pageSize || 12 });
    const qb = this.runsRepository
      .createQueryBuilder("run")
      .leftJoinAndSelect("run.user", "user")
      .leftJoinAndSelect("run.profile", "profile")
      .orderBy("run.createdAt", "DESC")
      .addOrderBy("run.id", "DESC")
      .skip(skip)
      .take(pageSize);

    const status = this.normalizeStatus(query.status);
    if (status) {
      qb.andWhere("run.status = :status", { status });
    }

    const search = String(query.search || "").trim();
    if (search) {
      const like = `%${search}%`;
      const numericSearch = Number(search);
      qb.andWhere(new Brackets((sub) => {
        sub
          .where("user.displayName LIKE :like", { like })
          .orWhere("user.account LIKE :like", { like });
        if (Number.isInteger(numericSearch) && numericSearch > 0) {
          sub
            .orWhere("run.id = :numericSearch", { numericSearch })
            .orWhere("run.userId = :numericSearch", { numericSearch })
            .orWhere("run.profileId = :numericSearch", { numericSearch });
        }
      }));
    }

    const [runs, total] = await qb.getManyAndCount();
    const context = await this.loadCatalogContext(runs);
    const items = await Promise.all(runs.map((run) => this.mapRun(run, context)));
    const summary = await this.summary();

    return {
      items,
      total,
      page,
      pageSize,
      summary,
      centerPositioning: "后台运营和顾问追溯中心，不是前端会员中心。",
      privacyBoundary: "仅展示推荐追溯所需的账号标识、画像字段和公开目录字段，不返回联系方式、材料库或完整学生档案。"
    };
  }

  private async summary() {
    const rows = await this.runsRepository
      .createQueryBuilder("run")
      .select("run.status", "status")
      .addSelect("COUNT(1)", "count")
      .groupBy("run.status")
      .getRawMany<{ status: RecommendationRunStatus; count: string }>();
    const byStatus = Object.fromEntries([...RUN_STATUSES].map((status) => [status, 0]));
    for (const row of rows) {
      byStatus[row.status] = Number(row.count || 0);
    }
    const total = Object.values(byStatus).reduce((sum, count) => sum + Number(count), 0);
    return { total, byStatus };
  }

  private async loadCatalogContext(runs: RecommendationRunEntity[]): Promise<CatalogContext> {
    const programIds = new Set<number>();
    const universityIds = new Set<number>();
    for (const run of runs) {
      for (const result of this.results(run)) {
        programIds.add(result.programId);
        universityIds.add(result.universityId);
      }
    }

    const programs = programIds.size
      ? await this.programsRepository.find({ where: { id: In([...programIds]) } })
      : [];
    for (const program of programs) {
      universityIds.add(program.universityId);
    }
    const universities = universityIds.size
      ? await this.universitiesRepository.find({ where: { id: In([...universityIds]) } })
      : [];

    return {
      programs: new Map(programs.map((program) => [program.id, program])),
      universities: new Map(universities.map((university) => [university.id, university]))
    };
  }

  private async mapRun(run: RecommendationRunEntity, context: CatalogContext) {
    const profile = this.profile(run);
    const cachePayload = run.cacheKey ? await this.cacheService.getJson<unknown>(run.cacheKey) : null;
    const profileDrift = this.profileDrift(run, profile);
    const cache = this.cacheState(run, profileDrift, Boolean(cachePayload));
    const results = this.results(run).map((result) => this.mapResult(result, context));

    return {
      id: run.id,
      userId: run.userId,
      profileId: run.profileId,
      student: this.student(run),
      status: run.status,
      statusLabel: this.statusLabel(run.status),
      profileVersion: run.profileVersion,
      currentProfileVersion: profile?.profileVersion ?? null,
      createdAt: run.createdAt?.toISOString() ?? null,
      generatedAt: run.generatedAt?.toISOString() ?? null,
      expiresAt: run.expiresAt?.toISOString() ?? null,
      resultCount: run.resultCount,
      auditNote: run.auditNote,
      profileSnapshot: this.profileSnapshotRows(run.profileSnapshot),
      missingProfileFields: (run.missingProfileFields || []).map((field) => ({
        field,
        label: PROFILE_FIELD_LABELS[field]
      })),
      profileDrift,
      cache,
      results,
      traceSummary: this.traceSummary(results),
      privacyBoundary: "不展示 contactInfo、academicBackground、languageProfile、studyPreferences、serviceNeeds 等完整画像明细。"
    };
  }

  private student(run: RecommendationRunEntity) {
    const user = (run as RecommendationRunEntity & { user?: UserEntity }).user;
    return {
      id: run.userId,
      displayName: user?.displayName || `学生 #${run.userId}`,
      accountMasked: this.maskAccount(user?.account || ""),
      preferredLocale: user?.preferredLocale || null
    };
  }

  private profile(run: RecommendationRunEntity) {
    return (run as RecommendationRunEntity & { profile?: PlannerProfileEntity }).profile || null;
  }

  private results(run: RecommendationRunEntity) {
    return Array.isArray(run.results) ? run.results : [];
  }

  private mapResult(result: RecommendationResultSnapshot, context: CatalogContext) {
    const program = context.programs.get(result.programId) || null;
    const university = context.universities.get(result.universityId || program?.universityId || 0) || null;
    const fee = program ? resolveProgramFee(program) : null;
    const profileFields = new Set(result.trace?.profileFields || []);
    const publicDataFields = new Set(result.trace?.publicDataFields || []);

    return {
      universityId: result.universityId,
      programId: result.programId,
      universityName: this.localizedName(university?.name, university?.nameEnOfficial || university?.shortName || `学校 #${result.universityId}`),
      programName: this.localizedName(program?.name, program?.nameEnOfficial || program?.code || `专业 #${result.programId}`),
      score: result.score,
      tier: result.tier,
      annualCostCny: result.annualCostCny,
      publicDisplayStatus: result.publicDisplayStatus,
      currentCatalog: {
        programPublicDisplayStatus: program?.publicDisplayStatus || null,
        universityPublicDisplayStatus: university?.publicDisplayStatus || null,
        programOfficialSourceStatus: program?.officialSourceStatus || null,
        universityOfficialSourceStatus: university?.officialSourceStatus || null
      },
      profileFields: [...profileFields].map((field) => ({
        field,
        label: PROFILE_FIELD_LABELS[field]
      })),
      publicDataFields: [...publicDataFields].map((field) => ({
        field,
        label: PUBLIC_DATA_FIELD_LABELS[field],
        currentValue: this.publicDataValue(field, program, university)
      })),
      feeSource: {
        displayText: fee?.displayText || null,
        filterableTuitionCny: fee?.filterableTuitionCny ?? null,
        confidence: fee?.confidence || "unavailable",
        annualTuitionCny: program?.annualTuitionCny ?? null,
        officialFeeAuditStatus: program?.officialFeeAuditStatus || null,
        officialFeeSourceUrl: program?.officialFeeSourceUrl || null,
        secondaryOfficialFeeSourceUrl: program?.secondaryOfficialFeeSourceUrl || null,
        sourceNote: program?.officialTuitionNote || null
      },
      languageSource: {
        ielts: this.languageIelts(program),
        officialLanguageRequirement: program?.officialLanguageRequirement || null,
        officialEntryRequirementSourceUrl: program?.officialEntryRequirementSourceUrl || null,
        acceptNoLanguage: university?.acceptNoLanguage ?? null
      },
      reasonSources: result.reasonsDetailed.map((reason) => this.reasonSource(reason)),
      riskSources: result.risks.map((risk) => this.riskSource(risk))
    };
  }

  private reasonSource(reason: SmartRecommendationReasonDto) {
    return {
      code: reason.code,
      message: reason.message["zh-CN"] || reason.message.en || reason.code,
      profileField: reason.profileField || null,
      profileFieldLabel: reason.profileField ? PROFILE_FIELD_LABELS[reason.profileField] : null,
      profileValue: reason.profileValue ?? null,
      publicDataField: reason.publicDataField || null,
      publicDataFieldLabel: reason.publicDataField ? PUBLIC_DATA_FIELD_LABELS[reason.publicDataField] : null,
      publicDataValue: reason.publicDataValue ?? null
    };
  }

  private riskSource(risk: SmartRecommendationRiskDto) {
    return {
      code: risk.code,
      severity: risk.severity,
      message: risk.message["zh-CN"] || risk.message.en || risk.code,
      suggestion: risk.suggestion?.["zh-CN"] || risk.suggestion?.en || "",
      profileField: risk.profileField || null,
      profileFieldLabel: risk.profileField ? PROFILE_FIELD_LABELS[risk.profileField] : null,
      publicDataField: risk.publicDataField || null,
      publicDataFieldLabel: risk.publicDataField ? PUBLIC_DATA_FIELD_LABELS[risk.publicDataField] : null
    };
  }

  private profileSnapshotRows(snapshot: RecommendationProfileSnapshot | null) {
    return PROFILE_FIELD_ORDER.map((field) => ({
      field,
      label: PROFILE_FIELD_LABELS[field],
      value: snapshot ? snapshot[field] ?? null : null,
      captured: Boolean(snapshot && snapshot[field] !== undefined && snapshot[field] !== null)
    }));
  }

  private profileDrift(run: RecommendationRunEntity, profile: PlannerProfileEntity | null) {
    const currentProfileHash = profile ? this.profileHash(profile) : "";
    const cacheProfileHash = this.cacheProfileHash(run.cacheKey);
    const versionChanged = profile ? Number(profile.profileVersion) !== Number(run.profileVersion) : true;
    const hashChanged = Boolean(profile && cacheProfileHash && currentProfileHash && cacheProfileHash !== currentProfileHash);
    const invalidationTriggers = [];
    if (!profile) invalidationTriggers.push("profile-missing");
    if (versionChanged || hashChanged) invalidationTriggers.push("profile-updated");
    if (run.expiresAt && run.expiresAt.getTime() <= Date.now()) invalidationTriggers.push("cache-expired");

    return {
      hasCurrentProfile: Boolean(profile),
      versionChanged,
      hashChanged,
      cacheProfileHash: cacheProfileHash || null,
      currentProfileHash: currentProfileHash || null,
      invalidationTriggers,
      profileChanged: versionChanged || hashChanged
    };
  }

  private cacheState(run: RecommendationRunEntity, profileDrift: ReturnType<AdminRecommendationsService["profileDrift"]>, cachePayloadAvailable: boolean) {
    let state: CacheTraceState = "not-cacheable";
    let label = "不进入缓存";
    let reason = "画像未完成或本次运行没有推荐缓存 key。";

    if (run.cacheKey && (run.status === "generated" || run.status === "no-match")) {
      if (profileDrift.profileChanged) {
        state = "profile-stale";
        label = "画像变化失效";
        reason = "当前画像版本或画像 hash 已不同，需要重新生成推荐。";
      } else if (run.expiresAt && run.expiresAt.getTime() <= Date.now()) {
        state = "expired";
        label = "已过期";
        reason = "缓存 TTL 已到期。";
      } else if (cachePayloadAvailable) {
        state = "hit-eligible";
        label = "可命中";
        reason = "缓存载荷仍存在，画像版本未变化。";
      } else {
        state = "payload-missing";
        label = "缓存载荷缺失";
        reason = "运行记录存在，但当前缓存中没有对应载荷，可能是 Redis 未启用或已被清理。";
      }
    }

    return {
      state,
      label,
      reason,
      cacheKey: run.cacheKey || "",
      payloadAvailable: cachePayloadAvailable,
      expiresAt: run.expiresAt?.toISOString() ?? null
    };
  }

  private traceSummary(results: ReturnType<AdminRecommendationsService["mapResult"]>[]) {
    const profileFields = new Set<string>();
    const publicDataFields = new Set<string>();
    let riskCount = 0;
    for (const result of results) {
      for (const field of result.profileFields) profileFields.add(field.field);
      for (const field of result.publicDataFields) publicDataFields.add(field.field);
      riskCount += result.riskSources.length;
    }
    return {
      profileFieldCount: profileFields.size,
      publicDataFieldCount: publicDataFields.size,
      riskCount
    };
  }

  private publicDataValue(field: SmartRecommendationPublicDataField, program: ProgramEntity | null, university: UniversityEntity | null) {
    if (field === "program.level") return program?.level ?? null;
    if (field === "program.category") return program?.category ?? null;
    if (field === "program.annualTuitionCny") return program?.annualTuitionCny ?? null;
    if (field === "program.requirement.gpa") return this.recordValue(program?.requirement, "gpa");
    if (field === "program.languageRequirement.ielts") return this.languageIelts(program);
    if (field === "program.publicDisplayStatus") return program?.publicDisplayStatus ?? null;
    if (field === "university.livingCostCny") return university?.livingCostCny ?? null;
    if (field === "university.acceptNoLanguage") return university?.acceptNoLanguage ?? null;
    if (field === "university.qsRank") return university?.qsRank ?? null;
    if (field === "university.publicDisplayStatus") return university?.publicDisplayStatus ?? null;
    return null;
  }

  private languageIelts(program: ProgramEntity | null) {
    return this.recordValue(program?.languageRequirement, "ielts");
  }

  private recordValue(source: object | null | undefined, key: string) {
    if (!source || typeof source !== "object") return null;
    const value = (source as Record<string, unknown>)[key];
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
  }

  private localizedName(value: Record<string, string> | null | undefined, fallback: string) {
    return value?.["zh-CN"] || value?.en || value?.ms || value?.["zh-TW"] || fallback;
  }

  private maskAccount(account: string) {
    const value = account.trim();
    if (!value) return "";
    if (value.includes("@")) {
      const [name, domain] = value.split("@");
      return `${name.slice(0, 2)}***@${domain}`;
    }
    if (value.length <= 4) return `${value.slice(0, 1)}***`;
    return `${value.slice(0, 3)}***${value.slice(-2)}`;
  }

  private normalizeStatus(status: string | undefined): RecommendationRunStatus | null {
    return RUN_STATUSES.has(status as RecommendationRunStatus) ? status as RecommendationRunStatus : null;
  }

  private statusLabel(status: RecommendationRunStatus) {
    const labels: Record<RecommendationRunStatus, string> = {
      "blocked-profile-incomplete": "画像不完整阻断",
      generated: "已生成",
      "no-match": "无匹配",
      expired: "已过期"
    };
    return labels[status] || status;
  }

  private cacheProfileHash(cacheKey: string) {
    const parts = cacheKey.split(":");
    if (parts.length >= 6 && parts[0] === "recommendation" && parts[1] === "profile") {
      return parts[4] || "";
    }
    return "";
  }

  private profileHash(profile: PlannerProfileEntity) {
    const source = {
      level: profile.level,
      targetCategory: profile.targetCategory,
      budgetCny: Number(profile.budgetCny),
      gpa: Number(profile.gpa),
      ielts: Number(profile.ielts),
      experience: profile.experience,
      acceptNoLanguage: profile.acceptNoLanguage,
      profileVersion: profile.profileVersion
    };
    return createHash("sha256").update(JSON.stringify(source)).digest("hex").slice(0, 32);
  }
}
