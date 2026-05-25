<template>
  <div class="notion-page">
    <section class="page-card notion-page__hero">
      <div class="page-toolbar notion-page__hero-toolbar">
        <div>
          <div class="notion-page__eyebrow">TASK-091 / parent TASK-063</div>
          <h2 class="notion-page__title">Notion 任务管理端拆分看板</h2>
          <div class="section-subtitle notion-page__hero-copy">
            只维护中文项目任务页的管理端可验证界面，覆盖任务列表、筛选、表单、状态流转和执行记录；Notion 不作为业务数据库。
          </div>
        </div>
        <div class="notion-page__hero-tags">
          <el-tag type="warning" effect="plain">admin-pages</el-tag>
          <el-tag type="info" effect="plain">apps/admin:Notion</el-tag>
        </div>
      </div>
    </section>

    <div class="metrics-grid notion-page__metrics">
      <div v-for="metric in metrics" :key="metric.label" class="metric-card">
        <div class="metric-card__label">{{ metric.label }}</div>
        <div class="metric-card__value">{{ metric.value }}</div>
      </div>
    </div>

    <section class="page-card">
      <div class="page-toolbar notion-page__toolbar">
        <div class="page-toolbar__left notion-page__filters">
          <el-input v-model="query.search" clearable placeholder="搜索任务编号或标题" />
          <el-select v-model="query.status" clearable placeholder="状态">
            <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
          </el-select>
          <el-select v-model="query.parallelGroup" clearable placeholder="并行分组">
            <el-option v-for="group in parallelGroupOptions" :key="group" :label="group" :value="group" />
          </el-select>
        </div>
        <div class="page-toolbar__right">
          <el-button type="primary" @click="openCreate">新增任务</el-button>
        </div>
      </div>

      <div class="notion-table-shell">
        <el-table :data="filteredTasks" border class="notion-page__table">
          <el-table-column label="任务" min-width="260">
            <template #default="scope">
              <div class="notion-task-title">
                <strong>{{ scope.row.taskId }}</strong>
                <span>{{ scope.row.title }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="180">
            <template #default="scope">
              <el-select v-model="scope.row.status" size="small" @change="recordStatusChange(scope.row)">
                <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="优先级" width="100">
            <template #default="scope">
              <el-tag :type="priorityTagType(scope.row.priority)" effect="plain">{{ scope.row.priority }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="任务类型" width="110">
            <template #default="scope">
              <el-tag type="info" effect="plain">{{ scope.row.taskType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="影响范围" min-width="220">
            <template #default="scope">
              <div class="notion-scope-list">
                <el-tag v-for="module in scope.row.impactScope.affectedModules" :key="module" type="info" effect="plain">
                  {{ module }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="依赖" min-width="180">
            <template #default="scope">
              <span v-if="!scope.row.dependencies.length" class="notion-muted">无真实前置任务</span>
              <div v-else class="notion-scope-list">
                <el-tag v-for="dependency in scope.row.dependencies" :key="dependency.taskId" type="warning" effect="plain">
                  {{ dependency.taskId }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="scope">
              <div class="table-actions">
                <el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button>
                <el-button link type="primary" @click="selectTask(scope.row)">记录</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section class="page-card notion-page__detail" v-if="selectedTask">
      <div class="page-toolbar">
        <div>
          <strong>{{ selectedTask.taskId }} 执行记录</strong>
          <div class="section-subtitle notion-page__subtitle">{{ selectedTask.implementationNotes }}</div>
        </div>
        <div class="table-actions">
          <el-button :disabled="selectedTask.status === '进行中'" @click="moveTask(selectedTask, '进行中')">开始</el-button>
          <el-button :disabled="selectedTask.status === '待评审'" @click="moveTask(selectedTask, '待评审')">送评审</el-button>
          <el-button :disabled="selectedTask.status === '已阻塞'" @click="moveTask(selectedTask, '已阻塞')">标记阻塞</el-button>
          <el-button type="primary" :disabled="selectedTask.status === '已完成'" @click="moveTask(selectedTask, '已完成')">完成</el-button>
        </div>
      </div>

      <div class="notion-detail-grid">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="锁范围">{{ selectedTask.lockScope.lockScopeHint }} / {{ selectedTask.lockScope.riskLevel }}</el-descriptions-item>
          <el-descriptions-item label="并行分组">{{ selectedTask.parallelGroup || "-" }}</el-descriptions-item>
          <el-descriptions-item label="拆分深度">{{ selectedTask.split.splitDepth }}</el-descriptions-item>
          <el-descriptions-item label="子任务策略">{{ selectedTask.split.childCompletionPolicy }}</el-descriptions-item>
          <el-descriptions-item label="验证结果">{{ selectedTask.validationResult || "-" }}</el-descriptions-item>
          <el-descriptions-item label="阻塞说明">{{ selectedTask.blockerNote || "-" }}</el-descriptions-item>
        </el-descriptions>

        <div>
          <div class="notion-section-title">验收标准</div>
          <el-timeline>
            <el-timeline-item v-for="item in selectedTask.acceptanceCriteria" :key="item" type="success">
              {{ item }}
            </el-timeline-item>
          </el-timeline>
        </div>

        <div>
          <div class="notion-section-title">最近记录</div>
          <el-empty v-if="!selectedTask.executionRecords.length" description="暂无执行记录" :image-size="80" />
          <el-timeline v-else>
            <el-timeline-item v-for="record in selectedTask.executionRecords" :key="record.recordedAt" :timestamp="record.recordedAt" placement="top">
              <div class="notion-record">
                <el-tag :type="statusTagType(record.status)" effect="plain">{{ record.status }}</el-tag>
                <span>{{ record.summary }}</span>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
    </section>

    <el-dialog v-model="editorVisible" title="Notion 任务" width="980px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" status-icon>
        <div class="split-grid">
          <el-form-item label="任务编号" prop="taskId"><el-input v-model="form.taskId" /></el-form-item>
          <el-form-item label="任务标题" prop="title"><el-input v-model="form.title" /></el-form-item>
        </div>
        <div class="split-grid">
          <el-form-item label="状态" prop="status">
            <el-select v-model="form.status">
              <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级" prop="priority">
            <el-select v-model="form.priority">
              <el-option v-for="priority in priorityOptions" :key="priority" :label="priority" :value="priority" />
            </el-select>
          </el-form-item>
        </div>
        <div class="split-grid">
          <el-form-item label="任务类型" prop="taskType">
            <el-select v-model="form.taskType">
              <el-option v-for="taskType in taskTypeOptions" :key="taskType" :label="taskType" :value="taskType" />
            </el-select>
          </el-form-item>
          <el-form-item label="并行分组">
            <el-select v-model="form.parallelGroup" clearable>
              <el-option v-for="group in parallelGroupOptions" :key="group" :label="group" :value="group" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="实现说明" prop="implementationNotes">
          <el-input v-model="form.implementationNotes" type="textarea" :rows="3" />
        </el-form-item>
        <div class="split-grid">
          <el-form-item label="影响应用">
            <el-input v-model="impactAppsText" type="textarea" :rows="3" placeholder="每行一个应用" />
          </el-form-item>
          <el-form-item label="影响模块">
            <el-input v-model="impactModulesText" type="textarea" :rows="3" placeholder="每行一个模块" />
          </el-form-item>
        </div>
        <div class="split-grid">
          <el-form-item label="锁范围">
            <el-select v-model="form.lockScope.lockScopeHint">
              <el-option v-for="scope in lockScopeOptions" :key="scope" :label="scope" :value="scope" />
            </el-select>
          </el-form-item>
          <el-form-item label="风险等级">
            <el-select v-model="form.lockScope.riskLevel">
              <el-option v-for="risk in riskOptions" :key="risk" :label="risk" :value="risk" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="验收标准">
          <el-input v-model="acceptanceText" type="textarea" :rows="4" placeholder="每行一条验收标准" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTask">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import {
  NOTION_LOCK_SCOPE_HINTS,
  NOTION_PARALLEL_GROUPS,
  NOTION_RISK_LEVELS,
  NOTION_TASK_PRIORITIES,
  NOTION_TASK_STATUSES,
  NOTION_TASK_TYPES,
  type NotionTaskContract,
  type NotionTaskPriority,
  type NotionTaskStatus
} from "@studymy/shared";

const statusOptions = [...NOTION_TASK_STATUSES];
const priorityOptions = [...NOTION_TASK_PRIORITIES];
const taskTypeOptions = [...NOTION_TASK_TYPES];
const parallelGroupOptions = [...NOTION_PARALLEL_GROUPS];
const lockScopeOptions = [...NOTION_LOCK_SCOPE_HINTS];
const riskOptions = [...NOTION_RISK_LEVELS];

const nowText = () => new Date().toLocaleString("zh-CN");
const lineText = (items: string[]) => items.join("\n");
const parseLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const createTask = (overrides: Partial<NotionTaskContract>): NotionTaskContract => ({
  taskId: "TASK-000",
  title: "",
  status: "可开始",
  priority: "中",
  taskType: "前端",
  owner: "Codex",
  linkedRequirement: "产品需求文档",
  linkedTechnicalDesign: "技术方案",
  implementationNotes: "",
  testPlan: "运行管理端构建，必要时使用浏览器验证关键页面。",
  acceptanceCriteria: ["管理端流程满足父任务相关维护需求。", "页面无明显文本溢出、破图或交互阻塞。"],
  validationResult: null,
  blockerNote: null,
  dependencies: [],
  parallelGroup: "admin-pages",
  impactScope: { affectedApps: ["apps/admin"], affectedModules: ["apps/admin:Notion"], likelyFiles: [] },
  lockScope: { lockScopeHint: "module_scope", riskLevel: "medium" },
  split: {
    parentTaskId: "TASK-063",
    childTaskIds: [],
    splitDepth: 1,
    splitReason: "由父任务 TASK-063 拆分生成。",
    splitStatus: "not_split",
    taskSize: "medium",
    taskSizeScore: 0,
    taskSizeReasons: ["子任务由任务拆分门禁生成，默认按 medium 以下粒度执行。"],
    shouldRunAsParent: true,
    childCompletionPolicy: "all_children_passed"
  },
  relatedCommits: [],
  executionRecords: [],
  ...overrides
});

const tasks = ref<NotionTaskContract[]>([
  createTask({
    taskId: "TASK-091",
    title: "新增需求边界和验收标准补充：Notion 管理端页面拆分",
    status: "待评审",
    priority: "高",
    implementationNotes: "从父任务 TASK-063 中拆出 Notion 管理端页面、表单、列表和状态交互，只处理管理端可验证界面。",
    validationResult: "Codex 已完成实现并返回完成状态。",
    executionRecords: [
      {
        recordedAt: "2026-05-25T15:05:48.843Z",
        status: "待评审",
        runId: "TASK-091-2026-05-25T14-53-34-129Z",
        summary: "Codex 已完成实现并返回完成状态。",
        testsRun: []
      },
      {
        recordedAt: "2026-05-25T14:53:34.134Z",
        status: "进行中",
        runId: "TASK-091-2026-05-25T14-53-34-129Z",
        summary: "自动化运行已领取该任务。",
        testsRun: []
      }
    ]
  }),
  createTask({
    taskId: "TASK-063",
    title: "新增需求边界和验收标准补充",
    status: "已失败",
    priority: "高",
    taskType: "产品",
    parallelGroup: "docs",
    impactScope: { affectedApps: ["docs"], affectedModules: ["docs:智能推荐需求边界"], likelyFiles: ["docs/prd/TASK-063-smart-recommendation-profile-requirement-boundary.md"] },
    implementationNotes: "父任务仅记录智能推荐必须登录并完善学生画像后的需求边界；Notion 只作为中文项目文档来源，不是业务数据库。",
    testPlan: "人工检查中文需求边界、非目标、验收标准和阻塞条件。",
    acceptanceCriteria: ["已说明新增需求目标、用户价值、功能范围和非目标。", "没有把 Notion 或 Markdown 快照描述为业务数据库。"],
    validationResult: "父任务已拆分为多个子任务，TASK-091 只承接管理端 Notion 页面可验证界面。"
  }),
  createTask({
    taskId: "TASK-072",
    title: "新增需求边界、验收标准和依赖规划补充：Notion 共享类型和接口契约拆分",
    status: "已完成",
    priority: "高",
    taskType: "架构",
    parallelGroup: "shared-contracts",
    impactScope: { affectedApps: ["packages/shared"], affectedModules: ["packages/shared:Notion"], likelyFiles: ["packages/shared/src/notion.ts"] },
    implementationNotes: "共享契约覆盖任务状态、优先级、锁范围、风险等级、拆分元数据、依赖和执行记录。",
    validationResult: "Review 已确认 Notion 契约覆盖核心字段，并已从 shared 入口导出。"
  }),
  createTask({
    taskId: "TASK-076",
    title: "新增需求边界、验收标准和依赖规划补充：Notion 后端 API 和服务拆分",
    status: "可开始",
    priority: "高",
    taskType: "后端",
    parallelGroup: "api-endpoints",
    implementationNotes: "从父任务 TASK-063 中拆出 Notion 后端 API、服务、校验和错误处理，只处理后端可测试接口能力。",
    testPlan: "运行后端构建、单元测试或接口验证命令。",
    acceptanceCriteria: ["API 契约清晰，输入校验和错误处理完整。", "后端构建、单测或接口验证通过。"],
    impactScope: { affectedApps: ["apps/api"], affectedModules: ["apps/api:Notion"], likelyFiles: [] }
  }),
  createTask({
    taskId: "TASK-094",
    title: "新增需求边界、验收标准和依赖规划补充：Notion 用户端页面和交互拆分",
    status: "已失败",
    priority: "高",
    taskType: "前端",
    parallelGroup: "frontend-pages",
    implementationNotes: "从父任务 TASK-063 中拆出的用户端残留项；Notion 不是业务功能，不应在用户端暴露为页面。",
    testPlan: "启动或复用前端服务，使用浏览器或等价工具验证关键页面。",
    acceptanceCriteria: ["用户端主流程满足父任务相关验收标准。", "浏览器验证通过，页面无明显视觉和响应式问题。"],
    impactScope: { affectedApps: ["apps/web"], affectedModules: ["apps/web:Notion"], likelyFiles: [] }
  })
]);

const query = reactive({ search: "", status: "", parallelGroup: "" });
const selectedTask = ref<NotionTaskContract | null>(tasks.value[0]);
const editorVisible = ref(false);
const formRef = ref<FormInstance>();
const editingTaskId = ref("");
const form = reactive<NotionTaskContract>(createTask({}));
const impactAppsText = ref("");
const impactModulesText = ref("");
const acceptanceText = ref("");

const rules = reactive<FormRules>({
  taskId: [
    { required: true, message: "请输入任务编号", trigger: "blur" },
    { pattern: /^TASK-\d+$/, message: "任务编号格式应为 TASK-数字", trigger: "blur" }
  ],
  title: [{ required: true, message: "请输入任务标题", trigger: "blur" }],
  status: [{ required: true, message: "请选择状态", trigger: "change" }],
  priority: [{ required: true, message: "请选择优先级", trigger: "change" }],
  taskType: [{ required: true, message: "请选择任务类型", trigger: "change" }],
  implementationNotes: [{ required: true, message: "请输入实现说明", trigger: "blur" }]
});

const filteredTasks = computed(() =>
  tasks.value.filter((task) => {
    const keyword = query.search.trim().toLowerCase();
    const matchesSearch = !keyword || `${task.taskId} ${task.title}`.toLowerCase().includes(keyword);
    const matchesStatus = !query.status || task.status === query.status;
    const matchesGroup = !query.parallelGroup || task.parallelGroup === query.parallelGroup;
    return matchesSearch && matchesStatus && matchesGroup;
  })
);

const metrics = computed(() => [
  { label: "任务总数", value: tasks.value.length },
  { label: "进行中", value: tasks.value.filter((task) => task.status === "进行中").length },
  { label: "待评审", value: tasks.value.filter((task) => task.status.includes("待评审")).length },
  { label: "阻塞或失败", value: tasks.value.filter((task) => task.status === "已阻塞" || task.status === "已失败").length }
]);

const resetForm = () => {
  Object.assign(form, createTask({}));
  impactAppsText.value = lineText(form.impactScope.affectedApps);
  impactModulesText.value = lineText(form.impactScope.affectedModules);
  acceptanceText.value = lineText(form.acceptanceCriteria);
};

const syncTextFields = () => {
  impactAppsText.value = lineText(form.impactScope.affectedApps);
  impactModulesText.value = lineText(form.impactScope.affectedModules);
  acceptanceText.value = lineText(form.acceptanceCriteria);
};

const openCreate = () => {
  editingTaskId.value = "";
  resetForm();
  editorVisible.value = true;
};

const openEdit = (task: NotionTaskContract) => {
  editingTaskId.value = task.taskId;
  Object.assign(form, JSON.parse(JSON.stringify(task)));
  syncTextFields();
  editorVisible.value = true;
};

const selectTask = (task: NotionTaskContract) => {
  selectedTask.value = task;
};

const saveTask = async () => {
  await formRef.value?.validate();
  form.impactScope.affectedApps = parseLines(impactAppsText.value);
  form.impactScope.affectedModules = parseLines(impactModulesText.value);
  form.acceptanceCriteria = parseLines(acceptanceText.value);
  if (!form.impactScope.affectedApps.length) throw new Error("请至少填写一个影响应用");
  if (!form.acceptanceCriteria.length) throw new Error("请至少填写一条验收标准");

  const payload = JSON.parse(JSON.stringify(form)) as NotionTaskContract;
  const existingIndex = tasks.value.findIndex((task) => task.taskId === editingTaskId.value);
  const duplicate = tasks.value.some((task, index) => task.taskId === payload.taskId && index !== existingIndex);
  if (duplicate) throw new Error("任务编号已存在");

  if (existingIndex >= 0) {
    tasks.value.splice(existingIndex, 1, payload);
  } else {
    tasks.value.unshift(payload);
  }
  selectedTask.value = payload;
  editorVisible.value = false;
  ElMessage.success("任务界面数据已更新");
};

const moveTask = (task: NotionTaskContract, status: NotionTaskStatus) => {
  task.status = status;
  recordStatusChange(task);
};

const recordStatusChange = (task: NotionTaskContract) => {
  task.executionRecords.unshift({
    recordedAt: nowText(),
    status: task.status,
    runId: null,
    summary: `状态更新为 ${task.status}`,
    testsRun: []
  });
  selectedTask.value = task;
};

const priorityTagType = (priority: NotionTaskPriority) => {
  if (priority === "高") return "danger";
  if (priority === "中") return "warning";
  return "info";
};

const statusTagType = (status: NotionTaskStatus) => {
  if (status === "已完成") return "success";
  if (status === "已阻塞" || status === "已失败") return "danger";
  if (status.includes("待评审")) return "warning";
  return "info";
};
</script>

<style scoped>
.notion-page {
  display: grid;
  gap: 18px;
  min-width: 0;
  max-width: 100%;
}

.notion-page :deep(.page-card) {
  min-width: 0;
  max-width: 100%;
}

.notion-page__metrics {
  margin-bottom: 0;
}

.notion-page__hero {
  overflow: hidden;
}

.notion-page__hero-toolbar {
  align-items: flex-start;
  margin-bottom: 0;
}

.notion-page__eyebrow {
  color: #3152a3;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.notion-page__title {
  margin: 6px 0 0;
  color: #12233c;
  font-size: 24px;
  line-height: 1.25;
}

.notion-page__hero-copy {
  max-width: 760px;
}

.notion-page__hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  min-width: 0;
}

.notion-page__toolbar {
  align-items: flex-start;
}

.notion-page__filters {
  flex: 1;
  min-width: 0;
}

.notion-page__filters .el-input,
.notion-page__filters .el-select {
  width: min(260px, 100%);
}

.notion-page__table {
  min-width: 1120px;
  width: 100%;
}

.notion-table-shell {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.notion-task-title {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.notion-task-title strong {
  color: #3152a3;
  font-size: 13px;
}

.notion-task-title span,
.notion-page__subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notion-scope-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.notion-muted {
  color: #94a3b8;
  font-size: 13px;
}

.notion-page__detail {
  overflow: hidden;
}

.notion-detail-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(260px, 1fr) minmax(280px, 1.1fr);
  gap: 18px;
}

.notion-section-title {
  margin-bottom: 12px;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
}

.notion-record {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.notion-record span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .notion-detail-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 960px) {
  .notion-page__filters .el-input,
  .notion-page__filters .el-select {
    width: 100%;
  }

  .notion-detail-grid {
    grid-template-columns: 1fr;
  }

  .notion-page__subtitle {
    white-space: normal;
  }
}
</style>
