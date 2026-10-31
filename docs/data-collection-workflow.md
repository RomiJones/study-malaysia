# StudyMY 大学数据采集到上线全流程执行方案

> 以 UMT（马来西亚登嘉楼大学）为完整案例，从信息采集到前端展示的全链路方法论。
>
> 编写日期: 2026-07-07 | 适用版本: schemaVersion 2 | 技术栈: Vue 3 + NestJS + MySQL 8.0

---

## 目录

1. [总览：五阶段两门禁流水线](#1-总览)
2. [Phase 1 · 多源发现](#2-phase-1--多源发现)
3. [Phase 2 · 交叉验证与新鲜度判断](#3-phase-2--交叉验证与新鲜度判断)
4. [Phase 3 · 结构化建模](#4-phase-3--结构化建模)
5. [GATE 1 · Dry-Run 预检门禁](#5-gate-1--dry-run-预检门禁)
6. [Phase 4 · 数据库入库](#6-phase-4--数据库入库)
7. [GATE 2 · 三层验证](#7-gate-2--三层验证)
8. [Phase 5 · 前端上线展示](#8-phase-5--前端上线展示)
9. [门禁汇总与违规处理协议](#9-门禁汇总与违规处理协议)
10. [UMT 实战案例全流程复盘](#10-umt-实战案例全流程复盘)

---

## 1. 总览

### 核心理念

```
多源采集 → 交叉验证 → 结构化建模 → [GATE 1] → 入库 → [GATE 2] → 上线展示
```

每一所大学的数据必须经过 **5 个阶段 + 2 道绝对门禁**，才能在前端展示。任何门禁不通过，数据不得上线。

### 为什么需要这个流程

| 问题 | 例子 | 流程如何防止 |
|------|------|-------------|
| 信息过时 | 学费是 2023 年的 | Phase 2 交叉验证 + 新鲜度判断 |
| 信息错误 | 国际生学费混入本地生学费 | Phase 2 源分离（international vs domestic） |
| 字段超长 | `institutionType` 写了 22 字符 | GATE 1 dry-run 预检 |
| 专业不可见 | 数据入库但前端显示 0 | GATE 2 三层验证（DB → API → 前端） |
| 临时逻辑残留 | review-preview 劫持正式数据 | Phase 5 清理临时逻辑 |

### 执行顺序（铁律）

```
先做什么 → 后做什么
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 确定大学官方域名 → 深挖子站
2. 获取专业完整列表 → 逐个深挖详情
3. 采集学费 → 分离国际生/本地生
4. 四语翻译 → en 优先，ms/zh-CN/zh-TW 填充
5. 生成 JSON → Python 脚本结构化
6. Dry-run 预检 → 不通过则修复重来
7. 确认导入 → --confirm-import
8. DB 直查 → API 验证 → 前端验证
9. 清理临时逻辑 → 最终展示确认
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 2. Phase 1 · 多源发现

### 2.1 数据源分级

| 级别 | 源类型 | 信任度 | 例子 | 用途 |
|------|--------|--------|------|------|
| **Tier 1** | 官方域名下的页面 | 最高 | `umt.edu.my/*` | 大学信息、专业列表、学费、入学要求 |
| **Tier 2** | 权威第三方平台 | 高 | StudyMalaysia.com, QS Top Universities | 专业目录交叉验证、排名数据 |
| **Tier 3** | 辅助信息源 | 中 | UniPage, EduYar, 4ICU | 补充缺失字段、翻译参考 |
| **Tier 4** | 政府监管源 | 高 | MQA, MOHE | 认证状态、MQA 代码 |

### 2.2 多层级页面深挖逻辑

不是只看首页，而是从首页出发**逐层深入**，直到拿到每个专业的完整信息。

```
第 0 层：官网首页
  │  采集：大学名称、建校年份、校区、官方域名
  │  UMT 例子：umt.edu.my → "Universiti Malaysia Terengganu", 2001, Kuala Nerus
  │
  ├─→ 第 1 层：学院/Faculty 页面
  │    采集：学院列表、学院四语名称
  │    UMT 例子：7个学院 (FSPA, FSMA, FSSM, FSKM, FTKK, FPM, FPEPS)
  │
  ├─→ 第 1 层：专业目录页 (all-programs)
  │    采集：完整专业列表、专业所属学院、学位等级
  │    UMT 例子：umt.edu.my/all-programs-at-umt/
  │    → 发现 192 个专业条目（含 175 个研究方向）
  │
  ├─→ 第 2 层：国际生本科页
  │    采集：国际生入学要求、申请材料、学费（USD）
  │    UMT 例子：umt.edu.my/international-student-undergraduate/
  │
  ├─→ 第 2 层：研究生学费子站
  │    采集：硕士/博士学费（MYR）、学制、研究方向列表
  │    UMT 例子：postgrad.umt.edu.my/postgraduate_fees-2/
  │    → 发现 175 个 M.Sc./Ph.D. 研究方向
  │
  ├─→ 第 2 层：学费 PDF 附件
  │    采集：本科国际生学费表（PDF 格式）
  │    UMT 例子：akademik.umt.edu.my/wp-content/uploads/2025/02/...
  │
  ├─→ 第 2 层：QS 排名公告页
  │    采集：最新 QS 排名、排名年份、排名变化
  │    UMT 例子：官网 QS 2026 公告 → #801-850（首次进入）
  │
  └─→ 第 1 层：StudyMalaysia 课程列表
       采集：第三方视角的专业列表、学费、学制
       UMT 例子：studymalaysia.com/edu/umt/courses/
       → 用于与官方数据交叉验证
```

### 2.3 深挖判断逻辑

**什么时候停止深挖？** 当满足以下全部条件时：

1. ✅ 每个专业都有：名称、学位等级、所属学院、学费、学制、语言要求
2. ✅ 大学信息完整：四语名称、建校年份、校区、排名、描述、设施、亮点
3. ✅ 每个关键字段至少有 2 个源可验证
4. ✅ 没有发现"更多专业"的链接未探索

**深挖中的陷阱：**

| 陷阱 | 说明 | UMT 例子 |
|------|------|---------|
| 隐藏的 PDF | 学费表可能是 PDF 附件，不在 HTML 页面 | 本科费用藏在 akademik 子站的 PDF 中 |
| 子站不同域名 | 研究生信息可能在不同的子域名 | `postgrad.umt.edu.my` ≠ `umt.edu.my` |
| 动态加载 | JS 渲染的页面可能需要等待 | 用 Playwright 等浏览器工具抓取 |
| 过时页面 | 某些页面可能未被更新 | 检查页面版权年份和 last-updated |

---

## 3. Phase 2 · 交叉验证与新鲜度判断

### 3.1 交叉验证规则

**核心原则：同一关键字段必须从 ≥2 个独立源验证。**

```
字段              源 A (Tier 1)           源 B (Tier 2)         判定
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
大学名称          官网首页                 QS排名页              一致 → 采纳
QS 排名           官网公告页               QS 官方网站           一致 → 采纳
专业列表          all-programs 页          StudyMalaysia 课程页  一致 → 采纳
本科学费          学费 PDF                 StudyMalaysia         一致 → 采纳
研究生学费        postgrad 子站            StudyMalaysia         一致 → 采纳
IELTS 要求        国际生页面               StudyMalaysia         一致 → 采纳
```

**不一致时的处理：**

| 情况 | 处理方式 |
|------|---------|
| Tier 1 源之间不一致 | 取最新日期的源；如果日期相同，取官方学术页面 > 官方招生页面 |
| Tier 1 vs Tier 2 不一致 | **以 Tier 1（官方）为准**，在 `auditNote` 中记录差异 |
| Tier 2 之间不一致 | 取 StudyMalaysia > 其他第三方 |
| 三个源各不同 | 标记为"待确认"，不录入，在文档中记录问题 |

### 3.2 新鲜度判断逻辑

**如何判断哪些信息是最新的：**

| 信号 | 判断方式 | 例子 |
|------|---------|------|
| **QS 排名年份** | 排名公告标题中的年份 | "QS World University Rankings 2026" → 2026 年最新 |
| **学费学年** | 学费页面标注的学年 | "2025/2026 academic session" → 当前有效 |
| **页面版权年份** | 页面 footer 的 © 年份 | "© 2025 UMT" → 至少 2025 年更新过 |
| **PDF 上传日期** | PDF 文件名或 URL 中的日期 | `2025/02/...fees...pdf` → 2025 年 2 月上传 |
| **StudyMalaysia 更新** | 页面 "last updated" 标记 | 2026-07 验证时仍显示当前数据 |
| **官网新闻** | 最近新闻的日期 | 如果最近新闻是 2026 年 6 月 → 网站仍在维护 |

**新鲜度门禁：**

```
学费数据 → 必须是当前学年或上一学年
QS 排名  → 必须是最新的 QS 版本（2026 > 2025）
建校信息 → 历史事实，不涉及新鲜度
专业列表 → 必须与官网当前展示一致
```

### 3.3 信息对错判断逻辑

**四层判断体系：**

```
第 1 层：逻辑一致性检查
  - 学费是否在合理范围？（本科 RM 30K-100K, 硕士 RM 10K-50K, 博士 RM 10K-40K）
  - 学制是否合理？（本科 3-4 年, 硕士 1-2 年, 博士 3-4 年）
  - IELTS 要求是否合理？（本科 5.0-6.0, 硕士 5.5-6.5, 博士 6.0-7.0）

第 2 层：源间一致性检查
  - 同一字段在 ≥2 个源的值是否相同？
  - 如不同，哪个源更权威/更新？

第 3 层：上下文合理性检查
  - 海洋大学的学费是否比商科大学低？（公立 < 私立，通常成立）
  - 研究型学位学费是否低于授课型？（通常成立）
  - 博士 IELTS 是否 ≥ 硕士 ≥ 本科？（通常成立）

第 4 层：特殊领域知识检查
  - UMT 是海洋大学 → 专业应含海洋/海事/水产类
  - UMT 是公立大学 → 学费应低于私立大学
  - UMT 首次进入 QS → 排名应在 800+ 而非 500+
```

### 3.4 学费采集的特殊逻辑

```
┌─────────────────────────────────────────────────────────┐
│  学费是最容易出错的数据，必须严格分离：                   │
│                                                         │
│  1. 国际生学费 vs 本地生学费                             │
│     → 我们只采集国际生学费                               │
│     → UMT 本科费用是 USD，需转换为 MYR (1 USD = 4.7 MYR) │
│                                                         │
│  2. 总学费 vs 年费                                       │
│     → 本科通常为总学费（total programme fee）             │
│     → 研究生可能是每学期或总                             │
│     → 必须在 fee.basis 中标注                            │
│                                                         │
│  3. 货币转换                                             │
│     → MYR → CNY: 汇率 ~1.68 (MYR 10,000 ≈ CNY 16,800)   │
│     → USD → MYR: 汇率 4.7                               │
│     → annualTuitionCny = tuitionMYR * 1.68 / duration    │
│                                                         │
│  4. 费用审计字段                                         │
│     → officialFeeAuditStatus = "matched-official"       │
│     → fee.status = "official-verified"                  │
│     → fee.officialFeeSourceUrl = 来源 URL                │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Phase 3 · 结构化建模

### 4.1 数据结构规范

每个专业必须包含以下字段（以 UMT 为例）：

```json
{
  "code": "UMT-UG-AGRO",
  "nameEnOfficial": "Bachelor of Agrotechnology Science (Crop Science) (Hons)",
  "localizedName": {
    "en": "Bachelor of Agrotechnology Science (Crop Science) (Hons)",
    "ms": "(auto-fill from en)",
    "zh-CN": "农业技术科学学士（作物科学）（荣誉）",
    "zh-TW": "(auto-fill from zh-CN)"
  },
  "level": "bachelor",           // bachelor | master | phd
  "category": "agriculture",     // science | engineering | business | computing | agriculture | maritime | ...
  "universityCode": "UMT",
  "facultyEn": "Faculty of Food Sciences and Agrotechnology (FSMA)",
  "facultyLocalized": {          // 四语学院名
    "en": "...", "ms": "...", "zh-CN": "...", "zh-TW": "..."
  },
  "campus": "Kuala Nerus",
  "studyMode": "coursework",     // coursework | research
  "durationYears": 4,
  "durationOfficial": "8 Semesters",
  "officialIntake": "February, September",
  "tuitionAmount": 42000,        // MYR
  "tuitionCurrency": "MYR",
  "tuitionBasis": "total-programme",
  "annualTuitionCny": 23520,
  "fee": {
    "internationalAmount": 42000,
    "currency": "MYR",
    "basis": "total-programme",
    "officialFeeText": "RM 42,000 total programme fee (international student)",
    "status": "official-verified",
    "officialFeeSourceUrl": "https://studymalaysia.com/edu/umt/courses/",
    "tuitionDisplay": "RM 42,000 total tuition"
  },
  "languageRequirement": {
    "ielts": 5.5, "toefl": 46, "pte": 39, "muet": 4
  },
  "requirement": {
    "gpa": 2.5, "gaokaoRequired": false, "huikaoRequired": false
  },
  "officialAcademicRequirement": "High school diploma equivalent to STPM/A-Levels...",
  "officialLanguageRequirement": "International students: IELTS 5.5 or TOEFL iBT 46...",
  "applicationDocuments": [...],
  "curriculum": ["Crop Science", "Soil Science", ...],
  "specializations": [],         // 研究型专业的研究方向
  "careerDirections": [...],
  "description": { "en": "...", "ms": "...", "zh-CN": "...", "zh-TW": "..." },
  "mqaCode": "",
  "officialSourceUrl": "https://www.umt.edu.my/all-programs-at-umt/",
  "officialFeeSourceUrl": "https://studymalaysia.com/edu/umt/courses/",
  "officialVerifiedAt": "2026-07-07",
  "officialSourceStatus": "official-verified",
  "publicDisplayStatus": "ready"
}
```

### 4.2 四语处理逻辑

```
en  → 从官方源直接获取（英文是马来西亚高等教育的工作语言）
ms  → 从马来文版官网获取；如果官网只有英文，则 auto-fill from en
zh-CN → 人工翻译（基于英文名称 + 专业领域知识）
zh-TW → 从 zh-CN 转换（繁体化），标记为 auto-fill

特殊情况：
- 学院名称：马来文版官网通常有正式马来文名称 → 直接使用
- 描述文本：en 完整，ms 简化，zh-CN 完整，zh-TW 简化
- 设施/亮点：en 完整列表，ms 精简列表，zh-CN 完整，zh-TW 精简
```

### 4.3 专业合并/拆分逻辑

**UMT 的特殊挑战：** 官网列出 175 个 M.Sc./Ph.D. 研究方向，但很多只是同一学位的不同研究方向。

**合并策略：**

```
原始数据：175 个 "M.Sc./Ph.D." 条目
  │
  ├─ 按学科领域分组
  │   例如：Marine Biology, Marine Chemistry, Marine Pollution, Mangrove Ecology
  │   → 合并为 "Master of Marine Science (Research)"
  │
  ├─ 区分硕士 vs 博士
  │   官网写 "M.Sc./Ph.D." → 拆分为两个独立专业
  │
  ├─ 保留研究方向作为 specializations 字段
  │   specializations: ["Marine Biology", "Marine Chemistry", ...]
  │
  └─ 最终结果：17 硕士研究型 + 7 硕士授课型 + 17 博士 = 41 研究生专业
     + 15 本科 = 56 个专业（从 175+15 条目合并而来）
```

**合并原则：**

| 条件 | 动作 |
|------|------|
| 同一学位名称 + 不同研究方向 | 合并为一个专业，研究方向放入 `specializations` |
| "M.Sc./Ph.D." 联合条目 | 拆分为硕士和博士两个独立专业 |
| 完全独立的专业 | 不合并 |
| Diploma/Foundation 等非学位课程 | 不采集（只采集 bachelor/master/phd） |

### 4.4 Slug 生成逻辑

```
slug = f"umt-{level}-{slugified_name}"

slugified_name = nameEnOfficial
  .lower()
  .replace(" ", "-")
  .replace("(", "")
  .replace(")", "")
  .replace(",", "")
  .replace("--", "-")
  .rstrip("-")

特殊处理（UMT 专属）：
  - "Bachelor of Applied Science" → strip prefix → "applied-science-..."
  - "Bachelor of Computer Science" → strip prefix → "computer-science-..."
  - "Doctor of Philosophy" → strip prefix → "marine-science" (保留学科名)

例子：
  "Bachelor of Agrotechnology Science (Crop Science) (Hons)"
  → umt-bachelor-agrotechnology-science-crop-science-hons
```

### 4.5 Python 生成脚本

使用 `make_prog()` 工厂函数统一生成专业对象，确保：

1. **所有字段名一致** — 不会出现 typo
2. **默认值统一** — `officialSourceStatus`, `publicDisplayStatus` 等审计字段自动填充
3. **四语自动填充** — ms auto-fill from en, zh-TW auto-fill from zh-CN
4. **费用计算自动化** — `annualTuitionCny = tuitionMYR * 1.68 / durationYears`
5. **语言要求联动** — IELTS → TOEFL/PTE/MUET 自动推算

---

## 5. GATE 1 · Dry-Run 预检门禁

### 5.1 门禁检查项

在执行 `--confirm-import` 之前，先运行 dry-run（默认模式），检查以下所有项：

| # | 检查项 | 门禁值 | 违规处理 |
|---|--------|--------|---------|
| 1 | **TypeScript 编译** | 0 错误 | 修复 TS 代码后重新编译 |
| 2 | **Slug 唯一性** | 所有 slug 不重复 | 修改 slugified name 直到唯一 |
| 3 | **institutionType 长度** | ≤ 20 字符 | 改用数据库已有值（如 `research`, `comprehensive`） |
| 4 | **四语字段非空** | en + zh-CN 必须有值 | 补充翻译 |
| 5 | **学费 > 0** | tuitionAmount > 0 | 重新采集学费数据 |
| 6 | **学制 > 0** | durationYears > 0 | 重新确认学制 |
| 7 | **学位等级合法** | bachelor/master/phd 之一 | 修正 level 字段 |
| 8 | **学院映射存在** | facultyKey 在 FACULTIES 字典中 | 补充学院映射 |
| 9 | **官方源 URL 非空** | officialSourceUrl 有值 | 补充来源 URL |
| 10 | **publicDisplayStatus** | = "ready" | 设置为 ready |

### 5.2 Dry-Run 执行

```bash
cd apps/api
npm run import:umt:official-audit
# 默认 dry-run 模式，不写入数据库
# 输出：专业数量、slug 列表、唯一性检查结果
```

### 5.3 UMT 的门禁违规案例

**实际发生的违规：**

```
❌ institutionType = "maritime-marine-science" (22 字符 > 20 字符限制)
   数据库列定义：varchar(20)
   错误信息：QueryFailedError: Data too long for column 'institutionType'
   修复：改为 "research"（与数据库中其他公立大学一致）
   修复后：✅ 通过
```

---

## 6. Phase 4 · 数据库入库

### 6.1 导入脚本结构

每个大学有一个专属导入脚本（TypeScript），基于已有模板（如 UTAR 的脚本）创建：

```
apps/api/src/db/import-umt-official-audit.ts (941 行)
  │
  ├─ 常量定义
  │   - UMT_OFFICIAL_SLUG_PREFIX = "umt-"
  │   - DEFAULT_UMT_OFFICIAL_CANDIDATE_PATH = "data/imports/umt/2026-07-07/candidate-dataset.json"
  │   - verifiedAt = "2026-07-07"
  │   - 官方 URL 常量
  │
  ├─ 接口定义
  │   - UMTImportOptions
  │   - UMTFee (学费结构)
  │   - UMTCandidateProgramme (专业结构)
  │
  ├─ 核心函数
  │   - generateSlug()          → slug 生成（含 UMT 专属学位前缀剥离）
  │   - parseDurationYears()    → "12 months" → 1 年
  │   - inferCategory()         → 从专业名推断 category
  │   - inferStudyMode()        → "(Research)" → "research"
  │   - mapProgramme()          → JSON → ProgramEntity
  │   - mapUniversity()         → JSON → UniversityEntity
  │
  ├─ 三种运行模式
  │   - dry-run (默认)         → 预览，不写入
  │   - --confirm-import        → 实际写入数据库
  │   - --verify-only           → 验证已入库数据
  │
  └─ 主流程
      1. 读取 candidate-dataset.json
      2. 建立 DataSource 连接 MySQL
      3. 映射大学 → upsert by slug
      4. 映射专业 → upsert by slug (batch)
      5. 输出报告（写入数、跳过数、错误数）
```

### 6.2 Upsert 逻辑

```
upsert by slug:
  - 如果 slug 已存在 → 更新所有字段
  - 如果 slug 不存在 → 插入新记录
  - 不会删除已有记录（幂等操作）

大学 slug: "universiti-malaysia-terengganu"
专业 slug: "umt-{level}-{slugified-name}"
```

### 6.3 审计字段设置

入库时必须设置以下审计字段，确保数据可追溯：

```typescript
// 大学级别
university.officialSourceStatus = "official-verified";
university.officialVerifiedAt = "2026-07-07";
university.publicDisplayStatus = "ready";
university.isPublished = true;

// 专业级别
program.officialSourceStatus = "official-verified";
program.officialVerifiedAt = "2026-07-07";
program.publicDisplayStatus = "ready";
program.isPublished = true;
program.fee.status = "official-verified";
program.fee.officialFeeAuditStatus = "matched-official";
```

### 6.4 确认导入命令

```bash
cd apps/api
npm run import:umt:official-audit -- --confirm-import
# 输出：
#   University upserted: ID=23, slug=universiti-malaysia-terengganu
#   Programmes upserted: 56 (15 bachelor + 24 master + 17 phd)
#   Skipped: 0
#   Errors: 0
```

---

## 7. GATE 2 · 三层验证

### 7.1 三层验证体系

数据入库后，必须通过三个层面的验证才能确认上线：

```
第 1 层：数据库直查
  ┌─────────────────────────────────────────────────────┐
  │ 直接查询 MySQL，确认数据物理存在且字段正确          │
  │                                                     │
  │ SELECT COUNT(*) FROM programs                       │
  │   WHERE universityId = 23                           │
  │   AND isPublished = 1                               │
  │   AND publicDisplayStatus = 'ready';                │
  │                                                     │
  │ 期望结果：56 条                                     │
  │ 按等级分组：bachelor=15, master=24, phd=17         │
  └─────────────────────────────────────────────────────┘
                         ↓
第 2 层：API 端点验证
  ┌─────────────────────────────────────────────────────┐
  │ curl http://localhost:3000/api/universities/        │
  │   universiti-malaysia-terengganu                    │
  │                                                     │
  │ 检查项：                                            │
  │   - HTTP 200                                        │
  │   - response.programs.length === 56                 │
  │   - 每个专业有 level, tuitionDisplay,              │
  │     durationOfficial, languageRequirement           │
  │   - publicDisplayStatus === "ready"                │
  │   - isPublished === true                            │
  └─────────────────────────────────────────────────────┘
                         ↓
第 3 层：前端页面渲染
  ┌─────────────────────────────────────────────────────┐
  │ 浏览器访问:                                         │
  │   http://localhost:5173/universities/               │
  │   universiti-malaysia-terengganu                    │
  │                                                     │
  │ 检查项：                                            │
  │   - 页面头部显示大学名称（四语）                    │
  │   - 本科标签：15 个专业                             │
  │   - 硕士标签：24 个专业                             │
  │   - 博士标签：17 个专业                             │
  │   - 专业卡片包含学费、学制、IELTS、学院             │
  │   - 无控制台错误                                    │
  └─────────────────────────────────────────────────────┘
```

### 7.2 验证失败的排查路径

```
前端显示 0 专业
  │
  ├─→ 检查 API 是否返回专业？
  │    ├─ YES → 前端问题（store/组件/review-preview 劫持）
  │    └─ NO  → 检查数据库
  │              ├─ DB 有数据 → API 过滤问题（isPublished/publicDisplayStatus）
  │              └─ DB 无数据 → 导入未成功
  │
  └─→ UMT 实际案例：
       API 返回 56 个 ✅
       DB 有 56 条 ✅
       前端显示 0 ❌
       → 根因：UniversityPage.vue 强制 UMT 走 review-preview 端点
       → 修复：移除 review-preview 强制逻辑
```

### 7.3 API 缓存注意

```
API getBySlug() 有 10 分钟内存缓存 (TTL = 600s)

影响：
  - 数据导入后，API 可能仍返回旧缓存
  - 需要：重启 API 服务器 OR 等待 10 分钟

处理：
  - 导入后立即验证时 → 重启 API 服务器
  - 生产环境中 → 等待缓存过期或主动清除
```

---

## 8. Phase 5 · 前端上线展示

### 8.1 前端过滤逻辑

API 层面的过滤条件（`catalog-localization.service.ts`）：

```typescript
// 默认查询条件（不含隐藏内容时）
where: includeHidden ? {} : {
  isPublished: true,
  publicDisplayStatus: "ready"
}
```

**两个条件必须同时满足，缺一不可：**

| 条件 | 值 | 含义 |
|------|-----|------|
| `isPublished` | `true` | 数据已发布 |
| `publicDisplayStatus` | `"ready"` | 数据已准备好公开展示 |

### 8.2 前端组件渲染逻辑

```
UniversityPage.vue
  │
  ├─ onMounted → catalog.loadUniversity(slug)
  │    → 调用 API: GET /api/universities/{slug}
  │    → 响应存入 store.universityDetail
  │
  ├─ computed: activePrograms
  │    → 从 detail.programs 过滤
  │    → 按 activeProgramLevel 过滤 (bachelor/master/phd)
  │    → 按 comparePrograms 排序
  │
  ├─ Tab 切换
  │    → 本科标签 → filter(level === "bachelor") → 15 个
  │    → 硕士标签 → filter(level === "master")   → 24 个
  │    → 博士标签 → filter(level === "phd")      → 17 个
  │
  └─ 专业卡片渲染
       → 名称、学院、学费、学制、IELTS、入学月份
```

### 8.3 Review-Preview 清理

**什么是 review-preview？**

早期开发阶段，部分大学数据尚未正式导入，使用了一个临时的 review-preview 机制：
- 前端强制某些大学走 `/api/universities/:slug/review-preview?key=xxx` 端点
- 该端点只返回特定 slug 前缀的专业（如 `umt-undergraduate-20260706-row-`）
- 正式导入的专业 slug 格式是 `umt-bachelor-*`，不匹配，导致 0 专业

**清理逻辑：**

当一所大学的数据正式导入并通过验证后，必须：

1. 从 `UniversityPage.vue` 移除该大学的 `reviewPreviewSlugs` 强制逻辑
2. 从 `ProgramPage.vue` 移除该大学的 slug 前缀检查
3. 从 `catalog.ts` 的 `REVIEW_PREVIEW_KEYS` 移除该大学的 key
4. 从 `universities.service.ts` 的 `reviewPreviewConfigs` 移除该大学的配置

**UMT 的清理涉及 4 个文件：**

```
apps/web/src/pages/UniversityPage.vue     → 移除 umtReviewPreviewSlugs
apps/web/src/pages/ProgramPage.vue        → 移除 umt slug 前缀检查
apps/web/src/stores/catalog.ts            → 移除 REVIEW_PREVIEW_KEYS.umt
apps/api/src/universities/universities.service.ts → 移除 reviewPreviewConfigs UMT 块
```

### 8.4 最终展示标准

一个专业卡片在前端展示时，必须包含：

```
┌──────────────────────────────────────────────┐
│  专业名称（中文）                             │
│  Bachelor of Agrotechnology Science (Hons)   │
│                                              │
│  学院：食品科学与农业技术学院                  │
│  学制：4年 (8 Semesters)                     │
│  学费：RM 42,000 总学费                      │
│  IELTS：5.5+                                 │
│  开学：2月, 9月                              │
│  类别：农业                                   │
└──────────────────────────────────────────────┘
```

---

## 9. 门禁汇总与违规处理协议

### 9.1 绝对门禁清单

以下门禁**不可跳过、不可降级**，违反任何一条都不得上线：

| 门禁 | 阶段 | 检查方式 | 违规后果 |
|------|------|---------|---------|
| **G1: TypeScript 0 错误** | GATE 1 | `tsc --noEmit` | 修复代码后重跑 |
| **G2: Slug 全部唯一** | GATE 1 | dry-run 输出 | 修改 slug 生成逻辑 |
| **G3: institutionType ≤ 20 字符** | GATE 1 | dry-run / DB 错误 | 改用已有短值 |
| **G4: 四语字段非空** | GATE 1 | dry-run 检查 | 补充翻译 |
| **G5: 学费 > 0 且有源** | GATE 1 | JSON 检查 | 重新采集学费 |
| **G6: publicDisplayStatus = "ready"** | Phase 4 | DB 查询 | 修正状态 |
| **G7: isPublished = true** | Phase 4 | DB 查询 | 修正状态 |
| **G8: API 返回正确专业数** | GATE 2 | curl 验证 | 排查 API 过滤/缓存 |
| **G9: 前端页面渲染正确** | GATE 2 | 浏览器验证 | 排查前端组件/store |
| **G10: 无 review-preview 劫持** | Phase 5 | 代码审查 | 清理临时逻辑 |

### 9.2 门禁违规处理协议

```
碰到门禁时的标准处理流程：

┌──────────────┐
│ 门禁检查失败  │
└──────┬───────┘
       ↓
┌──────────────────────────┐
│ 记录违规详情              │
│ - 哪个门禁失败            │
│ - 错误信息                │
│ - 涉及的专业/字段         │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│ 定位根因                  │
│ - JSON 数据问题？→ 修 JSON │
│ - 导入脚本问题？→ 修脚本   │
│ - 前端问题？→ 修组件       │
│ - 数据库限制？→ 适配限制   │
└──────────┬───────────────┘
           ↓
┌──────────────────────────┐
│ 修复后重新验证            │
│ - 从失败的门禁重新开始    │
│ - 不需要从 Phase 1 重来   │
│ - 最多重试 2 轮           │
└──────────┬───────────────┘
           ↓
     ┌─────┴─────┐
     │ 通过？     │
     ├─YES→ 上线  │
     └─NO → 标记遗留问题，人工介入 │
```

### 9.3 不可降级原则

以下原则**在任何情况下都不可降级**：

1. **学费必须有官方源** — 不允许估算、推测
2. **四语必须至少有 en + zh-CN** — 不允许只有英文
3. **slug 必须唯一** — 不允许添加后缀数字来去重
4. **publicDisplayStatus 必须为 "ready"** — 不允许用 "draft" 或 "review" 上线
5. **前端必须通过浏览器验证** — 不允许只看 API 返回就宣布完成

---

## 10. UMT 实战案例全流程复盘

### 10.1 时间线

```
Step 1: 确定数据源
  - 官网: umt.edu.my
  - 子站: postgrad.umt.edu.my, akademik.umt.edu.my
  - 第三方: StudyMalaysia, UniPage, EduYar
  - 排名: QS 2026 公告页

Step 2: 深挖页面
  - 首页 → 大学基本信息
  - all-programs → 192 个专业条目（含 175 研究方向）
  - international-student-undergraduate → 国际生要求
  - postgraduate_fees-2 → 研究生学费
  - 学费 PDF → 本科国际生学费（USD）
  - QS 公告 → 排名 #801-850 (2026, 首次进入)

Step 3: 交叉验证
  - 专业列表：官网 vs StudyMalaysia → 一致 ✅
  - 学费：学费 PDF vs StudyMalaysia → 一致 ✅
  - QS 排名：官网公告 vs QS 官网 → 一致 ✅
  - IELTS：国际生页 vs StudyMalaysia → 一致 ✅

Step 4: 专业合并
  - 175 个研究方向 → 17 硕士研究型 + 17 博士（按学科领域合并）
  - + 7 硕士授课型 + 15 本科 = 56 个专业

Step 5: 结构化建模
  - Python 脚本 generate-umt-data.py
  - make_prog() 工厂函数
  - 四语填充（en 完整, ms auto, zh-CN 翻译, zh-TW auto）
  - 学费 USD → MYR 转换 (1 USD = 4.7 MYR)
  - 输出 candidate-dataset.json (173KB)

Step 6: Dry-run 预检
  - TypeScript 编译：0 错误 ✅
  - Slug 唯一性：56 个全部唯一 ✅
  - institutionType = "maritime-marine-science" → 22 字符 ❌
  - 修复：改为 "research" (8 字符) ✅

Step 7: 确认导入
  - npm run import:umt:official-audit -- --confirm-import
  - 大学：ID=23, slug=universiti-malaysia-terengganu ✅
  - 专业：56 个全部写入 ✅

Step 8: 三层验证
  - DB 直查：56 条, isPublished=1, publicDisplayStatus=ready ✅
  - API 验证：返回 56 个专业 ✅
  - 前端验证：显示 0 专业 ❌

Step 9: 排查前端问题
  - API 返回正确 → 前端问题
  - Pinia store 有 universityDetail 但 programs=0
  - 手动调用 loadUniversity() → 56 个专业出现
  - 根因：reviewPreview 计算属性强制 UMT 走 review-preview 端点
  - review-preview 端点返回 404（slug 前缀不匹配）

Step 10: 修复 review-preview 劫持
  - 修改 4 个文件，移除 UMT 的 review-preview 强制逻辑
  - TypeScript 编译：0 错误 ✅
  - 前端验证：本科 15 + 硕士 24 + 博士 17 = 56 ✅

Step 11: 最终交付
  - 截图确认三个标签页专业正常展示
  - 项目记忆更新
  - 团队关闭
```

### 10.2 交付物清单

| 文件 | 用途 |
|------|------|
| `data/imports/umt/2026-07-07/generate-umt-data.py` | Python 数据生成脚本 |
| `data/imports/umt/2026-07-07/candidate-dataset.json` | 结构化 JSON 数据 (173KB) |
| `apps/api/src/db/import-umt-official-audit.ts` | TypeScript 导入脚本 (941行) |
| `apps/api/package.json` | 新增 import/verify 脚本命令 |
| `apps/web/src/pages/UniversityPage.vue` | 移除 review-preview 劫持 |
| `apps/web/src/pages/ProgramPage.vue` | 移除 review-preview 劫持 |
| `apps/web/src/stores/catalog.ts` | 移除 REVIEW_PREVIEW_KEYS.umt |
| `apps/api/src/universities/universities.service.ts` | 移除 reviewPreviewConfigs UMT |

### 10.3 经验教训

| 教训 | 详情 | 防范措施 |
|------|------|---------|
| institutionType 字段限制 | varchar(20) 导致 22 字符值被拒 | dry-run 必须检查所有 varchar 字段长度 |
| review-preview 遗留 | 临时逻辑未及时清理导致正式数据不可见 | 每次正式导入后必须清理 review-preview |
| API 缓存 | 10 分钟缓存导致导入后看不到新数据 | 导入后重启 API 或等待缓存过期 |
| 多子站深挖 | postgrad.umt.edu.my 是独立子域名 | 必须检查所有子域名，不能只看主站 |
| 研究方向合并 | 175 个方向不能全部作为独立专业 | 按学科领域合并，保留 specializations |

---

## 附录 A：标准执行清单

每处理一所新大学时，按以下清单执行：

```
□ 1. 确认大学官方域名和子站
□ 2. 深挖首页 → 学院页 → 专业目录页 → 学费子站 → PDF 附件
□ 3. 从 StudyMalaysia 获取第三方专业列表
□ 4. 交叉验证专业列表、学费、排名、IELTS
□ 5. 判断数据新鲜度（QS 年份、学费学年、页面更新日期）
□ 6. 合并/拆分研究方向（如有）
□ 7. 四语翻译（en 完整, zh-CN 完整, ms/zh-TW auto-fill）
□ 8. 编写 Python 生成脚本 → 输出 candidate-dataset.json
□ 9. 基于模板创建 TypeScript 导入脚本
□ 10. Dry-run 预检 → 通过所有 GATE 1 检查
□ 11. --confirm-import 执行入库
□ 12. DB 直查验证（数量、状态、字段）
□ 13. API 端点验证（HTTP 200, programs 数组）
□ 14. 重启 API 服务器（清除缓存）
□ 15. 前端页面验证（三个标签页专业数量）
□ 16. 检查并清理 review-preview 临时逻辑（如有）
□ 17. 截图确认最终展示效果
□ 18. 更新项目记忆
```

## 附录 B：文件结构规范

```
data/imports/{university-code}/{date}/
  ├── generate-{code}-data.py          # Python 生成脚本
  └── candidate-dataset.json           # 结构化 JSON

apps/api/src/db/
  └── import-{code}-official-audit.ts  # TypeScript 导入脚本

apps/api/package.json
  └── scripts:
      ├── "import:{code}:official-audit": "tsx src/db/import-{code}-official-audit.ts"
      └── "verify:{code}:official-audit": "tsx src/db/import-{code}-official-audit.ts --verify-only"
```

## 附录 C：质量评分标准

| 维度 | 满分 | 评分标准 |
|------|------|---------|
| 数据源覆盖 | 20 | 每个关键字段有 ≥2 源 = 20; 1 源 = 10; 0 源 = 0 |
| 四语完整性 | 20 | en+zh-CN+ms+zh-TW 全有 = 20; 缺1 = 15; 缺2 = 10 |
| 学费准确性 | 20 | 官方源+交叉验证 = 20; 官方源 = 15; 第三方 = 10 |
| 专业完整度 | 20 | 官网全部学位专业 = 20; ≥80% = 15; ≥50% = 10 |
| 前端展示 | 20 | 三标签全部正常 = 20; 部分缺失 = 10; 不可见 = 0 |

**及格线：80/100。低于 80 分不得上线。**
