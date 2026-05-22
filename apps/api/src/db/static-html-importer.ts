import "reflect-metadata";
import { DataSource, In, Not, type Repository } from "typeorm";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";
import type { StaticCatalog, StaticProgramSeed, StaticUniversitySeed } from "./static-html-catalog.js";
import { STATIC_HTML_EXPECTED_STATS } from "./static-html-catalog.js";

export interface StaticCatalogDbStats {
  universityCount: number;
  programCount: number;
  readyProgramCount: number;
  officialTuitionMYRCount: number;
  officialFeeSourceUrlCount: number;
  officialIntakeCount: number;
}

export interface StaticCatalogImportOptions {
  pruneCatalog?: boolean;
}

export interface StaticCatalogImportSummary {
  createdUniversities: number;
  updatedUniversities: number;
  createdPrograms: number;
  updatedPrograms: number;
  prunedUniversities: number;
  prunedPrograms: number;
  dbStats: StaticCatalogDbStats;
  expectedStats: typeof STATIC_HTML_EXPECTED_STATS;
  warnings: string[];
}

export function createCatalogDataSource() {
  loadEnvFiles();
  return new DataSource({
    type: "mysql",
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    username: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "123456",
    database: process.env.MYSQL_DATABASE || "study_malaysia",
    entities: [...ALL_ENTITIES],
    synchronize: true,
    charset: "utf8mb4_unicode_ci"
  });
}

async function findExistingUniversity(
  repository: Repository<UniversityEntity>,
  item: StaticUniversitySeed
) {
  return repository.findOne({ where: [{ code: item.code }, { slug: item.slug }] });
}

async function findExistingProgram(
  repository: Repository<ProgramEntity>,
  item: StaticProgramSeed
) {
  return repository.findOne({ where: [{ code: item.code }, { slug: item.slug }] });
}

export async function getStaticCatalogDbStats(dataSource: DataSource): Promise<StaticCatalogDbStats> {
  const universityRepository = dataSource.getRepository(UniversityEntity);
  const programRepository = dataSource.getRepository(ProgramEntity);

  const [
    universityCount,
    programCount,
    readyProgramCount,
    officialTuitionMYRCount,
    officialFeeSourceUrlCount,
    officialIntakeCount
  ] = await Promise.all([
    universityRepository.count(),
    programRepository.count(),
    programRepository.count({ where: { publicDisplayStatus: "ready" } }),
    programRepository.createQueryBuilder("program").where("program.officialTuitionMYR IS NOT NULL").getCount(),
    programRepository.createQueryBuilder("program").where("program.officialFeeSourceUrl <> ''").getCount(),
    programRepository.createQueryBuilder("program").where("program.officialIntake <> ''").getCount()
  ]);

  return {
    universityCount,
    programCount,
    readyProgramCount,
    officialTuitionMYRCount,
    officialFeeSourceUrlCount,
    officialIntakeCount
  };
}

async function refreshProgramCounts(dataSource: DataSource, universityIds: number[]) {
  if (!universityIds.length) return;
  const universityRepository = dataSource.getRepository(UniversityEntity);
  const programRepository = dataSource.getRepository(ProgramEntity);
  const rows = await programRepository
    .createQueryBuilder("program")
    .select("program.universityId", "universityId")
    .addSelect("COUNT(*)", "programCount")
    .where("program.universityId IN (:...universityIds)", { universityIds })
    .groupBy("program.universityId")
    .getRawMany<{ universityId: number; programCount: string }>();
  const counts = new Map(rows.map((row) => [Number(row.universityId), Number(row.programCount)]));
  const universities = await universityRepository.find({ where: { id: In(universityIds) } });
  for (const university of universities) {
    university.programCount = counts.get(university.id) || 0;
  }
  await universityRepository.save(universities);
}

export async function importStaticCatalog(
  dataSource: DataSource,
  catalog: StaticCatalog,
  options: StaticCatalogImportOptions = {}
): Promise<StaticCatalogImportSummary> {
  const universityRepository = dataSource.getRepository(UniversityEntity);
  const programRepository = dataSource.getRepository(ProgramEntity);
  const pruneCatalog = options.pruneCatalog ?? true;

  const summary: StaticCatalogImportSummary = {
    createdUniversities: 0,
    updatedUniversities: 0,
    createdPrograms: 0,
    updatedPrograms: 0,
    prunedUniversities: 0,
    prunedPrograms: 0,
    dbStats: {
      universityCount: 0,
      programCount: 0,
      readyProgramCount: 0,
      officialTuitionMYRCount: 0,
      officialFeeSourceUrlCount: 0,
      officialIntakeCount: 0
    },
    expectedStats: STATIC_HTML_EXPECTED_STATS,
    warnings: [...catalog.warnings]
  };

  const savedUniversities = new Map<string, UniversityEntity>();

  for (const item of catalog.universities) {
    const current = await findExistingUniversity(universityRepository, item);
    const { sourceId, ...universityData } = item;
    void sourceId;
    const saved = await universityRepository.save(universityRepository.create({ ...universityData, id: current?.id }));
    savedUniversities.set(item.code, saved);
    if (current) summary.updatedUniversities += 1;
    else summary.createdUniversities += 1;
  }

  for (const item of catalog.programs) {
    const university = savedUniversities.get(item.universityCode);
    if (!university) {
      summary.warnings.push(`Skipped program ${item.code}; missing university ${item.universityCode}.`);
      continue;
    }
    const current = await findExistingProgram(programRepository, item);
    const { sourceId, universityCode, ...programData } = item;
    void sourceId;
    void universityCode;
    await programRepository.save(
      programRepository.create({
        ...programData,
        id: current?.id,
        universityId: university.id
      })
    );
    if (current) summary.updatedPrograms += 1;
    else summary.createdPrograms += 1;
  }

  if (pruneCatalog) {
    const programCodes = catalog.programs.map((item) => item.code);
    const universityCodes = catalog.universities.map((item) => item.code);
    const staleProgramCount = await programRepository.count({ where: { code: Not(In(programCodes)) } });
    if (staleProgramCount) {
      await programRepository.delete({ code: Not(In(programCodes)) });
    }
    summary.prunedPrograms = staleProgramCount;

    const staleUniversityCount = await universityRepository.count({ where: { code: Not(In(universityCodes)) } });
    if (staleUniversityCount) {
      await universityRepository.delete({ code: Not(In(universityCodes)) });
    }
    summary.prunedUniversities = staleUniversityCount;
  }

  await refreshProgramCounts(dataSource, Array.from(savedUniversities.values()).map((item) => item.id));
  summary.dbStats = await getStaticCatalogDbStats(dataSource);

  return summary;
}

export function compareDbStats(stats: StaticCatalogDbStats): string[] {
  const errors: string[] = [];
  for (const [key, expected] of Object.entries(STATIC_HTML_EXPECTED_STATS)) {
    const actual = stats[key as keyof StaticCatalogDbStats];
    if (actual !== expected) {
      errors.push(`Expected database ${key}=${expected}, got ${actual}`);
    }
  }
  return errors;
}
