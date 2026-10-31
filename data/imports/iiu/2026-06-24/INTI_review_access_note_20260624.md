# INTI 官方审核数据查阅入口确认

- 确认时间：2026-06-24T16:52:30+08:00
- 数据库状态：已入库并填充到现有全栈展示链路 107 条
- 查阅口径：用户端按现有设计查阅，后台继续可筛选复核；未修改页面设计

## 查阅入口

- 用户端院校页：http://localhost:5173/universities/inti-international-university
- 管理后台：http://localhost:3001/programs
- 默认账号：`superadmin`
- 默认密码：`Admin123!`

## 筛选方式

1. 用户端直接打开 INTI 院校页查阅 107 条官方专业。
2. 管理后台打开“专业管理”。
3. 学校选择 `INTI`。
4. 费用审计可选择 `pending-review`。

说明：用户端仅显示 107 条本轮官方导入行，code 形如 `INTI-B-001`、`INTI-M-001`、`INTI-P-001`；另外 5 条 `INTIP1001` 至 `INTIP1005` 是旧 seed 行，仍隐藏，保留在后台用于追溯。

## 当前验证结果

- INTI 官方公开查阅行：107 条。
- 官方行可查阅状态：`isPublished=true`、`publicDisplayStatus=ready`、`officialSourceStatus=official-verified`。
- 费用状态：`officialFeeAuditStatus=pending-review`，不写入精确总学费。
- 学生端公开 INTI 专业：107 条。
- INTI 院校页仍可访问，slug 为 `inti-international-university`。

## 费用保留待复核原因

INTI 官方费用仍是近似费用或多费用选项，并注明国际学生费用另加 6% SST。因此本轮只把官方数据填充进现有展示链路，不把这些金额作为精确总学费。
