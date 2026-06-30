import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  DictionaryItemEntity,
  ProgramEntity,
  QualityIssueEntity,
  QualityRuleEntity,
  UniversityEntity,
  type QualityIssueEntityType,
  type QualityIssueSeverity,
  type QualityIssueStatus
} from "../db/entities.js";
import { isReadyForPublicCatalog, isVisibleInPublicCatalog } from "../common/mappers.js";
import type { AdminRequestUser } from "../common/guards.js";

const QUALITY_RULES: Array<{
  ruleId: string;
  name: string;
  description: string;
  severity: QualityIssueSeverity;
}> = [
  {
    ruleId: "R001",
    name: "Ready university missing official source",
    description: "University is public-ready but has no official source URL.",
    severity: "high"
  },
  {
    ruleId: "R002",
    name: "Program fee missing official source",
    description: "Program has official fee data but no official fee source URL.",
    severity: "high"
  },
  {
    ruleId: "R003",
    name: "Program fee audit unresolved",
    description: "Program fee audit status is conflict or pending review.",
    severity: "medium"
  },
  {
    ruleId: "R004",
    name: "Program category invalid",
    description: "Program category is not enabled in the system dictionary.",
    severity: "medium"
  },
  {
    ruleId: "R005",
    name: "Localized name missing",
    description: "University or program name is missing one of the required locales.",
    severity: "low"
  },
  {
    ruleId: "R006",
    name: "English name contains Chinese characters",
    description: "The English name field contains CJK characters.",
    severity: "low"
  }
];

const REQUIRED_NAME_LOCALES = ["en", "ms", "zh-CN", "zh-TW"] as const;
const CJK_PATTERN = /[\u3400-\u9fff]/;
const OPEN_STATUS: QualityIssueStatus = "open";
const MAX_PAGE_SIZE = 100;

interface GeneratedQualityIssue {
  entityType: QualityIssueEntityType;
  entityId: number;
  ruleId: string;
  severity: QualityIssueSeverity;
  message: string;
  fieldPath: string | null;
}

export interface QualityIssueListQuery {
  severity?: string;
  status?: string;
  entityType?: string;
  entityId?: string | number;
  ruleId?: string;
  page?: string | number;
  pageSize?: string | number;
}

@Injectable()
export class QualityEngineService {
  constructor(
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>,
    @InjectRepository(DictionaryItemEntity) private readonly dictionariesRepository: Repository<DictionaryItemEntity>,
    @InjectRepository(QualityRuleEntity) private readonly rulesRepository: Repository<QualityRuleEntity>,
    @InjectRepository(QualityIssueEntity) private readonly issuesRepository: Repository<QualityIssueEntity>
  ) {}

  async ensureDefaultRules() {
    const existing = await this.rulesRepository.find();
    const existingByRuleId = new Map(existing.map((rule) => [rule.ruleId, rule]));
    const missing = QUALITY_RULES
      .filter((rule) => !existingByRuleId.has(rule.ruleId))
      .map((rule) => this.rulesRepository.create({ ...rule, enabled: true }));
    if (missing.length) {
      await this.rulesRepository.save(missing);
    }
    return this.rulesRepository.find({ order: { ruleId: "ASC" } });
  }

  async runFullCheck() {
    await this.ensureDefaultRules();
    await this.issuesRepository.delete({ status: OPEN_STATUS });
    const [universities, programs, enabledRules, categoryCodes, ignoredIssueKeys] = await Promise.all([
      this.universitiesRepository.find(),
      this.programsRepository.find({ relations: { university: true } }),
      this.enabledRuleMap(),
      this.enabledProgramCategoryCodes(),
      this.ignoredIssueKeys()
    ]);

    const generated = [
      ...universities.flatMap((university) => this.inspectUniversity(university, enabledRules)),
      ...programs.flatMap((program) => this.inspectProgram(program, enabledRules, categoryCodes))
    ].filter((issue) => !ignoredIssueKeys.has(issueKey(issue)));

    const now = new Date();
    const saved = generated.length
      ? await this.issuesRepository.save(generated.map((issue) => this.issuesRepository.create({ ...issue, status: OPEN_STATUS, detectedAt: now })))
      : [];

    return {
      generated: saved.length,
      checkedAt: now.toISOString(),
      summary: await this.issueSummary()
    };
  }

  async runEntityCheck(entityType: QualityIssueEntityType, entityId: number) {
    await this.ensureDefaultRules();
    await this.issuesRepository.delete({ entityType, entityId, status: OPEN_STATUS });
    const [enabledRules, categoryCodes, ignoredIssueKeys] = await Promise.all([
      this.enabledRuleMap(),
      this.enabledProgramCategoryCodes(),
      this.ignoredIssueKeys(entityType, entityId)
    ]);
    const generated = await this.inspectEntity(entityType, entityId, enabledRules, categoryCodes);
    const filtered = generated.filter((issue) => !ignoredIssueKeys.has(issueKey(issue)));
    const now = new Date();
    const saved = filtered.length
      ? await this.issuesRepository.save(filtered.map((issue) => this.issuesRepository.create({ ...issue, status: OPEN_STATUS, detectedAt: now })))
      : [];
    return { generated: saved.length, checkedAt: now.toISOString() };
  }

  async assertNoOpenHighIssues(entityType: QualityIssueEntityType, entityId: number) {
    const existing = await this.issuesRepository.findOne({ where: { entityType, entityId, status: OPEN_STATUS, severity: "high" } });
    if (existing) {
      throw new BadRequestException("存在未解决的严重数据质量问题，无法发布。请先在质量工作台处理。");
    }
  }

  async assertSnapshotCanBeReady(entityType: QualityIssueEntityType, entity: UniversityEntity | ProgramEntity) {
    await this.ensureDefaultRules();
    const [enabledRules, categoryCodes] = await Promise.all([this.enabledRuleMap(), this.enabledProgramCategoryCodes()]);
    const issues = entityType === "university"
      ? this.inspectUniversity(entity as UniversityEntity, enabledRules)
      : this.inspectProgram(entity as ProgramEntity, enabledRules, categoryCodes);
    if (issues.some((issue) => issue.severity === "high")) {
      throw new BadRequestException("存在未解决的严重数据质量问题，无法发布。请先在质量工作台处理。");
    }
  }

  async catalogQuality() {
    await this.ensureDefaultRules();
    const [universities, programs, issues, summary, lastIssue] = await Promise.all([
      this.universitiesRepository.find(),
      this.programsRepository.find({ relations: { university: true } }),
      this.listIssues({ status: OPEN_STATUS, page: 1, pageSize: 80 }),
      this.issueSummary(),
      this.issuesRepository.findOne({ where: {}, order: { detectedAt: "DESC" } })
    ]);
    const readyUniversityMap = new Map(universities.filter(isReadyForPublicCatalog).map((university) => [university.id, university]));
    const publicPrograms = programs.filter((program) => isVisibleInPublicCatalog(program) && readyUniversityMap.has(program.universityId));
    const readyPrograms = publicPrograms.filter((program) => program.publicDisplayStatus === "ready");
    const feeIssueCount = await this.issuesRepository.count({ where: [{ ruleId: "R002", status: OPEN_STATUS }, { ruleId: "R003", status: OPEN_STATUS }] });
    const missingLanguageCount = await this.issuesRepository.count({ where: { ruleId: "R005", status: OPEN_STATUS } });

    return {
      overview: {
        checkedAt: lastIssue?.detectedAt?.toISOString() || new Date().toISOString(),
        universityTotal: universities.length,
        publicUniversityCount: readyUniversityMap.size,
        programTotal: programs.length,
        publicProgramCount: publicPrograms.length,
        readyProgramCount: readyPrograms.length,
        officialVerifiedUniversityCount: universities.filter((item) => item.officialSourceStatus === "official-verified").length,
        officialVerifiedProgramCount: programs.filter((item) => item.officialSourceStatus === "official-verified").length,
        issueCount: summary.openIssues,
        missingUniversitySourceCount: await this.issuesRepository.count({ where: { ruleId: "R001", status: OPEN_STATUS } }),
        missingProgramSourceCount: await this.issuesRepository.count({ where: { ruleId: "R002", status: OPEN_STATUS } }),
        missingFeeSourceCount: await this.issuesRepository.count({ where: { ruleId: "R002", status: OPEN_STATUS } }),
        missingStatusCount: 0,
        needsReviewCount: universities.filter((item) => item.publicDisplayStatus === "needs-review" || item.officialSourceStatus === "needs-review").length
          + programs.filter((item) => item.publicDisplayStatus === "needs-review" || item.officialSourceStatus === "needs-review" || item.officialFeeAuditStatus === "pending-review").length,
        feeIssueCount,
        missingLanguageCount,
        issueSeverityCounts: {
          high: summary.highSeverity,
          medium: summary.mediumSeverity,
          low: summary.lowSeverity
        },
        universityPublicDisplayCounts: countValues(universities, (item) => item.publicDisplayStatus),
        programPublicDisplayCounts: countValues(programs, (item) => item.publicDisplayStatus),
        publicDisplayCounts: countValues(programs, (item) => item.publicDisplayStatus),
        universitySourceStatusCounts: countValues(universities, (item) => item.officialSourceStatus),
        programSourceStatusCounts: countValues(programs, (item) => item.officialSourceStatus),
        feeAuditCounts: countValues(programs, (item) => item.officialFeeAuditStatus),
        levelCounts: countValues(programs, (item) => item.level),
        categoryCounts: countValues(programs, (item) => item.category)
      },
      issues: issues.items,
      issueLimit: issues.pageSize,
      hasMoreIssues: issues.total > issues.pageSize
    };
  }

  async listIssues(query: QualityIssueListQuery) {
    await this.ensureDefaultRules();
    const page = positiveNumber(query.page, 1);
    const pageSize = Math.min(positiveNumber(query.pageSize, 20), MAX_PAGE_SIZE);
    const where: Record<string, unknown> = {};
    if (isAllowed(query.severity, ["high", "medium", "low"])) where.severity = query.severity;
    if (isAllowed(query.status, ["open", "resolved", "ignored"])) where.status = query.status;
    if (isAllowed(query.entityType, ["university", "program"])) where.entityType = query.entityType;
    if (query.entityId) where.entityId = positiveNumber(query.entityId, 0);
    if (query.ruleId) where.ruleId = String(query.ruleId);

    const [items, total] = await this.issuesRepository.findAndCount({
      where,
      order: { detectedAt: "DESC", id: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    const mappedItems = await this.mapIssueItems(items);
    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      summary: await this.issueSummary(where)
    };
  }

  async updateIssueStatus(actor: AdminRequestUser, id: number, status: QualityIssueStatus) {
    if (!["resolved", "ignored", "open"].includes(status)) {
      throw new BadRequestException("Invalid quality issue status");
    }
    const issue = await this.issuesRepository.findOneBy({ id });
    if (!issue) throw new NotFoundException("Quality issue not found");
    issue.status = status;
    issue.resolvedAt = status === OPEN_STATUS ? null : new Date();
    issue.resolvedBy = status === OPEN_STATUS ? null : String(actor.id);
    const saved = await this.issuesRepository.save(issue);
    return (await this.mapIssueItems([saved]))[0];
  }

  async catalogStats() {
    const [universities, programs, summary] = await Promise.all([
      this.universitiesRepository.find(),
      this.programsRepository.find(),
      this.issueSummary({ status: OPEN_STATUS })
    ]);
    const readyUniversities = universities.filter(isReadyForPublicCatalog);
    const readyUniversityIds = new Set(readyUniversities.map((university) => university.id));
    const visiblePrograms = programs.filter((program) => isVisibleInPublicCatalog(program) && readyUniversityIds.has(program.universityId));
    return {
      universities: {
        total: universities.length,
        published: readyUniversities.length
      },
      programs: {
        total: programs.length,
        ready: visiblePrograms.filter((program) => program.publicDisplayStatus === "ready").length,
        withOfficialSource: programs.filter(hasProgramOfficialSource).length
      },
      quality: {
        openIssues: summary.openIssues,
        highSeverity: summary.highSeverity,
        mediumSeverity: summary.mediumSeverity,
        lowSeverity: summary.lowSeverity
      }
    };
  }

  private async inspectEntity(
    entityType: QualityIssueEntityType,
    entityId: number,
    enabledRules: Map<string, QualityRuleEntity>,
    categoryCodes: Set<string>
  ) {
    if (entityType === "university") {
      const university = await this.universitiesRepository.findOneBy({ id: entityId });
      return university ? this.inspectUniversity(university, enabledRules) : [];
    }
    const program = await this.programsRepository.findOne({ where: { id: entityId }, relations: { university: true } });
    return program ? this.inspectProgram(program, enabledRules, categoryCodes) : [];
  }

  private inspectUniversity(university: UniversityEntity, enabledRules: Map<string, QualityRuleEntity>): GeneratedQualityIssue[] {
    const issues: GeneratedQualityIssue[] = [];
    if (enabledRules.has("R001") && isReadyForPublicCatalog(university) && !hasUniversityOfficialSource(university)) {
      issues.push({
        entityType: "university",
        entityId: university.id,
        ruleId: "R001",
        severity: enabledRules.get("R001")!.severity,
        message: "该学校已公开 Ready，但缺少官方来源 URL。",
        fieldPath: "officialSources"
      });
    }
    this.pushNameIssues(issues, "university", university.id, university.name, enabledRules);
    return issues;
  }

  private inspectProgram(program: ProgramEntity, enabledRules: Map<string, QualityRuleEntity>, categoryCodes: Set<string>): GeneratedQualityIssue[] {
    const issues: GeneratedQualityIssue[] = [];
    if (enabledRules.has("R002") && requiresFeeSource(program) && !isFilledString(program.officialFeeSourceUrl)) {
      issues.push({
        entityType: "program",
        entityId: program.id,
        ruleId: "R002",
        severity: enabledRules.get("R002")!.severity,
        message: "该专业存在官方费用数据，但缺少官方费用来源 URL。",
        fieldPath: "officialFeeSourceUrl"
      });
    }
    if (enabledRules.has("R003") && ["conflict", "source-conflict", "pending-review"].includes(program.officialFeeAuditStatus || "")) {
      issues.push({
        entityType: "program",
        entityId: program.id,
        ruleId: "R003",
        severity: enabledRules.get("R003")!.severity,
        message: `该专业费用审计状态仍为 ${program.officialFeeAuditStatus}。`,
        fieldPath: "officialFeeAuditStatus"
      });
    }
    if (enabledRules.has("R004") && categoryCodes.size > 0 && !categoryCodes.has(program.category)) {
      issues.push({
        entityType: "program",
        entityId: program.id,
        ruleId: "R004",
        severity: enabledRules.get("R004")!.severity,
        message: `该专业分类 ${program.category} 不在启用的系统字典中。`,
        fieldPath: "category"
      });
    }
    this.pushNameIssues(issues, "program", program.id, program.name, enabledRules);
    return issues;
  }

  private pushNameIssues(
    issues: GeneratedQualityIssue[],
    entityType: QualityIssueEntityType,
    entityId: number,
    name: Record<string, string> | null | undefined,
    enabledRules: Map<string, QualityRuleEntity>
  ) {
    if (enabledRules.has("R005")) {
      const missing = REQUIRED_NAME_LOCALES.filter((locale) => !isFilledString(name?.[locale]));
      if (missing.length) {
        issues.push({
          entityType,
          entityId,
          ruleId: "R005",
          severity: enabledRules.get("R005")!.severity,
          message: `名称缺少 ${missing.join(", ")} 语言内容。`,
          fieldPath: "name"
        });
      }
    }
    if (enabledRules.has("R006") && CJK_PATTERN.test(name?.en || "")) {
      issues.push({
        entityType,
        entityId,
        ruleId: "R006",
        severity: enabledRules.get("R006")!.severity,
        message: "英文名称字段包含中文字符。",
        fieldPath: "name.en"
      });
    }
  }

  private async enabledRuleMap() {
    await this.ensureDefaultRules();
    const rules = await this.rulesRepository.find({ where: { enabled: true } });
    return new Map(rules.map((rule) => [rule.ruleId, rule]));
  }

  private async enabledProgramCategoryCodes() {
    const items = await this.dictionariesRepository.find({ where: { dictType: "program_category", status: "enabled" } });
    return new Set(items.map((item) => item.code));
  }

  private async ignoredIssueKeys(entityType?: QualityIssueEntityType, entityId?: number) {
    const where: Record<string, unknown> = { status: "ignored" };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    const issues = await this.issuesRepository.find({ where });
    return new Set(issues.map(issueKey));
  }

  private async mapIssueItems(items: QualityIssueEntity[]) {
    const rules = await this.rulesRepository.find();
    const ruleMap = new Map(rules.map((rule) => [rule.ruleId, rule]));
    const universityIds = items.filter((issue) => issue.entityType === "university").map((issue) => issue.entityId);
    const programIds = items.filter((issue) => issue.entityType === "program").map((issue) => issue.entityId);
    const [universities, programs] = await Promise.all([
      universityIds.length ? this.universitiesRepository.findBy({ id: In([...new Set(universityIds)]) }) : [],
      programIds.length ? this.programsRepository.find({ where: { id: In([...new Set(programIds)]) }, relations: { university: true } }) : []
    ]);
    const universityMap = new Map(universities.map((university) => [university.id, university]));
    const programMap = new Map(programs.map((program) => [program.id, program]));
    return items.map((issue) => {
      const rule = ruleMap.get(issue.ruleId);
      const target = issue.entityType === "university" ? universityMap.get(issue.entityId) : programMap.get(issue.entityId);
      const targetLabel = issue.entityType === "university"
        ? universityLabel(target as UniversityEntity | undefined)
        : programLabel(target as ProgramEntity | undefined);
      const searchKeyword = issue.entityType === "university"
        ? (target as UniversityEntity | undefined)?.code || targetLabel
        : (target as ProgramEntity | undefined)?.code || targetLabel;
      return {
        id: issue.id,
        entityType: issue.entityType,
        entityId: issue.entityId,
        ruleId: issue.ruleId,
        ruleName: rule?.name || issue.ruleId,
        severity: issue.severity,
        status: issue.status,
        message: issue.message,
        title: rule?.name || issue.ruleId,
        targetLabel,
        searchKeyword,
        hint: issue.message,
        fieldPath: issue.fieldPath,
        detectedAt: issue.detectedAt?.toISOString() || null,
        resolvedAt: issue.resolvedAt?.toISOString() || null,
        editUrl: issue.entityType === "university"
          ? `/universities?search=${encodeURIComponent(searchKeyword)}&editId=${issue.entityId}&focus=${encodeURIComponent(issue.fieldPath || "")}`
          : `/programs?search=${encodeURIComponent(searchKeyword)}&editId=${issue.entityId}&focus=${encodeURIComponent(issue.fieldPath || "")}`
      };
    });
  }

  private async issueSummary(baseWhere: Record<string, unknown> = {}) {
    const where = { ...baseWhere };
    const status = where.status as QualityIssueStatus | undefined;
    const [openIssues, highSeverity, mediumSeverity, lowSeverity] = await Promise.all([
      this.issuesRepository.count({ where: status ? where : { ...where, status: OPEN_STATUS } }),
      this.issuesRepository.count({ where: { ...where, status: status || OPEN_STATUS, severity: "high" } }),
      this.issuesRepository.count({ where: { ...where, status: status || OPEN_STATUS, severity: "medium" } }),
      this.issuesRepository.count({ where: { ...where, status: status || OPEN_STATUS, severity: "low" } })
    ]);
    return { openIssues, highSeverity, mediumSeverity, lowSeverity };
  }
}

function issueKey(issue: Pick<QualityIssueEntity, "entityType" | "entityId" | "ruleId" | "fieldPath">) {
  return `${issue.entityType}:${issue.entityId}:${issue.ruleId}:${issue.fieldPath || ""}`;
}

function hasUniversityOfficialSource(university: Partial<UniversityEntity>) {
  return isFilledString(university.officialWebsite) || isFilledString(university.website) || hasSourceLinks(university.officialSources);
}

function hasProgramOfficialSource(program: Partial<ProgramEntity>) {
  return (
    isFilledString(program.officialSourceUrl) ||
    isFilledString(program.officialEntryRequirementSourceUrl) ||
    isFilledString(program.officialAccreditationSourceUrl) ||
    hasSourceLinks(program.sourceUrls)
  );
}

function requiresFeeSource(program: Partial<ProgramEntity>) {
  return (
    ["matched-official", "fee-sheet-verified", "official-approximate", "official-rate-verified", "calculated-from-official-rate", "official-non-scalar"].includes(program.officialFeeAuditStatus || "") ||
    program.officialTuitionMYR !== undefined && program.officialTuitionMYR !== null ||
    program.tuitionCurrency === "MYR"
  );
}

function hasSourceLinks(value: unknown) {
  return Array.isArray(value) && value.some((item) => item && typeof item === "object" && isFilledString((item as { url?: string }).url));
}

function isFilledString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function localizedName(value: Record<string, string> | null | undefined) {
  if (!value) return "";
  return value["zh-CN"] || value.en || value.ms || value["zh-TW"] || "";
}

function universityLabel(university?: UniversityEntity) {
  if (!university) return "Unknown university";
  return university.shortName || localizedName(university.name) || university.code || `University #${university.id}`;
}

function programLabel(program?: ProgramEntity) {
  if (!program) return "Unknown program";
  const name = program.nameEnOfficial || localizedName(program.name) || program.code || `Program #${program.id}`;
  return program.university?.shortName ? `${program.university.shortName} / ${name}` : name;
}

function countValues<T>(items: T[], readValue: (item: T) => unknown) {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = isFilledString(readValue(item)) ? String(readValue(item)) : "empty";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function positiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function isAllowed(value: unknown, allowed: string[]) {
  return typeof value === "string" && allowed.includes(value);
}
