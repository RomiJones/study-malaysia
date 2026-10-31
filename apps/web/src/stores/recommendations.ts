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
  const session = useSessionStore();
  let latestRequestId = 0;

  const hasCurrentSessionResponse = computed(() => Boolean(session.token && response.value && loadedToken.value === session.token));
  const status = computed(() => {
    if (!session.token) return "login-required";
    if (!hasCurrentSessionResponse.value) return "login-required";
    return response.value?.status || "login-required";
  });
  const gate = computed(() => {
    if (!session.token) return buildLoginRequiredResponse().gate;
    return hasCurrentSessionResponse.value ? response.value?.gate || null : null;
  });
  const profileCompleteness = computed(() => hasCurrentSessionResponse.value ? response.value?.profileCompleteness || null : null);
  const recommendations = computed(() => {
    if (!hasCurrentSessionResponse.value || !response.value?.gate.canShowRecommendations) return [];
    return response.value.recommendations;
  });

  async function load(locale: SupportedLocale, options: { force?: boolean } = {}) {
    const session = useSessionStore();
    if (!session.token) {
      latestRequestId += 1;
      loadedToken.value = null;
      response.value = buildLoginRequiredResponse();
      loading.value = false;
      error.value = "";
      return;
    }

    if (loadedToken.value !== session.token) {
      response.value = null;
      loadedToken.value = session.token;
    }
    if (!options.force && response.value) return;

    const requestId = ++latestRequestId;
    const requestToken = session.token;
    const requestUserId = session.user?.id ?? null;
    loading.value = true;
    try {
      const nextResponse = await apiFetch<SmartRecommendationResponseDto>(
        `/recommendations/me?locale=${encodeURIComponent(locale)}`,
        {},
        requestToken
      );
      if (!isCurrentRequest(requestId, requestToken, requestUserId)) return;

      response.value = nextResponse;
      loadedToken.value = requestToken;
      error.value = "";
    } catch {
      if (!isCurrentRequest(requestId, requestToken, requestUserId)) return;

      response.value = buildErrorResponse();
      error.value = "recommendation-load-failed";
    } finally {
      if (requestId === latestRequestId) loading.value = false;
    }
  }

  async function refresh(locale: SupportedLocale) {
    const session = useSessionStore();
    if (!session.token) {
      latestRequestId += 1;
      response.value = buildLoginRequiredResponse();
      loadedToken.value = null;
      loading.value = false;
      error.value = "";
      return;
    }

    const requestId = ++latestRequestId;
    const requestToken = session.token;
    const requestUserId = session.user?.id ?? null;
    loading.value = true;
    try {
      const nextResponse = await apiFetch<SmartRecommendationResponseDto>(
        "/recommendations/refresh",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "personalized-profile-match",
            locale
          })
        },
        requestToken
      );
      if (!isCurrentRequest(requestId, requestToken, requestUserId)) return;

      response.value = nextResponse;
      loadedToken.value = requestToken;
      error.value = "";
    } catch {
      if (!isCurrentRequest(requestId, requestToken, requestUserId)) return;

      loadedToken.value = requestToken;
      response.value = buildErrorResponse();
      error.value = "recommendation-refresh-failed";
    } finally {
      if (requestId === latestRequestId) loading.value = false;
    }
  }

  function clear() {
    latestRequestId += 1;
    response.value = null;
    loading.value = false;
    error.value = "";
    loadedToken.value = null;
  }

  function isCurrentRequest(requestId: number, requestToken: string, requestUserId: number | null) {
    return requestId === latestRequestId
      && session.token === requestToken
      && (session.user?.id ?? null) === requestUserId;
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
        "請先登入並完善已儲存的學生畫像，再查看個人化智能推薦。",
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
        "個人化推薦暫時不可用。",
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

function localized(en: string, zhCN: string, zhTW: string, ms: string): LocalizedText {
  return {
    en,
    ms,
    "zh-CN": zhCN,
    "zh-TW": zhTW
  };
}
