<template>
  <section class="page-card" v-loading="loading">
    <div class="page-toolbar">
      <div class="page-toolbar__left">
        <el-input v-model="query.search" placeholder="搜索专业" clearable @change="load" />
        <el-select v-model="query.universityId" clearable filterable placeholder="学校" @change="load">
          <el-option v-for="item in universities" :key="item.id" :label="item.shortName" :value="item.id" />
        </el-select>
        <el-select v-model="query.level" clearable placeholder="层级" @change="load">
          <el-option v-for="item in levelOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.category" clearable filterable placeholder="学科" @change="load">
          <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.publicDisplayStatus" clearable placeholder="公开展示" @change="load">
          <el-option v-for="item in publicDisplayOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.feeAuditStatus" clearable placeholder="费用审计" @change="load">
          <el-option v-for="item in feeAuditOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
      <div class="page-toolbar__right">
        <el-button type="primary" :disabled="!canUpdate" @click="openCreate">新增专业</el-button>
      </div>
    </div>
    <el-table :data="items" border>
      <el-table-column label="专业名称" min-width="240">
        <template #default="scope">{{ scope.row.name?.["zh-CN"] }}</template>
      </el-table-column>
      <el-table-column prop="code" label="Code" width="130" />
      <el-table-column label="学校" min-width="140">
        <template #default="scope">{{ scope.row.university?.shortName }}</template>
      </el-table-column>
      <el-table-column label="层级" width="90">
        <template #default="scope">{{ optionLabel(levelOptions, scope.row.level) }}</template>
      </el-table-column>
      <el-table-column label="学科" width="130">
        <template #default="scope">{{ optionLabel(categoryOptions, scope.row.category) }}</template>
      </el-table-column>
      <el-table-column label="官方学费" min-width="150">
        <template #default="scope">{{ scope.row.tuitionDisplay || scope.row.listTuitionText || scope.row.annualTuitionCny }}</template>
      </el-table-column>
      <el-table-column label="费用审计" min-width="140">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.officialFeeAuditStatus)">
            {{ optionLabel(feeAuditOptions, scope.row.officialFeeAuditStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="公开展示" min-width="150">
        <template #default="scope">
          <el-tag :type="statusTagType(scope.row.publicDisplayStatus)">
            {{ optionLabel(publicDisplayOptions, scope.row.publicDisplayStatus) }}
          </el-tag>
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

  <el-dialog v-model="visible" title="专业管理" width="1180px" top="4vh" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" status-icon>
      <el-tabs>
        <el-tab-pane label="基础信息">
          <div class="split-grid">
            <el-form-item label="所属学校" prop="universityId">
              <el-select v-model="form.universityId" filterable>
                <el-option v-for="item in universities" :key="item.id" :label="item.shortName" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="Code" prop="code"><el-input v-model="form.code" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="Slug" prop="slug"><el-input v-model="form.slug" /></el-form-item>
            <el-form-item label="官方英文名称"><el-input v-model="form.nameEnOfficial" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="层级">
              <el-select v-model="form.level">
                <el-option v-for="item in levelOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="学科分类">
              <el-select v-model="form.category" filterable allow-create>
                <el-option v-for="item in categoryOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <LocaleTextTabs v-model="form.name" label="专业名称" />
          <LocaleTextTabs v-model="form.faculty" label="学院" />
          <LocaleTextTabs v-model="form.description" label="专业简介" textarea :rows="4" />
          <div class="split-grid">
            <el-form-item label="中文学院官方名称"><el-input v-model="form.facultyZh" /></el-form-item>
            <el-form-item label="学习模式"><el-input v-model="form.studyMode" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="校区"><el-input v-model="form.campus" /></el-form-item>
            <el-form-item label="发布状态"><el-switch v-model="form.isPublished" /></el-form-item>
          </div>
          <LocaleListTabs v-model="form.applicationDocs" label="申请材料" />
          <LocaleListTabs v-model="form.curriculum" label="课程结构" />
          <LocaleListTabs v-model="form.careers" label="就业方向" />
          <LocaleListTabs v-model="form.specializations" label="方向与特色" />
        </el-tab-pane>

        <el-tab-pane label="费用与开学">
          <div class="split-grid">
            <el-form-item label="学制(年)"><el-input-number v-model="form.durationYears" :min="0.5" :step="0.5" /></el-form-item>
            <el-form-item label="官方学制"><el-input v-model="form.durationOfficial" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="年学费(CNY)"><el-input-number v-model="form.annualTuitionCny" :min="0" /></el-form-item>
            <el-form-item label="总学费金额"><el-input-number v-model="form.tuitionAmount" :min="0" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="学费币种">
              <el-select v-model="form.tuitionCurrency">
                <el-option v-for="item in tuitionCurrencyOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="官方 MYR 学费"><el-input-number v-model="form.officialTuitionMYR" :min="0" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="列表学费文案"><el-input v-model="form.listTuitionText" /></el-form-item>
            <el-form-item label="学费展示文案"><el-input v-model="form.tuitionDisplay" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="官方学费来源 URL"><el-input v-model="form.officialFeeSourceUrl" /></el-form-item>
            <el-form-item label="次要学费来源 URL"><el-input v-model="form.secondaryOfficialFeeSourceUrl" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="费用审计状态">
              <el-select v-model="form.officialFeeAuditStatus">
                <el-option v-for="item in feeAuditOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="费用审计日期">
              <el-date-picker v-model="form.officialFeeAuditedAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
            </el-form-item>
          </div>
          <el-form-item label="官方学费备注"><el-input v-model="form.officialTuitionNote" type="textarea" :rows="3" /></el-form-item>
          <div class="split-grid">
            <el-form-item label="开学月份（每行或逗号分隔）"><el-input v-model="intakeMonthsText" type="textarea" :rows="4" /></el-form-item>
            <el-form-item label="官方开学时间"><el-input v-model="form.officialIntake" type="textarea" :rows="4" /></el-form-item>
          </div>
          <el-form-item label="官方开学备注"><el-input v-model="form.officialIntakeNote" type="textarea" :rows="3" /></el-form-item>
        </el-tab-pane>

        <el-tab-pane label="要求与来源">
          <div class="split-grid">
            <el-form-item label="IELTS"><el-input-number v-model="form.languageRequirement.ielts" :min="0" :max="9" :step="0.5" /></el-form-item>
            <el-form-item label="TOEFL"><el-input-number v-model="form.languageRequirement.toefl" :min="0" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="PTE"><el-input-number v-model="form.languageRequirement.pte" :min="0" /></el-form-item>
            <el-form-item label="MUET"><el-input-number v-model="form.languageRequirement.muet" :min="0" :step="0.5" /></el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="GPA"><el-input-number v-model="form.requirement.gpa" :min="0" :max="4" :step="0.1" /></el-form-item>
            <el-form-item label="高考要求"><el-switch v-model="form.requirement.gaokaoRequired" /></el-form-item>
          </div>
          <el-form-item label="会考要求"><el-switch v-model="form.requirement.huikaoRequired" /></el-form-item>
          <LocaleTextTabs v-model="form.requirement.note" label="本地入学要求备注" textarea :rows="3" />
          <el-form-item label="官方语言要求"><el-input v-model="form.officialLanguageRequirement" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="官方学术要求"><el-input v-model="form.officialAcademicRequirement" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="中国学生要求"><el-input v-model="form.chinaStudentRequirement" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="特殊要求备注"><el-input v-model="form.specialRequirementsNote" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="官方认证备注"><el-input v-model="form.officialAccreditationNote" type="textarea" :rows="3" /></el-form-item>
          <div class="split-grid">
            <el-form-item label="官方专业页 URL"><el-input v-model="form.officialSourceUrl" /></el-form-item>
            <el-form-item label="官方入学要求 URL"><el-input v-model="form.officialEntryRequirementSourceUrl" /></el-form-item>
          </div>
          <el-form-item label="官方认证 URL"><el-input v-model="form.officialAccreditationSourceUrl" /></el-form-item>
          <el-form-item label="来源列表">
            <el-table :data="form.sourceUrls" border class="inline-edit-table">
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
        </el-tab-pane>

        <el-tab-pane label="发布与审计">
          <div class="split-grid">
            <el-form-item label="公开展示状态">
              <el-select v-model="form.publicDisplayStatus">
                <el-option v-for="item in publicDisplayOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="官方来源状态">
              <el-select v-model="form.officialSourceStatus">
                <el-option v-for="item in sourceStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="官方核验日期">
              <el-date-picker v-model="form.officialVerifiedAt" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
            </el-form-item>
            <el-form-item label="公开展示备注"><el-input v-model="form.publicDisplayNote" /></el-form-item>
          </div>
          <el-form-item label="复核原因"><el-input v-model="form.reviewReason" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="审计备注"><el-input v-model="form.auditNote" type="textarea" :rows="4" /></el-form-item>
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
const canUpdate = computed(() => hasPermission("program:update"));
const canDelete = computed(() => hasPermission("program:delete"));
const items = ref<any[]>([]);
const universities = ref<any[]>([]);
const dictionaries = ref<DictionaryItem[]>([]);
const total = ref(0);
const visible = ref(false);
const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const query = reactive({
  page: 1,
  pageSize: 10,
  search: "",
  universityId: undefined as number | undefined,
  level: "",
  category: "",
  publicDisplayStatus: "",
  feeAuditStatus: ""
});
const form = reactive<any>({});

const levelOptions = computed(() => dictionaryOptions(dictionaries.value, "degree_level"));
const categoryOptions = computed(() => dictionaryOptions(dictionaries.value, "program_category"));
const publicDisplayOptions = computed(() => dictionaryOptions(dictionaries.value, "public_display_status"));
const sourceStatusOptions = computed(() => dictionaryOptions(dictionaries.value, "official_source_status"));
const feeAuditOptions = computed(() => dictionaryOptions(dictionaries.value, "fee_audit_status"));
const tuitionCurrencyOptions = computed(() => dictionaryOptions(dictionaries.value, "tuition_currency"));
const sourceTypeOptions = computed(() => dictionaryOptions(dictionaries.value, "source_type"));

const rules = reactive<FormRules>({
  universityId: [{ required: true, message: "请选择学校", trigger: "change" }],
  slug: [{ required: true, message: "请输入 Slug", trigger: "blur" }],
  code: [{ required: true, message: "请输入 Code", trigger: "blur" }]
});

const intakeMonthsText = computed({
  get: () => formatLineList(form.intakeMonths),
  set: (value: string) => {
    form.intakeMonths = parseLineList(value);
  }
});

const resetForm = () => {
  Object.assign(form, {
    id: undefined,
    universityId: undefined,
    slug: "",
    code: "",
    level: "bachelor",
    category: "business",
    isPublished: false,
    nameEnOfficial: "",
    facultyZh: "",
    studyMode: "",
    campus: "",
    durationYears: 4,
    durationOfficial: "",
    annualTuitionCny: 30000,
    tuitionAmount: null,
    tuitionCurrency: "CNY",
    tuitionDisplay: "",
    officialTuitionMYR: null,
    officialTuitionNote: "",
    officialFeeSourceUrl: "",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "pending-review",
    officialFeeAuditedAt: null,
    intakeMonths: ["September"],
    officialIntake: "",
    officialIntakeNote: "",
    languageRequirement: { ielts: 5.5, toefl: null, pte: null, muet: null },
    officialLanguageRequirement: "",
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: createLocaleMap() },
    officialAcademicRequirement: "",
    chinaStudentRequirement: "",
    specialRequirementsNote: "",
    officialAccreditationNote: "",
    officialSourceUrl: "",
    officialEntryRequirementSourceUrl: "",
    officialAccreditationSourceUrl: "",
    sourceUrls: [],
    officialVerifiedAt: null,
    officialSourceStatus: "needs-review",
    publicDisplayStatus: "needs-review",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "",
    listTuitionText: "",
    name: createLocaleMap(),
    faculty: createLocaleMap(),
    description: createLocaleMap(),
    applicationDocs: createLocaleArrayMap(),
    curriculum: createLocaleArrayMap(),
    careers: createLocaleArrayMap(),
    specializations: createLocaleArrayMap()
  });
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
    const data = await adminApi.programs(query);
    items.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
};

const loadUniversities = async () => {
  const data = await adminApi.universities({ page: 1, pageSize: 1000 });
  universities.value = data.items;
};

const openCreate = () => {
  resetForm();
  visible.value = true;
};

const openEdit = (row: any) => {
  resetForm();
  Object.assign(form, JSON.parse(JSON.stringify(row)));
  delete form.university;
  form.languageRequirement ||= { ielts: 5.5, toefl: null, pte: null, muet: null };
  form.requirement ||= { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: createLocaleMap() };
  form.requirement.note ||= createLocaleMap();
  form.applicationDocs ||= createLocaleArrayMap();
  form.curriculum ||= createLocaleArrayMap();
  form.careers ||= createLocaleArrayMap();
  form.specializations ||= createLocaleArrayMap();
  form.sourceUrls = normalizeSourceLinks(form.sourceUrls);
  normalizeNumericFields();
  visible.value = true;
};

const addSource = () => {
  form.sourceUrls = [...normalizeSourceLinks(form.sourceUrls), createSourceLink(form.officialSourceStatus)];
};

const removeSource = (index: number) => {
  form.sourceUrls.splice(index, 1);
};

const save = async () => {
  if (!canUpdate.value) return;
  try {
    await formRef.value?.validate();
    const payload = buildPayload();
    validatePayload(payload);
    saving.value = true;
    await adminApi.saveProgram(payload);
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
  await ElMessageBox.confirm(`确认删除 ${row.code}？`, "提示");
  try {
    await adminApi.deleteProgram(row.id);
    ElMessage.success("已删除");
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
};

const normalizeNumericFields = () => {
  ["durationYears", "annualTuitionCny", "tuitionAmount", "officialTuitionMYR"].forEach((field) => {
    if (form[field] !== null && form[field] !== undefined && form[field] !== "") form[field] = Number(form[field]);
  });
  ["ielts", "toefl", "pte", "muet"].forEach((field) => {
    if (form.languageRequirement[field] !== null && form.languageRequirement[field] !== undefined && form.languageRequirement[field] !== "") {
      form.languageRequirement[field] = Number(form.languageRequirement[field]);
    }
  });
  if (form.requirement.gpa !== null && form.requirement.gpa !== undefined && form.requirement.gpa !== "") form.requirement.gpa = Number(form.requirement.gpa);
};

const buildPayload = () => {
  const payload = JSON.parse(JSON.stringify(form));
  payload.sourceUrls = normalizeSourceLinks(payload.sourceUrls);
  payload.officialVerifiedAt = normalizeNullableDate(payload.officialVerifiedAt);
  payload.officialFeeAuditedAt = normalizeNullableDate(payload.officialFeeAuditedAt);
  if (payload.tuitionAmount === "") payload.tuitionAmount = null;
  if (payload.officialTuitionMYR === "") payload.officialTuitionMYR = null;
  return payload;
};

const validatePayload = (payload: any) => {
  if (!payload.name?.["zh-CN"]?.trim()) throw new Error("请填写专业中文名称");
  if (!payload.faculty?.["zh-CN"]?.trim()) throw new Error("请填写学院中文名称");
  if (payload.durationYears <= 0) throw new Error("学制必须大于 0");
  if (payload.annualTuitionCny < 0) throw new Error("年学费不能为负数");
  if (payload.officialTuitionMYR !== null && payload.officialTuitionMYR < 0) throw new Error("官方 MYR 学费不能为负数");
  const sourceReady = payload.publicDisplayStatus === "ready" || payload.officialSourceStatus === "official-verified";
  const hasProgramSource =
    payload.officialSourceUrl || payload.officialEntryRequirementSourceUrl || payload.officialAccreditationSourceUrl || hasSourceUrl(payload.sourceUrls);
  if (sourceReady && !hasProgramSource) throw new Error("可公开展示或官方已核验的专业必须至少填写一个官方来源 URL");
  if (payload.officialFeeAuditStatus === "matched-official" && !payload.officialFeeSourceUrl) throw new Error("费用审计为与官方一致时必须填写官方学费来源 URL");
  if (((payload.officialTuitionMYR !== null && payload.officialTuitionMYR !== undefined) || payload.tuitionCurrency === "MYR") && !payload.officialFeeSourceUrl) {
    throw new Error("官方 MYR 学费或 MYR 币种必须填写官方学费来源 URL");
  }
  const urlFields = ["officialFeeSourceUrl", "secondaryOfficialFeeSourceUrl", "officialSourceUrl", "officialEntryRequirementSourceUrl", "officialAccreditationSourceUrl"];
  const invalidField = urlFields.find((field) => !isValidUrl(payload[field]));
  if (invalidField) throw new Error(`${invalidField} 不是有效的 HTTP/HTTPS URL`);
  const invalidSource = payload.sourceUrls.find((item: any) => !isValidUrl(item.url));
  if (invalidSource) throw new Error("来源列表中存在无效 URL");
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "请检查表单必填项");

onMounted(async () => {
  resetForm();
  await Promise.all([loadDictionaries(), loadUniversities()]);
  await load();
});
</script>
