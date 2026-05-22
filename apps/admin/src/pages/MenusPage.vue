<template>
  <section class="page-card">
    <div class="page-toolbar">
      <div class="page-toolbar__left"><el-input v-model="query.search" placeholder="搜索菜单标题或路径" clearable @change="load" /></div>
      <div class="page-toolbar__right"><el-button type="primary" @click="openCreate">新增菜单</el-button></div>
    </div>
    <el-table :data="flatRows" row-key="id" border>
      <el-table-column prop="title" label="标题" min-width="180" />
      <el-table-column prop="path" label="路径" min-width="180" />
      <el-table-column prop="routeName" label="路由名" width="140" />
      <el-table-column prop="permissionCode" label="权限编码" min-width="180" />
      <el-table-column prop="menuType" label="类型" width="100" />
      <el-table-column prop="sortOrder" label="排序" width="80" />
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

  <el-dialog v-model="visible" title="菜单管理" width="620px">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="图标"><el-input v-model="form.icon" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="路径"><el-input v-model="form.path" /></el-form-item>
        <el-form-item label="路由名"><el-input v-model="form.routeName" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="父级"><el-select v-model="form.parentId" clearable><el-option v-for="item in parentOptions" :key="item.id" :label="item.title" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="类型"><el-select v-model="form.menuType"><el-option label="目录" value="directory" /><el-option label="菜单" value="menu" /><el-option label="动作" value="action" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="权限编码"><el-input v-model="form.permissionCode" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="显示"><el-switch v-model="form.isVisible" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.isEnabled" /></el-form-item>
      </div>
    </el-form>
    <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { adminApi } from "@/api/admin";

const tree = ref<any[]>([]);
const query = reactive({ search: "" });
const visible = ref(false);
const form = reactive({ id: undefined as number | undefined, parentId: undefined as number | undefined, title: "", icon: "Menu", path: "", routeName: "", permissionCode: "", menuType: "menu", sortOrder: 0, isVisible: true, isEnabled: true });
const flatRows = computed(() => {
  const result: any[] = [];
  const walk = (nodes: any[]) => nodes.forEach((node) => { result.push(node); if (node.children?.length) walk(node.children); });
  walk(tree.value || []);
  return result;
});
const parentOptions = computed(() => flatRows.value.filter((item) => item.menuType !== "action"));

const load = async () => { tree.value = await adminApi.menus(query); };
const openCreate = () => { Object.assign(form, { id: undefined, parentId: undefined, title: "", icon: "Menu", path: "", routeName: "", permissionCode: "", menuType: "menu", sortOrder: 0, isVisible: true, isEnabled: true }); visible.value = true; };
const openEdit = (row: any) => { Object.assign(form, { ...row }); visible.value = true; };
const save = async () => { await adminApi.saveMenu(form); ElMessage.success("已保存"); visible.value = false; await load(); };
const remove = async (row: any) => { await ElMessageBox.confirm(`确认删除菜单 ${row.title}？`, "提示"); await adminApi.deleteMenu(row.id); ElMessage.success("已删除"); await load(); };

onMounted(load);
</script>
