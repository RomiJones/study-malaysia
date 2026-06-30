import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { Repository } from "typeorm";
import {
  SMART_RECOMMENDATION_CACHE_INVALIDATION_TRIGGERS,
  SMART_RECOMMENDATION_CONTRACT,
  SMART_RECOMMENDATION_CONTRACT_SCHEMA_VERSION,
  SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS,
  SMART_RECOMMENDATION_PROFILE_COMPLETENESS_THRESHOLD,
  SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS,
  SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS,
  DEGREE_LEVEL_ORDER,
  hasValidQsWorldRank,
  type ApplicationTier,
  type LocalizedText,
  type SmartRecommendationAccessStatus,
  type SmartRecommendationBlockReason,
  type SmartRecommendationGateDto,
  type SmartRecommendationProfileCompletenessDto,
  type SmartRecommendationProfileField,
  type SmartRecommendationRequestDto,
  type SmartRecommendationRequiredProfileField,
  type SmartRecommendationResponseDto,
  type SmartRecommendationResultDto,
  type SmartRecommendationRiskDto,
  type SmartRecommendationRiskSeverity,
  type SmartRecommendationSavedProfileDto
} from "@studymy/shared";
import { CacheService } from "../common/cache.service.js";
import { getFilterableTuitionCny } from "../common/fee-strategy.helper.js";
import { buildRecommendation, isReadyForPublicCatalog } from "../common/mappers.js";
import {
  PlannerProfileEntity,
  ProgramEntity,
  RecommendationRunEntity,
  type RecommendationResultSnapshot,
  UniversityEntity
} from "../db/entities.js";

interface RecommendationBuildResult {
  item: SmartRecommendationResultDto;
  snapshot: RecommendationResultSnapshot;
}

const recommendationRuleVersion = "profile-gated-v1";
const recommendationCacheTtlSeconds = 30 * 60;

@Injectable()
export class RecommendationsService {
  private readonly profileRepository: Repository<PlannerProfileEntity>;
  private readonly recommendationRunRepository: Repository<RecommendationRunEntity>;
  private readonly programsRepository: Repository<ProgramEntity>;
  private readonly universitiesRepository: Repository<UniversityEntity>;
  private readonly cacheService: CacheService;

  constructor(
    @InjectRepository(PlannerProfileEntity) profileRepository: Repository<PlannerProfileEntity>,
    @InjectRepository(RecommendationRunEntity) recommendationRunRepository: Repository<RecommendationRunEntity>,
    @InjectRepository(ProgramEntity) programsRepository: Repository<ProgramEntity>,
    @InjectRepository(UniversityEntity) universitiesRepository: Repository<UniversityEntity>,
    @Inject(CacheService) cacheService: CacheService
  ) {
    this.profileRepository = profileRepository;
    this.recommendationRunRepository = recommendationRunRepository;
    this.programsRepository = programsRepository;
    this.universitiesRepository = universitiesRepository;
    this.cacheService = cacheService;
  }

  getContract() {
    return SMART_RECOMMENDATION_CONTRACT;
  }

  async getPersonalizedRecommendations(userId: number, input: SmartRecommendationRequestDto = { mode: "personalized-profile-match" }) {
    return this.buildPersonalizedResponse(userId, input, false);
  }

  async refreshPersonalizedRecommendations(userId: number, input: SmartRecommendationRequestDto = { mode: "personalized-profile-match" }) {
    return this.buildPersonalizedResponse(userId, input, true);
  }

  private async buildPersonalizedResponse(userId: number, input: SmartRecommendationRequestDto, forceRefresh: boolean) {
    this.ensurePersonalizedMode(input);

    const profile = await this.profileRepository.findOneBy({ userId });
    if (!profile) {
      const completeness = this.profileCompleteness(null);
      return this.blockedResponse("profile-incomplete", null, completeness, ["profile-required", "profile-incomplete"]);
    }

    if (input.profileVersion && input.profileVersion !== String(profile.profileVersion)) {
      throw this.badRequest(
        "SMART_RECOMMENDATION_PROFILE_STALE",
        localized(
          "Profile version is stale. Reload the saved student profile before refreshing recommendations.",
          "画像版本已过期，请重新读取已保存学生画像后再刷新推荐。",
          "Versi profil telah tamat tempoh. Muat semula profil pelajar tersimpan sebelum menyegar cadangan.",
          "畫像版本已過期，請重新讀取已儲存學生畫像後再重新整理推薦。"
        )
      );
    }

    const completeness = this.profileCompleteness(profile);
    const savedProfile = this.mapSavedProfile(profile);
    if (!completeness.isComplete) {
      await this.persistBlockedRun(userId, profile, completeness);
      return this.blockedResponse("profile-incomplete", savedProfile, completeness, ["profile-incomplete"]);
    }

    const profileHash = this.profileHash(profile);
    const cacheKey = this.cacheKey(userId, profile, profileHash, input.locale);
    if (!forceRefresh) {
      const cached = await this.cacheService.getJson<SmartRecommendationResponseDto>(cacheKey);
      if (cached) return cached;
    }

    const built = await this.buildRecommendations(userId, profile);
    const generatedAt = new Date();
    const response: SmartRecommendationResponseDto = {
      schemaVersion: SMART_RECOMMENDATION_CONTRACT_SCHEMA_VERSION,
      status: built.length ? "ready" : "no-match",
      gate: this.gate(built.length ? "ready" : "no-match", [], []),
      profile: savedProfile,
      profileCompleteness: completeness,
      recommendations: built.map((result) => result.item),
      cacheKey: {
        userId,
        profileVersion: String(profile.profileVersion),
        profileHash,
        locale: input.locale
      },
      cachePolicy: {
        scope: "user-profile",
        profileVersion: String(profile.profileVersion),
        ruleVersion: recommendationRuleVersion,
        expiresAt: this.cacheExpiresAt(generatedAt).toISOString(),
        invalidationTriggers: [...SMART_RECOMMENDATION_CACHE_INVALIDATION_TRIGGERS]
      },
      generatedAt: generatedAt.toISOString()
    };

    await this.persistGeneratedRun(userId, profile, profileHash, built, generatedAt);
    await this.cacheService.setJson(cacheKey, response, recommendationCacheTtlSeconds);
    return response;
  }

  private ensurePersonalizedMode(input: SmartRecommendationRequestDto) {
    if (input.mode !== "personalized-profile-match") {
      throw this.badRequest(
        "SMART_RECOMMENDATION_MODE_INVALID",
        localized(
          "Smart recommendations only support personalized-profile-match mode.",
          "智能推荐仅支持 personalized-profile-match 模式。",
          "Cadangan pintar hanya menyokong mod personalized-profile-match.",
          "智能推薦僅支援 personalized-profile-match 模式。"
        )
      );
    }
  }

  private badRequest(code: string, message: LocalizedText) {
    return new BadRequestException({ code, message });
  }

  private profileCompleteness(profile: PlannerProfileEntity | null): SmartRecommendationProfileCompletenessDto {
    const completedFields: SmartRecommendationProfileField[] = [];
    const requiredFields = [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS];
    const optionalFields = [...SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS];

    if (profile) {
      for (const field of [...requiredFields, ...optionalFields]) {
        if (this.hasProfileField(profile, field)) completedFields.push(field);
      }
    }

    const missingRequiredFields = requiredFields.filter((field) => !completedFields.includes(field));
    const missingOptionalFields = optionalFields.filter((field) => !completedFields.includes(field));
    const score = completedFields.reduce((total, field) => total + SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field], 0);
    const hasConfirmedProfile = Boolean(profile?.profileCompletedAt && profile.completenessStatus === "complete");

    return {
      score: Math.min(score, 100),
      threshold: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_THRESHOLD,
      isComplete: hasConfirmedProfile && missingRequiredFields.length === 0 && score >= SMART_RECOMMENDATION_PROFILE_COMPLETENESS_THRESHOLD,
      requiredFields,
      optionalFields,
      completedFields,
      missingRequiredFields,
      missingOptionalFields
    };
  }

  private hasProfileField(profile: PlannerProfileEntity, field: SmartRecommendationProfileField) {
    if (field === "level") return DEGREE_LEVEL_ORDER.includes(profile.level);
    if (field === "targetCategory") return typeof profile.targetCategory === "string" && profile.targetCategory.trim().length > 0;
    if (field === "budgetCny") return Number(profile.budgetCny) > 0;
    if (field === "gpa") return Number(profile.gpa) > 0;
    if (field === "ielts") return Number(profile.ielts) > 0;
    if (field === "experience") return typeof profile.experience === "string" && profile.experience.trim().length > 0;
    return typeof profile.acceptNoLanguage === "boolean";
  }

  private blockedResponse(
    status: SmartRecommendationAccessStatus,
    profile: SmartRecommendationSavedProfileDto | null,
    completeness: SmartRecommendationProfileCompletenessDto,
    blockReasons: SmartRecommendationBlockReason[]
  ): SmartRecommendationResponseDto {
    return {
      schemaVersion: SMART_RECOMMENDATION_CONTRACT_SCHEMA_VERSION,
      status,
      gate: this.gate(status, blockReasons, completeness.missingRequiredFields),
      profile,
      profileCompleteness: completeness,
      recommendations: []
    };
  }

  private gate(
    status: SmartRecommendationAccessStatus,
    blockReasons: SmartRecommendationBlockReason[],
    missingProfileFields: SmartRecommendationRequiredProfileField[]
  ): SmartRecommendationGateDto {
    const canShowRecommendations = status === "ready" || status === "no-match";
    const requiresCompleteProfile = status === "profile-incomplete";

    return {
      status,
      mode: "personalized-profile-match",
      canShowRecommendations,
      requiresAuthentication: false,
      requiresCompleteProfile,
      primaryAction: status === "profile-incomplete" ? "open-profile" : status === "no-match" ? "adjust-profile" : "refresh-recommendations",
      message: this.gateMessage(status),
      blockReasons,
      missingProfileFields
    };
  }

  private gateMessage(status: SmartRecommendationAccessStatus): LocalizedText {
    if (status === "profile-incomplete") {
      return {
        en: "Complete your saved student profile before viewing personalized recommendations.",
        ms: "Lengkapkan profil pelajar yang disimpan sebelum melihat cadangan peribadi.",
        "zh-CN": "请先完善已保存的学生画像，再查看个性化智能推荐。",
        "zh-TW": "請先完善已儲存的學生畫像，再查看個人化智能推薦。"
      };
    }
    if (status === "no-match") {
      return {
        en: "No public programs match the saved profile yet.",
        ms: "Belum ada program awam yang sepadan dengan profil tersimpan.",
        "zh-CN": "当前公开专业数据中暂未匹配到符合该画像的推荐结果。",
        "zh-TW": "目前公開專業資料中暫未匹配到符合該畫像的推薦結果。"
      };
    }
    return {
      en: "Recommendations are generated from the saved student profile and public program data.",
      ms: "Cadangan dijana daripada profil pelajar tersimpan dan data program awam.",
      "zh-CN": "推荐结果已基于已保存学生画像和公开专业数据生成。",
      "zh-TW": "推薦結果已基於已儲存學生畫像和公開專業資料生成。"
    };
  }

  private mapSavedProfile(profile: PlannerProfileEntity): SmartRecommendationSavedProfileDto {
    return {
      userId: profile.userId,
      source: "saved-user-profile",
      profileVersion: String(profile.profileVersion),
      updatedAt: profile.updatedAt?.toISOString?.() || new Date().toISOString(),
      level: profile.level,
      targetCategory: profile.targetCategory,
      budgetCny: Number(profile.budgetCny),
      gpa: Number(profile.gpa),
      ielts: Number(profile.ielts),
      experience: profile.experience,
      acceptNoLanguage: profile.acceptNoLanguage
    };
  }

  private async buildRecommendations(userId: number, profile: PlannerProfileEntity): Promise<RecommendationBuildResult[]> {
    const [universities, programs] = await Promise.all([
      this.universitiesRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } }),
      this.programsRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } })
    ]);
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const results: RecommendationBuildResult[] = [];

    for (const program of programs) {
      const university = universityMap.get(program.universityId);
      if (!university) continue;
      if (!isReadyForPublicCatalog(program) || !isReadyForPublicCatalog(university)) continue;
      if (program.level !== profile.level) continue;
      if (program.category !== profile.targetCategory) continue;

      const built = this.scoreProgram(userId, profile, university, program);
      if (built) results.push(built);
    }

    return results.sort((left, right) => right.item.score - left.item.score).slice(0, SMART_RECOMMENDATION_CONTRACT.maxResults);
  }

  private scoreProgram(
    userId: number,
    profile: PlannerProfileEntity,
    university: UniversityEntity,
    program: ProgramEntity
  ): RecommendationBuildResult | null {
    const filterableTuitionCny = getFilterableTuitionCny(program);
    const annualCostCny = filterableTuitionCny == null ? null : filterableTuitionCny + university.livingCostCny;
    const profileVersion = String(profile.profileVersion);
    const reasons = { en: [] as string[], ms: [] as string[], "zh-CN": [] as string[], "zh-TW": [] as string[] };
    const reasonsDetailed: SmartRecommendationResultDto["reasonsDetailed"] = [
      {
        code: "level-match",
        profileField: "level",
        publicDataField: "program.level",
        message: localized(
          "Degree level matches the saved profile.",
          "层次匹配已保存画像。",
          "Tahap pengajian sepadan dengan profil tersimpan.",
          "層次匹配已儲存畫像。"
        ),
        profileValue: profile.level,
        publicDataValue: program.level
      },
      {
        code: "category-match",
        profileField: "targetCategory",
        publicDataField: "program.category",
        message: localized(
          "Program category matches the target direction.",
          "专业方向匹配目标方向。",
          "Kategori program sepadan dengan arah sasaran.",
          "專業方向匹配目標方向。"
        ),
        profileValue: profile.targetCategory,
        publicDataValue: program.category
      }
    ];
    const risks: SmartRecommendationRiskDto[] = [];
    let score = 40;

    reasons.en.push("Degree level matched", "Program category matched");
    reasons.ms.push("Tahap pengajian sepadan", "Kategori program sepadan");
    reasons["zh-CN"].push("学历层次匹配", "专业方向匹配");
    reasons["zh-TW"].push("學歷層次匹配", "專業方向匹配");

    const gpaScore = this.scoreGpa(profile, program, reasons, reasonsDetailed, risks);
    const languageScore = this.scoreLanguage(profile, university, program, reasons, reasonsDetailed, risks);
    const budgetScore = this.scoreBudget(profile, annualCostCny, reasons, reasonsDetailed, risks);
    score += gpaScore + languageScore + budgetScore + (hasValidQsWorldRank(university.qsRank) ? university.qsRank <= 100 ? 8 : university.qsRank <= 300 ? 5 : 0 : 0);

    if (hasValidQsWorldRank(university.qsRank) && university.qsRank <= 300) {
      reasonsDetailed.push({
        code: "ranking-fit",
        publicDataField: "university.qsRank",
        message: localized(
          "University ranking adds shortlist confidence.",
          "院校排名提升候选可信度。",
          "Kedudukan universiti menambah keyakinan senarai pendek.",
          "院校排名提升候選可信度。"
        ),
        publicDataValue: university.qsRank
      });
    }

    if (score < 58 || risks.some((risk) => risk.severity === "critical")) return null;

    const base = buildRecommendation(university, program, score, reasons);
    const item: SmartRecommendationResultDto = {
      ...base,
      tier: this.tier(score),
      publicDisplayStatus: "ready",
      reasonsDetailed,
      risks,
      trace: {
        userId,
        profileVersion,
        profileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS, ...SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS],
        publicDataFields: [
          "program.level",
          "program.category",
          "program.annualTuitionCny",
          "program.requirement.gpa",
          "program.languageRequirement.ielts",
          "university.livingCostCny",
          "university.acceptNoLanguage",
          "university.qsRank",
          "program.publicDisplayStatus",
          "university.publicDisplayStatus"
        ],
        universityId: university.id,
        programId: program.id,
        generatedAt: new Date().toISOString()
      }
    };

    return {
      item,
      snapshot: {
        universityId: university.id,
        programId: program.id,
        score,
        annualCostCny,
        tier: item.tier,
        publicDisplayStatus: item.publicDisplayStatus,
        reasons,
        reasonsDetailed,
        risks,
        trace: item.trace
      }
    };
  }

  private scoreGpa(
    profile: PlannerProfileEntity,
    program: ProgramEntity,
    reasons: SmartRecommendationResultDto["reasons"],
    details: SmartRecommendationResultDto["reasonsDetailed"],
    risks: SmartRecommendationRiskDto[]
  ) {
    const profileGpa = Number(profile.gpa);
    const requiredGpa = Number(program.requirement.gpa);
    if (profileGpa >= requiredGpa) {
      reasons.en.push("GPA meets the academic requirement");
      reasons.ms.push("GPA memenuhi syarat akademik");
      reasons["zh-CN"].push("GPA 达到学术要求");
      reasons["zh-TW"].push("GPA 達到學術要求");
      details.push({
        code: "gpa-meets-requirement",
        profileField: "gpa",
        publicDataField: "program.requirement.gpa",
        message: localized(
          "GPA meets the published academic threshold.",
          "GPA 达到公开学术门槛。",
          "GPA memenuhi ambang akademik yang diterbitkan.",
          "GPA 達到公開學術門檻。"
        ),
        profileValue: profileGpa,
        publicDataValue: requiredGpa
      });
      return 20;
    }
    if (profileGpa + 0.3 >= requiredGpa) {
      risks.push(this.risk("gpa-below-requirement", "warning", "gpa", "program.requirement.gpa"));
      details.push({
        code: "gpa-close",
        profileField: "gpa",
        publicDataField: "program.requirement.gpa",
        message: localized(
          "GPA is close to the public threshold and needs review.",
          "GPA 接近公开门槛，需要进一步评估。",
          "GPA hampir dengan ambang awam dan perlu disemak.",
          "GPA 接近公開門檻，需要進一步評估。"
        ),
        profileValue: profileGpa,
        publicDataValue: requiredGpa
      });
      return 10;
    }
    risks.push(this.risk("gpa-below-requirement", "critical", "gpa", "program.requirement.gpa"));
    return 0;
  }

  private scoreLanguage(
    profile: PlannerProfileEntity,
    university: UniversityEntity,
    program: ProgramEntity,
    reasons: SmartRecommendationResultDto["reasons"],
    details: SmartRecommendationResultDto["reasonsDetailed"],
    risks: SmartRecommendationRiskDto[]
  ) {
    const profileIelts = Number(profile.ielts);
    const requiredIelts = Number(program.languageRequirement.ielts);
    if (profileIelts >= requiredIelts) {
      reasons.en.push("Language score meets the requirement");
      reasons.ms.push("Skor bahasa memenuhi syarat");
      reasons["zh-CN"].push("语言成绩达标");
      reasons["zh-TW"].push("語言成績達標");
      details.push({
        code: "language-meets-requirement",
        profileField: "ielts",
        publicDataField: "program.languageRequirement.ielts",
        message: localized(
          "IELTS meets the public language requirement.",
          "雅思达到公开语言要求。",
          "IELTS memenuhi syarat bahasa awam.",
          "雅思達到公開語言要求。"
        ),
        profileValue: profileIelts,
        publicDataValue: requiredIelts
      });
      return 18;
    }
    if (profile.acceptNoLanguage && university.acceptNoLanguage) {
      reasons.en.push("Conditional language pathway is available");
      reasons.ms.push("Laluan bahasa bersyarat tersedia");
      reasons["zh-CN"].push("支持条件录取或后补语言");
      reasons["zh-TW"].push("支援條件錄取或後補語言");
      details.push({
        code: "conditional-language-available",
        profileField: "acceptNoLanguage",
        publicDataField: "university.acceptNoLanguage",
        message: localized(
          "The saved profile accepts a conditional language pathway.",
          "画像接受条件录取或后补语言路径。",
          "Profil tersimpan menerima laluan bahasa bersyarat.",
          "畫像接受條件錄取或後補語言路徑。"
        ),
        profileValue: profile.acceptNoLanguage,
        publicDataValue: university.acceptNoLanguage
      });
      risks.push(this.risk("conditional-language-required", "warning", "ielts", "program.languageRequirement.ielts"));
      return 10;
    }
    risks.push(this.risk("language-below-requirement", "critical", "ielts", "program.languageRequirement.ielts"));
    return 0;
  }

  private scoreBudget(
    profile: PlannerProfileEntity,
    annualCostCny: number | null,
    reasons: SmartRecommendationResultDto["reasons"],
    details: SmartRecommendationResultDto["reasonsDetailed"],
    risks: SmartRecommendationRiskDto[]
  ) {
    const budget = Number(profile.budgetCny);
    if (annualCostCny != null && annualCostCny <= budget) {
      reasons.en.push("First-year cost is within budget");
      reasons.ms.push("Kos tahun pertama dalam bajet");
      reasons["zh-CN"].push("首年成本在预算内");
      reasons["zh-TW"].push("首年成本在預算內");
      details.push({
        code: "budget-within-range",
        profileField: "budgetCny",
        publicDataField: "program.annualTuitionCny",
        message: localized(
          "Budget covers estimated first-year tuition and living cost.",
          "预算可覆盖预计首年学费和生活费。",
          "Bajet menampung anggaran yuran dan kos hidup tahun pertama.",
          "預算可覆蓋預計首年學費和生活費。"
        ),
        profileValue: budget,
        publicDataValue: annualCostCny
      });
      return 18;
    }
    if (annualCostCny != null && annualCostCny <= budget * 1.15) {
      risks.push(this.risk("budget-over-limit", "warning", "budgetCny", "program.annualTuitionCny"));
      details.push({
        code: "budget-close",
        profileField: "budgetCny",
        publicDataField: "program.annualTuitionCny",
        message: localized(
          "Estimated first-year cost is close to the budget.",
          "预计首年成本接近预算上限。",
          "Anggaran kos tahun pertama hampir dengan bajet.",
          "預計首年成本接近預算上限。"
        ),
        profileValue: budget,
        publicDataValue: annualCostCny
      });
      return 8;
    }
    risks.push(this.risk("budget-over-limit", "critical", "budgetCny", "program.annualTuitionCny"));
    return 0;
  }

  private risk(
    code: SmartRecommendationRiskDto["code"],
    severity: SmartRecommendationRiskSeverity,
    profileField: SmartRecommendationRiskDto["profileField"],
    publicDataField: SmartRecommendationRiskDto["publicDataField"]
  ): SmartRecommendationRiskDto {
    const messages: Record<SmartRecommendationRiskDto["code"], LocalizedText> = {
      "budget-over-limit": localized(
        "Budget is below the estimated cost.",
        "预算低于预计成本。",
        "Bajet lebih rendah daripada anggaran kos.",
        "預算低於預計成本。"
      ),
      "gpa-below-requirement": localized(
        "GPA is below the public requirement.",
        "GPA 低于公开要求。",
        "GPA lebih rendah daripada syarat awam.",
        "GPA 低於公開要求。"
      ),
      "language-below-requirement": localized(
        "Language score is below the public requirement.",
        "语言成绩低于公开要求。",
        "Skor bahasa lebih rendah daripada syarat awam.",
        "語言成績低於公開要求。"
      ),
      "conditional-language-required": localized(
        "Recommendation depends on a conditional language pathway.",
        "该推荐依赖条件录取或后补语言路径。",
        "Cadangan bergantung pada laluan bahasa bersyarat.",
        "該推薦依賴條件錄取或後補語言路徑。"
      ),
      "limited-public-data": localized(
        "Public data is limited and needs review.",
        "公开数据有限，需要复核。",
        "Data awam terhad dan perlu disemak.",
        "公開資料有限，需要複核。"
      ),
      "source-needs-review": localized(
        "Official source still needs review.",
        "官方来源仍需核验。",
        "Sumber rasmi masih perlu semakan.",
        "官方來源仍需核驗。"
      )
    };
    return {
      code,
      severity,
      profileField,
      publicDataField,
      message: messages[code],
      suggestion: localized(
        "Review the saved profile or adjust the shortlist condition.",
        "请复核画像或调整筛选条件。",
        "Semak profil tersimpan atau laraskan syarat senarai pendek.",
        "請複核畫像或調整篩選條件。"
      )
    };
  }

  private tier(score: number): ApplicationTier {
    if (score >= 82) return "target";
    if (score >= 68) return "safe";
    return "reach";
  }

  private async persistBlockedRun(
    userId: number,
    profile: PlannerProfileEntity,
    completeness: SmartRecommendationProfileCompletenessDto
  ) {
    await this.recommendationRunRepository.save(this.recommendationRunRepository.create({
      userId,
      profileId: profile.id,
      profileVersion: profile.profileVersion,
      status: "blocked-profile-incomplete",
      cacheKey: "",
      profileSnapshot: null,
      requiredProfileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS],
      missingProfileFields: completeness.missingRequiredFields,
      results: null,
      resultCount: 0,
      generatedAt: null,
      expiresAt: null,
      auditNote: "Blocked because saved student profile is incomplete for personalized recommendations."
    }));
  }

  private async persistGeneratedRun(
    userId: number,
    profile: PlannerProfileEntity,
    profileHash: string,
    built: RecommendationBuildResult[],
    generatedAt: Date
  ) {
    const expiresAt = this.cacheExpiresAt(generatedAt);
    await this.recommendationRunRepository.save(this.recommendationRunRepository.create({
      userId,
      profileId: profile.id,
      profileVersion: profile.profileVersion,
      status: built.length ? "generated" : "no-match",
      cacheKey: this.cacheKey(userId, profile, profileHash),
      profileSnapshot: {
        level: profile.level,
        targetCategory: profile.targetCategory,
        budgetCny: Number(profile.budgetCny),
        gpa: Number(profile.gpa),
        ielts: Number(profile.ielts),
        experience: profile.experience,
        acceptNoLanguage: profile.acceptNoLanguage
      },
      requiredProfileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS],
      missingProfileFields: [],
      results: built.map((result) => result.snapshot),
      resultCount: built.length,
      generatedAt,
      expiresAt,
      auditNote: "Generated from saved student profile and public catalog data."
    }));

    profile.recommendationRefreshedAt = generatedAt;
    await this.profileRepository.save(profile);
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

  private cacheKey(userId: number, profile: PlannerProfileEntity, profileHash: string, locale?: string) {
    return `recommendation:profile:${userId}:${profile.profileVersion}:${profileHash}:${locale || "all"}`;
  }

  private cacheExpiresAt(generatedAt: Date) {
    return new Date(generatedAt.getTime() + recommendationCacheTtlSeconds * 1000);
  }
}

function localized(en: string, zhCN: string, ms: string, zhTW: string): LocalizedText {
  return {
    en,
    ms,
    "zh-CN": zhCN,
    "zh-TW": zhTW
  };
}
