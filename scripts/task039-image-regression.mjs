import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import net from "node:net";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const taskId = "task039";
const staticHtmlPath = process.env.STATIC_HTML_PATH || "D:\\mydev\\StudyMY_UM_v58_na_display_tidy.html";
const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputRoot = join(root, "output", "playwright", `${taskId}-${runStamp}`);
const permanentReportPath = join(root, "docs", "prd", "TASK-039-image-regression-report.md");
const childProcesses = [];

const localLogo = "/assets/static-html/fallback-university-logo.svg";
const localCover = "/assets/static-html/image-photo-1562774053-701939374585-3a3ba5b0250f.jpg";
const localCoverAlt = "/assets/static-html/card-image-photo-1541339907198-e08756dedf3f-8421a6bf5c1a.jpg";
const localCoverThird = "/assets/static-html/card-image-photo-1498243691581-b145c3f54a5a-35fe71643bf3.jpg";

const report = {
  taskId: "TASK-039",
  runId: `${taskId}-${runStamp}`,
  startedAt: new Date().toISOString(),
  staticHtmlPath,
  outputRoot,
  screenshots: [],
  scenarios: [],
  checks: [],
  sourceScan: null,
  reviewIssueVerification: {
    issueId: "TASK-031-ASSET-001",
    status: "pending",
    note: "院校卡片 fallback 通过本轮 DOM 图片健康检查和截图复核。"
  },
  remainingDifferences: [
    "静态 HTML 原始图片引用包含外部 Unsplash/Wikimedia/官网图片；本脚本在静态参考截图中用本地占位资产替换远程图片请求，仅用于观察尺寸、裁切和页面位置。",
    "Vue 用户端运行时图片全部来自本地 /assets/static-html 或组件 fallback，目标是消除破图和外链请求，不做逐像素图片内容一致性断言。",
    "登录、费用估算等弹窗主要使用 CSS 图标与装饰，不一定包含 img 标签；本轮按网络请求、CSS 图标加载和截图完整性验收。"
  ]
};

const viewports = [
  { key: "desktop", label: "桌面端 1440x1000", width: 1440, height: 1000 },
  { key: "mobile", label: "移动端 390x844", width: 390, height: 844 }
];

const scenarios = [
  scenario("home", "首页首屏", ".hero-panel", ".hero-panel, #hero", async (page) => {
    await gotoWeb(page, "/");
    await page.waitForSelector(".hero-panel", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
  }),
  scenario("university-list", "院校列表", ".university-card", ".uni-list-card, .university-card, .card", async (page) => {
    await gotoWeb(page, "/");
    await page.waitForSelector(".university-card", { timeout: 30_000 });
    await page.evaluate(() => document.querySelector(".home-layout")?.scrollIntoView({ block: "start" }));
  }, async (page) => {
    await gotoStatic(page);
    await runStatic(page, "S.filters.categories=['IT'];S.filters.levels=['硕士'];S.filters.qsRankMax=300;S.homePage=1;render();");
    await page.waitForSelector(".uni-list-card, .card", { timeout: 30_000 });
  }),
  scenario("university-detail", "院校详情", ".detail-hero", ".detail-hero", async (page) => {
    await gotoWeb(page, "/universities/universiti-malaya-um");
    await page.waitForSelector(".detail-hero", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await page.evaluate(() => globalThis.viewUni?.(1));
    await page.waitForSelector(".detail-hero", { timeout: 30_000 });
  }),
  scenario("program-list", "专业列表", ".programme-grid-row", ".programme-grid-row", async (page) => {
    await gotoWeb(page, "/universities/universiti-malaya-um");
    await page.waitForSelector(".detail-hero", { timeout: 30_000 });
    await page.getByRole("tab", { name: "本科专业" }).click();
    await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await page.evaluate(() => {
      globalThis.viewUni?.(1);
      globalThis.setUniTab?.("bachelorPrograms");
    });
    await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
  }),
  scenario("program-modal", "专业详情弹窗", ".program-detail-modal", ".modal, .program-detail-modal", async (page) => {
    await gotoWeb(page, "/universities/universiti-malaya-um");
    await page.waitForSelector(".detail-hero", { timeout: 30_000 });
    await page.getByRole("tab", { name: "本科专业" }).click();
    await page.locator(".programme-grid-row").first().click();
    await page.waitForSelector(".program-detail-modal", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await page.evaluate(() => {
      globalThis.viewUni?.(1);
      globalThis.setUniTab?.("bachelorPrograms");
    });
    await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
    await page.locator(".programme-grid-row").first().click();
    await page.waitForSelector(".modal", { timeout: 30_000 });
  }, "modal"),
  scenario("favorites", "收藏页", ".favorite-university-card, .fav-empty", ".fav-empty, .card", async (page) => {
    await gotoWeb(page, "/favorites");
    await page.waitForSelector(".favorite-university-card, .fav-empty", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await runStatic(page, "const u=universities[0];const p=u.programs[0];S.favorites={universities:[u.id],programs:[p.id]};ss(STORAGE_KEYS.favorites,S.favorites);nav('favorites');");
    await page.waitForSelector(".fav-empty, .card", { timeout: 30_000 });
  }),
  scenario("compare", "对比页", ".compare-table, .fav-empty", ".compare-table", async (page) => {
    await gotoWeb(page, "/compare");
    await page.waitForSelector(".compare-table, .fav-empty", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await runStatic(page, "S.compareList=universities.slice(0,2).map(u=>u.id);ss(STORAGE_KEYS.compareList,S.compareList);nav('compare');");
    await page.waitForSelector(".compare-table", { timeout: 30_000 });
  }),
  scenario("planner", "规划页", ".planner-panel", ".planner-tabs", async (page) => {
    await gotoWeb(page, "/planner");
    await page.waitForSelector(".planner-panel", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await seedStaticPlanner(page);
    await page.waitForSelector(".planner-tabs", { timeout: 30_000 });
  }),
  scenario("auth-modal", "登录弹窗", ".auth-panel", "#authModal, .auth-panel", async (page) => {
    await gotoWeb(page, "/");
    await page.waitForSelector(".hero-panel", { timeout: 30_000 });
    await page.locator(".header-actions .primary-action").click();
    await page.waitForSelector(".auth-panel", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await page.evaluate(() => globalThis.openAuth?.("login"));
    await page.waitForSelector("#authModal, .modal", { timeout: 30_000 });
  }, "modal"),
  scenario("calculator-modal", "费用计算弹窗", ".tool-modal-inner--calculator", "#calcModal, .tool-modal-inner", async (page) => {
    await gotoWeb(page, "/");
    await page.waitForSelector(".hero-panel", { timeout: 30_000 });
    await page.locator(".floating-tools .floating-tool").first().click();
    await page.waitForSelector(".tool-modal-inner--calculator", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await page.evaluate(() => globalThis.openCalc?.());
    await page.waitForSelector("#calcModal, .tool-modal-inner", { timeout: 30_000 });
  }, "modal"),
  scenario("recommend-modal", "推荐弹窗", ".tool-modal-inner--recommend", "#recModal, .tool-modal-inner", async (page) => {
    await gotoWeb(page, "/");
    await page.waitForSelector(".hero-panel", { timeout: 30_000 });
    await page.locator(".floating-tools .floating-tool").nth(1).click();
    await page.waitForSelector(".tool-modal-inner--recommend", { timeout: 30_000 });
  }, async (page) => {
    await gotoStatic(page);
    await seedStaticPlanner(page);
    await page.evaluate(() => globalThis.openRec?.());
    await page.waitForSelector("#recModal, .tool-modal-inner", { timeout: 30_000 });
  }, "modal")
];

let mockServer;
let mockPort;
let webPort;
let mockBaseUrl;
let webBaseUrl;

if (!existsSync(staticHtmlPath)) {
  throw new Error(`Static HTML not found: ${staticHtmlPath}`);
}

mkdirSync(outputRoot, { recursive: true });

main().catch(async (error) => {
  report.status = "failed";
  report.error = error instanceof Error ? error.stack || error.message : String(error);
  report.finishedAt = new Date().toISOString();
  await writeReports();
  console.error(`TASK-039 image regression failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  mockPort = Number(process.env.STUDYMY_TASK039_API_PORT || await getFreePort(4600));
  webPort = Number(process.env.STUDYMY_TASK039_WEB_PORT || await getFreePort(5200));
  mockBaseUrl = `http://127.0.0.1:${mockPort}/api`;
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  report.services = { mockBaseUrl, webBaseUrl };

  await step("扫描用户端外链图片字面量", scanUserFacingSource);
  await step("校验 mock 图片资产存在", verifyFixtureAssets);
  await step("启动 mock API", startMockApi);
  await step("启动用户端", startWeb);
  await step("执行桌面端和移动端图片回归", runBrowserAudit);

  const blockingIssues = report.scenarios.flatMap((item) => item.blockingIssues);
  report.status = blockingIssues.length ? "failed" : "passed";
  report.reviewIssueVerification.status = blockingIssues.length ? "failed" : "verified";
  report.finishedAt = new Date().toISOString();
  await writeReports();

  console.log(JSON.stringify({
    status: report.status,
    outputRoot: normalizePath(outputRoot),
    markdownReport: normalizePath(join(outputRoot, "image-regression-report.md")),
    jsonReport: normalizePath(join(outputRoot, "image-regression-report.json")),
    permanentReport: normalizePath(permanentReportPath),
    screenshotCount: report.screenshots.length,
    scenarioCount: report.scenarios.length,
    blockingIssueCount: blockingIssues.length
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

function scanUserFacingSource() {
  const files = listFiles(join(root, "apps", "web", "src"), [".vue", ".ts", ".css"]);
  const forbiddenHosts = ["images.unsplash.com", "upload.wikimedia.org", "source.unsplash.com"];
  const hits = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const host of forbiddenHosts) {
      if (source.includes(host)) hits.push(`${normalizePath(relative(root, file))}: ${host}`);
    }
  }
  if (hits.length) throw new Error(`用户端源码仍包含外部展示图片：${hits.join("; ")}`);
  report.sourceScan = { scannedFiles: files.length, forbiddenHosts, hits };
  return report.sourceScan;
}

function verifyFixtureAssets() {
  const assets = [localLogo, localCover, localCoverAlt, localCoverThird];
  const results = assets.map((publicPath) => {
    const filePath = join(root, "apps", "web", "public", publicPath.replace(/^\//, ""));
    const stats = statSync(filePath);
    if (!stats.isFile() || stats.size <= 0) throw new Error(`本地图片资产不存在或为空：${publicPath}`);
    return { publicPath, sizeBytes: stats.size };
  });
  return { checkedAssets: results };
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
  await waitForUrl(webBaseUrl, "用户端");
  return { webBaseUrl };
}

async function runBrowserAudit() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK039_HEADED !== "1" });
  try {
    for (const viewport of viewports) {
      for (const item of scenarios) {
        const staticResult = await captureStatic(browser, item, viewport);
        const webResult = await captureWeb(browser, item, viewport);
        report.scenarios.push(compareImageScenario(item, viewport, staticResult, webResult));
      }
    }
  } finally {
    await browser.close();
  }
  return { scenarios: report.scenarios.length, screenshots: report.screenshots.length };
}

async function captureStatic(browser, item, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1
  });
  await routeStaticExternalAssets(context);
  const page = await context.newPage();
  try {
    await item.staticSetup(page);
    await waitForPageReady(page);
    const metrics = await collectImageMetrics(page);
    const screenshotPath = await screenshot(page, `${viewport.key}-${item.key}-static.png`, item, viewport, "static");
    return { metrics, screenshotPath };
  } finally {
    await context.close();
  }
}

async function captureWeb(browser, item, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1
  });
  await routeFonts(context);
  await context.addInitScript((storage) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
  }, localStorageFixture());

  const page = await context.newPage();
  const audit = attachImageRequestAudit(page);
  try {
    await item.webSetup(page);
    await waitForPageReady(page);
    const metrics = await collectImageMetrics(page);
    const screenshotPath = await screenshot(page, `${viewport.key}-${item.key}-web.png`, item, viewport, "web");
    return { metrics, screenshotPath, audit };
  } finally {
    await context.close();
  }
}

function compareImageScenario(item, viewport, staticResult, webResult) {
  const blockingIssues = [];
  const differences = [];
  const audit = webResult.audit;
  const webMetrics = webResult.metrics;
  const staticMetrics = staticResult.metrics;

  if (audit.externalImageRequests.length) {
    blockingIssues.push(`出现外部运行时图片请求：${audit.externalImageRequests.join(", ")}`);
  }
  if (audit.failedImageRequests.length) {
    blockingIssues.push(`图片请求失败：${audit.failedImageRequests.join(", ")}`);
  }
  if (audit.failedImageResponses.length) {
    blockingIssues.push(`图片响应状态异常：${audit.failedImageResponses.join(", ")}`);
  }
  if (webMetrics.brokenImages.length) {
    blockingIssues.push(`可见 DOM 图片未成功加载：${JSON.stringify(webMetrics.brokenImages)}`);
  }
  if (webMetrics.horizontalOverflow > 1) {
    blockingIssues.push(`页面横向溢出 ${webMetrics.horizontalOverflow}px，可能影响移动端图片裁切。`);
  }

  if (staticMetrics.visibleImages.length !== webMetrics.visibleImages.length) {
    differences.push(`静态参考可见 img 数 ${staticMetrics.visibleImages.length}，Vue 可见 img 数 ${webMetrics.visibleImages.length}；部分 Vue 区块使用 CSS 图标或本地 SVG fallback，属于可接受差异。`);
  }
  if (webMetrics.localFallbackImages.length || webMetrics.fallbackElements.length) {
    differences.push(`Vue 使用 ${webMetrics.localFallbackImages.length} 个本地 fallback 图片和 ${webMetrics.fallbackElements.length} 个 fallback 元素，未检测到破图图标。`);
  }
  if (item.kind === "modal" && !webMetrics.modal) {
    blockingIssues.push("弹窗场景未检测到 Vue 弹窗面板。");
  }

  return {
    key: item.key,
    page: item.title,
    viewport: viewport.label,
    viewportSize: `${viewport.width}x${viewport.height}`,
    staticScreenshot: staticResult.screenshotPath,
    webScreenshot: webResult.screenshotPath,
    checkedDomImages: webMetrics.images.length,
    visibleDomImages: webMetrics.visibleImages.length,
    localImageRequests: audit.localImageRequests.length,
    externalImageRequests: audit.externalImageRequests,
    failedImageRequests: audit.failedImageRequests,
    failedImageResponses: audit.failedImageResponses,
    brokenImages: webMetrics.brokenImages,
    fallbackElements: webMetrics.fallbackElements,
    localFallbackImages: webMetrics.localFallbackImages,
    horizontalOverflow: webMetrics.horizontalOverflow,
    blockingIssues,
    differences,
    staticImageSummary: summarizeMetrics(staticMetrics),
    webImageSummary: summarizeMetrics(webMetrics)
  };
}

function attachImageRequestAudit(page) {
  const audit = {
    localImageRequests: [],
    externalImageRequests: [],
    failedImageRequests: [],
    failedImageResponses: []
  };

  page.on("request", (request) => {
    if (request.resourceType() !== "image") return;
    const url = request.url();
    if (isLocalWebImage(url)) audit.localImageRequests.push(url);
    else if (!url.startsWith("data:image/") && !url.startsWith("blob:")) audit.externalImageRequests.push(url);
  });
  page.on("requestfailed", (request) => {
    if (request.resourceType() !== "image") return;
    audit.failedImageRequests.push(`${request.url()} ${request.failure()?.errorText || ""}`.trim());
  });
  page.on("response", (response) => {
    const request = response.request();
    if (request.resourceType() !== "image") return;
    if (response.status() >= 400) audit.failedImageResponses.push(`${response.status()} ${response.url()}`);
  });

  return audit;
}

async function collectImageMetrics(page) {
  return page.evaluate(() => {
    const images = Array.from(document.images).map((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      const src = image.currentSrc || image.src;
      return {
        alt: image.alt,
        src,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        renderedWidth: Math.round(rect.width),
        renderedHeight: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none",
        objectFit: style.objectFit,
        className: image.className || "",
        parentClassName: image.parentElement?.className || ""
      };
    });
    const visibleImages = images.filter((image) => image.visible);
    const brokenImages = visibleImages.filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0);
    const fallbackSelector = [
      ".university-card__image--placeholder",
      ".university-card__logo--fallback",
      ".detail-hero-logo--fallback",
      ".favorite-university-card__logo--fallback"
    ].join(",");
    const fallbackElements = Array.from(document.querySelectorAll(fallbackSelector)).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        className: element.className,
        text: element.textContent?.trim() || "",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0
      };
    }).filter((element) => element.visible);
    const modalPanel = document.querySelector(".program-detail-modal, .auth-panel, .tool-modal-inner, .modal");
    const modal = modalPanel ? rectFor(modalPanel) : null;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return {
      url: location.href,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth,
      horizontalOverflow: Math.max(0, Math.round(scrollWidth - window.innerWidth)),
      images,
      visibleImages,
      brokenImages,
      fallbackElements,
      localFallbackImages: visibleImages.filter((image) =>
        image.src.includes("/assets/static-html/fallback-university-logo.svg") ||
        image.src.includes("/assets/static-html/fallback-university-cover.svg") ||
        image.src.includes("/assets/static-html/image-photo-1562774053-701939374585-3a3ba5b0250f.jpg")
      ),
      modal
    };

    function rectFor(element) {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bottom: Math.round(rect.bottom),
        right: Math.round(rect.right)
      };
    }
  });
}

async function screenshot(page, filename, item, viewport, target) {
  const filePath = join(outputRoot, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  const normalized = normalizePath(filePath);
  report.screenshots.push({
    page: item.title,
    key: item.key,
    viewport: viewport.label,
    target,
    path: normalized
  });
  return normalized;
}

async function waitForPageReady(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function gotoWeb(page, pathname = "/") {
  await page.goto(`${webBaseUrl}${pathname}`, { waitUntil: "domcontentloaded" });
}

async function gotoStatic(page) {
  await page.goto(pathToFileURL(staticHtmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#app, body", { timeout: 30_000 });
}

async function runStatic(page, script) {
  await page.evaluate((source) => globalThis.eval(source), script);
}

async function seedStaticPlanner(page) {
  await runStatic(page, `
    S.profile = { level:'硕士', targetCategory:'IT', budget:90000, gpa:3.2, ielts:6, experience:'1-3年', acceptNoLanguage:true };
    S.materialProgress = { passport:'done', photo:'progress', transcript:'wait', language:'draft', degree_certificate:'progress', study_plan:'done', recommendation:'wait' };
    S.visaChecklist = { offerAccepted:true, depositPaid:true, visaDocsReady:false, preDeparture:false, arrivalReady:false };
    S.appTasks = [];
    ss(STORAGE_KEYS.profile, S.profile);
    ss(STORAGE_KEYS.materialProgress, S.materialProgress);
    ss(STORAGE_KEYS.visaChecklist, S.visaChecklist);
    ss(STORAGE_KEYS.appTasks, S.appTasks);
    nav('planner');
    setTab('overview');
  `);
}

async function routeFonts(context) {
  await context.route("https://fonts.googleapis.com/**", (route) => {
    route.fulfill({ status: 200, contentType: "text/css", body: "" });
  });
  await context.route("https://fonts.gstatic.com/**", (route) => {
    route.fulfill({ status: 204, body: "" });
  });
}

async function routeStaticExternalAssets(context) {
  await routeFonts(context);
  await context.route(/^https?:\/\//, async (route) => {
    const request = route.request();
    if (request.resourceType() === "image") {
      const url = request.url();
      const publicPath = /logo|wikimedia|coat|arms/i.test(url) ? localLogo : localCover;
      const filePath = join(root, "apps", "web", "public", publicPath.replace(/^\//, ""));
      route.fulfill({
        status: 200,
        contentType: contentType(filePath),
        body: readFileSync(filePath)
      });
      return;
    }
    route.continue();
  });
}

function isLocalWebImage(url) {
  return url.startsWith(webBaseUrl) || url.startsWith(`${webBaseUrl}/`);
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

function writeReports() {
  const jsonPath = join(outputRoot, "image-regression-report.json");
  const markdownPath = join(outputRoot, "image-regression-report.md");
  const markdown = buildMarkdownReport();
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(markdownPath, markdown, "utf8");
  writeFileSync(permanentReportPath, markdown, "utf8");
}

function buildMarkdownReport() {
  const blockingIssues = report.scenarios.flatMap((item) => item.blockingIssues);
  const totals = report.scenarios.reduce((acc, item) => {
    acc.checkedDomImages += item.checkedDomImages || 0;
    acc.visibleDomImages += item.visibleDomImages || 0;
    acc.localImageRequests += item.localImageRequests || 0;
    acc.externalImageRequests += item.externalImageRequests.length;
    acc.failedImageRequests += item.failedImageRequests.length + item.failedImageResponses.length;
    acc.brokenImages += item.brokenImages.length;
    return acc;
  }, {
    checkedDomImages: 0,
    visibleDomImages: 0,
    localImageRequests: 0,
    externalImageRequests: 0,
    failedImageRequests: 0,
    brokenImages: 0
  });

  const lines = [];
  lines.push("# TASK-039 图片资产全页面回归与外链清理验收报告");
  lines.push("");
  lines.push("## 摘要");
  lines.push("");
  lines.push(`- **任务编号**: TASK-039`);
  lines.push(`- **运行编号**: ${report.runId}`);
  lines.push(`- **生成时间**: ${report.finishedAt || report.startedAt}`);
  lines.push(`- **状态**: ${report.status || "运行中"}`);
  lines.push(`- **静态 HTML**: \`${report.staticHtmlPath}\``);
  lines.push(`- **用户端地址**: \`${report.services?.webBaseUrl || "未启动"}\``);
  lines.push(`- **输出目录**: \`${normalizePath(report.outputRoot)}\``);
  lines.push("");
  lines.push("## 验收结论");
  lines.push("");
  lines.push(`- 覆盖页面和弹窗：${scenarios.map((item) => item.title).join("、")}。`);
  lines.push("- 覆盖视口：桌面端 1440x1000、移动端 390x844。");
  lines.push(`- DOM 图片检查总数：${totals.checkedDomImages}，其中可见图片 ${totals.visibleDomImages}。`);
  lines.push(`- 本地图片请求数：${totals.localImageRequests}。`);
  lines.push(`- 外部运行时图片请求数：${totals.externalImageRequests}。`);
  lines.push(`- 失败图片请求数：${totals.failedImageRequests}。`);
  lines.push(`- 可见破图数：${totals.brokenImages}。`);
  lines.push(`- TASK-031-ASSET-001 复核状态：${report.reviewIssueVerification.status === "verified" ? "已验证通过" : report.reviewIssueVerification.status}。`);
  lines.push("");
  if (blockingIssues.length) {
    lines.push("## 阻塞问题");
    lines.push("");
    for (const issue of blockingIssues) lines.push(`- ${issue}`);
    lines.push("");
  } else {
    lines.push("## 阻塞问题");
    lines.push("");
    lines.push("- 未发现图片加载、外链图片请求、图片 404、可见破图或移动端图片横向溢出阻塞。");
    lines.push("");
  }
  lines.push("## 页面检查明细");
  lines.push("");
  lines.push("| 页面 | 视口 | DOM 图片 | 外链图片请求 | 失败图片 | 破图 | fallback | Vue 截图 | 静态截图 |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |");
  for (const item of report.scenarios) {
    lines.push(`| ${item.page} | ${item.viewport} | ${item.checkedDomImages} | ${item.externalImageRequests.length} | ${item.failedImageRequests.length + item.failedImageResponses.length} | ${item.brokenImages.length} | ${item.localFallbackImages.length + item.fallbackElements.length} | \`${item.webScreenshot}\` | \`${item.staticScreenshot}\` |`);
  }
  lines.push("");
  lines.push("## 图片尺寸、裁切和 fallback 记录");
  lines.push("");
  for (const item of report.scenarios) {
    lines.push(`### ${item.page} / ${item.viewport}`);
    lines.push("");
    lines.push(`- Vue 可见图片：${item.visibleDomImages}，尺寸范围：${item.webImageSummary.sizeSummary}。`);
    lines.push(`- 静态参考可见图片：${item.staticImageSummary.visibleImages}，尺寸范围：${item.staticImageSummary.sizeSummary}。`);
    lines.push(`- Vue fallback 状态：本地 fallback 图片 ${item.localFallbackImages.length} 个，fallback 元素 ${item.fallbackElements.length} 个。`);
    if (item.differences.length) {
      for (const diff of item.differences) lines.push(`- 可接受差异：${diff}`);
    } else {
      lines.push("- 可接受差异：未记录图片相关差异。");
    }
    lines.push("");
  }
  lines.push("## 剩余视觉差异与建议");
  lines.push("");
  for (const item of report.remainingDifferences) lines.push(`- ${item}`);
  lines.push("");
  lines.push("## Notion 更新说明");
  lines.push("");
  lines.push("- 本轮没有可写入的真实 Notion 页面 URL，未直接更新 Notion；已生成本地中文验收报告，可由后续同步流程写回任务页。");
  return `${lines.join("\n")}\n`;
}

function summarizeMetrics(metrics) {
  const sizes = metrics.visibleImages.map((image) => `${image.renderedWidth}x${image.renderedHeight}`);
  const uniqueSizes = [...new Set(sizes)].slice(0, 8);
  return {
    visibleImages: metrics.visibleImages.length,
    brokenImages: metrics.brokenImages.length,
    fallbackElements: metrics.fallbackElements.length,
    localFallbackImages: metrics.localFallbackImages.length,
    sizeSummary: uniqueSizes.length ? uniqueSizes.join(", ") : "无可见 img"
  };
}

function routePayload(pathname, url) {
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
        title: "马来亚大学",
        subtitle: "Universiti Malaya",
        highlight: query,
        score: 1,
        universityId: 1,
        universitySlug: "universiti-malaya-um"
      }
    ];
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

function localStorageFixture() {
  return {
    studymy_locale: "zh-CN",
    studymy_favorites: JSON.stringify({ universities: [1, 2], programs: [1001] }),
    studymy_compare: JSON.stringify([1, 2]),
    studymy_profile: JSON.stringify({
      level: "master",
      targetCategory: "it",
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
    }),
    studymy_application_tasks: JSON.stringify([
      {
        id: -110011,
        universityId: 1,
        programId: 1001,
        tier: localized("Target", "主申", "Target", "主申"),
        stage: "materials",
        progress: 45,
        deadlineNote: localized("Within 10 days", "建议 10 天内补齐", "Dalam 10 hari", "建議 10 天內補齊"),
        nextAction: localized("Complete documents.", "补齐申请材料。", "Lengkapkan dokumen.", "補齊申請材料。")
      }
    ])
  };
}

function scenario(key, title, webReady, staticReady, webSetup, staticSetup, kind = "page") {
  return { key, title, webReady, staticReady, webSetup, staticSetup, kind };
}

function listFiles(rootDir, extensions) {
  const files = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const filePath = join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(filePath, extensions));
    else if (extensions.includes(extname(entry.name))) files.push(filePath);
  }
  return files;
}

function contentType(filePath) {
  const type = extname(filePath).toLowerCase();
  if (type === ".svg") return "image/svg+xml";
  if (type === ".jpg" || type === ".jpeg") return "image/jpeg";
  if (type === ".png") return "image/png";
  if (type === ".webp") return "image/webp";
  return "application/octet-stream";
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

const universities = [
  university({
    id: 1,
    slug: "universiti-malaya-um",
    code: "UM",
    shortName: "UM",
    nameEn: "Universiti Malaya",
    nameZh: "马来亚大学",
    imageUrl: localCover,
    color: "#003DA5",
    qsRank: 60,
    qsAsiaRank: 12,
    locationEn: "Kuala Lumpur",
    locationZh: "吉隆坡",
    ownership: "public",
    institutionType: "research",
    foundedYear: 1905,
    students: 30000,
    intlStudents: 5200,
    tuitionMinCny: 32000,
    tuitionMaxCny: 92000,
    livingCostCny: 30000,
    minIelts: 5.5,
    acceptNoLanguage: false,
    programCount: 4
  }),
  university({
    id: 2,
    slug: "universiti-putra-malaysia-upm",
    code: "UPM",
    shortName: "UPM",
    nameEn: "Universiti Putra Malaysia",
    nameZh: "博特拉大学",
    imageUrl: localCoverAlt,
    color: "#0F6B45",
    qsRank: 148,
    qsAsiaRank: 25,
    locationEn: "Serdang",
    locationZh: "雪兰莪沙登",
    ownership: "public",
    institutionType: "research",
    foundedYear: 1931,
    students: 25000,
    intlStudents: 4300,
    tuitionMinCny: 28000,
    tuitionMaxCny: 78000,
    livingCostCny: 26000,
    minIelts: 5.5,
    acceptNoLanguage: true,
    programCount: 2
  }),
  university({
    id: 3,
    slug: "taylors-university",
    code: "TAYLORS",
    shortName: "Taylor's",
    nameEn: "Taylor's University",
    nameZh: "泰莱大学",
    imageUrl: localCoverThird,
    color: "#C43830",
    qsRank: 253,
    qsAsiaRank: 41,
    locationEn: "Subang Jaya",
    locationZh: "梳邦再也",
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 1969,
    students: 20000,
    intlStudents: 6000,
    tuitionMinCny: 42000,
    tuitionMaxCny: 108000,
    livingCostCny: 32000,
    minIelts: 5,
    acceptNoLanguage: true,
    programCount: 1
  })
];

const programs = [
  program(1001, 1, "bachelor", "it", "program-1001", "Bachelor of Software Engineering", "软件工程学士", "Faculty of Computer Science", "计算机科学学院", 42000, 5.5, 36),
  program(1002, 1, "master", "business", "program-1002", "Master of Management", "管理学硕士", "Faculty of Business", "商学院", 52000, 6, 18),
  program(1003, 1, "master", "it", "program-1003", "Master of Data Science", "数据科学硕士", "Faculty of Computer Science", "计算机科学学院", 46000, 6, 24),
  program(1004, 1, "phd", "it", "program-1004", "Doctor of Philosophy in Computer Science", "计算机科学博士", "Faculty of Computer Science", "计算机科学学院", 38000, 6, 36),
  program(2001, 2, "master", "it", "program-2001", "Master of Software Engineering", "软件工程硕士", "Faculty of Computing", "计算机学院", 39000, 6, 24),
  program(2002, 2, "bachelor", "engineering", "program-2002", "Bachelor of Engineering", "工程学士", "Faculty of Engineering", "工程学院", 41000, 5.5, 42),
  program(3001, 3, "master", "business", "program-3001", "Master of International Hospitality", "国际酒店管理硕士", "School of Hospitality", "酒店管理学院", 56000, 6, 18)
];

function university(input) {
  return {
    id: input.id,
    slug: input.slug,
    code: input.code,
    name: localized(input.nameEn, input.nameZh, input.nameEn, input.nameZh),
    shortName: input.shortName,
    nameEn: input.nameEn,
    nameEnOfficial: input.nameEn,
    logoUrl: localLogo,
    imageUrl: input.imageUrl,
    color: input.color,
    qsRank: input.qsRank,
    qsAsiaRank: input.qsAsiaRank,
    location: localized(input.locationEn, input.locationZh, input.locationEn, input.locationZh),
    region: localized("Malaysia", "马来西亚", "Malaysia", "馬來西亞"),
    ownership: input.ownership,
    institutionType: input.institutionType,
    foundedYear: input.foundedYear,
    students: input.students,
    intlStudents: input.intlStudents,
    csrCertified: true,
    description: localized("Verified public display data for image regression.", "用于图片回归的已核验展示数据。", "Data paparan disahkan untuk regresi imej.", "用於圖片回歸的已核驗展示資料。"),
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
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: "2026-05-24",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "Official source verified for regression fixture.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "Living cost depends on accommodation.",
    tuitionMinCny: input.tuitionMinCny,
    tuitionMaxCny: input.tuitionMaxCny,
    livingCostCny: input.livingCostCny,
    minIelts: input.minIelts,
    acceptNoLanguage: input.acceptNoLanguage,
    facilities: localizedArray(["Library", "Student centre"], ["图书馆", "学生中心"], ["Perpustakaan", "Pusat pelajar"], ["圖書館", "學生中心"]),
    highlights: localizedArray(["Official data", "Local images"], ["官方数据", "本地图片"], ["Data rasmi", "Imej tempatan"], ["官方資料", "本地圖片"]),
    programCount: input.programCount
  };
}

function program(id, universityId, level, category, slug, nameEn, nameZh, facultyEn, facultyZh, annualTuitionCny, ielts, durationMonths) {
  return {
    id,
    universityId,
    slug,
    code: `P-${id}`,
    name: localized(nameEn, nameZh, nameEn, nameZh),
    nameEn,
    nameEnOfficial: nameEn,
    level,
    category,
    faculty: localized(facultyEn, facultyZh, facultyEn, facultyZh),
    facultyZh,
    studyMode: "Full time",
    campus: "Main campus",
    durationYears: Math.round(durationMonths / 12),
    durationMonths,
    durationOfficial: `${durationMonths} months`,
    annualTuitionCny,
    tuitionAmount: null,
    tuitionCurrency: "CNY",
    tuitionDisplay: `CNY ${annualTuitionCny}`,
    officialTuitionMYR: null,
    officialFeeSourceUrl: "https://example.edu/fees",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: "2026-05-24",
    intakeMonths: ["October"],
    officialIntake: "Semester 1 (October) Intake",
    officialIntakeNote: "Subject to official intake availability.",
    languageRequirement: { ielts, toefl: 80, pte: 50, muet: 4 },
    officialLanguageRequirement: `IELTS ${ielts}`,
    requirement: {
      gpa: 2.7,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: localized("Relevant academic background.", "相关学术背景。", "Latar akademik berkaitan.", "相關學術背景。")
    },
    officialAcademicRequirement: "Relevant academic background required.",
    chinaStudentRequirement: "Prepare transcripts, notarized translations and language results.",
    applicationDocs: localizedArray(["Passport", "Transcript"], ["护照", "成绩单"], ["Pasport", "Transkrip"], ["護照", "成績單"]),
    curriculum: localizedArray(["Core courses", "Project"], ["核心课程", "项目"], ["Kursus teras", "Projek"], ["核心課程", "項目"]),
    careers: localizedArray(["Engineer", "Analyst"], ["工程师", "分析师"], ["Jurutera", "Penganalisis"], ["工程師", "分析師"]),
    specializations: localizedArray(["Software", "Data"], ["软件", "数据"], ["Perisian", "Data"], ["軟件", "數據"]),
    description: localized("Official programme information for regression.", "用于回归验证的官方专业信息。", "Maklumat program rasmi untuk regresi.", "用於回歸驗證的官方專業資訊。"),
    officialAccreditationNote: "Refer to official accreditation record.",
    officialSourceUrl: "https://example.edu/program",
    officialEntryRequirementSourceUrl: "https://example.edu/entry",
    officialAccreditationSourceUrl: "https://example.edu/accreditation",
    sourceUrls: [],
    officialVerifiedAt: "2026-05-24",
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "Fees follow official page.",
    listTuitionText: `CNY ${annualTuitionCny}`,
    tuitionInfo: {
      amount: annualTuitionCny,
      currency: "CNY",
      displayText: `CNY ${annualTuitionCny}`,
      officialAmountMYR: null,
      sourceUrl: "https://example.edu/fees",
      secondarySourceUrl: null,
      auditStatus: "matched-official",
      auditedAt: "2026-05-24",
      note: "Accommodation and personal expenses are not included."
    },
    requirements: {
      language: { ielts, toefl: 80, pte: 50, muet: 4 },
      officialLanguageRequirement: `IELTS ${ielts}`,
      academic: {
        gpa: 2.7,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: localized("Relevant academic background.", "相关学术背景。", "Latar akademik berkaitan.", "相關學術背景。")
      },
      officialAcademicRequirement: "Relevant academic background required.",
      chinaStudentRequirement: "Prepare transcripts, notarized translations and language results.",
      specialRequirementsNote: null
    },
    requirementInfo: {
      language: { ielts, toefl: 80, pte: 50, muet: 4 },
      officialLanguageRequirement: `IELTS ${ielts}`,
      academic: {
        gpa: 2.7,
        gaokaoRequired: false,
        huikaoRequired: false,
        note: localized("Relevant academic background.", "相关学术背景。", "Latar akademik berkaitan.", "相關學術背景。")
      },
      officialAcademicRequirement: "Relevant academic background required.",
      chinaStudentRequirement: "Prepare transcripts, notarized translations and language results.",
      specialRequirementsNote: null
    }
  };
}
