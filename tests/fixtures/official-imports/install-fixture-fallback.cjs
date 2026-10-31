const crypto = require("node:crypto");
const fs = require("node:fs");
const { syncBuiltinESMExports } = require("node:module");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const zlib = require("node:zlib");

const fixtureRoot = __dirname;
const repositoryRoot = path.resolve(fixtureRoot, "../../..");
const manifestPath = path.join(fixtureRoot, "manifest.json");
const originalExistsSync = fs.existsSync;
const originalReadFileSync = fs.readFileSync;
const manifest = JSON.parse(originalReadFileSync(manifestPath, "utf8"));
const entries = new Map(manifest.entries.map((entry) => [entry.sourcePath, entry]));
const cache = new Map();

function normalizeFile(file) {
  if (file instanceof URL) return fileURLToPath(file);
  if (typeof file !== "string" && !Buffer.isBuffer(file)) return null;
  return path.resolve(String(file));
}

function toRepositoryPath(file) {
  const absolutePath = normalizeFile(file);
  if (!absolutePath) return null;
  const relativePath = path.relative(repositoryRoot, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
  return relativePath.split(path.sep).join("/");
}

function loadFixture(entry) {
  if (cache.has(entry.sourcePath)) return cache.get(entry.sourcePath);

  const compressedPath = path.join(fixtureRoot, entry.fixturePath);
  const content = zlib.gunzipSync(originalReadFileSync(compressedPath));
  const sha256 = crypto.createHash("sha256").update(content).digest("hex");

  if (content.length !== entry.bytes || sha256 !== entry.sha256) {
    throw new Error(`Official import test fixture integrity check failed: ${entry.sourcePath}`);
  }

  cache.set(entry.sourcePath, content);
  return content;
}

function decode(content, options) {
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding ? content.toString(encoding) : Buffer.from(content);
}

fs.readFileSync = function readFileSyncWithOfficialFixture(file, options) {
  const sourcePath = toRepositoryPath(file);
  const entry = sourcePath ? entries.get(sourcePath) : null;
  if (!entry) return originalReadFileSync.call(this, file, options);
  return decode(loadFixture(entry), options);
};

fs.existsSync = function existsSyncWithOfficialFixture(file) {
  const sourcePath = toRepositoryPath(file);
  if (sourcePath && entries.has(sourcePath)) return true;
  return originalExistsSync.call(this, file);
};

syncBuiltinESMExports();
