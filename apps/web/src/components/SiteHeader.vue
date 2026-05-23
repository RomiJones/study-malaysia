<template>
  <header class="site-header">
    <div class="header-inner">
      <RouterLink to="/" class="header-brand-link">
        <div class="header-brand-mark">SM</div>
        <div class="header-brand-copy">
          <div class="header-brand-title">
            <span>StudyMY</span>
            <span class="header-brand-badge">2026</span>
          </div>
          <div class="header-brand-subtitle">{{ t('header.platform') }}</div>
        </div>
      </RouterLink>

      <nav class="site-nav" aria-label="Primary">
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
          <span class="nav-link__icon">{{ item.icon }}</span>
          <span class="nav-link__label">{{ item.label }}</span>
          <span v-if="item.key === 'favorites' && favoriteCount" class="nav-link__badge">{{ favoriteCount }}</span>
        </component>
      </nav>

      <div class="header-actions">
        <select v-model="locale" class="shell-select" @change="switchLocale">
          <option v-for="option in localeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <RouterLink v-if="session.isLoggedIn" class="primary-action" to="/member">{{ session.user?.displayName || t('nav.member') }}</RouterLink>
        <button v-else class="primary-action" @click="$emit('open-auth', 'login')">{{ t('nav.login') }}</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
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

const menuItems = computed<HeaderMenuItem[]>(() => [
  { key: "home", label: t("nav.home"), icon: "▣", to: "/" },
  { key: "planner", label: t("nav.planner"), icon: "◎", to: "/planner" },
  { key: "calculator", label: t("nav.calculator"), icon: "◈", action: "calculator" },
  { key: "recommend", label: t("nav.recommend"), icon: "✦", action: "recommend" },
  { key: "favorites", label: t("nav.favorites"), icon: "♥", to: "/favorites" },
  { key: "compare", label: t("nav.compare"), icon: "⚖", to: "/compare" }
]);

const localeOptions = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "ms", label: "Bahasa Melayu" }
] as const;

function switchLocale() {
  localStorage.setItem("studymy_locale", locale.value);
}

function handleMenuClick(item: HeaderMenuItem) {
  if (item.action === "calculator") emit("open-calculator");
  if (item.action === "recommend") emit("open-recommend");
}

function isActive(target: string) {
  return target === "/" ? route.path === "/" : route.path.startsWith(target);
}
</script>
