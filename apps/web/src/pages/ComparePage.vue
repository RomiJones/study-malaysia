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
      <div class="fav-empty-icon" aria-hidden="true">
        <span class="ui-icon ui-icon--vs"></span>
      </div>
      <div class="serif text-xl">{{ t('comparePage.emptyTitle') }}</div>
      <div class="text-slate-500 mt-2">{{ t('comparePage.emptyBody') }}</div>
      <div class="text-slate-500 mt-2">{{ session.isLoggedIn ? t('comparePage.emptyAccount') : t('comparePage.emptyGuest') }}</div>
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
                  <img
                    class="compare-head-logo"
                    :src="item.logoUrl || LOCAL_UNIVERSITY_LOGO_FALLBACK"
                    :alt="item.shortName"
                    @error="replaceBrokenLogo"
                  />
                  <div>
                    <div class="compare-head-name">{{ text(item.name) }}</div>
                    <div class="compare-head-sub">QS #{{ item.qsRank }} · {{ item.shortName }}</div>
                  </div>
                  <button class="compare-remove" :aria-label="`${t('common.remove')} ${text(item.name)}`" @click="catalog.toggleCompare(item.id)">
                    <span class="compare-remove__text">{{ t('common.remove') }}</span>
                    <span class="compare-remove__icon ui-icon ui-icon--close" aria-hidden="true"></span>
                  </button>
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
import { LOCAL_UNIVERSITY_LOGO_FALLBACK, type UniversityListItem } from "@studymy/shared";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { useSessionStore } from "../stores/session";
import { formatCurrency } from "../utils/format";

const catalog = useCatalogStore();
const session = useSessionStore();
const { t } = useI18n();
const { text } = useLocaleText();

const compareUniversities = computed(() =>
  catalog.compareIds
    .map((id) => catalog.universities.find((item) => item.id === id))
    .filter((item): item is UniversityListItem => Boolean(item))
);

const rows = computed(() => [
  { key: "qsRank", label: t('comparePage.qsRank'), value: (item: UniversityListItem) => `QS #${item.qsRank}` },
  { key: "ownership", label: t('comparePage.ownership'), value: (item: UniversityListItem) => t(`ownership.${item.ownership}`) },
  { key: "location", label: t('comparePage.location'), value: (item: UniversityListItem) => text(item.location) },
  { key: "founded", label: t('comparePage.foundedYear'), value: (item: UniversityListItem) => `${item.foundedYear}` },
  { key: "students", label: t('comparePage.students'), value: (item: UniversityListItem) => `${formatCurrency(item.students)} ${t('common.people')}` },
  { key: "intlStudents", label: t('comparePage.intlStudents'), value: (item: UniversityListItem) => `${formatCurrency(item.intlStudents)} ${t('common.people')}` },
  {
    key: "tuition",
    label: t('comparePage.tuitionRange'),
    value: (item: UniversityListItem) => `CNY ${formatCurrency(item.tuitionMinCny)} - ${formatCurrency(item.tuitionMaxCny)}`
  },
  { key: "living", label: t('comparePage.annualLivingCost'), value: (item: UniversityListItem) => `CNY ${formatCurrency(item.livingCostCny)}` },
  { key: "ielts", label: t('comparePage.minIelts'), value: (item: UniversityListItem) => `IELTS ${item.minIelts}+` },
  { key: "language", label: t('comparePage.noLanguage'), value: (item: UniversityListItem) => item.acceptNoLanguage ? t('common.yes') : t('common.no') },
  { key: "programs", label: t('comparePage.programCount'), value: (item: UniversityListItem) => `${item.programCount}` },
  { key: "certified", label: t('comparePage.certification'), value: (item: UniversityListItem) => item.csrCertified ? t('common.yes') : t('common.no') },
  { key: "detail", label: t('comparePage.action'), value: () => t('common.viewDetails') }
]);

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
