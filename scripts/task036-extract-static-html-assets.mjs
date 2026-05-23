import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const taskId = "TASK-036";
const projectRoot = path.resolve(process.cwd());
const sourceHtmlPath = normalizePath(process.env.STATIC_HTML_PATH || "D:/mydev/StudyMY_UM_v58_na_display_tidy.html");
const assetRoot = path.join(projectRoot, "apps", "web", "public", "assets", "static-html");
const manifestPath = path.join(assetRoot, "manifest.json");
const reportPath = path.join(projectRoot, "docs", "prd", "TASK-036-static-html-image-assets-report.md");
const requestTimeoutMs = Number(process.env.STATIC_ASSET_TIMEOUT_MS || 20000);
const maxConcurrentDownloads = Number(process.env.STATIC_ASSET_CONCURRENCY || 6);

const successStatuses = new Set(["downloaded", "decoded", "extracted", "copied"]);
const imageFieldPattern = /^(?:logo|image|img|icon|cover|background|photo|thumbnail|favicon|picture|banner)$/i;
const imageUrlPattern = /^(?:https?:\/\/images\.unsplash\.com\/|https?:\/\/.*\.(?:png|jpe?g|webp|gif|svg|ico)(?:[?#].*)?$|data:image\/)/i;
const urlPattern = /https?:\/\/[^\s"'`<>)}]+/gi;

const mimeExtensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/svg+xml", "svg"],
  ["image/webp", "webp"],
  ["image/x-icon", "ico"],
  ["image/vnd.microsoft.icon", "ico"],
  ["image/ico", "ico"]
]);

function normalizePath(value) {
  return path.resolve(value.replace(/^file:\/\//i, ""));
}

function toPublicPath(fileName) {
  return `/assets/static-html/${fileName}`;
}

function toRepoPath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/");
}

function createLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function offsetToLocation(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (starts[mid] <= offset) low = mid + 1;
    else high = mid - 1;
  }
  const lineIndex = Math.max(0, high);
  return {
    line: lineIndex + 1,
    column: offset - starts[lineIndex] + 1
  };
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function shortHash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function sanitizeName(value, fallback = "asset") {
  const base = String(value || fallback)
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/%[0-9a-f]{2}/gi, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base || fallback;
}

function parseAttributes(tag) {
  const attrs = new Map();
  const re = /\b([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = re.exec(tag))) {
    attrs.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function parseSrcset(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split(/\s+/)[0])
    .filter(Boolean);
}

function extractLiteral(html, name) {
  const needle = `const ${name} =`;
  const start = html.indexOf(needle);
  if (start < 0) {
    return null;
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

  for (let i = cursor; i < html.length; i += 1) {
    const ch = html[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = "";
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return {
          literal: html.slice(cursor, i + 1),
          offset: cursor
        };
      }
    }
  }

  throw new Error(`Unclosed literal: ${name}`);
}

function evaluateLiteral(html, name) {
  const extracted = extractLiteral(html, name);
  if (!extracted) {
    return null;
  }
  return {
    data: Function(`return (${extracted.literal});`)(),
    offset: extracted.offset
  };
}

function walkStrings(value, pathParts = [], out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, [...pathParts, String(index)], out));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walkStrings(item, [...pathParts, key], out));
  } else if (typeof value === "string") {
    out.push({
      path: pathParts.join("."),
      field: pathParts.at(-1) || "",
      value
    });
  }
  return out;
}

function classifyPurpose(sourceType, field, reference) {
  const normalizedField = String(field || "").toLowerCase();
  if (normalizedField.includes("logo")) return "logo";
  if (normalizedField.includes("favicon")) return "favicon";
  if (normalizedField.includes("icon")) return "icon";
  if (normalizedField.includes("cover") || normalizedField.includes("banner")) return "cover";
  if (normalizedField.includes("background")) return "background";
  if (normalizedField.includes("image") || normalizedField.includes("photo") || normalizedField.includes("thumbnail")) {
    return "card-image";
  }
  if (sourceType === "css-url") return "css-background";
  if (sourceType === "inline-svg") return "inline-svg";
  if (String(reference || "").startsWith("data:image/svg+xml")) return "data-svg";
  return "image";
}

function findStringLocation(html, starts, value, fromOffset = 0) {
  if (!value) return {};
  const offset = html.indexOf(value, fromOffset);
  if (offset < 0) return {};
  return offsetToLocation(starts, offset);
}

function createReferenceFactory(html, lineStarts) {
  const references = [];
  const seenKeys = new Set();

  function addReference(input) {
    const originalReference = String(input.originalReference ?? "");
    const location = input.sourceLocation || {};
    const key = [
      input.sourceType,
      input.attribute || "",
      input.path || "",
      location.line || "",
      location.column || "",
      originalReference,
      input.inlineContent ? shortHash(input.inlineContent) : ""
    ].join("||");
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const purpose = input.purpose || classifyPurpose(input.sourceType, input.field || input.attribute, originalReference);
    references.push({
      referenceId: `${taskId}-${String(references.length + 1).padStart(4, "0")}`,
      sourceType: input.sourceType,
      purpose,
      originalReference,
      normalizedReference: normalizeReference(originalReference),
      sourceLocation: {
        ...location,
        path: input.path || null,
        tag: input.tag || null,
        attribute: input.attribute || null
      },
      inlineContent: input.inlineContent || null,
      descriptor: input.descriptor || null
    });
  }

  function addUrlFromValue(source, value, options = {}) {
    const raw = String(value ?? "").trim();
    const base = { ...options, originalReference: raw };
    if (!raw) {
      addReference(base);
      return;
    }

    if (raw.includes("${")) {
      addReference({
        ...base,
        sourceType: `${source}-template`
      });
      for (const match of raw.matchAll(urlPattern)) {
        addReference({
          ...options,
          sourceType: `${source}-template-fallback`,
          originalReference: trimTrailingUrlPunctuation(match[0]),
          descriptor: raw
        });
      }
      return;
    }

    addReference(base);
  }

  return {
    references,
    addReference,
    addUrlFromValue,
    html,
    lineStarts
  };
}

function trimTrailingUrlPunctuation(value) {
  return String(value || "").replace(/[;,]+$/g, "");
}

function normalizeReference(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      url.hash = "";
      return url.toString();
    } catch {
      return raw;
    }
  }
  return raw;
}

function collectHtmlTagReferences(html, lineStarts, collector) {
  const tagRe = /<(img|source|link)\b[^>]*>/gi;
  let match;
  while ((match = tagRe.exec(html))) {
    const tag = match[0];
    const tagName = match[1].toLowerCase();
    const attrs = parseAttributes(tag);
    const tagLocation = offsetToLocation(lineStarts, match.index);
    const rel = attrs.get("rel") || "";
    const isIconLink = tagName === "link" && /\b(?:icon|apple-touch-icon|mask-icon)\b/i.test(rel);
    if (tagName === "img") {
      for (const attr of ["src", "data-src"]) {
        if (attrs.has(attr)) {
          collector.addUrlFromValue("html-attr", attrs.get(attr), {
            sourceType: "html-attr",
            tag: tagName,
            attribute: attr,
            sourceLocation: tagLocation
          });
        }
      }
      if (attrs.has("srcset")) {
        for (const candidate of parseSrcset(attrs.get("srcset"))) {
          collector.addUrlFromValue("html-srcset", candidate, {
            sourceType: "html-srcset",
            tag: tagName,
            attribute: "srcset",
            sourceLocation: tagLocation,
            descriptor: attrs.get("srcset")
          });
        }
      }
    }
    if (tagName === "source") {
      for (const attr of ["src", "srcset"]) {
        if (!attrs.has(attr)) continue;
        const values = attr === "srcset" ? parseSrcset(attrs.get(attr)) : [attrs.get(attr)];
        for (const candidate of values) {
          collector.addUrlFromValue(attr === "srcset" ? "picture-source-srcset" : "picture-source", candidate, {
            sourceType: attr === "srcset" ? "picture-source-srcset" : "picture-source",
            tag: tagName,
            attribute: attr,
            sourceLocation: tagLocation,
            descriptor: attrs.get(attr)
          });
        }
      }
    }
    if (isIconLink && attrs.has("href")) {
      collector.addUrlFromValue("html-icon", attrs.get("href"), {
        sourceType: "html-icon",
        tag: tagName,
        attribute: "href",
        sourceLocation: tagLocation,
        purpose: "favicon"
      });
    }
  }
}

function collectCssReferences(html, lineStarts, collector) {
  const cssUrlRe = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  let match;
  while ((match = cssUrlRe.exec(html))) {
    const raw = match[2].trim();
    if (!raw || raw.startsWith("#")) continue;
    collector.addUrlFromValue("css-url", raw, {
      sourceType: "css-url",
      tag: "style",
      attribute: "url",
      sourceLocation: offsetToLocation(lineStarts, match.index)
    });
  }
}

function collectInlineSvgReferences(html, lineStarts, collector) {
  const svgRe = /<svg\b[\s\S]*?<\/svg>/gi;
  let match;
  while ((match = svgRe.exec(html))) {
    const content = match[0].trim();
    collector.addReference({
      sourceType: "inline-svg",
      purpose: "inline-svg",
      originalReference: `inline-svg:${shortHash(content)}`,
      inlineContent: content,
      sourceLocation: offsetToLocation(lineStarts, match.index),
      tag: "svg"
    });
  }
}

function collectDataFieldReferences(html, lineStarts, collector) {
  const literalNames = ["universitiesBase", "universitiesSupplement", "officialUniversityPatches"];
  for (const literalName of literalNames) {
    const evaluated = evaluateLiteral(html, literalName);
    if (!evaluated) continue;
    const strings = walkStrings(evaluated.data, [literalName]);
    for (const item of strings) {
      const isImageField = imageFieldPattern.test(item.field);
      const isImageUrl = imageUrlPattern.test(item.value);
      if (!isImageField && !isImageUrl) continue;
      collector.addUrlFromValue("data-field", item.value, {
        sourceType: "data-field",
        path: item.path,
        field: item.field,
        sourceLocation: findStringLocation(html, lineStarts, item.value, evaluated.offset)
      });
    }
  }
}

function inferMimeFromExtension(ext) {
  const normalized = String(ext || "").toLowerCase().replace(/^\./, "");
  for (const [mime, candidateExt] of mimeExtensions.entries()) {
    if (candidateExt === normalized) return mime;
  }
  return null;
}

function extensionFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const ext = path.extname(url.pathname).replace(".", "").toLowerCase();
    return ext || null;
  } catch {
    const ext = path.extname(rawUrl.split(/[?#]/)[0]).replace(".", "").toLowerCase();
    return ext || null;
  }
}

function extensionFromMime(mimeType, fallback = "bin") {
  const bare = String(mimeType || "").split(";")[0].trim().toLowerCase();
  return mimeExtensions.get(bare) || fallback;
}

function cleanMimeType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase() || null;
}

function getUrlBaseName(rawUrl, fallback = "remote-image") {
  try {
    const url = new URL(rawUrl);
    const decoded = decodeURIComponent(path.basename(url.pathname) || fallback);
    return decoded || fallback;
  } catch {
    return path.basename(String(rawUrl || "")) || fallback;
  }
}

function buildFileName(reference, buffer, mimeType) {
  const ext = extensionFromMime(mimeType, extensionFromUrl(reference.originalReference) || "bin");
  const sourceHash = reference.sourceType === "inline-svg" || reference.normalizedReference.startsWith("data:image/")
    ? hashBuffer(buffer).slice(0, 12)
    : shortHash(reference.normalizedReference || reference.originalReference);
  const prefix = sanitizeName(reference.purpose || "image", "image");
  const baseName = reference.sourceType === "inline-svg"
    ? `inline-svg-${sourceHash}`
    : reference.normalizedReference.startsWith("data:image/")
      ? `data-image-${sourceHash}`
      : sanitizeName(getUrlBaseName(reference.normalizedReference || reference.originalReference), "remote-image");
  return `${prefix}-${baseName}-${sourceHash}.${ext}`;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "StudyMY static asset extractor/1.0"
      }
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeDataUrl(reference) {
  const raw = reference.normalizedReference || reference.originalReference;
  const commaIndex = raw.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Data URL missing comma separator");
  }
  const meta = raw.slice(5, commaIndex);
  const data = raw.slice(commaIndex + 1);
  const mimeType = cleanMimeType(meta.split(";")[0] || "text/plain");
  const isBase64 = /;base64/i.test(meta);
  const buffer = isBase64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8");
  return { buffer, mimeType };
}

function normalizeStandaloneSvg(content) {
  let svg = String(content || "").trim();
  if (!svg) return svg;

  const openTag = svg.match(/^<svg\b([^>]*)>/i);
  if (!openTag) return svg;

  let attrs = openTag[1] || "";
  if (!/\sxmlns=/.test(attrs)) {
    attrs += ' xmlns="http://www.w3.org/2000/svg"';
  }

  const hasWidth = /\swidth=/.test(attrs);
  const hasHeight = /\sheight=/.test(attrs);
  if (!hasWidth || !hasHeight) {
    const viewBox = attrs.match(/\sviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
    if (viewBox) {
      if (!hasWidth) attrs += ` width="${viewBox[1]}"`;
      if (!hasHeight) attrs += ` height="${viewBox[2]}"`;
    }
  }

  return svg.replace(/^<svg\b[^>]*>/i, `<svg${attrs}>`);
}

async function readLocalFile(reference, htmlDir) {
  const raw = reference.normalizedReference || reference.originalReference;
  const resolved = raw.startsWith("/")
    ? path.join(htmlDir, raw.slice(1))
    : path.resolve(htmlDir, raw);
  const buffer = await fs.readFile(resolved);
  const ext = extensionFromUrl(resolved);
  return {
    buffer,
    mimeType: inferMimeFromExtension(ext) || "application/octet-stream"
  };
}

async function loadReferenceContent(reference, htmlDir) {
  const raw = reference.normalizedReference || reference.originalReference;
  if (reference.sourceType === "inline-svg") {
    const svg = normalizeStandaloneSvg(reference.inlineContent || "");
    return {
      buffer: Buffer.from(svg, "utf8"),
      mimeType: "image/svg+xml"
    };
  }
  if (!raw) {
    return null;
  }
  if (raw.includes("${")) {
    return null;
  }
  if (raw.startsWith("data:image/")) {
    return decodeDataUrl(reference);
  }
  if (/^https?:\/\//i.test(raw)) {
    const response = await fetchWithTimeout(raw);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    const contentType = cleanMimeType(response.headers.get("content-type"));
    if (contentType && !contentType.startsWith("image/")) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: contentType || inferMimeFromExtension(extensionFromUrl(raw)) || "application/octet-stream"
    };
  }
  return readLocalFile(reference, htmlDir);
}

function readPngDimensions(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return null;
}

function readGifDimensions(buffer) {
  if (buffer.length >= 10 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  return null;
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3 && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(buffer) {
  if (buffer.length < 30 || buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    return null;
  }
  const type = buffer.subarray(12, 16).toString("ascii");
  if (type === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  if (type === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  if (type === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }
  return null;
}

function readSvgDimensions(buffer) {
  const text = buffer.toString("utf8");
  const width = text.match(/\bwidth=["']?([0-9.]+)(?:px)?["']?/i)?.[1];
  const height = text.match(/\bheight=["']?([0-9.]+)(?:px)?["']?/i)?.[1];
  if (width && height) {
    return { width: Number(width), height: Number(height) };
  }
  const viewBox = text.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
  if (viewBox) {
    return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
  }
  return null;
}

function readDimensions(buffer, mimeType) {
  const mime = cleanMimeType(mimeType);
  if (mime === "image/png") return readPngDimensions(buffer);
  if (mime === "image/jpeg" || mime === "image/jpg") return readJpegDimensions(buffer);
  if (mime === "image/gif") return readGifDimensions(buffer);
  if (mime === "image/webp") return readWebpDimensions(buffer);
  if (mime === "image/svg+xml") return readSvgDimensions(buffer);
  return readPngDimensions(buffer) || readJpegDimensions(buffer) || readGifDimensions(buffer) || readWebpDimensions(buffer) || readSvgDimensions(buffer);
}

function getHandlingStrategy(status, message) {
  if (successStatuses.has(status)) {
    return "已落入本地 assets/static-html 目录，运行时应改用 publicPath 引用。";
  }
  if (status === "skipped-empty") {
    return "原始数据为空，manifest 保留来源位置；后续接入时继续使用设计兜底或补充真实图片。";
  }
  if (status === "skipped-template-expression") {
    return "模板表达式本身不是可下载 URL；脚本已单独提取表达式中的远程 fallback，并从数据字段提取运行时图片值。";
  }
  if (status === "skipped-fragment") {
    return "CSS 片段引用不是独立图片文件，无需下载。";
  }
  if (status === "failed") {
    return "已记录失败原因；后续可重试下载、手工补充同源图片，或在接入时使用本地设计兜底。";
  }
  return message || "已记录处理策略。";
}

async function processOneReference(reference, htmlDir) {
  const raw = reference.normalizedReference || reference.originalReference;
  if (!raw) {
    return {
      ...reference,
      status: "skipped-empty",
      statusMessageZh: "原始引用为空。",
      handlingStrategyZh: getHandlingStrategy("skipped-empty"),
      fileName: null,
      localPath: null,
      publicPath: null,
      sizeBytes: null,
      sha256: null,
      width: null,
      height: null,
      mimeType: null
    };
  }
  if (raw.startsWith("#")) {
    return {
      ...reference,
      status: "skipped-fragment",
      statusMessageZh: "这是 SVG/CSS 内部片段引用，不是独立图片资源。",
      handlingStrategyZh: getHandlingStrategy("skipped-fragment"),
      fileName: null,
      localPath: null,
      publicPath: null,
      sizeBytes: null,
      sha256: null,
      width: null,
      height: null,
      mimeType: null
    };
  }
  if (raw.includes("${")) {
    return {
      ...reference,
      status: "skipped-template-expression",
      statusMessageZh: "模板表达式不是可直接下载的图片 URL。",
      handlingStrategyZh: getHandlingStrategy("skipped-template-expression"),
      fileName: null,
      localPath: null,
      publicPath: null,
      sizeBytes: null,
      sha256: null,
      width: null,
      height: null,
      mimeType: null
    };
  }

  try {
    const loaded = await loadReferenceContent(reference, htmlDir);
    if (!loaded) {
      throw new Error("No image content was produced");
    }
    const { buffer, mimeType } = loaded;
    const cleanMime = cleanMimeType(mimeType) || "application/octet-stream";
    const fileName = buildFileName(reference, buffer, cleanMime);
    const filePath = path.join(assetRoot, fileName);
    await fs.writeFile(filePath, buffer);
    const dimensions = readDimensions(buffer, cleanMime) || {};
    const status = reference.sourceType === "inline-svg"
      ? "extracted"
      : raw.startsWith("data:image/")
        ? "decoded"
        : /^https?:\/\//i.test(raw)
          ? "downloaded"
          : "copied";
    return {
      ...reference,
      status,
      statusMessageZh: status === "downloaded"
        ? "远程图片已下载到本地。"
        : status === "decoded"
          ? "data URL 图片已解码为本地文件。"
          : status === "extracted"
            ? "内联 SVG 已提取为本地文件。"
            : "本地图片已复制到资源目录。",
      handlingStrategyZh: getHandlingStrategy(status),
      fileName,
      localPath: toRepoPath(filePath),
      publicPath: toPublicPath(fileName),
      sizeBytes: buffer.length,
      sha256: hashBuffer(buffer),
      width: Number.isFinite(dimensions.width) ? dimensions.width : null,
      height: Number.isFinite(dimensions.height) ? dimensions.height : null,
      mimeType: cleanMime
    };
  } catch (error) {
    return {
      ...reference,
      status: "failed",
      statusMessageZh: `无法提取图片：${error instanceof Error ? error.message : String(error)}`,
      handlingStrategyZh: getHandlingStrategy("failed"),
      fileName: null,
      localPath: null,
      publicPath: null,
      sizeBytes: null,
      sha256: null,
      width: null,
      height: null,
      mimeType: null
    };
  }
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function resetAssetRoot() {
  const resolvedAssetRoot = path.resolve(assetRoot);
  const expectedPrefix = path.join(projectRoot, "apps", "web", "public", "assets");
  if (!resolvedAssetRoot.startsWith(path.resolve(expectedPrefix))) {
    throw new Error(`Refusing to clean unexpected asset directory: ${resolvedAssetRoot}`);
  }
  await fs.rm(resolvedAssetRoot, { recursive: true, force: true });
  await fs.mkdir(resolvedAssetRoot, { recursive: true });
}

function buildSummary(assets) {
  const byStatus = {};
  const byPurpose = {};
  const bySourceType = {};
  for (const asset of assets) {
    byStatus[asset.status] = (byStatus[asset.status] || 0) + 1;
    byPurpose[asset.purpose] = (byPurpose[asset.purpose] || 0) + 1;
    bySourceType[asset.sourceType] = (bySourceType[asset.sourceType] || 0) + 1;
  }
  return {
    totalReferences: assets.length,
    successfulReferences: assets.filter((asset) => successStatuses.has(asset.status)).length,
    failedReferences: assets.filter((asset) => asset.status === "failed").length,
    skippedReferences: assets.filter((asset) => asset.status.startsWith("skipped")).length,
    uniqueLocalFiles: new Set(assets.map((asset) => asset.fileName).filter(Boolean)).size,
    totalLocalBytes: assets
      .filter((asset) => successStatuses.has(asset.status))
      .reduce((sum, asset) => sum + (asset.sizeBytes || 0), 0),
    byStatus,
    byPurpose,
    bySourceType
  };
}

function formatMarkdownTable(rows) {
  if (rows.length === 0) return "无。";
  return [
    "| 状态 | 用途 | 原始引用 | 来源位置 | 原因 / 策略 |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((asset) => {
      const source = [
        asset.sourceLocation?.path,
        asset.sourceLocation?.line ? `line ${asset.sourceLocation.line}` : null,
        asset.sourceLocation?.attribute ? `attr ${asset.sourceLocation.attribute}` : null
      ].filter(Boolean).join(" / ");
      const reference = asset.originalReference.length > 90
        ? `${asset.originalReference.slice(0, 87)}...`
        : asset.originalReference;
      return `| ${asset.status} | ${asset.purpose} | \`${reference.replace(/\|/g, "\\|")}\` | ${source || "-"} | ${asset.statusMessageZh} ${asset.handlingStrategyZh} |`;
    })
  ].join("\n");
}

async function writeReport(manifest) {
  const failedOrSkipped = manifest.assets.filter((asset) => asset.status === "failed" || asset.status.startsWith("skipped"));
  const successful = manifest.assets.filter((asset) => successStatuses.has(asset.status));
  const report = `# TASK-036 静态 HTML 图片资产提取报告

## 摘要

- **任务编号**: ${taskId}
- **生成时间**: ${manifest.generatedAt}
- **静态 HTML**: \`${normalizeSlashes(sourceHtmlPath)}\`
- **本地资源目录**: \`${normalizeSlashes(toRepoPath(assetRoot))}\`
- **Manifest**: \`${normalizeSlashes(toRepoPath(manifestPath))}\`
- **图片入口总数**: ${manifest.summary.totalReferences}
- **成功落地入口**: ${manifest.summary.successfulReferences}
- **本地文件数**: ${manifest.summary.uniqueLocalFiles}
- **失败入口**: ${manifest.summary.failedReferences}
- **跳过入口**: ${manifest.summary.skippedReferences}

## 覆盖范围

- 已扫描数据层 \`universitiesBase\`、\`universitiesSupplement\`、\`officialUniversityPatches\` 中的 \`logo\`、\`image\` 等图片字段。
- 已扫描 HTML \`img src\`、\`srcset\`、\`picture/source\`、\`link rel=icon\` 入口。
- 已扫描 CSS \`url(...)\`，包含 data URL 背景图。
- 已提取内联 SVG 图标和装饰图。
- 每条 manifest 记录包含原始引用、来源位置、用途、文件名、大小、hash、宽高和处理状态。

## 状态统计

\`\`\`json
${JSON.stringify(manifest.summary.byStatus, null, 2)}
\`\`\`

## 用途统计

\`\`\`json
${JSON.stringify(manifest.summary.byPurpose, null, 2)}
\`\`\`

## 无法下载或无法解析的入口

${formatMarkdownTable(failedOrSkipped)}

## 已落地样例

| 用途 | 原始引用 | 本地文件 | 尺寸 | 大小 |
| --- | --- | --- | --- | --- |
${successful.slice(0, 20).map((asset) => {
  const reference = asset.originalReference.length > 70 ? `${asset.originalReference.slice(0, 67)}...` : asset.originalReference;
  return `| ${asset.purpose} | \`${reference.replace(/\|/g, "\\|")}\` | \`${asset.localPath}\` | ${asset.width || "?"}x${asset.height || "?"} | ${asset.sizeBytes} |`;
}).join("\n")}

## Notion 更新说明

本轮没有真实 Notion 页面 URL，未直接更新 Notion；已生成本地中文报告和 manifest，可由后续同步流程写回任务页。
`;
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, "utf8");
}

async function main() {
  const html = await fs.readFile(sourceHtmlPath, "utf8");
  const lineStarts = createLineIndex(html);
  const collector = createReferenceFactory(html, lineStarts);
  collectHtmlTagReferences(html, lineStarts, collector);
  collectCssReferences(html, lineStarts, collector);
  collectInlineSvgReferences(html, lineStarts, collector);
  collectDataFieldReferences(html, lineStarts, collector);

  await resetAssetRoot();
  const htmlDir = path.dirname(sourceHtmlPath);
  const assets = await mapConcurrent(
    collector.references,
    maxConcurrentDownloads,
    (reference) => processOneReference(reference, htmlDir)
  );

  const manifest = {
    version: 1,
    taskId,
    generatedAt: new Date().toISOString(),
    sourceHtmlPath: normalizeSlashes(sourceHtmlPath),
    assetRoot: normalizeSlashes(toRepoPath(assetRoot)),
    manifestPath: normalizeSlashes(toRepoPath(manifestPath)),
    reportPath: normalizeSlashes(toRepoPath(reportPath)),
    summary: buildSummary(assets),
    assets
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeReport(manifest);

  console.log(JSON.stringify({
    taskId,
    manifest: toRepoPath(manifestPath),
    report: toRepoPath(reportPath),
    summary: manifest.summary
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
