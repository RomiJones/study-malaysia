<template>
  <div class="modal-backdrop" @click.self="session.closeAuth">
    <div class="modal-panel auth-panel">
      <div class="auth-modal-head">
        <div>
          <h3 class="auth-modal-title">{{ session.authMode === 'login' ? t('auth.titleLogin') : t('auth.titleRegister') }}</h3>
          <p class="auth-modal-note">{{ t('auth.guestSyncHint') }}</p>
        </div>
        <button class="modal-close" @click="session.closeAuth" :aria-label="t('common.close')">
          <span class="ui-icon ui-icon--close" aria-hidden="true"></span>
        </button>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab" :class="{ active: session.authMode === 'login' }" @click="session.authMode = 'login'">{{ t('auth.login') }}</button>
        <button class="auth-tab" :class="{ active: session.authMode === 'register' }" @click="session.authMode = 'register'">{{ t('auth.register') }}</button>
      </div>

      <div v-if="showTestAccount" class="auth-test-account">
        <div class="auth-test-account__copy">
          <strong>{{ t('auth.testAccountTitle') }}</strong>
          <p>{{ t('auth.testAccountHint') }}</p>
        </div>
        <dl class="auth-test-account__grid">
          <div>
            <dt>{{ t('auth.account') }}</dt>
            <dd>{{ memberTestAccount.account }}</dd>
          </div>
          <div>
            <dt>{{ t('auth.password') }}</dt>
            <dd>{{ memberTestAccount.password }}</dd>
          </div>
        </dl>
        <button class="btn btn-secondary auth-test-account__button" type="button" :disabled="submitting" @click="loginWithTestAccount">
          {{ submitting ? t('common.loading') : t('auth.testAccountLogin') }}
        </button>
      </div>

      <form class="auth-form" @submit.prevent="submitForm">
        <label class="field-shell">
          <span>{{ t('auth.accountLabel') }}</span>
          <input v-model="form.account" required :placeholder="t('auth.accountPlaceholder')" />
        </label>
        <label class="field-shell">
          <span>{{ t('auth.password') }}</span>
          <input v-model="form.password" type="password" required minlength="6" :placeholder="t('auth.passwordPlaceholder')" />
        </label>
        <label v-if="session.authMode === 'register'" class="field-shell">
          <span>{{ t('auth.displayNameOptional') }}</span>
          <input v-model="form.displayName" :placeholder="t('auth.displayNamePlaceholder')" />
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
const memberTestAccount = {
  method: "email" as const,
  account: "demo@studymy.local",
  password: "Demo123!",
  displayName: "Demo Student"
};
const showTestAccount = import.meta.env.VITE_HIDE_MEMBER_TEST_ACCOUNT !== "true";
const form = reactive({
  method: "email" as "phone" | "email" | "wechat" | "qq",
  account: "",
  password: "",
  displayName: ""
});

function fillTestAccount() {
  session.authMode = "login";
  form.method = memberTestAccount.method;
  form.account = memberTestAccount.account;
  form.password = memberTestAccount.password;
  form.displayName = memberTestAccount.displayName;
}

async function loginWithTestAccount() {
  fillTestAccount();
  await submit("login");
}

async function submitForm() {
  await submit();
}

async function submit(modeOverride?: "login" | "register") {
  if (submitting.value) return;
  error.value = "";
  submitting.value = true;
  syncNotice.value = "";
  try {
    await session.submitAuth(modeOverride || session.authMode, form);
    syncNotice.value = t('auth.syncNotice');
    await Promise.all([catalog.mergeLocalState(), planner.mergeLocalState()]);
    session.closeAuth();
    router.push("/member");
  } catch (err) {
    error.value = t('auth.failed');
  } finally {
    submitting.value = false;
  }
}
</script>
