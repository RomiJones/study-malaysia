import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, type DeepPartial, type EntityManager, In, Like, Not } from "typeorm";
import type {
  FeeAuditStatus,
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
export const UTM_MASTER_IMPORT_SLUG_PREFIX = "utm-master-official-2026-";
export const DEFAULT_UTM_MASTER_CANDIDATE_PATH = resolve(
  repositoryRoot,
  "data/imports/utm/2026-06-17/master/candidate-dataset.json"
);

const verifiedAt = "2026-06-17";
const cnyPerMyr = 1.55;

type StudyMode = "coursework" | "mixed" | "research" | "distance";
type FeeStatus = "verified-official-total" | "conflict" | "official-rate-only";

interface UTMFee {
  status: FeeStatus;
  tuitionAmount: number | null;
  tuitionCurrency: "MYR";
  tuitionBasis: string;
  tuitionAcademicSession: string;
  officialFeeSourceUrl: string;
  tuitionDisplay: string;
  note: string;
}

interface UTMSourceUrls {
  facultyProgrammeList: string;
  internationalPostgraduate: string;
  fees: string;
  entryRequirements: string;
  englishRequirements: string;
  intake: string;
  applicationDocuments: string;
}

export interface UTMMasterCandidateRecord {
  ordinal: number;
  code: string;
  slug: string;
  universityCode: "UTM";
  nameEnOfficial: string;
  level: "master";
  facultyEn: string;
  campus: string;
  studyMode: StudyMode;
  studyModeOfficial: string;
  applicantScope: "international";
  internationalEligibility: "available";
  academicSession: string;
  durationOfficial: string;
  durationYears: number;
  officialIntake: string;
  officialSourceUrl: string;
  fee: UTMFee;
  tuition: {
    status: FeeStatus;
    amountMYR: number | null;
    currency: "MYR";
    basis: string;
    sourceUrl: string;
    note: string;
  };
  academicRequirement: { status: string; sourceUrl: string; summary: string };
  languageRequirement: { status: string; sourceUrl: string; summary: string };
  applicationDocumentsPolicy: { status: string; sourceUrl: string; documents: string[] };
  sourceUrls: UTMSourceUrls;
  evidence: Array<Record<string, unknown>>;
  fieldCoverage: Record<string, string>;
  publicDisplayStatus: "ready";
  reviewReason: string;
  reviewedDecisions: string[];
}

export interface UTMMasterCandidateDataset {
  universityCode: "UTM";
  level: "master";
  applicantScope: "international";
  academicSession: string;
  programmeCount: number;
  statusPartition: {
    ready: number;
    needsReview: number;
    notAvailableForInternational: number;
  };
  programmes: UTMMasterCandidateRecord[];
}

interface UTMMasterImportSummary {
  candidateRows: number;
  importRows: number;
  readyRows: number;
  uniqueSlugs: number;
  officialTotalFeeRows: number;
  officialRateOnlyRows: number;
  conflictFeeRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
  modes: Record<string, number>;
}

interface UTMMasterImportVerification {
  importedRows: number;
  readyRows: number;
  publishedRows: number;
  legacyMasterPublicRows: number;
  officialTotalFeeRows: number;
  officialRateOnlyRows: number;
  conflictFeeRows: number;
  noScalarTotalRows: number;
  languageRows: number;
  sourceLinkedRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

const t = (en: string, zhCN = en, zhTW = zhCN, ms = en): LocalizedText => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });
const arr = (en: string[], zhCN = en, zhTW = zhCN, ms = en): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

function countBy<T>(items: T[], getter: (item: T) => string | null | undefined) {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item) || "unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function loadJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`UTM master candidate not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function normalizeText(value: string | null | undefined, maxLength = 1800) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function inferCategory(name: string, faculty: string): ProgramCategoryCode {
  const haystack = `${name} ${faculty}`.toLowerCase();
  if (/computer|software|artificial intelligence|data|cyber|information technology|multimedia/.test(haystack)) return "it";
  if (/architecture|planning|built environment|education|language|psychology|islamic|tourism|design|social/.test(haystack)) return "arts";
  if (/business|management|accounting|finance|entrepreneurship|administration/.test(haystack)) return "business";
  if (/engineering|geomatics|chemical|mechanical|electrical|electronic|petroleum|nuclear|marine|offshore|construction/.test(haystack)) {
    return "engineering";
  }
  return "science";
}

function localizedProgrammeName(name: string): LocalizedText {
  return t(name, `${name}（UTM 官方硕士项目）`, `${name}（UTM 官方碩士項目）`, name);
}

function localizedFaculty(faculty: string): LocalizedText {
  return t(faculty, faculty, faculty, faculty);
}

function studyModeDisplay(mode: StudyMode, official: string) {
  if (mode === "distance") return official || "Open and Distance Learning";
  if (mode === "mixed") return official || "Mixed mode";
  if (mode === "research") return official || "Research";
  return official || "Coursework";
}

function annualTuitionCny(totalMyr: number | null, years: number) {
  if (!totalMyr) return 0;
  return Math.round((totalMyr / Math.max(years, 1)) * cnyPerMyr);
}

function feePresentation(candidate: UTMMasterCandidateRecord): {
  amount: number | null;
  currency: TuitionCurrency;
  display: string;
  note: string;
  sourceUrl: string;
  auditStatus: FeeAuditStatus;
  officialTuitionMYR: number | null;
} {
  const fee = candidate.fee;
  if (fee.status === "verified-official-total") {
    const amount = fee.tuitionAmount ?? candidate.tuition.amountMYR;
    if (!amount) throw new Error(`Row ${candidate.ordinal} has verified-official-total without amount.`);
    return {
      amount,
      currency: "MYR",
      display: fee.tuitionDisplay || `MYR ${amount.toLocaleString("en-US")} total programme fee`,
      note: `UTM official international postgraduate fee source: ${fee.note}`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "matched-official",
      officialTuitionMYR: amount
    };
  }
  if (fee.status === "official-rate-only") {
    return {
      amount: null,
      currency: "MYR",
      display: "UTM publishes an official rate basis only; no single total programme fee is displayed.",
      note: `No StudyMY scalar total is written because UTM publishes rate-only fee information for this row. Official note: ${fee.note}`,
      sourceUrl: fee.officialFeeSourceUrl,
      auditStatus: "official-rate-verified",
      officialTuitionMYR: null
    };
  }
  return {
    amount: null,
    currency: "MYR",
    display: "UTM publishes non-primary fee information; no single total programme fee is displayed.",
    note: `No StudyMY scalar total is written because UTM publishes more than one applicable fee value or a non-primary total. Official note: ${fee.note}`,
    sourceUrl: fee.officialFeeSourceUrl,
    auditStatus: "not-published",
    officialTuitionMYR: null
  };
}

function sourceLinks(candidate: UTMMasterCandidateRecord): OfficialSourceLink[] {
  const links: OfficialSourceLink[] = [
    {
      title: "UTM official postgraduate programme list",
      url: candidate.sourceUrls.facultyProgrammeList || candidate.officialSourceUrl,
      sourceType: "admission",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international postgraduate study",
      url: candidate.sourceUrls.internationalPostgraduate,
      sourceType: "admission",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international postgraduate fee source",
      url: candidate.fee.officialFeeSourceUrl || candidate.sourceUrls.fees,
      sourceType: "fee",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international postgraduate entry requirements",
      url: candidate.sourceUrls.entryRequirements,
      sourceType: "entry-requirement",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM English language requirements",
      url: candidate.sourceUrls.englishRequirements,
      sourceType: "entry-requirement",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM postgraduate intake FAQ",
      url: candidate.sourceUrls.intake,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified"
    },
    {
      title: "UTM international student registration documents",
      url: candidate.sourceUrls.applicationDocuments,
      sourceType: "official-website",
      verifiedAt,
      status: "official-verified"
    }
  ];
  return links.filter((link, index, array) => link.url && array.findIndex((item) => item.url === link.url && item.title === link.title) === index);
}

export function validateUtmMasterCandidate(dataset: UTMMasterCandidateDataset) {
  const errors: string[] = [];
  if (dataset.universityCode !== "UTM") errors.push("Candidate universityCode must be UTM.");
  if (dataset.level !== "master") errors.push("Candidate level must be master.");
  if (dataset.applicantScope !== "international") errors.push("Candidate applicantScope must be international.");
  if (dataset.programmeCount !== dataset.programmes.length) errors.push("programmeCount must match programmes length.");
  if (dataset.programmes.length !== 153) errors.push(`Expected 153 canonical UTM master rows; got ${dataset.programmes.length}.`);
  if (dataset.statusPartition.ready !== 153 || dataset.statusPartition.needsReview !== 0 || dataset.statusPartition.notAvailableForInternational !== 0) {
    errors.push("Expected UTM master status partition to be 153 ready, 0 needs-review, 0 not-available-for-international.");
  }
  if (new Set(dataset.programmes.map((item) => item.code)).size !== dataset.programmes.length) errors.push("Candidate codes must be unique.");
  if (new Set(dataset.programmes.map((item) => item.slug)).size !== dataset.programmes.length) errors.push("Candidate slugs must be unique.");
  const feeCounts = countBy(dataset.programmes, (item) => item.fee.status);
  if (feeCounts["verified-official-total"] !== 132) errors.push(`Expected 132 verified official total fees; got ${feeCounts["verified-official-total"] || 0}.`);
  if (feeCounts.conflict !== 7) errors.push(`Expected 7 conflict fee rows; got ${feeCounts.conflict || 0}.`);
  if (feeCounts["official-rate-only"] !== 14) errors.push(`Expected 14 official-rate-only rows; got ${feeCounts["official-rate-only"] || 0}.`);
  for (const record of dataset.programmes) {
    if (record.level !== "master") errors.push(`Row ${record.ordinal} is not master level.`);
    if (record.applicantScope !== "international") errors.push(`Row ${record.ordinal} is not international applicant scope.`);
    if (record.internationalEligibility !== "available") errors.push(`Row ${record.ordinal} is not marked available to international applicants.`);
    if (record.publicDisplayStatus !== "ready") errors.push(`Row ${record.ordinal} is not ready.`);
    if (!record.nameEnOfficial) errors.push(`Row ${record.ordinal} has no official English name.`);
    if (!record.facultyEn) errors.push(`Row ${record.ordinal} has no faculty.`);
    if (!record.officialSourceUrl) errors.push(`Row ${record.ordinal} has no official source URL.`);
    if (!record.fee.officialFeeSourceUrl) errors.push(`Row ${record.ordinal} has no official fee source URL.`);
    if (record.fee.status === "verified-official-total" && !record.fee.tuitionAmount) {
      errors.push(`Row ${record.ordinal} verified official total fee has no amount.`);
    }
  }
  return errors;
}

export function buildUtmMasterProgramRows(dataset: UTMMasterCandidateDataset): Array<DeepPartial<ProgramEntity>> {
  return dataset.programmes.map((candidate) => {
    const fee = feePresentation(candidate);
    const faculty = localizedFaculty(candidate.facultyEn);
    const sourceStatus: OfficialSourceStatus = "official-verified";
    const publicDisplayStatus: PublicDisplayStatus = "ready";
    const applicationDocuments = candidate.applicationDocumentsPolicy.documents.length
      ? candidate.applicationDocumentsPolicy.documents
      : ["Passport", "Academic certificates", "Academic transcripts", "English language result"];
    const noScalarTotal = fee.officialTuitionMYR == null;
    return {
      slug: `${UTM_MASTER_IMPORT_SLUG_PREFIX}${String(candidate.ordinal).padStart(3, "0")}-${slugify(candidate.nameEnOfficial)}`,
      code: candidate.code,
      name: localizedProgrammeName(candidate.nameEnOfficial),
      nameEnOfficial: candidate.nameEnOfficial,
      level: "master",
      category: inferCategory(candidate.nameEnOfficial, candidate.facultyEn),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: studyModeDisplay(candidate.studyMode, candidate.studyModeOfficial),
      campus: candidate.campus,
      durationYears: candidate.durationYears,
      durationOfficial: candidate.durationOfficial,
      annualTuitionCny: annualTuitionCny(fee.officialTuitionMYR, candidate.durationYears),
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: fee.officialTuitionMYR,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: fee.sourceUrl,
      secondaryOfficialFeeSourceUrl: candidate.sourceUrls.fees,
      officialFeeAuditStatus: fee.auditStatus,
      officialFeeAuditedAt: verifiedAt,
      intakeMonths: ["February", "September"],
      officialIntake: normalizeText(candidate.officialIntake, 255),
      officialIntakeNote: "Captured from UTM official postgraduate admission FAQ and ODL intake page where applicable.",
      languageRequirement: { ielts: 6, toefl: null, pte: null, muet: null },
      officialLanguageRequirement: normalizeText(candidate.languageRequirement.summary),
      requirement: {
        gpa: 0,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          candidate.academicRequirement.summary,
          "以 UTM 官方硕士入学要求为准：申请人需具备认可本科荣誉学位或参议院认可的同等资格与经验。",
          "以 UTM 官方碩士入學要求為準：申請人需具備認可本科榮譽學位或參議院認可的同等資格與經驗。",
          candidate.academicRequirement.summary
        )
      },
      officialAcademicRequirement: normalizeText(candidate.academicRequirement.summary),
      chinaStudentRequirement: "Chinese applicants must follow UTM international postgraduate academic, English, visa and registration document rules; final equivalency is assessed by UTM.",
      specialRequirementsNote: noScalarTotal
        ? "Fee source is retained exactly as official evidence, but no single total programme fee is displayed because UTM does not publish one unique scalar total for this row."
        : `International eligibility status: ${candidate.internationalEligibility}.`,
      applicationDocs: arr(
        applicationDocuments,
        ["UTM 录取信", "白底照片", "护照", "学历证书", "成绩单", "健康状况声明表", "如适用，提交资格信/无异议信"],
        ["UTM 錄取信", "白底照片", "護照", "學歷證書", "成績單", "健康狀況聲明表", "如適用，提交資格信/無異議信"],
        applicationDocuments
      ),
      curriculum: arr([]),
      careers: arr(["UTM does not publish a structured career list for this programme in the collected official source."]),
      specializations: arr([]),
      description: t(
        `${candidate.nameEnOfficial} is listed by UTM for international postgraduate admission under ${candidate.facultyEn}.`,
        `${candidate.nameEnOfficial} 已列入 UTM 国际硕士招生目录，隶属 ${candidate.facultyEn}。`,
        `${candidate.nameEnOfficial} 已列入 UTM 國際碩士招生目錄，隸屬 ${candidate.facultyEn}。`,
        `${candidate.nameEnOfficial} is listed by UTM for international postgraduate admission under ${candidate.facultyEn}.`
      ),
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
      officialSourceUrl: candidate.officialSourceUrl,
      officialEntryRequirementSourceUrl: candidate.academicRequirement.sourceUrl,
      officialAccreditationSourceUrl: candidate.officialSourceUrl,
      sourceUrls: sourceLinks(candidate),
      officialVerifiedAt: verifiedAt,
      officialSourceStatus: sourceStatus,
      publicDisplayStatus,
      publicDisplayNote: noScalarTotal
        ? "Published from official UTM postgraduate sources; fee field is displayed as official non-scalar evidence without a StudyMY total amount."
        : "Published from official UTM postgraduate sources; StudyMY localisations are non-official.",
      reviewReason: noScalarTotal ? `Official fee status retained: ${candidate.fee.status}. ${candidate.fee.note}` : null,
      auditNote: [
        `Imported from UTM master official candidate ordinal ${candidate.ordinal}.`,
        `Official candidate slug: ${candidate.slug}.`,
        `Official mode: ${candidate.studyModeOfficial}.`,
        `Fee status: ${candidate.fee.status}.`,
        `Field coverage: ${JSON.stringify(candidate.fieldCoverage)}.`,
        `Reviewed decisions: ${JSON.stringify(candidate.reviewedDecisions || [])}.`
      ].join(" "),
      listTuitionText: fee.display,
      isPublished: true
    };
  });
}

export function summarizeUtmMasterImport(dataset: UTMMasterCandidateDataset, rows: Array<DeepPartial<ProgramEntity>>): UTMMasterImportSummary {
  return {
    candidateRows: dataset.programmes.length,
    importRows: rows.length,
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready" && row.isPublished).length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    officialTotalFeeRows: rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official").length,
    officialRateOnlyRows: rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified").length,
    conflictFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "not-published").length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus)),
    modes: countBy(rows, (row) => String(row.studyMode))
  };
}

function verifyUtmMasterImportedRecordSet(rows: ProgramEntity[], legacyMasterPublicRows: number, expectedRows: number): UTMMasterImportVerification {
  const readyRows = rows.filter((row) => row.publicDisplayStatus === "ready");
  const publishedRows = rows.filter((row) => row.isPublished);
  const officialTotalFeeRows = rows.filter((row) => row.officialTuitionMYR != null && row.officialFeeAuditStatus === "matched-official");
  const officialRateOnlyRows = rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified" && row.officialTuitionMYR == null);
  const conflictFeeRows = rows.filter((row) => row.officialFeeAuditStatus === "not-published" && row.officialTuitionMYR == null);
  const noScalarTotalRows = rows.filter((row) => row.officialTuitionMYR == null && row.tuitionAmount == null).length;
  const languageRows = rows.filter((row) => Number(row.languageRequirement?.ielts || 0) >= 6).length;
  const sourceLinkedRows = rows.filter((row) => (row.sourceUrls || []).length >= 5).length;
  if (
    rows.length !== expectedRows ||
    readyRows.length !== expectedRows ||
    publishedRows.length !== expectedRows ||
    officialTotalFeeRows.length !== 132 ||
    officialRateOnlyRows.length !== 14 ||
    conflictFeeRows.length !== 7 ||
    noScalarTotalRows !== 21 ||
    languageRows !== expectedRows ||
    sourceLinkedRows !== expectedRows ||
    legacyMasterPublicRows !== 0
  ) {
    throw new Error(
      `UTM master import verification failed: expected=${expectedRows}, actual=${rows.length}, ready=${readyRows.length}, published=${publishedRows.length}, officialTotal=${officialTotalFeeRows.length}, rateOnly=${officialRateOnlyRows.length}, conflict=${conflictFeeRows.length}, noScalarTotal=${noScalarTotalRows}, language=${languageRows}, sourceLinks=${sourceLinkedRows}, legacyPublic=${legacyMasterPublicRows}.`
    );
  }
  return {
    importedRows: rows.length,
    readyRows: readyRows.length,
    publishedRows: publishedRows.length,
    legacyMasterPublicRows,
    officialTotalFeeRows: officialTotalFeeRows.length,
    officialRateOnlyRows: officialRateOnlyRows.length,
    conflictFeeRows: conflictFeeRows.length,
    noScalarTotalRows,
    languageRows,
    sourceLinkedRows,
    publicDisplayStatusCounts: countBy(rows, (row) => row.publicDisplayStatus),
    officialSourceStatusCounts: countBy(rows, (row) => row.officialSourceStatus),
    feeAuditStatusCounts: countBy(rows, (row) => row.officialFeeAuditStatus)
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number, expectedRows: number) {
  const repository = manager.getRepository(ProgramEntity);
  const rows = await repository.find({ where: { universityId, slug: Like(`${UTM_MASTER_IMPORT_SLUG_PREFIX}%`) } });
  const legacyMasterPublicRows = await repository.count({
    where: {
      universityId,
      level: "master",
      isPublished: true,
      publicDisplayStatus: "ready",
      slug: Not(Like(`${UTM_MASTER_IMPORT_SLUG_PREFIX}%`))
    }
  });
  return verifyUtmMasterImportedRecordSet(rows, legacyMasterPublicRows, expectedRows);
}

async function visibleLevelSummary(repository: ReturnType<EntityManager["getRepository"]>, universityId: number, level: "bachelor" | "master" | "phd") {
  const rows = await repository.find({
    where: { universityId, level, isPublished: true, publicDisplayStatus: In(["ready", "not-available-for-international"]) }
  });
  return {
    total: rows.length,
    ready: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReview: 0,
    notAvailableForInternational: rows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length
  };
}

async function updateUniversityAfterMasterImport(manager: EntityManager, university: UniversityEntity, summary: UTMMasterImportSummary) {
  const programRepo = manager.getRepository(ProgramEntity);
  const universityRepo = manager.getRepository(UniversityEntity);
  const bachelor = await visibleLevelSummary(programRepo, university.id, "bachelor");
  const master = {
    total: summary.importRows,
    ready: summary.readyRows,
    needsReview: 0,
    notAvailableForInternational: 0
  };
  const phd = await visibleLevelSummary(programRepo, university.id, "phd");
  const all = {
    total: bachelor.total + master.total + phd.total,
    ready: bachelor.ready + master.ready + phd.ready,
    needsReview: 0,
    notAvailableForInternational: bachelor.notAvailableForInternational + master.notAvailableForInternational + phd.notAvailableForInternational
  };
  university.programCount = all.total;
  university.officialProfile = {
    ...(university.officialProfile || {}),
    collectionScope: "UTM official international bachelor and master catalogue import",
    masterCollectionScope: "UTM official international postgraduate master candidate import",
    masterAcademicSession: "2026/2027",
    cnyDisplayRateNote: `CNY display uses internal review conversion ${cnyPerMyr} CNY/MYR and is not an official UTM amount.`,
    catalogStatusSummary: {
      all,
      byLevel: { bachelor, master, phd }
    }
  };
  university.officialAuditSummary = `UTM official catalogue import: ${bachelor.total} bachelor rows and ${master.total} master rows are public-visible from official UTM sources. Master fees include ${summary.officialTotalFeeRows} official total rows and ${summary.officialRateOnlyRows + summary.conflictFeeRows} rows retained without a StudyMY scalar total.`;
  university.officialVerifiedAt = verifiedAt;
  university.officialSourceStatus = "official-verified";
  university.publicDisplayStatus = "ready";
  university.isPublished = true;
  await universityRepo.save(university);
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
  const candidatePath = resolve(readArgValue("--candidate") || DEFAULT_UTM_MASTER_CANDIDATE_PATH);
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/utm-master-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const dataset = loadJson<UTMMasterCandidateDataset>(candidatePath);
  const errors = validateUtmMasterCandidate(dataset);
  if (errors.length) throw new Error(`UTM master candidate validation failed:\n${errors.join("\n")}`);
  const rows = buildUtmMasterProgramRows(dataset);
  const summary = summarizeUtmMasterImport(dataset, rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const dryRun = !verifyOnly && !process.argv.includes("--confirm-import");

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          universityCode: "UTM",
          scope: "master",
          candidatePath,
          writePolicy: {
            upsertPrefix: UTM_MASTER_IMPORT_SLUG_PREFIX,
            importRows: rows.length,
            publicVisibleRows: rows.length,
            publicReadyRows: rows.length,
            archiveLegacyPublicMasterRows: true,
            preserveBachelorRows: true,
            feePolicy: {
              officialTotalRows: summary.officialTotalFeeRows,
              officialRateOnlyRows: summary.officialRateOnlyRows,
              conflictRows: summary.conflictFeeRows,
              nonScalarRowsDisplayNoStudyMYTotal: summary.officialRateOnlyRows + summary.conflictFeeRows
            }
          },
          summary,
          nextStep: "Review this output, then rerun with --confirm-import to create a backup and write transactionally."
        },
        null,
        2
      )
    );
    return;
  }

  loadEnvFiles();
  const dataSource = new DataSource({
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

  await dataSource.initialize();
  try {
    const universityRepository = dataSource.getRepository(UniversityEntity);
    const university = await universityRepository.findOne({ where: { code: "UTM" } });
    if (!university) throw new Error("UTM university row not found.");

    if (verifyOnly) {
      const verification = await verifyImportedRows(dataSource, university.id, rows.length);
      console.log(JSON.stringify({ mode: "verified", universityId: university.id, summary, verification, universityProgramCount: university.programCount }, null, 2));
      return;
    }

    const currentPrograms = await dataSource.getRepository(ProgramEntity).find({ where: { universityId: university.id } });
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2), "utf8");

    let verification: UTMMasterImportVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const programRepo = manager.getRepository(ProgramEntity);
      const universityRepo = manager.getRepository(UniversityEntity);
      const transactionUniversity = await universityRepo.findOne({ where: { code: "UTM" } });
      if (!transactionUniversity) throw new Error("UTM university row not found inside transaction.");
      const incomingSlugs = new Set(rows.map((row) => String(row.slug)));
      const currentMaster = await programRepo.find({ where: { universityId: transactionUniversity.id, level: "master" } });
      for (const existing of currentMaster) {
        if (incomingSlugs.has(existing.slug)) continue;
        if (existing.slug.startsWith(UTM_MASTER_IMPORT_SLUG_PREFIX)) {
          await programRepo.remove(existing);
          continue;
        }
        existing.isPublished = false;
        existing.publicDisplayStatus = "archived";
        existing.publicDisplayNote = "Archived by UTM master official import to prevent duplicate public-list leakage.";
        existing.reviewReason = "Superseded by the audited UTM official master catalogue dataset.";
        await programRepo.save(existing);
      }

      for (const row of rows) {
        const existing = await programRepo.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== transactionUniversity.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await programRepo.save(programRepo.create({ ...row, id: existing?.id, universityId: transactionUniversity.id }));
      }
      verification = await verifyImportedRows(manager, transactionUniversity.id, rows.length);
      await updateUniversityAfterMasterImport(manager, transactionUniversity, summary);
    });
    const cacheCleared = await clearCatalogCache();
    const refreshedUniversity = await universityRepository.findOne({ where: { code: "UTM" } });

    console.log(
      JSON.stringify(
        {
          mode: "imported",
          universityId: refreshedUniversity?.id,
          backupPath,
          summary,
          verification,
          universityProgramCount: refreshedUniversity?.programCount,
          cacheCleared
        },
        null,
        2
      )
    );
  } finally {
    await dataSource.destroy();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
