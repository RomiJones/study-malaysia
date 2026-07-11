<template>
  <div class="application-admin-page">
    <div class="metrics-grid">
      <div class="metric-card" v-for="metric in metrics" :key="metric.label">
        <div class="metric-card__label">{{ metric.label }}</div>
        <div class="metric-card__value">{{ metric.value }}</div>
      </div>
    </div>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>我的待处理工作台</strong>
          <div class="section-subtitle">聚合待分配、待审核材料、待回复留言和超时未跟进案件。</div>
        </div>
        <el-button size="small" @click="loadWorkbench">刷新工作台</el-button>
      </div>
      <el-table :data="workbench.items" size="small" border>
        <el-table-column label="优先级" width="90">
          <template #default="scope"><el-tag :type="priorityTagType(scope.row.priority)" size="small">{{ priorityLabel(scope.row.priority) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="title" label="待办事项" min-width="180" />
        <el-table-column prop="description" label="说明" min-width="240" />
        <el-table-column prop="applicationNo" label="申请号" width="150" />
        <el-table-column prop="studentName" label="学生" width="120" />
        <el-table-column label="状态" width="120">
          <template #default="scope"><el-tag :type="statusTagType(scope.row.status)" size="small">{{ scope.row.statusLabel || statusLabel(scope.row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope"><el-button link type="primary" @click="openCaseById(scope.row.applicationId)">处理</el-button></template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!workbench.items.length" description="暂无待处理事项" :image-size="68" />
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>分配通知</strong>
          <div class="section-subtitle">员工被分配案件后会在这里收到通知。</div>
        </div>
        <el-button size="small" @click="loadNotifications">刷新通知</el-button>
      </div>
      <el-empty v-if="!notifications.items.length" description="暂无通知" :image-size="68" />
      <div v-else class="notification-list">
        <div v-for="item in notifications.items" :key="item.id" class="notification-row" :class="{ unread: !item.isRead }">
          <div>
            <strong>{{ item.title }}</strong>
            <span>{{ item.body }}</span>
          </div>
          <div class="table-actions">
            <el-tag v-if="!item.isRead" type="danger" size="small">未读</el-tag>
            <el-button link type="primary" @click="openNotification(item)">查看</el-button>
            <el-button v-if="!item.isRead" link @click="markNotificationRead(item.id)">标记已读</el-button>
          </div>
        </div>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>超级管理员工作量看板</strong>
          <div class="section-subtitle">按负责人统计活跃案件、待审核和补件压力；普通员工只看到自己的工作量。</div>
        </div>
        <el-button size="small" @click="loadWorkload">刷新看板</el-button>
      </div>
      <el-table :data="workload.rows" size="small" border>
        <el-table-column prop="adminName" label="负责人" min-width="140" />
        <el-table-column prop="activeCount" label="活跃案件" width="110" />
        <el-table-column prop="submittedCount" label="新提交" width="100" />
        <el-table-column prop="reviewingCount" label="审核中" width="100" />
        <el-table-column prop="needRevisionCount" label="需补件" width="100" />
        <el-table-column prop="assignedTotal" label="累计分配" width="110" />
        <el-table-column label="最后更新" min-width="160">
          <template #default="scope">{{ scope.row.lastAssignedAt || "-" }}</template>
        </el-table-column>
      </el-table>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div class="page-toolbar__left">
          <el-radio-group v-model="viewMode" @change="changeViewMode">
            <el-radio-button label="all">全部案件</el-radio-button>
            <el-radio-button label="mine">我的案件</el-radio-button>
            <el-radio-button v-if="canAssignCases" label="unassigned">待分配</el-radio-button>
          </el-radio-group>
          <el-input v-model="query.search" placeholder="搜索申请号 / 学生 / 邮箱" clearable @change="reloadFirstPage" />
          <el-select v-model="query.status" clearable placeholder="申请状态" @change="reloadFirstPage">
            <el-option label="待整理" value="draft" />
            <el-option label="已递交" value="submitted" />
            <el-option label="审核中" value="reviewing" />
            <el-option label="需补件" value="need-info" />
            <el-option label="平台审核通过" value="platform-approved" />
            <el-option label="已递交院校" value="school-submitted" />
            <el-option label="院校审核中" value="school-reviewing" />
            <el-option label="获 Offer" value="offered" />
            <el-option label="拒录" value="rejected" />
            <el-option label="签证处理中" value="visa" />
            <el-option label="完成" value="done" />
          </el-select>
          <el-select v-model="query.universityId" clearable placeholder="学校" filterable @change="reloadFirstPage">
            <el-option v-for="item in universities" :key="item.id" :label="item.shortName" :value="item.id" />
          </el-select>
          <el-select v-model="query.programId" clearable placeholder="专业" filterable @change="reloadFirstPage">
            <el-option v-for="item in filteredProgramsForQuery" :key="item.id" :label="`${item.university?.shortName || ''} / ${item.name['zh-CN']}`" :value="item.id" />
          </el-select>
          <el-date-picker v-model="query.dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" @change="reloadFirstPage" />
        </div>
        <div class="page-toolbar__right">
          <el-button @click="exportRows">导出列表</el-button>
          <el-button type="primary" @click="openCreate">新增申请</el-button>
        </div>
      </div>
      <el-table :data="items" border>
        <el-table-column prop="applicationNo" label="申请号" min-width="150" />
        <el-table-column prop="studentName" label="学生" width="110" />
        <el-table-column prop="studentEmail" label="邮箱" min-width="190" />
        <el-table-column label="档案" width="140">
          <template #default="scope">
            <div class="profile-list-cell">
              <el-tag :type="profileStatusTagType(scope.row.applicationProfileSummary?.status)" size="small">{{ scope.row.applicationProfileSummary?.statusLabel || "信息不足" }}</el-tag>
              <span>{{ scope.row.applicationProfileSummary?.completion || 0 }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="universityName" label="学校" min-width="140" />
        <el-table-column prop="programName" label="专业" min-width="200" />
        <el-table-column label="状态" width="105">
          <template #default="scope"><el-tag :type="statusTagType(scope.row.applicationStatus)">{{ statusLabel(scope.row.applicationStatus) }}</el-tag></template>
        </el-table-column>
        <el-table-column label="材料" width="140">
          <template #default="scope">
            <div>{{ materialProgressText(scope.row) }}</div>
            <el-tag v-if="scope.row.materialSummary?.needRevision" type="danger" size="small">需补件 {{ scope.row.materialSummary.needRevision }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="assignedAdminName" label="负责人" width="120">
          <template #default="scope">{{ scope.row.assignedAdminName || "待分配" }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="scope">
            <div class="table-actions">
              <el-button link type="primary" @click="openCase(scope.row)">材料/跟进</el-button>
              <el-button v-if="canAssignCases" link @click="openAssign(scope.row)">分配</el-button>
              <el-button link @click="openEdit(scope.row)">编辑</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination style="margin-top: 16px" layout="prev, pager, next, total" :total="total" v-model:current-page="query.page" v-model:page-size="query.pageSize" @current-change="load" />
    </section>
  </div>

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
        <el-form-item label="学校"><el-select v-model="form.universityId" filterable><el-option v-for="item in universities" :key="item.id" :label="item.shortName" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="专业"><el-select v-model="form.programId" filterable><el-option v-for="item in filteredPrograms" :key="item.id" :label="`${item.university?.shortName || ''} / ${item.name['zh-CN']}`" :value="item.id" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="申请状态"><el-select v-model="form.applicationStatus"><el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
        <el-form-item label="当前阶段"><el-select v-model="form.currentStage"><el-option label="draft" value="draft" /><el-option label="materials" value="materials" /><el-option label="ready" value="ready" /><el-option label="review" value="review" /><el-option label="conditional-offer" value="conditional-offer" /><el-option label="visa" value="visa" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="材料状态"><el-select v-model="form.materialStatus"><el-option label="draft" value="draft" /><el-option label="wait" value="wait" /><el-option label="progress" value="progress" /><el-option label="done" value="done" /></el-select></el-form-item>
        <el-form-item label="签证状态"><el-select v-model="form.visaStatus"><el-option label="not-started" value="not-started" /><el-option label="preparing" value="preparing" /><el-option label="submitted" value="submitted" /><el-option label="approved" value="approved" /></el-select></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="优先级"><el-select v-model="form.priority"><el-option label="low" value="low" /><el-option label="medium" value="medium" /><el-option label="high" value="high" /></el-select></el-form-item>
        <el-form-item v-if="canAssignCases" label="负责人"><el-select v-model="form.assignedAdminId" clearable><el-option v-for="item in admins" :key="item.id" :label="item.displayName" :value="item.id" /></el-select></el-form-item>
      </div>
      <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="3" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
  </el-dialog>

  <el-dialog v-model="assignVisible" title="分配负责人" width="560px">
    <el-form label-position="top">
      <el-form-item label="负责人">
        <el-select v-model="assignForm.assignedAdminId" clearable filterable placeholder="选择负责员工">
          <el-option v-for="item in admins" :key="item.id" :label="item.displayName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="分配说明"><el-input v-model="assignForm.note" type="textarea" :rows="3" placeholder="可填写学生背景、注意事项或下一步动作" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="assignVisible = false">取消</el-button><el-button type="primary" @click="saveAssign">确认分配</el-button></template>
  </el-dialog>

  <el-dialog v-model="caseVisible" title="案件材料与跟进" width="min(1040px, 94vw)">
    <template v-if="currentDetail">
      <el-descriptions :column="2" border class="case-summary">
        <el-descriptions-item label="申请号">{{ currentDetail.applicationNo }}</el-descriptions-item>
        <el-descriptions-item label="学生">{{ currentDetail.studentName }} / {{ currentDetail.studentEmail }}</el-descriptions-item>
        <el-descriptions-item label="学校">{{ currentDetail.universityName }}</el-descriptions-item>
        <el-descriptions-item label="专业">{{ currentDetail.programName }}</el-descriptions-item>
        <el-descriptions-item label="申请档案">
          <el-tag :type="profileStatusTagType(currentDetail.applicationProfileSummary?.status)" size="small">{{ currentDetail.applicationProfileSummary?.statusLabel || "信息不足" }}</el-tag>
          <span class="case-profile-inline">{{ currentDetail.applicationProfileSummary?.completion || 0 }}%</span>
        </el-descriptions-item>
      </el-descriptions>

      <div class="case-flow-panel">
        <div>
          <span>当前状态</span>
          <strong>{{ currentDetail.workflow?.label || statusLabel(currentDetail.applicationStatus) }}</strong>
          <small>{{ currentDetail.workflow?.nextStaffAction || '按案件情况继续跟进。' }}</small>
        </div>
        <el-form class="case-flow-form" label-position="top">
          <div class="split-grid">
            <el-form-item label="流转到">
              <el-select v-model="statusForm.status" placeholder="选择下一状态">
                <el-option v-for="item in statusTransitionOptions" :key="item.status" :label="item.label" :value="item.status" />
              </el-select>
            </el-form-item>
            <el-form-item label="下次跟进时间">
              <el-date-picker v-model="statusForm.nextFollowUpAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="可选" />
            </el-form-item>
          </div>
          <el-form-item label="状态说明 / 下一步">
            <el-input v-model="statusForm.note" type="textarea" :rows="2" placeholder="填写状态变更说明，会同步到跟进记录和学生通知" />
          </el-form-item>
          <el-button type="primary" :loading="updatingStatus" :disabled="!statusForm.status" @click="saveStatusUpdate">更新状态</el-button>
        </el-form>
      </div>

      <el-tabs>
        <el-tab-pane label="学生档案">
          <div class="case-profile-panel">
            <div class="case-profile-panel__head">
              <div>
                <strong>学生申请档案</strong>
                <span>提交申请时生成的快照，后续学生修改档案不会覆盖本案件原始情况。</span>
              </div>
              <el-tag :type="profileStatusTagType(currentDetail.applicationProfileSummary?.status)">
                {{ currentDetail.applicationProfileSummary?.statusLabel || "信息不足" }} · {{ currentDetail.applicationProfileSummary?.completion || 0 }}%
              </el-tag>
            </div>
            <el-alert
              v-if="currentDetail.applicationProfileSummary?.missingLabels?.length"
              type="warning"
              :closable="false"
              :title="`建议补充：${currentDetail.applicationProfileSummary.missingLabels.join('、')}`"
              show-icon
            />
            <el-descriptions :column="2" border class="case-profile-descriptions">
              <el-descriptions-item label="申请目标">{{ currentDetail.universityName }} / {{ currentDetail.programName }} / {{ currentDetail.intake || "入学批次待确认" }}</el-descriptions-item>
              <el-descriptions-item label="目标方向">{{ profileLevelLabel(currentDetail.applicationProfileSnapshot?.level) }} · {{ profileCategoryLabel(currentDetail.applicationProfileSnapshot?.targetCategory) }}</el-descriptions-item>
              <el-descriptions-item label="学术背景">{{ profileAcademicText(currentDetail) }}</el-descriptions-item>
              <el-descriptions-item label="GPA/均分">{{ profileScoreText(currentDetail) }}</el-descriptions-item>
              <el-descriptions-item label="语言成绩">{{ profileLanguageText(currentDetail) }}</el-descriptions-item>
              <el-descriptions-item label="预算范围">{{ profileBudgetText(currentDetail.applicationProfileSnapshot?.budgetCny) }}</el-descriptions-item>
              <el-descriptions-item label="城市/院校偏好">{{ profilePreferenceText(currentDetail) }}</el-descriptions-item>
              <el-descriptions-item label="服务需求">{{ profileServiceText(currentDetail) }}</el-descriptions-item>
              <el-descriptions-item label="联系方式" :span="2">{{ profileContactText(currentDetail) }}</el-descriptions-item>
              <el-descriptions-item label="快照时间" :span="2">{{ formatDate(currentDetail.applicationProfileSnapshot?.snapshotAt) }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </el-tab-pane>
        <el-tab-pane label="目录快照对比">
          <div class="catalog-snapshot-panel">
            <div class="catalog-snapshot-panel__head">
              <div>
                <strong>申请时快照 vs 当前目录字段</strong>
                <span>案件判断保留提交时目录口径，当前目录仅用于顾问复核和后续沟通。</span>
              </div>
              <el-tag :type="catalogRiskTagType(currentDetail.catalogSnapshotComparison?.summary?.highestRisk)">
                {{ catalogRiskLabel(currentDetail.catalogSnapshotComparison?.summary?.highestRisk) }}
              </el-tag>
            </div>

            <el-alert
              :type="catalogSummaryAlertType(currentDetail.catalogSnapshotComparison?.summary)"
              :closable="false"
              :title="currentDetail.catalogSnapshotComparison?.summary?.recommendation || '当前暂无目录快照对比结果'"
              show-icon
            />

            <div class="catalog-snapshot-profile">
              <strong>学生画像快照</strong>
              <span>{{ profileSnapshotCompactText(currentDetail) }}</span>
            </div>

            <div class="catalog-snapshot-columns">
              <div class="catalog-snapshot-section">
                <div class="catalog-snapshot-section__title">
                  <strong>申请时快照</strong>
                  <span>{{ formatDate(currentDetail.catalogSnapshotComparison?.snapshotAt) }}</span>
                </div>
                <dl>
                  <dt>学校 / 专业</dt>
                  <dd>{{ catalogTargetText(currentDetail.catalogSnapshotComparison?.submitted) }}</dd>
                  <dt>费用</dt>
                  <dd>{{ catalogFeeText(currentDetail.catalogSnapshotComparison?.submitted?.program?.fee) }}</dd>
                  <dt>语言要求</dt>
                  <dd>{{ catalogLanguageText(currentDetail.catalogSnapshotComparison?.submitted?.program?.language) }}</dd>
                  <dt>申请材料</dt>
                  <dd>{{ catalogApplicationDocsText(currentDetail.catalogSnapshotComparison?.submitted) }}</dd>
                  <dt>公开 / 来源</dt>
                  <dd>{{ catalogStatusText(currentDetail.catalogSnapshotComparison?.submitted) }}</dd>
                </dl>
              </div>

              <div class="catalog-snapshot-section">
                <div class="catalog-snapshot-section__title">
                  <strong>当前目录字段</strong>
                  <span>{{ formatDate(currentDetail.catalogSnapshotComparison?.current?.snapshotAt) }}</span>
                </div>
                <dl>
                  <dt>学校 / 专业</dt>
                  <dd>{{ catalogTargetText(currentDetail.catalogSnapshotComparison?.current) }}</dd>
                  <dt>费用</dt>
                  <dd>{{ catalogFeeText(currentDetail.catalogSnapshotComparison?.current?.program?.fee) }}</dd>
                  <dt>语言要求</dt>
                  <dd>{{ catalogLanguageText(currentDetail.catalogSnapshotComparison?.current?.program?.language) }}</dd>
                  <dt>申请材料</dt>
                  <dd>{{ catalogApplicationDocsText(currentDetail.catalogSnapshotComparison?.current) }}</dd>
                  <dt>公开 / 来源</dt>
                  <dd>{{ catalogStatusText(currentDetail.catalogSnapshotComparison?.current) }}</dd>
                </dl>
              </div>
            </div>

            <el-table :data="currentDetail.catalogSnapshotComparison?.differences || []" border size="small">
              <el-table-column label="风险" width="88">
                <template #default="scope">
                  <el-tag :type="catalogRiskTagType(scope.row.riskLevel)" size="small">{{ catalogRiskLabel(scope.row.riskLevel) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="label" label="差异项" min-width="140" />
              <el-table-column label="申请时快照" min-width="220">
                <template #default="scope"><div class="catalog-diff-value">{{ scope.row.submittedValue }}</div></template>
              </el-table-column>
              <el-table-column label="当前目录字段" min-width="220">
                <template #default="scope"><div class="catalog-diff-value">{{ scope.row.currentValue }}</div></template>
              </el-table-column>
              <el-table-column prop="affectedArea" label="影响页面 / 能力" min-width="220" />
              <el-table-column prop="advice" label="顾问操作建议" min-width="260" />
            </el-table>
            <el-empty v-if="!(currentDetail.catalogSnapshotComparison?.differences || []).length" description="暂无关键目录差异" :image-size="68" />
          </div>
        </el-tab-pane>
        <el-tab-pane label="材料审核">
          <div class="material-adjust-toolbar">
            <div>
              <strong>案件材料清单</strong>
              <span>可按真实个案新增、修改、豁免或恢复材料要求。</span>
            </div>
            <el-button type="primary" size="small" @click="openAddMaterial">新增材料</el-button>
          </div>
          <el-table :data="currentDetail.materials || []" border size="small">
            <el-table-column type="expand" width="42">
              <template #default="scope">
                <div class="material-version-panel">
                  <div class="material-version-panel__title">材料版本记录</div>
                  <el-table :data="scope.row.versions || []" size="small" border>
                    <el-table-column label="版本" width="80">
                      <template #default="versionScope">第 {{ versionScope.row.version }} 版</template>
                    </el-table-column>
                    <el-table-column prop="fileName" label="文件名" min-width="220" />
                    <el-table-column label="状态" width="110">
                      <template #default="versionScope">
                        <el-tag :type="reviewTagType(versionScope.row.reviewStatus)" size="small">{{ reviewStatusLabel(versionScope.row.reviewStatus) }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="大小" width="100">
                      <template #default="versionScope">{{ formatFileSize(versionScope.row.size) }}</template>
                    </el-table-column>
                    <el-table-column label="上传时间" min-width="160">
                      <template #default="versionScope">{{ formatDate(versionScope.row.uploadedAt) }}</template>
                    </el-table-column>
                    <el-table-column prop="reviewNote" label="审核意见" min-width="180" />
                    <el-table-column label="操作" width="150">
                      <template #default="versionScope">
                        <el-button link type="primary" :disabled="!versionScope.row.hasFile" @click="previewMaterial(scope.row, versionScope.row.id, versionScope.row.fileName, versionScope.row.mimeType)">预览</el-button>
                        <el-button link type="primary" :disabled="!versionScope.row.hasFile" @click="downloadMaterial(scope.row, versionScope.row.id, versionScope.row.fileName)">下载</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-empty v-if="!(scope.row.versions || []).length" description="暂无历史版本" :image-size="56" />
                </div>
              </template>
            </el-table-column>
            <el-table-column label="材料" min-width="220">
              <template #default="scope">
                <div class="material-title-cell">
                  <strong>{{ scope.row.title }}</strong>
                  <span>{{ scope.row.groupLabel || "其他材料" }}</span>
                  <small v-if="scope.row.note">{{ scope.row.note }}</small>
                  <small v-for="tip in scope.row.uploadTips || []" :key="tip">{{ tip }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="要求" width="105">
              <template #default="scope">
                <el-tag :type="materialRequirementTagType(scope.row.requirementLevel)" size="small">{{ scope.row.requirementLevelLabel || materialRequirementLabel(scope.row.requirementLevel) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="来源" width="130">
              <template #default="scope">
                <el-tag type="info" size="small">{{ scope.row.sourceLabel || materialSourceLabel(scope.row.source) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="触发原因" min-width="220">
              <template #default="scope">{{ scope.row.reason || scope.row.note || "-" }}</template>
            </el-table-column>
            <el-table-column label="文件来源" width="150">
              <template #default="scope">
                <el-tag :type="scope.row.linkedFromLibrary ? 'success' : 'info'" size="small">
                  {{ scope.row.linkedFromLibrary ? `材料库第 ${scope.row.libraryVersion || 1} 版` : '案件上传' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="fileName" label="文件" min-width="180">
              <template #default="scope">{{ scope.row.fileName || "未上传" }}</template>
            </el-table-column>
            <el-table-column label="当前版本" width="100">
              <template #default="scope">第 {{ currentMaterialVersion(scope.row) }} 版</template>
            </el-table-column>
            <el-table-column label="审核状态" width="120">
              <template #default="scope">
                <el-tag :type="scope.row.isWaived ? 'info' : reviewTagType(scope.row.reviewStatus)">
                  {{ scope.row.isWaived ? '已豁免' : reviewStatusLabel(scope.row.reviewStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="审核意见" min-width="180">
              <template #default="scope">{{ scope.row.isWaived ? scope.row.waiverReason || "该材料已被标记为不需要提交" : scope.row.reviewNote || "-" }}</template>
            </el-table-column>
            <el-table-column label="操作" width="380">
              <template #default="scope">
                <div class="table-actions">
                  <el-button link type="primary" :disabled="scope.row.isWaived || !scope.row.hasFile" @click="previewMaterial(scope.row, scope.row.currentVersionId, scope.row.fileName, scope.row.mimeType)">预览</el-button>
                  <el-button link :disabled="scope.row.isWaived || !scope.row.hasFile" @click="downloadMaterial(scope.row, scope.row.currentVersionId, scope.row.fileName)">下载当前版</el-button>
                  <el-button link type="primary" :disabled="scope.row.isWaived" @click="openReview(scope.row)">审核</el-button>
                  <el-button link @click="openEditMaterial(scope.row)">编辑</el-button>
                  <el-button v-if="!scope.row.isWaived" link type="warning" @click="waiveMaterial(scope.row)">豁免</el-button>
                  <el-button v-else link type="success" @click="reopenMaterial(scope.row)">恢复</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="案件沟通">
          <div class="case-message-layout">
            <div class="case-message-list">
              <div v-for="message in currentDetail.messages || []" :key="message.id" class="case-message" :class="`case-message--${message.senderType}`">
                <div class="case-message__meta">
                  <strong>{{ message.senderName || senderTypeLabel(message.senderType) }}</strong>
                  <span>{{ messageTypeLabel(message.messageType) }} · {{ formatDate(message.createdAt) }}</span>
                </div>
                <p>{{ message.content }}</p>
              </div>
              <el-empty v-if="!(currentDetail.messages || []).length" description="暂无案件沟通记录" :image-size="68" />
            </div>
            <el-form label-position="top" class="case-message-form">
              <div class="split-grid">
                <el-form-item label="消息类型">
                  <el-select v-model="messageForm.messageType">
                    <el-option label="普通留言" value="message" />
                    <el-option label="补件说明" value="revision-request" />
                  </el-select>
                </el-form-item>
                <el-form-item label="发送对象">
                  <el-input :model-value="currentDetail.studentName || '学生'" disabled />
                </el-form-item>
              </div>
              <el-form-item label="沟通内容">
                <el-input v-model="messageForm.content" type="textarea" :rows="4" placeholder="填写给学生的说明，例如补件要求、材料问题、下一步安排" />
              </el-form-item>
              <el-button type="primary" :loading="sendingMessage" :disabled="!messageForm.content" @click="saveCaseMessage">发送给学生</el-button>
            </el-form>
          </div>
        </el-tab-pane>
        <el-tab-pane label="新增跟进">
          <el-form label-position="top">
            <el-form-item label="跟进内容"><el-input v-model="followUp.content" type="textarea" :rows="4" /></el-form-item>
            <div class="split-grid">
              <el-form-item label="跟进类型"><el-select v-model="followUp.followUpType"><el-option label="note" value="note" /><el-option label="status" value="status" /><el-option label="assign" value="assign" /><el-option label="material" value="material" /><el-option label="visa" value="visa" /></el-select></el-form-item>
              <el-form-item label="记录可见性">
                <el-radio-group v-model="followUp.visibility">
                  <el-radio-button label="internal">内部备注</el-radio-button>
                  <el-radio-button label="student">通知学生</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </div>
            <div class="split-grid">
              <el-form-item label="更新状态"><el-select v-model="followUp.statusTo" clearable><el-option label="draft" value="draft" /><el-option label="submitted" value="submitted" /><el-option label="reviewing" value="reviewing" /><el-option label="offer" value="offer" /><el-option label="visa" value="visa" /><el-option label="done" value="done" /></el-select></el-form-item>
              <el-form-item label="下一个动作"><el-input v-model="followUp.nextStep" /></el-form-item>
            </div>
            <div class="split-grid">
              <el-form-item v-if="canAssignCases" label="改派负责人"><el-select v-model="followUp.assignAdminId" clearable><el-option v-for="item in admins" :key="item.id" :label="item.displayName" :value="item.id" /></el-select></el-form-item>
            </div>
            <el-button type="primary" @click="saveFollowUp">保存跟进</el-button>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="跟进记录">
          <el-table :data="currentDetail.followUps || []" border size="small">
            <el-table-column prop="createdAt" label="时间" min-width="160" />
            <el-table-column prop="adminName" label="员工" width="120" />
            <el-table-column prop="followUpType" label="类型" width="100" />
            <el-table-column label="可见性" width="110">
              <template #default="scope">
                <el-tag :type="followUpVisibilityTag(scope.row.visibility)" size="small">{{ scope.row.visibilityLabel || followUpVisibilityLabel(scope.row.visibility) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="content" label="内容" min-width="260" />
            <el-table-column prop="nextStep" label="下一步" min-width="180" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="操作日志">
          <el-table :data="currentDetail.operationLogs || []" border size="small">
            <el-table-column prop="createdAt" label="时间" min-width="160" />
            <el-table-column prop="adminName" label="操作人" width="120" />
            <el-table-column prop="action" label="动作" width="130" />
            <el-table-column prop="summary" label="摘要" min-width="260" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </template>
  </el-dialog>

  <el-dialog v-model="reviewVisible" title="材料审核" width="620px">
    <el-form label-position="top">
      <el-form-item label="材料"><el-input v-model="reviewForm.title" disabled /></el-form-item>
      <el-form-item label="审核结果">
        <el-select v-model="reviewForm.reviewStatus">
          <el-option label="通过" value="approved" />
          <el-option label="需补件" value="needs-revision" />
          <el-option label="未通过" value="rejected" />
          <el-option label="待审核" value="pending-review" />
        </el-select>
      </el-form-item>
      <el-form-item label="审核意见 / 补件说明"><el-input v-model="reviewForm.note" type="textarea" :rows="4" /></el-form-item>
      <el-form-item label="下一步动作"><el-input v-model="reviewForm.nextStep" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="reviewVisible = false">取消</el-button><el-button type="primary" @click="saveReview">保存审核</el-button></template>
  </el-dialog>

  <el-dialog v-model="materialAdjustVisible" title="调整材料清单" width="680px">
    <el-form label-position="top">
      <div class="split-grid">
        <el-form-item label="材料名称"><el-input v-model="materialForm.title" placeholder="例如 补充作品集 / 奖学金证明" /></el-form-item>
        <el-form-item label="材料分类"><el-input v-model="materialForm.category" placeholder="例如 portfolio / scholarship" /></el-form-item>
      </div>
      <div class="split-grid">
        <el-form-item label="材料分组">
          <el-select v-model="materialForm.group" clearable placeholder="选择展示分组">
            <el-option v-for="item in materialGroupOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="要求等级">
          <el-select v-model="materialForm.requirementLevel">
            <el-option v-for="item in materialRequirementOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="来源">
        <el-select v-model="materialForm.source">
          <el-option v-for="item in materialSourceOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="材料说明"><el-input v-model="materialForm.note" type="textarea" :rows="3" placeholder="给学生看的上传说明" /></el-form-item>
      <el-form-item label="上传提示"><el-input v-model="materialForm.uploadTipsText" type="textarea" :rows="3" placeholder="每行一条提示，例如：护照有效期需至少 18 个月以上" /></el-form-item>
      <el-form-item label="调整原因"><el-input v-model="materialForm.reason" type="textarea" :rows="3" placeholder="说明为什么新增或修改该材料要求" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="materialAdjustVisible = false">取消</el-button>
      <el-button type="primary" :disabled="!materialForm.title" @click="saveMaterialAdjustment">保存调整</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="previewVisible" :title="previewState.fileName || '材料预览'" width="860px" @closed="clearMaterialPreview">
    <div class="material-preview-shell">
      <img v-if="previewKind === 'image'" :src="previewState.url" alt="申请材料预览" />
      <iframe v-else-if="previewKind === 'pdf'" :src="previewState.url" title="申请材料 PDF 预览"></iframe>
      <el-empty v-else description="该文件格式暂不支持在线预览" :image-size="80" />
    </div>
    <template #footer>
      <el-button @click="previewVisible = false">关闭</el-button>
      <el-button type="primary" :disabled="!previewState.url" @click="downloadPreviewFile">下载文件</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { adminApi } from "@/api/admin";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const items = ref<any[]>([]);
const universities = ref<any[]>([]);
const programs = ref<any[]>([]);
const admins = ref<any[]>([]);
const total = ref(0);
const visible = ref(false);
const assignVisible = ref(false);
const caseVisible = ref(false);
const reviewVisible = ref(false);
const materialAdjustVisible = ref(false);
const currentDetail = ref<any>(null);
const currentId = ref<number | null>(null);
const viewMode = ref<"all" | "mine" | "unassigned">("all");
const workload = ref<any>({ activeCount: 0, unassignedCount: 0, rows: [] });
const workbench = ref<any>({ summary: { total: 0, high: 0, medium: 0, low: 0, unreadMessages: 0 }, items: [] });
const notifications = ref<any>({ items: [], unreadCount: 0 });
const query = reactive({ page: 1, pageSize: 10, search: "", status: "", universityId: undefined as number | undefined, programId: undefined as number | undefined, dateRange: [] as string[] });
const form = reactive<any>({});
const assignForm = reactive<{ assignedAdminId?: number; note: string }>({ assignedAdminId: undefined, note: "" });
const followUp = reactive({ followUpType: "note", content: "", visibility: "internal", nextStep: "", statusTo: "", assignAdminId: undefined as number | undefined });
const reviewForm = reactive({ applicationId: 0, key: "", title: "", reviewStatus: "approved", note: "", nextStep: "" });
const materialForm = reactive({ action: "add", key: "", title: "", note: "", category: "", group: "", requirementLevel: "required", source: "staff", reason: "", uploadTipsText: "", allowMultipleFiles: false });
const messageForm = reactive({ messageType: "message", content: "" });
const statusForm = reactive({ status: "", note: "", nextFollowUpAt: "" });
const sendingMessage = ref(false);
const updatingStatus = ref(false);
const previewVisible = ref(false);
const previewState = reactive({ url: "", fileName: "", mimeType: "" });

const filteredPrograms = computed(() => programs.value.filter((item) => !form.universityId || item.universityId === form.universityId));
const filteredProgramsForQuery = computed(() => programs.value.filter((item) => !query.universityId || item.universityId === query.universityId));
const statusOptions = [
  { label: "待整理", value: "draft" },
  { label: "已提交平台", value: "submitted" },
  { label: "平台审核中", value: "reviewing" },
  { label: "需补件", value: "need-info" },
  { label: "平台审核通过", value: "platform-approved" },
  { label: "已递交院校", value: "school-submitted" },
  { label: "院校审核中", value: "school-reviewing" },
  { label: "获 Offer", value: "offered" },
  { label: "拒录", value: "rejected" },
  { label: "签证处理中", value: "visa" },
  { label: "完成", value: "done" },
  { label: "已关闭", value: "closed" }
];
const materialRequirementOptions = [
  { label: "必交", value: "required" },
  { label: "建议", value: "recommended" },
  { label: "条件触发", value: "conditional" }
];
const materialGroupOptions = [
  { label: "身份与照片", value: "identity" },
  { label: "学历与成绩公证", value: "academic" },
  { label: "文书与经历", value: "documents" },
  { label: "英文成绩", value: "language" },
  { label: "服务补充", value: "service" },
  { label: "其他材料", value: "additional" }
];
const materialSourceOptions = [
  { label: "后台调整", value: "staff" },
  { label: "院校要求", value: "school" },
  { label: "学历规则", value: "degree" },
  { label: "语言条件", value: "language" },
  { label: "奖学金需求", value: "scholarship" },
  { label: "签证服务需求", value: "visa" },
  { label: "申请档案", value: "profile" }
];
const requestParams = computed(() => ({
  page: query.page,
  pageSize: query.pageSize,
  search: query.search,
  status: query.status,
  universityId: query.universityId,
  programId: query.programId,
  mine: viewMode.value === "mine" ? "1" : undefined,
  unassigned: viewMode.value === "unassigned" ? "1" : undefined,
  startDate: query.dateRange?.[0] || undefined,
  endDate: query.dateRange?.[1] || undefined
}));
const metrics = computed(() => [
  { label: "活跃案件", value: workload.value.activeCount || 0 },
  { label: "我的待处理", value: workbench.value.summary?.total || 0 },
  { label: "待分配案件", value: workload.value.unassignedCount || 0 },
  { label: "未读通知", value: notifications.value.unreadCount || 0 },
  { label: "高优先级", value: workbench.value.summary?.high || 0 }
]);
const statusTransitionOptions = computed(() => currentDetail.value?.workflow?.allowedTransitions || []);
const previewKind = computed(() => {
  if (previewState.mimeType === "application/pdf") return "pdf";
  if (previewState.mimeType.startsWith("image/")) return "image";
  return "";
});
const canAssignCases = computed(() => {
  const roleCodes = auth.profile?.roles?.map((role) => role.code) || [];
  return Boolean(
    auth.hasPermission("application:assign") &&
      (auth.profile?.dataScope === "all" || roleCodes.includes("super-admin") || roleCodes.includes("application-manager") || roleCodes.includes("manager"))
  );
});

const resetForm = () => Object.assign(form, { id: undefined, studentName: "", studentEmail: "", studentPhone: "", universityId: undefined, programId: undefined, applicationStatus: "draft", currentStage: "draft", materialStatus: "draft", visaStatus: "not-started", priority: "medium", intake: "2026-09", assignedAdminId: undefined, notes: "" });

const load = async () => {
  const data = await adminApi.applications(requestParams.value);
  items.value = data.items;
  total.value = data.total;
};
const loadWorkload = async () => { workload.value = await adminApi.applicationWorkload(); };
const loadWorkbench = async () => { workbench.value = await adminApi.applicationWorkbench(); };
const loadNotifications = async () => { notifications.value = await adminApi.applicationNotifications(); };
const loadLookups = async () => {
  universities.value = (await adminApi.universities({ page: 1, pageSize: 200 })).items;
  programs.value = (await adminApi.programs({ page: 1, pageSize: 500 })).items;
  admins.value = (await adminApi.admins({ page: 1, pageSize: 200 })).items;
};
const reloadFirstPage = async () => { query.page = 1; await load(); };
const changeViewMode = async () => { query.page = 1; await load(); };
const refreshAll = async () => { await Promise.all([load(), loadWorkload(), loadWorkbench(), loadNotifications()]); };
const openCreate = () => { resetForm(); visible.value = true; };
const openEdit = async (row: any) => { resetForm(); const detail = await adminApi.applicationDetail(row.id); Object.assign(form, detail); visible.value = true; };
const save = async () => { await adminApi.saveApplication(form); ElMessage.success("已保存"); visible.value = false; await refreshAll(); };
const openAssign = (row: any) => { currentId.value = row.id; Object.assign(assignForm, { assignedAdminId: row.assignedAdminId || undefined, note: "" }); assignVisible.value = true; };
const saveAssign = async () => { if (!currentId.value) return; await adminApi.assignApplication(currentId.value, assignForm); ElMessage.success("已分配负责人并发送通知"); assignVisible.value = false; await refreshAll(); };
const openCase = async (row: any) => { await openCaseById(row.id); };
const openCaseById = async (id: number) => { currentId.value = id; currentDetail.value = await adminApi.applicationDetail(id); resetFollowUp(); resetMessageForm(); resetStatusForm(); caseVisible.value = true; await loadWorkbench(); };
const saveFollowUp = async () => { if (!currentId.value) return; await adminApi.saveFollowUp(currentId.value, followUp); ElMessage.success("已保存跟进"); currentDetail.value = await adminApi.applicationDetail(currentId.value); resetFollowUp(); await refreshAll(); };
const openReview = (material: any) => { if (!currentId.value) return; Object.assign(reviewForm, { applicationId: currentId.value, key: material.key, title: material.title, reviewStatus: material.reviewStatus === "approved" ? "approved" : "needs-revision", note: material.reviewNote || "", nextStep: "" }); reviewVisible.value = true; };
const saveReview = async () => { await adminApi.reviewApplicationMaterial(reviewForm.applicationId, reviewForm.key, { reviewStatus: reviewForm.reviewStatus, note: reviewForm.note, nextStep: reviewForm.nextStep }); ElMessage.success("已保存材料审核"); reviewVisible.value = false; currentDetail.value = await adminApi.applicationDetail(reviewForm.applicationId); await refreshAll(); };
const exportRows = async () => { const data = await adminApi.exportApplications(requestParams.value); currentDetail.value = { operationLogs: [], followUps: [], materials: [], exportRows: data }; ElMessage.success(`已导出 ${data.length} 条数据`); };
const markNotificationRead = async (id: number) => { await adminApi.readApplicationNotification(id); await loadNotifications(); };
const openNotification = async (item: any) => { await markNotificationRead(item.id); await openCaseById(Number(item.targetId)); };

function resetFollowUp() {
  Object.assign(followUp, { followUpType: "note", content: "", visibility: "internal", nextStep: "", statusTo: "", assignAdminId: undefined });
}

function resetMessageForm() {
  Object.assign(messageForm, { messageType: "message", content: "" });
}

function resetStatusForm() {
  Object.assign(statusForm, { status: statusTransitionOptions.value[0]?.status || "", note: "", nextFollowUpAt: "" });
}

function resetMaterialForm() {
  Object.assign(materialForm, { action: "add", key: "", title: "", note: "", category: "", group: "", requirementLevel: "required", source: "staff", reason: "", uploadTipsText: "", allowMultipleFiles: false });
}

function openAddMaterial() {
  resetMaterialForm();
  materialAdjustVisible.value = true;
}

function openEditMaterial(material: any) {
  resetMaterialForm();
  Object.assign(materialForm, {
    action: "update",
    key: material.key,
    title: material.title,
    note: material.note || "",
    category: material.category || "",
    group: material.group || "",
    requirementLevel: material.requirementLevel || "required",
    source: material.source || "staff",
    reason: material.reason || "",
    uploadTipsText: (material.uploadTips || []).join("\n"),
    allowMultipleFiles: Boolean(material.allowMultipleFiles)
  });
  materialAdjustVisible.value = true;
}

async function saveMaterialAdjustment() {
  if (!currentId.value || !materialForm.title) return;
  const { uploadTipsText, ...payload } = materialForm;
  currentDetail.value = await adminApi.adjustApplicationMaterial(currentId.value, {
    ...payload,
    uploadTips: uploadTipsText.split("\n").map((item) => item.trim()).filter(Boolean)
  });
  ElMessage.success(materialForm.action === "add" ? "已新增材料要求" : "已修改材料要求");
  materialAdjustVisible.value = false;
  await refreshAll();
}

async function waiveMaterial(material: any) {
  if (!currentId.value) return;
  const waiverReason = window.prompt(`请输入豁免「${material.title}」的原因`, material.waiverReason || "该学生当前申请不需要提交此材料。");
  if (waiverReason === null) return;
  currentDetail.value = await adminApi.adjustApplicationMaterial(currentId.value, {
    action: "waive",
    key: material.key,
    waiverReason
  });
  ElMessage.success("已豁免该材料");
  await refreshAll();
}

async function reopenMaterial(material: any) {
  if (!currentId.value) return;
  if (!window.confirm(`确认恢复「${material.title}」为需要提交的材料吗？`)) return;
  currentDetail.value = await adminApi.adjustApplicationMaterial(currentId.value, {
    action: "reopen",
    key: material.key
  });
  ElMessage.success("已恢复该材料要求");
  await refreshAll();
}

async function saveStatusUpdate() {
  if (!currentId.value || !statusForm.status) return;
  updatingStatus.value = true;
  try {
    currentDetail.value = await adminApi.updateApplicationStatus(currentId.value, {
      status: statusForm.status,
      note: statusForm.note,
      nextStep: statusForm.note,
      nextFollowUpAt: statusForm.nextFollowUpAt
    });
    ElMessage.success("申请状态已更新并通知学生");
    resetStatusForm();
    await refreshAll();
  } finally {
    updatingStatus.value = false;
  }
}

async function saveCaseMessage() {
  if (!currentId.value || !messageForm.content) return;
  sendingMessage.value = true;
  try {
    await adminApi.sendApplicationMessage(currentId.value, messageForm);
    ElMessage.success("已发送案件消息");
    currentDetail.value = await adminApi.applicationDetail(currentId.value);
    resetMessageForm();
    await refreshAll();
  } finally {
    sendingMessage.value = false;
  }
}

async function downloadMaterial(material: any, versionId?: string, fileName?: string) {
  if (!currentId.value || !material.hasFile) return;
  const response = await adminApi.downloadApplicationMaterial(currentId.value, material.key, versionId);
  const blob = new Blob([response.data], { type: response.headers?.["content-type"] || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || material.fileName || "application-material";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function previewMaterial(material: any, versionId?: string, fileName?: string, mimeType?: string) {
  if (!currentId.value) return;
  const response = await adminApi.downloadApplicationMaterial(currentId.value, material.key, versionId);
  const nextFileName = fileName || material.fileName || "application-material";
  const nextMimeType = resolvePreviewMimeType(headerContentType(response), nextFileName, mimeType || material.mimeType);
  if (!isPreviewableMaterialMimeType(nextMimeType)) {
    ElMessage.warning("仅支持在线预览 PDF、JPG、PNG 或 WebP 文件");
    return;
  }
  revokePreviewUrl();
  const blob = new Blob([response.data], { type: nextMimeType });
  previewState.url = URL.createObjectURL(blob);
  previewState.fileName = nextFileName;
  previewState.mimeType = nextMimeType;
  previewVisible.value = true;
}

function downloadPreviewFile() {
  if (!previewState.url) return;
  const link = document.createElement("a");
  link.href = previewState.url;
  link.download = previewState.fileName || "application-material";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function clearMaterialPreview() {
  revokePreviewUrl();
  previewState.fileName = "";
  previewState.mimeType = "";
}

function revokePreviewUrl() {
  if (!previewState.url) return;
  URL.revokeObjectURL(previewState.url);
  previewState.url = "";
}

function headerContentType(response: any) {
  const header = response.headers?.["content-type"] || response.headers?.get?.("content-type");
  return Array.isArray(header) ? header[0] : String(header || "");
}

function resolvePreviewMimeType(headerMimeType: string, fileName: string, fallbackMimeType?: string) {
  const normalizedHeader = normalizeMimeType(headerMimeType);
  if (isPreviewableMaterialMimeType(normalizedHeader)) return normalizedHeader;
  const normalizedFallback = normalizeMimeType(fallbackMimeType || "");
  if (isPreviewableMaterialMimeType(normalizedFallback)) return normalizedFallback;
  return mimeTypeFromFileName(fileName);
}

function normalizeMimeType(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() || "";
}

function mimeTypeFromFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };
  return mimeTypes[extension || ""] || "application/octet-stream";
}

function isPreviewableMaterialMimeType(mimeType: string) {
  return mimeType === "application/pdf" || mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp";
}

function currentMaterialVersion(material: any) {
  const versions = material.versions || [];
  const current = versions.find((item: any) => item.id === material.currentVersionId) || versions[versions.length - 1];
  return current?.version || (material.hasFile ? 1 : 0);
}

function materialProgressText(row: any) {
  const summary = row.materialSummary || {};
  return `${summary.approved || 0}/${summary.total || 0} 通过，${summary.pendingReview || 0} 待审`;
}

function profileStatusTagType(status?: string) {
  if (status === "complete") return "success";
  if (status === "missing-contact" || status === "missing-language" || status === "missing-budget") return "danger";
  return "warning";
}

function profileLevelLabel(level?: string) {
  const labels: Record<string, string> = { bachelor: "本科", master: "硕士", phd: "博士" };
  return labels[level || ""] || level || "待补充";
}

function profileCategoryLabel(category?: string) {
  const labels: Record<string, string> = { it: "计算机 / IT", IT: "计算机 / IT", business: "商科", engineering: "工程", science: "理科", arts: "艺术与设计", medicine: "医学健康", law: "法学" };
  return labels[category || ""] || category || "待补充";
}

function profileAcademicText(row: any) {
  const academic = row?.applicationProfileSnapshot?.academicBackground || {};
  return [academic.currentEducation, academic.schoolName, academic.majorName, academic.graduationYear].filter(Boolean).join(" · ") || "待补充";
}

function profileScoreText(row: any) {
  const snapshot = row?.applicationProfileSnapshot || {};
  const academic = snapshot.academicBackground || {};
  return [snapshot.gpa ? `GPA ${snapshot.gpa}` : "", academic.averageScore, academic.gradingScale].filter(Boolean).join(" · ") || "待补充";
}

function profileLanguageText(row: any) {
  const snapshot = row?.applicationProfileSnapshot || {};
  const language = snapshot.languageProfile || {};
  return [language.testType, language.overallScore || (snapshot.ielts ? `IELTS 等效 ${snapshot.ielts}` : ""), language.scoreBreakdown, language.testDate ? `考试 ${language.testDate}` : "", language.plannedTestDate ? `计划 ${language.plannedTestDate}` : ""].filter(Boolean).join(" · ") || "待补充";
}

function profileBudgetText(value?: number | null) {
  const budget = Number(value || 0);
  if (!budget) return "待补充";
  return `约 ${Math.round(budget / 10000)} 万人民币/年`;
}

function profilePreferenceText(row: any) {
  const preferences = row?.applicationProfileSnapshot?.studyPreferences || {};
  const cities = Array.isArray(preferences.preferredCities) ? preferences.preferredCities.join("、") : "";
  const tags = [preferences.intake ? `入学 ${preferences.intake}` : "", cities, preferences.preferredUniversityType, preferences.rankingPriority, preferences.scholarshipNeeded ? "需要奖学金" : "", preferences.accommodationNeeded ? "需要住宿" : ""];
  return tags.filter(Boolean).join(" · ") || "待补充";
}

function profileServiceText(row: any) {
  const service = row?.applicationProfileSnapshot?.serviceNeeds || {};
  return Array.isArray(service.needs) && service.needs.length ? service.needs.join("、") : service.notes || "待补充";
}

function profileContactText(row: any) {
  const contact = row?.applicationProfileSnapshot?.contactInfo || {};
  return [contact.fullName, contact.phone, contact.wechat, contact.whatsapp, contact.email, contact.currentLocation, contact.nationality].filter(Boolean).join(" · ") || "待补充";
}

function profileSnapshotCompactText(row: any) {
  const summary = row?.applicationProfileSummary || {};
  const snapshot = row?.applicationProfileSnapshot || {};
  return [
    `${summary.statusLabel || "信息不足"} ${summary.completion || 0}%`,
    profileLevelLabel(snapshot.level),
    profileCategoryLabel(snapshot.targetCategory),
    profileBudgetText(snapshot.budgetCny),
    profileLanguageText(row)
  ].filter(Boolean).join(" · ");
}

function catalogRiskLabel(risk?: string | null) {
  const labels: Record<string, string> = { high: "高风险", medium: "中风险", low: "低风险" };
  return risk ? labels[risk] || risk : "无关键风险";
}

function catalogRiskTagType(risk?: string | null) {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  if (risk === "low") return "info";
  return "success";
}

function catalogSummaryAlertType(summary?: any) {
  if (summary?.missingSnapshot || summary?.highestRisk === "high") return "error";
  if (summary?.highestRisk === "medium") return "warning";
  if (summary?.highestRisk === "low") return "info";
  return "success";
}

function catalogTargetText(snapshot?: any) {
  if (!snapshot) return "无申请时目录快照";
  const university = snapshot.university?.name || snapshot.university?.shortName || "学校缺失";
  const program = snapshot.program?.name || snapshot.program?.code || "专业缺失";
  return `${university} / ${program}`;
}

function catalogFeeText(fee?: any) {
  if (!fee) return "费用字段缺失";
  const filterable = fee.filterableTuitionCny == null ? "不可参与预算筛选" : `预算筛选 ${Number(fee.filterableTuitionCny).toLocaleString("zh-CN")} CNY/年`;
  return [fee.listTuitionText || fee.displayText, filterable, fee.auditStatusLabel].filter(Boolean).join(" · ");
}

function catalogLanguageText(language?: any) {
  if (!language) return "语言字段缺失";
  return [language.summary, language.officialText, language.requirementNote].filter(Boolean).join(" · ") || "未配置语言要求";
}

function catalogApplicationDocsText(snapshot?: any) {
  if (!snapshot?.program) return "材料字段缺失";
  const docs = Array.isArray(snapshot.program.applicationDocs) ? snapshot.program.applicationDocs : [];
  const caseMaterials = Array.isArray(snapshot.caseMaterials) ? snapshot.caseMaterials : [];
  const docPreview = docs.length ? docs.slice(0, 4).join("、") : "未配置目录材料";
  const suffix = docs.length > 4 ? `等 ${docs.length} 项` : `${docs.length} 项`;
  return [`目录材料：${docPreview}${docs.length ? `（${suffix}）` : ""}`, caseMaterials.length ? `案件材料快照：${caseMaterials.length} 项` : ""].filter(Boolean).join(" · ");
}

function catalogStatusText(snapshot?: any) {
  if (!snapshot) return "公开与来源字段缺失";
  const university = snapshot.university ? `学校 ${snapshot.university.publicDisplayStatusLabel} / ${snapshot.university.officialSourceStatusLabel}` : "学校状态缺失";
  const program = snapshot.program ? `专业 ${snapshot.program.publicDisplayStatusLabel} / ${snapshot.program.officialSourceStatusLabel}` : "专业状态缺失";
  return `${university} · ${program}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { draft: "待整理", submitted: "已提交平台", reviewing: "平台审核中", "need-info": "需补件", "platform-approved": "平台审核通过", "school-submitted": "已递交院校", "school-reviewing": "院校审核中", offered: "获 Offer", offer: "Offer", rejected: "拒录", visa: "签证处理中", done: "完成", closed: "已关闭" };
  return labels[status] || status;
}

function statusTagType(status: string) {
  if (status === "submitted") return "warning";
  if (status === "reviewing") return "primary";
  if (status === "need-info" || status === "rejected") return "danger";
  if (status === "done" || status === "offer" || status === "offered" || status === "platform-approved") return "success";
  if (status === "closed" || status === "school-submitted" || status === "school-reviewing" || status === "visa") return "info";
  return "";
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = { high: "高", medium: "中", low: "低" };
  return labels[priority] || priority;
}

function priorityTagType(priority: string) {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  return "info";
}

function reviewStatusLabel(status: string) {
  const labels: Record<string, string> = { "not-uploaded": "未上传", "pending-review": "待审核", approved: "已通过", "needs-revision": "需补件", rejected: "未通过" };
  return labels[status] || status;
}

function reviewTagType(status: string) {
  if (status === "approved") return "success";
  if (status === "needs-revision" || status === "rejected") return "danger";
  if (status === "pending-review") return "warning";
  return "info";
}

function materialRequirementLabel(level?: string) {
  const labels: Record<string, string> = { required: "必交", recommended: "建议", conditional: "条件触发" };
  return labels[level || "required"] || "必交";
}

function materialRequirementTagType(level?: string) {
  if (level === "conditional") return "warning";
  if (level === "recommended") return "info";
  return "danger";
}

function materialSourceLabel(source?: string) {
  const labels: Record<string, string> = { school: "院校要求", degree: "学历规则", language: "语言条件", scholarship: "奖学金需求", visa: "签证服务需求", profile: "申请档案", staff: "后台调整" };
  return labels[source || "school"] || "院校要求";
}

function messageTypeLabel(type: string) {
  const labels: Record<string, string> = { message: "留言", "revision-request": "补件说明", "material-upload": "材料上传", system: "系统" };
  return labels[type] || type;
}

function senderTypeLabel(type: string) {
  const labels: Record<string, string> = { student: "学生", admin: "后台员工", system: "系统" };
  return labels[type] || type;
}

function followUpVisibilityLabel(visibility?: string) {
  const labels: Record<string, string> = { internal: "内部备注", student: "学生可见", system: "系统记录" };
  return labels[visibility || "internal"] || labels.internal;
}

function followUpVisibilityTag(visibility?: string) {
  if (visibility === "student") return "primary";
  if (visibility === "system") return "info";
  return "warning";
}

function formatFileSize(size?: number) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

onMounted(async () => {
  resetForm();
  await loadLookups();
  await refreshAll();
});
</script>

<style scoped>
.application-admin-page {
  display: grid;
  gap: 18px;
}

.notification-list {
  display: grid;
  gap: 10px;
}

.notification-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: #f8fafc;
}

.notification-row.unread {
  border-color: rgba(239, 68, 68, 0.28);
  background: #fff7ed;
}

.notification-row strong,
.notification-row span {
  display: block;
  overflow-wrap: anywhere;
}

.notification-row span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.case-summary {
  margin-bottom: 16px;
}

.case-profile-inline {
  margin-left: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.case-flow-panel {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.4fr);
  gap: 16px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: #f8fafc;
}

.case-flow-panel span,
.case-flow-panel small {
  display: block;
  color: #64748b;
}

.case-flow-panel strong {
  display: block;
  margin: 6px 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.case-flow-form {
  min-width: 0;
}

.material-version-panel {
  padding: 12px 16px;
  background: #f8fafc;
}

.material-adjust-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: #f8fafc;
}

.material-adjust-toolbar strong,
.material-adjust-toolbar span {
  display: block;
  overflow-wrap: anywhere;
}

.material-adjust-toolbar span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.material-version-panel__title {
  margin-bottom: 10px;
  color: #334155;
  font-weight: 700;
}

.material-title-cell {
  display: grid;
  gap: 3px;
}

.material-title-cell strong,
.material-title-cell span,
.material-title-cell small {
  display: block;
  overflow-wrap: anywhere;
}

.material-title-cell span {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.material-title-cell small {
  color: #64748b;
  font-size: 12px;
}

.material-title-cell small::before {
  content: "· ";
}

.material-preview-shell {
  min-height: 520px;
  max-height: 72vh;
  overflow: auto;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  background: #f8fafc;
}

.material-preview-shell iframe {
  display: block;
  width: 100%;
  height: 70vh;
  min-height: 520px;
  border: 0;
  background: #fff;
}

.material-preview-shell img {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  margin: 0 auto;
  object-fit: contain;
}

.case-message-layout {
  display: grid;
  gap: 16px;
}

.case-message-list {
  display: grid;
  gap: 10px;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: #f8fafc;
}

.case-message {
  max-width: 78%;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: #fff;
}

.case-message--admin {
  justify-self: end;
  border-color: rgba(37, 99, 235, 0.22);
  background: #eff6ff;
}

.case-message--student {
  justify-self: start;
}

.case-message__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #64748b;
  font-size: 12px;
}

.case-message__meta strong,
.case-message p {
  overflow-wrap: anywhere;
}

.case-message p {
  margin: 8px 0 0;
  color: #0f172a;
}

.case-message-form {
  padding-top: 4px;
}

.profile-list-cell {
  display: grid;
  gap: 4px;
}

.profile-list-cell span {
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.case-profile-panel {
  display: grid;
  gap: 14px;
}

.case-profile-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.case-profile-panel__head strong,
.case-profile-panel__head span {
  display: block;
  overflow-wrap: anywhere;
}

.case-profile-panel__head span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.case-profile-descriptions {
  width: 100%;
}

.catalog-snapshot-panel {
  display: grid;
  gap: 14px;
}

.catalog-snapshot-panel__head,
.catalog-snapshot-profile,
.catalog-snapshot-section__title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.catalog-snapshot-panel__head strong,
.catalog-snapshot-panel__head span,
.catalog-snapshot-profile strong,
.catalog-snapshot-profile span,
.catalog-snapshot-section__title strong,
.catalog-snapshot-section__title span {
  display: block;
  overflow-wrap: anywhere;
}

.catalog-snapshot-panel__head span,
.catalog-snapshot-profile span,
.catalog-snapshot-section__title span {
  color: #64748b;
  font-size: 13px;
}

.catalog-snapshot-profile {
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: #f8fafc;
}

.catalog-snapshot-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.catalog-snapshot-section {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 8px;
  background: #fff;
}

.catalog-snapshot-section dl {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px 12px;
  margin: 12px 0 0;
}

.catalog-snapshot-section dt {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.catalog-snapshot-section dd {
  margin: 0;
  color: #0f172a;
  overflow-wrap: anywhere;
}

.catalog-diff-value {
  line-height: 1.45;
  white-space: normal;
  overflow-wrap: anywhere;
}

@media (max-width: 960px) {
  .notification-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .case-flow-panel {
    grid-template-columns: 1fr;
  }

  .case-message {
    max-width: 100%;
  }

  .case-message__meta {
    flex-direction: column;
    gap: 4px;
  }

  .case-profile-panel__head {
    flex-direction: column;
  }

  .catalog-snapshot-panel__head,
  .catalog-snapshot-profile,
  .catalog-snapshot-section__title {
    flex-direction: column;
  }

  .catalog-snapshot-columns {
    grid-template-columns: 1fr;
  }

  .catalog-snapshot-section dl {
    grid-template-columns: 1fr;
  }
}
</style>
