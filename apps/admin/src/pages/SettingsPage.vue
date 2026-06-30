<template>
  <el-tabs v-model="activeTab">
    <el-tab-pane label="系统配置" name="configs">
      <section class="page-card" v-loading="loading">
        <div class="page-toolbar">
          <div class="page-toolbar__left">
            <el-select v-model="configCategory" clearable filterable allow-create placeholder="配置分类" @change="loadConfigs">
              <el-option label="站点" value="site" />
              <el-option label="上传" value="upload" />
              <el-option label="申请" value="application" />
              <el-option label="导入校验" value="import" />
            </el-select>
          </div>
          <div class="page-toolbar__right">
            <el-button type="primary" :disabled="!canUpdate" @click="openConfig">新增配置</el-button>
          </div>
        </div>
        <el-table :data="configs" border>
          <el-table-column prop="category" label="分类" width="120" />
          <el-table-column prop="configKey" label="Key" min-width="160" />
          <el-table-column prop="label" label="名称" min-width="140" />
          <el-table-column prop="value" label="值" min-width="220" show-overflow-tooltip />
          <el-table-column label="公开" width="90">
            <template #default="scope"><el-tag :type="scope.row.isPublic ? 'success' : 'info'">{{ scope.row.isPublic ? "是" : "否" }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="scope"><el-button link type="primary" :disabled="!canUpdate" @click="editConfig(scope.row)">编辑</el-button></template>
          </el-table-column>
        </el-table>
      </section>
    </el-tab-pane>

    <el-tab-pane label="字典项" name="dictionaries">
      <section class="page-card" v-loading="loading">
        <div class="page-toolbar">
          <div class="page-toolbar__left">
            <el-select v-model="dictFilter" clearable filterable allow-create placeholder="字典类型">
              <el-option v-for="item in dictionaryTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </div>
          <div class="page-toolbar__right">
            <el-button type="primary" :disabled="!canUpdate" @click="openDict">新增字典</el-button>
          </div>
        </div>
        <el-table :data="filteredDictionaries" border max-height="640">
          <el-table-column prop="dictType" label="类型" min-width="160" />
          <el-table-column prop="code" label="Code" min-width="150" />
          <el-table-column prop="label" label="标签" min-width="150" />
          <el-table-column label="状态" width="100">
            <template #default="scope"><el-tag :type="statusTagType(scope.row.status)">{{ scope.row.status }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="sortOrder" label="排序" width="90" />
          <el-table-column label="Extra" min-width="220" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.extra ? JSON.stringify(scope.row.extra) : "-" }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="scope"><el-button link type="primary" :disabled="!canUpdate" @click="editDict(scope.row)">编辑</el-button></template>
          </el-table-column>
        </el-table>
      </section>
    </el-tab-pane>

    <el-tab-pane label="导入校验" name="import">
      <section class="page-card" v-loading="importLoading">
        <div class="page-toolbar">
          <div>
            <strong>静态 HTML 导入质量概览</strong>
            <div class="section-subtitle">由后台质量引擎统一计算，帮助定位缺少官方来源、费用来源和待复核状态的数据。</div>
          </div>
          <div class="page-toolbar__right">
            <el-button :disabled="!canRefreshImport" @click="refreshImportOverview">刷新校验</el-button>
            <el-button type="primary" :loading="qualityRunning" :disabled="!canRunQualityCheck" @click="runFullQualityCheck">运行全量检查</el-button>
          </div>
        </div>
        <el-alert v-if="importError" :title="importError" type="warning" show-icon :closable="false" />
        <div v-else>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-card__label">院校总数</div>
              <div class="metric-card__value">{{ importOverview.universityTotal }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">公开院校</div>
              <div class="metric-card__value">{{ importOverview.publicUniversityCount }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">专业总数</div>
              <div class="metric-card__value">{{ importOverview.programTotal }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">公开专业</div>
              <div class="metric-card__value">{{ importOverview.publicProgramCount }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">Ready 专业</div>
              <div class="metric-card__value">{{ importOverview.readyProgramCount }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">待复核问题</div>
              <div class="metric-card__value">{{ importOverview.issueCount }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">High 问题</div>
              <div class="metric-card__value">{{ importOverview.issueSeverityCounts.high || 0 }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">Medium 问题</div>
              <div class="metric-card__value">{{ importOverview.issueSeverityCounts.medium || 0 }}</div>
            </div>
          </div>
          <div class="split-grid">
            <el-table :data="issueRows" border>
              <el-table-column prop="label" label="校验项" min-width="200" />
              <el-table-column prop="count" label="数量" width="100" />
              <el-table-column prop="hint" label="处理建议" min-width="240" />
            </el-table>
            <el-table :data="statusRows" border>
              <el-table-column prop="type" label="分布类型" width="130" />
              <el-table-column prop="status" label="状态" min-width="170" />
              <el-table-column prop="count" label="数量" width="100" />
            </el-table>
          </div>
          <div class="section-subtitle import-issue-title">待处理数据</div>
          <el-table :data="catalogIssues" border max-height="460" empty-text="暂无待处理问题">
            <el-table-column label="等级" width="90">
              <template #default="scope"><el-tag :type="severityTagType(scope.row.severity)">{{ severityLabel(scope.row.severity) }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="ruleName" label="规则" min-width="190" />
            <el-table-column prop="targetLabel" label="对象" min-width="240" show-overflow-tooltip />
            <el-table-column label="字段" min-width="140">
              <template #default="scope">{{ scope.row.fieldPath || "-" }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="scope"><el-tag :type="issueStatusTagType(scope.row.status)">{{ issueStatusLabel(scope.row.status) }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="message" label="问题描述" min-width="300" show-overflow-tooltip />
            <el-table-column label="检测时间" min-width="160">
              <template #default="scope">{{ formatCheckedAt(scope.row.detectedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="scope">
                <div class="table-actions">
                  <RouterLink v-if="isFeeQualityIssue(scope.row)" :to="feeReviewRoute(scope.row)">
                    <el-button link type="primary">费用工作台</el-button>
                  </RouterLink>
                  <RouterLink :to="issueTargetRoute(scope.row)"><el-button link type="primary">去编辑</el-button></RouterLink>
                  <el-button link type="warning" :disabled="!canUpdate || scope.row.status === 'ignored'" @click="updateQualityIssue(scope.row, 'ignored')">忽略</el-button>
                  <el-button link type="success" :disabled="!canUpdate || scope.row.status === 'resolved'" @click="updateQualityIssue(scope.row, 'resolved')">已解决</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-alert
            v-if="hasMoreCatalogIssues"
            class="import-issue-limit"
            type="info"
            :title="`当前仅显示前 ${catalogIssueLimit} 条问题，请用院校或专业筛选继续处理。`"
            show-icon
            :closable="false"
          />
          <div class="section-subtitle import-checked-at">最近校验：{{ formatCheckedAt(importOverview.checkedAt) }}</div>
        </div>
      </section>
    </el-tab-pane>

    <el-tab-pane label="操作日志" name="logs">
      <section class="page-card" v-loading="logsLoading">
        <div class="page-toolbar">
          <div class="page-toolbar__left">
            <el-input v-model="logQuery.search" placeholder="搜索摘要或对象" clearable @change="loadLogs" />
            <el-select v-model="logQuery.module" clearable placeholder="模块" @change="loadLogs">
              <el-option label="学校" value="school" />
              <el-option label="专业" value="program" />
              <el-option label="内容" value="content" />
              <el-option label="设置" value="settings" />
              <el-option label="申请" value="application" />
            </el-select>
          </div>
        </div>
        <el-alert v-if="!canViewLogs" title="当前账号缺少操作日志查看权限" type="warning" show-icon :closable="false" />
        <el-table v-else :data="logs" border>
          <el-table-column prop="createdAt" label="时间" min-width="180" />
          <el-table-column prop="module" label="模块" width="120" />
          <el-table-column prop="action" label="动作" width="120" />
          <el-table-column prop="summary" label="摘要" min-width="240" />
          <el-table-column label="操作人" width="140">
            <template #default="scope">{{ scope.row.adminUser?.displayName || "system" }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-if="canViewLogs"
          style="margin-top: 16px"
          layout="prev, pager, next, total"
          :total="logsTotal"
          v-model:current-page="logQuery.page"
          v-model:page-size="logQuery.pageSize"
          @current-change="loadLogs"
        />
      </section>
    </el-tab-pane>
  </el-tabs>

  <el-dialog v-model="configVisible" title="系统配置" width="620px" destroy-on-close>
    <el-form ref="configFormRef" :model="configForm" :rules="configRules" label-position="top" status-icon>
      <div class="split-grid">
        <el-form-item label="分类" prop="category"><el-input v-model="configForm.category" /></el-form-item>
        <el-form-item label="Key" prop="configKey"><el-input v-model="configForm.configKey" /></el-form-item>
      </div>
      <el-form-item label="名称" prop="label"><el-input v-model="configForm.label" /></el-form-item>
      <el-form-item label="值" prop="value"><el-input v-model="configForm.value" type="textarea" :rows="4" /></el-form-item>
      <el-form-item label="说明"><el-input v-model="configForm.description" /></el-form-item>
      <div class="split-grid">
        <el-form-item label="排序"><el-input-number v-model="configForm.sortOrder" :min="0" /></el-form-item>
        <el-form-item label="公开读取"><el-switch v-model="configForm.isPublic" /></el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="configVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingConfig" :disabled="!canUpdate" @click="saveConfig">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="dictVisible" title="字典项" width="620px" destroy-on-close>
    <el-form ref="dictFormRef" :model="dictForm" :rules="dictRules" label-position="top" status-icon>
      <div class="split-grid">
        <el-form-item label="类型" prop="dictType">
          <el-select v-model="dictForm.dictType" filterable allow-create>
            <el-option v-for="item in dictionaryTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="Code" prop="code"><el-input v-model="dictForm.code" /></el-form-item>
      </div>
      <el-form-item label="标签" prop="label"><el-input v-model="dictForm.label" /></el-form-item>
      <div class="split-grid">
        <el-form-item label="状态">
          <el-select v-model="dictForm.status">
            <el-option label="enabled" value="enabled" />
            <el-option label="disabled" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="dictForm.sortOrder" :min="0" /></el-form-item>
      </div>
      <el-form-item label="Extra JSON"><el-input v-model="dictExtraText" type="textarea" :rows="4" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dictVisible = false">取消</el-button>
      <el-button type="primary" :loading="savingDict" :disabled="!canUpdate" @click="saveDict">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { adminApi } from "@/api/admin";
import { useAccess } from "@/utils/access";
import { DEFAULT_OPTIONS, dictionaryOptions, statusTagType, type DictionaryItem } from "@/utils/adminOptions";

const route = useRoute();
const { hasPermission } = useAccess();
const canUpdate = computed(() => hasPermission("settings:update"));
const canViewLogs = computed(() => hasPermission("log:view"));
const canRefreshImport = computed(() => hasPermission("settings:view") && hasPermission("school:view") && hasPermission("program:view"));
const canRunQualityCheck = computed(() => canUpdate.value && canRefreshImport.value);
const activeTab = ref(typeof route.query.tab === "string" ? route.query.tab : "configs");
const configs = ref<any[]>([]);
const dictionaries = ref<DictionaryItem[]>([]);
const logs = ref<any[]>([]);
const logsTotal = ref(0);
const loading = ref(false);
const logsLoading = ref(false);
const importLoading = ref(false);
const qualityRunning = ref(false);
const savingConfig = ref(false);
const savingDict = ref(false);
const configVisible = ref(false);
const dictVisible = ref(false);
const configCategory = ref("");
const dictFilter = ref("");
const dictExtraText = ref("");
const configFormRef = ref<FormInstance>();
const dictFormRef = ref<FormInstance>();
const configForm = reactive<any>({ id: undefined, category: "site", configKey: "", label: "", value: "", description: "", sortOrder: 0, isPublic: false });
const dictForm = reactive<any>({ id: undefined, dictType: "", code: "", label: "", status: "enabled", sortOrder: 0, extra: null });
const logQuery = reactive({ page: 1, pageSize: 20, search: "", module: "" });
const importOverview = reactive({
  checkedAt: "",
  universityTotal: 0,
  publicUniversityCount: 0,
  programTotal: 0,
  publicProgramCount: 0,
  readyProgramCount: 0,
  officialVerifiedUniversityCount: 0,
  officialVerifiedProgramCount: 0,
  issueCount: 0,
  missingUniversitySourceCount: 0,
  missingProgramSourceCount: 0,
  missingFeeSourceCount: 0,
  missingStatusCount: 0,
  needsReviewCount: 0,
  feeIssueCount: 0,
  missingLanguageCount: 0,
  issueSeverityCounts: {} as Record<string, number>,
  universityPublicDisplayCounts: {} as Record<string, number>,
  programPublicDisplayCounts: {} as Record<string, number>,
  publicDisplayCounts: {} as Record<string, number>,
  universitySourceStatusCounts: {} as Record<string, number>,
  programSourceStatusCounts: {} as Record<string, number>,
  feeAuditCounts: {} as Record<string, number>
});
const importError = ref("");
const catalogIssues = ref<any[]>([]);
const catalogIssueLimit = ref(0);
const hasMoreCatalogIssues = ref(false);

const dictionaryTypeOptions = computed(() => {
  const fromDictionary = dictionaryOptions(dictionaries.value, "dictionary_type");
  return fromDictionary.length ? fromDictionary : DEFAULT_OPTIONS.dictionary_type;
});
const filteredDictionaries = computed(() => (dictFilter.value ? dictionaries.value.filter((item) => item.dictType === dictFilter.value) : dictionaries.value));
const issueRows = computed(() => [
  { label: "High 级未处理问题", count: importOverview.issueSeverityCounts.high || 0, hint: "处理后才允许发布为 Ready" },
  { label: "Ready 院校缺少官方来源", count: importOverview.missingUniversitySourceCount, hint: "补充官网或官方来源链接后再保持 Ready 展示" },
  { label: "官方费用相关问题", count: importOverview.feeIssueCount, hint: "处理费用来源缺失、费用冲突和待审核状态" },
  { label: "多语言名称缺失", count: importOverview.missingLanguageCount, hint: "补齐四语言名称，避免前端多语言展示缺口" },
  { label: "待复核状态数据", count: importOverview.needsReviewCount, hint: "检查公开展示、来源状态和费用审计状态" }
]);
const statusRows = computed(() => {
  const universityPublicRows = Object.entries(importOverview.universityPublicDisplayCounts).map(([status, count]) => ({ type: "院校展示", status, count }));
  const programPublicRows = Object.entries(importOverview.programPublicDisplayCounts).map(([status, count]) => ({ type: "专业展示", status, count }));
  const sourceRows = Object.entries(importOverview.programSourceStatusCounts).map(([status, count]) => ({ type: "专业来源", status, count }));
  const feeRows = Object.entries(importOverview.feeAuditCounts).map(([status, count]) => ({ type: "费用审计", status, count }));
  return [...universityPublicRows, ...programPublicRows, ...sourceRows, ...feeRows];
});

const configRules = reactive<FormRules>({
  category: [{ required: true, message: "请输入分类", trigger: "blur" }],
  configKey: [{ required: true, message: "请输入 Key", trigger: "blur" }],
  label: [{ required: true, message: "请输入名称", trigger: "blur" }],
  value: [{ required: true, message: "请输入值", trigger: "blur" }]
});
const dictRules = reactive<FormRules>({
  dictType: [{ required: true, message: "请输入类型", trigger: "change" }],
  code: [{ required: true, message: "请输入 Code", trigger: "blur" }],
  label: [{ required: true, message: "请输入标签", trigger: "blur" }]
});

watch(
  () => route.query.tab,
  (tab) => {
    if (typeof tab === "string") activeTab.value = tab;
  }
);

const load = async () => {
  loading.value = true;
  try {
    await Promise.all([loadConfigs(), loadDictionaries()]);
  } finally {
    loading.value = false;
  }
};

const loadConfigs = async () => {
  try {
    configs.value = await adminApi.configs(configCategory.value || undefined);
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
};

const loadDictionaries = async () => {
  try {
    dictionaries.value = await adminApi.dictionaries();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
};

const loadLogs = async () => {
  if (!canViewLogs.value) return;
  logsLoading.value = true;
  try {
    const data = await adminApi.logs(logQuery);
    logs.value = data.items;
    logsTotal.value = data.total;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    logsLoading.value = false;
  }
};

const openConfig = () => {
  Object.assign(configForm, { id: undefined, category: configCategory.value || "site", configKey: "", label: "", value: "", description: "", sortOrder: 0, isPublic: false });
  configVisible.value = true;
};

const editConfig = (row: any) => {
  Object.assign(configForm, JSON.parse(JSON.stringify(row)));
  configVisible.value = true;
};

const saveConfig = async () => {
  if (!canUpdate.value) return;
  try {
    await configFormRef.value?.validate();
    savingConfig.value = true;
    await adminApi.saveConfig(configForm);
    ElMessage.success("已保存");
    configVisible.value = false;
    await loadConfigs();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    savingConfig.value = false;
  }
};

const openDict = () => {
  Object.assign(dictForm, { id: undefined, dictType: dictFilter.value || "program_category", code: "", label: "", status: "enabled", sortOrder: 0, extra: null });
  dictExtraText.value = "";
  dictVisible.value = true;
};

const editDict = (row: any) => {
  Object.assign(dictForm, JSON.parse(JSON.stringify(row)));
  dictExtraText.value = dictForm.extra ? JSON.stringify(dictForm.extra, null, 2) : "";
  dictVisible.value = true;
};

const saveDict = async () => {
  if (!canUpdate.value) return;
  try {
    await dictFormRef.value?.validate();
    savingDict.value = true;
    const payload = { ...dictForm, extra: parseExtraJson() };
    await adminApi.saveDictionary(payload);
    ElMessage.success("已保存");
    dictVisible.value = false;
    await loadDictionaries();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    savingDict.value = false;
  }
};

const refreshImportOverview = async () => {
  importError.value = "";
  if (!canRefreshImport.value) {
    importError.value = "当前账号缺少设置、学校或专业查看权限，无法读取导入校验概览。";
    return;
  }
  importLoading.value = true;
  try {
    const data = await adminApi.catalogQuality();
    Object.assign(importOverview, normalizeImportOverview(data.overview || {}));
    catalogIssues.value = data.issues || [];
    catalogIssueLimit.value = Number(data.issueLimit || 0);
    hasMoreCatalogIssues.value = Boolean(data.hasMoreIssues);
  } catch (error) {
    importError.value = errorMessage(error);
    catalogIssues.value = [];
    hasMoreCatalogIssues.value = false;
  } finally {
    importLoading.value = false;
  }
};

const runFullQualityCheck = async () => {
  if (!canRunQualityCheck.value) return;
  try {
    await ElMessageBox.confirm("将重新扫描全部院校和专业，并刷新待处理质量问题。确认继续？", "运行全量质量检查", { type: "warning" });
  } catch {
    return;
  }
  qualityRunning.value = true;
  importError.value = "";
  try {
    const result = await adminApi.runCatalogQualityCheck();
    ElMessage.success(`已生成 ${result.generated || 0} 条待处理问题`);
    await refreshImportOverview();
  } catch (error) {
    importError.value = errorMessage(error);
  } finally {
    qualityRunning.value = false;
  }
};

const updateQualityIssue = async (issue: any, status: "resolved" | "ignored") => {
  if (!canUpdate.value) return;
  try {
    await adminApi.updateQualityIssueStatus(issue.id, status);
    ElMessage.success(status === "resolved" ? "已标记为解决" : "已忽略");
    await refreshImportOverview();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
};

const parseExtraJson = () => {
  const text = dictExtraText.value.trim();
  if (!text) return null;
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Extra JSON 必须是对象");
  return parsed;
};

const normalizeImportOverview = (overview: any) => ({
  checkedAt: overview.checkedAt || "",
  universityTotal: Number(overview.universityTotal || 0),
  publicUniversityCount: Number(overview.publicUniversityCount || 0),
  programTotal: Number(overview.programTotal || 0),
  publicProgramCount: Number(overview.publicProgramCount || 0),
  readyProgramCount: Number(overview.readyProgramCount || 0),
  officialVerifiedUniversityCount: Number(overview.officialVerifiedUniversityCount || 0),
  officialVerifiedProgramCount: Number(overview.officialVerifiedProgramCount || 0),
  issueCount: Number(overview.issueCount || 0),
  missingUniversitySourceCount: Number(overview.missingUniversitySourceCount || 0),
  missingProgramSourceCount: Number(overview.missingProgramSourceCount || 0),
  missingFeeSourceCount: Number(overview.missingFeeSourceCount || 0),
  missingStatusCount: Number(overview.missingStatusCount || 0),
  needsReviewCount: Number(overview.needsReviewCount || 0),
  feeIssueCount: Number(overview.feeIssueCount || 0),
  missingLanguageCount: Number(overview.missingLanguageCount || 0),
  issueSeverityCounts: overview.issueSeverityCounts || {},
  universityPublicDisplayCounts: overview.universityPublicDisplayCounts || {},
  programPublicDisplayCounts: overview.programPublicDisplayCounts || overview.publicDisplayCounts || {},
  publicDisplayCounts: overview.publicDisplayCounts || {},
  universitySourceStatusCounts: overview.universitySourceStatusCounts || {},
  programSourceStatusCounts: overview.programSourceStatusCounts || {},
  feeAuditCounts: overview.feeAuditCounts || {}
});

const issueTargetRoute = (issue: any) => ({
  path: issue.entityType === "university" ? "/universities" : "/programs",
  query: {
    ...(issue.searchKeyword ? { search: issue.searchKeyword } : {}),
    ...(issue.entityId ? { editId: issue.entityId } : {}),
    ...(issue.fieldPath ? { focus: issue.fieldPath } : {})
  }
});

const isFeeQualityIssue = (issue: any) => issue.entityType === "program" && ["R002", "R003"].includes(issue.ruleId);

const feeReviewRoute = (issue: any) => ({
  path: "/fee-review",
  query: {
    issueType: feeReviewIssueType(issue),
    ...(issue.entityId ? { programId: issue.entityId } : {})
  }
});

const feeReviewIssueType = (issue: any) => {
  if (issue.ruleId === "R002") return "missing_source";
  const message = String(issue.message || "").toLowerCase();
  return message.includes("conflict") || message.includes("冲突") || message.includes("source-conflict") ? "conflict" : "pending";
};

const severityLabel = (severity: string) => ({ high: "High", medium: "Medium", low: "Low", error: "错误", warning: "提醒" }[severity] || severity || "-");
const severityTagType = (severity: string) => {
  if (severity === "high" || severity === "error") return "danger";
  if (severity === "medium" || severity === "warning") return "warning";
  return "info";
};
const issueStatusLabel = (status: string) => ({ open: "待处理", resolved: "已解决", ignored: "已忽略" }[status] || status || "-");
const issueStatusTagType = (status: string) => {
  if (status === "resolved") return "success";
  if (status === "ignored") return "info";
  return "warning";
};

const formatCheckedAt = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "请检查表单必填项");

onMounted(async () => {
  await load();
  await Promise.all([loadLogs(), refreshImportOverview()]);
});
</script>
