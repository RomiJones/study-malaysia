<template>
  <section v-if="dashboard" class="grid gap-6">
    <div class="section-card rounded-[32px] p-6 md:p-8">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{{ t('nav.member') }}</div>
          <h1 class="section-title mt-2">{{ t('member.title') }}</h1>
        </div>
        <button class="secondary-action" @click="logout">{{ t('common.logout') }}</button>
      </div>
      <div class="feature-grid mt-6">
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.account') }}</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ session.user?.displayName }}</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.readiness') }}</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ dashboard.summary.readinessScore }}/100</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.activeTasks') }}</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ dashboard.summary.activeTaskCount }}</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.visa') }}</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ dashboard.summary.visaDoneCount }}/5</div>
        </div>
      </div>
    </div>

    <div class="program-grid">
      <RouterLink class="data-card rounded-[24px] p-6 card-hover" to="/planner">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('nav.planner') }}</div>
        <h2 class="mt-2 text-2xl font-black text-slate-900">{{ t('member.continuePlanner') }}</h2>
        <p class="muted mt-3 text-sm">{{ t('member.continuePlannerDesc') }}</p>
      </RouterLink>
      <RouterLink class="data-card rounded-[24px] p-6 card-hover" to="/favorites">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('nav.favorites') }}</div>
        <h2 class="mt-2 text-2xl font-black text-slate-900">{{ t('member.viewFavorites') }}</h2>
        <p class="muted mt-3 text-sm">{{ t('member.viewFavoritesDesc') }}</p>
      </RouterLink>
      <RouterLink class="data-card rounded-[24px] p-6 card-hover" to="/compare">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('nav.compare') }}</div>
        <h2 class="mt-2 text-2xl font-black text-slate-900">{{ t('member.backCompare') }}</h2>
        <p class="muted mt-3 text-sm">{{ t('member.backCompareDesc') }}</p>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { usePlannerStore } from "../stores/planner";
import { useSessionStore } from "../stores/session";

const planner = usePlannerStore();
const session = useSessionStore();
const router = useRouter();
const { t } = useI18n();
const dashboard = computed(() => planner.dashboard);

onMounted(async () => {
  if (!session.isLoggedIn) {
    session.openAuth('login');
    router.push('/');
    return;
  }
  if (!dashboard.value) {
    await planner.load();
  }
});

function logout() {
  session.logout();
  router.push('/');
}
</script>