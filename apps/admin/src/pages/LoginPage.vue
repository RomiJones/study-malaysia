<template>
  <div class="login-shell">
    <div class="login-card">
      <div class="login-card__title">StudyMY Admin</div>
      <div class="login-card__subtitle">管理员登录与权限工作台</div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="superadmin / superadmin@studymy.local" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-button type="primary" style="width: 100%" :loading="auth.loading" @click="submit">登录</el-button>
      </el-form>
      <el-alert title="默认账号：superadmin / Admin123!" type="info" :closable="false" style="margin-top: 18px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const form = reactive({ username: "superadmin", password: "Admin123!" });

const submit = async () => {
  try {
    await auth.login(form);
    ElMessage.success("登录成功");
    router.push((route.query.redirect as string) || "/dashboard");
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
};
</script>
