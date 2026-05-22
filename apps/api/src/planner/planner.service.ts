import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { MaterialStatus, PlannerProfile, PlannerVisaChecklist } from "@studymy/shared";
import { PlannerProfileEntity, PlannerTaskEntity, ProgramEntity, UniversityEntity, UserEntity } from "../db/entities.js";
import { buildRecommendation, mapPlannerMaterials, mapPlannerProfile, mapPlannerTasks, mapVisaChecklist } from "../common/mappers.js";

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
    const tasks = await this.taskRepository.find({ where: { userId }, order: { createdAt: "DESC" } });
    const materials = mapPlannerMaterials(profile);
    const visaChecklist = mapVisaChecklist(profile);
    const recommendations = await this.buildProfileRecommendations(profile);
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
        profileCompleteness: this.profileCompleteness(profile),
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
    const program = await this.programsRepository.findOneBy({ id: programId, universityId });
    if (!program) throw new NotFoundException("Program not found");
    const university = await this.universitiesRepository.findOneBy({ id: universityId });
    if (!university) throw new NotFoundException("University not found");

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

  private async ensureProfile(userId: number) {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");

    let profile = await this.profileRepository.findOneBy({ userId });
    if (!profile) {
      profile = await this.profileRepository.save(
        this.profileRepository.create({
          userId,
          materialProgress: {},
          visaChecklist: {
            offerAccepted: false,
            depositPaid: false,
            visaDocsReady: false,
            preDeparture: false,
            arrivalReady: false
          }
        })
      );
    }
    return profile;
  }

  private profileCompleteness(profile: PlannerProfileEntity) {
    let score = 0;
    if (profile.level) score += 16;
    if (profile.targetCategory) score += 16;
    if (profile.budgetCny > 0) score += 16;
    if (profile.gpa > 0) score += 18;
    if (profile.ielts > 0) score += 16;
    if (profile.experience) score += 8;
    if (typeof profile.acceptNoLanguage === "boolean") score += 10;
    return Math.min(score, 100);
  }

  private async buildProfileRecommendations(profile: PlannerProfileEntity) {
    const universities = await this.universitiesRepository.find();
    const programs = await this.programsRepository.find();
    const universityMap = new Map(universities.map((item) => [item.id, item]));
    const results = [];

    for (const program of programs) {
      const university = universityMap.get(program.universityId);
      if (!university) continue;
      if (program.level !== profile.level) continue;
      if (program.category !== profile.targetCategory) continue;

      const annualCost = program.annualTuitionCny + university.livingCostCny;
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
      if (annualCost <= profile.budgetCny) {
        score += 20;
        reasons.en.push("Budget fits first year");
        reasons.ms.push("Bajet menampung tahun pertama");
        reasons["zh-CN"].push("预算可覆盖首年");
        reasons["zh-TW"].push("預算可覆蓋首年");
      }
      if (university.qsRank <= 200) {
        score += 12;
      } else if (university.qsRank <= 500) {
        score += 7;
      }

      if (score >= 28) {
        results.push(buildRecommendation(university, program, score, reasons));
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 6);
  }
}
