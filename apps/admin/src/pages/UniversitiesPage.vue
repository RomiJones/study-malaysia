<template>
  <section class="page-card">
    <div class="page-toolbar">
      <div class="page-toolbar__left">
        <el-input v-model="query.search" placeholder="搜索学校" clearable @change="load" />
        <el-select v-model="query.ownership" clearable placeholder="办学性质" @change="load"><el-option label="公立" value="public" /><el-option label="私立" value="private" /></el-select>
        <el-select v-model="query.published" clearable placeholder="发布状态" @change="load"><el-option label="已发布" value="true" /><el-option label="未发布" value="false" /></el-select>
      </div>
      <div class="page-toolbar__right"><el-button type="primary" @click="openCreate">新增学校</el-button></div>
    </div>
    <el-table :data="items" border>
      <el-table-column prop="shortName" label="简称" width="100" />
      <el-table-column label="学校名称" min-width="220"><template #default="scope">{{ scope.row.name['zh-CN'] }}</template></el-table-column>
      <el-table-column prop="ownership" label="性质" width="100" />
      <el-table-column prop="qsRank" label="QS" width="90" />
      <el-table-column prop="programCount" label="专业数" width="90" />
      <el-table-column label="状态" width="100"><template #default="scope"><el-tag :type="scope.row.isPublished ? 'success' : 'info'">{{ scope.row.isPublished ? '已发布' : '未发布' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="180"><template #default="scope"><div class="table-actions"><el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button><el-button link type="danger" @click="remove(scope.row)">删除</el-button></div></template></el-table-column>
    </el-table>
    <el-pagination style="margin-top: 16px" layout="prev, pager, next, total" :total="total" v-model:current-page="query.page" v-model:page-size="query.pageSize" @current-change="load" />
  </section>

  <el-dialog v-model="visible" title="学校管理" width="980px" top="4vh">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="Slug"><el-input v-model="form.slug" /></el-form-item>
        <el-form-item label="Code"><el-input v-model="form.code" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="简称"><el-input v-model="form.shortName" /></el-form-item>
        <el-form-item label="官网"><el-input v-model="form.website" /></el-form-item>
      </div>
      <LocaleTextTabs v-model="form.name" label="学校名称" />
      <LocaleTextTabs v-model="form.description" label="学校简介" textarea :rows="4" />
      <LocaleTextTabs v-model="form.location" label="城市" />
      <LocaleTextTabs v-model="form.region" label="地区" />
      <LocaleListTabs v-model="form.highlights" label="学校亮点" />
      <LocaleListTabs v-model="form.facilities" label="设施与资源" />
      <div class="split-grid">
        <el-form-item label="Logo URL"><el-input v-model="form.logoUrl" /></el-form-item>
        <el-form-item label="封面图 URL"><el-input v-model="form.imageUrl" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="办学性质"><el-select v-model="form.ownership"><el-option label="公立" value="public" /><el-option label="私立" value="private" /></el-select></el-form-item>
        <el-form-item label="院校类型"><el-select v-model="form.institutionType"><el-option label="研究型" value="research" /><el-option label="综合型" value="comprehensive" /><el-option label="应用型" value="applied" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="QS 排名"><el-input-number v-model="form.qsRank" :min="1" /></el-form-item>
        <el-form-item label="QS 亚洲排名"><el-input-number v-model="form.qsAsiaRank" :min="1" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="创立年份"><el-input-number v-model="form.foundedYear" :min="1900" /></el-form-item>
        <el-form-item label="年学费最低(CNY)"><el-input-number v-model="form.tuitionMinCny" :min="0" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="年学费最高(CNY)"><el-input-number v-model="form.tuitionMaxCny" :min="0" /></el-form-item>
        <el-form-item label="生活成本(CNY)"><el-input-number v-model="form.livingCostCny" :min="0" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="学生总数"><el-input-number v-model="form.students" :min="0" /></el-form-item>
        <el-form-item label="国际生数"><el-input-number v-model="form.intlStudents" :min="0" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="最低 IELTS"><el-input-number v-model="form.minIelts" :min="0" :max="9" :step="0.5" /></el-form-item>
        <el-form-item label="联系邮箱"><el-input v-model="form.admissionEmail" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="颜色"><el-input v-model="form.color" /></el-form-item>
        <el-form-item label="发布状态"><el-switch v-model="form.isPublished" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="接受无语言申请"><el-switch v-model="form.acceptNoLanguage" /></el-form-item>
        <el-form-item label="官方核验"><el-switch v-model="form.csrCertified" /></el-form-item>
      </div>
    </el-form>
    <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminApi } from "@/api/admin";
import LocaleTextTabs from "@/components/LocaleTextTabs.vue";
import LocaleListTabs from "@/components/LocaleListTabs.vue";
import { createLocaleArrayMap, createLocaleMap } from "@/utils/locale";

const items = ref<any[]>([]);
const total = ref(0);
const visible = ref(false);
const query = reactive({ page: 1, pageSize: 10, search: "", ownership: "", published: "" });
const form = reactive<any>({});
const resetForm = () => Object.assign(form, { id: undefined, slug: "", code: "", shortName: "", website: "", logoUrl: "", imageUrl: "", color: "#6C47FF", ownership: "public", institutionType: "research", qsRank: 100, qsAsiaRank: 50, foundedYear: 2000, tuitionMinCny: 30000, tuitionMaxCny: 80000, livingCostCny: 30000, students: 0, intlStudents: 0, minIelts: 5.5, admissionEmail: "", acceptNoLanguage: false, csrCertified: true, isPublished: true, name: createLocaleMap(), description: createLocaleMap(), location: createLocaleMap(), region: createLocaleMap(), highlights: createLocaleArrayMap(), facilities: createLocaleArrayMap() });

const load = async () => { const data = await adminApi.universities(query); items.value = data.items; total.value = data.total; };
const openCreate = () => { resetForm(); visible.value = true; };
const openEdit = (row: any) => { resetForm(); Object.assign(form, JSON.parse(JSON.stringify(row))); visible.value = true; };
const save = async () => { await adminApi.saveUniversity(form); ElMessage.success("已保存"); visible.value = false; await load(); };
const remove = async (row: any) => { await ElMessageBox.confirm(`确认删除 ${row.shortName}？`, "提示"); await adminApi.deleteUniversity(row.id); ElMessage.success("已删除"); await load(); };

onMounted(() => { resetForm(); load(); });
</script>
