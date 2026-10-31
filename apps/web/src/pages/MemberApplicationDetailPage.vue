<template>
  <section v-if="application" class="member-case-page grid gap-6">
    <div class="section-card rounded-[32px] p-6 md:p-8">
      <div class="member-case-head">
        <div>
          <RouterLink class="btn btn-outline btn-sm" to="/member">返回我的</RouterLink>
          <div class="section-kicker mt-5">申请案件详情</div>
          <h1 class="section-title mt-2">{{ application.programName }}</h1>
          <p class="section-copy mt-2">{{ application.universityName }} · {{ application.intake || '入学批次待确认' }} · {{ application.applicationNo }}</p>
        </div>
        <div class="member-case-owner">
          <span>负责人</span>
          <strong>{{ application.assignedAdminName || '待分配' }}</strong>
        </div>
      </div>

      <div class="member-case-status-grid">
        <div class="member-case-stat">
          <span>申请状态</span>
          <strong>{{ application.workflow?.label || statusLabel(application.applicationStatus) }}</strong>
        </div>
        <div class="member-case-stat">
          <span>当前阶段</span>
          <strong>{{ application.workflow?.stageLabel || materialStatusLabel(application.materialStatus) }}</strong>
        </div>
        <div class="member-case-stat">
          <span>材料通过</span>
          <strong>{{ application.materialSummary.approved }}/{{ application.materialSummary.total }}</strong>
        </div>
        <div class="member-case-stat">
          <span>待处理</span>
          <strong>{{ application.materialSummary.pendingReview + application.materialSummary.needRevision }}</strong>
        </div>
      </div>

      <div class="member-next-action">
        <div>
          <span>下一步</span>
          <strong>{{ application.workflow?.nextStudentAction || '等待下一步安排' }}</strong>
        </div>
        <div class="member-workflow-progress">
          <span>{{ application.workflow?.progress || 0 }}%</span>
          <div><i :style="{ width: `${application.workflow?.progress || 0}%` }"></i></div>
        </div>
      </div>
    </div>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="member-case-section-head">
        <div>
          <div class="section-kicker">申请档案</div>
          <h2 class="section-title mt-2">提交时申请档案</h2>
          <p class="section-copy mt-1">后台会按照这份提交时快照处理案件；你后续修改档案不会覆盖本案件原始情况。</p>
        </div>
        <div class="member-profile-status">
          <span>{{ profileSummary.statusLabel }}</span>
          <strong>{{ profileSummary.completion }}%</strong>
        </div>
      </div>
      <div class="member-profile-snapshot-grid">
        <div><span>申请目标</span><strong>{{ levelLabel(profileSnapshot.level) }} / {{ categoryLabel(profileSnapshot.targetCategory) }}</strong></div>
        <div><span>学术背景</span><strong>{{ academicText }}</strong></div>
        <div><span>语言成绩</span><strong>{{ languageText }}</strong></div>
        <div><span>预算范围</span><strong>{{ formatBudget(profileSnapshot.budgetCny) }}</strong></div>
        <div><span>城市/院校偏好</span><strong>{{ preferenceText }}</strong></div>
        <div><span>服务需求</span><strong>{{ serviceText }}</strong></div>
        <div><span>联系方式</span><strong>{{ contactText }}</strong></div>
      </div>
      <div class="member-profile-missing" :class="{ ok: !profileSummary.missingLabels?.length }">
        {{ profileSummary.missingLabels?.length ? `建议补充：${profileSummary.missingLabels.join('、')}` : '当前申请档案关键字段完整。' }}
      </div>
    </section>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="section-kicker">待办</div>
      <h2 class="section-title mt-2">本案件下一步</h2>
      <div v-if="application.todos?.length" class="member-case-todo-list">
        <div v-for="todo in application.todos" :key="todo.id" class="member-case-todo">
          <span class="member-status-pill" :class="priorityClass(todo.priority)">{{ priorityLabel(todo.priority) }}</span>
          <div>
            <strong>{{ todo.title }}</strong>
            <small>{{ todo.description }}</small>
          </div>
          <button v-if="todo.materialKey" class="btn btn-outline btn-sm" type="button" @click="scrollToMaterials">处理材料</button>
        </div>
      </div>
      <div v-else class="member-empty-state">
        <strong>暂无待办</strong>
        <span>当前案件没有需要你立即处理的事项。</span>
      </div>
    </section>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="section-kicker">进度</div>
      <h2 class="section-title mt-2">办理进度时间线</h2>
      <div class="member-case-timeline">
        <div v-for="step in timelineSteps" :key="step.key" class="member-case-step" :class="{ active: step.active, done: step.done }">
          <span></span>
          <div>
            <strong>{{ step.label }}</strong>
            <small>{{ step.note }}</small>
          </div>
        </div>
      </div>
    </section>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="member-case-section-head">
        <div>
          <div class="section-kicker">材料</div>
          <h2 class="section-title mt-2">材料版本与补件</h2>
          <p class="section-copy mt-1">每次重新上传都会保留为新版本，老师审核的是当前最新版本。</p>
        </div>
      </div>

      <div class="member-case-material-list">
        <section v-for="group in materialGroups" :key="group.key" class="member-case-material-group">
          <div class="member-case-material-group__head">
            <div>
              <strong>{{ group.label }}</strong>
              <span>{{ group.uploaded }}/{{ group.total }} 已上传</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: group.total ? `${Math.round((group.uploaded / group.total) * 100)}%` : '100%' }"></div>
            </div>
          </div>

          <article v-for="material in group.items" :key="material.key" class="member-case-material">
            <div class="member-case-material__top">
              <div>
                <div class="member-status-row">
                  <span class="member-status-pill" :class="material.isWaived ? 'member-status-pill--soft' : reviewStatusClass(material.reviewStatus)">{{ material.isWaived ? '已豁免' : reviewStatusLabel(material.reviewStatus) }}</span>
                  <span class="member-status-pill member-status-pill--soft">当前第 {{ material.versions?.length || (material.hasFile ? 1 : 0) }} 版</span>
                  <span class="member-status-pill member-status-pill--soft">{{ material.requirementLevelLabel || requirementLevelLabel(material.requirementLevel) }}</span>
                  <span class="member-status-pill member-status-pill--soft">{{ material.sourceLabel || materialSourceLabel(material.source) }}</span>
                </div>
                <h3>{{ material.title }}</h3>
                <p>{{ material.fileName || material.note || '请按要求上传该材料' }}</p>
                <div v-if="material.uploadTips?.length" class="member-case-material-tips">
                  <small v-for="tip in material.uploadTips" :key="tip">{{ tip }}</small>
                </div>
                <small v-if="!material.isWaived" class="member-upload-hint">支持 PDF、JPG、PNG、WebP，最大 20MB；多页材料请合并为 PDF</small>
                <small v-if="material.reason" class="member-case-material-reason">{{ material.reason }}</small>
                <small v-if="material.isWaived" class="member-case-material-waived-note">已豁免：{{ material.waiverReason || '该材料当前不需要提交' }}</small>
                <small v-if="material.linkedFromLibrary" class="member-case-material-library-note">已关联材料库：{{ material.libraryTitle || '材料库文件' }} 第 {{ material.libraryVersion || 1 }} 版</small>
                <small v-if="material.reviewNote" class="member-case-review-note">{{ material.reviewNote }}</small>
              </div>
              <div v-if="!material.isWaived" class="member-file-actions">
                <select v-model.number="selectedLibraryMaterialIds[material.key]" class="member-library-select">
                  <option :value="0">从材料库选择</option>
                  <option v-for="item in matchingLibraryMaterials(material)" :key="item.id" :value="item.id">{{ item.title }} 第 {{ item.version }} 版</option>
                </select>
                <button class="btn btn-outline btn-sm" type="button" :disabled="!selectedLibraryMaterialIds[material.key]" @click="linkMaterialFromLibrary(material.key)">
                  关联
                </button>
                <label class="member-file-picker">
                  <input type="file" :accept="acceptedMaterialFileTypes" @change="selectMaterialFile(material.key, $event)" />
                  <span>选择文件</span>
                </label>
                <button class="btn btn-outline btn-sm" type="button" :disabled="uploadingKey === material.key || !selectedFiles[material.key]" @click="uploadMaterial(material.key)">
                  {{ uploadingKey === material.key ? '上传中' : material.reviewStatus === 'needs-revision' || material.reviewStatus === 'rejected' ? '上传补件' : '上传新版' }}
                </button>
              </div>
            </div>

            <div v-if="material.versions?.length" class="member-version-list">
              <div v-for="version in material.versions" :key="version.id" class="member-version-row">
                <div>
                  <strong>第 {{ version.version }} 版 · {{ version.fileName }}</strong>
                  <span>{{ formatDate(version.uploadedAt) }} · {{ formatFileSize(version.size) }}</span>
                  <small v-if="version.reviewNote">{{ version.reviewNote }}</small>
                </div>
                <span class="member-status-pill" :class="reviewStatusClass(version.reviewStatus)">{{ reviewStatusLabel(version.reviewStatus) }}</span>
                <button class="btn btn-outline btn-sm" type="button" @click="downloadMaterial(material.key, version.id, version.fileName)">下载</button>
              </div>
            </div>
          </article>
        </section>
      </div>
    </section>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="member-case-section-head">
        <div>
          <div class="section-kicker">沟通</div>
          <h2 class="section-title mt-2">案件留言与补件说明</h2>
          <p class="section-copy mt-1">老师的补件说明会出现在这里，你也可以直接补充情况。</p>
        </div>
      </div>

      <div class="member-message-list">
        <div v-for="message in application.messages || []" :key="message.id" class="member-message" :class="`member-message--${message.senderType}`">
          <div>
            <strong>{{ message.senderName }}</strong>
            <span>{{ formatDate(message.createdAt) }}</span>
          </div>
          <p>{{ message.content }}</p>
        </div>
        <div v-if="!application.messages?.length" class="member-empty-state">
          <strong>暂无沟通记录</strong>
          <span>你可以在下方主动补充申请背景或材料说明。</span>
        </div>
      </div>

      <div class="member-message-form">
        <textarea v-model.trim="messageContent" rows="4" placeholder="输入要发给负责老师的说明，例如材料情况、预算变化、语言成绩更新时间等"></textarea>
        <button class="btn btn-gold" type="button" :disabled="!messageContent || sendingMessage" @click="sendMessage">
          {{ sendingMessage ? '发送中' : '发送留言' }}
        </button>
      </div>
    </section>

    <div v-if="actionMessage" class="member-inline-message">{{ actionMessage }}</div>
  </section>

  <section v-else class="section-card empty-state">
    正在加载申请案件...
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { API_BASE_URL } from "../api/client";
import { useApplicationsStore, type StudentApplicationItem } from "../stores/applications";
import { useSessionStore } from "../stores/session";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const applicationStore = useApplicationsStore();
const selectedFiles = reactive<Record<string, File | null>>({});
const selectedLibraryMaterialIds = reactive<Record<string, number>>({});
const uploadingKey = ref("");
const messageContent = ref("");
const sendingMessage = ref(false);
const actionMessage = ref("");
const acceptedMaterialFileTypes = ".pdf,image/jpeg,image/png,image/webp";
const maxMaterialUploadBytes = 20 * 1024 * 1024;
const allowedMaterialUploadTypes: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};
const application = computed(() => applicationStore.current as StudentApplicationItem | null);
const materialGroups = computed(() => groupMaterials(application.value?.materials || []));
const profileSnapshot = computed(() => application.value?.applicationProfileSnapshot || {});
const profileSummary = computed(() => application.value?.applicationProfileSummary || { completion: 0, status: "insufficient", statusLabel: "信息不足", missingFields: [], missingLabels: [] });
const academicText = computed(() => {
  const academic = profileSnapshot.value.academicBackground || {};
  return [academic.schoolName, academic.majorName, academic.averageScore || (profileSnapshot.value.gpa ? `GPA ${profileSnapshot.value.gpa}` : "")].filter(Boolean).join(" · ") || "待补充";
});
const languageText = computed(() => {
  const language = profileSnapshot.value.languageProfile || {};
  return String(language.overallScore || (language.plannedTestDate ? `计划考试 ${language.plannedTestDate}` : language.testDate ? `考试时间 ${language.testDate}` : "待补充"));
});
const preferenceText = computed(() => {
  const preferences = profileSnapshot.value.studyPreferences || {};
  const cities = Array.isArray(preferences.preferredCities) ? preferences.preferredCities.join("、") : "";
  return [preferences.intake ? `入学 ${preferences.intake}` : "", cities, preferences.preferredUniversityType].filter(Boolean).join(" · ") || "待补充";
});
const serviceText = computed(() => {
  const service = profileSnapshot.value.serviceNeeds || {};
  return Array.isArray(service.needs) && service.needs.length ? service.needs.join("、") : String(service.notes || "待补充");
});
const contactText = computed(() => {
  const contact = profileSnapshot.value.contactInfo || {};
  return [contact.fullName, contact.phone, contact.wechat, contact.whatsapp].filter(Boolean).join(" · ") || "待补充";
});

const timelineSteps = computed(() => {
  const order = ["submitted", "reviewing", "need-info", "platform-approved", "school-submitted", "school-reviewing", "offered", "visa", "done"];
  const currentIndex = Math.max(order.indexOf(normalizeTimelineStatus(application.value?.workflow?.status || application.value?.applicationStatus || "submitted")), 0);
  return [
    { key: "submitted", label: "已提交平台", note: "学生已确认目标并提交 StudyMY 审核。", active: currentIndex === 0, done: currentIndex > 0 },
    { key: "reviewing", label: "平台审核", note: "顾问审核材料并确认是否补件。", active: currentIndex === 1, done: currentIndex > 1 },
    { key: "need-info", label: "补件", note: "如需补件，请上传新版材料。", active: currentIndex === 2, done: currentIndex > 2 },
    { key: "platform-approved", label: "平台通过", note: "材料通过，准备递交院校。", active: currentIndex === 3, done: currentIndex > 3 },
    { key: "school-submitted", label: "已递交院校", note: "申请包已递交到目标院校。", active: currentIndex === 4, done: currentIndex > 4 },
    { key: "school-reviewing", label: "院校审核", note: "等待院校审核结果。", active: currentIndex === 5, done: currentIndex > 5 },
    { key: "offered", label: "Offer", note: "确认 Offer 条件和下一步。", active: currentIndex === 6, done: currentIndex > 6 },
    { key: "visa", label: "签证准备", note: "Offer 后进入签证和行前阶段。", active: currentIndex === 7, done: currentIndex > 7 },
    { key: "done", label: "办理完成", note: "申请流程结束或案件归档。", active: currentIndex >= 8, done: currentIndex >= 8 }
  ];
});

onMounted(async () => {
  if (!session.isLoggedIn) {
    session.openAuth("login");
    router.push("/");
    return;
  }
  await Promise.all([
    applicationStore.detail(Number(route.params.id)),
    applicationStore.loadMaterialLibrary()
  ]);
});

function selectMaterialFile(key: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (!validateSelectedUploadFile(file)) {
    selectedFiles[key] = null;
    input.value = "";
    return;
  }
  selectedFiles[key] = file;
}

async function uploadMaterial(key: string) {
  const file = selectedFiles[key];
  const currentApplication = application.value;
  if (!file || !currentApplication) return;
  if (!validateSelectedUploadFile(file)) return;
  uploadingKey.value = key;
  actionMessage.value = "";
  try {
    await applicationStore.uploadMaterial(currentApplication.id, key, file);
    await applicationStore.detail(currentApplication.id);
    selectedFiles[key] = null;
    actionMessage.value = "材料新版本已上传，等待老师审核。";
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : "材料上传失败";
  } finally {
    uploadingKey.value = "";
  }
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

async function linkMaterialFromLibrary(key: string) {
  const currentApplication = application.value;
  const libraryMaterialId = selectedLibraryMaterialIds[key];
  if (!currentApplication || !libraryMaterialId) return;
  actionMessage.value = "";
  try {
    await applicationStore.linkMaterialFromLibrary(currentApplication.id, key, libraryMaterialId);
    await applicationStore.detail(currentApplication.id);
    selectedLibraryMaterialIds[key] = 0;
    actionMessage.value = "已从材料库关联材料，等待老师审核。";
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : "材料库关联失败";
  }
}

async function sendMessage() {
  const currentApplication = application.value;
  if (!currentApplication || !messageContent.value) return;
  sendingMessage.value = true;
  actionMessage.value = "";
  try {
    await applicationStore.sendMessage(currentApplication.id, messageContent.value);
    messageContent.value = "";
    actionMessage.value = "留言已发送给负责老师。";
  } catch (error) {
    actionMessage.value = error instanceof Error ? error.message : "留言发送失败";
  } finally {
    sendingMessage.value = false;
  }
}

async function downloadMaterial(key: string, versionId: string, fileName: string) {
  const currentApplication = application.value;
  if (!currentApplication || !session.token) return;
  const url = `${API_BASE_URL}/applications/${currentApplication.id}/materials/${encodeURIComponent(key)}/download?versionId=${encodeURIComponent(versionId)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${session.token}` } });
  if (!response.ok) {
    actionMessage.value = "材料下载失败";
    return;
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName || "application-material";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function scrollToMaterials() {
  document.querySelector(".member-case-material-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function normalizeTimelineStatus(status: string) {
  if (status === "offer") return "offered";
  if (status === "rejected" || status === "closed") return "done";
  return status;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { draft: "待整理", submitted: "已提交", reviewing: "审核中", "need-info": "需补件", "platform-approved": "平台审核通过", "school-submitted": "已递交院校", "school-reviewing": "院校审核中", offered: "获 Offer", offer: "Offer", rejected: "拒录", visa: "签证", done: "完成", closed: "已关闭" };
  return labels[status] || status;
}

function materialStatusLabel(status: string) {
  const labels: Record<string, string> = { draft: "材料未开始", wait: "待补件", progress: "材料处理中", done: "材料完成" };
  return labels[status] || status;
}

function reviewStatusLabel(status: string) {
  const labels: Record<string, string> = { "not-uploaded": "未上传", "pending-review": "待审核", approved: "已通过", "needs-revision": "需补件", rejected: "未通过" };
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

function matchingLibraryMaterials(material: StudentApplicationItem["materials"][number]) {
  const category = material.category || material.key;
  const aliases = materialLibraryAliases(category);
  return applicationStore.materialLibraryItems.filter((item) => aliases.includes(item.materialType) || item.materialType === category || material.key.includes(item.materialType) || category.includes(item.materialType));
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
    recommendation: ["recommendation-letter"]
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

function levelLabel(level?: string) {
  const labels: Record<string, string> = { bachelor: "本科", master: "硕士", phd: "博士" };
  return labels[level || ""] || level || "待补充";
}

function categoryLabel(category?: string) {
  const labels: Record<string, string> = { it: "计算机 / IT", IT: "计算机 / IT", business: "商科", engineering: "工程", science: "理科", arts: "艺术与设计", medicine: "医学健康", law: "法学" };
  return labels[category || ""] || category || "待补充";
}

function formatBudget(value?: number | null) {
  const budget = Number(value || 0);
  if (!budget) return "待补充";
  return `约 ${Math.round(budget / 10000)} 万人民币/年`;
}

function formatFileSize(size?: number) {
  if (!size) return "大小未知";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
</script>

<style scoped>
.member-case-head,
.member-case-section-head,
.member-case-material__top,
.member-version-row,
.member-message-form {
  display: flex;
  gap: 16px;
}

.member-case-head,
.member-case-section-head,
.member-case-material__top,
.member-version-row {
  align-items: flex-start;
  justify-content: space-between;
}

.member-case-owner,
.member-case-stat {
  min-width: 160px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--paper);
}

.member-case-owner span,
.member-case-stat span {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.member-case-owner strong,
.member-case-stat strong {
  display: block;
  margin-top: 6px;
  color: var(--ink);
  font-size: 22px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.member-case-status-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 22px;
}

.member-next-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
  align-items: center;
  margin-top: 18px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #fff;
}

.member-profile-status {
  min-width: 150px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--paper);
}

.member-profile-status span {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.member-profile-status strong {
  display: block;
  margin-top: 4px;
  color: var(--ink);
  font-size: 26px;
  line-height: 1;
}

.member-profile-snapshot-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.member-profile-snapshot-grid div {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
}

.member-profile-snapshot-grid span {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.member-profile-snapshot-grid strong {
  display: block;
  margin-top: 5px;
  color: var(--ink);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.member-profile-missing {
  margin-top: 12px;
  color: var(--red);
  font-size: 13px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.member-profile-missing.ok {
  color: var(--teal);
}

.member-next-action span {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.member-next-action strong {
  display: block;
  margin-top: 6px;
  color: var(--ink);
  font-size: 18px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.member-workflow-progress {
  display: grid;
  gap: 8px;
}

.member-workflow-progress span {
  text-align: right;
}

.member-workflow-progress div {
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: var(--paper-2);
}

.member-workflow-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--teal);
}

.member-case-timeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.member-case-step {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
}

.member-case-step > span {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--paper-2);
}

.member-case-step.done > span,
.member-case-step.active > span {
  background: var(--teal);
}

.member-case-step strong,
.member-case-step small {
  display: block;
  overflow-wrap: anywhere;
}

.member-case-step small {
  margin-top: 4px;
  color: var(--ink-3);
}

.member-case-material-list,
.member-version-list,
.member-message-list,
.member-case-todo-list {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}

.member-case-material-group {
  display: grid;
  gap: 12px;
}

.member-case-material-group__head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 14px;
  align-items: center;
  padding: 4px 2px;
}

.member-case-material-group__head strong,
.member-case-material-group__head span {
  display: block;
  overflow-wrap: anywhere;
}

.member-case-material-group__head strong {
  color: var(--ink);
  font-size: 16px;
  line-height: 1.3;
}

.member-case-material-group__head span {
  margin-top: 3px;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.member-case-todo {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--shadow);
}

.member-case-todo strong,
.member-case-todo small {
  display: block;
  overflow-wrap: anywhere;
}

.member-case-todo small {
  margin-top: 3px;
  color: var(--ink-3);
}

.member-case-material {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #fff;
  box-shadow: var(--shadow);
}

.member-case-material h3 {
  margin-top: 8px;
  font-size: 20px;
  line-height: 1.3;
}

.member-case-material p,
.member-case-review-note,
.member-case-material-reason,
.member-case-material-waived-note,
.member-upload-hint {
  display: block;
  margin-top: 4px;
  color: var(--ink-3);
  overflow-wrap: anywhere;
}

.member-upload-hint {
  font-size: 12px;
  font-weight: 700;
}

.member-case-material-reason {
  color: var(--teal);
}

.member-case-material-waived-note {
  color: var(--teal);
}

.member-case-material-library-note {
  color: var(--teal);
}

.member-case-material-tips {
  display: grid;
  gap: 2px;
  margin-top: 6px;
}

.member-case-material-tips small {
  display: block;
  color: var(--ink-3);
  overflow-wrap: anywhere;
}

.member-case-material-tips small::before {
  content: "· ";
}

.member-version-row {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--paper);
}

.member-version-row > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.member-version-row strong,
.member-version-row span,
.member-version-row small {
  overflow-wrap: anywhere;
}

.member-version-row span,
.member-version-row small {
  color: var(--ink-3);
  font-size: 13px;
}

.member-message {
  max-width: 78%;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--paper);
}

.member-message--student {
  justify-self: end;
  background: var(--teal-lt);
}

.member-message--admin {
  justify-self: start;
  background: #fff;
}

.member-message > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--ink-3);
  font-size: 13px;
}

.member-message p {
  margin-top: 8px;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.member-message-form {
  align-items: stretch;
  margin-top: 18px;
}

.member-message-form textarea {
  flex: 1;
  width: 100%;
  min-height: 112px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
  resize: vertical;
}

.member-status-row,
.member-file-actions {
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

.member-library-select {
  width: 170px;
  min-height: 36px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 800;
}

.member-inline-message {
  padding: 12px 14px;
  border: 1px solid rgba(27, 122, 114, 0.22);
  border-radius: 14px;
  background: var(--teal-lt);
  color: var(--teal);
  font-weight: 700;
}

.member-empty-state {
  display: grid;
  gap: 6px;
  padding: 22px;
  border: 1px dashed var(--border);
  border-radius: 18px;
  background: var(--paper);
  color: var(--ink-3);
}

@media (max-width: 980px) {
  .member-case-head,
  .member-case-section-head,
  .member-case-material__top,
  .member-version-row,
  .member-message-form {
    flex-direction: column;
  }

  .member-case-status-grid,
  .member-case-timeline,
  .member-next-action,
  .member-profile-snapshot-grid,
  .member-case-material-group__head,
  .member-case-todo {
    grid-template-columns: 1fr;
  }

  .member-workflow-progress span {
    text-align: left;
  }

  .member-message {
    max-width: 100%;
  }
}
</style>
