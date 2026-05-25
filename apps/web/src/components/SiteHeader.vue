<template>
  <header class="site-header">
    <div class="header-inner">
      <RouterLink to="/" class="header-brand-link">
        <div class="header-brand-mark" aria-hidden="true">
          <span class="header-brand-mark-icon ui-icon ui-icon--school"></span>
        </div>
        <div class="header-brand-copy">
          <div class="header-brand-title">
            <span>StudyMY</span>
            <span class="header-brand-badge">2026</span>
          </div>
          <div class="header-brand-subtitle">{{ t('header.platform') }}</div>
        </div>
      </RouterLink>

      <nav class="site-nav" :aria-label="t('header.primaryNavigation')">
        <component
          :is="item.to ? RouterLink : 'button'"
          v-for="item in menuItems"
          :key="item.key"
          :to="item.to"
          class="nav-link"
          :class="{ active: item.to ? isActive(item.to) : false }"
          type="button"
          @click="handleMenuClick(item)"
        >
          <span class="nav-link__icon ui-icon" :class="item.icon" aria-hidden="true"></span>
          <span class="nav-link__label">{{ item.label }}</span>
          <span v-if="item.key === 'favorites' && favoriteCount" class="nav-link__badge">{{ favoriteCount }}</span>
        </component>
      </nav>

      <div class="header-actions">
        <div class="language-switcher" role="group" :aria-label="t('common.language')">
          <button
            v-for="option in localeOptions"
            :key="option.value"
            class="language-switcher__option"
            :class="{ active: option.value === currentLocale }"
            type="button"
            :aria-label="option.label"
            :aria-pressed="option.value === currentLocale"
            :title="option.label"
            @click="switchLocale(option.value)"
          >
            {{ option.shortLabel }}
          </button>
        </div>
        <RouterLink v-if="session.isLoggedIn" class="primary-action" to="/member">{{ session.user?.displayName || headerMemberLabel }}</RouterLink>
        <button v-else class="primary-action" @click="$emit('open-auth', 'login')">{{ headerLoginLabel }}</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import type { SupportedLocale } from "@studymy/shared";
import { useCatalogStore } from "../stores/catalog";
import { useSessionStore } from "../stores/session";

type HeaderMenuItem = {
  key: string;
  label: string;
  icon: string;
  to?: string;
  action?: "calculator" | "recommend";
};

const emit = defineEmits<{
  (e: "open-auth", mode: "login" | "register"): void;
  (e: "open-calculator"): void;
  (e: "open-recommend"): void;
}>();

const session = useSessionStore();
const catalog = useCatalogStore();
const route = useRoute();
const { t, locale } = useI18n();
const favoriteCount = computed(() => catalog.favoriteState.universities.length + catalog.favoriteState.programs.length);
const currentLocale = computed(() => locale.value as SupportedLocale);

const compactHeaderLabels: Partial<Record<SupportedLocale, Record<string, string>>> = {
  en: {
    home: "Universities",
    planner: "Planner",
    calculator: "Costs",
    recommend: "Match",
    member: "Student",
    login: "Sign in"
  },
  ms: {
    planner: "Perancang",
    favorites: "Senarai",
    compare: "Banding",
    member: "Pelajar",
    login: "Log masuk",
    calculator: "Kos",
    recommend: "Padanan"
  }
};

function headerLabel(key: string, fallbackKey: string) {
  return compactHeaderLabels[currentLocale.value]?.[key] || t(fallbackKey);
}

const menuItems = computed<HeaderMenuItem[]>(() => [
  { key: "home", label: headerLabel("home", "nav.home"), icon: "ui-icon--home", to: "/" },
  { key: "planner", label: headerLabel("planner", "nav.planner"), icon: "ui-icon--planner", to: "/planner" },
  { key: "calculator", label: headerLabel("calculator", "nav.calculator"), icon: "ui-icon--calculator", action: "calculator" },
  { key: "recommend", label: headerLabel("recommend", "nav.recommend"), icon: "ui-icon--recommend", action: "recommend" },
  { key: "favorites", label: headerLabel("favorites", "nav.favorites"), icon: "ui-icon--favorites", to: "/favorites" },
  { key: "compare", label: headerLabel("compare", "nav.compare"), icon: "ui-icon--compare", to: "/compare" }
]);

const headerMemberLabel = computed(() => headerLabel("member", "nav.member"));
const headerLoginLabel = computed(() => headerLabel("login", "nav.login"));

const localeOptions = computed<Array<{ value: SupportedLocale; label: string; shortLabel: string }>>(() => [
  { value: "zh-CN", label: t("localeNames.zhCN"), shortLabel: "简" },
  { value: "zh-TW", label: t("localeNames.zhTW"), shortLabel: "繁" },
  { value: "en", label: t("localeNames.en"), shortLabel: "EN" },
  { value: "ms", label: t("localeNames.ms"), shortLabel: "BM" }
]);

function switchLocale(nextLocale: SupportedLocale) {
  locale.value = nextLocale;
  localStorage.setItem("studymy_locale", nextLocale);
  document.documentElement.lang = nextLocale;
}

function handleMenuClick(item: HeaderMenuItem) {
  if (item.action === "calculator") emit("open-calculator");
  if (item.action === "recommend") emit("open-recommend");
}

function isActive(target: string) {
  return target === "/" ? route.path === "/" : route.path.startsWith(target);
}
</script>
