<template>
  <section v-if="detail" class="university-detail-page">
    <section class="detail-hero">
      <div class="container detail-hero__inner">
        <div class="detail-hero__copy">
          <div class="detail-hero__eyebrow">{{ detail.shortName }} / {{ detail.code }}</div>
          <h1 class="detail-hero__title">{{ text(detail.name) }}</h1>
          <p class="detail-hero__description">{{ text(detail.description) }}</p>
          <div class="detail-hero__chips">
            <span class="chip chip-gold">QS #{{ detail.qsRank }}</span>
            <span class="chip chip-teal">{{ t(`ownership.${detail.ownership}`) }}</span>
            <span class="chip chip-ink">{{ text(detail.location) }}</span>
            <span v-if="detail.acceptNoLanguage" class="chip chip-blue">{{ t('common.noLanguageApply') }}</span>
          </div>
        </div>

        <div class="detail-hero__panel">
          <div class="detail-hero__stat">
            <span>{{ t('common.programCount') }}</span>
            <strong>{{ detail.programs.length }}</strong>
          </div>
          <div class="detail-hero__stat">
            <span>{{ t('common.tuitionRange') }}</span>
            <strong>CNY {{ formatCurrency(detail.tuitionMinCny) }} - {{ formatCurrency(detail.tuitionMaxCny) }}</strong>
          </div>
          <div class="detail-hero__stat">
            <span>{{ t('common.languageRequirement') }}</span>
            <strong>IELTS {{ detail.minIelts }}+</strong>
          </div>
          <div class="detail-hero__actions">
            <a class="btn btn-gold" :href="detail.officialWebsite || detail.website" target="_blank" rel="noreferrer">{{ t('common.visitWebsite') }}</a>
            <button class="btn btn-outline btn-outline-light" @click="catalog.toggleCompare(detail.id)">
              {{ catalog.compareIds.includes(detail.id) ? t('common.removeFromCompare') : t('common.addToCompare') }}
            </button>
          </div>
        </div>
      </div>

      <nav class="detail-tabs container">
        <a href="#overview">{{ t('common.overview') }}</a>
        <a href="#applications">{{ t('common.applications') }}</a>
        <a href="#programmes">{{ t('university.structureTitle') }}</a>
      </nav>
    </section>

    <section id="overview" class="detail-section">
      <div class="container detail-section__inner">
        <div class="detail-section-title serif">{{ t('university.introTitle') }}</div>
        <div class="detail-overview-grid">
          <article class="official-card">
            <span>{{ t('common.foundedYear') }}</span>
            <strong>{{ detail.foundedYear }}</strong>
          </article>
          <article class="official-card">
            <span>{{ t('common.students') }}</span>
            <strong>{{ compactNumber(detail.students) }}</strong>
          </article>
          <article class="official-card">
            <span>{{ t('common.international') }}</span>
            <strong>{{ compactNumber(detail.intlStudents) }}</strong>
          </article>
          <article class="official-card">
            <span>{{ t('common.official') }}</span>
            <strong>{{ detail.officialVerifiedAt || detail.officialSourceStatus }}</strong>
          </article>
        </div>

        <div class="detail-two-col">
          <div class="section-card detail-copy-card">
            <h2 class="section-title">{{ t('university.highlightsTitle') }}</h2>
            <ul>
              <li v-for="item in array(detail.highlights)" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div class="section-card detail-copy-card">
            <h2 class="section-title">{{ t('university.facilitiesTitle') }}</h2>
            <ul>
              <li v-for="item in array(detail.facilities)" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section id="applications" class="detail-section">
      <div class="container detail-section__inner">
        <div class="detail-section-title serif">{{ t('common.applications') }}</div>
        <div class="application-grid">
          <article class="section-card application-card">
            <span>官方申请入口</span>
            <a :href="detail.applicationPortalUrl || detail.studyPortalUrl || detail.website" target="_blank" rel="noreferrer">
              {{ detail.applicationPortalUrl || detail.studyPortalUrl || detail.website }}
            </a>
          </article>
          <article class="section-card application-card">
            <span>申请时间</span>
            <ul>
              <li v-for="item in detail.applicationPeriods" :key="item">{{ item }}</li>
              <li v-if="!detail.applicationPeriods.length">以学校官方页面为准</li>
            </ul>
          </article>
          <article class="section-card application-card">
            <span>申请材料</span>
            <ul>
              <li v-for="item in array(detail.applicationDocuments)" :key="item">{{ item }}</li>
              <li v-if="!array(detail.applicationDocuments).length">{{ t('common.documents') }}</li>
            </ul>
          </article>
          <article class="section-card application-card">
            <span>中国学生要求</span>
            <ul>
              <li v-for="item in array(detail.chinaStudentRequirements)" :key="item">{{ item }}</li>
              <li v-if="!array(detail.chinaStudentRequirements).length">按具体专业官方要求核对</li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section id="programmes" class="detail-section">
      <div class="container detail-section__inner">
        <div class="programme-page-title">
          <div>
            <div class="section-kicker">{{ t('university.structureTitle') }}</div>
            <h2>{{ t('university.visibleCount', { count: detail.programs.length }) }}</h2>
          </div>
          <span class="programme-count">{{ detail.programs.length }}</span>
        </div>

        <div class="programme-levels">
          <section v-for="section in programSections" :key="section.level" class="programme-level">
            <div class="programme-level__head">
              <h2>{{ section.label }}</h2>
              <span class="programme-count">{{ section.items.length }}</span>
            </div>
            <div class="programme-table-wrap">
              <div class="programme-grid-head">
                <div>专业名称</div>
                <div>学院</div>
                <div>学制</div>
                <div>官方学费</div>
                <div>语言要求</div>
                <div>开学</div>
                <div>详情</div>
              </div>
              <button
                v-for="program in section.items"
                :key="program.id"
                class="programme-grid-row"
                type="button"
                @click="openProgram(program)"
              >
                <div class="programme-cell" data-label="专业名称">
                  <div class="programme-name-zh">{{ text(program.name) }}</div>
                  <div class="programme-name-en">{{ program.nameEnOfficial || program.nameEn }}</div>
                </div>
                <div class="programme-cell" data-label="学院">
                  <div class="programme-faculty-zh">{{ program.facultyZh || text(program.faculty) }}</div>
                </div>
                <div class="programme-cell" data-label="学制">
                  <span class="programme-pill">{{ program.durationOfficial || `${Number(program.durationYears)} 年` }}</span>
                </div>
                <div class="programme-cell" data-label="官方学费">
                  <div class="programme-fee-main">{{ program.tuitionDisplay || program.listTuitionText }}</div>
                  <div class="programme-fee-status" :class="{ review: program.officialFeeAuditStatus !== 'matched-official' }">
                    {{ feeStatus(program) }}
                  </div>
                </div>
                <div class="programme-cell" data-label="语言要求">
                  <span class="programme-lang-pill">IELTS {{ program.languageRequirement.ielts }}+</span>
                </div>
                <div class="programme-cell" data-label="开学">
                  <div class="programme-intake-cn">{{ program.officialIntake || program.intakeMonths.join(' / ') || '待确认' }}</div>
                </div>
                <div class="programme-cell" data-label="详情">
                  <span class="programme-detail-link">详情</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </section>

    <div v-if="catalog.selectedProgramDetail" class="modal-backdrop fade-in" @click.self="closeProgramModal">
      <div class="modal program-detail-modal">
        <div class="modal-header">
          <div>
            <div class="program-modal-tags">
              <span class="chip chip-teal">{{ levelLabel(catalog.selectedProgramDetail.level) }}</span>
              <span class="chip chip-gold">{{ catalog.selectedProgramDetail.category }}</span>
              <span class="chip chip-ink">{{ catalog.selectedProgramDetail.durationOfficial }}</span>
            </div>
            <h2 class="serif">{{ text(catalog.selectedProgramDetail.name) }}</h2>
            <div class="program-modal-subtitle">
              {{ catalog.selectedProgramDetail.nameEnOfficial || catalog.selectedProgramDetail.nameEn }} · {{ text(catalog.selectedProgramDetail.university.name) }}
            </div>
          </div>
          <button class="modal-close" @click="closeProgramModal">×</button>
        </div>

        <div class="modal-body">
          <p class="program-modal-description">{{ text(catalog.selectedProgramDetail.description) }}</p>

          <div class="modal-section">
            <div class="modal-section-title">学费与开学</div>
            <div class="req-grid">
              <div class="req-item">
                <div class="req-item-label">官方国际学生总学费</div>
                <div class="req-item-value">{{ catalog.selectedProgramDetail.tuitionDisplay || catalog.selectedProgramDetail.tuitionInfo.displayText }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">开学时间</div>
                <div class="req-item-value">{{ catalog.selectedProgramDetail.officialIntake || catalog.selectedProgramDetail.intakeMonths.join(' / ') || '待确认' }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">官方学制</div>
                <div class="req-item-value">{{ catalog.selectedProgramDetail.durationOfficial }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">费用备注</div>
                <div class="req-item-value req-item-value--text">{{ catalog.selectedProgramDetail.tuitionInfo.note || '以官方页面为准' }}</div>
              </div>
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">入学与语言要求</div>
            <div class="req-grid">
              <div class="req-item">
                <div class="req-item-label">GPA 要求</div>
                <div class="req-item-value">{{ catalog.selectedProgramDetail.requirement.gpa }}+</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">雅思要求</div>
                <div class="req-item-value">IELTS {{ catalog.selectedProgramDetail.languageRequirement.ielts }}+</div>
              </div>
              <div v-if="catalog.selectedProgramDetail.languageRequirement.toefl" class="req-item">
                <div class="req-item-label">托福要求</div>
                <div class="req-item-value">TOEFL {{ catalog.selectedProgramDetail.languageRequirement.toefl }}+</div>
              </div>
              <div class="req-item req-item--full">
                <div class="req-item-label">官方语言要求</div>
                <div class="req-item-value req-item-value--text">{{ catalog.selectedProgramDetail.officialLanguageRequirement || '按学校官方页面为准' }}</div>
              </div>
              <div class="req-item req-item--full">
                <div class="req-item-label">官方学术要求 / 备注</div>
                <div class="req-item-value req-item-value--text">{{ catalog.selectedProgramDetail.officialAcademicRequirement || text(catalog.selectedProgramDetail.requirement.note) }}</div>
              </div>
              <div v-if="catalog.selectedProgramDetail.chinaStudentRequirement" class="req-item req-item--full">
                <div class="req-item-label">中国学生申请备注</div>
                <div class="req-item-value req-item-value--text">{{ catalog.selectedProgramDetail.chinaStudentRequirement }}</div>
              </div>
              <div v-if="catalog.selectedProgramDetail.officialAccreditationNote" class="req-item req-item--full">
                <div class="req-item-label">官方认证 / 专业认可</div>
                <div class="req-item-value req-item-value--text">{{ catalog.selectedProgramDetail.officialAccreditationNote }}</div>
              </div>
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">{{ t('common.documents') }}</div>
            <ul class="program-doc-list">
              <li v-for="item in array(catalog.selectedProgramDetail.applicationDocs)" :key="item">{{ item }}</li>
              <li v-if="!array(catalog.selectedProgramDetail.applicationDocs).length">以官方申请系统要求为准</li>
            </ul>
          </div>

          <div v-if="array(catalog.selectedProgramDetail.curriculum).length" class="modal-section">
            <div class="modal-section-title">{{ t('common.curriculum') }}</div>
            <div class="curriculum-pills">
              <span v-for="item in array(catalog.selectedProgramDetail.curriculum)" :key="item" class="curriculum-pill">{{ item }}</span>
            </div>
          </div>

          <div v-if="array(catalog.selectedProgramDetail.careers).length" class="modal-section">
            <div class="modal-section-title">{{ t('common.careers') }}</div>
            <div class="career-pills">
              <span v-for="item in array(catalog.selectedProgramDetail.careers)" :key="item" class="career-pill">{{ item }}</span>
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">官方来源与核验状态</div>
            <div class="req-grid">
              <div class="req-item">
                <div class="req-item-label">来源状态</div>
                <div class="req-item-value">{{ sourceStatus(catalog.selectedProgramDetail.officialSourceStatus) }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">核验日期</div>
                <div class="req-item-value">{{ catalog.selectedProgramDetail.officialVerifiedAt || '待确认' }}</div>
              </div>
              <div class="req-item req-item--full">
                <div class="req-item-label">官方链接</div>
                <a class="req-source-link" :href="catalog.selectedProgramDetail.officialSourceUrl" target="_blank" rel="noreferrer">
                  {{ catalog.selectedProgramDetail.officialSourceUrl || '待补充' }}
                </a>
              </div>
              <div class="req-item req-item--full">
                <div class="req-item-label">官方学费来源</div>
                <a class="req-source-link" :href="catalog.selectedProgramDetail.officialFeeSourceUrl" target="_blank" rel="noreferrer">
                  {{ catalog.selectedProgramDetail.officialFeeSourceUrl || '待补充' }}
                </a>
              </div>
            </div>
          </div>

          <div class="program-modal-actions">
            <button class="btn btn-primary" @click="goPlanner">{{ t('program.addToPlanner') }}</button>
            <button class="btn btn-outline" @click="catalog.toggleFavoriteProgram(catalog.selectedProgramDetail.id)">
              {{ catalog.favoriteState.programs.includes(catalog.selectedProgramDetail.id) ? t('common.favorited') : t('program.favoriteProgram') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section v-else class="container detail-loading">
    <div class="section-card empty-state">{{ catalog.loading ? t('common.loading') : t('common.noData') }}</div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import type { DegreeLevel, ProgramListItem, UniversityListItem } from "@studymy/shared";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocaleText } from "../composables/useLocaleText";
import { useCatalogStore } from "../stores/catalog";
import { usePlannerStore } from "../stores/planner";
import { formatCurrency } from "../utils/format";

type UniversityDetailView = UniversityListItem & { programs: ProgramListItem[] };

const props = defineProps<{ slug: string }>();
const catalog = useCatalogStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { text, array } = useLocaleText();
const planner = usePlannerStore();

const detail = computed(() => catalog.universityDetail as UniversityDetailView | null);
const levelOrder: DegreeLevel[] = ["bachelor", "master", "phd"];
const programSections = computed(() =>
  levelOrder
    .map((level) => ({
      level,
      label: sectionLabel(level),
      items: (detail.value?.programs || []).filter((program) => program.level === level).sort(comparePrograms)
    }))
    .filter((section) => section.items.length)
);

async function loadDetail() {
  await catalog.loadUniversity(props.slug);
  await openQueryProgram();
}

async function openQueryProgram() {
  const programId = route.query.program;
  if (!programId || Array.isArray(programId)) return;
  await catalog.openProgramDetail(programId);
}

async function openProgram(program: ProgramListItem) {
  await catalog.openProgramDetail(program.id);
  await router.replace({ path: route.path, query: { ...route.query, program: String(program.id) } });
}

async function closeProgramModal() {
  catalog.closeProgramDetail();
  const nextQuery = { ...route.query };
  delete nextQuery.program;
  await router.replace({ path: route.path, query: nextQuery });
}

async function goPlanner() {
  if (catalog.selectedProgramDetail) {
    await planner.addTask(catalog.selectedProgramDetail.university.id, catalog.selectedProgramDetail.id);
  }
  void router.push("/planner");
}

function comparePrograms(a: ProgramListItem, b: ProgramListItem) {
  return a.nameEn.localeCompare(b.nameEn);
}

function sectionLabel(level: DegreeLevel) {
  if (level === "bachelor") return t('university.bachelorPrograms');
  if (level === "master") return t('university.masterPrograms');
  return t('university.phdPrograms');
}

function levelLabel(level: DegreeLevel) {
  if (level === "bachelor") return t('degree.bachelor');
  if (level === "master") return t('degree.master');
  return t('degree.phd');
}

function compactNumber(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}k+`;
  return `${value}`;
}

function feeStatus(program: ProgramListItem) {
  if (program.officialFeeAuditStatus === "matched-official") return "官方已核验";
  if (program.officialFeeAuditStatus === "not-published") return "官方未公布";
  return "待复核";
}

function sourceStatus(status: string) {
  if (status === "official-verified") return "官方来源已核验";
  if (status.includes("not-available")) return "官方页已核验但暂不开放";
  if (status.includes("missing")) return "缺少官方来源";
  return "待复核";
}

onMounted(() => {
  void loadDetail();
});

watch(() => props.slug, () => {
  catalog.closeProgramDetail();
  void loadDetail();
});
</script>
