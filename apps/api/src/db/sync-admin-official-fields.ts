import "reflect-metadata";

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { LocalizedStringArray, LocalizedText } from "@studymy/shared";
import { ProgramEntity, UniversityEntity } from "./entities.js";
import { createCatalogDataSource } from "./static-html-importer.js";

type SyncMode = "dry-run" | "applied";
type EntityType = "university" | "program";
type PatchValue = string | string[] | LocalizedStringArray;
type UniversitySyncField =
  | "nameEnOfficial"
  | "officialWebsite"
  | "studyPortalUrl"
  | "internationalPageUrl"
  | "applicationPortalUrl"
  | "officialAddress"
  | "applicationPeriods"
  | "applicationFees"
  | "applicationDocuments"
  | "chinaStudentRequirements"
  | "officialVerifiedAt";
type ProgramSyncField = "nameEnOfficial" | "tuitionDisplay";
type SyncField = UniversitySyncField | ProgramSyncField;

interface FieldPatch {
  entityType: EntityType;
  entityId: number;
  code: string;
  name: string;
  field: SyncField;
  sourcePath: string;
  previous: unknown;
  next: PatchValue;
}

interface SyncReport {
  mode: SyncMode;
  generatedAt: string;
  safety: {
    writesRequireConfirmFlag: boolean;
    overwriteExistingValues: false;
    synchronizeSchema: false;
  };
  summary: {
    universitiesScanned: number;
    programsScanned: number;
    universityRowsChanged: number;
    programRowsChanged: number;
    totalPatches: number;
    patchesByEntity: Record<EntityType, number>;
    patchesByField: Record<string, number>;
    reportPath: string;
  };
  patches: FieldPatch[];
}

interface CliOptions {
  confirm: boolean;
  output?: string;
}

const LOCALES = ["en", "ms", "zh-CN", "zh-TW"] as const;
const VERIFIED_FEE_STATUSES = new Set([
  "matched-official",
  "fee-sheet-verified",
  "official-approximate",
  "calculated-from-official-rate"
]);

export function collectUniversityPatches(university: UniversityEntity): FieldPatch[] {
  const profile = asRecord(university.officialProfile);
  const links = normalizeLinks(profile.officialLinks);
  const patches: FieldPatch[] = [];

  addStringPatch(patches, university, "nameEnOfficial", profile.legalName, "officialProfile.legalName");
  addStringPatch(patches, university, "officialWebsite", profile.officialWebsite, "officialProfile.officialWebsite");
  addStringPatch(patches, university, "studyPortalUrl", firstString(profile.studyPortalUrl, profile.studyPortal), "officialProfile.studyPortalUrl");
  addStringPatch(patches, university, "internationalPageUrl", firstString(profile.internationalPageUrl, profile.internationalPage), "officialProfile.internationalPageUrl");
  addStringPatch(patches, university, "applicationPortalUrl", firstString(profile.applicationPortalUrl, profile.applicationPortal), "officialProfile.applicationPortalUrl");
  addStringPatch(patches, university, "officialAddress", firstString(profile.address, profile.mrdAddress), "officialProfile.address");
  addStringPatch(patches, university, "officialVerifiedAt", normalizeDateString(profile.verifiedAt), "officialProfile.verifiedAt");

  addStringPatch(patches, university, "officialWebsite", pickUrl(links, ["official", "website", "home"]), "officialProfile.officialLinks");
  addStringPatch(patches, university, "studyPortalUrl", pickUrl(links, ["study", "course", "program", "programme", "academic"]), "officialProfile.officialLinks");
  addStringPatch(patches, university, "internationalPageUrl", pickUrl(links, ["international"]), "officialProfile.officialLinks");
  addStringPatch(patches, university, "applicationPortalUrl", pickUrl(links, ["apply", "application", "admission", "eadmission"]), "officialProfile.officialLinks");

  addStringListPatch(patches, university, "applicationPeriods", profile.applicationPeriods, "officialProfile.applicationPeriods");
  addStringListPatch(patches, university, "applicationFees", profile.applicationFees, "officialProfile.applicationFees");
  addLocalizedArrayPatch(patches, university, "applicationDocuments", profile.applicationDocuments, "officialProfile.applicationDocuments");
  addLocalizedArrayPatch(
    patches,
    university,
    "chinaStudentRequirements",
    firstValue(profile.chinaStudentRequirements, profile.chinaRequirement),
    "officialProfile.chinaRequirement"
  );

  return dedupePatches(patches);
}

export function collectProgramPatches(program: ProgramEntity): FieldPatch[] {
  const patches: FieldPatch[] = [];
  const name = asLocalizedText(program.name);
  addProgramStringPatch(patches, program, "nameEnOfficial", name.en, "name.en");
  addProgramStringPatch(patches, program, "tuitionDisplay", program.listTuitionText, "listTuitionText");

  if (
    isEmptyValue(program.tuitionDisplay) &&
    program.officialTuitionMYR != null &&
    VERIFIED_FEE_STATUSES.has(program.officialFeeAuditStatus)
  ) {
    addProgramStringPatch(
      patches,
      program,
      "tuitionDisplay",
      `RM ${Number(program.officialTuitionMYR).toLocaleString("en-US")}`,
      "officialTuitionMYR"
    );
  }

  return dedupePatches(patches);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const mode: SyncMode = options.confirm ? "applied" : "dry-run";
  const dataSource = createCatalogDataSource({ synchronize: false });
  await dataSource.initialize();

  try {
    const [universities, programs] = await Promise.all([
      dataSource.getRepository(UniversityEntity).find({ order: { code: "ASC" } }),
      dataSource.getRepository(ProgramEntity).find({ order: { code: "ASC" } })
    ]);
    const universityPatches = universities.flatMap(collectUniversityPatches);
    const programPatches = programs.flatMap(collectProgramPatches);
    const patches = [...universityPatches, ...programPatches];

    if (options.confirm && patches.length) {
      const universityPatchMap = groupPatches(universityPatches);
      const programPatchMap = groupPatches(programPatches);
      await dataSource.transaction(async (manager) => {
        for (const university of universities) {
          const rowPatches = universityPatchMap.get(university.id) || [];
          if (!rowPatches.length) continue;
          rowPatches.forEach((patch) => applyUniversityPatch(university, patch));
          await manager.getRepository(UniversityEntity).save(university);
        }
        for (const program of programs) {
          const rowPatches = programPatchMap.get(program.id) || [];
          if (!rowPatches.length) continue;
          rowPatches.forEach((patch) => applyProgramPatch(program, patch));
          await manager.getRepository(ProgramEntity).save(program);
        }
      });
    }

    const reportPath = await resolveReportPath(options.output, mode);
    const report = buildReport({
      mode,
      reportPath,
      universitiesScanned: universities.length,
      programsScanned: programs.length,
      patches
    });
    await writeJson(reportPath, report);
    printSummary(report);
  } finally {
    await dataSource.destroy();
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { confirm: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--confirm") {
      options.confirm = true;
      continue;
    }
    if (arg === "--output") {
      const next = args[index + 1];
      if (!next) throw new Error("--output requires a file path");
      options.output = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function buildReport(input: {
  mode: SyncMode;
  reportPath: string;
  universitiesScanned: number;
  programsScanned: number;
  patches: FieldPatch[];
}): SyncReport {
  const universityIds = new Set(input.patches.filter((patch) => patch.entityType === "university").map((patch) => patch.entityId));
  const programIds = new Set(input.patches.filter((patch) => patch.entityType === "program").map((patch) => patch.entityId));
  return {
    mode: input.mode,
    generatedAt: new Date().toISOString(),
    safety: {
      writesRequireConfirmFlag: true,
      overwriteExistingValues: false,
      synchronizeSchema: false
    },
    summary: {
      universitiesScanned: input.universitiesScanned,
      programsScanned: input.programsScanned,
      universityRowsChanged: universityIds.size,
      programRowsChanged: programIds.size,
      totalPatches: input.patches.length,
      patchesByEntity: {
        university: input.patches.filter((patch) => patch.entityType === "university").length,
        program: input.patches.filter((patch) => patch.entityType === "program").length
      },
      patchesByField: countBy(input.patches, (patch) => patch.field),
      reportPath: input.reportPath
    },
    patches: input.patches
  };
}

function addStringPatch(
  patches: FieldPatch[],
  university: UniversityEntity,
  field: UniversitySyncField,
  sourceValue: unknown,
  sourcePath: string
) {
  const next = normalizeString(sourceValue);
  if (!next || !isEmptyValue(valueOf(university, field))) return;
  patches.push(basePatch(university, field, sourcePath, next));
}

function addStringListPatch(
  patches: FieldPatch[],
  university: UniversityEntity,
  field: UniversitySyncField,
  sourceValue: unknown,
  sourcePath: string
) {
  const next = normalizeStringList(sourceValue);
  if (!next.length || !isEmptyValue(valueOf(university, field))) return;
  patches.push(basePatch(university, field, sourcePath, next));
}

function addLocalizedArrayPatch(
  patches: FieldPatch[],
  university: UniversityEntity,
  field: UniversitySyncField,
  sourceValue: unknown,
  sourcePath: string
) {
  const next = normalizeLocalizedArray(sourceValue);
  if (!hasLocalizedItems(next) || !isEmptyValue(valueOf(university, field))) return;
  patches.push(basePatch(university, field, sourcePath, next));
}

function addProgramStringPatch(
  patches: FieldPatch[],
  program: ProgramEntity,
  field: ProgramSyncField,
  sourceValue: unknown,
  sourcePath: string
) {
  const next = normalizeString(sourceValue);
  if (!next || !isEmptyValue(programValueOf(program, field))) return;
  patches.push({
    entityType: "program",
    entityId: program.id,
    code: program.code,
    name: localizedName(program.name),
    field,
    sourcePath,
    previous: programValueOf(program, field),
    next
  });
}

function basePatch(university: UniversityEntity, field: UniversitySyncField, sourcePath: string, next: PatchValue): FieldPatch {
  return {
    entityType: "university",
    entityId: university.id,
    code: university.code,
    name: localizedName(university.name),
    field,
    sourcePath,
    previous: valueOf(university, field),
    next
  };
}

function applyUniversityPatch(university: UniversityEntity, patch: FieldPatch) {
  switch (patch.field) {
    case "nameEnOfficial":
      university.nameEnOfficial = String(patch.next);
      break;
    case "officialWebsite":
      university.officialWebsite = String(patch.next);
      break;
    case "studyPortalUrl":
      university.studyPortalUrl = String(patch.next);
      break;
    case "internationalPageUrl":
      university.internationalPageUrl = String(patch.next);
      break;
    case "applicationPortalUrl":
      university.applicationPortalUrl = String(patch.next);
      break;
    case "officialAddress":
      university.officialAddress = String(patch.next);
      break;
    case "applicationPeriods":
      university.applicationPeriods = patch.next as string[];
      break;
    case "applicationFees":
      university.applicationFees = patch.next as string[];
      break;
    case "applicationDocuments":
      university.applicationDocuments = patch.next as LocalizedStringArray;
      break;
    case "chinaStudentRequirements":
      university.chinaStudentRequirements = patch.next as LocalizedStringArray;
      break;
    case "officialVerifiedAt":
      university.officialVerifiedAt = String(patch.next);
      break;
    default:
      break;
  }
}

function applyProgramPatch(program: ProgramEntity, patch: FieldPatch) {
  switch (patch.field) {
    case "nameEnOfficial":
      program.nameEnOfficial = String(patch.next);
      break;
    case "tuitionDisplay":
      program.tuitionDisplay = String(patch.next);
      break;
    default:
      break;
  }
}

function dedupePatches(patches: FieldPatch[]) {
  const seen = new Set<string>();
  return patches.filter((patch) => {
    const key = `${patch.entityType}:${patch.entityId}:${patch.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupPatches(patches: FieldPatch[]) {
  const grouped = new Map<number, FieldPatch[]>();
  for (const patch of patches) {
    const current = grouped.get(patch.entityId) || [];
    current.push(patch);
    grouped.set(patch.entityId, current);
  }
  return grouped;
}

function valueOf(university: UniversityEntity, field: UniversitySyncField): unknown {
  return (university as unknown as Record<UniversitySyncField, unknown>)[field];
}

function programValueOf(program: ProgramEntity, field: ProgramSyncField): unknown {
  return (program as unknown as Record<ProgramSyncField, unknown>)[field];
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => !isEmptyValue(value));
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }
  const text = normalizeString(value);
  return text ? [text] : [];
}

function normalizeLocalizedArray(value: unknown): LocalizedStringArray {
  if (Array.isArray(value) || typeof value === "string") {
    const items = normalizeStringList(value);
    return { en: items, ms: items, "zh-CN": items, "zh-TW": items };
  }

  const record = asRecord(value);
  const byLocale = Object.fromEntries(LOCALES.map((locale) => [locale, normalizeStringList(record[locale])])) as LocalizedStringArray;
  const fallback = LOCALES.map((locale) => byLocale[locale]).find((items) => items.length) || [];
  return {
    en: byLocale.en.length ? byLocale.en : fallback,
    ms: byLocale.ms.length ? byLocale.ms : fallback,
    "zh-CN": byLocale["zh-CN"].length ? byLocale["zh-CN"] : fallback,
    "zh-TW": byLocale["zh-TW"].length ? byLocale["zh-TW"] : fallback
  };
}

function hasLocalizedItems(value: LocalizedStringArray): boolean {
  return LOCALES.some((locale) => value[locale].length > 0);
}

function asLocalizedText(value: unknown): Partial<LocalizedText> {
  return asRecord(value) as Partial<LocalizedText>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (LOCALES.some((locale) => Array.isArray(record[locale]))) {
      return !LOCALES.some((locale) => normalizeStringList(record[locale]).length > 0);
    }
  }
  return false;
}

function localizedName(value: unknown): string {
  const name = asLocalizedText(value);
  return firstString(name["zh-CN"], name.en, name.ms, name["zh-TW"]);
}

function normalizeLinks(value: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      const url = normalizeString(record.url);
      const label = firstString(record.label, record.title, record.sourceType, url);
      return { label, url };
    })
    .filter((link) => Boolean(link.url));
}

function pickUrl(links: Array<{ label: string; url: string }>, keywords: string[]): string {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const matched = links.find((link) => {
    const haystack = `${link.label} ${link.url}`.toLowerCase();
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });
  return matched?.url || "";
}

function normalizeDateString(value: unknown): string {
  const text = normalizeString(value);
  if (!text) return "";
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function countBy<T>(items: T[], keyOf: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyOf(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function resolveReportPath(output: string | undefined, mode: SyncMode) {
  if (output) return path.resolve(output);
  const root = findRepoRoot(process.cwd());
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(root, "data", "admin-field-sync", `admin-official-field-sync-${mode}-${timestamp}.json`);
}

function findRepoRoot(startDir: string): string {
  let current = startDir;
  for (;;) {
    const packagePath = path.join(current, "package.json");
    if (existsSync(packagePath)) {
      const content = readFileSync(packagePath, "utf8");
      if (content.includes("\"workspaces\"")) return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
}

async function writeJson(filePath: string, report: SyncReport) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printSummary(report: SyncReport) {
  console.log(JSON.stringify(report.summary, null, 2));
}

function isMainModule() {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
