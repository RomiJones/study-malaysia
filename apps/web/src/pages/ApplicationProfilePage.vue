<template>
  <section class="application-profile-page">
    <div class="section-card rounded-[32px] p-6 md:p-8">
      <div class="profile-head">
        <div>
          <RouterLink class="btn btn-outline btn-sm" to="/member">返回我的</RouterLink>
          <div class="section-kicker mt-5">{{ pageKicker }}</div>
          <h1 class="section-title mt-2">完善申请档案</h1>
          <p class="section-copy mt-2">用于生成择校建议、材料清单，并帮助负责老师判断申请方案。</p>
        </div>
        <div class="profile-completion">
          <span>完成度</span>
          <strong>{{ completion }}%</strong>
          <div><i :style="{ width: `${completion}%` }"></i></div>
        </div>
      </div>
    </div>

    <section class="section-card rounded-[28px] p-6 md:p-8">
      <div class="profile-layout">
        <aside class="profile-steps">
          <button
            v-for="(step, index) in steps"
            :key="step.key"
            type="button"
            :class="{ active: step.key === activeStep }"
            @click="activeStep = step.key"
          >
            <span>{{ index + 1 }}</span>
            <strong>{{ step.label }}</strong>
          </button>
        </aside>

        <form class="profile-form" @submit.prevent="saveProfile">
          <div v-if="activeStep === 'target'" class="profile-form-grid">
            <label class="field-shell">
              <span>目标学历</span>
              <select v-model="form.level">
                <option value="bachelor">本科</option>
                <option value="master">硕士</option>
                <option value="phd">博士</option>
              </select>
            </label>
            <label class="field-shell">
              <span>目标专业方向</span>
              <select v-model="form.targetCategory">
                <option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
            <label class="field-shell">
              <span>计划入学时间</span>
              <input v-model.trim="form.studyPreferences.intake" placeholder="例如 2026-09 / 待确认" />
            </label>
            <label class="field-shell">
              <span>年度预算</span>
              <input v-model.number="form.budgetCny" type="number" min="0" step="1000" />
            </label>
            <label class="field-shell">
              <span>当前所在地</span>
              <input v-model.trim="form.contactInfo.currentLocation" placeholder="例如 北京 / 吉隆坡" />
            </label>
            <label class="field-shell">
              <span>国籍</span>
              <input v-model.trim="form.contactInfo.nationality" placeholder="例如 中国" />
            </label>
          </div>

          <div v-if="activeStep === 'academic'" class="profile-form-grid">
            <label class="field-shell">
              <span>当前学历</span>
              <input v-model.trim="form.academicBackground.currentEducation" placeholder="例如 本科在读 / 本科毕业" />
            </label>
            <label class="field-shell">
              <span>毕业院校</span>
              <input v-model.trim="form.academicBackground.schoolName" />
            </label>
            <label class="field-shell">
              <span>所学专业</span>
              <input v-model.trim="form.academicBackground.majorName" />
            </label>
            <label class="field-shell">
              <span>GPA</span>
              <input v-model.number="form.gpa" type="number" min="0" max="4" step="0.01" />
            </label>
            <label class="field-shell">
              <span>成绩制</span>
              <input v-model.trim="form.academicBackground.gradingScale" placeholder="例如 4.0 / 100 分制" />
            </label>
            <label class="field-shell">
              <span>平均分</span>
              <input v-model.trim="form.academicBackground.averageScore" placeholder="例如 82/100" />
            </label>
            <label class="field-shell">
              <span>毕业年份</span>
              <input v-model.trim="form.academicBackground.graduationYear" placeholder="例如 2025" />
            </label>
            <label class="field-shell">
              <span>学术经历</span>
              <input v-model.trim="form.experience" placeholder="例如 0-1 years / 2 years research" />
            </label>
          </div>

          <div v-if="activeStep === 'language'" class="profile-form-grid">
            <label class="field-shell">
              <span>语言考试</span>
              <select v-model="form.languageProfile.testType">
                <option value="">未确定</option>
                <option value="IELTS">IELTS</option>
                <option value="TOEFL">TOEFL</option>
                <option value="PTE">PTE</option>
                <option value="MUET">MUET</option>
              </select>
            </label>
            <label class="field-shell">
              <span>IELTS 等效总分</span>
              <input v-model.number="form.ielts" type="number" min="0" max="9" step="0.5" />
            </label>
            <label class="field-shell">
              <span>语言总分</span>
              <input v-model.trim="form.languageProfile.overallScore" placeholder="例如 IELTS 6.0 / PTE 59" />
            </label>
            <label class="field-shell">
              <span>小分情况</span>
              <input v-model.trim="form.languageProfile.scoreBreakdown" placeholder="例如 L6 R6 W5.5 S6" />
            </label>
            <label class="field-shell">
              <span>考试日期</span>
              <input v-model.trim="form.languageProfile.testDate" placeholder="例如 2026-03" />
            </label>
            <label class="field-shell">
              <span>预计考试时间</span>
              <input v-model.trim="form.languageProfile.plannedTestDate" placeholder="例如 2026-08" />
            </label>
            <label class="profile-check-row">
              <input v-model="form.acceptNoLanguage" type="checkbox" />
              <span>接受先申请后补语言或语言班路径</span>
            </label>
          </div>

          <div v-if="activeStep === 'preference'" class="profile-form-grid">
            <label class="field-shell">
              <span>院校类型偏好</span>
              <select v-model="form.studyPreferences.preferredUniversityType">
                <option value="">不限</option>
                <option value="public">公立优先</option>
                <option value="private">私立优先</option>
                <option value="branch-campus">国际分校优先</option>
              </select>
            </label>
            <label class="field-shell">
              <span>决策优先级</span>
              <select v-model="form.studyPreferences.rankingPriority">
                <option value="">综合考虑</option>
                <option value="ranking">排名优先</option>
                <option value="budget">费用优先</option>
                <option value="admission-rate">录取稳妥优先</option>
              </select>
            </label>
            <div class="profile-choice-panel">
              <span>城市偏好</span>
              <label v-for="city in cityOptions" :key="city">
                <input v-model="form.studyPreferences.preferredCities" type="checkbox" :value="city" />
                <small>{{ city }}</small>
              </label>
            </div>
            <label class="profile-check-row">
              <input v-model="form.studyPreferences.scholarshipNeeded" type="checkbox" />
              <span>希望优先考虑奖学金机会</span>
            </label>
            <label class="profile-check-row">
              <input v-model="form.studyPreferences.accommodationNeeded" type="checkbox" />
              <span>需要住宿安排建议</span>
            </label>
          </div>

          <div v-if="activeStep === 'service'" class="profile-form-grid">
            <label class="field-shell">
              <span>姓名</span>
              <input v-model.trim="form.contactInfo.fullName" :placeholder="session.user?.displayName || ''" />
            </label>
            <label class="field-shell">
              <span>手机号</span>
              <input v-model.trim="form.contactInfo.phone" />
            </label>
            <label class="field-shell">
              <span>微信</span>
              <input v-model.trim="form.contactInfo.wechat" />
            </label>
            <label class="field-shell">
              <span>WhatsApp</span>
              <input v-model.trim="form.contactInfo.whatsapp" />
            </label>
            <div class="profile-choice-panel profile-choice-panel--wide">
              <span>需要的服务</span>
              <label v-for="item in serviceOptions" :key="item.value">
                <input v-model="form.serviceNeeds.needs" type="checkbox" :value="item.value" />
                <small>{{ item.label }}</small>
              </label>
            </div>
            <label class="field-shell profile-form-grid__wide">
              <span>补充说明</span>
              <textarea v-model.trim="form.serviceNeeds.notes" rows="4" placeholder="例如预算边界、偏好城市、已有材料、家长关注点等"></textarea>
            </label>
          </div>

          <div class="profile-actions">
            <button class="btn btn-outline" type="button" :disabled="activeIndex === 0" @click="goStep(-1)">上一步</button>
            <button v-if="activeIndex < steps.length - 1" class="btn btn-gold" type="button" @click="goStep(1)">下一步</button>
            <button v-else class="btn btn-gold" type="submit" :disabled="planner.loading">{{ planner.loading ? '保存中' : '保存申请档案' }}</button>
          </div>
          <div v-if="message" class="profile-message">{{ message }}</div>
        </form>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { usePlannerStore } from "../stores/planner";
import { useSessionStore } from "../stores/session";

type StepKey = "target" | "academic" | "language" | "preference" | "service";

const route = useRoute();
const router = useRouter();
const planner = usePlannerStore();
const session = useSessionStore();
const activeStep = ref<StepKey>("target");
const message = ref("");

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "target", label: "申请目标" },
  { key: "academic", label: "学术背景" },
  { key: "language", label: "语言预算" },
  { key: "preference", label: "偏好条件" },
  { key: "service", label: "服务需求" }
];

const categoryOptions = [
  { value: "it", label: "计算机 / IT" },
  { value: "business", label: "商科" },
  { value: "engineering", label: "工程" },
  { value: "science", label: "理科" },
  { value: "arts", label: "艺术与设计" },
  { value: "medicine", label: "医学健康" },
  { value: "law", label: "法学" }
];
const cityOptions = ["Kuala Lumpur", "Selangor", "Penang", "Johor", "Sarawak", "Sabah"];
const serviceOptions = [
  { value: "school-selection", label: "择校方案" },
  { value: "application", label: "院校申请" },
  { value: "document-review", label: "材料审核" },
  { value: "personal-statement", label: "文书指导" },
  { value: "visa", label: "签证办理" },
  { value: "accommodation", label: "住宿安排" }
];

const form = reactive({
  level: "master",
  targetCategory: "it",
  budgetCny: 80000,
  gpa: 2.9,
  ielts: 5.5,
  experience: "0-1 years",
  acceptNoLanguage: true,
  contactInfo: {
    fullName: "",
    phone: "",
    wechat: "",
    whatsapp: "",
    nationality: "",
    currentLocation: ""
  },
  academicBackground: {
    currentEducation: "",
    schoolName: "",
    majorName: "",
    gradingScale: "",
    averageScore: "",
    graduationYear: ""
  },
  languageProfile: {
    testType: "IELTS",
    overallScore: "",
    scoreBreakdown: "",
    testDate: "",
    plannedTestDate: ""
  },
  studyPreferences: {
    intake: "",
    preferredCities: [] as string[],
    preferredUniversityType: "",
    rankingPriority: "",
    scholarshipNeeded: false,
    accommodationNeeded: false
  },
  serviceNeeds: {
    needs: [] as string[],
    notes: ""
  }
});

const pageKicker = computed(() => route.path === "/onboarding" ? "申请建档" : "申请档案");
const activeIndex = computed(() => steps.findIndex((step) => step.key === activeStep.value));
const completion = computed(() => {
  const checks = [
    form.level,
    form.targetCategory,
    form.budgetCny > 0,
    form.gpa > 0,
    form.ielts > 0,
    form.contactInfo.currentLocation,
    form.academicBackground.schoolName,
    form.academicBackground.majorName,
    form.academicBackground.currentEducation,
    form.languageProfile.testType || form.languageProfile.plannedTestDate,
    form.studyPreferences.intake,
    form.studyPreferences.preferredCities.length,
    form.serviceNeeds.needs.length,
    form.contactInfo.phone || form.contactInfo.wechat || form.contactInfo.whatsapp
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
});

onMounted(async () => {
  if (!session.isLoggedIn) {
    session.openAuth("login");
    router.push("/");
    return;
  }
  await planner.load();
  hydrateForm();
});

function hydrateForm() {
  const profile = planner.dashboard?.profile;
  if (!profile) return;
  form.level = profile.level || form.level;
  form.targetCategory = String(profile.targetCategory || form.targetCategory).toLowerCase();
  form.budgetCny = Number(profile.budgetCny || form.budgetCny);
  form.gpa = Number(profile.gpa || form.gpa);
  form.ielts = Number(profile.ielts || form.ielts);
  form.experience = profile.experience || form.experience;
  form.acceptNoLanguage = typeof profile.acceptNoLanguage === "boolean" ? profile.acceptNoLanguage : form.acceptNoLanguage;
  Object.assign(form.contactInfo, profile.contactInfo || {});
  Object.assign(form.academicBackground, profile.academicBackground || {});
  Object.assign(form.languageProfile, profile.languageProfile || {});
  Object.assign(form.studyPreferences, {
    ...(profile.studyPreferences || {}),
    preferredCities: Array.isArray(profile.studyPreferences?.preferredCities) ? profile.studyPreferences.preferredCities : []
  });
  Object.assign(form.serviceNeeds, {
    ...(profile.serviceNeeds || {}),
    needs: Array.isArray(profile.serviceNeeds?.needs) ? profile.serviceNeeds.needs : []
  });
}

function goStep(offset: number) {
  const next = steps[Math.min(Math.max(activeIndex.value + offset, 0), steps.length - 1)];
  activeStep.value = next.key;
}

async function saveProfile() {
  message.value = "";
  await planner.updateProfile({
    level: form.level as never,
    targetCategory: form.targetCategory,
    budgetCny: form.budgetCny,
    gpa: form.gpa,
    ielts: form.ielts,
    experience: form.experience,
    acceptNoLanguage: form.acceptNoLanguage,
    contactInfo: compactObject(form.contactInfo),
    academicBackground: compactObject(form.academicBackground),
    languageProfile: compactObject(form.languageProfile),
    studyPreferences: {
      ...compactObject(form.studyPreferences),
      preferredCities: form.studyPreferences.preferredCities
    },
    serviceNeeds: {
      ...compactObject(form.serviceNeeds),
      needs: form.serviceNeeds.needs
    }
  });
  message.value = "申请档案已保存。";
  if (route.path === "/onboarding") {
    router.push("/member");
  }
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "boolean") return true;
      return item !== undefined && item !== null && String(item).trim().length > 0;
    })
  );
}
</script>

<style scoped>
.application-profile-page {
  display: grid;
  gap: 24px;
}

.profile-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 20px;
  align-items: end;
}

.profile-completion {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #fff;
}

.profile-completion span {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.profile-completion strong {
  color: var(--ink);
  font-size: 28px;
  line-height: 1;
}

.profile-completion div {
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: var(--paper-2);
}

.profile-completion i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--teal);
}

.profile-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
}

.profile-steps {
  display: grid;
  align-content: start;
  gap: 10px;
}

.profile-steps button {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
  color: var(--ink-2);
  text-align: left;
}

.profile-steps button.active {
  border-color: rgba(20, 184, 166, 0.42);
  background: var(--teal-lt);
  color: var(--ink);
}

.profile-steps span {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--paper-2);
  font-weight: 900;
}

.profile-steps button.active span {
  background: var(--teal);
  color: #fff;
}

.profile-form {
  min-width: 0;
}

.profile-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.profile-form-grid__wide,
.profile-choice-panel--wide {
  grid-column: 1 / -1;
}

.profile-check-row,
.profile-choice-panel {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 56px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
}

.profile-choice-panel {
  align-items: flex-start;
  flex-wrap: wrap;
}

.profile-choice-panel > span {
  flex: 0 0 100%;
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 800;
}

.profile-choice-panel label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-height: 32px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--paper-2);
}

.profile-choice-panel small,
.profile-check-row span {
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 700;
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.profile-message {
  margin-top: 12px;
  padding: 12px;
  border-radius: 14px;
  background: var(--teal-lt);
  color: var(--teal);
  font-weight: 800;
}

@media (max-width: 900px) {
  .profile-head,
  .profile-layout,
  .profile-form-grid {
    grid-template-columns: 1fr;
  }

  .profile-steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .profile-steps {
    grid-template-columns: 1fr;
  }
}
</style>
