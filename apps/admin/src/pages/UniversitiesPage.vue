<template>
  <section class="page-card" v-loading="loading">
    <div class="page-toolbar">
      <div class="page-toolbar__left">
        <el-input v-model="query.search" placeholder="搜索学校" clearable @change="load" />
        <el-select v-model="query.ownership" clearable placeholder="办学性质" @change="load">
          <el-option v-for="item in ownershipOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.published" clearable placeholder="发布状态" @change="load">
          <el-option label="已发布" value="true" />
          <el-option label="未发布" value="false" />
        </el-select>
        <el-select v-model="query.publicDisplayStatus" clearable placeholder="公开展示" @change="load">
          <el-option v-for="item in publicDisplayOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.officialSourceStatus" clearable placeholder="来源状态" @change="load">
          <el-option v-for="item in sourceStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
      <div class="page-toolbar__right">
        <el-button type="primary" :disabled="!canUpdate" @click="openCreate">新增学校</el-button>
      </div>
    </div>
    <el-table :data="items" border>
      <el-table-column prop="shortName" label="简称" width="100" />
      <el-table-column label="学校名称" min-width="220">
        <template #default="scope">{{ scope.row.name?.["zh-CN"] }}</template>
      </el-table-column>
      <el-table-column prop="ownership" label="性质" width="100">
        <template #default="scope">{{ optionLabel(ownershipOptions, scope.row.ownership) }}</template>
      </el-table-column>
      <el-table-column prop="qsRank" label="QS" width="90" />
      <el-table-column label="公开展示" min-width="150">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.publicDisplayStatus)">
            {{ optionLabel(publicDisplayOptions, scope.row.publicDisplayStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源状态" min-width="170">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.officialSourceStatus)">
            {{ optionLabel(sourceStatusOptions, scope.row.officialSourceStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="officialVerifiedAt" label="核验日期" width="120" />
      <el-table-column label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.isPublished ? 'success' : 'info'">{{ scope.row.isPublished ? "已发布" : "未发布" }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="scope">
          <div class="table-actions">
            <el-button link type="primary" :disabled="!canUpdate" @click="openEdit(scope.row)">编辑</el-button>
            <el-button link type="danger" :disabled="!canDelete" @click="remove(scope.row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      style="margin-top: 16px"
      layout="prev, pager, next, total"
      :total="total"
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      @current-change="load"
    />
  </section>

  <el-dialog v-model="visible" title="学校管理" width="1120px" top="4vh" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" status-icon>
      <el-tabs>
        <el-tab-pane label="基础信息">
          <div class="split-grid">
            <el-form-item label="Slug" prop="slug"><el-input v-model="form.slug" /></el-form-item>
            <el-form-item label="Code" prop="code"><el-input v-model="form.code" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="简称" prop="shortName"><el-input v-model="form.shortName" /></el-form-item>
            <el-form-item label="官网" prop="website"><el-input v-model="form.website" /></el-form-item>
          </div>
          <LocaleTextTabs v-model="form.name" label="学校名称" />
          <LocaleTextTabs v-model="form.description" label="学校简介" textarea :rows="4" />
          <LocaleTextTabs v-model="form.location" label="城市" />
          <LocaleTextTabs v-model="form.region" label="地区" />
          <LocaleListTabs v-model="form.highlights" label="学校亮点" />
          <LocaleListTabs v-model="form.facilities" label="设施与资源" />
          <div class="split-grid">
            <el-form-item label="Logo URL"><el-input v-model="form.logoUrl" /></el-form-item>
            <el-form-item label="封面图 URL"><el-input v-model="form.imageUrl" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="办学性质">
              <el-select v-model="form.ownership">
                <el-option v-for="item in ownershipOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="院校类型">
              <el-select v-model="form.institutionType">
                <el-option v-for="item in institutionTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="QS 排名"><el-input-number v-model="form.qsRank" :min="1" /></el-form-item>
            <el-form-item label="QS 亚洲排名"><el-input-number v-model="form.qsAsiaRank" :min="1" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="创立年份"><el-input-number v-model="form.foundedYear" :min="1800" /></el-form-item>
            <el-form-item label="颜色"><el-input v-model="form.color" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="学生总数"><el-input-number v-model="form.students" :min="0" /></el-form-item>
            <el-form-item label="国际生数"><el-input-number v-model="form.intlStudents" :min="0" /></el-form-item>
          </div>
        </el-tab-pane>

        <el-tab-pane label="官方档案">
          <div class="split-grid">
            <el-form-item label="官方英文名称"><el-input v-model="form.nameEnOfficial" /></el-form-item>
            <el-form-item label="官方官网"><el-input v-model="form.officialWebsite" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="学习门户 URL"><el-input v-model="form.studyPortalUrl" /></el-form-item>
            <el-form-item label="国际生页面 URL"><el-input v-model="form.internationalPageUrl" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="申请入口 URL"><el-input v-model="form.applicationPortalUrl" /></el-form-item>
            <el-form-item label="官方地址"><el-input v-model="form.officialAddress" /></el-form-item>
          </div>
          <el-form-item label="官方来源列表">
            <el-table :data="form.officialSources" border class="inline-edit-table">
              <el-table-column label="标题" min-width="150"><template #default="scope"><el-input v-model="scope.row.title" /></template></el-table-column>
              <el-table-column label="URL" min-width="220"><template #default="scope"><el-input v-model="scope.row.url" /></template></el-table-column>
              <el-table-column label="类型" width="150">
                <template #default="scope">
                  <el-select v-model="scope.row.sourceType">
                    <el-option v-for="item in sourceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="170">
                <template #default="scope">
                  <el-select v-model="scope.row.status">
                    <el-option v-for="item in sourceStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="核验日期" width="150">
                <template #default="scope"><el-date-picker v-model="scope.row.verifiedAt" type="date" value-format="YYYY-MM-DD" /></template>
              </el-table-column>
              <el-table-column label="备注" min-width="180"><template #default="scope"><el-input v-model="scope.row.note" /></template></el-table-column>
              <el-table-column label="操作" width="90"><template #default="scope"><el-button link type="danger" @click="removeSource(scope.$index)">删除</el-button></template></el-table-column>
            </el-table>
            <el-button class="inline-add-button" @click="addSource">新增来源</el-button>
          </el-form-item>
          <el-form-item label="官方档案 JSON"><el-input v-model="officialProfileText" type="textarea" :rows="5" /></el-form-item>
        </el-tab-pane>

        <el-tab-pane label="申请与费用">
          <div class="split-grid">
            <el-form-item label="年学费最低(CNY)"><el-input-number v-model="form.tuitionMinCny" :min="0" /></el-form-item>
            <el-form-item label="年学费最高(CNY)"><el-input-number v-model="form.tuitionMaxCny" :min="0" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="生活成本(CNY)"><el-input-number v-model="form.livingCostCny" :min="0" /></el-form-item>
            <el-form-item label="最低 IELTS"><el-input-number v-model="form.minIelts" :min="0" :max="9" :step="0.5" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="联系邮箱" prop="admissionEmail"><el-input v-model="form.admissionEmail" /></el-form-item>
            <el-form-item label="生活成本官方备注"><el-input v-model="form.livingCostOfficialNote" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="申请周期（每行一个）"><el-input v-model="applicationPeriodsText" type="textarea" :rows="4" /></el-form-item>
            <el-form-item label="申请费用（每行一个）"><el-input v-model="applicationFeesText" type="textarea" :rows="4" /></el-form-item>
          </div>
          <LocaleListTabs v-model="form.applicationDocuments" label="官方申请材料" />
          <LocaleListTabs v-model="form.chinaStudentRequirements" label="中国学生要求" />
          <div class="split-grid">
            <el-form-item label="接受无语言申请"><el-switch v-model="form.acceptNoLanguage" /></el-form-item>
            <el-form-item label="官方核验"><el-switch v-model="form.csrCertified" /></el-form-item>
          </div>
        </el-tab-pane>

        <el-tab-pane label="发布与审计">
          <div class="split-grid">
            <el-form-item label="发布状态"><el-switch v-model="form.isPublished" /></el-form-item>
            <el-form-item label="公开展示状态">
              <el-select v-model="form.publicDisplayStatus">
                <el-option v-for="item in publicDisplayOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="官方来源状态">
              <el-select v-model="form.officialSourceStatus">
                <el-option v-for="item in sourceStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="官方核验日期">
              <el-date-picker v-model="form.officialVerifiedAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
            </el-form-item>
          </div>
          <el-form-item label="官方审计摘要"><el-input v-model="form.officialAuditSummary" type="textarea" :rows="5" /></el-form-item>
        </el-tab-pane>
      </el-tabs>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!canUpdate" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from "element-plus";
import { adminApi } from "@/api/admin";
import LocaleTextTabs from "@/components/LocaleTextTabs.vue";
import LocaleListTabs from "@/components/LocaleListTabs.vue";
import { createLocaleArrayMap, createLocaleMap } from "@/utils/locale";
import { useAccess } from "@/utils/access";
import {
  createSourceLink,
  dictionaryOptions,
  formatLineList,
  hasSourceUrl,
  isValidUrl,
  normalizeNullableDate,
  normalizeSourceLinks,
  optionLabel,
  parseLineList,
  statusTagType,
  type DictionaryItem
} from "@/utils/adminOptions";

const { hasPermission } = useAccess();
const canUpdate = computed(() => hasPermission("school:update"));
const canDelete = computed(() => hasPermission("school:delete"));
const items = ref<any[]>([]);
const dictionaries = ref<DictionaryItem[]>([]);
const total = ref(0);
const visible = ref(false);
const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const officialProfileText = ref("");
const query = reactive({ page: 1, pageSize: 10, search: "", ownership: "", published: "", publicDisplayStatus: "", officialSourceStatus: "" });
const form = reactive<any>({});

const ownershipOptions = computed(() => dictionaryOptions(dictionaries.value, "institution_ownership"));
const institutionTypeOptions = computed(() => dictionaryOptions(dictionaries.value, "institution_type"));
const publicDisplayOptions = computed(() => dictionaryOptions(dictionaries.value, "public_display_status"));
const sourceStatusOptions = computed(() => dictionaryOptions(dictionaries.value, "official_source_status"));
const sourceTypeOptions = computed(() => dictionaryOptions(dictionaries.value, "source_type"));

const rules = reactive<FormRules>({
  slug: [{ required: true, message: "请输入 Slug", trigger: "blur" }],
  code: [{ required: true, message: "请输入 Code", trigger: "blur" }],
  shortName: [{ required: true, message: "请输入简称", trigger: "blur" }],
  website: [{ required: true, message: "请输入官网", trigger: "blur" }],
  admissionEmail: [{ required: true, message: "请输入联系邮箱", trigger: "blur" }]
});

const applicationPeriodsText = computed({
  get: () => formatLineList(form.applicationPeriods),
  set: (value: string) => {
    form.applicationPeriods = parseLineList(value);
  }
});

const applicationFeesText = computed({
  get: () => formatLineList(form.applicationFees),
  set: (value: string) => {
    form.applicationFees = parseLineList(value);
  }
});

const resetForm = () => {
  Object.assign(form, {
    id: undefined,
    slug: "",
    code: "",
    shortName: "",
    website: "",
    logoUrl: "",
    imageUrl: "",
    color: "#6C47FF",
    ownership: "public",
    institutionType: "research",
    qsRank: 100,
    qsAsiaRank: null,
    foundedYear: 2000,
    tuitionMinCny: 30000,
    tuitionMaxCny: 80000,
    livingCostCny: 30000,
    students: 0,
    intlStudents: 0,
    minIelts: 5.5,
    admissionEmail: "",
    acceptNoLanguage: false,
    csrCertified: false,
    isPublished: false,
    nameEnOfficial: "",
    officialWebsite: "",
    studyPortalUrl: "",
    internationalPageUrl: "",
    applicationPortalUrl: "",
    officialAddress: "",
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: createLocaleArrayMap(),
    chinaStudentRequirements: createLocaleArrayMap(),
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: null,
    officialSourceStatus: "needs-review",
    officialAuditSummary: "",
    publicDisplayStatus: "needs-review",
    livingCostOfficialNote: "",
    name: createLocaleMap(),
    description: createLocaleMap(),
    location: createLocaleMap(),
    region: createLocaleMap(),
    highlights: createLocaleArrayMap(),
    facilities: createLocaleArrayMap()
  });
  officialProfileText.value = "";
};

const loadDictionaries = async () => {
  try {
    dictionaries.value = await adminApi.dictionaries();
  } catch {
    dictionaries.value = [];
  }
};

const load = async () => {
  loading.value = true;
  try {
    const data = await adminApi.universities(query);
    items.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  resetForm();
  visible.value = true;
};

const openEdit = (row: any) => {
  resetForm();
  Object.assign(form, JSON.parse(JSON.stringify(row)));
  form.applicationDocuments ||= createLocaleArrayMap();
  form.chinaStudentRequirements ||= createLocaleArrayMap();
  form.applicationPeriods ||= [];
  form.applicationFees ||= [];
  form.officialSources = normalizeSourceLinks(form.officialSources);
  normalizeNumericFields();
  officialProfileText.value = form.officialProfile ? JSON.stringify(form.officialProfile, null, 2) : "";
  visible.value = true;
};

const addSource = () => {
  form.officialSources = [...normalizeSourceLinks(form.officialSources), createSourceLink(form.officialSourceStatus)];
};

const removeSource = (index: number) => {
  form.officialSources.splice(index, 1);
};

const save = async () => {
  if (!canUpdate.value) return;
  try {
    await formRef.value?.validate();
    const payload = buildPayload();
    validatePayload(payload);
    saving.value = true;
    await adminApi.saveUniversity(payload);
    ElMessage.success("已保存");
    visible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
};

const remove = async (row: any) => {
  if (!canDelete.value) return;
  await ElMessageBox.confirm(`确认删除 ${row.shortName}？`, "提示");
  try {
    await adminApi.deleteUniversity(row.id);
    ElMessage.success("已删除");
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
};

const normalizeNumericFields = () => {
  ["qsRank", "qsAsiaRank", "foundedYear", "tuitionMinCny", "tuitionMaxCny", "livingCostCny", "students", "intlStudents", "minIelts"].forEach((field) => {
    if (form[field] !== null && form[field] !== undefined && form[field] !== "") form[field] = Number(form[field]);
  });
};

const buildPayload = () => {
  const payload = JSON.parse(JSON.stringify(form));
  payload.officialSources = normalizeSourceLinks(payload.officialSources);
  payload.officialVerifiedAt = normalizeNullableDate(payload.officialVerifiedAt);
  payload.officialProfile = parseOfficialProfile();
  return payload;
};

const parseOfficialProfile = () => {
  const text = officialProfileText.value.trim();
  if (!text) return null;
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("官方档案 JSON 必须是对象");
  return parsed;
};

const validatePayload = (payload: any) => {
  if (!payload.name?.["zh-CN"]?.trim()) throw new Error("请填写学校中文名称");
  if (payload.tuitionMaxCny < payload.tuitionMinCny) throw new Error("年学费最高值不能小于最低值");
  if (payload.minIelts < 0 || payload.minIelts > 9) throw new Error("最低 IELTS 必须在 0 到 9 之间");
  const sourceReady = payload.publicDisplayStatus === "ready" || payload.officialSourceStatus === "official-verified";
  if (sourceReady && !payload.officialWebsite && !payload.website && !hasSourceUrl(payload.officialSources)) {
    throw new Error("可公开展示或官方已核验的学校必须至少填写一个官方来源 URL");
  }
  const urlFields = ["website", "logoUrl", "imageUrl", "officialWebsite", "studyPortalUrl", "internationalPageUrl", "applicationPortalUrl"];
  const invalidField = urlFields.find((field) => !isValidUrl(payload[field]));
  if (invalidField) throw new Error(`${invalidField} 不是有效的 HTTP/HTTPS URL`);
  const invalidSource = payload.officialSources.find((item: any) => !isValidUrl(item.url));
  if (invalidSource) throw new Error("官方来源列表中存在无效 URL");
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "请检查表单必填项");

onMounted(async () => {
  resetForm();
  await loadDictionaries();
  await load();
});
</script>
