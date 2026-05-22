<template>
  <section class="page-card">
    <div class="page-toolbar">
      <div class="page-toolbar__left">
        <el-input v-model="query.search" placeholder="搜索申请号 / 学生" clearable @change="load" />
        <el-select v-model="query.status" clearable placeholder="申请状态" @change="load"><el-option label="待整理" value="draft" /><el-option label="已递交" value="submitted" /><el-option label="审核中" value="reviewing" /><el-option label="Offer" value="offer" /><el-option label="签证" value="visa" /><el-option label="完成" value="done" /></el-select>
        <el-select v-model="query.universityId" clearable placeholder="学校" filterable @change="load"><el-option v-for="item in universities" :key="item.id" :label="item.shortName" :value="item.id" /></el-select>
        <el-select v-model="query.programId" clearable placeholder="专业" filterable @change="load"><el-option v-for="item in filteredProgramsForQuery" :key="item.id" :label="`${item.university?.shortName || ''} / ${item.name['zh-CN']}`" :value="item.id" /></el-select>
        <el-date-picker v-model="query.dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" @change="load" />
      </div>
      <div class="page-toolbar__right"><el-button @click="exportRows">导出列表</el-button><el-button type="primary" @click="openCreate">新增申请</el-button></div>
    </div>
    <el-table :data="items" border>
      <el-table-column prop="applicationNo" label="申请号" min-width="160" />
      <el-table-column prop="studentName" label="学生姓名" width="120" />
      <el-table-column prop="studentEmail" label="学生邮箱" min-width="200" />
      <el-table-column prop="universityName" label="学校" min-width="160" />
      <el-table-column prop="programName" label="专业" min-width="200" />
      <el-table-column prop="applicationStatus" label="状态" width="110" />
      <el-table-column prop="assignedAdminName" label="负责人" width="120" />
      <el-table-column label="操作" width="180"><template #default="scope"><div class="table-actions"><el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button><el-button link @click="openFollowUp(scope.row)">跟进</el-button></div></template></el-table-column>
    </el-table>
    <el-pagination style="margin-top: 16px" layout="prev, pager, next, total" :total="total" v-model:current-page="query.page" v-model:page-size="query.pageSize" @current-change="load" />
  </section>

  <el-dialog v-model="visible" title="申请管理" width="900px">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="学生姓名"><el-input v-model="form.studentName" /></el-form-item>
        <el-form-item label="学生邮箱"><el-input v-model="form.studentEmail" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="手机号"><el-input v-model="form.studentPhone" /></el-form-item>
        <el-form-item label="入学批次"><el-input v-model="form.intake" placeholder="2026-09" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="学校"><el-select v-model="form.universityId"><el-option v-for="item in universities" :key="item.id" :label="item.shortName" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="专业"><el-select v-model="form.programId" filterable><el-option v-for="item in filteredPrograms" :key="item.id" :label="`${item.university?.shortName || ''} / ${item.name['zh-CN']}`" :value="item.id" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="申请状态"><el-select v-model="form.applicationStatus"><el-option label="待整理" value="draft" /><el-option label="已递交" value="submitted" /><el-option label="审核中" value="reviewing" /><el-option label="Offer" value="offer" /><el-option label="签证" value="visa" /><el-option label="完成" value="done" /></el-select></el-form-item>
        <el-form-item label="当前阶段"><el-select v-model="form.currentStage"><el-option label="draft" value="draft" /><el-option label="materials" value="materials" /><el-option label="ready" value="ready" /><el-option label="review" value="review" /><el-option label="conditional-offer" value="conditional-offer" /><el-option label="visa" value="visa" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="材料状态"><el-select v-model="form.materialStatus"><el-option label="draft" value="draft" /><el-option label="progress" value="progress" /><el-option label="done" value="done" /></el-select></el-form-item>
        <el-form-item label="签证状态"><el-select v-model="form.visaStatus"><el-option label="not-started" value="not-started" /><el-option label="preparing" value="preparing" /><el-option label="submitted" value="submitted" /><el-option label="approved" value="approved" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="优先级"><el-select v-model="form.priority"><el-option label="low" value="low" /><el-option label="medium" value="medium" /><el-option label="high" value="high" /></el-select></el-form-item>
        <el-form-item label="负责人"><el-select v-model="form.assignedAdminId" clearable><el-option v-for="item in admins" :key="item.id" :label="item.displayName" :value="item.id" /></el-select></el-form-item>
      </div>
      <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
  </el-dialog>

  <el-dialog v-model="followVisible" title="申请跟进" width="760px">
    <el-form label-position="top">
      <el-form-item label="跟进内容"><el-input v-model="followUp.content" type="textarea" :rows="4" /></el-form-item>
      <div class="split-grid">
        <el-form-item label="跟进类型"><el-select v-model="followUp.followUpType"><el-option label="note" value="note" /><el-option label="status" value="status" /><el-option label="assign" value="assign" /><el-option label="material" value="material" /><el-option label="visa" value="visa" /></el-select></el-form-item>
        <el-form-item label="更新状态"><el-select v-model="followUp.statusTo" clearable><el-option label="draft" value="draft" /><el-option label="submitted" value="submitted" /><el-option label="reviewing" value="reviewing" /><el-option label="offer" value="offer" /><el-option label="visa" value="visa" /><el-option label="done" value="done" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="下一个动作"><el-input v-model="followUp.nextStep" /></el-form-item>
        <el-form-item label="改派负责人"><el-select v-model="followUp.assignAdminId" clearable><el-option v-for="item in admins" :key="item.id" :label="item.displayName" :value="item.id" /></el-select></el-form-item>
      </div>
      <el-form-item label="历史记录">
        <div class="json-box" style="width: 100%; max-height: 240px">{{ JSON.stringify(currentDetail?.followUps || [], null, 2) }}</div>
      </el-form-item>
    </el-form>
    <template #footer><el-button @click="followVisible = false">取消</el-button><el-button type="primary" @click="saveFollowUp">保存跟进</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminApi } from "@/api/admin";

const items = ref<any[]>([]);
const universities = ref<any[]>([]);
const programs = ref<any[]>([]);
const admins = ref<any[]>([]);
const total = ref(0);
const visible = ref(false);
const followVisible = ref(false);
const currentDetail = ref<any>(null);
const currentId = ref<number | null>(null);
const query = reactive({ page: 1, pageSize: 10, search: "", status: "", universityId: undefined as number | undefined, programId: undefined as number | undefined, dateRange: [] as string[] });
const form = reactive<any>({});
const followUp = reactive({ followUpType: "note", content: "", nextStep: "", statusTo: "", assignAdminId: undefined as number | undefined });
const filteredPrograms = computed(() => programs.value.filter((item) => !form.universityId || item.universityId === form.universityId));
const filteredProgramsForQuery = computed(() => programs.value.filter((item) => !query.universityId || item.universityId === query.universityId));
const requestParams = computed(() => ({
  page: query.page,
  pageSize: query.pageSize,
  search: query.search,
  status: query.status,
  universityId: query.universityId,
  programId: query.programId,
  startDate: query.dateRange?.[0] || undefined,
  endDate: query.dateRange?.[1] || undefined
}));
const resetForm = () => Object.assign(form, { id: undefined, studentName: "", studentEmail: "", studentPhone: "", universityId: undefined, programId: undefined, applicationStatus: "draft", currentStage: "draft", materialStatus: "draft", visaStatus: "not-started", priority: "medium", intake: "2026-09", assignedAdminId: undefined, notes: "" });

const load = async () => { const data = await adminApi.applications(requestParams.value); items.value = data.items; total.value = data.total; };
const loadLookups = async () => {
  universities.value = (await adminApi.universities({ page: 1, pageSize: 200 })).items;
  programs.value = (await adminApi.programs({ page: 1, pageSize: 500 })).items;
  admins.value = (await adminApi.admins({ page: 1, pageSize: 200 })).items;
};
const openCreate = () => { resetForm(); visible.value = true; };
const openEdit = async (row: any) => { resetForm(); const detail = await adminApi.applicationDetail(row.id); Object.assign(form, detail); visible.value = true; };
const save = async () => { await adminApi.saveApplication(form); ElMessage.success("已保存"); visible.value = false; await load(); };
const openFollowUp = async (row: any) => { currentId.value = row.id; currentDetail.value = await adminApi.applicationDetail(row.id); Object.assign(followUp, { followUpType: "note", content: "", nextStep: "", statusTo: "", assignAdminId: undefined }); followVisible.value = true; };
const saveFollowUp = async () => { if (!currentId.value) return; await adminApi.saveFollowUp(currentId.value, followUp); ElMessage.success("已保存跟进"); followVisible.value = false; await load(); };
const exportRows = async () => { const data = await adminApi.exportApplications(requestParams.value); currentDetail.value = data; ElMessage.success(`已导出 ${data.length} 条数据，可在“历史记录”里复制 JSON`); followVisible.value = true; };

onMounted(async () => { resetForm(); await loadLookups(); await load(); });
</script>