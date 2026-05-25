<template>
  <div class="i18n-admin-page">
    <section class="page-card i18n-admin-hero" v-loading="loading">
      <div class="page-toolbar i18n-admin-hero__toolbar">
        <div>
          <div class="i18n-admin-hero__title">多语言切换管理</div>
          <div class="section-subtitle">
            维护管理端可验证的语言切换入口、语言选项、持久化状态和用户端顶部导航多语言布局契约。
          </div>
        </div>
        <div class="page-toolbar__right">
          <el-button :loading="loading" @click="loadOptions">刷新契约</el-button>
          <el-button type="primary" :loading="applying" @click="applyLocale">应用切换</el-button>
        </div>
      </div>

      <el-alert
        v-if="loadError"
        class="i18n-admin-alert"
        :title="loadError"
        type="warning"
        show-icon
        :closable="false"
      />

      <div class="metrics-grid i18n-admin-metrics">
        <div class="metric-card">
          <div class="metric-card__label">支持语言</div>
          <div class="metric-card__value">{{ languageRows.length }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">当前语言</div>
          <div class="metric-card__value i18n-admin-metric-text">{{ currentLocaleLabel }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">持久化状态</div>
          <div class="metric-card__value i18n-admin-metric-text">{{ persistenceLabel }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">路由保持</div>
          <div class="metric-card__value i18n-admin-metric-text">{{ preserveRoute ? "开启" : "关闭" }}</div>
        </div>
      </div>
    </section>

    <section class="page-card">
      <div class="split-grid i18n-admin-split">
        <el-form label-position="top" class="i18n-admin-form">
          <div class="i18n-admin-section-title">切换表单</div>
          <el-form-item label="目标语言">
            <el-select v-model="selectedLocale" filterable>
              <el-option
                v-for="option in languageRows"
                :key="option.value"
                :label="`${option.nativeLabel} / ${option.value}`"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="切换来源">
            <el-select v-model="switchSource">
              <el-option label="顶部语言切换器" value="header" />
              <el-option label="移动端菜单" value="mobile-menu" />
              <el-option label="账号设置" value="account-settings" />
              <el-option label="系统默认" value="system" />
            </el-select>
          </el-form-item>
          <el-form-item label="当前路由">
            <el-input v-model="currentRoutePath" placeholder="/universities" />
          </el-form-item>
          <el-form-item label="切换后保持当前路由">
            <el-switch v-model="preserveRoute" active-text="保持" inactive-text="不保持" />
          </el-form-item>
        </el-form>

        <div class="i18n-admin-status">
          <div class="i18n-admin-section-title">状态交互</div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="状态">
              <el-tag :type="switchStatusType">{{ switchStatusLabel }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="本地存储 Key">{{ storageKey }}</el-descriptions-item>
            <el-descriptions-item label="请求 Header">{{ requestHeader }}</el-descriptions-item>
            <el-descriptions-item label="查询参数">{{ queryParam }}</el-descriptions-item>
            <el-descriptions-item label="保留路由">{{ preservedRoutePath || "-" }}</el-descriptions-item>
          </el-descriptions>
          <el-alert
            v-if="switchMessage"
            class="i18n-admin-alert"
            :title="switchMessage"
            :type="switchStatusType === 'success' ? 'success' : 'info'"
            show-icon
            :closable="false"
          />
        </div>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>语言选项列表</strong>
          <div class="section-subtitle">用于核对四语言展示名、启用状态和排序。</div>
        </div>
        <el-radio-group v-model="previewLocale">
          <el-radio-button v-for="option in languageRows" :key="option.value" :label="option.value">
            {{ option.shortLabel }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="i18n-admin-table-wrap">
        <el-table :data="languageRows" border>
          <el-table-column prop="value" label="Locale" width="110" />
          <el-table-column prop="nativeLabel" label="原生名称" min-width="180" />
          <el-table-column label="预览文案" min-width="200">
            <template #default="scope">{{ labelText(scope.row.label, previewLocale) }}</template>
          </el-table-column>
          <el-table-column prop="shortLabel" label="短标签" width="90" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.enabled ? 'success' : 'info'">{{ scope.row.enabled ? "启用" : "停用" }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="sortOrder" label="排序" width="90" />
        </el-table>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>顶部导航多语言契约</strong>
          <div class="section-subtitle">用于验证长文案、导航区域、优先级和断点策略。</div>
        </div>
      </div>
      <el-tabs v-model="contractTab">
        <el-tab-pane label="导航项" name="items">
          <div class="i18n-admin-table-wrap">
            <el-table :data="navigationItems" border>
              <el-table-column prop="id" label="ID" min-width="170" />
              <el-table-column label="当前语言文案" min-width="220">
                <template #default="scope">{{ labelText(scope.row.label, previewLocale) }}</template>
              </el-table-column>
              <el-table-column prop="routePath" label="路由" min-width="220" />
              <el-table-column prop="region" label="区域" width="110" />
              <el-table-column prop="longLabelBehavior" label="长文案策略" min-width="170" />
              <el-table-column prop="priority" label="优先级" width="90" />
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="断点策略" name="breakpoints">
          <div class="i18n-admin-table-wrap">
            <el-table :data="breakpointRows" border>
              <el-table-column prop="name" label="断点" width="110" />
              <el-table-column prop="range" label="宽度范围" min-width="160" />
              <el-table-column prop="layoutMode" label="布局模式" min-width="140" />
              <el-table-column prop="overflowStrategy" label="溢出策略" min-width="170" />
              <el-table-column prop="primaryGapPx" label="导航间距" width="110" />
              <el-table-column prop="actionGapPx" label="操作间距" width="110" />
              <el-table-column prop="languageSwitcherPlacement" label="语言入口位置" min-width="180" />
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  HEADER_NAVIGATION_CONTRACT,
  LANGUAGE_SWITCHER_CONTRACT,
  LANGUAGE_SWITCHER_OPTIONS,
  LOCALE_QUERY_PARAM,
  LOCALE_REQUEST_HEADER,
  LOCALE_STORAGE_KEY,
  isSupportedLocale,
  type HeaderNavigationBreakpointContract,
  type HeaderNavigationContract,
  type LanguageSwitcherContract,
  type LocaleOptionContract,
  type LocaleSwitchResponseDto,
  type LocaleSwitchTrigger,
  type LocalizedText,
  type SupportedLocale
} from "@studymy/shared";
import { adminApi } from "@/api/admin";

type I18nOptionsResponse = {
  switcher?: LanguageSwitcherContract;
  preference?: LocaleSwitchResponseDto["preference"];
  navigation?: HeaderNavigationContract;
  request?: {
    header: string;
    queryParam: string;
    storageKey: string;
  };
};

const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
const selectedLocale = ref<SupportedLocale>(isSupportedLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE);
const previewLocale = ref<SupportedLocale>(selectedLocale.value);
const switchSource = ref<LocaleSwitchTrigger>("account-settings");
const currentRoutePath = ref("/universities");
const preserveRoute = ref(true);
const contractTab = ref("items");
const loading = ref(false);
const applying = ref(false);
const loadError = ref("");
const optionsResponse = ref<I18nOptionsResponse | null>(null);
const switchResult = ref<LocaleSwitchResponseDto | null>(null);

const switcher = computed(() => optionsResponse.value?.switcher || LANGUAGE_SWITCHER_CONTRACT);
const navigation = computed(() => optionsResponse.value?.navigation || HEADER_NAVIGATION_CONTRACT);
const storageKey = computed(() => optionsResponse.value?.request?.storageKey || switcher.value.storageKey || LOCALE_STORAGE_KEY);
const requestHeader = computed(() => optionsResponse.value?.request?.header || switcher.value.requestHeader || LOCALE_REQUEST_HEADER);
const queryParam = computed(() => optionsResponse.value?.request?.queryParam || switcher.value.queryParam || LOCALE_QUERY_PARAM);
const languageRows = computed<LocaleOptionContract[]>(() =>
  [...(switcher.value.options?.length ? switcher.value.options : LANGUAGE_SWITCHER_OPTIONS)].sort((a, b) => a.sortOrder - b.sortOrder)
);
const navigationItems = computed(() => [...navigation.value.items].sort((a, b) => a.priority - b.priority));
const breakpointRows = computed(() => navigation.value.breakpoints.map(formatBreakpoint));
const preference = computed(() => switchResult.value?.preference || optionsResponse.value?.preference || null);
const preservedRoutePath = computed(() => switchResult.value?.preservedRoutePath || "");
const switchStatusLabel = computed(() => statusLabel(switchResult.value?.status || "accepted"));
const switchStatusType = computed(() => (switchResult.value?.status === "unsupported-locale" ? "warning" : "success"));
const switchMessage = computed(() => switchResult.value?.message ? labelText(switchResult.value.message, previewLocale.value) : "");
const currentLocaleLabel = computed(() => {
  const option = languageRows.value.find((item) => item.value === selectedLocale.value);
  return option ? option.shortLabel : selectedLocale.value;
});
const persistenceLabel = computed(() => {
  if (preference.value?.persisted) return "账号已保存";
  return localStorage.getItem(storageKey.value) ? "本机已保存" : "未保存";
});

const labelText = (text: LocalizedText, locale: SupportedLocale) =>
  text?.[locale] || text?.[FALLBACK_LOCALE] || text?.[DEFAULT_LOCALE] || "-";

const statusLabel = (status: LocaleSwitchResponseDto["status"]) => {
  if (status === "fallback-applied") return "已应用兼容语言";
  if (status === "unsupported-locale") return "不支持的语言";
  return "已接受";
};

const formatBreakpoint = (item: HeaderNavigationBreakpointContract) => ({
  ...item,
  range: item.maxWidthPx === undefined ? `${item.minWidthPx}px+` : `${item.minWidthPx}-${item.maxWidthPx}px`
});

const loadOptions = async () => {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await adminApi.i18nOptions(selectedLocale.value);
    optionsResponse.value = data || null;
    const apiLocale = data?.switcher?.currentLocale || data?.preference?.locale;
    if (isSupportedLocale(apiLocale)) {
      selectedLocale.value = apiLocale;
      previewLocale.value = apiLocale;
    }
  } catch (error) {
    optionsResponse.value = null;
    loadError.value = `无法读取后端 i18n 契约，当前使用本地共享契约预览：${errorMessage(error)}`;
  } finally {
    loading.value = false;
  }
};

const applyLocale = async () => {
  applying.value = true;
  try {
    const result = await adminApi.switchLocale({
      locale: selectedLocale.value,
      source: switchSource.value,
      currentRoutePath: currentRoutePath.value,
      preserveRoute: preserveRoute.value
    });
    switchResult.value = result;
    persistLocale(result?.preference?.locale || selectedLocale.value);
    ElMessage.success("语言切换状态已更新");
  } catch (error) {
    persistLocale(selectedLocale.value);
    switchResult.value = {
      status: "accepted",
      preference: {
        locale: selectedLocale.value,
        fallbackLocale: FALLBACK_LOCALE,
        source: "local-storage",
        persistenceScope: "device",
        persisted: false,
        updatedAt: new Date().toISOString()
      },
      options: languageRows.value,
      preservedRoutePath: preserveRoute.value ? currentRoutePath.value : undefined,
      message: {
        en: "Locale saved locally because API switching is unavailable.",
        ms: "Bahasa disimpan secara setempat kerana API tidak tersedia.",
        "zh-CN": "后端切换接口不可用，已保存到本机预览状态。",
        "zh-TW": "後端切換介面不可用，已保存到本機預覽狀態。"
      }
    };
    ElMessage.warning(errorMessage(error));
  } finally {
    applying.value = false;
  }
};

const persistLocale = (locale: string) => {
  if (!isSupportedLocale(locale)) return;
  selectedLocale.value = locale;
  previewLocale.value = locale;
  localStorage.setItem(storageKey.value, locale);
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "请求失败");

onMounted(loadOptions);
</script>
