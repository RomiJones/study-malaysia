<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="tool-modal-inner tool-modal-inner--recommend">
      <div class="tool-modal-header">
        <div>
          <div class="tool-modal-kicker">基于你的画像匹配</div>
          <h3>{{ t('recommend.title') }}</h3>
        </div>
        <button class="tool-modal-close" type="button" @click="$emit('close')">×</button>
      </div>

      <div class="tool-modal-body">
        <div v-if="planner.loading && !dashboard" class="fav-empty">
          <div class="fav-empty-icon">荐</div>
          <strong>{{ t('common.loading') }}</strong>
        </div>

        <template v-else-if="dashboard">
          <div class="recommend-profile-strip">
            <span>{{ levelLabel(dashboard.profile.level) }}</span>
            <span>{{ categoryLabel(dashboard.profile.targetCategory) }}</span>
            <span>CNY {{ formatCurrency(dashboard.profile.budgetCny) }}</span>
            <span>GPA {{ dashboard.profile.gpa }}</span>
            <span>IELTS {{ dashboard.profile.ielts }}</span>
          </div>

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
            <div class="fav-empty-icon">荐</div>
            <strong>暂无完全匹配的推荐</strong>
            <span>请在申请规划里调整画像参数后重新查看。</span>
            <RouterLink class="btn btn-gold" to="/planner" @click="$emit('close')">完善学生画像</RouterLink>
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
import type { DegreeLevel } from "@studymy/shared";
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

function levelLabel(level: DegreeLevel) {
  return t(`degree.${level}`);
}

function categoryLabel(value: string) {
  const coreLabels: Record<string, string> = {
    business: t('category.business'),
    it: t('category.it'),
    engineering: t('category.engineering'),
    science: t('category.science'),
    arts: t('category.arts'),
    medicine: t('category.medicine'),
    law: t('category.law')
  };
  return coreLabels[value] || value;
}
</script>
