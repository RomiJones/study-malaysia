<template>
  <div class="admin-layout">
    <aside class="admin-layout__sidebar">
      <div class="admin-layout__brand-card">
        <div class="admin-layout__brand">
          <div class="admin-layout__logo">S</div>
          <div>
            <div class="admin-layout__title">StudyMY Admin</div>
            <div class="admin-layout__subtitle">后台管理中心</div>
          </div>
        </div>
        <div class="admin-layout__brand-tip">教育留学数据管理与业务工作台</div>
      </div>

      <div class="admin-layout__nav-label">导航菜单</div>
      <el-menu :default-active="route.path" router class="admin-layout__menu">
        <template v-for="menu in auth.menuTree" :key="menu.id">
          <el-sub-menu v-if="menu.children?.length" :index="menu.path || String(menu.id)">
            <template #title>
              <component :is="resolveIcon(menu.icon)" class="menu-icon" />
              <span>{{ menu.title }}</span>
            </template>
            <el-menu-item v-for="child in menu.children" :key="child.id" :index="child.path">
              <component :is="resolveIcon(child.icon)" class="menu-icon" />
              <span>{{ child.title }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="menu.path">
            <component :is="resolveIcon(menu.icon)" class="menu-icon" />
            <span>{{ menu.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>

      <div class="admin-layout__sidebar-footer">
        <div class="admin-layout__operator-card">
          <div class="admin-layout__operator-avatar">{{ (auth.profile?.displayName || 'A').slice(0, 1) }}</div>
          <div class="admin-layout__operator-meta">
            <div class="admin-layout__operator-name">{{ auth.profile?.displayName || '管理员' }}</div>
            <div class="admin-layout__operator-role">{{ auth.profile?.roles?.map((item) => item.name).join(' / ') || '未分配角色' }}</div>
          </div>
        </div>
      </div>
    </aside>

    <section class="admin-layout__main">
      <header class="admin-layout__header">
        <div>
          <div class="admin-layout__page-title">{{ route.meta.title || '后台管理' }}</div>
          <el-breadcrumb>
            <el-breadcrumb-item>后台</el-breadcrumb-item>
            <el-breadcrumb-item>{{ route.meta.title || '仪表盘' }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="admin-layout__actions">
          <el-tag type="info" effect="plain">{{ auth.profile?.displayName }}</el-tag>
          <el-button @click="logout">退出登录</el-button>
        </div>
      </header>
      <main class="admin-layout__content">
        <RouterView />
      </main>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { resolveIcon } from "@/utils/icons";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const logout = () => {
  auth.logout();
  router.push("/login");
};
</script>