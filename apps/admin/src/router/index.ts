import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import AdminLayout from "@/layouts/AdminLayout.vue";

const LoginPage = () => import("@/pages/LoginPage.vue");
const DashboardPage = () => import("@/pages/DashboardPage.vue");
const AdminUsersPage = () => import("@/pages/AdminUsersPage.vue");
const RolesPage = () => import("@/pages/RolesPage.vue");
const PermissionsPage = () => import("@/pages/PermissionsPage.vue");
const MenusPage = () => import("@/pages/MenusPage.vue");
const UniversitiesPage = () => import("@/pages/UniversitiesPage.vue");
const ProgramsPage = () => import("@/pages/ProgramsPage.vue");
const FeeReviewPage = () => import("@/pages/FeeReviewPage.vue");
const ContentPage = () => import("@/pages/ContentPage.vue");
const ApplicationsPage = () => import("@/pages/ApplicationsPage.vue");
const SettingsPage = () => import("@/pages/SettingsPage.vue");
const NotionTasksPage = () => import("@/pages/NotionTasksPage.vue");
const LocalizationPage = () => import("@/pages/LocalizationPage.vue");
const SmartRecommendationsPage = () => import("@/pages/SmartRecommendationsPage.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginPage, meta: { public: true, title: "登录" } },
    {
      path: "/",
      component: AdminLayout,
      children: [
        { path: "", redirect: "/dashboard" },
        { path: "/dashboard", name: "dashboard", component: DashboardPage, meta: { title: "仪表盘", permission: "dashboard:view" } },
        { path: "/admins", name: "admins", component: AdminUsersPage, meta: { title: "管理员", permission: "admin-user:view" } },
        { path: "/roles", name: "roles", component: RolesPage, meta: { title: "角色管理", permission: "role:view" } },
        { path: "/permissions", name: "permissions", component: PermissionsPage, meta: { title: "权限点", permission: "permission:view" } },
        { path: "/menus", name: "menus", component: MenusPage, meta: { title: "菜单管理", permission: "menu:view" } },
        { path: "/universities", name: "universities", component: UniversitiesPage, meta: { title: "学校管理", permission: "school:view" } },
        { path: "/programs", name: "programs", component: ProgramsPage, meta: { title: "专业管理", permission: "program:view" } },
        { path: "/fee-review", name: "fee-review", component: FeeReviewPage, meta: { title: "费用复核工作台", permission: "program:view" } },
        { path: "/content", name: "content", component: ContentPage, meta: { title: "内容管理", permission: "content:view" } },
        { path: "/notion-tasks", name: "notion-tasks", component: NotionTasksPage, meta: { title: "Notion 任务", permission: "settings:view" } },
        { path: "/localization", name: "localization", component: LocalizationPage, meta: { title: "多语言切换", permission: "settings:view" } },
        { path: "/smart-recommendations", name: "smart-recommendations", component: SmartRecommendationsPage, meta: { title: "智能推荐", permission: "settings:view" } },
        { path: "/applications", name: "applications", component: ApplicationsPage, meta: { title: "学生申请", permission: "application:view" } },
        { path: "/settings", name: "settings", component: SettingsPage, meta: { title: "系统设置", permission: "settings:view" } }
      ]
    }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (auth.isAuthenticated && !auth.profile) {
      await auth.loadProfile();
    }
    return true;
  }
  if (!auth.isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  if (!auth.profile) {
    const profile = await auth.loadProfile();
    if (!profile) {
      return { path: "/login", query: { redirect: to.fullPath } };
    }
  }
  const required = to.meta.permission as string | undefined;
  if (required && !auth.hasPermission(required)) {
    return "/dashboard";
  }
  return true;
});

export default router;
