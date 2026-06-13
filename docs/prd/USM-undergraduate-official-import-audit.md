# USM 本科官方采集数据写入审计

## 范围

本次仅将 2026-06-12 USM 国际本科官方采集试点的 91 条原始专业记录写入 StudyMY 本地 MySQL 审核层。数据来自 USM admission 页面、动态 CSV、2025/2026 国际本科手册、国际本科费用 PDF，以及成功获取的 9 个唯一专业详情页。

本次不执行公开发布，不删除旧数据，不覆盖其它院校，不修改收藏、对比、规划或申请记录。

规范化输入已固化到：

- `data/imports/usm/2026-06-12/undergraduate-manifest.json`
- `data/imports/usm/2026-06-12/undergraduate-details-parsed.json`

这使 dry-run、正式写入和数据库只读复验不再依赖 `/tmp` 目录。

## 写入策略

- 目标院校：USM，`universityId=2`。
- 每个采集行使用 `usm-ug-official-2026-row-*` 稳定 slug。
- 默认命令为 dry-run，只有 `--confirm-import` 才连接数据库写入。
- 正式写入前导出 USM 院校和专业备份。
- 使用事务执行 upsert 和数量校验。
- 所有记录设置 `isPublished=false`。
- 所有记录保持 `needs-review` 或 `hidden-unverified`，不允许 `ready`。
- 重复代码、无效代码和来源冲突不静默去重，继续保留为审核证据。
- USM 美元费用包含小数；数据库整数金额列无法精确承载时，金额保留在 `tuitionDisplay` 和 `officialTuitionNote`，不做错误取整。
- 官方中文和马来文专业名未发布，因此暂以官方英文填充四语言 payload 形状，同时保持未发布并等待人工本地化审核。

## 写入结果

| 项目 | 数量 |
| --- | ---: |
| 采集原始行 | 91 |
| 稳定唯一 slug | 91 |
| needs-review | 59 |
| hidden-unverified | 32 |
| official-verified | 9 |
| source-conflict | 40 |
| needs-review 来源状态 | 42 |
| matched-official 费用 | 9 |
| source-conflict 费用 | 40 |
| pending-review 费用 | 42 |
| 无效代码行 | 3 |
| 重复代码组 | 15 |
| 唯一详情页核验专业 | 9 |

数据库独立查询确认：

- USM 专业总数为 109。
- 本次审核记录为 91。
- 原有 USM 记录仍为 18。
- 本次记录 published 数为 0。
- 本次记录 ready 数为 0。
- 91 条记录均保留 USD 费用币种和 USM 官方来源 URL。

## 公开隔离

导入后请求：

```bash
curl "http://127.0.0.1:3000/api/programs?universityId=2&pageSize=100"
```

返回 HTTP 200，`total=0`、`items=[]`。这证明本次审核数据没有进入公开专业目录。

## 执行命令

```bash
npm --workspace @studymy/api run import:usm:undergraduate -- \
  --dry-run
```

```bash
npm --workspace @studymy/api run import:usm:undergraduate -- \
  --backup-output tmp/backups/usm-undergraduate-before-20260612.json \
  --confirm-import
```

```bash
npm --workspace @studymy/api run verify:usm:undergraduate
```

## 验证

- USM 和静态目录专项测试：20 个通过、0 失败、1 个可选历史基线跳过。
- API 构建：通过。
- 全量 workspace 构建：通过；管理端只有既有 chunk size 警告。
- 全量测试：123 个用例中 122 个通过、0 失败、1 个跳过。
- 原先依赖 Windows 静态文件的单元测试已改为仓库内跨平台 fixture；当真实原始文件存在时，119 所院校、687 个专业的历史基线仍会额外执行。
- 完整 91 条 manifest 已纳入测试，固定校验状态、费用审计、无效代码、重复代码组和唯一详情页数量。
- 只读数据库复验确认：91 条、published 0、ready 0，状态统计与 manifest 完全一致。
- 公开 API 复验确认：HTTP 200，`total=0`、返回记录 0。

规范化数据 SHA-256：

- `undergraduate-manifest.json`: `04c9ab6d8c40a6906c224dd087dc074d6d59b1ff7d5aa9a76edab8c1fcfffe23`
- `undergraduate-details-parsed.json`: `1dd782cc2d51077e5cc570479502f9338ec3db64966b2ca396e9e04c49fce422`

## 剩余审核事项

- 40 条来源冲突记录必须人工处理。
- 42 条来源或详情不足记录需要继续采集。
- 3 条无效短代码不能直接成为正式专业代码。
- 15 个重复代码组需要确定保留、合并或替代关系。
- 只有 9 个唯一专业完成详情页和费用交叉核验。
- 2025/2026 手册中的申请时间需与 2026 当前公告重新确认。
- 四语言专业名称和学院名称仍需人工本地化审核。
- 在上述问题关闭前，91 条记录不得批量改为 published 或 ready。

## Notion 与提交

当前会话没有可写入的 Notion 页面连接，真实 Notion 未更新；已记录本地中文任务快照。验证已通过，本轮按 USM 本科任务范围创建提交。
