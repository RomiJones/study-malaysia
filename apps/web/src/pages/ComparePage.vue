<template>
  <section class="compare-page">
    <div class="section-card compare-page__header">
      <div>
        <div class="section-kicker">{{ t('nav.compare') }}</div>
        <h1 class="section-title">{{ t('comparePage.title') }}</h1>
      </div>
      <button v-if="compareUniversities.length" class="secondary-action" @click="catalog.clearCompare">{{ t('comparePage.clear') }}</button>
    </div>

    <div v-if="catalog.compareMessage" class="app-alert compare-alert">{{ catalog.compareMessage }}</div>

    <div v-if="compareUniversities.length < 2" class="fav-empty section-card">
      <div class="fav-empty-icon">VS</div>
      <div class="serif text-xl">请至少选择 2 所院校进行对比</div>
      <div class="text-slate-500 mt-2">在院校卡片上点击对比按钮，最多可同时比较 4 所。</div>
      <RouterLink class="primary-action mt-4" to="/">{{ t('home.browseUniversities') }}</RouterLink>
    </div>

    <div v-else class="section-card compare-table-card">
      <div class="compare-table-scroll">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-label-col">{{ t('comparePage.dimension') }}</th>
              <th v-for="item in compareUniversities" :key="item.id">
                <div class="compare-head-cell">
                  <div>
                    <div class="compare-head-name">{{ text(item.name) }}</div>
                    <div class="compare-head-sub">QS #{{ item.qsRank }} · {{ item.shortName }}</div>
                  </div>
                  <button class="compare-remove" @click="catalog.toggleCompare(item.id)">移除</button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <td class="compare-label-col">{{ row.label }}</td>
              <td v-for="item in compareUniversities" :key="`${row.key}-${item.id}`">
                <component
                  :is="row.key === 'detail' ? RouterLink : 'span'"
                  v-bind="row.key === 'detail' ? { to: `/universities/${item.slug}`, class: 'primary-action compare-detail-link' } : {}"
                >
                  {{ row.value(item) }}
                </component>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { UniversityListItem } from "@studymy/shared";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { formatCurrency } from "../utils/format";

const catalog = useCatalogStore();
const { t } = useI18n();
const { text } = useLocaleText();

const compareUniversities = computed(() =>
  catalog.compareIds
    .map((id) => catalog.universities.find((item) => item.id === id))
    .filter((item): item is UniversityListItem => Boolean(item))
);

const rows = computed(() => [
  { key: "qsRank", label: "QS 排名", value: (item: UniversityListItem) => `QS #${item.qsRank}` },
  { key: "ownership", label: "院校类型", value: (item: UniversityListItem) => t(`ownership.${item.ownership}`) },
  { key: "location", label: "所在地", value: (item: UniversityListItem) => text(item.location) },
  { key: "founded", label: "建校年份", value: (item: UniversityListItem) => `${item.foundedYear}` },
  { key: "students", label: "在校学生", value: (item: UniversityListItem) => `${formatCurrency(item.students)} 人` },
  { key: "intlStudents", label: "国际生", value: (item: UniversityListItem) => `${formatCurrency(item.intlStudents)} 人` },
  {
    key: "tuition",
    label: "学费区间",
    value: (item: UniversityListItem) => `CNY ${formatCurrency(item.tuitionMinCny)} - ${formatCurrency(item.tuitionMaxCny)}`
  },
  { key: "living", label: "年生活费", value: (item: UniversityListItem) => `CNY ${formatCurrency(item.livingCostCny)}` },
  { key: "ielts", label: "最低雅思", value: (item: UniversityListItem) => `IELTS ${item.minIelts}+` },
  { key: "language", label: "免语言申请", value: (item: UniversityListItem) => item.acceptNoLanguage ? t('common.yes') : t('common.no') },
  { key: "programs", label: "专业数量", value: (item: UniversityListItem) => `${item.programCount}` },
  { key: "certified", label: "MQA / 官方认证", value: (item: UniversityListItem) => item.csrCertified ? t('common.yes') : t('common.no') },
  { key: "detail", label: "操作", value: () => t('common.viewDetails') }
]);
</script>
