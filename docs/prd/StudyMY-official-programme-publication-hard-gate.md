# StudyMY 官方专业上线硬门禁

## 1. 适用范围

本标准适用于所有准备进入 StudyMY 公开展示、导入、发布或上线审批的官方院校专业数据，覆盖本科、硕士和博士。

这是上线前硬门禁，不是建议项。任何 `publicDisplayStatus: "ready"` 或 `auditStatus: "official-verified-commercial-ready"` 的专业记录，必须全部满足本文件要求；任一项不满足，该专业不得上线，不得标记 ready，不得进入公开列表。

## 2. 绝对要求

### 2.1 专业名称必须是中文展示名

- 中文界面的专业主标题必须使用中文专业名。
- 专业名不得纯英文回退，不得直接使用官方英文名作为中文界面主标题。
- 当前 StudyMY 标准格式为：中文译名 + 官方英文名全角括注。
- 示例：`工程哲学博士（Doctor of Philosophy (Engineering)）`。

### 2.2 学院必须是中文展示名

- 中文界面的学院名称必须使用中文。
- 不得在中文列表中展示英文学院名。
- `facultyZh` 必须非空，并且不能等于官方英文 `faculty`。

### 2.3 专业列表语言要求只展示雅思

- 专业列表只允许展示 IELTS/雅思分数。
- TOEFL、PTE、MUET、Linguaskill、豁免条件和其他等同语言要求只能放在专业详情页。
- audit JSON 可以保留结构化 `language.toefl`、`language.pte`、`language.muet` 等详情字段，但列表展示字段不得输出这些考试。
- ready 专业必须有可用于列表展示的 `language.ielts` 数值；没有 IELTS 数值的专业不得 ready。

### 2.4 学费必须是准确费用，不得是范围

- 专业列表学费必须是官方公布的准确国际学生费用，优先使用官方专业详情页的 total programme fee。
- 不得展示学费范围、估算学费、起始价、最低到最高费用、生活费、住宿费、签证费、申请费或本地生费用。
- 若官网只公布年费、学期费或学分费，只有在官方学制/学期数/学分数可唯一核算时，才允许计算为单一总学费，并必须在详情页说明公式和来源。
- 无法得到单一准确费用时，该专业不得标记 ready。

### 2.5 学制列表只显示年数

- 专业列表学制必须是明确的数字年数。
- 不得在列表中展示 `1-3 years`、`2 - 4 years`、`full-time/part-time range`、`varies`、`rolling` 等范围或说明文本。
- 若官网同时公布多个模式，必须选择官方可唯一映射的默认/全日制/标准学制作为列表年数，并在详情页保留完整官方说明。
- 若无法唯一确定列表年数，该专业不得标记 ready。

## 3. 来源优先级

上线数据必须使用官方公布来源，优先级如下：

1. 当前官方专业详情页。
2. 当前官方专业目录页。
3. 当前官方学院/研究生院页面。
4. 官方手册、prospectus、fee table、academic handbook 或 PDF。
5. 官方申请、招生、语言、日历页面。

旧版官方 PDF 可以作为辅助证据，但不得覆盖当前官网详情页。第三方来源不得用于修复 ready 字段。

## 4. 上线判定

满足所有要求时，专业可以进入上线候选；最终导入或发布仍需要 Ian 明确批准。

以下情况必须阻断上线：

- 专业名不是中文展示名。
- 学院名不是中文展示名。
- 专业列表语言展示包含 TOEFL、PTE、MUET 或其他非 IELTS 考试。
- 缺少 IELTS 数值。
- 学费为空、为范围、为估算、为本地生费用或为非学费项目。
- 学制为空、为范围或为多模式说明文本。
- 官方来源冲突未解决。
- `pending_issues` 非空，且影响公开展示字段。

## 5. 可执行校验

每次上线前必须运行硬门禁脚本：

```bash
python3 scripts/validate-official-programme-publication-gate.py audits/XXX_reviewed.json
```

可同时传入多个层级文件：

```bash
python3 scripts/validate-official-programme-publication-gate.py \
  audits/UNITEN_audit_undergraduate_20260626_reviewed_v1.json \
  audits/UNITEN_audit_master_20260626_reviewed_v4.json \
  audits/UNITEN_audit_doctoral_20260626_reviewed_v1.json
```

脚本返回非零退出码时，不得上线。
