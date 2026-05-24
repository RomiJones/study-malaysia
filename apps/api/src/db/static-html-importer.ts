import "reflect-metadata";
import { DataSource, In, Not, type Repository } from "typeorm";
import { loadEnvFiles } from "../config/env.js";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";
import type {
  StaticCatalog,
  StaticCatalogExpectedStats,
  StaticCatalogLayerName,
  StaticProgramSeed,
  StaticUniversitySeed
} from "./static-html-catalog.js";
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

export interface StaticCatalogPruneOptions {
  noPrune?: boolean;
  confirmPrune?: boolean;
  scopeActive?: boolean;
}

export interface StaticCatalogDbStatsOptions {
  universityCodes?: string[];
  programCodes?: string[];
}

export interface StaticCatalogQualitySummary {
  publicDisplayStatusCounts: Record<string, number>;
  programsByLevel: Record<string, number>;
  readyByLevel: Record<string, number>;
  readyCategoryCount: number;
  missingOfficialTuitionMYRCount: number;
  missingOfficialFeeSourceUrlCount: number;
  missingOfficialIntakeCount: number;
  missingOfficialProgramSourceUrlCount: number;
}

export interface StaticCatalogImportConflict {
  entity: "university" | "program";
  code: string;
  slug: string;
  codeMatchId: number | null;
  slugMatchId: number | null;
  targetUniversityId?: number | null;
  codeMatchUniversityId?: number | null;
  slugMatchUniversityId?: number | null;
  reason?: "code-slug-mismatch" | "cross-university-match";
}

export interface StaticCatalogImportPlan {
  createdUniversities: number;
  updatedUniversities: number;
  createdPrograms: number;
  updatedPrograms: number;
  skippedPrograms: number;
  staleUniversities: number;
  stalePrograms: number;
  pruneCatalog: boolean;
  scopeActive: boolean;
  scopeUniversityCodes: string[];
  dbStatsBefore: StaticCatalogDbStats;
  expectedStats: StaticCatalogExpectedStats;
  quality: StaticCatalogQualitySummary;
  conflicts: StaticCatalogImportConflict[];
  warnings: string[];
}

export interface StaticCatalogImportSummary {
  createdUniversities: number;
  updatedUniversities: number;
  createdPrograms: number;
  updatedPrograms: number;
  prunedUniversities: number;
  prunedPrograms: number;
  dbStats: StaticCatalogDbStats;
  expectedStats: StaticCatalogExpectedStats;
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

export function shouldPruneStaticCatalog(
  layer: StaticCatalogLayerName,
  options: StaticCatalogPruneOptions = {}
): boolean {
  if (options.noPrune) return false;
  if (options.scopeActive) return options.confirmPrune === true;
  if (layer === "base") return true;
  return options.confirmPrune === true;
}

async function findExistingUniversity(
  repository: Repository<UniversityEntity>,
  item: StaticUniversitySeed
) {
  const { current, conflict } = await findUniversityMatch(repository, item);
  if (conflict) {
    throw new Error(`Static catalog university conflict for ${item.code}/${item.slug}: code and slug match different rows.`);
  }
  return current;
}

async function findExistingProgram(
  repository: Repository<ProgramEntity>,
  item: StaticProgramSeed,
  targetUniversityId: number
) {
  const { current, conflict } = await findProgramMatch(repository, item, targetUniversityId);
  if (conflict) {
    throw new Error(`Static catalog program conflict for ${item.code}/${item.slug}: code or slug matches another row or university.`);
  }
  return current;
}

async function findUniversityMatch(repository: Repository<UniversityEntity>, item: StaticUniversitySeed) {
  const [byCode, bySlug] = await Promise.all([
    repository.findOne({ where: { code: item.code } }),
    repository.findOne({ where: { slug: item.slug } })
  ]);
  const conflict =
    byCode && bySlug && byCode.id !== bySlug.id
      ? {
          entity: "university" as const,
          code: item.code,
          slug: item.slug,
          codeMatchId: byCode.id,
          slugMatchId: bySlug.id
        }
      : null;
  return {
    current: byCode || bySlug || null,
    conflict
  };
}

function createProgramConflict(
  item: StaticProgramSeed,
  codeMatch: ProgramEntity | null,
  slugMatch: ProgramEntity | null,
  reason: StaticCatalogImportConflict["reason"],
  targetUniversityId: number | null
): StaticCatalogImportConflict {
  return {
    entity: "program",
    code: item.code,
    slug: item.slug,
    codeMatchId: codeMatch?.id ?? null,
    slugMatchId: slugMatch?.id ?? null,
    targetUniversityId,
    codeMatchUniversityId: codeMatch?.universityId ?? null,
    slugMatchUniversityId: slugMatch?.universityId ?? null,
    reason
  };
}

async function findProgramMatch(
  repository: Repository<ProgramEntity>,
  item: StaticProgramSeed,
  targetUniversityId: number | null
) {
  const [byCode, bySlug] = await Promise.all([
    repository.find({ where: { code: item.code } }),
    repository.findOne({ where: { slug: item.slug } })
  ]);

  const codeMatchOutsideTarget = byCode.find((program) => program.universityId !== targetUniversityId) || null;
  const slugMatchOutsideTarget = bySlug && bySlug.universityId !== targetUniversityId ? bySlug : null;
  if (codeMatchOutsideTarget || slugMatchOutsideTarget) {
    return {
      current: null,
      conflict: createProgramConflict(
        item,
        codeMatchOutsideTarget,
        slugMatchOutsideTarget,
        "cross-university-match",
        targetUniversityId
      )
    };
  }

  const byCodeInTarget = byCode.find((program) => program.universityId === targetUniversityId) || null;
  const conflict =
    byCodeInTarget && bySlug && byCodeInTarget.id !== bySlug.id
      ? createProgramConflict(item, byCodeInTarget, bySlug, "code-slug-mismatch", targetUniversityId)
      : null;
  return {
    current: byCodeInTarget || bySlug || null,
    conflict
  };
}

export function getStaticCatalogDbStatsOptions(catalog: StaticCatalog): StaticCatalogDbStatsOptions {
  if (catalog.scope) {
    return { universityCodes: catalog.universities.map((university) => university.code) };
  }
  if (catalog.layer === "base" || catalog.layer === "supplement") {
    return {
      universityCodes: catalog.universities.map((university) => university.code),
      programCodes: catalog.programs.map((program) => program.code)
    };
  }
  return {};
}

export async function getStaticCatalogDbStats(
  dataSource: DataSource,
  options: StaticCatalogDbStatsOptions = {}
): Promise<StaticCatalogDbStats> {
  const universityRepository = dataSource.getRepository(UniversityEntity);
  const programRepository = dataSource.getRepository(ProgramEntity);
  const universityCodes = options.universityCodes?.filter(Boolean) || [];
  const programCodes = options.programCodes?.filter(Boolean) || [];
  if (options.universityCodes && !universityCodes.length) {
    return {
      universityCount: 0,
      programCount: 0,
      readyProgramCount: 0,
      officialTuitionMYRCount: 0,
      officialFeeSourceUrlCount: 0,
      officialIntakeCount: 0
    };
  }

  const scopedPrograms = () => {
    const query = programRepository.createQueryBuilder("program");
    if (universityCodes.length) {
      query.innerJoin("program.university", "university").where("university.code IN (:...universityCodes)", { universityCodes });
    }
    if (options.programCodes) {
      if (programCodes.length) {
        query.andWhere("program.code IN (:...programCodes)", { programCodes });
      } else {
        query.andWhere("1 = 0");
      }
    }
    return query;
  };

  const [
    universityCount,
    programCount,
    readyProgramCount,
    officialTuitionMYRCount,
    officialFeeSourceUrlCount,
    officialIntakeCount
  ] = await Promise.all([
    universityCodes.length ? universityRepository.count({ where: { code: In(universityCodes) } }) : universityRepository.count(),
    scopedPrograms().getCount(),
    scopedPrograms().andWhere("program.publicDisplayStatus = :ready", { ready: "ready" }).getCount(),
    scopedPrograms().andWhere("program.officialTuitionMYR IS NOT NULL").getCount(),
    scopedPrograms().andWhere("program.officialFeeSourceUrl <> ''").getCount(),
    scopedPrograms().andWhere("program.officialIntake <> ''").getCount()
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

function getCatalogQualitySummary(catalog: StaticCatalog): StaticCatalogQualitySummary {
  return {
    publicDisplayStatusCounts: catalog.stats.publicDisplayStatusCounts,
    programsByLevel: catalog.stats.programsByLevel,
    readyByLevel: catalog.stats.readyByLevel,
    readyCategoryCount: catalog.stats.readyCategoryCount,
    missingOfficialTuitionMYRCount: catalog.programs.filter((program) => program.officialTuitionMYR == null).length,
    missingOfficialFeeSourceUrlCount: catalog.programs.filter((program) => !program.officialFeeSourceUrl).length,
    missingOfficialIntakeCount: catalog.programs.filter((program) => !program.officialIntake).length,
    missingOfficialProgramSourceUrlCount: catalog.programs.filter((program) => !program.officialSourceUrl).length
  };
}

async function countStalePrograms(
  repository: Repository<ProgramEntity>,
  programCodes: string[],
  universityIds: number[] | null
): Promise<number> {
  if (!programCodes.length) return 0;
  const query = repository.createQueryBuilder("program").where("program.code NOT IN (:...programCodes)", { programCodes });
  if (universityIds) {
    if (!universityIds.length) return 0;
    query.andWhere("program.universityId IN (:...universityIds)", { universityIds });
  }
  return query.getCount();
}

async function countStaleUniversities(
  repository: Repository<UniversityEntity>,
  universityCodes: string[]
): Promise<number> {
  if (!universityCodes.length) return 0;
  return repository.count({ where: { code: Not(In(universityCodes)) } });
}

export async function previewStaticCatalogImport(
  dataSource: DataSource,
  catalog: StaticCatalog,
  options: StaticCatalogImportOptions = {}
): Promise<StaticCatalogImportPlan> {
  const universityRepository = dataSource.getRepository(UniversityEntity);
  const programRepository = dataSource.getRepository(ProgramEntity);
  const pruneCatalog = options.pruneCatalog ?? true;
  const scopeActive = Boolean(catalog.scope);
  const warnings = [...catalog.warnings];
  const conflicts: StaticCatalogImportConflict[] = [];
  const existingUniversityIds: number[] = [];
  const catalogUniversityIds = new Map<string, number | null>();
  let createdUniversities = 0;
  let updatedUniversities = 0;
  let createdPrograms = 0;
  let updatedPrograms = 0;
  let skippedPrograms = 0;

  for (const item of catalog.universities) {
    const match = await findUniversityMatch(universityRepository, item);
    if (match.conflict) {
      conflicts.push(match.conflict);
      continue;
    }
    if (match.current) {
      updatedUniversities += 1;
      existingUniversityIds.push(match.current.id);
      catalogUniversityIds.set(item.code, match.current.id);
    } else {
      createdUniversities += 1;
      catalogUniversityIds.set(item.code, null);
    }
  }

  for (const item of catalog.programs) {
    if (!catalogUniversityIds.has(item.universityCode)) {
      skippedPrograms += 1;
      warnings.push(`Skipped program ${item.code}; missing university ${item.universityCode}.`);
      continue;
    }
    const match = await findProgramMatch(programRepository, item, catalogUniversityIds.get(item.universityCode) ?? null);
    if (match.conflict) {
      conflicts.push(match.conflict);
      continue;
    }
    if (match.current) updatedPrograms += 1;
    else createdPrograms += 1;
  }

  const programCodes = catalog.programs.map((program) => program.code);
  const universityCodes = catalog.universities.map((university) => university.code);
  const stalePrograms = pruneCatalog
    ? await countStalePrograms(programRepository, programCodes, scopeActive ? existingUniversityIds : null)
    : 0;
  const staleUniversities = pruneCatalog && !scopeActive ? await countStaleUniversities(universityRepository, universityCodes) : 0;

  return {
    createdUniversities,
    updatedUniversities,
    createdPrograms,
    updatedPrograms,
    skippedPrograms,
    staleUniversities,
    stalePrograms,
    pruneCatalog,
    scopeActive,
    scopeUniversityCodes: universityCodes,
    dbStatsBefore: await getStaticCatalogDbStats(dataSource, getStaticCatalogDbStatsOptions(catalog)),
    expectedStats: catalog.expectedStats,
    quality: getCatalogQualitySummary(catalog),
    conflicts,
    warnings
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
    expectedStats: catalog.expectedStats,
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
    const current = await findExistingProgram(programRepository, item, university.id);
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
    const savedUniversityIds = Array.from(savedUniversities.values()).map((item) => item.id);
    const staleProgramCount = catalog.scope
      ? await countStalePrograms(programRepository, programCodes, savedUniversityIds)
      : await programRepository.count({ where: { code: Not(In(programCodes)) } });
    if (staleProgramCount) {
      if (catalog.scope) {
        await programRepository
          .createQueryBuilder()
          .delete()
          .from(ProgramEntity)
          .where("code NOT IN (:...programCodes)", { programCodes })
          .andWhere("universityId IN (:...savedUniversityIds)", { savedUniversityIds })
          .execute();
      } else {
        await programRepository.delete({ code: Not(In(programCodes)) });
      }
    }
    summary.prunedPrograms = staleProgramCount;

    const staleUniversityCount = catalog.scope ? 0 : await universityRepository.count({ where: { code: Not(In(universityCodes)) } });
    if (staleUniversityCount) {
      await universityRepository.delete({ code: Not(In(universityCodes)) });
    }
    summary.prunedUniversities = staleUniversityCount;
  }

  await refreshProgramCounts(dataSource, Array.from(savedUniversities.values()).map((item) => item.id));
  summary.dbStats = await getStaticCatalogDbStats(dataSource, getStaticCatalogDbStatsOptions(catalog));

  return summary;
}

export function compareDbStats(
  stats: StaticCatalogDbStats,
  expectedStats: StaticCatalogExpectedStats = STATIC_HTML_EXPECTED_STATS
): string[] {
  const errors: string[] = [];
  for (const [key, expected] of Object.entries(expectedStats)) {
    const actual = stats[key as keyof StaticCatalogDbStats];
    if (actual !== expected) {
      errors.push(`Expected database ${key}=${expected}, got ${actual}`);
    }
  }
  return errors;
}
