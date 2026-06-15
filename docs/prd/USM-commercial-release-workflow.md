# USM 商用发布固定工作流

## 目标

将 USM 本硕博数据从候选生成、费用语义、数据库状态、公开 API 到四语页面的商用标准固化为一个可重复、失败即阻断的发布门禁。

## 数据合同

- 本科、硕士、博士规范总数固定审计为 63、305、95。
- 公开国际生项目固定审计为 63、304、93，共 460。
- `needs-review` 必须为 0；3 条仅限马来西亚申请人的记录保留在审计层且不得公开。
- 主学费只接受官网直接公布、唯一对应项目或已选方向的标准项目总学费。
- 候选来源中，每学期费率继续使用 `official-rate-only`；进入数据库和公开 API 后，按官方全日制费率乘以官方最短全日制学期数，状态使用 `calculated-from-official-rate`。
- 费率型记录必须在公开 `tuitionDisplay` 中只展示一个标准总学费。计算公式、非全日制费率和排除项只在详情说明中展示，不得在列表重复展示。
- 只有官网没有任何可匹配数字费用时，用户端才显示“官方未公布”。
- 无数字的官方费用行使用 `official-total-unpublished`，不得标记为已匹配官方总额。
- 公开项目学费状态必须精确为：194 条 `matched-official`、213 条 `calculated-from-official-rate`、53 条 `not-published`。
- `calculated-from-official-rate` 必须有正数 `tuitionAmount` 和单一币种总额；`not-published` 的金额字段必须为 `null`，禁止用 `0` 表示未公布。
- 院校详情 API 必须保留 `tuitionInfo.note`，用于展示计算公式、官方学年、非全日制费率，以及延期学期和其他单独费用未计入的说明。
- 费用范围、模糊估算、延期或超期费用均不得进入主学费字段。
- 院校概览不得汇总不同专业的最低至最高费用。

## 生成与导入顺序

1. 从版本化官方来源重新生成硕士和博士候选，禁止手工修改生成 JSON。
2. 运行候选专项验证与 `scripts/audit-official-total-tuition.py`。
3. 执行数据库 dry-run、备份和受控事务导入。
4. 运行本硕博数据库专项验证。
5. 检查公开 API 数量、状态分区、费用标量和非公开记录泄漏。
6. 运行全量测试、生产构建与四语审计。
7. 使用真实页面完成四语、硕士列表、博士列表、DBA 总学费和浏览器控制台验收。
8. 仅提交和部署已通过门禁的聚焦改动，不发布包含无关未提交文件的工作区。

## 最终门禁

API 与 Web 服务启动后运行：

```bash
node scripts/verify-usm-commercial-release.mjs
```

可显式指定地址和报告路径：

```bash
node scripts/verify-usm-commercial-release.mjs \
  --api-url http://127.0.0.1:3000/api/universities/universiti-sains-malaysia-usm \
  --web-url http://127.0.0.1:5173/universities/universiti-sains-malaysia-usm \
  --report tmp/reports/usm-commercial-release-gate.json
```

该命令依次执行候选审计、交付 envelope 审计、三层级数据库专项验证、总学费政策审计、全量测试、生产构建、四语审计、公开 API 和真实浏览器检查。任一检查失败即返回非零退出码，发布决策为 `blocked`。

## 回滚

- 每次受控写入使用导入器生成的 `apps/api/tmp/backups/` 备份。
- 数据回滚按对应导入器的备份恢复流程执行。
- 代码发布只使用通过门禁的聚焦提交；不得用 `git reset --hard` 或覆盖用户未提交工作。

## Notion

Notion 是中文任务与文档源，不是业务数据库。无可写连接器时更新本地中文任务快照，并明确记录真实 Notion 未更新。
