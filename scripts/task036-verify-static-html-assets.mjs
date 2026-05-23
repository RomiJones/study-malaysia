import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());
const manifestPath = path.join(projectRoot, "apps", "web", "public", "assets", "static-html", "manifest.json");
const successStatuses = new Set(["downloaded", "decoded", "extracted", "copied"]);
const requiredSourceTypes = new Set(["data-field", "css-url", "inline-svg", "html-attr-template", "html-attr-template-fallback"]);
const requiredPurposes = new Set(["logo", "card-image", "css-background", "inline-svg"]);

function toAbsoluteRepoPath(repoPath) {
  return path.join(projectRoot, String(repoPath || "").replace(/\//g, path.sep));
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function fail(message) {
  throw new Error(message);
}

function assertRecordShape(asset) {
  const requiredFields = [
    "referenceId",
    "sourceType",
    "purpose",
    "originalReference",
    "sourceLocation",
    "status",
    "statusMessageZh",
    "handlingStrategyZh",
    "fileName",
    "localPath",
    "publicPath",
    "sizeBytes",
    "sha256",
    "width",
    "height",
    "mimeType"
  ];
  for (const field of requiredFields) {
    if (!(field in asset)) {
      fail(`${asset.referenceId || "unknown"} missing manifest field: ${field}`);
    }
  }
}

async function verifySuccessfulAsset(asset) {
  if (!asset.localPath || !asset.fileName || !asset.publicPath) {
    fail(`${asset.referenceId} succeeded without local path metadata`);
  }
  if (!asset.publicPath.startsWith("/assets/static-html/")) {
    fail(`${asset.referenceId} publicPath must use /assets/static-html/: ${asset.publicPath}`);
  }
  const filePath = toAbsoluteRepoPath(asset.localPath);
  const buffer = await fs.readFile(filePath);
  if (buffer.length !== asset.sizeBytes) {
    fail(`${asset.referenceId} size mismatch for ${asset.localPath}`);
  }
  const sha256 = hashBuffer(buffer);
  if (sha256 !== asset.sha256) {
    fail(`${asset.referenceId} hash mismatch for ${asset.localPath}`);
  }
  if (asset.width != null && (!Number.isFinite(asset.width) || asset.width <= 0)) {
    fail(`${asset.referenceId} invalid width`);
  }
  if (asset.height != null && (!Number.isFinite(asset.height) || asset.height <= 0)) {
    fail(`${asset.referenceId} invalid height`);
  }
}

function verifySkippedOrFailedAsset(asset) {
  if (!asset.statusMessageZh || !asset.handlingStrategyZh) {
    fail(`${asset.referenceId} ${asset.status} must include Chinese reason and handling strategy`);
  }
  if (asset.localPath || asset.publicPath || asset.fileName) {
    fail(`${asset.referenceId} ${asset.status} should not point to a local image file`);
  }
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.taskId !== "TASK-036") fail("manifest taskId must be TASK-036");
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) fail("manifest assets must be a non-empty array");

  const sourceTypes = new Set();
  const purposes = new Set();
  const statuses = new Map();
  const localFiles = new Set();
  const missingLocation = [];

  for (const asset of manifest.assets) {
    assertRecordShape(asset);
    sourceTypes.add(asset.sourceType);
    purposes.add(asset.purpose);
    statuses.set(asset.status, (statuses.get(asset.status) || 0) + 1);
    if (!asset.sourceLocation?.path && !asset.sourceLocation?.line) {
      missingLocation.push(asset.referenceId);
    }
    if (successStatuses.has(asset.status)) {
      await verifySuccessfulAsset(asset);
      localFiles.add(asset.localPath);
    } else {
      verifySkippedOrFailedAsset(asset);
    }
  }

  for (const type of requiredSourceTypes) {
    if (!sourceTypes.has(type)) {
      fail(`missing required source type coverage: ${type}`);
    }
  }
  for (const purpose of requiredPurposes) {
    if (!purposes.has(purpose)) {
      fail(`missing required purpose coverage: ${purpose}`);
    }
  }
  if (localFiles.size === 0) fail("no local files were produced");
  if (missingLocation.length > 0) {
    fail(`assets missing source location: ${missingLocation.slice(0, 10).join(", ")}`);
  }

  const remoteSuccessWithoutLocal = manifest.assets.filter((asset) =>
    /^https?:\/\//i.test(asset.originalReference) && successStatuses.has(asset.status) && !asset.localPath
  );
  if (remoteSuccessWithoutLocal.length > 0) {
    fail(`remote assets succeeded without local file: ${remoteSuccessWithoutLocal.map((asset) => asset.referenceId).join(", ")}`);
  }

  const summary = {
    totalReferences: manifest.assets.length,
    localFiles: localFiles.size,
    statuses: Object.fromEntries(statuses),
    manifest: path.relative(projectRoot, manifestPath).split(path.sep).join("/")
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
