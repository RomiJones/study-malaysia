<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="tool-modal-inner tool-modal-inner--recommend">
      <div class="tool-modal-header">
        <div>
          <div class="tool-modal-kicker">{{ t('recommend.kicker') }}</div>
          <h3>{{ t('recommend.title') }}</h3>
        </div>
        <button class="tool-modal-close" type="button" :aria-label="t('common.close')" @click="$emit('close')">
          <span class="ui-icon ui-icon--close" aria-hidden="true"></span>
        </button>
      </div>

      <div class="tool-modal-body">
        <div v-if="planner.syncError" class="inline-alert inline-alert--error">{{ planner.syncError }}</div>

        <div v-if="planner.loading && !dashboard" class="fav-empty">
          <div class="fav-empty-icon" aria-hidden="true">
            <span class="ui-icon ui-icon--recommend"></span>
          </div>
          <strong>{{ t('common.loading') }}</strong>
        </div>

        <template v-else-if="dashboard">
          <div v-if="dashboard.recommendations.length" class="recommendation-list">
            <RouterLink
              v-for="item in dashboard.recommendations"
              :key="item.program.id"
              class="rec-card"
              :to="`/universities/${item.university.slug}?program=${item.program.id}`"
              @click="$emit('close')"
            >
              <div class="rec-score">{{ item.score }}</div>
              <img
                class="rec-card__logo"
                :src="item.university.logoUrl || LOCAL_UNIVERSITY_LOGO_FALLBACK"
                :alt="item.university.shortName"
                @error="replaceBrokenLogo"
              />
              <div class="rec-card__body">
                <div class="rec-card__title">{{ text(item.program.name) }}</div>
                <div class="rec-card__meta">{{ text(item.university.name) }} · QS #{{ item.university.qsRank }}</div>
                <div class="rec-card__chips">
                  <span class="chip chip-ink">CNY {{ formatCurrency(item.annualCostCny) }}{{ t('common.perYear') }}</span>
                  <span class="chip chip-teal">IELTS {{ item.program.languageRequirement.ielts }}+</span>
                </div>
              </div>
            </RouterLink>
          </div>

          <div v-else class="fav-empty">
            <div class="fav-empty-icon" aria-hidden="true">
              <span class="ui-icon ui-icon--recommend"></span>
            </div>
            <strong>{{ t('recommend.emptyTitle') }}</strong>
            <span>{{ t('recommend.emptyBody') }}</span>
            <RouterLink class="btn btn-gold" to="/planner" @click="$emit('close')">{{ t('recommend.improveProfile') }}</RouterLink>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { LOCAL_UNIVERSITY_LOGO_FALLBACK } from "@studymy/shared";
import { useLocaleText } from "../composables/useLocaleText";
import { usePlannerStore } from "../stores/planner";
import { formatCurrency } from "../utils/format";

defineEmits<{ (e: "close"): void }>();

const planner = usePlannerStore();
const { t } = useI18n();
const { text } = useLocaleText();
const dashboard = computed(() => planner.dashboard);

onMounted(() => {
  if (!planner.dashboard) void planner.load();
});

function replaceBrokenLogo(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) return;
  if (target.dataset.fallbackApplied) {
    target.style.display = "none";
    return;
  }
  target.dataset.fallbackApplied = "true";
  target.src = LOCAL_UNIVERSITY_LOGO_FALLBACK;
}
</script>
