import "reflect-metadata";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import { DataSource, type DeepPartial, type EntityManager } from "typeorm";
import type { LocalizedStringArray, LocalizedText, OfficialSourceLink } from "@studymy/shared";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";
import {
  categoryFor,
  extractCgpa,
  extractLanguageScores,
  localizeFaculty,
  sanitizeOfficialText,
  toTraditional,
  translatedSubject
} from "./import-usm-master-commercial.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const USM_PHD_SLUG_PREFIX = "usm-phd-commercial-2026-";
export const DEFAULT_USM_PHD_SOURCE_PATH = resolve(
  repositoryRoot,
  "data/imports/usm/2026-06-14/phd-candidate.json"
);
const feeDirectoryUrl = "https://admission.usm.my/index.php/postgraduate/fee-pg";
const applicationGuideUrl =
  "https://onlineips.usm.my/images/ONLINE%20APPLICATION%20GUIDELINE%20012026%20v1.pdf";

type StudyMode = "research" | "coursework" | "mixed" | "online";
type PublicStatus = "ready" | "needs-review" | "not-available-for-international";

interface CandidateRecord {
  code: string;
  nameEnOfficial: string;
  facultyEn: string;
  campus: string;
  studyMode: StudyMode;
  delivery: string;
  internationalEligibility: { status: string; evidenceText: string };
  durationValue: { min: number; max: number } | null;
  durationOfficial: string;
  intakeMonths: string[];
  officialIntake: string;
  officialAcademicRequirement: string;
  officialLanguageRequirement: string;
  applicationDocuments: Array<{ id: string; nameEn: string; conditional?: string }>;
  researchFieldsOfficialText: string;
  officialSourceUrl: string;
  publicDisplayStatus: PublicStatus;
  reviewReasons: string[];
  publicationWarnings: string[];
  detailSha256: string;
  fee: {
    status: string;
    tuitionAmount: number | null;
    tuitionCurrency: "USD" | "MYR" | null;
    tuitionAcademicSession?: string;
    officialRatePerSemester?: number;
    officialPartTimeRatePerSemester?: number;
    officialFeeSourceUrl: string;
    reason?: string;
  };
}

export interface PhdCommercialSource {
  schemaVersion: string;
  universityCode: "USM";
  level: "phd";
  declaredProgrammeCount: number;
  audit: {
    canonicalProgrammes: number;
    statusCounts: Record<PublicStatus, number>;
    publicationDecision: string;
  };
  records: CandidateRecord[];
}

const t = (en: string, ms: string, zhCN: string, zhTW = toTraditional(zhCN)): LocalizedText => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const localizedArray = (
  en: string[],
  ms: string[],
  zhCN: string[],
  zhTW = zhCN.map(toTraditional)
): LocalizedStringArray => ({ en, ms, "zh-CN": zhCN, "zh-TW": zhTW });

function extractIntakeMonths(text: string) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months.filter((month) => new RegExp(month, "i").test(text));
}

function intakePresentation(record: CandidateRecord) {
  if (record.studyMode !== "research") {
    return {
      months: record.intakeMonths,
      official: record.officialIntake,
      note: record.officialIntake
        ? "Programme-specific official intake is published."
        : "USM does not publish a programme-specific intake for this directory entry."
    };
  }
  const programmeMonths = extractIntakeMonths(record.officialIntake);
  if (programmeMonths.length) {
    return {
      months: record.intakeMonths,
      official: record.officialIntake,
      note: `USM official programme page publishes ${programmeMonths.join(" / ")} intake for this research-mode programme.`
    };
  }
  return {
    months: [],
    official: "Open year-round application",
    note: "Research-mode postgraduate applications are treated as open year-round when USM does not publish a programme-specific fixed intake month; the reporting date follows the official offer and registration arrangement."
  };
}

function programmeName(record: CandidateRecord): LocalizedText {
  const official = record.nameEnOfficial.replace(/\s+/g, " ").trim();
  const faculty = localizeFaculty(record.facultyEn);
  const upper = official.toUpperCase();
  let zh = "";
  if (upper.startsWith("DOCTOR OF BUSINESS ADMINISTRATION")) {
    zh = `工商管理博士${upper.includes("ONLINE") ? "（在线）" : ""}`;
  } else if (upper.startsWith("DOCTOR OF NEUROSCIENCE")) {
    zh = "神经科学博士";
  } else if (upper.startsWith("DOCTOR OF PUBLIC HEALTH")) {
    const subject = official.match(/\(([^)]+)\)/)?.[1];
    zh = subject ? `${translatedSubject(subject)}公共卫生博士` : "公共卫生博士";
  } else if (upper.startsWith("DOCTOR OF EDUCATION")) {
    const subject = official.replace(/^Doctor of Education(?:\s+in)?/i, "").replace(/[()]/g, "").trim();
    const translated = translatedSubject(subject);
    zh = subject && /[\u3400-\u9fff]/.test(translated)
      ? `${translated.replace(/\s+/g, "")}${translated.includes("教育") ? "博士" : "教育学博士"}`
      : "教育学博士";
  } else if (upper.startsWith("DOCTOR OF PSYCHOLOGY")) {
    const subject = official.match(/\(([^)]+)\)/)?.[1];
    zh = subject ? `${translatedSubject(subject)}心理学博士` : "心理学博士";
  } else {
    const subject = official.match(/\(([^)]+)\)/)?.[1] || "";
    const genericSubject = /MAIN CAMPUS|HEALTH CAMPUS|ENGINEERING CAMPUS|OFFSHORE|DUAL PHD|JOINT PHD/i.test(subject);
    const translated = translatedSubject(subject);
    zh = !genericSubject && /[\u3400-\u9fff]/.test(translated)
      ? `${translated}哲学博士`
      : `${faculty["zh-CN"]}哲学博士`;
    if (record.delivery === "offshore") zh += "（离岸项目）";
    if (record.delivery === "dual-degree") zh += "（双学位）";
    if (record.delivery === "joint-degree") zh += "（联合学位）";
    if (record.delivery === "double-degree") zh += "（双学位）";
  }
  const ms = official
    .replace(/^DOCTOR OF PHILOSOPHY/i, "Doktor Falsafah")
    .replace(/^DOCTOR OF BUSINESS ADMINISTRATION/i, "Doktor Pentadbiran Perniagaan")
    .replace(/^DOCTOR OF PUBLIC HEALTH/i, "Doktor Kesihatan Awam")
    .replace(/^DOCTOR OF EDUCATION/i, "Doktor Pendidikan")
    .replace(/^DOCTOR OF PSYCHOLOGY/i, "Doktor Psikologi")
    .replace(/^DOCTOR OF NEUROSCIENCE/i, "Doktor Neurosains")
    .replace(/^DOCTOR OF /i, "Doktor ");
  return t(official, ms, zh);
}

function stableCode(code: string) {
  return code.replace("USM-PHD-", "USM-D-").slice(0, 50);
}

function stableSlug(record: CandidateRecord) {
  return `${USM_PHD_SLUG_PREFIX}${stableCode(record.code).toLowerCase()}`.slice(0, 120);
}

function feePresentation(record: CandidateRecord): {
  amount: number | null;
  currency: "USD" | "MYR" | "UNKNOWN";
  display: string;
  note: string;
  status: "matched-official" | "calculated-from-official-rate" | "not-published";
} {
  const amount = record.fee.tuitionAmount;
  if (typeof amount === "number") {
    return {
      amount,
      currency: record.fee.tuitionCurrency || "UNKNOWN",
      display: `${record.fee.tuitionCurrency} ${amount.toLocaleString("en-US")} total tuition`,
      note: "Current official total programme tuition; separate charges may apply.",
      status: "matched-official" as const
    };
  }
  if (
    record.fee.status === "official-rate-only"
    && record.fee.officialRatePerSemester
  ) {
    const fullTime = record.fee.officialRatePerSemester;
    const partTime = record.fee.officialPartTimeRatePerSemester || fullTime;
    const currency = record.fee.tuitionCurrency || "UNKNOWN";
    const standardSemesters = Math.max(1, Math.round((record.durationValue?.min || 0) * 2));
    const calculatedTotal = fullTime * standardSemesters;
    return {
      amount: calculatedTotal,
      currency,
      display: `${currency} ${calculatedTotal.toLocaleString("en-US")} total tuition`,
      note: `StudyMY calculated the standard full-time tuition as ${currency} ${fullTime.toLocaleString("en-US")} per semester × ${standardSemesters} official minimum semesters = ${currency} ${calculatedTotal.toLocaleString("en-US")}. USM official ${record.fee.tuitionAcademicSession || "current"} part-time rate: ${currency} ${partTime.toLocaleString("en-US")} per semester. Extension-period tuition and separate charges are excluded.`,
      status: "calculated-from-official-rate" as const
    };
  }
  return {
    amount: null,
    currency: record.fee.tuitionCurrency || "UNKNOWN",
    display: "",
    note: record.fee.reason || "No uniquely applicable current official international total tuition is published.",
    status: "not-published" as const
  };
}

function applicationDocuments(record: CandidateRecord) {
  const translations: Record<string, [string, string]> = {
    passport: ["Pasport pemohon antarabangsa", "国际申请人护照"],
    photo: ["Gambar berukuran pasport", "护照尺寸照片"],
    "master-certificate": ["Sijil ijazah sarjana dan terjemahan rasmi bahasa Inggeris", "硕士学位证书及官方英文翻译"],
    "academic-transcripts": ["Transkrip akademik dan terjemahan rasmi bahasa Inggeris", "成绩单及官方英文翻译"],
    "graduation-certificate": ["Sijil tamat pengajian jika berkenaan", "毕业证书（如适用）"],
    "grading-scheme": ["Skema pemarkahan rasmi", "官方评分制度说明"],
    "english-result": ["Keputusan ujian bahasa Inggeris atau bukti pengecualian", "认可的英语考试成绩或豁免证明"],
    "research-proposal": ["Cadangan penyelidikan", "研究计划"],
    referees: ["Maklumat pemberi rujukan", "推荐人信息"],
    "scholarship-letter": ["Surat biasiswa jika ada", "奖学金证明（如有）"]
  };
  const items = record.applicationDocuments.filter(
    (item) => item.conditional !== "research" || record.studyMode === "research"
  );
  return localizedArray(
    items.map((item) => item.nameEn),
    items.map((item) => translations[item.id]?.[0] || item.nameEn),
    items.map((item) => translations[item.id]?.[1] || item.nameEn)
  );
}

export function buildUsmPhdRows(source: PhdCommercialSource): Array<DeepPartial<ProgramEntity>> {
  return source.records.map((record) => {
    const name = programmeName(record);
    const faculty = localizeFaculty(record.facultyEn);
    const fee = feePresentation(record);
    const duration = record.durationValue;
    const publicStatus = record.publicDisplayStatus;
    const intake = intakePresentation(record);
    const descriptionZh = `${faculty["zh-CN"]}开设的${record.studyMode === "research" ? "研究型" : record.studyMode === "coursework" ? "授课型" : record.studyMode === "online" ? "在线" : "混合型"}博士项目。申请条件、学制与费用以所列 USM 官方来源为准。`;
    const sourceLinks: OfficialSourceLink[] = [
      {
        title: "USM official doctoral programme page",
        url: record.officialSourceUrl,
        sourceType: "admission",
        verifiedAt: "2026-06-14",
        status: "official-verified"
      },
      {
        title: "USM postgraduate fee schedule",
        url: record.fee.officialFeeSourceUrl || feeDirectoryUrl,
        sourceType: "fee",
        verifiedAt: "2026-06-15",
        status: "official-verified"
      },
      {
        title: "USM OnlineIPS application guide",
        url: applicationGuideUrl,
        sourceType: "entry-requirement",
        verifiedAt: "2026-06-14",
        status: "official-verified"
      }
    ];
    return {
      slug: stableSlug(record),
      code: stableCode(record.code),
      name,
      nameEnOfficial: record.nameEnOfficial,
      level: "phd",
      category: categoryFor({ faculty: record.facultyEn, officialName: record.nameEnOfficial }),
      faculty,
      facultyZh: faculty["zh-CN"],
      studyMode: record.studyMode,
      campus: record.campus,
      durationYears: duration?.min || 0,
      durationOfficial: (sanitizeOfficialText(record.durationOfficial) || "Official numeric duration is not published.").slice(0, 500),
      annualTuitionCny: 0,
      tuitionAmount: fee.amount,
      tuitionCurrency: fee.currency,
      tuitionDisplay: fee.display,
      officialTuitionMYR: null,
      officialTuitionNote: fee.note,
      officialFeeSourceUrl: record.fee.officialFeeSourceUrl || feeDirectoryUrl,
      secondaryOfficialFeeSourceUrl: feeDirectoryUrl,
      officialFeeAuditStatus: fee.status,
      officialFeeAuditedAt: "2026-06-15",
      intakeMonths: intake.months,
      officialIntake: intake.official.slice(0, 255),
      officialIntakeNote: intake.note,
      languageRequirement: extractLanguageScores(record.officialLanguageRequirement),
      officialLanguageRequirement: sanitizeOfficialText(record.officialLanguageRequirement),
      requirement: {
        gpa: extractCgpa(record.officialAcademicRequirement),
        gaokaoRequired: false,
        huikaoRequired: false,
        note: t(
          sanitizeOfficialText(record.officialAcademicRequirement),
          "Ijazah sarjana yang berkaitan atau setaraf; rujuk syarat rasmi program.",
          "相关硕士学位或同等学历；具体要求以官方项目页为准。"
        )
      },
      officialAcademicRequirement: sanitizeOfficialText(record.officialAcademicRequirement),
      chinaStudentRequirement: publicStatus === "not-available-for-international"
        ? "该项目官方标注仅限马来西亚申请人，不适用于中国及其他国际学生。"
        : publicStatus === "needs-review"
          ? "该项目的国际申请资格或数值学制尚未得到官方公开材料充分确认，暂不公开展示。"
          : "中国学历、成绩单及非英文材料须按 OnlineIPS 指南提交官方英文翻译；最终资格由 USM 审核。",
      specialRequirementsNote: [
        ...record.reviewReasons,
        ...record.publicationWarnings
      ].join("; ") || "International applicant scope is supported by current official evidence.",
      applicationDocs: applicationDocuments(record),
      curriculum: localizedArray(
        [sanitizeOfficialText(record.researchFieldsOfficialText) || "Refer to the official programme page for research fields."],
        ["Rujuk halaman rasmi program untuk bidang penyelidikan."],
        ["研究领域以 USM 官方项目页为准。"]
      ),
      careers: localizedArray(
        ["USM does not publish a structured career list for this programme."],
        ["USM tidak menerbitkan senarai kerjaya berstruktur untuk program ini."],
        ["USM 官方未公布该项目的结构化职业方向列表。"]
      ),
      specializations: localizedArray([], [], []),
      description: t(
        `${record.nameEnOfficial} is a ${record.studyMode}-mode doctoral programme offered by ${record.facultyEn}. Refer to the linked USM sources for current terms.`,
        `${record.nameEnOfficial} ialah program kedoktoran mod ${record.studyMode} yang ditawarkan oleh ${record.facultyEn}. Rujuk sumber rasmi USM untuk syarat semasa.`,
        descriptionZh
      ),
      officialAccreditationNote: "No programme-level accreditation claim is made without a dedicated official source.",
      officialSourceUrl: record.officialSourceUrl,
      officialEntryRequirementSourceUrl: record.officialSourceUrl,
      officialAccreditationSourceUrl: record.officialSourceUrl,
      sourceUrls: sourceLinks,
      officialVerifiedAt: "2026-06-14",
      officialSourceStatus: publicStatus === "not-available-for-international"
        ? "official-page-verified-international-not-available"
        : "official-verified",
      publicDisplayStatus: publicStatus,
      publicDisplayNote: publicStatus === "ready"
        ? "Published from the audited current USM doctoral catalogue; StudyMY localisations are non-official."
        : "Retained for catalogue completeness and excluded from the public international application list.",
      reviewReason: record.reviewReasons.join("; ") || null,
      auditNote: `StudyMY verified doctoral identity ${record.code} on 2026-06-14. Evidence hash: ${record.detailSha256.slice(0, 16)}.`,
      listTuitionText: fee.display || "Official fee not published",
      isPublished: publicStatus === "ready"
    };
  });
}

export function validateUsmPhdSource(source: PhdCommercialSource) {
  const errors: string[] = [];
  if (source.universityCode !== "USM" || source.level !== "phd") errors.push("Source scope must be USM phd.");
  if (source.records.length !== 95 || source.declaredProgrammeCount !== 95) errors.push("Expected 95 doctoral records.");
  if (source.audit.canonicalProgrammes !== 95) errors.push("Canonical doctoral count must be 95.");
  if (source.audit.publicationDecision !== "publish-international-eligible-catalogue") {
    errors.push("Publication decision is not approved.");
  }
  if (new Set(source.records.map((record) => record.code)).size !== 95) errors.push("Candidate codes must be unique.");
  if (new Set(source.records.map(stableSlug)).size !== 95) errors.push("Generated slugs must be unique.");
  return errors;
}

export function summarizeUsmPhdRows(rows: Array<DeepPartial<ProgramEntity>>) {
  return {
    rows: rows.length,
    ready: rows.filter((row) => row.publicDisplayStatus === "ready" && row.isPublished).length,
    needsReview: rows.filter((row) => row.publicDisplayStatus === "needs-review").length,
    notAvailableForInternational: rows.filter((row) => row.publicDisplayStatus === "not-available-for-international").length,
    feeMatched: rows.filter((row) => row.officialFeeAuditStatus === "matched-official").length,
    feeRateVerified: rows.filter((row) => row.officialFeeAuditStatus === "official-rate-verified").length,
    feeCalculated: rows.filter((row) => row.officialFeeAuditStatus === "calculated-from-official-rate").length,
    feeNotPublished: rows.filter((row) => row.officialFeeAuditStatus === "not-published").length,
    modes: rows.reduce<Record<string, number>>((result, row) => {
      result[String(row.studyMode)] = (result[String(row.studyMode)] || 0) + 1;
      return result;
    }, {})
  };
}

async function verifyRows(manager: EntityManager | DataSource, universityId: number) {
  const repository = manager.getRepository(ProgramEntity);
  const phd = await repository.find({ where: { universityId, level: "phd" } });
  const commercial = phd.filter((row) => row.slug.startsWith(USM_PHD_SLUG_PREFIX));
  const ready = commercial.filter((row) => row.isPublished && row.publicDisplayStatus === "ready");
  const needsReview = commercial.filter((row) => row.publicDisplayStatus === "needs-review");
  const unavailable = commercial.filter((row) => row.publicDisplayStatus === "not-available-for-international");
  const leakedLegacy = phd.filter((row) => row.isPublished && !row.slug.startsWith(USM_PHD_SLUG_PREFIX));
  const bachelor = await repository.count({ where: { universityId, level: "bachelor", isPublished: true, publicDisplayStatus: "ready" } });
  const master = await repository.count({ where: { universityId, level: "master", isPublished: true, publicDisplayStatus: "ready" } });
  if (
    commercial.length !== 95 ||
    ready.length !== 95 ||
    needsReview.length !== 0 ||
    unavailable.length !== 0 ||
    leakedLegacy.length !== 0 ||
    bachelor !== 63 ||
    master !== 304
  ) {
    throw new Error(
      `USM doctoral verification failed: canonical=${commercial.length}, ready=${ready.length}, review=${needsReview.length}, unavailable=${unavailable.length}, bachelor=${bachelor}, master=${master}.`
    );
  }
  return {
    canonicalRows: commercial.length,
    publicPhdRows: ready.length,
    publicMasterRows: master,
    publicBachelorRows: bachelor,
    totalCanonicalRows: 63 + 305 + commercial.length,
    totalPublicRows: bachelor + master + ready.length,
    needsReviewRows: needsReview.length,
    notAvailableForInternationalRows: unavailable.length,
    leakedLegacyRows: leakedLegacy.length
  };
}

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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
  const sourcePath = resolve(readArgValue("--source") || DEFAULT_USM_PHD_SOURCE_PATH);
  if (!existsSync(sourcePath)) throw new Error(`USM doctoral source not found: ${sourcePath}`);
  const source = JSON.parse(readFileSync(sourcePath, "utf8")) as PhdCommercialSource;
  const errors = validateUsmPhdSource(source);
  if (errors.length) throw new Error(`USM doctoral source validation failed:\n${errors.join("\n")}`);
  const rows = buildUsmPhdRows(source);
  const summary = summarizeUsmPhdRows(rows);
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const backupPath = resolve(
    readArgValue("--backup-output") ||
      `tmp/backups/usm-phd-commercial-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  if (!verifyOnly && !confirm) {
    console.log(JSON.stringify({
      mode: "dry-run",
      sourcePath,
      summary,
      writePolicy: {
        university: "USM",
        level: "phd",
        canonicalRows: summary.rows,
        publishReadyRows: summary.ready,
        preserveReviewRows: summary.needsReview,
        preserveInternationalUnavailableRows: summary.notAvailableForInternational,
        archiveLegacyPublicDoctoralRows: true,
        totalCanonicalRowsAfterImport: 63 + 305 + summary.rows,
        totalPublicRowsAfterImport: 63 + 304 + summary.ready
      }
    }, null, 2));
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
      console.log(JSON.stringify({
        mode: "verified",
        universityId: university.id,
        summary,
        verification: await verifyRows(dataSource, university.id)
      }, null, 2));
      return;
    }

    const currentPrograms = await dataSource.getRepository(ProgramEntity).find({ where: { universityId: university.id } });
    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university, programs: currentPrograms }, null, 2),
      "utf8"
    );
    let verification: Awaited<ReturnType<typeof verifyRows>> | null = null;
    await dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ProgramEntity);
      const currentPhd = await repository.find({ where: { universityId: university.id, level: "phd" } });
      for (const existing of currentPhd) {
        if (existing.slug.startsWith(USM_PHD_SLUG_PREFIX)) continue;
        existing.isPublished = false;
        existing.publicDisplayStatus = "archived";
        existing.publicDisplayNote = "Superseded by the audited current USM doctoral catalogue.";
        existing.reviewReason = "Archived to prevent duplicate public display after canonical doctoral publication.";
        await repository.save(existing);
      }
      for (const row of rows) {
        const existing = await repository.findOne({ where: { slug: String(row.slug) } });
        if (existing && existing.universityId !== university.id) {
          throw new Error(`Slug ${row.slug} belongs to another university.`);
        }
        await repository.save(repository.create({ ...row, id: existing?.id, universityId: university.id }));
      }
      const bachelorReady = 63;
      const masterReady = 304;
      const masterUnavailable = 1;
      const totalPublicRows = bachelorReady + masterReady + summary.ready;
      university.programCount = totalPublicRows;
      university.officialProfile = {
        ...(university.officialProfile || {}),
        catalogStatusSummary: {
          all: {
            total: 463,
            ready: totalPublicRows,
            needsReview: summary.needsReview,
            notAvailableForInternational: masterUnavailable + summary.notAvailableForInternational
          },
          byLevel: {
            bachelor: { total: 63, ready: 63, needsReview: 0, notAvailableForInternational: 0 },
            master: { total: 305, ready: masterReady, needsReview: 0, notAvailableForInternational: masterUnavailable },
            phd: {
              total: summary.rows,
              ready: summary.ready,
              needsReview: summary.needsReview,
              notAvailableForInternational: summary.notAvailableForInternational
            }
          }
        }
      };
      await manager.getRepository(UniversityEntity).save(university);
      verification = await verifyRows(manager, university.id);
    });
    const catalogCacheCleared = await clearCatalogCache();
    console.log(JSON.stringify({
      mode: "imported",
      universityId: university.id,
      backupPath,
      catalogCacheCleared,
      summary,
      verification
    }, null, 2));
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
