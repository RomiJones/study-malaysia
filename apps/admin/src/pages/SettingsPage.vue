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
            <div class="section-subtitle">基于当前管理端院校与专业数据计算，帮助定位缺少官方来源、费用来源和待复核状态的数据。</div>
          </div>
          <el-button type="primary" :disabled="!canRefreshImport" @click="refreshImportOverview">刷新校验</el-button>
        </div>
        <el-alert v-if="importError" :title="importError" type="warning" show-icon :closable="false" />
        <div v-else>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-card__label">院校总数</div>
              <div class="metric-card__value">{{ importOverview.universityTotal }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">专业总数</div>
              <div class="metric-card__value">{{ importOverview.programTotal }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">Ready 专业</div>
              <div class="metric-card__value">{{ importOverview.readyProgramCount }}</div>
            </div>
            <div class="metric-card">
              <div class="metric-card__label">待复核问题</div>
              <div class="metric-card__value">{{ importOverview.issueCount }}</div>
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
          <div class="section-subtitle import-checked-at">最近校验：{{ importOverview.checkedAt || "-" }}</div>
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
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { adminApi } from "@/api/admin";
import { useAccess } from "@/utils/access";
import { DEFAULT_OPTIONS, dictionaryOptions, statusTagType, type DictionaryItem } from "@/utils/adminOptions";

const route = useRoute();
const { hasPermission } = useAccess();
const canUpdate = computed(() => hasPermission("settings:update"));
const canViewLogs = computed(() => hasPermission("log:view"));
const canRefreshImport = computed(() => hasPermission("school:view") && hasPermission("program:view"));
const activeTab = ref(typeof route.query.tab === "string" ? route.query.tab : "configs");
const configs = ref<any[]>([]);
const dictionaries = ref<DictionaryItem[]>([]);
const logs = ref<any[]>([]);
const logsTotal = ref(0);
const loading = ref(false);
const logsLoading = ref(false);
const importLoading = ref(false);
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
  programTotal: 0,
  readyProgramCount: 0,
  issueCount: 0,
  missingProgramSourceCount: 0,
  missingFeeSourceCount: 0,
  missingStatusCount: 0,
  needsReviewCount: 0,
  publicDisplayCounts: {} as Record<string, number>,
  feeAuditCounts: {} as Record<string, number>
});
const importError = ref("");

const dictionaryTypeOptions = computed(() => {
  const fromDictionary = dictionaryOptions(dictionaries.value, "dictionary_type");
  return fromDictionary.length ? fromDictionary : DEFAULT_OPTIONS.dictionary_type;
});
const filteredDictionaries = computed(() => (dictFilter.value ? dictionaries.value.filter((item) => item.dictType === dictFilter.value) : dictionaries.value));
const issueRows = computed(() => [
  { label: "缺少发布或审计状态", count: importOverview.missingStatusCount, hint: "补齐公开展示、来源状态和费用审计状态" },
  { label: "Ready 专业缺少官方来源", count: importOverview.missingProgramSourceCount, hint: "补充专业页、入学要求或来源列表 URL" },
  { label: "官方学费缺少费用来源", count: importOverview.missingFeeSourceCount, hint: "补充官方学费来源 URL 后再标记费用审计" },
  { label: "待复核状态数据", count: importOverview.needsReviewCount, hint: "检查公开展示、来源状态和费用审计状态" }
]);
const statusRows = computed(() => {
  const publicRows = Object.entries(importOverview.publicDisplayCounts).map(([status, count]) => ({ type: "公开展示", status, count }));
  const feeRows = Object.entries(importOverview.feeAuditCounts).map(([status, count]) => ({ type: "费用审计", status, count }));
  return [...publicRows, ...feeRows];
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
    importError.value = "当前账号缺少学校或专业查看权限，无法计算导入校验概览。";
    return;
  }
  importLoading.value = true;
  try {
    const [universitiesData, programsData] = await Promise.all([
      fetchAllAdminItems((params) => adminApi.universities(params)),
      fetchAllAdminItems((params) => adminApi.programs(params))
    ]);
    const programs = programsData.items || [];
    const missingProgramSourceCount = programs.filter((item: any) => item.publicDisplayStatus === "ready" && !hasProgramSource(item)).length;
    const missingFeeSourceCount = programs.filter((item: any) => needsFeeSource(item) && !item.officialFeeSourceUrl).length;
    const missingStatusCount = programs.filter((item: any) => !item.publicDisplayStatus || !item.officialSourceStatus || !item.officialFeeAuditStatus).length;
    const needsReviewCount = programs.filter(
      (item: any) => item.publicDisplayStatus === "needs-review" || item.officialSourceStatus === "needs-review" || item.officialFeeAuditStatus === "pending-review"
    ).length;
    Object.assign(importOverview, {
      checkedAt: new Date().toLocaleString("zh-CN"),
      universityTotal: universitiesData.total ?? universitiesData.items?.length ?? 0,
      programTotal: programsData.total ?? programs.length,
      readyProgramCount: programs.filter((item: any) => item.publicDisplayStatus === "ready").length,
      issueCount: missingStatusCount + missingProgramSourceCount + missingFeeSourceCount + needsReviewCount,
      missingProgramSourceCount,
      missingFeeSourceCount,
      missingStatusCount,
      needsReviewCount,
      publicDisplayCounts: countBy(programs, "publicDisplayStatus"),
      feeAuditCounts: countBy(programs, "officialFeeAuditStatus")
    });
  } catch (error) {
    importError.value = errorMessage(error);
  } finally {
    importLoading.value = false;
  }
};

const fetchAllAdminItems = async (loader: (params: Record<string, unknown>) => Promise<any>) => {
  const pageSize = 50;
  const firstPage = await loader({ page: 1, pageSize });
  const total = Number(firstPage.total || firstPage.items?.length || 0);
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return firstPage;
  const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => loader({ page: index + 2, pageSize })));
  return {
    ...firstPage,
    total,
    items: [firstPage, ...rest].flatMap((page) => page.items || [])
  };
};

const parseExtraJson = () => {
  const text = dictExtraText.value.trim();
  if (!text) return null;
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Extra JSON 必须是对象");
  return parsed;
};

const hasProgramSource = (item: any) =>
  Boolean(item.officialSourceUrl || item.officialEntryRequirementSourceUrl || item.officialAccreditationSourceUrl || item.sourceUrls?.some((source: any) => source?.url));

const needsFeeSource = (item: any) =>
  item.officialFeeAuditStatus === "matched-official" || item.tuitionCurrency === "MYR" || item.officialTuitionMYR !== null && item.officialTuitionMYR !== undefined;

const countBy = (items: any[], field: string) =>
  items.reduce<Record<string, number>>((result, item) => {
    const key = item[field] || "empty";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "请检查表单必填项");

onMounted(async () => {
  await load();
  await Promise.all([loadLogs(), refreshImportOverview()]);
});
</script>
