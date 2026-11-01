import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const staticHtmlPath = process.env.STATIC_HTML_PATH || "D:\\mydev\\StudyMY_UM_v58_na_display_tidy.html";
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputDir = join(root, "output", "playwright", `task021-${stamp}`);
const childProcesses = [];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

if (!existsSync(staticHtmlPath)) {
  throw new Error(`Static HTML not found: ${staticHtmlPath}`);
}

mkdirSync(outputDir, { recursive: true });
loadEnv();

const apiPort = Number(process.env.TASK021_API_PORT || await getFreePort(3310));
const webPort = Number(process.env.TASK021_WEB_PORT || await getFreePort(5176));
const mysqlPort = process.env.STUDYMY_VISUAL_MYSQL_PORT || (process.env.MYSQL_PORT === "5306" ? "3306" : process.env.MYSQL_PORT || "3306");
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;
const baseEnv = {
  ...process.env,
  API_PORT: String(apiPort),
  MYSQL_PORT: mysqlPort,
  REDIS_URL: "",
  JWT_SECRET: process.env.JWT_SECRET || "studymy-task021-secret",
  VITE_API_BASE_URL: apiBaseUrl
};

const report = {
  runId: `task021-${stamp}`,
  outputDir,
  staticHtmlPath,
  apiBaseUrl,
  webBaseUrl,
  mysqlPort,
  screenshots: []
};

try {
  await startServices();
  await captureScreenshots();
  const reportPath = join(outputDir, "visual-regression-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ outputDir, reportPath, screenshotCount: report.screenshots.length }, null, 2));
} finally {
  stopServices();
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
  await waitForUrl(webBaseUrl, "web");
}

function startService(name, command, args) {
  const stdoutPath = join(outputDir, `${name}.log`);
  const stderrPath = join(outputDir, `${name}.err.log`);
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

function stopServices() {
  for (const child of childProcesses.reverse()) {
    if (child.killed) continue;
    if (isWindows && child.pid) {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill();
    }
  }
}

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: process.env.TASK021_HEADED !== "1" });
  try {
    const universities = await fetchJson(`${apiBaseUrl}/universities`);
    const compareIds = universities.slice(0, 2).map((item) => item.id);

    for (const viewport of viewports) {
      await captureStatic(browser, viewport);
      await captureWeb(browser, viewport, compareIds);
    }
  } finally {
    await browser.close();
  }
}

async function captureStatic(browser, viewport) {
  await withPage(browser, viewport, async (page) => {
    await page.goto(pathToFileURL(staticHtmlPath).href, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#app", { timeout: 30_000 });
    await page.waitForTimeout(800);
    await screenshot(page, `static-home-${viewport.name}`, viewport);

    await page.evaluate(() => {
      document.querySelector(".home-layout, .main-grid, .filter-panel, .sidebar, .uni-list-card")?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(300);
    await screenshot(page, `static-list-${viewport.name}`, viewport);

    await page.evaluate(() => globalThis.viewUni?.(1));
    await page.waitForSelector(".detail-hero", { timeout: 30_000 });
    await screenshot(page, `static-university-${viewport.name}`, viewport);

    await page.evaluate(() => globalThis.setUniTab?.("bachelorPrograms"));
    await page.waitForSelector(".programme-grid-row, [data-prog-id]", { timeout: 30_000 });
    await page.locator(".programme-grid-row, [data-prog-id]").first().click();
    await page.waitForSelector(".modal-backdrop", { timeout: 30_000 });
    await screenshot(page, `static-program-modal-${viewport.name}`, viewport);

    await page.evaluate(() => {
      globalThis.closeProg?.();
      globalThis.eval("S.compareList=[1,2];nav('compare')");
    });
    await page.waitForSelector(".compare-table, .fav-empty", { timeout: 30_000 });
    await screenshot(page, `static-compare-${viewport.name}`, viewport);

    await page.evaluate(() => globalThis.nav?.("planner"));
    await page.waitForSelector(".planner-tabs", { timeout: 30_000 });
    await screenshot(page, `static-planner-${viewport.name}`, viewport);

    await page.evaluate(() => globalThis.openAuth?.("login"));
    await page.waitForSelector("#authModal, .modal-backdrop", { timeout: 30_000 });
    await screenshot(page, `static-auth-${viewport.name}`, viewport);
  });
}

async function captureWeb(browser, viewport, compareIds) {
  await withPage(browser, viewport, async (page) => {
    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".hero-panel", { timeout: 30_000 });
    await screenshot(page, `web-home-${viewport.name}`, viewport);

    await page.evaluate(() => {
      document.querySelector(".home-layout")?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(300);
    await screenshot(page, `web-list-${viewport.name}`, viewport);

    await page.goto(`${webBaseUrl}/universities/universiti-malaya-um`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".detail-hero", { timeout: 30_000 });
    await screenshot(page, `web-university-${viewport.name}`, viewport);

    await page.locator(".programme-grid-row").first().click();
    await page.waitForSelector(".program-detail-modal", { timeout: 30_000 });
    await screenshot(page, `web-program-modal-${viewport.name}`, viewport);

    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate((ids) => localStorage.setItem("studymy_compare", JSON.stringify(ids)), compareIds);
    await page.goto(`${webBaseUrl}/compare`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".compare-table, .fav-empty", { timeout: 30_000 });
    await screenshot(page, `web-compare-${viewport.name}`, viewport);

    await page.goto(`${webBaseUrl}/planner`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".planner-page", { timeout: 30_000 });
    await screenshot(page, `web-planner-${viewport.name}`, viewport);

    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".header-actions .primary-action").first().click();
    await page.waitForSelector(".auth-panel", { timeout: 30_000 });
    await screenshot(page, `web-auth-${viewport.name}`, viewport);
  });
}

async function withPage(browser, viewport, fn) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  try {
    await fn(page);
  } finally {
    await context.close();
  }
}

async function screenshot(page, name, viewport) {
  const path = join(outputDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  report.screenshots.push({ name, viewport: `${viewport.width}x${viewport.height}`, path });
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
  throw new Error(`${label} did not become ready: ${url}; last error: ${lastError}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return JSON.parse(text);
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

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
