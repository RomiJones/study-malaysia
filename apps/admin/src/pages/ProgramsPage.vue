<template>
  <section class="page-card">
    <div class="page-toolbar">
      <div class="page-toolbar__left">
        <el-input v-model="query.search" placeholder="搜索专业" clearable @change="load" />
        <el-select v-model="query.universityId" clearable placeholder="学校" @change="load"><el-option v-for="item in universities" :key="item.id" :label="item.shortName" :value="item.id" /></el-select>
        <el-select v-model="query.level" clearable placeholder="层级" @change="load"><el-option label="本科" value="bachelor" /><el-option label="硕士" value="master" /><el-option label="博士" value="phd" /></el-select>
      </div>
      <div class="page-toolbar__right"><el-button type="primary" @click="openCreate">新增专业</el-button></div>
    </div>
    <el-table :data="items" border>
      <el-table-column label="专业名称" min-width="220"><template #default="scope">{{ scope.row.name['zh-CN'] }}</template></el-table-column>
      <el-table-column prop="code" label="Code" width="140" />
      <el-table-column label="学校" min-width="160"><template #default="scope">{{ scope.row.university?.shortName }}</template></el-table-column>
      <el-table-column prop="level" label="层级" width="100" />
      <el-table-column prop="category" label="学科" width="120" />
      <el-table-column prop="annualTuitionCny" label="年学费" width="110" />
      <el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="scope.row.isPublished ? 'success' : 'info'">{{ scope.row.isPublished ? '已发布' : '未发布' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="180"><template #default="scope"><div class="table-actions"><el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button><el-button link type="danger" @click="remove(scope.row)">删除</el-button></div></template></el-table-column>
    </el-table>
    <el-pagination style="margin-top: 16px" layout="prev, pager, next, total" :total="total" v-model:current-page="query.page" v-model:page-size="query.pageSize" @current-change="load" />
  </section>

  <el-dialog v-model="visible" title="专业管理" width="980px" top="4vh">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="所属学校"><el-select v-model="form.universityId"><el-option v-for="item in universities" :key="item.id" :label="item.shortName" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="Code"><el-input v-model="form.code" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="Slug"><el-input v-model="form.slug" /></el-form-item>
        <el-form-item label="层级"><el-select v-model="form.level"><el-option label="本科" value="bachelor" /><el-option label="硕士" value="master" /><el-option label="博士" value="phd" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="学科分类"><el-select v-model="form.category"><el-option label="商科" value="business" /><el-option label="IT" value="it" /><el-option label="工科" value="engineering" /><el-option label="理科" value="science" /><el-option label="艺术" value="arts" /><el-option label="医学" value="medicine" /><el-option label="法学" value="law" /></el-select></el-form-item>
        <el-form-item label="发布状态"><el-switch v-model="form.isPublished" /></el-form-item>
      </div>
      <LocaleTextTabs v-model="form.name" label="专业名称" />
      <LocaleTextTabs v-model="form.faculty" label="学院" />
      <LocaleTextTabs v-model="form.description" label="专业简介" textarea :rows="4" />
      <LocaleListTabs v-model="form.applicationDocs" label="申请材料" />
      <LocaleListTabs v-model="form.curriculum" label="课程结构" />
      <LocaleListTabs v-model="form.careers" label="就业方向" />
      <LocaleListTabs v-model="form.specializations" label="方向与特色" />
      <div class="split-grid">
        <el-form-item label="学制(年)"><el-input-number v-model="form.durationYears" :min="1" :step="0.5" /></el-form-item>
        <el-form-item label="年学费(CNY)"><el-input-number v-model="form.annualTuitionCny" :min="0" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="IELTS"><el-input-number v-model="form.languageRequirement.ielts" :min="0" :max="9" :step="0.5" /></el-form-item>
        <el-form-item label="GPA"><el-input-number v-model="form.requirement.gpa" :min="0" :max="4" :step="0.1" /></el-form-item>
      </div>
      <el-form-item label="入学月份（逗号分隔）"><el-input v-model="intakeMonthsText" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminApi } from "@/api/admin";
import LocaleTextTabs from "@/components/LocaleTextTabs.vue";
import LocaleListTabs from "@/components/LocaleListTabs.vue";
import { createLocaleArrayMap, createLocaleMap } from "@/utils/locale";

const items = ref<any[]>([]);
const universities = ref<any[]>([]);
const total = ref(0);
const visible = ref(false);
const query = reactive({ page: 1, pageSize: 10, search: "", universityId: undefined as number | undefined, level: "" });
const form = reactive<any>({});
const intakeMonthsText = computed({
  get: () => (form.intakeMonths || []).join(", "),
  set: (value: string) => { form.intakeMonths = value.split(",").map((item) => item.trim()).filter(Boolean); }
});
const resetForm = () => Object.assign(form, { id: undefined, universityId: undefined, slug: "", code: "", level: "bachelor", category: "business", isPublished: true, durationYears: 4, annualTuitionCny: 30000, intakeMonths: ["September"], languageRequirement: { ielts: 5.5, toefl: 60, pte: 50, muet: 4 }, requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: createLocaleMap() }, name: createLocaleMap(), faculty: createLocaleMap(), description: createLocaleMap(), applicationDocs: createLocaleArrayMap(), curriculum: createLocaleArrayMap(), careers: createLocaleArrayMap(), specializations: createLocaleArrayMap() });

const load = async () => { const data = await adminApi.programs(query); items.value = data.items; total.value = data.total; };
const loadUniversities = async () => { const data = await adminApi.universities({ page: 1, pageSize: 200 }); universities.value = data.items; };
const openCreate = () => { resetForm(); visible.value = true; };
const openEdit = (row: any) => { resetForm(); Object.assign(form, JSON.parse(JSON.stringify(row))); visible.value = true; };
const save = async () => { await adminApi.saveProgram(form); ElMessage.success("已保存"); visible.value = false; await load(); };
const remove = async (row: any) => { await ElMessageBox.confirm(`确认删除 ${row.code}？`, "提示"); await adminApi.deleteProgram(row.id); ElMessage.success("已删除"); await load(); };

onMounted(async () => { resetForm(); await loadUniversities(); await load(); });
</script>
