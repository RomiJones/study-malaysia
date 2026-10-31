import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());
const publicRoot = path.join(projectRoot, "apps", "web", "public");
const staticAssetRoot = path.join(publicRoot, "assets", "static-html");

const checks = [];

async function main() {
  await checkRequiredFiles();
  await checkSharedLocalAssetReferences();
  await checkSeedDataImageFields();
  await checkApiMappers();
  await checkUserFacingSource();
  await checkVueImageFallbacks();

  console.log(JSON.stringify({
    taskId: "TASK-037",
    status: "passed",
    checks
  }, null, 2));
}

async function checkRequiredFiles() {
  const files = [
    "manifest.json",
    "fallback-university-logo.svg",
    "fallback-university-cover.svg",
    "image-photo-1562774053-701939374585-3a3ba5b0250f.jpg"
  ];
  for (const file of files) {
    await assertFile(path.join(staticAssetRoot, file), `required static asset exists: ${file}`);
  }
}

async function checkSharedLocalAssetReferences() {
  const sharedPath = path.join(projectRoot, "packages", "shared", "src", "index.ts");
  const source = await readText(sharedPath);
  assertIncludes(source, "LOCAL_UNIVERSITY_LOGO_FALLBACK", "shared exports logo fallback");
  assertIncludes(source, "LOCAL_UNIVERSITY_COVER_FALLBACK", "shared exports cover fallback");
  assertIncludes(source, "localizeUniversityImageUrl", "shared exports image localization helper");
  assertIncludes(source, "localizeUniversityLogoUrl", "shared exports logo localization helper");
  assertIncludes(source, "getLocalUniversityCoverByCode", "shared exports university cover code mapping");
  assertIncludes(source, "getLocalUniversityLogoByCode", "shared exports university logo code mapping");
  assertIncludes(source, "LOCAL_CARD_IMAGE_BY_UNSPLASH_KEY", "shared maps static HTML Unsplash image keys");

  for (const publicPath of extractStaticAssetPublicPaths(source)) {
    await assertPublicAsset(publicPath, `shared referenced local asset exists: ${publicPath}`);
  }

  const logoMapPath = path.join(projectRoot, "packages", "shared", "src", "university-logo-assets.ts");
  const logoMapSource = await readText(logoMapPath);
  const logoPaths = extractStaticAssetPublicPaths(logoMapSource).filter((item) => item.includes("/university-logos/"));
  assert(logoPaths.length > 0, "university logo map contains local logo assets");
  for (const publicPath of logoPaths) {
    await assertPublicAsset(publicPath, `mapped university logo exists: ${publicPath}`);
  }

  const coverMapPath = path.join(projectRoot, "packages", "shared", "src", "university-cover-assets.ts");
  const coverMapSource = await readText(coverMapPath);
  const coverPaths = extractStaticAssetPublicPaths(coverMapSource).filter((item) => item.includes("/university-covers/"));
  assert(coverPaths.length === 119, `university cover map contains 119 local cover assets: ${coverPaths.length}`);
  for (const publicPath of coverPaths) {
    await assertPublicAsset(publicPath, `mapped university cover exists: ${publicPath}`);
  }
}

async function checkSeedDataImageFields() {
  const seedPath = path.join(projectRoot, "apps", "api", "src", "db", "seed-data.ts");
  const source = await readText(seedPath);
  assert(!/logoUrl:\s*["']https?:\/\//i.test(source), "seed data has no remote logoUrl literals");
  assert(!/imageUrl:\s*["']https?:\/\//i.test(source), "seed data has no remote imageUrl literals");
  assertIncludes(source, "LOCAL_UNIVERSITY_LOGO_FALLBACK", "seed data uses shared logo fallback");
  assertIncludes(source, "LOCAL_UNIVERSITY_COVER_FALLBACK", "seed data uses shared cover fallback");

  const localCoverMatches = [...source.matchAll(/localCover\(["']([^"']+)["']\)/g)];
  for (const match of localCoverMatches) {
    await assertPublicAsset(`/assets/static-html/${match[1]}`, `seed data local cover exists: ${match[1]}`);
  }
}

async function checkApiMappers() {
  const mapperPath = path.join(projectRoot, "apps", "api", "src", "common", "mappers.ts");
  const staticCatalogPath = path.join(projectRoot, "apps", "api", "src", "db", "static-html-catalog.ts");
  const mapperSource = await readText(mapperPath);
  const staticCatalogSource = await readText(staticCatalogPath);

  assertIncludes(mapperSource, "localizeUniversityLogoUrl(entity.logoUrl, entity.code)", "API mapper localizes logoUrl before public response");
  assertIncludes(mapperSource, "localizeUniversityImageUrl(entity.imageUrl, entity.code)", "API mapper localizes imageUrl before public response");
  assertIncludes(staticCatalogSource, "localizeUniversityLogoUrl(readString(raw, \"logo\") || readString(raw, \"logoUrl\"), code)", "static HTML import localizes logo fields");
  assertIncludes(staticCatalogSource, "localizeUniversityImageUrl(readString(raw, \"image\") || readString(raw, \"imageUrl\"), code)", "static HTML import localizes image fields");
}

async function checkUserFacingSource() {
  const sourceFiles = await listFiles(path.join(projectRoot, "apps", "web", "src"), [".vue", ".ts", ".css"]);
  const forbidden = [
    "images.unsplash.com",
    "upload.wikimedia.org",
    "source.unsplash.com"
  ];
  const hits = [];
  for (const file of sourceFiles) {
    const source = await readText(file);
    for (const token of forbidden) {
      if (source.includes(token)) hits.push(`${relative(file)} contains ${token}`);
    }
  }
  assert(hits.length === 0, `user-facing source must not reference external page images: ${hits.join("; ")}`);
  checks.push({ name: "user-facing source has no external image literals", status: "passed", files: sourceFiles.length });
}

async function checkVueImageFallbacks() {
  const vueFiles = await listFiles(path.join(projectRoot, "apps", "web", "src"), [".vue"]);
  const missing = [];
  for (const file of vueFiles) {
    const source = await readText(file);
    const imageTags = source.match(/<img\b[\s\S]*?(?:\/>|>)/g) || [];
    for (const tag of imageTags) {
      if (!tag.includes("@error=")) missing.push(`${relative(file)}: ${compact(tag)}`);
    }
  }
  assert(missing.length === 0, `all Vue image tags need an error fallback handler: ${missing.join("; ")}`);
  checks.push({ name: "Vue image tags include fallback handlers", status: "passed", imageTagCount: vueFiles.length });
}

async function assertPublicAsset(publicPath, name) {
  if (!publicPath.startsWith("/assets/static-html/")) {
    throw new Error(`Not a static HTML asset path: ${publicPath}`);
  }
  const absolutePath = path.join(publicRoot, publicPath.replace(/^\//, ""));
  await assertFile(absolutePath, name);
}

async function assertFile(filePath, name) {
  const stats = await fs.stat(filePath).catch(() => null);
  assert(Boolean(stats?.isFile()) && stats.size > 0, `${name}: ${relative(filePath)}`);
  checks.push({ name, status: "passed", file: relative(filePath), sizeBytes: stats.size });
}

function extractStaticAssetPublicPaths(source) {
  const paths = new Set();
  const directMatches = source.matchAll(/\/assets\/static-html\/[^"`' )]+/g);
  for (const match of directMatches) paths.add(match[0]);
  const templateMatches = source.matchAll(/\$\{LOCAL_STATIC_HTML_ASSET_ROOT\}\/([^"`']+)/g);
  for (const match of templateMatches) paths.add(`/assets/static-html/${match[1]}`);
  return [...paths];
}

async function listFiles(root, extensions) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(filePath, extensions));
    } else if (extensions.includes(path.extname(entry.name))) {
      files.push(filePath);
    }
  }
  return files;
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

function assertIncludes(source, token, message) {
  assert(source.includes(token), message);
  checks.push({ name: message, status: "passed" });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function relative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function compact(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
