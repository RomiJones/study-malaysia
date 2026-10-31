export interface QualityIssueRiskInput {
  ruleId?: string | null;
  entityType?: string | null;
  fieldPath?: string | null;
  message?: string | null;
}

export interface QualityFrontendRisk {
  title: string;
  summary: string;
  pages: string[];
  fields: string[];
  ability: string;
  severity: "high" | "medium" | "low";
}

const riskByRuleId: Record<string, QualityFrontendRisk> = {
  R001: {
    title: "Ready 院校缺少官方来源",
    summary: "Ready 院校缺官方来源，首页卡片和院校详情缺少官方依据，公开发布可信度不足。",
    pages: ["首页卡片", "院校详情", "对比", "推荐"],
    fields: ["officialSources", "officialWebsite", "website"],
    ability: "公开可信度",
    severity: "high"
  },
  R002: {
    title: "专业费用缺少官方来源",
    summary: "缺费用来源，专业列表学费不能作为可信预算筛选依据，规划和推荐成本判断会降级。",
    pages: ["专业列表", "专业详情弹窗", "对比", "规划", "推荐"],
    fields: ["officialFeeSourceUrl", "officialTuitionMYR", "tuitionCurrency"],
    ability: "预算筛选",
    severity: "high"
  },
  R003: {
    title: "专业费用仍待复核",
    summary: "费用待复核或存在冲突，前台只能按不可信费用展示，预算筛选和推荐置信度会下降。",
    pages: ["专业列表", "专业详情弹窗", "对比", "规划", "推荐"],
    fields: ["officialFeeAuditStatus", "officialFeeAuditedAt"],
    ability: "费用可信度",
    severity: "medium"
  },
  R004: {
    title: "专业分类不在启用字典内",
    summary: "分类不合法会影响专业筛选、院校详情分组和推荐匹配，用户可能无法按该方向找到专业。",
    pages: ["首页筛选", "专业列表", "院校详情", "推荐"],
    fields: ["category"],
    ability: "分类筛选",
    severity: "medium"
  },
  R005: {
    title: "多语言名称缺失",
    summary: "缺多语言名称，英文、马来文或繁体页面可能显示空值、fallback 或混入中文。",
    pages: ["首页卡片", "院校详情", "专业列表", "专业详情弹窗", "收藏", "对比"],
    fields: ["name"],
    ability: "多语言展示",
    severity: "low"
  },
  R006: {
    title: "英文名称包含中文",
    summary: "英文名称含中文，英文和马来文界面可能混入中文，影响国际用户阅读和搜索。",
    pages: ["首页卡片", "院校详情", "专业列表", "专业详情弹窗", "收藏", "对比"],
    fields: ["name.en"],
    ability: "英文展示",
    severity: "low"
  }
};

const defaultRisk: QualityFrontendRisk = {
  title: "目录质量风险",
  summary: "该问题会影响公开目录展示或后台发布判断，请按字段定位后复检。",
  pages: ["用户端目录", "管理端发布流程"],
  fields: [],
  ability: "目录治理",
  severity: "medium"
};

export function qualityIssueFrontendRisk(issue: QualityIssueRiskInput): QualityFrontendRisk {
  const ruleId = String(issue.ruleId || "");
  if (riskByRuleId[ruleId]) return riskByRuleId[ruleId];

  const fieldPath = String(issue.fieldPath || "");
  if (fieldPath.includes("officialFee")) return riskByRuleId.R002;
  if (fieldPath.includes("officialSource") || fieldPath.includes("officialSources")) return riskByRuleId.R001;
  if (fieldPath.includes("category")) return riskByRuleId.R004;
  if (fieldPath.includes("name")) return fieldPath.includes(".en") ? riskByRuleId.R006 : riskByRuleId.R005;
  if (fieldPath.includes("publicDisplayStatus") || fieldPath.includes("isPublished")) {
    return {
      title: "公开状态影响发布",
      summary: "公开状态不满足条件时，院校或专业会从列表、详情、收藏、对比、规划和推荐入口隐藏。",
      pages: ["首页卡片", "院校详情", "专业列表", "收藏", "对比", "规划", "推荐"],
      fields: ["isPublished", "publicDisplayStatus"],
      ability: "公开发布",
      severity: "high"
    };
  }

  return {
    ...defaultRisk,
    fields: fieldPath ? [fieldPath] : []
  };
}

export function feeReviewFrontendRisk(issueTypes: string[] = []): QualityFrontendRisk {
  if (issueTypes.includes("missing_source")) return riskByRuleId.R002;
  if (issueTypes.includes("conflict")) {
    return {
      ...riskByRuleId.R003,
      title: "费用金额或来源冲突",
      summary: "费用金额或来源冲突，专业列表、规划和推荐不能把该费用作为可信预算依据。"
    };
  }
  if (issueTypes.includes("pending")) return riskByRuleId.R003;
  if (issueTypes.includes("unverified")) {
    return {
      title: "费用尚未核验",
      summary: "费用未核验时，前台不会把该费用作为可靠筛选值，预算筛选和推荐结果会降低置信度。",
      pages: ["专业列表", "专业详情弹窗", "对比", "规划", "推荐"],
      fields: ["officialFeeAuditStatus", "officialFeeSourceUrl"],
      ability: "费用可信度",
      severity: "medium"
    };
  }
  return defaultRisk;
}

export function qualityRiskTagType(risk: QualityFrontendRisk) {
  if (risk.severity === "high") return "danger";
  if (risk.severity === "medium") return "warning";
  return "info";
}
