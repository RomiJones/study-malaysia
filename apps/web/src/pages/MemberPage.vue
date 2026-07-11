<template>
  <section v-if="dashboard" class="member-page grid gap-6">
    <div class="section-card rounded-[32px] p-6 md:p-8">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">我的</div>
          <h1 class="section-title mt-2">{{ t('member.title') }}</h1>
        </div>
        <button class="secondary-action" @click="logout">{{ t('common.logout') }}</button>
      </div>
      <div class="feature-grid mt-6">
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.account') }}</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ session.user?.displayName }}</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{{ t('common.readiness') }}</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ dashboard.summary.readinessScore }}/100</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">申请档案</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ dashboard.summary.profileCompleteness }}%</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">正式申请</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ applicationStore.items.length }}</div>
        </div>
        <div class="stat-card rounded-[24px] p-5">
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">我的待办</div>
          <div class="mt-3 text-2xl font-black text-slate-900">{{ todoItems.length }}</div>
        </div>
      </div>
    </div>

    <div class="program-grid">
      <RouterLink class="data-card rounded-[24px] p-6 card-hover" to="/planner">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('nav.planner') }}</div>
        <h2 class="mt-2 text-2xl font-black text-slate-900">{{ t('member.continuePlanner') }}</h2>
        <p class="muted mt-3 text-sm">{{ t('member.continuePlannerDesc') }}</p>
      </RouterLink>
      <RouterLink class="data-card rounded-[24px] p-6 card-hover" to="/member/profile/edit">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">申请档案</div>
        <h2 class="mt-2 text-2xl font-black text-slate-900">完善申请资料</h2>
        <p class="muted mt-3 text-sm">补充申请目标、学术背景、语言预算和服务需求。</p>
      </RouterLink>
      <RouterLink class="data-card rounded-[24px] p-6 card-hover" to="/favorites">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('nav.favorites') }}</div>
        <h2 class="mt-2 text-2xl font-black text-slate-900">{{ t('member.viewFavorites') }}</h2>
        <p class="muted mt-3 text-sm">{{ t('member.viewFavoritesDesc') }}</p>
      </RouterLink>
      <RouterLink class="data-card rounded-[24px] p-6 card-hover" to="/compare">
        <div class="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{{ t('nav.compare') }}</div>
        <h2 class="mt-2 text-2xl font-black text-slate-900">{{ t('member.backCompare') }}</h2>
        <p class="muted mt-3 text-sm">{{ t('member.backCompareDesc') }}</p>
      </RouterLink>
    </div>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="member-section-head">
        <div>
          <div class="section-kicker">待办</div>
          <h2 class="section-title">我的下一步</h2>
          <p class="section-copy mt-1">系统会根据材料审核、补件和申请阶段自动生成待办。</p>
        </div>
        <span class="member-status-pill member-status-pill--soft">待处理 {{ actionableTodoCount }}</span>
      </div>

      <div v-if="todoItems.length" class="member-todo-list">
        <RouterLink v-for="todo in todoItems" :key="todo.application.id + todo.id" class="member-todo-row" :to="`/member/applications/${todo.application.id}`">
          <div>
            <span class="member-status-pill" :class="priorityClass(todo.priority)">{{ priorityLabel(todo.priority) }}</span>
            <strong>{{ todo.title }}</strong>
            <small>{{ todo.application.universityName }} · {{ todo.application.programName }} · {{ todo.description }}</small>
          </div>
          <span>{{ todo.actionLabel || (todo.status === 'waiting' ? '等待处理' : '查看详情') }}</span>
        </RouterLink>
      </div>
      <div v-else class="member-empty-state">
        <strong>暂无待办</strong>
        <span>当前没有需要你立刻处理的申请事项。</span>
      </div>
    </section>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="member-section-head">
        <div>
          <div class="section-kicker">材料库</div>
          <h2 class="section-title">我的材料库</h2>
          <p class="section-copy mt-1">常用材料只需上传一次，可关联到多个申请案件。</p>
        </div>
        <span class="member-status-pill member-status-pill--soft">已上传 {{ applicationStore.materialLibraryItems.length }}</span>
      </div>

      <div class="member-library-upload">
        <label class="field-shell">
          <span>材料类型</span>
          <select v-model="libraryForm.materialType">
            <option v-for="item in materialTypeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-shell">
          <span>材料名称</span>
          <input v-model.trim="libraryForm.title" placeholder="默认使用材料类型名称" />
        </label>
        <label class="member-file-picker member-library-file">
          <input type="file" :accept="acceptedMaterialFileTypes" @change="selectLibraryFile" />
          <span>{{ libraryForm.file?.name || '选择文件' }}</span>
        </label>
        <button class="btn btn-gold" type="button" :disabled="uploadingLibrary || !libraryForm.file" @click="uploadLibraryMaterial">
          {{ uploadingLibrary ? '上传中' : '上传到材料库' }}
        </button>
        <small class="member-upload-hint">支持 PDF、JPG、PNG、WebP，单文件不超过 20MB；多页材料请合并为 PDF</small>
      </div>

      <div v-if="applicationStore.materialLibraryItems.length" class="member-library-list">
        <article v-for="item in applicationStore.materialLibraryItems" :key="item.id" class="member-library-card">
          <div>
            <strong>{{ item.title }}</strong>
            <span>{{ item.fileName }} · 第 {{ item.version }} 版 · {{ formatFileSize(item.size) }}</span>
          </div>
          <span class="member-status-pill member-status-pill--soft">{{ materialTypeLabel(item.materialType) }}</span>
        </article>
      </div>
      <div v-else class="member-empty-state">
        <strong>材料库暂无文件</strong>
        <span>先上传护照、成绩单、语言成绩等常用材料，后续可直接关联到申请案件。</span>
      </div>
    </section>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="member-section-head">
        <div>
          <div class="section-kicker">正式申请</div>
          <h2 class="section-title">我的申请案件</h2>
          <p class="section-copy mt-1">确认目标院校和专业后提交案件，后台老师会看到你的需求、材料和进度。</p>
        </div>
        <RouterLink class="btn btn-outline" to="/planner?tab=applications">查看规划任务</RouterLink>
      </div>

      <div class="member-application-form">
        <div class="field-shell member-picker-field" @click.stop>
          <span>申请院校</span>
          <button class="member-picker-trigger" type="button" :class="{ selected: applicationForm.universityId }" @click="togglePicker('university')">
            <span>{{ selectedUniversityLabel || '请选择院校' }}</span>
          </button>
          <div v-if="openPicker === 'university'" class="member-picker-panel">
            <input v-model.trim="universityQuery" class="member-picker-search" placeholder="搜索院校名称" @keydown.esc="closePicker" />
            <div class="member-picker-options">
              <button v-for="item in filteredUniversitiesForPicker" :key="item.id" type="button" :class="{ active: item.id === applicationForm.universityId }" @click="selectUniversity(item.id)">
                <strong>{{ item.shortName || text(item.name) }}</strong>
                <small>{{ text(item.location) || item.ownership || 'StudyMY 院校库' }}</small>
              </button>
              <div v-if="!filteredUniversitiesForPicker.length" class="member-picker-empty">没有匹配的院校</div>
            </div>
          </div>
        </div>
        <div class="field-shell member-picker-field" @click.stop>
          <span>申请专业</span>
          <button class="member-picker-trigger" type="button" :class="{ selected: applicationForm.programId }" @click="togglePicker('program')">
            <span>{{ selectedProgramLabel || '请选择专业' }}</span>
          </button>
          <div v-if="openPicker === 'program'" class="member-picker-panel member-picker-panel--wide">
            <input v-model.trim="programQuery" class="member-picker-search" placeholder="搜索专业名称" @keydown.esc="closePicker" />
            <div class="member-picker-options">
              <button v-for="item in filteredProgramsForPicker" :key="item.id" type="button" :class="{ active: item.id === applicationForm.programId }" @click="selectProgram(item.id, item.universityId)">
                <strong>{{ text(item.name) }}</strong>
                <small>{{ universityName(item.universityId) }} · {{ levelLabel(item.level) }}</small>
              </button>
              <div v-if="!filteredProgramsForPicker.length" class="member-picker-empty">没有匹配的专业</div>
            </div>
          </div>
        </div>
        <label class="field-shell">
          <span>入学批次</span>
          <input v-model.trim="applicationForm.intake" placeholder="例如 2026-09 / 待确认" />
        </label>
        <label class="field-shell">
          <span>联系电话</span>
          <input v-model.trim="applicationForm.studentPhone" placeholder="用于申请跟进" />
        </label>
        <div class="member-profile-submit-summary member-application-form__full">
          <div class="member-profile-submit-summary__head">
            <div>
              <span>提交前档案检查</span>
              <strong>申请档案完成度 {{ submitProfileSummary.completion }}%</strong>
            </div>
            <RouterLink class="btn btn-outline btn-sm" to="/member/profile/edit">完善档案</RouterLink>
          </div>
          <div class="member-profile-submit-summary__grid">
            <div><span>目标</span><strong>{{ submitProfileSummary.targetText }}</strong></div>
            <div><span>学术</span><strong>{{ submitProfileSummary.academicText }}</strong></div>
            <div><span>语言</span><strong>{{ submitProfileSummary.languageText }}</strong></div>
            <div><span>预算</span><strong>{{ submitProfileSummary.budgetText }}</strong></div>
            <div><span>偏好</span><strong>{{ submitProfileSummary.preferenceText }}</strong></div>
            <div><span>服务</span><strong>{{ submitProfileSummary.serviceText }}</strong></div>
            <div><span>联系方式</span><strong>{{ submitProfileSummary.contactText }}</strong></div>
          </div>
          <div class="member-profile-submit-summary__missing" :class="{ ok: !submitProfileSummary.missingLabels.length }">
            {{ submitProfileSummary.missingLabels.length ? `建议补充：${submitProfileSummary.missingLabels.join('、')}` : '关键申请档案已完整，可直接提交。' }}
          </div>
        </div>
        <label class="field-shell member-application-form__wide">
          <span>申请备注</span>
          <textarea v-model.trim="applicationForm.notes" rows="3" placeholder="可填写预算、目标入学时间、语言成绩、材料准备情况等"></textarea>
        </label>
        <button class="btn btn-gold member-submit-button" type="button" :disabled="applicationStore.loading || !canSubmitApplication" @click="submitApplication">
          提交申请案件
        </button>
      </div>

      <div v-if="actionMessage" class="member-inline-message">{{ actionMessage }}</div>
      <div v-if="applicationStore.errorMessage" class="member-inline-message member-inline-message--error">{{ applicationStore.errorMessage }}</div>

      <div v-if="applicationStore.items.length" class="member-application-list">
        <article v-for="application in applicationStore.items" :key="application.id" class="member-application-card">
          <div class="member-application-card__top">
            <div>
              <div class="member-status-row">
                <span class="member-status-pill">{{ statusLabel(application.applicationStatus) }}</span>
                <span class="member-status-pill member-status-pill--soft">{{ materialStatusLabel(application.materialStatus) }}</span>
                <span v-if="application.assignedAdminName" class="member-status-pill member-status-pill--soft">负责人：{{ application.assignedAdminName }}</span>
              </div>
              <h3>{{ application.programName }}</h3>
              <p>{{ application.universityName }} · {{ application.intake || '入学批次待确认' }} · {{ application.applicationNo }}</p>
            </div>
            <div class="member-application-actions">
              <RouterLink class="btn btn-outline btn-sm" :to="`/member/applications/${application.id}`">查看详情</RouterLink>
              <div class="member-progress-box">
                <strong>{{ application.materialSummary.approved }}/{{ application.materialSummary.total }}</strong>
                <span>材料通过</span>
              </div>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: materialProgress(application) }"></div>
          </div>

          <div class="member-material-list">
            <section v-for="group in groupedApplicationMaterials(application)" :key="`${application.id}-${group.label}`" class="member-material-group">
              <div class="member-material-group__head">
                <strong>{{ group.label }}</strong>
                <span>{{ group.uploaded }}/{{ group.total }} 已上传</span>
              </div>
              <div v-for="material in group.items" :key="material.key" class="member-material-row">
                <div class="member-material-row__body">
                  <div class="member-material-meta">
                    <span>{{ material.requirementLevelLabel || requirementLevelLabel(material.requirementLevel) }}</span>
                    <span>{{ material.sourceLabel || materialSourceLabel(material.source) }}</span>
                    <span v-if="material.isWaived">已豁免</span>
                  </div>
                  <strong>{{ material.title }}</strong>
                  <span>{{ material.fileName || material.note || '请按要求上传对应材料' }}</span>
                  <div v-if="material.uploadTips?.length" class="member-material-tips">
                    <small v-for="tip in material.uploadTips" :key="tip">{{ tip }}</small>
                  </div>
                  <small v-if="!material.isWaived" class="member-upload-hint">支持 PDF、JPG、PNG、WebP，最大 20MB；多页材料请合并为 PDF</small>
                  <small v-if="material.isWaived" class="member-material-waived-note">已豁免：{{ material.waiverReason || '该材料当前不需要提交' }}</small>
                  <small v-if="material.linkedFromLibrary" class="member-material-library-note">已关联材料库：{{ material.libraryTitle || '材料库文件' }} 第 {{ material.libraryVersion || 1 }} 版</small>
                  <small v-if="material.reviewNote">{{ material.reviewNote }}</small>
                </div>
                <span class="member-status-pill" :class="material.isWaived ? 'member-status-pill--soft' : reviewStatusClass(material.reviewStatus)">{{ material.isWaived ? '已豁免' : reviewStatusLabel(material.reviewStatus) }}</span>
                <div v-if="!material.isWaived" class="member-file-actions">
                  <select v-model.number="selectedLibraryMaterialIds[fileSlot(application.id, material.key)]" class="member-library-select">
                    <option :value="0">从材料库选择</option>
                    <option v-for="item in matchingLibraryMaterials(material)" :key="item.id" :value="item.id">{{ item.title }} 第 {{ item.version }} 版</option>
                  </select>
                  <button class="btn btn-outline btn-sm" type="button" :disabled="!selectedLibraryMaterialIds[fileSlot(application.id, material.key)]" @click="linkMaterialFromLibrary(application.id, material.key)">
                    关联
                  </button>
                  <label class="member-file-picker">
                    <input type="file" :accept="acceptedMaterialFileTypes" @change="selectMaterialFile(application.id, material.key, $event)" />
                    <span>选择文件</span>
                  </label>
                  <button class="btn btn-outline btn-sm" type="button" :disabled="uploadingKey === fileSlot(application.id, material.key) || !selectedFiles[fileSlot(application.id, material.key)]" @click="uploadMaterial(application.id, material.key)">
                    {{ uploadingKey === fileSlot(application.id, material.key) ? '上传中' : '上传' }}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </article>
      </div>

      <div v-else class="member-empty-state">
        <strong>还没有正式申请案件</strong>
        <span>先在择校和规划中确认目标，再在这里提交给后台老师处理。</span>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useApplicationsStore, type StudentApplicationItem } from "../stores/applications";
import { useCatalogStore } from "../stores/catalog";
import { usePlannerStore } from "../stores/planner";
import { useSessionStore } from "../stores/session";

const planner = usePlannerStore();
const catalog = useCatalogStore();
const applicationStore = useApplicationsStore();
const session = useSessionStore();
const router = useRouter();
const { t } = useI18n();
const dashboard = computed(() => planner.dashboard);
const actionMessage = ref("");
const uploadingKey = ref("");
const uploadingLibrary = ref(false);
const openPicker = ref<"university" | "program" | "">("");
const universityQuery = ref("");
const programQuery = ref("");
const selectedFiles = reactive<Record<string, File | null>>({});
const selectedLibraryMaterialIds = reactive<Record<string, number>>({});
const applicationForm = reactive({
  universityId: 0,
  programId: 0,
  intake: "",
  studentPhone: "",
  notes: ""
});
const libraryForm = reactive({
  materialType: "passport",
  title: "",
  file: null as File | null
});
const materialTypeOptions = [
  { value: "passport-full-scan", label: "整本护照扫描件" },
  { value: "id-photo-white-background", label: "白底证件照片" },
  { value: "high-school-notarized-docs", label: "高中毕业证与成绩单公证书" },
  { value: "bachelor-notarized-docs", label: "本科毕业证与成绩单公证书" },
  { value: "college-upgrade-notarized-docs", label: "专升本大专材料" },
  { value: "overseas-credential-verification", label: "中留服验证及公证" },
  { value: "bachelor-master-notarized-docs", label: "本科及硕士公证材料" },
  { value: "cv-work-proof", label: "个人简历与工作证明" },
  { value: "language-score", label: "英文成绩证明" },
  { value: "passport", label: "护照首页" },
  { value: "transcript", label: "成绩单" },
  { value: "language", label: "语言成绩" },
  { value: "graduation", label: "毕业证/在读证明" },
  { value: "degree", label: "学位证" },
  { value: "recommendation", label: "推荐信" },
  { value: "statement", label: "个人陈述" },
  { value: "cv", label: "英文简历" },
  { value: "research-proposal", label: "研究计划" },
  { value: "scholarship", label: "奖学金材料" },
  { value: "visa", label: "签证材料" }
];
const acceptedMaterialFileTypes = ".pdf,image/jpeg,image/png,image/webp";
const maxMaterialUploadBytes = 20 * 1024 * 1024;
const allowedMaterialUploadTypes: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};

const availablePrograms = computed(() => catalog.programs.filter((item) => !applicationForm.universityId || item.universityId === applicationForm.universityId));
const selectedUniversityLabel = computed(() => {
  const selected = catalog.universities.find((item) => item.id === applicationForm.universityId);
  return selected ? selected.shortName || text(selected.name) : "";
});
const selectedProgramLabel = computed(() => {
  const selected = catalog.programs.find((item) => item.id === applicationForm.programId);
  return selected ? text(selected.name) : "";
});
const filteredUniversitiesForPicker = computed(() => {
  const query = universityQuery.value.toLowerCase();
  return catalog.universities.filter((item) => {
    const source = `${item.shortName || ""} ${text(item.name)} ${text(item.location)}`.toLowerCase();
    return !query || source.includes(query);
  });
});
const filteredProgramsForPicker = computed(() => {
  const query = programQuery.value.toLowerCase();
  return availablePrograms.value.filter((item) => {
    const source = `${text(item.name)} ${universityName(item.universityId)} ${item.level || ""}`.toLowerCase();
    return !query || source.includes(query);
  });
});
const canSubmitApplication = computed(() => Boolean(applicationForm.universityId && applicationForm.programId));
const submitProfileSummary = computed(() => buildSubmitProfileSummary(dashboard.value?.profile, applicationForm.studentPhone));
const todoItems = computed(() =>
  applicationStore.items.flatMap((application) =>
    (application.todos || []).map((todo) => ({
      ...todo,
      application
    }))
  )
);
const actionableTodoCount = computed(() => todoItems.value.filter((todo) => todo.status === "todo").length);

watch(() => applicationForm.universityId, () => {
  if (!availablePrograms.value.some((item) => item.id === applicationForm.programId)) {
    applicationForm.programId = 0;
  }
});

onMounted(async () => {
  if (!session.isLoggedIn) {
    session.openAuth('login');
    router.push('/');
    return;
  }
  await Promise.all([
    dashboard.value ? Promise.resolve() : planner.load(),
    catalog.universities.length ? Promise.resolve() : catalog.loadUniversities(),
    applicationStore.load(),
    applicationStore.loadMaterialLibrary()
  ]);
  prefillFromPlanner();
  document.addEventListener("click", closePicker);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", closePicker);
});

async function submitApplication() {
  if (!canSubmitApplication.value) return;
  actionMessage.value = "";
  const profileSummary = submitProfileSummary.value;
  if (profileSummary.missingLabels.length) {
    const confirmed = window.confirm(`当前申请档案完成度 ${profileSummary.completion}%，建议补充：${profileSummary.missingLabels.join("、")}。是否仍然继续提交申请案件？`);
    if (!confirmed) return;
  }
  try {
    const application = await applicationStore.submit({
      universityId: applicationForm.universityId,
      programId: applicationForm.programId,
      intake: applicationForm.intake,
      studentPhone: applicationForm.studentPhone,
      notes: applicationForm.notes
    });
    actionMessage.value = `已提交申请案件 ${application.applicationNo}，后台老师可在申请列表查看。`;
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : "提交申请失败";
  }
}

function selectMaterialFile(applicationId: number, key: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (!validateSelectedUploadFile(file)) {
    selectedFiles[fileSlot(applicationId, key)] = null;
    input.value = "";
    return;
  }
  selectedFiles[fileSlot(applicationId, key)] = file;
}

function selectLibraryFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (!validateSelectedUploadFile(file)) {
    libraryForm.file = null;
    input.value = "";
    return;
  }
  libraryForm.file = file;
}

async function uploadLibraryMaterial() {
  if (!libraryForm.file) return;
  if (!validateSelectedUploadFile(libraryForm.file)) return;
  uploadingLibrary.value = true;
  actionMessage.value = "";
  try {
    await applicationStore.uploadMaterialLibrary({
      materialType: libraryForm.materialType,
      title: libraryForm.title,
      file: libraryForm.file
    });
    libraryForm.title = "";
    libraryForm.file = null;
    actionMessage.value = "材料已上传到材料库，可关联到申请案件。";
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : "材料库上传失败";
  } finally {
    uploadingLibrary.value = false;
  }
}

async function uploadMaterial(applicationId: number, key: string) {
  const slot = fileSlot(applicationId, key);
  const file = selectedFiles[slot];
  if (!file) return;
  if (!validateSelectedUploadFile(file)) return;
  uploadingKey.value = slot;
  actionMessage.value = "";
  try {
    await applicationStore.uploadMaterial(applicationId, key, file);
    selectedFiles[slot] = null;
    actionMessage.value = "材料已上传，等待后台老师审核。";
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : "材料上传失败";
  } finally {
    uploadingKey.value = "";
  }
}

async function linkMaterialFromLibrary(applicationId: number, key: string) {
  const slot = fileSlot(applicationId, key);
  const libraryMaterialId = selectedLibraryMaterialIds[slot];
  if (!libraryMaterialId) return;
  actionMessage.value = "";
  try {
    await applicationStore.linkMaterialFromLibrary(applicationId, key, libraryMaterialId);
    selectedLibraryMaterialIds[slot] = 0;
    actionMessage.value = "已从材料库关联材料，等待后台老师审核。";
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : "材料库关联失败";
  }
}

function prefillFromPlanner() {
  const task = dashboard.value?.tasks?.[0];
  if (!task) return;
  applicationForm.universityId = task.universityId;
  applicationForm.programId = task.programId;
}

function togglePicker(type: "university" | "program") {
  openPicker.value = openPicker.value === type ? "" : type;
}

function closePicker() {
  openPicker.value = "";
}

function selectUniversity(id: number) {
  applicationForm.universityId = id;
  applicationForm.programId = 0;
  programQuery.value = "";
  closePicker();
}

function selectProgram(id: number, universityId: number) {
  if (!applicationForm.universityId) applicationForm.universityId = universityId;
  applicationForm.programId = id;
  closePicker();
}

function fileSlot(applicationId: number, key: string) {
  return `${applicationId}:${key}`;
}

function materialProgress(application: StudentApplicationItem) {
  const total = application.materialSummary.total || 1;
  return `${Math.round((application.materialSummary.approved / total) * 100)}%`;
}

function matchingLibraryMaterials(material: StudentApplicationItem["materials"][number]) {
  const category = material.category || material.key;
  const aliases = materialLibraryAliases(category);
  return applicationStore.materialLibraryItems.filter((item) => aliases.includes(item.materialType) || item.materialType === category || material.key.includes(item.materialType) || category.includes(item.materialType));
}

function groupedApplicationMaterials(application: StudentApplicationItem) {
  return groupMaterials(application.materials || []);
}

function groupMaterials(materials: StudentApplicationItem["materials"]) {
  const groups: Array<{ key: string; label: string; total: number; uploaded: number; items: StudentApplicationItem["materials"] }> = [];
  for (const material of materials) {
    const key = material.group || materialGroupForCategory(material.category || material.key);
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label: material.groupLabel || materialGroupLabel(key), total: 0, uploaded: 0, items: [] };
      groups.push(group);
    }
    group.items.push(material);
    if (!material.isWaived) {
      group.total += 1;
      if (material.hasFile || material.fileName) group.uploaded += 1;
    }
  }
  return groups;
}

function materialLibraryAliases(category: string) {
  const aliases: Record<string, string[]> = {
    "passport-full-scan": ["passport"],
    "id-photo-white-background": ["photo", "id-photo"],
    "language-score": ["language"],
    "cv-work-proof": ["cv", "work-proof"],
    "recommendation": ["recommendation-letter"]
  };
  return [category, ...(aliases[category] || [])];
}

function materialGroupForCategory(category: string) {
  if (/passport|photo|identity/.test(category)) return "identity";
  if (/notarized|credential|transcript|graduation|degree/.test(category)) return "academic";
  if (/cv|work|recommendation|proposal|statement|supervisor|research/.test(category)) return "documents";
  if (/language/.test(category)) return "language";
  if (/scholarship|visa/.test(category)) return "service";
  return "additional";
}

function materialGroupLabel(group: string) {
  const labels: Record<string, string> = {
    identity: "身份与照片",
    academic: "学历与成绩公证",
    documents: "文书与经历",
    language: "英文成绩",
    service: "服务补充",
    additional: "其他材料"
  };
  return labels[group] || labels.additional;
}

function validateSelectedUploadFile(file: File | null) {
  if (!file) return true;
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop()?.toLowerCase()}` : "";
  const acceptedExtensions = allowedMaterialUploadTypes[file.type];
  if (!acceptedExtensions || !acceptedExtensions.includes(extension)) {
    actionMessage.value = "仅支持上传 PDF、JPG、PNG 或 WebP 文件。";
    return false;
  }
  if (file.size > maxMaterialUploadBytes) {
    actionMessage.value = "单个文件不能超过 20MB。";
    return false;
  }
  return true;
}

function buildSubmitProfileSummary(profile: Record<string, any> | undefined, fallbackPhone: string) {
  const contactInfo = profile?.contactInfo || {};
  const academicBackground = profile?.academicBackground || {};
  const languageProfile = profile?.languageProfile || {};
  const studyPreferences = profile?.studyPreferences || {};
  const serviceNeeds = profile?.serviceNeeds || {};
  const contactPhone = fallbackPhone || contactInfo.phone || contactInfo.wechat || contactInfo.whatsapp || "";
  const checks = [
    { key: "level", label: "目标学历", ok: hasProfileValue(profile?.level) },
    { key: "targetCategory", label: "目标专业方向", ok: hasProfileValue(profile?.targetCategory) },
    { key: "budget", label: "预算范围", ok: Number(profile?.budgetCny || 0) > 0 },
    { key: "academicScore", label: "GPA/均分", ok: Number(profile?.gpa || 0) > 0 || hasProfileValue(academicBackground.averageScore) },
    { key: "language", label: "语言成绩或考试计划", ok: hasProfileValue(languageProfile.overallScore) || hasProfileValue(languageProfile.testDate) || hasProfileValue(languageProfile.plannedTestDate) },
    { key: "currentEducation", label: "当前学历", ok: hasProfileValue(academicBackground.currentEducation) },
    { key: "schoolName", label: "毕业/就读院校", ok: hasProfileValue(academicBackground.schoolName) },
    { key: "majorName", label: "所学专业", ok: hasProfileValue(academicBackground.majorName) },
    { key: "intake", label: "计划入学时间", ok: hasProfileValue(studyPreferences.intake) },
    { key: "preferredCities", label: "城市偏好", ok: Array.isArray(studyPreferences.preferredCities) && studyPreferences.preferredCities.length > 0 },
    { key: "serviceNeeds", label: "服务需求", ok: Array.isArray(serviceNeeds.needs) && serviceNeeds.needs.length > 0 || hasProfileValue(serviceNeeds.notes) },
    { key: "contact", label: "联系方式", ok: hasProfileValue(contactPhone) }
  ];
  const missingLabels = checks.filter((item) => !item.ok).map((item) => item.label);
  return {
    completion: Math.round(((checks.length - missingLabels.length) / checks.length) * 100),
    missingLabels,
    targetText: `${levelLabel(profile?.level || "")} / ${categoryLabel(profile?.targetCategory || "")}`,
    academicText: [academicBackground.schoolName, academicBackground.majorName, academicBackground.averageScore || (profile?.gpa ? `GPA ${profile.gpa}` : "")].filter(Boolean).join(" · ") || "待补充",
    languageText: languageProfile.overallScore || (languageProfile.plannedTestDate ? `计划 ${languageProfile.plannedTestDate}` : "待补充"),
    budgetText: formatBudget(profile?.budgetCny),
    preferenceText: Array.isArray(studyPreferences.preferredCities) && studyPreferences.preferredCities.length ? studyPreferences.preferredCities.join("、") : "待补充",
    serviceText: Array.isArray(serviceNeeds.needs) && serviceNeeds.needs.length ? serviceNeeds.needs.join("、") : serviceNeeds.notes || "待补充",
    contactText: contactPhone || "待补充"
  };
}

function hasProfileValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function formatBudget(value: unknown) {
  const budget = Number(value || 0);
  if (!budget) return "待补充";
  return `约 ${Math.round(budget / 10000)} 万人民币/年`;
}

function text(value: Record<string, string> | undefined) {
  return value?.["zh-CN"] || value?.en || value?.["zh-TW"] || value?.ms || "";
}

function universityName(universityId: number) {
  const university = catalog.universities.find((item) => item.id === universityId);
  return university?.shortName || text(university?.name) || "院校待确认";
}

function levelLabel(level: string) {
  const labels: Record<string, string> = { bachelor: "本科", master: "硕士", phd: "博士" };
  return labels[level] || level || "学历待确认";
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = { it: "计算机 / IT", IT: "计算机 / IT", business: "商科", engineering: "工程", science: "理科", arts: "艺术与设计", medicine: "医学健康", law: "法学" };
  return labels[category] || category || "专业方向待确认";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "待整理",
    submitted: "已提交",
    reviewing: "审核中",
    "need-info": "需补件",
    "platform-approved": "平台审核通过",
    "school-submitted": "已递交院校",
    "school-reviewing": "院校审核中",
    offered: "获 Offer",
    offer: "Offer",
    rejected: "拒录",
    visa: "签证",
    done: "完成",
    closed: "已关闭"
  };
  return labels[status] || status;
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = { high: "高优先级", medium: "中优先级", low: "低优先级" };
  return labels[priority] || priority;
}

function priorityClass(priority: string) {
  return {
    "member-status-pill--warning": priority === "high",
    "member-status-pill--soft": priority === "low"
  };
}

function materialStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "材料未开始",
    wait: "待补件",
    progress: "材料处理中",
    done: "材料完成"
  };
  return labels[status] || status;
}

function reviewStatusLabel(status: string) {
  const labels: Record<string, string> = {
    "not-uploaded": "未上传",
    "pending-review": "待审核",
    approved: "已通过",
    "needs-revision": "需补件",
    rejected: "未通过"
  };
  return labels[status] || status;
}

function reviewStatusClass(status: string) {
  return {
    "member-status-pill--success": status === "approved",
    "member-status-pill--warning": status === "needs-revision" || status === "rejected",
    "member-status-pill--soft": status === "not-uploaded" || status === "pending-review"
  };
}

function requirementLevelLabel(level?: string) {
  const labels: Record<string, string> = { required: "必交", recommended: "建议", conditional: "条件触发" };
  return labels[level || "required"] || "必交";
}

function materialSourceLabel(source?: string) {
  const labels: Record<string, string> = { school: "院校要求", degree: "学历规则", language: "语言条件", scholarship: "奖学金需求", visa: "签证服务需求", profile: "申请档案", staff: "后台调整" };
  return labels[source || "school"] || "院校要求";
}

function materialTypeLabel(type: string) {
  return materialTypeOptions.find((item) => item.value === type)?.label || type;
}

function formatFileSize(size?: number) {
  if (!size) return "大小未知";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function logout() {
  session.logout();
  router.push('/');
}
</script>

<style scoped>
.member-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}

.member-application-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  align-items: end;
}

.member-picker-field {
  position: relative;
  z-index: 3;
}

.member-picker-field:focus-within {
  z-index: 12;
}

.member-picker-trigger {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-radius: var(--r-sm);
  background: #fff;
  color: var(--ink-3);
  font-size: 14px;
  line-height: 1.35;
  text-align: left;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.member-picker-trigger::after {
  content: "";
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
}

.member-picker-trigger.selected {
  color: var(--ink);
}

.member-picker-trigger:focus-visible,
.member-picker-trigger:hover {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(200, 168, 75, 0.12);
  outline: none;
}

.member-picker-trigger span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-picker-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  display: grid;
  gap: 10px;
  max-height: 340px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 38px rgba(12, 14, 26, 0.16);
  z-index: 30;
}

.member-picker-panel--wide {
  min-width: min(620px, calc(100vw - 48px));
}

.member-picker-search {
  min-height: 40px;
}

.member-picker-options {
  display: grid;
  gap: 6px;
  max-height: 252px;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-color: rgba(12, 14, 26, 0.24) transparent;
  scrollbar-width: thin;
}

.member-picker-options::-webkit-scrollbar {
  width: 8px;
}

.member-picker-options::-webkit-scrollbar-track {
  background: transparent;
}

.member-picker-options::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(12, 14, 26, 0.22);
}

.member-picker-options button {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink);
  text-align: left;
}

.member-picker-options button:hover,
.member-picker-options button.active {
  border-color: rgba(27, 122, 114, 0.24);
  background: var(--teal-lt);
}

.member-picker-options strong,
.member-picker-options small {
  display: block;
  overflow-wrap: anywhere;
}

.member-picker-options strong {
  font-size: 14px;
  line-height: 1.3;
}

.member-picker-options small {
  color: var(--ink-3);
  font-size: 12px;
}

.member-picker-empty {
  padding: 18px;
  border: 1px dashed var(--border);
  border-radius: 12px;
  background: var(--paper);
  color: var(--ink-3);
  font-size: 13px;
  text-align: center;
}

.member-application-form__wide {
  grid-column: span 3;
}

.member-application-form__full {
  grid-column: 1 / -1;
}

.member-profile-submit-summary {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(27, 122, 114, 0.2);
  border-radius: 18px;
  background: var(--teal-lt);
}

.member-profile-submit-summary__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.member-profile-submit-summary__head span,
.member-profile-submit-summary__grid span {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.member-profile-submit-summary__head strong {
  display: block;
  margin-top: 4px;
  color: var(--ink);
  font-size: 18px;
  line-height: 1.3;
}

.member-profile-submit-summary__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.member-profile-submit-summary__grid div {
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(27, 122, 114, 0.14);
  border-radius: 14px;
  background: #fff;
}

.member-profile-submit-summary__grid strong {
  display: block;
  margin-top: 4px;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.member-profile-submit-summary__missing {
  color: var(--red);
  font-size: 13px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.member-profile-submit-summary__missing.ok {
  color: var(--teal);
}

.member-submit-button {
  min-height: 52px;
}

.member-inline-message {
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(27, 122, 114, 0.22);
  border-radius: 14px;
  background: var(--teal-lt);
  color: var(--teal);
  font-weight: 700;
}

.member-inline-message--error {
  border-color: rgba(196, 56, 48, 0.22);
  background: var(--red-lt);
  color: var(--red);
}

.member-library-upload {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) minmax(180px, 1fr) minmax(180px, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.member-library-file {
  min-height: 52px;
  border-radius: var(--r-sm);
}

.member-library-upload > .member-upload-hint {
  grid-column: 1 / -1;
}

.member-library-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.member-library-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--shadow);
}

.member-library-card div {
  min-width: 0;
}

.member-library-card strong,
.member-library-card span {
  display: block;
  overflow-wrap: anywhere;
}

.member-library-card > div > span {
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 13px;
}

.member-application-list {
  display: grid;
  gap: 18px;
  margin-top: 22px;
}

.member-todo-list {
  display: grid;
  gap: 10px;
}

.member-todo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
  color: inherit;
  text-decoration: none;
  box-shadow: var(--shadow);
}

.member-todo-row > div {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.member-todo-row strong,
.member-todo-row small {
  display: block;
  overflow-wrap: anywhere;
}

.member-todo-row small {
  color: var(--ink-3);
}

.member-todo-row > span:last-child {
  color: var(--teal);
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.member-application-card {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #fff;
  box-shadow: var(--shadow);
}

.member-application-card__top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.member-application-card h3 {
  margin-top: 10px;
  color: var(--ink);
  font-size: 22px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.member-application-card p {
  margin-top: 6px;
  color: var(--ink-2);
}

.member-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.member-status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--blue-lt);
  color: var(--blue);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.member-status-pill--soft {
  background: var(--paper-2);
  color: var(--ink-2);
}

.member-status-pill--success {
  background: var(--teal-lt);
  color: var(--teal);
}

.member-status-pill--warning {
  background: var(--red-lt);
  color: var(--red);
}

.member-progress-box {
  min-width: 108px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  text-align: center;
  background: var(--paper);
}

.member-application-actions {
  display: grid;
  gap: 10px;
  justify-items: end;
}

.member-progress-box strong {
  display: block;
  font-size: 24px;
  line-height: 1.1;
}

.member-progress-box span {
  display: block;
  margin-top: 4px;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.member-material-list {
  display: grid;
  gap: 10px;
}

.member-material-group {
  display: grid;
  gap: 10px;
}

.member-material-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 2px 0;
}

.member-material-group__head strong {
  color: var(--ink);
  font-size: 14px;
  line-height: 1.3;
}

.member-material-group__head span {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.member-material-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--paper);
}

.member-material-row__body {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.member-material-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.member-material-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fff;
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 800;
}

.member-material-row__body strong,
.member-material-row__body span,
.member-material-row__body small {
  overflow-wrap: anywhere;
}

.member-material-row__body span,
.member-material-row__body small {
  color: var(--ink-3);
  font-size: 13px;
}

.member-material-row__body small {
  color: var(--red);
}

.member-material-tips {
  display: grid;
  gap: 2px;
  margin-top: 2px;
}

.member-material-tips small {
  color: var(--ink-3) !important;
}

.member-material-tips small::before {
  content: "· ";
}

.member-upload-hint {
  color: var(--ink-3) !important;
  font-size: 12px !important;
  font-weight: 700;
}

.member-material-library-note {
  color: var(--teal) !important;
}

.member-material-waived-note {
  color: var(--teal) !important;
}

.member-file-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-library-select {
  width: 160px;
  min-height: 36px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 800;
}

.member-file-picker {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.member-file-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.member-empty-state {
  display: grid;
  gap: 6px;
  margin-top: 22px;
  padding: 22px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  background: var(--paper);
  color: var(--ink-3);
}

.member-empty-state strong {
  color: var(--ink);
}

@media (max-width: 980px) {
  .member-section-head,
  .member-application-card__top {
    flex-direction: column;
  }

  .member-application-actions {
    justify-items: stretch;
  }

  .member-application-form {
    grid-template-columns: 1fr;
  }

  .member-library-upload,
  .member-library-list {
    grid-template-columns: 1fr;
  }

  .member-picker-panel,
  .member-picker-panel--wide {
    min-width: 0;
    max-height: 320px;
  }

  .member-picker-options {
    max-height: 234px;
  }

  .member-application-form__wide {
    grid-column: span 1;
  }

  .member-application-form__full {
    grid-column: span 1;
  }

  .member-profile-submit-summary__head {
    flex-direction: column;
  }

  .member-profile-submit-summary__grid {
    grid-template-columns: 1fr;
  }

  .member-material-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .member-todo-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .member-file-actions {
    flex-wrap: wrap;
  }
}
</style>
