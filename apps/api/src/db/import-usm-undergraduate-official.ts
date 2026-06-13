import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DataSource, Like, type DeepPartial, type EntityManager } from "typeorm";
import type {
  FeeAuditStatus,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  OfficialSourceStatus,
  ProgramCategoryCode,
  PublicDisplayStatus
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

export const USM_UNDERGRADUATE_IMPORT_SLUG_PREFIX = "usm-ug-official-2026-row-";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const DEFAULT_USM_UNDERGRADUATE_MANIFEST_PATH = resolve(
  repositoryRoot,
  "data/imports/usm/2026-06-12/undergraduate-manifest.json"
);
export const DEFAULT_USM_UNDERGRADUATE_DETAILS_PATH = resolve(
  repositoryRoot,
  "data/imports/usm/2026-06-12/undergraduate-details-parsed.json"
);
const undergraduatePageUrl = "https://admission.usm.my/index.php/main/undergraduate/international";
const undergraduateCsvUrl = "https://admission.usm.my/images/data/antarbangsa.csv";
const undergraduateFeeUrl =
  "https://admission.usm.my/images/00uginternational/fee_2025/UNDERGRADUATE_INTERNATIONAL_TUITION_FEES_PER_SEMESTER.pdf";
const undergraduateBookletUrl =
  "https://admission.usm.my/images/00uginternational/download_2025/BOOKLET_INTERNATIONAL_2025-2026.pdf";

interface ManifestEvidence {
  field: string;
  sourceId: string;
  sourceUrl: string;
  sourcePage: number | null;
  sourceText: string;
  retrievedAt: string;
  confidence: number;
}

export interface UsmUndergraduateManifestRecord {
  rowNumber: number;
  code: string;
  nameEnOfficial: string;
  level: "bachelor";
  category: ProgramCategoryCode;
  universityCode: "USM";
  facultyEn: string;
  studyMode: string;
  campus: string;
  internationalEligibility: "available" | "not-available" | "unknown";
  officialSourceUrl: string;
  officialVerifiedAt: string;
  officialSourceStatus: OfficialSourceStatus;
  publicDisplayStatus: PublicDisplayStatus;
  evidence: ManifestEvidence[];
  totalTuitionCandidateUSD?: number | null;
  welfareFeePerSemesterCandidateUSD?: number | null;
  registrationFeeCandidateUSD?: number | null;
  tuitionBasis?: string | null;
  officialFeeSourceUrl?: string | null;
  pdfPerSemesterCandidateUSD?: number | null;
  feeCrossCheckStatus?: string | null;
  detailVerified?: boolean;
  qualityFlags?: string[];
  generalAcademicRequirement?: string | null;
  generalLanguageRequirement?: string | null;
  auditNote?: string | null;
}

export interface UsmUndergraduateManifest {
  universityCode: "USM";
  academicSession: string;
  retrievedAt: string;
  records: UsmUndergraduateManifestRecord[];
}

export interface UsmUndergraduateDetail {
  url: string;
  code: string;
  name: string;
  durationOfficial: string;
  mediumInstruction: string;
  semesterOffered: string;
  ieltsMinimum: number | null;
  interviewRequired: boolean;
  feeRows: Array<{ label: string; value: string }>;
  courseSectionCount: number;
  careerCount: number;
  careers: string[];
}

interface ImportSummary {
  manifestRows: number;
  uniqueSlugs: number;
  detailVerifiedRows: number;
  uniqueDetailVerifiedCodes: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
  invalidCodeRows: number;
  duplicateCodeGroups: number;
}

export interface UsmUndergraduateImportVerification {
  importedRows: number;
  publishedRows: number;
  readyRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

function localizedText(value: string): LocalizedText {
  return { en: value, ms: value, "zh-CN": value, "zh-TW": value };
}

function localizedArray(value: string[]): LocalizedStringArray {
  return { en: value, ms: value, "zh-CN": value, "zh-TW": value };
}

function readArgValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function countBy<T>(items: T[], readKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = readKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function formatUsd(value: number | null | undefined) {
  if (value == null) return "";
  return `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseDurationYears(value: string | undefined): number {
  if (!value) return 0;
  const mixedYear = value.match(/(\d+)\s+1\/2\s*(?:years?|tahun)/i);
  if (mixedYear) return Number(mixedYear[1]) + 0.5;
  const year = value.match(/(\d+(?:\.\d+)?)\s*(?:years?|year|tahun)/i);
  if (year) return Number(year[1]);
  const semester = value.match(/(?:minimum\s+)?(\d+)\s*semesters?/i);
  if (semester) return Number(semester[1]) / 2;
  return 0;
}

function parseIntakeMonths(value: string | undefined): string[] {
  if (!value) return [];
  return ["March", "October"].filter((month) => value.toLowerCase().includes(month.toLowerCase()));
}

function feeAuditStatus(record: UsmUndergraduateManifestRecord): FeeAuditStatus {
  if (record.officialSourceStatus === "source-conflict") return "source-conflict";
  if (record.feeCrossCheckStatus?.includes("conflict")) return "source-conflict";
  if (record.detailVerified && record.feeCrossCheckStatus === "consistent-integer-semesters") return "matched-official";
  return "pending-review";
}

function buildSourceLinks(
  record: UsmUndergraduateManifestRecord,
  detail: UsmUndergraduateDetail | undefined
): OfficialSourceLink[] {
  const status = record.officialSourceStatus;
  const links: OfficialSourceLink[] = [
    {
      title: "USM international undergraduate catalogue",
      url: undergraduatePageUrl,
      sourceType: "admission",
      verifiedAt: record.officialVerifiedAt,
      status
    },
    {
      title: "USM international undergraduate CSV",
      url: undergraduateCsvUrl,
      sourceType: "official-website",
      verifiedAt: record.officialVerifiedAt,
      status
    },
    {
      title: "USM international undergraduate fee table",
      url: undergraduateFeeUrl,
      sourceType: "fee",
      verifiedAt: record.officialVerifiedAt,
      status
    },
    {
      title: "USM international undergraduate booklet 2025/2026",
      url: undergraduateBookletUrl,
      sourceType: "entry-requirement",
      verifiedAt: record.officialVerifiedAt,
      status: "needs-review",
      note: "Academic session is older than the current 2026 catalogue page."
    }
  ];
  if (detail) {
    links.unshift({
      title: "USM official programme detail",
      url: detail.url,
      sourceType: "profile",
      verifiedAt: record.officialVerifiedAt,
      status
    });
  }
  return links;
}

function buildFeeNote(record: UsmUndergraduateManifestRecord, detail: UsmUndergraduateDetail | undefined) {
  const parts = [
    record.totalTuitionCandidateUSD != null
      ? `Candidate total tuition: ${formatUsd(record.totalTuitionCandidateUSD)} (${record.tuitionBasis || "basis unknown"}).`
      : "Candidate total tuition was not published.",
    record.pdfPerSemesterCandidateUSD != null
      ? `Official fee PDF candidate: ${formatUsd(record.pdfPerSemesterCandidateUSD)} per semester.`
      : null,
    record.welfareFeePerSemesterCandidateUSD != null
      ? `Recurrent welfare fee: ${formatUsd(record.welfareFeePerSemesterCandidateUSD)} per semester.`
      : null,
    record.registrationFeeCandidateUSD != null
      ? `Registration fee: ${formatUsd(record.registrationFeeCandidateUSD)}.`
      : null,
    detail ? "Programme detail page was captured and cross-checked." : "Programme detail page was not captured in this run."
  ];
  return parts.filter(Boolean).join(" ");
}

function buildReviewReason(record: UsmUndergraduateManifestRecord) {
  const flags = record.qualityFlags || [];
  if (flags.length) return `Collection quality flags: ${flags.join(", ")}.`;
  return "Imported as an unpublished review candidate; publication requires manual approval and localized content review.";
}

export function validateUsmUndergraduateManifest(manifest: UsmUndergraduateManifest) {
  const errors: string[] = [];
  if (manifest.universityCode !== "USM") errors.push("Manifest universityCode must be USM.");
  if (!manifest.records.length) errors.push("Manifest has no programme records.");
  const rowNumbers = new Set<number>();
  for (const record of manifest.records) {
    if (record.universityCode !== "USM") errors.push(`Row ${record.rowNumber} has another university code.`);
    if (record.level !== "bachelor") errors.push(`Row ${record.rowNumber} is not bachelor level.`);
    if (rowNumbers.has(record.rowNumber)) errors.push(`Duplicate manifest rowNumber ${record.rowNumber}.`);
    rowNumbers.add(record.rowNumber);
    if (!record.officialSourceUrl.startsWith("https://admission.usm.my/")) {
      errors.push(`Row ${record.rowNumber} has a non-USM source URL.`);
    }
  }
  return errors;
}

export function buildUsmUndergraduateProgramRows(
  manifest: UsmUndergraduateManifest,
  details: UsmUndergraduateDetail[]
): DeepPartial<ProgramEntity>[] {
  const detailByCode = new Map(details.map((detail) => [detail.code, detail]));
  const applicationDocs = [
    "Academic certificates and transcripts",
    "Certified English translations when documents are not in English",
    "English language result or accepted medium-of-instruction evidence",
    "Passport details",
    "Scholarship letter when applicable",
    "Application fee receipt"
  ];

  return manifest.records.map((record) => {
    const detail = record.detailVerified ? detailByCode.get(record.code) : undefined;
    const officialName = detail?.name || record.nameEnOfficial;
    const tuitionDisplay =
      record.totalTuitionCandidateUSD == null
        ? "Official tuition pending review"
        : `${formatUsd(record.totalTuitionCandidateUSD)} total programme candidate`;
    const exactIntegerTuition =
      record.totalTuitionCandidateUSD != null && Number.isInteger(record.totalTuitionCandidateUSD)
        ? record.totalTuitionCandidateUSD
        : null;
    const auditParts = [
      record.auditNote,
      `Imported from USM undergraduate manifest row ${record.rowNumber}; retained as unpublished review data.`,
      "Exact USD decimals are preserved in tuitionDisplay and officialTuitionNote; tuitionAmount is null when the database integer column cannot preserve the source value.",
      `Evidence: ${JSON.stringify(record.evidence)}`
    ];
    const publicDisplayStatus =
      record.publicDisplayStatus === "ready" ? "needs-review" : record.publicDisplayStatus;

    return {
      slug: `${USM_UNDERGRADUATE_IMPORT_SLUG_PREFIX}${String(record.rowNumber).padStart(3, "0")}-${record.code.toLowerCase()}`,
      code: record.code,
      name: localizedText(officialName),
      nameEnOfficial: officialName,
      level: "bachelor",
      category: record.category,
      faculty: localizedText(record.facultyEn || "Official faculty pending review"),
      facultyZh: "",
      studyMode: record.studyMode || "unknown",
      campus: record.campus || "",
      durationYears: parseDurationYears(detail?.durationOfficial),
      durationOfficial: detail?.durationOfficial || "Official duration pending programme-detail verification",
      annualTuitionCny: 0,
      tuitionAmount: exactIntegerTuition,
      tuitionCurrency: "USD",
      tuitionDisplay,
      officialTuitionMYR: null,
      officialTuitionNote: buildFeeNote(record, detail),
      officialFeeSourceUrl: record.pdfPerSemesterCandidateUSD != null ? undergraduateFeeUrl : undergraduateCsvUrl,
      secondaryOfficialFeeSourceUrl: undergraduateCsvUrl,
      officialFeeAuditStatus: feeAuditStatus(record),
      officialFeeAuditedAt: record.officialVerifiedAt,
      intakeMonths: parseIntakeMonths(detail?.semesterOffered),
      officialIntake: detail?.semesterOffered || "",
      officialIntakeNote: detail
        ? "Intake text captured from the official programme detail page."
        : "Programme-specific intake pending detail-page verification.",
      languageRequirement: {
        ielts: detail?.ieltsMinimum || 0,
        toefl: null,
        pte: null,
        muet: null
      },
      officialLanguageRequirement:
        detail?.ieltsMinimum != null
          ? `IELTS ${detail.ieltsMinimum}; ${detail.mediumInstruction || "official detail page applies"}.`
          : record.generalLanguageRequirement || null,
      requirement: {
        gpa: 0,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: localizedText(record.generalAcademicRequirement || "Official programme-specific requirement pending review.")
      },
      officialAcademicRequirement: record.generalAcademicRequirement || null,
      chinaStudentRequirement: "No China-specific official requirement was identified in the collected sources.",
      specialRequirementsNote: detail?.interviewRequired ? "Official detail page indicates an interview is required." : null,
      applicationDocs: localizedArray(applicationDocs),
      curriculum: localizedArray([]),
      careers: localizedArray(detail?.careers || []),
      specializations: localizedArray([]),
      description: localizedText(
        `${officialName} is listed in the USM international undergraduate catalogue under ${record.facultyEn || "an official school pending review"}.`
      ),
      officialAccreditationNote: null,
      officialSourceUrl: detail?.url || record.officialSourceUrl,
      officialEntryRequirementSourceUrl: undergraduateBookletUrl,
      officialAccreditationSourceUrl: "",
      sourceUrls: buildSourceLinks(record, detail),
      officialVerifiedAt: record.officialVerifiedAt,
      officialSourceStatus: record.officialSourceStatus,
      publicDisplayStatus,
      publicDisplayNote: "Internal review record. This row is deliberately excluded from the public catalogue.",
      reviewReason: buildReviewReason(record),
      auditNote: auditParts.filter(Boolean).join(" "),
      listTuitionText: tuitionDisplay,
      isPublished: false
    };
  });
}

export function summarizeUsmUndergraduateRows(
  manifest: UsmUndergraduateManifest,
  rows: DeepPartial<ProgramEntity>[]
): ImportSummary {
  const codeCounts = countBy(manifest.records, (record) => record.code);
  return {
    manifestRows: manifest.records.length,
    uniqueSlugs: new Set(rows.map((row) => row.slug)).size,
    detailVerifiedRows: manifest.records.filter((record) => record.detailVerified).length,
    uniqueDetailVerifiedCodes: new Set(
      manifest.records.filter((record) => record.detailVerified && /^US\d{7}$/.test(record.code)).map((record) => record.code)
    ).size,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus)),
    invalidCodeRows: manifest.records.filter((record) => !/^US\d{7}$/.test(record.code)).length,
    duplicateCodeGroups: Object.values(codeCounts).filter((count) => count > 1).length
  };
}

export function verifyUsmUndergraduateImportedRecordSet(
  rows: Array<Pick<ProgramEntity, "isPublished" | "publicDisplayStatus" | "officialSourceStatus" | "officialFeeAuditStatus">>,
  expectedRows: number
): UsmUndergraduateImportVerification {
  const publishedRows = rows.filter((row) => row.isPublished);
  const readyRows = rows.filter((row) => row.publicDisplayStatus === "ready");
  if (rows.length !== expectedRows || publishedRows.length || readyRows.length) {
    throw new Error(
      `USM import verification failed: expected=${expectedRows}, actual=${rows.length}, published=${publishedRows.length}, ready=${readyRows.length}.`
    );
  }
  return {
    importedRows: rows.length,
    publishedRows: publishedRows.length,
    readyRows: readyRows.length,
    publicDisplayStatusCounts: countBy(rows, (row) => row.publicDisplayStatus),
    officialSourceStatusCounts: countBy(rows, (row) => row.officialSourceStatus),
    feeAuditStatusCounts: countBy(rows, (row) => row.officialFeeAuditStatus)
  };
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number, expectedRows: number) {
  const repository = manager.getRepository(ProgramEntity);
  const rows = await repository.find({
    where: { universityId, slug: Like(`${USM_UNDERGRADUATE_IMPORT_SLUG_PREFIX}%`) }
  });
  return verifyUsmUndergraduateImportedRecordSet(rows, expectedRows);
}

async function main() {
  const manifestArg = readArgValue("--manifest") || DEFAULT_USM_UNDERGRADUATE_MANIFEST_PATH;
  const manifestPath = resolve(manifestArg);
  const detailsArg = readArgValue("--details") || DEFAULT_USM_UNDERGRADUATE_DETAILS_PATH;
  const detailsPath = detailsArg ? resolve(detailsArg) : "";
  const backupPath = resolve(
    readArgValue("--backup-output") || `tmp/backups/usm-undergraduate-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const manifest = loadJson<UsmUndergraduateManifest>(manifestPath);
  const details = detailsPath && existsSync(detailsPath) ? loadJson<UsmUndergraduateDetail[]>(detailsPath) : [];
  const errors = validateUsmUndergraduateManifest(manifest);
  if (errors.length) throw new Error(`USM manifest validation failed:\n${errors.join("\n")}`);
  const rows = buildUsmUndergraduateProgramRows(manifest, details);
  const summary = summarizeUsmUndergraduateRows(manifest, rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const dryRun = !verifyOnly && !process.argv.includes("--confirm-import");

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          universityCode: "USM",
          scope: "undergraduate",
          manifestPath,
          detailsPath: detailsPath || null,
          writePolicy: {
            prune: false,
            overwriteLegacyRows: false,
            isPublished: false,
            readyRowsAllowed: false,
            exactDecimalFeePolicy: "Keep exact USD amount in display/audit fields; do not round into the integer amount column."
          },
          summary,
          nextStep: "Review this output, then rerun with --confirm-import and --backup-output."
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
    const university = await dataSource.getRepository(UniversityEntity).findOne({ where: { code: "USM" } });
    if (!university) throw new Error("USM university row not found.");
    if (verifyOnly) {
      const verification = await verifyImportedRows(dataSource, university.id, rows.length);
      console.log(
        JSON.stringify(
          {
            mode: "verified",
            universityId: university.id,
            summary,
            verification,
            universityProgramCount: university.programCount
          },
          null,
          2
        )
      );
      return;
    }
    const currentPrograms = await dataSource.getRepository(ProgramEntity).find({ where: { universityId: university.id } });
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );

    let verification: Awaited<ReturnType<typeof verifyImportedRows>> | null = null;
    await dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ProgramEntity);
      for (const row of rows) {
        const existing = await repository.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await repository.save(repository.create({ ...row, id: existing?.id, universityId: university.id }));
      }
      verification = await verifyImportedRows(manager, university.id, rows.length);
      university.programCount = await repository.count({
        where: { universityId: university.id, isPublished: true, publicDisplayStatus: "ready" }
      });
      await manager.getRepository(UniversityEntity).save(university);
    });

    console.log(
      JSON.stringify(
        {
          mode: "imported",
          universityId: university.id,
          backupPath,
          summary,
          verification,
          universityProgramCount: university.programCount
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
