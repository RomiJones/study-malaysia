<template>
  <section class="page-card">
    <div class="page-toolbar">
      <div class="page-toolbar__left">
        <el-input v-model="query.search" placeholder="搜索 code / 名称 / 分组" clearable @change="load" />
      </div>
      <div class="page-toolbar__right">
        <el-button type="primary" @click="openCreate">新增权限点</el-button>
      </div>
    </div>
    <el-table :data="items" border>
      <el-table-column prop="groupName" label="分组" width="140" />
      <el-table-column prop="code" label="Code" min-width="220" />
      <el-table-column prop="name" label="名称" min-width="160" />
      <el-table-column prop="description" label="说明" min-width="220" />
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

  <el-dialog v-model="visible" title="权限点" width="520px">
    <el-form label-position="top">
      <el-form-item label="Code"><el-input v-model="form.code" /></el-form-item>
      <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="分组"><el-input v-model="form.groupName" /></el-form-item>
      <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminApi } from "@/api/admin";

const items = ref<any[]>([]);
const total = ref(0);
const visible = ref(false);
const query = reactive({ page: 1, pageSize: 10, search: "" });
const form = reactive({ id: undefined as number | undefined, code: "", name: "", groupName: "general", description: "" });

const load = async () => {
  const data = await adminApi.permissions(query);
  items.value = data.items;
  total.value = data.total;
};
const openCreate = () => {
  Object.assign(form, { id: undefined, code: "", name: "", groupName: "general", description: "" });
  visible.value = true;
};
const openEdit = (row: any) => {
  Object.assign(form, row);
  visible.value = true;
};
const save = async () => {
  await adminApi.savePermission(form);
  ElMessage.success("已保存");
  visible.value = false;
  await load();
};
const remove = async (row: any) => {
  await ElMessageBox.confirm(`确认删除权限点 ${row.code}？`, "提示");
  await adminApi.deletePermission(row.id);
  ElMessage.success("已删除");
  await load();
};

onMounted(load);
</script>