import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { AuthPayload, AuthResponse } from "@studymy/shared";
import { apiFetch } from "../api/client";

const TOKEN_KEY = "studymy_token";
const USER_KEY = "studymy_user";

export const useSessionStore = defineStore("session", () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const user = ref<AuthResponse["user"] | null>(JSON.parse(localStorage.getItem(USER_KEY) || "null"));
  const authOpen = ref(false);
  const authMode = ref<"login" | "register">("login");

  const isLoggedIn = computed(() => Boolean(token.value));

  function openAuth(mode: "login" | "register" = "login") {
    authMode.value = mode;
    authOpen.value = true;
  }

  function closeAuth() {
    authOpen.value = false;
  }

  async function submitAuth(mode: "login" | "register", payload: AuthPayload) {
    const response = await apiFetch<AuthResponse>(`/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    token.value = response.accessToken;
    user.value = response.user;
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    authOpen.value = false;
    return response.user;
  }

  async function hydrateUser() {
    if (!token.value) return null;
    try {
      const profile = await apiFetch<AuthResponse["user"]>("/auth/me", {}, token.value);
      user.value = profile;
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      return profile;
    } catch {
      logout();
      return null;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return {
    token,
    user,
    authOpen,
    authMode,
    isLoggedIn,
    openAuth,
    closeAuth,
    submitAuth,
    hydrateUser,
    logout
  };
});
