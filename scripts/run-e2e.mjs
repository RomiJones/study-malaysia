import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import mysql from "mysql2/promise";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const taskId = "task020";
const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputRoot = join(root, "output", "e2e", `${taskId}-${runStamp}`);
const apiPort = Number(process.env.STUDYMY_E2E_API_PORT || 3200);
const webPort = Number(process.env.STUDYMY_E2E_WEB_PORT || 5174);
const adminPort = Number(process.env.STUDYMY_E2E_ADMIN_PORT || 3004);
const dbName = process.env.STUDYMY_E2E_DATABASE || "study_malaysia_e2e";
const headless = process.env.STUDYMY_E2E_HEADED !== "1";
const keepDb = process.env.STUDYMY_E2E_KEEP_DB === "1";

assert(/^[a-zA-Z0-9_]+$/.test(dbName), "E2E 测试库名只能包含字母、数字和下划线");

mkdirSync(outputRoot, { recursive: true });
loadEnv();

const mysqlConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "123456",
  multipleStatements: false
};

const childProcesses = [];
const baseEnv = {
  ...process.env,
  API_PORT: String(apiPort),
  MYSQL_DATABASE: dbName,
  REDIS_URL: "",
  JWT_SECRET: process.env.JWT_SECRET || "studymy-e2e-secret",
  VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}/api`,
  VITE_ADMIN_API_BASE_URL: "/api",
  VITE_ADMIN_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
  WEB_BASE_URL: `http://127.0.0.1:${webPort}`,
  ADMIN_BASE_URL: `http://127.0.0.1:${adminPort}`
};

const apiBaseUrl = baseEnv.VITE_API_BASE_URL;
const webBaseUrl = baseEnv.WEB_BASE_URL;
const adminBaseUrl = baseEnv.ADMIN_BASE_URL;
const report = {
  runId: `${taskId}-${runStamp}`,
  outputRoot,
  database: dbName,
  services: { api: apiBaseUrl, web: webBaseUrl, admin: adminBaseUrl },
  steps: [],
  artifacts: []
};
let shuttingDown = false;

main().catch(async (error) => {
  report.error = error instanceof Error ? error.stack || error.message : String(error);
  await writeReport("failed");
  console.error(`E2E 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  console.log(`E2E 运行目录：${outputRoot}`);
  await step("准备 E2E MySQL 数据库", ensureDatabase);
  await step("执行数据库种子数据", runSeed);
  await step("确保 Chromium 可用", ensureBrowserRuntime);
  await step("启动 API、用户端和管理端", startServices);
  await step("校验 API 数据一致性", verifyApiConsistency);
  await step("执行用户端浏览器核心流程", verifyUserWebFlow);
  await step("执行管理端登录和字段维护流程", verifyAdminFlow);

  if (!keepDb) {
    await step("清理 E2E MySQL 数据库", dropDatabase);
  } else {
    console.log(`已按 STUDYMY_E2E_KEEP_DB=1 保留测试数据库：${dbName}`);
  }

  await writeReport("passed");
  console.log("E2E 验证通过。");
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
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
  return { database: dbName, mysqlPort: mysqlConfig.port };
}

async function dropDatabase() {
  const connection = await createMysqlConnection();
  await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await connection.end();
  return { database: dbName };
}

async function createMysqlConnection() {
  try {
    return await mysql.createConnection(mysqlConfig);
  } catch (error) {
    if (mysqlConfig.port !== 3306 && isConnectionRefused(error) && process.env.STUDYMY_E2E_STRICT_MYSQL_PORT !== "1") {
      const fallbackConfig = { ...mysqlConfig, port: 3306 };
      const connection = await mysql.createConnection(fallbackConfig);
      mysqlConfig.port = fallbackConfig.port;
      baseEnv.MYSQL_PORT = String(fallbackConfig.port);
      console.log(`MySQL ${process.env.MYSQL_PORT} 不可用，已回退到 3306。`);
      return connection;
    }
    throw error;
  }
}

function isConnectionRefused(error) {
  return error && typeof error === "object" && "code" in error && error.code === "ECONNREFUSED";
}

async function runSeed() {
  await runCommand(
    "seed",
    "npm",
    ["--workspace", "@studymy/api", "run", "seed"],
    { env: baseEnv, timeoutMs: 120_000 }
  );
  return { source: "apps/api/src/db/seed.ts", database: dbName };
}

async function ensureBrowserRuntime() {
  if (process.env.STUDYMY_E2E_SKIP_BROWSER_INSTALL === "1") {
    return { skipped: true };
  }
  await runCommand("playwright-install", "npx", ["playwright", "install", "chromium"], {
    env: baseEnv,
    timeoutMs: 180_000
  });
  return { browser: "chromium" };
}

async function startServices() {
  childProcesses.push(startService("api", localBin("tsx"), ["--tsconfig", "apps/api/tsconfig.json", "apps/api/src/main.ts"], baseEnv));
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
  ], baseEnv));
  await waitForUrl(webBaseUrl, "用户端");

  childProcesses.push(startService("admin", "npm", [
    "--workspace",
    "@studymy/admin",
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    String(adminPort),
    "--strictPort"
  ], baseEnv));
  await waitForUrl(`${adminBaseUrl}/login`, "管理端");

  return { api: apiBaseUrl, web: webBaseUrl, admin: adminBaseUrl };
}

function startService(name, command, args, env) {
  const stdoutPath = join(outputRoot, `${name}.log`);
  const stderrPath = join(outputRoot, `${name}.err.log`);
  const child = spawn(command, args, {
    cwd: root,
    env,
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.pipe(createWriteStream(stdoutPath, { flags: "a" }));
  child.stderr.pipe(createWriteStream(stderrPath, { flags: "a" }));
  child.on("exit", (code, signal) => {
    if (!shuttingDown && !child.killed && code !== null && code !== 0) {
      console.error(`${name} 服务提前退出，code=${code}, signal=${signal ?? ""}`);
    }
  });
  report.artifacts.push(stdoutPath, stderrPath);
  return child;
}

async function stopServices() {
  shuttingDown = true;
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
  report.artifacts.push(stdoutPath, stderrPath);

  await new Promise((resolvePromise, rejectPromise) => {
    const stdout = createWriteStream(stdoutPath, { flags: "a" });
    const stderr = createWriteStream(stderrPath, { flags: "a" });
    const child = spawn(command, args, {
      cwd: root,
      env: options.env || baseEnv,
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

async function verifyApiConsistency() {
  const [homeMeta, universities, programs] = await Promise.all([
    fetchJson(`${apiBaseUrl}/universities/meta/home`),
    fetchJson(`${apiBaseUrl}/universities`),
    fetchJson(`${apiBaseUrl}/programs`)
  ]);

  assert(Array.isArray(universities) && universities.length >= 2, "院校列表至少需要 2 条测试数据");
  assert(Array.isArray(programs) && programs.length >= 1, "专业列表至少需要 1 条测试数据");
  assert(homeMeta.stats.universityCount === universities.length, "首页院校统计必须与院校列表一致");
  assert(homeMeta.stats.programCount === programs.length, "首页专业统计必须与专业列表一致");

  const universityWithPrograms = universities.find((university) =>
    programs.some((program) => program.universityId === university.id)
  );
  assert(universityWithPrograms, "测试数据中必须存在带专业的院校");

  const program = programs.find((item) => item.universityId === universityWithPrograms.id);
  const detail = await fetchJson(`${apiBaseUrl}/programs/detail/${program.id}`);
  assert(detail.university.id === universityWithPrograms.id, "专业详情必须关联同一所院校");
  assert(detail.publicDisplayStatus === "ready", "公开专业测试数据必须来自 ready 种子或导入结果");

  return {
    universities: universities.length,
    programs: programs.length,
    universitySlug: universityWithPrograms.slug,
    programId: program.id
  };
}

async function verifyUserWebFlow() {
  const catalog = await fetchJson(`${apiBaseUrl}/universities`);
  const programs = await fetchJson(`${apiBaseUrl}/programs`);
  const firstUniversity = catalog.find((university) => programs.some((program) => program.universityId === university.id));
  const secondUniversity = catalog.find((university) => university.id !== firstUniversity.id);
  assert(firstUniversity && secondUniversity, "用户端流程需要至少两所院校");

  await withPage("user-web", async (page) => {
    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".hero-panel").waitFor();
    await expectCount(page.locator(".university-card"), 2, "首页应渲染院校卡片");

    await page.locator(".search-input").fill(firstUniversity.code);
    await page.locator(".search-input").press("Enter");
    await expectCount(page.locator(".university-card"), 1, "搜索后应保留匹配院校");

    await page.locator(".filter-chip--level").first().click();
    await page.locator(".active-filter-tag, .active-tag").first().waitFor();

    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await expectCount(page.locator(".university-card"), 2, "重进首页后应恢复院校卡片");
    await toggleCardAction(page, 0, 0);
    await toggleCardAction(page, 0, 1);
    await toggleCardAction(page, 1, 1);
    const localState = await page.evaluate(() => ({
      favorites: JSON.parse(localStorage.getItem("studymy_favorites") || "{}"),
      compare: JSON.parse(localStorage.getItem("studymy_compare") || "[]")
    }));
    assert(localState.favorites.universities?.length >= 1, "收藏状态必须写入本地存储");
    assert(localState.compare.length >= 2, "对比状态必须写入本地存储");

    await page.goto(`${webBaseUrl}/favorites`, { waitUntil: "domcontentloaded" });
    await expectCount(page.locator(".favorites-page .university-card"), 1, "收藏页应展示收藏院校");

    await page.goto(`${webBaseUrl}/compare`, { waitUntil: "domcontentloaded" });
    await page.locator(".compare-table").waitFor();
    await expectCount(page.locator(".compare-table thead th"), 3, "对比表应展示至少两所院校");

    await page.goto(`${webBaseUrl}/universities/${firstUniversity.slug}`, { waitUntil: "domcontentloaded" });
    await page.locator(".detail-hero").waitFor();
    await page.locator(".programme-grid-row").first().click();
    await page.locator(".program-detail-modal").waitFor();
    await page.locator(".program-modal-actions .btn-primary").click();
    await page.locator(".planner-page").waitFor();
    await page.locator(".planner-hero, .planner-panel").first().waitFor();

    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".header-actions .primary-action").click();
    await page.locator(".auth-panel").waitFor();
    await page.locator(".auth-form input").nth(0).fill("demo@studymy.local");
    await page.locator(".auth-form input").nth(1).fill("Demo123!");
    await page.locator(".auth-submit").click();
    await page.waitForURL(/\/member/, { timeout: 30_000 });
    const token = await page.evaluate(() => localStorage.getItem("studymy_token"));
    assert(Boolean(token), "用户登录后必须写入 token");

    const favorites = await fetchJson(`${apiBaseUrl}/favorites`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(favorites.universityIds?.length >= 1, "登录后收藏应同步到服务端");
  });

  return { universitySlug: firstUniversity.slug, comparedSlug: secondUniversity.slug };
}

async function verifyAdminFlow() {
  const adminLogin = await fetchJson(`${apiBaseUrl}/admin/auth/login`, {
    method: "POST",
    body: JSON.stringify({ username: "superadmin", password: "Admin123!" })
  });
  const adminToken = adminLogin.data.accessToken;
  assert(adminToken, "管理端登录接口必须返回 token");

  await withPage("admin-web", async (page) => {
    await page.goto(`${adminBaseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator(".login-card input").nth(0).fill("superadmin");
    await page.locator(".login-card input").nth(1).fill("Admin123!");
    await page.locator(".login-card .el-button").click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await page.locator(".admin-layout").waitFor();
    await page.goto(`${adminBaseUrl}/universities`, { waitUntil: "domcontentloaded" });
    await page.locator(".page-card").waitFor();
    await expectCount(page.locator(".el-table__body-wrapper tbody tr"), 1, "管理端院校列表应展示种子数据");
  });

  const programList = await fetchJson(`${apiBaseUrl}/admin/programs?page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const program = programList.data.items[0];
  assert(program, "管理端字段维护需要至少一条专业数据");

  const marker = `TASK-020 E2E ${runStamp}`;
  const payload = {
    ...program,
    officialSourceUrl: program.officialSourceUrl || "https://example.edu/e2e-program-source",
    officialIntakeNote: marker,
    publicDisplayStatus: "ready",
    officialSourceStatus: program.officialSourceStatus || "needs-review"
  };
  delete payload.university;
  normalizeProgramPayloadNumbers(payload);

  const saved = await fetchJson(`${apiBaseUrl}/admin/programs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(payload)
  });
  assert(saved.data.officialIntakeNote === marker, "管理端字段维护保存结果必须包含本轮标记");

  const publicDetail = await fetchJson(`${apiBaseUrl}/programs/detail/${program.id}`);
  assert(publicDetail.officialIntakeNote === marker, "公开 API 必须能读取管理端维护后的专业字段");

  const logs = await fetchJson(`${apiBaseUrl}/admin/settings/logs?page=1&pageSize=5`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(logs.data.items.some((item) => item.module === "program" && item.action === "update"), "管理端维护必须写入操作日志");

  return { programId: program.id, marker };
}

function normalizeProgramPayloadNumbers(payload) {
  for (const field of ["id", "universityId", "durationYears", "annualTuitionCny", "tuitionAmount", "officialTuitionMYR"]) {
    if (payload[field] !== null && payload[field] !== undefined && payload[field] !== "") {
      payload[field] = Number(payload[field]);
    }
  }
}

async function withPage(name, fn) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    baseURL: webBaseUrl
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const screenshotPath = join(outputRoot, `${name}-failure.png`);
  const tracePath = join(outputRoot, `${name}-failure-trace.zip`);

  try {
    await fn(page);
    await context.tracing.stop();
  } catch (error) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    await context.tracing.stop({ path: tracePath }).catch(() => undefined);
    report.artifacts.push(screenshotPath, tracePath);
    throw error;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function toggleCardAction(page, cardIndex, actionIndex) {
  await page
    .locator(".university-card")
    .nth(cardIndex)
    .locator(".university-card__actions .ghost-action")
    .nth(actionIndex)
    .click();
}

async function expectCount(locator, minCount, message) {
  await locator.first().waitFor({ timeout: 30_000 });
  const count = await locator.count();
  assert(count >= minCount, `${message}，当前数量 ${count}`);
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
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return body;
}

async function writeReport(status) {
  report.status = status;
  report.finishedAt = new Date().toISOString();
  const reportPath = join(outputRoot, "report.json");
  await import("node:fs/promises").then(({ writeFile }) => writeFile(reportPath, JSON.stringify(report, null, 2), "utf8"));
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
