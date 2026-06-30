export interface AdminOption {
  label: string;
  value: string;
}

export interface DictionaryItem {
  dictType: string;
  code: string;
  label: string;
  status?: "enabled" | "disabled";
  sortOrder?: number;
  extra?: Record<string, unknown> | null;
}

export interface SourceLink {
  title: string;
  url: string;
  sourceType: string;
  verifiedAt?: string | null;
  status?: string;
  note?: string | null;
}

export const DEFAULT_OPTIONS: Record<string, AdminOption[]> = {
  institution_ownership: [
    { label: "公立", value: "public" },
    { label: "私立", value: "private" }
  ],
  institution_type: [
    { label: "研究型", value: "research" },
    { label: "综合型", value: "comprehensive" },
    { label: "应用型", value: "applied" }
  ],
  degree_level: [
    { label: "本科", value: "bachelor" },
    { label: "硕士", value: "master" },
    { label: "博士", value: "phd" }
  ],
  program_category: [
    { label: "商科", value: "business" },
    { label: "IT", value: "it" },
    { label: "工科", value: "engineering" },
    { label: "理科", value: "science" },
    { label: "艺术", value: "arts" },
    { label: "医学", value: "medicine" },
    { label: "法学", value: "law" }
  ],
  public_display_status: [
    { label: "可公开展示", value: "ready" },
    { label: "不开放国际学生", value: "not-available-for-international" },
    { label: "待复核", value: "needs-review" },
    { label: "未核验隐藏", value: "hidden-unverified" },
    { label: "已归档", value: "archived" }
  ],
  official_source_status: [
    { label: "官方来源已核验", value: "official-verified" },
    { label: "官方页已核验但当前周期未开放", value: "official-page-verified-current-cycle-not-open" },
    { label: "官方页已核验但不开放", value: "official-page-verified-international-not-available" },
    { label: "待复核", value: "needs-review" },
    { label: "来源冲突", value: "source-conflict" },
    { label: "缺少官方来源", value: "missing-source" },
    { label: "重复或已替代隐藏", value: "hidden-duplicate-superseded" }
  ],
  fee_audit_status: [
    { label: "官方总学费一致", value: "matched-official" },
    { label: "官方费用表已核验", value: "fee-sheet-verified" },
    { label: "官方近似金额", value: "official-approximate" },
    { label: "仅官方费率已核验", value: "official-rate-verified" },
    { label: "按官方费率计算总额", value: "calculated-from-official-rate" },
    { label: "官方非单一金额", value: "official-non-scalar" },
    { label: "金额冲突", value: "conflict" },
    { label: "费用来源冲突", value: "source-conflict" },
    { label: "费用待复核", value: "pending-review" },
    { label: "官网未公布费用", value: "not-published" }
  ],
  tuition_currency: [
    { label: "MYR", value: "MYR" },
    { label: "CNY", value: "CNY" },
    { label: "USD", value: "USD" },
    { label: "未知", value: "UNKNOWN" }
  ],
  source_type: [
    { label: "官网", value: "official-website" },
    { label: "课程页", value: "profile" },
    { label: "学费", value: "fee" },
    { label: "入学要求", value: "entry-requirement" },
    { label: "认证", value: "accreditation" },
    { label: "招生", value: "admission" },
    { label: "学习门户", value: "study-portal" },
    { label: "其他", value: "other" }
  ],
  dictionary_type: [
    { label: "院校性质", value: "institution_ownership" },
    { label: "院校类型", value: "institution_type" },
    { label: "学位层级", value: "degree_level" },
    { label: "专业分类", value: "program_category" },
    { label: "公开展示状态", value: "public_display_status" },
    { label: "官方来源状态", value: "official_source_status" },
    { label: "费用审计状态", value: "fee_audit_status" },
    { label: "学费币种", value: "tuition_currency" },
    { label: "来源类型", value: "source_type" },
    { label: "申请状态", value: "application_status" },
    { label: "材料状态", value: "material_status" },
    { label: "签证状态", value: "visa_status" }
  ]
};

export function dictionaryOptions(items: DictionaryItem[], dictType: string): AdminOption[] {
  const options = items
    .filter((item) => item.dictType === dictType && item.status !== "disabled")
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((item) => ({ label: item.label, value: item.code }));

  return options.length ? options : DEFAULT_OPTIONS[dictType] || [];
}

export function optionLabel(options: AdminOption[], value?: string | null) {
  if (!value) return "-";
  return options.find((item) => item.value === value)?.label || value;
}

export function statusTagType(value?: string | null) {
  if (!value) return "info";
  if (["ready", "official-verified", "matched-official", "fee-sheet-verified", "official-rate-verified", "calculated-from-official-rate", "enabled"].includes(value)) return "success";
  if (["needs-review", "pending-review", "official-approximate", "official-non-scalar"].includes(value)) return "warning";
  if (["source-conflict", "conflict", "missing-source"].includes(value)) return "danger";
  return "info";
}

export function parseLineList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatLineList(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).join("\n") : "";
}

export function createSourceLink(status = "needs-review"): SourceLink {
  return { title: "", url: "", sourceType: "other", verifiedAt: null, status, note: "" };
}

export function normalizeSourceLinks(value: unknown): SourceLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      title: typeof item?.title === "string" ? item.title : "",
      url: typeof item?.url === "string" ? item.url : "",
      sourceType: typeof item?.sourceType === "string" ? item.sourceType : "other",
      verifiedAt: item?.verifiedAt || null,
      status: typeof item?.status === "string" ? item.status : "needs-review",
      note: item?.note || ""
    }))
    .filter((item) => item.url || item.title || item.note);
}

export function hasSourceUrl(value: unknown) {
  return Array.isArray(value) && value.some((item) => typeof item?.url === "string" && item.url.trim());
}

export function isValidUrl(value?: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeNullableDate(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
