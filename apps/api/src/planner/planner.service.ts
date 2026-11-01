import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { Repository } from "typeorm";
import {
  SMART_RECOMMENDATION_PROFILE_COMPLETENESS_THRESHOLD,
  SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS,
  SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS,
  SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS,
  DEGREE_LEVEL_ORDER,
  hasValidQsWorldRank,
  type ApplicationStage,
  type LocalizedText,
  type MaterialStatus,
  type PlannerProfile,
  type PlannerVisaChecklist,
  type SmartRecommendationProfileField
} from "@studymy/shared";
import { getFilterableTuitionCny } from "../common/fee-strategy.helper.js";
import { PlannerProfileEntity, PlannerTaskEntity, ProgramEntity, UniversityEntity, UserEntity } from "../db/entities.js";
import { buildRecommendation, isReadyForPublicCatalog, mapPlannerMaterials, mapPlannerProfile, mapPlannerTasks, mapVisaChecklist } from "../common/mappers.js";

interface PlannerTaskInput {
  universityId: number;
  programId: number;
  tier?: Record<string, string>;
  stage?: ApplicationStage;
  progress?: number;
  deadlineNote?: Record<string, string>;
  nextAction?: Record<string, string>;
}

interface PlannerLocalStateInput {
  profile?: Partial<PlannerProfile>;
  materialProgress?: Record<string, MaterialStatus>;
  visaChecklist?: Partial<PlannerVisaChecklist>;
  tasks?: PlannerTaskInput[];
}

@Injectable()
export class PlannerService {
  private readonly profileRepository: Repository<PlannerProfileEntity>;
  private readonly taskRepository: Repository<PlannerTaskEntity>;
  private readonly programsRepository: Repository<ProgramEntity>;
  private readonly universitiesRepository: Repository<UniversityEntity>;
  private readonly usersRepository: Repository<UserEntity>;

  constructor(
    @InjectRepository(PlannerProfileEntity) profileRepository: Repository<PlannerProfileEntity>,
    @InjectRepository(PlannerTaskEntity) taskRepository: Repository<PlannerTaskEntity>,
    @InjectRepository(ProgramEntity) programsRepository: Repository<ProgramEntity>,
    @InjectRepository(UniversityEntity) universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(UserEntity) usersRepository: Repository<UserEntity>
  ) {
    this.profileRepository = profileRepository;
    this.taskRepository = taskRepository;
    this.programsRepository = programsRepository;
    this.universitiesRepository = universitiesRepository;
    this.usersRepository = usersRepository;
  }

  async getDashboard(userId: number) {
    const profile = await this.ensureProfile(userId);
    const tasks = await this.findReadyTasks(userId);
    const materials = mapPlannerMaterials(profile);
    const visaChecklist = mapVisaChecklist(profile);
    const recommendationStatus = this.recommendationProfileStatus(profile);
    const recommendations = recommendationStatus.isComplete ? await this.buildProfileRecommendations(profile) : [];
    const doneMaterials = materials.filter((item) => item.status === "done").length;
    const readinessScore = Math.min(
      96,
      Math.max(
        38,
        Math.round(
          (doneMaterials / materials.length) * 34 +
            Math.min(Number(profile.gpa) / 3.5, 1) * 24 +
            Math.min(Number(profile.ielts) / 6.5, 1) * 18 +
            (recommendations[0] ? 14 : 6)
        )
      )
    );

    return {
      profile: mapPlannerProfile(profile),
      materials,
      tasks: mapPlannerTasks(tasks),
      visaChecklist,
      summary: {
        readinessScore,
        materialCompletion: Math.round((doneMaterials / materials.length) * 100),
        profileCompleteness: recommendationStatus.score,
        recommendationCount: recommendations.length,
        activeTaskCount: tasks.length,
        visaDoneCount: Object.values(visaChecklist).filter(Boolean).length
      },
      recommendations
    };
  }

  async updateProfile(userId: number, payload: Partial<PlannerProfile>) {
    const profile = await this.ensureProfile(userId);
    Object.assign(profile, payload);
    this.syncProfileRecommendationState(profile, true, this.confirmedRecommendationProfileFields(payload));
    await this.profileRepository.save(profile);
    return this.getDashboard(userId);
  }

  async saveMaterials(userId: number, materialProgress: Record<string, MaterialStatus>) {
    const profile = await this.ensureProfile(userId);
    profile.materialProgress = this.normalizeMaterialProgress(materialProgress);
    await this.profileRepository.save(profile);
    return this.getDashboard(userId);
  }

  async updateMaterialStatus(userId: number, key: string, status: MaterialStatus) {
    const profile = await this.ensureProfile(userId);
    profile.materialProgress = { ...(profile.materialProgress || {}), [key]: status };
    await this.profileRepository.save(profile);
    return this.getDashboard(userId);
  }

  async addTask(userId: number, universityId: number, programId: number) {
    await this.ensureTaskTarget(universityId, programId);

    const existing = await this.taskRepository.findOne({ where: { userId, universityId, programId } });
    if (existing) {
      throw new BadRequestException("Task already exists");
    }

    await this.taskRepository.save(
      this.taskRepository.create({
        userId,
        universityId,
        programId,
        tier: {
          en: "New",
          ms: "Baharu",
          "zh-CN": "新增",
          "zh-TW": "新增"
        },
        stage: "draft",
        progress: 18,
        deadlineNote: {
          en: "Confirm shortlist within 7 days.",
          ms: "Sahkan senarai pendek dalam 7 hari.",
          "zh-CN": "建议 7 天内确认是否进入正式申请名单。",
          "zh-TW": "建議 7 天內確認是否進入正式申請名單。"
        },
        nextAction: {
          en: "Lock application strategy and material package.",
          ms: "Tetapkan strategi permohonan dan pakej dokumen.",
          "zh-CN": "锁定申请策略与材料包。",
          "zh-TW": "鎖定申請策略與材料包。"
        }
      })
    );

    return this.getDashboard(userId);
  }

  async listTasks(userId: number) {
    const tasks = await this.findReadyTasks(userId);
    return {
      tasks: mapPlannerTasks(tasks)
    };
  }

  async saveTasks(userId: number, taskInputs: PlannerTaskInput[]) {
    const uniqueInputs = this.uniqueTaskInputs(taskInputs);
    const builtTasks = [];
    for (const input of uniqueInputs) {
      builtTasks.push(await this.buildTaskEntity(userId, input));
    }

    const existing = await this.taskRepository.find({ where: { userId } });
    if (existing.length) {
      await this.taskRepository.remove(existing);
    }
    if (builtTasks.length) {
      await this.taskRepository.save(builtTasks);
    }
    return this.getDashboard(userId);
  }

  async updateTask(userId: number, taskId: number, payload: Partial<PlannerTaskInput>) {
    const task = await this.taskRepository.findOneBy({ id: taskId, userId });
    if (!task) throw new NotFoundException("Task not found");

    const universityId = payload.universityId ?? task.universityId;
    const programId = payload.programId ?? task.programId;
    if (universityId !== task.universityId || programId !== task.programId) {
      await this.ensureTaskTarget(universityId, programId);
      task.universityId = universityId;
      task.programId = programId;
    }

    if (payload.tier) task.tier = this.normalizeLocalizedText(payload.tier, task.tier);
    if (payload.stage) task.stage = payload.stage;
    if (typeof payload.progress === "number") task.progress = this.clampProgress(payload.progress);
    if (payload.deadlineNote) task.deadlineNote = this.normalizeLocalizedText(payload.deadlineNote, task.deadlineNote);
    if (payload.nextAction) task.nextAction = this.normalizeLocalizedText(payload.nextAction, task.nextAction);

    await this.taskRepository.save(task);
    return this.getDashboard(userId);
  }

  async deleteTask(userId: number, taskId: number) {
    const task = await this.taskRepository.findOneBy({ id: taskId, userId });
    if (task) {
      await this.taskRepository.remove(task);
    }
    return this.getDashboard(userId);
  }

  async advanceTask(userId: number, taskId: number) {
    const task = await this.taskRepository.findOneBy({ id: taskId, userId });
    if (!task) throw new NotFoundException("Task not found");

    const stages = [
      {
        stage: "draft",
        progress: 20,
        nextAction: { en: "Confirm shortlist and required materials.", ms: "Sahkan senarai pendek dan dokumen.", "zh-CN": "确认目标名单与材料包。", "zh-TW": "確認目標名單與材料包。" },
        deadlineNote: { en: "Within 7 days", ms: "Dalam 7 hari", "zh-CN": "建议 7 天内", "zh-TW": "建議 7 天內" }
      },
      {
        stage: "materials",
        progress: 45,
        nextAction: { en: "Complete language, recommendation and degree documents.", ms: "Lengkapkan dokumen bahasa, rujukan dan ijazah.", "zh-CN": "补齐语言、推荐信和学历材料。", "zh-TW": "補齊語言、推薦信和學歷材料。" },
        deadlineNote: { en: "Within 10 days", ms: "Dalam 10 hari", "zh-CN": "建议 10 天内", "zh-TW": "建議 10 天內" }
      },
      {
        stage: "ready",
        progress: 70,
        nextAction: { en: "Submit form and fee package.", ms: "Hantar borang dan yuran permohonan.", "zh-CN": "完成表单与申请费准备。", "zh-TW": "完成表單與申請費準備。" },
        deadlineNote: { en: "Within 14 days", ms: "Dalam 14 hari", "zh-CN": "建议 14 天内递交", "zh-TW": "建議 14 天內遞交" }
      },
      {
        stage: "review",
        progress: 82,
        nextAction: { en: "Track review feedback and missing documents.", ms: "Jejaki maklum balas semakan dan dokumen kurang.", "zh-CN": "跟进审核反馈与补件。", "zh-TW": "跟進審核回饋與補件。" },
        deadlineNote: { en: "Keep following up", ms: "Teruskan susulan", "zh-CN": "保持跟进", "zh-TW": "保持跟進" }
      },
      {
        stage: "conditional-offer",
        progress: 92,
        nextAction: { en: "Close offer conditions and deposit steps.", ms: "Selesaikan syarat offer dan deposit.", "zh-CN": "完成 conditional offer 条件与押金步骤。", "zh-TW": "完成 conditional offer 條件與押金步驟。" },
        deadlineNote: { en: "Follow offer timeline", ms: "Ikut garis masa offer", "zh-CN": "按 offer 节点推进", "zh-TW": "按 offer 節點推進" }
      },
      {
        stage: "visa",
        progress: 100,
        nextAction: { en: "Move into visa and pre-departure workflow.", ms: "Masuk ke aliran visa dan pra-berlepas.", "zh-CN": "转入签证与行前流程。", "zh-TW": "轉入簽證與行前流程。" },
        deadlineNote: { en: "Per visa requirement", ms: "Mengikut keperluan visa", "zh-CN": "按签证要求推进", "zh-TW": "按簽證要求推進" }
      }
    ];

    const currentIndex = stages.findIndex((item) => item.stage === task.stage);
    const nextStage = stages[Math.min(currentIndex + 1, stages.length - 1)];
    Object.assign(task, nextStage);
    await this.taskRepository.save(task);
    return this.getDashboard(userId);
  }

  async updateVisa(userId: number, payload: Partial<PlannerVisaChecklist>) {
    const profile = await this.ensureProfile(userId);
    profile.visaChecklist = { ...(profile.visaChecklist || {}), ...payload };
    await this.profileRepository.save(profile);
    return this.getDashboard(userId);
  }

  async saveVisa(userId: number, payload: Partial<PlannerVisaChecklist>) {
    const profile = await this.ensureProfile(userId);
    profile.visaChecklist = { ...this.defaultVisaChecklist(), ...payload };
    await this.profileRepository.save(profile);
    return this.getDashboard(userId);
  }

  async mergeLocalState(userId: number, payload: PlannerLocalStateInput) {
    const profile = await this.ensureProfile(userId);
    if (payload.profile) {
      Object.assign(profile, payload.profile);
    }
    if (payload.materialProgress) {
      profile.materialProgress = {
        ...(profile.materialProgress || {}),
        ...this.normalizeMaterialProgress(payload.materialProgress)
      };
    }
    if (payload.visaChecklist) {
      profile.visaChecklist = { ...(profile.visaChecklist || this.defaultVisaChecklist()), ...payload.visaChecklist };
    }
    if (payload.profile) {
      this.syncProfileRecommendationState(profile, true, this.confirmedRecommendationProfileFields(payload.profile));
    }
    await this.profileRepository.save(profile);

    const skippedTasks = await this.mergeTasks(userId, payload.tasks || []);

    return {
      dashboard: await this.getDashboard(userId),
      skippedTasks,
      mergeStrategy: {
        favorites: "Call POST /favorites/merge with localStorage universityIds and programIds.",
        compare: "Call POST /compare/merge with localStorage universityIds.",
        plannerProfile: "Explicit local profile fields overwrite server fields.",
        materialProgress: "Explicit local material statuses overwrite matching server keys.",
        visaChecklist: "Explicit local checklist flags overwrite matching server keys.",
        tasks: "Server tasks are kept first and local tasks are appended by universityId + programId."
      }
    };
  }

  private async buildTaskEntity(userId: number, input: PlannerTaskInput) {
    await this.ensureTaskTarget(input.universityId, input.programId);
    const defaults = this.defaultTaskFields();
    return this.taskRepository.create({
      userId,
      universityId: input.universityId,
      programId: input.programId,
      tier: this.normalizeLocalizedText(input.tier, defaults.tier),
      stage: input.stage || defaults.stage,
      progress: this.clampProgress(input.progress ?? defaults.progress),
      deadlineNote: this.normalizeLocalizedText(input.deadlineNote, defaults.deadlineNote),
      nextAction: this.normalizeLocalizedText(input.nextAction, defaults.nextAction)
    });
  }

  private async mergeTasks(userId: number, taskInputs: PlannerTaskInput[]) {
    const current = await this.findReadyTasks(userId);
    const existingKeys = new Set(current.map((task) => `${task.universityId}:${task.programId}`));
    const additions: PlannerTaskEntity[] = [];
    const skippedTasks: Array<{ universityId: number; programId: number; reason: string }> = [];

    for (const input of this.uniqueTaskInputs(taskInputs)) {
      const key = `${input.universityId}:${input.programId}`;
      if (existingKeys.has(key)) continue;
      try {
        additions.push(await this.buildTaskEntity(userId, input));
        existingKeys.add(key);
      } catch {
        skippedTasks.push({ universityId: input.universityId, programId: input.programId, reason: "Target university or program not found" });
      }
    }

    if (additions.length) {
      await this.taskRepository.save(additions);
    }

    return skippedTasks;
  }

  private async ensureTaskTarget(universityId: number, programId: number) {
    if (!Number.isInteger(universityId) || universityId <= 0) {
      throw new BadRequestException("University id is required");
    }
    if (!Number.isInteger(programId) || programId <= 0) {
      throw new BadRequestException("Program id is required");
    }

    const [university, program] = await Promise.all([
      this.universitiesRepository.findOneBy({ id: universityId, isPublished: true, publicDisplayStatus: "ready" }),
      this.programsRepository.findOneBy({ id: programId, universityId, isPublished: true, publicDisplayStatus: "ready" })
    ]);
    if (!university || !isReadyForPublicCatalog(university)) throw new NotFoundException("University not found");
    if (!program || !isReadyForPublicCatalog(program)) throw new NotFoundException("Program not found");
  }

  private async findReadyTasks(userId: number) {
    const tasks = await this.taskRepository.find({
      where: { userId },
      relations: { university: true, program: true },
      order: { createdAt: "DESC" }
    });
    return tasks.filter((task) => this.isReadyTaskTarget(task));
  }

  private isReadyTaskTarget(task: PlannerTaskEntity) {
    return Boolean(
      task.university &&
        task.program &&
        task.program.universityId === task.universityId &&
        isReadyForPublicCatalog(task.university) &&
        isReadyForPublicCatalog(task.program)
    );
  }

  private uniqueTaskInputs(taskInputs: PlannerTaskInput[]) {
    const seen = new Set<string>();
    const uniqueInputs: PlannerTaskInput[] = [];
    for (const input of taskInputs) {
      const universityId = Number(input.universityId);
      const programId = Number(input.programId);
      const key = `${universityId}:${programId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueInputs.push({ ...input, universityId, programId });
    }
    return uniqueInputs;
  }

  private normalizeMaterialProgress(materialProgress: Record<string, MaterialStatus>) {
    const normalized: Record<string, MaterialStatus> = {};
    for (const [key, status] of Object.entries(materialProgress || {})) {
      if (!key || !this.isMaterialStatus(status)) continue;
      normalized[key] = status;
    }
    return normalized;
  }

  private isMaterialStatus(status: string): status is MaterialStatus {
    return status === "draft" || status === "wait" || status === "progress" || status === "done";
  }

  private clampProgress(progress: number) {
    return Math.min(100, Math.max(0, Math.round(progress)));
  }

  private defaultVisaChecklist(): PlannerVisaChecklist {
    return {
      offerAccepted: false,
      depositPaid: false,
      visaDocsReady: false,
      preDeparture: false,
      arrivalReady: false
    };
  }

  private normalizeLocalizedText(value: Record<string, string> | undefined, fallback: LocalizedText): LocalizedText {
    return {
      en: value?.en || fallback.en,
      ms: value?.ms || fallback.ms,
      "zh-CN": value?.["zh-CN"] || fallback["zh-CN"],
      "zh-TW": value?.["zh-TW"] || fallback["zh-TW"]
    };
  }

  private defaultTaskFields(): {
    tier: LocalizedText;
    stage: ApplicationStage;
    progress: number;
    deadlineNote: LocalizedText;
    nextAction: LocalizedText;
  } {
    return {
      tier: {
        en: "New",
        ms: "New",
        "zh-CN": "New",
        "zh-TW": "New"
      },
      stage: "draft" as ApplicationStage,
      progress: 18,
      deadlineNote: {
        en: "Confirm shortlist within 7 days.",
        ms: "Confirm shortlist within 7 days.",
        "zh-CN": "Confirm shortlist within 7 days.",
        "zh-TW": "Confirm shortlist within 7 days."
      },
      nextAction: {
        en: "Lock application strategy and material package.",
        ms: "Lock application strategy and material package.",
        "zh-CN": "Lock application strategy and material package.",
        "zh-TW": "Lock application strategy and material package."
      }
    };
  }

  private async ensureProfile(userId: number) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");

    let profile = await this.profileRepository.findOneBy({ userId });
    if (!profile) {
      profile = await this.profileRepository.save(
        this.profileRepository.create({
          userId,
          profileVersion: 1,
          completenessStatus: "incomplete",
          requiredProfileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS],
          missingProfileFields: [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS],
          profileSnapshotHash: "",
          profileCompletedAt: null,
          recommendationRefreshedAt: null,
          materialProgress: {},
          visaChecklist: this.defaultVisaChecklist()
        })
      );
    }
    return profile;
  }

  private profileCompleteness(profile: PlannerProfileEntity, missingFields = this.resolveMissingRecommendationProfileFields(profile)) {
    const missingFieldSet = new Set<SmartRecommendationProfileField>(missingFields);
    return Math.min(
      Object.entries(SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS).reduce((score, [field, weight]) => {
        const profileField = field as SmartRecommendationProfileField;
        return !missingFieldSet.has(profileField) && this.hasRecommendationProfileField(profile, profileField) ? score + weight : score;
      }, 0),
      100
    );
  }

  private recommendationProfileStatus(profile: PlannerProfileEntity) {
    const missingFields = this.resolveMissingRecommendationProfileFields(profile);
    const score = this.profileCompleteness(profile, missingFields);
    const hasConfirmedProfile = Boolean(profile.profileCompletedAt && profile.completenessStatus === "complete");
    return {
      missingFields,
      score,
      isComplete: hasConfirmedProfile && missingFields.length === 0 && score >= SMART_RECOMMENDATION_PROFILE_COMPLETENESS_THRESHOLD
    };
  }

  private syncProfileRecommendationState(
    profile: PlannerProfileEntity,
    incrementVersion: boolean,
    confirmedFields: SmartRecommendationProfileField[]
  ) {
    const confirmedFieldSet = new Set<SmartRecommendationProfileField>(confirmedFields);
    const missingFieldSet = new Set<SmartRecommendationProfileField>(this.resolveMissingRecommendationProfileFields(profile));
    for (const field of SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS) {
      if (!this.hasRecommendationProfileField(profile, field)) {
        missingFieldSet.add(field);
      } else if (confirmedFieldSet.has(field)) {
        missingFieldSet.delete(field);
      }
    }

    const missingFields = SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS.filter((field) => missingFieldSet.has(field));
    const score = this.profileCompleteness(profile, missingFields);
    const isComplete = missingFields.length === 0 && score >= SMART_RECOMMENDATION_PROFILE_COMPLETENESS_THRESHOLD;

    profile.requiredProfileFields = [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS];
    profile.missingProfileFields = missingFields;
    profile.completenessStatus = isComplete ? "complete" : "incomplete";
    profile.profileCompletedAt = isComplete ? profile.profileCompletedAt || new Date() : null;
    if (incrementVersion) {
      profile.profileVersion = Number(profile.profileVersion || 0) + 1;
    }
    profile.profileSnapshotHash = isComplete ? this.profileHash(profile) : "";
    profile.recommendationRefreshedAt = null;
  }

  private confirmedRecommendationProfileFields(payload: Partial<PlannerProfile>) {
    const payloadFields = new Set(
      Object.entries(payload)
        .filter(([, value]) => value !== undefined)
        .map(([field]) => field)
    );
    return [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS, ...SMART_RECOMMENDATION_OPTIONAL_PROFILE_FIELDS].filter((field) =>
      payloadFields.has(field)
    );
  }

  private resolveMissingRecommendationProfileFields(profile: PlannerProfileEntity) {
    const storedMissingFields = this.normalizeMissingRecommendationProfileFields(profile.missingProfileFields);
    const hasConfirmedProfile = Boolean(profile.profileCompletedAt && profile.completenessStatus === "complete");
    const baselineMissingFields = hasConfirmedProfile || storedMissingFields.length
      ? storedMissingFields
      : [...SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS];
    const missingFieldSet = new Set<SmartRecommendationProfileField>(baselineMissingFields);

    for (const field of SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS) {
      if (!this.hasRecommendationProfileField(profile, field)) {
        missingFieldSet.add(field);
      }
    }

    return SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS.filter((field) => missingFieldSet.has(field));
  }

  private normalizeMissingRecommendationProfileFields(fields: PlannerProfileEntity["missingProfileFields"]) {
    const fieldSet = new Set(fields || []);
    return SMART_RECOMMENDATION_REQUIRED_PROFILE_FIELDS.filter((field) => fieldSet.has(field));
  }

  private hasRecommendationProfileField(profile: PlannerProfileEntity, field: SmartRecommendationProfileField) {
    if (field === "level") return DEGREE_LEVEL_ORDER.includes(profile.level);
    if (field === "targetCategory") return typeof profile.targetCategory === "string" && profile.targetCategory.trim().length > 0;
    if (field === "budgetCny") return Number(profile.budgetCny) > 0;
    if (field === "gpa") return Number(profile.gpa) > 0;
    if (field === "ielts") return Number(profile.ielts) > 0;
    if (field === "experience") return typeof profile.experience === "string" && profile.experience.trim().length > 0;
    return typeof profile.acceptNoLanguage === "boolean";
  }

  private profileHash(profile: PlannerProfileEntity) {
    return createHash("sha256")
      .update(JSON.stringify({
        level: profile.level,
        targetCategory: profile.targetCategory,
        budgetCny: Number(profile.budgetCny),
        gpa: Number(profile.gpa),
        ielts: Number(profile.ielts),
        experience: profile.experience,
        acceptNoLanguage: profile.acceptNoLanguage,
        profileVersion: profile.profileVersion
      }))
      .digest("hex")
      .slice(0, 32);
  }

  private async buildProfileRecommendations(profile: PlannerProfileEntity) {
    const universities = await this.universitiesRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } });
    const programs = await this.programsRepository.find({ where: { isPublished: true, publicDisplayStatus: "ready" } });
    const universityMap = new Map(universities.map((item) => [item.id, item]));
    const results = [];

    for (const program of programs) {
      const university = universityMap.get(program.universityId);
      if (!university) continue;
      if (!isReadyForPublicCatalog(program) || !isReadyForPublicCatalog(university)) continue;
      if (program.level !== profile.level) continue;
      if (program.category !== profile.targetCategory) continue;

      const filterableTuitionCny = getFilterableTuitionCny(program);
      const annualCost = filterableTuitionCny == null ? null : filterableTuitionCny + university.livingCostCny;
      let score = 0;
      const reasons = { en: [] as string[], ms: [] as string[], "zh-CN": [] as string[], "zh-TW": [] as string[] };

      if (Number(profile.gpa) >= program.requirement.gpa) {
        score += 28;
        reasons.en.push("Academic background fits");
        reasons.ms.push("Latar akademik sepadan");
        reasons["zh-CN"].push("学术背景匹配");
        reasons["zh-TW"].push("學術背景匹配");
      }
      if (Number(profile.ielts) >= program.languageRequirement.ielts) {
        score += 24;
        reasons.en.push("Language score already met");
        reasons.ms.push("Skor bahasa telah memenuhi syarat");
        reasons["zh-CN"].push("语言成绩已达标");
        reasons["zh-TW"].push("語言成績已達標");
      } else if (profile.acceptNoLanguage && university.acceptNoLanguage) {
        score += 14;
        reasons.en.push("Conditional pathway available");
        reasons.ms.push("Laluan conditional tersedia");
        reasons["zh-CN"].push("支持条件录取路径");
        reasons["zh-TW"].push("支援條件錄取路徑");
      }
      if (annualCost != null && annualCost <= profile.budgetCny) {
        score += 20;
        reasons.en.push("Budget fits first year");
        reasons.ms.push("Bajet menampung tahun pertama");
        reasons["zh-CN"].push("预算可覆盖首年");
        reasons["zh-TW"].push("預算可覆蓋首年");
      }
      if (hasValidQsWorldRank(university.qsRank) && university.qsRank <= 200) {
        score += 12;
      } else if (hasValidQsWorldRank(university.qsRank) && university.qsRank <= 500) {
        score += 7;
      }

      if (score >= 28) {
        results.push(buildRecommendation(university, program, score, reasons));
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 6);
  }
}
