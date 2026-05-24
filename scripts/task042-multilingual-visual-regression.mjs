import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const taskId = "task042";
const staticHtmlPath = process.env.STATIC_HTML_PATH || "D:\\mydev\\StudyMY_UM_v58_na_display_tidy.html";
const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputRoot = join(root, "output", "playwright", `${taskId}-${runStamp}`);
const permanentReportPath = join(root, "docs", "prd", "TASK-042-multilingual-visual-regression-report.md");
const childProcesses = [];

const localLogo = "/assets/static-html/fallback-university-logo.svg";
const localCover = "/assets/static-html/image-photo-1562774053-701939374585-3a3ba5b0250f.jpg";
const localCoverAlt = "/assets/static-html/card-image-photo-1541339907198-e08756dedf3f-8421a6bf5c1a.jpg";
const localCoverThird = "/assets/static-html/card-image-photo-1498243691581-b145c3f54a5a-35fe71643bf3.jpg";

const locales = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁体中文" },
  { code: "en", label: "English" },
  { code: "ms", label: "Bahasa Melayu" }
];

const viewports = [
  { key: "desktop", label: "桌面端 1440x1000", width: 1440, height: 1000 },
  { key: "mobile", label: "移动端 390x844", width: 390, height: 844 }
];

const report = {
  taskId: "TASK-042",
  runId: `${taskId}-${runStamp}`,
  startedAt: new Date().toISOString(),
  staticHtmlPath,
  staticReferenceAvailable: existsSync(staticHtmlPath),
  outputRoot,
  screenshots: [],
  scenarios: [],
  checks: [],
  totals: null,
  remainingRisks: [
    "本轮使用固定 mock API 覆盖四语言视觉、混合语言、图片和弹窗状态，避免本地数据库内容差异影响判断。",
    "静态 HTML 作为视觉参考路径做可访问性确认；本任务重点是 Vue 用户端四语言回归，不执行逐像素静态页对比。",
    "官方英文院校名、专业英文名、QS、IELTS、TOEFL、GPA、RM、CNY 和 URL 属于允许保留的官方或通用表达。"
  ]
};

const scenarios = [
  scenario("home", "首页", "/", ".hero-panel"),
  scenario("university-list", "院校列表", "/", ".university-card", async (page) => {
    await page.locator(".filter-panel").waitFor({ timeout: 30_000 });
    await page.evaluate(() => document.querySelector(".home-layout")?.scrollIntoView({ block: "start" }));
  }),
  scenario("university-overview", "院校详情概览", "/universities/universiti-malaya-um", ".detail-hero"),
  scenario("university-bachelor", "院校详情本科专业", "/universities/universiti-malaya-um", ".programme-grid-row", async (page) => clickDetailTab(page, 1)),
  scenario("university-master", "院校详情硕士专业", "/universities/universiti-malaya-um", ".programme-grid-row", async (page) => clickDetailTab(page, 2)),
  scenario("university-phd", "院校详情博士专业", "/universities/universiti-malaya-um", ".programme-grid-row", async (page) => clickDetailTab(page, 3)),
  scenario("university-facilities", "校园设施", "/universities/universiti-malaya-um", ".highlight-item--facility", async (page) => clickDetailTab(page, 4)),
  scenario("university-apply", "申请信息", "/universities/universiti-malaya-um", ".official-apply-card", async (page) => clickDetailTab(page, 5)),
  scenario("program-modal", "专业详情弹窗", "/universities/universiti-malaya-um?program=1670", ".program-detail-modal", undefined, { kind: "modal" }),
  scenario("favorites", "收藏", "/favorites", ".favorite-university-card, .fav-empty"),
  scenario("compare", "对比", "/compare", ".compare-table"),
  scenario("planner-overview", "规划", "/planner", ".planner-tabs"),
  scenario("planner-materials", "规划材料清单", "/planner", ".material-item", async (page) => clickPlannerTab(page, 2)),
  scenario("planner-visa", "规划签证清单", "/planner", ".visa-step", async (page) => clickPlannerTab(page, 4)),
  scenario("member", "会员中心", "/member", ".section-card", undefined, { requiresAuth: true }),
  scenario("login-modal", "登录弹窗", "/", ".auth-panel", async (page) => {
    await page.locator(".hero-panel").waitFor({ timeout: 30_000 });
    await page.locator(".header-actions .primary-action").click();
  }, { kind: "modal", authError: true }),
  scenario("calculator-modal", "费用计算弹窗", "/", ".tool-modal-inner--calculator", async (page) => {
    await page.locator(".hero-panel").waitFor({ timeout: 30_000 });
    await page.locator(".floating-tools .floating-tool").first().click();
  }, { kind: "modal" }),
  scenario("recommend-modal", "推荐弹窗", "/", ".tool-modal-inner--recommend", async (page) => {
    await page.locator(".hero-panel").waitFor({ timeout: 30_000 });
    await page.locator(".floating-tools .floating-tool").nth(1).click();
  }, { kind: "modal" })
];

let mockServer;
let mockPort;
let webPort;
let mockBaseUrl;
let webBaseUrl;

if (!report.staticReferenceAvailable) {
  throw new Error(`Static HTML not found: ${staticHtmlPath}`);
}

mkdirSync(outputRoot, { recursive: true });

main().catch(async (error) => {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack || error.message : String(error);
  report.finishedAt = new Date().toISOString();
  await writeReports();
  console.error(`TASK-042 multilingual visual regression failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  mockPort = Number(process.env.STUDYMY_TASK042_API_PORT || await getFreePort(4700));
  webPort = Number(process.env.STUDYMY_TASK042_WEB_PORT || await getFreePort(5300));
  mockBaseUrl = `http://127.0.0.1:${mockPort}/api`;
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  report.services = { mockBaseUrl, webBaseUrl };

  await step("确认静态 HTML 视觉参考可访问", verifyStaticReference);
  await step("启动 mock API", startMockApi);
  await step("启动用户端", startWeb);
  await step("执行四语言全页面视觉回归", runBrowserAudit);

  const blockingIssues = report.scenarios.flatMap((item) => item.blockingIssues);
  report.totals = summarizeTotals();
  report.status = blockingIssues.length ? "failed" : "passed";
  report.finishedAt = new Date().toISOString();
  await writeReports();

  console.log(JSON.stringify({
    status: report.status,
    outputRoot: normalizePath(outputRoot),
    markdownReport: normalizePath(join(outputRoot, "multilingual-visual-regression-report.md")),
    jsonReport: normalizePath(join(outputRoot, "multilingual-visual-regression-report.json")),
    permanentReport: normalizePath(permanentReportPath),
    screenshotCount: report.screenshots.length,
    scenarioCount: report.scenarios.length,
    blockingIssueCount: blockingIssues.length,
    totals: report.totals
  }, null, 2));

  if (blockingIssues.length) process.exitCode = 1;
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

function verifyStaticReference() {
  return {
    staticHtmlPath,
    available: report.staticReferenceAvailable
  };
}

function startMockApi() {
  mockServer = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || "/", `http://127.0.0.1:${mockPort}`);
    const payload = routePayload(url.pathname, url, request.method || "GET");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (payload == null) {
      response.writeHead(404);
      response.end(JSON.stringify({ message: "Not found" }));
      return;
    }
    if (payload.statusCode) {
      response.writeHead(payload.statusCode);
      response.end(JSON.stringify(payload.body));
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
  await waitForUrl(webBaseUrl, "用户端");
  return { webBaseUrl };
}

async function runBrowserAudit() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK042_HEADED !== "1" });
  try {
    for (const viewport of viewports) {
      for (const locale of locales) {
        for (const item of scenarios) {
          const result = await captureScenario(browser, locale, viewport, item);
          report.scenarios.push(result);
        }
      }
    }
  } finally {
    await browser.close();
  }
  return { screenshots: report.screenshots.length, scenarios: report.scenarios.length };
}

async function captureScenario(browser, locale, viewport, item) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1
  });
  await routeFonts(context);
  await context.addInitScript((storage) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
  }, localStorageFixture(locale.code, item.requiresAuth));

  const page = await context.newPage();
  const audit = attachRequestAudit(page);
  const blockingIssues = [];
  const warnings = [];
  try {
    await page.goto(`${webBaseUrl}${item.path}`, { waitUntil: "domcontentloaded" });
    if (item.setup) await item.setup(page, locale);
    await page.locator(item.readySelector).first().waitFor({ timeout: 30_000 });
    if (item.authError) await triggerAuthError(page, locale.code);
    await waitForPageReady(page);

    const screenshotPath = await screenshot(page, `${viewport.key}-${locale.code}-${item.key}.png`, item, viewport, locale);
    const metrics = await collectPageMetrics(page, item.kind);
    const text = await page.locator("body").innerText({ timeout: 10_000 });

    blockingIssues.push(...languageIssues(locale.code, text));
    blockingIssues.push(...technicalTextIssues(text));
    blockingIssues.push(...layoutIssues(metrics, item, viewport));
    blockingIssues.push(...assetIssues(metrics, audit));

    if (metrics.textOverflow.length) {
      warnings.push(`检测到 ${metrics.textOverflow.length} 个普通文本溢出候选，已列入阻塞前明细。`);
    }

    return {
      key: item.key,
      page: item.title,
      locale: locale.code,
      localeLabel: locale.label,
      viewport: viewport.label,
      viewportSize: `${viewport.width}x${viewport.height}`,
      screenshot: normalizePath(screenshotPath),
      status: blockingIssues.length ? "failed" : "passed",
      blockingIssues,
      warnings,
      textOverflow: metrics.textOverflow,
      buttonWrapIssues: metrics.buttonWrapIssues,
      brokenImages: metrics.brokenImages,
      failedImageRequests: audit.failedImageRequests,
      failedImageResponses: audit.failedImageResponses,
      externalImageRequests: audit.externalImageRequests,
      horizontalOverflow: metrics.horizontalOverflow,
      modal: metrics.modal,
      visibleImageCount: metrics.visibleImageCount
    };
  } finally {
    await context.close();
  }
}

async function clickDetailTab(page, index) {
  await page.locator(".detail-hero").waitFor({ timeout: 30_000 });
  await page.locator(".detail-tab").nth(index).click();
}

async function clickPlannerTab(page, index) {
  await page.locator(".planner-tabs").waitFor({ timeout: 30_000 });
  await page.locator(".planner-tab").nth(index).click();
}

async function triggerAuthError(page, locale) {
  await page.locator(".auth-form input").nth(0).fill(`${locale.toLowerCase()}-review@example.com`);
  await page.locator(".auth-form input").nth(1).fill("wrongpass");
  await page.locator(".auth-submit").click();
  await page.locator(".inline-alert--error").waitFor({ timeout: 30_000 });
}

async function waitForPageReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(350);
}

async function screenshot(page, filename, item, viewport, locale) {
  const path = join(outputRoot, filename);
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push({
    page: item.title,
    key: item.key,
    locale: locale.code,
    viewport: viewport.label,
    path: normalizePath(path)
  });
  return path;
}

function attachRequestAudit(page) {
  const audit = {
    failedRequests: [],
    failedImageRequests: [],
    failedImageResponses: [],
    externalImageRequests: []
  };

  page.on("request", (request) => {
    if (request.resourceType() !== "image") return;
    const url = request.url();
    if (!isLocalImageUrl(url)) audit.externalImageRequests.push(url);
  });
  page.on("requestfailed", (request) => {
    const detail = `${request.url()} ${request.failure()?.errorText || ""}`.trim();
    audit.failedRequests.push(detail);
    if (request.resourceType() === "image") audit.failedImageRequests.push(detail);
  });
  page.on("response", (response) => {
    const request = response.request();
    if (request.resourceType() !== "image") return;
    if (response.status() >= 400) audit.failedImageResponses.push(`${response.status()} ${response.url()}`);
  });

  return audit;
}

async function collectPageMetrics(page, kind) {
  return page.evaluate((scenarioKind) => {
    const ignoredOverflowSelectors = [
      ".programme-table-wrap",
      ".compare-table-scroll",
      ".modal-body",
      ".tool-modal-body",
      ".planner-tabs",
      ".detail-tabs",
      ".floating-tools",
      ".official-link-card small"
    ];
    const ignoredButtonWrapSelectors = [
      ".floating-tool",
      ".modal-close",
      ".tool-modal-close",
      ".compare-remove"
    ];

    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const isIgnored = (element, selectors) => selectors.some((selector) => element.closest(selector));
    const selectorFor = (element) => {
      const className = typeof element.className === "string" ? element.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      return `${element.tagName.toLowerCase()}${className ? `.${className}` : ""}`;
    };

    const textOverflow = [];
    const leafElements = Array.from(document.body.querySelectorAll("body *"))
      .filter((element) => {
        if (!isVisible(element) || isIgnored(element, ignoredOverflowSelectors)) return false;
        if (element.children.length && Array.from(element.children).some((child) => child.textContent?.trim())) return false;
        return Boolean(element.textContent?.replace(/\s+/g, " ").trim());
      });

    for (const element of leafElements) {
      const style = getComputedStyle(element);
      const overflowX = element.scrollWidth - element.clientWidth;
      const overflowY = element.scrollHeight - element.clientHeight;
      const visiblySpillsX = overflowX > 3 && style.overflowX === "visible" && style.textOverflow !== "ellipsis";
      if (visiblySpillsX || (overflowY > 4 && style.overflowY === "hidden" && style.textOverflow !== "ellipsis")) {
        textOverflow.push({
          selector: selectorFor(element),
          text: element.textContent.replace(/\s+/g, " ").trim().slice(0, 120),
          overflowX,
          overflowY,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth
        });
      }
    }

    const buttonWrapIssues = [];
    for (const button of Array.from(document.querySelectorAll("button, .btn, .primary-action, .secondary-action"))) {
      if (!isVisible(button) || isIgnored(button, ignoredButtonWrapSelectors)) continue;
      const text = button.textContent?.replace(/\s+/g, " ").trim() || "";
      if (!text) continue;
      const style = getComputedStyle(button);
      const overflowX = button.scrollWidth - button.clientWidth;
      if (overflowX > 3 && style.overflowX === "visible" && style.textOverflow !== "ellipsis") {
        buttonWrapIssues.push({
          selector: selectorFor(button),
          text: text.slice(0, 120),
          overflowX
        });
      }
    }

    const brokenImages = Array.from(document.images)
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && image.currentSrc && image.complete && image.naturalWidth === 0;
      })
      .map((image) => image.alt || image.currentSrc);

    const visibleImageCount = Array.from(document.images).filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }).length;

    const modalElement = scenarioKind === "modal"
      ? document.querySelector(".program-detail-modal, .auth-panel, .tool-modal-inner")
      : null;
    const modal = modalElement
      ? (() => {
        const rect = modalElement.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom)
        };
      })()
      : null;

    return {
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      textOverflow,
      buttonWrapIssues,
      brokenImages,
      visibleImageCount,
      modal
    };
  }, kind);
}

function languageIssues(locale, text) {
  const issues = [];
  if (locale === "en" || locale === "ms") {
    const cjkMatches = [...new Set(text.match(/[\u3400-\u9fff]+/g) || [])].slice(0, 12);
    if (cjkMatches.length) {
      issues.push(`${locale} 页面出现中文字符：${cjkMatches.join("、")}`);
    }
  }

  if (locale === "zh-CN" || locale === "zh-TW" || locale === "ms") {
    const leaked = forbiddenEnglishRuntimeSamples.filter((sample) => text.includes(sample));
    if (leaked.length) issues.push(`${locale} 页面暴露未本地化英文运行时文案：${leaked.join("；")}`);
  }

  if (locale === "zh-TW") {
    const simplifiedHits = knownSimplifiedSamples.filter((sample) => text.includes(sample));
    if (simplifiedHits.length) issues.push(`繁体页面残留简体词：${simplifiedHits.join("、")}`);
  }

  const oldLanguageHits = forbiddenCrossLocaleSamples[locale]
    .filter((sample) => text.includes(sample));
  if (oldLanguageHits.length) issues.push(`${locale} 页面出现其他语言界面文案：${oldLanguageHits.join("、")}`);

  return issues;
}

function technicalTextIssues(text) {
  const markers = ["undefined", "null", "[object Object]", "category.", "Not found", "Missing translation", "Invalid account or method"];
  const hits = markers.filter((marker) => text.includes(marker));
  return hits.length ? [`页面出现缺失值、技术错误或后端原始错误：${hits.join("、")}`] : [];
}

function layoutIssues(metrics, item, viewport) {
  const issues = [];
  if (metrics.horizontalOverflow > 1) {
    issues.push(`整页横向溢出 ${metrics.horizontalOverflow}px。`);
  }
  if (metrics.textOverflow.length) {
    issues.push(`存在 ${metrics.textOverflow.length} 个文本溢出候选：${metrics.textOverflow.slice(0, 4).map((entry) => `${entry.selector} "${entry.text}"`).join("；")}`);
  }
  if (metrics.buttonWrapIssues.length) {
    issues.push(`存在 ${metrics.buttonWrapIssues.length} 个按钮文字溢出或异常换行：${metrics.buttonWrapIssues.slice(0, 4).map((entry) => `${entry.selector} "${entry.text}"`).join("；")}`);
  }
  if (item.kind === "modal") {
    if (!metrics.modal) {
      issues.push("未检测到弹窗面板。");
    } else {
      if (metrics.modal.width > viewport.width + 2) issues.push(`弹窗宽度超出视口：${metrics.modal.width}px / ${viewport.width}px。`);
      if (metrics.modal.right > viewport.width + 2 || metrics.modal.x < -2) issues.push("弹窗横向位置超出视口。");
      if (metrics.modal.bottom > viewport.height + 2 && viewport.key !== "mobile") issues.push("桌面端弹窗底部超出视口。");
      if (viewport.key === "mobile" && metrics.modal.height > viewport.height + 2) issues.push("移动端弹窗高度超出视口。");
    }
  }
  return issues;
}

function assetIssues(metrics, audit) {
  const issues = [];
  if (metrics.brokenImages.length) issues.push(`可见 DOM 图片破图：${metrics.brokenImages.join("、")}`);
  if (audit.failedImageRequests.length) issues.push(`图片请求失败：${audit.failedImageRequests.join("、")}`);
  if (audit.failedImageResponses.length) issues.push(`图片响应异常：${audit.failedImageResponses.join("、")}`);
  return issues;
}

function summarizeTotals() {
  return report.scenarios.reduce((acc, item) => {
    acc.checkedScenarios += 1;
    acc.failedScenarios += item.blockingIssues.length ? 1 : 0;
    acc.screenshots = report.screenshots.length;
    acc.textOverflow += item.textOverflow.length;
    acc.buttonWrapIssues += item.buttonWrapIssues.length;
    acc.brokenImages += item.brokenImages.length;
    acc.failedImageRequests += item.failedImageRequests.length + item.failedImageResponses.length;
    acc.externalImageRequests += item.externalImageRequests.length;
    acc.horizontalOverflow += item.horizontalOverflow > 1 ? 1 : 0;
    acc.visibleImages += item.visibleImageCount;
    return acc;
  }, {
    checkedScenarios: 0,
    failedScenarios: 0,
    screenshots: 0,
    textOverflow: 0,
    buttonWrapIssues: 0,
    brokenImages: 0,
    failedImageRequests: 0,
    externalImageRequests: 0,
    horizontalOverflow: 0,
    visibleImages: 0
  });
}

async function routeFonts(context) {
  await context.route(/fonts\.(gstatic|googleapis)\.com/, (route) => route.fulfill({
    status: 204,
    body: ""
  }));
}

function isLocalImageUrl(url) {
  return url.startsWith("data:image/") ||
    url.startsWith("blob:") ||
    url.startsWith(webBaseUrl) ||
    url.startsWith(mockBaseUrl);
}

function routePayload(pathname, url, method) {
  if (method === "POST" && (pathname === "/api/auth/login" || pathname === "/api/auth/register")) {
    return {
      statusCode: 401,
      body: { message: "Invalid account or method" }
    };
  }
  if (pathname === "/api/auth/me") {
    return userFixture;
  }
  if (pathname === "/api/universities/meta/home") {
    return {
      stats: {
        universityCount: universities.length,
        programCount: programs.length,
        readyProgramCount: programs.length,
        bestQsRank: 60,
        officialVerifiedCount: universities.length
      },
      contentBlocks: []
    };
  }
  if (pathname === "/api/universities") return universities;
  if (pathname === "/api/programs") return programs;
  if (pathname === "/api/search/suggestions") {
    const query = (url.searchParams.get("q") || "").trim();
    if (!query) return [];
    return [
      {
        id: "u-1",
        type: "university",
        title: "Universiti Malaya",
        subtitle: "Kuala Lumpur",
        highlight: query,
        score: 1,
        universityId: 1,
        universitySlug: "universiti-malaya-um"
      },
      {
        id: "p-1670",
        type: "program",
        title: "Bachelor of Software Engineering",
        subtitle: "Universiti Malaya",
        highlight: query,
        score: 0.9,
        universityId: 1,
        universitySlug: "universiti-malaya-um",
        programId: 1670
      }
    ];
  }
  if (pathname === "/api/favorites" || pathname === "/api/favorites/merge") {
    return { universityIds: [1, 2], programIds: [1670, 1671] };
  }
  if (pathname === "/api/compare" || pathname === "/api/compare/merge") {
    return { universityIds: [1, 2, 3] };
  }
  if (pathname === "/api/planner" || pathname === "/api/planner/merge-local-state") {
    const dashboard = plannerDashboard();
    return pathname.endsWith("merge-local-state") ? { dashboard } : dashboard;
  }
  if (pathname.startsWith("/api/universities/")) {
    const slug = pathname.split("/").pop();
    const university = universities.find((item) => item.slug === slug) || universities[0];
    return { ...university, programs: programs.filter((program) => program.universityId === university.id) };
  }
  if (pathname.startsWith("/api/programs/detail/")) {
    const id = Number(pathname.split("/").pop());
    const programItem = programs.find((item) => item.id === id) || programs[0];
    const university = universities.find((item) => item.id === programItem.universityId) || universities[0];
    return { ...programItem, university, annualCostCny: programItem.annualTuitionCny + university.livingCostCny };
  }
  if (pathname.startsWith("/api/programs/")) {
    const slug = pathname.split("/").pop();
    const programItem = programs.find((item) => item.slug === slug) || programs[0];
    const university = universities.find((item) => item.id === programItem.universityId) || universities[0];
    return { ...programItem, university, annualCostCny: programItem.annualTuitionCny + university.livingCostCny };
  }
  return null;
}

function localStorageFixture(locale, withAuth = false) {
  const storage = {
    studymy_locale: locale,
    studymy_favorites: JSON.stringify({ universities: [1, 2], programs: [1670, 1671] }),
    studymy_compare: JSON.stringify([1, 2, 3]),
    studymy_profile: JSON.stringify({
      level: "master",
      targetCategory: "IT",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6,
      experience: "1-3 years",
      acceptNoLanguage: true
    }),
    studymy_material_progress: JSON.stringify({
      passport: "done",
      photo: "progress",
      transcript: "wait",
      language: "draft",
      degree_certificate: "progress",
      study_plan: "done",
      recommendation: "wait"
    }),
    studymy_visa_checklist: JSON.stringify({
      offerAccepted: true,
      depositPaid: true,
      visaDocsReady: false,
      preDeparture: false,
      arrivalReady: false
    })
  };
  if (withAuth) {
    storage.studymy_token = "task042-token";
    storage.studymy_user = JSON.stringify(userFixture);
  }
  return storage;
}

function plannerDashboard() {
  const recommendationPrograms = programs.filter((program) => program.level === "master" && program.category.toLowerCase() === "it");
  const recommendations = recommendationPrograms.map((program, index) => {
    const university = universities.find((item) => item.id === program.universityId) || universities[0];
    return {
      score: 88 - index * 6,
      reasons: localizedArray(
        ["Academic profile fits", "Budget is close"],
        ["学术背景匹配", "预算接近"],
        ["Profil akademik sepadan", "Belanjawan hampir sepadan"],
        ["學術背景匹配", "預算接近"]
      ),
      university,
      program,
      annualCostCny: program.annualTuitionCny + university.livingCostCny
    };
  });
  return {
    profile: {
      level: "master",
      targetCategory: "IT",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6,
      experience: "1-3 years",
      acceptNoLanguage: true
    },
    materials: [
      material("passport", "Passport bio page", "护照首页扫描件", "Halaman biodata pasport", "Clear scan with at least six months validity.", "清晰扫描件，护照有效期至少六个月。", "Salinan imbasan jelas dengan tempoh sah sekurang-kurangnya enam bulan.", "done"),
      material("transcript", "Academic transcript", "英文版成绩单", "Transkrip akademik", "English transcript issued by the previous school or an official authority.", "原就读学校或官方出具的英文成绩单。", "Transkrip bahasa Inggeris yang dikeluarkan oleh sekolah terdahulu atau pihak rasmi.", "wait"),
      material("language", "Language score", "英语成绩证明", "Bukti skor bahasa Inggeris", "IELTS, TOEFL or university-accepted conditional-language route.", "IELTS、TOEFL 或院校认可的条件语言路径。", "IELTS, TOEFL atau laluan bahasa bersyarat yang diterima universiti.", "draft"),
      material("recommendation", "Recommendation letter", "推荐信", "Surat cadangan", "Academic or professional references.", "准备学术或职业推荐信。", "Sediakan rujukan akademik atau profesional.", "progress")
    ],
    tasks: [
      {
        id: -116701,
        universityId: 1,
        programId: 1671,
        tier: localized("Target", "主申", "Target", "主申"),
        stage: "materials",
        progress: 45,
        deadlineNote: localized("Within 10 days", "建议 10 天内补齐", "Dalam 10 hari", "建議 10 天內補齊"),
        nextAction: localized("Complete documents.", "补齐申请材料。", "Lengkapkan dokumen.", "補齊申請材料。")
      }
    ],
    visaChecklist: {
      offerAccepted: true,
      depositPaid: true,
      visaDocsReady: false,
      preDeparture: false,
      arrivalReady: false
    },
    summary: {
      readinessScore: 78,
      materialCompletion: 45,
      profileCompleteness: 94,
      recommendationCount: recommendations.length,
      activeTaskCount: 1,
      visaDoneCount: 2
    },
    recommendations
  };
}

function material(key, nameEn, nameZh, nameMs, noteEn, noteZh, noteMs, status) {
  return {
    key,
    name: localized(nameEn, nameZh, nameMs),
    note: localized(noteEn, noteZh, noteMs),
    status
  };
}

function scenario(key, title, path, readySelector, setup, options = {}) {
  return {
    key,
    title,
    path,
    readySelector,
    setup,
    kind: options.kind || "page",
    authError: Boolean(options.authError),
    requiresAuth: Boolean(options.requiresAuth)
  };
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
  throw new Error(`${label} 未在 ${timeoutMs}ms 内就绪：${url}；最后错误：${lastError}`);
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

async function writeReports() {
  const jsonPath = join(outputRoot, "multilingual-visual-regression-report.json");
  const markdownPath = join(outputRoot, "multilingual-visual-regression-report.md");
  const markdown = buildMarkdownReport();
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(markdownPath, markdown, "utf8");
  writeFileSync(permanentReportPath, markdown, "utf8");
}

function buildMarkdownReport() {
  const blockingIssues = report.scenarios.flatMap((item) => item.blockingIssues.map((issue) => ({ item, issue })));
  const totals = report.totals || summarizeTotals();
  const lines = [];
  lines.push("# TASK-042 多语言全页面视觉回归和混合语言收口验收报告");
  lines.push("");
  lines.push("## 摘要");
  lines.push("");
  lines.push("- **任务编号**: TASK-042");
  lines.push(`- **运行编号**: ${report.runId}`);
  lines.push(`- **生成时间**: ${report.finishedAt || report.startedAt}`);
  lines.push(`- **状态**: ${report.status || "运行中"}`);
  lines.push(`- **静态 HTML 参考**: \`${report.staticHtmlPath}\``);
  lines.push(`- **静态参考可访问**: ${report.staticReferenceAvailable ? "是" : "否"}`);
  lines.push(`- **用户端地址**: \`${report.services?.webBaseUrl || "未启动"}\``);
  lines.push(`- **输出目录**: \`${normalizePath(report.outputRoot)}\``);
  lines.push("");
  lines.push("## 覆盖范围");
  lines.push("");
  lines.push(`- 语言：${locales.map((item) => `${item.label}（${item.code}）`).join("、")}。`);
  lines.push(`- 视口：${viewports.map((item) => item.label).join("、")}。`);
  lines.push(`- 页面和弹窗：${scenarios.map((item) => item.title).join("、")}。`);
  lines.push(`- 全页面截图：${totals.screenshots} 张。`);
  lines.push("");
  lines.push("## 自动检测结论");
  lines.push("");
  lines.push(`- 检查场景数：${totals.checkedScenarios}，失败场景数：${totals.failedScenarios}。`);
  lines.push(`- 可见图片数：${totals.visibleImages}；破图数：${totals.brokenImages}；失败图片请求数：${totals.failedImageRequests}。`);
  lines.push(`- 文本溢出候选：${totals.textOverflow}；按钮文字溢出或异常换行：${totals.buttonWrapIssues}；整页横向溢出场景：${totals.horizontalOverflow}。`);
  lines.push("");
  lines.push("## 阻塞问题");
  lines.push("");
  if (blockingIssues.length) {
    for (const { item, issue } of blockingIssues) {
      lines.push(`- ${item.localeLabel} / ${item.viewport} / ${item.page}: ${issue}`);
    }
  } else {
    lines.push("- 未发现明显混合语言、缺失翻译 key、undefined、对象字符串、技术错误、按钮文字溢出、表格错位、弹窗遮挡、图片破图或图片请求失败。");
  }
  lines.push("");
  lines.push("## 页面截图与明细");
  lines.push("");
  lines.push("| 语言 | 视口 | 页面 | 状态 | 文本溢出 | 按钮问题 | 破图 | 截图 |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | --- |");
  for (const item of report.scenarios) {
    lines.push(`| ${item.localeLabel} | ${item.viewport} | ${item.page} | ${item.status} | ${item.textOverflow.length} | ${item.buttonWrapIssues.length} | ${item.brokenImages.length} | \`${item.screenshot}\` |`);
  }
  lines.push("");
  lines.push("## 剩余视觉差异和语言风险");
  lines.push("");
  for (const risk of report.remainingRisks) lines.push(`- ${risk}`);
  lines.push("");
  lines.push("## Notion 更新说明");
  lines.push("");
  lines.push("- 本轮没有真实 Notion 页面 URL，未直接更新 Notion；已生成本地中文验收报告，可由后续同步流程写回任务页。");
  return `${lines.join("\n")}\n`;
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

const localized = (en, zhCN, ms, zhTW = zhCN) => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const localizedArray = (en, zhCN, ms, zhTW = zhCN) => ({
  en,
  ms,
  "zh-CN": zhCN,
  "zh-TW": zhTW
});

const forbiddenEnglishRuntimeSamples = [
  "Invalid account or method",
  "Official source verified.",
  "Accommodation and personal expenses are not included.",
  "Relevant academic background required.",
  "Refer to programme page and MQA record.",
  "Fee follows the latest official page.",
  "Subject to official intake availability.",
  "Full-Time Duration",
  "Language requirements are subject to official review.",
  "Applications may be submitted through the official system.",
  "May be submitted through the official system.",
  "March requirements are subject to change."
];

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
  "财",
  "费用",
  "对比",
  "筛选"
];

const forbiddenCrossLocaleSamples = {
  en: ["筛选条件", "院校库", "收藏", "会员中心", "Syarat tapisan", "Senarai Pendek", "Pusat Pelajar"],
  ms: ["Filter conditions", "University Directory", "Shortlist", "Student Center", "筛选条件", "院校库", "会员中心"],
  "zh-CN": ["Filter conditions", "University Directory", "Shortlist", "Student Center", "Syarat tapisan", "Senarai Pendek", "Pusat Pelajar"],
  "zh-TW": ["Filter conditions", "University Directory", "Shortlist", "Student Center", "Syarat tapisan", "Senarai Pendek", "Pusat Pelajar", "筛选条件", "院校库", "会员中心"]
};

const userFixture = {
  id: 42,
  displayName: "Reviewer",
  account: "review@example.com",
  method: "email",
  createdAt: "2026-05-24T00:00:00.000Z"
};

const fullOfficialProfile = {
  chineseName: "马来亚大学",
  legalName: "Universiti Malaya",
  institutionType: "公立大学",
  universityType: "研究型大学",
  city: "Kuala Lumpur",
  country: "Malaysia",
  address: "Universiti Malaya, 50603 Kuala Lumpur, Malaysia",
  levels: ["本科", "硕士", "博士"],
  studyModes: ["全日制", "授课型", "研究型"],
  programmeModes: ["Coursework", "Research"],
  rankings: [
    { label: "QS 世界排名", value: "#60" },
    { label: "QS 亚洲排名", value: "#12" }
  ],
  scale: [
    { label: "学生总数", value: "超过 30,000 人" },
    { label: "国际学生", value: "来自 80+ 国家和地区" }
  ],
  contact: [
    { label: "官网", value: "www.um.edu.my", href: "https://www.um.edu.my" },
    { label: "招生邮箱", value: "study@um.edu.my", href: "mailto:study@um.edu.my" }
  ],
  officialLinks: [
    { label: "官网", url: "https://www.um.edu.my" },
    { label: "Study Portal", url: "https://study.um.edu.my" },
    { label: "申请入口", url: "https://maya.um.edu.my" }
  ],
  qualityNote: "官方资料已准备完成，申请计划字段需按官方页面复核。",
  sourceNote: "以 UM 官网、Study Portal 和官方申请入口为主要来源。",
  verifiedAt: "2026-05-24",
  tuitionAudit: {
    displayText: "按专业显示 RM 官方总学费",
    notes: ["每个专业显示官方国际学生总学费，费用以官方最新公布为准。"]
  },
  undergraduateAudit: {
    officialBachelorTotal: 2,
    readyForPublicDisplay: 2,
    needsReview: 0,
    notAvailableForInternational: 0
  },
  applicationPeriods: [
    { label: "本科", value: "第一学期（10月）为主" },
    { label: "研究生", value: "March requirements are subject to change." }
  ],
  applicationFees: [
    { label: "申请费", value: "Refer to official portal" },
    { label: "Application note", value: "Applications may be submitted through the official system." }
  ],
  applicationDocuments: ["护照", "成绩单", "语言成绩", "个人陈述", "研究计划（研究型）"],
  chinaRequirement: {
    summary: "中国学生需准备研究计划、公证翻译和补充材料。"
  }
};

const universities = [
  university({
    id: 1,
    slug: "universiti-malaya-um",
    code: "UM",
    shortName: "UM",
    nameEn: "Universiti Malaya",
    nameZh: "马来亚大学",
    nameTw: "馬來亞大學",
    nameMs: "Universiti Malaya",
    imageUrl: localCover,
    color: "#003DA5",
    qsRank: 60,
    qsAsiaRank: 12,
    locationEn: "Kuala Lumpur",
    locationZh: "吉隆坡",
    locationTw: "吉隆坡",
    locationMs: "Kuala Lumpur",
    ownership: "public",
    institutionType: "research",
    officialProfile: fullOfficialProfile,
    programCount: 5
  }),
  university({
    id: 2,
    slug: "universiti-putra-malaysia-upm",
    code: "UPM",
    shortName: "UPM",
    nameEn: "Universiti Putra Malaysia",
    nameZh: "博特拉大学",
    nameTw: "博特拉大學",
    nameMs: "Universiti Putra Malaysia",
    imageUrl: localCoverAlt,
    color: "#0F6B45",
    qsRank: 148,
    qsAsiaRank: 25,
    locationEn: "Serdang",
    locationZh: "雪兰莪沙登",
    locationTw: "雪蘭莪沙登",
    locationMs: "Serdang",
    ownership: "public",
    institutionType: "research",
    officialProfile: null,
    programCount: 3
  }),
  university({
    id: 3,
    slug: "taylors-university",
    code: "TAYLORS",
    shortName: "Taylor's",
    nameEn: "Taylor's University",
    nameZh: "泰莱大学",
    nameTw: "泰萊大學",
    nameMs: "Taylor's University",
    imageUrl: localCoverThird,
    color: "#C43830",
    qsRank: 253,
    qsAsiaRank: 41,
    locationEn: "Subang Jaya",
    locationZh: "梳邦再也",
    locationTw: "梳邦再也",
    locationMs: "Subang Jaya",
    ownership: "private",
    institutionType: "comprehensive",
    officialProfile: null,
    programCount: 2
  })
];

const programs = [
  program(1670, 1, "bachelor", "理科", "program-1670", "Bachelor of Software Engineering (Software Technology)", "软件工程学士（软件技术）", "軟體工程學士（軟體技術）", "Faculty of Computer Science", "计算机科学学院", "Sains Komputer", 42000, 5.5, "Full-Time Duration: 6 Semesters, (Clinical) — official page title is Doctor of Public Health (Mixed-Mode)"),
  program(1671, 1, "master", "商科", "program-1671", "Master of Responsible Management and Agricultural Biosecurity", "管理责任与农业生物安全硕士", "管理責任與農業生物安全碩士", "Faculty of Business", "商学院", "Fakulti Perniagaan", 52000, 6, "1.5 Years"),
  program(1672, 1, "master", "IT", "program-1672", "Master of Data Science", "数据科学硕士", "資料科學碩士", "Faculty of Computer Science", "计算机科学学院", "Fakulti Sains Komputer", 46000, 6, "2 Years"),
  program(1673, 1, "phd", "Clinical Medicine", "program-1673", "Doctor of Philosophy in Clinical Medicine", "临床医学博士", "臨床醫學博士", "Faculty of Medicine", "医学院", "Fakulti Perubatan", 38000, 6, "3 Years"),
  program(2670, 2, "master", "IT", "program-2670", "Master of Software Engineering", "软件工程硕士", "軟體工程碩士", "Faculty of Computing", "计算机学院", "Fakulti Pengkomputeran", 39000, 6, "2 Years"),
  program(2671, 2, "bachelor", "engineering", "program-2671", "Bachelor of Engineering", "工程学士", "工程學士", "Faculty of Engineering", "工程学院", "Fakulti Kejuruteraan", 41000, 5.5, "3.5 Years"),
  program(3670, 3, "master", "business", "program-3670", "Master of International Hospitality", "国际酒店管理硕士", "國際酒店管理碩士", "School of Hospitality", "酒店管理学院", "Pusat Pengajian Hospitaliti", 56000, 6, "1.5 Years")
];

function university(input) {
  return {
    id: input.id,
    slug: input.slug,
    code: input.code,
    name: localized(input.nameEn, input.nameZh, input.nameMs, input.nameTw),
    shortName: input.shortName,
    nameEn: input.nameEn,
    nameEnOfficial: input.nameEn,
    logoUrl: localLogo,
    imageUrl: input.imageUrl,
    color: input.color,
    qsRank: input.qsRank,
    qsAsiaRank: input.qsAsiaRank,
    location: localized(input.locationEn, input.locationZh, input.locationMs, input.locationTw),
    region: localized("Malaysia", "马来西亚", "Malaysia", "馬來西亞"),
    ownership: input.ownership,
    institutionType: input.institutionType,
    foundedYear: input.id === 1 ? 1905 : 1931,
    students: input.id === 1 ? 30000 : 24000,
    intlStudents: input.id === 1 ? 5200 : 4300,
    csrCertified: true,
    description: localized(
      `${input.nameEn} is included in the multilingual regression fixture.`,
      `${input.nameZh}用于多语言回归验证。`,
      `${input.nameMs} digunakan untuk regresi berbilang bahasa.`,
      `${input.nameTw}用於多語言回歸驗證。`
    ),
    website: "https://www.example.edu.my",
    admissionEmail: "admission@example.edu.my",
    officialWebsite: "https://www.example.edu.my",
    studyPortalUrl: "https://study.example.edu.my",
    internationalPageUrl: "https://international.example.edu.my",
    applicationPortalUrl: "https://apply.example.edu.my",
    officialAddress: `${input.nameEn}, Malaysia`,
    applicationPeriods: ["October intake"],
    applicationFees: ["Refer to official portal"],
    applicationDocuments: localizedArray(["Passport", "Transcript"], ["护照", "成绩单"], ["Pasport", "Transkrip"], ["護照", "成績單"]),
    chinaStudentRequirements: localizedArray(["Verify official requirements."], ["中国学生需核对官方要求。"], ["Semak syarat rasmi."], ["中國學生需核對官方要求。"]),
    officialProfile: input.officialProfile,
    officialSources: [
      { title: "Official website", url: "https://www.example.edu.my", sourceType: "official-website", verifiedAt: "2026-05-24", status: "official-verified", note: null }
    ],
    officialVerifiedAt: "2026-05-24",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "Official source verified.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "Living cost depends on accommodation.",
    tuitionMinCny: 32000,
    tuitionMaxCny: 92000,
    livingCostCny: 30000,
    minIelts: 5.5,
    acceptNoLanguage: input.id !== 1,
    facilities: localizedArray(["Library", "Student centre", "Sports complex"], ["图书馆", "学生中心", "运动中心"], ["Perpustakaan", "Pusat pelajar", "Kompleks sukan"], ["圖書館", "學生中心", "運動中心"]),
    highlights: localizedArray(["Official data", "Local images"], ["官方数据", "本地图片"], ["Data rasmi", "Imej tempatan"], ["官方資料", "本地圖片"]),
    programCount: input.programCount
  };
}

function program(id, universityId, level, category, slug, nameEn, nameZh, nameTw, facultyEn, facultyZh, facultyMs, annualTuitionCny, ielts, durationOfficial) {
  const tuitionDisplay = `CNY ${annualTuitionCny}`;
  return {
    id,
    universityId,
    slug,
    code: `P-${id}`,
    name: localized(nameEn, nameZh, nameEn, nameTw),
    nameEn,
    nameEnOfficial: nameEn,
    level,
    category,
    faculty: localized(facultyEn, facultyZh, facultyMs, facultyZh),
    facultyZh,
    studyMode: "Full time",
    campus: "Main campus",
    durationYears: level === "bachelor" ? 3.5 : level === "master" ? 1.5 : 3,
    durationOfficial,
    annualTuitionCny,
    tuitionAmount: annualTuitionCny,
    tuitionCurrency: "CNY",
    tuitionDisplay,
    officialTuitionMYR: null,
    officialFeeSourceUrl: "https://example.edu/fees",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: "2026-05-24",
    intakeMonths: ["October"],
    officialIntake: id === 1670 ? "March requirements are subject to change." : "Semester 1 (October) Intake",
    officialIntakeNote: "Subject to official intake availability.",
    languageRequirement: { ielts, toefl: 80, pte: 50, muet: 4 },
    officialLanguageRequirement: id === 1670 ? "Language requirements are subject to official review." : `IELTS ${ielts}`,
    requirement: {
      gpa: 2.7,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: localized("Relevant academic background required.", "需具备相关学术背景。", "Latar akademik berkaitan diperlukan.", "需具備相關學術背景。")
    },
    officialAcademicRequirement: "Relevant academic background required.",
    chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
    applicationDocs: localizedArray(["Passport", "Transcript"], ["护照", "成绩单"], ["Pasport", "Transkrip"], ["護照", "成績單"]),
    curriculum: localizedArray(["Core courses", "Project"], ["核心课程", "项目"], ["Kursus teras", "Projek"], ["核心課程", "專案"]),
    careers: localizedArray(["Analyst", "Consultant"], ["分析师", "顾问"], ["Penganalisis", "Perunding"], ["分析師", "顧問"]),
    specializations: localizedArray(["Software", "Data"], ["软件", "数据"], ["Perisian", "Data"], ["軟體", "資料"]),
    description: localized("Official programme information for regression.", `${nameZh}是面向国际学生展示的官方专业信息。`, "Maklumat program rasmi untuk regresi.", `${nameTw}是面向國際學生展示的官方專業資訊。`),
    officialAccreditationNote: "Refer to programme page and MQA record.",
    officialSourceUrl: "https://example.edu/program",
    officialEntryRequirementSourceUrl: "https://example.edu/entry",
    officialAccreditationSourceUrl: "https://example.edu/accreditation",
    sourceUrls: [],
    officialVerifiedAt: "2026-05-24",
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "Fee follows the latest official page.",
    listTuitionText: tuitionDisplay,
    tuitionInfo: {
      amount: annualTuitionCny,
      currency: "CNY",
      displayText: tuitionDisplay,
      officialAmountMYR: null,
      sourceUrl: "https://example.edu/fees",
      secondarySourceUrl: null,
      auditStatus: "matched-official",
      auditedAt: "2026-05-24",
      note: "Accommodation and personal expenses are not included."
    },
    requirements: {
      language: { ielts, toefl: 80, pte: 50, muet: 4 },
      officialLanguageRequirement: id === 1670 ? "Language requirements are subject to official review." : `IELTS ${ielts}`,
      academic: {
        gpa: 2.7,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: localized("Relevant academic background required.", "需具备相关学术背景。", "Latar akademik berkaitan diperlukan.", "需具備相關學術背景。")
      },
      officialAcademicRequirement: "Relevant academic background required.",
      chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
      specialRequirementsNote: null
    },
    requirementInfo: {
      language: { ielts, toefl: 80, pte: 50, muet: 4 },
      officialLanguageRequirement: id === 1670 ? "Language requirements are subject to official review." : `IELTS ${ielts}`,
      academic: {
        gpa: 2.7,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: localized("Relevant academic background required.", "需具备相关学术背景。", "Latar akademik berkaitan diperlukan.", "需具備相關學術背景。")
      },
      officialAcademicRequirement: "Relevant academic background required.",
      chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
      specialRequirementsNote: null
    }
  };
}
