<template>
  <div class="fee-review-page">
    <section class="fee-review-hero">
      <div>
        <div class="fee-review-hero__eyebrow">R002 / R003 费用问题处理</div>
        <h1>费用复核工作台</h1>
        <p>集中处理 officialFeeSourceUrl 缺失、officialFeeAuditStatus 待复核和冲突状态，复核后同步触发单条质量检查。</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="fetchPrograms">刷新</el-button>
    </section>

    <section class="metrics-grid fee-review-metrics">
      <div class="metric-card">
        <div class="metric-card__label">专业总数</div>
        <div class="metric-card__value">{{ summary.total }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card__label">缺费用来源 R002</div>
        <div class="metric-card__value danger">{{ summary.missingSource }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card__label">费用待复核 R003</div>
        <div class="metric-card__value warning">{{ summary.pending }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card__label">冲突 R003</div>
        <div class="metric-card__value danger">{{ summary.conflict }}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card__label">已可参与筛选</div>
        <div class="metric-card__value success">{{ summary.verified }}</div>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar fee-review-toolbar">
        <div class="page-toolbar__left">
          <el-radio-group v-model="filters.issueType" @change="handleFilterChange">
            <el-radio-button v-for="item in feeReviewIssueOptions" :key="item.value" :label="item.value">{{ item.label }}</el-radio-button>
          </el-radio-group>
          <el-input v-model="filters.search" clearable placeholder="搜索专业、学校或 Code" @change="handleFilterChange" />
          <el-select v-model="filters.universityId" clearable filterable placeholder="学校" @change="handleFilterChange">
            <el-option v-for="item in universities" :key="item.id" :label="item.shortName || item.nameEnOfficial" :value="String(item.id)" />
          </el-select>
          <el-select v-model="filters.category" clearable filterable placeholder="专业分类" @change="handleFilterChange">
            <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
      </div>
    </section>

    <section class="page-card">
      <div class="fee-review-batch">
        <div class="fee-review-batch__meta">
          <strong>批量复核</strong>
          <span>已选择 {{ selectedIds.length }} 个专业</span>
        </div>
        <el-select v-model="batchForm.feeAuditStatus" placeholder="复核状态">
          <el-option v-for="item in reviewableFeeAuditOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="batchForm.feeSourceUrl" clearable placeholder="统一 officialFeeSourceUrl（可选）" />
        <el-input v-model="batchForm.reviewNote" clearable placeholder="复核备注（写入操作日志）" />
        <el-button type="primary" :loading="batchSaving" :disabled="!canUpdate || selectedIds.length === 0" @click="submitBatchReview">
          批量确认
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="items"
        border
        row-key="id"
        class="fee-review-table"
        @selection-change="setSelectedRows"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column label="专业" min-width="260" show-overflow-tooltip>
          <template #default="scope">
            <div class="fee-review-program">
              <strong>{{ scope.row.nameEnOfficial || scope.row.name?.["zh-CN"] || scope.row.code }}</strong>
              <span>{{ scope.row.universityName || "-" }} / {{ scope.row.code }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="问题类型" min-width="190">
          <template #default="scope">
            <div class="issue-tags">
              <el-tag v-for="item in scope.row.issueTypes" :key="item" :type="issueTypeTagType(item)" effect="plain">
                {{ issueTypeLabel(item) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="前台风险" min-width="310">
          <template #default="scope">
            <div class="quality-risk-cell quality-risk-cell--compact">
              <div class="quality-risk-cell__title">
                <el-tag size="small" :type="qualityRiskTagType(feeReviewFrontendRisk(scope.row.issueTypes))" effect="plain">
                  {{ feeReviewFrontendRisk(scope.row.issueTypes).ability }}
                </el-tag>
                <strong>{{ feeReviewFrontendRisk(scope.row.issueTypes).title }}</strong>
              </div>
              <span>{{ feeReviewFrontendRisk(scope.row.issueTypes).summary }}</span>
              <small>影响页面：{{ feeReviewFrontendRisk(scope.row.issueTypes).pages.join("、") }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="官方学费" min-width="170">
          <template #default="scope">
            <div>{{ scope.row.tuitionDisplay || formatMyr(scope.row.officialTuitionMYR) || "-" }}</div>
            <div class="muted">CNY {{ formatNumber(scope.row.filterableTuitionCny || scope.row.annualTuitionCny) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="费用状态" min-width="170">
          <template #default="scope">
            <el-tag :type="statusTagType(scope.row.officialFeeAuditStatus)">
              {{ optionLabel(feeAuditOptions, scope.row.officialFeeAuditStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="费用来源" min-width="220" show-overflow-tooltip>
          <template #default="scope">
            <a v-if="scope.row.officialFeeSourceUrl" :href="scope.row.officialFeeSourceUrl" target="_blank" rel="noreferrer">
              {{ scope.row.officialFeeSourceUrl }}
            </a>
            <span v-else class="muted">缺少 officialFeeSourceUrl</span>
          </template>
        </el-table-column>
        <el-table-column label="公开状态" min-width="160">
          <template #default="scope">
            <el-tag :type="statusTagType(scope.row.publicDisplayStatus)" effect="plain">
              {{ optionLabel(publicDisplayOptions, scope.row.publicDisplayStatus) }}
            </el-tag>
            <el-tag class="published-tag" :type="scope.row.isPublished ? 'success' : 'info'" effect="plain">
              {{ scope.row.isPublished ? "已发布" : "未发布" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <div class="table-actions">
              <el-button link type="primary" :disabled="!canUpdate" @click="openFeeDialog(scope.row)">复核</el-button>
              <RouterLink :to="{ path: '/programs', query: { editId: scope.row.id, focus: 'officialFeeAuditStatus' } }">
                <el-button link>去修复</el-button>
              </RouterLink>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-pagination">
        <el-pagination
          v-model:current-page="filters.page"
          v-model:page-size="filters.pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[10, 20, 50]"
          @size-change="fetchPrograms"
          @current-change="fetchPrograms"
        />
      </div>
    </section>

    <el-dialog v-model="feeDialogVisible" title="费用快速复核" width="680px">
      <el-form ref="feeFormRef" :model="feeForm" :rules="feeRules" label-width="150px">
        <el-form-item label="专业">
          <div class="fee-review-dialog-title">
            <strong>{{ activeProgram?.nameEnOfficial || activeProgram?.name?.["zh-CN"] || "-" }}</strong>
            <span>{{ activeProgram?.universityName || "-" }}</span>
          </div>
        </el-form-item>
        <el-form-item label="官方学费 MYR" prop="officialTuitionMYR">
          <el-input-number v-model="feeForm.officialTuitionMYR" :min="0" :precision="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="展示文案">
          <el-input v-model="feeForm.tuitionDisplay" placeholder="例如 RM 20,000 / year" />
        </el-form-item>
        <el-form-item label="费用审计状态" prop="feeAuditStatus">
          <el-select v-model="feeForm.feeAuditStatus" filterable>
            <el-option v-for="item in reviewableFeeAuditOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="费用来源 URL" prop="feeSourceUrl">
          <el-input v-model="feeForm.feeSourceUrl" placeholder="officialFeeSourceUrl" />
        </el-form-item>
        <el-form-item label="费用备注">
          <el-input v-model="feeForm.feeSourceNote" type="textarea" :rows="3" placeholder="officialTuitionNote" />
        </el-form-item>
        <el-form-item label="复核备注">
          <el-input v-model="feeForm.reviewNote" type="textarea" :rows="2" placeholder="写入操作日志，不影响前端展示" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="feeSaving" @click="submitFeeDetail">保存并复检</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Refresh } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { adminApi } from "@/api/admin";
import {
  feeReviewIssueOptions,
  useFeeReview,
  type FeeReviewIssueType,
  type FeeReviewProgram
} from "@/composables/useFeeReview";
import { DEFAULT_OPTIONS, dictionaryOptions, optionLabel, statusTagType, type AdminOption, type DictionaryItem } from "@/utils/adminOptions";
import { feeReviewFrontendRisk, qualityRiskTagType } from "@/utils/qualityRisk";
import { useAuthStore } from "@/stores/auth";

interface UniversityOption {
  id: number;
  shortName: string;
  nameEnOfficial: string;
}

interface FeeDetail extends FeeReviewProgram {
  feeSourceNote?: string | null;
  officialTuitionNote?: string | null;
  feeDisplayText?: string;
}

const FILTERABLE_STATUSES = ["matched-official", "fee-sheet-verified", "calculated-from-official-rate"];
const SOURCE_REQUIRED_STATUSES = [
  "matched-official",
  "fee-sheet-verified",
  "official-approximate",
  "official-rate-verified",
  "calculated-from-official-rate",
  "official-non-scalar"
];
const REVIEWABLE_STATUSES = [
  "matched-official",
  "fee-sheet-verified",
  "calculated-from-official-rate",
  "official-approximate",
  "official-rate-verified",
  "official-non-scalar",
  "not-published"
];

const route = useRoute();
const auth = useAuthStore();
const {
  loading,
  items,
  total,
  summary,
  filters,
  selectedIds,
  fetchPrograms,
  resetAndFetch,
  batchUpdate,
  setSelectedRows
} = useFeeReview();
const canUpdate = computed(() => auth.hasPermission("program:update"));
const universities = ref<UniversityOption[]>([]);
const dictionaries = ref<DictionaryItem[]>([]);
const batchSaving = ref(false);
const feeDialogVisible = ref(false);
const feeSaving = ref(false);
const feeFormRef = ref<FormInstance>();
const activeProgram = ref<FeeReviewProgram | null>(null);
const batchForm = reactive({
  feeAuditStatus: "fee-sheet-verified",
  feeSourceUrl: "",
  reviewNote: ""
});
const feeForm = reactive({
  officialTuitionMYR: null as number | null,
  tuitionDisplay: "",
  feeAuditStatus: "fee-sheet-verified",
  feeSourceUrl: "",
  feeSourceNote: "",
  reviewNote: ""
});
const feeRules = reactive<FormRules>({
  feeAuditStatus: [{ required: true, message: "请选择费用审计状态", trigger: "change" }]
});

const feeAuditOptions = computed(() => dictionaryOptions(dictionaries.value, "fee_audit_status"));
const publicDisplayOptions = computed(() => dictionaryOptions(dictionaries.value, "public_display_status"));
const categoryOptions = computed(() => dictionaryOptions(dictionaries.value, "program_category"));
const reviewableFeeAuditOptions = computed<AdminOption[]>(() => {
  const source = feeAuditOptions.value.length ? feeAuditOptions.value : DEFAULT_OPTIONS.fee_audit_status;
  return source.filter((item) => REVIEWABLE_STATUSES.includes(item.value));
});

const handleFilterChange = () => {
  filters.programId = "";
  void resetAndFetch();
};

const submitBatchReview = async () => {
  if (!canUpdate.value || selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(`确认批量复核 ${selectedIds.value.length} 个专业？`, "批量费用复核", { type: "warning" });
  } catch {
    return;
  }

  batchSaving.value = true;
  try {
    const result = await batchUpdate({
      feeAuditStatus: batchForm.feeAuditStatus,
      feeSourceUrl: batchForm.feeSourceUrl,
      reviewNote: batchForm.reviewNote
    });
    const skipped = Number(result.skipped?.length || 0);
    const errors = Number(result.errors?.length || 0);
    ElMessage.success(`已更新 ${result.updated || 0} 个专业，跳过 ${skipped} 个，失败 ${errors} 个`);
    await fetchPrograms();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    batchSaving.value = false;
  }
};

const openFeeDialog = async (row: FeeReviewProgram) => {
  activeProgram.value = row;
  feeDialogVisible.value = true;
  feeSaving.value = true;
  try {
    const detail = await adminApi.feeReviewDetail(row.id) as FeeDetail;
    activeProgram.value = detail;
    Object.assign(feeForm, {
      officialTuitionMYR: detail.officialTuitionMYR,
      tuitionDisplay: detail.tuitionDisplay || detail.feeDisplayText || "",
      feeAuditStatus: REVIEWABLE_STATUSES.includes(detail.officialFeeAuditStatus) ? detail.officialFeeAuditStatus : "fee-sheet-verified",
      feeSourceUrl: detail.officialFeeSourceUrl || "",
      feeSourceNote: detail.feeSourceNote || detail.officialTuitionNote || "",
      reviewNote: ""
    });
  } catch (error) {
    ElMessage.error(errorMessage(error));
    feeDialogVisible.value = false;
  } finally {
    feeSaving.value = false;
  }
};

const submitFeeDetail = async () => {
  if (!activeProgram.value || !canUpdate.value) return;
  try {
    await feeFormRef.value?.validate();
    validateFeeInput(feeForm.feeAuditStatus, feeForm.officialTuitionMYR, feeForm.feeSourceUrl);
  } catch (error) {
    ElMessage.warning(errorMessage(error));
    return;
  }

  feeSaving.value = true;
  try {
    await adminApi.updateFeeReviewDetail(activeProgram.value.id, {
      officialTuitionMYR: feeForm.officialTuitionMYR,
      tuitionDisplay: feeForm.tuitionDisplay,
      feeAuditStatus: feeForm.feeAuditStatus,
      feeSourceUrl: feeForm.feeSourceUrl,
      feeSourceNote: feeForm.feeSourceNote,
      reviewNote: feeForm.reviewNote
    });
    ElMessage.success("已保存并重新检查该专业");
    feeDialogVisible.value = false;
    await fetchPrograms();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    feeSaving.value = false;
  }
};

const loadOptions = async () => {
  const [universityData, dictionaryData] = await Promise.all([
    adminApi.universities({ pageSize: 500 }),
    adminApi.dictionaries()
  ]);
  universities.value = (universityData.items || []).map((item: Record<string, unknown>) => ({
    id: Number(item.id),
    shortName: String(item.shortName || ""),
    nameEnOfficial: String(item.nameEnOfficial || "")
  }));
  dictionaries.value = dictionaryData || [];
};

const applyRouteQuery = () => {
  const issueType = route.query.issueType;
  const programId = route.query.programId;
  if (typeof issueType === "string" && feeReviewIssueOptions.some((item) => item.value === issueType)) {
    filters.issueType = issueType as FeeReviewIssueType;
  }
  if (typeof programId === "string" && programId) {
    filters.programId = programId;
  }
};

const issueTypeLabel = (type: string) => {
  if (type === "missing_source") return "缺费用来源";
  if (type === "pending") return "待复核";
  if (type === "conflict") return "冲突";
  if (type === "unverified") return "未核验";
  return type || "-";
};

const issueTypeTagType = (type: string) => {
  if (type === "missing_source" || type === "conflict") return "danger";
  if (type === "pending") return "warning";
  return "info";
};

const formatMyr = (value?: number | null) => {
  if (!value) return "";
  return `RM ${formatNumber(value)}`;
};

const formatNumber = (value?: number | null) => {
  if (!value) return "-";
  return Math.round(value).toLocaleString("zh-CN");
};

const validateFeeInput = (status: string, officialTuitionMYR: number | null, feeSourceUrl: string) => {
  if (FILTERABLE_STATUSES.includes(status) && !officialTuitionMYR) {
    throw new Error("官方核验费用需要填写官方学费 MYR");
  }
  if (SOURCE_REQUIRED_STATUSES.includes(status) && !feeSourceUrl.trim()) {
    throw new Error("该费用状态需要填写 officialFeeSourceUrl");
  }
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "操作失败");

watch(
  () => [route.query.issueType, route.query.programId],
  async () => {
    applyRouteQuery();
    await resetAndFetch();
  }
);

onMounted(async () => {
  applyRouteQuery();
  try {
    await loadOptions();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
  await fetchPrograms();
});
</script>

<style scoped>
.fee-review-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fee-review-hero {
  align-items: flex-start;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  padding: 20px;
}

.fee-review-hero h1 {
  color: #111827;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  margin: 4px 0 8px;
}

.fee-review-hero p {
  color: #6b7280;
  margin: 0;
}

.fee-review-hero__eyebrow {
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
}

.fee-review-metrics {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.metric-card__value.danger {
  color: #dc2626;
}

.metric-card__value.warning {
  color: #d97706;
}

.metric-card__value.success {
  color: #16a34a;
}

.fee-review-toolbar :deep(.el-radio-group) {
  flex-wrap: wrap;
}

.fee-review-batch {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: 160px 220px minmax(240px, 1fr) minmax(180px, 260px) 110px;
  margin-bottom: 14px;
}

.fee-review-batch__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fee-review-batch__meta span,
.muted {
  color: #6b7280;
  font-size: 12px;
}

.fee-review-program,
.fee-review-dialog-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fee-review-program span,
.fee-review-dialog-title span {
  color: #6b7280;
  font-size: 12px;
}

.issue-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.published-tag {
  margin-left: 6px;
}

.fee-review-table {
  width: 100%;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

@media (max-width: 1180px) {
  .fee-review-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .fee-review-batch {
    grid-template-columns: 1fr;
  }
}
</style>
