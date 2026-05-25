import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type {
  LocalizedText,
  SmartRecommendationResponseDto,
  SupportedLocale
} from "@studymy/shared";
import { apiFetch } from "../api/client";
import { useSessionStore } from "./session";

export const useSmartRecommendationsStore = defineStore("smartRecommendations", () => {
  const response = ref<SmartRecommendationResponseDto | null>(null);
  const loading = ref(false);
  const error = ref("");
  const loadedToken = ref<string | null>(null);

  const status = computed(() => response.value?.status || "login-required");
  const gate = computed(() => response.value?.gate || null);
  const profileCompleteness = computed(() => response.value?.profileCompleteness || null);
  const recommendations = computed(() => {
    if (!response.value?.gate.canShowRecommendations) return [];
    return response.value.recommendations;
  });

  async function load(locale: SupportedLocale, options: { force?: boolean } = {}) {
    const session = useSessionStore();
    if (!session.token) {
      loadedToken.value = null;
      response.value = buildLoginRequiredResponse();
      error.value = "";
      return;
    }

    if (loadedToken.value !== session.token) {
      response.value = null;
      loadedToken.value = session.token;
    }
    if (!options.force && response.value) return;

    loading.value = true;
    try {
      response.value = await apiFetch<SmartRecommendationResponseDto>(
        `/recommendations/me?locale=${encodeURIComponent(locale)}`,
        {},
        session.token
      );
      loadedToken.value = session.token;
      error.value = "";
    } catch {
      response.value = buildErrorResponse();
      error.value = "recommendation-load-failed";
    } finally {
      loading.value = false;
    }
  }

  async function refresh(locale: SupportedLocale) {
    const session = useSessionStore();
    if (!session.token) {
      response.value = buildLoginRequiredResponse();
      error.value = "";
      return;
    }

    loading.value = true;
    try {
      response.value = await apiFetch<SmartRecommendationResponseDto>(
        "/recommendations/refresh",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "personalized-profile-match",
            locale
          })
        },
        session.token
      );
      loadedToken.value = session.token;
      error.value = "";
    } catch {
      response.value = buildErrorResponse();
      error.value = "recommendation-refresh-failed";
    } finally {
      loading.value = false;
    }
  }

  function clear() {
    response.value = null;
    error.value = "";
    loadedToken.value = null;
  }

  return {
    response,
    loading,
    error,
    status,
    gate,
    profileCompleteness,
    recommendations,
    load,
    refresh,
    clear
  };
});

function buildLoginRequiredResponse(): SmartRecommendationResponseDto {
  return {
    schemaVersion: "2026-05-25",
    status: "login-required",
    gate: {
      status: "login-required",
      mode: "personalized-profile-match",
      canShowRecommendations: false,
      requiresAuthentication: true,
      requiresCompleteProfile: true,
      primaryAction: "open-login",
      message: localized(
        "Sign in and complete your saved student profile before viewing personalized recommendations.",
        "请先登录并完善已保存的学生画像，再查看个性化智能推荐。",
        "Log masuk dan lengkapkan profil pelajar tersimpan sebelum melihat cadangan peribadi."
      ),
      blockReasons: ["login-required", "anonymous-personalization-not-allowed"],
      missingProfileFields: []
    },
    profile: null,
    profileCompleteness: null,
    recommendations: []
  };
}

function buildErrorResponse(): SmartRecommendationResponseDto {
  return {
    schemaVersion: "2026-05-25",
    status: "error",
    gate: {
      status: "error",
      mode: "personalized-profile-match",
      canShowRecommendations: false,
      requiresAuthentication: false,
      requiresCompleteProfile: true,
      primaryAction: "retry",
      message: localized(
        "Personalized recommendations are temporarily unavailable.",
        "个性化推荐暂时不可用。",
        "Cadangan peribadi tidak tersedia buat sementara."
      ),
      blockReasons: [],
      missingProfileFields: []
    },
    profile: null,
    profileCompleteness: null,
    recommendations: []
  };
}

function localized(en: string, zh: string, ms: string): LocalizedText {
  return {
    en,
    ms,
    "zh-CN": zh,
    "zh-TW": zh
  };
}
