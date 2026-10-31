# UMT 专业数据完整性审计报告

> 审计日期: 2026-07-07
> 审计对象: Universiti Malaysia Terengganu (UMT)
> 审计目的: 核实已导入专业数量与官方公布是否一致

## 一、结论：不一致，存在严重缺口

| 层级 | 官方数量 | 已导入 | 缺失 | 覆盖率 | 状态 |
|------|---------|--------|------|--------|------|
| Foundation 预科 | 1 | 0 | 1 | 0% | ❌ 完全缺失 |
| Diploma 文凭 | 1 | 0 | 1 | 0% | ❌ 完全缺失 |
| **Bachelor 本科** | **38** | **15** | **23** | **39.5%** | ❌ 严重缺失 |
| **Master 授课型** | **14** | **7** | **7** | **50%** | ❌ 严重缺失 |
| Master 研究型 | 175* | 17 | — | — | ⚠️ 合并策略待评估 |
| PhD 博士 | 175* | 17 | — | — | ⚠️ 合并策略待评估 |
| PG Certificate | 1 | 0 | 1 | 0% | ❌ 完全缺失 |
| PG Diploma | 1 | 0 | 1 | 0% | ❌ 完全缺失 |

> *175 个 M.Sc./Ph.D. 联合研究方向（StudyMalaysia），被合并为 17 个研究型硕士 + 17 个 PhD 大类专业。

**虽然我们导入的 56 个专业与官方明确课程总数（~56）数字巧合，但结构完全不同——本科和授课型硕士大面积缺失，而 PhD 是官方页面未明确列出具体课程的。**

---

## 二、本科专业缺失明细（最严重）

官方 38 个本科，我们只导入了 15 个，**缺失 23 个（60.5%）**。

### FSPA 渔业科学与水产养殖学院（缺失 2/2，100%）

| # | 官方专业 | 状态 |
|---|---------|------|
| 1 | Bachelor of Applied Science (Fisheries) with Honours | ❌ 缺失 |
| 2 | Bachelor of Science in Aquaculture with Honours | ❌ 缺失 |

### FSMA 食品科学与农业技术学院（缺失 2/4，50%）

| # | 官方专业 | 状态 |
|---|---------|------|
| 1 | Bachelor of Science Agrotechnology (Crop Science) with Honours | ✅ 已导入 |
| 2 | Bachelor of Food Science (Food Technology) with Honours | ❌ 缺失 |
| 3 | Bachelor of Food Science (Food Service and Nutrition) with Honours | ✅ 已导入 |
| 4 | Bachelor of Agro Processing Technology with Honours | ❌ 缺失 |

### FSSM 科学与海洋环境学院（缺失 3/8，37.5%）

| # | 官方专业 | 状态 |
|---|---------|------|
| 1 | Bachelor of Science (Marine Science) with Honours | ❌ 缺失 |
| 2 | Bachelor of Science (Marine Biology) with Honours | ✅ 已导入 |
| 3 | Bachelor of Science (Marine Geosciences) with Honours | ❌ 缺失 |
| 4 | Bachelor of Science (Biological Sciences) with Honours | ✅ 已导入 |
| 5 | Bachelor of Science (Chemical Sciences) with Honours | ✅ 已导入 |
| 6 | Bachelor of Science (Analytical and Environmental Chemistry) with Honours | ✅ 可能对应 |
| 7 | Bachelor of Applied Science Nanophysics with Honours | ❌ 缺失 |
| 8 | Bachelor of Applied Science (Biodiversity Conservation and Management) with Honours | ✅ 已导入 |

### FSKM 计算机科学与数学学院（缺失 4/6，67%）

| # | 官方专业 | 状态 |
|---|---------|------|
| 1 | Bachelor of Science (Data Analytics) with Honours | ❌ 缺失 |
| 2 | Bachelor of Science (Financial Mathematics) with Honours | ✅ 已导入 |
| 3 | Bachelor of Science (Applied Mathematics) with Honours | ❌ 缺失 |
| 4 | Bachelor of Computer Science (Software Engineering) with Honours | ❌ 缺失 |
| 5 | Bachelor of Computer Science with Maritime Informatics with Honours | ✅ 已导入 |
| 6 | Bachelor of Computer Science (Mobile Computing) with Honours | ❌ 缺失 |

### FTKK 海洋工程技术学院（缺失 5/8，62.5%）

| # | 官方专业 | 状态 |
|---|---------|------|
| 1 | Bachelor of Technology (Environmental) with Honours | ❌ 缺失 |
| 2 | Bachelor of Applied Science (Electronics and Instrumentation) with Honours | ✅ 已导入 |
| 3 | Bachelor of Applied Science (Maritime Technology) with Honours | ✅ 已导入 |
| 4 | Bachelor of Mechanical Engineering Technology (Naval Architecture) with Honours | ❌ 缺失 |
| 5 | Bachelor of Technology (Renewable Energy) with Honours | ❌ 缺失 |
| 6 | Bachelor of Electrical Technology (Energy and Power) with Honours | ✅ 已导入 |
| 7 | Bachelor of Applied Science (Maritime Technology) with Honours (Dual Degree) | ❌ 缺失 |
| 8 | Bachelor of Science in Occupational Safety and Health with Environmental Technology with Honours | ❌ 缺失 |

### FPM 海事研究学院（缺失 2/3，67%）

| # | 官方专业 | 状态 |
|---|---------|------|
| 1 | Bachelor of Management (Maritime) with Honours | ❌ 缺失 |
| 2 | Bachelor of Management (Maritime Operation) with Honours | ❌ 缺失 |
| 3 | Bachelor of Science (Nautical Science and Maritime Transportation) with Honours | ✅ 已导入 |

### FPEPS 商业、经济与社会发展学院（缺失 5/7，71%）

| # | 官方专业 | 状态 |
|---|---------|------|
| 1 | Bachelor of Economics (Natural Resources) with Honours | ❌ 缺失 |
| 2 | Bachelor of Counselling with Honours | ✅ 已导入 |
| 3 | Bachelor of Finance with Honours | ✅ 已导入 |
| 4 | Bachelor of Management (Marketing) with Honours | ❌ 缺失 |
| 5 | Bachelor of Management (Policy Studies) with Honours | ❌ 缺失 |
| 6 | Bachelor of Management (Tourism) with Honours | ❌ 缺失 |
| 7 | Bachelor of Accounting with Honours | ❌ 缺失 |

---

## 三、授课型硕士缺失明细

官方 14 个授课型硕士，我们只导入了 7 个，**缺失 7 个（50%）**。

| # | 官方专业 | 状态 |
|---|---------|------|
| 1 | Master of Information Technology | ❌ 缺失 |
| 2 | Master of Computer Science | ✅ 已导入 |
| 3 | Master of Science (Maritime Studies) | ❌ 缺失 |
| 4 | Master of Business Administration (MBA) | ✅ 已导入 |
| 5 | Master of Economics | ❌ 缺失 |
| 6 | Master of Counselling | ✅ 已导入 |
| 7 | Master of Management (Integrated Coastal Zone) | ❌ 缺失 |
| 8 | Master of Science in Tropical Fisheries | ✅ 已导入 |
| 9 | Master of Science in Aquaculture | ✅ 已导入 |
| 10 | Master of Statistics in Marine Science | ❌ 缺失 |
| 11 | Master of Science Tropical Marine Environment | ❌ 缺失 |
| 12 | Master of Science in Tropical Biodiversity | ❌ 缺失 |
| 13 | Master of Environmental Forensic | ✅ 已导入 |
| 14 | Master of Mathematics | ❌ 缺失 |

---

## 四、其他层级缺失

| 层级 | 专业名 | 状态 |
|------|--------|------|
| Foundation | Foundation in STEM | ❌ 缺失 |
| Diploma | Diploma in Fisheries | ❌ 缺失 |
| PG Certificate | Postgraduate Certificate in Maritime Studies | ❌ 缺失 |
| PG Diploma | Postgraduate Diploma in Maritime Studies | ❌ 缺失 |

---

## 五、根因分析

### 直接原因

采集时主要依赖了 **StudyMalaysia.com** 的 UMT 课程页面（`studymalaysia.com/edu/umt/courses/`），而该页面的本科列表在第 15 个专业（Financial Mathematics）处**截断**，未显示完整列表。

### 深层原因

1. **交叉验证不足**：虽然官方源列表中包含了 `umt.edu.my/all-programs-at-umt/` 的 URL，但没有用该页面的完整 38 个本科列表做逐项交叉验证。

2. **单一来源依赖**：本科数据主要来自 StudyMalaysia（Tier 2 来源），而非 UMT 官网 "All Programs" 页面（Tier 1 来源）。

3. **页面截断未识别**：StudyMalaysia 页面在本科列表第 15 项处截断，这是一个明显的数据不完整信号，但采集时未识别并触发补充采集。

4. **层级覆盖不全**：只采集了 Bachelor + Master + PhD 三个层级，遗漏了 Foundation、Diploma、PG Certificate、PG Diploma 四个层级。

---

## 六、补救方案

### 方案 A：补全缺失专业（推荐）

1. 以 UMT 官网 `all-programs-at-umt` 页面为权威源（Tier 1）
2. 逐个采集 23 个缺失本科 + 7 个缺失授课型硕士的详细信息
3. 补采 Foundation、Diploma、PG Cert、PG Dip 共 4 个课程
4. 更新 `candidate-dataset.json`，重新运行导入脚本
5. 前端验证所有层级显示

### 方案 B：仅补全本科

1. 补采 23 个缺失本科专业
2. 授课型硕士和 PhD 暂不处理
3. 适合时间紧迫的情况

### 评估研究型硕士/PhD 合并策略

- 官方列出了 175 个 M.Sc./Ph.D. 联合研究方向
- 我们合并为 17 个研究型硕士 + 17 个 PhD 大类专业
- 需评估：合并是否合理？是否应该保留原始 175 个方向作为专业详情？

---

## 七、数据来源

| 来源 | URL | 信任层级 | 用途 |
|------|-----|---------|------|
| UMT 官网 All Programs | https://www.umt.edu.my/all-programs-at-umt/ | Tier 1 (官方权威) | 完整课程列表 |
| UMT 国际生本科 | https://www.umt.edu.my/international-student-undergraduate/ | Tier 1 | 入学要求 |
| UMT 研究生费用 | https://postgrad.umt.edu.my/postgraduate_fees-2/ | Tier 1 | 学费 |
| UMT 本科费用 PDF | https://akademik.umt.edu.my/wp-content/uploads/... | Tier 1 | 本科学费 |
| StudyMalaysia 课程 | https://studymalaysia.com/edu/umt/courses/ | Tier 2 (官方listing) | 课程详情+学费 |
| UMT QS 排名公告 | https://www.umt.edu.my/umt-placed-higher... | Tier 1 | 排名信息 |
