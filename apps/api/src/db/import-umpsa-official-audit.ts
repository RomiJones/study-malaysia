import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, type DeepPartial, type EntityManager } from "typeorm";
import type {
  FeeAuditStatus,
  LanguageRequirement,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  OfficialSourceStatus,
  ProgramCategoryCode,
  PublicDisplayStatus,
  TuitionCurrency
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const umpsaImportDir = resolve(repositoryRoot, "data/imports/umpsa/2026-06-28/all-level-publication");

export const UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX = "umpsa-public-20260628-";
export const DEFAULT_UMPSA_UNDERGRADUATE_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/UMPSA_audit_undergraduate_20260627_reviewed_v8.json"
);
export const DEFAULT_UMPSA_MASTER_AUDIT_PATH = resolve(repositoryRoot, "audits/UMPSA_audit_master_20260628_reviewed_v4.json");
export const DEFAULT_UMPSA_DOCTORAL_AUDIT_PATH = resolve(repositoryRoot, "audits/UMPSA_audit_doctoral_20260628_reviewed_v1.json");
export const DEFAULT_UMPSA_PUBLISH_PLAN_PATH = resolve(umpsaImportDir, "01_publish_plan.json");
export const DEFAULT_UMPSA_POST_IMPORT_AUDIT_PATH = resolve(umpsaImportDir, "02_post_import_audit.json");
export const DEFAULT_UMPSA_RELEASE_REPORT_PATH = resolve(umpsaImportDir, "03_release_report.md");

const verifiedAt = "2026-06-28";
const myrToCny = 1.55;
const expectedProgrammes = 58;
const expectedByLevel = { bachelor: 34, master: 19, phd: 5 } as const;
const publicCatalogProgramStatuses = ["ready", "current-cycle-not-open", "not-available-for-international"] as const;
const officialWebsite = "https://www.umpsa.edu.my/en";
const programmeCatalogueUrl = "https://admission.umpsa.edu.my/international-programme-offered";
const internationalStudentPageUrl = "https://admission.umpsa.edu.my/undergraduate/international-student-2";
const postgraduateAdmissionUrl = "https://ips.umpsa.edu.my/index.php/en/ips-offer/admission-information";
const postgraduateFeesUrl = "https://ips.umpsa.edu.my/index.php/en/ips-offer/fees";
const feePageUrl = "https://bendahari.umpsa.edu.my/index.php/en/component/sppagebuilder/?view=page&id=249";
const applicationPortalUrl = "https://application.umpsa.edu.my/";
const postgraduateApplicationPortalUrl = "https://ipsonline.ump.edu.my/ipsonline/admission_v2/";
const universitySlug = "universiti-malaysia-pahang-al-sultan-abdullah-umpsa";

type UmpsaAuditLevel = "undergraduate" | "master" | "doctoral";
type UmpsaDegreeLevel = "bachelor" | "master" | "phd";

interface UmpsaEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface UmpsaAuditProgramme {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: UmpsaAuditLevel;
  duration: number | null;
  tuitionMYR: number | null;
  tuitionNote: string | null;
  intake: number[];
  applicationDeadline: string | null;
  language: {
    ielts: number | null;
    toefl?: number | null;
    pte?: number | null;
    muet?: number | null;
    otherRequirement?: string | null;
    waiver?: string | null;
  };
  curriculum: string[];
  curriculumNote: string | null;
  careerProspects: string[];
  applicationDocs?: string[];
  officialFeeSourceUrl: string | null;
  officialSourceUrl: string;
  officialVerifiedAt: string;
  entryRequirement: UmpsaEntryRequirement;
  studyMode: string | null;
  studyModeNote: string | null;
  thesisRequired: boolean | null;
  thesisNote: string | null;
  interviewRequired: string | boolean | null;
  interviewNote: string | null;
  supervisorSystem: boolean | null;
  creditHours: number | null;
  publicDisplayStatus: PublicDisplayStatus;
  auditStatus: string;
  fieldStatus?: Record<string, { status?: string; note?: string; sourceUrl?: string; crawlLevel?: string }>;
  fieldEvidence?: Record<string, unknown>;
  crawlLog?: Record<string, unknown>;
  _validationResult?: string;
  _validationIssues?: unknown[];
  _pendingIssues?: unknown[];
}

interface UmpsaReviewedAudit {
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  auditMeta?: {
    targetUniversityShortName?: string;
    targetLevel?: UmpsaAuditLevel;
    targetUniversity?: string;
    officialDomain?: string;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
  };
  sourceRegistry?: unknown;
  programmes: UmpsaAuditProgramme[];
  pending_issues?: unknown[];
  exception_queue?: Array<Record<string, unknown>>;
  validationMeta?: {
    overallDecision?: string;
    reviewVersion?: number;
    counts?: {
      totalProgrammesValidated?: number;
      issuesPending?: number;
    };
    qualityRuleCandidates?: string[];
  };
  repair_log?: unknown[];
}

interface UmpsaAuditInputSet {
  undergraduate: UmpsaReviewedAudit;
  master: UmpsaReviewedAudit;
  doctoral: UmpsaReviewedAudit;
}

interface UmpsaImportSummary {
  importRows: number;
  byLevel: Record<UmpsaDegreeLevel, number>;
  readyRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialFeeRows: number;
  languageRows: number;
  chineseNameRows: number;
  chineseFacultyRows: number;
  chineseCurriculumRows: number;
  chineseCareerRows: number;
  englishPublicTextRows: number;
  sourceRows: number;
  officialUnpublishedCurriculumRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface UmpsaVerification extends UmpsaImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  activeSupersededRows: number;
  legacyVisibleRows: number;
  visibleCurrentRows: number;
}

const t = (en: string, ms = en, zhCN = en, zhTW = zhCN): LocalizedText => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], ms = en, zhCN = en, zhTW = zhCN): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

const englishApplicationDocs = [
  "Submit the UMPSA international application through the official undergraduate admission channel or IPS Online postgraduate portal.",
  "Submit passport biodata pages and required identity documents.",
  "Submit certified academic certificates and transcripts; documents not issued in English require English translation.",
  "Submit official English-language evidence such as IELTS, TOEFL, PTE, MUET or other accepted routes where applicable.",
  "Complete the UMPSA Health Examination Form and EMGS/student-pass process after offer instructions.",
  "Provide additional documents requested by UMPSA or EMGS for the selected intake."
];

const chineseApplicationDocs = [
  "通过 UMPSA 国际本科招生通道或 IPS Online 研究生申请系统提交申请",
  "提交护照首页及所需身份证明文件",
  "提交经认证的学历证书和成绩单；非英文材料需附英文翻译",
  "按要求提交 IELTS、TOEFL、PTE、MUET 或其他认可英语能力证明",
  "收到录取说明后完成 UMPSA Health Examination Form 健康检查表及 EMGS/学生签证流程",
  "按 UMPSA 或 EMGS 要求补交对应入学批次的其他材料"
];

export function validateUmpsaReviewedAudit(audit: UmpsaReviewedAudit, expectedCount: number = expectedByLevel.bachelor, targetLevel: UmpsaAuditLevel = "undergraduate"): string[] {
  const errors: string[] = [];
  if (audit.safe_to_import !== false) errors.push("safe_to_import must remain false.");
  if (audit.import_approved_by != null || audit.import_approved_at != null) errors.push("import approval fields must remain null.");
  if (audit.auditMeta?.targetUniversityShortName !== "UMPSA") errors.push("targetUniversityShortName must be UMPSA.");
  if (audit.auditMeta?.targetLevel !== targetLevel) errors.push(`targetLevel must be ${targetLevel}.`);
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedCount) errors.push(`${targetLevel}: baseline must be ${expectedCount}.`);
  if (audit.auditMeta?.totalProgrammesCollected !== expectedCount) errors.push(`${targetLevel}: collected count must be ${expectedCount}.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
    errors.push(`${targetLevel}: expected ${expectedCount} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if ((audit.pending_issues || []).length !== 0) errors.push("pending_issues must be empty.");
  if (!["PASS", "PASS-WITH-EXCEPTIONS"].includes(String(audit.validationMeta?.overallDecision || ""))) {
    errors.push("validationMeta.overallDecision must be PASS or PASS-WITH-EXCEPTIONS.");
  }
  if (audit.validationMeta?.counts?.totalProgrammesValidated !== expectedCount) {
    errors.push(`${targetLevel}: validation totalProgrammesValidated must be ${expectedCount}.`);
  }
  if (audit.validationMeta?.counts?.issuesPending !== 0) errors.push("validation issuesPending must be 0.");

  for (const [index, issue] of (audit.exception_queue || []).entries()) {
    const status = String(issue.status || "");
    const severity = String(issue.severity || "");
    if (status === "open" && severity === "high") errors.push(`exception_queue ${index + 1}: high severity open issue must be resolved.`);
  }

  const seenNames = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `${targetLevel} ${index + 1} ${programme.nameEn || "unknown"}`;
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (seenNames.has(programme.nameEn)) errors.push(`${row}: duplicate programme name.`);
    seenNames.add(programme.nameEn);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn || !programme.name.includes(`（${programme.nameEn}）`)) {
      errors.push(`${row}: Chinese bilingual programme name is required.`);
    }
    if (programme.level !== targetLevel) errors.push(`${row}: level must be ${targetLevel}.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) errors.push(`${row}: Chinese faculty is required.`);
    if (!officialUmpsaUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be UMPSA official URL.`);
    if (!programme.officialFeeSourceUrl || !officialUmpsaUrl(programme.officialFeeSourceUrl)) {
      errors.push(`${row}: officialFeeSourceUrl must be UMPSA official URL.`);
    }
    if (programme.publicDisplayStatus !== "ready") errors.push(`${row}: publicDisplayStatus must be ready.`);
    if (programme.auditStatus !== "official-verified-commercial-ready") errors.push(`${row}: auditStatus must be official-verified-commercial-ready.`);
    if (programme._pendingIssues?.length) errors.push(`${row}: _pendingIssues must be empty.`);
    if (typeof programme.duration !== "number" || programme.duration <= 0) errors.push(`${row}: duration must be positive number.`);
    if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: tuitionMYR must be positive number.`);
    if (!Array.isArray(programme.intake) || programme.intake.length === 0 || programme.intake.some((month) => month < 1 || month > 12)) {
      errors.push(`${row}: intake must be valid month numbers.`);
    }
    if (!programme.language || typeof programme.language.ielts !== "number" || programme.language.ielts <= 0) {
      errors.push(`${row}: IELTS list score is required.`);
    }
    const languageEvidence = asRecord(programme.fieldEvidence?.language);
    const languageIelts = asNumberOrNull(programme.language?.ielts);
    const directIeltsValue = asNumberOrNull(languageEvidence.directIeltsValue);
    const reviewedListIeltsValue = asNumberOrNull(languageEvidence.reviewedListIeltsValue);
    const matchesDirectIelts = directIeltsValue != null && directIeltsValue === languageIelts;
    const matchesReviewedIelts = reviewedListIeltsValue != null && reviewedListIeltsValue === languageIelts;
    if (!matchesDirectIelts && !matchesReviewedIelts) {
      errors.push(`${row}: IELTS must match direct official IELTS evidence or reviewed public-list calibration.`);
    }
    if (matchesReviewedIelts && !matchesDirectIelts) {
      const ieltsDisplayPolicy = String(languageEvidence.ieltsDisplayPolicy || "");
      const ieltsFieldStatus = String(programme.fieldStatus?.["language.ielts"]?.status || "");
      if (ieltsDisplayPolicy !== "calibrated-equivalent-for-public-list") {
        errors.push(`${row}: reviewed IELTS calibration requires calibrated-equivalent-for-public-list evidence policy.`);
      }
      if (ieltsFieldStatus !== "calibrated-from-equivalent-official-scores") {
        errors.push(`${row}: reviewed IELTS calibration requires calibrated-from-equivalent-official-scores fieldStatus.`);
      }
    }
    if (programme.language?.ielts === programme.language?.muet && [3, 4].includes(Number(programme.language?.ielts))) {
      errors.push(`${row}: IELTS appears to be copied from MUET.`);
    }

    const curriculumOfficiallyUnpublished =
      programme.fieldStatus?.curriculum?.status === "official-unpublished" ||
      /官网未公布|official-unpublished/i.test(programme.curriculumNote || "");
    if (programme.curriculum.length === 0 && !curriculumOfficiallyUnpublished) {
      errors.push(`${row}: empty curriculum requires official-unpublished status.`);
    }
    if (programme.curriculum.length > 0 && !programme.curriculum.every(hasChinese)) {
      errors.push(`${row}: Chinese curriculum array is required.`);
    }
    const careerOfficiallyUnpublished =
      programme.fieldStatus?.careerProspects?.status === "official-unpublished" ||
      /官网未公布|official-unpublished/i.test(String(programme.fieldStatus?.careerProspects?.note || ""));
    if (programme.careerProspects.length === 0 && !careerOfficiallyUnpublished) {
      errors.push(`${row}: empty careerProspects requires official-unpublished status.`);
    }
    if (programme.careerProspects.length > 0 && !programme.careerProspects.every(hasChinese)) {
      errors.push(`${row}: Chinese career array is required.`);
    }
    if (!Array.isArray(programme.applicationDocs) || programme.applicationDocs.length === 0 || !programme.applicationDocs.every(hasChinese)) {
      errors.push(`${row}: Chinese applicationDocs array is required.`);
    }
  }
  return errors;
}

export function loadUmpsaReviewedAudit(path = DEFAULT_UMPSA_UNDERGRADUATE_AUDIT_PATH): UmpsaReviewedAudit {
  return loadJson<UmpsaReviewedAudit>(path);
}

export function loadUmpsaReviewedAudits(paths: {
  undergraduatePath?: string;
  masterPath?: string;
  doctoralPath?: string;
} = {}): UmpsaAuditInputSet {
  return {
    undergraduate: loadJson<UmpsaReviewedAudit>(paths.undergraduatePath || DEFAULT_UMPSA_UNDERGRADUATE_AUDIT_PATH),
    master: loadJson<UmpsaReviewedAudit>(paths.masterPath || DEFAULT_UMPSA_MASTER_AUDIT_PATH),
    doctoral: loadJson<UmpsaReviewedAudit>(paths.doctoralPath || DEFAULT_UMPSA_DOCTORAL_AUDIT_PATH)
  };
}

export function buildUmpsaOfficialAuditRows(audits: UmpsaAuditInputSet): Array<DeepPartial<ProgramEntity>> {
  const programmes = [
    ...audits.undergraduate.programmes,
    ...audits.master.programmes,
    ...audits.doctoral.programmes
  ];
  return programmes.map((programme, index) => buildUmpsaProgrammeRow(programme, index + 1));
}

export function summarizeUmpsaOfficialAuditImport(rows: Array<DeepPartial<ProgramEntity>>): UmpsaImportSummary {
  return {
    importRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length,
      master: rows.filter((row) => row.level === "master").length,
      phd: rows.filter((row) => row.level === "phd").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    languageRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0).length,
    chineseNameRows: rows.filter((row) => hasChinese((row.name as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseFacultyRows: rows.filter((row) => hasChinese((row.faculty as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseCurriculumRows: rows.filter((row) => localizedArrayHasChinese(row.curriculum as LocalizedStringArray | undefined)).length,
    chineseCareerRows: rows.filter((row) => localizedArrayHasChinese(row.careers as LocalizedStringArray | undefined)).length,
    englishPublicTextRows: rows.filter((row) =>
      !hasChinese((row.name as LocalizedText | undefined)?.en || "") &&
      !hasChinese((row.faculty as LocalizedText | undefined)?.en || "") &&
      localizedArrayHasNoChinese(row.curriculum as LocalizedStringArray | undefined, "en") &&
      localizedArrayHasNoChinese(row.careers as LocalizedStringArray | undefined, "en")
    ).length,
    sourceRows: rows.filter((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 3).length,
    officialUnpublishedCurriculumRows: rows.filter((row) =>
      (row.curriculum as LocalizedStringArray | undefined)?.["zh-CN"]?.some((item) => item.includes("官网未公布"))
    ).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function buildUmpsaUniversityRow(
  audits: UmpsaAuditInputSet,
  rows: Array<DeepPartial<ProgramEntity>>,
  existing: UniversityEntity | null = null
): DeepPartial<UniversityEntity> {
  const annualCosts = rows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const ieltsValues = rows.map((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0)).filter((value) => value > 0);

  return {
    slug: existing?.slug || universitySlug,
    code: existing?.code || "UMPSA",
    name: existing?.name || t(
      "Universiti Malaysia Pahang Al-Sultan Abdullah",
      "Universiti Malaysia Pahang Al-Sultan Abdullah",
      "彭亨苏丹阿都拉大学",
      "彭亨蘇丹阿都拉大學"
    ),
    shortName: existing?.shortName || "UMPSA",
    logoUrl: existing?.logoUrl || "/assets/static-html/university-logos/umpsa-universiti-malaysia-pahang-al-sultan-abdullah-umpsa-f57438f553.png",
    imageUrl: existing?.imageUrl || "/assets/static-html/university-covers/umpsa-universiti-malaysia-pahang-al-sultan-abdullah-umpsa-4a05c82caf.webp",
    color: existing?.color || "#0F766E",
    qsRank: existing?.qsRank || 781,
    qsAsiaRank: existing?.qsAsiaRank ?? null,
    location: t("Pahang, Malaysia", "Pahang, Malaysia", "马来西亚彭亨州", "馬來西亞彭亨州"),
    region: t("Pahang", "Pahang", "彭亨", "彭亨"),
    ownership: existing?.ownership || "public",
    institutionType: existing?.institutionType || "applied",
    foundedYear: existing?.foundedYear || 2002,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: t(
      "Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA) is a Malaysian public technical university with audited bachelor, master and doctoral programmes across engineering, engineering technology, computing, industrial sciences, management and research pathways.",
      "Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA) is a Malaysian public technical university with audited bachelor, master and doctoral programmes across engineering, engineering technology, computing, industrial sciences, management and research pathways.",
      "彭亨苏丹阿都拉大学（UMPSA）是马来西亚公立技术大学，本次上线数据覆盖已审计的本科、硕士和博士专业，领域包括工程、工程技术、计算机、工业科学、管理与研究型路径。",
      "彭亨蘇丹阿都拉大學（UMPSA）是馬來西亞公立技術大學，本次上線數據覆蓋已審計的本科、碩士和博士專業，領域包括工程、工程技術、電腦、工業科學、管理與研究型路徑。"
    ),
    website: officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: "Universiti Malaysia Pahang Al-Sultan Abdullah",
    officialWebsite,
    studyPortalUrl: programmeCatalogueUrl,
    internationalPageUrl: internationalStudentPageUrl,
    applicationPortalUrl,
    officialAddress: existing?.officialAddress || "Universiti Malaysia Pahang Al-Sultan Abdullah, Pahang, Malaysia",
    applicationPeriods: existing?.applicationPeriods || [],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: arr(englishApplicationDocs, englishApplicationDocs, chineseApplicationDocs, chineseApplicationDocs),
    chinaStudentRequirements: arr(
      ["UMPSA official audit sources did not publish a separate China-specific equivalency route; applicants follow the international admission process and programme entry requirements."],
      ["UMPSA official audit sources did not publish a separate China-specific equivalency route; applicants follow the international admission process and programme entry requirements."],
      ["本轮 UMPSA 官方审计来源未单独公布中国学生学历等效路径；申请按国际招生流程和各专业入学要求评估。"],
      ["本輪 UMPSA 官方審計來源未單獨公布中國學生學歷等效路徑；申請按國際招生流程和各專業入學要求評估。"]
    ),
    officialProfile: {
      ...asRecord(existing?.officialProfile),
      umpsaAllLevelPublication: {
        sourceAudits: {
          undergraduate: relative(repositoryRoot, DEFAULT_UMPSA_UNDERGRADUATE_AUDIT_PATH),
          master: relative(repositoryRoot, DEFAULT_UMPSA_MASTER_AUDIT_PATH),
          doctoral: relative(repositoryRoot, DEFAULT_UMPSA_DOCTORAL_AUDIT_PATH)
        },
        publishedAt: new Date().toISOString(),
        verifiedAt,
        programmes: rows.length,
        byLevel: expectedByLevel,
        publicationHardGate: "passed",
        officialUnpublishedCurriculumRows: rows.filter((row) =>
          (row.curriculum as LocalizedStringArray | undefined)?.["zh-CN"]?.some((item) => item.includes("官网未公布"))
        ).length,
        qualityRuleCandidates: [
          ...(audits.undergraduate.validationMeta?.qualityRuleCandidates || []),
          ...(audits.master.validationMeta?.qualityRuleCandidates || []),
          ...(audits.doctoral.validationMeta?.qualityRuleCandidates || [])
        ],
        exceptions: [
          ...(audits.undergraduate.exception_queue || []),
          ...(audits.master.exception_queue || []),
          ...(audits.doctoral.exception_queue || [])
        ]
      }
    },
    officialSources: buildUmpsaUniversitySourceLinks(audits),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: "UMPSA bachelor, master and doctoral programmes are published from UMPSA official admission, IPS, faculty, finance, open-intake and application sources. Public list fields pass StudyMY hard gates: Chinese bilingual programme name, Chinese faculty, reviewed IELTS list score, single official international tuition amount and numeric duration years.",
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: annualCosts.length ? Math.min(...annualCosts) : existing?.tuitionMinCny || 0,
    tuitionMaxCny: annualCosts.length ? Math.max(...annualCosts) : existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 24000,
    minIelts: ieltsValues.length ? Math.min(...ieltsValues) : existing?.minIelts || 0,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr(
      ["Public technical university campuses in Pahang", "Engineering and technology learning facilities", "Computing and industrial management academic units", "International undergraduate admission channel"],
      ["Public technical university campuses in Pahang", "Engineering and technology learning facilities", "Computing and industrial management academic units", "International undergraduate admission channel"],
      ["彭亨州公立技术大学校区", "工程与技术学习设施", "计算机与工业管理教学单位", "国际本科招生通道"],
      ["彭亨州公立技術大學校區", "工程與技術學習設施", "電腦與工業管理教學單位", "國際本科招生通道"]
    ),
    highlights: arr(
      ["Official UMPSA bachelor, master and doctoral catalogue", "Official international student fee evidence", "Engineering, technology, computing, science, management and research coverage"],
      ["Official UMPSA bachelor, master and doctoral catalogue", "Official international student fee evidence", "Engineering, technology, computing, science, management and research coverage"],
      ["UMPSA 官方本硕博目录", "官方国际学生学费证据", "工程、技术、计算机、科学、管理与研究型项目覆盖"],
      ["UMPSA 官方本碩博目錄", "官方國際學生學費證據", "工程、技術、電腦、科學、管理與研究型項目覆蓋"]
    ),
    programCount: rows.length,
    isPublished: true
  };
}

export function verifyUmpsaAllLevelPublicRecordSet(
  university: UniversityEntity,
  publicRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): UmpsaVerification {
  const summary = summarizeUmpsaOfficialAuditImport(publicRows);
  const activeSupersededRows = allUniversityRows.filter((row) =>
    !row.slug.startsWith(UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  );
  const visibleCurrentRows = publicRows.filter((row) =>
    row.isPublished &&
    row.publicDisplayStatus === "ready" &&
    row.slug.startsWith(UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX)
  ).length;

  if (
    publicRows.length !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedByLevel.bachelor ||
    summary.byLevel.master !== expectedByLevel.master ||
    summary.byLevel.phd !== expectedByLevel.phd ||
    summary.readyRows !== expectedProgrammes ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== expectedProgrammes ||
    summary.languageRows !== expectedProgrammes ||
    summary.chineseNameRows !== expectedProgrammes ||
    summary.chineseFacultyRows !== expectedProgrammes ||
    summary.chineseCurriculumRows !== expectedProgrammes ||
    summary.chineseCareerRows !== expectedProgrammes ||
    summary.englishPublicTextRows !== expectedProgrammes ||
    summary.sourceRows !== expectedProgrammes ||
    visibleCurrentRows !== expectedProgrammes ||
    activeSupersededRows.length !== 0 ||
    legacyVisibleRows.length !== 0 ||
    university.publicDisplayStatus !== "ready" ||
    !university.isPublished ||
    university.programCount !== expectedProgrammes
  ) {
    throw new Error(`UMPSA all-level public verification failed: ${JSON.stringify({
      summary,
      activeSupersededRows: activeSupersededRows.map((row) => row.slug),
      legacyVisibleRows: legacyVisibleRows.map((row) => row.slug),
      visibleCurrentRows,
      universityStatus: university.publicDisplayStatus,
      universityPublished: university.isPublished,
      universityProgramCount: university.programCount
    })}`);
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    activeSupersededRows: activeSupersededRows.length,
    legacyVisibleRows: legacyVisibleRows.length,
    visibleCurrentRows
  };
}

function buildUmpsaProgrammeRow(programme: UmpsaAuditProgramme, ordinal: number): DeepPartial<ProgramEntity> {
  const level = mapUmpsaLevel(programme.level);
  const tuitionMYR = programme.tuitionMYR || 0;
  const durationYears = programme.duration || 1;
  const code = `UMPSA-${level.toUpperCase()}-${String(ordinal).padStart(3, "0")}`;
  const sourceUrls = buildUmpsaProgrammeSourceLinks(programme);
  const curriculumZh = displayCurriculumZh(programme);
  const curriculumEn = displayCurriculumEn(programme);
  const careerZh = programme.careerProspects.length ? programme.careerProspects : ["官网未公布具体职业方向"];
  const careerEn = englishListFromEvidence(programme, "careerProspects", "career prospects");

  return {
    slug: `${UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
    code,
    name: t(programme.nameEn, programme.nameEn, programme.name, programme.name),
    nameEnOfficial: programme.nameEn,
    level,
    category: inferCategory(programme.nameEn, programme.faculty),
    faculty: t(programme.faculty, programme.faculty, programme.facultyZh || programme.faculty, programme.facultyZh || programme.faculty),
    facultyZh: programme.facultyZh || "",
    studyMode: normalizeText(programme.studyMode || "full-time", 80),
    campus: inferCampus(programme),
    durationYears,
    durationOfficial: `${formatNumber(durationYears)} ${durationYears === 1 ? "year" : "years"}`,
    annualTuitionCny: Math.round((tuitionMYR * myrToCny) / Math.max(durationYears, 0.5)),
    tuitionAmount: tuitionMYR,
    tuitionCurrency: "MYR" satisfies TuitionCurrency,
    tuitionDisplay: `RM ${formatNumber(tuitionMYR)}`,
    officialTuitionMYR: Math.round(tuitionMYR),
    officialTuitionNote: normalizeLongText(programme.tuitionNote || "UMPSA official international student tuition from the programme or official fee source."),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || programme.officialSourceUrl,
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official" satisfies FeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: intakeMonthNames(programme.intake),
    officialIntake: intakeMonthNames(programme.intake).join(", "),
    officialIntakeNote: programme.applicationDeadline
      ? normalizeLongText(`Application timing: ${programme.applicationDeadline}`)
      : "UMPSA official international undergraduate intake evidence is captured in the reviewed audit.",
    languageRequirement: buildLanguage(programme),
    officialLanguageRequirement: buildLanguageText(programme),
    requirement: {
      gpa: programme.entryRequirement?.minGPA || 0,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: t(
        buildAcademicRequirement(programme),
        buildAcademicRequirement(programme),
        buildAcademicRequirementZh(programme),
        buildAcademicRequirementZh(programme)
      )
    },
    officialAcademicRequirement: buildAcademicRequirement(programme),
    chinaStudentRequirement: "UMPSA 本轮官方本科审计未单独公布中国学生学历等效路径；按国际招生流程和专业入学要求评估。",
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: arr(englishApplicationDocs, englishApplicationDocs, programme.applicationDocs || chineseApplicationDocs, programme.applicationDocs || chineseApplicationDocs),
    curriculum: arr(curriculumEn, curriculumEn, curriculumZh, curriculumZh),
    careers: arr(careerEn, careerEn, careerZh, careerZh),
    specializations: arr([]),
    description: t(
      `${programme.nameEn} is published from UMPSA official ${programme.level} audit evidence, including programme, fee, admission and language sources.`,
      `${programme.nameEn} is published from UMPSA official ${programme.level} audit evidence, including programme, fee, admission and language sources.`,
      `${programme.name} 已按 UMPSA 官方${levelLabelZh(programme.level)}审计证据公开展示，来源覆盖专业页、费用、招生和语言要求。`,
      `${programme.name} 已按 UMPSA 官方${levelLabelZh(programme.level)}審計證據公開展示，來源覆蓋專業頁、費用、招生和語言要求。`
    ),
    officialAccreditationNote: null,
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: programme.officialSourceUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    publicDisplayNote: "已依据 UMPSA 官方来源完成上线硬门禁校验：中文专业名、中文学院、列表 IELTS、准确国际学生学费和数字学制。",
    reviewReason: null,
    auditNote: normalizeLongText([
      `Published from UMPSA ${programme.level} reviewed audit row ${ordinal}.`,
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || programme.officialSourceUrl}.`,
      programme.curriculumNote || "",
      programme.studyModeNote || "",
      ...(programme._validationIssues || []).map((item) => String(item))
    ].filter(Boolean).join(" ")),
    listTuitionText: `RM ${formatNumber(tuitionMYR)}`,
    isPublished: true
  };
}

async function verifyImportedUmpsaRows(manager: EntityManager | DataSource, universityId: number) {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("UMPSA university row not found during verification.");
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  const publicRows = allUniversityRows.filter((row) =>
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number])
  );
  return verifyUmpsaAllLevelPublicRecordSet(university, publicRows, allUniversityRows);
}

async function runUmpsaPublication(options: {
  undergraduatePath: string;
  masterPath: string;
  doctoralPath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audits = loadUmpsaReviewedAudits(options);
  const validationErrors = [
    ...validateUmpsaReviewedAudit(audits.undergraduate, expectedByLevel.bachelor, "undergraduate"),
    ...validateUmpsaReviewedAudit(audits.master, expectedByLevel.master, "master"),
    ...validateUmpsaReviewedAudit(audits.doctoral, expectedByLevel.phd, "doctoral")
  ];
  if (validationErrors.length) throw new Error(`UMPSA all-level audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildUmpsaOfficialAuditRows(audits);
  const summary = summarizeUmpsaOfficialAuditImport(rows);
  const plan = buildPublishPlan(options, summary, audits);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "umpsa-all-level-dry-run",
      planPath: options.planOutput,
      summary,
      nextStep: "Run npm --workspace @studymy/api run import:umpsa:official-audit -- --confirm-import"
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "UMPSA" } })) ||
      (await universityRepo.findOne({ where: { slug: universitySlug } }));

    if (options.verifyOnly) {
      if (!university) throw new Error("UMPSA university row not found.");
      const verification = await verifyImportedUmpsaRows(dataSource, university.id);
      console.log(JSON.stringify({ mode: "umpsa-all-level-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: universitySlug } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug ${universitySlug} belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/umpsa-all-level-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: UmpsaVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "UMPSA" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: universitySlug } }));

      const universitySeed = buildUmpsaUniversityRow(audits, rows, university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX}%`) }
      });
      for (const previous of previousCurrentRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      const allRows = await txProgramRepo.find({ where: { universityId: university.id } });
      for (const row of allRows) {
        if (!incomingSlugs.has(row.slug)) {
          row.isPublished = false;
          row.publicDisplayStatus = "archived";
          row.publicDisplayNote = "Archived because the UMPSA all-level official publication batch supersedes this legacy or review row.";
          row.reviewReason = normalizeLongText([
            row.reviewReason,
            "Archived by UMPSA all-level official publication; current public display uses umpsa-public-20260628 rows."
          ].filter(Boolean).join(" "));
          await txProgramRepo.save(row);
        }
      }

      const publicVisibleRows = await txProgramRepo.find({
        where: {
          universityId: university.id,
          isPublished: true,
          publicDisplayStatus: In([...publicCatalogProgramStatuses])
        }
      });
      const annualCosts = publicVisibleRows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
      const ieltsValues = publicVisibleRows.map((row) => Number(row.languageRequirement?.ielts || 0)).filter((value) => value > 0);
      university.programCount = publicVisibleRows.length;
      if (annualCosts.length) {
        university.tuitionMinCny = Math.min(...annualCosts);
        university.tuitionMaxCny = Math.max(...annualCosts);
      }
      if (ieltsValues.length) university.minIelts = Math.min(...ieltsValues);
      university = await txUniversityRepo.save(university);
      verification = await verifyImportedUmpsaRows(manager, university.id);
    });

    if (!verification) throw new Error("UMPSA all-level publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    writeJson(options.postImportAuditOutput, buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared));
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "umpsa-all-level-published",
      universityId: university?.id,
      backupPath,
      catalogCacheCleared,
      summary,
      verification,
      artifacts: {
        planPath: options.planOutput,
        postImportAuditPath: options.postImportAuditOutput,
        releaseReportPath: options.releaseReportOutput
      }
    }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

function buildPublishPlan(
  options: { undergraduatePath: string; masterPath: string; doctoralPath: string },
  summary: UmpsaImportSummary,
  audits: UmpsaAuditInputSet
) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "UMPSA",
      shortName: "UMPSA",
      name: "Universiti Malaysia Pahang Al-Sultan Abdullah",
      slug: universitySlug
    },
    authorization: "ian-approved-after-all-level-review",
    sourceInputs: {
      undergraduateAudit: relative(repositoryRoot, options.undergraduatePath),
      masterAudit: relative(repositoryRoot, options.masterPath),
      doctoralAudit: relative(repositoryRoot, options.doctoralPath),
      sourceAuditSafeToImport: false,
      sourceAuditReason: "StudyMY audit JSON stays safe_to_import=false by contract; this importer publishes only after explicit operator command."
    },
    writePolicy: {
      importer: "apps/api/src/db/import-umpsa-official-audit.ts",
      mode: "publish-all-level",
      upsertPrefix: UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
      universityRow: `upsert by code UMPSA or slug ${universitySlug}`,
      programmeRows: "upsert 58 current UMPSA bachelor/master/phd public rows and archive non-current UMPSA rows",
      transactional: true,
      backupRequired: true
    },
    publicationHardGate: {
      result: "passed",
      standard: "docs/prd/StudyMY-official-programme-publication-hard-gate.md",
      rules: [
        "Chinese bilingual programme name",
        "Chinese faculty",
        "reviewed IELTS list score",
        "single official international tuition",
        "numeric duration years",
        "no programme-level pending issues"
      ]
    },
    expectedSurface: {
      programmeCount: expectedProgrammes,
      byLevel: expectedByLevel,
      summary,
      validationMeta: {
        undergraduate: audits.undergraduate.validationMeta,
        master: audits.master.validationMeta,
        doctoral: audits.doctoral.validationMeta
      },
      exceptionQueue: [
        ...(audits.undergraduate.exception_queue || []),
        ...(audits.master.exception_queue || []),
        ...(audits.doctoral.exception_queue || [])
      ]
    }
  };
}

function buildPostImportAudit(
  summary: UmpsaImportSummary,
  verification: UmpsaVerification,
  backupPath: string,
  catalogCacheCleared: boolean
) {
  return {
    schemaVersion: 1,
    mode: "umpsa-all-level-published",
    createdAt: new Date().toISOString(),
    institution: {
      code: "UMPSA",
      name: "Universiti Malaysia Pahang Al-Sultan Abdullah",
      importedRows: summary.importRows,
      byLevel: summary.byLevel
    },
    database: {
      backupPath: relative(repositoryRoot, backupPath),
      transactionalImport: "passed",
      catalogCacheCleared,
      scopedRows: verification.importRows,
      activeSupersededRows: verification.activeSupersededRows,
      legacyVisibleRows: verification.legacyVisibleRows,
      visibleCurrentRows: verification.visibleCurrentRows
    },
    publicVisibility: {
      universityPublicDisplayStatus: verification.universityPublicDisplayStatus,
      universityIsPublished: verification.universityIsPublished,
      universityProgramCount: verification.universityProgramCount,
      rowsPublished: verification.publishedRows,
      rowsReady: verification.readyRows
    },
    displayHardGate: {
      chineseNameRows: verification.chineseNameRows,
      chineseFacultyRows: verification.chineseFacultyRows,
      chineseCurriculumRows: verification.chineseCurriculumRows,
      chineseCareerRows: verification.chineseCareerRows,
      englishPublicTextRows: verification.englishPublicTextRows,
      languageRows: verification.languageRows,
      officialFeeRows: verification.officialFeeRows,
      sourceRows: verification.sourceRows,
      officialUnpublishedCurriculumRows: verification.officialUnpublishedCurriculumRows
    }
  };
}

function buildReleaseReportMarkdown(verification: UmpsaVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# UMPSA All-Level Official Publication Report",
    "",
    "- Decision: published for Ian review",
    "- Scope: Universiti Malaysia Pahang Al-Sultan Abdullah official bachelor, master and doctoral programmes",
    `- Published rows: ${verification.publishedRows}`,
    `- By level: bachelor ${verification.byLevel.bachelor}, master ${verification.byLevel.master}, phd ${verification.byLevel.phd}`,
    `- Ready rows: ${verification.readyRows}`,
    `- Official fee rows: ${verification.officialFeeRows}`,
    `- IELTS rows: ${verification.languageRows}`,
    `- Chinese programme name rows: ${verification.chineseNameRows}`,
    `- Chinese faculty rows: ${verification.chineseFacultyRows}`,
    `- Chinese curriculum/display rows: ${verification.chineseCurriculumRows}`,
    `- Chinese career rows: ${verification.chineseCareerRows}`,
    `- English public text rows without Chinese leakage: ${verification.englishPublicTextRows}`,
    `- Active superseded rows: ${verification.activeSupersededRows}`,
    `- Legacy visible rows: ${verification.legacyVisibleRows}`,
    `- University programCount: ${verification.universityProgramCount}`,
    `- Catalog cache cleared: ${catalogCacheCleared ? "yes" : "not configured"}`,
    `- Backup: ${relative(repositoryRoot, backupPath)}`,
    "",
    "## Hard Gate",
    "",
    "- 中文专业名：通过",
    "- 中文学院：通过",
    "- 列表 IELTS：通过",
    "- 学费为单一官方国际学生费用：通过",
    "- 学制为数字年数：通过",
    "- 无专业级 pending issue：通过",
    "",
    "## Official Sources",
    "",
    `- ${officialWebsite}`,
    `- ${programmeCatalogueUrl}`,
    `- ${internationalStudentPageUrl}`,
    `- ${feePageUrl}`,
    ""
  ].join("\n");
}

function buildUmpsaProgrammeSourceLinks(programme: UmpsaAuditProgramme): OfficialSourceLink[] {
  const urls = new Set([
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || programme.officialSourceUrl,
    programmeCatalogueUrl,
    internationalStudentPageUrl,
    feePageUrl,
    ...urlsFromUnknown(programme.fieldEvidence),
    ...urlsFromUnknown(programme.fieldStatus),
    ...urlsFromUnknown(programme.crawlLog)
  ].filter(Boolean));

  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && officialUmpsaUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url, programme),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: url === (programme.officialFeeSourceUrl || programme.officialSourceUrl)
        ? "UMPSA official source used for the selected international student tuition amount."
        : "Official UMPSA source used for the 2026-06-28 all-level publication audit."
    }));
}

function buildUmpsaUniversitySourceLinks(audits: UmpsaAuditInputSet): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    programmeCatalogueUrl,
    internationalStudentPageUrl,
    postgraduateAdmissionUrl,
    postgraduateFeesUrl,
    feePageUrl,
    applicationPortalUrl,
    postgraduateApplicationPortalUrl,
    ...urlsFromUnknown(audits.undergraduate.sourceRegistry),
    ...urlsFromUnknown(audits.master.sourceRegistry),
    ...urlsFromUnknown(audits.doctoral.sourceRegistry)
  ]);
  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && officialUmpsaUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: "Official UMPSA university/programme source used for all-level publication."
    }));
}

function buildLanguage(programme: UmpsaAuditProgramme): LanguageRequirement {
  return {
    ielts: programme.language?.ielts || 0,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: UmpsaAuditProgramme) {
  const parts = [
    programme.language?.ielts ? `IELTS ${programme.language.ielts}` : "",
    programme.language?.toefl ? `TOEFL ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver ? `Waiver: ${programme.language.waiver}` : ""
  ].filter(Boolean);
  return normalizeLongText(parts.join("; "));
}

function buildAcademicRequirement(programme: UmpsaAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `Degree level: ${requirement.degreeLevel}.` : "",
    requirement.degreeRelevance ? `Degree relevance: ${requirement.degreeRelevance}.` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `Published CGPA threshold: ${requirement.minGPA}/${requirement.gpaScale || 4}.` : "",
    requirement.workExperience ? `Work or experience requirement: ${requirement.workExperience}.` : "",
    "See the official UMPSA admission and programme sources for final equivalency assessment."
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirementZh(programme: UmpsaAuditProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `学历层级：${requirement.degreeLevel}。` : "",
    requirement.degreeRelevance ? `相关背景：${requirement.degreeRelevance}。` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `官方 CGPA 门槛：${requirement.minGPA}/${requirement.gpaScale || 4}。` : "",
    requirement.workExperience ? `工作经验要求：${requirement.workExperience}。` : "",
    "最终等效资格以 UMPSA 官方招生和专业来源审核为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: UmpsaAuditProgramme) {
  return normalizeLongText([
    programme.studyModeNote || "",
    programme.thesisRequired === true ? "Final year project, industrial training or project component applies where required by the programme structure." : "",
    programme.thesisNote || "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.creditHours ? `Credit hours: ${programme.creditHours}.` : ""
  ].filter(Boolean).join(" "));
}

function displayCurriculumZh(programme: UmpsaAuditProgramme) {
  if (programme.curriculum.length) return programme.curriculum;
  return ["官网未公布具体课程结构"];
}

function displayCurriculumEn(programme: UmpsaAuditProgramme) {
  if (!programme.curriculum.length) return ["Official source does not publish a specific curriculum list for this programme."];
  return englishListFromEvidence(programme, "curriculum", "curriculum");
}

function englishListFromEvidence(programme: UmpsaAuditProgramme, field: string, label: string) {
  const evidence = fieldEvidenceValue(programme, field);
  const parts = evidence
    .split(/[;；。]\s*/)
    .map((item) => normalizeText(item, 160))
    .filter((item) => item && !hasChinese(item));
  return parts.length ? parts : [`See the official UMPSA source for ${label} of ${programme.nameEn}.`];
}

function inferCampus(programme: UmpsaAuditProgramme) {
  const text = `${programme.nameEn} ${programme.officialSourceUrl} ${programme.fieldEvidence ? JSON.stringify(programme.fieldEvidence) : ""}`.toLowerCase();
  if (/kuala lumpur/.test(text)) return "UMPSA Kuala Lumpur";
  if (/pekan/.test(text)) return "UMPSA Pekan";
  if (/gambang/.test(text)) return "UMPSA Gambang";
  return "UMPSA official campus";
}

function mapUmpsaLevel(level: UmpsaAuditLevel): UmpsaDegreeLevel {
  if (level === "master") return "master";
  if (level === "doctoral") return "phd";
  return "bachelor";
}

function levelLabelZh(level: UmpsaAuditLevel) {
  if (level === "master") return "硕士";
  if (level === "doctoral") return "博士";
  return "本科";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/business|management|finance|financial|analytics|project/.test(value)) return "business";
  if (/computer|computing|software|cyber|network|multimedia|data/.test(value)) return "it";
  if (/engineering|electrical|electronic|mechanical|mechatronic|automotive|chemical|civil|manufacturing|robotics|petroleum|technology/.test(value)) return "engineering";
  if (/chemistry|biotechnology|material|mathematical|science|safety|health/.test(value)) return "science";
  return "science";
}

function intakeMonthNames(months: number[]) {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (months || []).map((month) => names[month - 1]).filter(Boolean);
}

function sourceLinkTitle(url: string, programme?: UmpsaAuditProgramme) {
  if (url === officialWebsite) return "UMPSA official website";
  if (url === programmeCatalogueUrl) return "UMPSA international programme catalogue";
  if (url === internationalStudentPageUrl) return "UMPSA international undergraduate admission page";
  if (url === postgraduateAdmissionUrl) return "UMPSA IPS postgraduate admission information";
  if (url === postgraduateFeesUrl) return "UMPSA IPS postgraduate fees";
  if (url === feePageUrl) return "UMPSA Bendahari fee page";
  if (url === applicationPortalUrl) return "UMPSA application portal";
  if (url === postgraduateApplicationPortalUrl) return "UMPSA IPS Online application portal";
  if (programme && url === programme.officialSourceUrl) return "Official programme page";
  if (programme && url === programme.officialFeeSourceUrl) return "Official fee source";
  if (/bendahari|fee|fees|portal international|program/i.test(url)) return "Official UMPSA fee source";
  if (/admission/.test(url)) return "Official UMPSA admission source";
  if (/ips/.test(url)) return "Official UMPSA postgraduate source";
  if (/fim|ftka|ftkma|ftkpm/.test(url)) return "Official UMPSA faculty source";
  if (/open-intake/.test(url)) return "Official UMPSA open-intake source";
  return "Official UMPSA source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/bendahari|fee|fees|tuition|portal international/.test(value)) return "fee";
  if (/admission|international-student|open-intake|application|ipsonline/.test(value)) return "admission";
  if (/programme|program|undergraduate|postgraduate|ips|fim|ftka|ftkma|ftkpm/.test(value)) return "study-portal";
  if (value === officialWebsite) return "profile";
  return "other";
}

function officialUmpsaUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "umpsa.edu.my" || host.endsWith(".umpsa.edu.my") || host === "ump.edu.my" || host.endsWith(".ump.edu.my");
  } catch {
    return false;
  }
}

function fieldEvidenceValue(programme: UmpsaAuditProgramme, field: string) {
  const value = asRecord(programme.fieldEvidence)[field];
  const record = asRecord(value);
  if (Array.isArray(value)) return value.map((item) => normalizeText(asRecord(item).value || asRecord(item).evidenceText || "", 500)).join("; ");
  return normalizeText(record.evidenceText || record.value || record.valuesZh || "", 4000);
}

function urlsFromUnknown(value: unknown): string[] {
  const urls: string[] = [];
  const visit = (item: unknown) => {
    if (typeof item === "string") {
      const matches = item.match(/https?:\/\/[^\s)\]}"']+/g) || [];
      urls.push(...matches.map((url) => url.replace(/[.,;:]+$/, "")));
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (item && typeof item === "object") Object.values(item as Record<string, unknown>).forEach(visit);
  };
  visit(value);
  return urls.filter((url) => !url.includes("{"));
}

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function localizedArrayHasChinese(value?: LocalizedStringArray) {
  return Boolean(value?.["zh-CN"]?.length && value["zh-CN"].every(hasChinese));
}

function localizedArrayHasNoChinese(value?: LocalizedStringArray, locale: keyof LocalizedStringArray = "en") {
  return Boolean(value?.[locale]?.length && value[locale].every((item) => !hasChinese(item)));
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeLongText(value: unknown) {
  return normalizeText(value, 4000);
}

function normalizeText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNumberOrNull(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function buildDataSource() {
  loadEnvFiles();
  return new DataSource({
    type: "mysql",
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "123456",
    database: process.env.MYSQL_DATABASE || "study_malaysia",
    entities: [...ALL_ENTITIES],
    synchronize: false,
    charset: "utf8mb4_unicode_ci"
  });
}

async function clearCatalogCache() {
  if (!process.env.REDIS_URL) return false;
  const RedisCtor = IORedis as unknown as new (connection: string, options: Record<string, unknown>) => Redis;
  const client = new RedisCtor(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  client.on("error", () => undefined);
  try {
    await client.connect();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", "catalog:*", "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) await client.del(...keys);
    } while (cursor !== "0");
    return true;
  } catch {
    return false;
  } finally {
    await client.quit().catch(() => undefined);
  }
}

async function main() {
  await runUmpsaPublication({
    undergraduatePath: resolve(readArgValue("--undergraduate-audit") || DEFAULT_UMPSA_UNDERGRADUATE_AUDIT_PATH),
    masterPath: resolve(readArgValue("--master-audit") || DEFAULT_UMPSA_MASTER_AUDIT_PATH),
    doctoralPath: resolve(readArgValue("--doctoral-audit") || DEFAULT_UMPSA_DOCTORAL_AUDIT_PATH),
    planOutput: resolve(readArgValue("--plan-output") || DEFAULT_UMPSA_PUBLISH_PLAN_PATH),
    postImportAuditOutput: resolve(readArgValue("--post-import-audit-output") || DEFAULT_UMPSA_POST_IMPORT_AUDIT_PATH),
    releaseReportOutput: resolve(readArgValue("--release-report-output") || DEFAULT_UMPSA_RELEASE_REPORT_PATH),
    confirm: process.argv.includes("--confirm-import"),
    verifyOnly: process.argv.includes("--verify-only")
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
