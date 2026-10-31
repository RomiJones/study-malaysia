import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import mysql from "mysql2/promise";
import { loadEnvFiles } from "../apps/api/src/config/env.js";

type LocaleText = { en: string; ms: string; "zh-CN": string; "zh-TW": string };
type ProgramRow = {
  id: number;
  code: string;
  slug: string;
  level: string;
  nameEnOfficial: string;
  category: string | null;
  facultyZh: string | null;
  durationYears: string | number;
  durationOfficial: string;
  intakeMonths: string[] | null;
  officialIntake: string | null;
  languageRequirement: Record<string, unknown> | null;
  officialLanguageRequirement: string | null;
  requirement: Record<string, unknown> | null;
  officialAcademicRequirement: string | null;
  officialEntryRequirementSourceUrl: string | null;
  sourceUrls: unknown[] | null;
  tuitionAmount: string | number | null;
  tuitionDisplay: string | null;
  officialFeeSourceUrl: string | null;
};

type PdfSource = {
  id: string;
  url: string;
  localPath: string;
  extractedTextPath: string;
  lines: string[];
  normalizedWindows: string[];
  published: string;
};

type ExtractedPdfFields = {
  matched: boolean;
  score: number;
  matchedTokenRatio: number;
  sourceId?: string;
  sourceUrl?: string;
  sourceTextPath?: string;
  lineStart?: number;
  lineEnd?: number;
  matchedTokens?: string[];
  durationYears?: number | null;
  durationOfficial?: string;
  intakeMonths?: string[];
  officialIntake?: string;
  languageRequirement?: Record<string, number | null>;
  officialLanguageRequirement?: string;
  officialAcademicRequirement?: string;
  gpa?: number;
};

const repositoryRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const sourceRoot = "data/imports/iiu/2026-06-20/iiu-20260620";
const reportRoot = "data/imports/iiu/2026-06-24";
const outputPath = resolve(repositoryRoot, reportRoot, "inti-pdf-requirements-sync-report-20260624.json");
const summaryPath = resolve(repositoryRoot, reportRoot, "INTI_pdf_requirements_sync_summary_20260624.md");
const backupPath = resolve(repositoryRoot, "apps/api/tmp/backups/inti-official-rows-before-pdf-requirements-sync-20260624.json");

const monthMap: Record<string, string> = {
  jan: "January",
  january: "January",
  feb: "February",
  february: "February",
  mar: "March",
  march: "March",
  apr: "April",
  april: "April",
  may: "May",
  jun: "June",
  june: "June",
  jul: "July",
  july: "July",
  aug: "August",
  august: "August",
  sep: "September",
  sept: "September",
  september: "September",
  oct: "October",
  october: "October",
  nov: "November",
  november: "November",
  dec: "December",
  december: "December"
};

const tokenStopwords = new Set([
  "a", "an", "and", "at", "by", "collaboration", "collaborative", "degree", "for", "from", "hons",
  "honors", "honours", "in", "international", "inti", "level", "malaysia", "mqf", "of", "online",
  "programme", "program", "the", "uk", "university", "usa", "with"
]);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8")) as T;
}

function malaysiaTimestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+08:00`;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bb\.?\s*sc\.?\b/g, "bachelor science")
    .replace(/\bb\.?\s*a\.?\b/g, "bachelor arts")
    .replace(/\bba\b/g, "bachelor arts")
    .replace(/\bph\.?\s*d\.?\b/g, "doctor philosophy")
    .replace(/\bmba\b/g, "master business administration")
    .replace(/\bintergrated\b/g, "integrated")
    .replace(/&/g, " and ")
    .replace(/3\+0|4\+0|3\.5\+0|\d+\+\d+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(name: string) {
  return [...new Set(normalizeText(name).split(" ")
    .filter((token) => token.length > 2 && !tokenStopwords.has(token)))];
}

function compactLines(lines: string[]) {
  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function loadPdfSources(): PdfSource[] {
  const registry = readJson<{ sources?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
    `${sourceRoot}/02_official_source_registry.json`
  );
  const items = Array.isArray(registry) ? registry : registry.sources || [];
  return items
    .filter((item) => item.sourceType === "official-pdf" && item.extractedTextPath && item.url)
    .map((item) => {
      const textPath = String(item.extractedTextPath);
      const lines = compactLines(readFileSync(resolve(repositoryRoot, textPath), "utf8").split(/\r?\n/));
      const normalizedWindows = lines.map((_line, index) => normalizeText(lines.slice(index, index + 8).join(" ")));
      const published = lines.find((line) => /published\s*:/i.test(line))?.replace(/\s+/g, " ").trim() || "";
      return {
        id: String(item.id || ""),
        url: String(item.url || ""),
        localPath: String(item.localPath || ""),
        extractedTextPath: textPath,
        lines,
        normalizedWindows,
        published
      };
    });
}

function scoreWindow(tokens: string[], normalizedWindow: string) {
  const matched = tokens.filter((token) => normalizedWindow.includes(token));
  return { score: matched.length, matched };
}

function isOnlineRow(row: ProgramRow) {
  return /online/.test(normalizeText(`${row.nameEnOfficial} ${row.category || ""} ${row.facultyZh || ""}`));
}

function adjustedScore(row: ProgramRow, score: number, normalizedWindow: string) {
  const windowHasOnline = /\bonline\s+learning\b/.test(normalizedWindow);
  if (isOnlineRow(row)) return windowHasOnline ? score + 1 : score - 1;
  return windowHasOnline ? score - 2 : score;
}

function findBestSection(row: ProgramRow, sources: PdfSource[]) {
  const tokens = titleTokens(row.nameEnOfficial);
  const explicitBrochureUrls = Array.isArray(row.sourceUrls)
    ? row.sourceUrls
      .map((source) => typeof source === "object" && source ? String((source as Record<string, unknown>).url || "") : "")
      .filter((url) => /\.pdf(?:$|\?)/i.test(url))
    : [];
  const explicitSources = sources.filter((source) =>
    explicitBrochureUrls.some((url) => url.toLowerCase() === source.url.toLowerCase())
  );
  const candidateSources = explicitSources.length ? explicitSources : sources.filter((source) =>
    sourceAppliesToRow(row, source)
    || explicitBrochureUrls.some((url) => url.toLowerCase() === source.url.toLowerCase() && sourceTitleOverlap(row, source) >= 2)
  );
  const scopedSources = candidateSources.length ? candidateSources : sources.filter((source) => sourceTitleOverlap(row, source) >= 2);
  let best: { source: PdfSource; index: number; score: number; rawScore: number; matched: string[] } | null = null;
  for (const source of scopedSources) {
    source.normalizedWindows.forEach((window, index) => {
      const scored = scoreWindow(tokens, window);
      const score = adjustedScore(row, scored.score, window);
      if (!best || score > best.score || (score === best.score && scored.score > best.rawScore)) {
        best = { source, index, score, rawScore: scored.score, matched: scored.matched };
      }
    });
  }
  if (!best) return null;
  const ratio = tokens.length ? best.rawScore / tokens.length : 0;
  const threshold = tokens.length <= 3 ? tokens.length : Math.max(3, Math.ceil(tokens.length * 0.48));
  if (best.rawScore < threshold || ratio < 0.45) return null;
  const normalizedWindow = best.source.normalizedWindows[best.index] || "";
  const titleSignals = ["bachelor", "master", "doctor", "philosophy", "science", "arts", "business", "engineering", "technology", "degree", "program"]
    .filter((token) => normalizeText(row.nameEnOfficial).split(" ").includes(token));
  if (titleSignals.length && !titleSignals.some((token) => normalizedWindow.includes(token))) return null;
  return { ...best, score: best.rawScore, ratio, tokens };
}

function sourceTitleOverlap(row: ProgramRow, source: PdfSource) {
  const sourceTokens = normalizeText(`${source.id} ${source.url}`).split(" ");
  return specificTitleTokens(row.nameEnOfficial).filter((token) => sourceTokens.includes(token)).length;
}

function sourceAppliesToRow(row: ProgramRow, source: PdfSource) {
  const sourceId = source.id.toLowerCase();
  const name = normalizeText(row.nameEnOfficial);
  const category = normalizeText(`${row.category || ""} ${row.facultyZh || ""}`);
  const hasAny = (...terms: string[]) => terms.some((term) => name.includes(term) || category.includes(term));

  if (sourceTitleOverlap(row, source) >= 2) return true;
  if (sourceId.includes("aup")) return /american|degree transfer/.test(name);
  if (sourceId.includes("business-pdf")) return hasAny("business", "accounting", "finance", "marketing", "banking", "management", "entrepreneurship", "logistics", "human resource");
  if (sourceId.includes("computing-pdf")) return hasAny("computer", "computing", "information technology", "information and communication", "data science", "software", "network", "cloud");
  if (sourceId.includes("engineering-pdf")) return hasAny("engineering", "quantity surveying", "construction", "manufacturing", "process", "product design", "civil", "mechanical", "electrical");
  if (sourceId.includes("biotechnology-pdf")) return hasAny("biotechnology", "biosciences", "science", "applied physics");
  if (sourceId.includes("mass-communication-pdf")) return hasAny("mass communication", "communication", "media", "digital media");
  if (sourceId.includes("art-and-design-pdf")) return hasAny("art", "design", "fashion", "interior architecture");
  if (sourceId.includes("hospitality-pdf")) return hasAny("hospitality", "culinary", "food service");
  if (sourceId.includes("physiotherapy-pdf")) return hasAny("physiotherapy", "health administration", "health sciences");
  if (sourceId.includes("traditional-chinese-medicine-pdf")) return hasAny("traditional chinese medicine");
  if (sourceId.includes("swinburne") || sourceId.includes("sut-pdf")) return /swinburne/.test(name);
  if (sourceId.includes("snhu-pdf")) return /southern new hampshire|snhu/.test(name);
  if (sourceId.includes("inti-wa-mba-booklet")) return row.level !== "bachelor";
  if (sourceId.includes("iicp-inti-iu-mba")) return /master business administration|mba/.test(name);
  return false;
}

function specificTitleTokens(name: string) {
  const generic = new Set([
    "bachelor", "master", "doctor", "science", "arts", "business", "technology", "degree", "program", "programme",
    "honours", "major", "online", "learning", "collaboration", "university", "international"
  ]);
  return titleTokens(name).filter((token) => !generic.has(token));
}

function nextHeadingIndex(lines: string[], start: number) {
  const headingPattern = /^(BACHELOR|MASTER|DOCTOR|FOUNDATION|DIPLOMA|CERTIFICATE|AMERICAN|AUSTRALIAN)\b/i;
  for (let index = start + 6; index < Math.min(lines.length, start + 220); index += 1) {
    if (headingPattern.test(lines[index]) && lines.slice(index, index + 4).join(" ").length > 18) return index;
  }
  return Math.min(lines.length, start + 180);
}

function findTitleStart(row: ProgramRow, source: PdfSource, matchedIndex: number) {
  const tokens = titleTokens(row.nameEnOfficial);
  const threshold = tokens.length <= 3 ? tokens.length : Math.max(3, Math.ceil(tokens.length * 0.48));
  const headingPattern = /^(BACHELOR|MASTER|DOCTOR|AMERICAN|AUSTRALIAN|HEALTH|BUSINESS|MASS|PSYCHOLOGY|BIOSCIENCES)\b/i;
  const start = Math.max(0, matchedIndex - 30);
  const end = Math.min(source.lines.length, matchedIndex + 100);
  let best: { index: number; score: number; heading: boolean } | null = null;
  for (let index = start; index < end; index += 1) {
    const window = normalizeText(source.lines.slice(index, index + 8).join(" "));
    const rawScore = scoreWindow(tokens, window).score;
    if (rawScore < threshold) continue;
    const score = adjustedScore(row, rawScore, window);
    const line = source.lines[index];
    const heading = headingPattern.test(line) || (/^[A-Z0-9&(),/ .'-]{8,}$/.test(line) && /[A-Z]/.test(line));
    if (
      !best
      || (heading && !best.heading)
      || (heading === best.heading && score > best.score)
      || (heading === best.heading && score === best.score && index > best.index)
    ) {
      best = { index, score, heading };
    }
  }
  return best?.index ?? matchedIndex;
}

function findFieldSectionStart(row: ProgramRow, lines: string[], titleStart: number) {
  const specificTokens = specificTitleTokens(row.nameEnOfficial);
  const earliest = Math.max(0, titleStart - 45);
  for (let index = titleStart - 1; index >= earliest; index -= 1) {
    if (/^offered at$/i.test(lines[index])) {
      const prelude = normalizeText(lines.slice(index, titleStart).join(" "));
      const required = Math.min(2, specificTokens.length);
      const matched = specificTokens.filter((token) => prelude.includes(token)).length;
      return matched >= required ? index : titleStart;
    }
    if (/^(bachelor|master|doctor|diploma|certificate|foundation|american|australian)\b/i.test(lines[index])) break;
  }
  return titleStart;
}

function findBlockAfter(section: string[], pattern: RegExp, stopPatterns: RegExp[], maxLines = 45) {
  const index = section.findIndex((line) => pattern.test(line));
  if (index < 0) return "";
  const rows: string[] = [];
  for (let cursor = index + 1; cursor < Math.min(section.length, index + maxLines); cursor += 1) {
    const line = section[cursor];
    if (rows.length && stopPatterns.some((stop) => stop.test(line))) break;
    rows.push(line);
  }
  return rows.join(" ").replace(/\s+/g, " ").trim();
}

function findEnglishRequirement(section: string[]) {
  const index = section.findIndex((line, cursor) => {
    const pair = `${line} ${section[cursor + 1] || ""}`.replace(/\s+/g, " ");
    return /english language requirements?:?/i.test(pair)
      || /meet any of these(?: following)? english language requirements?:?/i.test(pair)
      || /(?:international students|candidates).{0,80}(?:ielts|muet|toefl|pte)/i.test(pair);
  });
  if (index < 0) return "";
  const rows: string[] = [];
  for (let cursor = index; cursor < Math.min(section.length, index + 32); cursor += 1) {
    const line = section[cursor];
    if (rows.length && /^(highlights?|programme structure|career opportunities|offered at|duration|entry requirements?|bachelor|master|doctor|awarded by|note\b)/i.test(line)) break;
    rows.push(line);
  }
  return rows.join(" ").replace(/\s+/g, " ").trim();
}

function buildExtractedFields(
  row: ProgramRow,
  source: PdfSource,
  sectionStart: number,
  end: number,
  score: number,
  ratio: number,
  matchedTokens: string[]
): ExtractedPdfFields {
  const section = source.lines.slice(sectionStart, end);
  const sectionText = section.join(" ");
  const duration = extractDuration(section);
  const intake = extractIntake(section);
  const officialAcademicRequirement = cleanOfficialRequirement(findBlockAfter(
    section,
    /^entry requirements?:?/i,
    [/^english language requirements?:?/i, /^meet any of these/i, /^highlights?$/i, /^programme structure$/i, /^career opportunities/i, /^offered at$/i],
    60
  ));
  const officialLanguageRequirement = cleanOfficialRequirement(findEnglishRequirement(section));
  const language = extractLanguage([officialLanguageRequirement, officialAcademicRequirement, sectionText].join(" "));
  const gpa = extractGpa(officialAcademicRequirement);
  return {
    matched: true,
    score,
    matchedTokenRatio: Number(ratio.toFixed(2)),
    sourceId: source.id,
    sourceUrl: source.url,
    sourceTextPath: source.extractedTextPath,
    lineStart: sectionStart + 1,
    lineEnd: end,
    matchedTokens,
    durationYears: duration?.years ?? null,
    durationOfficial: duration?.official,
    intakeMonths: intake?.months,
    officialIntake: intake?.officialIntake,
    languageRequirement: language || undefined,
    officialLanguageRequirement: officialLanguageRequirement || undefined,
    officialAcademicRequirement: officialAcademicRequirement || undefined,
    gpa
  };
}

function findKnownSection(row: ProgramRow, sources: PdfSource[]) {
  if (row.code !== "INTI-M-014") return null;
  const source = sources.find((item) => item.id.includes("inti-wa-mba-booklet"));
  if (!source) return null;
  const registrationIndex = source.lines.findIndex((line) => /R\/0733\/7\/0008/i.test(line));
  if (registrationIndex < 0) return null;
  const titleIndex = source.lines.findIndex((line, index) =>
    index > registrationIndex
    && /^MASTER OF SCIENCE IN/i.test(line)
    && normalizeText(source.lines.slice(index, index + 5).join(" ")).includes("building information modelling")
  );
  if (titleIndex < 0) return null;
  let offeredIndex = registrationIndex;
  for (let index = registrationIndex; index >= Math.max(0, registrationIndex - 12); index -= 1) {
    if (/^offered at$/i.test(source.lines[index])) {
      offeredIndex = index;
      break;
    }
  }
  return {
    source,
    sectionStart: offeredIndex,
    titleStart: titleIndex,
    end: nextHeadingIndex(source.lines, titleIndex),
    score: titleTokens(row.nameEnOfficial).length,
    ratio: 1,
    matchedTokens: titleTokens(row.nameEnOfficial)
  };
}

function intakeMonthsFromText(text: string) {
  const months = new Set<string>();
  for (const match of text.matchAll(/\b(JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEPT|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC)\b/gi)) {
    const month = monthMap[match[1].toLowerCase()];
    if (month) months.add(month);
  }
  return [...months];
}

function extractIntake(section: string[]) {
  const windows: string[] = [];
  for (let index = 0; index < section.length; index += 1) {
    if (/intakes?|ambilan/i.test(section[index])) {
      windows.push(section.slice(index, index + 3).join(" "));
    }
  }
  const universityWindow = section
    .map((line, index) => ({ line, index }))
    .filter((item) => /INTI International University/i.test(item.line))
    .map((item) => section.slice(item.index, item.index + 8).join(" "))
    .find((text) => /intakes?/i.test(text));
  const text = universityWindow || windows[0] || "";
  const months = intakeMonthsFromText(text);
  return months.length ? { months, officialIntake: limitText(text.replace(/\s+/g, " ").trim(), 240) } : null;
}

function limitText(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength - 1).trimEnd() : value;
}

function durationYearsFromText(text: string) {
  if (/\d+(?:\.\d+)?\s*(?:[-–—+]|\bor\b|\bto\b)\s*\d+(?:\.\d+)?/i.test(text)) return null;
  if (/\bpart[-\s]?time\b/i.test(text) && !/\bfull[-\s]?time\b/i.test(text)) return null;
  const fullTime = text.match(/full[-\s]?time\s*:?\s*(\d+(?:\.\d+)?)\s*years?(?!\s*[-–—+])/i);
  if (fullTime) return Number(fullTime[1]);
  const year = text.match(/(\d+(?:\.\d+)?)\s*years?(?!\s*[-–—+])/i);
  if (year) return Number(year[1]);
  const semester = text.match(/(\d+(?:\.\d+)?)\s*semesters?/i);
  if (semester) return Number((Number(semester[1]) / 2).toFixed(1));
  return null;
}

function extractDuration(section: string[]) {
  const index = section.findIndex((line) => /^duration\b/i.test(line));
  if (index < 0) return null;
  const rows: string[] = [];
  for (let cursor = index + 1; cursor < Math.min(section.length, index + 6); cursor += 1) {
    const line = section[cursor];
    if (/^(entry requirements?|programme structure|career opportunities|offered at|highlights?|note\b|year\s+\d+|bachelor|master|doctor)\b/i.test(line)) break;
    if (!/\d|full[-\s]?time|part[-\s]?time|years?|semesters?/i.test(line)) break;
    rows.push(line);
  }
  const text = rows
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  const years = durationYearsFromText(text);
  return { years, official: limitText(text, 480) };
}

function parseScore(text: string, label: string) {
  const reverse = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:band|score)?\\s*(?:in\\s+)?${label}\\b`, "i"));
  const direct = text.match(new RegExp(`${label}\\b[^0-9,;/]{0,18}(\\d+(?:\\.\\d+)?)`, "i"));
  const parsed = Number(reverse?.[1] ?? direct?.[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function bounded(value: number | null, min: number, max: number) {
  return value != null && value >= min && value <= max ? value : null;
}

function extractLanguage(text: string) {
  const fullNameIelts = text.match(/(\d+(?:\.\d+)?)\s+in\s+International\s+English\s+Language\s+Testing\s+System\s*\(IELTS\)/i);
  const fullNameMuet = text.match(/Band\s+(\d+(?:\.\d+)?)\s+in\s+Malaysian\s+University\s+English\s+Test\s*\(MUET\)/i);
  const ielts = bounded(fullNameIelts ? Number(fullNameIelts[1]) : parseScore(text, "IELTS"), 1, 9);
  const toefl = bounded(parseScore(text, "TOEFL(?:\\s*iBT)?"), 30, 677);
  const pte = bounded(parseScore(text, "PTE"), 20, 90);
  const muet = bounded(fullNameMuet ? Number(fullNameMuet[1]) : parseScore(text, "MUET(?:\\s*Band)?"), 1, 5);
  const result = { ielts, toefl, pte, muet };
  return Object.values(result).some((value) => value != null) ? result : null;
}

function extractGpa(text: string) {
  const values = [...text.matchAll(/CGPA(?:\s+of)?\s*(\d+(?:\.\d+)?)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 4);
  return values.length ? Math.max(...values) : undefined;
}

function cleanOfficialRequirement(text: string) {
  return text
    .replace(/\s*Note: Programme structure is subject to change from time to time\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFields(row: ProgramRow, sources: PdfSource[]): ExtractedPdfFields {
  const known = findKnownSection(row, sources);
  if (known) {
    return buildExtractedFields(row, known.source, known.sectionStart, known.end, known.score, known.ratio, known.matchedTokens);
  }
  const best = findBestSection(row, sources);
  if (!best) return { matched: false, score: 0, matchedTokenRatio: 0 };
  const titleStart = findTitleStart(row, best.source, best.index);
  const sectionStart = findFieldSectionStart(row, best.source.lines, titleStart);
  const end = nextHeadingIndex(best.source.lines, titleStart);
  return buildExtractedFields(row, best.source, sectionStart, end, best.score, best.ratio, best.matched);
}

function mergeLanguage(existing: Record<string, unknown> | null, pdfLanguage?: Record<string, number | null>) {
  const merged = { ...(existing || {}) } as Record<string, unknown>;
  if (!pdfLanguage) return merged;
  for (const [key, value] of Object.entries(pdfLanguage)) {
    if (value != null) merged[key] = value;
  }
  return merged;
}

function localizedNote(text: string): LocaleText {
  return { en: text, ms: text, "zh-CN": text, "zh-TW": text };
}

function mergeRequirement(existing: Record<string, unknown> | null, gpa?: number, note?: string) {
  const merged = { ...(existing || {}) } as Record<string, unknown>;
  if (gpa) merged.gpa = gpa;
  if (note) merged.note = localizedNote("Entry requirements follow the latest official INTI PDF brochure. See official academic requirement text for the full route-specific requirements.");
  return merged;
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

function diffRow(row: ProgramRow, extracted: ExtractedPdfFields) {
  const updates: Record<string, unknown> = {};
  const differences: string[] = [];
  if (!extracted.matched) return { updates, differences };

  if (extracted.durationYears && Number(row.durationYears) !== extracted.durationYears) {
    updates.durationYears = extracted.durationYears;
    differences.push(`durationYears: ${row.durationYears} -> ${extracted.durationYears}`);
  }
  if (extracted.durationOfficial && row.durationOfficial !== extracted.durationOfficial) {
    updates.durationOfficial = extracted.durationOfficial;
    differences.push("durationOfficial updated from PDF");
  }
  if (extracted.intakeMonths?.length && !sameJson(row.intakeMonths || [], extracted.intakeMonths)) {
    updates.intakeMonths = extracted.intakeMonths;
    differences.push(`intakeMonths: ${JSON.stringify(row.intakeMonths || [])} -> ${JSON.stringify(extracted.intakeMonths)}`);
  }
  if (extracted.officialIntake && row.officialIntake !== extracted.officialIntake) {
    updates.officialIntake = extracted.officialIntake;
    differences.push("officialIntake updated from PDF");
  }
  const mergedLanguage = mergeLanguage(row.languageRequirement, extracted.languageRequirement);
  if (!sameJson(row.languageRequirement || {}, mergedLanguage)) {
    updates.languageRequirement = mergedLanguage;
    differences.push("languageRequirement updated from PDF");
  }
  if (extracted.officialLanguageRequirement && row.officialLanguageRequirement !== extracted.officialLanguageRequirement) {
    updates.officialLanguageRequirement = extracted.officialLanguageRequirement;
    differences.push("officialLanguageRequirement updated from PDF");
  }
  if (extracted.officialAcademicRequirement && row.officialAcademicRequirement !== extracted.officialAcademicRequirement) {
    updates.officialAcademicRequirement = extracted.officialAcademicRequirement;
    differences.push("officialAcademicRequirement updated from PDF");
  }
  const mergedRequirement = mergeRequirement(row.requirement, extracted.gpa, extracted.officialAcademicRequirement);
  if (!sameJson(row.requirement || {}, mergedRequirement)) {
    updates.requirement = mergedRequirement;
    differences.push("requirement.gpa/note updated from PDF");
  }
  if (extracted.sourceUrl && row.officialEntryRequirementSourceUrl !== extracted.sourceUrl) {
    updates.officialEntryRequirementSourceUrl = extracted.sourceUrl;
    differences.push("officialEntryRequirementSourceUrl set to official PDF");
  }
  return { updates, differences };
}

async function main() {
  loadEnvFiles();
  const generatedAt = malaysiaTimestamp();
  const sources = loadPdfSources();
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "123456",
    database: process.env.MYSQL_DATABASE || "study_malaysia"
  });

  const [rows] = await connection.query(
    `SELECT id, code, slug, level, nameEnOfficial, category, facultyZh, durationYears, durationOfficial, intakeMonths, officialIntake,
            languageRequirement, officialLanguageRequirement, requirement, officialAcademicRequirement,
            officialEntryRequirementSourceUrl, sourceUrls, tuitionAmount, tuitionDisplay, officialFeeSourceUrl
     FROM programs
     WHERE slug LIKE 'inti-official-2026-review-row-%'
     ORDER BY code`
  );
  const programs = rows as ProgramRow[];
  mkdirSync(dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, JSON.stringify(programs, null, 2), "utf8");

  const report = {
    generatedAt,
    tuitionPolicy: "Tuition fields are intentionally preserved from the latest official website programme pages. This PDF sync does not update tuitionAmount, tuitionDisplay, officialTuitionMYR, officialTuitionNote, annualTuitionCny, or fee source fields.",
    pdfSources: sources.map((source) => ({ id: source.id, url: source.url, extractedTextPath: source.extractedTextPath, published: source.published })),
    totals: {
      programs: programs.length,
      pdfSources: sources.length,
      matched: 0,
      unmatched: 0,
      updated: 0,
      unchanged: 0
    },
    rows: [] as Array<{
      code: string;
      nameEnOfficial: string;
      matched: boolean;
      sourceId?: string;
      sourceUrl?: string;
      score: number;
      matchedTokenRatio: number;
      differences: string[];
      extracted: ExtractedPdfFields;
    }>
  };

  await connection.beginTransaction();
  try {
    for (const row of programs) {
      const extracted = extractFields(row, sources);
      const { updates, differences } = diffRow(row, extracted);
      if (extracted.matched) report.totals.matched += 1;
      else report.totals.unmatched += 1;

      if (Object.keys(updates).length) {
        await connection.execute(
          `UPDATE programs
           SET durationYears = COALESCE(?, durationYears),
               durationOfficial = COALESCE(?, durationOfficial),
               intakeMonths = COALESCE(?, intakeMonths),
               officialIntake = COALESCE(?, officialIntake),
               languageRequirement = COALESCE(?, languageRequirement),
               officialLanguageRequirement = COALESCE(?, officialLanguageRequirement),
               requirement = COALESCE(?, requirement),
               officialAcademicRequirement = COALESCE(?, officialAcademicRequirement),
               officialEntryRequirementSourceUrl = COALESCE(?, officialEntryRequirementSourceUrl),
               officialVerifiedAt = '2026-06-24',
               officialSourceStatus = 'official-verified',
               publicDisplayNote = 'Official INTI PDF brochure admission requirements were compared and synced on 2026-06-24. Tuition remains governed by the latest official website programme fee pages.'
           WHERE id = ?`,
          [
            updates.durationYears ?? null,
            updates.durationOfficial ?? null,
            updates.intakeMonths ? JSON.stringify(updates.intakeMonths) : null,
            updates.officialIntake ?? null,
            updates.languageRequirement ? JSON.stringify(updates.languageRequirement) : null,
            updates.officialLanguageRequirement ?? null,
            updates.requirement ? JSON.stringify(updates.requirement) : null,
            updates.officialAcademicRequirement ?? null,
            updates.officialEntryRequirementSourceUrl ?? null,
            row.id
          ]
        );
        report.totals.updated += 1;
      } else {
        report.totals.unchanged += 1;
      }

      report.rows.push({
        code: row.code,
        nameEnOfficial: row.nameEnOfficial,
        matched: extracted.matched,
        sourceId: extracted.sourceId,
        sourceUrl: extracted.sourceUrl,
        score: extracted.score,
        matchedTokenRatio: extracted.matchedTokenRatio,
        differences,
        extracted
      });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

  const unmatched = report.rows.filter((row) => !row.matched);
  const updatedRows = report.rows.filter((row) => row.differences.length);
  const markdown = [
    "# INTI PDF 招生要求对比同步摘要",
    "",
    `- 执行时间：${report.generatedAt}`,
    "- 数据范围：INTI 官方公开专业 107 条。",
    `- 官方 PDF 来源：${report.totals.pdfSources} 份 INTI 官方 brochure PDF。`,
    "- 口径：PDF 作为招生要求、语言要求、学制、开学信息的官方依据；学费继续以最新官网 programme fee 页面为准，本轮未更新任何学费字段。",
    "",
    "## 结果",
    "",
    `- PDF 匹配：${report.totals.matched}/${report.totals.programs}`,
    `- 未匹配：${report.totals.unmatched}/${report.totals.programs}`,
    `- 有字段差异并已同步：${report.totals.updated}/${report.totals.programs}`,
    `- 无需更新：${report.totals.unchanged}/${report.totals.programs}`,
    "",
    "## 未匹配项目",
    "",
    ...(unmatched.length ? unmatched.map((row) => `- ${row.code} ${row.nameEnOfficial}`) : ["- 无"]),
    "",
    "## 代表性差异",
    "",
    ...updatedRows.slice(0, 30).map((row) => `- ${row.code} ${row.nameEnOfficial}: ${row.differences.join("; ")}`),
    updatedRows.length > 30 ? `- 其余 ${updatedRows.length - 30} 条详见 JSON 报告。` : "",
    "",
    "## 文件",
    "",
    `- JSON 报告：${reportRoot}/inti-pdf-requirements-sync-report-20260624.json`,
    `- 数据备份：apps/api/tmp/backups/inti-official-rows-before-pdf-requirements-sync-20260624.json`
  ].filter(Boolean).join("\n");
  writeFileSync(summaryPath, markdown, "utf8");

  console.log(JSON.stringify({
    matched: report.totals.matched,
    unmatched: report.totals.unmatched,
    updated: report.totals.updated,
    unchanged: report.totals.unchanged,
    output: outputPath,
    summary: summaryPath,
    backup: backupPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
