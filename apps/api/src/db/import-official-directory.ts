import "reflect-metadata";
import { createHash } from "node:crypto";
import { loadEnvFiles } from "../config/env.js";
import { DataSource, In } from "typeorm";
import type {
  DegreeLevel,
  InstitutionOwnership,
  InstitutionType,
  LocalizedStringArray,
  LocalizedText,
  ProgramCategory
} from "@studymy/shared";
import { ALL_ENTITIES, ProgramEntity, UniversityEntity } from "./entities.js";

const OFFICIAL_DIRECTORY_BASE = "https://discover.educationmalaysia.gov.my";
const DIRECTORY_API_BASE = `${OFFICIAL_DIRECTORY_BASE}/wp-json/wp/v2`;
const HIGHER_EDUCATION_INSTITUTION_IDS = [252, 253, 254, 255, 1212];
const PROGRAM_URL_KEYWORDS = [
  "programme",
  "program",
  "course",
  "study",
  "degree",
  "undergraduate",
  "postgraduate",
  "bachelor",
  "master",
  "phd",
  "doctor",
  "faculty"
];
const DEGREE_KEYWORDS = /(bachelor|undergraduate|degree|master|phd|doctor|doctorate|doctoral|mba|llm|msc|ma|meng|mphil)/i;
const NOISE_TITLE_KEYWORDS = /(admission|apply|enrol|enroll|fees|scholarship|campus|research|faculty|school of|student life|why choose|overview|about)/i;

interface DirectoryTerm {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
}

interface DirectoryCourse {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  institution: number[];
  study_level: number[];
  study_areas: number[];
  university: number[];
}

interface OfficialSiteMeta {
  title: string;
  description: string;
  logoUrl: string;
  homepageUrl: string;
}

interface DirectoryUniversityProfile {
  term: DirectoryTerm;
  officialWebsite: string;
  admissionEmail: string;
  location: string;
  region: string;
  logoUrl: string;
  imageUrl: string;
  description: string;
  qsRank: number;
  qsAsiaRank: number | null;
  ownership: InstitutionOwnership;
  institutionType: InstitutionType;
}

interface ProgramCandidate {
  title: string;
  url: string;
  description: string;
  level: DegreeLevel;
  category: ProgramCategory;
  faculty: string;
}

interface ImportSummary {
  importedUniversities: number;
  updatedUniversities: number;
  importedPrograms: number;
  skippedPrograms: number;
  warnings: string[];
}

function localizedText(value: string): LocalizedText {
  const normalized = value.trim();
  return {
    en: normalized,
    ms: normalized,
    "zh-CN": normalized,
    "zh-TW": normalized
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

function stripHtml(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, "&")
    .replace(/&#8211;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(input: string) {
  return stripHtml(input);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function clampWithHash(value: string, maxLength: number, seed: string) {
  if (value.length <= maxLength) return value;
  const hash = createHash("md5").update(seed).digest("hex").slice(0, 8);
  const prefixLength = Math.max(1, maxLength - hash.length - 1);
  return `${value.slice(0, prefixLength).replace(/-+$/g, "")}-${hash}`;
}

function sanitizeCode(value: string) {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 20);
  return normalized || `UNI${createHash("md5").update(value).digest("hex").slice(0, 6).toUpperCase()}`;
}

function hashColor(seed: string) {
  const hex = createHash("md5").update(seed).digest("hex").slice(0, 6);
  return `#${hex.toUpperCase()}`;
}

function resolveUrl(url: string, base: string) {
  try {
    return new URL(url, base).toString();
  } catch {
    return "";
  }
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(init?.headers || {})
    },
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      accept: "application/json,text/plain,*/*",
      ...(init?.headers || {})
    },
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchPagedJson<T>(urlBuilder: (page: number) => string) {
  const firstUrl = urlBuilder(1);
  const firstResponse = await fetch(firstUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      accept: "application/json,text/plain,*/*"
    },
    redirect: "follow"
  });
  if (!firstResponse.ok) {
    throw new Error(`HTTP ${firstResponse.status} for ${firstUrl}`);
  }
  const firstPage = (await firstResponse.json()) as T[];
  const totalPages = Number(firstResponse.headers.get("x-wp-totalpages") || 1);
  const all = [...firstPage];

  for (let page = 2; page <= totalPages; page += 1) {
    const pageUrl = urlBuilder(page);
    const pageItems = await fetchJson<T[]>(pageUrl);
    all.push(...pageItems);
  }

  return all;
}

function extractFirstMatch(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : "";
}

function extractAllMatches(html: string, pattern: RegExp) {
  return Array.from(html.matchAll(pattern))
    .map((match) => decodeHtml(match[1] || ""))
    .filter(Boolean);
}

function mapOwnership(text: string): InstitutionOwnership {
  return /public/i.test(text) ? "public" : "private";
}

function mapInstitutionType(text: string): InstitutionType {
  if (/research/i.test(text)) return "research";
  if (/college|applied|polytechnic|tvet|technical/i.test(text)) return "applied";
  return "comprehensive";
}

function getShortName(termName: string, officialWebsite: string) {
  const bracketMatch = termName.match(/\(([^)]+)\)/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim().slice(0, 50);
  }
  if (officialWebsite) {
    try {
      const hostname = new URL(officialWebsite).hostname.replace(/^www\./, "");
      return hostname.split(".")[0].slice(0, 50);
    } catch {
      return termName.slice(0, 50);
    }
  }
  return termName.slice(0, 50);
}

function getUniversityCode(termName: string, shortName: string, officialWebsite: string) {
  const bracketMatch = termName.match(/\(([^)]+)\)/);
  if (bracketMatch?.[1]) {
    return sanitizeCode(bracketMatch[1]);
  }
  if (shortName && shortName.length <= 10) {
    return sanitizeCode(shortName);
  }
  if (officialWebsite) {
    try {
      return sanitizeCode(new URL(officialWebsite).hostname.replace(/^www\./, "").split(".")[0]);
    } catch {
      return sanitizeCode(termName);
    }
  }
  return sanitizeCode(termName);
}

function getUniqueUniversityCode(
  profile: DirectoryUniversityProfile,
  usedCodes: Set<string>,
  current?: UniversityEntity | null
) {
  const shortName = getShortName(profile.term.name, profile.officialWebsite);
  const baseCode = current?.code || getUniversityCode(profile.term.name, shortName, profile.officialWebsite);
  if (!usedCodes.has(baseCode) || current?.code === baseCode) {
    usedCodes.add(baseCode);
    return { shortName, code: baseCode };
  }

  const slugParts = profile.term.slug
    .split("-")
    .map((item) => item.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);
  for (let index = slugParts.length - 1; index >= 0; index -= 1) {
    const suffix = sanitizeCode(slugParts[index]).slice(0, 6);
    const candidate = sanitizeCode(`${baseCode}${suffix}`).slice(0, 20);
    if (candidate && !usedCodes.has(candidate)) {
      usedCodes.add(candidate);
      return { shortName, code: candidate };
    }
  }

  const fallback = sanitizeCode(`${baseCode}${profile.term.id}`).slice(0, 20);
  usedCodes.add(fallback);
  return { shortName, code: fallback };
}

async function getHigherEducationUniversityIds() {
  const ids = new Set<number>();
  for (const institutionId of HIGHER_EDUCATION_INSTITUTION_IDS) {
    const courses = await fetchPagedJson<DirectoryCourse>(
      (page) => `${DIRECTORY_API_BASE}/course?institution=${institutionId}&per_page=100&page=${page}`
    );
    for (const course of courses) {
      for (const universityId of course.university || []) {
        ids.add(universityId);
      }
    }
  }
  return ids;
}

async function getDirectoryUniversityProfiles(universities: DirectoryTerm[]) {
  const profiles: DirectoryUniversityProfile[] = [];
  for (const term of universities) {
    const html = await fetchText(term.link);
    const citeTopBlocks = extractAllMatches(html, /<div class="cit_top">[\s\S]*?<p>(.*?)<\/p>/gi);
    const description =
      extractFirstMatch(html, /<div class="preline">[\s\S]*?<p>([\s\S]*?)<\/p>/i) || term.description || term.name;
    const website =
      extractFirstMatch(html, /<a[^>]+class="[^"]*enquiry_button[^"]*"[^>]+href="([^"]+)"[^>]*>Visit Website<\/a>/i) ||
      extractFirstMatch(html, /<a[^>]+href="([^"]+)"[^>]*>Visit Website<\/a>/i);
    const logoUrl = extractFirstMatch(html, /<div class="ib_logo">[\s\S]*?<img[^>]+src="([^"]+)"/i);
    const imageUrl =
      extractFirstMatch(html, /<img[^>]+class="overview-image"[^>]+src="([^"]+)"/i) ||
      extractFirstMatch(html, /class="ib_background" style="background-image:url\(([^)]+)\)"/i);
    const location = extractFirstMatch(html, /<div class="ib_location">[\s\S]*?<p>(.*?)<\/p>/i);
    const email = extractFirstMatch(html, /name="temporarily_taxonomy_email"\s+value="([^"]*)"/i);
    const qsRankRaw = extractFirstMatch(html, /QS World University Rankings:\s*<\/strong><\/a>\s*([0-9]+)/i);
    const qsAsiaRaw = extractFirstMatch(html, /QS Asian University Rankings:\s*<\/strong><\/a>\s*([0-9]+)/i);

    profiles.push({
      term,
      officialWebsite: resolveUrl(website, term.link),
      admissionEmail: email,
      location,
      region: location,
      logoUrl: resolveUrl(logoUrl, term.link),
      imageUrl: resolveUrl(imageUrl, term.link),
      description,
      qsRank: Number(qsRankRaw || 0),
      qsAsiaRank: qsAsiaRaw ? Number(qsAsiaRaw) : null,
      ownership: mapOwnership(citeTopBlocks[0] || ""),
      institutionType: mapInstitutionType(citeTopBlocks.join(" "))
    });
  }
  return profiles;
}

async function getOfficialSiteMeta(website: string): Promise<OfficialSiteMeta> {
  try {
    const html = await fetchText(website);
    const title =
      extractFirstMatch(html, /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
      extractFirstMatch(html, /<title>([\s\S]*?)<\/title>/i);
    const description =
      extractFirstMatch(html, /<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
      extractFirstMatch(html, /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
    const logoUrl =
      resolveUrl(
        extractFirstMatch(html, /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
          extractFirstMatch(html, /<link[^>]+rel="(?:shortcut icon|icon|apple-touch-icon)"[^>]+href="([^"]+)"/i),
        website
      ) || "";

    return {
      title: title || "",
      description: description || "",
      logoUrl,
      homepageUrl: website
    };
  } catch {
    return {
      title: "",
      description: "",
      logoUrl: "",
      homepageUrl: website
    };
  }
}

function getSitemapCandidates(baseUrl: string, robotsTxt: string) {
  const fromRobots = extractAllMatches(robotsTxt, /^Sitemap:\s*(.+)$/gim).map((item) => item.trim());
  const common = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml", "/sitemap/sitemap-index.xml"];
  const combined = [
    ...fromRobots,
    ...common.map((path) => resolveUrl(path, baseUrl))
  ];
  return uniqueStrings(combined);
}

function parseXmlLocs(xml: string) {
  return extractAllMatches(xml, /<loc>([\s\S]*?)<\/loc>/gi)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

async function collectSitemapUrls(baseUrl: string) {
  let robotsTxt = "";
  try {
    robotsTxt = await fetchText(resolveUrl("/robots.txt", baseUrl));
  } catch {
    robotsTxt = "";
  }

  const queue = getSitemapCandidates(baseUrl, robotsTxt);
  const visited = new Set<string>();
  const urls = new Set<string>();

  while (queue.length) {
    const sitemapUrl = queue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    try {
      const xml = await fetchText(sitemapUrl, {
        headers: {
          accept: "application/xml,text/xml,*/*"
        }
      });
      const locs = parseXmlLocs(xml);
      for (const loc of locs) {
        if (/\.xml($|\?)/i.test(loc) && !visited.has(loc) && queue.length < 200) {
          queue.push(loc);
        } else {
          urls.add(loc);
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(urls);
}

function looksLikeProgramUrl(url: string) {
  const normalized = url.toLowerCase();
  return PROGRAM_URL_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferLevel(title: string, url: string): DegreeLevel | null {
  const sample = `${title} ${url}`.toLowerCase();
  if (/(phd|doctor of philosophy|doctorate|doctoral)/i.test(sample)) return "phd";
  if (/(master|msc|m.sc|mba|meng|mphil|llm|postgraduate)/i.test(sample)) return "master";
  if (/(bachelor|undergraduate|degree|ba |bsc|b.eng|llb)/i.test(sample)) return "bachelor";
  return null;
}

function inferCategory(sample: string): ProgramCategory {
  const value = sample.toLowerCase();
  if (/(medicine|medical|pharmacy|nursing|health|dentistry)/i.test(value)) return "medicine";
  if (/(law|legal|syariah|juris)/i.test(value)) return "law";
  if (/(engineering|electrical|mechanical|civil|chemical|petroleum|built environment)/i.test(value)) return "engineering";
  if (/(computer|software|data|information technology|informatics|artificial intelligence|cyber security|digital)/i.test(value)) {
    return "it";
  }
  if (/(business|finance|accounting|management|marketing|economics|banking|commerce|actuarial)/i.test(value)) {
    return "business";
  }
  if (/(design|art|music|film|media|communication|language|literature|education|humanities|psychology)/i.test(value)) {
    return "arts";
  }
  return "science";
}

async function collectProgramCandidates(website: string) {
  const allUrls = await collectSitemapUrls(website);
  const candidates = allUrls.filter((url) => {
    try {
      const target = new URL(url);
      const source = new URL(website);
      return target.hostname === source.hostname && looksLikeProgramUrl(url);
    } catch {
      return false;
    }
  });

  const results: ProgramCandidate[] = [];
  const seenTitles = new Set<string>();

  for (const url of candidates.slice(0, 800)) {
    try {
      const html = await fetchText(url);
      const title =
        extractFirstMatch(html, /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
        extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
        extractFirstMatch(html, /<title>([\s\S]*?)<\/title>/i);
      const description =
        extractFirstMatch(html, /<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
        extractFirstMatch(html, /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
      if (!title || !DEGREE_KEYWORDS.test(title) || NOISE_TITLE_KEYWORDS.test(title)) continue;
      const normalizedTitle = normalizeTitle(title);
      if (!normalizedTitle || seenTitles.has(normalizedTitle)) continue;
      const level = inferLevel(title, url);
      if (!level) continue;

      seenTitles.add(normalizedTitle);
      results.push({
        title: title.replace(/\s*\|\s*.*$/, "").trim(),
        url,
        description,
        level,
        category: inferCategory(`${title} ${description}`),
        faculty: "Official Website"
      });
    } catch {
      continue;
    }
  }

  return results;
}

function buildProgramCode(universityCode: string, title: string, index: number) {
  return sanitizeCode(`${universityCode}${title}`).slice(0, 50) || `${universityCode}P${index + 1}`;
}

function buildProgramSlug(universitySlug: string, title: string, url: string) {
  const base = slugify(`${universitySlug}-${title}`);
  return clampWithHash(base, 120, url || base);
}

async function upsertUniversities(
  dataSource: DataSource,
  profiles: Array<DirectoryUniversityProfile & { official: OfficialSiteMeta }>
) {
  const repo = dataSource.getRepository(UniversityEntity);
  const existing = await repo.find();
  const bySlug = new Map(existing.map((item) => [item.slug, item]));
  const byCode = new Map(existing.map((item) => [item.code, item]));
  const usedCodes = new Set(existing.map((item) => item.code));

  let created = 0;
  let updated = 0;
  const saved: UniversityEntity[] = [];

  for (const profile of profiles) {
    const predictedCode = getUniversityCode(profile.term.name, getShortName(profile.term.name, profile.officialWebsite), profile.officialWebsite);
    const current = bySlug.get(profile.term.slug) || null;
    const { shortName, code } = getUniqueUniversityCode(profile, usedCodes, current);
    const description = profile.official.description || profile.description || profile.term.description || profile.term.name;
    const record = repo.create({
      id: current?.id,
      slug: profile.term.slug,
      code,
      name: localizedText(profile.term.name.replace(/\s*\([^)]+\)\s*$/, "").trim()),
      shortName,
      logoUrl: profile.official.logoUrl || profile.logoUrl || current?.logoUrl || "",
      imageUrl: profile.imageUrl || current?.imageUrl || "",
      color: current?.color || hashColor(profile.officialWebsite || profile.term.slug),
      qsRank: profile.qsRank || current?.qsRank || 0,
      qsAsiaRank: profile.qsAsiaRank ?? current?.qsAsiaRank ?? null,
      location: localizedText(profile.location || profile.region || current?.location?.en || "Malaysia"),
      region: localizedText(profile.region || current?.region?.en || "Malaysia"),
      ownership: profile.ownership || current?.ownership || "private",
      institutionType: profile.institutionType || current?.institutionType || "comprehensive",
      foundedYear: current?.foundedYear || 0,
      students: current?.students || 0,
      intlStudents: current?.intlStudents || 0,
      csrCertified: true,
      description: localizedText(description),
      website: profile.officialWebsite || current?.website || "",
      admissionEmail: profile.admissionEmail || current?.admissionEmail || "",
      tuitionMinCny: current?.tuitionMinCny || 0,
      tuitionMaxCny: current?.tuitionMaxCny || 0,
      livingCostCny: current?.livingCostCny || 0,
      minIelts: current?.minIelts || 0,
      acceptNoLanguage: current?.acceptNoLanguage || false,
      facilities: current?.facilities || localizedArray([]),
      highlights: current?.highlights || localizedArray([]),
      programCount: current?.programCount || 0,
      isPublished: true
    });
    const savedItem = await repo.save(record);
    saved.push(savedItem);
    if (current) updated += 1;
    else created += 1;
  }

  return { created, updated, saved };
}

async function replaceProgramsForTopUniversities(dataSource: DataSource, universities: UniversityEntity[], warnings: string[]) {
  const repo = dataSource.getRepository(ProgramEntity);
  const universityRepo = dataSource.getRepository(UniversityEntity);
  const top = universities
    .filter((item) => item.website)
    .sort((a, b) => {
      const left = a.qsRank || Number.MAX_SAFE_INTEGER;
      const right = b.qsRank || Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .slice(0, 10);

  let importedPrograms = 0;
  let skippedPrograms = 0;

  for (const university of top) {
    const candidates = await collectProgramCandidates(university.website);
    if (!candidates.length) {
      warnings.push(`No official-website program pages discovered for ${university.shortName} (${university.website}).`);
      continue;
    }

    await repo.delete({ universityId: university.id });

    let index = 0;
    for (const candidate of candidates) {
      const slug = buildProgramSlug(university.slug, candidate.title, candidate.url);
      const exists = await repo.findOne({ where: { slug } });
      if (exists) {
        skippedPrograms += 1;
        continue;
      }

      await repo.save(
        repo.create({
          universityId: university.id,
          slug,
          code: buildProgramCode(university.code, candidate.title, index),
          name: localizedText(candidate.title),
          level: candidate.level,
          category: candidate.category,
          faculty: localizedText(candidate.faculty),
          durationYears: candidate.level === "bachelor" ? 3 : candidate.level === "master" ? 1.5 : 3,
          annualTuitionCny: 0,
          intakeMonths: [],
          languageRequirement: {
            ielts: 0,
            toefl: null,
            pte: null,
            muet: null
          },
          requirement: {
            gpa: 0,
            gaokaoRequired: false,
            huikaoRequired: false,
            note: localizedText(`Imported from official website: ${candidate.url}`)
          },
          applicationDocs: localizedArray([]),
          curriculum: localizedArray([]),
          careers: localizedArray([]),
          specializations: localizedArray([]),
          description: localizedText(candidate.description || candidate.url),
          isPublished: true
        })
      );
      index += 1;
      importedPrograms += 1;
    }

    university.programCount = await repo.count({ where: { universityId: university.id } });
    await universityRepo.save(university);
  }

  return { importedPrograms, skippedPrograms };
}

async function main() {
  loadEnvFiles();

  const dataSource = new DataSource({
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

  const summary: ImportSummary = {
    importedUniversities: 0,
    updatedUniversities: 0,
    importedPrograms: 0,
    skippedPrograms: 0,
    warnings: []
  };

  await dataSource.initialize();

  try {
    const allTerms = await fetchPagedJson<DirectoryTerm>((page) => `${DIRECTORY_API_BASE}/university?per_page=100&page=${page}`);
    const higherEdUniversityIds = await getHigherEducationUniversityIds();
    const higherEdTerms = allTerms.filter((term) => higherEdUniversityIds.has(term.id));
    const directoryProfiles = await getDirectoryUniversityProfiles(higherEdTerms);
    const officialProfiles: Array<DirectoryUniversityProfile & { official: OfficialSiteMeta }> = [];

    for (const profile of directoryProfiles) {
      if (!profile.officialWebsite) {
        summary.warnings.push(`Missing official website for ${profile.term.name}.`);
      }
      const official = profile.officialWebsite
        ? await getOfficialSiteMeta(profile.officialWebsite)
        : {
            title: "",
            description: "",
            logoUrl: "",
            homepageUrl: profile.officialWebsite
          };
      officialProfiles.push({ ...profile, official });
    }

    const universityResult = await upsertUniversities(dataSource, officialProfiles);
    summary.importedUniversities = universityResult.created;
    summary.updatedUniversities = universityResult.updated;

    const programResult = await replaceProgramsForTopUniversities(dataSource, universityResult.saved, summary.warnings);
    summary.importedPrograms = programResult.importedPrograms;
    summary.skippedPrograms = programResult.skippedPrograms;

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});