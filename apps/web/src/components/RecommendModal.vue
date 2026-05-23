<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="tool-modal-inner tool-modal-inner--recommend">
      <div class="tool-modal-header">
        <div>
          <div class="tool-modal-kicker">{{ t('recommend.kicker') }}</div>
          <h3>{{ t('recommend.title') }}</h3>
        </div>
        <button class="tool-modal-close" type="button" :aria-label="t('common.close')" @click="$emit('close')">×</button>
      </div>

      <div class="tool-modal-body">
        <div v-if="planner.loading && !dashboard" class="fav-empty">
          <div class="fav-empty-icon">✦</div>
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
            <div class="fav-empty-icon">✦</div>
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

</script>
