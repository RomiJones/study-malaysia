<template>
  <section class="page-card">
    <div class="page-toolbar">
      <div class="page-toolbar__left"><el-input v-model="query.search" placeholder="搜索管理员" clearable @change="load" /></div>
      <div class="page-toolbar__right"><el-button type="primary" @click="openCreate">新增管理员</el-button></div>
    </div>
    <el-table :data="items" border>
      <el-table-column prop="displayName" label="姓名" min-width="140" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column prop="email" label="邮箱" min-width="220" />
      <el-table-column label="角色" min-width="200"><template #default="scope">{{ (scope.row.roles || []).map((item: any) => item.name).join(' / ') }}</template></el-table-column>
      <el-table-column prop="dataScope" label="数据范围" width="120" />
      <el-table-column label="启用" width="100"><template #default="scope"><el-tag :type="scope.row.isActive ? 'success' : 'info'">{{ scope.row.isActive ? '启用' : '停用' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="scope">
          <div class="table-actions">
            <el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button>
            <el-button link type="danger" @click="remove(scope.row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination style="margin-top: 16px" layout="prev, pager, next, total" :total="total" v-model:current-page="query.page" v-model:page-size="query.pageSize" @current-change="load" />
  </section>

  <el-dialog v-model="visible" title="管理员账号" width="720px">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.displayName" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password placeholder="编辑时留空表示不修改" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="数据范围"><el-select v-model="form.dataScope"><el-option label="全部" value="all" /><el-option label="指派" value="assigned" /><el-option label="本人创建" value="created" /></el-select></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.isActive" /></el-form-item>
      </div>
      <el-form-item label="角色"><el-select v-model="form.roleIds" multiple filterable><el-option v-for="item in roleOptions" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
    </el-form>
    <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminApi } from "@/api/admin";

const items = ref<any[]>([]);
const total = ref(0);
const roleOptions = ref<any[]>([]);
const query = reactive({ page: 1, pageSize: 10, search: "" });
const visible = ref(false);
const form = reactive({ id: undefined as number | undefined, username: "", displayName: "", email: "", password: "", isActive: true, dataScope: "assigned", roleIds: [] as number[] });

const load = async () => {
  const data = await adminApi.admins(query);
  items.value = data.items;
  total.value = data.total;
  roleOptions.value = await adminApi.roles({});
};
const openCreate = () => { Object.assign(form, { id: undefined, username: "", displayName: "", email: "", password: "", isActive: true, dataScope: "assigned", roleIds: [] }); visible.value = true; };
const openEdit = (row: any) => { Object.assign(form, { ...row, password: "", roleIds: [...(row.roleIds || [])] }); visible.value = true; };
const save = async () => { await adminApi.saveAdmin(form); ElMessage.success("已保存"); visible.value = false; await load(); };
const remove = async (row: any) => { await ElMessageBox.confirm(`确认删除管理员 ${row.displayName}？`, "提示"); await adminApi.deleteAdmin(row.id); ElMessage.success("已删除"); await load(); };

onMounted(load);
</script>