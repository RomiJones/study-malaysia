<template>
  <div class="split-grid" style="grid-template-columns: 1.2fr 1fr">
    <section class="page-card">
      <div class="page-toolbar"><strong>系统配置</strong><el-button type="primary" @click="openConfig">新增配置</el-button></div>
      <el-table :data="configs" border>
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="configKey" label="Key" min-width="160" />
        <el-table-column prop="label" label="名称" min-width="140" />
        <el-table-column prop="value" label="值" min-width="180" />
        <el-table-column label="操作" width="120"><template #default="scope"><el-button link type="primary" @click="editConfig(scope.row)">编辑</el-button></template></el-table-column>
      </el-table>
    </section>
    <section class="page-card">
      <div class="page-toolbar"><strong>字典项</strong><el-button type="primary" @click="openDict">新增字典</el-button></div>
      <el-table :data="dictionaries" border max-height="520">
        <el-table-column prop="dictType" label="类型" width="140" />
        <el-table-column prop="code" label="Code" width="120" />
        <el-table-column prop="label" label="标签" min-width="120" />
        <el-table-column label="操作" width="120"><template #default="scope"><el-button link type="primary" @click="editDict(scope.row)">编辑</el-button></template></el-table-column>
      </el-table>
    </section>
  </div>

  <section class="page-card">
    <div class="page-toolbar"><strong>操作日志</strong></div>
    <el-table :data="logs" border>
      <el-table-column prop="createdAt" label="时间" min-width="180" />
      <el-table-column prop="module" label="模块" width="120" />
      <el-table-column prop="action" label="动作" width="120" />
      <el-table-column prop="summary" label="摘要" min-width="240" />
      <el-table-column label="操作人" width="140"><template #default="scope">{{ scope.row.adminUser?.displayName || 'system' }}</template></el-table-column>
    </el-table>
  </section>

  <el-dialog v-model="configVisible" title="系统配置" width="560px">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="分类"><el-input v-model="configForm.category" /></el-form-item>
        <el-form-item label="Key"><el-input v-model="configForm.configKey" /></el-form-item>
      </div>
      <el-form-item label="名称"><el-input v-model="configForm.label" /></el-form-item>
      <el-form-item label="值"><el-input v-model="configForm.value" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="说明"><el-input v-model="configForm.description" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="configVisible = false">取消</el-button><el-button type="primary" @click="saveConfig">保存</el-button></template>
  </el-dialog>

  <el-dialog v-model="dictVisible" title="字典项" width="560px">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="类型"><el-input v-model="dictForm.dictType" /></el-form-item>
        <el-form-item label="Code"><el-input v-model="dictForm.code" /></el-form-item>
      </div>
      <el-form-item label="标签"><el-input v-model="dictForm.label" /></el-form-item>
      <div class="split-grid">
        <el-form-item label="状态"><el-select v-model="dictForm.status"><el-option label="enabled" value="enabled" /><el-option label="disabled" value="disabled" /></el-select></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="dictForm.sortOrder" :min="0" /></el-form-item>
      </div>
    </el-form>
    <template #footer><el-button @click="dictVisible = false">取消</el-button><el-button type="primary" @click="saveDict">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminApi } from "@/api/admin";

const configs = ref<any[]>([]);
const dictionaries = ref<any[]>([]);
const logs = ref<any[]>([]);
const configVisible = ref(false);
const dictVisible = ref(false);
const configForm = reactive<any>({ id: undefined, category: "site", configKey: "", label: "", value: "", description: "", sortOrder: 0, isPublic: false });
const dictForm = reactive<any>({ id: undefined, dictType: "", code: "", label: "", status: "enabled", sortOrder: 0, extra: null });

const load = async () => {
  configs.value = await adminApi.configs();
  dictionaries.value = await adminApi.dictionaries();
  logs.value = (await adminApi.logs({ page: 1, pageSize: 20 })).items;
};
const openConfig = () => { Object.assign(configForm, { id: undefined, category: "site", configKey: "", label: "", value: "", description: "", sortOrder: 0, isPublic: false }); configVisible.value = true; };
const editConfig = (row: any) => { Object.assign(configForm, row); configVisible.value = true; };
const saveConfig = async () => { await adminApi.saveConfig(configForm); ElMessage.success("已保存"); configVisible.value = false; await load(); };
const openDict = () => { Object.assign(dictForm, { id: undefined, dictType: "", code: "", label: "", status: "enabled", sortOrder: 0, extra: null }); dictVisible.value = true; };
const editDict = (row: any) => { Object.assign(dictForm, row); dictVisible.value = true; };
const saveDict = async () => { await adminApi.saveDictionary(dictForm); ElMessage.success("已保存"); dictVisible.value = false; await load(); };

onMounted(load);
</script>
