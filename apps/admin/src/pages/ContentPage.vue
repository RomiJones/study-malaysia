<template>
  <section class="page-card" v-loading="loading">
    <div class="page-toolbar">
      <div class="page-toolbar__left">
        <el-input v-model="query.search" placeholder="搜索内容块 key" clearable @change="load" />
      </div>
      <div class="page-toolbar__right">
        <el-button type="primary" :disabled="!canUpdate" @click="openCreate">新增内容块</el-button>
      </div>
    </div>
    <el-table :data="items" border>
      <el-table-column prop="key" label="Key" min-width="200" />
      <el-table-column label="标题(简中)" min-width="220">
        <template #default="scope">{{ scope.row.title?.["zh-CN"] }}</template>
      </el-table-column>
      <el-table-column label="正文(简中)" min-width="300">
        <template #default="scope">{{ scope.row.body?.["zh-CN"] }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="scope">
          <el-button link type="primary" :disabled="!canUpdate" @click="openEdit(scope.row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>

  <el-dialog v-model="visible" title="内容块编辑" width="900px" destroy-on-close>
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" status-icon>
      <el-form-item label="Key" prop="key"><el-input v-model="form.key" :disabled="Boolean(form.id)" /></el-form-item>
      <LocaleTextTabs v-model="form.title" label="标题" />
      <LocaleTextTabs v-model="form.body" label="正文" textarea :rows="8" />
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!canUpdate" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { adminApi } from "@/api/admin";
import LocaleTextTabs from "@/components/LocaleTextTabs.vue";
import { createLocaleMap } from "@/utils/locale";
import { useAccess } from "@/utils/access";

const { hasPermission } = useAccess();
const canUpdate = computed(() => hasPermission("content:update"));
const query = reactive({ search: "" });
const items = ref<any[]>([]);
const visible = ref(false);
const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<any>({ id: undefined, key: "", title: createLocaleMap(), body: createLocaleMap() });

const rules = reactive<FormRules>({
  key: [
    { required: true, message: "请输入内容块 Key", trigger: "blur" },
    { pattern: /^[a-zA-Z0-9_.:-]+$/, message: "Key 只能包含英文、数字、点、冒号、下划线或中划线", trigger: "blur" }
  ]
});

const resetForm = () => {
  Object.assign(form, { id: undefined, key: "", title: createLocaleMap(), body: createLocaleMap() });
};

const load = async () => {
  loading.value = true;
  try {
    items.value = await adminApi.content(query);
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  resetForm();
  visible.value = true;
};

const openEdit = (row: any) => {
  resetForm();
  Object.assign(form, JSON.parse(JSON.stringify(row)));
  visible.value = true;
};

const save = async () => {
  if (!canUpdate.value) return;
  try {
    await formRef.value?.validate();
    if (!form.title?.["zh-CN"]?.trim()) throw new Error("请填写简中标题");
    if (!form.body?.["zh-CN"]?.trim()) throw new Error("请填写简中正文");
    saving.value = true;
    await adminApi.saveContent(form.key, { title: form.title, body: form.body });
    ElMessage.success("已保存");
    visible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "请检查表单必填项");

onMounted(load);
</script>
