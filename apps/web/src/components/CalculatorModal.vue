<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="tool-modal-inner tool-modal-inner--calculator">
      <div class="tool-modal-header">
        <div>
          <div class="tool-modal-kicker">{{ t('calculator.title') }}</div>
          <h3>{{ t('calculator.heading') }}</h3>
        </div>
        <button class="tool-modal-close" type="button" :aria-label="t('common.close')" @click="$emit('close')">
          <span class="ui-icon ui-icon--close" aria-hidden="true"></span>
        </button>
      </div>

      <div class="tool-modal-body">
        <div class="calculator-grid">
          <label class="field-shell">
            <span>{{ t('calculator.annualTuitionCny') }}</span>
            <input v-model.number="form.tuition" type="number" min="0" step="1000" />
          </label>
          <label class="field-shell">
            <span>{{ t('calculator.annualLivingCny') }}</span>
            <input v-model.number="form.living" type="number" min="0" step="1000" />
          </label>
          <label class="field-shell">
            <span>{{ t('calculator.duration') }}</span>
            <input v-model.number="form.duration" type="number" min="0.5" max="8" step="0.5" />
          </label>
          <label class="field-shell">
            <span>{{ t('calculator.miscCostCny') }}</span>
            <input v-model.number="form.misc" type="number" min="0" step="1000" />
          </label>
        </div>

        <div class="calc-result">
          <div class="calc-result-label">{{ t('calculator.estimatedTotal') }}</div>
          <div class="calc-result-total">CNY {{ formatCurrency(grandTotal) }}</div>
          <div class="calc-breakdown">
            <div class="calc-row"><span>{{ t('calculator.tuitionBreakdown', { years: form.duration }) }}</span><strong>CNY {{ formatCurrency(tuitionTotal) }}</strong></div>
            <div class="calc-row"><span>{{ t('calculator.livingBreakdown', { years: form.duration }) }}</span><strong>CNY {{ formatCurrency(livingTotal) }}</strong></div>
            <div class="calc-row"><span>{{ t('calculator.miscBreakdown') }}</span><strong>CNY {{ formatCurrency(form.misc) }}</strong></div>
            <div class="calc-row calc-row--total"><span>{{ t('calculator.annualTotal') }}</span><strong>CNY {{ formatCurrency(annualTotal) }}{{ t('common.perYear') }}</strong></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import { formatCurrency } from "../utils/format";

defineEmits<{ (e: "close"): void }>();

const { t } = useI18n();
const form = reactive({
  tuition: 50000,
  living: 25000,
  duration: 3,
  misc: 10000
});

const tuitionTotal = computed(() => Number(form.tuition || 0) * Number(form.duration || 0));
const livingTotal = computed(() => Number(form.living || 0) * Number(form.duration || 0));
const annualTotal = computed(() => Number(form.tuition || 0) + Number(form.living || 0));
const grandTotal = computed(() => tuitionTotal.value + livingTotal.value + Number(form.misc || 0));
</script>
