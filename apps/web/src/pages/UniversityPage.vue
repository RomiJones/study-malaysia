<template>
  <section v-if="detail" class="university-detail-page">
    <section class="detail-hero">
      <div class="container detail-hero-inner">
        <button class="btn btn-ghost btn-sm detail-back-btn" type="button" @click="goHome">
          <span class="ui-icon ui-icon--arrow-left" aria-hidden="true"></span>
          {{ t('university.backToDirectory') }}
        </button>

        <div class="detail-hero-main">
          <img
            v-if="detail.logoUrl && !hasHeroLogoError"
            class="detail-hero-logo"
            :src="detail.logoUrl"
            :alt="detail.shortName"
            @error="hideBrokenImage"
          >
          <div v-else class="detail-hero-logo detail-hero-logo--fallback" aria-hidden="true">
            {{ detail.shortName.slice(0, 3) }}
          </div>
          <div class="detail-hero-heading">
            <div class="detail-hero-badges">
              <span class="chip" :class="detail.ownership === 'public' ? 'chip-blue' : 'chip-gold'">
                {{ ownershipLabel(detail.ownership) }}
              </span>
              <span class="uni-rank-badge serif">QS #{{ detail.qsRank }}</span>
              <span v-if="detail.csrCertified" class="chip chip-teal">{{ t('university.mqaCertified') }}</span>
              <span class="chip chip-ink">{{ detail.code }}</span>
            </div>
            <h1 class="serif detail-hero-title">{{ text(detail.name) }}</h1>
            <div class="detail-hero-subtitle">{{ detail.nameEnOfficial || detail.nameEn }}</div>
          </div>
        </div>

        <div class="detail-hero-stats">
          <div v-for="item in heroStats" :key="item.label" class="detail-hero-stat">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="detail-tabs" role="tablist" :aria-label="t('university.detailTabsLabel')">
          <button
            v-for="tab in detailTabs"
            :key="tab.key"
            :id="tabId(tab.key)"
            class="detail-tab"
            :class="{ active: activeTab === tab.key }"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :aria-controls="panelId(tab.key)"
            :tabindex="activeTab === tab.key ? 0 : -1"
            @click="setActiveTab(tab.key)"
            @keydown="handleTabKeydown($event, tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="detail-content detail-section">
      <div
        v-for="tab in detailTabs"
        :key="`panel-${tab.key}`"
        class="container detail-panel"
        role="tabpanel"
        :id="panelId(tab.key)"
        :aria-labelledby="tabId(tab.key)"
        :hidden="activeTab !== tab.key"
        :tabindex="activeTab === tab.key ? 0 : -1"
      >
        <template v-if="activeTab === tab.key">
          <template v-if="tab.key === 'overview'">
            <div class="detail-highlights">
              <div v-for="item in array(detail.highlights)" :key="item" class="highlight-item">
                <span class="highlight-icon" aria-hidden="true"></span>
                <span>{{ item }}</span>
              </div>
            </div>

            <article class="section-card official-profile-card">
              <div class="detail-section-title serif">{{ t('university.officialProfile') }}</div>
              <div class="official-profile-grid">
                <div v-for="item in officialInfoFields" :key="item.label" class="official-profile-item">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>

              <div class="official-profile-support">
                <div class="official-mini-card">
                  <span>{{ t('university.programmeLevels') }}</span>
                  <div class="tag-row">
                    <span v-for="item in profileLevelChips" :key="item" class="chip chip-blue">{{ item }}</span>
                  </div>
                </div>
                <div class="official-mini-card">
                  <span>{{ t('university.studyMode') }}</span>
                  <div class="tag-row">
                    <span v-for="item in profileModeChips" :key="item" class="chip chip-ink">{{ item }}</span>
                  </div>
                </div>
              </div>
            </article>

            <div class="detail-overview-cards">
              <article class="section-card detail-metric-card">
                <div class="detail-section-title serif detail-section-title--compact">{{ t('university.rankingScale') }}</div>
                <div class="detail-row-list">
                  <div v-for="item in rankingRows" :key="`ranking-${item.label}`" class="detail-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                  <div class="detail-row-separator"></div>
                  <div v-for="item in scaleRows" :key="`scale-${item.label}`" class="detail-row">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </article>

              <article class="section-card detail-metric-card">
                <div class="detail-section-title serif detail-section-title--compact">{{ t('university.officialContact') }}</div>
                <div class="detail-row-list">
                  <div v-for="item in contactRows" :key="item.label" class="detail-row detail-row--link">
                    <span>{{ item.label }}</span>
                    <a :href="item.href" target="_blank" rel="noreferrer">{{ item.value }}</a>
                  </div>
                </div>
                <div class="official-link-row">
                  <a
                    v-for="item in sourceLinks"
                    :key="item.url"
                    class="btn btn-outline btn-sm"
                    :href="item.url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ item.label }}
                  </a>
                </div>
              </article>
            </div>

            <article class="audit-note-card">
              <span>{{ t('university.auditNote') }}</span>
              <p>{{ auditSummary }}</p>
              <small>{{ sourceSummary }}</small>
            </article>

            <div class="detail-body">
              <div class="detail-copy-block">
                <div class="detail-section-title serif">{{ t('university.introTitle') }}</div>
                <p>{{ text(detail.description) }}</p>
                <div v-if="detail.admissionEmail" class="detail-inline-contact">
                  {{ t('university.admissionsPrefix') }}
                  <a :href="`mailto:${detail.admissionEmail}`">{{ detail.admissionEmail }}</a>
                </div>
              </div>

              <aside class="section-card detail-side-card">
                <div class="detail-section-title serif detail-section-title--compact">{{ t('university.officialFeeStatus') }}</div>
                <div class="detail-tuition-main">{{ tuitionSummary }}</div>
                <p>{{ tuitionNote }}</p>
                <div class="detail-program-stats">
                  <div v-for="item in programAuditRows" :key="item.label">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
                <div class="detail-side-actions">
                  <button class="btn btn-primary w-full" type="button" @click="setActiveTab('bachelor')">{{ t('university.browseBachelor') }}</button>
                  <a
                    v-if="detail.officialWebsite || detail.website"
                    class="btn btn-outline w-full"
                    :href="detail.officialWebsite || detail.website"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ t('common.visitWebsite') }}
                  </a>
                </div>
              </aside>
            </div>
          </template>

          <template v-else-if="activeProgramLevel">
            <div ref="programmeBlockRef" class="programme-block">
              <div class="programme-table-title">
                <h2>{{ t('university.programmeHeading', { level: activeProgramLabel }) }}</h2>
                <span class="programme-count">{{ activePrograms.length }}</span>
              </div>
              <div v-if="catalog.errorMessage" class="inline-alert inline-alert--error programme-inline-alert">{{ catalog.errorMessage }}</div>
              <div v-if="catalog.programLoading" class="section-card empty-state empty-state--loading">{{ t('common.loading') }}</div>
              <div v-if="activePrograms.length" class="programme-table-wrap">
                <div class="programme-grid-head">
                  <div>{{ t('university.programmeName') }}</div>
                  <div>{{ t('university.faculty') }}</div>
                  <div>{{ t('university.duration') }}</div>
                  <div>{{ t('university.officialTuition') }}</div>
                  <div>{{ t('university.languageRequirement') }}</div>
                  <div>{{ t('university.intake') }}</div>
                  <div></div>
                </div>
                <button
                  v-for="program in pagedPrograms"
                  :key="program.id"
                  class="programme-grid-row"
                  type="button"
                  @click="openProgram(program)"
                >
                  <div class="programme-cell" :data-label="t('university.programmeName')">
                    <div class="programme-name-zh">{{ text(program.name) }}</div>
                    <div class="programme-name-en">{{ program.nameEnOfficial || program.nameEn }}</div>
                  </div>
                  <div class="programme-cell" :data-label="t('university.faculty')">
                    <div class="programme-faculty-zh">{{ facultyLabel(program) }}</div>
                  </div>
                  <div class="programme-cell" :data-label="t('university.duration')">
                    <span class="programme-pill">{{ durationLabel(program) }}</span>
                  </div>
                  <div class="programme-cell" :data-label="t('university.officialTuition')">
                    <div class="programme-fee-main">
                      <span>{{ tuitionListLabel(program) }}</span>
                      <span v-if="hasVerifiedProgramFee(program)" class="fee-verified-badge">{{ formatProgramFeeVerifiedLabel(currentLocale) }}</span>
                    </div>
                    <div class="programme-fee-status" :class="{ review: feeStatusNeedsReview(program) }">
                      {{ feeStatus(program) }}
                    </div>
                  </div>
                  <div class="programme-cell" :data-label="t('university.languageRequirement')">
                    <span class="programme-lang-pill">{{ languageLabel(program) }}</span>
                  </div>
                  <div class="programme-cell" :data-label="t('university.intake')">
                    <div class="programme-intake-cn">{{ intakeLabel(program) }}</div>
                  </div>
                  <div class="programme-cell" :data-label="t('university.detail')">
                    <span class="programme-detail-link">{{ t('university.detail') }}</span>
                  </div>
                </button>
              </div>
              <nav
                v-if="programTotalPages > 1"
                class="pagination-bar"
                :aria-label="t('common.pagination')"
              >
                <button
                  class="page-btn"
                  type="button"
                  :disabled="currentProgramPage <= 1"
                  :aria-label="t('common.previous')"
                  @click="setProgramPage(currentProgramPage - 1)"
                >
                  <span class="ui-icon ui-icon--arrow-left" aria-hidden="true"></span>
                </button>
                <template v-for="(item, index) in programPaginationItems" :key="`${item}-${index}`">
                  <span v-if="item === 'ellipsis'" class="pagination-gap" aria-hidden="true">...</span>
                  <button
                    v-else
                    class="page-btn"
                    :class="{ active: currentProgramPage === item }"
                    type="button"
                    :aria-current="currentProgramPage === item ? 'page' : undefined"
                    @click="setProgramPage(item)"
                  >
                    {{ item }}
                  </button>
                </template>
                <button
                  class="page-btn"
                  type="button"
                  :disabled="currentProgramPage >= programTotalPages"
                  :aria-label="t('common.next')"
                  @click="setProgramPage(currentProgramPage + 1)"
                >
                  <span class="ui-icon ui-icon--arrow-right" aria-hidden="true"></span>
                </button>
              </nav>
              <div v-if="!activePrograms.length" class="section-card empty-state">
                {{ t('university.noPrograms', { level: activeProgramLabel }) }}
              </div>
            </div>
          </template>

          <template v-else-if="tab.key === 'facilities'">
            <div class="detail-section-title serif">{{ t('university.facilitiesTab') }}</div>
            <div class="detail-highlights">
              <div v-for="item in array(detail.facilities)" :key="item" class="highlight-item highlight-item--facility">
                <span class="highlight-icon" aria-hidden="true"></span>
                <span>{{ item }}</span>
              </div>
            </div>
          </template>

          <template v-else-if="tab.key === 'apply'">
            <article class="section-card official-apply-card">
              <div class="detail-section-title serif">{{ t('university.officialApplicationEntry') }}</div>
              <div class="official-link-grid">
                <a
                  v-for="item in sourceLinks"
                  :key="`apply-${item.url}`"
                  :href="item.url"
                  target="_blank"
                  rel="noreferrer"
                  class="official-link-card"
                >
                  <span>{{ t('common.officialLink') }}</span>
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.url }}</small>
                </a>
              </div>

              <div class="official-contact-grid">
                <div v-for="item in contactRows" :key="`apply-contact-${item.label}`" class="official-profile-item">
                  <span>{{ item.label }}</span>
                  <a :href="item.href" target="_blank" rel="noreferrer">{{ item.value }}</a>
                </div>
              </div>

              <div class="application-info-grid">
                <div class="application-info-card">
                  <span>{{ t('university.applicationPeriod') }}</span>
                  <ul>
                    <li v-for="item in applicationPeriodRows" :key="item">{{ item }}</li>
                  </ul>
                </div>
                <div class="application-info-card">
                  <span>{{ t('university.applicationFee') }}</span>
                  <ul>
                    <li v-for="item in applicationFeeRows" :key="item">{{ item }}</li>
                  </ul>
                </div>
                <div class="application-info-card">
                  <span>{{ t('university.applicationDocuments') }}</span>
                  <ul>
                    <li v-for="item in applicationDocumentRows" :key="item">{{ item }}</li>
                  </ul>
                </div>
                <div class="application-info-card">
                  <span>{{ t('university.chinaBachelorRequirement') }}</span>
                  <p>{{ chinaRequirementSummary }}</p>
                </div>
              </div>
            </article>

            <div class="apply-bottom-grid">
              <article class="section-card">
                <div class="detail-section-title serif detail-section-title--compact">{{ t('university.applicationNotes') }}</div>
                <div class="apply-note-list">
                  <div>
                    <span>{{ t('common.officialWebsite') }}</span>
                    <a :href="detail.officialWebsite || detail.website" target="_blank" rel="noreferrer">
                      {{ detail.officialWebsite || detail.website || officialConfirmationFallback(currentLocale) }}
                    </a>
                  </div>
                  <div>
                    <span>{{ t('common.admissionsEmail') }}</span>
                    <a v-if="detail.admissionEmail" :href="`mailto:${detail.admissionEmail}`">{{ detail.admissionEmail }}</a>
                    <strong v-else>{{ officialConfirmationFallback(currentLocale) }}</strong>
                  </div>
                  <div>
                    <span>{{ t('university.englishRequirement') }}</span>
                    <strong>{{ t('university.englishRequirementNote') }}</strong>
                  </div>
                </div>
              </article>

              <article class="section-card apply-planner-card">
                <div class="detail-section-title serif detail-section-title--compact">{{ t('university.openPlannerTitle') }}</div>
                <p>{{ t('university.openPlannerBody') }}</p>
                <button class="btn btn-gold w-full" type="button" @click="goPlanner">{{ t('university.openPlannerAction') }}</button>
              </article>
            </div>
          </template>
        </template>
      </div>
    </section>

    <div v-if="catalog.selectedProgramDetail" class="modal-backdrop fade-in" @click.self="closeProgramModal">
      <div class="modal program-detail-modal">
        <div class="modal-header">
          <div>
            <div class="program-modal-tags">
              <span class="chip chip-teal">{{ levelLabel(catalog.selectedProgramDetail.level) }}</span>
              <span class="chip chip-gold">{{ categoryLabel(catalog.selectedProgramDetail.category) }}</span>
              <span class="chip chip-ink">{{ durationLabel(catalog.selectedProgramDetail) }}</span>
            </div>
            <h2 class="serif">{{ text(catalog.selectedProgramDetail.name) }}</h2>
            <div class="program-modal-subtitle">
              {{ catalog.selectedProgramDetail.nameEnOfficial || catalog.selectedProgramDetail.nameEn }} · {{ text(catalog.selectedProgramDetail.university.name) }}
            </div>
          </div>
          <button class="modal-close" type="button" :aria-label="t('common.close')" @click="closeProgramModal">
            <span class="ui-icon ui-icon--close" aria-hidden="true"></span>
          </button>
        </div>

        <div class="modal-body">
          <p class="program-modal-description">{{ text(catalog.selectedProgramDetail.description) }}</p>

          <div class="modal-section">
            <div class="modal-section-title">{{ t('program.tuitionAndIntake') }}</div>
            <div class="req-grid">
              <div class="req-item">
                <div class="req-item-label">{{ t('program.officialInternationalTuition') }}</div>
                <div class="req-item-value req-item-value--inline">
                  <span>{{ tuitionLabel(catalog.selectedProgramDetail) }}</span>
                  <span v-if="hasVerifiedProgramFee(catalog.selectedProgramDetail)" class="fee-verified-badge">
                    {{ formatProgramFeeVerifiedLabel(currentLocale) }}
                  </span>
                </div>
              </div>
              <div class="req-item">
                <div class="req-item-label">{{ t('program.intakeTime') }}</div>
                <div class="req-item-value">{{ intakeLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">{{ t('program.officialDuration') }}</div>
                <div class="req-item-value">{{ durationLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">{{ t('program.feeNote') }}</div>
                <div class="req-item-value req-item-value--text">{{ tuitionNoteLabel(catalog.selectedProgramDetail) }}</div>
              </div>
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">{{ t('program.entryLanguageRequirements') }}</div>
            <div class="req-grid">
              <div class="req-item">
                <div class="req-item-label">{{ t('program.gpaRequirement') }}</div>
                <div class="req-item-value">{{ gpaLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">{{ t('program.ieltsRequirement') }}</div>
                <div class="req-item-value">{{ languageLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div v-if="catalog.selectedProgramDetail.languageRequirement.toefl" class="req-item">
                <div class="req-item-label">{{ t('program.toeflRequirement') }}</div>
                <div class="req-item-value">TOEFL {{ catalog.selectedProgramDetail.languageRequirement.toefl }}+</div>
              </div>
              <div class="req-item req-item--full">
                <div class="req-item-label">{{ t('program.officialLanguageRequirement') }}</div>
                <div class="req-item-value req-item-value--text">{{ officialLanguageLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div class="req-item req-item--full">
                <div class="req-item-label">{{ t('program.officialAcademicRequirement') }}</div>
                <div class="req-item-value req-item-value--text">{{ academicRequirementLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div v-if="chinaStudentRequirementLabel(catalog.selectedProgramDetail)" class="req-item req-item--full">
                <div class="req-item-label">{{ t('program.chinaStudentNote') }}</div>
                <div class="req-item-value req-item-value--text">{{ chinaStudentRequirementLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div v-if="accreditationNoteLabel(catalog.selectedProgramDetail)" class="req-item req-item--full">
                <div class="req-item-label">{{ t('program.accreditationNote') }}</div>
                <div class="req-item-value req-item-value--text">{{ accreditationNoteLabel(catalog.selectedProgramDetail) }}</div>
              </div>
            </div>
          </div>

          <div v-if="array(catalog.selectedProgramDetail.curriculum).length" class="modal-section">
            <div class="modal-section-title">{{ t("common.curriculum") }}</div>
            <div class="curriculum-pills">
              <span v-for="item in array(catalog.selectedProgramDetail.curriculum)" :key="item" class="curriculum-pill">{{ item }}</span>
            </div>
          </div>

          <div v-if="array(catalog.selectedProgramDetail.careers).length" class="modal-section">
            <div class="modal-section-title">{{ t("common.careers") }}</div>
            <div class="career-pills">
              <span v-for="item in array(catalog.selectedProgramDetail.careers)" :key="item" class="career-pill">{{ item }}</span>
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">{{ t('program.applicationDocs') }}</div>
            <ul class="program-doc-list program-doc-list--checked">
              <li v-for="item in programApplicationDocs(catalog.selectedProgramDetail)" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">{{ t('program.sourceVerification') }}</div>
            <div class="req-grid req-grid--sources">
              <div
                v-for="item in programSourceRows(catalog.selectedProgramDetail)"
                :key="item.label"
                class="req-item"
                :class="{ 'req-item--full': item.full }"
              >
                <div class="req-item-label">{{ item.label }}</div>
                <div class="req-item-value" :class="{ 'req-item-value--text': item.full }">{{ item.value }}</div>
              </div>
              <div
                v-for="item in programSourceLinks(catalog.selectedProgramDetail)"
                :key="item.url"
                class="req-item req-item--full req-item--source-link"
              >
                <div class="req-item-label">{{ item.label }}</div>
                <a class="req-source-link" :href="item.url" target="_blank" rel="noreferrer">{{ item.url }}</a>
              </div>
            </div>
          </div>

          <div v-if="selectedProgramApplicationReady" class="program-modal-actions">
            <button class="btn btn-primary" type="button" @click="goPlannerWithProgram">{{ t("program.addToPlanner") }}</button>
            <button class="btn btn-outline" type="button" @click="catalog.toggleFavoriteProgram(catalog.selectedProgramDetail.id)">
              {{ catalog.favoriteState.programs.includes(catalog.selectedProgramDetail.id) ? t("common.favorited") : t("program.favoriteProgram") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section v-else class="container detail-loading">
    <div class="section-card empty-state" :class="{ 'empty-state--warning': catalog.errorMessage && !catalog.loading }">
      {{ catalog.loading ? t("common.loading") : catalog.errorMessage || t("common.noData") }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type {
  DegreeLevel,
  InstitutionOwnership,
  InstitutionType,
  OfficialSourceLink,
  ProgramCatalogDetail,
  ProgramListItem,
  UniversityListItem
} from "@studymy/shared";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { usePlannerStore } from "../stores/planner";
import { buildPaginationItems } from "../utils/pagination";
import {
  cleanDisplayText,
  formatCategoryLabel,
  formatCurrency,
  formatFeeAuditStatus,
  formatOfficialNote,
  formatOfficialSourceStatus,
  formatProgramFeeVerifiedLabel,
  formatProgramFacultyLabel,
  formatProgramDuration,
  formatProgramIntake,
  formatProgramListTuition,
  formatProgramLanguage,
  formatVerifiedOfficialText,
  formatRuntimeDisplayText,
  hasVerifiedProgramFee,
  officialConfirmationFallback,
  officialPageFallback,
  normalizeAcademicText
} from "../utils/format";

type DetailTab = "overview" | "bachelor" | "master" | "phd" | "facilities" | "apply";
type CatalogStatusCounts = {
  total: number;
  ready: number;
  needsReview: number;
  notAvailableForInternational?: number;
  officialLanguageRequirementNotPublished?: number;
};
type UniversityDetailView = UniversityListItem & {
  programs: ProgramListItem[];
  catalogStatusSummary?: {
    all: CatalogStatusCounts;
    byLevel: Record<DegreeLevel, CatalogStatusCounts>;
  };
};
type LabelValue = { label: string; value: string };
type ModalSourceRow = LabelValue & { full?: boolean };
type LabelLink = LabelValue & { href: string };
type SourceLinkView = { label: string; url: string };
type LooseRecord = Record<string, unknown>;
type ProfileScaleKey = "studentTotal" | "internationalStudents";
type ReviewPreview = "msu" | "luc";

const legacyProfileScaleLabels: Record<ProfileScaleKey, string[]> = {
  studentTotal: ["studentTotal", "student count", "student total", "学生总数", "在校学生", "Students"],
  internationalStudents: ["internationalStudents", "international students", "国际学生", "國際學生", "International"]
};

const props = defineProps<{ slug: string }>();
const catalog = useCatalogStore();
const route = useRoute();
const router = useRouter();
const { t, tm } = useI18n();
const { currentLocale, text, array } = useLocaleText();
const planner = usePlannerStore();
const activeTab = ref<DetailTab>("overview");
const hasHeroLogoError = ref(false);
const programmeBlockRef = ref<HTMLElement | null>(null);
const currentProgramPage = ref(1);
const PROGRAMS_PER_PAGE = 12;
const tabKeys: DetailTab[] = ["overview", "bachelor", "master", "phd", "facilities", "apply"];
const lucReviewPreviewSlugs = new Set(["lincoln-university-college", "lincoln-university-college-malaysia", "lincoln-university", "luc"]);
const reviewPreview = computed<ReviewPreview | undefined>(() => {
  if (route.query.review === "msu") return "msu";
  if (route.query.review === "luc") return "luc";
  if (lucReviewPreviewSlugs.has(props.slug)) return "luc";
  return undefined;
});
const selectedProgramApplicationReady = computed(() => {
  const program = catalog.selectedProgramDetail;
  return Boolean(program && program.publicDisplayStatus === "ready" && !isReviewPreviewProgram(program));
});

const detailTabs = computed<Array<{ key: DetailTab; label: string }>>(() => [
  { key: "overview", label: t('university.overviewTab') },
  { key: "bachelor", label: t('university.bachelorTab') },
  { key: "master", label: t('university.masterTab') },
  { key: "phd", label: t('university.phdTab') },
  { key: "facilities", label: t('university.facilitiesTab') },
  { key: "apply", label: t('university.applyTab') }
]);

const detail = computed(() => catalog.universityDetail as UniversityDetailView | null);
const profile = computed(() => asRecord(detail.value?.officialProfile));

const heroStats = computed<LabelValue[]>(() => {
  const current = detail.value;
  if (!current) return [];
  return [
    { label: t('common.location'), value: text(current.location) },
    { label: t('common.foundedYear'), value: `${current.foundedYear}` },
    { label: t('university.studentTotal'), value: profileScaleValue("studentTotal") || compactNumber(current.students) },
    { label: t('university.internationalStudents'), value: profileScaleValue("internationalStudents") || compactNumber(current.intlStudents) },
    {
      label: t('university.languageRequirement'),
      value: current.acceptNoLanguage
        ? t('university.conditionalPath')
        : Number(current.minIelts) > 0 ? `IELTS ${current.minIelts}+` : t('university.languageShownByProgram')
    }
  ];
});

const officialInfoFields = computed<LabelValue[]>(() => {
  const current = detail.value;
  if (!current) return [];
  const cityCountry = [profileString("city"), profileString("country")].filter(Boolean).join(", ");
  return [
    { label: t('university.officialProfileChineseName'), value: profileString("chineseName") || text(current.name) },
    { label: t('university.officialLegalName'), value: profileString("legalName") || current.nameEnOfficial || current.nameEn },
    { label: t('university.institutionType'), value: profileDisplayText(profile.value?.institutionType, "", "institution") || ownershipLabel(current.ownership) },
    { label: t('university.universityPositioning'), value: profileDisplayText(profile.value?.universityType, "", "universityType") || institutionTypeLabel(current.institutionType) },
    { label: t('university.city'), value: cityCountry || text(current.location) },
    {
      label: t('university.officialAddress'),
      value: cleanDisplayText(current.officialAddress, "", currentLocale.value) ||
        profileString("address") ||
        officialConfirmationFallback(currentLocale.value)
    }
  ];
});

const profileLevelChips = computed(() => {
  const levels = normalizeProfileList(profile.value?.levels, "level");
  return levels.length ? levels : [t('degree.bachelor'), t('degree.master'), t('degree.phd')];
});

const profileModeChips = computed(() => {
  const modes = [
    ...normalizeProfileList(profile.value?.studyModes, "mode"),
    ...normalizeProfileList(profile.value?.programmeModes, "mode")
  ];
  return modes.length ? modes : [detail.value ? institutionTypeLabel(detail.value.institutionType) : t('university.studyModeFallback')];
});

const rankingRows = computed<LabelValue[]>(() => {
  const rows = normalizeProfileRows(profile.value?.rankings);
  if (rows.length) return rows;
  const current = detail.value;
  if (!current) return [];
  return [
    { label: t('university.qsWorldRank'), value: `#${current.qsRank}` },
    { label: t('university.qsAsiaRank'), value: current.qsAsiaRank ? `#${current.qsAsiaRank}` : officialConfirmationFallback(currentLocale.value) },
    { label: t('university.officialSource'), value: sourceStatus(current.officialSourceStatus) }
  ];
});

const scaleRows = computed<LabelValue[]>(() => {
  const rows = normalizeProfileRows(profile.value?.scale);
  if (rows.length) return rows;
  const current = detail.value;
  if (!current) return [];
  return [
    { label: t('university.studentTotal'), value: compactNumber(current.students) },
    { label: t('university.internationalStudents'), value: compactNumber(current.intlStudents) },
    { label: t('common.foundedYear'), value: `${current.foundedYear}` }
  ];
});

const contactRows = computed<LabelLink[]>(() => {
  const profileContacts = normalizeContactRows(profile.value?.contact);
  if (profileContacts.length) return profileContacts;
  const current = detail.value;
  if (!current) return [];
  return [
    current.officialWebsite || current.website
      ? { label: t('common.officialWebsite'), value: current.officialWebsite || current.website, href: current.officialWebsite || current.website }
      : null,
    current.admissionEmail
      ? { label: t('common.admissionsEmail'), value: current.admissionEmail, href: `mailto:${current.admissionEmail}` }
      : null
  ].filter(Boolean) as LabelLink[];
});

const sourceLinks = computed<SourceLinkView[]>(() => {
  const current = detail.value;
  if (!current) return [];
  const items: SourceLinkView[] = [];
  pushLink(items, t('common.officialWebsite'), current.officialWebsite || current.website);
  pushLink(items, t('common.studyPortal'), current.studyPortalUrl);
  pushLink(items, t('common.international'), current.internationalPageUrl);
  pushLink(items, t('common.applicationPortal'), current.applicationPortalUrl);
  for (const item of normalizeProfileLinks(profile.value?.officialLinks)) pushLink(items, item.label, item.url);
  for (const item of current.officialSources || []) pushLink(items, sourceLabel(item), item.url);
  return items;
});

const auditSummary = computed(() =>
  profileOfficialNote("qualityNote") ||
  formatOfficialNote(detail.value?.officialAuditSummary, "", currentLocale.value) ||
  t('university.qualityNoteFallback')
);

const sourceSummary = computed(() => {
  const note = profileOfficialNote("sourceNote");
  const date = detail.value?.officialVerifiedAt || profileString("verifiedAt") || profileString("auditedAt") || officialConfirmationFallback(currentLocale.value);
  return note
    ? t('university.sourceSummaryWithNote', { note, date })
    : t('university.sourceSummary', {
      status: detail.value ? sourceStatus(detail.value.officialSourceStatus) : officialConfirmationFallback(currentLocale.value),
      date
    });
});

const tuitionSummary = computed(() => {
  return detail.value
    ? t("university.officialTotalByProgramme")
    : officialConfirmationFallback(currentLocale.value);
});

const tuitionNote = computed(() => {
  const tuitionAudit = asRecord(profile.value?.tuitionAudit);
  const notes = normalizeRuntimeList(tuitionAudit?.notes, "");
  if (notes.length) return notes[0];
  return t('university.tuitionNoteFallback');
});

const programAuditRows = computed<LabelValue[]>(() => {
  const current = detail.value;
  if (!current) return [];
  return [
    { label: t('university.bachelorPrograms'), value: catalogLevelTotal("bachelor") },
    { label: t('university.masterPrograms'), value: catalogLevelTotal("master") },
    { label: t('university.phdPrograms'), value: catalogLevelTotal("phd") },
    { label: t('university.publicReady'), value: String(current.catalogStatusSummary?.all.ready ?? current.programs.length) },
    { label: auditRestrictionLabel(), value: auditReviewCount() },
    { label: t('university.languageRequirement'), value: t('university.languageShownByProgram') }
  ];
});

const activeProgramLevel = computed<DegreeLevel | null>(() => {
  if (activeTab.value === "bachelor") return "bachelor";
  if (activeTab.value === "master") return "master";
  if (activeTab.value === "phd") return "phd";
  return null;
});

const activePrograms = computed(() => {
  const level = activeProgramLevel.value;
  return level
    ? [...(detail.value?.programs || [])].filter((program) => program.level === level).sort(comparePrograms)
    : [];
});

const programTotalPages = computed(() => Math.max(1, Math.ceil(activePrograms.value.length / PROGRAMS_PER_PAGE)));
const pagedPrograms = computed(() => {
  const start = (currentProgramPage.value - 1) * PROGRAMS_PER_PAGE;
  return activePrograms.value.slice(start, start + PROGRAMS_PER_PAGE);
});
const programPaginationItems = computed(() =>
  buildPaginationItems(currentProgramPage.value, programTotalPages.value)
);

const activeProgramLabel = computed(() => activeProgramLevel.value ? levelLabel(activeProgramLevel.value) : "");

const applicationPeriodRows = computed(() => {
  const rows = normalizeRawRows(profile.value?.applicationPeriods).map((item) => formatProfileRuntimeRow(item)).filter(Boolean);
  if (rows.length) return uniqueRows(rows);
  const detailRows = normalizeRuntimeList(detail.value?.applicationPeriods);
  return detailRows.length ? uniqueRows(detailRows) : [officialPageFallback(currentLocale.value)];
});

const applicationFeeRows = computed(() => {
  const rows = normalizeRawRows(profile.value?.applicationFees).map((item) => formatProfileRuntimeRow(item)).filter(Boolean);
  if (rows.length) return uniqueRows(rows);
  const detailRows = normalizeRuntimeList(detail.value?.applicationFees);
  return detailRows.length ? uniqueRows(detailRows) : [officialPageFallback(currentLocale.value)];
});

const applicationDocumentRows = computed(() => {
  const rows = array(detail.value?.applicationDocuments || emptyLocalizedArray());
  return rows.length
    ? rows
    : uniqueRows(normalizeProfileList(profile.value?.applicationDocuments, "document").concat(messageArray("university.defaultApplicationDocs"))).slice(0, 4);
});

const chinaRequirementSummary = computed(() => {
  const profileChina = asRecord(profile.value?.chinaRequirement);
  const summary = formatRuntimeDisplayText(profileChina?.summary, "", currentLocale.value);
  if (summary) return summary;
  const rows = array(detail.value?.chinaStudentRequirements || emptyLocalizedArray());
  return rows.length ? rows.join("；") : t('university.chinaRequirementFallback');
});

async function loadDetail() {
  try {
    await catalog.loadUniversity(props.slug, reviewPreview.value ? { review: reviewPreview.value } : {});
    await openQueryProgram();
  } catch {
    catalog.closeProgramDetail();
  }
}

async function openQueryProgram() {
  const programId = route.query.program;
  if (!programId || Array.isArray(programId)) return;
  await catalog.openProgramDetail(programId, reviewPreview.value ? { review: reviewPreview.value } : {});
}

function setActiveTab(tab: DetailTab) {
  if (activeTab.value !== tab) currentProgramPage.value = 1;
  activeTab.value = tab;
  catalog.closeProgramDetail();
}

async function setProgramPage(page: number) {
  const nextPage = Math.min(programTotalPages.value, Math.max(1, Math.floor(page)));
  if (nextPage === currentProgramPage.value) return;
  currentProgramPage.value = nextPage;
  await nextTick();
  if (typeof programmeBlockRef.value?.scrollIntoView === "function") {
    programmeBlockRef.value.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function handleTabKeydown(event: KeyboardEvent, currentTab: DetailTab) {
  const currentIndex = tabKeys.indexOf(currentTab);
  if (currentIndex < 0) return;

  let nextTab: DetailTab | null = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextTab = tabKeys[(currentIndex + 1) % tabKeys.length];
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextTab = tabKeys[(currentIndex - 1 + tabKeys.length) % tabKeys.length];
  } else if (event.key === "Home") {
    nextTab = tabKeys[0];
  } else if (event.key === "End") {
    nextTab = tabKeys[tabKeys.length - 1];
  }

  if (!nextTab) return;
  event.preventDefault();
  setActiveTab(nextTab);
  focusTab(nextTab);
}

function focusTab(tab: DetailTab) {
  window.requestAnimationFrame(() => {
    document.getElementById(tabId(tab))?.focus();
  });
}

function tabId(tab: DetailTab) {
  return `university-detail-${tab}-tab`;
}

function panelId(tab: DetailTab) {
  return `university-detail-${tab}-panel`;
}

async function openProgram(program: ProgramListItem) {
  const opened = await catalog.openProgramDetail(program.id, reviewPreview.value ? { review: reviewPreview.value } : {});
  if (opened) await router.replace({ path: route.path, query: { ...route.query, program: String(program.id) } });
}

async function closeProgramModal() {
  catalog.closeProgramDetail();
  const nextQuery = { ...route.query };
  delete nextQuery.program;
  await router.replace({ path: route.path, query: nextQuery });
}

function goHome() {
  void router.push("/");
}

function goPlanner() {
  void router.push("/planner");
}

function hideBrokenImage(event: Event) {
  const target = event.target;
  if (target instanceof HTMLImageElement) hasHeroLogoError.value = true;
}

async function goPlannerWithProgram() {
  if (catalog.selectedProgramDetail && selectedProgramApplicationReady.value) {
    await planner.addTask(catalog.selectedProgramDetail.university.id, catalog.selectedProgramDetail.id);
    void router.push("/planner");
  }
}

function comparePrograms(a: ProgramListItem, b: ProgramListItem) {
  return (a.nameEnOfficial || a.nameEn).localeCompare(b.nameEnOfficial || b.nameEn);
}

function isReviewPreviewProgram(program: ProgramListItem | ProgramCatalogDetail) {
  return Boolean((program as ProgramCatalogDetail & { reviewPreview?: unknown }).reviewPreview) ||
    program.slug.startsWith("luc-official-20260630-row-") ||
    program.slug.startsWith("luc-postgraduate-20260705-row-") ||
    program.slug.startsWith("msu-review-");
}

function levelLabel(level: DegreeLevel) {
  return t(`degree.${level}`);
}

function ownershipLabel(value: InstitutionOwnership) {
  return t(`ownership.${value}`);
}

function institutionTypeLabel(value: InstitutionType) {
  if (value === "research") return t('university.researchUniversity');
  if (value === "applied") return t('university.appliedUniversity');
  return t('university.comprehensiveUniversity');
}

function categoryLabel(value: string) {
  return formatCategoryLabel(value, currentLocale.value);
}

function facultyLabel(program: ProgramListItem | ProgramCatalogDetail) {
  return formatProgramFacultyLabel(program, currentLocale.value);
}

function compactNumber(value: number) {
  if (!value) return officialConfirmationFallback(currentLocale.value);
  if (value >= 1000) return `${Math.round(value / 1000)}k+`;
  return `${value}`;
}

function tuitionLabel(program: ProgramListItem | ProgramCatalogDetail) {
  return formatProgramListTuition(program, undefined, currentLocale.value);
}

function tuitionListLabel(program: ProgramListItem | ProgramCatalogDetail) {
  return formatProgramListTuition(program, undefined, currentLocale.value);
}

function feeStatus(program: ProgramListItem | ProgramCatalogDetail) {
  return formatFeeAuditStatus(program.officialFeeAuditStatus, program.publicDisplayStatus, currentLocale.value);
}

function feeStatusNeedsReview(program: ProgramListItem | ProgramCatalogDetail) {
  return ["pending-review", "conflict", "source-conflict"].includes(program.officialFeeAuditStatus);
}

function durationLabel(program: ProgramListItem | ProgramCatalogDetail) {
  return formatProgramDuration(program, currentLocale.value);
}

function languageLabel(program: ProgramListItem | ProgramCatalogDetail) {
  return formatProgramLanguage(program, undefined, currentLocale.value);
}

function intakeLabel(program: ProgramListItem | ProgramCatalogDetail) {
  return formatProgramIntake(program, undefined, currentLocale.value);
}

function tuitionNoteLabel(program: ProgramCatalogDetail) {
  if (program.code.startsWith("USM-") && (program.level === "master" || program.level === "phd")) {
    if (program.officialFeeAuditStatus === "calculated-from-official-rate") {
      const note = String(program.tuitionInfo?.note || "");
      const match = note.match(
        /calculated the standard full-time tuition as (USD|MYR) ([\d,]+(?:\.\d+)?) per semester × (\d+) official minimum semesters = (?:USD|MYR) ([\d,]+(?:\.\d+)?).*part-time rate: (?:USD|MYR) ([\d,]+(?:\.\d+)?) per semester/i
      );
      if (match) {
        return t("program.calculatedTotalTuitionNote", {
          currency: match[1].toUpperCase(),
          fullTime: match[2],
          semesters: match[3],
          total: match[4],
          partTime: match[5]
        });
      }
      return formatOfficialNote(
        program.tuitionInfo?.note,
        officialPageFallback(currentLocale.value),
        currentLocale.value
      );
    }
    if (program.officialFeeAuditStatus === "official-rate-verified") {
      const note = String(program.tuitionInfo?.note || "");
      const match = note.match(
        /USM official (.+?) international tuition rates: full-time (USD|MYR) ([\d,]+(?:\.\d+)?) per semester; part-time (?:USD|MYR) ([\d,]+(?:\.\d+)?) per semester/i
      );
      if (match) {
        return t("program.officialRateTuitionNote", {
          session: match[1],
          currency: match[2].toUpperCase(),
          fullTime: match[3],
          partTime: match[4]
        });
      }
      return t("program.officialRateTuitionNote", {
        session: "",
        currency: "",
        fullTime: "",
        partTime: ""
      });
    }
    if (program.officialFeeAuditStatus === "not-published") return t("program.feeNotPublishedNote");
    return t("program.officialTotalTuitionNote");
  }
  return formatVerifiedOfficialText(
    program.tuitionInfo?.note,
    program.officialSourceStatus,
    officialPageFallback(currentLocale.value),
    currentLocale.value
  );
}

function gpaLabel(program: ProgramCatalogDetail) {
  const gpa = Number(program.requirement?.gpa);
  return Number.isFinite(gpa) && gpa > 0 ? `${gpa}+` : officialConfirmationFallback(currentLocale.value);
}

function officialLanguageLabel(program: ProgramCatalogDetail) {
  return formatVerifiedOfficialText(
    program.officialLanguageRequirement,
    program.officialSourceStatus,
    officialPageFallback(currentLocale.value),
    currentLocale.value
  );
}

function academicRequirementLabel(program: ProgramCatalogDetail) {
  return formatVerifiedOfficialText(
    program.officialAcademicRequirement || text(program.requirement.note),
    program.officialSourceStatus,
    officialPageFallback(currentLocale.value),
    currentLocale.value
  );
}

function chinaStudentRequirementLabel(program: ProgramCatalogDetail) {
  const value = cleanDisplayText(program.chinaStudentRequirement, "", "en");
  if (!value.startsWith("USM does not publish a China-specific route in this prospectus.")) {
    return cleanDisplayText(program.chinaStudentRequirement, "", currentLocale.value);
  }
  const labels = {
    en: value,
    ms: "USM tidak menerbitkan laluan khusus untuk pemohon dari China dalam prospektus ini. Pemohon hendaklah menggunakan laluan High School, A-Level, IB, AUSMAT, SAM, Diploma atau kelayakan setara yang diterima dan mendapatkan pengesahan kes khusus daripada USM.",
    "zh-CN": "USM 本次简章未公布中国学生专属申请路径。申请人应按其认可的高中、A-Level、IB、AUSMAT、SAM、文凭或同等学历路径申请，并向 USM 确认个案要求。",
    "zh-TW": "USM 本次簡章未公布中國學生專屬申請路徑。申請人應按其認可的高中、A-Level、IB、AUSMAT、SAM、文憑或同等學歷路徑申請，並向 USM 確認個案要求。"
  };
  return labels[currentLocale.value];
}

function accreditationNoteLabel(program: ProgramCatalogDetail) {
  const value = cleanDisplayText(program.officialAccreditationNote, "", "en");
  if (!value) return "";
  if (value === "Programme accreditation details are not published in the collected USM international prospectus and are not inferred.") {
    const labels = {
      en: value,
      ms: "Butiran akreditasi program tidak diterbitkan dalam prospektus antarabangsa USM yang dikumpulkan dan tidak dibuat andaian.",
      "zh-CN": "本次采集的 USM 国际招生简章未公布该专业的认证详情，StudyMY 不作推断。",
      "zh-TW": "本次採集的 USM 國際招生簡章未公布該專業的認證詳情，StudyMY 不作推斷。"
    };
    return labels[currentLocale.value];
  }
  return formatOfficialNote(program.officialAccreditationNote, officialPageFallback(currentLocale.value), currentLocale.value);
}

function programApplicationDocs(program: ProgramCatalogDetail) {
  const docs = array(program.applicationDocs);
  return docs.length ? docs : [t('university.programmeDocFallback')];
}

function programSourceRows(program: ProgramCatalogDetail): ModalSourceRow[] {
  const rows: ModalSourceRow[] = [
    { label: t('university.sourceStatus'), value: sourceStatus(program.officialSourceStatus) },
    { label: t('university.verifiedDate'), value: program.officialVerifiedAt || officialConfirmationFallback(currentLocale.value) },
    { label: t('university.feeStatus'), value: feeStatus(program) }
  ];
  if (program.officialIntakeNote) {
    rows.push({
      label: t('university.intakeNote'),
      value: formatVerifiedOfficialText(
        program.officialIntakeNote,
        program.officialSourceStatus,
        officialPageFallback(currentLocale.value),
        currentLocale.value
      ),
      full: true
    });
  }
  if (program.auditNote || program.publicDisplayNote || program.reviewReason) {
    const auditValue = program.auditNote || program.publicDisplayNote || program.reviewReason;
    rows.push({
      label: t('university.dataNote'),
      value: cleanDisplayText(auditValue, officialConfirmationFallback(currentLocale.value), "en"),
      full: true
    });
  }
  return rows;
}

function programSourceLinks(program: ProgramCatalogDetail): SourceLinkView[] {
  const items: SourceLinkView[] = [];
  pushLink(items, t('common.officialLink'), program.officialSourceUrl);
  pushLink(items, t('university.officialFeeSource'), program.officialFeeSourceUrl);
  pushLink(items, t('university.entryRequirementSource'), program.officialEntryRequirementSourceUrl);
  pushLink(items, t('university.accreditationSource'), program.officialAccreditationSourceUrl);
  for (const item of program.sourceUrls || []) pushLink(items, sourceLabel(item), item.url);
  return items;
}

function sourceStatus(status: string) {
  return formatOfficialSourceStatus(status, currentLocale.value);
}

type ProfileTextKind = "institution" | "universityType" | "level" | "mode" | "rowLabel" | "document" | "linkLabel";

function profileLocaleText(labels: Record<string, string>) {
  return labels[currentLocale.value] || labels.en || "";
}

function normalizeProfileKey(value: unknown) {
  return rawStringFrom(value)
    .trim()
    .replace(/[()（）]/g, " ")
    .replace(/[：:|/,_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function profileKnownText(value: unknown, kind?: ProfileTextKind) {
  const key = normalizeProfileKey(value);
  if (!key) return "";

  if (kind === "institution") {
    if (/^(public|public university|公立|公立大学|公立大學)$/.test(key)) return t('common.publicUniversity');
    if (/^(private|private university|私立|私立大学|私立大學)$/.test(key)) return t('common.privateUniversity');
  }

  if (kind === "universityType") {
    if (/^(research|research university|研究型|研究型大学|研究型大學)$/.test(key)) return t('university.researchUniversity');
    if (/^(applied|applied university|应用型|應用型|应用型大学|應用型大學)$/.test(key)) return t('university.appliedUniversity');
    if (/^(comprehensive|comprehensive university|综合型|綜合型|综合型大学|綜合型大學)$/.test(key)) return t('university.comprehensiveUniversity');
  }

  if (kind === "level" || kind === "rowLabel") {
    if (/^(bachelor|bachelor programmes?|undergraduate|本科)$/.test(key)) return t('degree.bachelor');
    if (/^(master|master programmes?|postgraduate|硕士|碩士|研究生)$/.test(key)) return t('degree.master');
    if (/^(phd|ph d|doctor|doctoral|doctorate|博士)$/.test(key)) return t('degree.phd');
  }

  if (kind === "mode") {
    if (/^(full time|fulltime|full time study|全日制)$/.test(key)) {
      return profileLocaleText({ en: "Full time", ms: "Sepenuh masa", "zh-CN": "全日制", "zh-TW": "全日制" });
    }
    if (/^(part time|parttime|part time study|非全日制)$/.test(key)) {
      return profileLocaleText({ en: "Part time", ms: "Separuh masa", "zh-CN": "非全日制", "zh-TW": "非全日制" });
    }
    if (/^(coursework|course work|授课型|授課型|课程制|課程制)$/.test(key)) {
      return profileLocaleText({ en: "Coursework", ms: "Kerja kursus", "zh-CN": "授课型", "zh-TW": "授課型" });
    }
    if (/^(research|research mode|研究型|研究制)$/.test(key)) {
      return profileLocaleText({ en: "Research", ms: "Penyelidikan", "zh-CN": "研究型", "zh-TW": "研究型" });
    }
  }

  if (kind === "rowLabel" || kind === "linkLabel") {
    if (/^(qs world ranking|qs world rank|qs 世界排名|qs 世界排名)$/.test(key)) return t('university.qsWorldRank');
    if (/^(qs asia ranking|qs asia rank|qs 亚洲排名|qs 亞洲排名)$/.test(key)) return t('university.qsAsiaRank');
    if (/^(student total|student count|students|学生总数|學生總數|在校学生|在校學生)$/.test(key)) return t('university.studentTotal');
    if (/^(international students|intl students|国际学生|國際學生)$/.test(key)) return t('university.internationalStudents');
    if (/^(official source|source|官方来源|官方來源)$/.test(key)) return t('university.officialSource');
    if (/^(official website|website|home page|homepage|官网|官網)$/.test(key)) return t('common.officialWebsite');
    if (/^(admissions email|admission email|email|招生邮箱|招生郵箱)$/.test(key)) return t('common.admissionsEmail');
    if (/^(study portal|study programme portal)$/.test(key)) return t('common.studyPortal');
    if (/^(application portal|application entry|application system|申请入口|申請入口|申请系统|申請系統)$/.test(key)) return t('common.applicationPortal');
    if (/^(application fee|fee|申请费|申請費)$/.test(key)) return t('university.applicationFee');
  }

  if (kind === "document") {
    const docs = messageArray("university.defaultApplicationDocs");
    if (/^(passport|护照|護照|pasport)$/.test(key)) return docs[0] || "";
    if (/^(transcript|academic transcript|成绩单|成績單|transkrip)$/.test(key)) return docs[1] || "";
    if (/^(language score|language test score|语言成绩|語言成績|skor bahasa)$/.test(key)) return docs[2] || "";
    if (/^(personal statement|个人陈述|個人陳述|penyataan peribadi)$/.test(key)) return docs[3] || "";
  }

  return "";
}

function profileRuntimeText(value: unknown, fallback = "", kind?: ProfileTextKind) {
  const known = profileKnownText(value, kind);
  if (known) return known;
  return formatRuntimeDisplayText(rawStringFrom(value), fallback, currentLocale.value);
}

function profileDisplayText(value: unknown, fallback = "", kind?: ProfileTextKind) {
  const known = profileKnownText(value, kind);
  if (known) return known;
  return cleanDisplayText(rawStringFrom(value), fallback, currentLocale.value);
}

function profileString(key: string) {
  return stringFrom(profile.value?.[key]);
}

function profileOfficialNote(key: string) {
  return formatOfficialNote(profile.value?.[key], "", currentLocale.value);
}

function profileScaleValue(key: ProfileScaleKey) {
  const labels = [t(`university.${key}`), ...legacyProfileScaleLabels[key]].map((item) => item.toLowerCase());
  return scaleRows.value.find((item) => {
    const label = item.label.toLowerCase();
    return labels.some((candidate) => label.includes(candidate));
  })?.value || "";
}

function countPrograms(level: DegreeLevel) {
  return String((detail.value?.programs || []).filter((program) => program.level === level).length);
}

function catalogLevelTotal(level: DegreeLevel) {
  return String(detail.value?.catalogStatusSummary?.byLevel?.[level]?.total ?? countPrograms(level));
}

function auditReviewCount() {
  const summary = detail.value?.catalogStatusSummary?.all;
  if (summary) {
    return String(
      (summary.needsReview || 0) +
      (summary.notAvailableForInternational || 0) +
      (summary.officialLanguageRequirementNotPublished || 0)
    );
  }
  const audit = asRecord(profile.value?.undergraduateAudit);
  const needsReview = numberFrom(audit?.needsReview);
  const unavailable = numberFrom(audit?.notAvailableForInternational);
  if (needsReview || unavailable) return String(needsReview + unavailable);
  return "0";
}

function auditRestrictionLabel() {
  const summary = detail.value?.catalogStatusSummary?.all;
  if (summary?.officialLanguageRequirementNotPublished) return t('university.languageRequirement');
  return summary?.needsReview === 0
    ? t('university.internationalUnavailable')
    : t('university.reviewUnavailable');
}

function sourceLabel(item: OfficialSourceLink) {
  if (item.sourceType === "official-website") return t('common.officialWebsite');
  if (item.sourceType === "study-portal") return t('common.studyPortal');
  if (item.sourceType === "admission") return t('common.applicationPortal');
  if (item.sourceType === "fee") return t('university.officialFeeSource');
  return item.title || t('common.officialLink');
}

function formatRow(item: LabelValue) {
  return item.label ? `${item.label}${labelValueSeparator()}${item.value}` : item.value;
}

function formatRuntimeRow(item: LabelValue, fallback = officialPageFallback(currentLocale.value)) {
  const label = formatRuntimeDisplayText(item.label, "", currentLocale.value);
  const value = formatRuntimeDisplayText(item.value, fallback, currentLocale.value);
  if (label && value) return `${label}${labelValueSeparator()}${value}`;
  return value || label;
}

function formatProfileRuntimeRow(item: LabelValue, fallback = officialPageFallback(currentLocale.value)) {
  const label = profileRuntimeText(item.label, "", "rowLabel");
  const value = profileRuntimeText(item.value, fallback);
  if (label && value) return `${label}${labelValueSeparator()}${value}`;
  return value || label;
}

function normalizeRawRows(value: unknown): LabelValue[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { label: "", value: item };
    const record = asRecord(item);
    if (!record) return { label: "", value: "" };
    return {
      label: rawStringFrom(record.label || record.title || record.name),
      value: rawStringFrom(record.value || record.text || record.description || record.url)
    };
  }).filter((item) => item.label || item.value);
}

function normalizeRows(value: unknown): LabelValue[] {
  return normalizeRawRows(value).map((item) => ({
    label: stringFrom(item.label),
    value: stringFrom(item.value)
  })).filter((item) => item.label || item.value);
}

function normalizeProfileRows(value: unknown): LabelValue[] {
  return normalizeRawRows(value).map((item) => ({
    label: profileDisplayText(item.label, "", "rowLabel"),
    value: profileRuntimeText(item.value, "")
  })).filter((item) => item.label && item.value);
}

function normalizeContactRows(value: unknown): LabelLink[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    if (!record) return null;
    const valueText = profileDisplayText(record.value || record.text || record.url || record.href);
    const href = rawStringFrom(record.href || record.url) || (valueText.includes("@") ? `mailto:${valueText}` : valueText);
    return {
      label: profileDisplayText(record.label || record.title || record.name, "", "linkLabel") || t('common.contactInfo'),
      value: valueText,
      href
    };
  }).filter((item): item is LabelLink => Boolean(item?.value && item.href));
}

function normalizeProfileLinks(value: unknown): SourceLinkView[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      const match = item.match(/https?:\/\/\S+/);
      const rawLabel = item.replace(/:\s*https?:\/\/\S+$/, "");
      return match ? { label: profileDisplayText(rawLabel, "", "linkLabel") || t('common.officialLink'), url: match[0] } : null;
    }
    const record = asRecord(item);
    if (!record) return null;
    const url = rawStringFrom(record.url || record.href);
    if (!url) return null;
    return { label: profileDisplayText(record.label || record.title || record.name, "", "linkLabel") || t('common.officialLink'), url };
  }).filter((item): item is SourceLinkView => Boolean(item));
}

function normalizeList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return stringFrom(item);
      const record = asRecord(item);
      if (!record) return "";
      const row = normalizeRows([record])[0];
      return row ? formatRow(row) : "";
    }).filter(Boolean);
  }
  if (typeof value === "string") {
    const text = stringFrom(value);
    return text ? [text] : [];
  }
  return [];
}

function normalizeProfileList(value: unknown, kind?: ProfileTextKind): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return profileRuntimeText(item, "", kind);
      const record = asRecord(item);
      if (!record) return "";
      const row = normalizeRawRows([record])[0];
      return row ? formatProfileRuntimeRow(row, "") : "";
    }).filter(Boolean);
  }
  if (typeof value === "string") {
    const text = profileRuntimeText(value, "", kind);
    return text ? [text] : [];
  }
  return [];
}

function normalizeRuntimeList(value: unknown, fallback = officialPageFallback(currentLocale.value)): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return formatRuntimeDisplayText(item, fallback, currentLocale.value);
      const record = asRecord(item);
      if (!record) return "";
      const row = normalizeRows([record])[0];
      return row ? formatRuntimeRow(row, fallback) : "";
    }).filter(Boolean);
  }
  if (typeof value === "string") {
    const text = formatRuntimeDisplayText(value, fallback, currentLocale.value);
    return text ? [text] : [];
  }
  return [];
}

function uniqueRows(rows: string[]) {
  return [...new Set(rows.filter(Boolean))];
}

function pushLink(items: SourceLinkView[], label: string, url?: string | null) {
  if (!url || items.some((item) => item.url === url)) return;
  items.push({ label, url });
}

function stringFrom(value: unknown) {
  if (typeof value === "string") return cleanDisplayText(value, "", currentLocale.value);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? t('common.yes') : t('common.no');
  return "";
}

function rawStringFrom(value: unknown) {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? t('common.yes') : t('common.no');
  return "";
}

function messageArray(key: string): string[] {
  const value = tm(key);
  return Array.isArray(value) ? value.map(String) : [];
}

function labelValueSeparator() {
  return currentLocale.value === "zh-CN" || currentLocale.value === "zh-TW" ? "：" : ": ";
}

function numberFrom(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as LooseRecord : null;
}

function emptyLocalizedArray() {
  return { en: [], ms: [], "zh-CN": [], "zh-TW": [] };
}

onMounted(() => {
  void loadDetail();
});

watch(() => props.slug, () => {
  activeTab.value = "overview";
  currentProgramPage.value = 1;
  hasHeroLogoError.value = false;
  catalog.closeProgramDetail();
  void loadDetail();
});

watch(() => route.query.review, () => {
  activeTab.value = "overview";
  currentProgramPage.value = 1;
  hasHeroLogoError.value = false;
  catalog.closeProgramDetail();
  void loadDetail();
});

watch(programTotalPages, (totalPages) => {
  if (currentProgramPage.value > totalPages) currentProgramPage.value = totalPages;
});

watch(() => detail.value?.logoUrl, () => {
  hasHeroLogoError.value = false;
});
</script>
