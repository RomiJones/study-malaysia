import type { ApplicationProfileSnapshot } from "./application-profile.js";

export type ApplicationMaterialReviewStatus = "not-uploaded" | "pending-review" | "approved" | "needs-revision" | "rejected";
export type ApplicationMaterialStatus = "draft" | "wait" | "progress" | "done";
export type ApplicationMaterialRequirementLevel = "required" | "recommended" | "conditional";
export type ApplicationMaterialSource = "school" | "degree" | "language" | "scholarship" | "visa" | "profile" | "staff";

export interface ApplicationMaterialVersion {
  id: string;
  version: number;
  fileName: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
  storagePath?: string;
  reviewStatus: ApplicationMaterialReviewStatus;
  reviewNote?: string | null;
  reviewedAt?: string;
  reviewedByAdminId?: number;
  reviewedByAdminName?: string;
  isWaived?: boolean;
  waiverReason?: string;
  waivedAt?: string;
  waivedByAdminId?: number;
  waivedByAdminName?: string;
  linkedFromLibrary?: boolean;
  libraryMaterialId?: number;
  libraryVersionId?: string;
  libraryVersion?: number;
}

export interface ApplicationMaterialItem {
  key: string;
  title: string;
  note?: string;
  category?: string;
  group?: string;
  groupLabel?: string;
  requirementLevel?: ApplicationMaterialRequirementLevel;
  requirementLevelLabel?: string;
  source?: ApplicationMaterialSource;
  sourceLabel?: string;
  reason?: string;
  triggers?: string[];
  uploadTips?: string[];
  allowMultipleFiles?: boolean;
  status: ApplicationMaterialStatus;
  reviewStatus: ApplicationMaterialReviewStatus;
  fileName?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
  storagePath?: string;
  reviewNote?: string | null;
  reviewedAt?: string;
  reviewedByAdminId?: number;
  reviewedByAdminName?: string;
  isWaived?: boolean;
  waiverReason?: string;
  waivedAt?: string;
  waivedByAdminId?: number;
  waivedByAdminName?: string;
  linkedFromLibrary?: boolean;
  libraryMaterialId?: number;
  libraryVersionId?: string;
  libraryVersion?: number;
  libraryTitle?: string;
  currentVersionId?: string;
  versions?: ApplicationMaterialVersion[];
}

export interface ApplicationMaterialSummary {
  total: number;
  uploaded: number;
  approved: number;
  needRevision: number;
  pendingReview: number;
  waived: number;
}

export interface BuildIntelligentApplicationMaterialsOptions {
  applicationDocs?: Record<string, unknown> | null;
  profileSnapshot?: ApplicationProfileSnapshot | null;
  programLevel?: string;
}

export interface MaterialLibraryLinkReference {
  id: number;
  title: string;
  materialType: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  storagePath: string;
  currentVersionId: string;
  version: number;
  uploadedAt?: string;
}

export interface ManualApplicationMaterialPayload {
  key?: string;
  title: string;
  note?: string;
  category?: string;
  group?: string;
  requirementLevel?: ApplicationMaterialRequirementLevel;
  source?: ApplicationMaterialSource;
  reason?: string;
  uploadTips?: string[];
  allowMultipleFiles?: boolean;
}

export function buildApplicationMaterialsFromDocs(applicationDocs?: Record<string, unknown> | null): ApplicationMaterialItem[] {
  const docs = pickDocumentList(applicationDocs);
  return docs.map((title, index) => ({
    key: inferMaterialKey(title, index),
    title,
    category: materialCategory(title),
    group: materialGroupForCategory(materialCategory(title)),
    groupLabel: materialGroupLabel(materialGroupForCategory(materialCategory(title))),
    requirementLevel: "required",
    requirementLevelLabel: requirementLevelLabel("required"),
    source: "school",
    sourceLabel: materialSourceLabel("school"),
    reason: "院校或专业页面列出的申请材料。",
    status: "draft",
    reviewStatus: "not-uploaded"
  }));
}

export function buildIntelligentApplicationMaterials(options: BuildIntelligentApplicationMaterialsOptions): ApplicationMaterialItem[] {
  const materials: ApplicationMaterialItem[] = [];
  if (hasProvidedDocumentList(options.applicationDocs)) {
    for (const material of buildApplicationMaterialsFromDocs(options.applicationDocs)) {
      addMaterial(materials, material);
    }
  }

  const level = normalizeDegreeLevel(options.profileSnapshot?.level || options.programLevel);
  for (const material of degreeRuleMaterials(level)) {
    addMaterial(materials, material);
  }

  const language = languageRuleMaterial(options.profileSnapshot);
  if (language) addMaterial(materials, language);

  if (needsScholarshipMaterial(options.profileSnapshot)) {
    addMaterial(materials, {
      key: "scholarship-supporting-docs",
      title: "奖学金申请支持材料",
      note: "如有奖学金申请需求，请准备获奖证明、活动经历、个人陈述补充或财务说明。",
      category: "scholarship",
      group: "service",
      groupLabel: materialGroupLabel("service"),
      requirementLevel: "conditional",
      requirementLevelLabel: requirementLevelLabel("conditional"),
      source: "scholarship",
      sourceLabel: materialSourceLabel("scholarship"),
      reason: "申请档案显示学生希望优先考虑奖学金机会。",
      triggers: ["studyPreferences.scholarshipNeeded", "serviceNeeds.needs.scholarship"],
      uploadTips: ["如暂无奖学金申请，可等待后台老师豁免或调整。"],
      status: "draft",
      reviewStatus: "not-uploaded"
    });
  }

  if (needsVisaPreparationMaterial(options.profileSnapshot)) {
    addMaterial(materials, {
      key: "visa-preparation-docs",
      title: "签证材料预备项",
      note: "Offer 后将用于签证办理，可提前准备护照、照片、资金证明和体检/保险等材料。",
      category: "visa",
      group: "service",
      groupLabel: materialGroupLabel("service"),
      requirementLevel: "recommended",
      requirementLevelLabel: requirementLevelLabel("recommended"),
      source: "visa",
      sourceLabel: materialSourceLabel("visa"),
      reason: "申请档案显示学生需要签证办理服务，提前生成准备项便于后续衔接。",
      triggers: ["serviceNeeds.needs.visa"],
      uploadTips: ["这是后续签证阶段预备项，当前申请阶段可先不上传。"],
      status: "draft",
      reviewStatus: "not-uploaded"
    });
  }

  return materials;
}

export function normalizeApplicationMaterials(
  metadata?: Record<string, unknown> | null,
  applicationDocs?: Record<string, unknown> | null
): ApplicationMaterialItem[] {
  const rawMaterials = Array.isArray(metadata?.materials) ? metadata.materials : [];
  const materials = rawMaterials
    .map((item, index) => normalizeMaterialItem(item, index))
    .filter((item): item is ApplicationMaterialItem => Boolean(item));
  return materials.length ? materials : buildApplicationMaterialsFromDocs(applicationDocs);
}

export function toPublicApplicationMaterials(materials: ApplicationMaterialItem[]) {
  return materials.map(({ storagePath, versions, ...item }) => ({
    ...item,
    versions: (versions || []).map(({ storagePath: versionPath, ...version }) => ({
      ...version,
      hasFile: Boolean(versionPath || version.fileName)
    })),
    hasFile: Boolean(storagePath || item.fileName)
  }));
}

export function upsertApplicationMaterial(
  metadata: Record<string, unknown> | null | undefined,
  applicationDocs: Record<string, unknown> | null | undefined,
  nextMaterial: ApplicationMaterialItem
) {
  const materials = normalizeApplicationMaterials(metadata, applicationDocs);
  const index = materials.findIndex((item) => item.key === nextMaterial.key);
  if (index >= 0) {
    materials[index] = nextMaterial;
  } else {
    materials.push(nextMaterial);
  }
  return {
    ...(metadata || {}),
    materials
  };
}

export function createManualApplicationMaterial(payload: ManualApplicationMaterialPayload, index = 0): ApplicationMaterialItem {
  const title = safeString(payload.title);
  return {
    key: safeString(payload.key) || `manual-${materialKey(title, index)}`,
    title: title || `补充材料 ${index + 1}`,
    note: safeString(payload.note) || undefined,
    category: safeString(payload.category) || materialCategory(title),
    group: safeString(payload.group) || materialGroupForCategory(safeString(payload.category) || materialCategory(title)),
    groupLabel: materialGroupLabel(safeString(payload.group) || materialGroupForCategory(safeString(payload.category) || materialCategory(title))),
    requirementLevel: normalizeRequirementLevel(payload.requirementLevel),
    requirementLevelLabel: requirementLevelLabel(normalizeRequirementLevel(payload.requirementLevel)),
    source: normalizeMaterialSource(payload.source || "staff"),
    sourceLabel: materialSourceLabel(normalizeMaterialSource(payload.source || "staff")),
    reason: safeString(payload.reason) || "后台工作人员根据个案情况新增材料要求。",
    triggers: ["admin.material-adjustment"],
    uploadTips: normalizeStringList(payload.uploadTips),
    allowMultipleFiles: Boolean(payload.allowMultipleFiles),
    status: "draft",
    reviewStatus: "not-uploaded"
  };
}

export function updateApplicationMaterialDefinition(material: ApplicationMaterialItem, payload: Partial<ManualApplicationMaterialPayload>): ApplicationMaterialItem {
  const requirementLevel = payload.requirementLevel ? normalizeRequirementLevel(payload.requirementLevel) : material.requirementLevel || "required";
  const source = payload.source ? normalizeMaterialSource(payload.source) : material.source || "staff";
  const category = payload.category === undefined ? material.category : safeString(payload.category) || material.category;
  const group = payload.group === undefined ? material.group || materialGroupForCategory(category || "") : safeString(payload.group) || materialGroupForCategory(category || "");
  return {
    ...material,
    title: safeString(payload.title) || material.title,
    note: payload.note === undefined ? material.note : safeString(payload.note) || undefined,
    category,
    group,
    groupLabel: materialGroupLabel(group),
    requirementLevel,
    requirementLevelLabel: requirementLevelLabel(requirementLevel),
    source,
    sourceLabel: materialSourceLabel(source),
    reason: payload.reason === undefined ? material.reason : safeString(payload.reason) || undefined,
    uploadTips: payload.uploadTips === undefined ? material.uploadTips : normalizeStringList(payload.uploadTips),
    allowMultipleFiles: payload.allowMultipleFiles === undefined ? material.allowMultipleFiles : Boolean(payload.allowMultipleFiles)
  };
}

export function waiveApplicationMaterial(
  material: ApplicationMaterialItem,
  actor: { id: number; displayName: string },
  waiverReason: string,
  waivedAt = new Date().toISOString()
): ApplicationMaterialItem {
  return {
    ...material,
    isWaived: true,
    waiverReason: safeString(waiverReason) || "后台工作人员已标记该材料当前不需要提交。",
    waivedAt,
    waivedByAdminId: actor.id,
    waivedByAdminName: actor.displayName,
    status: "done"
  };
}

export function reopenApplicationMaterial(material: ApplicationMaterialItem): ApplicationMaterialItem {
  return {
    ...material,
    isWaived: false,
    waiverReason: undefined,
    waivedAt: undefined,
    waivedByAdminId: undefined,
    waivedByAdminName: undefined,
    status: material.fileName ? "progress" : "draft",
    reviewStatus: material.fileName ? "pending-review" : "not-uploaded"
  };
}

export function linkApplicationMaterialFromLibrary(
  currentMaterial: ApplicationMaterialItem,
  libraryMaterial: MaterialLibraryLinkReference,
  linkedAt = new Date().toISOString()
): ApplicationMaterialItem {
  const versions = currentMaterial.versions || [];
  const nextVersion: ApplicationMaterialVersion = {
    id: `library-${libraryMaterial.id}-${libraryMaterial.currentVersionId}-${linkedAt.replace(/[^0-9a-z]/gi, "").slice(0, 18)}`,
    version: versions.length + 1,
    fileName: libraryMaterial.fileName,
    mimeType: libraryMaterial.mimeType,
    size: libraryMaterial.size,
    uploadedAt: linkedAt,
    storagePath: libraryMaterial.storagePath,
    reviewStatus: "pending-review",
    reviewNote: null,
    linkedFromLibrary: true,
    libraryMaterialId: libraryMaterial.id,
    libraryVersionId: libraryMaterial.currentVersionId,
    libraryVersion: libraryMaterial.version
  };
  return {
    ...currentMaterial,
    status: "progress",
    reviewStatus: "pending-review",
    fileName: nextVersion.fileName,
    mimeType: nextVersion.mimeType,
    size: nextVersion.size,
    uploadedAt: linkedAt,
    storagePath: nextVersion.storagePath,
    reviewNote: null,
    reviewedAt: undefined,
    reviewedByAdminId: undefined,
    reviewedByAdminName: undefined,
    linkedFromLibrary: true,
    libraryMaterialId: libraryMaterial.id,
    libraryVersionId: libraryMaterial.currentVersionId,
    libraryVersion: libraryMaterial.version,
    libraryTitle: libraryMaterial.title,
    currentVersionId: nextVersion.id,
    versions: [...versions, nextVersion]
  };
}

export function summarizeApplicationMaterials(materials: ApplicationMaterialItem[]): ApplicationMaterialSummary {
  const activeMaterials = materials.filter((item) => !item.isWaived);
  return {
    total: activeMaterials.length,
    uploaded: activeMaterials.filter((item) => Boolean(item.fileName)).length,
    approved: activeMaterials.filter((item) => item.reviewStatus === "approved").length,
    needRevision: activeMaterials.filter((item) => item.reviewStatus === "needs-revision" || item.reviewStatus === "rejected").length,
    pendingReview: activeMaterials.filter((item) => item.reviewStatus === "pending-review").length,
    waived: materials.filter((item) => item.isWaived).length
  };
}

export function aggregateApplicationMaterialStatus(materials: ApplicationMaterialItem[]): ApplicationMaterialStatus {
  const activeMaterials = materials.filter((item) => !item.isWaived);
  if (!activeMaterials.length) return materials.length ? "done" : "draft";
  if (activeMaterials.every((item) => item.reviewStatus === "approved" || item.status === "done")) return "done";
  if (activeMaterials.some((item) => item.reviewStatus === "needs-revision" || item.reviewStatus === "rejected")) return "wait";
  if (activeMaterials.some((item) => item.fileName || item.reviewStatus === "pending-review" || item.status === "progress")) return "progress";
  return "draft";
}

function normalizeMaterialItem(raw: unknown, index: number): ApplicationMaterialItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const title = safeString(item.title) || safeString(item.name) || `材料 ${index + 1}`;
  const key = safeString(item.key) || materialKey(title, index);
  const fileName = safeString(item.fileName) || safeString(item.originalName) || undefined;
  const versions = normalizeMaterialVersions(item.versions, {
    key,
    fileName,
    mimeType: safeString(item.mimeType) || undefined,
    size: typeof item.size === "number" ? item.size : undefined,
    uploadedAt: safeString(item.uploadedAt) || undefined,
    storagePath: safeString(item.storagePath) || undefined,
    reviewStatus: normalizeReviewStatus(item.reviewStatus),
    reviewNote: item.reviewNote === null ? null : safeString(item.reviewNote) || undefined,
    reviewedAt: safeString(item.reviewedAt) || undefined,
    reviewedByAdminId: typeof item.reviewedByAdminId === "number" ? item.reviewedByAdminId : undefined,
    reviewedByAdminName: safeString(item.reviewedByAdminName) || undefined
  });
  const currentVersion = versions.find((version) => version.id === safeString(item.currentVersionId)) || versions[versions.length - 1];
  return {
    key,
    title,
    note: safeString(item.note) || undefined,
    category: safeString(item.category) || materialCategory(title),
    group: safeString(item.group) || materialGroupForCategory(safeString(item.category) || materialCategory(title)),
    groupLabel: safeString(item.groupLabel) || materialGroupLabel(safeString(item.group) || materialGroupForCategory(safeString(item.category) || materialCategory(title))),
    requirementLevel: normalizeRequirementLevel(item.requirementLevel),
    requirementLevelLabel: safeString(item.requirementLevelLabel) || requirementLevelLabel(normalizeRequirementLevel(item.requirementLevel)),
    source: normalizeMaterialSource(item.source),
    sourceLabel: safeString(item.sourceLabel) || materialSourceLabel(normalizeMaterialSource(item.source)),
    reason: safeString(item.reason) || undefined,
    triggers: Array.isArray(item.triggers) ? item.triggers.map((trigger) => safeString(trigger)).filter(Boolean) : undefined,
    uploadTips: normalizeStringList(item.uploadTips),
    allowMultipleFiles: Boolean(item.allowMultipleFiles),
    status: normalizeMaterialStatus(item.status),
    reviewStatus: currentVersion?.reviewStatus || normalizeReviewStatus(item.reviewStatus),
    fileName: currentVersion?.fileName || fileName,
    mimeType: currentVersion?.mimeType || safeString(item.mimeType) || undefined,
    size: currentVersion?.size || (typeof item.size === "number" ? item.size : undefined),
    uploadedAt: currentVersion?.uploadedAt || safeString(item.uploadedAt) || undefined,
    storagePath: currentVersion?.storagePath || safeString(item.storagePath) || undefined,
    reviewNote: currentVersion ? currentVersion.reviewNote : item.reviewNote === null ? null : safeString(item.reviewNote) || undefined,
    reviewedAt: currentVersion?.reviewedAt || safeString(item.reviewedAt) || undefined,
    reviewedByAdminId: currentVersion?.reviewedByAdminId || (typeof item.reviewedByAdminId === "number" ? item.reviewedByAdminId : undefined),
    reviewedByAdminName: currentVersion?.reviewedByAdminName || safeString(item.reviewedByAdminName) || undefined,
    isWaived: Boolean(item.isWaived),
    waiverReason: safeString(item.waiverReason) || undefined,
    waivedAt: safeString(item.waivedAt) || undefined,
    waivedByAdminId: toNumberOrUndefined(item.waivedByAdminId),
    waivedByAdminName: safeString(item.waivedByAdminName) || undefined,
    linkedFromLibrary: Boolean(currentVersion?.linkedFromLibrary || item.linkedFromLibrary),
    libraryMaterialId: currentVersion?.libraryMaterialId || toNumberOrUndefined(item.libraryMaterialId),
    libraryVersionId: currentVersion?.libraryVersionId || safeString(item.libraryVersionId) || undefined,
    libraryVersion: currentVersion?.libraryVersion || toNumberOrUndefined(item.libraryVersion),
    libraryTitle: safeString(item.libraryTitle) || undefined,
    currentVersionId: currentVersion?.id || safeString(item.currentVersionId) || undefined,
    versions
  };
}

function normalizeMaterialVersions(rawVersions: unknown, fallback: Partial<ApplicationMaterialVersion> & { key: string }): ApplicationMaterialVersion[] {
  const versions = Array.isArray(rawVersions)
    ? rawVersions
        .map((raw, index) => normalizeMaterialVersion(raw, index))
        .filter((item): item is ApplicationMaterialVersion => Boolean(item))
    : [];

  if (!versions.length && fallback.fileName && fallback.storagePath && fallback.uploadedAt) {
    return [
      {
        id: `legacy-${fallback.key}-1`,
        version: 1,
        fileName: fallback.fileName,
        mimeType: fallback.mimeType,
        size: fallback.size,
        uploadedAt: fallback.uploadedAt,
        storagePath: fallback.storagePath,
        reviewStatus: fallback.reviewStatus || "pending-review",
        reviewNote: fallback.reviewNote,
        reviewedAt: fallback.reviewedAt,
        reviewedByAdminId: fallback.reviewedByAdminId,
        reviewedByAdminName: fallback.reviewedByAdminName
      }
    ];
  }

  return versions.map((version, index) => ({ ...version, version: version.version || index + 1 }));
}

function normalizeMaterialVersion(raw: unknown, index: number): ApplicationMaterialVersion | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const fileName = safeString(item.fileName) || safeString(item.originalName);
  const uploadedAt = safeString(item.uploadedAt);
  if (!fileName || !uploadedAt) return null;
  return {
    id: safeString(item.id) || `version-${index + 1}`,
    version: typeof item.version === "number" ? item.version : index + 1,
    fileName,
    mimeType: safeString(item.mimeType) || undefined,
    size: typeof item.size === "number" ? item.size : undefined,
    uploadedAt,
    storagePath: safeString(item.storagePath) || undefined,
    reviewStatus: normalizeReviewStatus(item.reviewStatus),
    reviewNote: item.reviewNote === null ? null : safeString(item.reviewNote) || undefined,
    reviewedAt: safeString(item.reviewedAt) || undefined,
    reviewedByAdminId: typeof item.reviewedByAdminId === "number" ? item.reviewedByAdminId : undefined,
    reviewedByAdminName: safeString(item.reviewedByAdminName) || undefined,
    linkedFromLibrary: Boolean(item.linkedFromLibrary),
    libraryMaterialId: toNumberOrUndefined(item.libraryMaterialId),
    libraryVersionId: safeString(item.libraryVersionId) || undefined,
    libraryVersion: toNumberOrUndefined(item.libraryVersion)
  };
}

function pickDocumentList(applicationDocs?: Record<string, unknown> | null) {
  const candidates = ["zh-CN", "en", "zh-TW", "ms"];
  for (const key of candidates) {
    const value = applicationDocs?.[key];
    if (Array.isArray(value)) {
      const list = value.map((item) => safeString(item)).filter(Boolean);
      if (list.length) return list;
    }
  }
  return ["护照首页", "最高学历毕业证或在读证明", "完整成绩单", "语言成绩或英语能力证明", "个人陈述或学习计划", "推荐信"];
}

function hasProvidedDocumentList(applicationDocs?: Record<string, unknown> | null) {
  const candidates = ["zh-CN", "en", "zh-TW", "ms"];
  return candidates.some((key) => Array.isArray(applicationDocs?.[key]) && (applicationDocs?.[key] as unknown[]).some((item) => safeString(item)));
}

function degreeRuleMaterials(level: string): ApplicationMaterialItem[] {
  if (level === "bachelor") {
    return [
      requiredRuleMaterial({
        key: "high-school-notarized-docs",
        title: "高中毕业证与成绩单公证书",
        category: "high-school-notarized-docs",
        reason: "高中毕业申请本科需要提交高中毕业证与成绩单公证材料。",
        note: "请合并上传高中毕业证公证书、成绩单公证书；高中毕业证需同步准备电子注册备案表或前学信网验证报告。",
        uploadTips: ["建议整理成一个 PDF 文件上传。", "高中毕业证需包含电子注册备案表或前学信网验证报告。"],
        allowMultipleFiles: true
      }),
      fullPassportScanMaterial("本科申请需要确认学生护照信息。"),
      idPhotoMaterial("本科申请需要白底证件照用于院校申请表和后续材料。")
    ];
  }
  if (level === "phd") {
    return [
      requiredRuleMaterial({
        key: "bachelor-master-notarized-docs",
        title: "本科及硕士毕业证与成绩单公证书",
        category: "bachelor-master-notarized-docs",
        reason: "硕士毕业申请博士需要提交本科和硕士阶段学历、成绩公证材料。",
        note: "请上传本科毕业证、本科成绩单、硕士毕业证、硕士成绩单对应公证书；本科和硕士毕业证需准备电子注册备案表或前学信网验证报告。",
        uploadTips: ["建议按本科、硕士两个阶段整理成清晰 PDF。", "毕业证需包含电子注册备案表或前学信网验证报告。"],
        allowMultipleFiles: true
      }),
      fullPassportScanMaterial("博士申请需要确认学生护照信息。"),
      idPhotoMaterial("博士申请需要白底证件照用于院校申请表和后续材料。"),
      requiredRuleMaterial({
        key: "cv-work-proof",
        title: "个人简历与工作证明（如有）",
        category: "cv-work-proof",
        reason: "博士申请需要展示教育、科研、工作经历；有工作经历时需补充工作证明。",
        note: "请上传英文简历；如有工作经历，请一并上传工作证明。",
        uploadTips: ["简历建议使用英文版。", "工作证明如有，请加盖单位章或提供正式证明文件。"],
        allowMultipleFiles: true
      }),
      requiredRuleMaterial({
        key: "research-proposal",
        title: "开题报告 / 研究计划",
        category: "research-proposal",
        reason: "博士申请需要说明研究方向、研究问题、研究方法和预期成果。",
        note: "请上传研究计划或开题报告。",
        uploadTips: ["建议包含研究题目、背景、方法、时间计划和参考文献。"]
      }),
      requiredRuleMaterial({
        key: "recommendation-letter",
        title: "两封推荐信",
        category: "recommendation",
        reason: "博士申请通常需要硕士导师或工作单位领导推荐。",
        note: "请上传两封推荐信，推荐人优先选择硕士导师或工作单位领导。",
        uploadTips: ["两封推荐信可合并为一个 PDF，也可分别上传后合并。", "推荐信建议包含推荐人职务、联系方式和签名。"],
        allowMultipleFiles: true
      })
    ];
  }
  return [
    requiredRuleMaterial({
      key: "bachelor-notarized-docs",
      title: "本科毕业证与成绩单公证书",
      category: "bachelor-notarized-docs",
      reason: "本科毕业申请硕士需要提交本科毕业证与成绩单公证材料。",
      note: "请上传本科毕业证公证书、成绩单公证书；本科毕业证需同步准备电子注册备案表或前学信网验证报告。",
      uploadTips: ["建议整理成一个 PDF 文件上传。", "本科毕业证需包含电子注册备案表或前学信网验证报告。"],
      allowMultipleFiles: true
    }),
    conditionalRuleMaterial({
      key: "college-upgrade-notarized-docs",
      title: "专升本大专毕业证与成绩单公证书",
      category: "college-upgrade-notarized-docs",
      reason: "专升本学生除本科材料外，还需要补充大专毕业证与成绩单公证材料。",
      note: "如学生为专升本背景，请上传大专毕业证公证书、成绩单公证书和大专毕业证电子注册备案表。",
      uploadTips: ["非专升本学生可等待后台豁免。", "大专毕业证需包含电子注册备案表。"],
      allowMultipleFiles: true
    }),
    conditionalRuleMaterial({
      key: "overseas-credential-verification",
      title: "海外学历中留服验证报告及公证书",
      category: "overseas-credential-verification",
      reason: "海外文凭背景通常需要提供中留服验证报告和公证材料。",
      note: "如最高学历为海外文凭，请上传中留服验证报告及对应公证书。",
      uploadTips: ["国内学历学生可等待后台豁免。", "请确保验证报告姓名、院校和学历层次与申请档案一致。"],
      allowMultipleFiles: true
    }),
    fullPassportScanMaterial("硕士申请需要确认学生护照信息。"),
    idPhotoMaterial("硕士申请需要白底证件照用于院校申请表和后续材料。"),
    conditionalRuleMaterial({
      key: "cv-work-proof",
      title: "个人简历与工作证明（25岁以上或如有）",
      category: "cv-work-proof",
      reason: "25岁以上或有工作经历的硕士申请学生通常需要补充个人简历和工作证明。",
      note: "25岁以上学生请上传个人简历；如有工作经历，请一并上传工作证明。",
      uploadTips: ["简历建议使用英文版。", "工作证明如有，请加盖单位章或提供正式证明文件。"],
      allowMultipleFiles: true
    })
  ];
}

function requiredRuleMaterial(payload: {
  key: string;
  title: string;
  category: string;
  reason: string;
  note?: string;
  uploadTips?: string[];
  allowMultipleFiles?: boolean;
}): ApplicationMaterialItem {
  const group = materialGroupForCategory(payload.category);
  return {
    key: payload.key,
    title: payload.title,
    note: payload.note,
    category: payload.category,
    group,
    groupLabel: materialGroupLabel(group),
    requirementLevel: "required",
    requirementLevelLabel: requirementLevelLabel("required"),
    source: "degree",
    sourceLabel: materialSourceLabel("degree"),
    reason: payload.reason,
    triggers: ["profile.level"],
    uploadTips: payload.uploadTips || [],
    allowMultipleFiles: Boolean(payload.allowMultipleFiles),
    status: "draft",
    reviewStatus: "not-uploaded"
  };
}

function conditionalRuleMaterial(payload: Parameters<typeof requiredRuleMaterial>[0]): ApplicationMaterialItem {
  return {
    ...requiredRuleMaterial(payload),
    requirementLevel: "conditional",
    requirementLevelLabel: requirementLevelLabel("conditional")
  };
}

function fullPassportScanMaterial(reason: string): ApplicationMaterialItem {
  return requiredRuleMaterial({
    key: "passport-full-scan",
    title: "整本护照扫描件",
    category: "passport-full-scan",
    reason,
    note: "请上传整本护照扫描件，全本包括封面、个人信息页、签证页、空白页。",
    uploadTips: ["建议将整本护照扫描页合并为一个 PDF 后上传。", "护照有效期需至少 18 个月以上。", "请包含封面和所有空白页，不只上传首页。"],
    allowMultipleFiles: true
  });
}

function idPhotoMaterial(reason: string): ApplicationMaterialItem {
  return requiredRuleMaterial({
    key: "id-photo-white-background",
    title: "白底证件照片",
    category: "id-photo-white-background",
    reason,
    note: "请上传白底证件照。",
    uploadTips: ["不能戴眼镜，需要露出额头和耳朵。", "不能露牙齿，建议穿深色衣服。"]
  });
}

function languageRuleMaterial(snapshot?: ApplicationProfileSnapshot | null): ApplicationMaterialItem | null {
  const language = snapshot?.languageProfile || {};
  const hasScore = hasText(language.overallScore) || Number(snapshot?.ielts || 0) > 0;
  const hasPlan = hasText(language.plannedTestDate) || hasText(language.testDate);
  const title = hasScore ? "英文成绩证明（雅思/托福/领思等）" : "英文成绩或考试计划说明";
  return {
    key: hasScore ? "language-score-proof" : "language-follow-up-plan",
    title,
    note: hasScore ? "学生若已有雅思、托福、领思等英文成绩，请一并上传。" : "如暂未取得英文成绩，请上传预计考试时间、报名记录或语言班接受意向说明。",
    category: "language-score",
    group: "language",
    groupLabel: materialGroupLabel("language"),
    requirementLevel: "conditional",
    requirementLevelLabel: requirementLevelLabel("conditional"),
    source: "language",
    sourceLabel: materialSourceLabel("language"),
    reason: hasScore ? "申请档案显示学生已有英文成绩，需要随申请材料一起提供。" : hasPlan ? "申请档案显示学生已有语言考试计划，需要补充考试计划说明。" : "学生若有英文成绩需一起提供；暂无成绩时可先补充考试计划。",
    triggers: ["profile.ielts", "profile.languageProfile"],
    uploadTips: ["支持 IELTS、TOEFL、Linguaskill/领思、PTE、MUET 等成绩证明。"],
    status: "draft",
    reviewStatus: "not-uploaded"
  };
}

function addMaterial(materials: ApplicationMaterialItem[], material: ApplicationMaterialItem) {
  const duplicateIndex = materials.findIndex(
    (item) => item.key === material.key || (canMergeByCategory(item, material) && materialCategory(item.title) === materialCategory(material.title))
  );
  if (duplicateIndex < 0) {
    materials.push(material);
    return;
  }
  const existing = materials[duplicateIndex];
  const nextUploadTips = Array.from(new Set([...(existing.uploadTips || []), ...(material.uploadTips || [])]));
  const nextGroup = existing.group || material.group || materialGroupForCategory(existing.category || material.category || "");
  materials[duplicateIndex] = {
    ...existing,
    title: shouldPreferRuleTitle(existing, material) ? material.title : existing.title,
    note: existing.note || material.note,
    category: existing.category || material.category,
    group: nextGroup,
    groupLabel: existing.groupLabel || material.groupLabel || materialGroupLabel(nextGroup),
    requirementLevel: strongerRequirementLevel(existing.requirementLevel, material.requirementLevel),
    requirementLevelLabel: requirementLevelLabel(strongerRequirementLevel(existing.requirementLevel, material.requirementLevel)),
    source: existing.source === "school" ? existing.source : material.source || existing.source,
    sourceLabel: existing.source === "school" ? existing.sourceLabel : material.sourceLabel || existing.sourceLabel,
    reason: [existing.reason, material.reason].filter(Boolean).join("；"),
    triggers: Array.from(new Set([...(existing.triggers || []), ...(material.triggers || [])])),
    uploadTips: nextUploadTips,
    allowMultipleFiles: Boolean(existing.allowMultipleFiles || material.allowMultipleFiles)
  };
}

function canMergeByCategory(current: ApplicationMaterialItem, next: ApplicationMaterialItem) {
  return current.key !== "language-follow-up-plan" && next.key !== "language-follow-up-plan" && current.category === next.category;
}

function shouldPreferRuleTitle(current: ApplicationMaterialItem, next: ApplicationMaterialItem) {
  return current.source === "school" && next.source === "degree" && Boolean(next.uploadTips?.length);
}

function strongerRequirementLevel(current?: ApplicationMaterialRequirementLevel, next?: ApplicationMaterialRequirementLevel): ApplicationMaterialRequirementLevel {
  const weights: Record<ApplicationMaterialRequirementLevel, number> = { required: 3, conditional: 2, recommended: 1 };
  return (weights[next || "required"] > weights[current || "recommended"] ? next : current) || "required";
}

function needsScholarshipMaterial(snapshot?: ApplicationProfileSnapshot | null) {
  const preferences = snapshot?.studyPreferences || {};
  const needs = profileNeeds(snapshot);
  return preferences.scholarshipNeeded === true || needs.some((item) => item.includes("scholarship") || item.includes("奖学金"));
}

function needsVisaPreparationMaterial(snapshot?: ApplicationProfileSnapshot | null) {
  return profileNeeds(snapshot).some((item) => item === "visa" || item.includes("签证"));
}

function profileNeeds(snapshot?: ApplicationProfileSnapshot | null) {
  const needs = snapshot?.serviceNeeds?.needs;
  return Array.isArray(needs) ? needs.map((item) => String(item).toLowerCase()) : [];
}

function normalizeDegreeLevel(value: unknown) {
  const level = safeString(value).toLowerCase();
  if (level === "bachelor" || level === "undergraduate") return "bachelor";
  if (level === "phd" || level === "doctoral" || level === "doctor") return "phd";
  return "master";
}

function materialCategory(title: string) {
  const value = title.toLowerCase();
  if (/护照|passport/.test(value)) return "passport-full-scan";
  if (/白底|证件照|照片|photo/.test(value)) return "id-photo-white-background";
  if (/高中/.test(value) && /毕业|成绩|公证|transcript|certificate/.test(value)) return "high-school-notarized-docs";
  if (/专升本|大专|college|diploma/.test(value)) return "college-upgrade-notarized-docs";
  if (/海外|中留服|credential|留服/.test(value)) return "overseas-credential-verification";
  if (/本科.*硕士|硕士.*本科/.test(value) && /毕业|成绩|公证|transcript|certificate/.test(value)) return "bachelor-master-notarized-docs";
  if (/本科|bachelor|undergraduate/.test(value) && /毕业|成绩|公证|transcript|certificate/.test(value)) return "bachelor-notarized-docs";
  if (/语言|雅思|托福|领思|ielts|toefl|pte|muet|linguaskill|english/.test(value)) return "language-score";
  if (/成绩单|transcript/.test(value)) return "transcript";
  if (/毕业证|在读证明|completion|graduation/.test(value)) return "graduation";
  if (/学位证|degree/.test(value)) return "degree";
  if (/推荐信|recommend/.test(value)) return "recommendation";
  if (/个人陈述|ps|statement/.test(value)) return "statement";
  if (/工作证明|简历|cv|resume/.test(value)) return "cv-work-proof";
  if (/开题|研究计划|proposal/.test(value)) return "research-proposal";
  if (/导师|supervisor/.test(value)) return "supervisor";
  if (/论文|科研|publication|research/.test(value)) return "research-evidence";
  if (/奖学金|scholarship/.test(value)) return "scholarship";
  if (/签证|visa/.test(value)) return "visa";
  return materialKey(title, 0);
}

function materialGroupForCategory(category: string) {
  if (/passport|photo|identity/.test(category)) return "identity";
  if (/notarized|credential|transcript|graduation|degree/.test(category)) return "academic";
  if (/cv|work|recommendation|proposal|statement|supervisor|research/.test(category)) return "documents";
  if (/language/.test(category)) return "language";
  if (/scholarship|visa/.test(category)) return "service";
  return "additional";
}

function materialGroupLabel(group: string) {
  const labels: Record<string, string> = {
    identity: "身份与照片",
    academic: "学历与成绩公证",
    documents: "文书与经历",
    language: "英文成绩",
    service: "服务补充",
    additional: "其他材料"
  };
  return labels[group] || labels.additional;
}

function inferMaterialKey(title: string, index: number) {
  const category = materialCategory(title);
  return category && category !== materialKey(title, 0) ? category : materialKey(title, index);
}

function requirementLevelLabel(value: ApplicationMaterialRequirementLevel) {
  const labels: Record<ApplicationMaterialRequirementLevel, string> = {
    required: "必交",
    recommended: "建议",
    conditional: "条件触发"
  };
  return labels[value];
}

function materialSourceLabel(value: ApplicationMaterialSource) {
  const labels: Record<ApplicationMaterialSource, string> = {
    school: "院校要求",
    degree: "学历规则",
    language: "语言条件",
    scholarship: "奖学金需求",
    visa: "签证服务需求",
    profile: "申请档案",
    staff: "后台调整"
  };
  return labels[value];
}

function normalizeMaterialStatus(value: unknown): ApplicationMaterialStatus {
  if (value === "wait" || value === "progress" || value === "done") return value;
  return "draft";
}

function normalizeRequirementLevel(value: unknown): ApplicationMaterialRequirementLevel {
  if (value === "recommended" || value === "conditional") return value;
  return "required";
}

function normalizeMaterialSource(value: unknown): ApplicationMaterialSource {
  if (value === "degree" || value === "language" || value === "scholarship" || value === "visa" || value === "profile" || value === "staff") return value;
  return "school";
}

function normalizeReviewStatus(value: unknown): ApplicationMaterialReviewStatus {
  if (value === "pending-review" || value === "approved" || value === "needs-revision" || value === "rejected") return value;
  return "not-uploaded";
}

function materialKey(title: string, index: number) {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return normalized || `material-${index + 1}`;
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeString(item)).filter(Boolean);
}

function hasText(value: unknown) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function toNumberOrUndefined(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
