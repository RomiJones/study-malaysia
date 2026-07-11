import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, In, Like, Not, type DeepPartial, type EntityManager } from "typeorm";
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
const iiumMasterImportDir = resolve(repositoryRoot, "data/imports/iium/2026-06-29/master-official");

export const IIUM_MASTER_SLUG_PREFIX = "iium-master-20260629-";
export const DEFAULT_IIUM_MASTER_AUDIT_PATH = resolve(
  repositoryRoot,
  "audits/IIUM_audit_master_20260629_verified_20260629_r3.json"
);
export const DEFAULT_IIUM_MASTER_PUBLISH_PLAN_PATH = resolve(iiumMasterImportDir, "01_publish_plan.json");
export const DEFAULT_IIUM_MASTER_POST_IMPORT_AUDIT_PATH = resolve(iiumMasterImportDir, "02_post_import_audit.json");
export const DEFAULT_IIUM_MASTER_RELEASE_REPORT_PATH = resolve(iiumMasterImportDir, "03_release_report.md");

const verifiedAt = "2026-06-29";
const myrToCny = 1.55;
const expectedProgrammes = 81;
const publicCatalogProgramStatuses = ["ready", "current-cycle-not-open", "not-available-for-international"] as const;

const officialWebsite = "https://www.iium.edu.my/v2/";
const academicsUrl = "https://www.iium.edu.my/v2/academics/";
const cpsProgrammesUrl = "https://centre.iium.edu.my/cps/programmes-offered/";
const cpsApplicationUrl = "https://centre.iium.edu.my/cps/application-online/";
const cpsLanguageUrl = "https://centre.iium.edu.my/cps/language-requirements/";
const cpsGeneralAdmissionUrl = "https://centre.iium.edu.my/cps/general-admission-requirements/";
const eAdmissionUrl = "https://eadmission.iium.edu.my/";
const masterFinancePdfUrl =
  "https://division.iium.edu.my/finance/wp-content/uploads/sites/6/2026/06/2.5.1-Master-International-After-Discount-Sem-1-2024-2025-v2.7-June26.pdf";

type IssueStatus = "resolved" | "accepted_gap" | "open" | string;

interface IiumMasterEntryRequirement {
  minGPA: number | null;
  gpaScale: number | null;
  gpaNote: string | null;
  degreeLevel: string | null;
  degreeRelevance: string | null;
  workExperience: string | null;
}

interface IiumMasterProgramme {
  nameEn: string;
  name: string;
  faculty: string;
  facultyZh: string | null;
  level: "master";
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
  entryRequirement: IiumMasterEntryRequirement;
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
  remarks?: string | null;
  fieldStatus?: Record<string, { status?: string; note?: string; sourceUrl?: string; crawlLevel?: string }>;
  fieldEvidence?: Record<string, unknown>;
  crawlLog?: Record<string, unknown>;
  _validationResult?: string;
  _validationIssues?: unknown[];
  _pendingIssues?: unknown[];
  _acceptedGaps?: string[];
}

interface IiumMasterAudit {
  schema_version?: string;
  workflow_status?: string;
  safe_to_import: boolean;
  import_approved_by?: string | null;
  import_approved_at?: string | null;
  auditMeta?: {
    targetUniversity?: string;
    targetUniversityShortName?: string;
    targetLevel?: string;
    totalProgrammesBaseline?: number;
    totalProgrammesCollected?: number;
    readyCount?: number;
    needsReviewCount?: number;
    exceptionCount?: number;
  };
  sourceRegistry?: unknown;
  programmeBaseline?: unknown;
  programme_baseline?: unknown;
  programmes: IiumMasterProgramme[];
  pending_issues?: Array<{ status?: IssueStatus; issue_id?: string; field?: string; title?: string; requiresIanDecision?: boolean }>;
  exception_queue?: Array<{ status?: IssueStatus; issue_id?: string; field?: string; title?: string; requiresIanDecision?: boolean }>;
  validation_result?: {
    recommended_for_import?: boolean;
    blocking_issues?: unknown[];
    accepted_gaps?: Array<{ issue_id?: string; id?: string; field?: string }>;
    requires_ian_decision?: unknown[];
    import_boundary?: string;
  };
  import_authorization?: {
    authorization_status?: string;
    safe_to_import?: boolean;
  };
  validationMeta?: {
    overallDecision?: string;
    languageGateStats?: {
      directIeltsRows?: number;
      noDirectIeltsRows?: number;
      officialIeltsDistribution?: Record<string, number>;
    };
    strictFeeGateStats?: {
      decision?: string;
      totalProgrammesChecked?: number;
      pdfTotalFeeRowsPopulated?: number;
      grandTotalRowsExcluded?: number;
      openHighFeeConflictRows?: number;
      primaryFeePolicy?: string;
    };
    acceptedGapSummary?: Record<string, unknown>;
    counts?: {
      totalProgrammesValidated?: number;
      pass?: number;
      reject?: number;
      issuesPending?: number;
    };
  };
}

export interface IiumMasterImportSummary {
  importRows: number;
  byLevel: { bachelor: number; master: number; phd: number };
  readyRows: number;
  publishedRows: number;
  uniqueSlugs: number;
  officialFeeRows: number;
  directIeltsRows: number;
  languageCoverageRows: number;
  eptMentionRows: number;
  chineseNameRows: number;
  chineseFacultyRows: number;
  curriculumDisplayRows: number;
  officialCurriculumRows: number;
  careerDisplayRows: number;
  officialCareerRows: number;
  inferredCareerRows: number;
  sourceRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  studyModeCounts: Record<string, number>;
}

interface IiumMasterVerification extends IiumMasterImportSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  activeSupersededMasterRows: number;
  legacyVisibleMasterRows: number;
  visibleCurrentRows: number;
  visibleBachelorRowsPreserved: number;
}

const t = (en: string, ms = en, zhCN = en, zhTW = zhCN): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const arr = (en: string[], ms = en, zhCN = en, zhTW = zhCN): LocalizedStringArray => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const defaultEnglishApplicationDocs = [
  "Submit the online postgraduate application through IIUM eAdmission or the official CPS application channel.",
  "Submit bachelor's degree certificate, transcript or equivalent qualification evidence.",
  "Submit research proposal, references, professional qualification or work-experience evidence where required by the Kulliyyah or programme.",
  "International applicants must complete offer, visa, registration and payment steps required by IIUM."
];

const defaultChineseApplicationDocs = [
  "通过 IIUM eAdmission / CPS 官方在线申请入口提交申请",
  "提交学士学位证书、成绩单或同等学历证明",
  "按学院或项目要求提交研究计划、推荐信、专业资格或工作经验证明",
  "国际学生按 IIUM 要求办理录取、签证、注册和缴费手续"
];

export function validateIiumMasterAudit(audit: IiumMasterAudit, expectedCount = expectedProgrammes): string[] {
  const errors: string[] = [];
  if (audit.schema_version !== "audit-json-v2.1") errors.push("schema_version must be audit-json-v2.1.");
  if (audit.workflow_status !== "validated_with_gaps") errors.push("workflow_status must be validated_with_gaps for the review import.");
  if (audit.safe_to_import !== false) errors.push("safe_to_import must remain false.");
  if (audit.import_approved_by != null || audit.import_approved_at != null) errors.push("import approval fields must remain null.");
  if (audit.import_authorization?.safe_to_import !== false) errors.push("import_authorization.safe_to_import must remain false.");
  if (audit.validation_result?.recommended_for_import !== false) {
    errors.push("validation_result.recommended_for_import must remain false for the review import.");
  }
  if (audit.auditMeta?.targetUniversityShortName !== "IIUM") errors.push("targetUniversityShortName must be IIUM.");
  if (audit.auditMeta?.targetLevel !== "master") errors.push("targetLevel must be master.");
  if (audit.auditMeta?.totalProgrammesBaseline !== expectedCount) errors.push(`baseline must be ${expectedCount}.`);
  if (audit.auditMeta?.totalProgrammesCollected !== expectedCount) errors.push(`collected count must be ${expectedCount}.`);
  if (!Array.isArray(audit.programmes) || audit.programmes.length !== expectedCount) {
    errors.push(`expected ${expectedCount} programmes, got ${audit.programmes?.length || 0}.`);
  }
  if (audit.validationMeta?.counts?.totalProgrammesValidated !== expectedCount) {
    errors.push(`validationMeta.counts.totalProgrammesValidated must be ${expectedCount}.`);
  }
  if (audit.validationMeta?.languageGateStats?.directIeltsRows !== expectedCount) {
    errors.push(`direct IELTS row count must be ${expectedCount}.`);
  }
  if (audit.validationMeta?.languageGateStats?.noDirectIeltsRows !== 0) {
    errors.push("noDirectIeltsRows must be 0.");
  }
  if (audit.validationMeta?.strictFeeGateStats?.decision !== "PASS_BY_IAN_APPROVED_FINANCE_PDF_TOTAL_POLICY") {
    errors.push("strict fee gate must pass Ian-approved Finance PDF TOTAL policy.");
  }
  if (audit.validationMeta?.strictFeeGateStats?.pdfTotalFeeRowsPopulated !== expectedCount) {
    errors.push(`strict fee gate must populate ${expectedCount} Finance PDF total rows.`);
  }
  if (audit.validationMeta?.strictFeeGateStats?.openHighFeeConflictRows !== 0) {
    errors.push("strict fee gate must have zero open high-fee conflicts.");
  }
  if (audit.validationMeta?.strictFeeGateStats?.grandTotalRowsExcluded !== expectedCount) {
    errors.push(`grand total rows must be excluded for all ${expectedCount} rows.`);
  }
  const acceptedGapIds = new Set((audit.validation_result?.accepted_gaps || []).map((item) => item.issue_id || item.id || item.field));
  for (const required of ["PI-IIUM-2026-MASTER-002", "PI-IIUM-2026-MASTER-008"]) {
    if (!acceptedGapIds.has(required)) errors.push(`accepted gap ${required} is required for the fee policy review import.`);
  }

  const seenSlugs = new Set<string>();
  for (const [index, programme] of (audit.programmes || []).entries()) {
    const row = `master ${index + 1} ${programme.nameEn || "unknown"}`;
    const slug = `${IIUM_MASTER_SLUG_PREFIX}${String(index + 1).padStart(3, "0")}-${slugify(programme.nameEn || "")}`;
    if (seenSlugs.has(slug)) errors.push(`${row}: generated slug is duplicated.`);
    seenSlugs.add(slug);
    if (!programme.nameEn) errors.push(`${row}: nameEn is required.`);
    if (!hasChinese(programme.name) || programme.name === programme.nameEn || !programme.name.includes(programme.nameEn)) {
      errors.push(`${row}: Chinese bilingual programme name is required.`);
    }
    if (programme.level !== "master") errors.push(`${row}: level must be master.`);
    if (!programme.faculty) errors.push(`${row}: faculty is required.`);
    if (!hasChinese(programme.facultyZh || "") || programme.facultyZh === programme.faculty) errors.push(`${row}: Chinese faculty is required.`);
    if (!officialIiumUrl(programme.officialSourceUrl)) errors.push(`${row}: officialSourceUrl must be IIUM official URL.`);
    if (!programme.officialFeeSourceUrl || !officialIiumUrl(programme.officialFeeSourceUrl)) {
      errors.push(`${row}: officialFeeSourceUrl must be IIUM official URL.`);
    }
    if (typeof programme.duration !== "number" || programme.duration <= 0) errors.push(`${row}: duration must be positive number.`);
    if (typeof programme.tuitionMYR !== "number" || programme.tuitionMYR <= 0) errors.push(`${row}: tuitionMYR must be positive number.`);
    if (!programme.tuitionNote || !/TOTAL|Finance|Sem 1 2024\/2025|official/i.test(programme.tuitionNote)) {
      errors.push(`${row}: tuitionNote must retain official Finance PDF total policy evidence.`);
    }
    if (typeof programme.language?.ielts !== "number" || programme.language.ielts <= 0) {
      errors.push(`${row}: direct IELTS must be populated.`);
    }
    if (!programme.language?.otherRequirement || !/EPT|IIUM-administered/i.test(programme.language.otherRequirement)) {
      errors.push(`${row}: language.otherRequirement must mention the IIUM EPT pathway.`);
    }
    if (!programme.applicationDeadline || !hasChinese(programme.applicationDeadline)) {
      errors.push(`${row}: applicationDeadline must store current official intake/opening note.`);
    }
    if (!Array.isArray(programme.applicationDocs) || programme.applicationDocs.length === 0 || !programme.applicationDocs.every(hasChinese)) {
      errors.push(`${row}: Chinese applicationDocs are required.`);
    }
  }
  return errors;
}

export function loadIiumMasterAudit(path = DEFAULT_IIUM_MASTER_AUDIT_PATH): IiumMasterAudit {
  if (!existsSync(path)) throw new Error(`IIUM master audit file not found: ${path}`);
  return loadJson<IiumMasterAudit>(path);
}

export function buildIiumMasterRows(audit: IiumMasterAudit): Array<DeepPartial<ProgramEntity>> {
  return audit.programmes.map((programme, index) => buildIiumMasterProgrammeRow(programme, index + 1));
}

export function summarizeIiumMasterImport(rows: Array<DeepPartial<ProgramEntity>>): IiumMasterImportSummary {
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
    directIeltsRows: rows.filter((row) => Number((row.languageRequirement as LanguageRequirement | undefined)?.ielts || 0) > 0).length,
    languageCoverageRows: rows.filter((row) => Boolean(normalizeText(row.officialLanguageRequirement, 4000))).length,
    eptMentionRows: rows.filter((row) => /EPT|IIUM-administered/i.test(String(row.officialLanguageRequirement || ""))).length,
    chineseNameRows: rows.filter((row) => hasChinese((row.name as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    chineseFacultyRows: rows.filter((row) => hasChinese((row.faculty as LocalizedText | undefined)?.["zh-CN"] || "")).length,
    curriculumDisplayRows: rows.filter((row) => localizedArrayHasContent(row.curriculum as LocalizedStringArray | undefined)).length,
    officialCurriculumRows: rows.filter((row) => !(row.curriculum as LocalizedStringArray | undefined)?.["zh-CN"]?.[0]?.includes("官网未公布完整课程结构")).length,
    careerDisplayRows: rows.filter((row) => localizedArrayHasContent(row.careers as LocalizedStringArray | undefined)).length,
    officialCareerRows: rows.filter((row) => !(row.publicDisplayNote || "").includes("就业方向为 StudyMY 审核展示补充")).length,
    inferredCareerRows: rows.filter((row) => String(row.publicDisplayNote || "").includes("就业方向为 StudyMY 审核展示补充")).length,
    sourceRows: rows.filter((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 5).length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    studyModeCounts: countBy(rows, (row) => String(row.studyMode || "unknown"))
  };
}

function buildIiumMasterProgrammeRow(programme: IiumMasterProgramme, ordinal: number): DeepPartial<ProgramEntity> {
  const tuitionMYR = programme.tuitionMYR || 0;
  const durationYears = programme.duration || 1;
  const sourceUrls = buildIiumProgrammeSourceLinks(programme);
  const mode = studyModeDisplay(programme);
  const category = inferCategory(programme.nameEn, programme.faculty);
  const officialCareer = programme.careerProspects.length > 0;
  const careerZh = officialCareer ? programme.careerProspects : inferCareerZh(programme, category);
  const careerEn = officialCareer ? [`See the official IIUM programme source for career prospects of ${programme.nameEn}.`] : inferCareerEn(programme, category);

  return {
    slug: `${IIUM_MASTER_SLUG_PREFIX}${String(ordinal).padStart(3, "0")}-${slugify(programme.nameEn)}`,
    code: `IIUM-MAST-${String(ordinal).padStart(3, "0")}`,
    name: t(programme.nameEn, programme.nameEn, programme.name, programme.name),
    nameEnOfficial: programme.nameEn,
    level: "master",
    category,
    faculty: t(programme.faculty, programme.faculty, programme.facultyZh || programme.faculty, programme.facultyZh || programme.faculty),
    facultyZh: programme.facultyZh || "",
    studyMode: mode,
    campus: inferCampus(programme),
    durationYears,
    durationOfficial: buildDurationOfficial(programme, mode),
    annualTuitionCny: Math.round((tuitionMYR * myrToCny) / Math.max(durationYears, 0.5)),
    tuitionAmount: tuitionMYR,
    tuitionCurrency: "MYR" satisfies TuitionCurrency,
    tuitionDisplay: `RM ${formatNumber(tuitionMYR)} total programme fee`,
    officialTuitionMYR: Math.round(tuitionMYR),
    officialTuitionNote: buildTuitionNote(programme),
    officialFeeSourceUrl: programme.officialFeeSourceUrl || masterFinancePdfUrl,
    secondaryOfficialFeeSourceUrl: masterFinancePdfUrl,
    officialFeeAuditStatus: "matched-official" satisfies FeeAuditStatus,
    officialFeeAuditedAt: verifiedAt,
    intakeMonths: [],
    officialIntake: "Applications open throughout the year; registration is to the next available semester.",
    officialIntakeNote: normalizeLongText(programme.applicationDeadline || "CPS states postgraduate applications are open throughout the year; no stable programme-level month array is verified."),
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
    chinaStudentRequirement: "IIUM 未单独公布中国学生硕士等效路径；按 CPS / eAdmission、国际学历资格、学院要求和专业要求评估。",
    specialRequirementsNote: buildSpecialRequirements(programme),
    applicationDocs: arr(
      defaultEnglishApplicationDocs,
      defaultEnglishApplicationDocs,
      programme.applicationDocs?.length ? programme.applicationDocs : defaultChineseApplicationDocs,
      programme.applicationDocs?.length ? programme.applicationDocs : defaultChineseApplicationDocs
    ),
    curriculum: buildCurriculum(programme),
    careers: arr(careerEn, careerEn, careerZh, careerZh),
    specializations: buildSpecializations(programme),
    description: t(
      `${programme.nameEn} is published for Ian review from IIUM official CPS, Kulliyyah, language and Finance fee evidence in the 2026-06-29 master audit.`,
      `${programme.nameEn} is published for Ian review from IIUM official CPS, Kulliyyah, language and Finance fee evidence in the 2026-06-29 master audit.`,
      `${programme.name} 已按 IIUM 官方 CPS、学院、语言要求与 Finance 费用证据上线给 Ian 审核；仍保留模式拆分、课程结构与方向拆分等后续复核备注。`,
      `${programme.name} 已按 IIUM 官方 CPS、學院、語言要求與 Finance 費用證據上線給 Ian 審核；仍保留模式拆分、課程結構與方向拆分等後續複核備註。`
    ),
    officialAccreditationNote: null,
    officialSourceUrl: programme.officialSourceUrl,
    officialEntryRequirementSourceUrl: cpsGeneralAdmissionUrl,
    officialAccreditationSourceUrl: programme.officialSourceUrl,
    sourceUrls,
    officialVerifiedAt: programme.officialVerifiedAt || verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    publicDisplayNote: buildPublicDisplayNote(programme, officialCareer),
    reviewReason: null,
    auditNote: normalizeLongText([
      `Published from IIUM master review audit row ${ordinal}.`,
      `Source audit workflow_status=${"validated_with_gaps"} and safe_to_import=false are intentionally preserved in artifacts.`,
      `Official source: ${programme.officialSourceUrl}.`,
      `Fee source: ${programme.officialFeeSourceUrl || masterFinancePdfUrl}.`,
      programme.curriculumNote || "",
      programme.studyModeNote || "",
      programme.fieldStatus?.intake?.note || "",
      programme.fieldStatus?.careerProspects?.note || "",
      programme.fieldStatus?.["language.toefl"]?.note || ""
    ].filter(Boolean).join(" ")),
    listTuitionText: `RM ${formatNumber(tuitionMYR)}`,
    isPublished: true
  };
}

function assertIiumMasterImportSummary(summary: IiumMasterImportSummary) {
  const failed =
    summary.importRows !== expectedProgrammes ||
    summary.byLevel.master !== expectedProgrammes ||
    summary.byLevel.bachelor !== 0 ||
    summary.byLevel.phd !== 0 ||
    summary.readyRows !== expectedProgrammes ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== expectedProgrammes ||
    summary.directIeltsRows !== expectedProgrammes ||
    summary.languageCoverageRows !== expectedProgrammes ||
    summary.eptMentionRows !== expectedProgrammes ||
    summary.chineseNameRows !== expectedProgrammes ||
    summary.chineseFacultyRows !== expectedProgrammes ||
    summary.curriculumDisplayRows !== expectedProgrammes ||
    summary.careerDisplayRows !== expectedProgrammes ||
    summary.sourceRows !== expectedProgrammes;
  if (failed) throw new Error(`IIUM master import row summary hard gate failed: ${JSON.stringify(summary)}`);
}

async function runIiumMasterPublication(options: {
  auditPath: string;
  planOutput: string;
  postImportAuditOutput: string;
  releaseReportOutput: string;
  confirm: boolean;
  verifyOnly: boolean;
}) {
  const audit = loadIiumMasterAudit(options.auditPath);
  const validationErrors = validateIiumMasterAudit(audit, expectedProgrammes);
  if (validationErrors.length) throw new Error(`IIUM master audit validation failed:\n${validationErrors.join("\n")}`);

  const rows = buildIiumMasterRows(audit);
  const summary = summarizeIiumMasterImport(rows);
  assertIiumMasterImportSummary(summary);
  const plan = buildPublishPlan(options, summary, audit);
  writeJson(options.planOutput, plan);

  if (!options.confirm && !options.verifyOnly) {
    console.log(JSON.stringify({
      mode: "iium-master-dry-run",
      planPath: options.planOutput,
      summary,
      nextStep: "Run npm --workspace @studymy/api run import:iium:master -- --confirm-import"
    }, null, 2));
    return;
  }

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    const programRepo = dataSource.getRepository(ProgramEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "IIUM" } })) ||
      (await universityRepo.findOne({ where: { slug: "international-islamic-university-malaysia" } }));

    if (options.verifyOnly) {
      if (!university) throw new Error("IIUM university row not found.");
      const verification = await verifyImportedIiumMasterRows(dataSource, university.id);
      console.log(JSON.stringify({ mode: "iium-master-verified", universityId: university.id, summary, verification }, null, 2));
      return;
    }

    const slugConflict = await universityRepo.findOne({ where: { slug: "international-islamic-university-malaysia" } });
    if (slugConflict && university && slugConflict.id !== university.id) {
      throw new Error(`University slug international-islamic-university-malaysia belongs to ${slugConflict.code}.`);
    }
    if (!university && slugConflict) university = slugConflict;

    const backupPath = resolve(repositoryRoot, `tmp/backups/iium-master-public-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const currentPrograms = university ? await programRepo.find({ where: { universityId: university.id } }) : [];
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: IiumMasterVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = university?.id
        ? await txUniversityRepo.findOne({ where: { id: university.id } })
        : (await txUniversityRepo.findOne({ where: { code: "IIUM" } })) ||
          (await txUniversityRepo.findOne({ where: { slug: "international-islamic-university-malaysia" } }));

      const universitySeed = buildIiumUniversitySeed(university);
      university = await txUniversityRepo.save(txUniversityRepo.create({ ...universitySeed, id: university?.id }));

      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const previousCurrentRows = await txProgramRepo.find({
        where: { universityId: university.id, slug: Like(`${IIUM_MASTER_SLUG_PREFIX}%`) }
      });
      for (const previous of previousCurrentRows) {
        if (!incomingSlugs.has(previous.slug)) await txProgramRepo.remove(previous);
      }

      await txProgramRepo.update(
        {
          universityId: university.id,
          level: "master",
          isPublished: true,
          publicDisplayStatus: In([...publicCatalogProgramStatuses]),
          slug: Not(Like(`${IIUM_MASTER_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          publicDisplayNote: "Archived by IIUM master official review import to prevent legacy public-list leakage.",
          reviewReason: "Archived by IIUM master official review publication; current public display uses iium-master-20260629 rows."
        }
      );

      for (const row of rows) {
        const existing = await txProgramRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await txProgramRepo.save(txProgramRepo.create({ ...row, id: existing?.id, universityId: university.id }));
      }

      await updateUniversityAfterMasterImport(manager, university, audit, summary, options.auditPath);
      verification = await verifyImportedIiumMasterRows(manager, university.id);
    });

    if (!verification) throw new Error("IIUM master publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    writeJson(options.postImportAuditOutput, buildPostImportAudit(summary, verification, backupPath, catalogCacheCleared, audit));
    writeFileSync(options.releaseReportOutput, buildReleaseReportMarkdown(verification, backupPath, catalogCacheCleared), "utf8");

    console.log(JSON.stringify({
      mode: "iium-master-published-for-review",
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

function buildIiumUniversitySeed(existing: UniversityEntity | null = null): DeepPartial<UniversityEntity> {
  return {
    slug: existing?.slug || "international-islamic-university-malaysia",
    code: existing?.code || "IIUM",
    name: existing?.name || t("International Islamic University Malaysia", "International Islamic University Malaysia", "国际伊斯兰大学", "國際伊斯蘭大學"),
    shortName: existing?.shortName || "IIUM",
    logoUrl: existing?.logoUrl || "",
    imageUrl: existing?.imageUrl || "",
    color: existing?.color || "#006B3F",
    qsRank: existing?.qsRank || 691,
    qsAsiaRank: existing?.qsAsiaRank ?? null,
    location: existing?.location || t("Gombak, Selangor, Malaysia", "Gombak, Selangor, Malaysia", "马来西亚雪兰莪鹅唛", "馬來西亞雪蘭莪鵝嘜"),
    region: existing?.region || t("Selangor", "Selangor", "雪兰莪", "雪蘭莪"),
    ownership: existing?.ownership || "public",
    institutionType: existing?.institutionType || "comprehensive",
    foundedYear: existing?.foundedYear || 1983,
    students: existing?.students || 0,
    intlStudents: existing?.intlStudents || 0,
    csrCertified: existing?.csrCertified || false,
    description: t(
      "International Islamic University Malaysia (IIUM) is a Malaysian public university with undergraduate and postgraduate programmes across law, economics, ICT, architecture, education, human sciences, engineering, health sciences, medicine, dentistry, nursing, pharmacy, science, languages and Islamic thought.",
      "International Islamic University Malaysia (IIUM) is a Malaysian public university with undergraduate and postgraduate programmes across law, economics, ICT, architecture, education, human sciences, engineering, health sciences, medicine, dentistry, nursing, pharmacy, science, languages and Islamic thought.",
      "国际伊斯兰大学（IIUM）是马来西亚公立大学，专业覆盖法律、经济、信息技术、建筑、教育、人文、工程、健康科学、医学、牙科、护理、药学、科学、语言与伊斯兰思想等本科和研究生方向。",
      "國際伊斯蘭大學（IIUM）是馬來西亞公立大學，課程涵蓋法律、經濟、資訊科技、建築、教育、人文、工程、健康科學、醫學、牙科、護理、藥學、科學、語言與伊斯蘭思想等本科和研究生方向。"
    ),
    website: officialWebsite,
    admissionEmail: existing?.admissionEmail || "",
    nameEnOfficial: "International Islamic University Malaysia",
    officialWebsite,
    studyPortalUrl: academicsUrl,
    internationalPageUrl: cpsProgrammesUrl,
    applicationPortalUrl: eAdmissionUrl,
    officialAddress: existing?.officialAddress || "International Islamic University Malaysia, Jalan Gombak, 53100 Kuala Lumpur, Malaysia",
    applicationPeriods: [
      "Postgraduate applications open throughout the year",
      "Students are registered to the next available semester",
      "Programme-level month arrays remain under review where CPS does not publish stable monthly intake mapping."
    ],
    applicationFees: existing?.applicationFees || [],
    applicationDocuments: existing?.applicationDocuments || arr(defaultEnglishApplicationDocs, defaultEnglishApplicationDocs, defaultChineseApplicationDocs, defaultChineseApplicationDocs),
    chinaStudentRequirements: existing?.chinaStudentRequirements || arr(
      ["IIUM did not publish a China-specific postgraduate equivalency route in the collected official sources; international applications follow CPS/eAdmission and programme-level requirements."],
      ["IIUM did not publish a China-specific postgraduate equivalency route in the collected official sources; international applications follow CPS/eAdmission and programme-level requirements."],
      ["IIUM 本次采集的官方来源未单独公布中国学生研究生等效路径；国际申请按 CPS / eAdmission 及各专业要求评估。"],
      ["IIUM 本次採集的官方來源未單獨公布中國學生研究生等效路徑；國際申請按 CPS / eAdmission 及各課程要求評估。"]
    ),
    officialProfile: existing?.officialProfile || {},
    officialSources: mergeOfficialSources(existing?.officialSources || [], buildIiumUniversitySourceLinks()),
    officialVerifiedAt: verifiedAt,
    officialSourceStatus: "official-verified" satisfies OfficialSourceStatus,
    officialAuditSummary: existing?.officialAuditSummary || null,
    publicDisplayStatus: "ready" satisfies PublicDisplayStatus,
    livingCostOfficialNote: existing?.livingCostOfficialNote || null,
    tuitionMinCny: existing?.tuitionMinCny || 0,
    tuitionMaxCny: existing?.tuitionMaxCny || 0,
    livingCostCny: existing?.livingCostCny || 30000,
    minIelts: existing?.minIelts || 5,
    acceptNoLanguage: false,
    facilities: existing?.facilities || arr(
      ["Gombak campus", "Kuantan campus", "Pagoh campus", "CPS and Kulliyyah postgraduate offices"],
      ["Gombak campus", "Kuantan campus", "Pagoh campus", "CPS and Kulliyyah postgraduate offices"],
      ["鹅唛校区", "关丹校区", "巴莪校区", "CPS 与学院研究生办公室"],
      ["鵝嘜校區", "關丹校區", "巴莪校區", "CPS 與學院研究生辦公室"]
    ),
    highlights: existing?.highlights || arr(
      ["QS WUR 2027 =691", "Public Malaysian university", "Official IIUM CPS postgraduate catalogue", "Official IIUM Finance international master fee PDF"],
      ["QS WUR 2027 =691", "Public Malaysian university", "Official IIUM CPS postgraduate catalogue", "Official IIUM Finance international master fee PDF"],
      ["QS 世界大学排名 2027 =691", "马来西亚公立大学", "IIUM CPS 官方研究生专业目录", "IIUM Finance 国际硕士官方费用 PDF"],
      ["QS 世界大學排名 2027 =691", "馬來西亞公立大學", "IIUM CPS 官方研究生課程目錄", "IIUM Finance 國際碩士官方費用 PDF"]
    ),
    programCount: existing?.programCount || 0,
    isPublished: true
  };
}

async function updateUniversityAfterMasterImport(
  manager: EntityManager,
  university: UniversityEntity,
  audit: IiumMasterAudit,
  importSummary: IiumMasterImportSummary,
  auditPath: string
) {
  const programRepo = manager.getRepository(ProgramEntity);
  const universityRepo = manager.getRepository(UniversityEntity);
  const visibleRows = await programRepo.find({
    where: {
      universityId: university.id,
      isPublished: true,
      publicDisplayStatus: In([...publicCatalogProgramStatuses])
    }
  });
  const annualCosts = visibleRows.map((row) => Number(row.annualTuitionCny || 0)).filter((value) => value > 0);
  const directIeltsValues = visibleRows.map((row) => Number(row.languageRequirement?.ielts || 0)).filter((value) => value > 0);
  const byLevel = {
    bachelor: visibleRows.filter((row) => row.level === "bachelor").length,
    master: visibleRows.filter((row) => row.level === "master").length,
    phd: visibleRows.filter((row) => row.level === "phd").length
  };
  university.programCount = visibleRows.length;
  if (annualCosts.length) {
    university.tuitionMinCny = Math.min(...annualCosts);
    university.tuitionMaxCny = Math.max(...annualCosts);
  }
  if (directIeltsValues.length) university.minIelts = Math.min(...directIeltsValues);
  university.officialProfile = {
    ...asRecord(university.officialProfile),
    iiumMasterPublication: {
      sourceAudit: relative(repositoryRoot, auditPath),
      importedAt: new Date().toISOString(),
      verifiedAt,
      programmes: importSummary.importRows,
      byLevel,
      workflowStatus: audit.workflow_status,
      sourceAuditSafeToImport: audit.safe_to_import,
      sourceAuditRecommendedForImport: audit.validation_result?.recommended_for_import,
      strictFeeGateStats: audit.validationMeta?.strictFeeGateStats || null,
      languageGateStats: audit.validationMeta?.languageGateStats || null,
      openIssues: openIssueSummary(audit),
      acceptedGapSummary: audit.validationMeta?.acceptedGapSummary || null
    }
  };
  university.officialSources = mergeOfficialSources(university.officialSources || [], buildIiumUniversitySourceLinks(audit));
  university.officialAuditSummary =
    `IIUM official master review import: ${importSummary.importRows} master rows are public-visible for Ian review. ` +
    "The source audit remains safe_to_import=false and recommended_for_import=false because non-fee gaps remain; " +
    "fees use Ian-approved latest IIUM Finance PDF TOTAL policy, language list fields use direct CPS/Kulliyyah IELTS values, and EPT is retained as an IIUM-administered test pathway.";
  university.officialVerifiedAt = verifiedAt;
  university.officialSourceStatus = "official-verified";
  university.publicDisplayStatus = "ready";
  university.isPublished = true;
  await universityRepo.save(university);
}

async function verifyImportedIiumMasterRows(manager: EntityManager | DataSource, universityId: number) {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("IIUM university row not found during verification.");
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  const importRows = allUniversityRows.filter((row) => row.slug.startsWith(IIUM_MASTER_SLUG_PREFIX));
  return verifyIiumMasterPublicRecordSet(university, importRows, allUniversityRows);
}

function verifyIiumMasterPublicRecordSet(
  university: UniversityEntity,
  importRows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): IiumMasterVerification {
  const summary = summarizeIiumMasterImport(importRows);
  const activeSupersededMasterRows = allUniversityRows.filter((row) =>
    row.level === "master" &&
    !row.slug.startsWith(IIUM_MASTER_SLUG_PREFIX) &&
    row.publicDisplayStatus !== "archived"
  );
  const legacyVisibleMasterRows = allUniversityRows.filter((row) =>
    row.level === "master" &&
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number]) &&
    !row.slug.startsWith(IIUM_MASTER_SLUG_PREFIX)
  );
  const visibleCurrentRows = importRows.filter((row) =>
    row.isPublished &&
    row.publicDisplayStatus === "ready" &&
    row.slug.startsWith(IIUM_MASTER_SLUG_PREFIX)
  ).length;
  const visibleBachelorRowsPreserved = allUniversityRows.filter((row) =>
    row.level === "bachelor" &&
    row.isPublished &&
    publicCatalogProgramStatuses.includes(row.publicDisplayStatus as typeof publicCatalogProgramStatuses[number])
  ).length;

  if (
    importRows.length !== expectedProgrammes ||
    summary.byLevel.master !== expectedProgrammes ||
    summary.readyRows !== expectedProgrammes ||
    summary.publishedRows !== expectedProgrammes ||
    summary.uniqueSlugs !== expectedProgrammes ||
    summary.officialFeeRows !== expectedProgrammes ||
    summary.directIeltsRows !== expectedProgrammes ||
    summary.eptMentionRows !== expectedProgrammes ||
    summary.chineseNameRows !== expectedProgrammes ||
    summary.chineseFacultyRows !== expectedProgrammes ||
    summary.curriculumDisplayRows !== expectedProgrammes ||
    summary.careerDisplayRows !== expectedProgrammes ||
    summary.sourceRows !== expectedProgrammes ||
    visibleCurrentRows !== expectedProgrammes ||
    activeSupersededMasterRows.length !== 0 ||
    legacyVisibleMasterRows.length !== 0 ||
    university.publicDisplayStatus !== "ready" ||
    !university.isPublished ||
    university.programCount < expectedProgrammes
  ) {
    throw new Error(`IIUM master public verification failed: ${JSON.stringify({
      summary,
      activeSupersededMasterRows: activeSupersededMasterRows.map((row) => row.slug),
      legacyVisibleMasterRows: legacyVisibleMasterRows.map((row) => row.slug),
      visibleCurrentRows,
      visibleBachelorRowsPreserved,
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
    activeSupersededMasterRows: activeSupersededMasterRows.length,
    legacyVisibleMasterRows: legacyVisibleMasterRows.length,
    visibleCurrentRows,
    visibleBachelorRowsPreserved
  };
}

function buildPublishPlan(
  options: { auditPath: string },
  summary: IiumMasterImportSummary,
  audit: IiumMasterAudit
) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    institution: {
      code: "IIUM",
      shortName: "IIUM",
      name: "International Islamic University Malaysia",
      slug: "international-islamic-university-malaysia"
    },
    authorization: "operator-requested-publication-for-ian-review",
    sourceInputs: {
      masterAudit: relative(repositoryRoot, options.auditPath),
      sourceAuditSafeToImport: audit.safe_to_import,
      sourceAuditRecommendedForImport: audit.validation_result?.recommended_for_import,
      sourceAuditWorkflowStatus: audit.workflow_status,
      sourceAuditReason: "The StudyMY audit JSON remains validated_with_gaps and safe_to_import=false; this importer publishes a review surface only after explicit operator command."
    },
    writePolicy: {
      importer: "apps/api/src/db/import-iium-master-official.ts",
      mode: "publish-master-for-review",
      upsertPrefix: IIUM_MASTER_SLUG_PREFIX,
      universityRow: "upsert by code IIUM or slug international-islamic-university-malaysia",
      programmeRows: "upsert 81 current IIUM master public rows and archive legacy visible IIUM master rows only",
      preserveOtherLevels: true,
      transactional: true,
      backupRequired: true
    },
    publicationGate: {
      result: "passed-for-review",
      rules: [
        "81 master rows",
        "81 official IIUM Finance PDF TOTAL tuition rows",
        "81 direct IELTS rows from CPS/Kulliyyah language evidence",
        "81 EPT details preserved as IIUM-administered test pathway",
        "81 Chinese bilingual programme names",
        "81 Chinese faculty names",
        "81 official source URL rows",
        "all rows publicDisplayStatus=ready only for Ian review"
      ]
    },
    acceptedGapsAndOpenIssues: {
      acceptedGaps: audit.validation_result?.accepted_gaps || [],
      openIssues: openIssueSummary(audit),
      strictFeeGateStats: audit.validationMeta?.strictFeeGateStats || null,
      languageGateStats: audit.validationMeta?.languageGateStats || null
    },
    expectedSurface: {
      programmeCount: expectedProgrammes,
      byLevel: { bachelor: 0, master: expectedProgrammes, phd: 0 },
      summary
    }
  };
}

function buildPostImportAudit(
  summary: IiumMasterImportSummary,
  verification: IiumMasterVerification,
  backupPath: string,
  catalogCacheCleared: boolean,
  audit: IiumMasterAudit
) {
  return {
    schemaVersion: 1,
    mode: "iium-master-published-for-review",
    createdAt: new Date().toISOString(),
    institution: {
      code: "IIUM",
      name: "International Islamic University Malaysia",
      importedRows: summary.importRows,
      byLevel: summary.byLevel
    },
    sourceAudit: {
      workflowStatus: audit.workflow_status,
      safeToImport: audit.safe_to_import,
      recommendedForImport: audit.validation_result?.recommended_for_import,
      strictFeeGateStats: audit.validationMeta?.strictFeeGateStats || null,
      languageGateStats: audit.validationMeta?.languageGateStats || null,
      openIssues: openIssueSummary(audit),
      acceptedGapSummary: audit.validationMeta?.acceptedGapSummary || null
    },
    database: {
      backupPath: relative(repositoryRoot, backupPath),
      transactionalImport: "passed",
      catalogCacheCleared,
      scopedRows: verification.importRows,
      activeSupersededMasterRows: verification.activeSupersededMasterRows,
      legacyVisibleMasterRows: verification.legacyVisibleMasterRows,
      visibleCurrentRows: verification.visibleCurrentRows,
      visibleBachelorRowsPreserved: verification.visibleBachelorRowsPreserved
    },
    publicVisibility: {
      universityPublicDisplayStatus: verification.universityPublicDisplayStatus,
      universityIsPublished: verification.universityIsPublished,
      universityProgramCount: verification.universityProgramCount,
      rowsPublished: verification.publishedRows,
      rowsReady: verification.readyRows
    },
    displayGate: {
      chineseNameRows: verification.chineseNameRows,
      chineseFacultyRows: verification.chineseFacultyRows,
      curriculumDisplayRows: verification.curriculumDisplayRows,
      officialCurriculumRows: verification.officialCurriculumRows,
      careerDisplayRows: verification.careerDisplayRows,
      officialCareerRows: verification.officialCareerRows,
      inferredCareerRows: verification.inferredCareerRows,
      directIeltsRows: verification.directIeltsRows,
      eptMentionRows: verification.eptMentionRows,
      languageCoverageRows: verification.languageCoverageRows,
      officialFeeRows: verification.officialFeeRows,
      sourceRows: verification.sourceRows
    }
  };
}

function buildReleaseReportMarkdown(verification: IiumMasterVerification, backupPath: string, catalogCacheCleared: boolean) {
  return [
    "# IIUM Master Official Review Publication Report",
    "",
    "- Decision: published for Ian review",
    "- Scope: International Islamic University Malaysia official master programmes",
    `- Published rows: ${verification.publishedRows}`,
    `- Ready rows: ${verification.readyRows}`,
    `- Official fee rows: ${verification.officialFeeRows}`,
    `- Direct IELTS rows: ${verification.directIeltsRows}`,
    `- EPT detail rows: ${verification.eptMentionRows}`,
    `- Chinese programme name rows: ${verification.chineseNameRows}`,
    `- Chinese faculty rows: ${verification.chineseFacultyRows}`,
    `- Curriculum display rows: ${verification.curriculumDisplayRows}`,
    `- Official curriculum rows: ${verification.officialCurriculumRows}`,
    `- Career display rows: ${verification.careerDisplayRows}`,
    `- Official career rows: ${verification.officialCareerRows}`,
    `- StudyMY inferred career rows: ${verification.inferredCareerRows}`,
    `- Active superseded master rows: ${verification.activeSupersededMasterRows}`,
    `- Legacy visible master rows: ${verification.legacyVisibleMasterRows}`,
    `- Visible bachelor rows preserved: ${verification.visibleBachelorRowsPreserved}`,
    `- University programCount: ${verification.universityProgramCount}`,
    `- Catalog cache cleared: ${catalogCacheCleared ? "yes" : "not configured"}`,
    `- Backup: ${relative(repositoryRoot, backupPath)}`,
    "",
    "## Gate",
    "",
    "- Source audit stays safe_to_import=false and recommended_for_import=false.",
    "- This is a review publication, not a validator final-pass rewrite.",
    "- 学费：通过，81/81 使用 IIUM Finance 最新硕士国际学生 PDF 的 TOTAL。",
    "- 语言：通过，81/81 写入直接 IELTS；EPT 保留为 IIUM 校内测试路径，不换算 IELTS。",
    "- 入学季：CPS 官方为全年开放、注册到下一个可用学期；未写稳定月份数组。",
    "- 就业方向：官方已有则使用官方内容；官方未公布则按 Ian 授权写入 StudyMY 审核展示补充。",
    "- 仍待后续补：模式/方向拆分、课程结构深挖、部分学院附加方向裁定。",
    "",
    "## Official Sources",
    "",
    `- ${cpsProgrammesUrl}`,
    `- ${cpsApplicationUrl}`,
    `- ${cpsLanguageUrl}`,
    `- ${cpsGeneralAdmissionUrl}`,
    `- ${masterFinancePdfUrl}`,
    ""
  ].join("\n");
}

function buildIiumProgrammeSourceLinks(programme: IiumMasterProgramme): OfficialSourceLink[] {
  const urls = new Set([
    programme.officialSourceUrl,
    programme.officialFeeSourceUrl || masterFinancePdfUrl,
    masterFinancePdfUrl,
    cpsProgrammesUrl,
    cpsApplicationUrl,
    cpsLanguageUrl,
    cpsGeneralAdmissionUrl,
    eAdmissionUrl,
    ...urlsFromUnknown(programme.fieldEvidence),
    ...urlsFromUnknown(programme.fieldStatus),
    ...urlsFromUnknown(programme.crawlLog)
  ].filter(Boolean));

  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && officialIiumUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url, programme),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: url === (programme.officialFeeSourceUrl || masterFinancePdfUrl)
        ? "IIUM official Finance Master Degree Programmes (International) PDF TOTAL source used for the international master fee amount."
        : "Official IIUM source used for the 2026-06-29 master review publication."
    }));
}

function buildIiumUniversitySourceLinks(audit?: IiumMasterAudit): OfficialSourceLink[] {
  const urls = new Set([
    officialWebsite,
    academicsUrl,
    cpsProgrammesUrl,
    cpsApplicationUrl,
    cpsLanguageUrl,
    cpsGeneralAdmissionUrl,
    eAdmissionUrl,
    masterFinancePdfUrl,
    ...urlsFromUnknown(audit?.sourceRegistry),
    ...urlsFromUnknown(audit?.programmeBaseline),
    ...urlsFromUnknown(audit?.programme_baseline)
  ]);
  return Array.from(urls)
    .filter((url) => /^https?:\/\//i.test(url) && officialIiumUrl(url))
    .map((url) => ({
      title: sourceLinkTitle(url),
      url,
      sourceType: sourceLinkType(url),
      verifiedAt,
      status: "official-verified",
      note: "Official IIUM university/programme source used for master review publication."
    }));
}

function buildLanguage(programme: IiumMasterProgramme): LanguageRequirement {
  return {
    ielts: programme.language?.ielts || 0,
    toefl: programme.language?.toefl ?? null,
    pte: programme.language?.pte ?? null,
    muet: programme.language?.muet ?? null
  };
}

function buildLanguageText(programme: IiumMasterProgramme) {
  const parts = [
    programme.language?.ielts ? `IELTS Academic ${formatNumber(programme.language.ielts)} overall band score` : "",
    programme.language?.toefl ? `TOEFL ${programme.language.toefl}` : "",
    programme.language?.pte ? `PTE Academic ${programme.language.pte}` : "",
    programme.language?.muet ? `MUET Band ${programme.language.muet}` : "",
    programme.language?.otherRequirement || "",
    programme.language?.waiver ? `Waiver/assessment note: ${programme.language.waiver}` : ""
  ].filter(Boolean);
  return normalizeLongText([
    `Official direct IELTS requirement retained for list display: IELTS ${formatNumber(programme.language?.ielts || 0)}.`,
    parts.length ? `Official language evidence: ${parts.join("; ")}.` : "",
    "EPT note: IIUM-administered English Proficiency Test (EPT) is a school test pathway published by IIUM; StudyMY keeps EPT in the requirement detail and does not convert EPT to IELTS.",
    programme.fieldStatus?.["language.toefl"]?.note || ""
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirement(programme: IiumMasterProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `Academic level: ${requirement.degreeLevel}.` : "",
    requirement.degreeRelevance ? `Academic relevance: ${requirement.degreeRelevance}.` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `Published GPA threshold: ${requirement.minGPA}/${requirement.gpaScale || 4}.` : "",
    requirement.workExperience ? `Work or experience requirement: ${requirement.workExperience}.` : "",
    "Final equivalency assessment follows IIUM CPS/eAdmission, Kulliyyah and programme-level official requirements."
  ].filter(Boolean).join(" "));
}

function buildAcademicRequirementZh(programme: IiumMasterProgramme) {
  const requirement = programme.entryRequirement || {};
  return normalizeLongText([
    requirement.degreeLevel ? `学历层级：${requirement.degreeLevel}。` : "",
    requirement.degreeRelevance ? `相关背景：${requirement.degreeRelevance}。` : "",
    requirement.gpaNote || "",
    requirement.minGPA ? `官方 GPA 门槛：${requirement.minGPA}/${requirement.gpaScale || 4}。` : "",
    requirement.workExperience ? `工作经验要求：${requirement.workExperience}。` : "",
    "最终等效资格以 IIUM CPS / eAdmission、学院与专业官方要求为准。"
  ].filter(Boolean).join(" "));
}

function buildSpecialRequirements(programme: IiumMasterProgramme) {
  return normalizeLongText([
    programme.studyModeNote || "",
    programme.thesisRequired === true ? "Thesis, dissertation, research project or final project applies where required by the programme structure." : "",
    programme.thesisNote || "",
    programme.interviewRequired ? `Interview or selection review: ${programme.interviewRequired}.` : "",
    programme.interviewNote || "",
    programme.supervisorSystem === true ? "Supervisor or research supervision applies." : "",
    programme.creditHours ? `Credit hours: ${programme.creditHours}.` : "",
    programme.fieldStatus?.creditHours?.note || "",
    programme.fieldStatus?.studyMode?.note || "",
    programme.fieldStatus?.curriculum?.note || ""
  ].filter(Boolean).join(" "));
}

function buildTuitionNote(programme: IiumMasterProgramme) {
  return normalizeLongText([
    programme.tuitionNote || "IIUM Finance official Master Degree Programmes (International) PDF TOTAL fee row.",
    "StudyMY displays the TOTAL programme fee only; optional Mahallah, SST and GRAND TOTAL figures are excluded under Ian-approved review policy."
  ].join(" "));
}

function buildDurationOfficial(programme: IiumMasterProgramme, mode: string) {
  const years = `${programme.duration} ${programme.duration === 1 ? "year" : "years"}`;
  const credit = programme.creditHours ? `Credit hours: ${programme.creditHours}` : "";
  return normalizeText([years, mode, credit, programme.studyModeNote].filter(Boolean).join("; "), 500);
}

function buildCurriculum(programme: IiumMasterProgramme) {
  if (programme.curriculum.length) {
    return arr(
      [`See official IIUM programme source for the curriculum signals of ${programme.nameEn}.`],
      [`See official IIUM programme source for the curriculum signals of ${programme.nameEn}.`],
      programme.curriculum,
      programme.curriculum
    );
  }
  const mode = String(programme.studyMode || "").toLowerCase();
  const zh = mode.includes("research")
    ? ["研究方法或研究准备课程（如学院要求）", "导师指导下的研究工作", "论文撰写与提交"]
    : mode.includes("mixed")
      ? ["课程学习模块", "研究方法或项目准备", "论文、研究项目或毕业项目"]
      : mode.includes("clinical")
        ? ["临床或专业训练模块", "学院规定的专业实践/轮转", "研究、病例或项目要求（如适用）"]
        : ["专业核心课程", "选修或专业方向课程（如学院公布）", "项目、论文或毕业要求（如适用）"];
  return arr(
    ["Official IIUM sources did not publish a complete module-by-module curriculum in the collected evidence; this review display uses a mode-based StudyMY curriculum summary."],
    ["Official IIUM sources did not publish a complete module-by-module curriculum in the collected evidence; this review display uses a mode-based StudyMY curriculum summary."],
    [`官网未公布完整课程结构；以下为按${studyModeDisplay(programme)}路径生成的审核展示摘要`, ...zh],
    [`官網未公布完整課程結構；以下為按${studyModeDisplay(programme)}路徑生成的審核展示摘要`, ...zh]
  );
}

function buildSpecializations(programme: IiumMasterProgramme) {
  const name = programme.nameEn;
  const fieldMatch = name.match(/\(([^)]+)\)/);
  if (!fieldMatch?.[1]) return arr([]);
  const field = fieldMatch[1].trim();
  if (/mixed mode|coursework|research/i.test(field)) return arr([]);
  return arr([field], [field], [translateSpecializationZh(field)], [translateSpecializationZh(field)]);
}

function buildPublicDisplayNote(programme: IiumMasterProgramme, officialCareer: boolean) {
  return normalizeLongText([
    "已依据 IIUM 官方来源上线给 Ian 审核：中文专业名、中文学院、官方总学费、直接 IELTS、EPT 学校测试路径与官方来源链接。",
    "源审计仍为 validated_with_gaps / safe_to_import=false，原因是硕士模式/方向拆分、部分课程结构和学院附加方向仍需后续复核。",
    officialCareer ? "" : "就业方向为 StudyMY 审核展示补充，按专业名称、学院与同类院校常见去向理解性生成，非 IIUM 官方逐字公布。",
    programme.intake.length ? "" : "开学/申请按 CPS 官方全年开放、注册到下一个可用学期展示；不写未验证月份数组。"
  ].filter(Boolean).join(" "));
}

function studyModeDisplay(programme: IiumMasterProgramme) {
  const value = String(programme.studyMode || "").trim().toLowerCase();
  if (value === "coursework") return "Coursework";
  if (value === "mixed") return "Mixed mode";
  if (value === "research") return "Research";
  if (value === "clinical-specialist-training") return "Clinical specialist training";
  return "Mode pending faculty split review";
}

function inferCampus(programme: IiumMasterProgramme) {
  const value = `${programme.nameEn} ${programme.faculty}`.toLowerCase();
  if (/medicine|pharmacy|dentistry|nursing|allied health|science/.test(value)) return "IIUM Kuantan Campus";
  if (/languages|tourism|kstcl|contemporary languages/.test(value)) return "IIUM Pagoh Campus";
  return "IIUM Gombak Campus";
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const value = `${name} ${faculty}`.toLowerCase();
  if (/law|shariah|kulliyyah of laws/.test(value)) return "law";
  if (/business|management|finance|accounting|economics|administration|banking|marketing|halal industry/.test(value)) return "business";
  if (/computer|information technology|ict|library|analytics|protective security|information/.test(value)) return "it";
  if (/engineering|manufacturing|mechatronics|biotechnology engineering|architecture|urban|planning|built environment|quantity surveying/.test(value)) return "engineering";
  if (/medicine|medical|pharmacy|dental|dentistry|nursing|allied health|audiology|optometry|physiotherapy|dietetics|biomedical|speech-language|psychology|radiography|nutrition|health/.test(value)) return "medicine";
  if (/science|biotechnology|mathematical|chemistry|physics|marine|plant|environmental|pharmacy/.test(value)) return "science";
  return "arts";
}

function inferCareerZh(programme: IiumMasterProgramme, category: ProgramCategoryCode) {
  const value = `${programme.nameEn} ${programme.faculty}`.toLowerCase();
  if (/education|teaching|tesl|language education/.test(value)) return ["学校教师或教育管理岗位", "教培行业课程研发与教学岗位", "教育研究或高校相关岗位", "培训与学习发展岗位"];
  if (/law|shariah/.test(value)) return ["法律研究与政策岗位", "合规、法务或公共机构岗位", "伊斯兰法与比较法相关研究岗位", "高校或研究机构岗位"];
  if (/halal/.test(value)) return ["清真产业管理岗位", "清真认证、合规与质量管理岗位", "食品、制药或供应链企业清真事务岗位", "研究机构或行业咨询岗位"];
  if (/architecture/.test(value)) return ["建筑设计与建筑事务所岗位", "建筑项目管理岗位", "城市与建成环境相关岗位", "政府、半政府或高校相关岗位"];
  if (/urban|planning/.test(value)) return ["城市与区域规划顾问", "发展规划与政策研究岗位", "项目管理和城市治理岗位", "政府规划部门或咨询机构岗位"];
  if (/business|management|economics|finance|accounting|marketing|banking/.test(value)) return ["企业管理与战略岗位", "金融、会计、市场或商业分析岗位", "咨询与项目管理岗位", "政府、企业或研究机构经济管理岗位"];
  if (/computer|information technology|analytics|library|security/.test(value)) return ["信息技术与系统管理岗位", "数据分析、商业智能或软件相关岗位", "网络安全、信息治理或知识管理岗位", "高校、研究机构或数字化转型岗位"];
  if (/engineering|manufacturing|mechatronics/.test(value)) return ["工程研发与设计岗位", "制造、质量与生产管理岗位", "技术项目管理岗位", "工程咨询、研究机构或高校岗位"];
  if (/medicine|medical|clinical/.test(value)) return ["医疗机构临床或专科训练相关岗位", "医学研究与公共卫生相关岗位", "医院管理、教学或科研岗位", "政府或专业机构岗位"];
  if (/pharmacy/.test(value)) return ["药学研究与药品开发岗位", "医院、社区或工业药学岗位", "药政、药品注册或质量管理岗位", "高校或研究机构岗位"];
  if (/dental|dentistry/.test(value)) return ["牙科临床或专科相关岗位", "口腔医学研究岗位", "医院、诊所或公共卫生机构岗位", "高校教学与科研岗位"];
  if (/nursing/.test(value)) return ["高级护理实践岗位", "护理管理与护理教育岗位", "临床专科或公共卫生相关岗位", "医院、社区或高校岗位"];
  if (/health|audiology|optometry|physiotherapy|dietetics|nutrition|biomedical|radiography|speech/.test(value)) {
    return ["医院与健康服务机构岗位", "康复、诊断、营养或公共健康相关岗位", "健康科学研究岗位", "高校、政府或专业机构岗位"];
  }
  if (category === "science") return ["科研助理或研究员岗位", "实验室、质量控制或技术服务岗位", "行业研发与项目岗位", "高校、研究机构或政府部门岗位"];
  return ["高校教学与研究岗位", "文化、语言、传播或公共事务岗位", "政府、非营利组织或国际机构岗位", "咨询、培训或内容研究岗位"];
}

function inferCareerEn(programme: IiumMasterProgramme, category: ProgramCategoryCode) {
  return inferCareerZh(programme, category).map((item) => `StudyMY review career display: ${item}`);
}

function translateSpecializationZh(value: string) {
  return value
    .replace(/Mixed Mode/gi, "混合模式")
    .replace(/Research/gi, "研究型")
    .replace(/Halal Industry Science/gi, "清真产业科学")
    .replace(/Computer Science and Information Technology/gi, "计算机科学与信息技术")
    .replace(/Islamic Thought and Civilization/gi, "伊斯兰思想与文明");
}

function sourceLinkTitle(url: string, programme?: IiumMasterProgramme) {
  if (url === officialWebsite) return "IIUM official website";
  if (url === academicsUrl) return "IIUM Academics";
  if (url === cpsProgrammesUrl) return "IIUM CPS Programmes Offered";
  if (url === cpsApplicationUrl) return "IIUM CPS Application Online";
  if (url === cpsLanguageUrl) return "IIUM CPS Language Requirements";
  if (url === cpsGeneralAdmissionUrl) return "IIUM CPS General Admission Requirements";
  if (url === eAdmissionUrl || url.startsWith(eAdmissionUrl)) return "IIUM eAdmission";
  if (url === masterFinancePdfUrl) return "IIUM Finance Master International fee PDF";
  if (programme && url === programme.officialSourceUrl) return "Official programme source";
  if (/pdf/i.test(url)) return "Official IIUM PDF";
  return "Official IIUM source";
}

function sourceLinkType(url: string): OfficialSourceLink["sourceType"] {
  const value = url.toLowerCase();
  if (/fee|finance|tuition/.test(value)) return "fee";
  if (/admission|application|eadmission|cps/.test(value)) return "admission";
  if (/language|requirement/.test(value)) return "entry-requirement";
  if (/academics|programme|program|kulliyyah|postgraduate|master/.test(value)) return "study-portal";
  if (value === officialWebsite) return "profile";
  return "other";
}

function mergeOfficialSources(existing: OfficialSourceLink[], incoming: OfficialSourceLink[]) {
  const byUrl = new Map<string, OfficialSourceLink>();
  for (const link of [...existing, ...incoming]) {
    if (link.url && !byUrl.has(link.url)) byUrl.set(link.url, link);
  }
  return Array.from(byUrl.values());
}

function openIssueSummary(audit: IiumMasterAudit) {
  return [...(audit.pending_issues || []), ...(audit.exception_queue || [])]
    .filter((issue) => !["resolved", "accepted_gap"].includes(String(issue.status || "")))
    .map((issue) => ({
      issue_id: issue.issue_id,
      status: issue.status,
      field: issue.field,
      title: issue.title,
      requiresIanDecision: Boolean(issue.requiresIanDecision)
    }));
}

function officialIiumUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "iium.edu.my" || host.endsWith(".iium.edu.my");
  } catch {
    return false;
  }
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
    if (item && typeof item === "object") {
      Object.values(item as Record<string, unknown>).forEach(visit);
    }
  };
  visit(value);
  return urls.filter((url) => !url.includes("{"));
}

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function localizedArrayHasContent(value?: LocalizedStringArray) {
  return Boolean(value?.["zh-CN"]?.length && value["zh-CN"].every((item) => String(item).trim().length > 0));
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
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
  await runIiumMasterPublication({
    auditPath: resolve(readArgValue("--audit") || DEFAULT_IIUM_MASTER_AUDIT_PATH),
    planOutput: resolve(readArgValue("--plan-output") || DEFAULT_IIUM_MASTER_PUBLISH_PLAN_PATH),
    postImportAuditOutput: resolve(readArgValue("--post-import-audit-output") || DEFAULT_IIUM_MASTER_POST_IMPORT_AUDIT_PATH),
    releaseReportOutput: resolve(readArgValue("--release-report-output") || DEFAULT_IIUM_MASTER_RELEASE_REPORT_PATH),
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
