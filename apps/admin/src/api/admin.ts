import { http, unwrap } from "./client";

export type LocaleMap = { en: string; ms: string; "zh-CN": string; "zh-TW": string };
export type LocaleArrayMap = { en: string[]; ms: string[]; "zh-CN": string[]; "zh-TW": string[] };

const unwrapLoose = async (promise: Promise<any>) => {
  const response = await promise;
  return response.data?.data ?? response.data;
};

export const adminApi = {
  login: (payload: { username: string; password: string }) => unwrap(http.post("/admin/auth/login", payload)),
  me: () => unwrap(http.get("/admin/auth/me")),
  currentMenus: () => unwrap(http.get("/admin/access/menus/current")),
  dashboard: () => unwrap(http.get("/admin/dashboard")),
  permissions: (params?: Record<string, unknown>) => unwrap(http.get("/admin/access/permissions", { params })),
  savePermission: (payload: Record<string, unknown>) => unwrap(http.post("/admin/access/permissions", payload)),
  deletePermission: (id: number) => unwrap(http.delete(`/admin/access/permissions/${id}`)),
  roles: (params?: Record<string, unknown>) => unwrap(http.get("/admin/access/roles", { params })),
  saveRole: (payload: Record<string, unknown>) => unwrap(http.post("/admin/access/roles", payload)),
  deleteRole: (id: number) => unwrap(http.delete(`/admin/access/roles/${id}`)),
  admins: (params?: Record<string, unknown>) => unwrap(http.get("/admin/access/admins", { params })),
  saveAdmin: (payload: Record<string, unknown>) => unwrap(http.post("/admin/access/admins", payload)),
  deleteAdmin: (id: number) => unwrap(http.delete(`/admin/access/admins/${id}`)),
  menus: (params?: Record<string, unknown>) => unwrap(http.get("/admin/access/menus", { params })),
  saveMenu: (payload: Record<string, unknown>) => unwrap(http.post("/admin/access/menus", payload)),
  deleteMenu: (id: number) => unwrap(http.delete(`/admin/access/menus/${id}`)),
  universities: (params?: Record<string, unknown>) => unwrap(http.get("/admin/universities", { params })),
  saveUniversity: (payload: Record<string, unknown>) => unwrap(http.post("/admin/universities", payload)),
  deleteUniversity: (id: number) => unwrap(http.delete(`/admin/universities/${id}`)),
  programs: (params?: Record<string, unknown>) => unwrap(http.get("/admin/programs", { params })),
  saveProgram: (payload: Record<string, unknown>) => unwrap(http.post("/admin/programs", payload)),
  deleteProgram: (id: number) => unwrap(http.delete(`/admin/programs/${id}`)),
  content: (params?: Record<string, unknown>) => unwrap(http.get("/admin/content", { params })),
  saveContent: (key: string, payload: Record<string, unknown>) => unwrap(http.post(`/admin/content/${key}`, payload)),
  applications: (params?: Record<string, unknown>) => unwrap(http.get("/admin/applications", { params })),
  applicationDetail: (id: number) => unwrap(http.get(`/admin/applications/${id}`)),
  saveApplication: (payload: Record<string, unknown>) => unwrap(http.post("/admin/applications", payload)),
  saveFollowUp: (id: number, payload: Record<string, unknown>) => unwrap(http.post(`/admin/applications/${id}/follow-ups`, payload)),
  exportApplications: (params?: Record<string, unknown>) => unwrap(http.get("/admin/applications-export", { params })),
  configs: (category?: string) => unwrap(http.get("/admin/settings/configs", { params: category ? { category } : undefined })),
  saveConfig: (payload: Record<string, unknown>) => unwrap(http.post("/admin/settings/configs", payload)),
  dictionaries: (dictType?: string) => unwrap(http.get("/admin/settings/dictionaries", { params: dictType ? { dictType } : undefined })),
  saveDictionary: (payload: Record<string, unknown>) => unwrap(http.post("/admin/settings/dictionaries", payload)),
  logs: (params?: Record<string, unknown>) => unwrap(http.get("/admin/settings/logs", { params })),
  i18nOptions: (locale?: string) => unwrapLoose(http.get("/i18n/options", { params: locale ? { locale } : undefined })),
  switchLocale: (payload: Record<string, unknown>) => unwrapLoose(http.post("/i18n/switch", payload)),
  recommendationContract: () => unwrapLoose(http.get("/recommendations/contract"))
};