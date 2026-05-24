import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputRoot = join(root, "output", "playwright", `task035-${runStamp}`);
const childProcesses = [];
const report = {
  taskId: "TASK-035",
  runId: `task035-${runStamp}`,
  startedAt: new Date().toISOString(),
  outputRoot,
  checks: [],
  screenshots: []
};

let mockServer;
let mockPort;
let webPort;
let mockBaseUrl;
let webBaseUrl;

mkdirSync(outputRoot, { recursive: true });

main().catch(async (error) => {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack || error.message : String(error);
  await writeReport();
  console.error(`TASK-035 final release audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  mockPort = Number(process.env.STUDYMY_TASK035_API_PORT || await getFreePort(4400));
  webPort = Number(process.env.STUDYMY_TASK035_WEB_PORT || await getFreePort(5180));
  mockBaseUrl = `http://127.0.0.1:${mockPort}/api`;
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  report.services = { mockBaseUrl, webBaseUrl };

  await step("start mock API", startMockApi);
  await step("start web app", startWeb);
  await step("audit locale rendering", auditLocales);
  await step("audit TASK-040 runtime locale switch", auditRuntimeLocaleSwitch);
  await step("audit modal close and localized auth error", auditAuthModal);
  await step("audit mobile layout and asset fallback", auditMobileAndAssets);

  report.status = "passed";
  report.finishedAt = new Date().toISOString();
  await writeReport();
  console.log(JSON.stringify({
    status: report.status,
    outputRoot,
    jsonReport: join(outputRoot, "task035-final-release-audit.json"),
    screenshotCount: report.screenshots.length,
    checkCount: report.checks.length
  }, null, 2));
}

async function step(name, fn) {
  const startedAt = new Date().toISOString();
  try {
    const result = await fn();
    report.checks.push({ name, status: "passed", startedAt, finishedAt: new Date().toISOString(), result });
    return result;
  } catch (error) {
    report.checks.push({
      name,
      status: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.stack || error.message : String(error)
    });
    throw error;
  }
}

function startMockApi() {
  mockServer = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || "/", `http://127.0.0.1:${mockPort}`);
    if (request.method === "POST" && (url.pathname === "/api/auth/login" || url.pathname === "/api/auth/register")) {
      response.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ message: "Invalid account or method" }));
      return;
    }

    const payload = routePayload(url.pathname, url);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (payload == null) {
      response.writeHead(404);
      response.end(JSON.stringify({ message: "Not found" }));
      return;
    }

    response.writeHead(200);
    response.end(JSON.stringify(payload));
  });

  return new Promise((resolvePromise) => {
    mockServer.listen(mockPort, "127.0.0.1", () => resolvePromise({ mockBaseUrl }));
  });
}

async function startWeb() {
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
  ], {
    ...process.env,
    VITE_API_BASE_URL: mockBaseUrl
  }));
  await waitForUrl(webBaseUrl, "web app");
  return { webBaseUrl };
}

async function auditLocales() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK035_HEADED !== "1" });
  const locales = ["zh-CN", "zh-TW", "en", "ms"];
  const results = [];
  try {
    for (const locale of locales) {
      const context = await newContext(browser, locale, { width: 1440, height: 1000 });
      const page = await context.newPage();
      await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
      await page.locator(".hero-panel").waitFor({ timeout: 30_000 });
      await screenshot(page, `home-${locale}.png`);
      const homeText = await visibleText(page);
      assertNoLiteral(homeText, ["undefined", "category.", "Not found"], `${locale} home must not show missing values or i18n keys`);
      assertNoHorizontalOverflow(await pageMetrics(page), `${locale} home`);

      if (locale === "en" || locale === "ms") {
        assertNoCjk(homeText, `${locale} home must not render Chinese dynamic text`);
        assertNoLiteral(homeText, ["理科", "商科", "医学院", "软件"], `${locale} home must localize raw Chinese category and faculty values`);
      }

      if (locale === "zh-TW") {
        assertNoLiteral(homeText, ["软件", "责任", "农业", "公开信息", "申请规划"], "zh-TW home must not keep known Simplified Chinese samples");
      }

      await page.goto(`${webBaseUrl}/universities/universiti-malaya-um?program=1670`, { waitUntil: "domcontentloaded" });
      await page.locator(".program-detail-modal").waitFor({ timeout: 30_000 });
      await screenshot(page, `program-modal-${locale}.png`);
      const modalText = await visibleText(page);
      assertNoLiteral(modalText, ["undefined", "category.", "Not found"], `${locale} program modal must not show missing values or i18n keys`);

      if (locale === "en" || locale === "ms") {
        assertNoCjk(modalText, `${locale} program modal must not render Chinese dynamic text`);
        assertNoLiteral(modalText, ["商科", "理科", "医学院"], `${locale} program modal must localize raw category and faculty values`);
      }

      if (locale === "zh-TW") {
        assertNoLiteral(modalText, ["软件", "责任", "农业", "公开信息", "专业"], "zh-TW program modal must not keep known Simplified Chinese samples");
      }

      await page.locator(".program-detail-modal .modal-close").click();
      await page.locator(".program-detail-modal").waitFor({ state: "detached", timeout: 10_000 });
      await context.close();
      results.push({ locale, status: "passed" });
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function auditRuntimeLocaleSwitch() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK035_HEADED !== "1" });
  const expectations = {
    "zh-CN": {
      filtersTitle: "筛选条件",
      rankUnlimited: "不限",
      rankTop100: "前 100",
      budget30: "≤ CNY 30k",
      activeTuition: "CNY 0 - 30000",
      forbidden: []
    },
    en: {
      filtersTitle: "Filter conditions",
      rankUnlimited: "Unlimited",
      rankTop100: "Top 100",
      budget30: "≤ CNY 30k",
      activeTuition: "0 - 30000 CNY",
      forbidden: ["筛选条件", "不限", "前 100", "CNY 0 - 30000"]
    },
    ms: {
      filtersTitle: "Syarat tapisan",
      rankUnlimited: "Tiada had",
      rankTop100: "100 teratas",
      budget30: "CNY 30k ke bawah",
      activeTuition: "CNY 0 hingga 30000",
      forbidden: ["Filter conditions", "Unlimited", "Top 100", "筛选条件", "不限", "前 100"]
    },
    "zh-TW": {
      filtersTitle: "篩選條件",
      rankUnlimited: "不限",
      rankTop100: "前 100",
      budget30: "≤ CNY 30k",
      activeTuition: "CNY 0 - 30000",
      forbidden: ["Filter conditions", "Syarat tapisan", "Unlimited", "Tiada had", "Top 100", "100 teratas"]
    }
  };
  const locales = ["zh-CN", "en", "ms", "zh-TW"];
  const results = [];

  try {
    const context = await newContext(browser, "zh-CN", { width: 1440, height: 1000 });
    const page = await context.newPage();
    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".filter-panel").waitFor({ timeout: 30_000 });
    await assertRuntimeLocale(page, "zh-CN", expectations["zh-CN"]);

    await page.locator(".filter-chip--rank").filter({ hasText: expectations["zh-CN"].rankTop100 }).first().click();
    await page.locator(".filter-chip--budget").filter({ hasText: expectations["zh-CN"].budget30 }).first().click();
    await assertRuntimeLocale(page, "zh-CN", expectations["zh-CN"], true);
    await screenshot(page, "runtime-switch-zh-CN.png");
    results.push({ locale: "zh-CN", status: "passed" });

    for (const locale of locales.slice(1)) {
      await switchRuntimeLocale(page, locale);
      await waitForBodyText(page, expectations[locale].filtersTitle);
      await assertRuntimeLocale(page, locale, expectations[locale], true);
      await screenshot(page, `runtime-switch-${locale}.png`);
      results.push({ locale, status: "passed" });
    }

    await context.close();
  } finally {
    await browser.close();
  }

  return results;
}

async function assertRuntimeLocale(page, locale, expected, withActiveFilters = false) {
  const bodyText = await visibleText(page);
  assert(bodyText.includes(expected.filtersTitle), `${locale} should show localized filter title: ${expected.filtersTitle}`);

  const rankLabels = normalizeLabels(await page.locator(".filter-chip--rank").allTextContents());
  assert(rankLabels.includes(expected.rankUnlimited), `${locale} should show localized unlimited rank chip; received: ${rankLabels.join(", ")}`);
  assert(rankLabels.includes(expected.rankTop100), `${locale} should show localized top-rank chip; received: ${rankLabels.join(", ")}`);

  const budgetLabels = normalizeLabels(await page.locator(".filter-chip--budget").allTextContents());
  assert(budgetLabels.includes(expected.budget30), `${locale} should show localized budget chip; received: ${budgetLabels.join(", ")}`);

  if (withActiveFilters) {
    assert(bodyText.includes(expected.rankTop100), `${locale} active rank filter should be localized as ${expected.rankTop100}`);
    assert(bodyText.includes(expected.activeTuition), `${locale} active tuition filter should be localized as ${expected.activeTuition}`);
  }

  for (const forbidden of expected.forbidden) {
    assert(!bodyText.includes(forbidden), `${locale} runtime switch should not keep old-language text: ${forbidden}`);
  }
}

async function auditAuthModal() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK035_HEADED !== "1" });
  try {
    const context = await newContext(browser, "zh-CN", { width: 1440, height: 1000 });
    const page = await context.newPage();
    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".header-actions .primary-action").click();
    await page.locator(".auth-panel").waitFor({ timeout: 30_000 });
    await page.locator(".auth-form input").nth(0).fill("review@example.com");
    await page.locator(".auth-form input").nth(1).fill("wrongpass");
    await page.locator(".auth-submit").click();
    const error = page.locator(".inline-alert--error");
    await error.waitFor({ timeout: 30_000 });
    const errorText = (await error.textContent())?.trim() || "";
    assert(errorText.includes("认证失败"), `auth error should be localized, received: ${errorText}`);
    assert(!errorText.includes("Invalid account or method"), "auth error must not expose raw backend English message");
    await screenshot(page, "auth-error-zh-CN.png");
    await page.locator(".auth-panel .modal-close").click();
    await page.locator(".auth-panel").waitFor({ state: "detached", timeout: 10_000 });
    await context.close();
    return { errorText };
  } finally {
    await browser.close();
  }
}

async function auditMobileAndAssets() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK035_HEADED !== "1" });
  try {
    const context = await newContext(browser, "zh-CN", { width: 390, height: 844 });
    const page = await context.newPage();
    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".university-card").nth(1).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await screenshot(page, "mobile-home-assets.png");

    const metrics = await pageMetrics(page);
    assertNoHorizontalOverflow(metrics, "mobile home");
    assert(metrics.brokenImages.length === 0, `visible broken image elements found: ${metrics.brokenImages.join(", ")}`);
    const placeholderCount = await page.locator(".university-card__image--placeholder").count();
    assert(placeholderCount >= 1, "mocked broken university image should render the designed placeholder");
    return { placeholderCount, scrollWidth: metrics.scrollWidth, viewportWidth: metrics.viewportWidth };
  } finally {
    await browser.close();
  }
}

async function newContext(browser, locale, viewport) {
  return browser.newContext({ viewport, deviceScaleFactor: 1 }).then(async (context) => {
    await context.addInitScript((currentLocale) => {
      localStorage.clear();
      localStorage.setItem("studymy_locale", currentLocale);
    }, locale);
    return context;
  });
}

async function screenshot(page, filename) {
  const path = join(outputRoot, filename);
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
}

async function visibleText(page) {
  return page.locator("body").innerText({ timeout: 10_000 });
}

async function waitForBodyText(page, text) {
  await page.waitForFunction((expectedText) => document.body.innerText.includes(expectedText), text, { timeout: 10_000 });
}

async function switchRuntimeLocale(page, locale) {
  await page.locator(".shell-select").evaluate((element, nextLocale) => {
    if (!(element instanceof HTMLSelectElement)) {
      throw new Error("Locale selector is not a select element");
    }
    element.value = nextLocale;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, locale);
}

function normalizeLabels(values) {
  return values.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean);
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const brokenImages = Array.from(document.images)
      .filter((image) => image.currentSrc && image.complete && image.naturalWidth === 0)
      .map((image) => image.alt || image.currentSrc);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      brokenImages
    };
  });
}

function assertNoHorizontalOverflow(metrics, label) {
  assert(metrics.scrollWidth <= metrics.viewportWidth + 1, `${label} has horizontal overflow: ${metrics.scrollWidth} > ${metrics.viewportWidth}`);
}

function assertNoLiteral(text, literals, message) {
  const found = literals.filter((literal) => text.includes(literal));
  assert(found.length === 0, `${message}; found: ${found.join(", ")}`);
}

function assertNoCjk(text, message) {
  assert(!/[\u3400-\u9fff]/.test(text), message);
}

function routePayload(pathname, url) {
  if (pathname === "/api/universities/meta/home") {
    return {
      stats: {
        universityCount: universities.length,
        programCount: programs.length,
        readyProgramCount: programs.length,
        officialVerifiedCount: 2
      },
      contentBlocks: []
    };
  }
  if (pathname === "/api/universities") return universities;
  if (pathname === "/api/programs") return programs;
  if (pathname === "/api/search/suggestions") return [];
  if (pathname.startsWith("/api/universities/")) {
    const slug = pathname.split("/").pop();
    const university = universities.find((item) => item.slug === slug) || universities[0];
    return { ...university, programs: programs.filter((programItem) => programItem.universityId === university.id) };
  }
  if (pathname.startsWith("/api/programs/detail/")) {
    const id = Number(pathname.split("/").pop());
    const programItem = programs.find((item) => item.id === id) || programs[0];
    const university = universities.find((item) => item.id === programItem.universityId) || universities[0];
    return { ...programItem, university, annualCostCny: programItem.annualTuitionCny + university.livingCostCny };
  }
  return null;
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
  return child;
}

async function stopServices() {
  if (mockServer) {
    await new Promise((resolvePromise) => mockServer.close(resolvePromise));
  }
  for (const child of childProcesses.reverse()) {
    if (child.killed) continue;
    if (isWindows && child.pid) {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill();
    }
  }
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

function getFreePort(startPort) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") resolvePromise(getFreePort(startPort + 1));
      else rejectPromise(error);
    });
    server.listen(startPort, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePromise(address.port));
    });
  });
}

async function writeReport() {
  writeFileSync(join(outputRoot, "task035-final-release-audit.json"), JSON.stringify(report, null, 2), "utf8");
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const localized = (en, zhCN, ms, zhTW) => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW || zhCN
});

const localizedArray = (en, zhCN, ms, zhTW) => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW || zhCN
});

const universities = [
  {
    id: 1,
    slug: "universiti-malaya-um",
    code: "UM",
    name: localized("Universiti Malaya", "马来亚大学", "Universiti Malaya", "馬來亞大學"),
    shortName: "UM",
    nameEn: "Universiti Malaya",
    nameEnOfficial: "Universiti Malaya",
    logoUrl: transparentPixel,
    imageUrl: transparentPixel,
    color: "#003DA5",
    qsRank: 60,
    qsAsiaRank: 12,
    location: localized("Kuala Lumpur", "吉隆坡", "Kuala Lumpur", "吉隆坡"),
    region: localized("Federal Territory of Kuala Lumpur", "吉隆坡联邦直辖区", "Wilayah Persekutuan Kuala Lumpur", "吉隆坡聯邦直轄區"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1905,
    students: 30000,
    intlStudents: 5200,
    csrCertified: true,
    description: localized(
      "Malaysia's flagship research university.",
      "马来西亚旗舰研究型大学，位于吉隆坡核心区域。",
      "Universiti penyelidikan utama Malaysia.",
      "馬來西亞旗艦研究型大學，位於吉隆坡核心區域。"
    ),
    website: "https://www.um.edu.my",
    admissionEmail: "study@um.edu.my",
    officialWebsite: "https://www.um.edu.my",
    studyPortalUrl: "https://study.um.edu.my",
    internationalPageUrl: "https://study.um.edu.my/international",
    applicationPortalUrl: "https://maya.um.edu.my",
    officialAddress: "Universiti Malaya, 50603 Kuala Lumpur, Malaysia",
    applicationPeriods: ["October intake"],
    applicationFees: ["Refer to official portal"],
    applicationDocuments: localizedArray(["Passport", "Transcript"], ["护照", "成绩单"], ["Pasport", "Transkrip"], ["護照", "成績單"]),
    chinaStudentRequirements: localizedArray(["Verify official requirements."], ["中国学生需核对官方要求。"], ["Semak syarat rasmi."], ["中國學生需核對官方要求。"]),
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: "2026-05-23",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "Official source verified.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "Living cost depends on accommodation.",
    tuitionMinCny: 32000,
    tuitionMaxCny: 92000,
    livingCostCny: 30000,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: localizedArray(["Library"], ["图书馆"], ["Perpustakaan"], ["圖書館"]),
    highlights: localizedArray(["QS Top 100"], ["QS 世界排名 Top 100"], ["QS Top 100"], ["QS 世界排名 Top 100"]),
    programCount: 2
  },
  {
    id: 2,
    slug: "universiti-putra-malaysia-upm",
    code: "UPM",
    name: localized("Universiti Putra Malaysia", "博特拉大学", "Universiti Putra Malaysia", "博特拉大學"),
    shortName: "UPM",
    nameEn: "Universiti Putra Malaysia",
    nameEnOfficial: "Universiti Putra Malaysia",
    logoUrl: `${mockBaseUrl || ""}/missing-logo.png`,
    imageUrl: `${mockBaseUrl || ""}/missing-cover.png`,
    color: "#0F6B45",
    qsRank: 148,
    qsAsiaRank: 25,
    location: localized("Serdang", "雪兰莪沙登", "Serdang", "雪蘭莪沙登"),
    region: localized("Selangor", "雪兰莪", "Selangor", "雪蘭莪"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1931,
    students: 25000,
    intlStudents: 4300,
    csrCertified: true,
    description: localized("A public research university in Selangor.", "位于雪兰莪的公立研究型大学。", "Universiti penyelidikan awam di Selangor.", "位於雪蘭莪的公立研究型大學。"),
    website: "https://www.upm.edu.my",
    admissionEmail: "admission@upm.edu.my",
    officialWebsite: "https://www.upm.edu.my",
    studyPortalUrl: "https://akademik.upm.edu.my",
    internationalPageUrl: "https://intl.upm.edu.my",
    applicationPortalUrl: "https://sgsportal.upm.edu.my",
    officialAddress: "Universiti Putra Malaysia, 43400 UPM Serdang, Selangor",
    applicationPeriods: ["Refer to official system"],
    applicationFees: ["Refer to official system"],
    applicationDocuments: localizedArray(["Passport"], ["护照"], ["Pasport"], ["護照"]),
    chinaStudentRequirements: localizedArray(["Verify by programme."], ["按专业核对。"], ["Semak mengikut program."], ["按專業核對。"]),
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: "2026-05-23",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "Official source verified.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "Living cost depends on accommodation.",
    tuitionMinCny: 28000,
    tuitionMaxCny: 78000,
    livingCostCny: 26000,
    minIelts: 5.5,
    acceptNoLanguage: true,
    facilities: localizedArray(["Library"], ["图书馆"], ["Perpustakaan"], ["圖書館"]),
    highlights: localizedArray(["Research university"], ["研究型大学"], ["Universiti penyelidikan"], ["研究型大學"]),
    programCount: 2
  }
];

const programs = [
  program(1670, 1, "bachelor", "理科", "软件工程学士（软件技术）", "Bachelor of Software Engineering (Software Technology)", "计算机学院", "RM 74,200", 42000, 5.5),
  program(1671, 1, "master", "商科", "管理责任与农业生物安全硕士", "Master of Responsible Management and Agricultural Biosecurity", "医学院", "RM 52,800", 52000, 6),
  program(2670, 2, "master", "IT", "数据科学硕士", "Master of Data Science", "计算机学院", "RM 38,600", 39000, 6),
  program(2671, 2, "master", "医学", "临床医学硕士", "Master of Clinical Medicine", "医学院", "RM 40,800", 41000, 6)
];

function program(id, universityId, level, category, nameZh, nameEn, facultyZh, tuitionDisplay, annualTuitionCny, ielts) {
  return {
    id,
    universityId,
    slug: `program-${id}`,
    code: `P-${id}`,
    name: localized(nameEn, nameZh, nameEn, nameZh),
    nameEn,
    nameEnOfficial: nameEn,
    level,
    category,
    faculty: localized(facultyZh, facultyZh, facultyZh, facultyZh),
    facultyZh,
    studyMode: "Full time",
    campus: "Main campus",
    durationYears: level === "bachelor" ? 3.5 : 1.5,
    durationOfficial: level === "bachelor" ? "3.5 Years" : "1.5 Years",
    annualTuitionCny,
    tuitionAmount: null,
    tuitionCurrency: "MYR",
    tuitionDisplay,
    officialTuitionMYR: Number(tuitionDisplay.replace(/\D/g, "")) || null,
    officialFeeSourceUrl: "https://study.um.edu.my/fees",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: "2026-05-23",
    intakeMonths: ["October"],
    officialIntake: "Semester 1 (October) Intake",
    officialIntakeNote: "Subject to official intake availability.",
    languageRequirement: { ielts, toefl: 80, pte: 50, muet: 4 },
    officialLanguageRequirement: `IELTS ${ielts}`,
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: localized("Relevant academic background required.", "需具备相关学术背景。", "Latar akademik berkaitan diperlukan.", "需具備相關學術背景。") },
    officialAcademicRequirement: "Relevant academic background required.",
    chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
    applicationDocs: localizedArray(["Passport", "Transcript"], ["护照", "成绩单"], ["Pasport", "Transkrip"], ["護照", "成績單"]),
    curriculum: localizedArray(["Core course"], ["核心课程"], ["Kursus teras"], ["核心課程"]),
    careers: localizedArray(["Analyst"], ["分析师"], ["Penganalisis"], ["分析師"]),
    specializations: localizedArray([], [], [], []),
    description: localized(`${nameEn} official sample.`, `${nameZh} 是面向国际学生展示的官方项目之一。`, `${nameEn} ialah sampel rasmi.`, `${nameZh} 是面向國際學生展示的官方項目之一。`),
    officialAccreditationNote: "Refer to programme page and MQA record.",
    officialSourceUrl: "https://study.um.edu.my",
    officialEntryRequirementSourceUrl: "https://study.um.edu.my",
    officialAccreditationSourceUrl: "",
    sourceUrls: [],
    officialVerifiedAt: "2026-05-23",
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "Fee follows the latest official page.",
    listTuitionText: tuitionDisplay,
    tuitionInfo: {
      amount: Number(tuitionDisplay.replace(/\D/g, "")) || null,
      currency: "MYR",
      displayText: tuitionDisplay,
      officialAmountMYR: Number(tuitionDisplay.replace(/\D/g, "")) || null,
      sourceUrl: "https://study.um.edu.my/fees",
      secondarySourceUrl: null,
      auditStatus: "matched-official",
      auditedAt: "2026-05-23",
      note: "Accommodation and personal expenses are not included."
    },
    requirements: {
      language: { ielts, toefl: 80, pte: 50, muet: 4 },
      officialLanguageRequirement: `IELTS ${ielts}`,
      academic: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: localized("Relevant academic background required.", "需具备相关学术背景。", "Latar akademik berkaitan diperlukan.", "需具備相關學術背景。") },
      officialAcademicRequirement: "Relevant academic background required.",
      chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
      specialRequirementsNote: null
    },
    requirementInfo: {
      language: { ielts, toefl: 80, pte: 50, muet: 4 },
      officialLanguageRequirement: `IELTS ${ielts}`,
      academic: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: localized("Relevant academic background required.", "需具备相关学术背景。", "Latar akademik berkaitan diperlukan.", "需具備相關學術背景。") },
      officialAcademicRequirement: "Relevant academic background required.",
      chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
      specialRequirementsNote: null
    }
  };
}
