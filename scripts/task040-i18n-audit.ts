import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@studymy/shared";
import { messages } from "../apps/web/src/i18n/messages.ts";

type CheckResult = {
  name: string;
  status: "passed";
  detail?: unknown;
};

const root = process.cwd();
const webSourceRoot = join(root, "apps", "web", "src");
const checks: CheckResult[] = [];

function runCheck(name: string, fn: () => unknown) {
  const detail = fn();
  checks.push({ name, status: "passed", detail });
}

function checkMessageKeys() {
  const baseline = collectLeafPaths(messages.en);
  const missing: Record<string, string[]> = {};
  const extra: Record<string, string[]> = {};

  for (const locale of SUPPORTED_LOCALES) {
    const paths = collectLeafPaths(messages[locale]);
    missing[locale] = baseline.filter((path) => !paths.includes(path));
    extra[locale] = paths.filter((path) => !baseline.includes(path));
  }

  const failures = [
    ...Object.entries(missing).flatMap(([locale, paths]) => paths.map((path) => `${locale} missing ${path}`)),
    ...Object.entries(extra).flatMap(([locale, paths]) => paths.map((path) => `${locale} extra ${path}`))
  ];

  assert(failures.length === 0, `i18n keys are inconsistent:\n${failures.join("\n")}`);

  for (const locale of SUPPORTED_LOCALES) {
    const emptyPaths = collectStringLeaves(messages[locale]).filter((item) => !item.value.trim()).map((item) => item.path);
    assert(emptyPaths.length === 0, `${locale} has empty i18n values:\n${emptyPaths.join("\n")}`);
  }

  return {
    locales: SUPPORTED_LOCALES,
    keyCount: baseline.length,
    missingKeyCount: 0,
    extraKeyCount: 0
  };
}

function checkLocaleFallbackBoundaries() {
  const enLeaves = Object.fromEntries(collectStringLeaves(messages.en).map((item) => [item.path, item.value]));
  const msLeaves = Object.fromEntries(collectStringLeaves(messages.ms).map((item) => [item.path, item.value]));
  const equalMalayEnglish = Object.entries(msLeaves)
    .filter(([path, value]) => enLeaves[path] === value && !allowedEqualMalayEnglishPaths.has(path))
    .map(([path]) => path);

  assert(equalMalayEnglish.length === 0, `Malay messages still fall back to English:\n${equalMalayEnglish.join("\n")}`);
  assert(!containsCjk(JSON.stringify(messages.en)), "English messages must not contain Chinese text");
  assert(!containsCjk(JSON.stringify(messages.ms)), "Malay messages must not contain Chinese text");

  const zhTwText = collectStringLeaves(messages["zh-TW"]).map((item) => item.value).join("\n");
  const simplifiedHits = knownSimplifiedSamples.filter((sample) => zhTwText.includes(sample));
  assert(simplifiedHits.length === 0, `Traditional Chinese messages contain Simplified samples: ${simplifiedHits.join(", ")}`);

  return {
    englishCjkCount: 0,
    malayCjkCount: 0,
    malayEnglishFallbackCount: 0,
    traditionalSimplifiedSampleCount: 0
  };
}

function checkVisibleHardcodedText() {
  const files = [
    ...collectFiles(webSourceRoot).filter((file) => file.endsWith(".vue")),
    join(root, "apps", "web", "index.html")
  ];
  const hits: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const template = file.endsWith(".vue") ? source.match(/<template>([\s\S]*?)<\/template>/)?.[1] || "" : source;
    const relativePath = relative(root, file);

    for (const match of template.matchAll(/>\s*([^<>{}]*[A-Za-z\u3400-\u9fff][^<>{}]*)\s*</g)) {
      const text = normalizeTemplateText(match[1]);
      if (!text || isAllowedVisibleLiteral(text)) continue;
      hits.push(`${relativePath}: text "${text}"`);
    }

    for (const match of template.matchAll(/(?:^|[\s<])(?:aria-label|placeholder|title|alt)=["']([^"']*[A-Za-z\u3400-\u9fff][^"']*)["']/g)) {
      const text = normalizeTemplateText(match[1]);
      if (!text || isAllowedVisibleLiteral(text)) continue;
      hits.push(`${relativePath}: attribute "${text}"`);
    }
  }

  assert(hits.length === 0, `visible hardcoded text found outside i18n bindings:\n${hits.join("\n")}`);
  return { scannedFiles: files.length, hardcodedTextCount: 0 };
}

function checkScriptGeneratedVisibleLabels() {
  const file = join(webSourceRoot, "pages", "HomePage.vue");
  const source = readFileSync(file, "utf8");
  const hits: string[] = [];

  if (!/const\s+rankOptions\s*=\s*computed\s*\(\s*\(\)\s*=>/.test(source)) {
    hits.push("HomePage rankOptions must be a computed value so labels update after runtime locale switches");
  }
  if (!/const\s+budgetOptions\s*=\s*computed\s*\(\s*\(\)\s*=>/.test(source)) {
    hits.push("HomePage budgetOptions must be a computed value so labels update after runtime locale switches");
  }

  const forbiddenScriptLabelPatterns = [
    /label:\s*["'`]Top\s+\d+["'`]/g,
    /label:\s*["'`]≤\s*CNY\s+\d+k["'`]/g,
    /label:\s*`Top\s+\$\{[^`]+\}`/g,
    /label:\s*`\$\{[^`]+}\s*-\s*\$\{[^`]+}\s*CNY`/g
  ];

  for (const pattern of forbiddenScriptLabelPatterns) {
    for (const match of source.matchAll(pattern)) {
      hits.push(`HomePage script-generated visible label must use i18n: ${match[0]}`);
    }
  }

  assert(hits.length === 0, `script-generated visible labels found outside i18n bindings:\n${hits.join("\n")}`);
  return { scannedFiles: 1, hardcodedScriptLabelCount: 0 };
}

function checkRawApiErrorDisplay() {
  const files = collectFiles(webSourceRoot).filter((file) => /\.(ts|vue)$/.test(file) && !file.endsWith(join("api", "client.ts")));
  const hits: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const relativePath = relative(root, file);
    source.split(/\r?\n/).forEach((line, index) => {
      if (/\berror\.(message|stack)\b|\berr\.(message|stack)\b/.test(line)) {
        hits.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert(hits.length === 0, `raw API error message is displayed in web source:\n${hits.join("\n")}`);
  return { scannedFiles: files.length, rawErrorDisplayCount: 0 };
}

function collectLeafPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [prefix];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => collectLeafPaths(item, prefix ? `${prefix}.${key}` : key))
      .sort();
  }
  return [prefix];
}

function collectStringLeaves(value: unknown, prefix = ""): Array<{ path: string; value: string }> {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({ path: `${prefix}.${index}`, value: String(item) }));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => collectStringLeaves(item, prefix ? `${prefix}.${key}` : key));
  }
  return [{ path: prefix, value: String(value) }];
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) files.push(...collectFiles(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function normalizeTemplateText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isAllowedVisibleLiteral(value: string): boolean {
  return allowedVisibleLiteralPatterns.some((pattern) => pattern.test(value));
}

function containsCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const allowedEqualMalayEnglishPaths = new Set([
  "common.phd",
  "common.visa",
  "common.gpa",
  "common.ielts",
  "degree.phd",
  "category.it",
  "authMethod.wechat",
  "authMethod.qq",
  "planner.tiers.reach",
  "planner.tiers.target",
  "planner.tiers.safe"
]);

const knownSimplifiedSamples = [
  "软件",
  "责任",
  "农业",
  "公开信息",
  "申请规划",
  "登录",
  "账号",
  "专业",
  "数据",
  "费用",
  "对比",
  "筛选"
];

const allowedVisibleLiteralPatterns = [
  /^StudyMY(?: Admin)?$/,
  /^2026$/,
  /^QS(?:\s*#)?$/,
  /^GPA$/,
  /^IELTS$/,
  /^TOEFL$/,
  /^CNY$/,
  /^RM$/
];

runCheck("i18n key completeness", checkMessageKeys);
runCheck("locale fallback boundaries", checkLocaleFallbackBoundaries);
runCheck("visible hardcoded text scan", checkVisibleHardcodedText);
runCheck("script-generated visible label scan", checkScriptGeneratedVisibleLabels);
runCheck("raw API error display scan", checkRawApiErrorDisplay);

console.log(JSON.stringify({
  taskId: "TASK-040",
  status: "passed",
  checks
}, null, 2));
