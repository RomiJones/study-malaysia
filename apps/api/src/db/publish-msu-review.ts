import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, Like, Not, type DeepPartial, type EntityManager } from "typeorm";
import type {
  FeeAuditStatus,
  LocalizedStringArray,
  LocalizedText,
  OfficialSourceLink,
  OfficialSourceStatus,
  PublicDisplayStatus
} from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export const MSU_PUBLICATION_SLUG_PREFIX = "msu-review-";
export const DEFAULT_MSU_DIRECT_PUBLICATION_REPORT_PATH = resolve(
  repositoryRoot,
  "data/imports/msu/2026-06-30/msu-direct-publication-report.json"
);

const publishedAt = "2026-06-30";
const expectedProgrammes = 110;
const expectedBachelorProgrammes = 80;
const expectedMasterProgrammes = 20;
const expectedPhdProgrammes = 10;
const expectedNonOfficialCandidateFees = 101;
const expectedMissingFees = 9;
const expectedSourceConflictFees = 6;
const expectedPendingFeeCandidates = expectedNonOfficialCandidateFees - expectedSourceConflictFees;
const myrToCny = 1.55;

interface MsuDirectPublicationSummary {
  totalRows: number;
  byLevel: Record<"bachelor" | "master" | "phd", number>;
  readyRows: number;
  needsReviewRows: number;
  publishedRows: number;
  officialSourceVerifiedRows: number;
  officialFeeRows: number;
  nonOfficialCandidateFeeRows: number;
  missingFeeRows: number;
  sourceConflictFeeRows: number;
  pendingFeeCandidateRows: number;
  notPublishedFeeRows: number;
  forbiddenPublicTextRows: number;
  publicDisplayStatusCounts: Record<string, number>;
  officialSourceStatusCounts: Record<string, number>;
  feeAuditStatusCounts: Record<string, number>;
}

interface MsuDirectPublicationVerification extends MsuDirectPublicationSummary {
  universityPublicDisplayStatus: PublicDisplayStatus;
  universityIsPublished: boolean;
  universityProgramCount: number;
  activeSupersededRows: number;
}

const t = (en: string, ms = en, zhCN = en, zhTW = zhCN): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

export function buildMsuDirectPublicationPatch(row: Partial<ProgramEntity>): DeepPartial<ProgramEntity> {
  const hasCandidateFee = hasNonOfficialCandidateFee(row);
  const missingFee = !hasCandidateFee && row.officialTuitionMYR == null;
  const tuitionDisplay = hasCandidateFee ? displayAnnualFee(row) : "Official international tuition not published";
  const feeAuditStatus: FeeAuditStatus = missingFee
    ? "not-published"
    : row.officialFeeAuditStatus === "source-conflict"
      ? "source-conflict"
      : "pending-review";
  const publicNote = hasCandidateFee
    ? "Published under MSU-only authorization on 2026-06-30. The displayed annual tuition is a non-official 2026 candidate and must be confirmed with MSU before applying."
    : "Published under MSU-only authorization on 2026-06-30. MSU did not publish an adoptable international tuition amount for this programme; confirm the final fee with MSU before applying.";

  return {
    isPublished: true,
    publicDisplayStatus: "ready",
    officialSourceStatus: "official-verified",
    officialFeeAuditStatus: feeAuditStatus,
    tuitionDisplay,
    listTuitionText: tuitionDisplay,
    tuitionAmount: hasCandidateFee ? Number(row.tuitionAmount) : null,
    annualTuitionCny: hasCandidateFee ? Math.round(Number(row.tuitionAmount) * myrToCny) : 0,
    officialTuitionMYR: null,
    officialTuitionNote: publicTuitionNote(row, hasCandidateFee),
    description: publicDescription(row, hasCandidateFee),
    curriculum: sanitizeLocalizedArray(row.curriculum, "Course title follows the official MSU English source."),
    careers: sanitizeLocalizedArray(row.careers, "Career information follows the official MSU English source."),
    specializations: sanitizeLocalizedArray(row.specializations, "Specialization follows the official MSU English source."),
    specialRequirementsNote: "Confirm programme-specific admission documents, interview, portfolio or professional requirements with MSU before applying.",
    chinaStudentRequirement: "MSU did not publish a separate China-specific route for this programme in the captured official apply data. Chinese applicants should follow the international route and confirm document requirements with MSU.",
    publicDisplayNote: publicNote,
    reviewReason: "",
    auditNote: publicNote,
    sourceUrls: sanitizeSourceLinks(row.sourceUrls, feeAuditStatus)
  };
}

export function summarizeMsuDirectPublication(rows: Array<Partial<ProgramEntity>>): MsuDirectPublicationSummary {
  const forbiddenRows = rows.filter(hasForbiddenPublicText);
  return {
    totalRows: rows.length,
    byLevel: {
      bachelor: rows.filter((row) => row.level === "bachelor").length,
      master: rows.filter((row) => row.level === "master").length,
      phd: rows.filter((row) => row.level === "phd").length
    },
    readyRows: rows.filter((row) => row.publicDisplayStatus === "ready").length,
    needsReviewRows: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    publishedRows: rows.filter((row) => row.isPublished).length,
    officialSourceVerifiedRows: rows.filter((row) => row.officialSourceStatus === "official-verified").length,
    officialFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    nonOfficialCandidateFeeRows: rows.filter(hasNonOfficialCandidateFee).length,
    missingFeeRows: rows.filter((row) => !hasNonOfficialCandidateFee(row) && row.officialTuitionMYR == null).length,
    sourceConflictFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "source-conflict").length,
    pendingFeeCandidateRows: rows.filter((row) => row.officialFeeAuditStatus === "pending-review" && hasNonOfficialCandidateFee(row)).length,
    notPublishedFeeRows: rows.filter((row) => row.officialFeeAuditStatus === "not-published").length,
    forbiddenPublicTextRows: forbiddenRows.length,
    publicDisplayStatusCounts: countBy(rows, (row) => String(row.publicDisplayStatus)),
    officialSourceStatusCounts: countBy(rows, (row) => String(row.officialSourceStatus)),
    feeAuditStatusCounts: countBy(rows, (row) => String(row.officialFeeAuditStatus))
  };
}

export function verifyMsuDirectPublicationRecordSet(
  university: UniversityEntity,
  rows: ProgramEntity[],
  allUniversityRows: ProgramEntity[]
): MsuDirectPublicationVerification {
  const summary = summarizeMsuDirectPublication(rows);
  const activeSupersededRows = allUniversityRows.filter(
    (row) => !row.slug.startsWith(MSU_PUBLICATION_SLUG_PREFIX) && row.publicDisplayStatus !== "archived"
  ).length;

  if (
    summary.totalRows !== expectedProgrammes ||
    summary.byLevel.bachelor !== expectedBachelorProgrammes ||
    summary.byLevel.master !== expectedMasterProgrammes ||
    summary.byLevel.phd !== expectedPhdProgrammes ||
    summary.readyRows !== expectedProgrammes ||
    summary.needsReviewRows !== 0 ||
    summary.publishedRows !== expectedProgrammes ||
    summary.officialSourceVerifiedRows !== expectedProgrammes ||
    summary.officialFeeRows !== 0 ||
    summary.nonOfficialCandidateFeeRows !== expectedNonOfficialCandidateFees ||
    summary.missingFeeRows !== expectedMissingFees ||
    summary.sourceConflictFeeRows !== expectedSourceConflictFees ||
    summary.pendingFeeCandidateRows !== expectedPendingFeeCandidates ||
    summary.notPublishedFeeRows !== expectedMissingFees ||
    summary.forbiddenPublicTextRows !== 0 ||
    activeSupersededRows !== 0 ||
    university.isPublished !== true ||
    university.publicDisplayStatus !== "ready" ||
    Number(university.programCount || 0) < expectedProgrammes
  ) {
    throw new Error(
      `MSU direct publication verification failed: ${JSON.stringify({
        summary,
        activeSupersededRows,
        universityStatus: university.publicDisplayStatus,
        universityPublished: university.isPublished,
        universityProgramCount: university.programCount
      })}`
    );
  }

  return {
    ...summary,
    universityPublicDisplayStatus: university.publicDisplayStatus,
    universityIsPublished: university.isPublished,
    universityProgramCount: university.programCount,
    activeSupersededRows
  };
}

function publicDescription(row: Partial<ProgramEntity>, hasCandidateFee: boolean): LocalizedText {
  const level = row.level === "phd" ? "doctoral" : row.level === "master" ? "master's" : "undergraduate";
  const feeText = hasCandidateFee
    ? "A 2026 annual tuition candidate is displayed because MSU did not publish an adoptable programme-level international tuition amount."
    : "MSU did not publish an adoptable programme-level international tuition amount for this programme.";
  return t(
    `MSU ${level} programme listed from the official application catalogue. ${feeText} Confirm final admission and fee details with MSU before applying.`,
    `MSU ${level} programme listed from the official application catalogue. ${feeText} Confirm final admission and fee details with MSU before applying.`,
    `该专业来自管理与科学大学官方申请目录。${hasCandidateFee ? "因 MSU 未公布可直接采纳的专业级国际学生学费，页面展示 2026 年费候选金额。" : "MSU 未公布该专业可直接采纳的国际学生学费金额。"}申请前请向 MSU 确认最终录取与费用信息。`,
    `該專業來自管理與科學大學官方申請目錄。${hasCandidateFee ? "因 MSU 未公布可直接採納的專業級國際學生學費，頁面展示 2026 年費候選金額。" : "MSU 未公布該專業可直接採納的國際學生學費金額。"}申請前請向 MSU 確認最終錄取與費用資訊。`
  );
}

function publicTuitionNote(row: Partial<ProgramEntity>, hasCandidateFee: boolean) {
  if (!hasCandidateFee) {
    return "MSU official sources checked did not publish an adoptable programme-level international tuition amount, and no authorized EasyUni/Your-Uni annual candidate was matched. Confirm the final payable fee directly with MSU before applying.";
  }
  const sourceLabel = feeSourceLabel(row.officialFeeSourceUrl);
  const conflictNote = row.officialFeeAuditStatus === "source-conflict"
    ? " EasyUni and Your-Uni values differed; the higher annual candidate was selected under the MSU-only authorization."
    : "";
  return `MSU official sources checked did not publish an adoptable programme-level international tuition total. The displayed ${displayAnnualFee(row)} is a 2026 annual tuition candidate from ${sourceLabel}, authorized for MSU only; it is not an official MSU tuition amount.${conflictNote} Confirm the final payable fee directly with MSU before applying.`;
}

function displayAnnualFee(row: Partial<ProgramEntity>) {
  const existing = String(row.tuitionDisplay || row.listTuitionText || "").trim();
  if (/RM\s*[\d,]+\s*\/\s*year/i.test(existing) || /RM\s*[\d,]+\s*per\s+year/i.test(existing)) return existing;
  return `RM ${formatCurrency(Number(row.tuitionAmount || 0))} / year`;
}

function feeSourceLabel(url: unknown) {
  const value = String(url || "");
  if (/your-uni\.com/i.test(value)) return "Your-Uni";
  if (/easyuni\.com/i.test(value)) return "EasyUni";
  return "an authorized non-official source";
}

function hasNonOfficialCandidateFee(row: Partial<ProgramEntity>) {
  return Number(row.tuitionAmount || 0) > 0 && row.officialTuitionMYR == null;
}

function sanitizeSourceLinks(value: unknown, feeAuditStatus: FeeAuditStatus): OfficialSourceLink[] {
  const links = Array.isArray(value) ? value as OfficialSourceLink[] : [];
  return links
    .filter((link) => Boolean(link?.url))
    .map((link) => {
      const url = String(link.url || "");
      const isFeeCandidate = /easyuni\.com|your-uni\.com/i.test(url) || link.sourceType === "fee";
      const status: OfficialSourceStatus = isOfficialMsuUrl(url)
        ? "official-verified"
        : isFeeCandidate
          ? "source-conflict"
          : "official-verified";
      return {
        ...link,
        status,
        note: isFeeCandidate
          ? `Non-official 2026 fee candidate source for MSU-only publication; fee audit status is ${feeAuditStatus}.`
          : "Official MSU source used for the public programme baseline."
      };
    });
}

function sanitizeLocalizedArray(value: unknown, fallback: string): LocalizedStringArray {
  const record = asRecord(value);
  const english = sanitizeStringArray(record.en, fallback);
  return {
    en: english,
    ms: sanitizeStringArray(record.ms, fallback, english),
    "zh-CN": sanitizeStringArray(record["zh-CN"], fallback, english),
    "zh-TW": sanitizeStringArray(record["zh-TW"], fallback, english)
  };
}

function sanitizeStringArray(value: unknown, fallback: string, english: string[] = []) {
  const items = Array.isArray(value) ? value : [];
  return items.map((item, index) => {
    const text = String(item || "").trim();
    if (!text || /待复核译名|待審核譯名|待审核译名|待複核譯名/i.test(text)) {
      return english[index] || fallback;
    }
    return text;
  });
}

function isOfficialMsuUrl(value: string) {
  try {
    const host = new URL(value).hostname;
    return host === "apply.msu.edu.my" || host === "www.msu.edu.my" || host.endsWith(".msu.edu.my");
  } catch {
    return false;
  }
}

function hasForbiddenPublicText(row: Partial<ProgramEntity>) {
  const fields = [
    row.description,
    row.specialRequirementsNote,
    row.publicDisplayNote,
    row.reviewReason,
    row.auditNote,
    row.officialTuitionNote,
    row.chinaStudentRequirement,
    row.sourceUrls
  ];
  const text = fields.map((field) => typeof field === "string" ? field : JSON.stringify(field || "")).join("\n");
  return /review-only|do not publish|hidden from public|needs-review|blocking issues|禁止导入|嚴禁導入|严格费用门禁失败|嚴格費用門檻失敗|待审核|待審核|待复核|待複核|needs-manual-review|validation result|pending issue|official audit batch for review|official apply catalogue for review|review import|审核候选|審核候選|keep as needs-review|per-record ready gate/i.test(text);
}

function buildMsuRootCatalogStatusSummary() {
  const zero = { total: 0, ready: 0, needsReview: 0, notAvailableForInternational: 0 };
  return {
    all: { total: expectedProgrammes, ready: expectedProgrammes, needsReview: 0, notAvailableForInternational: 0 },
    byLevel: {
      bachelor: { total: expectedBachelorProgrammes, ready: expectedBachelorProgrammes, needsReview: 0, notAvailableForInternational: 0 },
      master: { total: expectedMasterProgrammes, ready: expectedMasterProgrammes, needsReview: 0, notAvailableForInternational: 0 },
      phd: { total: expectedPhdProgrammes, ready: expectedPhdProgrammes, needsReview: 0, notAvailableForInternational: 0 },
      "postgraduate-certificate": zero,
      "postgraduate-diploma": zero
    }
  };
}

function buildMsuDirectPublicationProfile(existingProfile: unknown, summary: MsuDirectPublicationSummary) {
  const {
    msuUndergraduateReviewImport: _msuUndergraduateReviewImport,
    msuPostgraduateReviewImport: _msuPostgraduateReviewImport,
    ...profile
  } = asRecord(existingProfile);
  return {
    ...profile,
    catalogStatusSummary: buildMsuRootCatalogStatusSummary(),
    msuDirectPublicImport: {
      publishedAt,
      authorization: "MSU-only direct public import requested by Ian",
      skillPolicy: "No StudyMY skill code or skill standards were modified.",
      sourcePolicy: "Programme baseline is from MSU official sources. Tuition amounts are displayed only as MSU-only authorized non-official 2026 annual candidates where official MSU international tuition is not published.",
      summary
    }
  };
}

function buildMsuUniversityPatch(university: UniversityEntity, summary: MsuDirectPublicationSummary): DeepPartial<UniversityEntity> {
  return {
    id: university.id,
    officialProfile: buildMsuDirectPublicationProfile(university.officialProfile, summary),
    officialAuditSummary: "MSU direct public import: 110 bachelor/master/phd programmes are public-ready under Ian's MSU-only authorization. Fee candidates remain distinguished from official MSU tuition.",
    programCount: expectedProgrammes,
    publicDisplayStatus: "ready",
    isPublished: true
  };
}

async function loadMsuRows(manager: EntityManager | DataSource, universityId: number) {
  return manager.getRepository(ProgramEntity).find({
    where: { universityId, slug: Like(`${MSU_PUBLICATION_SLUG_PREFIX}%`) },
    order: { code: "ASC" }
  });
}

async function verifyImportedRows(manager: EntityManager | DataSource, universityId: number): Promise<MsuDirectPublicationVerification> {
  const university = await manager.getRepository(UniversityEntity).findOne({ where: { id: universityId } });
  if (!university) throw new Error("MSU university row not found during direct publication verification.");
  const rows = await loadMsuRows(manager, universityId);
  const allUniversityRows = await manager.getRepository(ProgramEntity).find({ where: { universityId } });
  return verifyMsuDirectPublicationRecordSet(university, rows, allUniversityRows);
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

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getter(item);
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function main() {
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-publish");
  const reportOutput = resolve(readArgValue("--report-output") || DEFAULT_MSU_DIRECT_PUBLICATION_REPORT_PATH);
  const backupPath = resolve(
    readArgValue("--backup-output") || `apps/api/tmp/backups/msu-direct-publication-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  const dataSource = buildDataSource();
  await dataSource.initialize();
  try {
    const universityRepo = dataSource.getRepository(UniversityEntity);
    let university =
      (await universityRepo.findOne({ where: { code: "MSU" } })) ||
      (await universityRepo.findOne({ where: { slug: "management-and-science-university" } }));
    if (!university) throw new Error("MSU university row not found.");

    if (verifyOnly) {
      const report = {
        mode: "verified",
        universityId: university.id,
        databaseUniversityCode: university.code,
        verification: await verifyImportedRows(dataSource, university.id)
      };
      writeJson(reportOutput, report);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const currentRows = await loadMsuRows(dataSource, university.id);
    const dryRunRows: Array<Partial<ProgramEntity>> = currentRows.map((row) => ({
      ...row,
      ...buildMsuDirectPublicationPatch(row)
    }) as Partial<ProgramEntity>);
    const dryRunSummary = summarizeMsuDirectPublication(dryRunRows);
    if (!confirm) {
      const report = {
        mode: "dry-run",
        universityCode: "MSU",
        writePolicy: {
          authorization: "MSU-only direct public import",
          programmes: { isPublished: true, publicDisplayStatus: "ready" },
          officialTuitionPolicy: "officialTuitionMYR remains null for non-official candidate fees; missing fees become not-published.",
          nextStep: "Review this dry-run, then rerun with --confirm-publish to write transactionally."
        },
        summary: dryRunSummary
      };
      writeJson(reportOutput, report);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const currentPrograms = await dataSource.getRepository(ProgramEntity).find({ where: { universityId: university.id } });
    writeJson(backupPath, { createdAt: new Date().toISOString(), university, programs: currentPrograms });

    let verification: MsuDirectPublicationVerification | null = null;
    await dataSource.transaction(async (manager) => {
      const txUniversityRepo = manager.getRepository(UniversityEntity);
      const txProgramRepo = manager.getRepository(ProgramEntity);
      university = await txUniversityRepo.findOne({ where: { id: university!.id } });
      if (!university) throw new Error("MSU university row not found in transaction.");

      const rows = await loadMsuRows(manager, university.id);
      const incomingRows: Array<Partial<ProgramEntity>> = rows.map((row) => ({
        ...row,
        ...buildMsuDirectPublicationPatch(row)
      }) as Partial<ProgramEntity>);
      const incomingSummary = summarizeMsuDirectPublication(incomingRows);
      if (
        incomingSummary.totalRows !== expectedProgrammes ||
        incomingSummary.byLevel.bachelor !== expectedBachelorProgrammes ||
        incomingSummary.byLevel.master !== expectedMasterProgrammes ||
        incomingSummary.byLevel.phd !== expectedPhdProgrammes ||
        incomingSummary.nonOfficialCandidateFeeRows !== expectedNonOfficialCandidateFees ||
        incomingSummary.missingFeeRows !== expectedMissingFees
      ) {
        throw new Error(`MSU direct publication preflight failed: ${JSON.stringify(incomingSummary)}`);
      }

      await txProgramRepo.update(
        {
          universityId: university.id,
          slug: Not(Like(`${MSU_PUBLICATION_SLUG_PREFIX}%`))
        },
        {
          isPublished: false,
          publicDisplayStatus: "archived",
          officialSourceStatus: "hidden-duplicate-superseded",
          publicDisplayNote: "Archived by the 2026-06-30 MSU direct publication to prevent stale placeholder rows from mixing with the public MSU catalogue.",
          reviewReason: "Superseded by the 110-row MSU direct public publication."
        }
      );

      for (const row of rows) {
        await txProgramRepo.save(txProgramRepo.create({ ...row, ...buildMsuDirectPublicationPatch(row) }));
      }

      await txUniversityRepo.save(txUniversityRepo.create(buildMsuUniversityPatch(university, incomingSummary)));
      verification = await verifyImportedRows(manager, university.id);
    });

    if (!verification) throw new Error("MSU direct publication verification did not run.");
    const catalogCacheCleared = await clearCatalogCache();
    const report = {
      mode: "published",
      universityId: university?.id,
      backupPath,
      catalogCacheCleared,
      verification
    };
    writeJson(reportOutput, report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
