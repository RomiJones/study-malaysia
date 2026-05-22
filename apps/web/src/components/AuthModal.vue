<template>
  <div class="modal-backdrop" @click.self="session.closeAuth">
    <div class="modal-panel auth-panel">
      <div class="auth-modal-head">
        <div>
          <div class="modal-kicker">{{ t('nav.login') }}</div>
          <h3 class="auth-modal-title">{{ session.authMode === 'login' ? t('auth.titleLogin') : t('auth.titleRegister') }}</h3>
        </div>
        <button class="modal-close" @click="session.closeAuth" aria-label="Close">×</button>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab" :class="{ active: session.authMode === 'login' }" @click="session.authMode = 'login'">{{ t('auth.login') }}</button>
        <button class="auth-tab" :class="{ active: session.authMode === 'register' }" @click="session.authMode = 'register'">{{ t('auth.register') }}</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label class="field-shell">
          <span>{{ t('auth.method') }}</span>
          <select v-model="form.method">
            <option value="email">{{ t('authMethod.email') }}</option>
            <option value="phone">{{ t('authMethod.phone') }}</option>
            <option value="wechat">{{ t('authMethod.wechat') }}</option>
            <option value="qq">{{ t('authMethod.qq') }}</option>
          </select>
        </label>
        <label class="field-shell">
          <span>{{ t('auth.account') }}</span>
          <input v-model="form.account" required />
        </label>
        <label class="field-shell">
          <span>{{ t('auth.password') }}</span>
          <input v-model="form.password" type="password" required minlength="6" />
        </label>
        <label v-if="session.authMode === 'register'" class="field-shell">
          <span>{{ t('auth.displayName') }}</span>
          <input v-model="form.displayName" />
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
