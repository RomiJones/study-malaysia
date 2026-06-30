import {
  normalizeQsRankDisplay,
  normalizeProgramDetailLocalizedArray,
  normalizeProgramDetailLocalizedText,
  QS_WORLD_RANKING_YEAR,
  localizeUniversityImageUrl,
  localizeUniversityLogoUrl,
  type FeeAuditStatus,
  type LocalizedStringArray,
  type OfficialSourceLink,
  type PlannerApplicationItem,
  type PlannerMaterialItem,
  type PlannerProfile,
  type PlannerVisaChecklist,
  type ProgramListItem,
  type PublicDisplayStatus,
  type RecommendationResult,
  type RequirementInfo,
  type TuitionCurrency,
  type TuitionInfo,
  type QsWorldRankContext,
  type QsWorldRankStatus,
  type UniversityListItem
} from "@studymy/shared";
import { translateArray } from "./i18n.js";
import { getFilterableTuitionCny, resolveProgramFee } from "./fee-strategy.helper.js";
import {
  ContentBlockEntity,
  PlannerProfileEntity,
  PlannerTaskEntity,
  ProgramEntity,
  UniversityEntity
} from "../db/entities.js";

const emptyLocalizedArray = (): LocalizedStringArray => ({ en: [], ms: [], "zh-CN": [], "zh-TW": [] });

function toDateString(value: Date | string | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

function normalizeSourceLink(item: OfficialSourceLink): OfficialSourceLink {
  return {
    title: item.title || item.url,
    url: item.url,
    sourceType: item.sourceType || "other",
    verifiedAt: item.verifiedAt ?? null,
    status: item.status,
    note: item.note ?? null
  };
}

function normalizeSourceLinks(value: OfficialSourceLink[] | null | undefined): OfficialSourceLink[] {
  return Array.isArray(value)
    ? value.filter((item) => Boolean(item?.url)).map(normalizeSourceLink)
    : [];
}

function appendSourceLink(items: OfficialSourceLink[], link: OfficialSourceLink): OfficialSourceLink[] {
  if (!link.url || items.some((item) => item.url === link.url)) return items;
  return [...items, normalizeSourceLink(link)];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeQsRankStatus(value: unknown): QsWorldRankStatus {
  return value === "ranked" ? "ranked" : "not-ranked";
}

function normalizeQsRankContext(value: unknown): QsWorldRankContext {
  return value === "malaysia-institution" || value === "parent-institution" ? value : "not-ranked";
}

function extractQsWorldRanking(entity: UniversityEntity) {
  const profile = asRecord(entity.officialProfile);
  const rankings = asRecord(profile.rankings);
  const qsWorld = asRecord(rankings.qsWorld);
  return {
    qsRankDisplay: normalizeQsRankDisplay(entity.qsRank, optionalString(qsWorld.rankDisplay)),
    qsRankYear: optionalNumber(qsWorld.year) || QS_WORLD_RANKING_YEAR,
    qsRankStatus: normalizeQsRankStatus(qsWorld.status),
    qsRankContext: normalizeQsRankContext(qsWorld.context),
    qsRankSourceUrl: optionalString(qsWorld.sourceUrl)
  };
}

export function normalizePublicDisplayStatus(status?: PublicDisplayStatus | null, isPublished = true): PublicDisplayStatus {
  if (!isPublished && (!status || status === "ready")) return "hidden-unverified";
  return status || "ready";
}

export function isReadyForPublicCatalog(entity: { isPublished: boolean; publicDisplayStatus?: PublicDisplayStatus | null }) {
  return entity.isPublished && normalizePublicDisplayStatus(entity.publicDisplayStatus, entity.isPublished) === "ready";
}

export function isVisibleInPublicCatalog(entity: { isPublished: boolean; publicDisplayStatus?: PublicDisplayStatus | null }) {
  if (!entity.isPublished) return false;
  const status = normalizePublicDisplayStatus(entity.publicDisplayStatus, entity.isPublished);
  return status === "ready" ||
    status === "current-cycle-not-open" ||
    status === "official-language-requirement-not-published" ||
    status === "not-available-for-international";
}

export function mapUniversity(entity: UniversityEntity): UniversityListItem {
  const officialWebsite = entity.officialWebsite || entity.website;
  const qsWorldRanking = extractQsWorldRanking(entity);
  let officialSources = normalizeSourceLinks(entity.officialSources);
  officialSources = appendSourceLink(officialSources, {
    title: "Official website",
    url: officialWebsite,
    sourceType: "official-website",
    verifiedAt: toDateString(entity.officialVerifiedAt),
    status: entity.officialSourceStatus || "needs-review",
    note: null
  });

  return {
    id: entity.id,
    slug: entity.slug,
    code: entity.code,
    name: entity.name,
    shortName: entity.shortName,
    nameEn: entity.name.en,
    logoUrl: localizeUniversityLogoUrl(entity.logoUrl, entity.code),
    imageUrl: localizeUniversityImageUrl(entity.imageUrl, entity.code),
    color: entity.color,
    qsRank: entity.qsRank,
    ...qsWorldRanking,
    qsAsiaRank: entity.qsAsiaRank,
    location: entity.location,
    region: entity.region,
    ownership: entity.ownership,
    institutionType: entity.institutionType,
    foundedYear: entity.foundedYear,
    students: entity.students,
    intlStudents: entity.intlStudents,
    csrCertified: entity.csrCertified,
    description: entity.description,
    website: entity.website,
    admissionEmail: entity.admissionEmail,
    nameEnOfficial: entity.nameEnOfficial || entity.name.en,
    officialWebsite,
    studyPortalUrl: entity.studyPortalUrl || "",
    internationalPageUrl: entity.internationalPageUrl || "",
    applicationPortalUrl: entity.applicationPortalUrl || "",
    officialAddress: entity.officialAddress || "",
    applicationPeriods: entity.applicationPeriods || [],
    applicationFees: entity.applicationFees || [],
    applicationDocuments: entity.applicationDocuments || emptyLocalizedArray(),
    chinaStudentRequirements: entity.chinaStudentRequirements || emptyLocalizedArray(),
    officialProfile: entity.officialProfile || null,
    officialSources,
    officialVerifiedAt: toDateString(entity.officialVerifiedAt),
    officialSourceStatus: entity.officialSourceStatus || "needs-review",
    officialAuditSummary: entity.officialAuditSummary || "",
    publicDisplayStatus: normalizePublicDisplayStatus(entity.publicDisplayStatus, entity.isPublished),
    livingCostOfficialNote: entity.livingCostOfficialNote || "",
    tuitionMinCny: entity.tuitionMinCny,
    tuitionMaxCny: entity.tuitionMaxCny,
    livingCostCny: entity.livingCostCny,
    minIelts: entity.minIelts,
    acceptNoLanguage: entity.acceptNoLanguage,
    facilities: entity.facilities,
    highlights: entity.highlights,
    programCount: entity.programs?.length ?? entity.programCount ?? 0
  };
}

export function mapProgram(entity: ProgramEntity): ProgramListItem {
  const officialFeeAuditStatus: FeeAuditStatus = entity.officialFeeAuditStatus || "pending-review";
  const tuitionCurrency: TuitionCurrency = entity.tuitionCurrency || (entity.officialTuitionMYR ? "MYR" : "CNY");
  const tuitionAmount = entity.tuitionAmount == null ? null : Number(entity.tuitionAmount);
  const feeResolution = resolveProgramFee(entity);
  const tuitionDisplay = feeResolution.displayText;
  const tuitionInfo: TuitionInfo = {
    amount: feeResolution.hasVerifiedFee
      ? (tuitionAmount ?? (tuitionCurrency === "MYR" ? entity.officialTuitionMYR ?? null : feeResolution.filterableTuitionCny ?? entity.annualTuitionCny))
      : null,
    currency: tuitionCurrency,
    displayText: tuitionDisplay,
    filterableTuitionCny: feeResolution.filterableTuitionCny,
    officialAmountMYR: entity.officialTuitionMYR ?? null,
    sourceUrl: entity.officialFeeSourceUrl || null,
    secondarySourceUrl: entity.secondaryOfficialFeeSourceUrl || null,
    auditStatus: officialFeeAuditStatus,
    auditedAt: toDateString(entity.officialFeeAuditedAt),
    note: entity.officialTuitionNote || null
  };
  const requirementInfo: RequirementInfo = {
    language: entity.languageRequirement,
    officialLanguageRequirement: entity.officialLanguageRequirement || null,
    academic: entity.requirement,
    officialAcademicRequirement: entity.officialAcademicRequirement || null,
    chinaStudentRequirement: entity.chinaStudentRequirement || null,
    specialRequirementsNote: entity.specialRequirementsNote || null
  };
  let sourceUrls = normalizeSourceLinks(entity.sourceUrls);
  sourceUrls = appendSourceLink(sourceUrls, {
    title: "Official program page",
    url: entity.officialSourceUrl,
    sourceType: "profile",
    verifiedAt: toDateString(entity.officialVerifiedAt),
    status: entity.officialSourceStatus || "needs-review",
    note: null
  });
  sourceUrls = appendSourceLink(sourceUrls, {
    title: "Official fee source",
    url: entity.officialFeeSourceUrl,
    sourceType: "fee",
    verifiedAt: toDateString(entity.officialFeeAuditedAt),
    status: entity.officialSourceStatus || "needs-review",
    note: entity.officialTuitionNote || null
  });
  sourceUrls = appendSourceLink(sourceUrls, {
    title: "Official entry requirement source",
    url: entity.officialEntryRequirementSourceUrl,
    sourceType: "entry-requirement",
    verifiedAt: toDateString(entity.officialVerifiedAt),
    status: entity.officialSourceStatus || "needs-review",
    note: null
  });
  sourceUrls = appendSourceLink(sourceUrls, {
    title: "Official accreditation source",
    url: entity.officialAccreditationSourceUrl,
    sourceType: "accreditation",
    verifiedAt: toDateString(entity.officialVerifiedAt),
    status: entity.officialSourceStatus || "needs-review",
    note: entity.officialAccreditationNote || null
  });

  return {
    id: entity.id,
    universityId: entity.universityId,
    slug: entity.slug,
    code: entity.code,
    name: entity.name,
    nameEn: entity.name.en,
    nameEnOfficial: entity.nameEnOfficial || entity.name.en,
    level: entity.level,
    category: entity.category,
    faculty: entity.faculty,
    facultyZh: entity.facultyZh || entity.faculty["zh-CN"] || "",
    studyMode: entity.studyMode || "",
    campus: entity.campus || "",
    durationYears: entity.durationYears,
    durationOfficial: entity.durationOfficial || `${Number(entity.durationYears)} years`,
    annualTuitionCny: entity.annualTuitionCny,
    filterableTuitionCny: feeResolution.filterableTuitionCny,
    hasVerifiedFee: feeResolution.hasVerifiedFee,
    feeConfidence: feeResolution.confidence,
    tuitionAmount,
    tuitionCurrency,
    tuitionDisplay,
    officialTuitionMYR: entity.officialTuitionMYR ?? null,
    officialFeeSourceUrl: entity.officialFeeSourceUrl || "",
    secondaryOfficialFeeSourceUrl: entity.secondaryOfficialFeeSourceUrl || "",
    officialFeeAuditStatus,
    officialFeeAuditedAt: toDateString(entity.officialFeeAuditedAt),
    intakeMonths: entity.intakeMonths,
    officialIntake: entity.officialIntake || entity.intakeMonths.join(", "),
    officialIntakeNote: entity.officialIntakeNote || "",
    languageRequirement: entity.languageRequirement,
    officialLanguageRequirement: entity.officialLanguageRequirement || "",
    requirement: entity.requirement,
    officialAcademicRequirement: entity.officialAcademicRequirement || "",
    chinaStudentRequirement: entity.chinaStudentRequirement || "",
    applicationDocs: normalizeProgramDetailLocalizedArray(entity.applicationDocs, "document"),
    curriculum: normalizeProgramDetailLocalizedArray(entity.curriculum, "curriculum"),
    careers: normalizeProgramDetailLocalizedArray(entity.careers, "career"),
    specializations: normalizeProgramDetailLocalizedArray(entity.specializations, "specialization"),
    description: normalizeProgramDetailLocalizedText(entity.description, "description"),
    officialAccreditationNote: entity.officialAccreditationNote || "",
    officialSourceUrl: entity.officialSourceUrl || "",
    officialEntryRequirementSourceUrl: entity.officialEntryRequirementSourceUrl || "",
    officialAccreditationSourceUrl: entity.officialAccreditationSourceUrl || "",
    sourceUrls,
    officialVerifiedAt: toDateString(entity.officialVerifiedAt),
    officialSourceStatus: entity.officialSourceStatus || "needs-review",
    publicDisplayStatus: normalizePublicDisplayStatus(entity.publicDisplayStatus, entity.isPublished),
    publicDisplayNote: entity.publicDisplayNote || "",
    reviewReason: entity.reviewReason || "",
    auditNote: entity.auditNote || "",
    listTuitionText: entity.listTuitionText || tuitionDisplay,
    tuitionInfo,
    requirements: requirementInfo,
    requirementInfo
  };
}

export function mapPlannerProfile(entity?: PlannerProfileEntity | null): PlannerProfile {
  return {
    level: entity?.level ?? "master",
    targetCategory: entity?.targetCategory ?? "it",
    budgetCny: entity?.budgetCny ?? 80000,
    gpa: entity?.gpa ?? 3,
    ielts: entity?.ielts ?? 5.5,
    experience: entity?.experience ?? "0-1 years",
    acceptNoLanguage: entity?.acceptNoLanguage ?? true
  };
}

export function mapPlannerMaterials(entity?: PlannerProfileEntity | null): PlannerMaterialItem[] {
  const profile = mapPlannerProfile(entity);
  const defaults: PlannerMaterialItem[] = [
    {
      key: "passport",
      name: { en: "Passport Scan", ms: "Imbasan Pasport", "zh-CN": "护照首页扫描件", "zh-TW": "護照首頁掃描件" },
      note: { en: "Keep at least 18 months validity.", ms: "Pastikan sah sekurang-kurangnya 18 bulan.", "zh-CN": "建议有效期不少于 18 个月。", "zh-TW": "建議有效期不少於 18 個月。" },
      status: entity?.materialProgress?.passport ?? "done"
    },
    {
      key: "photo",
      name: { en: "Passport Photo", ms: "Foto Pasport", "zh-CN": "白底证件照", "zh-TW": "白底證件照" },
      note: { en: "Use one naming convention across uploads.", ms: "Gunakan format nama fail yang konsisten.", "zh-CN": "建议统一命名上传照片。", "zh-TW": "建議統一命名上傳照片。" },
      status: entity?.materialProgress?.photo ?? "progress"
    },
    {
      key: "transcript",
      name: { en: "Academic Transcript", ms: "Transkrip Akademik", "zh-CN": "成绩单", "zh-TW": "成績單" },
      note: { en: "Prepare English or bilingual versions.", ms: "Sediakan versi Inggeris atau dwibahasa.", "zh-CN": "建议准备英文版或中英双语。", "zh-TW": "建議準備英文版或中英雙語。" },
      status: entity?.materialProgress?.transcript ?? "progress"
    },
    {
      key: "english",
      name: { en: "English Test Report", ms: "Laporan Ujian Bahasa Inggeris", "zh-CN": "英语成绩单", "zh-TW": "英語成績單" },
      note: { en: "You can still shortlist conditional-offer schools before the score is ready.", ms: "Anda masih boleh menyenarai pendek program conditional offer sebelum skor siap.", "zh-CN": "分数未出前也可以先筛选支持 conditional offer 的项目。", "zh-TW": "分數未出前也可以先篩選支持 conditional offer 的項目。" },
      status: entity?.materialProgress?.english ?? "wait"
    }
  ];

  const levelSpecific: PlannerMaterialItem[] = profile.level === "bachelor"
    ? [
        {
          key: "graduation",
          name: { en: "Graduation Certificate", ms: "Sijil Tamat Pengajian", "zh-CN": "高中毕业证明", "zh-TW": "高中畢業證明" },
          note: { en: "Use an enrolment proof if not graduated yet.", ms: "Gunakan surat pengesahan belajar jika belum tamat.", "zh-CN": "未毕业可先用在读证明替代。", "zh-TW": "未畢業可先用在讀證明替代。" },
          status: entity?.materialProgress?.graduation ?? "wait"
        },
        {
          key: "studyplan",
          name: { en: "Personal Statement", ms: "Pernyataan Peribadi", "zh-CN": "个人陈述", "zh-TW": "個人陳述" },
          note: { en: "Explain why Malaysia and why this major.", ms: "Terangkan sebab memilih Malaysia dan program ini.", "zh-CN": "重点说明为什么选择马来西亚和该专业。", "zh-TW": "重點說明為什麼選擇馬來西亞和該專業。" },
          status: entity?.materialProgress?.studyplan ?? "draft"
        }
      ]
    : profile.level === "master" || profile.level === "postgraduate-certificate" || profile.level === "postgraduate-diploma"
      ? [
          {
            key: "degree",
            name: { en: "Degree Certificates", ms: "Sijil Ijazah", "zh-CN": "本科毕业证与学位证", "zh-TW": "本科畢業證與學位證" },
            note: { en: "Keep Chinese and English versions aligned.", ms: "Pastikan versi Cina dan Inggeris konsisten.", "zh-CN": "中英文版本信息需要保持一致。", "zh-TW": "中英文版本資訊需要保持一致。" },
            status: entity?.materialProgress?.degree ?? "progress"
          },
          {
            key: "studyplan",
            name: { en: "Study Plan", ms: "Pelan Pengajian", "zh-CN": "学习计划 / 个人陈述", "zh-TW": "學習計畫 / 個人陳述" },
            note: { en: "Show academic fit and career goals.", ms: "Jelaskan kesesuaian akademik dan matlamat kerjaya.", "zh-CN": "重点体现学术匹配和职业目标。", "zh-TW": "重點體現學術匹配和職業目標。" },
            status: entity?.materialProgress?.studyplan ?? "draft"
          },
          {
            key: "recommendation",
            name: { en: "Recommendation Letters", ms: "Surat Rujukan", "zh-CN": "推荐信", "zh-TW": "推薦信" },
            note: { en: "Academic referees are preferred.", ms: "Pensyarah atau penyelia akademik lebih diutamakan.", "zh-CN": "优先使用学术导师或直属上级。", "zh-TW": "優先使用學術導師或直屬上級。" },
            status: entity?.materialProgress?.recommendation ?? "wait"
          }
        ]
      : [
          {
            key: "master-degree",
            name: { en: "Master's Degree Package", ms: "Dokumen Ijazah Sarjana", "zh-CN": "硕士阶段完整材料", "zh-TW": "碩士階段完整材料" },
            note: { en: "Include transcript and degree certificate.", ms: "Sertakan transkrip dan sijil sarjana.", "zh-CN": "需包含成绩单与学位证明。", "zh-TW": "需包含成績單與學位證明。" },
            status: entity?.materialProgress?.["master-degree"] ?? "progress"
          },
          {
            key: "research-plan",
            name: { en: "Research Proposal", ms: "Cadangan Penyelidikan", "zh-CN": "研究计划书", "zh-TW": "研究計畫書" },
            note: { en: "Keep the topic and supervisor direction specific.", ms: "Pastikan topik dan arah penyelia jelas.", "zh-CN": "建议聚焦明确主题和导师方向。", "zh-TW": "建議聚焦明確主題和導師方向。" },
            status: entity?.materialProgress?.["research-plan"] ?? "draft"
          }
        ];

  return defaults.concat(levelSpecific);
}

export function mapPlannerTasks(tasks: PlannerTaskEntity[]): PlannerApplicationItem[] {
  return tasks.map((task) => ({
    id: task.id,
    universityId: task.universityId,
    programId: task.programId,
    tier: task.tier,
    stage: task.stage,
    progress: task.progress,
    deadlineNote: task.deadlineNote,
    nextAction: task.nextAction
  }));
}

export function mapVisaChecklist(entity?: PlannerProfileEntity | null): PlannerVisaChecklist {
  return entity?.visaChecklist ?? {
    offerAccepted: false,
    depositPaid: false,
    visaDocsReady: false,
    preDeparture: false,
    arrivalReady: false
  };
}

export function mapContentBlock(entity: ContentBlockEntity) {
  return {
    id: entity.id,
    key: entity.key,
    title: entity.title,
    body: entity.body
  };
}

export function buildRecommendation(
  university: UniversityEntity,
  program: ProgramEntity,
  score: number,
  reasons: RecommendationResult["reasons"]
): RecommendationResult {
  const filterableTuitionCny = getFilterableTuitionCny(program);
  return {
    score,
    reasons,
    university: mapUniversity(university),
    program: mapProgram(program),
    annualCostCny: filterableTuitionCny == null ? null : filterableTuitionCny + university.livingCostCny
  };
}

export function textContains(value: UniversityEntity | ProgramEntity, search: string): boolean {
  const query = search.toLowerCase();
  const source = JSON.stringify(value).toLowerCase();
  return source.includes(query);
}
