import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import mysql from "mysql2/promise";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const taskId = "task022";
const staticHtmlPath = process.env.STATIC_HTML_PATH || "D:\\mydev\\StudyMY_UM_v58_na_display_tidy.html";
const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputRoot = join(root, "output", "playwright", `${taskId}-${runStamp}`);
const databaseName = process.env.STUDYMY_VISUAL_DATABASE || `study_malaysia_visual_${runStamp.replace(/\D/g, "").slice(0, 14)}`;
const keepDatabase = process.env.STUDYMY_VISUAL_KEEP_DB === "1";
const headless = process.env.STUDYMY_VISUAL_HEADED !== "1";
const childProcesses = [];
const report = {
  taskId: "TASK-022",
  runId: `${taskId}-${runStamp}`,
  startedAt: new Date().toISOString(),
  staticHtmlPath,
  outputRoot,
  database: databaseName,
  screenshots: [],
  comparisons: [],
  steps: []
};

const viewports = [
  { key: "desktop", label: "桌面端", width: 1440, height: 1000 },
  { key: "mobile", label: "移动端", width: 390, height: 844 }
];

const categories = [
  ["layout", "布局"],
  ["color", "颜色"],
  ["font", "字体"],
  ["spacing", "间距"],
  ["card", "卡片"],
  ["modal", "弹窗"],
  ["responsive", "响应式"],
  ["data", "数据呈现"]
];

let apiPort;
let webPort;
let apiBaseUrl;
let webBaseUrl;
let baseEnv;
let visualData;

if (!existsSync(staticHtmlPath)) {
  throw new Error(`Static HTML not found: ${staticHtmlPath}`);
}

mkdirSync(outputRoot, { recursive: true });
loadEnv();

const mysqlConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "123456",
  multipleStatements: false
};

main().catch(async (error) => {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack || error.message : String(error);
  if (!keepDatabase && baseEnv?.MYSQL_DATABASE) {
    await dropDatabase().catch(() => undefined);
  }
  await writeReports();
  console.error(`TASK-022 视觉基线失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  assert(/^[a-zA-Z0-9_]+$/.test(databaseName), "视觉验证数据库名只能包含字母、数字和下划线");
  apiPort = Number(process.env.STUDYMY_VISUAL_API_PORT || await getFreePort(3322));
  webPort = Number(process.env.STUDYMY_VISUAL_WEB_PORT || await getFreePort(5182));
  apiBaseUrl = `http://127.0.0.1:${apiPort}/api`;
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  baseEnv = {
    ...process.env,
    API_PORT: String(apiPort),
    MYSQL_PORT: String(mysqlConfig.port),
    MYSQL_DATABASE: databaseName,
    REDIS_URL: "",
    JWT_SECRET: process.env.JWT_SECRET || "studymy-task022-secret",
    VITE_API_BASE_URL: apiBaseUrl
  };
  report.services = { apiBaseUrl, webBaseUrl };

  await step("准备隔离视觉验证数据库", ensureDatabase);
  await step("执行种子数据", seedDatabase);
  await step("确保 Chromium 可用", ensureBrowserRuntime);
  await step("启动 API 和用户端", startServices);
  await step("读取截图用公开数据", loadVisualData);
  await step("截取静态 HTML 与 Vue 用户端全页面截图", captureVisualBaseline);
  if (!keepDatabase) await step("清理隔离视觉验证数据库", dropDatabase);
  report.status = "passed";
  report.finishedAt = new Date().toISOString();
  await writeReports();
  console.log(JSON.stringify({
    status: report.status,
    outputRoot,
    markdownReport: join(outputRoot, "visual-diff-report.md"),
    jsonReport: join(outputRoot, "visual-diff-report.json"),
    screenshotCount: report.screenshots.length,
    comparisonCount: report.comparisons.length
  }, null, 2));
}

function loadEnv() {
  for (const envPath of [join(root, ".env"), join(root, ".env.local")]) {
    if (!existsSync(envPath)) continue;
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

async function step(name, fn) {
  const startedAt = new Date().toISOString();
  console.log(`开始：${name}`);
  try {
    const result = await fn();
    report.steps.push({ name, status: "passed", startedAt, finishedAt: new Date().toISOString(), result });
    console.log(`通过：${name}`);
    return result;
  } catch (error) {
    report.steps.push({
      name,
      status: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.stack || error.message : String(error)
    });
    throw error;
  }
}

async function ensureDatabase() {
  const connection = await createMysqlConnection();
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
  return { database: databaseName, mysqlPort: mysqlConfig.port };
}

async function dropDatabase() {
  const connection = await createMysqlConnection();
  await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  await connection.end();
  return { database: databaseName };
}

async function createMysqlConnection() {
  try {
    return await mysql.createConnection(mysqlConfig);
  } catch (error) {
    if (mysqlConfig.port !== 3306 && isConnectionRefused(error) && process.env.STUDYMY_VISUAL_STRICT_MYSQL_PORT !== "1") {
      mysqlConfig.port = 3306;
      if (baseEnv) baseEnv.MYSQL_PORT = "3306";
      return mysql.createConnection(mysqlConfig);
    }
    throw error;
  }
}

function isConnectionRefused(error) {
  return error && typeof error === "object" && "code" in error && error.code === "ECONNREFUSED";
}

async function seedDatabase() {
  await runCommand("seed", "npm", ["--workspace", "@studymy/api", "run", "seed"], {
    env: baseEnv,
    timeoutMs: 120_000
  });
  return { database: databaseName };
}

async function ensureBrowserRuntime() {
  if (process.env.STUDYMY_VISUAL_SKIP_BROWSER_INSTALL === "1") return { skipped: true };
  await runCommand("playwright-install", "npx", ["playwright", "install", "chromium"], {
    env: baseEnv,
    timeoutMs: 180_000
  });
  return { browser: "chromium" };
}

async function startServices() {
  childProcesses.push(startService("api", localBin("tsx"), ["--tsconfig", "apps/api/tsconfig.json", "apps/api/src/main.ts"]));
  await waitForUrl(`${apiBaseUrl}/universities/meta/home`, "API");

  childProcesses.push(startService("web", "npm", [
    "--workspace",
    "@studymy/web",
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    String(webPort),
    "--strictPort"
  ]));
  await waitForUrl(webBaseUrl, "用户端");
  return { apiBaseUrl, webBaseUrl };
}

function startService(name, command, args) {
  const stdoutPath = join(outputRoot, `${name}.log`);
  const stderrPath = join(outputRoot, `${name}.err.log`);
  const child = spawn(command, args, {
    cwd: root,
    env: baseEnv,
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.pipe(createWriteStream(stdoutPath, { flags: "a" }));
  child.stderr.pipe(createWriteStream(stderrPath, { flags: "a" }));
  return child;
}

async function stopServices() {
  for (const child of childProcesses.reverse()) {
    if (child.killed) continue;
    if (isWindows && child.pid) {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill();
    }
  }
}

async function runCommand(name, command, args, options = {}) {
  const stdoutPath = join(outputRoot, `${name}.log`);
  const stderrPath = join(outputRoot, `${name}.err.log`);

  await new Promise((resolvePromise, rejectPromise) => {
    const stdout = createWriteStream(stdoutPath, { flags: "a" });
    const stderr = createWriteStream(stderrPath, { flags: "a" });
    const child = spawn(command, args, {
      cwd: root,
      env: options.env || baseEnv || process.env,
      shell: isWindows,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timer = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`${name} 超时，详见 ${stderrPath}`));
    }, options.timeoutMs || 60_000);

    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      clearTimeout(timer);
      stdout.end();
      stderr.end();
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${name} 退出码 ${code}，详见 ${stderrPath}`));
    });
  });
  return { stdoutPath, stderrPath };
}

async function loadVisualData() {
  const [universities, programs] = await Promise.all([
    fetchJson(`${apiBaseUrl}/universities`),
    fetchJson(`${apiBaseUrl}/programs`)
  ]);
  const um = universities.find((item) => item.code === "UM" || item.slug.includes("universiti-malaya")) || universities[0];
  const secondUniversity = universities.find((item) => item.id !== um.id) || universities[1] || um;
  const firstProgram = programs.find((item) => item.universityId === um.id) || programs[0];
  assert(um, "截图数据中必须存在 UM 或至少一所院校");
  assert(firstProgram, "截图数据中必须存在至少一个专业");
  visualData = {
    universities,
    programs,
    um,
    secondUniversity,
    firstProgram,
    favorites: { universities: [um.id], programs: [firstProgram.id] },
    compareIds: Array.from(new Set([um.id, secondUniversity.id])).slice(0, 2)
  };
  return {
    universities: universities.length,
    programs: programs.length,
    umSlug: um.slug,
    programId: firstProgram.id
  };
}

async function captureVisualBaseline() {
  const browser = await chromium.launch({ headless });
  try {
    for (const viewport of viewports) {
      for (const scenario of scenarios) {
        const staticResult = await captureScenario(browser, "static", scenario, viewport);
        const webResult = await captureScenario(browser, "web", scenario, viewport);
        report.comparisons.push(compareScenario(scenario, viewport, staticResult, webResult));
      }
    }
  } finally {
    await browser.close();
  }
  return {
    screenshots: report.screenshots.length,
    comparisons: report.comparisons.length
  };
}

async function captureScenario(browser, target, scenario, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1
  });
  if (target === "web") {
    const storage = buildWebStorage(scenario);
    await context.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
    }, storage);
  }

  const page = await context.newPage();
  try {
    if (target === "static") await scenario.staticSetup(page);
    else await scenario.webSetup(page);
    await waitForPageReady(page);
    const screenshotPath = join(outputRoot, `${target}-${scenario.key}-${viewport.key}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
    const metrics = await collectMetrics(page, scenario.metricPairs, scenario.countPairs, target);
    const artifact = {
      target,
      scenarioKey: scenario.key,
      scenarioTitle: scenario.title,
      viewport: viewport.key,
      viewportSize: `${viewport.width}x${viewport.height}`,
      path: screenshotPath,
      metrics
    };
    report.screenshots.push({
      target: target === "static" ? "静态 HTML" : "Vue 用户端",
      page: scenario.title,
      viewport: viewport.label,
      path: screenshotPath
    });
    return artifact;
  } catch (error) {
    const failurePath = join(outputRoot, `${target}-${scenario.key}-${viewport.key}-failure.png`);
    await page.screenshot({ path: failurePath, fullPage: true }).catch(() => undefined);
    throw new Error(`${target}/${scenario.title}/${viewport.label} 截图失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close();
  }
}

function buildWebStorage(scenario) {
  const storage = {
    studymy_locale: "zh-CN"
  };
  if (scenario.key === "favorites") {
    storage.studymy_favorites = JSON.stringify(visualData.favorites);
  }
  if (scenario.key === "compare") {
    storage.studymy_compare = JSON.stringify(visualData.compareIds);
  }
  if (scenario.key === "planner" || scenario.key === "recommend-modal") {
    storage.studymy_profile = JSON.stringify({
      level: "master",
      targetCategory: "IT",
      budgetCny: 80000,
      gpa: 3.2,
      ielts: 6,
      experience: "1-3 years",
      acceptNoLanguage: true
    });
  }
  return storage;
}

async function waitForPageReady(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function collectMetrics(page, metricPairs, countPairs, target) {
  const selectors = metricPairs.map((item) => ({
    label: item.label,
    selector: target === "static" ? item.static : item.web
  }));
  const counts = countPairs.map((item) => ({
    label: item.label,
    selector: target === "static" ? item.static : item.web
  }));

  return page.evaluate(({ selectors, counts }) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const selectorMetrics = {};
    for (const item of selectors) {
      selectorMetrics[item.label] = readElementMetrics(item.selector);
    }
    const countMetrics = {};
    for (const item of counts) {
      countMetrics[item.label] = document.querySelectorAll(item.selector).length;
    }
    return {
      url: location.href,
      title: document.title,
      scrollHeight: Math.round(document.documentElement.scrollHeight),
      bodyTextLength: (document.body.innerText || "").trim().length,
      bodyTextSample: compactText(document.body.innerText || "", 220),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      root: {
        bodyBackground: bodyStyle.backgroundColor,
        bodyColor: bodyStyle.color,
        bodyFontFamily: bodyStyle.fontFamily,
        bodyFontSize: bodyStyle.fontSize,
        ink: rootStyle.getPropertyValue("--ink").trim(),
        paper: rootStyle.getPropertyValue("--paper").trim(),
        gold: rootStyle.getPropertyValue("--gold").trim(),
        teal: rootStyle.getPropertyValue("--teal").trim(),
        radius: rootStyle.getPropertyValue("--r").trim()
      },
      selectors: selectorMetrics,
      counts: countMetrics
    };

    function readElementMetrics(selector) {
      const element = document.querySelector(selector);
      if (!element) {
        return { selector, missing: true };
      }
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        tag: element.tagName.toLowerCase(),
        text: compactText(element.innerText || element.textContent || "", 120),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        display: style.display,
        position: style.position,
        gridTemplateColumns: style.gridTemplateColumns,
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        padding: style.padding,
        margin: style.margin,
        gap: style.gap
      };
    }

    function compactText(value, length) {
      return value.replace(/\s+/g, " ").trim().slice(0, length);
    }
  }, { selectors, counts });
}

function compareScenario(scenario, viewport, staticResult, webResult) {
  const diffs = Object.fromEntries(categories.map(([key]) => [key, []]));
  compareRootMetrics(staticResult.metrics, webResult.metrics, diffs);
  compareCounts(staticResult.metrics.counts, webResult.metrics.counts, diffs);

  for (const pair of scenario.metricPairs) {
    const left = staticResult.metrics.selectors[pair.label];
    const right = webResult.metrics.selectors[pair.label];
    compareElement(pair.label, left, right, diffs, scenario.kind);
  }

  if (viewport.key === "mobile") {
    const heightDelta = Math.abs(staticResult.metrics.scrollHeight - webResult.metrics.scrollHeight);
    if (heightDelta > 240) {
      diffs.responsive.push(`移动端页面总高度不同：静态 HTML ${staticResult.metrics.scrollHeight}px，Vue ${webResult.metrics.scrollHeight}px。`);
    }
  }

  for (const note of scenario.expectedNotes || []) {
    if (!hasCategorySignal(diffs, note.category, note.includes)) {
      diffs[note.category].push(note.text);
    }
  }

  return {
    page: scenario.title,
    key: scenario.key,
    viewport: viewport.label,
    viewportSize: `${viewport.width}x${viewport.height}`,
    staticScreenshot: staticResult.path,
    webScreenshot: webResult.path,
    differences: diffs,
    differenceCount: Object.values(diffs).reduce((sum, items) => sum + items.length, 0)
  };
}

function compareRootMetrics(staticMetrics, webMetrics, diffs) {
  if (normalizeCss(staticMetrics.root.bodyBackground) !== normalizeCss(webMetrics.root.bodyBackground)) {
    diffs.color.push(`页面背景不同：静态 HTML ${staticMetrics.root.bodyBackground}，Vue ${webMetrics.root.bodyBackground}。`);
  }
  if (fontFamilyHead(staticMetrics.root.bodyFontFamily) !== fontFamilyHead(webMetrics.root.bodyFontFamily)) {
    diffs.font.push(`全局字体族不同：静态 HTML ${staticMetrics.root.bodyFontFamily}，Vue ${webMetrics.root.bodyFontFamily}。`);
  }
  for (const token of ["ink", "paper", "gold", "teal", "radius"]) {
    if (staticMetrics.root[token] && webMetrics.root[token] && normalizeCss(staticMetrics.root[token]) !== normalizeCss(webMetrics.root[token])) {
      diffs.color.push(`CSS token --${token} 不一致：静态 HTML ${staticMetrics.root[token]}，Vue ${webMetrics.root[token]}。`);
    }
  }
  const scrollDelta = Math.abs(staticMetrics.scrollHeight - webMetrics.scrollHeight);
  if (scrollDelta > 320) {
    diffs.layout.push(`页面总高度差异较大：静态 HTML ${staticMetrics.scrollHeight}px，Vue ${webMetrics.scrollHeight}px。`);
  }
}

function compareCounts(staticCounts, webCounts, diffs) {
  for (const [label, staticCount] of Object.entries(staticCounts)) {
    const webCount = webCounts[label];
    if (webCount === undefined) continue;
    if (staticCount !== webCount) {
      diffs.data.push(`${label} 数量不同：静态 HTML ${staticCount}，Vue ${webCount}。`);
    }
  }
}

function compareElement(label, left, right, diffs, kind) {
  if (!left || !right) return;
  if (left.missing || right.missing) {
    diffs.layout.push(`${label} 元素可用性不同：静态 HTML ${left.missing ? "缺失" : "存在"}，Vue ${right.missing ? "缺失" : "存在"}。`);
    return;
  }

  if (Math.abs(left.rect.width - right.rect.width) > 24 || Math.abs(left.rect.height - right.rect.height) > 24) {
    diffs.layout.push(`${label} 尺寸不同：静态 HTML ${left.rect.width}x${left.rect.height}px，Vue ${right.rect.width}x${right.rect.height}px。`);
  }
  if (Math.abs(left.rect.y - right.rect.y) > 32) {
    diffs.spacing.push(`${label} 垂直位置不同：静态 HTML y=${left.rect.y}px，Vue y=${right.rect.y}px。`);
  }
  if (normalizeCss(left.backgroundColor) !== normalizeCss(right.backgroundColor)) {
    diffs.color.push(`${label} 背景色不同：静态 HTML ${left.backgroundColor}，Vue ${right.backgroundColor}。`);
  }
  if (normalizeCss(left.color) !== normalizeCss(right.color)) {
    diffs.color.push(`${label} 文字色不同：静态 HTML ${left.color}，Vue ${right.color}。`);
  }
  if (fontFamilyHead(left.fontFamily) !== fontFamilyHead(right.fontFamily)) {
    diffs.font.push(`${label} 字体不同：静态 HTML ${left.fontFamily}，Vue ${right.fontFamily}。`);
  }
  if (numberFromCss(left.fontSize) !== numberFromCss(right.fontSize)) {
    const delta = Math.abs(numberFromCss(left.fontSize) - numberFromCss(right.fontSize));
    if (delta > 1) diffs.font.push(`${label} 字号不同：静态 HTML ${left.fontSize}，Vue ${right.fontSize}。`);
  }
  if (normalizeCss(left.padding) !== normalizeCss(right.padding)) {
    diffs.spacing.push(`${label} padding 不同：静态 HTML ${left.padding}，Vue ${right.padding}。`);
  }
  if (normalizeCss(left.gap) !== normalizeCss(right.gap)) {
    diffs.spacing.push(`${label} gap 不同：静态 HTML ${left.gap}，Vue ${right.gap}。`);
  }
  if (normalizeCss(left.borderRadius) !== normalizeCss(right.borderRadius)) {
    diffs.card.push(`${label} 圆角不同：静态 HTML ${left.borderRadius}，Vue ${right.borderRadius}。`);
  }
  if (normalizeCss(left.boxShadow) !== normalizeCss(right.boxShadow)) {
    diffs.card.push(`${label} 阴影不同：静态 HTML ${left.boxShadow}，Vue ${right.boxShadow}。`);
  }
  if (left.text !== right.text) {
    diffs.data.push(`${label} 文案或字段呈现不同：静态 HTML「${left.text || "空"}」，Vue「${right.text || "空"}」。`);
  }
  if (kind === "modal") {
    diffs.modal.push(`${label} 弹窗指标：静态 HTML ${left.rect.width}x${left.rect.height}px / 圆角 ${left.borderRadius}，Vue ${right.rect.width}x${right.rect.height}px / 圆角 ${right.borderRadius}。`);
  }
}

function hasCategorySignal(diffs, category, includesText) {
  return diffs[category].some((item) => item.includes(includesText));
}

function normalizeCss(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function fontFamilyHead(value) {
  return String(value || "").split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
}

function numberFromCss(value) {
  const parsed = Number.parseFloat(String(value || "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function gotoStatic(page) {
  await page.goto(pathToFileURL(staticHtmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#app", { timeout: 30_000 });
}

async function gotoWeb(page, path = "/") {
  await page.goto(`${webBaseUrl}${path}`, { waitUntil: "domcontentloaded" });
}

const commonMetricPairs = [
  { label: "导航", static: "#nav", web: ".site-header" },
  { label: "右下浮动按钮", static: ".fab-group, .floating-tools", web: ".floating-tools" }
];

const commonCountPairs = [
  { label: "院校卡片", static: ".uni-list-card", web: ".university-card" },
  { label: "专业行", static: ".programme-grid-row", web: ".programme-grid-row" }
];

const scenarios = [
  {
    key: "home",
    title: "首页首屏",
    kind: "page",
    metricPairs: [
      ...commonMetricPairs,
      { label: "Hero 区块", static: "#hero", web: ".hero-panel" },
      { label: "Hero 标题", static: ".hero-title", web: ".hero-title" },
      { label: "搜索框", static: ".search-wrap", web: ".search-wrap" },
      { label: "统计卡片", static: ".hero-stat, .hero-metric-card", web: ".hero-metric-card" }
    ],
    countPairs: commonCountPairs,
    staticSetup: async (page) => {
      await gotoStatic(page);
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.waitForSelector(".hero-panel", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "layout", includes: "Hero", text: "重点核对 Hero 是否保持深墨色背景、居中搜索框、统计栏与静态页层级。" },
      { category: "responsive", includes: "移动端", text: "移动端需核对导航、Hero 标题、搜索框和统计卡片是否按静态断点堆叠。" }
    ]
  },
  {
    key: "list-filter",
    title: "院校列表与筛选",
    kind: "page",
    metricPairs: [
      ...commonMetricPairs,
      { label: "筛选侧栏", static: ".sidebar", web: ".filter-panel" },
      { label: "筛选分组", static: ".filter-group", web: ".filter-group" },
      { label: "活跃筛选标签", static: ".active-filter-tag, .active-tag", web: ".active-filter-tag, .active-tag" },
      { label: "院校卡片", static: ".uni-list-card", web: ".university-card" },
      { label: "卡片图片区", static: ".uni-list-img-wrap", web: ".university-card__media" }
    ],
    countPairs: commonCountPairs,
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => {
        globalThis.eval("S.filters.categories=['IT'];S.filters.levels=['硕士'];S.filters.qsRankMax=200;S.homePage=1;render()");
      });
      await page.waitForSelector(".active-filter-tag, .active-tag, .uni-list-card", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.waitForSelector(".filter-panel", { timeout: 30_000 });
      await page.locator(".filter-chip--level").nth(1).click();
      await page.locator(".filter-chip--category").first().click();
      await page.waitForSelector(".active-filter-tag, .active-tag, .university-card", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "card", includes: "院校卡片", text: "院校卡片需重点核对横向媒体区、QS 浮层、底部按钮、圆角和 hover 阴影基线。" },
      { category: "responsive", includes: "筛选", text: "移动端需核对筛选栏取消 sticky 后的纵向顺序，以及院校卡片是否由横向切为纵向。" }
    ]
  },
  {
    key: "university-detail",
    title: "UM 院校详情",
    kind: "page",
    metricPairs: [
      ...commonMetricPairs,
      { label: "详情 Hero", static: ".detail-hero", web: ".detail-hero" },
      { label: "详情标题", static: ".detail-hero h1, .detail-hero__title", web: ".detail-hero__title" },
      { label: "详情标签页", static: ".detail-tabs", web: ".detail-tabs" },
      { label: "官方信息卡片", static: ".official-card", web: ".official-card" },
      { label: "专业列表容器", static: ".programme-table-wrap", web: ".programme-table-wrap" }
    ],
    countPairs: commonCountPairs,
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.viewUni?.(1));
      await page.waitForSelector(".detail-hero", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, `/universities/${visualData.um.slug}`);
      await page.waitForSelector(".detail-hero", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "layout", includes: "详情 Hero", text: "重点核对深色详情 Hero、官方信息卡和专业列表在页面中的纵向节奏。" },
      { category: "data", includes: "UM", text: "UM 数据字段需核对 QS、官方入口、申请材料、专业数量和费用来源展示是否与静态页一致。" }
    ]
  },
  {
    key: "program-modal",
    title: "专业详情弹窗",
    kind: "modal",
    metricPairs: [
      { label: "弹窗遮罩", static: ".modal-backdrop", web: ".modal-backdrop" },
      { label: "弹窗面板", static: ".modal", web: ".program-detail-modal" },
      { label: "弹窗头部", static: ".modal-header", web: ".modal-header" },
      { label: "要求栅格", static: ".req-grid", web: ".req-grid" },
      { label: "弹窗操作区", static: ".program-modal-actions, .modal-body .btn", web: ".program-modal-actions" }
    ],
    countPairs: [
      { label: "弹窗段落", static: ".modal-section", web: ".modal-section" }
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => {
        globalThis.viewUni?.(1);
        globalThis.setUniTab?.("bachelorPrograms");
      });
      await page.waitForSelector(".programme-grid-row, [data-prog-id]", { timeout: 30_000 });
      await page.locator(".programme-grid-row, [data-prog-id]").first().click();
      await page.waitForSelector(".modal-backdrop", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, `/universities/${visualData.um.slug}`);
      await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
      await page.locator(".programme-grid-row").first().click();
      await page.waitForSelector(".program-detail-modal", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "modal", includes: "弹窗", text: "桌面端应居中显示，移动端应贴底显示；需核对遮罩、最大宽度、圆角和滚动高度。" },
      { category: "data", includes: "官方", text: "专业弹窗需核对官方总学费、语言要求、入学要求、材料、职业方向和来源状态字段。" }
    ]
  },
  {
    key: "favorites",
    title: "收藏页",
    kind: "page",
    metricPairs: [
      ...commonMetricPairs,
      { label: "收藏页主体", static: ".container.section", web: ".favorites-page" },
      { label: "收藏状态卡片", static: ".fav-empty, .card", web: ".fav-empty, .university-card" },
      { label: "收藏院校卡片", static: ".uni-list-card, .card", web: ".university-card" }
    ],
    countPairs: [
      { label: "收藏院校卡片", static: ".uni-list-card, .card", web: ".favorites-page .university-card" }
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => {
        globalThis.eval("S.favorites={universities:[1],programs:[]};ss(STORAGE_KEYS.favorites,S.favorites);nav('favorites')");
      });
      await page.waitForSelector(".fav-empty, .uni-list-card, .card", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/favorites");
      await page.waitForSelector(".favorites-page", { timeout: 30_000 });
      await page.waitForSelector(".fav-empty, .university-card", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "data", includes: "收藏", text: "收藏页需核对已收藏院校/专业、本地状态和空状态提示是否与静态页展示层级一致。" }
    ]
  },
  {
    key: "compare",
    title: "对比页",
    kind: "page",
    metricPairs: [
      ...commonMetricPairs,
      { label: "对比页主体", static: ".container.section", web: ".compare-page" },
      { label: "对比表格", static: ".compare-table", web: ".compare-table" },
      { label: "对比标签列", static: ".compare-label-col", web: ".compare-label-col" }
    ],
    countPairs: [
      { label: "对比列", static: ".compare-table th", web: ".compare-table th" }
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => {
        globalThis.eval("S.compareList=[1,2];ss(STORAGE_KEYS.compareList,S.compareList);nav('compare')");
      });
      await page.waitForSelector(".compare-table, .fav-empty", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/compare");
      await page.waitForSelector(".compare-table, .fav-empty", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "layout", includes: "对比表格", text: "对比表需核对 label 列宽、横向滚动、表头浅纸色背景和清空操作位置。" }
    ]
  },
  {
    key: "planner",
    title: "规划页",
    kind: "page",
    metricPairs: [
      ...commonMetricPairs,
      { label: "规划页主体", static: ".container.section", web: ".planner-page" },
      { label: "规划标签页", static: ".planner-tabs", web: ".planner-tabs" },
      { label: "画像表单", static: ".profile-form, .form-grid", web: ".profile-form, .profile-grid" },
      { label: "申请任务卡", static: ".task-card, .application-task-card", web: ".application-task-card, .task-card" }
    ],
    countPairs: [
      { label: "材料项", static: ".material-item", web: ".material-item" },
      { label: "申请任务", static: ".task-card, .application-task-card", web: ".task-card, .application-task-card" }
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.nav?.("planner"));
      await page.waitForSelector(".planner-tabs", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/planner");
      await page.waitForSelector(".planner-page", { timeout: 30_000 });
      await page.waitForSelector(".planner-tabs", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "layout", includes: "规划标签页", text: "规划页需核对五标签页、进度条、画像表单、材料项、申请任务卡和签证步骤顺序。" }
    ]
  },
  {
    key: "login-modal",
    title: "登录弹窗",
    kind: "modal",
    metricPairs: [
      { label: "登录遮罩", static: ".modal-backdrop", web: ".modal-backdrop" },
      { label: "登录面板", static: "#authModal .modal", web: ".auth-panel" },
      { label: "登录标签页", static: ".auth-tabs", web: ".auth-tabs" },
      { label: "登录表单", static: ".auth-modal-body", web: ".auth-form" }
    ],
    countPairs: [
      { label: "登录输入项", static: "#authModal input", web: ".auth-form input, .auth-form select" }
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.openAuth?.("login"));
      await page.waitForSelector("#authModal", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.waitForSelector(".site-header", { timeout: 30_000 });
      await page.evaluate(() => document.querySelector(".header-actions .primary-action")?.click());
      await page.waitForSelector(".auth-panel", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "modal", includes: "登录", text: "登录弹窗需核对桌面 440px 宽度、登录/注册 tab、输入控件和移动端贴底行为。" }
    ]
  },
  {
    key: "calculator-modal",
    title: "费用计算弹窗",
    kind: "modal",
    metricPairs: [
      { label: "费用遮罩", static: "#calcModal", web: ".modal-backdrop" },
      { label: "费用面板", static: "#calcModal .tool-modal-inner", web: ".tool-modal-inner--calculator" },
      { label: "费用头部", static: "#calcModal .tool-modal-header", web: ".tool-modal-header" },
      { label: "费用表单", static: "#calcModal .tool-modal-body", web: ".calculator-grid" },
      { label: "费用结果卡", static: "#calcModal .calc-result", web: ".calc-result" }
    ],
    countPairs: [
      { label: "费用输入项", static: "#calcModal input", web: ".calculator-grid input" }
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.openCalc?.());
      await page.waitForSelector("#calcModal", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.waitForSelector(".floating-tools", { timeout: 30_000 });
      await page.evaluate(() => document.querySelectorAll(".floating-tools .floating-tool")[0]?.click());
      await page.waitForSelector(".tool-modal-inner--calculator", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "modal", includes: "费用", text: "费用计算弹窗需核对深色 header、结果卡、输入项排列和移动端贴底规则。" }
    ]
  },
  {
    key: "recommend-modal",
    title: "智能推荐弹窗",
    kind: "modal",
    metricPairs: [
      { label: "推荐遮罩", static: "#recModal", web: ".modal-backdrop" },
      { label: "推荐面板", static: "#recModal .tool-modal-inner", web: ".tool-modal-inner--recommend" },
      { label: "推荐头部", static: "#recModal .tool-modal-header", web: ".tool-modal-header" },
      { label: "推荐卡片", static: "#recModal .rec-card", web: ".rec-card" },
      { label: "推荐分数", static: "#recModal .rec-score", web: ".rec-score" }
    ],
    countPairs: [
      { label: "推荐卡片", static: "#recModal .rec-card", web: ".rec-card" }
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.openRec?.());
      await page.waitForSelector("#recModal", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.waitForSelector(".floating-tools", { timeout: 30_000 });
      await page.evaluate(() => document.querySelectorAll(".floating-tools .floating-tool")[1]?.click());
      await page.waitForSelector(".tool-modal-inner--recommend", { timeout: 30_000 });
      await page.waitForSelector(".rec-card, .fav-empty", { timeout: 30_000 });
    },
    expectedNotes: [
      { category: "modal", includes: "推荐", text: "智能推荐弹窗需核对 720px 桌面宽度、推荐卡片、分数块和画像提示。" }
    ]
  }
];

async function writeReports() {
  const jsonPath = join(outputRoot, "visual-diff-report.json");
  const markdownPath = join(outputRoot, "visual-diff-report.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(markdownPath, buildMarkdownReport(), "utf8");
}

function buildMarkdownReport() {
  const lines = [];
  lines.push("# TASK-022 全页面视觉截图基线与差异清单");
  lines.push("");
  lines.push(`- 运行编号：${report.runId}`);
  lines.push(`- 静态 HTML：${report.staticHtmlPath}`);
  lines.push(`- Vue 用户端：${report.services?.webBaseUrl || "未启动"}`);
  lines.push(`- API：${report.services?.apiBaseUrl || "未启动"}`);
  lines.push(`- 输出目录：${report.outputRoot}`);
  lines.push(`- 状态：${report.status || "运行中"}`);
  lines.push("");
  lines.push("## 覆盖范围");
  lines.push("");
  lines.push("- 桌面端：1440x1000。");
  lines.push("- 移动端：390x844。");
  lines.push("- 页面和组件：首页、院校列表与筛选、UM 院校详情、专业详情弹窗、收藏页、对比页、规划页、登录弹窗、费用计算弹窗、智能推荐弹窗。");
  lines.push("- 每个目标均分别截取静态 HTML 和 Vue 用户端全页面截图。");
  lines.push("");
  lines.push("## 截图清单");
  lines.push("");
  lines.push("| 页面 | 视口 | 来源 | 截图 |");
  lines.push("| --- | --- | --- | --- |");
  for (const item of report.screenshots) {
    lines.push(`| ${item.page} | ${item.viewport} | ${item.target} | ${item.path} |`);
  }
  lines.push("");
  lines.push("## 差异清单");
  lines.push("");

  for (const comparison of report.comparisons) {
    lines.push(`### ${comparison.page} / ${comparison.viewport}（${comparison.viewportSize}）`);
    lines.push("");
    lines.push(`- 静态截图：${comparison.staticScreenshot}`);
    lines.push(`- Vue 截图：${comparison.webScreenshot}`);
    lines.push(`- 自动检测差异数：${comparison.differenceCount}`);
    lines.push("");
    for (const [key, label] of categories) {
      lines.push(`**${label}**`);
      const items = comparison.differences[key] || [];
      if (!items.length) {
        lines.push("- 自动指标未检测到明显差异，仍需结合截图人工复核。");
      } else {
        for (const item of items) lines.push(`- ${item}`);
      }
      lines.push("");
    }
  }

  lines.push("## 说明");
  lines.push("");
  lines.push("- 本报告记录差异和建立可重复截图工具，不进行大规模样式修复。");
  lines.push("- 自动检测基于 DOM 尺寸、颜色、字体、间距、卡片、弹窗、响应式高度和关键数量；最终视觉判断仍以同视口截图人工复核为准。");
  lines.push("- Notion 未在本脚本中更新；本地中文差异报告已保存到 `output/playwright/`。");
  return `${lines.join("\n")}\n`;
}

async function waitForUrl(url, label, timeoutMs = 90_000) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(1000);
  }
  throw new Error(`${label} 未在 ${timeoutMs}ms 内就绪：${url}；最后错误：${lastError}`);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function getFreePort(startPort) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolvePromise(getFreePort(startPort + 1));
      } else {
        rejectPromise(error);
      }
    });
    server.listen(startPort, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePromise(address.port));
    });
  });
}

function localBin(name) {
  return join(root, "node_modules", ".bin", isWindows ? `${name}.cmd` : name);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
