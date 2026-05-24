# TASK-041 四语言专业翻译词表和页面文案校对说明

## 文档定位

本文件记录 TASK-041 的四语言术语统一口径和页面文案校对结论。Notion 仍是中文项目文档和任务管理来源，不是业务数据库；本轮未获得可写入的真实 Notion 页面 ID，因此只更新本地中文文档。

## 翻译原则

- 官方学校名、官方专业名、官方来源标题、QS、IELTS、TOEFL、GPA、MQA、RM、CNY 等可信原文或通用缩写保持原始表达。
- 静态界面文案按当前语言自然表达，不把后端原始英文错误、中文分类值或未核验英文备注直接暴露到非对应语言页面。
- 简体中文统一面向留学决策场景，优先使用“院校”“专业”“申请规划”“可公开展示”等表达，避免“项目”“客户”“可商用展示”等内部或中式表达进入用户界面。
- 繁体中文由简体中文基线转换并补充真实动态样本校验，避免“软件、责任、农业、申请规划、登录、账号、专业”等简体残留。
- 英文使用面向国际学生的专业表达，采用马来西亚高等教育语境中的 `programme`。
- 马来语不沿用英文兜底；收藏场景统一使用 `Senarai pendek`，会员中心统一使用 `Pusat Pelajar`。

## 核心术语表

| 术语场景 | zh-CN | zh-TW | en | ms |
| --- | --- | --- | --- | --- |
| 院校库 | 院校库 | 院校庫 | University Directory | Universiti |
| 院校 | 院校 | 院校 | University | Universiti |
| 专业 | 专业 | 專業 | Programme | Program |
| 专业方向 | 专业方向 | 專業方向 | Programme category | Kategori program |
| 学位层级 | 学位层级 | 學位層級 | Degree level | Tahap ijazah |
| 本科 | 本科 | 本科 | Bachelor | Sarjana muda |
| 硕士 | 硕士 | 碩士 | Master | Sarjana |
| 博士 | 博士 | 博士 | PhD | PhD |
| 收藏 / 短名单 | 收藏 | 收藏 | Shortlist | Senarai Pendek |
| 对比 | 对比 | 對比 | Compare | Perbandingan |
| 申请规划 | 申请规划 | 申請規劃 | Application Planner | Perancangan Permohonan |
| 会员中心 | 会员中心 | 會員中心 | Student Center | Pusat Pelajar |
| 条件语言路径 | 条件语言路径 | 條件語言路徑 | Conditional offer / language score later | Tawaran bersyarat / skor bahasa kemudian |
| 费用估算 | 费用估算 | 費用估算 | Cost Estimator | Anggaran Kos |
| 年学费 | 年学费 | 年學費 | Annual tuition | Yuran tahunan |
| 首年成本 | 首年成本 | 首年成本 | First-year cost | Kos tahun pertama |
| 入学与语言要求 | 入学与语言要求 | 入學與語言要求 | Entry and language requirements | Syarat kemasukan dan bahasa |
| 申请材料 | 申请材料 | 申請材料 | Application documents | Dokumen permohonan |
| 开学时间 | 开学时间 | 開學時間 | Intake time | Masa ambilan |
| 官方学制 | 官方学制 | 官方學制 | Official duration | Tempoh rasmi |
| 官方来源 | 官方来源 | 官方來源 | Official source | Sumber rasmi |
| 可公开展示 | 可公开展示 | 可公開展示 | Ready for public display | Sedia untuk paparan awam |
| 待官方确认 | 待官方确认 | 待官方確認 | Pending official confirmation | Menunggu pengesahan rasmi |
| 以院校官方页面为准 | 以院校官方页面为准 | 以院校官方頁面為準 | Refer to the official university page | Rujuk halaman rasmi universiti |
| 认证失败 | 认证失败，请检查账号信息后重试。 | 認證失敗，請檢查帳號資訊後重試。 | Authentication failed. Please check your account details and try again. | Pengesahan gagal. Sila semak butiran akaun dan cuba lagi. |

## 本轮校对范围

- 更新用户端四语言 messages 中导航、收藏、会员中心、登录弹窗、首页说明、院校详情、专业详情、对比、费用和错误提示的表达。
- 修正对比页移动端移除按钮的可见硬编码符号，改为现有图标体系，避免 i18n 扫描误判。
- 新增 `scripts/task041-copy-audit.ts`，对术语表抽样、简繁残留、马来语英文兜底、动态分类和复杂英文备注 fallback 进行校验。
- 复用 TASK-040 的 i18n key、硬编码、动态文案和 raw error.message 检查，保持四语言结构一致。

## 不变范围

- 不翻译官方学校名、官方专业名和官方来源标题。
- 不修改页面功能逻辑、路由、API 契约、数据库结构或页面整体风格。
- 不处理 TASK-042 的全页面视觉回归范围；本任务仅做必要的四语言浏览器抽查。
