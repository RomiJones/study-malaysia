<template>
  <div class="modal-backdrop" @click.self="session.closeAuth">
    <div class="modal-panel auth-panel">
      <div class="auth-modal-head">
        <div>
          <h3 class="auth-modal-title">{{ session.authMode === 'login' ? '登录 StudyMY' : '注册 StudyMY' }}</h3>
        </div>
        <button class="modal-close" @click="session.closeAuth" aria-label="Close">×</button>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab" :class="{ active: session.authMode === 'login' }" @click="session.authMode = 'login'">{{ t('auth.login') }}</button>
        <button class="auth-tab" :class="{ active: session.authMode === 'register' }" @click="session.authMode = 'register'">{{ t('auth.register') }}</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label class="field-shell">
          <span>邮箱 / 手机号</span>
          <input v-model="form.account" required placeholder="请输入邮箱或手机号" />
        </label>
        <label class="field-shell">
          <span>{{ t('auth.password') }}</span>
          <input v-model="form.password" type="password" required minlength="6" placeholder="请输入密码" />
        </label>
        <label v-if="session.authMode === 'register'" class="field-shell">
          <span>昵称（可选）</span>
          <input v-model="form.displayName" placeholder="你的昵称" />
        </label>
        <button class="btn btn-primary auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? t('common.loading') : session.authMode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister') }}
        </button>
        <p v-if="syncNotice" class="inline-alert">{{ syncNotice }}</p>
        <p v-if="error" class="inline-alert inline-alert--error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useCatalogStore } from "../stores/catalog";
import { usePlannerStore } from "../stores/planner";
import { useSessionStore } from "../stores/session";

const session = useSessionStore();
const catalog = useCatalogStore();
const planner = usePlannerStore();
const router = useRouter();
const { t } = useI18n();
const error = ref("");
const submitting = ref(false);
const syncNotice = ref("");
const form = reactive({
  method: "email" as "phone" | "email" | "wechat" | "qq",
  account: "",
  password: "",
  displayName: ""
});

async function submit() {
  error.value = "";
  submitting.value = true;
  syncNotice.value = "";
  try {
    await session.submitAuth(session.authMode, form);
    syncNotice.value = "正在同步本地收藏和申请规划...";
    await Promise.all([catalog.mergeLocalState(), planner.mergeLocalState()]);
    session.closeAuth();
    router.push("/member");
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('auth.failed');
  } finally {
    submitting.value = false;
  }
}
</script>
