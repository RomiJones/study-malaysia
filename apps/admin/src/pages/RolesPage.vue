<template>
  <section class="page-card">
    <div class="page-toolbar">
      <div class="page-toolbar__left"><el-input v-model="query.search" placeholder="搜索角色" clearable @change="load" /></div>
      <div class="page-toolbar__right"><el-button type="primary" @click="openCreate">新增角色</el-button></div>
    </div>
    <el-table :data="items" border>
      <el-table-column prop="name" label="角色" min-width="160" />
      <el-table-column prop="code" label="Code" min-width="180" />
      <el-table-column prop="dataScope" label="数据范围" width="120" />
      <el-table-column prop="description" label="说明" min-width="220" />
      <el-table-column label="权限数" width="100"><template #default="scope">{{ scope.row.permissionCodes?.length || 0 }}</template></el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="scope">
          <div class="table-actions">
            <el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button>
            <el-button link type="danger" @click="remove(scope.row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </section>

  <el-dialog v-model="visible" title="角色管理" width="760px">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="Code"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="数据范围">
          <el-select v-model="form.dataScope"><el-option label="全部" value="all" /><el-option label="指派" value="assigned" /><el-option label="本人创建" value="created" /></el-select>
        </el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.isActive" /></el-form-item>
      </div>
      <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      <el-form-item label="权限点"><el-select v-model="form.permissionCodes" multiple filterable><el-option v-for="item in permissionOptions" :key="item.code" :label="`${item.groupName} / ${item.name}`" :value="item.code" /></el-select></el-form-item>
      <el-form-item label="菜单"><el-select v-model="form.menuIds" multiple filterable><el-option v-for="item in flatMenus" :key="item.id" :label="item.title" :value="item.id" /></el-select></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminApi } from "@/api/admin";

const items = ref<any[]>([]);
const permissionOptions = ref<any[]>([]);
const menuTree = ref<any[]>([]);
const query = reactive({ search: "" });
const visible = ref(false);
const form = reactive({ id: undefined as number | undefined, code: "", name: "", description: "", dataScope: "assigned", isActive: true, permissionCodes: [] as string[], menuIds: [] as number[] });
const flatMenus = computed(() => {
  const result: any[] = [];
  const walk = (nodes: any[]) => nodes.forEach((node) => { result.push(node); if (node.children?.length) walk(node.children); });
  walk(menuTree.value || []);
  return result;
});

const load = async () => {
  items.value = await adminApi.roles(query);
  const permissionData = await adminApi.permissions({ page: 1, pageSize: 300 });
  permissionOptions.value = permissionData.items;
  menuTree.value = await adminApi.menus();
};
const openCreate = () => { Object.assign(form, { id: undefined, code: "", name: "", description: "", dataScope: "assigned", isActive: true, permissionCodes: [], menuIds: [] }); visible.value = true; };
const openEdit = (row: any) => { Object.assign(form, { ...row, permissionCodes: [...(row.permissionCodes || [])], menuIds: [...(row.menuIds || [])] }); visible.value = true; };
const save = async () => { await adminApi.saveRole(form); ElMessage.success("已保存"); visible.value = false; await load(); };
const remove = async (row: any) => { await ElMessageBox.confirm(`确认删除角色 ${row.name}？`, "提示"); await adminApi.deleteRole(row.id); ElMessage.success("已删除"); await load(); };

onMounted(load);
</script>