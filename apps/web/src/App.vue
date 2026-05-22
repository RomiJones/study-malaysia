<template>
  <div class="app-shell">
    <SiteHeader
      @open-auth="session.openAuth"
      @open-calculator="showCalculator = true"
      @open-recommend="showRecommend = true"
    />

    <main class="page-shell">
      <div v-if="bootError" class="app-alert">
        {{ t('common.initError') }}: {{ bootError }}
      </div>
      <RouterView />
    </main>

    <div class="floating-tools">
      <RouterLink v-if="session.isLoggedIn" class="floating-tool" :class="{ active: route.path === '/favorites' }" to="/favorites">
        <span class="floating-tool-icon">藏</span>
        <span class="floating-tool-label">{{ t('nav.favorites') }}</span>
        <span v-if="favoriteCount" class="floating-tool-badge">{{ favoriteCount }}</span>
      </RouterLink>
      <RouterLink class="floating-tool" :class="{ active: route.path === '/compare' }" to="/compare">
        <span class="floating-tool-icon">比</span>
        <span class="floating-tool-label">{{ t('nav.compare') }}</span>
        <span v-if="compareCount" class="floating-tool-badge floating-tool-badge--accent">{{ compareCount }}</span>
      </RouterLink>
    </div>

    <SiteFooter />
    <AuthModal v-if="session.authOpen" />
    <CalculatorModal v-if="showCalculator" @close="showCalculator = false" />
    <RecommendModal v-if="showRecommend" @close="showRecommend = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import AuthModal from "./components/AuthModal.vue";
import CalculatorModal from "./components/CalculatorModal.vue";
import RecommendModal from "./components/RecommendModal.vue";
import SiteFooter from "./components/SiteFooter.vue";
import SiteHeader from "./components/SiteHeader.vue";
import { useCatalogStore } from "./stores/catalog";
import { useSessionStore } from "./stores/session";

const session = useSessionStore();
const catalog = useCatalogStore();
const route = useRoute();
const { t } = useI18n();
const showCalculator = ref(false);
const showRecommend = ref(false);
const bootError = ref("");
const favoriteCount = computed(() => catalog.favoriteState.universities.length + catalog.favoriteState.programs.length);
const compareCount = computed(() => catalog.compareIds.length);

onMounted(async () => {
  try {
    await Promise.all([session.hydrateUser(), catalog.loadHomeMeta(), catalog.loadUniversities()]);
  } catch (error) {
    bootError.value = error instanceof Error ? error.message : "Unknown error";
  }
});
</script>
