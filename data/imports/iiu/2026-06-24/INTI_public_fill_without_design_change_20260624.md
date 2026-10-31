# INTI 官方数据填充到现有全栈展示链路记录

- 时间：2026-06-24T17:05:07+08:00
- 范围：INTI 官方导入批次 107 条专业
- 原则：不修改页面设计、不修改前端布局、不修改 CSS、不新增 UI 组件；仅调整数据状态，让官方数据进入现有 StudyMY 全栈展示链路。

## 执行动作

1. 已备份 107 条 INTI 官方导入行：`apps/api/tmp/backups/inti-official-review-rows-before-public-fill-20260624.sql`。
2. 已备份 INTI 院校行：`apps/api/tmp/backups/inti-university-before-public-fill-20260624.sql`。
3. 仅将 `slug LIKE 'inti-official-2026-review-row-%'` 的 107 条官方行设置为公开可见。
4. 旧 5 条 `INTIP1001` 至 `INTIP1005` 非官方 seed 行继续隐藏，不恢复公开。
5. 费用字段保持 `officialFeeAuditStatus=pending-review`，`officialTuitionMYR=null`，不把 INTI 官方近似费用写成精确总学费。

## 当前公开链路状态

- INTI 院校页：`/api/universities/inti-international-university`
- 公开专业数：107
- 本科：74
- 硕士：23
- 博士：10
- 旧 seed 公开行：0
- 第一条官方行示例：`INTI-B-001`，`publicDisplayStatus=ready`，`officialSourceStatus=official-verified`，`officialFeeAuditStatus=pending-review`

## 查阅入口

- 用户端：http://localhost:5173/universities/inti-international-university
- 管理后台：http://localhost:3001/programs

## 保留风险提示

INTI 官方费用仍为近似费用或多费用选项，并注明国际学生费用另加 6% SST。本次只是按 Ian 要求把官方数据填充到现有全栈展示链路用于查阅；费用仍保留待复核状态。
