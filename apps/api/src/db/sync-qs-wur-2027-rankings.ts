import "reflect-metadata";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import {
  QS_UNRANKED_RANK,
  QS_WORLD_RANKING_NAME,
  QS_WORLD_RANKING_YEAR,
  normalizeQsRankDisplay,
  type LocalizedText,
  type QsWorldRankContext
} from "@studymy/shared";
import { DataSource } from "typeorm";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, UniversityEntity } from "./entities.js";

type RankingEntry = {
  code: string;
  qsTitle: string;
  qsProfileUrl: string;
  qsCountry: string;
  qsCity: string;
  rankDisplay: string;
  rankSort: number;
  officialSortRank: number;
  overallScore: string | null;
  context: QsWorldRankContext;
  status: "ranked";
  sourceUrl: string;
};

type RankingSource = {
  rankingName: string;
  rankingYear: number;
  publishedAt: string;
  retrievedAt: string;
  sourcePageUrl: string;
  sourceNid: string;
  unrankedRankSort: number;
  entries: RankingEntry[];
};

type QsWorldProfile = {
  name: string;
  year: number;
  status: "ranked" | "not-ranked";
  context: QsWorldRankContext;
  rankDisplay: string | null;
  rankSort: number;
  officialSortRank?: number;
  overallScore?: string | null;
  sourceUrl: string;
  profileUrl?: string;
  qsTitle?: string;
  qsCountry?: string;
  qsCity?: string;
  publishedAt: string;
  retrievedAt: string;
  note?: string;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const defaultSourcePath = resolve(repoRoot, "data/imports/qs/2026-06-19/qs-wur-2027-study-my/rankings.json");
const expectedUniversityCount = 119;

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cloneProfile(value: unknown) {
  const profile = { ...asRecord(value) };
  if (Array.isArray((value as { rankings?: unknown } | null)?.rankings) && !profile.legacyRankings) {
    profile.legacyRankings = (value as { rankings: unknown }).rankings;
  }
  return profile;
}

function createQsWorldProfile(entry: RankingEntry | undefined, source: RankingSource): QsWorldProfile {
  if (!entry) {
    return {
      name: source.rankingName || QS_WORLD_RANKING_NAME,
      year: source.rankingYear || QS_WORLD_RANKING_YEAR,
      status: "not-ranked",
      context: "not-ranked",
      rankDisplay: null,
      rankSort: source.unrankedRankSort || QS_UNRANKED_RANK,
      sourceUrl: source.sourcePageUrl,
      publishedAt: source.publishedAt,
      retrievedAt: source.retrievedAt,
      note: "No matching row in the official QS WUR 2027 Malaysia country filter or configured parent-institution mappings."
    };
  }

  return {
    name: source.rankingName || QS_WORLD_RANKING_NAME,
    year: source.rankingYear || QS_WORLD_RANKING_YEAR,
    status: "ranked",
    context: entry.context,
    rankDisplay: entry.rankDisplay,
    rankSort: entry.rankSort,
    officialSortRank: entry.officialSortRank,
    overallScore: entry.overallScore,
    sourceUrl: entry.sourceUrl,
    profileUrl: entry.qsProfileUrl,
    qsTitle: entry.qsTitle,
    qsCountry: entry.qsCountry,
    qsCity: entry.qsCity,
    publishedAt: source.publishedAt,
    retrievedAt: source.retrievedAt
  };
}

function updateOfficialProfile(university: UniversityEntity, entry: RankingEntry | undefined, source: RankingSource) {
  const profile = cloneProfile(university.officialProfile);
  const rankings = asRecord(profile.rankings);
  profile.rankings = {
    ...rankings,
    qsWorld: createQsWorldProfile(entry, source)
  };
  return profile;
}

function updateUsmDescription(university: UniversityEntity, entry: RankingEntry | undefined): LocalizedText {
  if (university.code !== "USM" || !entry) return university.description;
  const display = entry.rankDisplay;
  return {
    en: String(university.description.en || "").replace(
      /ranked\s+[^,]+?\s+in the QS World University Rankings 2026/i,
      `ranked ${display} in the QS World University Rankings 2027`
    ),
    ms: String(university.description.ms || "").replace(
      /berada pada kedudukan\s+[^ ]+\s+dalam QS World University Rankings 2026/i,
      `berada pada kedudukan ${display} dalam QS World University Rankings 2027`
    ),
    "zh-CN": String(university.description["zh-CN"] || "")
      .replace(/QS 世界排名第\s*134\s*位（2026 年）/, `QS 世界大学排名 2027 第 ${display} 位`)
      .replace(/QS 世界排名第\s*134\s*位/, `QS 世界大学排名 2027 第 ${display} 位`),
    "zh-TW": String(university.description["zh-TW"] || "")
      .replace(/QS 世界排名第\s*134\s*位（2026 年）/, `QS 世界大學排名 2027 第 ${display} 位`)
      .replace(/QS 世界排名第\s*134\s*位/, `QS 世界大學排名 2027 第 ${display} 位`)
  };
}

function replaceStaleQsWurCopy(value: string, entry: RankingEntry | undefined) {
  if (!entry || !value.includes("QS")) return value;
  const rank = entry.rankDisplay;
  const rankLabel = `QS WUR 2027 #${rank}`;
  return value
    .replace(/QS World University Rankings 2026:\s*#=?\d+/gi, `QS WUR 2027: #${rank}`)
    .replace(/QS Asian University Rankings 2026:\s*#=?\d+/gi, "QS Asian University Rankings 2026")
    .replace(/2026\s*年\s*QS World University Rankings\s*中位列\s*#=?\d+/gi, `QS WUR 2027 中位列 #${rank}`)
    .replace(/2026\s*QS\s*世界排名第\s*\d+\s*位/g, rankLabel)
    .replace(/QS\s*世界排名第\s*\d+\s*位（2026\s*年）/g, rankLabel)
    .replace(/QS\s*世界\s*\d+\s*位（2026\s*年）/g, rankLabel)
    .replace(/QS\s*世界大学排名\s*2026\s*第\s*\d+/g, rankLabel)
    .replace(/QS\s*世界大學排名\s*2026\s*第\s*\d+/g, rankLabel)
    .replace(/QS\s*世界第\s*\d+（2026）/g, rankLabel)
    .replace(/QS\s*世界第\s*\d+（2026年）/g, rankLabel)
    .replace(/QS\s*#\d+（母校）/g, `${rankLabel}（母校）`)
    .replace(/QS\s*#\d+/g, rankLabel)
    .replace(/(QS WUR 2027 #\S+)全马私立最高（2026）/g, "$1")
    .replace(/(QS WUR 2027 #\S+)全馬私立最高（2026）/g, "$1")
    .replace(/Monash University 2026全球排名作参考/g, `Monash University QS WUR 2027 全球排名 #${rank} 作参考`)
    .replace(/University of Nottingham 2026全球排名作参考/g, `University of Nottingham QS WUR 2027 全球排名 #${rank} 作参考`)
    .replace(/Monash University 2026全球排名/g, `Monash University QS WUR 2027 全球排名 #${rank}`)
    .replace(/University of Nottingham 2026全球排名/g, `University of Nottingham QS WUR 2027 全球排名 #${rank}`)
    .replace(/2026全球排名作参考/g, `QS WUR 2027 全球排名 #${rank} 作参考`)
    .replace(/2026全球排名/g, `QS WUR 2027 全球排名 #${rank}`);
}

function updateLocalizedTextCopy(value: LocalizedText, entry: RankingEntry | undefined): LocalizedText {
  return {
    en: replaceStaleQsWurCopy(String(value.en || ""), entry),
    ms: replaceStaleQsWurCopy(String(value.ms || ""), entry),
    "zh-CN": replaceStaleQsWurCopy(String(value["zh-CN"] || ""), entry),
    "zh-TW": replaceStaleQsWurCopy(String(value["zh-TW"] || ""), entry)
  };
}

function updateLocalizedArrayCopy(value: UniversityEntity["highlights"], entry: RankingEntry | undefined) {
  return {
    en: (value.en || []).map((item) => replaceStaleQsWurCopy(String(item), entry)),
    ms: (value.ms || []).map((item) => replaceStaleQsWurCopy(String(item), entry)),
    "zh-CN": (value["zh-CN"] || []).map((item) => replaceStaleQsWurCopy(String(item), entry)),
    "zh-TW": (value["zh-TW"] || []).map((item) => replaceStaleQsWurCopy(String(item), entry))
  };
}

function describeDiff(university: UniversityEntity, entry: RankingEntry | undefined, source: RankingSource) {
  const afterRank = entry?.rankSort ?? (source.unrankedRankSort || QS_UNRANKED_RANK);
  const afterDisplay = normalizeQsRankDisplay(afterRank, entry?.rankDisplay);
  return {
    code: university.code,
    slug: university.slug,
    nameEn: university.name.en,
    beforeRank: university.qsRank,
    afterRank,
    beforeDisplay: normalizeQsRankDisplay(university.qsRank),
    afterDisplay,
    context: entry?.context ?? "not-ranked",
    changed: university.qsRank !== afterRank
  };
}

function validateSource(source: RankingSource) {
  const errors: string[] = [];
  if (source.rankingYear !== QS_WORLD_RANKING_YEAR) errors.push(`Expected rankingYear ${QS_WORLD_RANKING_YEAR}.`);
  if (!source.entries.length) errors.push("Ranking source has no entries.");
  const codes = new Set<string>();
  for (const entry of source.entries) {
    if (codes.has(entry.code)) errors.push(`Duplicate ranking entry code ${entry.code}.`);
    codes.add(entry.code);
    if (!entry.rankDisplay || entry.rankSort <= 0 || entry.rankSort >= QS_UNRANKED_RANK) {
      errors.push(`Invalid rank entry for ${entry.code}.`);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
}

function verifyCurrent(universities: UniversityEntity[]) {
  const errors: string[] = [];
  if (universities.length !== expectedUniversityCount) {
    errors.push(`Expected ${expectedUniversityCount} universities, got ${universities.length}.`);
  }
  for (const university of universities) {
    if (university.qsRank <= 0) errors.push(`${university.code} has invalid qsRank ${university.qsRank}.`);
    const qsWorld = asRecord(asRecord(asRecord(university.officialProfile).rankings).qsWorld);
    if (qsWorld.year !== QS_WORLD_RANKING_YEAR) errors.push(`${university.code} missing QS WUR 2027 profile.`);
    if (university.qsRank === QS_UNRANKED_RANK && qsWorld.status !== "not-ranked") {
      errors.push(`${university.code} is unranked but qsWorld.status is not not-ranked.`);
    }
    if (university.qsRank < QS_UNRANKED_RANK && qsWorld.status !== "ranked") {
      errors.push(`${university.code} is ranked but qsWorld.status is not ranked.`);
    }
  }
  const usm = universities.find((item) => item.code === "USM");
  if (!usm || usm.qsRank !== 128) errors.push("USM must have qsRank 128 for QS WUR 2027 display =128.");
  const utm = universities.find((item) => item.code === "UTM");
  if (!utm || utm.qsRank !== 158) errors.push("UTM must have qsRank 158 and must not remain 0.");
  if (errors.length) throw new Error(errors.join("\n"));
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
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", "catalog:*", "COUNT", 200);
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
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const sourcePath = resolve(readArgValue("--source") || defaultSourcePath);
  const backupPath = resolve(
    readArgValue("--backup-output") ||
      `tmp/backups/qs-wur-2027-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const reportPath = resolve(
    readArgValue("--report-output") ||
      `tmp/qs-wur-2027-sync-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  const source = readJson<RankingSource>(sourcePath);
  validateSource(source);
  const rankingsByCode = new Map(source.entries.map((entry) => [entry.code, entry]));

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
    const repository = dataSource.getRepository(UniversityEntity);
    const universities = await repository.find({ where: { isPublished: true }, order: { code: "ASC" } });
    const diffs = universities.map((university) => describeDiff(university, rankingsByCode.get(university.code), source));
    const rankedCodes = diffs.filter((item) => item.afterRank < QS_UNRANKED_RANK).map((item) => item.code);
    const unmatchedSourceCodes = source.entries.map((entry) => entry.code).filter((code) => !universities.some((university) => university.code === code));
    const report = {
      mode: verifyOnly ? "verify-only" : confirm ? "write" : "dry-run",
      sourcePath,
      source: {
        rankingName: source.rankingName,
        rankingYear: source.rankingYear,
        publishedAt: source.publishedAt,
        retrievedAt: source.retrievedAt,
        entries: source.entries.length
      },
      counts: {
        universities: universities.length,
        ranked: rankedCodes.length,
        unranked: universities.length - rankedCodes.length,
        changed: diffs.filter((item) => item.changed).length,
        unmatchedSourceCodes: unmatchedSourceCodes.length
      },
      rankedCodes,
      unmatchedSourceCodes,
      changes: diffs.filter((item) => item.changed)
    };

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (verifyOnly) {
      verifyCurrent(universities);
      console.log(JSON.stringify({ ...report, verified: true, reportPath }, null, 2));
      return;
    }

    if (!confirm) {
      console.log(JSON.stringify({ ...report, writePolicy: "dry-run only; rerun with --confirm-import to write", reportPath }, null, 2));
      return;
    }

    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, JSON.stringify({
      createdAt: new Date().toISOString(),
      sourcePath,
      universities: universities.map((university) => ({
        id: university.id,
        code: university.code,
        slug: university.slug,
        qsRank: university.qsRank,
        qsAsiaRank: university.qsAsiaRank,
        description: university.description,
        officialProfile: university.officialProfile
      }))
    }, null, 2));

    await dataSource.transaction(async (manager) => {
      const transactionalRepository = manager.getRepository(UniversityEntity);
      for (const university of universities) {
        const entry = rankingsByCode.get(university.code);
        university.qsRank = entry?.rankSort ?? (source.unrankedRankSort || QS_UNRANKED_RANK);
        university.officialProfile = updateOfficialProfile(university, entry, source);
        university.description = updateLocalizedTextCopy(updateUsmDescription(university, entry), entry);
        university.highlights = updateLocalizedArrayCopy(university.highlights, entry);
        await transactionalRepository.save(university);
      }
    });

    const after = await repository.find({ where: { isPublished: true }, order: { code: "ASC" } });
    verifyCurrent(after);
    const cacheCleared = await clearCatalogCache();
    console.log(JSON.stringify({ ...report, backupPath, reportPath, verified: true, cacheCleared }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
