<template>
  <div class="recommendation-admin-page">
    <section class="page-card recommendation-admin-hero" v-loading="loading">
      <div class="page-toolbar recommendation-admin-hero__toolbar">
        <div>
          <div class="recommendation-admin-hero__title">智能推荐管理</div>
          <div class="section-subtitle">
            维护登录门禁、学生画像完整度、推荐规则状态和可解释推荐结果的管理端验证界面。
          </div>
        </div>
        <div class="page-toolbar__right">
          <el-button :loading="loading" @click="loadContract">刷新契约</el-button>
          <el-button type="primary" @click="openCreateRule">新增规则</el-button>
        </div>
      </div>

      <el-alert
        v-if="loadError"
        class="recommendation-admin-alert"
        :title="loadError"
        type="warning"
        show-icon
        :closable="false"
      />

      <div class="metrics-grid recommendation-admin-metrics">
        <div class="metric-card">
          <div class="metric-card__label">契约版本</div>
          <div class="metric-card__value recommendation-admin-metric-text">{{ contract.schemaVersion }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">必填画像字段</div>
          <div class="metric-card__value">{{ contract.requiredProfileFields.length }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">完整度门槛</div>
          <div class="metric-card__value">{{ contract.completenessThreshold }}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">启用规则</div>
          <div class="metric-card__value">{{ enabledRuleCount }}</div>
        </div>
      </div>

      <div class="recommendation-admin-source">
        <el-tag type="info" effect="plain">来源：{{ contractSource }}</el-tag>
        <el-tag type="success" effect="plain">个性化推荐必须登录</el-tag>
        <el-tag type="warning" effect="plain">公开建议模式不能包装为个性化推荐</el-tag>
      </div>
    </section>

    <section class="page-card recommendation-trace-card" v-loading="runLoading">
      <div class="page-toolbar recommendation-trace-toolbar">
        <div>
          <strong>推荐与画像追溯中心</strong>
          <div class="section-subtitle">
            {{ centerPositioning || "后台运营和顾问追溯中心，不是前端会员中心。" }}
          </div>
        </div>
        <div class="page-toolbar__right recommendation-trace-filters">
          <el-input
            v-model="runQuery.search"
            clearable
            placeholder="搜索运行ID、学生ID或账号"
            @clear="handleRunSearch"
            @keyup.enter="handleRunSearch"
          />
          <el-select v-model="runQuery.status" clearable placeholder="运行状态" @change="handleRunSearch">
            <el-option v-for="item in runStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-button :loading="runLoading" @click="loadRecommendationRuns">刷新记录</el-button>
        </div>
      </div>

      <el-alert
        v-if="runError"
        class="recommendation-admin-alert"
        :title="runError"
        type="warning"
        show-icon
        :closable="false"
      />

      <div class="metrics-grid recommendation-admin-metrics">
        <div class="metric-card">
          <div class="metric-card__label">运行记录</div>
          <div class="metric-card__value">{{ runSummary.total }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">已生成</div>
          <div class="metric-card__value">{{ runSummary.byStatus.generated || 0 }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">无匹配</div>
          <div class="metric-card__value">{{ runSummary.byStatus["no-match"] || 0 }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">画像阻断</div>
          <div class="metric-card__value">{{ runSummary.byStatus["blocked-profile-incomplete"] || 0 }}</div>
        </div>
      </div>

      <div class="recommendation-trace-privacy">
        <el-tag type="info" effect="plain">{{ privacyBoundary }}</el-tag>
      </div>

      <div class="recommendation-admin-table-wrap">
        <el-table :data="recommendationRuns" border class="recommendation-trace-table" empty-text="暂无推荐运行记录">
          <el-table-column type="expand">
            <template #default="scope">
              <div class="recommendation-trace-detail">
                <div class="recommendation-admin-panel">
                  <div class="recommendation-admin-section-title">使用的画像字段</div>
                  <el-table :data="scope.row.profileSnapshot" size="small" border>
                    <el-table-column prop="label" label="字段" min-width="150" />
                    <el-table-column label="运行时取值" min-width="160">
                      <template #default="fieldScope">{{ formatTraceValue(fieldScope.row.value) }}</template>
                    </el-table-column>
                    <el-table-column label="状态" width="110">
                      <template #default="fieldScope">
                        <el-tag :type="fieldScope.row.captured ? 'success' : 'warning'" effect="plain">
                          {{ fieldScope.row.captured ? "已采集" : "未采集" }}
                        </el-tag>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div v-if="scope.row.missingProfileFields.length" class="recommendation-trace-tags">
                    <span class="recommendation-trace-label">缺失字段</span>
                    <el-tag v-for="field in scope.row.missingProfileFields" :key="field.field" type="warning" effect="plain">
                      {{ field.label }}
                    </el-tag>
                  </div>
                </div>

                <div class="recommendation-admin-panel">
                  <div class="recommendation-admin-section-title">缓存与画像失效</div>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="缓存状态">
                      <el-tag :type="cacheStateTag(scope.row.cache.state)">
                        {{ scope.row.cache.label }}
                      </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="缓存说明">{{ scope.row.cache.reason }}</el-descriptions-item>
                    <el-descriptions-item label="画像版本">
                      提交时 v{{ scope.row.profileVersion }} / 当前 v{{ scope.row.currentProfileVersion || "-" }}
                    </el-descriptions-item>
                    <el-descriptions-item label="失效触发">
                      <div class="recommendation-trace-tags">
                        <el-tag
                          v-for="trigger in scope.row.profileDrift.invalidationTriggers"
                          :key="trigger"
                          type="warning"
                          effect="plain"
                        >
                          {{ driftTriggerLabel(trigger) }}
                        </el-tag>
                        <span v-if="!scope.row.profileDrift.invalidationTriggers.length">无</span>
                      </div>
                    </el-descriptions-item>
                    <el-descriptions-item label="缓存 Key">{{ scope.row.cache.cacheKey || "-" }}</el-descriptions-item>
                  </el-descriptions>
                </div>
              </div>

              <div class="recommendation-trace-results">
                <div class="recommendation-admin-section-title">匹配到的公开专业字段与推荐理由</div>
                <div v-if="!scope.row.results.length" class="empty-hint">本次运行没有生成推荐结果。</div>
                <div v-for="result in scope.row.results" :key="`${scope.row.id}-${result.programId}`" class="recommendation-trace-result">
                  <div class="recommendation-trace-result__header">
                    <div>
                      <strong>{{ result.programName }}</strong>
                      <span>{{ result.universityName }}</span>
                    </div>
                    <div class="recommendation-trace-result__meta">
                      <el-tag type="success" effect="plain">分数 {{ result.score }}</el-tag>
                      <el-tag effect="plain">{{ tierLabel(result.tier) }}</el-tag>
                      <el-tag :type="result.riskSources.length ? 'warning' : 'info'" effect="plain">
                        风险 {{ result.riskSources.length }}
                      </el-tag>
                    </div>
                  </div>

                  <div class="recommendation-trace-source-grid">
                    <el-descriptions :column="1" border size="small">
                      <el-descriptions-item label="费用来源">
                        {{ result.feeSource.displayText || "-" }}
                        <span class="muted">
                          / {{ result.feeSource.officialFeeAuditStatus || "未复核" }}
                        </span>
                      </el-descriptions-item>
                      <el-descriptions-item label="预算筛选">
                        {{ result.feeSource.filterableTuitionCny == null ? "不可参与预算筛选" : formatCurrency(result.feeSource.filterableTuitionCny) }}
                      </el-descriptions-item>
                      <el-descriptions-item label="费用来源URL">
                        <span>{{ result.feeSource.officialFeeSourceUrl || result.feeSource.secondaryOfficialFeeSourceUrl || "-" }}</span>
                      </el-descriptions-item>
                    </el-descriptions>

                    <el-descriptions :column="1" border size="small">
                      <el-descriptions-item label="语言要求">
                        IELTS {{ result.languageSource.ielts ?? "-" }}
                      </el-descriptions-item>
                      <el-descriptions-item label="官方语言说明">
                        {{ result.languageSource.officialLanguageRequirement || "-" }}
                      </el-descriptions-item>
                      <el-descriptions-item label="来源URL">
                        {{ result.languageSource.officialEntryRequirementSourceUrl || "-" }}
                      </el-descriptions-item>
                    </el-descriptions>
                  </div>

                  <div class="recommendation-trace-tags">
                    <span class="recommendation-trace-label">画像字段</span>
                    <el-tag v-for="field in result.profileFields" :key="field.field" effect="plain">
                      {{ field.label }}
                    </el-tag>
                  </div>
                  <div class="recommendation-trace-tags">
                    <span class="recommendation-trace-label">公开专业字段</span>
                    <el-tag v-for="field in result.publicDataFields" :key="field.field" type="info" effect="plain">
                      {{ field.label }}：{{ formatTraceValue(field.currentValue) }}
                    </el-tag>
                  </div>

                  <div class="recommendation-trace-source-grid">
                    <div class="recommendation-trace-source-list">
                      <div class="recommendation-trace-label">推荐理由来源</div>
                      <div v-for="reason in result.reasonSources" :key="reason.code" class="recommendation-trace-source-item">
                        <strong>{{ reason.message }}</strong>
                        <span>
                          {{ reason.profileFieldLabel || "画像字段" }} {{ formatTraceValue(reason.profileValue) }}
                          / {{ reason.publicDataFieldLabel || "公开字段" }} {{ formatTraceValue(reason.publicDataValue) }}
                        </span>
                      </div>
                    </div>
                    <div class="recommendation-trace-source-list">
                      <div class="recommendation-trace-label">风险来源</div>
                      <div v-if="!result.riskSources.length" class="recommendation-trace-source-item muted">无风险提示</div>
                      <div v-for="risk in result.riskSources" :key="risk.code" class="recommendation-trace-source-item">
                        <strong>
                          <el-tag :type="riskSeverityTag(risk.severity)" effect="plain">{{ riskSeverityLabel(risk.severity) }}</el-tag>
                          {{ risk.message }}
                        </strong>
                        <span>{{ risk.profileFieldLabel || "-" }} / {{ risk.publicDataFieldLabel || "-" }}</span>
                        <span>{{ risk.suggestion }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="运行" width="110">
            <template #default="scope">#{{ scope.row.id }}</template>
          </el-table-column>
          <el-table-column label="学生" min-width="190">
            <template #default="scope">
              <div class="recommendation-admin-name-cell">
                <strong>{{ scope.row.student.displayName }}</strong>
                <span>{{ scope.row.student.accountMasked || `用户 #${scope.row.userId}` }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="150">
            <template #default="scope">
              <el-tag :type="runStatusTag(scope.row.status)">{{ scope.row.statusLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="画像版本" width="150">
            <template #default="scope">
              v{{ scope.row.profileVersion }} / 当前 v{{ scope.row.currentProfileVersion || "-" }}
            </template>
          </el-table-column>
          <el-table-column label="缓存" min-width="160">
            <template #default="scope">
              <el-tag :type="cacheStateTag(scope.row.cache.state)" effect="plain">
                {{ scope.row.cache.label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="追溯字段" width="150">
            <template #default="scope">
              {{ scope.row.traceSummary.profileFieldCount }} 画像 / {{ scope.row.traceSummary.publicDataFieldCount }} 公开
            </template>
          </el-table-column>
          <el-table-column label="结果" width="90">
            <template #default="scope">{{ scope.row.resultCount }}</template>
          </el-table-column>
          <el-table-column label="生成时间" min-width="180">
            <template #default="scope">{{ formatDateTime(scope.row.generatedAt || scope.row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </div>

      <div class="recommendation-trace-pagination">
        <el-pagination
          v-model:current-page="runQuery.page"
          v-model:page-size="runQuery.pageSize"
          :page-sizes="[6, 10, 12, 20]"
          :total="runTotal"
          layout="total, sizes, prev, pager, next"
          @size-change="handleRunSizeChange"
          @current-change="loadRecommendationRuns"
        />
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>学生画像完整度</strong>
          <div class="section-subtitle">用于核对推荐前置字段、缺失提示和画像入口展示。</div>
        </div>
        <el-segmented v-model="fieldView" :options="fieldViewOptions" />
      </div>
      <div class="recommendation-admin-table-wrap">
        <el-table :data="visibleProfileFields" border>
          <el-table-column label="画像字段" min-width="180">
            <template #default="scope">
              <div class="recommendation-admin-name-cell">
                <strong>{{ profileFieldLabel(scope.row.field) }}</strong>
                <span>{{ scope.row.field }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="前置要求" width="120">
            <template #default="scope">
              <el-tag :type="scope.row.required ? 'danger' : 'info'" effect="plain">
                {{ scope.row.required ? "必填" : "可选" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="weight" label="完整度权重" width="120" />
          <el-table-column label="缺失时动作" min-width="180">
            <template #default="scope">{{ scope.row.required ? "阻断推荐并引导完善画像" : "提示补充但不阻断" }}</template>
          </el-table-column>
          <el-table-column label="状态" width="130">
            <template #default="scope">
              <el-switch
                v-model="scope.row.enabled"
                active-text="启用"
                inactive-text="停用"
                @change="recordFieldToggle(scope.row)"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section class="page-card">
      <div class="split-grid recommendation-admin-split">
        <div class="recommendation-admin-panel">
          <div class="recommendation-admin-section-title">状态交互预览</div>
          <el-radio-group v-model="selectedScenario" class="recommendation-admin-scenarios">
            <el-radio-button v-for="scenario in gateScenarios" :key="scenario.key" :value="scenario.key">
              {{ scenario.label }}
            </el-radio-button>
          </el-radio-group>

          <el-descriptions :column="1" border>
            <el-descriptions-item label="访问状态">
              <el-tag :type="gateStatusTag(activeScenario.status)">{{ activeScenario.statusLabel }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="是否展示推荐列表">
              {{ activeScenario.canShowRecommendations ? "允许展示" : "禁止展示" }}
            </el-descriptions-item>
            <el-descriptions-item label="主动作">{{ activeScenario.primaryAction }}</el-descriptions-item>
            <el-descriptions-item label="阻断原因">
              <div class="recommendation-admin-tags">
                <el-tag v-for="reason in activeScenario.blockReasons" :key="reason" type="warning" effect="plain">
                  {{ reason }}
                </el-tag>
                <span v-if="!activeScenario.blockReasons.length">无</span>
              </div>
            </el-descriptions-item>
          </el-descriptions>

          <div class="recommendation-admin-actions">
            <el-button @click="selectedScenario = 'login-required'">模拟退出登录</el-button>
            <el-button @click="selectedScenario = 'profile-incomplete'">模拟画像缺失</el-button>
            <el-button type="primary" @click="refreshPreview">模拟刷新推荐</el-button>
          </div>

          <el-alert
            class="recommendation-admin-alert"
            :title="interactionMessage"
            type="info"
            show-icon
            :closable="false"
          />
        </div>

        <el-form label-position="top" class="recommendation-admin-panel">
          <div class="recommendation-admin-section-title">规则表单</div>
          <div class="split-grid">
            <el-form-item label="规则名称"><el-input v-model="ruleForm.name" /></el-form-item>
            <el-form-item label="规则范围">
              <el-select v-model="ruleForm.scope">
                <el-option v-for="item in ruleScopeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="关联画像字段">
              <el-select v-model="ruleForm.profileField" clearable>
                <el-option v-for="item in profileFieldOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="关联公开数据字段">
              <el-select v-model="ruleForm.publicDataField" clearable filterable>
                <el-option v-for="item in publicDataFieldOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="权重">
              <el-input-number v-model="ruleForm.weight" :min="0" :max="100" />
            </el-form-item>
            <el-form-item label="风险级别">
              <el-select v-model="ruleForm.riskSeverity">
                <el-option v-for="item in riskSeverityOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="split-grid">
            <el-form-item label="申请层级">
              <el-select v-model="ruleForm.tier">
                <el-option label="冲刺" value="reach" />
                <el-option label="匹配" value="target" />
                <el-option label="保底" value="safe" />
              </el-select>
            </el-form-item>
            <el-form-item label="规则状态">
              <el-select v-model="ruleForm.status">
                <el-option v-for="item in ruleStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="说明">
            <el-input v-model="ruleForm.description" type="textarea" :rows="3" />
          </el-form-item>
          <div class="recommendation-admin-actions">
            <el-button @click="resetRuleForm">重置</el-button>
            <el-button type="primary" @click="saveRule">保存规则</el-button>
          </div>
        </el-form>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>推荐规则列表</strong>
          <div class="section-subtitle">管理端可验证的规则状态、权重和追踪字段。</div>
        </div>
        <div class="page-toolbar__right">
          <el-select v-model="ruleFilter" clearable placeholder="规则状态">
            <el-option v-for="item in ruleStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </div>
      </div>

      <div class="recommendation-admin-table-wrap">
        <el-table :data="filteredRules" border class="recommendation-admin-rules-table">
          <el-table-column label="规则" min-width="260">
            <template #default="scope">
              <div class="recommendation-admin-name-cell">
                <strong>{{ scope.row.name }}</strong>
                <span>{{ scope.row.description }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="范围" width="110">
            <template #default="scope">{{ ruleScopeLabel(scope.row.scope) }}</template>
          </el-table-column>
          <el-table-column label="画像字段" min-width="160">
            <template #default="scope">{{ scope.row.profileField ? profileFieldLabel(scope.row.profileField) : "-" }}</template>
          </el-table-column>
          <el-table-column label="公开数据字段" min-width="210">
            <template #default="scope">{{ scope.row.publicDataField ? publicDataFieldLabel(scope.row.publicDataField) : "-" }}</template>
          </el-table-column>
          <el-table-column prop="weight" label="权重" width="90" />
          <el-table-column label="状态" width="150">
            <template #default="scope">
              <el-select v-model="scope.row.status" size="small" @change="recordRuleStatus(scope.row)">
                <el-option v-for="item in ruleStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="scope">
              <div class="table-actions">
                <el-button link type="primary" @click="openEditRule(scope.row)">编辑</el-button>
                <el-button link type="warning" @click="markRuleReview(scope.row)">送复核</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section class="page-card">
      <div class="page-toolbar">
        <div>
          <strong>缓存失效与执行记录</strong>
          <div class="section-subtitle">用于验证画像变更、退出登录、切换账号和规则版本变化后的状态处理。</div>
        </div>
      </div>
      <div class="recommendation-admin-log-grid">
        <el-timeline>
          <el-timeline-item v-for="record in executionRecords" :key="record.time" :timestamp="record.time" placement="top">
            <div class="recommendation-admin-record">
              <el-tag :type="record.type" effect="plain">{{ record.label }}</el-tag>
              <span>{{ record.message }}</span>
            </div>
          </el-timeline-item>
        </el-timeline>
        <div class="recommendation-admin-panel">
          <div class="recommendation-admin-section-title">缓存失效触发器</div>
          <div class="recommendation-admin-tags">
            <el-tag v-for="trigger in contract.cacheInvalidationTriggers" :key="trigger" type="info" effect="plain">
              {{ cacheTriggerLabel(trigger) }}
            </el-tag>
          </div>
          <el-divider />
          <el-descriptions :column="1" border>
            <el-descriptions-item label="缓存范围">{{ contract.personalizationRequiresAuthentication ? "账号画像级缓存" : "无" }}</el-descriptions-item>
            <el-descriptions-item label="公开结果状态">{{ contract.publicResultStatus }}</el-descriptions-item>
            <el-descriptions-item label="最大推荐数">{{ contract.maxResults }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  SMART_RECOMMENDATION_CONTRACT,
  SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS,
  type ApplicationTier,
  type SmartRecommendationAccessStatus,
  type SmartRecommendationCacheInvalidationTrigger,
  type SmartRecommendationContract,
  type SmartRecommendationProfileField,
  type SmartRecommendationPublicDataField,
  type SmartRecommendationRiskSeverity
} from "@studymy/shared";
import { adminApi } from "@/api/admin";

type FieldView = "all" | "required" | "optional";
type RuleScope = "gate" | "scoring" | "risk" | "cache";
type RuleStatus = "enabled" | "disabled" | "needs-review";
type TimelineType = "success" | "warning" | "info";
type RecommendationRunStatus = "blocked-profile-incomplete" | "generated" | "no-match" | "expired";
type CacheTraceState = "hit-eligible" | "payload-missing" | "expired" | "profile-stale" | "not-cacheable";

interface ProfileFieldRow {
  field: SmartRecommendationProfileField;
  required: boolean;
  weight: number;
  enabled: boolean;
}

interface RecommendationRule {
  id: string;
  name: string;
  scope: RuleScope;
  profileField: SmartRecommendationProfileField | "";
  publicDataField: SmartRecommendationPublicDataField | "";
  weight: number;
  riskSeverity: SmartRecommendationRiskSeverity;
  tier: ApplicationTier;
  status: RuleStatus;
  description: string;
}

interface GateScenario {
  key: SmartRecommendationAccessStatus;
  label: string;
  status: SmartRecommendationAccessStatus;
  statusLabel: string;
  canShowRecommendations: boolean;
  primaryAction: string;
  blockReasons: string[];
}

interface ExecutionRecord {
  time: string;
  type: TimelineType;
  label: string;
  message: string;
}

interface RecommendationRunRow {
  id: number;
  userId: number;
  profileId: number;
  student: { id: number; displayName: string; accountMasked: string; preferredLocale: string | null };
  status: RecommendationRunStatus;
  statusLabel: string;
  profileVersion: number;
  currentProfileVersion: number | null;
  createdAt?: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  resultCount: number;
  auditNote: string | null;
  profileSnapshot: Array<{ field: string; label: string; value: unknown; captured: boolean }>;
  missingProfileFields: Array<{ field: string; label: string }>;
  profileDrift: {
    hasCurrentProfile: boolean;
    versionChanged: boolean;
    hashChanged: boolean;
    cacheProfileHash: string | null;
    currentProfileHash: string | null;
    invalidationTriggers: string[];
    profileChanged: boolean;
  };
  cache: {
    state: CacheTraceState;
    label: string;
    reason: string;
    cacheKey: string;
    payloadAvailable: boolean;
    expiresAt: string | null;
  };
  results: Array<{
    universityId: number;
    programId: number;
    universityName: string;
    programName: string;
    score: number;
    tier: ApplicationTier;
    annualCostCny: number | null;
    publicDisplayStatus: string;
    currentCatalog: Record<string, string | null>;
    profileFields: Array<{ field: string; label: string }>;
    publicDataFields: Array<{ field: string; label: string; currentValue: unknown }>;
    feeSource: {
      displayText: string | null;
      filterableTuitionCny: number | null;
      confidence: string;
      annualTuitionCny: number | null;
      officialFeeAuditStatus: string | null;
      officialFeeSourceUrl: string | null;
      secondaryOfficialFeeSourceUrl: string | null;
      sourceNote: string | null;
    };
    languageSource: {
      ielts: string | number | boolean | null;
      officialLanguageRequirement: string | null;
      officialEntryRequirementSourceUrl: string | null;
      acceptNoLanguage: boolean | null;
    };
    reasonSources: Array<{
      code: string;
      message: string;
      profileField: string | null;
      profileFieldLabel: string | null;
      profileValue: unknown;
      publicDataField: string | null;
      publicDataFieldLabel: string | null;
      publicDataValue: unknown;
    }>;
    riskSources: Array<{
      code: string;
      severity: SmartRecommendationRiskSeverity;
      message: string;
      suggestion: string;
      profileField: string | null;
      profileFieldLabel: string | null;
      publicDataField: string | null;
      publicDataFieldLabel: string | null;
    }>;
  }>;
  traceSummary: { profileFieldCount: number; publicDataFieldCount: number; riskCount: number };
  privacyBoundary: string;
}

const PROFILE_FIELD_LABELS: Record<SmartRecommendationProfileField, string> = {
  level: "目标学历",
  targetCategory: "目标专业方向",
  budgetCny: "预算",
  gpa: "GPA",
  ielts: "IELTS",
  experience: "工作或研究经验",
  acceptNoLanguage: "是否接受后补语言"
};

const PUBLIC_DATA_FIELD_LABELS: Record<SmartRecommendationPublicDataField, string> = {
  "program.level": "专业层级",
  "program.category": "专业分类",
  "program.annualTuitionCny": "专业年度学费",
  "program.requirement.gpa": "专业 GPA 要求",
  "program.languageRequirement.ielts": "专业 IELTS 要求",
  "program.publicDisplayStatus": "专业公开展示状态",
  "university.livingCostCny": "学校生活费",
  "university.acceptNoLanguage": "学校是否接受后补语言",
  "university.qsRank": "学校 QS 排名",
  "university.publicDisplayStatus": "学校公开展示状态"
};

const ruleScopeOptions = [
  { label: "门禁", value: "gate" },
  { label: "评分", value: "scoring" },
  { label: "风险", value: "risk" },
  { label: "缓存", value: "cache" }
] as const;

const ruleStatusOptions = [
  { label: "启用", value: "enabled" },
  { label: "停用", value: "disabled" },
  { label: "待复核", value: "needs-review" }
] as const;

const riskSeverityOptions = [
  { label: "提示", value: "info" },
  { label: "警告", value: "warning" },
  { label: "严重", value: "critical" }
] as const;

const fieldViewOptions = [
  { label: "全部字段", value: "all" },
  { label: "必填字段", value: "required" },
  { label: "可选字段", value: "optional" }
];

const runStatusOptions = [
  { label: "画像不完整阻断", value: "blocked-profile-incomplete" },
  { label: "已生成", value: "generated" },
  { label: "无匹配", value: "no-match" },
  { label: "已过期", value: "expired" }
];

const profileFieldOptions = Object.entries(PROFILE_FIELD_LABELS).map(([value, label]) => ({ label, value }));
const publicDataFieldOptions = Object.entries(PUBLIC_DATA_FIELD_LABELS).map(([value, label]) => ({ label, value }));

const nowText = () => new Date().toLocaleString("zh-CN");

const createRule = (overrides: Partial<RecommendationRule> = {}): RecommendationRule => ({
  id: `rule-${Date.now()}`,
  name: "",
  scope: "scoring",
  profileField: "",
  publicDataField: "",
  weight: 10,
  riskSeverity: "info",
  tier: "target",
  status: "needs-review",
  description: "",
  ...overrides
});

const contract = ref<SmartRecommendationContract>({ ...SMART_RECOMMENDATION_CONTRACT });
const contractSource = ref("本地共享契约");
const loadError = ref("");
const loading = ref(false);
const fieldView = ref<FieldView>("all");
const selectedScenario = ref<SmartRecommendationAccessStatus>("login-required");
const refreshCount = ref(0);
const ruleFilter = ref<RuleStatus | "">("");
const editingRuleId = ref("");
const ruleForm = reactive<RecommendationRule>(createRule());
const runLoading = ref(false);
const runError = ref("");
const recommendationRuns = ref<RecommendationRunRow[]>([]);
const runTotal = ref(0);
const centerPositioning = ref("后台运营和顾问追溯中心，不是前端会员中心。");
const privacyBoundary = ref("仅展示推荐追溯所需字段，不展示完整学生档案。");
const runQuery = reactive({
  page: 1,
  pageSize: 10,
  status: "" as RecommendationRunStatus | "",
  search: ""
});
const runSummary = ref({
  total: 0,
  byStatus: {
    "blocked-profile-incomplete": 0,
    generated: 0,
    "no-match": 0,
    expired: 0
  } as Record<RecommendationRunStatus, number>
});

const profileFields = ref<ProfileFieldRow[]>([
  ...SMART_RECOMMENDATION_CONTRACT.requiredProfileFields.map((field) => ({
    field,
    required: true,
    weight: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field],
    enabled: true
  })),
  ...SMART_RECOMMENDATION_CONTRACT.optionalProfileFields.map((field) => ({
    field,
    required: false,
    weight: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field],
    enabled: true
  }))
]);

const recommendationRules = ref<RecommendationRule[]>([
  createRule({
    id: "gate-auth-required",
    name: "个性化推荐登录门禁",
    scope: "gate",
    profileField: "",
    publicDataField: "",
    weight: 100,
    riskSeverity: "critical",
    tier: "target",
    status: "enabled",
    description: "未登录用户只能看到登录或注册引导，不能展示个性化推荐列表。"
  }),
  createRule({
    id: "gate-profile-complete",
    name: "画像完整度门槛",
    scope: "gate",
    profileField: "level",
    publicDataField: "",
    weight: SMART_RECOMMENDATION_CONTRACT.completenessThreshold,
    riskSeverity: "critical",
    tier: "target",
    status: "enabled",
    description: "画像未达到最低完整度时，展示缺失项并引导完善画像。"
  }),
  createRule({
    id: "score-budget-match",
    name: "预算与成本匹配",
    scope: "scoring",
    profileField: "budgetCny",
    publicDataField: "program.annualTuitionCny",
    weight: 18,
    riskSeverity: "warning",
    tier: "target",
    status: "enabled",
    description: "用学生预算与专业年度学费、生活费做匹配，超预算时进入风险提示。"
  }),
  createRule({
    id: "risk-language-gap",
    name: "语言差距风险",
    scope: "risk",
    profileField: "ielts",
    publicDataField: "program.languageRequirement.ielts",
    weight: 16,
    riskSeverity: "warning",
    tier: "reach",
    status: "enabled",
    description: "语言未达标时展示差距和后补语言路径，不给出无依据的安全推荐。"
  })
]);

const gateScenarios: GateScenario[] = [
  {
    key: "login-required",
    label: "未登录",
    status: "login-required",
    statusLabel: "需要登录",
    canShowRecommendations: false,
    primaryAction: "打开登录",
    blockReasons: ["login-required"]
  },
  {
    key: "profile-incomplete",
    label: "画像缺失",
    status: "profile-incomplete",
    statusLabel: "画像不完整",
    canShowRecommendations: false,
    primaryAction: "完善画像",
    blockReasons: ["profile-incomplete"]
  },
  {
    key: "ready",
    label: "可推荐",
    status: "ready",
    statusLabel: "可生成推荐",
    canShowRecommendations: true,
    primaryAction: "刷新推荐",
    blockReasons: []
  },
  {
    key: "no-match",
    label: "无匹配",
    status: "no-match",
    statusLabel: "暂无匹配",
    canShowRecommendations: false,
    primaryAction: "调整画像",
    blockReasons: ["profile-required"]
  }
];

const executionRecords = ref<ExecutionRecord[]>([
  {
    time: nowText(),
    type: "info",
    label: "初始化",
    message: "已加载智能推荐管理端页面，使用共享契约作为默认展示。"
  }
]);

const enabledRuleCount = computed(() => recommendationRules.value.filter((rule) => rule.status === "enabled").length);
const activeScenario = computed(() => gateScenarios.find((item) => item.key === selectedScenario.value) || gateScenarios[0]);
const interactionMessage = computed(() => {
  if (activeScenario.value.status === "ready") return `画像完整，可展示推荐列表；本轮已模拟刷新 ${refreshCount.value} 次。`;
  if (activeScenario.value.status === "login-required") return "推荐结果已隐藏，用户需要先登录或注册。";
  if (activeScenario.value.status === "profile-incomplete") return "推荐结果已隐藏，页面应展示缺失画像字段和完善入口。";
  return "没有匹配结果时，应解释预算、GPA、语言或专业方向可能导致无结果。";
});
const visibleProfileFields = computed(() => {
  if (fieldView.value === "required") return profileFields.value.filter((item) => item.required);
  if (fieldView.value === "optional") return profileFields.value.filter((item) => !item.required);
  return profileFields.value;
});
const filteredRules = computed(() => {
  if (!ruleFilter.value) return recommendationRules.value;
  return recommendationRules.value.filter((rule) => rule.status === ruleFilter.value);
});

const loadContract = async () => {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await adminApi.recommendationContract();
    if (data?.schemaVersion) {
      contract.value = data as SmartRecommendationContract;
      contractSource.value = "后端 /recommendations/contract";
      syncProfileFields();
      addExecutionRecord("success", "契约", "已刷新智能推荐后端契约。");
    }
  } catch (error) {
    contract.value = { ...SMART_RECOMMENDATION_CONTRACT };
    contractSource.value = "本地共享契约";
    loadError.value = `无法读取后端推荐契约，当前使用本地共享契约预览：${errorMessage(error)}`;
  } finally {
    loading.value = false;
  }
};

const loadRecommendationRuns = async () => {
  runLoading.value = true;
  runError.value = "";
  try {
    const data = await adminApi.recommendationRuns({
      page: runQuery.page,
      pageSize: runQuery.pageSize,
      status: runQuery.status || undefined,
      search: runQuery.search || undefined
    });
    recommendationRuns.value = (data?.items || []) as RecommendationRunRow[];
    runTotal.value = Number(data?.total || 0);
    if (data?.summary) runSummary.value = data.summary;
    if (data?.centerPositioning) centerPositioning.value = data.centerPositioning;
    if (data?.privacyBoundary) privacyBoundary.value = data.privacyBoundary;
  } catch (error) {
    runError.value = `无法读取推荐运行记录：${errorMessage(error)}`;
    recommendationRuns.value = [];
    runTotal.value = 0;
  } finally {
    runLoading.value = false;
  }
};

const handleRunSearch = () => {
  runQuery.page = 1;
  void loadRecommendationRuns();
};

const handleRunSizeChange = () => {
  runQuery.page = 1;
  void loadRecommendationRuns();
};

const syncProfileFields = () => {
  const enabledByField = new Map(profileFields.value.map((item) => [item.field, item.enabled]));
  profileFields.value = [
    ...contract.value.requiredProfileFields.map((field) => ({
      field,
      required: true,
      weight: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field] || 0,
      enabled: enabledByField.get(field) ?? true
    })),
    ...contract.value.optionalProfileFields.map((field) => ({
      field,
      required: false,
      weight: SMART_RECOMMENDATION_PROFILE_COMPLETENESS_WEIGHTS[field] || 0,
      enabled: enabledByField.get(field) ?? true
    }))
  ];
};

const refreshPreview = () => {
  refreshCount.value += 1;
  selectedScenario.value = "ready";
  addExecutionRecord("success", "刷新", "已模拟基于当前完整画像刷新推荐结果。");
  ElMessage.success("已模拟刷新推荐");
};

const recordFieldToggle = (row: ProfileFieldRow) => {
  addExecutionRecord(row.enabled ? "success" : "warning", "画像字段", `${profileFieldLabel(row.field)} 已${row.enabled ? "启用" : "停用"}。`);
};

const openCreateRule = () => {
  editingRuleId.value = "";
  resetRuleForm();
};

const openEditRule = (rule: RecommendationRule) => {
  editingRuleId.value = rule.id;
  Object.assign(ruleForm, JSON.parse(JSON.stringify(rule)));
};

const resetRuleForm = () => {
  Object.assign(ruleForm, createRule({ id: editingRuleId.value || `rule-${Date.now()}` }));
};

const saveRule = () => {
  if (!ruleForm.name.trim()) {
    ElMessage.error("请填写规则名称");
    return;
  }
  if (!ruleForm.description.trim()) {
    ElMessage.error("请填写规则说明");
    return;
  }
  const payload = JSON.parse(JSON.stringify(ruleForm)) as RecommendationRule;
  const index = recommendationRules.value.findIndex((rule) => rule.id === editingRuleId.value);
  if (index >= 0) {
    recommendationRules.value.splice(index, 1, payload);
  } else {
    recommendationRules.value.unshift({ ...payload, id: payload.id || `rule-${Date.now()}` });
  }
  editingRuleId.value = payload.id;
  addExecutionRecord(payload.status === "enabled" ? "success" : "info", "规则", `${payload.name} 已保存为${ruleStatusLabel(payload.status)}。`);
  ElMessage.success("规则已保存到当前页面状态");
};

const recordRuleStatus = (rule: RecommendationRule) => {
  addExecutionRecord(rule.status === "enabled" ? "success" : "warning", "规则状态", `${rule.name} 已切换为${ruleStatusLabel(rule.status)}。`);
};

const markRuleReview = (rule: RecommendationRule) => {
  rule.status = "needs-review";
  recordRuleStatus(rule);
};

const addExecutionRecord = (type: TimelineType, label: string, message: string) => {
  executionRecords.value.unshift({ time: nowText(), type, label, message });
};

const profileFieldLabel = (field: SmartRecommendationProfileField) => PROFILE_FIELD_LABELS[field] || field;
const publicDataFieldLabel = (field: SmartRecommendationPublicDataField) => PUBLIC_DATA_FIELD_LABELS[field] || field;
const ruleScopeLabel = (scope: RuleScope) => ruleScopeOptions.find((item) => item.value === scope)?.label || scope;
const ruleStatusLabel = (status: RuleStatus) => ruleStatusOptions.find((item) => item.value === status)?.label || status;

const runStatusTag = (status: RecommendationRunStatus) => {
  if (status === "generated") return "success";
  if (status === "blocked-profile-incomplete") return "warning";
  if (status === "expired") return "danger";
  return "info";
};

const cacheStateTag = (state: CacheTraceState) => {
  if (state === "hit-eligible") return "success";
  if (state === "profile-stale" || state === "expired") return "danger";
  if (state === "payload-missing") return "warning";
  return "info";
};

const riskSeverityTag = (severity: SmartRecommendationRiskSeverity) => {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
};

const riskSeverityLabel = (severity: SmartRecommendationRiskSeverity) => {
  const labels: Record<SmartRecommendationRiskSeverity, string> = {
    info: "提示",
    warning: "警告",
    critical: "严重"
  };
  return labels[severity] || severity;
};

const tierLabel = (tier: ApplicationTier) => {
  const labels: Record<ApplicationTier, string> = {
    reach: "冲刺",
    target: "匹配",
    safe: "保底"
  };
  return labels[tier] || tier;
};

const driftTriggerLabel = (trigger: string) => {
  const labels: Record<string, string> = {
    "profile-missing": "当前画像缺失",
    "profile-updated": "画像已变化",
    "cache-expired": "缓存已过期"
  };
  return labels[trigger] || trigger;
};

const gateStatusTag = (status: SmartRecommendationAccessStatus) => {
  if (status === "ready") return "success";
  if (status === "login-required" || status === "profile-incomplete") return "warning";
  if (status === "error") return "danger";
  return "info";
};

const cacheTriggerLabel = (trigger: SmartRecommendationCacheInvalidationTrigger) => {
  const labels: Record<SmartRecommendationCacheInvalidationTrigger, string> = {
    "profile-updated": "画像更新",
    "sign-out": "退出登录",
    "account-switched": "切换账号",
    "rule-version-changed": "规则版本变化",
    "public-program-data-updated": "公开专业数据更新"
  };
  return labels[trigger] || trigger;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : typeof error === "string" ? error : "请求失败");

const formatTraceValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("zh-CN") : "-";
  return String(value);
};

const formatCurrency = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `${Number(value).toLocaleString("zh-CN")} CNY/年`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
};

onMounted(() => {
  void loadContract();
  void loadRecommendationRuns();
});
</script>

<style scoped>
.recommendation-admin-page {
  display: grid;
  gap: 18px;
  min-width: 0;
  max-width: 100%;
}

.recommendation-admin-page :deep(.page-card),
.recommendation-admin-page :deep(.page-toolbar),
.recommendation-admin-page :deep(.page-toolbar > *) {
  min-width: 0;
  max-width: 100%;
}

.recommendation-admin-hero__toolbar {
  align-items: flex-start;
}

.recommendation-admin-hero__title {
  color: #12233c;
  font-size: 24px;
  font-weight: 800;
}

.recommendation-admin-alert {
  margin: 12px 0;
}

.recommendation-admin-metrics {
  margin-bottom: 0;
}

.recommendation-admin-metric-text {
  overflow-wrap: anywhere;
  font-size: 22px;
  line-height: 1.25;
}

.recommendation-admin-source,
.recommendation-admin-tags,
.recommendation-admin-actions,
.recommendation-trace-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.recommendation-admin-source {
  margin-top: 16px;
}

.recommendation-admin-split {
  align-items: start;
}

.recommendation-admin-panel {
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.72);
}

.recommendation-admin-section-title {
  margin-bottom: 14px;
  color: #1e293b;
  font-size: 16px;
  font-weight: 800;
}

.recommendation-admin-scenarios {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  margin-bottom: 16px;
}

.recommendation-admin-actions {
  margin-top: 16px;
}

.recommendation-admin-table-wrap {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
}

.recommendation-admin-rules-table {
  min-width: 1120px;
}

.recommendation-trace-card {
  display: grid;
  gap: 16px;
}

.recommendation-trace-toolbar {
  align-items: flex-start;
}

.recommendation-trace-filters {
  align-items: center;
}

.recommendation-trace-filters .el-input {
  width: 240px;
}

.recommendation-trace-filters .el-select {
  width: 170px;
}

.recommendation-trace-privacy {
  display: flex;
  min-width: 0;
}

.recommendation-trace-privacy :deep(.el-tag) {
  height: auto;
  min-height: 32px;
  white-space: normal;
  line-height: 1.45;
}

.recommendation-trace-table {
  min-width: 1180px;
}

.recommendation-trace-detail,
.recommendation-trace-source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.recommendation-trace-results {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.recommendation-trace-result {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: #ffffff;
}

.recommendation-trace-result__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.recommendation-trace-result__header > div:first-child {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.recommendation-trace-result__header strong {
  color: #12233c;
  overflow-wrap: anywhere;
}

.recommendation-trace-result__header span {
  color: #64748b;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.recommendation-trace-result__meta {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.recommendation-trace-label {
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.recommendation-trace-source-list {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.recommendation-trace-source-item {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.82);
}

.recommendation-trace-source-item strong,
.recommendation-trace-source-item span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.recommendation-trace-source-item strong {
  color: #1e293b;
  font-size: 13px;
}

.recommendation-trace-source-item span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.recommendation-trace-pagination {
  display: flex;
  justify-content: flex-end;
}

.recommendation-admin-name-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.recommendation-admin-name-cell strong {
  color: #274c9b;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.recommendation-admin-name-cell span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.recommendation-admin-log-grid {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(320px, 0.9fr);
  gap: 18px;
  align-items: start;
}

.recommendation-admin-record {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.recommendation-admin-record span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.recommendation-admin-page :deep(.el-table .cell),
.recommendation-admin-page :deep(.el-descriptions__content),
.recommendation-admin-page :deep(.el-form-item__label),
.recommendation-admin-page :deep(.el-tag__content) {
  overflow-wrap: anywhere;
  white-space: normal;
}

.empty-hint,
.muted {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 1180px) {
  .recommendation-admin-log-grid,
  .recommendation-trace-detail,
  .recommendation-trace-source-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .recommendation-admin-hero__toolbar,
  .recommendation-admin-page :deep(.page-toolbar__right) {
    width: 100%;
  }

  .recommendation-admin-page :deep(.page-toolbar__right .el-button),
  .recommendation-admin-page :deep(.page-toolbar__right .el-input),
  .recommendation-admin-page :deep(.page-toolbar__right .el-select),
  .recommendation-admin-actions .el-button {
    width: 100%;
    margin-left: 0;
  }

  .recommendation-admin-metric-text {
    font-size: 20px;
  }

  .recommendation-admin-scenarios {
    width: 100%;
  }

  .recommendation-admin-scenarios :deep(.el-radio-button) {
    flex: 1 1 50%;
  }

  .recommendation-admin-scenarios :deep(.el-radio-button__inner) {
    width: 100%;
  }

  .recommendation-trace-result__header {
    display: grid;
  }

  .recommendation-trace-result__meta {
    justify-content: flex-start;
  }

  .recommendation-trace-pagination {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
