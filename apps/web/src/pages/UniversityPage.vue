<template>
  <section v-if="detail" class="university-detail-page">
    <section class="detail-hero">
      <div class="container detail-hero-inner">
        <button class="btn btn-ghost btn-sm detail-back-btn" type="button" @click="goHome">
          ← 返回院校库
        </button>

        <div class="detail-hero-main">
          <img
            v-if="detail.logoUrl"
            class="detail-hero-logo"
            :src="detail.logoUrl"
            :alt="detail.shortName"
            @error="hideBrokenImage"
          >
          <div class="detail-hero-heading">
            <div class="detail-hero-badges">
              <span class="chip" :class="detail.ownership === 'public' ? 'chip-blue' : 'chip-gold'">
                {{ ownershipLabel(detail.ownership) }}
              </span>
              <span class="uni-rank-badge serif">QS #{{ detail.qsRank }}</span>
              <span v-if="detail.csrCertified" class="chip chip-teal">MQA 认证</span>
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

        <div class="detail-tabs" role="tablist" aria-label="院校详情标签页">
          <button
            v-for="tab in detailTabs"
            :key="tab.key"
            class="detail-tab"
            :class="{ active: activeTab === tab.key }"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            @click="setActiveTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </section>

    <section class="detail-content detail-section">
      <div class="container">
        <template v-if="activeTab === 'overview'">
          <div class="detail-highlights">
            <div v-for="item in array(detail.highlights)" :key="item" class="highlight-item">
              <span class="highlight-icon" aria-hidden="true"></span>
              <span>{{ item }}</span>
            </div>
          </div>

          <article class="section-card official-profile-card">
            <div class="detail-section-title serif">官方基础信息</div>
            <div class="official-profile-grid">
              <div v-for="item in officialInfoFields" :key="item.label" class="official-profile-item">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>

            <div class="official-profile-support">
              <div class="official-mini-card">
                <span>课程层级</span>
                <div class="tag-row">
                  <span v-for="item in profileLevelChips" :key="item" class="chip chip-blue">{{ item }}</span>
                </div>
              </div>
              <div class="official-mini-card">
                <span>学习 / 课程模式</span>
                <div class="tag-row">
                  <span v-for="item in profileModeChips" :key="item" class="chip chip-ink">{{ item }}</span>
                </div>
              </div>
            </div>
          </article>

          <div class="detail-overview-cards">
            <article class="section-card detail-metric-card">
              <div class="detail-section-title serif detail-section-title--compact">排名与规模</div>
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
              <div class="detail-section-title serif detail-section-title--compact">官方入口与联系</div>
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
            <span>核验备注</span>
            <p>{{ auditSummary }}</p>
            <small>{{ sourceSummary }}</small>
          </article>

          <div class="detail-body">
            <div class="detail-copy-block">
              <div class="detail-section-title serif">院校简介</div>
              <p>{{ text(detail.description) }}</p>
              <div v-if="detail.admissionEmail" class="detail-inline-contact">
                招生邮箱：
                <a :href="`mailto:${detail.admissionEmail}`">{{ detail.admissionEmail }}</a>
              </div>
            </div>

            <aside class="section-card detail-side-card">
              <div class="detail-section-title serif detail-section-title--compact">官方费用与资料状态</div>
              <div class="detail-tuition-main">{{ tuitionSummary }}</div>
              <p>{{ tuitionNote }}</p>
              <div class="detail-program-stats">
                <div v-for="item in programAuditRows" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div class="detail-side-actions">
                <button class="btn btn-primary w-full" type="button" @click="setActiveTab('bachelor')">浏览本科专业</button>
                <a
                  v-if="detail.officialWebsite || detail.website"
                  class="btn btn-outline w-full"
                  :href="detail.officialWebsite || detail.website"
                  target="_blank"
                  rel="noreferrer"
                >
                  访问官网
                </a>
              </div>
            </aside>
          </div>
        </template>

        <template v-else-if="activeProgramLevel">
          <div class="programme-block">
            <div class="programme-table-title">
              <h2>{{ activeProgramLabel }}项目</h2>
              <span class="programme-count">{{ activePrograms.length }}</span>
            </div>
            <div v-if="activePrograms.length" class="programme-table-wrap">
              <div class="programme-grid-head">
                <div>专业名称</div>
                <div>学院</div>
                <div>学制</div>
                <div>官方学费</div>
                <div>语言要求</div>
                <div>开学</div>
                <div></div>
              </div>
              <button
                v-for="program in activePrograms"
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
                  <div class="programme-faculty-zh">{{ program.facultyZh || text(program.faculty) || categoryLabel(program.category) }}</div>
                </div>
                <div class="programme-cell" data-label="学制">
                  <span class="programme-pill">{{ durationLabel(program) }}</span>
                </div>
                <div class="programme-cell" data-label="官方学费">
                  <div class="programme-fee-main">{{ tuitionLabel(program) }}</div>
                  <div class="programme-fee-status" :class="{ review: program.officialFeeAuditStatus !== 'matched-official' }">
                    {{ feeStatus(program) }}
                  </div>
                </div>
                <div class="programme-cell" data-label="语言要求">
                  <span class="programme-lang-pill">{{ languageLabel(program) }}</span>
                </div>
                <div class="programme-cell" data-label="开学">
                  <div class="programme-intake-cn">{{ intakeLabel(program) }}</div>
                </div>
                <div class="programme-cell" data-label="详情">
                  <span class="programme-detail-link">详情</span>
                </div>
              </button>
            </div>
            <div v-else class="section-card empty-state">
              当前没有可展示的{{ activeProgramLabel }}项目。
            </div>
          </div>
        </template>

        <template v-else-if="activeTab === 'facilities'">
          <div class="detail-section-title serif">校园设施</div>
          <div class="detail-highlights">
            <div v-for="item in array(detail.facilities)" :key="item" class="highlight-item highlight-item--facility">
              <span class="highlight-icon" aria-hidden="true"></span>
              <span>{{ item }}</span>
            </div>
          </div>
        </template>

        <template v-else-if="activeTab === 'apply'">
          <article class="section-card official-apply-card">
            <div class="detail-section-title serif">官方申请入口</div>
            <div class="official-link-grid">
              <a
                v-for="item in sourceLinks"
                :key="`apply-${item.url}`"
                :href="item.url"
                target="_blank"
                rel="noreferrer"
                class="official-link-card"
              >
                <span>官方链接</span>
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
                <span>申请时间</span>
                <ul>
                  <li v-for="item in applicationPeriodRows" :key="item">{{ item }}</li>
                </ul>
              </div>
              <div class="application-info-card">
                <span>申请费</span>
                <ul>
                  <li v-for="item in applicationFeeRows" :key="item">{{ item }}</li>
                </ul>
              </div>
              <div class="application-info-card">
                <span>申请材料</span>
                <ul>
                  <li v-for="item in applicationDocumentRows" :key="item">{{ item }}</li>
                </ul>
              </div>
              <div class="application-info-card">
                <span>中国学生本科要求</span>
                <p>{{ chinaRequirementSummary }}</p>
              </div>
            </div>
          </article>

          <div class="apply-bottom-grid">
            <article class="section-card">
              <div class="detail-section-title serif detail-section-title--compact">申请须知</div>
              <div class="apply-note-list">
                <div>
                  <span>官方网站</span>
                  <a :href="detail.officialWebsite || detail.website" target="_blank" rel="noreferrer">
                    {{ detail.officialWebsite || detail.website || "待确认" }}
                  </a>
                </div>
                <div>
                  <span>招生邮箱</span>
                  <a v-if="detail.admissionEmail" :href="`mailto:${detail.admissionEmail}`">{{ detail.admissionEmail }}</a>
                  <strong v-else>待确认</strong>
                </div>
                <div>
                  <span>英语要求</span>
                  <strong>按具体专业官方页面为准；列表中已展示每个可申请专业的语言要求。</strong>
                </div>
              </div>
            </article>

            <article class="section-card apply-planner-card">
              <div class="detail-section-title serif detail-section-title--compact">一键进入申请规划</div>
              <p>使用申请规划器追踪材料进度、管理申请时间线，让留学申请更有条理。</p>
              <button class="btn btn-gold w-full" type="button" @click="goPlanner">进入申请规划 →</button>
            </article>
          </div>
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
          <button class="modal-close" type="button" aria-label="关闭专业详情" @click="closeProgramModal">×</button>
        </div>

        <div class="modal-body">
          <p class="program-modal-description">{{ text(catalog.selectedProgramDetail.description) }}</p>

          <div class="modal-section">
            <div class="modal-section-title">学费与开学</div>
            <div class="req-grid">
              <div class="req-item">
                <div class="req-item-label">官方国际学生总学费</div>
                <div class="req-item-value">{{ tuitionLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">开学时间</div>
                <div class="req-item-value">{{ intakeLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">官方学制</div>
                <div class="req-item-value">{{ durationLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div class="req-item">
                <div class="req-item-label">费用备注</div>
                <div class="req-item-value req-item-value--text">{{ catalog.selectedProgramDetail.tuitionInfo.note || "以官方页面为准" }}</div>
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
                <div class="req-item-value">{{ languageLabel(catalog.selectedProgramDetail) }}</div>
              </div>
              <div v-if="catalog.selectedProgramDetail.languageRequirement.toefl" class="req-item">
                <div class="req-item-label">托福要求</div>
                <div class="req-item-value">TOEFL {{ catalog.selectedProgramDetail.languageRequirement.toefl }}+</div>
              </div>
              <div class="req-item req-item--full">
                <div class="req-item-label">官方语言要求</div>
                <div class="req-item-value req-item-value--text">{{ catalog.selectedProgramDetail.officialLanguageRequirement || "按学校官方页面为准" }}</div>
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
            <div class="modal-section-title">申请所需材料</div>
            <ul class="program-doc-list program-doc-list--checked">
              <li v-for="item in programApplicationDocs(catalog.selectedProgramDetail)" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">官方来源与核验状态</div>
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

          <div class="program-modal-actions">
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
    <div class="section-card empty-state">{{ catalog.loading ? t("common.loading") : t("common.noData") }}</div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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
import { formatCurrency } from "../utils/format";

type DetailTab = "overview" | "bachelor" | "master" | "phd" | "facilities" | "apply";
type UniversityDetailView = UniversityListItem & { programs: ProgramListItem[] };
type LabelValue = { label: string; value: string };
type ModalSourceRow = LabelValue & { full?: boolean };
type LabelLink = LabelValue & { href: string };
type SourceLinkView = { label: string; url: string };
type LooseRecord = Record<string, unknown>;

const props = defineProps<{ slug: string }>();
const catalog = useCatalogStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { text, array } = useLocaleText();
const planner = usePlannerStore();
const activeTab = ref<DetailTab>("overview");

const detailTabs: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "概览" },
  { key: "bachelor", label: "本科专业" },
  { key: "master", label: "硕士专业" },
  { key: "phd", label: "博士专业" },
  { key: "facilities", label: "校园设施" },
  { key: "apply", label: "申请信息" }
];

const detail = computed(() => catalog.universityDetail as UniversityDetailView | null);
const profile = computed(() => asRecord(detail.value?.officialProfile));

const heroStats = computed<LabelValue[]>(() => {
  const current = detail.value;
  if (!current) return [];
  return [
    { label: "所在地", value: text(current.location) },
    { label: "建校年份", value: `${current.foundedYear}年` },
    { label: "在校学生", value: profileScaleValue("学生总数") || profileScaleValue("Students") || compactNumber(current.students) },
    { label: "国际学生来源", value: profileScaleValue("国际学生") || profileScaleValue("International") || compactNumber(current.intlStudents) },
    { label: "本科语言", value: current.acceptNoLanguage ? "支持条件路径" : `IELTS ${current.minIelts}+` }
  ];
});

const officialInfoFields = computed<LabelValue[]>(() => {
  const current = detail.value;
  if (!current) return [];
  const cityCountry = [profileString("city"), profileString("country")].filter(Boolean).join(", ");
  return [
    { label: "中文名", value: profileString("chineseName") || text(current.name) },
    { label: "英文法定名", value: profileString("legalName") || current.nameEnOfficial || current.nameEn },
    { label: "学校类型", value: profileString("institutionType") || ownershipLabel(current.ownership) },
    { label: "学校定位", value: profileString("universityType") || institutionTypeLabel(current.institutionType) },
    { label: "所在城市", value: cityCountry || text(current.location) },
    { label: "官方地址", value: current.officialAddress || profileString("address") || "待确认" }
  ];
});

const profileLevelChips = computed(() => normalizeList(profile.value?.levels).length
  ? normalizeList(profile.value?.levels)
  : ["本科", "硕士", "博士"]);

const profileModeChips = computed(() => {
  const modes = [...normalizeList(profile.value?.studyModes), ...normalizeList(profile.value?.programmeModes)];
  return modes.length ? modes : [detail.value ? institutionTypeLabel(detail.value.institutionType) : "课程制 / 研究制"];
});

const rankingRows = computed<LabelValue[]>(() => {
  const rows = normalizeRows(profile.value?.rankings);
  if (rows.length) return rows;
  const current = detail.value;
  if (!current) return [];
  return [
    { label: "QS 世界排名", value: `#${current.qsRank}` },
    { label: "QS 亚洲排名", value: current.qsAsiaRank ? `#${current.qsAsiaRank}` : "待确认" },
    { label: "官方来源", value: sourceStatus(current.officialSourceStatus) }
  ];
});

const scaleRows = computed<LabelValue[]>(() => {
  const rows = normalizeRows(profile.value?.scale);
  if (rows.length) return rows;
  const current = detail.value;
  if (!current) return [];
  return [
    { label: "在校学生", value: compactNumber(current.students) },
    { label: "国际学生", value: compactNumber(current.intlStudents) },
    { label: "建校年份", value: `${current.foundedYear}年` }
  ];
});

const contactRows = computed<LabelLink[]>(() => {
  const profileContacts = normalizeContactRows(profile.value?.contact);
  if (profileContacts.length) return profileContacts;
  const current = detail.value;
  if (!current) return [];
  return [
    current.officialWebsite || current.website
      ? { label: "官网", value: current.officialWebsite || current.website, href: current.officialWebsite || current.website }
      : null,
    current.admissionEmail
      ? { label: "招生邮箱", value: current.admissionEmail, href: `mailto:${current.admissionEmail}` }
      : null
  ].filter(Boolean) as LabelLink[];
});

const sourceLinks = computed<SourceLinkView[]>(() => {
  const current = detail.value;
  if (!current) return [];
  const items: SourceLinkView[] = [];
  pushLink(items, "官网", current.officialWebsite || current.website);
  pushLink(items, "Study Portal", current.studyPortalUrl);
  pushLink(items, "国际学生页", current.internationalPageUrl);
  pushLink(items, "申请入口", current.applicationPortalUrl);
  for (const item of normalizeProfileLinks(profile.value?.officialLinks)) pushLink(items, item.label, item.url);
  for (const item of current.officialSources || []) pushLink(items, sourceLabel(item), item.url);
  return items;
});

const auditSummary = computed(() =>
  profileString("qualityNote") ||
  detail.value?.officialAuditSummary ||
  "已按学校官方入口和公开资料进行字段整理；具体申请要求仍以当期官方页面为准。"
);

const sourceSummary = computed(() => {
  const note = profileString("sourceNote");
  const date = detail.value?.officialVerifiedAt || profileString("verifiedAt") || profileString("auditedAt") || "待确认";
  return note ? `${note}｜核验日期：${date}` : `来源状态：${detail.value ? sourceStatus(detail.value.officialSourceStatus) : "待确认"}｜核验日期：${date}`;
});

const tuitionSummary = computed(() => {
  const tuitionAudit = asRecord(profile.value?.tuitionAudit);
  const display = stringFrom(tuitionAudit?.displayText);
  if (display) return display;
  const current = detail.value;
  if (!current) return "待确认";
  return `CNY ${formatCurrency(current.tuitionMinCny)} - ${formatCurrency(current.tuitionMaxCny)}`;
});

const tuitionNote = computed(() => {
  const tuitionAudit = asRecord(profile.value?.tuitionAudit);
  const notes = normalizeList(tuitionAudit?.notes);
  if (notes.length) return notes[0];
  return "每个专业优先显示官方学制下的国际学生学费；费用以学校当期官方公布为准。";
});

const programAuditRows = computed<LabelValue[]>(() => {
  const current = detail.value;
  if (!current) return [];
  return [
    { label: "本科专业", value: auditCount("undergraduateAudit", "officialBachelorTotal", countPrograms("bachelor")) },
    { label: "可商用展示", value: auditCount("undergraduateAudit", "readyForPublicDisplay", current.programs.length) },
    { label: "待核准/不开放", value: auditReviewCount() },
    { label: "语言要求", value: "按具体专业页显示" }
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

const activeProgramLabel = computed(() => activeProgramLevel.value ? levelLabel(activeProgramLevel.value) : "");

const applicationPeriodRows = computed(() => {
  const rows = normalizeRows(profile.value?.applicationPeriods).map(formatRow);
  return rows.length ? rows : normalizeList(detail.value?.applicationPeriods).concat(["以学校官方页面为准"]).slice(0, Math.max(1, normalizeList(detail.value?.applicationPeriods).length || 1));
});

const applicationFeeRows = computed(() => {
  const rows = normalizeRows(profile.value?.applicationFees).map(formatRow);
  return rows.length ? rows : normalizeList(detail.value?.applicationFees).concat(["以学校官方页面为准"]).slice(0, Math.max(1, normalizeList(detail.value?.applicationFees).length || 1));
});

const applicationDocumentRows = computed(() => {
  const rows = array(detail.value?.applicationDocuments || emptyLocalizedArray());
  return rows.length ? rows : normalizeList(profile.value?.applicationDocuments).concat(["护照", "成绩单", "语言成绩", "个人陈述"]).slice(0, 4);
});

const chinaRequirementSummary = computed(() => {
  const profileChina = asRecord(profile.value?.chinaRequirement);
  const summary = stringFrom(profileChina?.summary);
  if (summary) return summary;
  const rows = array(detail.value?.chinaStudentRequirements || emptyLocalizedArray());
  return rows.length ? rows.join("；") : "以官方 FAQ 与具体专业页面为准。";
});

async function loadDetail() {
  await catalog.loadUniversity(props.slug);
  await openQueryProgram();
}

async function openQueryProgram() {
  const programId = route.query.program;
  if (!programId || Array.isArray(programId)) return;
  await catalog.openProgramDetail(programId);
}

function setActiveTab(tab: DetailTab) {
  activeTab.value = tab;
  catalog.closeProgramDetail();
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

function goHome() {
  void router.push("/");
}

function goPlanner() {
  void router.push("/planner");
}

function hideBrokenImage(event: Event) {
  const target = event.target;
  if (target instanceof HTMLImageElement) target.style.display = "none";
}

async function goPlannerWithProgram() {
  if (catalog.selectedProgramDetail) {
    await planner.addTask(catalog.selectedProgramDetail.university.id, catalog.selectedProgramDetail.id);
  }
  void router.push("/planner");
}

function comparePrograms(a: ProgramListItem, b: ProgramListItem) {
  return (a.nameEnOfficial || a.nameEn).localeCompare(b.nameEnOfficial || b.nameEn);
}

function levelLabel(level: DegreeLevel) {
  if (level === "bachelor") return "本科";
  if (level === "master") return "硕士";
  return "博士";
}

function ownershipLabel(value: InstitutionOwnership) {
  return value === "public" ? "公立" : "私立";
}

function institutionTypeLabel(value: InstitutionType) {
  if (value === "research") return "研究型大学";
  if (value === "applied") return "应用型大学";
  return "综合型大学";
}

function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    business: "商科",
    it: "IT",
    engineering: "工科",
    science: "理科",
    arts: "艺术与设计",
    medicine: "医学",
    law: "法学"
  };
  return labels[value] || value;
}

function compactNumber(value: number) {
  if (!value) return "待确认";
  if (value >= 1000) return `${Math.round(value / 1000)}k+`;
  return `${value}`;
}

function tuitionLabel(program: ProgramListItem | ProgramCatalogDetail) {
  if (program.publicDisplayStatus === "not-available-for-international") return "不适用国际学生";
  return program.tuitionDisplay || program.listTuitionText || program.tuitionInfo?.displayText || `CNY ${formatCurrency(program.annualTuitionCny)} / 年`;
}

function feeStatus(program: ProgramListItem | ProgramCatalogDetail) {
  if (program.officialFeeAuditStatus === "matched-official") return "官方已核验";
  if (program.officialFeeAuditStatus === "not-published") return "官方未公布";
  if (program.publicDisplayStatus === "not-available-for-international") return "详情页查看说明";
  return "待官方确认";
}

function durationLabel(program: ProgramListItem | ProgramCatalogDetail) {
  return normalizeAcademicText(program.durationOfficial || `${Number(program.durationYears)} years`);
}

function languageLabel(program: ProgramListItem | ProgramCatalogDetail) {
  if (program.publicDisplayStatus === "not-available-for-international") return "不适用";
  const raw = program.officialLanguageRequirement || "";
  const match = raw.match(/IELTS(?:\s*\(Academic\)|\s+Academic)?(?:\s*Band)?\s*(\d+(?:\.\d+)?)/i);
  if (match) return `IELTS ${match[1]}+`;
  return `IELTS ${program.languageRequirement.ielts}+`;
}

function intakeLabel(program: ProgramListItem | ProgramCatalogDetail) {
  const value = program.officialIntake || program.intakeMonths.join(" / ");
  return normalizeAcademicText(value || "待确认");
}

function programApplicationDocs(program: ProgramCatalogDetail) {
  const docs = array(program.applicationDocs);
  return docs.length ? docs : ["以官方申请系统要求为准"];
}

function programSourceRows(program: ProgramCatalogDetail): ModalSourceRow[] {
  const rows: ModalSourceRow[] = [
    { label: "来源状态", value: sourceStatus(program.officialSourceStatus) },
    { label: "核验日期", value: program.officialVerifiedAt || "待确认" },
    { label: "费用状态", value: feeStatus(program) }
  ];
  if (program.officialIntakeNote) {
    rows.push({ label: "开学备注", value: normalizeAcademicText(program.officialIntakeNote), full: true });
  }
  if (program.auditNote || program.publicDisplayNote || program.reviewReason) {
    rows.push({
      label: "资料备注",
      value: program.auditNote || program.publicDisplayNote || program.reviewReason,
      full: true
    });
  }
  return rows;
}

function programSourceLinks(program: ProgramCatalogDetail): SourceLinkView[] {
  const items: SourceLinkView[] = [];
  pushLink(items, "官方链接", program.officialSourceUrl);
  pushLink(items, "官方学费来源", program.officialFeeSourceUrl);
  pushLink(items, "入学要求来源", program.officialEntryRequirementSourceUrl);
  pushLink(items, "官方认证来源", program.officialAccreditationSourceUrl);
  for (const item of program.sourceUrls || []) pushLink(items, sourceLabel(item), item.url);
  return items;
}

function normalizeAcademicText(value: string) {
  return value
    .replace(/Not offered for the Academic Session 2026\/2027/gi, "2026/2027 学年不开放")
    .replace(/Not offered/gi, "暂不开放")
    .replace(/Semester 1 \(October\) Intake/gi, "第一学期（10月）")
    .replace(/Semester 2 \(March\) Intake/gi, "第二学期（3月）")
    .replace(/October Intake/gi, "10月")
    .replace(/March Intake/gi, "3月")
    .replace(/October/gi, "10月")
    .replace(/March/gi, "3月")
    .replace(/Rolling/gi, "滚动开放")
    .replace(/Years?/gi, "年")
    .replace(/Semesters?/gi, "个学期")
    .replace(/Full time/gi, "全日制")
    .replace(/Coursework/gi, "授课型")
    .replace(/\band\b/gi, "及");
}

function sourceStatus(status: string) {
  if (status === "official-verified") return "官方来源已核验";
  if (status.includes("not-available")) return "官方页已核验但暂不开放";
  if (status.includes("missing")) return "缺少官方来源";
  if (status.includes("conflict")) return "来源需复核";
  return "待复核";
}

function profileString(key: string) {
  return stringFrom(profile.value?.[key]);
}

function profileScaleValue(label: string) {
  return scaleRows.value.find((item) => item.label.includes(label))?.value || "";
}

function countPrograms(level: DegreeLevel) {
  return String((detail.value?.programs || []).filter((program) => program.level === level).length);
}

function auditCount(section: string, key: string, fallback: string | number) {
  const value = asRecord(profile.value?.[section])?.[key];
  return stringFrom(value) || String(fallback);
}

function auditReviewCount() {
  const audit = asRecord(profile.value?.undergraduateAudit);
  const needsReview = numberFrom(audit?.needsReview);
  const unavailable = numberFrom(audit?.notAvailableForInternational);
  if (needsReview || unavailable) return String(needsReview + unavailable);
  return "0";
}

function sourceLabel(item: OfficialSourceLink) {
  if (item.sourceType === "official-website") return "官网";
  if (item.sourceType === "study-portal") return "Study Portal";
  if (item.sourceType === "admission") return "申请入口";
  if (item.sourceType === "fee") return "费用来源";
  return item.title || "官方链接";
}

function formatRow(item: LabelValue) {
  return item.label ? `${item.label}：${item.value}` : item.value;
}

function normalizeRows(value: unknown): LabelValue[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return { label: "", value: item };
    const record = asRecord(item);
    if (!record) return { label: "", value: "" };
    return {
      label: stringFrom(record.label || record.title || record.name),
      value: stringFrom(record.value || record.text || record.description || record.url)
    };
  }).filter((item) => item.label || item.value);
}

function normalizeContactRows(value: unknown): LabelLink[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    if (!record) return null;
    const valueText = stringFrom(record.value || record.text || record.url || record.href);
    const href = stringFrom(record.href || record.url) || (valueText.includes("@") ? `mailto:${valueText}` : valueText);
    return {
      label: stringFrom(record.label || record.title || record.name) || "联系信息",
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
      return match ? { label: item.replace(/:\s*https?:\/\/\S+$/, "") || "官方链接", url: match[0] } : null;
    }
    const record = asRecord(item);
    if (!record) return null;
    const url = stringFrom(record.url || record.href);
    if (!url) return null;
    return { label: stringFrom(record.label || record.title || record.name) || "官方链接", url };
  }).filter((item): item is SourceLinkView => Boolean(item));
}

function normalizeList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      const record = asRecord(item);
      if (!record) return "";
      const row = normalizeRows([record])[0];
      return row ? formatRow(row) : "";
    }).filter(Boolean);
  }
  if (typeof value === "string") return value ? [value] : [];
  return [];
}

function pushLink(items: SourceLinkView[], label: string, url?: string | null) {
  if (!url || items.some((item) => item.url === url)) return;
  items.push({ label, url });
}

function stringFrom(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  return "";
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
  catalog.closeProgramDetail();
  void loadDetail();
});
</script>
