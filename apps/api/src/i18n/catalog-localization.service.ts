import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SUPPORTED_LOCALES, type LocalizedStringArray, type LocalizedText, type PublicDisplayStatus, type SupportedLocale } from "@studymy/shared";
import { normalizePublicDisplayStatus } from "../common/mappers.js";
import { ProgramEntity, UniversityEntity } from "../db/entities.js";

export type CatalogLocalizationEntityType = "all" | "university" | "program";
export type CatalogLocalizationFieldKind = "localized-text" | "localized-array";
export type CatalogLocalizationIssueCode =
  | "invalid-localized-shape"
  | "missing-locale"
  | "non-cjk-locale-has-cjk-content";

export interface CatalogLocalizationQuery {
  entityType?: unknown;
  locale?: unknown;
  includeHidden?: unknown;
  limit?: unknown;
}

export interface CatalogLocalizationFieldContract {
  entityType: Exclude<CatalogLocalizationEntityType, "all">;
  field: string;
  kind: CatalogLocalizationFieldKind;
  required: boolean;
}

export interface CatalogLocalizationIssue {
  entityType: Exclude<CatalogLocalizationEntityType, "all">;
  entityId: number;
  slug: string;
  code: CatalogLocalizationIssueCode;
  field: string;
  locale: SupportedLocale;
  severity: "error" | "warning";
  message: LocalizedText;
  sample: string | null;
  publicDisplayStatus: PublicDisplayStatus;
  isPublished: boolean;
}

export interface CatalogLocalizationCoverageReport {
  contract: {
    endpoint: string;
    method: "GET";
    query: {
      entityType: CatalogLocalizationEntityType[];
      locale: SupportedLocale[];
      includeHidden: boolean;
      limit: { default: number; max: number };
    };
    supportedLocales: SupportedLocale[];
    checkedFields: CatalogLocalizationFieldContract[];
  };
  query: {
    entityType: CatalogLocalizationEntityType;
    locale: SupportedLocale | null;
    includeHidden: boolean;
    limit: number;
  };
  summary: {
    scanned: { universities: number; programs: number; total: number };
    issues: {
      total: number;
      returned: number;
      byCode: Record<CatalogLocalizationIssueCode, number>;
      byLocale: Record<SupportedLocale, number>;
      byEntityType: Record<Exclude<CatalogLocalizationEntityType, "all">, number>;
    };
    completeRecords: { universities: number; programs: number; total: number };
  };
  issues: CatalogLocalizationIssue[];
}

type CatalogRecord = UniversityEntity | ProgramEntity;
type EntityTypeWithoutAll = Exclude<CatalogLocalizationEntityType, "all">;

const ENTITY_TYPES = ["all", "university", "program"] as const satisfies readonly CatalogLocalizationEntityType[];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CJK_PATTERN = /[\u3400-\u9fff]/;

const UNIVERSITY_FIELDS = [
  { entityType: "university", field: "name", kind: "localized-text", required: true },
  { entityType: "university", field: "location", kind: "localized-text", required: true },
  { entityType: "university", field: "region", kind: "localized-text", required: true },
  { entityType: "university", field: "description", kind: "localized-text", required: true },
  { entityType: "university", field: "facilities", kind: "localized-array", required: false },
  { entityType: "university", field: "highlights", kind: "localized-array", required: false },
  { entityType: "university", field: "applicationDocuments", kind: "localized-array", required: false },
  { entityType: "university", field: "chinaStudentRequirements", kind: "localized-array", required: false }
] as const satisfies readonly CatalogLocalizationFieldContract[];

const PROGRAM_FIELDS = [
  { entityType: "program", field: "name", kind: "localized-text", required: true },
  { entityType: "program", field: "faculty", kind: "localized-text", required: true },
  { entityType: "program", field: "description", kind: "localized-text", required: true },
  { entityType: "program", field: "requirement.note", kind: "localized-text", required: true },
  { entityType: "program", field: "applicationDocs", kind: "localized-array", required: false },
  { entityType: "program", field: "curriculum", kind: "localized-array", required: false },
  { entityType: "program", field: "careers", kind: "localized-array", required: false },
  { entityType: "program", field: "specializations", kind: "localized-array", required: false }
] as const satisfies readonly CatalogLocalizationFieldContract[];

const CHECKED_FIELDS = [...UNIVERSITY_FIELDS, ...PROGRAM_FIELDS] as const satisfies readonly CatalogLocalizationFieldContract[];

const EMPTY_ISSUE_COUNTS: Record<CatalogLocalizationIssueCode, number> = {
  "invalid-localized-shape": 0,
  "missing-locale": 0,
  "non-cjk-locale-has-cjk-content": 0
};

const ERROR_MESSAGES = {
  invalidEntityType: localized(
    "Unsupported catalog localization entity type.",
    "\u4e0d\u652f\u6301\u7684\u76ee\u5f55\u591a\u8bed\u8a00\u5b9e\u4f53\u7c7b\u578b\u3002",
    "\u4e0d\u652f\u63f4\u7684\u76ee\u9304\u591a\u8a9e\u8a00\u5be6\u9ad4\u985e\u578b\u3002",
    "Jenis entiti penyetempatan katalog tidak disokong."
  ),
  invalidLocale: localized(
    "Unsupported catalog localization locale.",
    "\u4e0d\u652f\u6301\u7684\u76ee\u5f55\u591a\u8bed\u8a00\u8bed\u8a00\u4ee3\u7801\u3002",
    "\u4e0d\u652f\u63f4\u7684\u76ee\u9304\u591a\u8a9e\u8a00\u8a9e\u8a00\u4ee3\u78bc\u3002",
    "Lokal penyetempatan katalog tidak disokong."
  ),
  invalidBoolean: localized(
    "includeHidden must be true or false.",
    "includeHidden \u5fc5\u987b\u662f true \u6216 false\u3002",
    "includeHidden \u5fc5\u9808\u662f true \u6216 false\u3002",
    "includeHidden mesti true atau false."
  ),
  invalidLimit: localized(
    `limit must be an integer between 1 and ${MAX_LIMIT}.`,
    `limit \u5fc5\u987b\u662f 1 \u5230 ${MAX_LIMIT} \u4e4b\u95f4\u7684\u6574\u6570\u3002`,
    `limit \u5fc5\u9808\u662f 1 \u5230 ${MAX_LIMIT} \u4e4b\u9593\u7684\u6574\u6578\u3002`,
    `limit mesti nombor bulat antara 1 dan ${MAX_LIMIT}.`
  )
} as const satisfies Record<string, LocalizedText>;

@Injectable()
export class CatalogLocalizationService {
  constructor(
    @InjectRepository(UniversityEntity) private readonly universitiesRepository: Repository<UniversityEntity>,
    @InjectRepository(ProgramEntity) private readonly programsRepository: Repository<ProgramEntity>
  ) {}

  getContract() {
    return this.buildContract();
  }

  async getCoverageReport(query: CatalogLocalizationQuery = {}): Promise<CatalogLocalizationCoverageReport> {
    const normalized = this.normalizeQuery(query);
    const [universities, programs] = await Promise.all([
      normalized.entityType === "program" ? Promise.resolve([]) : this.findUniversities(normalized.includeHidden),
      normalized.entityType === "university" ? Promise.resolve([]) : this.findPrograms(normalized.includeHidden)
    ]);

    const issues: CatalogLocalizationIssue[] = [];
    const recordIssues = {
      university: new Set<number>(),
      program: new Set<number>()
    };

    for (const university of universities) {
      const recordIssueCount = this.inspectRecord("university", university, UNIVERSITY_FIELDS, normalized.locale, issues);
      if (recordIssueCount > 0) recordIssues.university.add(university.id);
    }

    for (const program of programs) {
      const recordIssueCount = this.inspectRecord("program", program, PROGRAM_FIELDS, normalized.locale, issues);
      if (recordIssueCount > 0) recordIssues.program.add(program.id);
    }

    const limitedIssues = issues.slice(0, normalized.limit);

    return {
      contract: this.buildContract(),
      query: normalized,
      summary: {
        scanned: {
          universities: universities.length,
          programs: programs.length,
          total: universities.length + programs.length
        },
        issues: {
          total: issues.length,
          returned: limitedIssues.length,
          byCode: countByCode(issues),
          byLocale: countByLocale(issues),
          byEntityType: countByEntityType(issues)
        },
        completeRecords: {
          universities: universities.length - recordIssues.university.size,
          programs: programs.length - recordIssues.program.size,
          total: universities.length + programs.length - recordIssues.university.size - recordIssues.program.size
        }
      },
      issues: limitedIssues
    };
  }

  private async findUniversities(includeHidden: boolean) {
    return this.universitiesRepository.find({
      where: includeHidden ? {} : { isPublished: true, publicDisplayStatus: "ready" },
      order: { id: "ASC" }
    });
  }

  private async findPrograms(includeHidden: boolean) {
    return this.programsRepository.find({
      where: includeHidden ? {} : { isPublished: true, publicDisplayStatus: "ready" },
      order: { id: "ASC" }
    });
  }

  private inspectRecord(
    entityType: EntityTypeWithoutAll,
    record: CatalogRecord,
    fields: readonly CatalogLocalizationFieldContract[],
    locale: SupportedLocale | null,
    issues: CatalogLocalizationIssue[]
  ) {
    const startCount = issues.length;
    const locales = locale ? [locale] : [...SUPPORTED_LOCALES];

    for (const field of fields) {
      const value = readField(record, field.field);
      if (value == null && !field.required) {
        continue;
      }

      if (!isLocalizedPayload(value)) {
        for (const checkedLocale of locales) {
          issues.push(this.buildIssue(entityType, record, field.field, checkedLocale, "invalid-localized-shape", "error", null));
        }
        continue;
      }

      if (hasUnsupportedLocaleKey(value) || (!hasSupportedLocaleKey(value) && hasAnyPayloadValue(value))) {
        for (const checkedLocale of locales) {
          issues.push(this.buildIssue(entityType, record, field.field, checkedLocale, "invalid-localized-shape", "error", null));
        }
        continue;
      }

      const shouldRequireLocaleContent = field.required || hasAnyLocalizedValue(value);

      for (const checkedLocale of locales) {
        if (!isLocaleValueShapeValid(value, checkedLocale, field.kind)) {
          issues.push(this.buildIssue(entityType, record, field.field, checkedLocale, "invalid-localized-shape", "error", null));
          continue;
        }

        const samples = localeSamples(value, checkedLocale, field.kind);
        if (!samples.length && shouldRequireLocaleContent) {
          issues.push(this.buildIssue(entityType, record, field.field, checkedLocale, "missing-locale", "error", null));
          continue;
        }

        if ((checkedLocale === "en" || checkedLocale === "ms") && samples.some(hasCjkContent)) {
          issues.push(
            this.buildIssue(
              entityType,
              record,
              field.field,
              checkedLocale,
              "non-cjk-locale-has-cjk-content",
              "error",
              samples.find(hasCjkContent) || null
            )
          );
        }
      }
    }

    return issues.length - startCount;
  }

  private buildIssue(
    entityType: EntityTypeWithoutAll,
    record: CatalogRecord,
    field: string,
    locale: SupportedLocale,
    code: CatalogLocalizationIssueCode,
    severity: CatalogLocalizationIssue["severity"],
    sample: string | null
  ): CatalogLocalizationIssue {
    const status = normalizePublicDisplayStatus(record.publicDisplayStatus, record.isPublished);
    return {
      entityType,
      entityId: record.id,
      slug: record.slug,
      code,
      field,
      locale,
      severity,
      message: issueMessage(code, field, locale),
      sample: truncateSample(sample),
      publicDisplayStatus: status,
      isPublished: record.isPublished
    };
  }

  private normalizeQuery(query: CatalogLocalizationQuery) {
    const entityType = this.normalizeEntityType(query.entityType);
    const locale = this.normalizeLocale(query.locale);
    const includeHidden = this.normalizeBoolean(query.includeHidden);
    const limit = this.normalizeLimit(query.limit);

    return {
      entityType,
      locale,
      includeHidden,
      limit
    };
  }

  private normalizeEntityType(value: unknown): CatalogLocalizationEntityType {
    if (value == null || value === "") return "all";
    if (typeof value !== "string") {
      throw localizedBadRequest("INVALID_ENTITY_TYPE", ERROR_MESSAGES.invalidEntityType, {
        supportedEntityTypes: [...ENTITY_TYPES]
      });
    }

    const normalized = value.trim();
    if (!ENTITY_TYPES.includes(normalized as CatalogLocalizationEntityType)) {
      throw localizedBadRequest("INVALID_ENTITY_TYPE", ERROR_MESSAGES.invalidEntityType, {
        supportedEntityTypes: [...ENTITY_TYPES],
        received: normalized
      });
    }

    return normalized as CatalogLocalizationEntityType;
  }

  private normalizeLocale(value: unknown): SupportedLocale | null {
    if (value == null || value === "") return null;
    if (typeof value !== "string") {
      throw localizedBadRequest("INVALID_LOCALE", ERROR_MESSAGES.invalidLocale, {
        supportedLocales: [...SUPPORTED_LOCALES]
      });
    }

    const normalized = value.trim();
    if (!SUPPORTED_LOCALES.includes(normalized as SupportedLocale)) {
      throw localizedBadRequest("INVALID_LOCALE", ERROR_MESSAGES.invalidLocale, {
        supportedLocales: [...SUPPORTED_LOCALES],
        received: normalized
      });
    }

    return normalized as SupportedLocale;
  }

  private normalizeBoolean(value: unknown): boolean {
    if (value == null || value === "") return false;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    throw localizedBadRequest("INVALID_INCLUDE_HIDDEN", ERROR_MESSAGES.invalidBoolean, { field: "includeHidden" });
  }

  private normalizeLimit(value: unknown): number {
    if (value == null || value === "") return DEFAULT_LIMIT;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      throw localizedBadRequest("INVALID_LIMIT", ERROR_MESSAGES.invalidLimit, {
        min: 1,
        max: MAX_LIMIT,
        received: value
      });
    }
    return parsed;
  }

  private buildContract(): CatalogLocalizationCoverageReport["contract"] {
    return {
      endpoint: "/api/i18n/catalog-localization/coverage",
      method: "GET",
      query: {
        entityType: [...ENTITY_TYPES],
        locale: [...SUPPORTED_LOCALES],
        includeHidden: false,
        limit: { default: DEFAULT_LIMIT, max: MAX_LIMIT }
      },
      supportedLocales: [...SUPPORTED_LOCALES],
      checkedFields: [...CHECKED_FIELDS]
    };
  }
}

function localized(en: string, zhCN: string, zhTW: string, ms: string): LocalizedText {
  return { en, ms, "zh-CN": zhCN, "zh-TW": zhTW };
}

function localizedBadRequest(code: string, message: LocalizedText, details: Record<string, unknown>) {
  return new BadRequestException({ code, message, details });
}

function issueMessage(code: CatalogLocalizationIssueCode, field: string, locale: SupportedLocale): LocalizedText {
  const prefix = `${field} (${locale})`;
  const messages: Record<CatalogLocalizationIssueCode, LocalizedText> = {
    "invalid-localized-shape": localized(
      `${prefix} is not stored as a supported localized object.`,
      `${prefix} \u672a\u6309\u53d7\u652f\u6301\u7684\u591a\u8bed\u8a00\u5bf9\u8c61\u5165\u5e93\u3002`,
      `${prefix} \u672a\u6309\u53d7\u652f\u63f4\u7684\u591a\u8a9e\u8a00\u7269\u4ef6\u5165\u5eab\u3002`,
      `${prefix} tidak disimpan sebagai objek setempat yang disokong.`
    ),
    "missing-locale": localized(
      `${prefix} is missing required localized content.`,
      `${prefix} \u7f3a\u5c11\u5fc5\u8981\u7684\u591a\u8bed\u8a00\u5185\u5bb9\u3002`,
      `${prefix} \u7f3a\u5c11\u5fc5\u8981\u7684\u591a\u8a9e\u8a00\u5167\u5bb9\u3002`,
      `${prefix} tiada kandungan setempat yang wajib.`
    ),
    "non-cjk-locale-has-cjk-content": localized(
      `${prefix} contains CJK text and should be replaced with localized content.`,
      `${prefix} \u5305\u542b\u4e2d\u6587\u5185\u5bb9\uff0c\u9700\u8981\u66ff\u6362\u4e3a\u5bf9\u5e94\u8bed\u8a00\u7248\u672c\u3002`,
      `${prefix} \u5305\u542b\u4e2d\u6587\u5167\u5bb9\uff0c\u9700\u8981\u66ff\u63db\u70ba\u5c0d\u61c9\u8a9e\u8a00\u7248\u672c\u3002`,
      `${prefix} mengandungi teks CJK dan perlu diganti dengan kandungan setempat.`
    )
  };
  return messages[code];
}

function readField(record: CatalogRecord, field: string): unknown {
  return field.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
}

function isLocalizedPayload(value: unknown): value is LocalizedText | LocalizedStringArray {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasUnsupportedLocaleKey(value: LocalizedText | LocalizedStringArray): boolean {
  return Object.keys(value).some((key) => !SUPPORTED_LOCALES.includes(key as SupportedLocale));
}

function hasSupportedLocaleKey(value: LocalizedText | LocalizedStringArray): boolean {
  return Object.keys(value).some((key) => SUPPORTED_LOCALES.includes(key as SupportedLocale));
}

function hasAnyPayloadValue(value: LocalizedText | LocalizedStringArray): boolean {
  return Object.values(value).some((raw) => {
    if (Array.isArray(raw)) return raw.some((item) => Boolean(String(item || "").trim()));
    if (typeof raw === "string") return Boolean(raw.trim());
    return raw != null;
  });
}

function localeSamples(
  value: LocalizedText | LocalizedStringArray,
  locale: SupportedLocale,
  kind: CatalogLocalizationFieldKind
): string[] {
  const raw = value[locale];
  if (kind === "localized-array") {
    return Array.isArray(raw)
      ? raw.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
  }
  return typeof raw === "string" && raw.trim() ? [raw.trim()] : [];
}

function hasAnyLocalizedValue(value: LocalizedText | LocalizedStringArray): boolean {
  return SUPPORTED_LOCALES.some((locale) => {
    const raw = value[locale];
    if (Array.isArray(raw)) return raw.some((item) => Boolean(String(item || "").trim()));
    if (typeof raw === "string") return Boolean(raw.trim());
    return raw != null;
  });
}

function isLocaleValueShapeValid(
  value: LocalizedText | LocalizedStringArray,
  locale: SupportedLocale,
  kind: CatalogLocalizationFieldKind
): boolean {
  const raw = value[locale];
  if (raw == null) return true;
  return kind === "localized-array" ? Array.isArray(raw) : typeof raw === "string";
}

function hasCjkContent(value: string): boolean {
  return CJK_PATTERN.test(value);
}

function truncateSample(value: string | null): string | null {
  if (!value) return null;
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function countByCode(issues: CatalogLocalizationIssue[]): Record<CatalogLocalizationIssueCode, number> {
  const counts = { ...EMPTY_ISSUE_COUNTS };
  for (const issue of issues) counts[issue.code] += 1;
  return counts;
}

function countByLocale(issues: CatalogLocalizationIssue[]): Record<SupportedLocale, number> {
  const counts = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, 0])) as Record<SupportedLocale, number>;
  for (const issue of issues) counts[issue.locale] += 1;
  return counts;
}

function countByEntityType(
  issues: CatalogLocalizationIssue[]
): Record<Exclude<CatalogLocalizationEntityType, "all">, number> {
  const counts = { university: 0, program: 0 };
  for (const issue of issues) counts[issue.entityType] += 1;
  return counts;
}
