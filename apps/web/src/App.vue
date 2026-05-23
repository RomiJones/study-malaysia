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
      <button class="floating-tool" type="button" @click="showCalculator = true">
        <span class="floating-tool-icon">¥</span>
        <span class="floating-tool-label">{{ t('nav.calculator') }}</span>
      </button>
      <button class="floating-tool" type="button" @click="showRecommend = true">
        <span class="floating-tool-icon">荐</span>
        <span class="floating-tool-label">{{ t('nav.recommend') }}</span>
      </button>
    </div>

    <SiteFooter />
    <AuthModal v-if="session.authOpen" />
    <CalculatorModal v-if="showCalculator" @close="showCalculator = false" />
    <RecommendModal v-if="showRecommend" @close="showRecommend = false" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterView } from "vue-router";
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
const { t } = useI18n();
const showCalculator = ref(false);
const showRecommend = ref(false);
const bootError = ref("");

onMounted(async () => {
  try {
    const [profile] = await Promise.all([session.hydrateUser(), catalog.loadHomeMeta(), catalog.loadUniversities()]);
    if (profile) await catalog.loadUserCollections();
  } catch (error) {
    bootError.value = error instanceof Error ? error.message : "Unknown error";
  }
});
</script>
