<template>
  <div class="modal-backdrop">
    <div class="modal-panel auth-panel section-card">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{{ t('nav.login') }}</div>
          <h3 class="mt-2 text-2xl font-black text-slate-900">{{ session.authMode === 'login' ? t('auth.titleLogin') : t('auth.titleRegister') }}</h3>
        </div>
        <button class="ghost-action !rounded-full !px-4" @click="session.closeAuth">{{ t('common.close') }}</button>
      </div>

      <div class="mt-6 flex gap-3">
        <button class="secondary-action flex-1" :class="{ 'primary-action': session.authMode === 'login' }" @click="session.authMode = 'login'">{{ t('auth.login') }}</button>
        <button class="secondary-action flex-1" :class="{ 'primary-action': session.authMode === 'register' }" @click="session.authMode = 'register'">{{ t('auth.register') }}</button>
      </div>

      <form class="mt-6 grid gap-4" @submit.prevent="submit">
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
        <button class="primary-action w-full" type="submit">{{ session.authMode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister') }}</button>
        <p v-if="error" class="text-sm font-semibold text-red-600">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSessionStore } from "../stores/session";

const session = useSessionStore();
const router = useRouter();
const { t } = useI18n();
const error = ref("");
const form = reactive({
  method: "email" as "phone" | "email" | "wechat" | "qq",
  account: "",
  password: "",
  displayName: ""
});

async function submit() {
  error.value = "";
  try {
    await session.submitAuth(session.authMode, form);
    router.push("/member");
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('auth.failed');
  }
}
</script>