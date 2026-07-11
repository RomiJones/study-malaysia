import {
  FEE_AUDIT_STATUS_LABELS,
  OFFICIAL_SOURCE_STATUS_LABELS,
  PUBLIC_DISPLAY_STATUS_LABELS,
  type FeeAuditStatus,
  type LanguageRequirement,
  type LocalizedStringArray,
  type LocalizedText,
  type OfficialSourceStatus,
  type PublicDisplayStatus,
  type TuitionCurrency
} from "@studymy/shared";
import type { ApplicationMaterialItem } from "./application-materials.js";
import { resolveProgramFee } from "./fee-strategy.helper.js";
import { normalizePublicDisplayStatus } from "./mappers.js";
import type { ProgramEntity, UniversityEntity } from "../db/entities.js";

export type CatalogSnapshotRiskLevel = "low" | "medium" | "high";
export type CatalogSnapshotDifferenceCategory = "university" | "program" | "fee" | "language" | "materials" | "publication" | "source";

export interface ApplicationCatalogSnapshot {
  version: 1;
  snapshotAt: string;
  university: CatalogUniversitySnapshot | null;
  program: CatalogProgramSnapshot | null;
  caseMaterials: CatalogCaseMaterialSnapshot[];
}

export interface CatalogUniversitySnapshot {
  id: number;
  code: string;
  slug: string;
  name: string;
  shortName: string;
  publicDisplayStatus: PublicDisplayStatus;
  publicDisplayStatusLabel: string;
  officialSourceStatus: OfficialSourceStatus;
  officialSourceStatusLabel: string;
  officialVerifiedAt: string | null;
  isPublished: boolean;
  officialWebsite: string;
}

export interface CatalogProgramSnapshot {
  id: number;
  universityId: number;
  code: string;
  slug: string;
  name: string;
  level: string;
  category: string;
  faculty: string;
  publicDisplayStatus: PublicDisplayStatus;
  publicDisplayStatusLabel: string;
  officialSourceStatus: OfficialSourceStatus;
  officialSourceStatusLabel: string;
  officialVerifiedAt: string | null;
  isPublished: boolean;
  publicDisplayNote: string;
  reviewReason: string;
  officialSourceUrl: string;
  officialEntryRequirementSourceUrl: string;
  officialAccreditationSourceUrl: string;
  fee: CatalogFeeSnapshot;
  language: CatalogLanguageSnapshot;
  applicationDocs: string[];
}

export interface CatalogFeeSnapshot {
  displayText: string;
  filterableTuitionCny: number | null;
  hasVerifiedFee: boolean;
  feeConfidence: "verified" | "display-only" | "unavailable";
  tuitionAmount: number | null;
  tuitionCurrency: TuitionCurrency | string;
  officialTuitionMYR: number | null;
  annualTuitionCny: number | null;
  auditStatus: FeeAuditStatus;
  auditStatusLabel: string;
  auditedAt: string | null;
  sourceUrl: string;
  secondarySourceUrl: string;
  note: string;
  listTuitionText: string;
}

export interface CatalogLanguageSnapshot {
  requirement: LanguageRequirement | null;
  summary: string;
  officialText: string;
  requirementNote: string;
}

export interface CatalogCaseMaterialSnapshot {
  key: string;
  title: string;
  requirementLevel: string;
  source: string;
  sourceLabel: string;
  reason: string;
  note: string;
}

export interface CatalogSnapshotDifference {
  key: string;
  category: CatalogSnapshotDifferenceCategory;
  label: string;
  submittedValue: string;
  currentValue: string;
  riskLevel: CatalogSnapshotRiskLevel;
  affectedArea: string;
  advice: string;
}

export interface ApplicationCatalogSnapshotComparison {
  hasSnapshot: boolean;
  snapshotAt: string | null;
  submitted: ApplicationCatalogSnapshot | null;
  current: ApplicationCatalogSnapshot | null;
  differences: CatalogSnapshotDifference[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    highestRisk: CatalogSnapshotRiskLevel | null;
    hasHighRisk: boolean;
    missingSnapshot: boolean;
    feeChanges: number;
    languageChanges: number;
    materialChanges: number;
    publicationChanges: number;
    sourceChanges: number;
    recommendation: string;
  };
}

interface BuildApplicationCatalogSnapshotOptions {
  university?: UniversityEntity | null;
  program?: ProgramEntity | null;
  caseMaterials?: ApplicationMaterialItem[];
  snapshotAt?: string;
}

const sourceRiskStatuses = new Set<string>(["missing-source", "source-conflict"]);
const reviewSourceStatuses = new Set<string>(["needs-review"]);
const blockingPublicStatuses = new Set<string>(["hidden-unverified", "archived", "not-available-for-international"]);
const reviewPublicStatuses = new Set<string>(["needs-review", "current-cycle-not-open", "official-language-requirement-not-published"]);
const reviewFeeStatuses = new Set<string>(["pending-review", "conflict", "source-conflict", "not-published"]);

export function buildApplicationCatalogSnapshot(options: BuildApplicationCatalogSnapshotOptions): ApplicationCatalogSnapshot {
  return {
    version: 1,
    snapshotAt: options.snapshotAt || new Date().toISOString(),
    university: options.university ? buildUniversitySnapshot(options.university) : null,
    program: options.program ? buildProgramSnapshot(options.program) : null,
    caseMaterials: (options.caseMaterials || []).map((item) => ({
      key: item.key,
      title: item.title,
      requirementLevel: item.requirementLevel || "",
      source: item.source || "",
      sourceLabel: item.sourceLabel || "",
      reason: item.reason || "",
      note: item.note || ""
    }))
  };
}

export function getApplicationCatalogSnapshot(metadata?: Record<string, unknown> | null): ApplicationCatalogSnapshot | null {
  const candidate = metadata?.applicationCatalogSnapshot || metadata?.catalogSnapshot;
  if (!isRecord(candidate) || candidate.version !== 1) return null;
  return candidate as unknown as ApplicationCatalogSnapshot;
}

export function compareApplicationCatalogSnapshot(
  submitted: ApplicationCatalogSnapshot | null,
  current: ApplicationCatalogSnapshot | null
): ApplicationCatalogSnapshotComparison {
  if (!submitted) {
    return {
      hasSnapshot: false,
      snapshotAt: null,
      submitted: null,
      current,
      differences: [],
      summary: buildDifferenceSummary([], true)
    };
  }

  const differences: CatalogSnapshotDifference[] = [];
  compareUniversity(submitted.university, current?.university || null, differences);
  compareProgram(submitted.program, current?.program || null, differences);

  return {
    hasSnapshot: true,
    snapshotAt: submitted.snapshotAt,
    submitted,
    current,
    differences,
    summary: buildDifferenceSummary(differences, false)
  };
}

function buildUniversitySnapshot(university: UniversityEntity): CatalogUniversitySnapshot {
  const publicDisplayStatus = normalizePublicDisplayStatus(university.publicDisplayStatus, university.isPublished);
  const officialSourceStatus = university.officialSourceStatus || "needs-review";
  return {
    id: university.id,
    code: university.code || "",
    slug: university.slug || "",
    name: localizeText(university.name),
    shortName: university.shortName || "",
    publicDisplayStatus,
    publicDisplayStatusLabel: publicDisplayStatusLabel(publicDisplayStatus),
    officialSourceStatus,
    officialSourceStatusLabel: officialSourceStatusLabel(officialSourceStatus),
    officialVerifiedAt: university.officialVerifiedAt || null,
    isPublished: Boolean(university.isPublished),
    officialWebsite: university.officialWebsite || university.website || ""
  };
}

function buildProgramSnapshot(program: ProgramEntity): CatalogProgramSnapshot {
  const publicDisplayStatus = normalizePublicDisplayStatus(program.publicDisplayStatus, program.isPublished);
  const officialSourceStatus = program.officialSourceStatus || "needs-review";
  return {
    id: program.id,
    universityId: program.universityId,
    code: program.code || "",
    slug: program.slug || "",
    name: localizeText(program.name),
    level: program.level || "",
    category: program.category || "",
    faculty: localizeText(program.faculty),
    publicDisplayStatus,
    publicDisplayStatusLabel: publicDisplayStatusLabel(publicDisplayStatus),
    officialSourceStatus,
    officialSourceStatusLabel: officialSourceStatusLabel(officialSourceStatus),
    officialVerifiedAt: program.officialVerifiedAt || null,
    isPublished: Boolean(program.isPublished),
    publicDisplayNote: program.publicDisplayNote || "",
    reviewReason: program.reviewReason || "",
    officialSourceUrl: program.officialSourceUrl || "",
    officialEntryRequirementSourceUrl: program.officialEntryRequirementSourceUrl || "",
    officialAccreditationSourceUrl: program.officialAccreditationSourceUrl || "",
    fee: buildFeeSnapshot(program),
    language: buildLanguageSnapshot(program),
    applicationDocs: localizeArray(program.applicationDocs)
  };
}

function buildFeeSnapshot(program: ProgramEntity): CatalogFeeSnapshot {
  const feeResolution = resolveProgramFee(program);
  const auditStatus = program.officialFeeAuditStatus || "pending-review";
  return {
    displayText: feeResolution.displayText,
    filterableTuitionCny: feeResolution.filterableTuitionCny,
    hasVerifiedFee: feeResolution.hasVerifiedFee,
    feeConfidence: feeResolution.confidence,
    tuitionAmount: nullableNumber(program.tuitionAmount),
    tuitionCurrency: program.tuitionCurrency || "UNKNOWN",
    officialTuitionMYR: nullableNumber(program.officialTuitionMYR),
    annualTuitionCny: nullableNumber(program.annualTuitionCny),
    auditStatus,
    auditStatusLabel: feeAuditStatusLabel(auditStatus),
    auditedAt: program.officialFeeAuditedAt || null,
    sourceUrl: program.officialFeeSourceUrl || "",
    secondarySourceUrl: program.secondaryOfficialFeeSourceUrl || "",
    note: program.officialTuitionNote || "",
    listTuitionText: program.listTuitionText || program.tuitionDisplay || feeResolution.displayText
  };
}

function buildLanguageSnapshot(program: ProgramEntity): CatalogLanguageSnapshot {
  const requirement = cloneJson(program.languageRequirement || null) as LanguageRequirement | null;
  return {
    requirement,
    summary: languageRequirementText(requirement),
    officialText: program.officialLanguageRequirement || "",
    requirementNote: localizeText(program.requirement?.note)
  };
}

function compareUniversity(
  submitted: CatalogUniversitySnapshot | null,
  current: CatalogUniversitySnapshot | null,
  differences: CatalogSnapshotDifference[]
) {
  if (!submitted || !current) {
    addDifference(differences, {
      key: "university.availability",
      category: "publication",
      label: "学校目录可用性",
      submittedValue: submitted ? "申请时存在学校目录" : "申请时学校目录缺失",
      currentValue: current ? "当前存在学校目录" : "当前学校目录缺失",
      riskLevel: "high",
      affectedArea: "案件学校判断、院校详情、推荐",
      advice: "先按申请时快照判断案件，当前学校目录缺失时需人工复核后再对学生承诺。"
    });
    return;
  }

  compareTextField(differences, {
    key: "university.name",
    category: "university",
    label: "学校名称",
    submittedValue: submitted.name,
    currentValue: current.name,
    riskLevel: "low",
    affectedArea: "案件标题、院校详情、对比",
    advice: "名称变化通常不影响历史判断，可在跟进记录中备注。"
  });
  comparePublication(differences, "university", "学校公开状态", submitted, current);
  compareSource(differences, "university", "学校来源状态", submitted, current);
}

function compareProgram(
  submitted: CatalogProgramSnapshot | null,
  current: CatalogProgramSnapshot | null,
  differences: CatalogSnapshotDifference[]
) {
  if (!submitted || !current) {
    addDifference(differences, {
      key: "program.availability",
      category: "publication",
      label: "专业目录可用性",
      submittedValue: submitted ? "申请时存在专业目录" : "申请时专业目录缺失",
      currentValue: current ? "当前存在专业目录" : "当前专业目录缺失",
      riskLevel: "high",
      affectedArea: "案件专业判断、专业详情、材料要求、推荐",
      advice: "不要用当前缺失目录反推历史案件，需按申请时快照和官方来源人工复核。"
    });
    return;
  }

  compareTextField(differences, {
    key: "program.name",
    category: "program",
    label: "专业名称",
    submittedValue: submitted.name,
    currentValue: current.name,
    riskLevel: "low",
    affectedArea: "案件标题、专业详情、对比",
    advice: "名称变化通常是文案或官方命名更新，可备注后继续按申请时口径处理。"
  });
  compareTextField(differences, {
    key: "program.faculty",
    category: "program",
    label: "所属学院",
    submittedValue: submitted.faculty,
    currentValue: current.faculty,
    riskLevel: "low",
    affectedArea: "专业详情、对比、推荐解释",
    advice: "学院归属变化需记录，但一般不直接改变已提交案件材料判断。"
  });
  comparePublication(differences, "program", "专业公开状态", submitted, current);
  compareSource(differences, "program", "专业来源状态", submitted, current);
  compareFee(submitted.fee, current.fee, differences);
  compareLanguage(submitted.language, current.language, differences);
  compareApplicationDocs(submitted.applicationDocs, current.applicationDocs, differences);
}

function comparePublication(
  differences: CatalogSnapshotDifference[],
  entityKey: "university" | "program",
  label: string,
  submitted: Pick<CatalogUniversitySnapshot | CatalogProgramSnapshot, "publicDisplayStatus" | "publicDisplayStatusLabel" | "isPublished">,
  current: Pick<CatalogUniversitySnapshot | CatalogProgramSnapshot, "publicDisplayStatus" | "publicDisplayStatusLabel" | "isPublished">
) {
  const submittedText = `${submitted.isPublished ? "已发布" : "未发布"} · ${submitted.publicDisplayStatusLabel}`;
  const currentText = `${current.isPublished ? "已发布" : "未发布"} · ${current.publicDisplayStatusLabel}`;
  if (submittedText === currentText) return;
  addDifference(differences, {
    key: `${entityKey}.publicDisplayStatus`,
    category: "publication",
    label,
    submittedValue: submittedText,
    currentValue: currentText,
    riskLevel: publicationRisk(current),
    affectedArea: entityKey === "program" ? "专业列表、专业详情、收藏、对比、规划、推荐" : "首页卡片、院校详情、收藏、对比、推荐",
    advice: current.isPublished && current.publicDisplayStatus === "ready"
      ? "当前已恢复公开，但历史案件仍按申请时状态判断；如需引用当前状态，请补充跟进说明。"
      : "当前公开状态已变化，先按申请时快照处理案件，并复核官方页面是否仍接受该申请。"
  });
}

function compareSource(
  differences: CatalogSnapshotDifference[],
  entityKey: "university" | "program",
  label: string,
  submitted: Pick<CatalogUniversitySnapshot | CatalogProgramSnapshot, "officialSourceStatus" | "officialSourceStatusLabel" | "officialVerifiedAt">,
  current: Pick<CatalogUniversitySnapshot | CatalogProgramSnapshot, "officialSourceStatus" | "officialSourceStatusLabel" | "officialVerifiedAt">
) {
  const submittedText = `${submitted.officialSourceStatusLabel}${submitted.officialVerifiedAt ? ` · ${submitted.officialVerifiedAt}` : ""}`;
  const currentText = `${current.officialSourceStatusLabel}${current.officialVerifiedAt ? ` · ${current.officialVerifiedAt}` : ""}`;
  if (submittedText === currentText) return;
  const statusChanged = submitted.officialSourceStatus !== current.officialSourceStatus;
  addDifference(differences, {
    key: `${entityKey}.officialSourceStatus`,
    category: "source",
    label,
    submittedValue: submittedText,
    currentValue: currentText,
    riskLevel: statusChanged ? sourceRisk(current.officialSourceStatus) : "low",
    affectedArea: entityKey === "program" ? "专业详情可信度、申请材料、费用与语言来源" : "院校详情可信度、推荐与对比",
    advice: statusChanged
      ? "来源状态已变化，顾问需打开官方来源复核后再更新学生预期。"
      : "仅核验时间变化，可记录最新复核时间，不改变历史案件判断。"
  });
}

function compareFee(submitted: CatalogFeeSnapshot, current: CatalogFeeSnapshot, differences: CatalogSnapshotDifference[]) {
  if (submitted.filterableTuitionCny !== current.filterableTuitionCny) {
    addDifference(differences, {
      key: "program.fee.filterableTuitionCny",
      category: "fee",
      label: "预算筛选学费",
      submittedValue: feeValueText(submitted),
      currentValue: feeValueText(current),
      riskLevel: feeAmountRisk(submitted.filterableTuitionCny, current.filterableTuitionCny),
      affectedArea: "专业列表预算筛选、对比、规划费用估算、推荐",
      advice: "不要用当前费用覆盖历史案件判断；如当前费用更高或不可筛选，需人工复核预算并通知学生。"
    });
  } else if (submitted.displayText !== current.displayText || submitted.listTuitionText !== current.listTuitionText) {
    addDifference(differences, {
      key: "program.fee.displayText",
      category: "fee",
      label: "费用展示文案",
      submittedValue: submitted.listTuitionText || submitted.displayText || "-",
      currentValue: current.listTuitionText || current.displayText || "-",
      riskLevel: "medium",
      affectedArea: "专业列表学费展示、详情页费用说明",
      advice: "费用展示已变化，需核对官方费用页后决定是否更新学生沟通口径。"
    });
  }

  if (submitted.auditStatus !== current.auditStatus || submitted.sourceUrl !== current.sourceUrl || submitted.secondarySourceUrl !== current.secondarySourceUrl) {
    addDifference(differences, {
      key: "program.fee.source",
      category: "source",
      label: "费用来源状态",
      submittedValue: `${submitted.auditStatusLabel}${submitted.sourceUrl ? ` · ${submitted.sourceUrl}` : ""}`,
      currentValue: `${current.auditStatusLabel}${current.sourceUrl ? ` · ${current.sourceUrl}` : ""}`,
      riskLevel: feeSourceRisk(current),
      affectedArea: "专业列表预算筛选、详情页费用可信度、推荐预算匹配",
      advice: "费用来源或审核状态已变化，顾问需以申请时快照为历史依据，并按当前官方来源做补充复核。"
    });
  }
}

function compareLanguage(submitted: CatalogLanguageSnapshot, current: CatalogLanguageSnapshot, differences: CatalogSnapshotDifference[]) {
  if (submitted.summary !== current.summary) {
    const submittedIelts = submitted.requirement?.ielts || 0;
    const currentIelts = current.requirement?.ielts || 0;
    addDifference(differences, {
      key: "program.languageRequirement",
      category: "language",
      label: "语言要求结构化字段",
      submittedValue: submitted.summary,
      currentValue: current.summary,
      riskLevel: currentIelts > submittedIelts ? "high" : "medium",
      affectedArea: "专业详情、规划语言差距、推荐风险提示、申请材料",
      advice: currentIelts > submittedIelts
        ? "当前语言门槛升高，需人工确认是否影响该学生已提交案件，并补充语言备考或豁免说明。"
        : "语言要求已变化，继续按申请时快照判断历史案件，同时复核当前目录给后续沟通使用。"
    });
  }

  if (submitted.officialText !== current.officialText || submitted.requirementNote !== current.requirementNote) {
    addDifference(differences, {
      key: "program.officialLanguageRequirement",
      category: "language",
      label: "官方语言说明",
      submittedValue: [submitted.officialText, submitted.requirementNote].filter(Boolean).join(" / ") || "-",
      currentValue: [current.officialText, current.requirementNote].filter(Boolean).join(" / ") || "-",
      riskLevel: "medium",
      affectedArea: "专业详情语言说明、申请规划、补件建议",
      advice: "官方语言说明变化需人工复核；历史案件材料判断仍以提交时快照为准。"
    });
  }
}

function compareApplicationDocs(submittedDocs: string[], currentDocs: string[], differences: CatalogSnapshotDifference[]) {
  const submittedSet = normalizedSet(submittedDocs);
  const currentSet = normalizedSet(currentDocs);
  const added = currentDocs.filter((item) => !submittedSet.has(normalizeComparableText(item)));
  const removed = submittedDocs.filter((item) => !currentSet.has(normalizeComparableText(item)));
  if (!added.length && !removed.length) return;

  addDifference(differences, {
    key: "program.applicationDocs",
    category: "materials",
    label: "目录申请材料",
    submittedValue: submittedDocs.length ? submittedDocs.join("、") : "未配置目录材料",
    currentValue: currentDocs.length ? currentDocs.join("、") : "未配置目录材料",
    riskLevel: added.length ? "high" : "medium",
    affectedArea: "会员申请材料清单、材料审核、专业详情弹窗",
    advice: added.length
      ? `当前目录新增材料：${added.join("、")}。不要自动要求历史案件补交，需顾问核对院校是否追溯适用。`
      : `当前目录移除材料：${removed.join("、")}。历史已生成材料不自动删除，可由顾问判断是否豁免。`
  });
}

function compareTextField(
  differences: CatalogSnapshotDifference[],
  difference: CatalogSnapshotDifference
) {
  if (normalizeComparableText(difference.submittedValue) === normalizeComparableText(difference.currentValue)) return;
  addDifference(differences, difference);
}

function addDifference(differences: CatalogSnapshotDifference[], difference: CatalogSnapshotDifference) {
  differences.push({
    ...difference,
    submittedValue: difference.submittedValue || "-",
    currentValue: difference.currentValue || "-"
  });
}

function buildDifferenceSummary(differences: CatalogSnapshotDifference[], missingSnapshot: boolean): ApplicationCatalogSnapshotComparison["summary"] {
  const high = differences.filter((item) => item.riskLevel === "high").length;
  const medium = differences.filter((item) => item.riskLevel === "medium").length;
  const low = differences.filter((item) => item.riskLevel === "low").length;
  const highestRisk = high ? "high" : medium ? "medium" : low ? "low" : null;
  return {
    total: differences.length,
    high,
    medium,
    low,
    highestRisk,
    hasHighRisk: high > 0,
    missingSnapshot,
    feeChanges: countCategory(differences, "fee"),
    languageChanges: countCategory(differences, "language"),
    materialChanges: countCategory(differences, "materials"),
    publicationChanges: countCategory(differences, "publication"),
    sourceChanges: countCategory(differences, "source"),
    recommendation: recommendationText(differences, missingSnapshot)
  };
}

function recommendationText(differences: CatalogSnapshotDifference[], missingSnapshot: boolean) {
  if (missingSnapshot) {
    return "该案件没有申请时目录快照，可能是旧数据或后台手动创建；不要用当前目录反推提交时口径。";
  }
  if (differences.some((item) => item.riskLevel === "high")) {
    return "存在高风险目录变化：案件判断先按申请时快照执行，当前目录仅作为人工复核依据。";
  }
  if (differences.some((item) => item.riskLevel === "medium")) {
    return "存在中风险目录变化：建议顾问记录差异并核对官方来源后继续跟进。";
  }
  if (differences.length) {
    return "仅发现低风险文字或核验时间变化，可备注后继续按原案件口径处理。";
  }
  return "当前目录与申请时目录未发现关键差异，可继续按原案件口径处理。";
}

function countCategory(differences: CatalogSnapshotDifference[], category: CatalogSnapshotDifferenceCategory) {
  return differences.filter((item) => item.category === category).length;
}

function publicationRisk(current: Pick<CatalogUniversitySnapshot | CatalogProgramSnapshot, "publicDisplayStatus" | "isPublished">): CatalogSnapshotRiskLevel {
  if (!current.isPublished || blockingPublicStatuses.has(current.publicDisplayStatus)) return "high";
  if (reviewPublicStatuses.has(current.publicDisplayStatus)) return "medium";
  return "low";
}

function sourceRisk(status: OfficialSourceStatus): CatalogSnapshotRiskLevel {
  if (sourceRiskStatuses.has(status)) return "high";
  if (reviewSourceStatuses.has(status)) return "medium";
  return "low";
}

function feeSourceRisk(current: CatalogFeeSnapshot): CatalogSnapshotRiskLevel {
  if (current.auditStatus === "source-conflict" || current.auditStatus === "conflict") return "high";
  if (reviewFeeStatuses.has(current.auditStatus)) return "medium";
  return "low";
}

function feeAmountRisk(submitted: number | null, current: number | null): CatalogSnapshotRiskLevel {
  if (submitted == null || current == null) return "high";
  const diff = Math.abs(current - submitted);
  const ratio = diff / Math.max(submitted, 1);
  if (current > submitted && (diff >= 5000 || ratio >= 0.1)) return "high";
  if (diff >= 3000 || ratio >= 0.05) return "medium";
  return "low";
}

function feeValueText(fee: CatalogFeeSnapshot) {
  const filterableText = fee.filterableTuitionCny == null ? "不可参与预算筛选" : `预算筛选 ${fee.filterableTuitionCny.toLocaleString("zh-CN")} CNY/年`;
  return [fee.listTuitionText || fee.displayText, filterableText, fee.auditStatusLabel].filter(Boolean).join(" · ");
}

function languageRequirementText(requirement: LanguageRequirement | null) {
  if (!requirement) return "未配置语言要求";
  const items = [
    requirement.ielts ? `IELTS ${requirement.ielts}` : "",
    requirement.toefl ? `TOEFL ${requirement.toefl}` : "",
    requirement.pte ? `PTE ${requirement.pte}` : "",
    requirement.muet ? `MUET ${requirement.muet}` : ""
  ];
  return items.filter(Boolean).join(" / ") || "未配置语言要求";
}

function normalizedSet(values: string[]) {
  return new Set(values.map(normalizeComparableText).filter(Boolean));
}

function normalizeComparableText(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function publicDisplayStatusLabel(status: PublicDisplayStatus) {
  return localizedLabel(PUBLIC_DISPLAY_STATUS_LABELS, status);
}

function officialSourceStatusLabel(status: OfficialSourceStatus) {
  return localizedLabel(OFFICIAL_SOURCE_STATUS_LABELS, status);
}

function feeAuditStatusLabel(status: FeeAuditStatus) {
  return localizedLabel(FEE_AUDIT_STATUS_LABELS, status);
}

function localizedLabel<T extends string>(labels: Record<T, LocalizedText>, value: T) {
  return labels[value]?.["zh-CN"] || value;
}

function localizeText(value?: Partial<LocalizedText> | null) {
  if (!value) return "";
  return value["zh-CN"] || value.en || value.ms || value["zh-TW"] || "";
}

function localizeArray(value?: Partial<LocalizedStringArray> | null) {
  if (!value) return [];
  const items = value["zh-CN"] || value.en || value.ms || value["zh-TW"] || [];
  return Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function cloneJson(value: unknown) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
