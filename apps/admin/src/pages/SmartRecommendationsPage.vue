<template>
  <div class="recommendation-admin-page">
    <section class="page-card recommendation-admin-hero" v-loading="loading">
      <div class="page-toolbar recommendation-admin-hero__toolbar">
        <div>
          <div class="recommendation-admin-hero__title">智能推荐管理</div>
          <div class="section-subtitle">
            维护登录门禁、学生画像完整度、推荐规则状态和可解释推荐结果的管理端验证界面。
          </div>
        </div>
        <div class="page-toolbar__right">
          <el-button :loading="loading" @click="loadContract">刷新契约</el-button>
          <el-button type="primary" @click="openCreateRule">新增规则</el-button>
        </div>
      </div>

      <el-alert
        v-if="loadError"
        class="recommendation-admin-alert"
        :title="loadError"
        type="warning"
        show-icon
        :closable="false"
      />

      <div class="metrics-grid recommendation-admin-metrics">
        <div class="metric-card">
          <div class="metric-card__label">契约版本</div>
          <div class="metric-card__value recommendation-admin-metric-text">{{ contract.schemaVersion }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">必填画像字段</div>
          <div class="metric-card__value">{{ contract.requiredProfileFields.length }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">完整度门槛</div>
          <div class="metric-card__value">{{ contract.completenessThreshold }}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">启用规则</div>
          <div class="metric-card__value">{{ enabledRuleCount }}</div>
        </div>
      </div>

      <div class="recommendation-admin-source">
        <el-tag type="info" effect="plain">来源：{{ contractSource }}</el-tag>
        <el-tag type="success" effect="plain">个性化推荐必须登录</el-tag>
        <el-tag type="warning" effect="plain">公开建议模式不能包装为个性化推荐</el-tag>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>学生画像完整度</strong>
          <div class="section-subtitle">用于核对推荐前置字段、缺失提示和画像入口展示。</div>
        </div>
        <el-segmented v-model="fieldView" :options="fieldViewOptions" />
      </div>
      <div class="recommendation-admin-table-wrap">
        <el-table :data="visibleProfileFields" border>
          <el-table-column label="画像字段" min-width="180">
            <template #default="scope">
              <div class="recommendation-admin-name-cell">
                <strong>{{ profileFieldLabel(scope.row.field) }}</strong>
                <span>{{ scope.row.field }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="前置要求" width="120">
            <template #default="scope">
              <el-tag :type="scope.row.required ? 'danger' : 'info'" effect="plain">
                {{ scope.row.required ? "必填" : "可选" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="weight" label="完整度权重" width="120" />
          <el-table-column label="缺失时动作" min-width="180">
            <template #default="scope">{{ scope.row.required ? "阻断推荐并引导完善画像" : "提示补充但不阻断" }}</template>
          </el-table-column>
          <el-table-column label="状态" width="130">
            <template #default="scope">
              <el-switch
                v-model="scope.row.enabled"
                active-text="启用"
                inactive-text="停用"
                @change="recordFieldToggle(scope.row)"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section class="page-card">
      <div class="split-grid recommendation-admin-split">
        <div class="recommendation-admin-panel">
          <div class="recommendation-admin-section-title">状态交互预览</div>
          <el-radio-group v-model="selectedScenario" class="recommendation-admin-scenarios">
            <el-radio-button v-for="scenario in gateScenarios" :key="scenario.key" :value="scenario.key">
              {{ scenario.label }}
            </el-radio-button>
          </el-radio-group>

          <el-descriptions :column="1" border>
            <el-descriptions-item label="访问状态">
              <el-tag :type="gateStatusTag(activeScenario.status)">{{ activeScenario.statusLabel }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="是否展示推荐列表">
              {{ activeScenario.canShowRecommendations ? "允许展示" : "禁止展示" }}
            </el-descriptions-item>
            <el-descriptions-item label="主动作">{{ activeScenario.primaryAction }}</el-descriptions-item>
            <el-descriptions-item label="阻断原因">
              <div class="recommendation-admin-tags">
                <el-tag v-for="reason in activeScenario.blockReasons" :key="reason" type="warning" effect="plain">
                  {{ reason }}
                </el-tag>
                <span v-if="!activeScenario.blockReasons.length">无</span>
              </div>
            </el-descriptions-item>
          </el-descriptions>

          <div class="recommendation-admin-actions">
            <el-button @click="selectedScenario = 'login-required'">模拟退出登录</el-button>
            <el-button @click="selectedScenario = 'profile-incomplete'">模拟画像缺失</el-button>
            <el-button type="primary" @click="refreshPreview">模拟刷新推荐</el-button>
          </div>

          <el-alert
            class="recommendation-admin-alert"
            :title="interactionMessage"
            type="info"
            show-icon
            :closable="false"
          />
        </div>

        <el-form label-position="top" class="recommendation-admin-panel">
          <div class="recommendation-admin-section-title">规则表单</div>
          <div class="split-grid">
            <el-form-item label="规则名称"><el-input v-model="ruleForm.name" /></el-form-item>
            <el-form-item label="规则范围">
              <el-select v-model="ruleForm.scope">
                <el-option v-for="item in ruleScopeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="关联画像字段">
              <el-select v-model="ruleForm.profileField" clearable>
                <el-option v-for="item in profileFieldOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="关联公开数据字段">
              <el-select v-model="ruleForm.publicDataField" clearable filterable>
                <el-option v-for="item in publicDataFieldOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="权重">
              <el-input-number v-model="ruleForm.weight" :min="0" :max="100" />
            </el-form-item>
            <el-form-item label="风险级别">
              <el-select v-model="ruleForm.riskSeverity">
                <el-option v-for="item in riskSeverityOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="申请层级">
              <el-select v-model="ruleForm.tier">
                <el-option label="冲刺" value="reach" />
                <el-option label="匹配" value="target" />
                <el-option label="保底" value="safe" />
              </el-select>
            </el-form-item>
            <el-form-item label="规则状态">
              <el-select v-model="ruleForm.status">
                <el-option v-for="item in ruleStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="说明">
            <el-input v-model="ruleForm.description" type="textarea" :rows="3" />
          </el-form-item>
          <div class="recommendation-admin-actions">
            <el-button @click="resetRuleForm">重置</el-button>
            <el-button type="primary" @click="saveRule">保存规则</el-button>
          </div>
        </el-form>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>推荐规则列表</strong>
          <div class="section-subtitle">管理端可验证的规则状态、权重和追踪字段。</div>
        </div>
        <div class="page-toolbar__right">
          <el-select v-model="ruleFilter" clearable placeholder="规则状态">
            <el-option v-for="item in ruleStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
      </div>

      <div class="recommendation-admin-table-wrap">
        <el-table :data="filteredRules" border class="recommendation-admin-rules-table">
          <el-table-column label="规则" min-width="260">
            <template #default="scope">
              <div class="recommendation-admin-name-cell">
                <strong>{{ scope.row.name }}</strong>
                <span>{{ scope.row.description }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="范围" width="110">
            <template #default="scope">{{ ruleScopeLabel(scope.row.scope) }}</template>
          </el-table-column>
          <el-table-column label="画像字段" min-width="160">
            <template #default="scope">{{ scope.row.profileField ? profileFieldLabel(scope.row.profileField) : "-" }}</template>
          </el-table-column>
          <el-table-column label="公开数据字段" min-width="210">
            <template #default="scope">{{ scope.row.publicDataField ? publicDataFieldLabel(scope.row.publicDataField) : "-" }}</template>
          </el-table-column>
          <el-table-column prop="weight" label="权重" width="90" />
          <el-table-column label="状态" width="150">
            <template #default="scope">
              <el-select v-model="scope.row.status" size="small" @change="recordRuleStatus(scope.row)">
                <el-option v-for="item in ruleStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="scope">
              <div class="table-actions">
                <el-button link type="primary" @click="openEditRule(scope.row)">编辑</el-button>
                <el-button link type="warning" @click="markRuleReview(scope.row)">送复核</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>缓存失效与执行记录</strong>
          <div class="section-subtitle">用于验证画像变更、退出登录、切换账号和规则版本变化后的状态处理。</div>
        </div>
      </div>
      <div class="recommendation-admin-log-grid">
        <el-timeline>
          <el-timeline-item v-for="record in executionRecords" :key="record.time" :timestamp="record.time" placement="top">
            <div class="recommendation-admin-record">
              <el-tag :type="record.type" effect="plain">{{ record.label }}</el-tag>
              <span>{{ record.message }}</span>
            </div>
          </el-timeline-item>
        </el-timeline>
        <div class="recommendation-admin-panel">
          <div class="recommendation-admin-section-title">缓存失效触发器</div>
          <div class="recommendation-admin-tags">
            <el-tag v-for="trigger in contract.cacheInvalidationTriggers" :key="trigger" type="info" effect="plain">
              {{ cacheTriggerLabel(trigger) }}
            </el-tag>
          </div>
          <el-divider />
          <el-descriptions :column="1" border>
            <el-descriptions-item label="缓存范围">{{ contract.personalizationRequiresAuthentication ? "账号画像级缓存" : "无" }}</el-descriptions-item>
            <el-descriptions-item label="公开结果状态">{{ contract.publicResultStatus }}</el-descriptions-item>
            <el-descriptions-item label="最大推荐数">{{ contract.maxResults }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  SMART_RECOMMENDATION_CONTRACT,
  SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS,
  type ApplicationTier,
  type SmartRecommendationAccessStatus,
  type SmartRecommendationCacheInvalidationTrigger,
  type SmartRecommendationContract,
  type SmartRecommendationProfileField,
  type SmartRecommendationPublicDataField,
  type SmartRecommendationRiskSeverity
} from "@studymy/shared";
import { adminApi } from "@/api/admin";

type FieldView = "all" | "required" | "optional";
type RuleScope = "gate" | "scoring" | "risk" | "cache";
type RuleStatus = "enabled" | "disabled" | "needs-review";
type TimelineType = "success" | "warning" | "info";

interface ProfileFieldRow {
  field: SmartRecommendationProfileField;
  required: boolean;
  weight: number;
  enabled: boolean;
}

interface RecommendationRule {
  id: string;
  name: string;
  scope: RuleScope;
  profileField: SmartRecommendationProfileField | "";
  publicDataField: SmartRecommendationPublicDataField | "";
  weight: number;
  riskSeverity: SmartRecommendationRiskSeverity;
  tier: ApplicationTier;
  status: RuleStatus;
  description: string;
}

interface GateScenario {
  key: SmartRecommendationAccessStatus;
  label: string;
  status: SmartRecommendationAccessStatus;
  statusLabel: string;
  canShowRecommendations: boolean;
  primaryAction: string;
  blockReasons: string[];
}

interface ExecutionRecord {
  time: string;
  type: TimelineType;
  label: string;
  message: string;
}

const PROFILE_FIELD_LABELS: Record<SmartRecommendationProfileField, string> = {
  level: "目标学历",
  targetCategory: "目标专业方向",
  budgetCny: "预算",
  gpa: "GPA",
  ielts: "IELTS",
  experience: "工作或研究经验",
  acceptNoLanguage: "是否接受后补语言"
};

const PUBLIC_DATA_FIELD_LABELS: Record<SmartRecommendationPublicDataField, string> = {
  "program.level": "专业层级",
  "program.category": "专业分类",
  "program.annualTuitionCny": "专业年度学费",
  "program.requirement.gpa": "专业 GPA 要求",
  "program.languageRequirement.ielts": "专业 IELTS 要求",
  "program.publicDisplayStatus": "专业公开展示状态",
  "university.livingCostCny": "学校生活费",
  "university.acceptNoLanguage": "学校是否接受后补语言",
  "university.qsRank": "学校 QS 排名",
  "university.publicDisplayStatus": "学校公开展示状态"
};

const ruleScopeOptions = [
  { label: "门禁", value: "gate" },
  { label: "评分", value: "scoring" },
  { label: "风险", value: "risk" },
  { label: "缓存", value: "cache" }
] as const;

const ruleStatusOptions = [
  { label: "启用", value: "enabled" },
  { label: "停用", value: "disabled" },
  { label: "待复核", value: "needs-review" }
] as const;

const riskSeverityOptions = [
  { label: "提示", value: "info" },
  { label: "警告", value: "warning" },
  { label: "严重", value: "critical" }
] as const;

const fieldViewOptions = [
  { label: "全部字段", value: "all" },
  { label: "必填字段", value: "required" },
  { label: "可选字段", value: "optional" }
];

const profileFieldOptions = Object.entries(PROFILE_FIELD_LABELS).map(([value, label]) => ({ label, value }));
const publicDataFieldOptions = Object.entries(PUBLIC_DATA_FIELD_LABELS).map(([value, label]) => ({ label, value }));

const nowText = () => new Date().toLocaleString("zh-CN");

const createRule = (overrides: Partial<RecommendationRule> = {}): RecommendationRule => ({
  id: `rule-${Date.now()}`,
  name: "",
  scope: "scoring",
  profileField: "",
  publicDataField: "",
  weight: 10,
  riskSeverity: "info",
  tier: "target",
  status: "needs-review",
  description: "",
  ...overrides
});

const contract = ref<SmartRecommendationContract>({ ...SMART_RECOMMENDATION_CONTRACT });
const contractSource = ref("本地共享契约");
const loadError = ref("");
const loading = ref(false);
const fieldView = ref<FieldView>("all");
const selectedScenario = ref<SmartRecommendationAccessStatus>("login-required");
const refreshCount = ref(0);
const ruleFilter = ref<RuleStatus | "">("");
const editingRuleId = ref("");
const ruleForm = reactive<RecommendationRule>(createRule());

const profileFields = ref<ProfileFieldRow[]>([
  ...SMART_RECOMMENDATION_CONTRACT.requiredProfileFields.map((field) => ({
    field,
    required: true,
    weight: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field],
    enabled: true
  })),
  ...SMART_RECOMMENDATION_CONTRACT.optionalProfileFields.map((field) => ({
    field,
    required: false,
    weight: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field],
    enabled: true
  }))
]);

const recommendationRules = ref<RecommendationRule[]>([
  createRule({
    id: "gate-auth-required",
    name: "个性化推荐登录门禁",
    scope: "gate",
    profileField: "",
    publicDataField: "",
    weight: 100,
    riskSeverity: "critical",
    tier: "target",
    status: "enabled",
    description: "未登录用户只能看到登录或注册引导，不能展示个性化推荐列表。"
  }),
  createRule({
    id: "gate-profile-complete",
    name: "画像完整度门槛",
    scope: "gate",
    profileField: "level",
    publicDataField: "",
    weight: SMART_RECOMMENDATION_CONTRACT.completenessThreshold,
    riskSeverity: "critical",
    tier: "target",
    status: "enabled",
    description: "画像未达到最低完整度时，展示缺失项并引导完善画像。"
  }),
  createRule({
    id: "score-budget-match",
    name: "预算与成本匹配",
    scope: "scoring",
    profileField: "budgetCny",
    publicDataField: "program.annualTuitionCny",
    weight: 18,
    riskSeverity: "warning",
    tier: "target",
    status: "enabled",
    description: "用学生预算与专业年度学费、生活费做匹配，超预算时进入风险提示。"
  }),
  createRule({
    id: "risk-language-gap",
    name: "语言差距风险",
    scope: "risk",
    profileField: "ielts",
    publicDataField: "program.languageRequirement.ielts",
    weight: 16,
    riskSeverity: "warning",
    tier: "reach",
    status: "enabled",
    description: "语言未达标时展示差距和后补语言路径，不给出无依据的安全推荐。"
  })
]);

const gateScenarios: GateScenario[] = [
  {
    key: "login-required",
    label: "未登录",
    status: "login-required",
    statusLabel: "需要登录",
    canShowRecommendations: false,
    primaryAction: "打开登录",
    blockReasons: ["login-required"]
  },
  {
    key: "profile-incomplete",
    label: "画像缺失",
    status: "profile-incomplete",
    statusLabel: "画像不完整",
    canShowRecommendations: false,
    primaryAction: "完善画像",
    blockReasons: ["profile-incomplete"]
  },
  {
    key: "ready",
    label: "可推荐",
    status: "ready",
    statusLabel: "可生成推荐",
    canShowRecommendations: true,
    primaryAction: "刷新推荐",
    blockReasons: []
  },
  {
    key: "no-match",
    label: "无匹配",
    status: "no-match",
    statusLabel: "暂无匹配",
    canShowRecommendations: false,
    primaryAction: "调整画像",
    blockReasons: ["profile-required"]
  }
];

const executionRecords = ref<ExecutionRecord[]>([
  {
    time: nowText(),
    type: "info",
    label: "初始化",
    message: "已加载智能推荐管理端页面，使用共享契约作为默认展示。"
  }
]);

const enabledRuleCount = computed(() => recommendationRules.value.filter((rule) => rule.status === "enabled").length);
const activeScenario = computed(() => gateScenarios.find((item) => item.key === selectedScenario.value) || gateScenarios[0]);
const interactionMessage = computed(() => {
  if (activeScenario.value.status === "ready") return `画像完整，可展示推荐列表；本轮已模拟刷新 ${refreshCount.value} 次。`;
  if (activeScenario.value.status === "login-required") return "推荐结果已隐藏，用户需要先登录或注册。";
  if (activeScenario.value.status === "profile-incomplete") return "推荐结果已隐藏，页面应展示缺失画像字段和完善入口。";
  return "没有匹配结果时，应解释预算、GPA、语言或专业方向可能导致无结果。";
});
const visibleProfileFields = computed(() => {
  if (fieldView.value === "required") return profileFields.value.filter((item) => item.required);
  if (fieldView.value === "optional") return profileFields.value.filter((item) => !item.required);
  return profileFields.value;
});
const filteredRules = computed(() => {
  if (!ruleFilter.value) return recommendationRules.value;
  return recommendationRules.value.filter((rule) => rule.status === ruleFilter.value);
});

const loadContract = async () => {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await adminApi.recommendationContract();
    if (data?.schemaVersion) {
      contract.value = data as SmartRecommendationContract;
      contractSource.value = "后端 /recommendations/contract";
      syncProfileFields();
      addExecutionRecord("success", "契约", "已刷新智能推荐后端契约。");
    }
  } catch (error) {
    contract.value = { ...SMART_RECOMMENDATION_CONTRACT };
    contractSource.value = "本地共享契约";
    loadError.value = `无法读取后端推荐契约，当前使用本地共享契约预览：${errorMessage(error)}`;
  } finally {
    loading.value = false;
  }
};

const syncProfileFields = () => {
  const enabledByField = new Map(profileFields.value.map((item) => [item.field, item.enabled]));
  profileFields.value = [
    ...contract.value.requiredProfileFields.map((field) => ({
      field,
      required: true,
      weight: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field] || 0,
      enabled: enabledByField.get(field) ?? true
    })),
    ...contract.value.optionalProfileFields.map((field) => ({
      field,
      required: false,
      weight: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field] || 0,
      enabled: enabledByField.get(field) ?? true
    }))
  ];
};

const refreshPreview = () => {
  refreshCount.value += 1;
  selectedScenario.value = "ready";
  addExecutionRecord("success", "刷新", "已模拟基于当前完整画像刷新推荐结果。");
  ElMessage.success("已模拟刷新推荐");
};

const recordFieldToggle = (row: ProfileFieldRow) => {
  addExecutionRecord(row.enabled ? "success" : "warning", "画像字段", `${profileFieldLabel(row.field)} 已${row.enabled ? "启用" : "停用"}。`);
};

const openCreateRule = () => {
  editingRuleId.value = "";
  resetRuleForm();
};

const openEditRule = (rule: RecommendationRule) => {
  editingRuleId.value = rule.id;
  Object.assign(ruleForm, JSON.parse(JSON.stringify(rule)));
};

const resetRuleForm = () => {
  Object.assign(ruleForm, createRule({ id: editingRuleId.value || `rule-${Date.now()}` }));
};

const saveRule = () => {
  if (!ruleForm.name.trim()) {
    ElMessage.error("请填写规则名称");
    return;
  }
  if (!ruleForm.description.trim()) {
    ElMessage.error("请填写规则说明");
    return;
  }
  const payload = JSON.parse(JSON.stringify(ruleForm)) as RecommendationRule;
  const index = recommendationRules.value.findIndex((rule) => rule.id === editingRuleId.value);
  if (index >= 0) {
    recommendationRules.value.splice(index, 1, payload);
  } else {
    recommendationRules.value.unshift({ ...payload, id: payload.id || `rule-${Date.now()}` });
  }
  editingRuleId.value = payload.id;
  addExecutionRecord(payload.status === "enabled" ? "success" : "info", "规则", `${payload.name} 已保存为${ruleStatusLabel(payload.status)}。`);
  ElMessage.success("规则已保存到当前页面状态");
};

const recordRuleStatus = (rule: RecommendationRule) => {
  addExecutionRecord(rule.status === "enabled" ? "success" : "warning", "规则状态", `${rule.name} 已切换为${ruleStatusLabel(rule.status)}。`);
};

const markRuleReview = (rule: RecommendationRule) => {
  rule.status = "needs-review";
  recordRuleStatus(rule);
};

const addExecutionRecord = (type: TimelineType, label: string, message: string) => {
  executionRecords.value.unshift({ time: nowText(), type, label, message });
};

const profileFieldLabel = (field: SmartRecommendationProfileField) => PROFILE_FIELD_LABELS[field] || field;
const publicDataFieldLabel = (field: SmartRecommendationPublicDataField) => PUBLIC_DATA_FIELD_LABELS[field] || field;
const ruleScopeLabel = (scope: RuleScope) => ruleScopeOptions.find((item) => item.value === scope)?.label || scope;
const ruleStatusLabel = (status: RuleStatus) => ruleStatusOptions.find((item) => item.value === status)?.label || status;

const gateStatusTag = (status: SmartRecommendationAccessStatus) => {
  if (status === "ready") return "success";
  if (status === "login-required" || status === "profile-incomplete") return "warning";
  if (status === "error") return "danger";
  return "info";
};

const cacheTriggerLabel = (trigger: SmartRecommendationCacheInvalidationTrigger) => {
  const labels: Record<SmartRecommendationCacheInvalidationTrigger, string> = {
    "profile-updated": "画像更新",
    "sign-out": "退出登录",
    "account-switched": "切换账号",
    "rule-version-changed": "规则版本变化",
    "public-program-data-updated": "公开专业数据更新"
  };
  return labels[trigger] || trigger;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "请求失败");

onMounted(loadContract);
</script>

<style scoped>
.recommendation-admin-page {
  display: grid;
  gap: 18px;
  min-width: 0;
  max-width: 100%;
}

.recommendation-admin-page :deep(.page-card),
.recommendation-admin-page :deep(.page-toolbar),
.recommendation-admin-page :deep(.page-toolbar > *) {
  min-width: 0;
  max-width: 100%;
}

.recommendation-admin-hero__toolbar {
  align-items: flex-start;
}

.recommendation-admin-hero__title {
  color: #12233c;
  font-size: 24px;
  font-weight: 800;
}

.recommendation-admin-alert {
  margin: 12px 0;
}

.recommendation-admin-metrics {
  margin-bottom: 0;
}

.recommendation-admin-metric-text {
  overflow-wrap: anywhere;
  font-size: 22px;
  line-height: 1.25;
}

.recommendation-admin-source,
.recommendation-admin-tags,
.recommendation-admin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.recommendation-admin-source {
  margin-top: 16px;
}

.recommendation-admin-split {
  align-items: start;
}

.recommendation-admin-panel {
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.72);
}

.recommendation-admin-section-title {
  margin-bottom: 14px;
  color: #1e293b;
  font-size: 16px;
  font-weight: 800;
}

.recommendation-admin-scenarios {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: 16px;
}

.recommendation-admin-actions {
  margin-top: 16px;
}

.recommendation-admin-table-wrap {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
}

.recommendation-admin-rules-table {
  min-width: 1120px;
}

.recommendation-admin-name-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.recommendation-admin-name-cell strong {
  color: #274c9b;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.recommendation-admin-name-cell span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.recommendation-admin-log-grid {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(320px, 0.9fr);
  gap: 18px;
  align-items: start;
}

.recommendation-admin-record {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.recommendation-admin-record span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.recommendation-admin-page :deep(.el-table .cell),
.recommendation-admin-page :deep(.el-descriptions__content),
.recommendation-admin-page :deep(.el-form-item__label) {
  overflow-wrap: anywhere;
}

@media (max-width: 1180px) {
  .recommendation-admin-log-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .recommendation-admin-hero__toolbar,
  .recommendation-admin-page :deep(.page-toolbar__right) {
    width: 100%;
  }

  .recommendation-admin-page :deep(.page-toolbar__right .el-button),
  .recommendation-admin-page :deep(.page-toolbar__right .el-select),
  .recommendation-admin-actions .el-button {
    width: 100%;
    margin-left: 0;
  }

  .recommendation-admin-metric-text {
    font-size: 20px;
  }

  .recommendation-admin-scenarios {
    width: 100%;
  }

  .recommendation-admin-scenarios :deep(.el-radio-button) {
    flex: 1 1 50%;
  }

  .recommendation-admin-scenarios :deep(.el-radio-button__inner) {
    width: 100%;
  }
}
</style>
