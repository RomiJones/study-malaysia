import { computed, reactive, ref } from "vue";
import { adminApi } from "@/api/admin";

export type FeeReviewIssueType = "all" | "missing_source" | "pending" | "conflict" | "unverified";

export interface FeeReviewProgram {
  id: number;
  code: string;
  name: Record<string, string>;
  nameEnOfficial: string;
  universityId: number;
  universityName: string;
  category: string;
  publicDisplayStatus: string;
  isPublished: boolean;
  annualTuitionCny: number;
  officialTuitionMYR: number | null;
  tuitionDisplay: string;
  officialFeeSourceUrl: string;
  officialFeeAuditStatus: string;
  officialFeeAuditedAt: string | null;
  filterableTuitionCny: number | null;
  hasVerifiedFee: boolean;
  feeConfidence: string;
  issueTypes: string[];
  updatedAt: string | null;
}

export interface FeeReviewSummary {
  total: number;
  missingSource: number;
  pending: number;
  conflict: number;
  unverified: number;
  verified: number;
}

export const feeReviewIssueOptions: Array<{ label: string; value: FeeReviewIssueType }> = [
  { label: "全部费用问题", value: "all" },
  { label: "缺费用来源 R002", value: "missing_source" },
  { label: "费用待复核 R003", value: "pending" },
  { label: "金额/来源冲突 R003", value: "conflict" },
  { label: "未核验费用", value: "unverified" }
];

export function useFeeReview() {
  const loading = ref(false);
  const items = ref<FeeReviewProgram[]>([]);
  const total = ref(0);
  const selectedRows = ref<FeeReviewProgram[]>([]);
  const summary = reactive<FeeReviewSummary>({
    total: 0,
    missingSource: 0,
    pending: 0,
    conflict: 0,
    unverified: 0,
    verified: 0
  });
  const filters = reactive({
    search: "",
    programId: "",
    universityId: "",
    category: "",
    issueType: "all" as FeeReviewIssueType,
    page: 1,
    pageSize: 20
  });
  const selectedIds = computed(() => selectedRows.value.map((row) => row.id));

  const fetchPrograms = async () => {
    loading.value = true;
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== "" && value !== null && value !== undefined)
      );
      const data = await adminApi.feeReviewPrograms(params);
      items.value = data.items || [];
      total.value = Number(data.total || 0);
      Object.assign(summary, normalizeSummary(data.summary || {}));
    } finally {
      loading.value = false;
    }
  };

  const resetAndFetch = async () => {
    filters.page = 1;
    await fetchPrograms();
  };

  const batchUpdate = async (payload: { feeAuditStatus: string; feeSourceUrl?: string; reviewNote?: string }) =>
    adminApi.batchFeeReview({
      programIds: selectedIds.value,
      ...payload
    });

  const setSelectedRows = (rows: FeeReviewProgram[]) => {
    selectedRows.value = rows;
  };

  return {
    loading,
    items,
    total,
    summary,
    filters,
    selectedRows,
    selectedIds,
    fetchPrograms,
    resetAndFetch,
    batchUpdate,
    setSelectedRows
  };
}

function normalizeSummary(value: Partial<FeeReviewSummary>): FeeReviewSummary {
  return {
    total: Number(value.total || 0),
    missingSource: Number(value.missingSource || 0),
    pending: Number(value.pending || 0),
    conflict: Number(value.conflict || 0),
    unverified: Number(value.unverified || 0),
    verified: Number(value.verified || 0)
  };
}
