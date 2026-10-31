import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

const projectRoot = path.resolve(process.cwd());
dotenv.config({ path: path.join(projectRoot, ".env"), override: false });

const taskId = "TASK-COVERS";
const assetRoot = path.join(projectRoot, "apps", "web", "public", "assets", "static-html", "university-covers");
const manifestPath = path.join(assetRoot, "manifest.json");
const reportPath = path.join(projectRoot, "docs", "prd", "TASK-COVERS-university-gate-image-collection-report.md");
const generatedMapPath = path.join(projectRoot, "packages", "shared", "src", "university-cover-assets.ts");
const requestTimeoutMs = Number(process.env.UNIVERSITY_COVER_TIMEOUT_MS || 18000);
const maxConcurrent = Number(process.env.UNIVERSITY_COVER_CONCURRENCY || 4);
const refresh = process.argv.includes("--refresh");
const applyDb = process.argv.includes("--apply-db");

const publicCoverRoot = "/assets/static-html/university-covers";
const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const candidateLimit = 40;
const minCoverWidth = 560;
const minCoverHeight = 260;
const acceptedScore = 58;
const imageSearchLimit = Number(process.env.UNIVERSITY_COVER_IMAGE_SEARCH_LIMIT || 24);

const knownHomepages = {
  AIMST: "https://aimst.edu.my",
  AIU: "https://www.aiu.edu.my",
  AMU: "https://www.amu.edu.my",
  ASWARA: "https://www.aswara.edu.my",
  AUCMS: "https://www.aucms.edu.my",
  BERJAYA: "https://www.berjaya.edu.my",
  BINARY: "https://binary.edu.my",
  CITYU: "https://city.edu.my",
  CUCMS: "https://cyberjaya.edu.my",
  DHU: "https://www.en.dhuautomotive.edu.my",
  FCUC: "https://firstcity.edu.my",
  GLOBALNXT: "https://www.globalnxt.edu.my",
  HELP: "https://help.edu.my",
  IMU: "https://www.imu.edu.my",
  IBS: "https://www.ibs.edu.my",
  INCEIF: "https://www.inceif.edu.my",
  INSANIAH: "https://unishams.edu.my",
  IPG: "https://www.moe.gov.my/en/education/higher-education/institut-pendidikan-guru",
  IUCAS: "https://www.neg.edu.my/IUCAS-College",
  IUCTT: "https://newtwintech.edu.my",
  IUKL: "https://iukl.edu.my",
  IUMW: "https://www.umwales.edu.my",
  KDU: "https://www.uow.edu.my",
  KLMUC: "https://www.unitar.my/uuckl",
  KPJ: "https://kpju.edu.my",
  KUIM: "https://www.unimel.edu.my",
  KUIS: "https://www.uis.edu.my",
  KUISAS: "https://www.usas.edu.my",
  LINTON: "https://www.linton.edu.my",
  LUC: "https://www.lincoln.edu.my",
  LUCT: "https://www.limkokwing.net",
  MAHSA: "https://mahsa.edu.my",
  MIA: "https://mia.edu.my",
  MEDIU: "https://www.mediu.edu.my",
  MIBC: "https://www.mib.edu.my",
  MPI: "https://www.pilley.edu.my",
  MISI: "https://www.misi.edu.my",
  MIU: "https://www.mila.edu.my",
  MSU: "https://www.msu.edu.my",
  NBUC: "https://www.nbuc.edu.my",
  NKL: "https://nkl.edu.my",
  OLYMPIA: "https://olympia-education.com",
  PBS: "https://putrabusinessschool.edu.my",
  PERDANA: "https://perdanauniversity.edu.my",
  PIC: "https://www.iputra.edu.my/v2",
  PPD: "https://polipd.mypolycc.edu.my/web",
  QIU: "https://qiu.edu.my",
  RAFFLES: "https://raffles-university.edu.my",
  SOUTHERN: "https://www.southern.edu.my",
  TARUC: "https://www.tarc.edu.my",
  TATI: "https://www.tatiuc.edu.my",
  UCAM: "https://ucam.edu.my",
  UCB: "https://ucbestari.edu.my",
  UCSA: "https://www.widad.edu.my",
  UCTS: "https://www.uts.edu.my",
  UMS: "https://www.ums.edu.my",
  UMT: "https://www.umt.edu.my",
  UMPSA: "https://www.umpsa.edu.my/en",
  UNIKL: "https://www.unikl.edu.my",
  UNIMY: "https://www.unimy.edu.my",
  UNIRAZAK: "https://www.unirazak.edu.my",
  UNISEL: "https://www.unisel.edu.my",
  UNITAR: "https://www.unitar.my",
  UPNM: "https://www.upnm.edu.my",
  USIM: "https://www.usim.edu.my",
  VMIUC: "https://www.vmiuc.edu.my"
};

const pathHints = [
  "",
  "/about",
  "/about-us",
  "/campus",
  "/contact",
  "/contact-us",
  "/gallery"
];

async function main() {
  const universities = await readUniversities();
  await prepareAssetRoot();
  const previous = await readPreviousManifest();
  const results = await mapConcurrent(universities, maxConcurrent, async (university, index) => {
    const result = await collectOne(university, previous);
    process.stderr.write(`[${index + 1}/${universities.length}] ${university.code} ${result.status}\n`);
    return result;
  });
  const coverMap = Object.fromEntries(
    results
      .filter((item) => item.publicPath && item.status === "downloaded")
      .map((item) => [item.code, item.publicPath])
      .sort(([a], [b]) => a.localeCompare(b))
  );

  const manifest = {
    version: 1,
    taskId,
    generatedAt: new Date().toISOString(),
    applyDb,
    assetRoot: repoPath(assetRoot),
    manifestPath: repoPath(manifestPath),
    reportPath: repoPath(reportPath),
    generatedMapPath: repoPath(generatedMapPath),
    summary: buildSummary(results),
    results
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeGeneratedMap(coverMap);
  await writeReport(manifest);

  if (applyDb) await updateDatabaseCovers(results);

  console.log(JSON.stringify({
    taskId,
    status: manifest.summary.pending === 0 ? "completed" : "completed_with_pending_items",
    total: universities.length,
    summary: manifest.summary,
    manifest: repoPath(manifestPath),
    report: repoPath(reportPath),
    generatedMap: repoPath(generatedMapPath)
  }, null, 2));
}

async function readUniversities() {
  const connection = await createConnection();
  try {
    const [rows] = await connection.query(`
      SELECT
        id,
        code,
        slug,
        shortName,
        JSON_UNQUOTE(JSON_EXTRACT(name, '$.en')) AS nameEn,
        officialWebsite,
        website,
        imageUrl
      FROM universities
      ORDER BY code ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      code: String(row.code || "").trim().toUpperCase(),
      slug: String(row.slug || "").trim(),
      shortName: String(row.shortName || "").trim(),
      nameEn: String(row.nameEn || "").trim(),
      officialWebsite: cleanUrl(row.officialWebsite),
      website: cleanUrl(row.website),
      imageUrl: cleanUrl(row.imageUrl)
    })).filter((item) => item.code);
  } finally {
    await connection.end();
  }
}

async function createConnection() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "study_malaysia"
  });
}

async function prepareAssetRoot() {
  await fs.mkdir(assetRoot, { recursive: true });
  if (!refresh) return;
  const resolved = path.resolve(assetRoot);
  const expected = path.resolve(path.join(projectRoot, "apps", "web", "public", "assets", "static-html", "university-covers"));
  if (resolved !== expected) throw new Error(`Refusing to clean unexpected directory: ${resolved}`);
  await fs.rm(assetRoot, { recursive: true, force: true });
  await fs.mkdir(assetRoot, { recursive: true });
}

async function readPreviousManifest() {
  if (refresh) return new Map();
  const manifest = await readJson(manifestPath).catch(() => null);
  const map = new Map();
  for (const result of manifest?.results || []) {
    if (result?.code && result?.publicPath && result?.status === "downloaded") {
      map.set(result.code, result);
    }
  }
  return map;
}

async function collectOne(university, previous) {
  const previousResult = previous.get(university.code);
  if (previousResult?.localPath) {
    const previousPath = path.join(projectRoot, previousResult.localPath);
    const stats = await fs.stat(previousPath).catch(() => null);
    if (stats?.isFile() && stats.size > 0) return { ...previousResult, reused: true };
  }

  const pageUrls = await discoverSourcePages(university);
  const candidates = [];
  for (const pageUrl of pageUrls) {
    candidates.push(...await discoverCandidatesFromPage(pageUrl, university));
  }
  candidates.push(...await discoverImageSearchCandidates(university, pageUrls));

  const downloaded = await downloadBestCandidate(university, uniqueCandidates(candidates));
  if (downloaded.result) return downloaded.result;

  return {
    code: university.code,
    slug: university.slug,
    nameEn: university.nameEn,
    status: pageUrls.length ? "needs-cover-review" : "needs-domain",
    statusMessageZh: pageUrls.length
      ? "已尝试官网候选页面，但未找到满足校门/校园主图口径与尺寸要求的图片。"
      : "数据库和候选表都没有可用官网，需人工确认官网后重新采集。",
    publicPath: "",
    localPath: "",
    sourceUrl: "",
    sourcePageUrl: "",
    width: null,
    height: null,
    mimeType: "",
    sizeBytes: 0,
    sha256: "",
    pageUrls,
    attempts: downloaded.attempts.length
      ? downloaded.attempts
      : candidates.slice(0, 16).map((item) => ({ url: item.url, score: item.score, reason: item.reason }))
  };
}

async function discoverSourcePages(university) {
  const roots = homepageUrls(university);
  const pages = new Set();
  for (const root of roots.slice(0, 2)) {
    const parsed = safeUrl(root);
    if (!parsed) continue;
    for (const hint of pathHints) {
      pages.add(new URL(hint, parsed.origin).toString());
    }
    const html = await fetchHtml(root).catch(() => "");
    for (const link of extractRelevantLinks(html, root).slice(0, 4)) pages.add(link);
  }
  return [...pages].slice(0, 10);
}

function homepageUrls(university) {
  const urls = [
    university.officialWebsite,
    university.website,
    knownHomepages[university.code]
  ].filter(isExternalUrl);

  const out = [];
  for (const url of urls) {
    out.push(url);
  }
  return uniqueStrings(out);
}

async function discoverCandidatesFromPage(pageUrl, university) {
  const html = await fetchHtml(pageUrl).catch(() => "");
  if (!html) return [];
  const baseUrl = pageUrl;
  return [
    ...extractImageTagCandidates(html, baseUrl, university),
    ...extractMetaImageCandidates(html, baseUrl, university),
    ...extractCssUrlCandidates(html, baseUrl, university)
  ].map((item) => ({ ...item, sourcePageUrl: baseUrl }));
}

async function fetchHtml(url) {
  const response = await fetchWithTimeout(url, {
    headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
    redirect: "follow"
  });
  if (!response.ok) return "";
  const contentType = response.headers.get("content-type") || "";
  if (!/html|xml/i.test(contentType)) return "";
  return response.text();
}

function extractRelevantLinks(html, baseUrl) {
  const out = [];
  const pattern = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html || ""))) {
    const href = match[1] || match[2] || match[3] || "";
    const text = stripTags(match[4]);
    const context = `${href} ${text}`.toLowerCase();
    if (!/(gate|entrance|campus|about|contact|location|gallery|virtual|tour|visit|facilit|building|kampus|pintu|gerbang)/i.test(context)) continue;
    const url = absolutize(href, baseUrl);
    if (!url || !sameOrigin(url, baseUrl)) continue;
    out.push(url);
  }
  return uniqueStrings(out);
}

function extractImageTagCandidates(html, baseUrl, university) {
  const out = [];
  const tagPattern = /<(img|source)\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    const attrs = parseAttributes(match[0]);
    const context = compact([
      attrs.get("alt"),
      attrs.get("title"),
      attrs.get("class"),
      attrs.get("id"),
      attrs.get("aria-label"),
      attrs.get("data-name"),
      html.slice(Math.max(0, match.index - 180), Math.min(html.length, tagPattern.lastIndex + 180))
    ].filter(Boolean).join(" "));
    const urls = [
      attrs.get("src"),
      attrs.get("data-src"),
      attrs.get("data-lazy-src"),
      attrs.get("data-original"),
      attrs.get("data-bg"),
      ...parseSrcset(attrs.get("srcset")),
      ...parseSrcset(attrs.get("data-srcset"))
    ].filter(Boolean);
    for (const rawUrl of urls) {
      const url = absolutize(rawUrl, baseUrl);
      if (!url || !looksLikeRasterImageUrl(url)) continue;
      const score = 28 + scoreCoverContext(context) + scoreCoverUrl(url) + scoreUniversityToken(context, url, university);
      out.push(candidate(url, score, `html-${match[1]}:${compact(context)}`, "html-image", baseUrl));
    }
  }
  return out;
}

function extractMetaImageCandidates(html, baseUrl, university) {
  const out = [];
  const tagPattern = /<meta\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    const attrs = parseAttributes(match[0]);
    const key = String(attrs.get("property") || attrs.get("name") || "").toLowerCase();
    if (!/(og:image|twitter:image|image|thumbnail)/.test(key)) continue;
    const url = absolutize(attrs.get("content"), baseUrl);
    if (!url || !looksLikeRasterImageUrl(url)) continue;
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
    const context = `${key} ${stripTags(title)}`;
    const score = 35 + scoreCoverContext(context) + scoreCoverUrl(url) + scoreUniversityToken(context, url, university);
    out.push(candidate(url, score, `meta:${compact(context)}`, "meta-image", baseUrl));
  }
  return out;
}

function extractCssUrlCandidates(html, baseUrl, university) {
  const out = [];
  const cssUrlPattern = /url\((["']?)(.*?)\1\)/gi;
  let match;
  while ((match = cssUrlPattern.exec(html))) {
    const raw = decodeCssUrl(match[2]);
    const url = absolutize(raw, baseUrl);
    if (!url || !looksLikeRasterImageUrl(url)) continue;
    const context = html.slice(Math.max(0, match.index - 180), Math.min(html.length, match.index + 180));
    const score = 22 + scoreCoverContext(context) + scoreCoverUrl(url) + scoreUniversityToken(context, url, university);
    if (score < acceptedScore) continue;
    out.push(candidate(url, score, `css-url:${compact(context)}`, "css-url", baseUrl));
  }
  return out;
}

async function discoverImageSearchCandidates(university, pageUrls) {
  const out = [];
  const officialHosts = officialHostCandidates(university, pageUrls);
  for (const query of buildImageSearchQueries(university, officialHosts).slice(0, 3)) {
    const results = await queryDuckDuckGoImages(query).catch(() => []);
    for (const result of results.slice(0, imageSearchLimit)) {
      const imageUrl = result.image;
      if (!imageUrl || !looksLikeRasterImageUrl(imageUrl)) continue;
      const context = `${result.title || ""} ${result.url || ""} ${imageUrl}`;
      if (isForbiddenSearchResult(context)) continue;
      const officialEvidence = hasOfficialHostEvidence(result, officialHosts);
      const likelyInstitutionHostEvidence = hasLikelyInstitutionHostEvidence(result, university);
      const wikimediaEvidence = /wikimedia|wikipedia|commons\.wikimedia/i.test(context);
      if (!officialEvidence && !likelyInstitutionHostEvidence && !wikimediaEvidence) continue;
      if (!hasCoverEvidence(`${context} ${imageUrl}`)) continue;
      const universityTokenScore = scoreUniversityToken(context, imageUrl, university);
      let score = 30 + scoreCoverContext(context) + scoreCoverUrl(imageUrl) + universityTokenScore;
      if (officialEvidence) score += 95;
      else if (likelyInstitutionHostEvidence) score += 70;
      else if (wikimediaEvidence) score += 55;
      out.push(candidate(imageUrl, score, `image-search:${compact(context)}`, "image-search", result.url || ""));
    }
  }
  return out;
}

function buildImageSearchQueries(university, officialHosts) {
  const name = university.nameEn;
  const queries = [
    `${name} main gate`,
    `${name} entrance`,
    `${name} campus entrance`
  ];
  const host = officialHosts[0];
  if (host) {
    queries.unshift(`site:${host} ${name} main gate`);
    queries.unshift(`site:${host} ${name} entrance`);
  }
  return uniqueStrings(queries);
}

async function queryDuckDuckGoImages(query) {
  const html = await fetchWithTimeout(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`, {
    headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
    redirect: "follow"
  }).then((response) => response.ok ? response.text() : "");
  const vqd = /vqd=([\d-]+)/.exec(html)?.[1] || html.match(/vqd=['"]([^'"]+)/)?.[1] || "";
  if (!vqd) return [];
  const apiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;
  const response = await fetchWithTimeout(apiUrl, {
    headers: {
      "user-agent": userAgent,
      accept: "application/json,text/javascript,*/*",
      referer: "https://duckduckgo.com/"
    },
    redirect: "follow"
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return Array.isArray(data?.results) ? data.results : [];
}

async function downloadBestCandidate(university, candidates) {
  const attempts = [];
  const sorted = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, candidateLimit);

  for (const item of sorted) {
    const downloaded = await tryDownloadCandidate(university, item).catch((error) => ({
      error: error instanceof Error ? error.message : String(error)
    }));
    attempts.push({
      url: item.url,
      score: item.score,
      reason: item.reason,
      error: downloaded?.error || "",
      width: downloaded?.width ?? null,
      height: downloaded?.height ?? null,
      mimeType: downloaded?.mimeType || ""
    });

    if (downloaded?.accepted) {
      return {
        result: {
          code: university.code,
          slug: university.slug,
          nameEn: university.nameEn,
          status: "downloaded",
          statusMessageZh: downloaded.gateEvidence
            ? "已采集到可用于院校短名单主图的校门/入口图片。"
            : "已采集到可用于院校短名单主图的官方校园图片，未能强匹配校门关键词。",
          sourceUrl: item.url,
          sourcePageUrl: item.sourcePageUrl || "",
          sourceType: item.sourceType,
          sourceReason: item.reason,
          publicPath: downloaded.publicPath,
          localPath: downloaded.localPath,
          fileName: downloaded.fileName,
          width: downloaded.width,
          height: downloaded.height,
          mimeType: downloaded.mimeType,
          sizeBytes: downloaded.sizeBytes,
          sha256: downloaded.sha256,
          gateEvidence: downloaded.gateEvidence,
          attempts
        },
        attempts
      };
    }
  }

  return { result: null, attempts };
}

async function tryDownloadCandidate(university, item) {
  if (item.score < acceptedScore) return { error: "candidate score below cover threshold" };
  const { response, buffer } = await fetchBinaryWithTimeout(item.url, {
    headers: stripEmptyHeaders({
      "user-agent": userAgent,
      accept: "image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      referer: item.sourcePageUrl || undefined
    }),
    redirect: "follow"
  });
  if (!response.ok) return { error: `HTTP ${response.status}` };
  if (buffer.length < 8_000) return { error: "image too small" };
  if (buffer.length > 10_000_000) return { error: "image file is larger than 10MB" };

  const detected = detectImage(buffer, response.headers.get("content-type") || "", item.url);
  if (!detected.mimeType || detected.mimeType === "image/svg+xml" || detected.mimeType === "image/gif") {
    return { error: "not a supported raster cover", ...detected };
  }
  if (!isDisplayQualityCover(detected, item)) {
    return { error: "cover candidate below minimum display quality", ...detected };
  }

  const sha256 = hash(buffer);
  const fileName = `${university.code.toLowerCase()}-${sanitizeName(university.slug || university.nameEn, "university")}-${sha256.slice(0, 10)}.${detected.extension}`;
  const localFile = path.join(assetRoot, fileName);
  await fs.writeFile(localFile, buffer);
  return {
    accepted: true,
    fileName,
    publicPath: `${publicCoverRoot}/${fileName}`,
    localPath: repoPath(localFile),
    sizeBytes: buffer.length,
    sha256,
    gateEvidence: hasGateEvidence(`${item.url} ${item.reason}`),
    ...detected
  };
}

function detectImage(buffer, contentType, sourceUrl) {
  const cleanType = String(contentType || "").split(";")[0].trim().toLowerCase();
  const sourceExt = extensionFromUrl(sourceUrl);
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png", ...parsePngDimensions(buffer) };
  }
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { mimeType: "image/jpeg", extension: "jpg", ...parseJpegDimensions(buffer) };
  }
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mimeType: "image/webp", extension: "webp", ...parseWebpDimensions(buffer) };
  }
  return {
    mimeType: /^image\//.test(cleanType) ? cleanType : "",
    extension: sourceExt || "bin",
    width: null,
    height: null
  };
}

function isDisplayQualityCover(image, item) {
  const width = Number(image.width || 0);
  const height = Number(image.height || 0);
  if (!width || !height) return false;
  if (width < minCoverWidth || height < minCoverHeight) return false;
  const ratio = width / height;
  if (ratio < 1.1 || ratio > 3.4) return false;
  if (/logo|favicon|icon|seal|crest|badge|sponsor|partner|award|qr|map/i.test(`${item.url} ${item.reason}`)) return false;
  if (/pool|party|red[- ]?carpet|celebrity|event|seminar|workshop|conference|convocation|graduation|student-?life/i.test(`${item.url} ${item.reason}`)) return false;
  return true;
}

function scoreCoverContext(value) {
  const text = String(value || "").toLowerCase();
  let score = 0;
  if (hasGateEvidence(text)) score += 118;
  if (/campus|kampus|building|main building|facilit|location|contact|virtual|tour|front/.test(text)) score += 48;
  if (/hero|banner|slider|carousel|cover|background|masthead/.test(text)) score += 28;
  if (/student|convocation|event|news|workshop|conference|staff|people|classroom|lab|laboratory/.test(text)) score -= 40;
  if (/pool|party|red[- ]?carpet|celebrity|seminar|graduation|visit|visiting|courtesy|delegate|delegation|chairman|admission|intake|kemasukan|pelajar|sarjana|poster|campaign|open day/.test(text)) score -= 110;
  if (/logo|favicon|icon|seal|crest|badge|sponsor|partner|award|ranking|qs|map|qr/.test(text)) score -= 80;
  return score;
}

function scoreCoverUrl(value) {
  const url = String(value || "").toLowerCase();
  let score = 0;
  if (hasGateEvidence(url)) score += 130;
  if (/campus|kampus|building|front|facilit|contact|location|tour/.test(url)) score += 42;
  if (/hero|banner|slider|carousel|cover|bg|background/.test(url)) score += 22;
  if (/logo|favicon|icon|seal|crest|badge|sponsor|partner|award|ranking|qs|map|qr/.test(url)) score -= 90;
  if (/pool|party|red[- ]?carpet|celebrity|event|seminar|workshop|conference|convocation|graduation|visit|visiting|courtesy|delegate|delegation|chairman|admission|intake|kemasukan|pelajar|sarjana|poster|campaign|open-?day/.test(url)) score -= 110;
  if (/\.(?:jpe?g|webp|png)(?:[?#]|$)/.test(url)) score += 8;
  return score;
}

function scoreUniversityToken(context, url, university) {
  const haystack = `${context} ${url}`.toLowerCase();
  const tokens = [
    university.code,
    university.shortName,
    ...university.nameEn.split(/[^a-z0-9]+/i).filter((token) => token.length > 3)
  ].map((token) => String(token || "").toLowerCase());
  return tokens.some((token) => token && haystack.includes(token)) ? 18 : 0;
}

function hasGateEvidence(value) {
  return /gate|entrance|main entrance|front entrance|signboard|pintu|gerbang|gateway|main-gate|front-gate/i.test(String(value || ""));
}

function hasCoverEvidence(value) {
  return /gate|entrance|signboard|pintu|gerbang|gateway|campus|kampus|building|facilit|location|tour|front/i.test(String(value || ""));
}

function officialHostCandidates(university, pageUrls) {
  const hosts = [
    university.officialWebsite,
    university.website,
    knownHomepages[university.code],
    ...pageUrls
  ]
    .map((value) => safeUrl(value)?.hostname.replace(/^www\./, ""))
    .filter(Boolean);
  return uniqueStrings(hosts);
}

function hasOfficialHostEvidence(result, officialHosts) {
  const values = [result.url, result.image, result.thumbnail].filter(Boolean).join(" ");
  return officialHosts.some((host) => host && values.includes(host));
}

function hasLikelyInstitutionHostEvidence(result, university) {
  const hosts = [result.url, result.image]
    .map((value) => safeUrl(value)?.hostname.replace(/^www\./, "").toLowerCase())
    .filter(Boolean);
  const code = String(university.code || "").toLowerCase();
  const slugTokens = String(university.slug || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
  return hosts.some((host) => {
    if (!host.endsWith(".edu.my") && !host.endsWith(".edu")) return false;
    return host.includes(code) || slugTokens.some((token) => host.includes(token));
  });
}

function isForbiddenSearchResult(value) {
  return /pinterest|pinimg|shutterstock|alamy|dreamstime|123rf|depositphotos|gettyimages|istockphoto|tripadvisor|foursquare|mapcarta|worldorgs|lookp|facebook\.com|instagram\.com|youtube\.com|visit|visiting|courtesy|delegate|delegation|chairman|admission|intake|kemasukan|pelajar|sarjana|poster|campaign|open-?day/i.test(String(value || ""));
}

async function updateDatabaseCovers(results) {
  const rows = results.filter((item) => item.status === "downloaded" && item.publicPath);
  if (!rows.length) return;
  const connection = await createConnection();
  try {
    for (const row of rows) {
      await connection.execute("UPDATE universities SET imageUrl = ? WHERE code = ?", [row.publicPath, row.code]);
    }
  } finally {
    await connection.end();
  }
}

function buildSummary(results) {
  const byStatus = {};
  for (const item of results) byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  return {
    total: results.length,
    downloaded: results.filter((item) => item.status === "downloaded").length,
    gateEvidence: results.filter((item) => item.status === "downloaded" && item.gateEvidence).length,
    campusFallback: results.filter((item) => item.status === "downloaded" && !item.gateEvidence).length,
    pending: results.filter((item) => item.status !== "downloaded").length,
    byStatus
  };
}

async function writeGeneratedMap(coverMap) {
  const lines = Object.entries(coverMap).map(([code, publicPath]) => `  ${JSON.stringify(code)}: ${JSON.stringify(publicPath)},`);
  const source = `// Generated by scripts/collect-university-cover-images.mjs. Do not edit by hand.

export const LOCAL_UNIVERSITY_COVER_BY_CODE: Record<string, string> = {
${lines.join("\n")}
};

export function getLocalUniversityCoverByCode(code: string | null | undefined): string {
  return LOCAL_UNIVERSITY_COVER_BY_CODE[String(code || "").trim().toUpperCase()] || "";
}
`;
  await fs.writeFile(generatedMapPath, source, "utf8");
}

async function writeReport(manifest) {
  const pending = manifest.results.filter((item) => item.status !== "downloaded");
  const rows = manifest.results.map((item) => {
    const size = item.width && item.height ? `${item.width}x${item.height}` : "-";
    const evidence = item.gateEvidence ? "校门/入口" : item.status === "downloaded" ? "校园图" : "-";
    return `| ${item.code} | ${escapeTable(item.nameEn)} | ${item.status} | ${evidence} | ${escapeTable(size)} | ${escapeTable(item.sourcePageUrl || "-")} | ${escapeTable(item.sourceUrl || "-")} | ${escapeTable(item.publicPath || "-")} |`;
  }).join("\n");
  const pendingRows = pending.length
    ? pending.map((item) => `| ${item.code} | ${escapeTable(item.nameEn)} | ${item.status} | ${escapeTable(item.statusMessageZh)} |`).join("\n")
    : "无。";

  const report = `# 119 所高校校门主图采集报告

## 摘要

- **任务编号**: ${taskId}
- **生成时间**: ${manifest.generatedAt}
- **院校总数**: ${manifest.summary.total}
- **已落地本地主图**: ${manifest.summary.downloaded}
- **其中强匹配校门/入口关键词**: ${manifest.summary.gateEvidence}
- **官方校园图兜底**: ${manifest.summary.campusFallback}
- **待人工确认**: ${manifest.summary.pending}
- **本地资源目录**: \`${manifest.assetRoot}\`
- **Manifest**: \`${manifest.manifestPath}\`
- **共享映射**: \`${manifest.generatedMapPath}\`
- **是否回写数据库**: ${manifest.applyDb ? "是" : "否"}

## 采集口径

- 主图优先使用院校官网页面中的校门、入口、门头、signboard、front gate、main entrance、pintu、gerbang 等候选图。
- 若官网未暴露明确校门图，则使用官网可核验的 campus / building / hero / gallery 图作为临时主图，manifest 中以 \`gateEvidence=false\` 标明。
- 仅落地宽度不少于 ${minCoverWidth}px、高度不少于 ${minCoverHeight}px、比例适合短名单卡片的 PNG/JPG/WebP。
- 用户端仍通过本地 \`/assets/static-html/university-covers/\` 路径加载，不在运行时请求外部图片。

## 明细

| Code | 学校 | 状态 | 证据 | 尺寸 | 来源页面 | 图片来源 | 本地路径 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## 待人工确认项

${pending.length ? "| Code | 学校 | 状态 | 说明 |\n| --- | --- | --- | --- |\n" + pendingRows : pendingRows}

## Notion 更新说明

本轮没有可写入的真实 Notion 页面 ID；已生成本地中文报告和 manifest，后续可由 Notion 同步流程写回任务页。
`;

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, "utf8");
}

function candidate(url, score, reason, sourceType, sourcePageUrl) {
  return { url, score, reason, sourceType, sourcePageUrl };
}

function uniqueCandidates(candidates) {
  const seen = new Map();
  for (const item of candidates) {
    const normalized = normalizeCandidateUrl(item.url);
    if (!normalized) continue;
    const existing = seen.get(normalized);
    if (!existing || item.score > existing.score) seen.set(normalized, { ...item, url: normalized });
  }
  return [...seen.values()];
}

function normalizeCandidateUrl(value) {
  const url = safeUrl(value);
  if (!url) return "";
  url.hash = "";
  return url.toString();
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text || text === "#") return "";
  return text;
}

function isExternalUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function looksLikeRasterImageUrl(value) {
  const url = String(value || "");
  if (!url || /^data:/i.test(url) || /\.svg(?:[?#]|$)/i.test(url)) return false;
  if (/\.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(url)) return true;
  return /image|photo|campus|gate|entrance|hero|banner|slider|gallery|building|uploads|media|wp-content/i.test(url);
}

function sameOrigin(a, b) {
  const left = safeUrl(a);
  const right = safeUrl(b);
  return Boolean(left && right && left.origin === right.origin);
}

function safeUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
}

function absolutize(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("javascript:") || raw.startsWith("mailto:")) return "";
  try {
    return new URL(decodeHtml(raw), baseUrl).toString();
  } catch {
    return "";
  }
}

function parseAttributes(tag) {
  const attrs = new Map();
  const pattern = /\b([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = pattern.exec(tag))) {
    attrs.set(match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attrs;
}

function parseSrcset(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function parsePngDimensions(buffer) {
  if (buffer.length < 24) return { width: null, height: null };
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseJpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < buffer.length) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return { width: null, height: null };
}

function parseWebpDimensions(buffer) {
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X" && buffer.length >= 30) {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
    };
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  return { width: null, height: null };
}

function extensionFromUrl(value) {
  const pathname = safeUrl(value)?.pathname || "";
  const ext = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "";
  if (ext === "jpeg") return "jpg";
  if (["png", "jpg", "webp"].includes(ext)) return ext;
  return "";
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "));
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function decodeCssUrl(value) {
  return decodeHtml(String(value || "").trim().replace(/^["']|["']$/g, ""));
}

function stripEmptyHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value != null && value !== ""));
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function sanitizeName(value, fallback) {
  const name = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  return name || fallback;
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
}

function hash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function repoPath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function escapeTable(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBinaryWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 10_000_000) return { response, buffer: Buffer.alloc(0) };
    const buffer = Buffer.from(await response.arrayBuffer());
    return { response, buffer };
  } finally {
    clearTimeout(timer);
  }
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
