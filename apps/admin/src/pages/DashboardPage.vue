<template>
  <div>
    <div class="metrics-grid">
      <div class="metric-card" v-for="metric in metrics" :key="metric.label">
        <div class="metric-card__label">{{ metric.label }}</div>
        <div class="metric-card__value">{{ metric.value }}</div>
      </div>
    </div>
    <div class="split-grid">
      <section class="page-card">
        <div class="page-toolbar"><strong>申请阶段分布</strong></div>
        <el-table :data="stageBoard" size="small">
          <el-table-column prop="status" label="阶段" />
          <el-table-column prop="count" label="数量" />
        </el-table>
      </section>
      <section class="page-card">
        <div class="page-toolbar"><strong>当前权限概览</strong></div>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="管理员">{{ auth.profile?.displayName }}</el-descriptions-item>
          <el-descriptions-item label="角色">{{ roleNames }}</el-descriptions-item>
          <el-descriptions-item label="权限点数量">{{ auth.profile?.permissions.length || 0 }}</el-descriptions-item>
          <el-descriptions-item label="数据范围">{{ auth.profile?.dataScope }}</el-descriptions-item>
        </el-descriptions>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { adminApi } from "@/api/admin";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const data = ref<any>({ overview: {}, stageBoard: [] });
const metrics = computed(() => [
  { label: "学校数量", value: data.value.overview.schoolCount || 0 },
  { label: "专业数量", value: data.value.overview.programCount || 0 },
  { label: "申请数量", value: data.value.overview.applicationCount || 0 },
  { label: "待处理申请", value: data.value.overview.pendingCount || 0 }
]);
const stageBoard = computed(() => data.value.stageBoard || []);
const roleNames = computed(() => (auth.profile?.roles || []).map((item) => item.name).join(" / "));

onMounted(async () => {
  data.value = await adminApi.dashboard();
});
</script>
