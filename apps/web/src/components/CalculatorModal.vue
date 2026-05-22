<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="tool-modal-inner tool-modal-inner--calculator">
      <div class="tool-modal-header">
        <div>
          <div class="tool-modal-kicker">{{ t('calculator.title') }}</div>
          <h3>留学总费用估算</h3>
        </div>
        <button class="tool-modal-close" type="button" @click="$emit('close')">×</button>
      </div>

      <div class="tool-modal-body">
        <div class="calculator-picker">
          <label class="field-shell">
            <span>{{ t('calculator.school') }}</span>
            <select v-model.number="selectedUniversityId" @change="resetProgram">
              <option :value="0">{{ t('common.select') }}</option>
              <option v-for="item in catalog.universities" :key="item.id" :value="item.id">{{ text(item.name) }}</option>
            </select>
          </label>
          <label class="field-shell">
            <span>{{ t('calculator.program') }}</span>
            <select v-model.number="selectedProgramId" @change="applyProgramDefaults">
              <option :value="0">{{ t('common.select') }}</option>
              <option v-for="item in availablePrograms" :key="item.id" :value="item.id">{{ text(item.name) }}</option>
            </select>
          </label>
        </div>

        <div class="calculator-grid">
          <label class="field-shell">
            <span>年学费（人民币）</span>
            <input v-model.number="form.tuition" type="number" min="0" step="1000" />
          </label>
          <label class="field-shell">
            <span>年生活费（人民币）</span>
            <input v-model.number="form.living" type="number" min="0" step="1000" />
          </label>
          <label class="field-shell">
            <span>{{ t('calculator.duration') }}</span>
            <input v-model.number="form.duration" type="number" min="0.5" max="8" step="0.5" />
          </label>
          <label class="field-shell">
            <span>其他费用（签证 / 机票等）</span>
            <input v-model.number="form.misc" type="number" min="0" step="1000" />
          </label>
        </div>

        <div class="calc-result">
          <div class="calc-result-label">预估总费用</div>
          <div class="calc-result-total">CNY {{ formatCurrency(grandTotal) }}</div>
          <div class="calc-breakdown">
            <div class="calc-row"><span>年学费 × {{ form.duration }} 年</span><strong>CNY {{ formatCurrency(tuitionTotal) }}</strong></div>
            <div class="calc-row"><span>年生活费 × {{ form.duration }} 年</span><strong>CNY {{ formatCurrency(livingTotal) }}</strong></div>
            <div class="calc-row"><span>其他费用</span><strong>CNY {{ formatCurrency(form.misc) }}</strong></div>
            <div class="calc-row calc-row--total"><span>年总成本</span><strong>CNY {{ formatCurrency(annualTotal) }}{{ t('common.perYear') }}</strong></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { formatCurrency } from "../utils/format";

defineEmits<{ (e: "close"): void }>();

const catalog = useCatalogStore();
const { t } = useI18n();
const { text } = useLocaleText();
const selectedUniversityId = ref(0);
const selectedProgramId = ref(0);
const form = reactive({
  tuition: 50000,
  living: 25000,
  duration: 3,
  misc: 10000
});

const availablePrograms = computed(() => catalog.programs.filter((item) => item.universityId === selectedUniversityId.value));
const selectedUniversity = computed(() => catalog.universities.find((item) => item.id === selectedUniversityId.value));
const selectedProgram = computed(() => catalog.programs.find((item) => item.id === selectedProgramId.value));
const tuitionTotal = computed(() => Number(form.tuition || 0) * Number(form.duration || 0));
const livingTotal = computed(() => Number(form.living || 0) * Number(form.duration || 0));
const annualTotal = computed(() => Number(form.tuition || 0) + Number(form.living || 0));
const grandTotal = computed(() => tuitionTotal.value + livingTotal.value + Number(form.misc || 0));

function resetProgram() {
  selectedProgramId.value = 0;
  if (selectedUniversity.value) {
    form.living = selectedUniversity.value.livingCostCny;
  }
}

function applyProgramDefaults() {
  if (selectedProgram.value) {
    form.tuition = selectedProgram.value.annualTuitionCny;
    form.duration = Number(selectedProgram.value.durationYears) || form.duration;
  }
  if (selectedUniversity.value) {
    form.living = selectedUniversity.value.livingCostCny;
  }
}
</script>
