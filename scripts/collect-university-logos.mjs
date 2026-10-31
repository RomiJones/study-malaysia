import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

const projectRoot = path.resolve(process.cwd());
dotenv.config({ path: path.join(projectRoot, ".env"), override: false });

const taskId = "TASK-LOGOS";
const assetRoot = path.join(projectRoot, "apps", "web", "public", "assets", "static-html", "university-logos");
const manifestPath = path.join(assetRoot, "manifest.json");
const reportPath = path.join(projectRoot, "docs", "prd", "TASK-LOGOS-university-logo-collection-report.md");
const generatedMapPath = path.join(projectRoot, "packages", "shared", "src", "university-logo-assets.ts");
const requestTimeoutMs = Number(process.env.UNIVERSITY_LOGO_TIMEOUT_MS || 18000);
const maxConcurrent = Number(process.env.UNIVERSITY_LOGO_CONCURRENCY || 5);
const applyDb = process.argv.includes("--apply-db");
const refresh = process.argv.includes("--refresh");

const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const publicLogoRoot = "/assets/static-html/university-logos";
const highQualityMinWidth = 120;
const highQualityMinHeight = 80;
const strongCandidateScore = 70;
const candidateLimit = 28;
const nonBrandTextPattern = /partner|sponsor|client|payment|social|facebook|instagram|twitter|youtube|ranking|qs|award|conference|event|times higher education|the impact/i;
const nonBrandUrlPattern = /partner|sponsor|payment|social|facebook|instagram|twitter|youtube|font-awesome|webfonts|templately|elementor\/assets|plugin|plugins|swiper|landmark|search|qs_|qs-|qs-star|logoqs|ranking|award|conference|event|tnb-logo|times-higher-education|the-impact|the_impact|the%20impact|impact-20\d{2}|impact_20\d{2}|iso-logo|setara|certification|certified|accreditation|study-at/i;
const knownNonBrandAssetPattern = /font-awesome|webfonts|templately|elementor\/assets|wp-content\/plugins|fa-brands|fa-solid|i-search|search|landmark|swiper|campus|tiles\/|apel-a-logo|qs_|qs-|qs-star|logoqs|ranking|award|conference|event|tnb-logo|times-higher-education|the-impact|the_impact|the%20impact|impact-20\d{2}|impact_20\d{2}|iso-logo|setara|certification|certified|accreditation|study-at/i;

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

const directLogoCandidates = {
  APU: ["https://www.apu.edu.my/themes/custom/apu/logo.svg"],
  ASB: ["https://asb.edu.my/wp-content/uploads/2022/12/logo.svg"],
  AUCMS: [{
    url: "https://upload.wikimedia.org/wikipedia/ms/5/5d/Aucms.jpg",
    sourceType: "curated-wikimedia-logo",
    reason: "curated-wikimedia-logo",
    sourcePageUrl: "https://ms.wikipedia.org/wiki/Kolej_Universiti_Sains_Perubatan_Allianze"
  }],
  BERJAYA: ["https://www.berjaya.edu.my/university/wp-content/uploads/2019/02/buc-logo-edited-reg.png"],
  CRESCENDO: ["https://www.crescendo.edu.my/assets_user/img/crescendo_2024-06-26341.png"],
  CUCMS: ["https://cyberjaya.edu.my/wp-content/uploads/2022/10/University-of-Cyberjaya-Logo.png"],
  DHU: ["https://www.en.dhuautomotive.edu.my/wp-content/uploads/2018/12/DHU_Official_Logo.png"],
  IIUM: ["https://www.iium.edu.my/v2/wp-content/uploads/2024/02/Official_Logo_IIUM_Tawhidic_Kanan_FullCMYK.png"],
  IBS: ["https://www.ibs.edu.my/wp-content/uploads/2022/10/logo-450px-ibs.png"],
  INCEIF: [{
    url: "https://images.seeklogo.com/logo-png/28/1/inceif-university-logo-png_seeklogo-285188.png",
    sourceType: "curated-logo-repository",
    reason: "curated-logo-repository",
    sourcePageUrl: "https://seeklogo.com/vector-logo/285188/inceif-university"
  }],
  INTI: ["https://newinti.edu.my/wp-content/uploads/2025/12/INTI-40.png"],
  IUCAS: ["https://www.neg.edu.my/imgs/logos/IUCAS_wt.png"],
  IUCTT: ["https://newtwintech.edu.my/wp-content/uploads/2022/12/cropped-Twintech-Logo_Colour_Long.png"],
  IUMW: ["https://www.umwales.edu.my/wp-content/uploads/2024/04/UM-Wales-Logo.png"],
  KDU: ["https://www.uow.edu.my/wp-content/themes/kdu/img/UOWMKDU-logb.png"],
  KLMUC: ["https://www.unitar.my/wp-content/uploads/2021/06/UNITAR-Logo.svg"],
  INSANIAH: ["https://unishams.edu.my/media/yootheme/cache/bc/LOGO%20UniSHAMS%20FULL%201-bc9e6eb4.png"],
  LELC: ["https://limkokwing.net/wp-content/uploads/2024/10/LKW-Logo.svg"],
  MIA: ["https://mia.edu.my/wp-content/uploads/2025/05/mia.jpg"],
  MIBC: ["https://www.mib.edu.my/wp-content/uploads/2024/06/logo-2.png"],
  MISI: ["https://www.misi.edu.my/wp-content/themes/misi-theme/misi/assets/img/misi-university-logo.svg"],
  MPI: ["https://www.pilley.edu.my/wp-content/uploads/2018/04/lighthouse-logo-1.png"],
  MSU: ["https://www.msu.edu.my/files/logo_msu.webp"],
  NKL: ["https://nkl.edu.my/wp-content/uploads/2023/09/NKL-Logo-mandarin.png"],
  OLYMPIA: ["https://olympia-education.com/assets/logo/olympia-land.png"],
  PIC: ["https://www.iputra.edu.my/v2/images/logo_iputra_university_v2.png"],
  PPD: ["https://polipd.mypolycc.edu.my/web/images/logo_PPD_2015.png"],
  PSDC: ["https://www.psdc.org.my/assets/images/logo-blue.png"],
  RIYAZ: [{
    url: "https://www.myuni.com.my/assets/img/uni-logo/697031f929397.jpg",
    sourceType: "curated-education-portal-logo",
    reason: "curated-education-portal-logo",
    sourcePageUrl: "https://www.myuni.com.my/"
  }],
  SAITO: ["https://saito.edu.my/wp-content/uploads/2025/04/main-logo.png"],
  SEGI: ["https://university.segi.edu.my/wp-content/uploads/2023/09/SEGi-University-logo.svg"],
  UCSA: ["https://widad.edu.my/assets/images/logo/rwuc-large.png"],
  UMPSA: ["https://www.umpsa.edu.my/img/logo-umpsa.png"],
  UOC: ["https://cyberjaya.edu.my/wp-content/uploads/2022/10/University-of-Cyberjaya-Logo.png"],
  USM: ["https://www.usm.my/templates/yootheme/cache/2e/USM%20APEX-Ver-R-2e18fddc.webp"],
  UTM: ["https://www.utm.my/wp-content/uploads/2020/12/cropped-logo-utm-512.png"]
};

const preparedLocalLogoCandidates = {
  PSDC: [{
    url: "https://www.psdc.org.my/assets/images/logo-blue.png",
    localSourcePath: path.join(projectRoot, "scripts", "assets", "university-logo-sources", "psdc-penang-skills-development-centre.png"),
    sourceType: "prepared-local-logo",
    reason: "prepared-local-logo:official-site-certificate-chain-workaround",
    sourcePageUrl: "https://www.psdc.org.my/"
  }],
  VMIUC: [{
    url: "https://web.archive.org/web/20140411235131id_/http://www.vmiuc.edu.my/website2/doc/File/Application_Form.pdf",
    localSourcePath: path.join(projectRoot, "scripts", "assets", "university-logo-sources", "vmiuc-vinayaka-mission-international-university-college.png"),
    sourceType: "prepared-local-logo",
    reason: "prepared-local-logo:official-archive-pdf-crop",
    sourcePageUrl: "https://web.archive.org/web/20140411235131/http://www.vmiuc.edu.my/website2/doc/File/Application_Form.pdf"
  }]
};

async function main() {
  const universities = await readUniversities();
  await prepareAssetRoot();
  const previous = await readPreviousManifest();
  const results = await mapConcurrent(universities, maxConcurrent, (university) => collectOne(university, previous));
  const logoMap = Object.fromEntries(
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

  await fs.mkdir(assetRoot, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeGeneratedMap(logoMap);
  await writeReport(manifest);

  if (applyDb) {
    await updateDatabaseLogos(results);
  }

  console.log(JSON.stringify({
    taskId,
    status: manifest.summary.downloaded === universities.length ? "completed" : "completed_with_pending_items",
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
        logoUrl,
        officialWebsite,
        website
      FROM universities
      ORDER BY code ASC
    `);
    return rows.map((row) => ({
      id: row.id,
      code: String(row.code || "").trim().toUpperCase(),
      slug: String(row.slug || "").trim(),
      shortName: String(row.shortName || "").trim(),
      nameEn: String(row.nameEn || "").trim(),
      logoUrl: cleanUrl(row.logoUrl),
      officialWebsite: cleanUrl(row.officialWebsite),
      website: cleanUrl(row.website)
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
  const expected = path.resolve(path.join(projectRoot, "apps", "web", "public", "assets", "static-html", "university-logos"));
  if (resolved !== expected) {
    throw new Error(`Refusing to clean unexpected directory: ${resolved}`);
  }
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
    if (stats?.isFile() && stats.size > 0) {
      return {
        ...previousResult,
        reused: true
      };
    }
  }

  const candidates = uniqueCandidates(seedCandidates(university));
  const homepageCandidates = homepageUrls(university);
  for (const homepage of homepageCandidates) {
    candidates.push(...rootIconCandidates(homepage));
    const discovered = await discoverCandidatesFromHomepage(homepage, university);
    candidates.push(...discovered);
  }

  const downloaded = await downloadBestCandidate(university, uniqueCandidates(candidates));
  if (downloaded.result) return downloaded.result;

  return {
    code: university.code,
    slug: university.slug,
    nameEn: university.nameEn,
    homepageCandidates,
    status: homepageCandidates.length ? "needs-logo-review" : "needs-domain",
    statusMessageZh: homepageCandidates.length
      ? "已尝试官网候选，但未找到满足尺寸或格式要求的 logo。"
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
    attempts: downloaded.attempts.length
      ? downloaded.attempts
      : candidates.slice(0, 12).map((item) => ({ url: item.url, score: item.score, reason: item.reason }))
  };
}

function seedCandidates(university) {
  const seeds = [];
  for (const item of directLogoCandidates[university.code] || []) {
    if (typeof item === "string") {
      seeds.push(candidate(item, 180, "direct-known-logo", "direct", ""));
    } else if (item?.url) {
      seeds.push(candidate(
        item.url,
        item.score || 170,
        item.reason || "direct-known-logo",
        item.sourceType || "direct",
        item.sourcePageUrl || "",
        "",
        item
      ));
    }
  }
  for (const item of preparedLocalLogoCandidates[university.code] || []) {
    seeds.push(candidate(
      item.url,
      item.score || 175,
      item.reason || "prepared-local-logo",
      item.sourceType || "prepared-local-logo",
      item.sourcePageUrl || "",
      "",
      item
    ));
  }
  if (isExternalUrl(university.logoUrl)) {
    seeds.push(candidate(university.logoUrl, 125, "existing-db-logo", "db-logo", ""));
  }
  return seeds;
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
    const parsed = safeUrl(url);
    if (parsed?.protocol === "https:") {
      out.push(`http://${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`);
    }
  }
  return uniqueStrings(out);
}

function rootIconCandidates(homepageUrl) {
  const parsed = safeUrl(homepageUrl);
  if (!parsed) return [];
  const origin = parsed.origin;
  return [
    ["/apple-touch-icon.png", 66],
    ["/apple-touch-icon-precomposed.png", 64],
    ["/android-chrome-512x512.png", 64],
    ["/android-chrome-192x192.png", 60],
    ["/favicon-512x512.png", 58],
    ["/favicon-192x192.png", 56],
    ["/favicon.png", 52]
  ].map(([suffix, score]) => candidate(`${origin}${suffix}`, Number(score), `root-icon:${suffix}`, "root-icon", homepageUrl))
    .concat(candidate(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=256`, 50, `domain-favicon:${parsed.hostname}`, "domain-favicon", homepageUrl));
}

async function discoverCandidatesFromHomepage(homepageUrl, university) {
  const response = await fetchWithTimeout(homepageUrl, {
    headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
    redirect: "follow"
  }).catch(() => null);
  if (!response || !response.ok) return [];
  const contentType = response.headers.get("content-type") || "";
  if (!/html|xml/i.test(contentType)) return [];
  const html = await response.text().catch(() => "");
  if (!html) return [];

  const baseUrl = response.url || homepageUrl;
  const candidates = [
    ...extractInlineSvgLogoCandidates(html, baseUrl, university),
    ...extractJsonLdLogoCandidates(html, baseUrl),
    ...extractImageTagCandidates(html, baseUrl, university),
    ...extractLinkIconCandidates(html, baseUrl),
    ...extractMetaImageCandidates(html, baseUrl),
    ...extractCssUrlCandidates(html, baseUrl, university)
  ];

  const manifestUrls = extractManifestUrls(html, baseUrl);
  for (const manifestUrl of manifestUrls.slice(0, 3)) {
    candidates.push(...await extractWebManifestCandidates(manifestUrl));
  }

  return candidates.map((item) => ({
    ...item,
    sourcePageUrl: baseUrl
  }));
}

function extractImageTagCandidates(html, baseUrl, university) {
  const out = [];
  const tagPattern = /<(img|source)\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    const attrs = parseAttributes(match[0]);
    const haystack = [
      attrs.get("alt"),
      attrs.get("title"),
      attrs.get("class"),
      attrs.get("id"),
      attrs.get("aria-label"),
      attrs.get("data-name")
    ].filter(Boolean).join(" ").toLowerCase();
    const urls = [
      attrs.get("src"),
      attrs.get("data-src"),
      attrs.get("data-lazy-src"),
      attrs.get("data-original"),
      attrs.get("data-logo"),
      ...parseSrcset(attrs.get("srcset")),
      ...parseSrcset(attrs.get("data-srcset"))
    ].filter(Boolean);
    for (const rawUrl of urls) {
      const url = absolutize(rawUrl, baseUrl);
      if (!url || !looksLikeImageUrl(url)) continue;
      let score = 30 + scoreLogoText(haystack) + scoreLogoUrl(url);
      if (containsUniversityToken(haystack, university)) score += 18;
      if (containsUniversityToken(url, university)) score += 24;
      out.push(candidate(url, score, `html-${match[1]}:${compact(haystack)}`, "html-image", baseUrl));
    }
  }
  return out;
}

function extractLinkIconCandidates(html, baseUrl) {
  const out = [];
  const tagPattern = /<link\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    const attrs = parseAttributes(match[0]);
    const rel = String(attrs.get("rel") || "").toLowerCase();
    const href = attrs.get("href");
    if (!href) continue;
    const url = absolutize(href, baseUrl);
    if (!url || !looksLikeImageUrl(url)) continue;
    if (/apple-touch-icon/.test(rel)) out.push(candidate(url, 58 + scoreLogoUrl(url), `link:${rel}`, "link-icon", baseUrl));
    else if (/mask-icon/.test(rel)) out.push(candidate(url, 62 + scoreLogoUrl(url), `link:${rel}`, "link-icon", baseUrl));
    else if (/\bicon\b/.test(rel)) out.push(candidate(url, 35 + scoreLogoUrl(url), `link:${rel}`, "link-icon", baseUrl));
  }
  return out;
}

function extractMetaImageCandidates(html, baseUrl) {
  const out = [];
  const tagPattern = /<meta\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    const attrs = parseAttributes(match[0]);
    const key = String(attrs.get("property") || attrs.get("name") || "").toLowerCase();
    if (!/(og:image|twitter:image|image|thumbnail)/.test(key)) continue;
    const url = absolutize(attrs.get("content"), baseUrl);
    if (!url || !looksLikeImageUrl(url)) continue;
    out.push(candidate(url, 18 + scoreLogoUrl(url), `meta:${key}`, "meta-image", baseUrl));
  }
  return out;
}

function extractInlineSvgLogoCandidates(html, baseUrl, university) {
  const out = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const attrs = match[1];
    const content = match[2];
    if (!/\bclass=(["'])(?=[^"']*\blogo\b)[^"']*\1/i.test(attrs)) continue;
    const svg = content.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0] || "";
    if (!svg) continue;
    const context = html.slice(Math.max(0, match.index - 120), Math.min(html.length, anchorPattern.lastIndex + 120)).toLowerCase();
    let score = 120 + scoreLogoText(context);
    if (containsUniversityToken(context, university)) score += 18;
    out.push(inlineSvgCandidate(svg, score, "inline-svg:logo-anchor", baseUrl));
  }
  return out;
}

function extractJsonLdLogoCandidates(html, baseUrl) {
  const out = [];
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptPattern.exec(html))) {
    const json = decodeHtml(match[1]).trim();
    if (!json) continue;
    const parsed = parseJson(json);
    const values = parsed ? findLogoValues(parsed) : [];
    for (const value of values) {
      const url = absolutize(value, baseUrl);
      if (url && looksLikeImageUrl(url)) out.push(candidate(url, 105 + scoreLogoUrl(url), "json-ld-logo", "json-ld", baseUrl));
    }
  }
  return out;
}

function extractCssUrlCandidates(html, baseUrl, university) {
  const out = [];
  const cssUrlPattern = /url\((["']?)(.*?)\1\)/gi;
  let match;
  while ((match = cssUrlPattern.exec(html))) {
    const raw = decodeCssUrl(match[2]);
    const context = html.slice(Math.max(0, match.index - 120), match.index + 120).toLowerCase();
    if (!scoreLogoText(context) && !scoreLogoUrl(raw) && !containsUniversityToken(context, university)) continue;
    const url = absolutize(raw, baseUrl);
    if (url && looksLikeImageUrl(url)) {
      out.push(candidate(url, 22 + scoreLogoText(context) + scoreLogoUrl(url), "css-url-logo-context", "css-url", baseUrl));
    }
  }
  return out;
}

function extractManifestUrls(html, baseUrl) {
  const out = [];
  const tagPattern = /<link\b[^>]*>/gi;
  let match;
  while ((match = tagPattern.exec(html))) {
    const attrs = parseAttributes(match[0]);
    const rel = String(attrs.get("rel") || "").toLowerCase();
    if (!/\bmanifest\b/.test(rel)) continue;
    const url = absolutize(attrs.get("href"), baseUrl);
    if (url) out.push(url);
  }
  return uniqueStrings(out);
}

async function extractWebManifestCandidates(manifestUrl) {
  const response = await fetchWithTimeout(manifestUrl, {
    headers: { "user-agent": userAgent, accept: "application/json,text/plain,*/*" },
    redirect: "follow"
  }).catch(() => null);
  if (!response?.ok) return [];
  const json = await response.json().catch(() => null);
  const icons = Array.isArray(json?.icons) ? json.icons : [];
  return icons
    .map((icon) => absolutize(icon.src, response.url || manifestUrl))
    .filter((url) => url && looksLikeImageUrl(url))
    .map((url) => candidate(url, 42 + scoreLogoUrl(url), "web-manifest-icon", "web-manifest", response.url || manifestUrl));
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
          statusMessageZh: "已采集到可用于院校列表展示的本地 logo。",
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
          attempts
        },
        attempts
      };
    }
  }

  return { result: null, attempts };
}

async function tryDownloadCandidate(university, item) {
  if (!hasStrongLogoEvidence(item)) return { error: "candidate does not have strong logo evidence" };
  let buffer;
  let contentType = "";
  if (item.inlineSvg) {
    buffer = Buffer.from(item.inlineSvg, "utf8");
    contentType = "image/svg+xml";
  } else if (item.localSourcePath) {
    buffer = await fs.readFile(item.localSourcePath);
    contentType = contentTypeFromPath(item.localSourcePath);
  } else {
    const response = await fetchWithTimeout(item.url, {
      headers: stripEmptyHeaders({
        "user-agent": userAgent,
        accept: "image/webp,image/svg+xml,image/png,image/jpeg,image/gif,image/*,*/*;q=0.8",
        referer: item.sourcePageUrl || undefined
      }),
      redirect: "follow"
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    contentType = response.headers.get("content-type") || "";
  }
  if (buffer.length < 80) return { error: "image too small" };
  if (buffer.length > 4_000_000) return { error: "image file is larger than 4MB" };

  const detected = detectImage(buffer, contentType, item.url);
  if (!detected.mimeType) return { error: "not a supported image" };
  const highQuality = isHighQuality(detected, item);
  if (!highQuality) {
    return {
      error: "logo candidate below minimum display quality",
      ...detected
    };
  }

  const sha256 = hash(buffer);
  const fileName = `${university.code.toLowerCase()}-${sanitizeName(university.slug || university.nameEn, "university")}-${sha256.slice(0, 10)}.${detected.extension}`;
  const localFile = path.join(assetRoot, fileName);
  await fs.writeFile(localFile, buffer);
  return {
    accepted: true,
    fileName,
    publicPath: `${publicLogoRoot}/${fileName}`,
    localPath: repoPath(localFile),
    sizeBytes: buffer.length,
    sha256,
    ...detected
  };
}

function detectImage(buffer, contentType, sourceUrl) {
  const cleanType = String(contentType || "").split(";")[0].trim().toLowerCase();
  const sourceExt = extensionFromUrl(sourceUrl);
  const textStart = buffer.slice(0, 512).toString("utf8").trimStart();
  if (cleanType === "image/svg+xml" || sourceExt === "svg" || textStart.startsWith("<svg") || textStart.includes("<svg")) {
    const svg = buffer.toString("utf8");
    const dimensions = parseSvgDimensions(svg);
    return {
      mimeType: "image/svg+xml",
      extension: "svg",
      width: dimensions.width,
      height: dimensions.height,
      vector: true
    };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png", ...parsePngDimensions(buffer), vector: false };
  }
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { mimeType: "image/jpeg", extension: "jpg", ...parseJpegDimensions(buffer), vector: false };
  }
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mimeType: "image/webp", extension: "webp", ...parseWebpDimensions(buffer), vector: false };
  }
  if (buffer.subarray(0, 6).toString("ascii").startsWith("GIF")) {
    return { mimeType: "image/gif", extension: "gif", ...parseGifDimensions(buffer), vector: false };
  }
  return {
    mimeType: /^image\//.test(cleanType) ? cleanType : "",
    extension: sourceExt || "bin",
    width: null,
    height: null,
    vector: false
  };
}

function isHighQuality(image, item) {
  if (image.vector) {
    const width = Number(image.width || 0);
    const height = Number(image.height || 0);
    if (item.sourceType === "inline-svg") {
      if (!width || !height) return false;
      return width >= 80 && height >= 30;
    }
    if (!width && !height) return item.score >= 100 && !isKnownNonBrandAsset(item.url);
    return width >= 80 || height >= 60 || item.score >= 100;
  }
  const width = Number(image.width || 0);
  const height = Number(image.height || 0);
  if (!width || !height) return false;
  if (width >= highQualityMinWidth && height >= highQualityMinHeight) return true;
  if (width >= 160 && height >= 40 && hasStrongLogoEvidence(item)) return true;
  if (width >= 120 && height >= 50 && hasStrongLogoEvidence(item)) return true;
  if (width >= 96 && height >= 96) return true;
  return false;
}

async function updateDatabaseLogos(results) {
  const rows = results.filter((item) => item.status === "downloaded" && item.publicPath);
  if (!rows.length) return;
  const connection = await createConnection();
  try {
    for (const row of rows) {
      await connection.execute("UPDATE universities SET logoUrl = ? WHERE code = ?", [row.publicPath, row.code]);
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
    pending: results.filter((item) => item.status !== "downloaded").length,
    svgOrVector: results.filter((item) => item.status === "downloaded" && item.mimeType === "image/svg+xml").length,
    raster: results.filter((item) => item.status === "downloaded" && item.mimeType !== "image/svg+xml").length,
    domainFallback: results.filter((item) => item.status === "downloaded" && item.sourceType === "domain-favicon").length,
    byStatus
  };
}

async function writeGeneratedMap(logoMap) {
  const lines = Object.entries(logoMap).map(([code, publicPath]) => `  ${JSON.stringify(code)}: ${JSON.stringify(publicPath)},`);
  const source = `// Generated by scripts/collect-university-logos.mjs. Do not edit by hand.

export const LOCAL_UNIVERSITY_LOGO_BY_CODE: Record<string, string> = {
${lines.join("\n")}
};

export function getLocalUniversityLogoByCode(code: string | null | undefined): string {
  return LOCAL_UNIVERSITY_LOGO_BY_CODE[String(code || "").trim().toUpperCase()] || "";
}
`;
  await fs.writeFile(generatedMapPath, source, "utf8");
}

async function writeReport(manifest) {
  const pending = manifest.results.filter((item) => item.status !== "downloaded");
  const rows = manifest.results.map((item) => {
    const size = item.width && item.height ? `${item.width}x${item.height}` : item.mimeType === "image/svg+xml" ? "vector" : "-";
    return `| ${item.code} | ${escapeTable(item.nameEn)} | ${item.status} | ${escapeTable(size)} | ${escapeTable(item.sourceUrl || "-")} | ${escapeTable(item.publicPath || "-")} |`;
  }).join("\n");
  const pendingRows = pending.length
    ? pending.map((item) => `| ${item.code} | ${escapeTable(item.nameEn)} | ${item.status} | ${escapeTable(item.statusMessageZh)} |`).join("\n")
    : "无。";

  const report = `# 119 所高校 Logo 采集报告

## 摘要

- **任务编号**: ${taskId}
- **生成时间**: ${manifest.generatedAt}
- **院校总数**: ${manifest.summary.total}
- **已落地本地 logo**: ${manifest.summary.downloaded}
- **待人工确认**: ${manifest.summary.pending}
- **本地资源目录**: \`${manifest.assetRoot}\`
- **Manifest**: \`${manifest.manifestPath}\`
- **共享映射**: \`${manifest.generatedMapPath}\`
- **是否回写数据库**: ${manifest.applyDb ? "是" : "否"}

## 采集口径

- 优先使用数据库已有官网、官网首页公开 logo、站点 manifest、apple touch icon 和现有外部 logo 字段。
- 缺少官网的院校使用脚本内 \`knownHomepages\` 候选表，并在 manifest 中保留采集来源。
- 仅接受 SVG，或满足用户端 40-60px logo 展示清晰度的 PNG/JPG/WebP/GIF；低于阈值的 favicon 不会进入映射。
- 官网直接候选失败时，最后使用 Google domain favicon 作为展示 fallback，并在 manifest 的 \`sourceType=domain-favicon\` 中标明。
- 对旧官网失效、官网被安全策略拦截或已停办/更名的院校，使用可核验的官方归档 PDF、Wikimedia、教育门户或 logo 仓库作为保底，并在 manifest 的 \`sourceType\` 中标明。
- 用户端仍通过本地 \`/assets/static-html/university-logos/\` 路径加载，不在运行时请求外部图片。

## 明细

| Code | 学校 | 状态 | 尺寸 | 来源 | 本地路径 |
| --- | --- | --- | --- | --- | --- |
${rows}

## 待人工确认项

${pending.length ? "| Code | 学校 | 状态 | 说明 |\n| --- | --- | --- | --- |\n" + pendingRows : pendingRows}

## Notion 更新说明

本轮没有可写入的真实 Notion 页面 ID；已生成本地中文报告和 manifest，后续可由 Notion 同步流程写回任务页。
`;

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, "utf8");
}

function candidate(url, score, reason, sourceType, sourcePageUrl, inlineSvg = "", extra = {}) {
  return {
    url,
    score,
    reason,
    sourceType,
    sourcePageUrl,
    inlineSvg,
    localSourcePath: extra.localSourcePath || ""
  };
}

function inlineSvgCandidate(svg, score, reason, sourcePageUrl) {
  const buffer = Buffer.from(svg, "utf8");
  return candidate(`${sourcePageUrl}#inline-svg-${hash(buffer).slice(0, 10)}`, score, reason, "inline-svg", sourcePageUrl, svg);
}

function uniqueCandidates(candidates) {
  const seen = new Map();
  for (const item of candidates) {
    const normalized = item.inlineSvg
      ? `inline:${hash(Buffer.from(item.inlineSvg, "utf8"))}`
      : item.localSourcePath
        ? `local:${path.resolve(item.localSourcePath)}`
        : normalizeCandidateUrl(item.url);
    if (!normalized) continue;
    const existing = seen.get(normalized);
    if (!existing || item.score > existing.score) {
      seen.set(normalized, item.inlineSvg || item.localSourcePath ? item : { ...item, url: normalized });
    }
  }
  return [...seen.values()];
}

function normalizeCandidateUrl(value) {
  const url = safeUrl(value);
  if (!url) return "";
  url.hash = "";
  return url.toString();
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanUrl(value) {
  const text = String(value || "").trim();
  if (!text || text === "#") return "";
  return text;
}

function isExternalUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function looksLikeImageUrl(value) {
  const url = String(value || "");
  if (!url || /^data:/i.test(url)) return false;
  if (/\.(?:svg|png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(url)) return true;
  return /logo|brand|crest|seal|emblem|identity|icon|apple-touch/i.test(url);
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

function parseSvgDimensions(svg) {
  const tag = svg.match(/<svg\b[^>]*>/i)?.[0] || "";
  const width = parseSvgNumber(attrValue(tag, "width"));
  const height = parseSvgNumber(attrValue(tag, "height"));
  if (width && height) return { width, height };
  const viewBox = attrValue(tag, "viewBox");
  const parts = String(viewBox || "").trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
  }
  return { width: null, height: null };
}

function attrValue(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']?([^"'\\s>]+)`, "i"));
  return match?.[1] || "";
}

function parseSvgNumber(value) {
  const match = String(value || "").match(/[\d.]+/);
  const number = match ? Number(match[0]) : 0;
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function parsePngDimensions(buffer) {
  if (buffer.length < 24) return { width: null, height: null };
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function parseGifDimensions(buffer) {
  if (buffer.length < 10) return { width: null, height: null };
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function parseJpegDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
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
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
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
  if (["svg", "png", "jpg", "webp", "gif"].includes(ext)) return ext;
  return "";
}

function contentTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "";
}

function scoreLogoText(value) {
  const text = String(value || "").toLowerCase();
  let score = 0;
  if (/\blogo\b|logotype|brand|branding|site-logo/.test(text)) score += 55;
  if (/crest|seal|emblem|coat|identity/.test(text)) score += 35;
  if (/header|navbar|masthead/.test(text)) score += 10;
  if (/footer/.test(text)) score -= 8;
  if (nonBrandTextPattern.test(text)) score -= 55;
  return score;
}

function scoreLogoUrl(value) {
  const url = String(value || "").toLowerCase();
  let score = 0;
  if (/logo|logotype|brand|crest|seal|emblem|identity/.test(url)) score += 45;
  if (/apple-touch-icon|android-chrome|mstile/.test(url)) score += 18;
  if (/favicon|icon-\d+x\d+/.test(url)) score -= 18;
  if (nonBrandUrlPattern.test(url)) score -= 80;
  if (/\.svg(?:[?#]|$)/.test(url)) score += 20;
  if (/(?:@2x|retina|512|300|250|200|180)/.test(url)) score += 12;
  return score;
}

function hasStrongLogoEvidence(item) {
  if (!item?.url) return false;
  if (isKnownNonBrandAsset(item.url)) return false;
  if (item.score >= strongCandidateScore && /logo|brand|crest|seal|emblem|identity|favicon|apple-touch-icon|custom-logo|json-ld-logo|existing-db-logo|direct-known-logo/i.test(`${item.url} ${item.reason}`)) {
    return true;
  }
  if (item.sourceType === "domain-favicon" && /google\.com\/s2\/favicons/i.test(item.url)) return true;
  return item.score >= 100 && item.sourceType !== "css-url";
}

function isKnownNonBrandAsset(value) {
  return knownNonBrandAssetPattern.test(String(value || ""));
}

function containsUniversityToken(value, university) {
  const text = String(value || "").toLowerCase();
  const tokens = [
    university.code,
    university.shortName,
    ...university.nameEn.split(/[^a-z0-9]+/i).filter((token) => token.length > 3)
  ].map((token) => String(token || "").toLowerCase());
  return tokens.some((token) => token && text.includes(token));
}

function findLogoValues(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) findLogoValues(item, out);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key.toLowerCase() === "logo") {
        if (typeof item === "string") out.push(item);
        else findUrlValues(item, out);
      } else {
        findLogoValues(item, out);
      }
    }
  }
  return out;
}

function findUrlValues(value, out = []) {
  if (typeof value === "string" && /^https?:\/\//i.test(value)) out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => findUrlValues(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => findUrlValues(item, out));
  return out;
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

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stripEmptyHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value != null && value !== ""));
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
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 90);
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
