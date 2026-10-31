import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../pages/HomePage.vue";
import UniversityPage from "../pages/UniversityPage.vue";
import ProgramPage from "../pages/ProgramPage.vue";
import FavoritesPage from "../pages/FavoritesPage.vue";
import ComparePage from "../pages/ComparePage.vue";
import PlannerPage from "../pages/PlannerPage.vue";
import MemberPage from "../pages/MemberPage.vue";
import MemberApplicationDetailPage from "../pages/MemberApplicationDetailPage.vue";
import ApplicationProfilePage from "../pages/ApplicationProfilePage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomePage },
    { path: "/universities", component: HomePage },
    { path: "/universities/:slug", component: UniversityPage, props: true },
    { path: "/programs/:slug", component: ProgramPage, props: true },
    { path: "/favorites", component: FavoritesPage },
    { path: "/compare", component: ComparePage },
    { path: "/planner", component: PlannerPage },
    { path: "/onboarding", component: ApplicationProfilePage },
    { path: "/member", component: MemberPage },
    { path: "/member/profile/edit", component: ApplicationProfilePage },
    { path: "/member/applications/:id", component: MemberApplicationDetailPage }
  ]
});
