import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Repository } from "typeorm";
import {
  aggregateApplicationMaterialStatus,
  buildIntelligentApplicationMaterials,
  normalizeApplicationMaterials,
  linkApplicationMaterialFromLibrary,
  summarizeApplicationMaterials,
  toPublicApplicationMaterials,
  upsertApplicationMaterial,
  type ApplicationMaterialItem,
  type MaterialLibraryLinkReference,
  type ApplicationMaterialVersion
} from "../common/application-materials.js";
import {
  buildStudentApplicationTodos,
  getApplicationWorkflow,
  normalizeApplicationStatus,
  stageForApplicationStatus
} from "../common/application-workflow.js";
import {
  buildApplicationProfileSnapshot,
  getApplicationProfileSnapshot,
  getApplicationProfileSummary,
  summarizeApplicationProfile
} from "../common/application-profile.js";
import { buildApplicationCatalogSnapshot } from "../common/application-catalog-snapshot.js";
import { validateApplicationUploadFile } from "../common/application-upload.js";
import {
  AdminNotificationEntity,
  ApplicationMessageEntity,
  PlannerProfileEntity,
  ProgramEntity,
  StudentApplicationEntity,
  StudentMaterialLibraryEntity,
  UniversityEntity,
  UserEntity,
  type ApplicationMessageType
} from "../db/entities.js";
import { AdminLogService } from "../admin/admin-log.service.js";

export interface SubmitApplicationPayload {
  universityId: number;
  programId: number;
  intake?: string;
  studentPhone?: string;
  notes?: string;
}

export interface UploadedApplicationFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadMaterialLibraryPayload {
  materialType?: string;
  title?: string;
}

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(StudentApplicationEntity) private readonly applicationsRepository: Repository<StudentApplicationEntity>,
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @InjectRepository(PlannerProfileEntity) private readonly profilesRepository: Repository<PlannerProfileEntity>,
    @InjectRepository(StudentMaterialLibraryEntity) private readonly materialLibraryRepository: Repository<StudentMaterialLibraryEntity>,
    @InjectRepository(ApplicationMessageEntity) private readonly messagesRepository: Repository<ApplicationMessageEntity>,
    @InjectRepository(AdminNotificationEntity) private readonly notificationsRepository: Repository<AdminNotificationEntity>,
    @Inject(AdminLogService) private readonly logService: AdminLogService
  ) {}

  async list(userId: number) {
    const items = await this.applicationsRepository.find({
      where: { studentId: userId },
      relations: { university: true, program: true, assignedAdmin: true },
      order: { updatedAt: "DESC" }
    });
    return { items: items.map((item) => this.serializeApplication(item)) };
  }

  async materialLibrary(userId: number) {
    const items = await this.materialLibraryRepository.find({
      where: { studentId: userId },
      order: { updatedAt: "DESC" }
    });
    return { items: items.map((item) => this.serializeLibraryMaterial(item)) };
  }

  async uploadMaterialLibrary(userId: number, payload: UploadMaterialLibraryPayload, file: UploadedApplicationFile | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException("Missing upload file");
    validateApplicationUploadFile(file);

    const materialType = safePathSegment(payload.materialType || "general");
    const title = payload.title?.trim() || materialLibraryTitle(materialType);
    const relativePath = await this.storeLibraryUpload(userId, materialType, file);
    const uploadedAt = new Date().toISOString();
    const existing = await this.materialLibraryRepository.findOne({ where: { studentId: userId, materialType } });
    const versions = normalizeLibraryVersions(existing?.metadata?.versions);
    const nextVersion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      version: versions.length + 1,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt,
      storagePath: relativePath
    };

    const entity = existing || this.materialLibraryRepository.create({ studentId: userId, materialType });
    Object.assign(entity, {
      title,
      fileName: nextVersion.fileName,
      mimeType: nextVersion.mimeType || "",
      size: nextVersion.size,
      storagePath: nextVersion.storagePath,
      currentVersionId: nextVersion.id,
      version: nextVersion.version,
      metadata: {
        ...(existing?.metadata || {}),
        versions: [...versions, nextVersion]
      }
    });
    const saved = await this.materialLibraryRepository.save(entity);
    await this.logService.write(null, "application", "student-material-library-upload", "material-library", String(saved.id), `Student uploaded library material ${saved.title}`, {
      studentId: userId,
      materialType,
      fileName: file.originalname,
      version: nextVersion.version
    });
    return this.serializeLibraryMaterial(saved);
  }

  async detail(userId: number, id: number) {
    const entity = await this.findStudentApplication(userId, id);
    await this.markStudentMessagesRead(entity.id);
    return {
      ...this.serializeApplication(entity),
      messages: await this.messages(entity.id)
    };
  }

  async submit(user: UserEntity, payload: SubmitApplicationPayload) {
    const { university, program } = await this.ensureApplicationTarget(payload.universityId, payload.programId);
    const existing = await this.applicationsRepository.findOne({
      where: { studentId: user.id, universityId: payload.universityId, programId: payload.programId },
      relations: { university: true, program: true, assignedAdmin: true },
      order: { createdAt: "DESC" }
    });

    if (existing && existing.applicationStatus !== "closed") {
      return this.serializeApplication(existing);
    }

    const profile = await this.profilesRepository.findOne({ where: { userId: user.id } });
    const profileSnapshot = buildApplicationProfileSnapshot(profile, {
      fallbackContact: {
        fullName: user.displayName,
        email: user.account,
        phone: payload.studentPhone
      }
    });
    const profileSummary = summarizeApplicationProfile(profileSnapshot);
    const materials = buildIntelligentApplicationMaterials({
      applicationDocs: program.applicationDocs as Record<string, unknown>,
      profileSnapshot,
      programLevel: program.level
    });
    const submittedAt = new Date().toISOString();
    const applicationCatalogSnapshot = buildApplicationCatalogSnapshot({
      university,
      program,
      caseMaterials: materials,
      snapshotAt: submittedAt
    });
    const application = await this.applicationsRepository.save(
      this.applicationsRepository.create({
        applicationNo: this.generateApplicationNo(),
        studentId: user.id,
        studentName: user.displayName,
        studentEmail: user.account,
        studentPhone: payload.studentPhone || "",
        universityId: university.id,
        programId: program.id,
        applicationStatus: "submitted",
        currentStage: "materials",
        materialStatus: aggregateApplicationMaterialStatus(materials),
        visaStatus: "not-started",
        priority: "medium",
        intake: payload.intake || firstIntake(program),
        ownerAdminId: null,
        assignedAdminId: null,
        submittedAt: currentDateString(),
        expectedDecisionDate: null,
        notes: payload.notes || null,
        metadata: {
          source: "student-portal",
          studentSubmittedAt: submittedAt,
          studentNotes: payload.notes || "",
          applicationCatalogSnapshot,
          applicationProfileSnapshot: profileSnapshot,
          applicationProfileSummary: profileSummary,
          studentProfile: profileSnapshot,
          materials
        }
      })
    );

    await this.logService.write(null, "application", "student-submit", "application", String(application.id), `Student submitted application ${application.applicationNo}`, {
      studentId: user.id,
      universityId: university.id,
      programId: program.id
    });

    return this.detail(user.id, application.id);
  }

  async uploadMaterial(userId: number, applicationId: number, key: string, file: UploadedApplicationFile | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException("Missing upload file");
    validateApplicationUploadFile(file);

    const application = await this.findStudentApplication(userId, applicationId);
    const materials = normalizeApplicationMaterials(application.metadata, application.program?.applicationDocs as Record<string, unknown>);
    const target = materials.find((item) => item.key === key);
    if (!target) throw new NotFoundException("Material not found");

    const relativePath = await this.storeUpload(application.id, key, file);
    const uploadedAt = new Date().toISOString();
    const versions = target.versions || [];
    const nextVersion: ApplicationMaterialVersion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      version: versions.length + 1,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt,
      storagePath: relativePath,
      reviewStatus: "pending-review",
      reviewNote: null
    };
    const nextMaterial: ApplicationMaterialItem = {
      ...target,
      status: "progress",
      reviewStatus: "pending-review",
      fileName: nextVersion.fileName,
      mimeType: nextVersion.mimeType,
      size: nextVersion.size,
      uploadedAt,
      storagePath: relativePath,
      reviewNote: null,
      reviewedAt: undefined,
      reviewedByAdminId: undefined,
      reviewedByAdminName: undefined,
      currentVersionId: nextVersion.id,
      versions: [...versions, nextVersion]
    };

    const metadata = upsertApplicationMaterial(application.metadata, application.program?.applicationDocs as Record<string, unknown>, nextMaterial);
    const nextMaterials = normalizeApplicationMaterials(metadata, application.program?.applicationDocs as Record<string, unknown>);
    application.metadata = metadata;
    application.materialStatus = aggregateApplicationMaterialStatus(nextMaterials);
    const nextApplicationStatus = normalizeApplicationStatus(application.applicationStatus === "need-info" ? "reviewing" : application.applicationStatus);
    application.applicationStatus = nextApplicationStatus === "draft" ? "submitted" : nextApplicationStatus;
    application.currentStage = stageForApplicationStatus(application.applicationStatus) as StudentApplicationEntity["currentStage"];
    await this.applicationsRepository.save(application);

    await this.logService.write(null, "application", "student-material-upload", "application", String(application.id), `Student uploaded material ${nextMaterial.title}`, {
      studentId: userId,
      materialKey: key,
      fileName: file.originalname,
      versionId: nextVersion.id,
      version: nextVersion.version
    });

    await this.createStudentMessage(application, userId, `学生已上传材料：${nextMaterial.title}（第 ${nextVersion.version} 版）`, "material-upload", {
      materialKey: key,
      versionId: nextVersion.id,
      fileName: nextVersion.fileName
    });
    await this.notifyAssignedAdmin(application, "学生上传了新的申请材料", `${application.studentName} 已上传 ${nextMaterial.title}（第 ${nextVersion.version} 版），请及时审核。`);

    return this.detail(userId, application.id);
  }

  async linkMaterialFromLibrary(userId: number, applicationId: number, key: string, payload: { libraryMaterialId: number }) {
    const application = await this.findStudentApplication(userId, applicationId);
    const libraryMaterial = await this.materialLibraryRepository.findOne({ where: { id: payload.libraryMaterialId, studentId: userId } });
    if (!libraryMaterial) throw new NotFoundException("Library material not found");

    const materials = normalizeApplicationMaterials(application.metadata, application.program?.applicationDocs as Record<string, unknown>);
    const target = materials.find((item) => item.key === key);
    if (!target) throw new NotFoundException("Material not found");

    const linkedMaterial = linkApplicationMaterialFromLibrary(target, this.toLibraryLinkReference(libraryMaterial));
    const metadata = upsertApplicationMaterial(application.metadata, application.program?.applicationDocs as Record<string, unknown>, linkedMaterial);
    const nextMaterials = normalizeApplicationMaterials(metadata, application.program?.applicationDocs as Record<string, unknown>);
    application.metadata = metadata;
    application.materialStatus = aggregateApplicationMaterialStatus(nextMaterials);
    const nextApplicationStatus = normalizeApplicationStatus(application.applicationStatus === "need-info" ? "reviewing" : application.applicationStatus);
    application.applicationStatus = nextApplicationStatus === "draft" ? "submitted" : nextApplicationStatus;
    application.currentStage = stageForApplicationStatus(application.applicationStatus) as StudentApplicationEntity["currentStage"];
    await this.applicationsRepository.save(application);

    await this.logService.write(null, "application", "student-material-library-link", "application", String(application.id), `Student linked library material ${libraryMaterial.title}`, {
      studentId: userId,
      materialKey: key,
      libraryMaterialId: libraryMaterial.id,
      libraryVersionId: libraryMaterial.currentVersionId,
      libraryVersion: libraryMaterial.version
    });
    await this.createStudentMessage(application, userId, `学生已从材料库关联材料：${target.title}（${libraryMaterial.title} 第 ${libraryMaterial.version} 版）`, "material-upload", {
      materialKey: key,
      libraryMaterialId: libraryMaterial.id,
      libraryVersionId: libraryMaterial.currentVersionId,
      libraryVersion: libraryMaterial.version
    });
    await this.notifyAssignedAdmin(application, "学生关联了材料库文件", `${application.studentName} 已将材料库文件关联到 ${target.title}，请及时审核。`);

    return this.detail(userId, application.id);
  }

  async sendMessage(userId: number, applicationId: number, payload: { content: string }) {
    const application = await this.findStudentApplication(userId, applicationId);
    const content = payload.content.trim();
    if (!content) throw new BadRequestException("Message content is required");
    const message = await this.createStudentMessage(application, userId, content, "message");
    await this.notifyAssignedAdmin(application, "学生发送了新的案件留言", `${application.studentName}：${content.slice(0, 120)}`);
    return message;
  }

  async materialFile(userId: number, applicationId: number, key: string, versionId?: string) {
    const application = await this.findStudentApplication(userId, applicationId);
    return this.resolveMaterialFile(application, key, versionId);
  }

  async materialLibraryFile(userId: number, materialId: number, versionId?: string) {
    const material = await this.materialLibraryRepository.findOne({ where: { id: materialId, studentId: userId } });
    if (!material) throw new NotFoundException("Library material not found");
    const versions = normalizeLibraryVersions(material.metadata?.versions);
    const version = versionId ? versions.find((item) => item.id === versionId) : versions.find((item) => item.id === material.currentVersionId) || versions[versions.length - 1];
    const storagePath = version?.storagePath || material.storagePath;
    if (!storagePath) throw new NotFoundException("Library material file not found");
    const root = uploadRoot();
    const fullPath = path.resolve(root, storagePath);
    if (!fullPath.startsWith(`${root}${path.sep}`)) throw new BadRequestException("Invalid material path");
    await stat(fullPath);
    return {
      stream: createReadStream(fullPath),
      fileName: version?.fileName || material.fileName,
      mimeType: version?.mimeType || material.mimeType || "application/octet-stream"
    };
  }

  private async findStudentApplication(userId: number, id: number) {
    const entity = await this.applicationsRepository.findOne({
      where: { id, studentId: userId },
      relations: { university: true, program: true, assignedAdmin: true }
    });
    if (!entity) throw new NotFoundException("Application not found");
    return entity;
  }

  private async ensureApplicationTarget(universityId: number, programId: number) {
    const [university, program] = await Promise.all([
      this.universitiesRepository.findOneBy({ id: universityId }),
      this.programsRepository.findOneBy({ id: programId })
    ]);
    if (!university) throw new NotFoundException("University not found");
    if (!program) throw new NotFoundException("Program not found");
    if (program.universityId !== university.id) throw new BadRequestException("Program does not belong to selected university");
    return { university, program };
  }

  private serializeApplication(entity: StudentApplicationEntity) {
    const materials = normalizeApplicationMaterials(entity.metadata, entity.program?.applicationDocs as Record<string, unknown>);
    const workflow = getApplicationWorkflow(entity.applicationStatus);
    const applicationProfileSnapshot = getApplicationProfileSnapshot(entity.metadata);
    const applicationProfileSummary = getApplicationProfileSummary(entity.metadata);
    return {
      id: entity.id,
      applicationNo: entity.applicationNo,
      studentName: entity.studentName,
      studentEmail: entity.studentEmail,
      studentPhone: entity.studentPhone,
      universityId: entity.universityId,
      universityName: entity.university?.name?.["zh-CN"] || entity.university?.shortName || "",
      programId: entity.programId,
      programName: entity.program?.name?.["zh-CN"] || entity.program?.code || "",
      applicationStatus: entity.applicationStatus,
      currentStage: entity.currentStage,
      materialStatus: entity.materialStatus,
      visaStatus: entity.visaStatus,
      priority: entity.priority,
      intake: entity.intake,
      assignedAdminName: entity.assignedAdmin?.displayName || "",
      submittedAt: entity.submittedAt,
      expectedDecisionDate: entity.expectedDecisionDate,
      lastFollowUpAt: entity.lastFollowUpAt,
      notes: entity.notes,
      materialSummary: summarizeApplicationMaterials(materials),
      materials: toPublicApplicationMaterials(materials),
      applicationProfileSnapshot,
      applicationProfileSummary,
      workflow,
      todos: buildStudentApplicationTodos(entity, materials),
      metadata: {
        source: entity.metadata?.source,
        studentNotes: entity.metadata?.studentNotes,
        studentProfile: applicationProfileSnapshot
      },
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  private async messages(applicationId: number) {
    const messages = await this.messagesRepository.find({
      where: { applicationId },
      relations: { adminUser: true, student: true },
      order: { createdAt: "ASC" },
      take: 200
    });
    return messages.map((item) => ({
      id: item.id,
      senderType: item.senderType,
      messageType: item.messageType,
      content: item.content,
      metadata: item.metadata,
      senderName: item.senderType === "admin" ? item.adminUser?.displayName || "顾问老师" : item.senderType === "system" ? "系统通知" : item.student?.displayName || "学生",
      createdAt: item.createdAt,
      isReadByStudent: item.isReadByStudent,
      isReadByAdmin: item.isReadByAdmin
    }));
  }

  private async markStudentMessagesRead(applicationId: number) {
    await this.messagesRepository
      .createQueryBuilder()
      .update(ApplicationMessageEntity)
      .set({ isReadByStudent: true })
      .where("applicationId = :applicationId", { applicationId })
      .andWhere("senderType != :senderType", { senderType: "student" })
      .andWhere("isReadByStudent = :isReadByStudent", { isReadByStudent: false })
      .execute();
  }

  private async storeUpload(applicationId: number, key: string, file: UploadedApplicationFile) {
    const root = uploadRoot();
    const folder = path.join(root, String(applicationId), safePathSegment(key));
    await mkdir(folder, { recursive: true });
    const fileName = `${Date.now()}-${safeFileName(file.originalname)}`;
    const fullPath = path.join(folder, fileName);
    await writeFile(fullPath, file.buffer);
    return path.relative(root, fullPath);
  }

  private async storeLibraryUpload(userId: number, materialType: string, file: UploadedApplicationFile) {
    const root = uploadRoot();
    const folder = path.join(root, "library", String(userId), safePathSegment(materialType));
    await mkdir(folder, { recursive: true });
    const fileName = `${Date.now()}-${safeFileName(file.originalname)}`;
    const fullPath = path.join(folder, fileName);
    await writeFile(fullPath, file.buffer);
    return path.relative(root, fullPath);
  }

  private async resolveMaterialFile(application: StudentApplicationEntity, key: string, versionId?: string) {
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

  private async createStudentMessage(
    application: StudentApplicationEntity,
    studentId: number,
    content: string,
    messageType: ApplicationMessageType,
    metadata?: Record<string, unknown>
  ) {
    return this.messagesRepository.save(
      this.messagesRepository.create({
        applicationId: application.id,
        studentId,
        adminUserId: null,
        senderType: "student",
        messageType,
        content,
        metadata: metadata || null,
        isReadByStudent: true,
        isReadByAdmin: false
      })
    );
  }

  private async notifyAssignedAdmin(application: StudentApplicationEntity, title: string, body: string) {
    if (!application.assignedAdminId) return;
    await this.notificationsRepository.save(
      this.notificationsRepository.create({
        adminUserId: application.assignedAdminId,
        notificationType: "application-message",
        targetType: "application",
        targetId: String(application.id),
        title,
        body,
        isRead: false,
        metadata: {
          applicationId: application.id,
          applicationNo: application.applicationNo,
          studentName: application.studentName
        }
      })
    );
  }

  private serializeLibraryMaterial(entity: StudentMaterialLibraryEntity) {
    const versions = normalizeLibraryVersions(entity.metadata?.versions);
    return {
      id: entity.id,
      materialType: entity.materialType,
      title: entity.title,
      fileName: entity.fileName,
      mimeType: entity.mimeType,
      size: entity.size,
      currentVersionId: entity.currentVersionId,
      version: entity.version,
      versions: versions.map(({ storagePath, ...version }) => ({
        ...version,
        hasFile: Boolean(storagePath)
      })),
      hasFile: Boolean(entity.storagePath),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  private toLibraryLinkReference(entity: StudentMaterialLibraryEntity): MaterialLibraryLinkReference {
    return {
      id: entity.id,
      title: entity.title,
      materialType: entity.materialType,
      fileName: entity.fileName,
      mimeType: entity.mimeType,
      size: entity.size,
      storagePath: entity.storagePath,
      currentVersionId: entity.currentVersionId,
      version: entity.version,
      uploadedAt: entity.updatedAt ? entity.updatedAt.toISOString() : undefined
    };
  }

  private generateApplicationNo() {
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `APP-${currentDateString().replace(/-/g, "")}-${random}`;
  }
}

function uploadRoot() {
  const configured = process.env.APPLICATION_UPLOAD_DIR;
  return path.resolve(configured || path.join(process.cwd(), "data", "uploads", "applications"));
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "material";
}

function safeFileName(value: string) {
  const extension = path.extname(value).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
  const base = path.basename(value, path.extname(value)).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "upload";
  return `${base}${extension}`;
}

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}

function firstIntake(program: ProgramEntity) {
  const first = Array.isArray(program.intakeMonths) ? program.intakeMonths[0] : "";
  return first || "待确认";
}

function normalizeLibraryVersions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const fileName = typeof source.fileName === "string" ? source.fileName : "";
      const uploadedAt = typeof source.uploadedAt === "string" ? source.uploadedAt : "";
      const storagePath = typeof source.storagePath === "string" ? source.storagePath : "";
      if (!fileName || !uploadedAt || !storagePath) return null;
      return {
        id: typeof source.id === "string" ? source.id : `library-version-${index + 1}`,
        version: typeof source.version === "number" ? source.version : index + 1,
        fileName,
        mimeType: typeof source.mimeType === "string" ? source.mimeType : "",
        size: typeof source.size === "number" ? source.size : 0,
        uploadedAt,
        storagePath
      };
    })
    .filter((item): item is { id: string; version: number; fileName: string; mimeType: string; size: number; uploadedAt: string; storagePath: string } => Boolean(item));
}

function materialLibraryTitle(materialType: string) {
  const labels: Record<string, string> = {
    passport: "护照首页",
    "passport-full-scan": "整本护照扫描件",
    "id-photo-white-background": "白底证件照片",
    "high-school-notarized-docs": "高中毕业证与成绩单公证书",
    "bachelor-notarized-docs": "本科毕业证与成绩单公证书",
    "college-upgrade-notarized-docs": "专升本大专毕业证与成绩单公证书",
    "overseas-credential-verification": "海外学历中留服验证报告及公证书",
    "bachelor-master-notarized-docs": "本科及硕士毕业证与成绩单公证书",
    "cv-work-proof": "个人简历与工作证明",
    "language-score": "英文成绩证明",
    transcript: "成绩单",
    language: "语言成绩",
    graduation: "毕业证或在读证明",
    degree: "学位证",
    recommendation: "推荐信",
    statement: "个人陈述",
    cv: "英文简历",
    "research-proposal": "研究计划",
    scholarship: "奖学金材料",
    visa: "签证材料"
  };
  return labels[materialType] || "申请材料";
}
