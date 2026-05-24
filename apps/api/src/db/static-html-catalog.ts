import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  localizeUniversityImageUrl,
  localizeUniversityLogoUrl,
  type DegreeLevel,
  type FeeAuditStatus,
  type InstitutionOwnership,
  type InstitutionType,
  type LanguageRequirement,
  type LocalizedStringArray,
  type LocalizedText,
  type OfficialSourceLink,
  type OfficialSourceStatus,
  type ProgramCategoryCode,
  type ProgramRequirement,
  type PublicDisplayStatus,
  type TuitionCurrency
} from "@studymy/shared";

export const DEFAULT_STATIC_HTML_PATH = "D:/mydev/StudyMY_UM_v58_na_display_tidy.html";

export type StaticCatalogLayerName = "base" | "supplement" | "merged";
export const DEFAULT_STATIC_CATALOG_LAYER: StaticCatalogLayerName = "merged";

export interface StaticCatalogExpectedStats {
  universityCount: number;
  programCount: number;
  readyProgramCount: number;
  officialTuitionMYRCount: number;
  officialFeeSourceUrlCount: number;
  officialIntakeCount: number;
}

export const STATIC_HTML_EXPECTED_LAYER_STATS = {
  base: {
    universityCount: 18,
    programCount: 431,
    readyProgramCount: 239,
    officialTuitionMYRCount: 240,
    officialFeeSourceUrlCount: 248,
    officialIntakeCount: 245
  },
  supplement: {
    universityCount: 104,
    programCount: 256,
    readyProgramCount: 0,
    officialTuitionMYRCount: 0,
    officialFeeSourceUrlCount: 0,
    officialIntakeCount: 0
  },
  merged: {
    universityCount: 119,
    programCount: 687,
    readyProgramCount: 239,
    officialTuitionMYRCount: 240,
    officialFeeSourceUrlCount: 248,
    officialIntakeCount: 245
  }
} as const;

export const STATIC_HTML_EXPECTED_STATS = STATIC_HTML_EXPECTED_LAYER_STATS[DEFAULT_STATIC_CATALOG_LAYER];

export const STATIC_HTML_EXPECTED_UM_BASE_STATS: StaticCatalogExpectedStats = {
  universityCount: 1,
  programCount: 248,
  readyProgramCount: 239,
  officialTuitionMYRCount: 240,
  officialFeeSourceUrlCount: 248,
  officialIntakeCount: 245
};

type RawRecord = Record<string, unknown>;

interface RawUniversity extends RawRecord {
  programs?: RawRecord[];
}

export interface StaticUniversitySeed {
  sourceId: string;
  slug: string;
  code: string;
  name: LocalizedText;
  shortName: string;
  logoUrl: string;
  imageUrl: string;
  color: string;
  qsRank: number;
  qsAsiaRank: number | null;
  location: LocalizedText;
  region: LocalizedText;
  ownership: InstitutionOwnership;
  institutionType: InstitutionType;
  foundedYear: number;
  students: number;
  intlStudents: number;
  csrCertified: boolean;
  description: LocalizedText;
  website: string;
  admissionEmail: string;
  nameEnOfficial: string;
  officialWebsite: string;
  studyPortalUrl: string;
  internationalPageUrl: string;
  applicationPortalUrl: string;
  officialAddress: string;
  applicationPeriods: string[] | null;
  applicationFees: string[] | null;
  applicationDocuments: LocalizedStringArray | null;
  chinaStudentRequirements: LocalizedStringArray | null;
  officialProfile: Record<string, unknown> | null;
  officialSources: OfficialSourceLink[] | null;
  officialVerifiedAt: string | null;
  officialSourceStatus: OfficialSourceStatus;
  officialAuditSummary: string | null;
  publicDisplayStatus: PublicDisplayStatus;
  livingCostOfficialNote: string | null;
  tuitionMinCny: number;
  tuitionMaxCny: number;
  livingCostCny: number;
  minIelts: number;
  acceptNoLanguage: boolean;
  facilities: LocalizedStringArray;
  highlights: LocalizedStringArray;
  programCount: number;
  isPublished: boolean;
}

export interface StaticProgramSeed {
  sourceId: string;
  universityCode: string;
  slug: string;
  code: string;
  name: LocalizedText;
  nameEnOfficial: string;
  level: DegreeLevel;
  category: ProgramCategoryCode;
  faculty: LocalizedText;
  facultyZh: string;
  studyMode: string;
  campus: string;
  durationYears: number;
  durationOfficial: string;
  annualTuitionCny: number;
  tuitionAmount: number | null;
  tuitionCurrency: TuitionCurrency;
  tuitionDisplay: string;
  officialTuitionMYR: number | null;
  officialTuitionNote: string | null;
  officialFeeSourceUrl: string;
  secondaryOfficialFeeSourceUrl: string;
  officialFeeAuditStatus: FeeAuditStatus;
  officialFeeAuditedAt: string | null;
  intakeMonths: string[];
  officialIntake: string;
  officialIntakeNote: string | null;
  languageRequirement: LanguageRequirement;
  officialLanguageRequirement: string | null;
  requirement: ProgramRequirement;
  officialAcademicRequirement: string | null;
  chinaStudentRequirement: string | null;
  specialRequirementsNote: string | null;
  applicationDocs: LocalizedStringArray;
  curriculum: LocalizedStringArray;
  careers: LocalizedStringArray;
  specializations: LocalizedStringArray;
  description: LocalizedText;
  officialAccreditationNote: string | null;
  officialSourceUrl: string;
  officialEntryRequirementSourceUrl: string;
  officialAccreditationSourceUrl: string;
  sourceUrls: OfficialSourceLink[] | null;
  officialVerifiedAt: string | null;
  officialSourceStatus: OfficialSourceStatus;
  publicDisplayStatus: PublicDisplayStatus;
  publicDisplayNote: string | null;
  reviewReason: string | null;
  auditNote: string | null;
  listTuitionText: string;
  isPublished: boolean;
}

export interface StaticCatalogStats {
  sourceHtmlPath: string;
  fileBytes: number;
  universityCount: number;
  programCount: number;
  readyProgramCount: number;
  officialTuitionMYRCount: number;
  officialFeeSourceUrlCount: number;
  officialIntakeCount: number;
  publicDisplayStatusCounts: Record<string, number>;
  programsByLevel: Record<string, number>;
  readyByLevel: Record<string, number>;
  readyCategoryCount: number;
  readyCategories: string[];
}

export interface StaticCatalogScope {
  universityCode: string | null;
  universitySlug: string | null;
  matchedUniversityCodes: string[];
  matchedUniversitySlugs: string[];
}

export interface StaticCatalogLayerReport {
  layer: StaticCatalogLayerName;
  stats: StaticCatalogStats;
  expectedStats: StaticCatalogExpectedStats;
  duplicateUniversityKeys: string[];
  duplicateUniversityCount: number;
  overrideUniversityNames: string[];
  overrideUniversityCount: number;
}

export interface StaticCatalog {
  layer: StaticCatalogLayerName;
  sourceHtmlPath: string;
  universities: StaticUniversitySeed[];
  programs: StaticProgramSeed[];
  stats: StaticCatalogStats;
  expectedStats: StaticCatalogExpectedStats;
  layerReports: Record<StaticCatalogLayerName, StaticCatalogLayerReport>;
  scope?: StaticCatalogScope | null;
  warnings: string[];
}

export interface StaticCatalogValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  layer: StaticCatalogLayerName;
  expectedStats: StaticCatalogExpectedStats;
  stats: StaticCatalogStats;
  layerReports: Record<StaticCatalogLayerName, StaticCatalogLayerReport>;
  scope: StaticCatalogScope | null;
}

export interface ExtractStaticCatalogOptions {
  layer?: StaticCatalogLayerName;
  universityCode?: string | null;
  universitySlug?: string | null;
}

function localizedText(en: string, zhCN = en, ms = en, zhTW = zhCN): LocalizedText {
  const fallback = en || zhCN || ms || zhTW || "";
  return {
    en: en || fallback,
    ms: ms || en || fallback,
    "zh-CN": zhCN || en || fallback,
    "zh-TW": zhTW || zhCN || en || fallback
  };
}

function localizedArray(values: string[]): LocalizedStringArray {
  return {
    en: values,
    ms: values,
    "zh-CN": values,
    "zh-TW": values
  };
}

function readString(record: RawRecord, key: string): string {
  const value = record[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function readNullableString(record: RawRecord, key: string): string | null {
  const value = readString(record, key);
  return value || null;
}

function readNumber(record: RawRecord, key: string, fallback = 0): number {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readBoolean(record: RawRecord, key: string, fallback = false): boolean {
  const value = record[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(true|yes|1)$/i.test(value);
  return fallback;
}

function readRecord(record: RawRecord, key: string): RawRecord {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function readArray(record: RawRecord, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function toDisplayString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toDisplayString).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const record = value as RawRecord;
    const label = readString(record, "label") || readString(record, "title") || readString(record, "name");
    const detail = readString(record, "value") || readString(record, "summary") || readString(record, "url");
    if (label && detail) return `${label}: ${detail}`;
    if (label) return label;
    if (detail) return detail;
    return JSON.stringify(record);
  }
  return "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(toDisplayString).filter(Boolean);
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function clampWithHash(value: string, maxLength: number, seed: string): string {
  if (value.length <= maxLength) return value;
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 8);
  const prefixLength = Math.max(1, maxLength - hash.length - 1);
  return `${value.slice(0, prefixLength).replace(/-+$/g, "")}-${hash}`;
}

function sanitizeCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 50);
}

function uniqueBySuffix(baseValue: string, used: Set<string>, fallbackSeed: string, maxLength: number): string {
  const fallback = sanitizeCode(fallbackSeed) || createHash("sha1").update(fallbackSeed).digest("hex").slice(0, 8).toUpperCase();
  let candidate = (baseValue || fallback).slice(0, maxLength);
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  for (let index = 2; index < 999; index += 1) {
    const suffix = String(index);
    candidate = `${(baseValue || fallback).slice(0, Math.max(1, maxLength - suffix.length - 1))}-${suffix}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }

  const hash = createHash("sha1").update(fallbackSeed).digest("hex").slice(0, 8).toUpperCase();
  candidate = `${(baseValue || fallback).slice(0, Math.max(1, maxLength - hash.length - 1))}-${hash}`;
  used.add(candidate);
  return candidate;
}

function uniqueSlug(baseValue: string, used: Set<string>, seed: string): string {
  let candidate = clampWithHash(slugify(baseValue) || `item-${seed}`, 120, seed);
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 8);
  candidate = clampWithHash(`${candidate}-${hash}`, 120, seed);
  let counter = 2;
  while (used.has(candidate)) {
    candidate = clampWithHash(`${slugify(baseValue) || "item"}-${hash}-${counter}`, 120, `${seed}-${counter}`);
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function mapOwnership(value: string): InstitutionOwnership {
  const normalized = value.toLowerCase();
  return normalized.includes("public") || value.includes("公立") ? "public" : "private";
}

function mapInstitutionType(value: string): InstitutionType {
  const normalized = value.toLowerCase();
  if (normalized.includes("research") || value.includes("研究")) return "research";
  if (normalized.includes("applied") || normalized.includes("college") || normalized.includes("polytechnic")) return "applied";
  return "comprehensive";
}

function mapLevel(value: string): DegreeLevel {
  const normalized = value.toLowerCase();
  if (normalized.includes("phd") || normalized.includes("doctor") || value.includes("博士")) return "phd";
  if (normalized.includes("master") || value.includes("硕士") || value.includes("碩士")) return "master";
  return "bachelor";
}

function inferCategory(value: string): ProgramCategoryCode {
  const normalized = value.toLowerCase();
  if (value.includes("商") || /business|account|finance|economic|management/.test(normalized)) return "business";
  if (value.includes("工") || /engineer|built environment/.test(normalized)) return "engineering";
  if (value.includes("医") || value.includes("醫") || /medicine|medical|health|pharmacy|dentistry|nursing/.test(normalized)) return "medicine";
  if (value.includes("法") || /law|legal/.test(normalized)) return "law";
  if (value.includes("艺术") || value.includes("藝術") || /art|design|media|communication|language|education|social/.test(normalized)) return "arts";
  if (/computer|data|it|information technology|software|digital/.test(normalized)) return "it";
  return "science";
}

function mapPublicDisplayStatus(value: string): PublicDisplayStatus {
  if (value === "ready") return "ready";
  if (value === "not-available-for-international") return "not-available-for-international";
  if (value === "hidden-unverified") return "hidden-unverified";
  if (value === "archived") return "archived";
  return "needs-review";
}

function mapOfficialSourceStatus(value: string): OfficialSourceStatus {
  if (value === "official-verified") return "official-verified";
  if (value === "official-page-verified-international-not-available" || value.includes("international-not-available")) {
    return "official-page-verified-international-not-available";
  }
  if (value.includes("duplicate") || value.includes("superseded")) return "hidden-duplicate-superseded";
  if (value.includes("conflict")) return "source-conflict";
  if (value.includes("missing")) return "missing-source";
  if (value.includes("official")) return "official-verified";
  return "missing-source";
}

function mapFeeAuditStatus(value: string, hasOfficialFeeSource: boolean, hasOfficialTuition: boolean): FeeAuditStatus {
  const normalized = value.toLowerCase();
  if (normalized.includes("conflict")) return "source-conflict";
  if (normalized.includes("not available") || normalized.includes("not offered") || normalized.includes("not list")) return "not-published";
  if (normalized.includes("matched") || normalized.includes("official") || normalized.includes("confirmed")) return "matched-official";
  if (hasOfficialFeeSource && hasOfficialTuition) return "matched-official";
  if (!hasOfficialFeeSource && !hasOfficialTuition) return "not-published";
  return "pending-review";
}

function mapTuitionCurrency(value: string, officialTuitionMYR: number | null): TuitionCurrency {
  const normalized = value.toUpperCase();
  if (normalized === "MYR" || officialTuitionMYR != null) return "MYR";
  if (normalized === "CNY") return "CNY";
  if (normalized === "USD") return "USD";
  return officialTuitionMYR != null ? "MYR" : "UNKNOWN";
}

function parseDurationYears(record: RawRecord): number {
  const direct = readNumber(record, "duration", Number.NaN);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const source = readString(record, "officialDuration") || readString(record, "durationOfficial");
  const match = source.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return 1;
  const value = Number(match[1]);
  if (/semester/i.test(source)) return Math.max(0.5, value / 2);
  return value || 1;
}

function getOfficialProfileDate(officialProfile: RawRecord): string | null {
  const direct = readNullableString(officialProfile, "auditedAt") || readNullableString(officialProfile, "verifiedAt");
  if (direct) return direct;
  const postgraduateAudit = readRecord(officialProfile, "postgraduateAudit");
  return readNullableString(postgraduateAudit, "auditedAt");
}

function extractLiteral(html: string, name: string): string {
  const needle = `const ${name} =`;
  const start = html.indexOf(needle);
  if (start < 0) {
    throw new Error(`Missing literal: ${name}`);
  }

  let cursor = html.indexOf("=", start) + 1;
  while (/\s/.test(html[cursor])) cursor += 1;

  const open = html[cursor];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) {
    throw new Error(`Unexpected literal opener for ${name}: ${open}`);
  }

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = cursor; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(cursor, index + 1);
      }
    }
  }

  throw new Error(`Unclosed literal: ${name}`);
}

function evaluateLiteral<T>(html: string, name: string): T {
  return Function(`return (${extractLiteral(html, name)});`)() as T;
}

function mergeUniquePrograms(programLists: RawRecord[][] = []): RawRecord[] {
  const map = new Map<string, RawRecord>();

  for (const program of programLists.flat()) {
    if (!program) continue;
    const key = [
      readString(program, "name"),
      readString(program, "level"),
      readString(program, "category"),
      readString(program, "nameEn")
    ].filter(Boolean).join("||");

    if (!map.has(key)) {
      map.set(key, JSON.parse(JSON.stringify(program)) as RawRecord);
      continue;
    }

    const existing = map.get(key)!;
    const merged: RawRecord = { ...existing, ...program };
    for (const field of ["intake", "applicationDocs", "curriculum", "careers"]) {
      merged[field] = Array.from(new Set([...toStringArray(existing[field]), ...toStringArray(program[field])]));
    }
    if (existing.specializations || program.specializations) {
      merged.specializations = Array.from(new Set([...toStringArray(existing.specializations), ...toStringArray(program.specializations)]));
    }
    merged.language = { ...readRecord(existing, "language"), ...readRecord(program, "language") };
    merged.requirements = { ...readRecord(existing, "requirements"), ...readRecord(program, "requirements") };
    map.set(key, merged);
  }

  return Array.from(map.values());
}

function cloneRawUniversity(university: RawUniversity): RawUniversity {
  return JSON.parse(JSON.stringify(university)) as RawUniversity;
}

function normalizeUniversityName(name = "") {
  return String(name || "")
    .replace(/\u9a6c\u6765\u897f\u4e9a\u7406\u5de5\u5927\u5b66/g, "\u9a6c\u6765\u897f\u4e9a\u5de5\u827a\u5927\u5b66")
    .trim()
    .toLowerCase();
}

function normalizeUniversityWebsite(url = "") {
  return String(url || "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .trim()
    .toLowerCase();
}

function getUniversityDedupeKey(university: RawUniversity): string {
  return [
    readString(university, "shortName").toLowerCase(),
    normalizeUniversityWebsite(readString(university, "website")),
    normalizeUniversityName(readString(university, "name")),
    readString(university, "nameEn").toLowerCase()
  ].join("||");
}

function dedupeUniversities(list: RawUniversity[]): RawUniversity[] {
  const map = new Map<string, RawUniversity>();

  for (const university of list) {
    if (!university) continue;

    const key = getUniversityDedupeKey(university);

    if (!map.has(key)) {
      map.set(key, cloneRawUniversity(university));
      continue;
    }

    const existing = map.get(key)!;
    const merged: RawUniversity = { ...existing, ...university };
    merged.id = existing.id;
    merged.name = existing.name || university.name;
    merged.nameEn = existing.nameEn || university.nameEn;
    merged.shortName = existing.shortName || university.shortName;
    merged.website =
      readString(existing, "website") && readString(existing, "website") !== "#"
        ? existing.website
        : university.website || existing.website;
    merged.programs = mergeUniquePrograms([existing.programs || [], university.programs || []]);
    merged.facilities = Array.from(new Set([...toStringArray(existing.facilities), ...toStringArray(university.facilities)]));
    merged.highlights = Array.from(new Set([...toStringArray(existing.highlights), ...toStringArray(university.highlights)]));

    const existingTuitionRange = readRecord(existing, "tuitionRange");
    const universityTuitionRange = readRecord(university, "tuitionRange");
    const minTuition = Math.min(
      readNumber(existingTuitionRange, "min", Number.POSITIVE_INFINITY),
      readNumber(universityTuitionRange, "min", Number.POSITIVE_INFINITY)
    );
    merged.tuitionRange = {
      min: Number.isFinite(minTuition)
        ? minTuition
        : readNumber(existingTuitionRange, "min", readNumber(universityTuitionRange, "min", 0)),
      max: Math.max(readNumber(existingTuitionRange, "max", 0), readNumber(universityTuitionRange, "max", 0))
    };

    const minIelts = Math.min(readNumber(existing, "minIELTS", Number.POSITIVE_INFINITY), readNumber(university, "minIELTS", Number.POSITIVE_INFINITY));
    merged.minIELTS = Number.isFinite(minIelts) ? minIelts : readNumber(existing, "minIELTS", readNumber(university, "minIELTS", 0));
    merged.acceptNoLanguage = readBoolean(existing, "acceptNoLanguage") || readBoolean(university, "acceptNoLanguage");
    map.set(key, merged);
  }

  return Array.from(map.values());
}

interface RawCatalogLayerCollection {
  layers: Record<StaticCatalogLayerName, RawUniversity[]>;
  duplicateUniversityKeys: string[];
  patchNamesByLayer: Record<StaticCatalogLayerName, string[]>;
}

function applyOfficialPatches(universities: RawUniversity[], patches: Record<string, RawRecord>): string[] {
  const patchedNames: string[] = [];
  for (const university of universities) {
    const patch = patches[readString(university, "name")];
    if (!patch) continue;
    patchedNames.push(readString(university, "name"));
    for (const key of Object.keys(patch)) {
      if (key === "facilities") {
        university.facilities = Array.from(new Set([...toStringArray(university.facilities), ...toStringArray(patch.facilities)]));
      } else if (key === "highlights") {
        university.highlights = Array.from(new Set([...toStringArray(university.highlights), ...toStringArray(patch.highlights)]));
      } else {
        university[key] = patch[key];
      }
    }
  }

  return patchedNames;
}

function buildRawCatalogLayers(html: string): RawCatalogLayerCollection {
  const base = evaluateLiteral<RawUniversity[]>(html, "universitiesBase");
  const supplement = evaluateLiteral<RawUniversity[]>(html, "universitiesSupplement");
  const patches = evaluateLiteral<Record<string, RawRecord>>(html, "officialUniversityPatches");
  const baseKeys = new Set(base.map(getUniversityDedupeKey));
  const duplicateUniversityKeys = Array.from(new Set(supplement.map(getUniversityDedupeKey).filter((key) => baseKeys.has(key)))).sort();

  const layers: Record<StaticCatalogLayerName, RawUniversity[]> = {
    base: dedupeUniversities(base),
    supplement: dedupeUniversities(supplement),
    merged: dedupeUniversities([...base, ...supplement])
  };
  const patchNamesByLayer: Record<StaticCatalogLayerName, string[]> = {
    base: applyOfficialPatches(layers.base, patches),
    supplement: applyOfficialPatches(layers.supplement, patches),
    merged: applyOfficialPatches(layers.merged, patches)
  };

  return {
    layers,
    duplicateUniversityKeys,
    patchNamesByLayer
  };
}

function buildOfficialSourceLink(
  title: string,
  url: string,
  sourceType: OfficialSourceLink["sourceType"],
  status: OfficialSourceStatus,
  verifiedAt: string | null,
  note: string | null = null
): OfficialSourceLink | null {
  if (!url) return null;
  return {
    title,
    url,
    sourceType,
    status,
    verifiedAt,
    note
  };
}

function normalizeSourceUrls(program: RawRecord, status: OfficialSourceStatus, verifiedAt: string | null): OfficialSourceLink[] {
  const links: OfficialSourceLink[] = [];
  const addLink = (link: OfficialSourceLink | null) => {
    if (!link || links.some((item) => item.url === link.url)) return;
    links.push(link);
  };

  addLink(buildOfficialSourceLink("Official program page", readString(program, "officialSourceUrl") || readString(program, "officialUrl"), "profile", status, verifiedAt));
  addLink(buildOfficialSourceLink("Official fee source", readString(program, "officialFeeSourceUrl"), "fee", status, readNullableString(program, "officialFeeAuditedAt") || verifiedAt));
  addLink(buildOfficialSourceLink("Official entry requirement source", readString(program, "officialEntryRequirementSourceUrl"), "entry-requirement", status, verifiedAt));
  addLink(buildOfficialSourceLink("Official accreditation source", readString(program, "officialAccreditationSourceUrl"), "accreditation", status, verifiedAt));

  for (const value of readArray(program, "sourceUrls")) {
    if (typeof value === "string") {
      addLink(buildOfficialSourceLink("Official source", value.trim(), "other", status, verifiedAt));
    } else if (value && typeof value === "object") {
      const source = value as RawRecord;
      addLink(
        buildOfficialSourceLink(
          readString(source, "title") || "Official source",
          readString(source, "url"),
          (readString(source, "sourceType") || "other") as OfficialSourceLink["sourceType"],
          mapOfficialSourceStatus(readString(source, "status")) || status,
          readNullableString(source, "verifiedAt") || verifiedAt,
          readNullableString(source, "note")
        )
      );
    }
  }

  return links;
}

function mapUniversityRecord(raw: RawUniversity, usedCodes: Set<string>, usedSlugs: Set<string>): StaticUniversitySeed {
  const sourceId = String(raw.id ?? (readString(raw, "shortName") || readString(raw, "name")));
  const nameZh = readString(raw, "name");
  const nameEnOfficial = readString(raw, "nameEn") || nameZh;
  const shortName = readString(raw, "shortName") || sanitizeCode(nameEnOfficial).slice(0, 20) || `UNI${sourceId}`;
  const code = uniqueBySuffix(sanitizeCode(shortName), usedCodes, `${shortName}-${sourceId}`, 50);
  const slug = uniqueSlug(nameEnOfficial || nameZh || code, usedSlugs, sourceId);
  const tuitionRange = readRecord(raw, "tuitionRange");
  const officialProfile = readRecord(raw, "officialProfile");
  const officialVerifiedAt = getOfficialProfileDate(officialProfile);
  const officialSourceStatus = readString(raw, "officialWebsite") || readString(raw, "website") ? "official-verified" : "needs-review";
  const applicationDocuments = toStringArray(officialProfile.applicationDocuments ?? raw.applicationDocuments);
  const chinaRequirement = readRecord(officialProfile, "chinaRequirement");
  const chinaRequirements = [
    readString(chinaRequirement, "summary"),
    readString(chinaRequirement, "effective")
  ].filter(Boolean);
  const officialSources = toStringArray(officialProfile.officialLinks).map((value) => {
    const urlMatch = value.match(/https?:\/\/\S+/);
    return buildOfficialSourceLink(value.replace(/:\s*https?:\/\/\S+$/, ""), urlMatch?.[0] || "", "other", officialSourceStatus, officialVerifiedAt);
  }).filter((item): item is OfficialSourceLink => Boolean(item));
  const website = readString(raw, "website") || readString(raw, "officialWebsite");
  const officialWebsite = readString(raw, "officialWebsite") || website;
  const officialWebsiteLink = buildOfficialSourceLink("Official website", officialWebsite, "official-website", officialSourceStatus, officialVerifiedAt);
  if (officialWebsiteLink && !officialSources.some((item) => item.url === officialWebsiteLink.url)) {
    officialSources.push(officialWebsiteLink);
  }

  return {
    sourceId,
    slug,
    code,
    name: localizedText(nameEnOfficial, nameZh || nameEnOfficial),
    shortName,
    logoUrl: localizeUniversityLogoUrl(readString(raw, "logo") || readString(raw, "logoUrl")),
    imageUrl: localizeUniversityImageUrl(readString(raw, "image") || readString(raw, "imageUrl")),
    color: readString(raw, "color") || "#1B7A72",
    qsRank: readNumber(raw, "qsRank", 0),
    qsAsiaRank: hasValue(raw.qsAsiaRank) ? readNumber(raw, "qsAsiaRank", 0) : null,
    location: localizedText(readString(raw, "location"), readString(raw, "location")),
    region: localizedText(readString(raw, "region"), readString(raw, "region")),
    ownership: mapOwnership(readString(raw, "type")),
    institutionType: mapInstitutionType(readString(raw, "uniType")),
    foundedYear: readNumber(raw, "founded", 0),
    students: readNumber(raw, "students", 0),
    intlStudents: readNumber(raw, "intlStudents", 0),
    csrCertified: readBoolean(raw, "csrCertified", false),
    description: localizedText(readString(raw, "description"), readString(raw, "description")),
    website,
    admissionEmail: readString(raw, "admissionEmail"),
    nameEnOfficial,
    officialWebsite,
    studyPortalUrl: readString(raw, "studyPortal"),
    internationalPageUrl: readString(raw, "internationalPage"),
    applicationPortalUrl: readString(raw, "applicationPortal"),
    officialAddress: readString(officialProfile, "address") || readString(officialProfile, "mrdAddress"),
    applicationPeriods: toStringArray(officialProfile.applicationPeriods).length ? toStringArray(officialProfile.applicationPeriods) : null,
    applicationFees: toStringArray(officialProfile.applicationFees).length ? toStringArray(officialProfile.applicationFees) : null,
    applicationDocuments: applicationDocuments.length ? localizedArray(applicationDocuments) : null,
    chinaStudentRequirements: chinaRequirements.length ? localizedArray(chinaRequirements) : null,
    officialProfile: Object.keys(officialProfile).length ? officialProfile : null,
    officialSources: officialSources.length ? officialSources : null,
    officialVerifiedAt,
    officialSourceStatus,
    officialAuditSummary: readNullableString(raw, "officialAuditSummary"),
    publicDisplayStatus: "ready",
    livingCostOfficialNote: readNullableString(raw, "livingCostOfficialNote"),
    tuitionMinCny: readNumber(tuitionRange, "min", 0),
    tuitionMaxCny: readNumber(tuitionRange, "max", 0),
    livingCostCny: readNumber(raw, "livingCost", 0),
    minIelts: readNumber(raw, "minIELTS", 0),
    acceptNoLanguage: readBoolean(raw, "acceptNoLanguage", false),
    facilities: localizedArray(toStringArray(raw.facilities)),
    highlights: localizedArray(toStringArray(raw.highlights)),
    programCount: Array.isArray(raw.programs) ? raw.programs.length : 0,
    isPublished: true
  };
}

function mapProgramRecord(raw: RawRecord, university: StaticUniversitySeed, index: number, usedCodes: Set<string>, usedSlugs: Set<string>): StaticProgramSeed {
  const rawSourceId = String(raw.id ?? `${university.sourceId}-${index + 1}`);
  const sourceId = `${university.sourceId}:${rawSourceId}`;
  const nameZh = readString(raw, "name");
  const nameEnOfficial = readString(raw, "nameEn") || nameZh;
  const code = uniqueBySuffix(sanitizeCode(`${university.code}P${rawSourceId}`), usedCodes, sourceId, 50);
  const slug = uniqueSlug(`${university.slug}-${nameEnOfficial || nameZh}-${rawSourceId}`, usedSlugs, sourceId);
  const level = mapLevel(readString(raw, "level"));
  const rawCategory = readString(raw, "category");
  const category = rawCategory || inferCategory(`${nameEnOfficial} ${nameZh} ${readString(raw, "faculty")}`);
  const publicDisplayStatus = mapPublicDisplayStatus(readString(raw, "publicDisplayStatus"));
  const officialSourceStatus = mapOfficialSourceStatus(readString(raw, "officialSourceStatus") || readString(raw, "sourceStatus"));
  const officialVerifiedAt = readNullableString(raw, "officialVerifiedAt") || readNullableString(raw, "verifiedAt");
  const officialFeeSourceUrl = readString(raw, "officialFeeSourceUrl");
  const officialTuitionMYR =
    hasValue(raw.officialTuitionMYR) || hasValue(raw.tuitionOfficialRM)
      ? readNumber(raw, "officialTuitionMYR", readNumber(raw, "tuitionOfficialRM", 0))
      : null;
  const tuitionCurrency = mapTuitionCurrency(readString(raw, "tuitionCurrency"), officialTuitionMYR);
  const tuitionAmount = officialTuitionMYR ?? (hasValue(raw.tuition) ? readNumber(raw, "tuition", 0) : null);
  const tuitionDisplay =
    readString(raw, "tuitionDisplay") ||
    readString(raw, "listTuitionText") ||
    readString(raw, "officialTuitionText") ||
    (tuitionAmount != null ? `${tuitionCurrency === "MYR" ? "RM" : tuitionCurrency} ${tuitionAmount.toLocaleString("en-US")}` : "");
  const language = readRecord(raw, "language");
  const requirements = readRecord(raw, "requirements");
  const requirementNote = [
    readString(requirements, "note"),
    readString(requirements, "specialNote")
  ].filter(Boolean).join(" ");
  const officialFeeAuditStatus = mapFeeAuditStatus(readString(raw, "officialFeeAuditStatus"), Boolean(officialFeeSourceUrl), officialTuitionMYR != null);
  const sourceUrls = normalizeSourceUrls(raw, officialSourceStatus, officialVerifiedAt);
  const officialIntake = toDisplayString(raw.officialIntake ?? raw.intakeOfficial);
  const intakeMonths = toStringArray(raw.intake);

  return {
    sourceId,
    universityCode: university.code,
    slug,
    code,
    name: localizedText(nameEnOfficial, nameZh || nameEnOfficial),
    nameEnOfficial,
    level,
    category,
    faculty: localizedText(readString(raw, "faculty"), readString(raw, "facultyZh") || readString(raw, "faculty")),
    facultyZh: readString(raw, "facultyZh"),
    studyMode: readString(raw, "studyMode") || readString(raw, "mode") || readString(raw, "programmeMode"),
    campus: readString(raw, "campus"),
    durationYears: parseDurationYears(raw),
    durationOfficial: readString(raw, "officialDuration") || readString(raw, "durationOfficial"),
    annualTuitionCny: readNumber(raw, "tuition", 0),
    tuitionAmount,
    tuitionCurrency,
    tuitionDisplay,
    officialTuitionMYR,
    officialTuitionNote: readNullableString(raw, "officialTuitionNote") || readNullableString(raw, "tuitionOfficialNote"),
    officialFeeSourceUrl,
    secondaryOfficialFeeSourceUrl: readString(raw, "secondaryOfficialFeeSourceUrl"),
    officialFeeAuditStatus,
    officialFeeAuditedAt: readNullableString(raw, "officialFeeAuditedAt"),
    intakeMonths,
    officialIntake,
    officialIntakeNote: readNullableString(raw, "officialIntakeNote") || readNullableString(raw, "intakeNote"),
    languageRequirement: {
      ielts: readNumber(language, "ielts", 0),
      toefl: hasValue(language.toefl) ? readNumber(language, "toefl", 0) : null,
      pte: hasValue(language.pte) ? readNumber(language, "pte", 0) : null,
      muet: hasValue(language.muet) ? readNumber(language, "muet", 0) : null
    },
    officialLanguageRequirement: readNullableString(raw, "officialLanguageRequirement") || readNullableString(raw, "englishOfficial"),
    requirement: {
      gpa: readNumber(requirements, "gpa", 0),
      gaokaoRequired: readBoolean(requirements, "gaokao", false) || readBoolean(requirements, "gaokaoRequired", false),
      huikaoRequired: readBoolean(requirements, "huikao", false) || readBoolean(requirements, "huikaoRequired", false),
      note: localizedText(requirementNote, requirementNote)
    },
    officialAcademicRequirement: readNullableString(raw, "officialAcademicRequirement"),
    chinaStudentRequirement: readNullableString(raw, "chinaStudentRequirement") || readNullableString(raw, "chinaStudentEligibility"),
    specialRequirementsNote: readNullableString(requirements, "specialNote") || readNullableString(raw, "specialRequirementsNote"),
    applicationDocs: localizedArray(toStringArray(raw.applicationDocs)),
    curriculum: localizedArray(toStringArray(raw.curriculum)),
    careers: localizedArray(toStringArray(raw.careers)),
    specializations: localizedArray(toStringArray(raw.specializations)),
    description: localizedText(readString(raw, "description") || nameEnOfficial, readString(raw, "description") || nameZh || nameEnOfficial),
    officialAccreditationNote: readNullableString(raw, "officialAccreditationNote"),
    officialSourceUrl: readString(raw, "officialSourceUrl") || readString(raw, "officialUrl"),
    officialEntryRequirementSourceUrl: readString(raw, "officialEntryRequirementSourceUrl"),
    officialAccreditationSourceUrl: readString(raw, "officialAccreditationSourceUrl"),
    sourceUrls: sourceUrls.length ? sourceUrls : null,
    officialVerifiedAt,
    officialSourceStatus,
    publicDisplayStatus,
    publicDisplayNote: readNullableString(raw, "publicDisplayNote"),
    reviewReason: readNullableString(raw, "reviewReason"),
    auditNote: readNullableString(raw, "auditNote") || readNullableString(raw, "officialDataPolicy"),
    listTuitionText: readString(raw, "listTuitionText") || tuitionDisplay,
    isPublished: true
  };
}

function countBy<T>(list: T[], getValue: (item: T) => string): Record<string, number> {
  return list.reduce<Record<string, number>>((acc, item) => {
    const value = getValue(item) || "__missing__";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildStats(sourceHtmlPath: string, fileBytes: number, universities: StaticUniversitySeed[], programs: StaticProgramSeed[]): StaticCatalogStats {
  const readyPrograms = programs.filter((program) => program.publicDisplayStatus === "ready");
  const readyCategories = [...new Set(readyPrograms.map((program) => String(program.category)).filter(Boolean))].sort();

  return {
    sourceHtmlPath,
    fileBytes,
    universityCount: universities.length,
    programCount: programs.length,
    readyProgramCount: readyPrograms.length,
    officialTuitionMYRCount: programs.filter((program) => program.officialTuitionMYR != null).length,
    officialFeeSourceUrlCount: programs.filter((program) => hasValue(program.officialFeeSourceUrl)).length,
    officialIntakeCount: programs.filter((program) => hasValue(program.officialIntake)).length,
    publicDisplayStatusCounts: countBy(programs, (program) => program.publicDisplayStatus),
    programsByLevel: countBy(programs, (program) => program.level),
    readyByLevel: countBy(readyPrograms, (program) => program.level),
    readyCategoryCount: readyCategories.length,
    readyCategories
  };
}

const STATIC_CATALOG_LAYERS: StaticCatalogLayerName[] = ["base", "supplement", "merged"];

function expectedStatsFromStats(stats: StaticCatalogStats): StaticCatalogExpectedStats {
  return {
    universityCount: stats.universityCount,
    programCount: stats.programCount,
    readyProgramCount: stats.readyProgramCount,
    officialTuitionMYRCount: stats.officialTuitionMYRCount,
    officialFeeSourceUrlCount: stats.officialFeeSourceUrlCount,
    officialIntakeCount: stats.officialIntakeCount
  };
}

function normalizeScopeCode(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function normalizeScopeSlug(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function getExpectedStatsForScope(
  layer: StaticCatalogLayerName,
  scope: StaticCatalogScope | null,
  stats: StaticCatalogStats
): StaticCatalogExpectedStats {
  if (layer === "base" && scope?.universityCode === "UM" && !scope.universitySlug) {
    return STATIC_HTML_EXPECTED_UM_BASE_STATS;
  }
  return expectedStatsFromStats(stats);
}

function mapRawCatalog(
  sourceHtmlPath: string,
  fileBytes: number,
  rawUniversities: RawUniversity[]
): Pick<StaticCatalog, "universities" | "programs" | "stats"> {
  const usedUniversityCodes = new Set<string>();
  const usedUniversitySlugs = new Set<string>();
  const universities = rawUniversities.map((raw) => mapUniversityRecord(raw, usedUniversityCodes, usedUniversitySlugs));
  const universityBySourceId = new Map(universities.map((university) => [university.sourceId, university]));
  const usedProgramCodes = new Set<string>();
  const usedProgramSlugs = new Set<string>();
  const programs = rawUniversities.flatMap((rawUniversity) => {
    const university = universityBySourceId.get(String(rawUniversity.id ?? (readString(rawUniversity, "shortName") || readString(rawUniversity, "name"))));
    if (!university) return [];
    return (rawUniversity.programs || []).map((program, index) =>
      mapProgramRecord(program, university, index, usedProgramCodes, usedProgramSlugs)
    );
  });
  for (const university of universities) {
    university.programCount = programs.filter((program) => program.universityCode === university.code).length;
  }

  return {
    universities,
    programs,
    stats: buildStats(sourceHtmlPath, fileBytes, universities, programs)
  };
}

function applyCatalogScope(
  sourceHtmlPath: string,
  fileBytes: number,
  catalog: Pick<StaticCatalog, "universities" | "programs" | "stats">,
  options: Pick<ExtractStaticCatalogOptions, "universityCode" | "universitySlug">
): Pick<StaticCatalog, "universities" | "programs" | "stats" | "scope"> {
  const universityCode = normalizeScopeCode(options.universityCode);
  const universitySlug = normalizeScopeSlug(options.universitySlug);
  if (!universityCode && !universitySlug) {
    return { ...catalog, scope: null };
  }

  const matchedUniversities = catalog.universities.filter((university) => {
    const codeMatches = !universityCode || university.code.toUpperCase() === universityCode;
    const slugMatches = !universitySlug || university.slug === universitySlug;
    return codeMatches && slugMatches;
  });
  const matchedCodes = new Set(matchedUniversities.map((university) => university.code));
  const programs = catalog.programs.filter((program) => matchedCodes.has(program.universityCode));
  const programCounts = countBy(programs, (program) => program.universityCode);
  const universities = matchedUniversities.map((university) => ({
    ...university,
    programCount: programCounts[university.code] || 0
  }));

  return {
    universities,
    programs,
    stats: buildStats(sourceHtmlPath, fileBytes, universities, programs),
    scope: {
      universityCode,
      universitySlug,
      matchedUniversityCodes: universities.map((university) => university.code),
      matchedUniversitySlugs: universities.map((university) => university.slug)
    }
  };
}

function normalizeStaticCatalogLayer(layer: string | undefined): StaticCatalogLayerName {
  if (layer === "base" || layer === "supplement" || layer === "merged") return layer;
  throw new Error(`Unsupported static catalog layer: ${layer || ""}. Use base, supplement, or merged.`);
}

export function extractStaticCatalog(
  htmlPath = process.env.STATIC_HTML_PATH || DEFAULT_STATIC_HTML_PATH,
  options: ExtractStaticCatalogOptions = {}
): StaticCatalog {
  if (!existsSync(htmlPath)) {
    throw new Error(`Static HTML file not found: ${htmlPath}`);
  }

  const html = readFileSync(htmlPath, "utf8");
  const fileBytes = readFileSync(htmlPath).length;
  const selectedLayer = normalizeStaticCatalogLayer(options.layer || process.env.STATIC_HTML_LAYER || DEFAULT_STATIC_CATALOG_LAYER);
  const rawCollection = buildRawCatalogLayers(html);
  const mappedLayers = Object.fromEntries(
    STATIC_CATALOG_LAYERS.map((layer) => [
      layer,
      applyCatalogScope(htmlPath, fileBytes, mapRawCatalog(htmlPath, fileBytes, rawCollection.layers[layer]), options)
    ])
  ) as Record<StaticCatalogLayerName, Pick<StaticCatalog, "universities" | "programs" | "stats" | "scope">>;
  const layerReports = Object.fromEntries(
    STATIC_CATALOG_LAYERS.map((layer) => [
      layer,
      {
        layer,
        stats: mappedLayers[layer].stats,
        expectedStats: mappedLayers[layer].scope
          ? getExpectedStatsForScope(layer, mappedLayers[layer].scope || null, mappedLayers[layer].stats)
          : STATIC_HTML_EXPECTED_LAYER_STATS[layer],
        duplicateUniversityKeys: layer === "base" ? [] : rawCollection.duplicateUniversityKeys,
        duplicateUniversityCount: layer === "base" ? 0 : rawCollection.duplicateUniversityKeys.length,
        overrideUniversityNames: rawCollection.patchNamesByLayer[layer],
        overrideUniversityCount: rawCollection.patchNamesByLayer[layer].length
      }
    ])
  ) as Record<StaticCatalogLayerName, StaticCatalogLayerReport>;
  const selected = mappedLayers[selectedLayer];
  const validation = validateStaticCatalog(
    {
      layer: selectedLayer,
      sourceHtmlPath: htmlPath,
      universities: selected.universities,
      programs: selected.programs,
      stats: selected.stats,
      expectedStats: selected.scope
        ? getExpectedStatsForScope(selectedLayer, selected.scope || null, selected.stats)
        : STATIC_HTML_EXPECTED_LAYER_STATS[selectedLayer],
      layerReports,
      scope: selected.scope || null,
      warnings: []
    },
    false
  );

  return {
    layer: selectedLayer,
    sourceHtmlPath: htmlPath,
    universities: selected.universities,
    programs: selected.programs,
    stats: selected.stats,
    expectedStats: selected.scope
      ? getExpectedStatsForScope(selectedLayer, selected.scope || null, selected.stats)
      : STATIC_HTML_EXPECTED_LAYER_STATS[selectedLayer],
    layerReports,
    scope: selected.scope || null,
    warnings: validation.warnings
  };
}

function assertUnique(values: string[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  if (duplicates.size) {
    errors.push(`${label} has duplicates: ${Array.from(duplicates).join(", ")}`);
  }
}

export function validateStaticCatalog(catalog: StaticCatalog, compareExpected = true): StaticCatalogValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const layer = catalog.layer || "base";
  const expectedStats = catalog.expectedStats || STATIC_HTML_EXPECTED_LAYER_STATS[layer];
  const scope = catalog.scope || null;
  const layerReports = catalog.layerReports || {
    base: {
      layer: "base",
      stats: catalog.stats,
      expectedStats,
      duplicateUniversityKeys: [],
      duplicateUniversityCount: 0,
      overrideUniversityNames: [],
      overrideUniversityCount: 0
    },
    supplement: {
      layer: "supplement",
      stats: catalog.stats,
      expectedStats: STATIC_HTML_EXPECTED_LAYER_STATS.supplement,
      duplicateUniversityKeys: [],
      duplicateUniversityCount: 0,
      overrideUniversityNames: [],
      overrideUniversityCount: 0
    },
    merged: {
      layer: "merged",
      stats: catalog.stats,
      expectedStats: STATIC_HTML_EXPECTED_LAYER_STATS.merged,
      duplicateUniversityKeys: [],
      duplicateUniversityCount: 0,
      overrideUniversityNames: [],
      overrideUniversityCount: 0
    }
  };
  const stats = buildStats(
    catalog.sourceHtmlPath,
    catalog.stats.fileBytes,
    catalog.universities,
    catalog.programs
  );

  assertUnique(catalog.universities.map((item) => item.code), "University code", errors);
  assertUnique(catalog.universities.map((item) => item.slug), "University slug", errors);
  assertUnique(catalog.programs.map((item) => item.code), "Program code", errors);
  assertUnique(catalog.programs.map((item) => item.slug), "Program slug", errors);

  const universityCodes = new Set(catalog.universities.map((item) => item.code));
  const orphanPrograms = catalog.programs.filter((program) => !universityCodes.has(program.universityCode));
  if (orphanPrograms.length) {
    errors.push(`Program references missing universities: ${orphanPrograms.slice(0, 10).map((item) => item.code).join(", ")}`);
  }
  if (scope && !catalog.universities.length) {
    const scopeLabel = [
      scope.universityCode ? `code=${scope.universityCode}` : "",
      scope.universitySlug ? `slug=${scope.universitySlug}` : ""
    ].filter(Boolean).join(", ");
    errors.push(`Static catalog scope matched no universities: ${scopeLabel || "empty scope"}`);
  }

  if (compareExpected) {
    for (const [key, expected] of Object.entries(expectedStats)) {
      const actual = stats[key as keyof StaticCatalogExpectedStats];
      if (actual !== expected) {
        errors.push(`Expected ${layer} ${key}=${expected}, got ${String(actual)}`);
      }
    }
  }

  if ((stats.publicDisplayStatusCounts.ready || 0) !== expectedStats.readyProgramCount) {
    warnings.push("Ready program count differs from public display status count.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    layer,
    expectedStats,
    stats,
    layerReports,
    scope
  };
}
