import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import mysql from "mysql2/promise";
import { loadEnvFiles } from "../apps/api/src/config/env.js";

type LocaleText = { en: string; ms: string; "zh-CN": string; "zh-TW": string };
type LocaleArray = { en: string[]; ms: string[]; "zh-CN": string[]; "zh-TW": string[] };

interface V2Programme {
  nameEn: string;
  name?: string | null;
  faculty?: string | null;
  level: string;
  duration?: number | null;
  intake?: number[];
  ielts?: number | null;
  curriculum?: string[];
  careerProspects?: string | string[] | null;
  otherLanguageReqs?: Record<string, number | string | null> | null;
  gpaRequirement?: string | null;
  studyMode?: string | null;
  interviewRequired?: boolean | string | null;
  otherEntryReqs?: string[] | null;
  remarks?: string | null;
  officialFeeSourceUrl?: string | null;
  officialSourceUrl?: string | null;
}

interface V3Programme {
  nameEn: string;
  name?: string | null;
  faculty?: string | null;
  facultyZh?: string | null;
  duration?: number | null;
  intake?: number[];
  language?: {
    ielts?: number | null;
    toefl?: number | null;
    otherRequirement?: string | null;
    waiver?: string | null;
  } | null;
  curriculum?: string[];
  curriculumNote?: string | null;
  careerProspects?: string[] | string | null;
  tuitionNote?: string | null;
  studyMode?: string | null;
  studyModeNote?: string | null;
  interviewRequired?: boolean | string | null;
  interviewNote?: string | null;
  entryRequirement?: {
    minGPA?: number | null;
    gpaNote?: string | null;
    degreeLevel?: string | null;
    workExperience?: string | null;
  } | null;
  officialFeeSourceUrl?: string | null;
  officialSourceUrl?: string | null;
}

interface DbRow {
  id: number;
  code: string;
  nameEnOfficial: string;
  name: LocaleText;
  faculty: LocaleText;
  curriculum: LocaleArray;
  careers: LocaleArray;
  requirement: Record<string, unknown>;
  languageRequirement: Record<string, unknown>;
  studyMode: string;
  durationYears: string | number;
  tuitionDisplay: string;
  officialTuitionNote: string | null;
  auditNote: string | null;
  reviewReason: string | null;
}

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const cnyPerMyr = 1.55;
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8")) as T;
}

function programmes(path: string): Array<V2Programme | V3Programme> {
  const payload = readJson<{ programmes: Array<V2Programme | V3Programme> }>(path);
  return payload.programmes;
}

function byName(items: Array<V2Programme | V3Programme>) {
  return new Map(items.map((item) => [item.nameEn, item]));
}

function cleanList(items: unknown): string[] {
  const array = Array.isArray(items) ? items : typeof items === "string" ? items.split(/[、，,;；]/) : [];
  return array
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter((item) => item && !/^official-unpublished$/i.test(item));
}

function localizedArray(existing: LocaleArray, zhItems: string[]): LocaleArray {
  const zh = zhItems.length ? zhItems : existing?.["zh-CN"] || [];
  return {
    en: existing?.en?.length ? existing.en : zh,
    ms: existing?.ms?.length ? existing.ms : existing?.en?.length ? existing.en : zh,
    "zh-CN": zh,
    "zh-TW": zh
  };
}

function localizedText(existing: LocaleText, en: string, zh?: string | null): LocaleText {
  const zhValue = zh || existing?.["zh-CN"] || en;
  return {
    en: existing?.en || en,
    ms: existing?.ms || en,
    "zh-CN": zhValue,
    "zh-TW": zhValue
  };
}

function parseScore(text: string, label: string) {
  const pattern = new RegExp(`${label}\\s*[：: ]\\s*(\\d+(?:\\.\\d+)?)`, "i");
  const parsed = Number(text.match(pattern)?.[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function languageRequirement(existing: Record<string, unknown>, v2?: V2Programme, v3?: V3Programme) {
  const otherText = v3?.language?.otherRequirement || "";
  const v2Other = v2?.otherLanguageReqs || {};
  const score = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const bounded = (value: number | null, min: number, max: number) => value != null && value >= min && value <= max ? value : null;
  const ielts = bounded(score(v3?.language?.ielts) ?? score(v2?.ielts) ?? score(existing?.ielts), 1, 9) ?? 0;
  const toefl = bounded(score(v3?.language?.toefl) ?? score(v2Other.toefl) ?? score(existing?.toefl), 30, 677);
  const pte = bounded(score(v2Other.pte) ?? parseScore(otherText, "PTE") ?? score(existing?.pte), 20, 90);
  const muet = bounded(score(v2Other.muet) ?? parseScore(otherText, "MUET") ?? score(existing?.muet), 1, 5);
  return {
    ...existing,
    ielts,
    toefl,
    pte,
    muet
  };
}

function requirement(existing: Record<string, unknown>, v2?: V2Programme, v3?: V3Programme) {
  const minGpa = Number(v3?.entryRequirement?.minGPA);
  const gpa = Number.isFinite(minGpa) && minGpa > 0 ? minGpa : Number(existing?.gpa || 0);
  const notes = [
    v2?.gpaRequirement,
    v3?.entryRequirement?.degreeLevel,
    v3?.entryRequirement?.gpaNote,
    v3?.entryRequirement?.workExperience,
    ...(v2?.otherEntryReqs || [])
  ].filter(Boolean).join(" ");
  return {
    ...existing,
    gpa,
    note: notes
      ? localizedText((existing?.note as LocaleText) || { en: "", ms: "", "zh-CN": "", "zh-TW": "" }, notes, notes)
      : existing?.note
  };
}

function intakeMonths(record?: V2Programme | V3Programme) {
  return (record?.intake || [])
    .map((month) => monthNames[Number(month) - 1])
    .filter(Boolean);
}

function feeAmounts(...texts: Array<string | null | undefined>) {
  const text = texts.filter(Boolean).join(" ");
  return [...text.matchAll(/\b(?:RM|MYR)\s*([\d,]+(?:\.\d+)?)/gi)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
}

function studyMode(current: string, v2?: V2Programme, v3?: V3Programme) {
  const parts = [v3?.studyMode, v3?.studyModeNote, v2?.studyMode].filter(Boolean).map((item) => String(item));
  return parts.length ? [...new Set(parts)].join(" / ") : current;
}

function specialRequirements(current: string | null | undefined, v2?: V2Programme, v3?: V3Programme) {
  const notes = [
    current,
    v3?.interviewRequired ? `Interview/internal assessment: ${v3.interviewRequired}.` : "",
    v3?.interviewNote,
    v2?.interviewRequired ? `Interview/internal assessment: ${v2.interviewRequired}.` : ""
  ].filter(Boolean);
  return [...new Set(notes.map((item) => String(item)))].join(" ");
}

async function main() {
  loadEnvFiles();
  const v2Items = [
    ...programmes("data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_bachelor_20260624.json"),
    ...programmes("data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_master_20260624.json"),
    ...programmes("data/imports/iiu/2026-06-24/v2-calibrated/INTI_audit_phd_20260624.json")
  ] as V2Programme[];
  const v3Items = [
    ...programmes("data/imports/iiu/2026-06-24/v3-calibrated/INTI_audit_undergraduate_20260624.json"),
    ...programmes("data/imports/iiu/2026-06-24/v3-calibrated/INTI_audit_master_20260624.json"),
    ...programmes("data/imports/iiu/2026-06-24/v3-calibrated/INTI_audit_doctoral_20260624.json")
  ] as V3Programme[];
  const v2ByName = byName(v2Items) as Map<string, V2Programme>;
  const v3ByName = byName(v3Items) as Map<string, V3Programme>;

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "123456",
    database: process.env.MYSQL_DATABASE || "study_malaysia"
  });

  const [rows] = await connection.query(
    "SELECT * FROM programs WHERE slug LIKE 'inti-official-2026-review-row-%' ORDER BY id"
  );
  const dbRows = rows as DbRow[];
  const report = {
    matched: 0,
    missing: [] as string[],
    updated: [] as Array<{ code: string; nameEnOfficial: string; tuitionAmount: number | null; durationYears: number; ielts: number | null; curriculumZh: number; careersZh: number }>
  };

  await connection.beginTransaction();
  try {
    for (const row of dbRows) {
      const v2 = v2ByName.get(row.nameEnOfficial);
      const v3 = v3ByName.get(row.nameEnOfficial);
      if (!v2 && !v3) {
        report.missing.push(row.nameEnOfficial);
        continue;
      }
      report.matched += 1;
      const duration = Number(v3?.duration ?? v2?.duration ?? row.durationYears);
      const amounts = feeAmounts(row.tuitionDisplay, row.officialTuitionNote, v3?.tuitionNote, v2?.remarks);
      const tuitionAmount = amounts.length ? Math.max(...amounts) : null;
      const annualTuitionCny = tuitionAmount && Number.isFinite(duration) && duration > 0
        ? Math.round((tuitionAmount * cnyPerMyr) / duration)
        : 0;
      const curriculumZh = cleanList(v3?.curriculum?.length ? v3.curriculum : v2?.curriculum);
      const careersZh = cleanList(v3?.careerProspects ?? v2?.careerProspects);
      const language = languageRequirement(row.languageRequirement || {}, v2, v3);
      const sourceNote = [
        v3?.tuitionNote || v2?.remarks || row.officialTuitionNote || "",
        "本条学费为 INTI 官方已采集近似金额或多费用选项；官方未公布可核准为精确总学费的国际学生总额，且公布费用不含 6% SST。"
      ].filter(Boolean).join(" ");

      await connection.execute(
        `UPDATE programs
         SET name = ?,
             faculty = ?,
             facultyZh = ?,
             durationYears = ?,
             tuitionAmount = ?,
             tuitionCurrency = 'MYR',
             annualTuitionCny = ?,
             officialTuitionMYR = NULL,
             officialTuitionNote = ?,
             officialFeeAuditedAt = '2026-06-24',
             intakeMonths = ?,
             languageRequirement = ?,
             requirement = ?,
             studyMode = ?,
             specialRequirementsNote = ?,
             curriculum = ?,
             careers = ?,
             officialSourceUrl = COALESCE(NULLIF(?, ''), officialSourceUrl),
             officialFeeSourceUrl = COALESCE(NULLIF(?, ''), officialFeeSourceUrl),
             officialVerifiedAt = '2026-06-24',
             officialSourceStatus = 'official-verified',
             publicDisplayStatus = 'ready',
             isPublished = 1,
             publicDisplayNote = 'Official-only INTI collected fields were synced into the existing StudyMY full-stack display on 2026-06-24. Tuition amount is approximate/pending-review because INTI publishes approximate fees and excludes 6% SST.'
         WHERE id = ?`,
        [
          JSON.stringify(localizedText(row.name, row.nameEnOfficial, v3?.name || v2?.name)),
          JSON.stringify(localizedText(row.faculty, v3?.faculty || v2?.faculty || row.faculty?.en || "", v3?.facultyZh || v3?.faculty || v2?.faculty)),
          v3?.facultyZh || v3?.faculty || v2?.faculty || row.faculty?.["zh-CN"] || "",
          duration,
          tuitionAmount,
          annualTuitionCny,
          sourceNote,
          JSON.stringify(intakeMonths(v3 || v2)),
          JSON.stringify(language),
          JSON.stringify(requirement(row.requirement || {}, v2, v3)),
          studyMode(row.studyMode, v2, v3),
          specialRequirements(row.reviewReason, v2, v3),
          JSON.stringify(localizedArray(row.curriculum, curriculumZh)),
          JSON.stringify(localizedArray(row.careers, careersZh)),
          v3?.officialSourceUrl || v2?.officialSourceUrl || "",
          v3?.officialFeeSourceUrl || v2?.officialFeeSourceUrl || "",
          row.id
        ]
      );

      report.updated.push({
        code: row.code,
        nameEnOfficial: row.nameEnOfficial,
        tuitionAmount,
        durationYears: duration,
        ielts: Number(language.ielts) || null,
        curriculumZh: curriculumZh.length,
        careersZh: careersZh.length
      });
    }

    await connection.execute(
      `UPDATE universities u
       SET programCount = (
             SELECT COUNT(*) FROM programs p
             WHERE p.universityId = u.id
               AND p.isPublished = 1
               AND p.publicDisplayStatus IN ('ready', 'current-cycle-not-open', 'not-available-for-international')
           ),
           tuitionMinCny = (
             SELECT COALESCE(MIN(NULLIF(p.annualTuitionCny, 0)), u.tuitionMinCny)
             FROM programs p
             WHERE p.universityId = u.id
               AND p.slug LIKE 'inti-official-2026-review-row-%'
           ),
           tuitionMaxCny = (
             SELECT COALESCE(MAX(NULLIF(p.annualTuitionCny, 0)), u.tuitionMaxCny)
             FROM programs p
             WHERE p.universityId = u.id
               AND p.slug LIKE 'inti-official-2026-review-row-%'
           ),
           minIelts = (
             SELECT COALESCE(MIN(CAST(JSON_UNQUOTE(JSON_EXTRACT(p.languageRequirement, '$.ielts')) AS DECIMAL(3,1))), u.minIelts)
             FROM programs p
             WHERE p.universityId = u.id
               AND p.slug LIKE 'inti-official-2026-review-row-%'
               AND CAST(JSON_UNQUOTE(JSON_EXTRACT(p.languageRequirement, '$.ielts')) AS DECIMAL(3,1)) > 0
           )
       WHERE u.code = 'INTI'`
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  const output = resolve(repositoryRoot, "data/imports/iiu/2026-06-24/inti-collected-fields-sync-report-20260624.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    matched: report.matched,
    missing: report.missing.length,
    updated: report.updated.length,
    output
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
