import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { hash } from "bcryptjs";
import { Repository } from "typeorm";
import type { AdminRequestUser } from "../common/guards.js";
import {
  AdminUserEntity,
  ApplicationFollowUpEntity,
  ProgramEntity,
  StudentApplicationEntity,
  UniversityEntity,
  UserEntity,
  type ApplicationStatus
} from "../db/entities.js";
import { AdminLogService } from "./admin-log.service.js";
import { applyDataScope, normalizePagination, type AdminListQuery } from "./admin.helpers.js";

@Injectable()
export class AdminApplicationsService {
  constructor(
    @InjectRepository(StudentApplicationEntity) private readonly applicationsRepository: Repository<StudentApplicationEntity>,
    @InjectRepository(ApplicationFollowUpEntity) private readonly followUpsRepository: Repository<ApplicationFollowUpEntity>,
    @InjectRepository(UserEntity) private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(AdminUserEntity) private readonly adminUsersRepository: Repository<AdminUserEntity>,
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @Inject(AdminLogService) private readonly logService: AdminLogService
  ) {}

  async list(actor: AdminRequestUser, query: AdminListQuery & { status?: string; universityId?: number; programId?: number; startDate?: string; endDate?: string }) {
    const { page, pageSize, skip } = normalizePagination(query);
    const qb = this.applicationsRepository
      .createQueryBuilder("application")
      .leftJoinAndSelect("application.university", "university")
      .leftJoinAndSelect("application.program", "program")
      .leftJoinAndSelect("application.ownerAdmin", "ownerAdmin")
      .leftJoinAndSelect("application.assignedAdmin", "assignedAdmin");

    applyDataScope(qb, actor);
    if (query.search) qb.andWhere("application.applicationNo LIKE :search OR application.studentName LIKE :search OR application.studentEmail LIKE :search", { search: `%${query.search}%` });
    if (query.status) qb.andWhere("application.applicationStatus = :status", { status: query.status });
    if (query.universityId) qb.andWhere("application.universityId = :universityId", { universityId: query.universityId });
    if (query.programId) qb.andWhere("application.programId = :programId", { programId: query.programId });
    if (query.startDate) qb.andWhere("application.createdAt >= :startDate", { startDate: query.startDate });
    if (query.endDate) qb.andWhere("application.createdAt <= :endDate", { endDate: `${query.endDate} 23:59:59` });

    const [items, total] = await qb.orderBy("application.updatedAt", "DESC").skip(skip).take(pageSize).getManyAndCount();
    return { items: await Promise.all(items.map((item) => this.serializeApplication(item))), total, page, pageSize };
  }

  async detail(actor: AdminRequestUser, id: number) {
    const qb = this.applicationsRepository
      .createQueryBuilder("application")
      .leftJoinAndSelect("application.university", "university")
      .leftJoinAndSelect("application.program", "program")
      .leftJoinAndSelect("application.ownerAdmin", "ownerAdmin")
      .leftJoinAndSelect("application.assignedAdmin", "assignedAdmin")
      .where("application.id = :id", { id });
    applyDataScope(qb, actor);
    const entity = await qb.getOne();
    if (!entity) throw new NotFoundException("Application not found");

    const followUps = await this.followUpsRepository.find({ where: { applicationId: id }, relations: { adminUser: true }, order: { createdAt: "DESC" } });
    return {
      ...(await this.serializeApplication(entity)),
      followUps: followUps.map((item) => ({
        id: item.id,
        followUpType: item.followUpType,
        statusFrom: item.statusFrom,
        statusTo: item.statusTo,
        content: item.content,
        nextStep: item.nextStep,
        nextFollowUpAt: item.nextFollowUpAt,
        createdAt: item.createdAt,
        adminName: item.adminUser?.displayName || "system"
      }))
    };
  }

  async save(actor: AdminRequestUser, payload: Partial<StudentApplicationEntity> & { id?: number; studentName: string; studentEmail: string; studentPhone?: string; universityId: number; programId: number; applicationStatus: ApplicationStatus; currentStage: string; materialStatus: string; visaStatus: string; priority: "low" | "medium" | "high"; intake: string; ownerAdminId?: number | null; assignedAdminId?: number | null; notes?: string | null; metadata?: Record<string, unknown> | null }) {
    const student = await this.ensureStudentUser(payload.studentEmail, payload.studentName);
    let entity: StudentApplicationEntity;
    if (payload.id) {
      const existing = await this.applicationsRepository.findOneBy({ id: payload.id });
      if (!existing) throw new NotFoundException("Application not found");
      entity = existing;
      Object.assign(entity, payload, { studentId: student.id, studentName: payload.studentName, studentEmail: payload.studentEmail, studentPhone: payload.studentPhone || "" });
    } else {
      entity = this.applicationsRepository.create({
        applicationNo: await this.generateApplicationNo(),
        studentId: student.id,
        studentName: payload.studentName,
        studentEmail: payload.studentEmail,
        studentPhone: payload.studentPhone || "",
        universityId: payload.universityId,
        programId: payload.programId,
        applicationStatus: payload.applicationStatus,
        currentStage: payload.currentStage as StudentApplicationEntity["currentStage"],
        materialStatus: payload.materialStatus as StudentApplicationEntity["materialStatus"],
        visaStatus: payload.visaStatus as StudentApplicationEntity["visaStatus"],
        priority: payload.priority,
        intake: payload.intake,
        ownerAdminId: payload.ownerAdminId ?? actor.id,
        assignedAdminId: payload.assignedAdminId ?? actor.id,
        submittedAt: payload.submittedAt ?? null,
        expectedDecisionDate: payload.expectedDecisionDate ?? null,
        notes: payload.notes || null,
        metadata: payload.metadata || null
      });
    }
    const saved = await this.applicationsRepository.save(entity);
    await this.logService.write(actor, "application", payload.id ? "update" : "create", "application", String(saved.id), `${payload.id ? "Update" : "Create"} application ${saved.applicationNo}`);
    return this.detail(actor, saved.id);
  }

  async addFollowUp(actor: AdminRequestUser, applicationId: number, payload: { followUpType: string; content: string; nextStep?: string; nextFollowUpAt?: string; statusTo?: string; assignAdminId?: number | null }) {
    const application = await this.applicationsRepository.findOneBy({ id: applicationId });
    if (!application) throw new NotFoundException("Application not found");
    const statusFrom = application.applicationStatus;
    if (payload.statusTo) application.applicationStatus = payload.statusTo as ApplicationStatus;
    if (payload.assignAdminId !== undefined) application.assignedAdminId = payload.assignAdminId;
    application.lastFollowUpAt = new Date();
    await this.applicationsRepository.save(application);

    const followUp = await this.followUpsRepository.save(
      this.followUpsRepository.create({
        applicationId,
        adminUserId: actor.id,
        followUpType: payload.followUpType as ApplicationFollowUpEntity["followUpType"],
        statusFrom,
        statusTo: payload.statusTo || null,
        content: payload.content,
        nextStep: payload.nextStep || null,
        nextFollowUpAt: payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : null
      })
    );

    await this.logService.write(actor, "application", "follow-up", "application", String(applicationId), `Create follow-up for ${application.applicationNo}`);
    return { id: followUp.id, createdAt: followUp.createdAt };
  }

  async export(actor: AdminRequestUser, query: Parameters<AdminApplicationsService["list"]>[1]) {
    const result = await this.list(actor, { ...query, page: 1, pageSize: 500 });
    return result.items.map((item: any) => ({
      申请号: item.applicationNo,
      学生姓名: item.studentName,
      学生邮箱: item.studentEmail,
      学校: item.universityName,
      专业: item.programName,
      申请状态: item.applicationStatus,
      当前阶段: item.currentStage,
      材料状态: item.materialStatus,
      签证状态: item.visaStatus,
      跟进顾问: item.assignedAdminName,
      更新时间: item.updatedAt
    }));
  }

  private async serializeApplication(entity: StudentApplicationEntity) {
    const university = entity.university || (await this.universitiesRepository.findOneBy({ id: entity.universityId }));
    const program = entity.program || (await this.programsRepository.findOneBy({ id: entity.programId }));
    const assignedAdmin = entity.assignedAdmin || (entity.assignedAdminId ? await this.adminUsersRepository.findOneBy({ id: entity.assignedAdminId }) : null);
    const ownerAdmin = entity.ownerAdmin || (entity.ownerAdminId ? await this.adminUsersRepository.findOneBy({ id: entity.ownerAdminId }) : null);
    return {
      id: entity.id,
      applicationNo: entity.applicationNo,
      studentId: entity.studentId,
      studentName: entity.studentName,
      studentEmail: entity.studentEmail,
      studentPhone: entity.studentPhone,
      universityId: entity.universityId,
      universityName: university?.name?.["zh-CN"] || university?.shortName || "",
      programId: entity.programId,
      programName: program?.name?.["zh-CN"] || program?.code || "",
      applicationStatus: entity.applicationStatus,
      currentStage: entity.currentStage,
      materialStatus: entity.materialStatus,
      visaStatus: entity.visaStatus,
      priority: entity.priority,
      intake: entity.intake,
      ownerAdminId: entity.ownerAdminId,
      ownerAdminName: ownerAdmin?.displayName || "",
      assignedAdminId: entity.assignedAdminId,
      assignedAdminName: assignedAdmin?.displayName || "",
      submittedAt: entity.submittedAt,
      expectedDecisionDate: entity.expectedDecisionDate,
      lastFollowUpAt: entity.lastFollowUpAt,
      notes: entity.notes,
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  private async ensureStudentUser(email: string, studentName: string) {
    let student = await this.usersRepository.findOne({ where: { account: email } });
    if (!student) {
      student = await this.usersRepository.save(
        this.usersRepository.create({ role: "student", method: "email", account: email, displayName: studentName, passwordHash: await hash("Temp123456!", 10) })
      );
    }
    return student;
  }

  private async generateApplicationNo() {
    const count = await this.applicationsRepository.count();
    return `APP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }
}
