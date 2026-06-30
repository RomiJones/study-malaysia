<template>
  <div class="smart-rec-panel" :class="`smart-rec-panel--${context}`">
    <div v-if="showLoading" class="smart-rec-state">
      <div class="fav-empty-icon" aria-hidden="true">
        <span class="ui-icon ui-icon--recommend"></span>
      </div>
      <strong>{{ t('common.loading') }}</strong>
    </div>

    <div v-else-if="status === 'login-required'" class="smart-rec-state smart-rec-state--gate">
      <div class="fav-empty-icon" aria-hidden="true">
        <span class="ui-icon ui-icon--recommend"></span>
      </div>
      <strong>{{ t('recommend.loginRequiredTitle') }}</strong>
      <span>{{ t('recommend.loginRequiredBody') }}</span>
      <div class="smart-rec-actions">
        <button class="btn btn-gold" type="button" @click="$emit('open-auth', 'login')">{{ t('recommend.loginAction') }}</button>
        <button class="btn btn-outline" type="button" @click="$emit('open-auth', 'register')">{{ t('recommend.registerAction') }}</button>
      </div>
    </div>

    <div v-else-if="status === 'profile-incomplete'" class="smart-rec-state smart-rec-state--gate">
      <div class="smart-rec-gate-head">
        <div>
          <strong>{{ t('recommend.profileIncompleteTitle') }}</strong>
          <span>{{ t('recommend.profileIncompleteBody') }}</span>
        </div>
        <div v-if="profileCompleteness" class="smart-rec-progress">
          <span>{{ t('recommend.profileCompleteness') }}</span>
          <strong>{{ profileCompleteness.score }}%</strong>
        </div>
      </div>
      <div v-if="profileCompleteness" class="progress-bar">
        <div class="progress-fill" :style="{ width: `${profileCompleteness.score}%` }"></div>
      </div>
      <div v-if="missingFieldLabels.length" class="smart-rec-missing">
        <span>{{ t('recommend.missingFields') }}</span>
        <span v-for="field in missingFieldLabels" :key="field" class="chip chip-ink">{{ field }}</span>
      </div>
      <div class="smart-rec-actions">
        <button class="btn btn-gold" type="button" @click="$emit('open-profile')">{{ t('recommend.viewPlannerProfile') }}</button>
      </div>
    </div>

    <div v-else-if="status === 'error'" class="smart-rec-state smart-rec-state--error">
      <div class="fav-empty-icon" aria-hidden="true">
        <span class="ui-icon ui-icon--recommend"></span>
      </div>
      <strong>{{ t('recommend.errorTitle') }}</strong>
      <span>{{ t('recommend.errorBody') }}</span>
      <button class="btn btn-outline" type="button" :disabled="smart.loading" @click="refresh">
        {{ smart.loading ? t('recommend.refreshing') : t('recommend.retry') }}
      </button>
    </div>

    <template v-else>
      <div v-if="visibleRecommendations.length" class="smart-rec-result">
        <div class="smart-rec-source">
          <span>{{ t('recommend.resultSource') }}</span>
          <strong>{{ t('recommend.generatedFromSavedProfile') }}</strong>
        </div>
        <div class="recommendation-list">
          <RouterLink
            v-for="(item, index) in visibleRecommendations"
            :key="item.program.id"
            class="rec-card rec-card--smart"
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
                <span class="chip" :class="tierChipClass(item.tier, index)">{{ tierLabel(item.tier, index) }}</span>
                <span class="chip chip-ink">{{ annualCostLabel(item.annualCostCny) }}</span>
                <span v-if="hasVerifiedProgramFee(item.program)" class="chip chip-success">{{ formatProgramFeeVerifiedLabel(currentLocale) }}</span>
                <span class="chip chip-teal">IELTS {{ item.program.languageRequirement.ielts }}+</span>
              </div>
              <div class="rec-card__notes">
                <span v-for="reason in recommendationReasons(item)" :key="reason" class="rec-note">{{ reason }}</span>
                <span v-for="risk in recommendationRisks(item)" :key="risk" class="rec-note rec-note--risk">{{ risk }}</span>
              </div>
            </div>
          </RouterLink>
        </div>
        <button class="btn btn-outline smart-rec-refresh" type="button" :disabled="smart.loading" @click="refresh">
          {{ smart.loading ? t('recommend.refreshing') : t('recommend.refresh') }}
        </button>
      </div>

      <div v-else class="smart-rec-state">
        <div class="fav-empty-icon" aria-hidden="true">
          <span class="ui-icon ui-icon--recommend"></span>
        </div>
        <strong>{{ t('recommend.noMatchTitle') }}</strong>
        <span>{{ t('recommend.noMatchBody') }}</span>
        <button class="btn btn-gold" type="button" @click="$emit('open-profile')">{{ t('recommend.viewPlannerProfile') }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  LOCAL_UNIVERSITY_LOGO_FALLBACK,
  type ApplicationTier,
  type SmartRecommendationResultDto,
  type SmartRecommendationRequiredProfileField
} from "@studymy/shared";
import { useLocaleText } from "../composables/useLocaleText";
import { useSessionStore } from "../stores/session";
import { useSmartRecommendationsStore } from "../stores/recommendations";
import { formatCurrency, formatProgramFeeVerifiedLabel, hasVerifiedProgramFee, officialConfirmationFallback } from "../utils/format";

const props = withDefaults(defineProps<{
  context?: "modal" | "planner";
  limit?: number;
}>(), {
  context: "modal",
  limit: 8
});

defineEmits<{
  (e: "open-auth", mode: "login" | "register"): void;
  (e: "open-profile"): void;
  (e: "close"): void;
}>();

const smart = useSmartRecommendationsStore();
const session = useSessionStore();
const { t } = useI18n();
const { currentLocale, text, array } = useLocaleText();

const context = computed(() => props.context);
const status = computed(() => smart.status);
const profileCompleteness = computed(() => smart.profileCompleteness);
const showLoading = computed(() => smart.loading && !smart.response);
const visibleRecommendations = computed(() => smart.recommendations.slice(0, props.limit));
const missingFieldLabels = computed(() => {
  const fields = smart.gate?.missingProfileFields || [];
  return fields.map((field) => profileFieldLabel(field));
});

function annualCostLabel(value: number | null) {
  return value == null
    ? officialConfirmationFallback(currentLocale.value)
    : `CNY ${formatCurrency(value)}${t('common.perYear')}`;
}

onMounted(() => {
  void smart.load(currentLocale.value);
});

watch([() => session.token, () => currentLocale.value], () => {
  void smart.load(currentLocale.value, { force: true });
});

function profileFieldLabel(field: SmartRecommendationRequiredProfileField) {
  return t(`recommend.fields.${field}`);
}

function recommendationReasons(item: SmartRecommendationResultDto) {
  if (item.reasonsDetailed?.length) {
    return item.reasonsDetailed.slice(0, 2).map((reason) => text(reason.message));
  }
  return array(item.reasons).slice(0, 2);
}

function recommendationRisks(item: SmartRecommendationResultDto) {
  return (item.risks || []).slice(0, 1).map((risk) => text(risk.message));
}

function tierLabel(tier: ApplicationTier | undefined, index: number) {
  if (tier === "reach" || tier === "target" || tier === "safe") return t(`planner.tiers.${tier}`);
  if (index === 0) return t('planner.tiers.reach');
  if (index < 3) return t('planner.tiers.target');
  return t('planner.tiers.safe');
}

function tierChipClass(tier: ApplicationTier | undefined, index: number) {
  const value = tier || (index === 0 ? "reach" : index < 3 ? "target" : "safe");
  if (value === "reach") return "chip-gold";
  if (value === "target") return "chip-teal";
  return "chip-blue";
}

function refresh() {
  void smart.refresh(currentLocale.value);
}

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

<style scoped>
.smart-rec-panel {
  display: grid;
  gap: 14px;
}

.smart-rec-state {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 34px 22px;
  text-align: center;
  color: var(--ink-3);
  line-height: 1.65;
}

.smart-rec-state strong {
  color: var(--ink);
  font-size: 18px;
}

.smart-rec-state--gate {
  justify-items: stretch;
  border: 1px solid rgba(200, 168, 75, 0.28);
  border-radius: var(--r);
  background: #fffaf0;
}

.smart-rec-state--error {
  color: var(--red);
}

.smart-rec-gate-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  text-align: left;
}

.smart-rec-gate-head > div:first-child {
  display: grid;
  gap: 6px;
}

.smart-rec-progress {
  min-width: 92px;
  display: grid;
  justify-items: end;
  gap: 2px;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.smart-rec-progress strong {
  color: var(--teal);
  font-family: "DM Serif Display", Georgia, serif;
  font-size: 28px;
  line-height: 1;
}

.smart-rec-missing {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.smart-rec-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.smart-rec-result {
  display: grid;
  gap: 12px;
}

.smart-rec-source {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--paper-2);
  padding: 10px 12px;
  color: var(--ink-3);
  font-size: 12px;
}

.smart-rec-source strong {
  color: var(--ink-2);
  text-align: right;
}

.rec-card--smart {
  min-width: 0;
}

.rec-card__body {
  flex: 1;
}

.rec-card__notes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.rec-note {
  border-radius: 999px;
  background: var(--teal-lt);
  color: var(--teal);
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.rec-note--risk {
  background: var(--gold-lt);
  color: #8a6a10;
}

.smart-rec-refresh {
  justify-self: end;
}

@media (max-width: 760px) {
  .smart-rec-state {
    padding: 26px 16px;
  }

  .smart-rec-gate-head,
  .smart-rec-source,
  .rec-card--smart {
    align-items: flex-start;
    flex-direction: column;
  }

  .smart-rec-progress {
    justify-items: start;
  }

  .smart-rec-source strong {
    text-align: left;
  }

  .rec-score {
    width: 36px;
    height: 36px;
  }

  .rec-card__logo {
    display: none;
  }

  .smart-rec-refresh,
  .smart-rec-actions .btn {
    width: 100%;
  }
}
</style>
