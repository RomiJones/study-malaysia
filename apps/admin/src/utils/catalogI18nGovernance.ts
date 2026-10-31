export type CatalogI18nEntityType = "university" | "program";
export type CatalogI18nEntityFilter = "all" | CatalogI18nEntityType;
export type CatalogI18nLocale = "en" | "ms" | "zh-CN" | "zh-TW";
export type CatalogI18nIssueCode =
  | "invalid-localized-shape"
  | "missing-locale"
  | "non-cjk-locale-has-cjk-content";
export type CatalogI18nSeverity = "high" | "medium" | "low";

export interface CatalogI18nIssue {
  entityType: CatalogI18nEntityType;
  entityId: number;
  slug: string;
  code: CatalogI18nIssueCode | string;
  field: string;
  locale: CatalogI18nLocale;
  severity: "error" | "warning" | string;
  message: string;
  sample: string | null;
  publicDisplayStatus: string;
  isPublished: boolean;
}

export interface CatalogI18nRisk {
  title: string;
  summary: string;
  ability: string;
  pages: string[];
  severity: CatalogI18nSeverity;
}

export interface CatalogI18nFieldOption {
  entityType: CatalogI18nEntityType;
  field: string;
  value: string;
  label: string;
  pages: string[];
}

export interface CatalogI18nSummary {
  scanned: { universities: number; programs: number; total: number };
  issues: {
    total: number;
    returned: number;
    byCode: Record<CatalogI18nIssueCode, number>;
    byLocale: Record<CatalogI18nLocale, number>;
    byEntityType: Record<CatalogI18nEntityType, number>;
  };
  completeRecords: { universities: number; programs: number; total: number };
}

export interface CatalogI18nReport {
  summary: CatalogI18nSummary;
  issues: CatalogI18nIssue[];
}

export const CATALOG_I18N_LOCALE_OPTIONS = [
  { label: "English", value: "en" },
  { label: "Bahasa Melayu", value: "ms" },
  { label: "简体中文", value: "zh-CN" },
  { label: "繁體中文", value: "zh-TW" }
] as const;

export const CATALOG_I18N_ENTITY_OPTIONS = [
  { label: "全部实体", value: "all" },
  { label: "学校", value: "university" },
  { label: "专业", value: "program" }
] as const;

export const CATALOG_I18N_FIELD_OPTIONS: CatalogI18nFieldOption[] = [
  {
    entityType: "university",
    field: "name",
    value: "university.name",
    label: "学校名称",
    pages: ["首页卡片", "院校详情", "收藏", "对比", "推荐"]
  },
  {
    entityType: "university",
    field: "description",
    value: "university.description",
    label: "学校简介",
    pages: ["院校详情", "对比", "推荐"]
  },
  {
    entityType: "university",
    field: "highlights",
    value: "university.highlights",
    label: "学校亮点",
    pages: ["首页卡片", "院校详情", "对比"]
  },
  {
    entityType: "university",
    field: "facilities",
    value: "university.facilities",
    label: "设施与资源",
    pages: ["院校详情", "对比"]
  },
  {
    entityType: "university",
    field: "location",
    value: "university.location",
    label: "城市",
    pages: ["首页卡片", "院校详情", "专业列表", "对比", "推荐"]
  },
  {
    entityType: "university",
    field: "region",
    value: "university.region",
    label: "地区",
    pages: ["首页卡片", "院校详情", "专业列表", "对比", "推荐"]
  },
  {
    entityType: "university",
    field: "applicationDocuments",
    value: "university.applicationDocuments",
    label: "学校申请材料",
    pages: ["院校详情", "规划", "会员申请"]
  },
  {
    entityType: "university",
    field: "chinaStudentRequirements",
    value: "university.chinaStudentRequirements",
    label: "中国学生要求",
    pages: ["院校详情", "规划", "会员申请"]
  },
  {
    entityType: "program",
    field: "name",
    value: "program.name",
    label: "专业名称",
    pages: ["专业列表", "专业详情弹窗", "收藏", "对比", "规划", "推荐"]
  },
  {
    entityType: "program",
    field: "description",
    value: "program.description",
    label: "专业简介",
    pages: ["专业详情弹窗", "对比", "推荐"]
  },
  {
    entityType: "program",
    field: "faculty",
    value: "program.faculty",
    label: "学院",
    pages: ["专业列表", "专业详情弹窗", "院校详情", "推荐"]
  },
  {
    entityType: "program",
    field: "applicationDocs",
    value: "program.applicationDocs",
    label: "申请材料",
    pages: ["专业详情弹窗", "规划", "会员申请"]
  },
  {
    entityType: "program",
    field: "curriculum",
    value: "program.curriculum",
    label: "课程结构",
    pages: ["专业详情弹窗", "对比", "推荐"]
  },
  {
    entityType: "program",
    field: "careers",
    value: "program.careers",
    label: "就业方向",
    pages: ["专业详情弹窗", "对比", "推荐"]
  },
  {
    entityType: "program",
    field: "specializations",
    value: "program.specializations",
    label: "方向与特色",
    pages: ["专业详情弹窗", "对比", "推荐"]
  },
  {
    entityType: "program",
    field: "requirement.note",
    value: "program.requirement.note",
    label: "入学要求备注",
    pages: ["专业详情弹窗", "规划", "会员申请", "推荐"]
  }
];

const emptyIssueCodeCounts: Record<CatalogI18nIssueCode, number> = {
  "invalid-localized-shape": 0,
  "missing-locale": 0,
  "non-cjk-locale-has-cjk-content": 0
};

const emptyLocaleCounts: Record<CatalogI18nLocale, number> = {
  en: 0,
  ms: 0,
  "zh-CN": 0,
  "zh-TW": 0
};

const emptyEntityCounts: Record<CatalogI18nEntityType, number> = {
  university: 0,
  program: 0
};

export function normalizeCatalogI18nReport(raw: any): CatalogI18nReport {
  const summary = raw?.summary || {};
  const issues = Array.isArray(raw?.issues) ? raw.issues : [];
  return {
    summary: {
      scanned: normalizeTotalGroup(summary.scanned, "universities", "programs"),
      issues: {
        total: numberValue(summary.issues?.total),
        returned: numberValue(summary.issues?.returned ?? issues.length),
        byCode: normalizeCounts(summary.issues?.byCode, emptyIssueCodeCounts),
        byLocale: normalizeCounts(summary.issues?.byLocale, emptyLocaleCounts),
        byEntityType: normalizeCounts(summary.issues?.byEntityType, emptyEntityCounts)
      },
      completeRecords: normalizeTotalGroup(summary.completeRecords, "universities", "programs")
    },
    issues: issues.map(normalizeIssue)
  };
}

export function catalogI18nFieldOptions(entityType: CatalogI18nEntityFilter) {
  return CATALOG_I18N_FIELD_OPTIONS.filter((option) => entityType === "all" || option.entityType === entityType);
}

export function catalogI18nFieldLabel(issueOrField: Pick<CatalogI18nIssue, "entityType" | "field"> | string, entityType?: CatalogI18nEntityType) {
  const field = typeof issueOrField === "string" ? issueOrField : issueOrField.field;
  const targetEntity = typeof issueOrField === "string" ? entityType : issueOrField.entityType;
  return fieldOption(field, targetEntity)?.label || field || "-";
}

export function catalogI18nIssueCodeLabel(code: string) {
  const labels: Record<string, string> = {
    "invalid-localized-shape": "字段结构异常",
    "missing-locale": "缺失语言",
    "non-cjk-locale-has-cjk-content": "中文泄漏"
  };
  return labels[code] || code || "-";
}

export function catalogI18nLocaleLabel(locale: string) {
  return CATALOG_I18N_LOCALE_OPTIONS.find((option) => option.value === locale)?.label || locale || "-";
}

export function catalogI18nEntityLabel(entityType: string) {
  return entityType === "university" ? "学校" : entityType === "program" ? "专业" : entityType || "-";
}

export function catalogI18nFrontendRisk(issue: Pick<CatalogI18nIssue, "code" | "entityType" | "field" | "locale" | "publicDisplayStatus">): CatalogI18nRisk {
  const option = fieldOption(issue.field, issue.entityType);
  const pages = option?.pages || ["用户端目录", "管理端发布流程"];
  const fieldLabel = option?.label || issue.field || "业务字段";
  const readyPrefix = issue.publicDisplayStatus === "ready" ? "Ready 数据" : "目录数据";

  if (issue.code === "invalid-localized-shape") {
    return {
      title: "多语言字段结构异常",
      summary: `${fieldLabel} 不是可稳定读取的四语言对象或数组，前台可能触发异常 fallback，后台 Locale 编辑器也无法可靠维护。`,
      ability: "读取稳定性",
      pages,
      severity: "high"
    };
  }

  if (issue.code === "non-cjk-locale-has-cjk-content") {
    return {
      title: "英文/马来文字段中文泄漏",
      summary: `${readyPrefix}的 ${catalogI18nLocaleLabel(issue.locale)} ${fieldLabel} 含中文，英文或马来文页面、对比和推荐解释可能混入中文。`,
      ability: "语言一致性",
      pages,
      severity: issue.publicDisplayStatus === "ready" ? "high" : "medium"
    };
  }

  return {
    title: "业务数据缺失语言",
    summary: `${readyPrefix}缺少 ${catalogI18nLocaleLabel(issue.locale)} ${fieldLabel}，前台可能显示空值、其它语言 fallback 或官方页面提示。`,
    ability: "业务多语言",
    pages,
    severity: issue.publicDisplayStatus === "ready" ? "high" : "medium"
  };
}

export function catalogI18nRiskTagType(risk: CatalogI18nRisk) {
  if (risk.severity === "high") return "danger";
  if (risk.severity === "medium") return "warning";
  return "info";
}

export function catalogI18nIssueRoute(issue: Pick<CatalogI18nIssue, "entityType" | "entityId" | "field">) {
  return {
    path: issue.entityType === "university" ? "/universities" : "/programs",
    query: {
      ...(issue.entityId ? { editId: issue.entityId } : {}),
      ...(issue.field ? { focus: issue.field } : {})
    }
  };
}

function normalizeIssue(raw: any): CatalogI18nIssue {
  const entityType = raw?.entityType === "university" ? "university" : "program";
  const locale = isCatalogLocale(raw?.locale) ? raw.locale : "zh-CN";
  const code = String(raw?.code || "missing-locale");
  return {
    entityType,
    entityId: numberValue(raw?.entityId),
    slug: String(raw?.slug || ""),
    code,
    field: String(raw?.field || raw?.fieldPath || ""),
    locale,
    severity: String(raw?.severity || "warning"),
    message: localizedMessage(raw?.message, code),
    sample: raw?.sample ? String(raw.sample) : null,
    publicDisplayStatus: String(raw?.publicDisplayStatus || ""),
    isPublished: Boolean(raw?.isPublished)
  };
}

function fieldOption(field: string, entityType?: CatalogI18nEntityType) {
  return CATALOG_I18N_FIELD_OPTIONS.find((option) => {
    const fieldMatches = option.field === field || option.value === field;
    const entityMatches = !entityType || option.entityType === entityType;
    return fieldMatches && entityMatches;
  });
}

function localizedMessage(message: unknown, fallbackCode: string) {
  if (typeof message === "string") return message;
  if (message && typeof message === "object") {
    const map = message as Record<string, unknown>;
    return String(map["zh-CN"] || map.en || map.ms || map["zh-TW"] || catalogI18nIssueCodeLabel(fallbackCode));
  }
  return catalogI18nIssueCodeLabel(fallbackCode);
}

function normalizeTotalGroup(raw: any, firstKey: "universities", secondKey: "programs") {
  const first = numberValue(raw?.[firstKey]);
  const second = numberValue(raw?.[secondKey]);
  return {
    [firstKey]: first,
    [secondKey]: second,
    total: numberValue(raw?.total ?? first + second)
  } as { universities: number; programs: number; total: number };
}

function normalizeCounts<T extends string>(raw: any, empty: Record<T, number>): Record<T, number> {
  const counts = { ...empty };
  for (const key of Object.keys(counts) as T[]) counts[key] = numberValue(raw?.[key]);
  return counts;
}

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function isCatalogLocale(value: unknown): value is CatalogI18nLocale {
  return value === "en" || value === "ms" || value === "zh-CN" || value === "zh-TW";
}
