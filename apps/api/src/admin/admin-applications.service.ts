import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { hash } from "bcryptjs";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Repository, type SelectQueryBuilder } from "typeorm";
import type { AdminRequestUser } from "../common/guards.js";
import {
  aggregateApplicationMaterialStatus,
  createManualApplicationMaterial,
  normalizeApplicationMaterials,
  reopenApplicationMaterial,
  summarizeApplicationMaterials,
  toPublicApplicationMaterials,
  upsertApplicationMaterial,
  updateApplicationMaterialDefinition,
  waiveApplicationMaterial,
  type ApplicationMaterialItem,
  type ApplicationMaterialRequirementLevel,
  type ApplicationMaterialVersion,
  type ApplicationMaterialSource,
  type ApplicationMaterialReviewStatus
} from "../common/application-materials.js";
import {
  assertApplicationStatusTransition,
  buildStudentApplicationTodos,
  deriveStatusFromMaterialReview,
  getApplicationWorkflow,
  normalizeApplicationStatus,
  stageForApplicationStatus,
  type ApplicationWorkflowStatus
} from "../common/application-workflow.js";
import { getApplicationProfileSnapshot, getApplicationProfileSummary } from "../common/application-profile.js";
import {
  buildApplicationCatalogSnapshot,
  compareApplicationCatalogSnapshot,
  getApplicationCatalogSnapshot
} from "../common/application-catalog-snapshot.js";
import {
  AdminNotificationEntity,
  AdminUserEntity,
  ApplicationFollowUpEntity,
  ApplicationMessageEntity,
  OperationLogEntity,
  ProgramEntity,
  StudentApplicationEntity,
  UniversityEntity,
  UserEntity,
  type ApplicationFollowUpVisibility,
  type ApplicationMessageType,
  type ApplicationStatus
} from "../db/entities.js";
import { AdminLogService } from "./admin-log.service.js";
import { normalizePagination, type AdminListQuery } from "./admin.helpers.js";

@Injectable()
export class AdminApplicationsService {
  constructor(
    @InjectRepository(StudentApplicationEntity) private readonly applicationsRepository: Repository<StudentApplicationEntity>,
    @InjectRepository(ApplicationFollowUpEntity) private readonly followUpsRepository: Repository<ApplicationFollowUpEntity>,
    @InjectRepository(ApplicationMessageEntity) private readonly messagesRepository: Repository<ApplicationMessageEntity>,
    @InjectRepository(AdminNotificationEntity) private readonly notificationsRepository: Repository<AdminNotificationEntity>,
    @InjectRepository(OperationLogEntity) private readonly logsRepository: Repository<OperationLogEntity>,
    @InjectRepository(UserEntity) private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(AdminUserEntity) private readonly adminUsersRepository: Repository<AdminUserEntity>,
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @Inject(AdminLogService) private readonly logService: AdminLogService
  ) {}

  async list(
    actor: AdminRequestUser,
    query: AdminListQuery & {
      status?: string;
      universityId?: number;
      programId?: number;
      assignedAdminId?: number | string;
      mine?: string | boolean;
      unassigned?: string | boolean;
      startDate?: string;
      endDate?: string;
    }
  ) {
    const { page, pageSize, skip } = normalizePagination(query);
    const qb = this.applicationsRepository
      .createQueryBuilder("application")
      .leftJoinAndSelect("application.university", "university")
      .leftJoinAndSelect("application.program", "program")
      .leftJoinAndSelect("application.ownerAdmin", "ownerAdmin")
      .leftJoinAndSelect("application.assignedAdmin", "assignedAdmin");

    applyApplicationAccessScope(qb, actor);
    if (query.search) qb.andWhere("application.applicationNo LIKE :search OR application.studentName LIKE :search OR application.studentEmail LIKE :search", { search: `%${query.search}%` });
    if (query.status) {
      const normalizedStatus = normalizeApplicationStatus(query.status);
      const statusValues = normalizedStatus === "offered" ? ["offered", "offer"] : [normalizedStatus];
      qb.andWhere("application.applicationStatus IN (:...statusValues)", { statusValues });
    }
    if (query.universityId) qb.andWhere("application.universityId = :universityId", { universityId: query.universityId });
    if (query.programId) qb.andWhere("application.programId = :programId", { programId: query.programId });
    if (query.assignedAdminId) qb.andWhere("application.assignedAdminId = :assignedAdminId", { assignedAdminId: Number(query.assignedAdminId) });
    if (isTruthy(query.mine)) qb.andWhere("application.assignedAdminId = :mineAdminId", { mineAdminId: actor.id });
    if (isTruthy(query.unassigned)) qb.andWhere("application.assignedAdminId IS NULL");
    if (query.startDate) qb.andWhere("application.createdAt >= :startDate", { startDate: query.startDate });
    if (query.endDate) qb.andWhere("application.createdAt <= :endDate", { endDate: `${query.endDate} 23:59:59` });

    const [items, total] = await qb.orderBy("application.updatedAt", "DESC").skip(skip).take(pageSize).getManyAndCount();
    return { items: await Promise.all(items.map((item) => this.serializeApplication(item))), total, page, pageSize };
  }

  async detail(actor: AdminRequestUser, id: number) {
    const entity = await this.findScopedApplication(actor, id);
    const followUps = await this.followUpsRepository.find({ where: { applicationId: id }, relations: { adminUser: true }, order: { createdAt: "DESC" } });
    const operationLogs = await this.logsRepository.find({ where: { targetType: "application", targetId: String(id) }, relations: { adminUser: true }, order: { createdAt: "DESC" }, take: 100 });
    const messages = await this.messagesRepository.find({ where: { applicationId: id }, relations: { adminUser: true, student: true }, order: { createdAt: "ASC" }, take: 200 });
    const unreadMessageIds = messages.filter((item) => !item.isReadByAdmin && item.senderType !== "admin").map((item) => item.id);
    if (unreadMessageIds.length) {
      await this.messagesRepository
        .createQueryBuilder()
        .update(ApplicationMessageEntity)
        .set({ isReadByAdmin: true })
        .where("id IN (:...unreadMessageIds)", { unreadMessageIds })
        .execute();
    }
    return {
      ...(await this.serializeApplication(entity)),
      messages: messages.map((item) => ({
        id: item.id,
        senderType: item.senderType,
        messageType: item.messageType,
        content: item.content,
        metadata: item.metadata,
        senderName: item.senderType === "admin" ? item.adminUser?.displayName || "顾问老师" : item.senderType === "system" ? "系统通知" : item.student?.displayName || "学生",
        isReadByStudent: item.isReadByStudent,
        isReadByAdmin: item.isReadByAdmin,
        createdAt: item.createdAt
      })),
      followUps: followUps.map((item) => ({
        id: item.id,
        followUpType: item.followUpType,
        visibility: item.visibility || "internal",
        visibilityLabel: followUpVisibilityLabel(item.visibility || "internal"),
        statusFrom: item.statusFrom,
        statusTo: item.statusTo,
        content: item.content,
        nextStep: item.nextStep,
        nextFollowUpAt: item.nextFollowUpAt,
        createdAt: item.createdAt,
        adminName: item.adminUser?.displayName || "system"
      })),
      operationLogs: operationLogs.map((item) => ({
        id: item.id,
        module: item.module,
        action: item.action,
        summary: item.summary,
        detail: item.detail,
        adminName: item.adminUser?.displayName || "system",
        createdAt: item.createdAt
      }))
    };
  }

  async save(actor: AdminRequestUser, payload: Partial<StudentApplicationEntity> & { id?: number; studentName: string; studentEmail: string; studentPhone?: string; universityId: number; programId: number; applicationStatus: ApplicationStatus; currentStage: string; materialStatus: string; visaStatus: string; priority: "low" | "medium" | "high"; intake: string; ownerAdminId?: number | null; assignedAdminId?: number | null; notes?: string | null; metadata?: Record<string, unknown> | null }) {
    const student = await this.ensureStudentUser(payload.studentEmail, payload.studentName);
    let entity: StudentApplicationEntity;
    if (payload.id) {
      const existing = await this.findScopedApplication(actor, payload.id);
      if (payload.assignedAdminId !== undefined && payload.assignedAdminId !== existing.assignedAdminId) {
        this.ensureCanAssign(actor);
        await this.ensureAssignableAdmin(payload.assignedAdminId);
      }
      entity = existing;
      Object.assign(entity, payload, {
        studentId: student.id,
        studentName: payload.studentName,
        studentEmail: payload.studentEmail,
        studentPhone: payload.studentPhone || "",
        applicationStatus: normalizeApplicationStatus(payload.applicationStatus) as ApplicationStatus,
        currentStage: stageForApplicationStatus(payload.applicationStatus) as StudentApplicationEntity["currentStage"]
      });
    } else {
      const applicationStatus = normalizeApplicationStatus(payload.applicationStatus);
      const assignedAdminId = payload.assignedAdminId ?? actor.id;
      if (assignedAdminId !== actor.id) {
        this.ensureCanAssign(actor);
      }
      await this.ensureAssignableAdmin(assignedAdminId);
      entity = this.applicationsRepository.create({
        applicationNo: await this.generateApplicationNo(),
        studentId: student.id,
        studentName: payload.studentName,
        studentEmail: payload.studentEmail,
        studentPhone: payload.studentPhone || "",
        universityId: payload.universityId,
        programId: payload.programId,
        applicationStatus,
        currentStage: stageForApplicationStatus(applicationStatus) as StudentApplicationEntity["currentStage"],
        materialStatus: payload.materialStatus as StudentApplicationEntity["materialStatus"],
        visaStatus: payload.visaStatus as StudentApplicationEntity["visaStatus"],
        priority: payload.priority,
        intake: payload.intake,
        ownerAdminId: payload.ownerAdminId ?? actor.id,
        assignedAdminId,
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

  async addFollowUp(actor: AdminRequestUser, applicationId: number, payload: { followUpType: string; content: string; visibility?: ApplicationFollowUpVisibility; nextStep?: string; nextFollowUpAt?: string; statusTo?: string; assignAdminId?: number | null }) {
    const application = await this.findScopedApplication(actor, applicationId);
    const statusFrom = application.applicationStatus;
    const visibility = normalizeFollowUpVisibility(payload.visibility);
    if (payload.statusTo) {
      const statusTo = this.ensureAllowedStatusTransition(statusFrom, payload.statusTo);
      this.ensureCanUpdateStatus(actor, statusTo);
      application.applicationStatus = statusTo;
      application.currentStage = stageForApplicationStatus(statusTo) as StudentApplicationEntity["currentStage"];
    }
    if (payload.assignAdminId !== undefined) {
      this.ensureCanAssign(actor);
      await this.ensureAssignableAdmin(payload.assignAdminId);
      application.assignedAdminId = payload.assignAdminId;
    }
    application.lastFollowUpAt = new Date();
    await this.applicationsRepository.save(application);

    const followUp = await this.followUpsRepository.save(
      this.followUpsRepository.create({
        applicationId,
        adminUserId: actor.id,
        followUpType: payload.followUpType as ApplicationFollowUpEntity["followUpType"],
        visibility,
        statusFrom,
        statusTo: payload.statusTo ? normalizeApplicationStatus(payload.statusTo) : null,
        content: payload.content,
        nextStep: payload.nextStep || null,
        nextFollowUpAt: payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : null
      })
    );

    await this.logService.write(actor, "application", "follow-up", "application", String(applicationId), `Create follow-up for ${application.applicationNo}`);
    if (payload.statusTo && normalizeApplicationStatus(statusFrom) !== normalizeApplicationStatus(payload.statusTo)) {
      await this.createSystemMessage(application, `申请状态已更新为：${getApplicationWorkflow(payload.statusTo).label}。${payload.nextStep || payload.content || ""}`.trim(), {
        statusFrom,
        statusTo: normalizeApplicationStatus(payload.statusTo),
        nextStep: payload.nextStep || ""
      });
    }
    if (visibility === "student") {
      await this.createAdminMessage(application, actor, payload.content, messageTypeForFollowUp(payload.followUpType), {
        followUpId: followUp.id,
        followUpType: payload.followUpType,
        nextStep: payload.nextStep || ""
      });
    }
    if (payload.assignAdminId) {
      await this.notifyAssignedAdmin(payload.assignAdminId, application, actor, payload.content);
    }
    return { id: followUp.id, createdAt: followUp.createdAt };
  }

  async assign(actor: AdminRequestUser, applicationId: number, payload: { assignedAdminId?: number | null; note?: string }) {
    this.ensureCanAssign(actor);
    const application = await this.findScopedApplication(actor, applicationId);
    await this.ensureAssignableAdmin(payload.assignedAdminId ?? null);
    const previousAdminId = application.assignedAdminId;
    application.assignedAdminId = payload.assignedAdminId ?? null;
    application.ownerAdminId = application.ownerAdminId ?? actor.id;
    application.lastFollowUpAt = new Date();
    await this.applicationsRepository.save(application);

    await this.followUpsRepository.save(
      this.followUpsRepository.create({
        applicationId,
        adminUserId: actor.id,
        followUpType: "assign",
        visibility: "internal",
        statusFrom: application.applicationStatus,
        statusTo: application.applicationStatus,
        content: payload.assignedAdminId ? `案件分配给负责人。${payload.note || ""}`.trim() : `案件已取消负责人。${payload.note || ""}`.trim(),
        nextStep: payload.note || null,
        nextFollowUpAt: null
      })
    );
    await this.logService.write(actor, "application", "assign", "application", String(applicationId), `Assign application ${application.applicationNo}`, {
      previousAdminId,
      assignedAdminId: payload.assignedAdminId ?? null,
      note: payload.note || ""
    });
    if (payload.assignedAdminId) {
      await this.notifyAssignedAdmin(payload.assignedAdminId, application, actor, payload.note || "");
    }
    return this.detail(actor, applicationId);
  }

  async updateStatus(
    actor: AdminRequestUser,
    applicationId: number,
    payload: { status: string; note?: string; nextStep?: string; nextFollowUpAt?: string }
  ) {
    const application = await this.findScopedApplication(actor, applicationId);
    const statusFrom = application.applicationStatus;
    const statusTo = this.ensureAllowedStatusTransition(statusFrom, payload.status);
    this.ensureCanUpdateStatus(actor, statusTo);
    const workflow = getApplicationWorkflow(statusTo);
    const note = payload.note?.trim() || "";
    const nextStep = payload.nextStep?.trim() || workflow.nextStudentAction;

    application.applicationStatus = statusTo;
    application.currentStage = workflow.stage as StudentApplicationEntity["currentStage"];
    if (statusTo === "need-info") application.materialStatus = "wait";
    if (statusTo === "visa") application.visaStatus = application.visaStatus === "not-started" ? "preparing" : application.visaStatus;
    if (statusTo === "done") application.visaStatus = application.visaStatus === "approved" ? "approved" : application.visaStatus;
    application.lastFollowUpAt = new Date();
    await this.applicationsRepository.save(application);

    await this.followUpsRepository.save(
      this.followUpsRepository.create({
        applicationId,
        adminUserId: actor.id,
        followUpType: "status",
        visibility: "system",
        statusFrom,
        statusTo,
        content: `状态流转：${getApplicationWorkflow(statusFrom).label} -> ${workflow.label}${note ? `。${note}` : ""}`,
        nextStep,
        nextFollowUpAt: payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : null
      })
    );
    await this.logService.write(actor, "application", "status-update", "application", String(applicationId), `Update application status to ${statusTo}`, {
      statusFrom,
      statusTo,
      note,
      nextStep
    });
    await this.createSystemMessage(application, `申请状态已更新为：${workflow.label}。${nextStep}`, {
      statusFrom,
      statusTo,
      note,
      nextStep
    });
    return this.detail(actor, applicationId);
  }

  async reviewMaterial(
    actor: AdminRequestUser,
    applicationId: number,
    key: string,
    payload: { reviewStatus: ApplicationMaterialReviewStatus; note?: string; nextStep?: string }
  ) {
    if (!["pending-review", "approved", "needs-revision", "rejected"].includes(payload.reviewStatus)) {
      throw new BadRequestException("Invalid review status");
    }

    const application = await this.findScopedApplication(actor, applicationId);
    this.ensureCanReviewMaterial(actor);
    const statusFrom = application.applicationStatus;
    const materials = normalizeApplicationMaterials(application.metadata, application.program?.applicationDocs as Record<string, unknown>);
    const target = materials.find((item) => item.key === key);
    if (!target) throw new NotFoundException("Material not found");
    const versions = target.versions || [];
    const currentVersionId = target.currentVersionId || versions[versions.length - 1]?.id;
    const nextVersions = versions.map((version) =>
      version.id === currentVersionId ? this.reviewMaterialVersion(version, payload, actor) : version
    );
    const reviewedVersion = nextVersions.find((version) => version.id === currentVersionId);

    const nextMaterial: ApplicationMaterialItem = {
      ...target,
      status: payload.reviewStatus === "approved" ? "done" : payload.reviewStatus === "pending-review" ? "progress" : "wait",
      reviewStatus: payload.reviewStatus,
      reviewNote: payload.note || null,
      reviewedAt: new Date().toISOString(),
      reviewedByAdminId: actor.id,
      reviewedByAdminName: actor.displayName,
      currentVersionId,
      versions: nextVersions,
      fileName: reviewedVersion?.fileName || target.fileName,
      mimeType: reviewedVersion?.mimeType || target.mimeType,
      size: reviewedVersion?.size || target.size,
      uploadedAt: reviewedVersion?.uploadedAt || target.uploadedAt,
      storagePath: reviewedVersion?.storagePath || target.storagePath
    };
    const metadata = upsertApplicationMaterial(application.metadata, application.program?.applicationDocs as Record<string, unknown>, nextMaterial);
    const nextMaterials = normalizeApplicationMaterials(metadata, application.program?.applicationDocs as Record<string, unknown>);
    const nextStatus = deriveStatusFromMaterialReview(statusFrom, nextMaterials, payload.reviewStatus);
    application.metadata = metadata;
    application.materialStatus = aggregateApplicationMaterialStatus(nextMaterials);
    application.applicationStatus = nextStatus;
    application.currentStage = stageForApplicationStatus(nextStatus) as StudentApplicationEntity["currentStage"];
    application.lastFollowUpAt = new Date();
    await this.applicationsRepository.save(application);

    await this.followUpsRepository.save(
      this.followUpsRepository.create({
        applicationId,
        adminUserId: actor.id,
        followUpType: "material",
        visibility: payload.reviewStatus === "needs-revision" || payload.reviewStatus === "rejected" ? "student" : "internal",
        statusFrom,
        statusTo: nextStatus,
        content: `材料审核：${nextMaterial.title} - ${payload.reviewStatus}${payload.note ? `。${payload.note}` : ""}`,
        nextStep: payload.nextStep || null,
        nextFollowUpAt: null
      })
    );
    await this.logService.write(actor, "application", "material-review", "application", String(applicationId), `Review material ${nextMaterial.title}`, {
      materialKey: key,
      versionId: currentVersionId,
      reviewStatus: payload.reviewStatus,
      note: payload.note || ""
    });
    if ((payload.reviewStatus === "needs-revision" || payload.reviewStatus === "rejected") && payload.note) {
      await this.createAdminMessage(application, actor, `材料需补件：${nextMaterial.title}。${payload.note}`, "revision-request", {
        materialKey: key,
        versionId: currentVersionId,
        reviewStatus: payload.reviewStatus,
        nextStep: payload.nextStep || ""
      });
    }
    if (normalizeApplicationStatus(statusFrom) !== nextStatus) {
      await this.createSystemMessage(application, `申请状态已更新为：${getApplicationWorkflow(nextStatus).label}。${payload.nextStep || getApplicationWorkflow(nextStatus).nextStudentAction}`, {
        statusFrom,
        statusTo: nextStatus,
        materialKey: key,
        versionId: currentVersionId
      });
    }
    return this.detail(actor, applicationId);
  }

  async adjustMaterialChecklist(
    actor: AdminRequestUser,
    applicationId: number,
    payload: {
      action: "add" | "update" | "waive" | "reopen";
      key?: string;
      title?: string;
      note?: string;
      category?: string;
      group?: string;
      requirementLevel?: ApplicationMaterialRequirementLevel;
      source?: ApplicationMaterialSource;
      reason?: string;
      uploadTips?: string[];
      allowMultipleFiles?: boolean;
      waiverReason?: string;
    }
  ) {
    const application = await this.findScopedApplication(actor, applicationId);
    this.ensureCanReviewMaterial(actor);
    const materials = normalizeApplicationMaterials(application.metadata, application.program?.applicationDocs as Record<string, unknown>);
    const action = payload.action;
    let nextMaterials = [...materials];
    let targetMaterial: ApplicationMaterialItem | undefined;

    if (action === "add") {
      if (!payload.title?.trim()) throw new BadRequestException("Material title is required");
      targetMaterial = createManualApplicationMaterial({
        key: payload.key,
        title: payload.title,
        note: payload.note,
        category: payload.category,
        group: payload.group,
        requirementLevel: payload.requirementLevel,
        source: payload.source || "staff",
        reason: payload.reason,
        uploadTips: payload.uploadTips,
        allowMultipleFiles: payload.allowMultipleFiles
      }, materials.length + 1);
      targetMaterial.key = uniqueMaterialKey(nextMaterials, targetMaterial.key);
      nextMaterials.push(targetMaterial);
    } else {
      const targetIndex = nextMaterials.findIndex((item) => item.key === payload.key);
      if (targetIndex < 0) throw new NotFoundException("Material not found");
      const current = nextMaterials[targetIndex];
      if (action === "update") {
        targetMaterial = updateApplicationMaterialDefinition(current, payload);
      } else if (action === "waive") {
        targetMaterial = waiveApplicationMaterial(current, actor, payload.waiverReason || payload.reason || "");
      } else {
        targetMaterial = reopenApplicationMaterial(current);
      }
      nextMaterials[targetIndex] = targetMaterial;
    }

    const metadata = { ...(application.metadata || {}), materials: nextMaterials };
    const normalizedMaterials = normalizeApplicationMaterials(metadata, application.program?.applicationDocs as Record<string, unknown>);
    application.metadata = metadata;
    application.materialStatus = aggregateApplicationMaterialStatus(normalizedMaterials);
    application.lastFollowUpAt = new Date();
    await this.applicationsRepository.save(application);

    await this.logService.write(actor, "application", `material-${action}`, "application", String(applicationId), `${materialAdjustmentActionLabel(action)} ${targetMaterial.title}`, {
      action,
      materialKey: targetMaterial.key,
      title: targetMaterial.title,
      requirementLevel: targetMaterial.requirementLevel,
      source: targetMaterial.source,
      waiverReason: targetMaterial.waiverReason || ""
    });

    await this.followUpsRepository.save(
      this.followUpsRepository.create({
        applicationId,
        adminUserId: actor.id,
        followUpType: "material",
        visibility: action === "waive" || action === "reopen" || action === "add" ? "student" : "internal",
        statusFrom: application.applicationStatus,
        statusTo: application.applicationStatus,
        content: `${materialAdjustmentActionLabel(action)}：${targetMaterial.title}${targetMaterial.waiverReason ? `。${targetMaterial.waiverReason}` : ""}`,
        nextStep: null,
        nextFollowUpAt: null
      })
    );

    if (action === "add" || action === "waive" || action === "reopen") {
      await this.createSystemMessage(application, `材料清单已调整：${materialAdjustmentActionLabel(action)}「${targetMaterial.title}」。`, {
        action,
        materialKey: targetMaterial.key,
        waiverReason: targetMaterial.waiverReason || ""
      });
    }

    return this.detail(actor, applicationId);
  }

  async sendMessage(actor: AdminRequestUser, applicationId: number, payload: { content: string; messageType?: ApplicationMessageType }) {
    const application = await this.findScopedApplication(actor, applicationId);
    const content = payload.content.trim();
    if (!content) throw new BadRequestException("Message content is required");
    const message = await this.createAdminMessage(application, actor, content, payload.messageType || "message");
    await this.followUpsRepository.save(
      this.followUpsRepository.create({
        applicationId,
        adminUserId: actor.id,
        followUpType: "note",
        visibility: "student",
        statusFrom: application.applicationStatus,
        statusTo: application.applicationStatus,
        content,
        nextStep: null,
        nextFollowUpAt: null
      })
    );
    await this.logService.write(actor, "application", "message", "application", String(applicationId), `Create application message for ${application.applicationNo}`);
    return message;
  }

  async notifications(actor: AdminRequestUser, query: { unreadOnly?: string | boolean }) {
    const items = await this.notificationsRepository.find({
      where: {
        adminUserId: actor.id,
        ...(isTruthy(query.unreadOnly) ? { isRead: false } : {})
      },
      order: { createdAt: "DESC" },
      take: 50
    });
    return { items, unreadCount: await this.notificationsRepository.count({ where: { adminUserId: actor.id, isRead: false } }) };
  }

  async markNotificationRead(actor: AdminRequestUser, id: number) {
    const notification = await this.notificationsRepository.findOneBy({ id, adminUserId: actor.id });
    if (!notification) throw new NotFoundException("Notification not found");
    notification.isRead = true;
    notification.readAt = new Date();
    await this.notificationsRepository.save(notification);
    return { id: notification.id, isRead: true };
  }

  async workbench(actor: AdminRequestUser) {
    const canSeeAll = canSeeAllApplications(actor);
    const qb = this.applicationsRepository
      .createQueryBuilder("application")
      .leftJoinAndSelect("application.university", "university")
      .leftJoinAndSelect("application.program", "program")
      .leftJoinAndSelect("application.assignedAdmin", "assignedAdmin")
      .where("application.applicationStatus NOT IN (:...closedStatuses)", { closedStatuses: ["done", "closed"] });
    applyApplicationAccessScope(qb, actor);
    const applications = await qb.orderBy("application.updatedAt", "DESC").take(200).getMany();
    const applicationIds = applications.map((item) => item.id);
    const unreadMessages = applicationIds.length
      ? await this.messagesRepository
          .createQueryBuilder("message")
          .where("message.applicationId IN (:...applicationIds)", { applicationIds })
          .andWhere("message.isReadByAdmin = :isRead", { isRead: false })
          .andWhere("message.senderType != :senderType", { senderType: "admin" })
          .getMany()
      : [];
    const unreadMessageCountByApplication = unreadMessages.reduce<Record<number, number>>((acc, message) => {
      acc[message.applicationId] = (acc[message.applicationId] || 0) + 1;
      return acc;
    }, {});

    const items: Array<Record<string, unknown>> = [];
    for (const application of applications) {
      const serialized = await this.serializeApplication(application);
      const materials = normalizeApplicationMaterials(application.metadata, application.program?.applicationDocs as Record<string, unknown>);
      if (canSeeAll && !application.assignedAdminId) {
        items.push(this.workbenchItem(application, "assign", "high", "待分配案件", "该申请还没有负责人，请分配给具体员工。"));
      }
      const unreadCount = unreadMessageCountByApplication[application.id] || 0;
      if (unreadCount) {
        items.push(this.workbenchItem(application, "message", "high", `待回复留言 ${unreadCount} 条`, "学生有新的案件留言或系统消息未读。"));
      }
      for (const material of materials.filter((item) => item.reviewStatus === "pending-review").slice(0, 3)) {
        if (material.isWaived) continue;
        items.push(this.workbenchItem(application, "material-review", "high", `待审核材料：${material.title}`, material.fileName || "学生已上传材料，请审核当前版本。", material.key));
      }
      if (materials.some((item) => !item.isWaived && (item.reviewStatus === "needs-revision" || item.reviewStatus === "rejected"))) {
        items.push(this.workbenchItem(application, "revision-wait", "medium", "等待学生补件", "已发出补件要求，需关注学生是否上传新版材料。"));
      }
      if (this.isStaleApplication(application)) {
        items.push(this.workbenchItem(application, "stale", "medium", "超过 3 天未跟进", "该案件近期没有跟进记录，建议更新下一步动作。"));
      }
      if (!serialized.workflow?.terminal && !items.some((item) => item.applicationId === application.id)) {
        items.push(this.workbenchItem(application, "status", "low", serialized.workflow.nextStaffAction, "当前案件没有紧急事项，可按状态继续跟进。"));
      }
    }

    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    items.sort((a, b) => (priorityWeight[String(b.priority)] || 0) - (priorityWeight[String(a.priority)] || 0));
    return {
      summary: {
        total: items.length,
        high: items.filter((item) => item.priority === "high").length,
        medium: items.filter((item) => item.priority === "medium").length,
        low: items.filter((item) => item.priority === "low").length,
        unreadMessages: unreadMessages.length
      },
      items: items.slice(0, 80)
    };
  }

  async workload(actor: AdminRequestUser) {
    const canSeeAll = canSeeAllApplications(actor);
    const admins = await this.adminUsersRepository.find({ where: { isActive: true }, order: { displayName: "ASC" } });
    const visibleAdmins = canSeeAll ? admins : admins.filter((admin) => admin.id === actor.id);
    const applicationsQb = this.applicationsRepository
      .createQueryBuilder("application")
      .leftJoinAndSelect("application.program", "program");
    applyApplicationAccessScope(applicationsQb, actor);
    const visibleApplications = await applicationsQb.getMany();
    const activeApplications = visibleApplications.filter((item) => item.applicationStatus !== "done" && item.applicationStatus !== "closed");

    const rows = visibleAdmins.map((admin) => {
      const assigned = visibleApplications.filter((item) => item.assignedAdminId === admin.id);
      const active = assigned.filter((item) => item.applicationStatus !== "done" && item.applicationStatus !== "closed");
      const needRevisionCount = active.filter((item) => {
        const materials = normalizeApplicationMaterials(item.metadata, item.program?.applicationDocs as Record<string, unknown>);
        return materials.some((material) => !material.isWaived && (material.reviewStatus === "needs-revision" || material.reviewStatus === "rejected"));
      }).length;
      const lastAssigned = assigned.map((item) => item.updatedAt).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0] || null;
      return {
        adminId: admin.id,
        adminName: admin.displayName,
        assignedTotal: assigned.length,
        activeCount: active.length,
        submittedCount: active.filter((item) => item.applicationStatus === "submitted").length,
        reviewingCount: active.filter((item) => item.applicationStatus === "reviewing").length,
        needRevisionCount,
        lastAssignedAt: lastAssigned
      };
    });

    return {
      unassignedCount: activeApplications.filter((item) => !item.assignedAdminId).length,
      activeCount: activeApplications.length,
      rows
    };
  }

  async materialFile(actor: AdminRequestUser, applicationId: number, key: string, versionId?: string) {
    const application = await this.findScopedApplication(actor, applicationId);
    const materials = normalizeApplicationMaterials(application.metadata, application.program?.applicationDocs as Record<string, unknown>);
    const material = materials.find((item) => item.key === key);
    const version = versionId ? material?.versions?.find((item) => item.id === versionId) : undefined;
    const storagePath = version?.storagePath || material?.storagePath;
    if (!material || !storagePath) throw new NotFoundException("Material file not found");

    const root = uploadRoot();
    const fullPath = path.resolve(root, storagePath);
    if (!fullPath.startsWith(`${root}${path.sep}`)) throw new BadRequestException("Invalid material path");
    await stat(fullPath);
    return {
      stream: createReadStream(fullPath),
      fileName: version?.fileName || material.fileName || `${material.key}.file`,
      mimeType: version?.mimeType || material.mimeType || "application/octet-stream"
    };
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
      材料进度: `${item.materialSummary?.approved || 0}/${item.materialSummary?.total || 0}`,
      跟进顾问: item.assignedAdminName,
      更新时间: item.updatedAt
    }));
  }

  private async serializeApplication(entity: StudentApplicationEntity) {
    const university = entity.university || (await this.universitiesRepository.findOneBy({ id: entity.universityId }));
    const program = entity.program || (await this.programsRepository.findOneBy({ id: entity.programId }));
    const assignedAdmin = entity.assignedAdmin || (entity.assignedAdminId ? await this.adminUsersRepository.findOneBy({ id: entity.assignedAdminId }) : null);
    const ownerAdmin = entity.ownerAdmin || (entity.ownerAdminId ? await this.adminUsersRepository.findOneBy({ id: entity.ownerAdminId }) : null);
    const materials = normalizeApplicationMaterials(entity.metadata, program?.applicationDocs as Record<string, unknown>);
    const applicationProfileSnapshot = getApplicationProfileSnapshot(entity.metadata);
    const applicationProfileSummary = getApplicationProfileSummary(entity.metadata);
    const submittedCatalogSnapshot = getApplicationCatalogSnapshot(entity.metadata);
    const currentCatalogSnapshot = buildApplicationCatalogSnapshot({ university, program });
    const catalogSnapshotComparison = compareApplicationCatalogSnapshot(submittedCatalogSnapshot, currentCatalogSnapshot);
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
      applicationProfileSnapshot,
      applicationProfileSummary,
      catalogSnapshotComparison,
      materialSummary: summarizeApplicationMaterials(materials),
      materials: toPublicApplicationMaterials(materials),
      workflow: getApplicationWorkflow(entity.applicationStatus),
      todos: buildStudentApplicationTodos(entity, materials),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  private async findScopedApplication(actor: AdminRequestUser, id: number) {
    const qb = this.applicationsRepository
      .createQueryBuilder("application")
      .leftJoinAndSelect("application.university", "university")
      .leftJoinAndSelect("application.program", "program")
      .leftJoinAndSelect("application.ownerAdmin", "ownerAdmin")
      .leftJoinAndSelect("application.assignedAdmin", "assignedAdmin")
      .where("application.id = :id", { id });
    applyApplicationAccessScope(qb, actor);
    const entity = await qb.getOne();
    if (!entity) throw new NotFoundException("Application not found");
    return entity;
  }

  private async ensureAssignableAdmin(adminId: number | null) {
    if (!adminId) return null;
    const admin = await this.adminUsersRepository.findOneBy({ id: adminId, isActive: true });
    if (!admin) throw new BadRequestException("Assigned admin not found");
    return admin;
  }

  private ensureCanAssign(actor: AdminRequestUser) {
    if (!canAssignApplications(actor)) {
      throw new ForbiddenException("当前账号没有分配或转交案件的权限");
    }
  }

  private ensureCanUpdateStatus(actor: AdminRequestUser, statusTo: ApplicationWorkflowStatus) {
    if (canUpdateApplicationStatus(actor, statusTo)) {
      return;
    }
    throw new ForbiddenException("当前账号不能流转到该申请阶段");
  }

  private ensureCanReviewMaterial(actor: AdminRequestUser) {
    if (canReviewApplicationMaterials(actor)) {
      return;
    }
    throw new ForbiddenException("当前账号没有材料审核权限");
  }

  private ensureAllowedStatusTransition(from: unknown, to: unknown): ApplicationWorkflowStatus {
    try {
      return assertApplicationStatusTransition(from, to);
    } catch {
      throw new BadRequestException(`不允许的申请状态流转：${getApplicationWorkflow(from).label} -> ${getApplicationWorkflow(to).label}`);
    }
  }

  private workbenchItem(
    application: StudentApplicationEntity,
    category: string,
    priority: "low" | "medium" | "high",
    title: string,
    description: string,
    materialKey?: string
  ) {
    return {
      id: `${category}-${application.id}-${materialKey || "case"}`,
      category,
      priority,
      title,
      description,
      applicationId: application.id,
      applicationNo: application.applicationNo,
      studentName: application.studentName,
      universityName: application.university?.name?.["zh-CN"] || application.university?.shortName || "",
      programName: application.program?.name?.["zh-CN"] || application.program?.code || "",
      assignedAdminName: application.assignedAdmin?.displayName || "待分配",
      status: normalizeApplicationStatus(application.applicationStatus),
      statusLabel: getApplicationWorkflow(application.applicationStatus).label,
      materialKey,
      updatedAt: application.updatedAt
    };
  }

  private isStaleApplication(application: StudentApplicationEntity) {
    const reference = application.lastFollowUpAt || application.updatedAt || application.createdAt;
    return Date.now() - new Date(reference).getTime() > 3 * 24 * 60 * 60 * 1000;
  }

  private async notifyAssignedAdmin(adminId: number, application: StudentApplicationEntity, actor: AdminRequestUser, note: string) {
    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        adminUserId: adminId,
        notificationType: "application-assigned",
        targetType: "application",
        targetId: String(application.id),
        title: "新申请案件已分配给你",
        body: `${actor.displayName} 已将 ${application.applicationNo}（${application.studentName}）分配给你${note ? `：${note}` : ""}`,
        isRead: false,
        metadata: {
          applicationId: application.id,
          applicationNo: application.applicationNo,
          studentName: application.studentName,
          assignedBy: actor.displayName
        }
      })
    );
  }

  private reviewMaterialVersion(
    version: ApplicationMaterialVersion,
    payload: { reviewStatus: ApplicationMaterialReviewStatus; note?: string },
    actor: AdminRequestUser
  ): ApplicationMaterialVersion {
    return {
      ...version,
      reviewStatus: payload.reviewStatus,
      reviewNote: payload.note || null,
      reviewedAt: new Date().toISOString(),
      reviewedByAdminId: actor.id,
      reviewedByAdminName: actor.displayName
    };
  }

  private async createAdminMessage(
    application: StudentApplicationEntity,
    actor: AdminRequestUser,
    content: string,
    messageType: ApplicationMessageType,
    metadata?: Record<string, unknown>
  ) {
    return this.messagesRepository.save(
      this.messagesRepository.create({
        applicationId: application.id,
        studentId: application.studentId,
        adminUserId: actor.id,
        senderType: "admin",
        messageType,
        content,
        metadata: metadata || null,
        isReadByStudent: false,
        isReadByAdmin: true
      })
    );
  }

  private async createSystemMessage(application: StudentApplicationEntity, content: string, metadata?: Record<string, unknown>) {
    return this.messagesRepository.save(
      this.messagesRepository.create({
        applicationId: application.id,
        studentId: application.studentId,
        adminUserId: null,
        senderType: "system",
        messageType: "system",
        content,
        metadata: metadata || null,
        isReadByStudent: false,
        isReadByAdmin: true
      })
    );
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

function isTruthy(value: unknown) {
  return value === true || value === "true" || value === "1" || value === 1;
}

const MANAGER_ROLE_CODES = new Set(["application-manager", "manager", "business-manager"]);
const CONSULTANT_ROLE_CODES = new Set(["counselor", "consultant", "application-consultant"]);
const MATERIAL_AUDITOR_ROLE_CODES = new Set(["material-auditor", "application-auditor", "auditor"]);
const VISA_SPECIALIST_ROLE_CODES = new Set(["visa-specialist", "visa-officer"]);
const MATERIAL_AUDITOR_STATUSES: ApplicationStatus[] = ["submitted", "reviewing", "need-info"];
const VISA_SPECIALIST_STATUSES: ApplicationStatus[] = ["visa", "done"];

export function canSeeAllApplications(actor: AdminRequestUser) {
  return actor.dataScope === "all" || actor.roleCodes.includes("super-admin");
}

export function canAssignApplications(actor: AdminRequestUser) {
  return canSeeAllApplications(actor) || hasAnyRole(actor, MANAGER_ROLE_CODES);
}

export function canReviewApplicationMaterials(actor: AdminRequestUser) {
  return canSeeAllApplications(actor) || hasAnyRole(actor, MANAGER_ROLE_CODES) || hasAnyRole(actor, CONSULTANT_ROLE_CODES) || hasAnyRole(actor, MATERIAL_AUDITOR_ROLE_CODES);
}

export function canUpdateApplicationStatus(actor: AdminRequestUser, statusTo: ApplicationWorkflowStatus) {
  if (canSeeAllApplications(actor) || hasAnyRole(actor, MANAGER_ROLE_CODES) || hasAnyRole(actor, CONSULTANT_ROLE_CODES)) {
    return true;
  }
  if (hasAnyRole(actor, MATERIAL_AUDITOR_ROLE_CODES) && ["reviewing", "need-info", "platform-approved"].includes(statusTo)) {
    return true;
  }
  if (hasAnyRole(actor, VISA_SPECIALIST_ROLE_CODES) && ["visa", "done", "closed"].includes(statusTo)) {
    return true;
  }
  return false;
}

export function applicationStatusScopeForActor(actor: AdminRequestUser): ApplicationStatus[] | null {
  if (canSeeAllApplications(actor) || hasAnyRole(actor, MANAGER_ROLE_CODES) || hasAnyRole(actor, CONSULTANT_ROLE_CODES)) {
    return null;
  }
  const statuses = new Set<ApplicationStatus>();
  if (hasAnyRole(actor, MATERIAL_AUDITOR_ROLE_CODES)) {
    MATERIAL_AUDITOR_STATUSES.forEach((status) => statuses.add(status));
  }
  if (hasAnyRole(actor, VISA_SPECIALIST_ROLE_CODES)) {
    VISA_SPECIALIST_STATUSES.forEach((status) => statuses.add(status));
  }
  return statuses.size ? Array.from(statuses) : null;
}

export function applyApplicationAccessScope(qb: SelectQueryBuilder<any>, actor: AdminRequestUser, alias = "application") {
  if (!canSeeAllApplications(actor)) {
    if (actor.dataScope === "created") {
      qb.andWhere(`${alias}.ownerAdminId = :applicationScopeAdminId`, { applicationScopeAdminId: actor.id });
    } else {
      qb.andWhere(`${alias}.assignedAdminId = :applicationScopeAdminId`, { applicationScopeAdminId: actor.id });
    }
  }

  const statusScope = applicationStatusScopeForActor(actor);
  if (statusScope?.length) {
    qb.andWhere(`${alias}.applicationStatus IN (:...applicationRoleStatuses)`, { applicationRoleStatuses: statusScope });
  }
  return qb;
}

function hasAnyRole(actor: AdminRequestUser, roleCodes: Set<string>) {
  return actor.roleCodes.some((roleCode) => roleCodes.has(roleCode));
}

function normalizeFollowUpVisibility(value: unknown): ApplicationFollowUpVisibility {
  if (value === "student" || value === "system") return value;
  return "internal";
}

function followUpVisibilityLabel(value: ApplicationFollowUpVisibility) {
  const labels: Record<ApplicationFollowUpVisibility, string> = {
    internal: "内部备注",
    student: "学生可见",
    system: "系统记录"
  };
  return labels[value] || labels.internal;
}

function messageTypeForFollowUp(followUpType: string): ApplicationMessageType {
  if (followUpType === "material") return "revision-request";
  if (followUpType === "status") return "system";
  return "message";
}

function uniqueMaterialKey(materials: ApplicationMaterialItem[], key: string) {
  if (!materials.some((item) => item.key === key)) return key;
  let index = 2;
  while (materials.some((item) => item.key === `${key}-${index}`)) index += 1;
  return `${key}-${index}`;
}

function materialAdjustmentActionLabel(action: "add" | "update" | "waive" | "reopen") {
  const labels = {
    add: "新增材料",
    update: "修改材料要求",
    waive: "豁免材料",
    reopen: "恢复材料要求"
  };
  return labels[action];
}

function uploadRoot() {
  const configured = process.env.APPLICATION_UPLOAD_DIR;
  return path.resolve(configured || path.join(process.cwd(), "data", "uploads", "applications"));
}
