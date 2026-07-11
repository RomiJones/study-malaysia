import "reflect-metadata";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import IORedis, { type Redis } from "ioredis";
import type { LocalizedText } from "@studymy/shared";
import { DataSource } from "typeorm";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, UniversityEntity } from "./entities.js";

const standardName: LocalizedText = {
  en: "Universiti Sains Malaysia",
  ms: "Universiti Sains Malaysia",
  "zh-CN": "马来西亚理科大学",
  "zh-TW": "馬來西亞理科大學"
};

const standardDescription: LocalizedText = {
  en: "Universiti Sains Malaysia (USM) is Malaysia's only APEX (Accelerated Programme for Excellence) university, ranked =128 in the QS World University Rankings 2027 and among Malaysia's leading universities. It is located in Penang, a popular tourism city with a lower cost of living than Kuala Lumpur. USM is known for science and engineering research, with chemistry, materials science, electronic engineering and biology ranked among the world's top 200. The university is highly international, with students from 85 countries.",
  ms: "Universiti Sains Malaysia (USM) ialah satu-satunya universiti APEX (Accelerated Programme for Excellence) di Malaysia, berada pada kedudukan =128 dalam QS World University Rankings 2027 dan antara universiti terkemuka di Malaysia. Terletak di Pulau Pinang, sebuah bandar pelancongan popular dengan kos sara hidup yang lebih rendah berbanding Kuala Lumpur. USM terkenal dengan penyelidikan sains dan kejuruteraan; kimia, sains bahan, kejuruteraan elektronik dan biologi berada dalam kelompok 200 terbaik dunia. Universiti ini sangat bersifat antarabangsa, dengan pelajar dari 85 negara.",
  "zh-CN": "马来西亚理科大学（USM）是马来西亚唯一的 APEX（Accelerated Programme for Excellence）大学，QS 世界大学排名 2027 第 =128 位，位居马来西亚前列。位于美丽的旅游城市槟城，生活费低于吉隆坡。USM 以理工科研究见长，化学、材料科学、电子工程、生物学均进入世界前 200。学校国际化程度高，拥有来自全球 85 个国家的留学生。",
  "zh-TW": "馬來西亞理科大學（USM）是馬來西亞唯一的 APEX（Accelerated Programme for Excellence）大學，QS 世界大學排名 2027 第 =128 位，位居馬來西亞前列。位於美麗的旅遊城市檳城，生活費低於吉隆坡。USM 以理工科研究見長，化學、材料科學、電子工程、生物學均進入世界前 200。學校國際化程度高，擁有來自全球 85 個國家的留學生。"
};

function readArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function equalJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffSnapshot(university: UniversityEntity) {
  return {
    name: {
      before: university.name,
      after: standardName,
      changed: !equalJson(university.name, standardName)
    },
    nameEnOfficial: {
      before: university.nameEnOfficial,
      after: standardName.en,
      changed: university.nameEnOfficial !== standardName.en
    },
    description: {
      before: university.description,
      after: standardDescription,
      changed: !equalJson(university.description, standardDescription)
    }
  };
}

function assertStandardized(university: UniversityEntity) {
  const errors: string[] = [];
  if (!equalJson(university.name, standardName)) errors.push("USM localized name is not standardized.");
  if (university.nameEnOfficial !== standardName.en) errors.push("USM official English name is not standardized.");
  if (!equalJson(university.description, standardDescription)) errors.push("USM description localization is not standardized.");
  if (university.shortName !== "USM") errors.push("USM shortName must remain USM.");
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
  const verifyOnly = process.argv.includes("--verify-only");
  const confirm = process.argv.includes("--confirm-import");
  const backupPath = resolve(
    readArgValue("--backup-output") ||
      `tmp/backups/usm-university-name-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

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
    const university = await repository.findOne({ where: { code: "USM" } });
    if (!university) throw new Error("USM university row not found.");

    const diff = diffSnapshot(university);
    if (verifyOnly) {
      assertStandardized(university);
      console.log(JSON.stringify({ mode: "verified", universityId: university.id, diff }, null, 2));
      return;
    }

    if (!confirm) {
      console.log(JSON.stringify({
        mode: "dry-run",
        universityId: university.id,
        slug: university.slug,
        code: university.code,
        writePolicy: {
          table: "universities",
          rowSelector: { code: "USM" },
          updateFields: ["name", "nameEnOfficial", "description"],
          preserveShortName: "USM",
          preservePrograms: true
        },
        diff
      }, null, 2));
      return;
    }

    mkdirSync(dirname(backupPath), { recursive: true });
    writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), university }, null, 2),
      "utf8"
    );

    await dataSource.transaction(async (manager) => {
      const transactionalRepository = manager.getRepository(UniversityEntity);
      const current = await transactionalRepository.findOne({ where: { id: university.id } });
      if (!current) throw new Error("USM university row disappeared during transaction.");
      current.name = standardName;
      current.nameEnOfficial = standardName.en;
      current.description = standardDescription;
      current.shortName = "USM";
      await transactionalRepository.save(current);
      assertStandardized(current);
    });

    const updated = await repository.findOneOrFail({ where: { id: university.id } });
    assertStandardized(updated);
    const catalogCacheCleared = await clearCatalogCache();
    console.log(JSON.stringify({
      mode: "imported",
      universityId: updated.id,
      slug: updated.slug,
      backupPath,
      catalogCacheCleared,
      diff,
      current: {
        name: updated.name,
        shortName: updated.shortName,
        nameEnOfficial: updated.nameEnOfficial,
        description: updated.description
      }
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
