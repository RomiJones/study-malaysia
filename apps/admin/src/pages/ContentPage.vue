<template>
  <section class="page-card">
    <div class="page-toolbar">
      <div class="page-toolbar__left"><el-input v-model="query.search" placeholder="搜索内容块 key" clearable @change="load" /></div>
    </div>
    <el-table :data="items" border>
      <el-table-column prop="key" label="Key" min-width="200" />
      <el-table-column label="标题(简中)" min-width="220"><template #default="scope">{{ scope.row.title['zh-CN'] }}</template></el-table-column>
      <el-table-column label="操作" width="120"><template #default="scope"><el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button></template></el-table-column>
    </el-table>
  </section>

  <el-dialog v-model="visible" title="内容块编辑" width="900px">
    <el-form label-position="top">
      <el-form-item label="Key"><el-input v-model="form.key" disabled /></el-form-item>
      <LocaleTextTabs v-model="form.title" label="标题" />
      <LocaleTextTabs v-model="form.body" label="正文" textarea :rows="8" />
    </el-form>
    <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminApi } from "@/api/admin";
import LocaleTextTabs from "@/components/LocaleTextTabs.vue";

const query = reactive({ search: "" });
const items = ref<any[]>([]);
const visible = ref(false);
const form = reactive<any>({ key: "", title: {}, body: {} });

const load = async () => { items.value = await adminApi.content(query); };
const openEdit = (row: any) => { Object.assign(form, JSON.parse(JSON.stringify(row))); visible.value = true; };
const save = async () => { await adminApi.saveContent(form.key, { title: form.title, body: form.body }); ElMessage.success("已保存"); visible.value = false; await load(); };

onMounted(load);
</script>
