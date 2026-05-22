import { defineStore } from "pinia";
import { adminApi } from "@/api/admin";

export interface AdminProfile {
  id: number;
  username: string;
  email: string;
  displayName: string;
  isActive: boolean;
  dataScope: string;
  managedUniversityIds: number[];
  roles: Array<{ id: number; code: string; name: string }>;
  permissions: string[];
  menus: any[];
}

export const useAuthStore = defineStore("admin-auth", {
  state: () => ({
    token: localStorage.getItem("studymy-admin-token") || "",
    profile: null as AdminProfile | null,
    loading: false
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    permissions: (state) => new Set(state.profile?.permissions || []),
    menuTree: (state) => state.profile?.menus || []
  },
  actions: {
    async login(payload: { username: string; password: string }) {
      this.loading = true;
      try {
        const result = await adminApi.login(payload);
        this.token = result.accessToken;
        this.profile = result.user;
        localStorage.setItem("studymy-admin-token", this.token);
      } finally {
        this.loading = false;
      }
    },
    async loadProfile() {
      if (!this.token) return null;
      try {
        this.profile = await adminApi.me();
        return this.profile;
      } catch {
        this.logout();
        return null;
      }
    },
    logout() {
      this.token = "";
      this.profile = null;
      localStorage.removeItem("studymy-admin-token");
    },
    hasPermission(permission: string) {
      return this.permissions.has(permission);
    }
  }
});
