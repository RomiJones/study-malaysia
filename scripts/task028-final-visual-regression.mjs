import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const taskId = "task028";
const staticHtmlPath = process.env.STATIC_HTML_PATH || "D:\\mydev\\StudyMY_UM_v58_na_display_tidy.html";
const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputRoot = join(root, "output", "playwright", `${taskId}-${runStamp}`);
const childProcesses = [];
const report = {
  taskId: "TASK-028",
  runId: `${taskId}-${runStamp}`,
  startedAt: new Date().toISOString(),
  staticHtmlPath,
  outputRoot,
  screenshots: [],
  comparisons: [],
  fixedItems: [
    "整合 TASK-024 至 TASK-027 的专项视觉验收范围，形成桌面端和移动端最终全页面截图回归。",
    "最终脚本固定 mock API、收藏、对比、规划、费用估算、推荐和登录状态，避免本地数据库或浏览器状态影响截图。",
    "桌面端弹窗按居中面板验收，移动端弹窗按贴底面板验收，分别覆盖专业详情、登录、费用估算和智能推荐。",
    "保留整页横向溢出、文本溢出、关键元素缺失和弹窗布局作为阻塞级自动检查。"
  ],
  remainingDifferences: [
    "Vue 页面由 mock API 与本地状态驱动，静态 HTML 使用内置完整数据；具体院校、专业数量和费用字段仍可能不同。",
    "静态 HTML 移动端部分入口使用 emoji 图标，Vue 页面沿用现有文字/符号图标，交互语义一致但像素不完全一致。",
    "本脚本以溢出、弹窗布局、核心元素尺寸和截图为验收证据，不做逐像素相似度断言。"
  ]
};

const viewports = [
  { key: "desktop", label: "桌面端 1440x1000", width: 1440, height: 1000 },
  { key: "mobile", label: "移动端 390x844", width: 390, height: 844 }
];

const scenarios = [
  {
    key: "home",
    title: "首页首屏",
    kind: "page",
    requiredSelector: ".hero-title",
    selectors: [
      item("导航", "#nav", ".site-header"),
      item("Hero", "#hero", ".hero-panel"),
      item("Hero 标题", ".hero-title", ".hero-title"),
      item("搜索框", ".search-wrap", ".search-wrap"),
      item("统计栏", ".hero-stats, .hero-metrics", ".hero-metrics")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.waitForSelector(".hero-panel", { timeout: 30_000 });
    }
  },
  {
    key: "list-filter",
    title: "首页筛选与院校卡片",
    kind: "page",
    requiredSelector: ".filter-panel",
    staticRequiredSelector: ".sidebar, .filter-group, .uni-list-card",
    selectors: [
      item("筛选区", ".sidebar, .filter-panel", ".filter-panel"),
      item("筛选分组", ".filter-group", ".filter-group"),
      item("活跃筛选", ".active-filter-tag, .active-tag", ".active-filter-tag, .active-tag"),
      item("院校卡片", ".uni-list-card", ".university-card"),
      item("卡片图片", ".uni-list-img-wrap", ".university-card__media")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await runStatic(page, "S.filters.categories=['IT'];S.filters.levels=['硕士'];S.filters.qsRankMax=200;S.homePage=1;render();");
      await page.waitForSelector(".active-filter-tag, .active-tag, .uni-list-card", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.waitForSelector(".filter-panel", { timeout: 30_000 });
      const level = page.locator(".filter-chip--level");
      const rank = page.locator(".filter-chip--rank");
      const category = page.locator(".filter-chip--category");
      if (await level.count() > 1) await level.nth(1).click();
      if (await rank.count() > 2) await rank.nth(2).click();
      if (await category.count() > 0) await category.nth(0).click();
      await page.waitForSelector(".active-filter-tag, .active-tag, .university-card", { timeout: 30_000 });
    }
  },
  {
    key: "university-overview",
    title: "院校详情概览",
    kind: "page",
    requiredSelector: ".detail-hero",
    selectors: [
      item("详情 Hero", ".detail-hero", ".detail-hero"),
      item("详情标题", ".detail-hero h1, .detail-hero__title", ".detail-hero-title"),
      item("详情标签页", ".detail-tabs", ".detail-tabs"),
      item("官方信息卡", ".official-card, .official-profile-card, .card:has(a[href])", ".detail-metric-card:has(a[href])"),
      item("高亮卡片", ".highlight-item", ".highlight-item")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.viewUni?.(1));
      await page.waitForSelector(".detail-hero", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/universities/universiti-malaya-um");
      await page.waitForSelector(".detail-hero", { timeout: 30_000 });
    }
  },
  {
    key: "university-programs",
    title: "院校详情专业列表",
    kind: "page",
    requiredSelector: ".programme-grid-row",
    selectors: [
      item("专业标题", ".programme-table-title, .programme-level__head", ".programme-table-title"),
      item("专业表格", ".programme-table-wrap", ".programme-table-wrap"),
      item("专业行", ".programme-grid-row", ".programme-grid-row"),
      item("专业名称", ".programme-name-zh", ".programme-name-zh")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => {
        globalThis.viewUni?.(1);
        globalThis.setUniTab?.("bachelorPrograms");
      });
      await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/universities/universiti-malaya-um");
      await page.waitForSelector(".detail-hero", { timeout: 30_000 });
      await page.getByRole("tab", { name: "本科专业" }).click();
      await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
    }
  },
  {
    key: "program-modal",
    title: "专业详情弹窗",
    kind: "modal",
    requiredSelector: ".modal, .program-detail-modal",
    selectors: [
      item("弹窗遮罩", ".modal-backdrop", ".modal-backdrop"),
      item("弹窗面板", ".modal", ".program-detail-modal"),
      item("弹窗头部", ".modal-header", ".modal-header"),
      item("要求栅格", ".req-grid", ".req-grid"),
      item("操作区", ".program-modal-actions .btn-primary, .modal-body .btn", ".program-modal-actions .btn-primary")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => {
        globalThis.viewUni?.(1);
        globalThis.setUniTab?.("bachelorPrograms");
      });
      await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
      await page.locator(".programme-grid-row").nth(0).click();
      await page.waitForSelector(".modal", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/universities/universiti-malaya-um");
      await page.waitForSelector(".detail-hero", { timeout: 30_000 });
      await page.getByRole("tab", { name: "本科专业" }).click();
      await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
      await page.locator(".programme-grid-row").nth(0).click();
      await page.waitForSelector(".program-detail-modal", { timeout: 30_000 });
    }
  },
  {
    key: "favorites",
    title: "收藏页",
    kind: "page",
    requiredSelector: ".fav-empty, .favorite-university-card",
    staticRequiredSelector: ".fav-empty, .card",
    selectors: [
      item("收藏页主体", ".container.section", ".favorites-page"),
      item("收藏院校", ".fav-empty, .card:not(:has(.chip))", ".favorite-university-card"),
      item("收藏专业", ".card:has(.chip)", ".favorite-program-card")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await runStatic(page, "const u=universities[0];const p=u.programs[0];S.favorites={universities:[u.id],programs:[p.id]};ss(STORAGE_KEYS.favorites,S.favorites);nav('favorites');");
      await page.waitForSelector(".fav-empty, .card", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/favorites");
      await page.waitForSelector(".fav-empty, .favorite-university-card", { timeout: 30_000 });
    }
  },
  {
    key: "compare",
    title: "对比页",
    kind: "page",
    requiredSelector: ".compare-table",
    selectors: [
      item("对比页主体", ".container.section", ".compare-page"),
      item("对比表格", ".compare-table", ".compare-table"),
      item("对比标签列", ".compare-label-col", ".compare-label-col"),
      item("详情按钮", ".compare-detail-link, .btn", ".compare-detail-link")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await runStatic(page, "S.compareList=universities.slice(0,2).map(u=>u.id);ss(STORAGE_KEYS.compareList,S.compareList);nav('compare');");
      await page.waitForSelector(".compare-table", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/compare");
      await page.waitForSelector(".compare-table", { timeout: 30_000 });
    }
  },
  {
    key: "planner-overview",
    title: "规划页申请概览",
    kind: "page",
    requiredSelector: ".planner-tabs",
    selectors: [
      item("规划页主体", ".container.section", ".planner-page"),
      item("规划标签页", ".planner-tabs", ".planner-tabs"),
      item("进度卡片", ".progress-bar", ".progress-bar"),
      item("推荐卡片", ".rec-card", ".rec-card")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await seedStaticPlanner(page, "overview");
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/planner");
      await page.waitForSelector(".planner-tabs", { timeout: 30_000 });
    }
  },
  {
    key: "planner-materials",
    title: "规划页材料清单",
    kind: "page",
    requiredSelector: ".material-item",
    selectors: [
      item("规划标签页", ".planner-tabs", ".planner-tabs"),
      item("材料项", ".material-item", ".material-item"),
      item("材料状态", ".material-status", ".material-status")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await seedStaticPlanner(page, "materials");
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/planner");
      await page.waitForSelector(".planner-tabs", { timeout: 30_000 });
      await page.getByRole("button", { name: "材料清单" }).click();
      await page.waitForSelector(".material-item", { timeout: 30_000 });
    }
  },
  {
    key: "planner-visa",
    title: "规划页签证清单",
    kind: "page",
    requiredSelector: ".visa-step",
    selectors: [
      item("规划标签页", ".planner-tabs", ".planner-tabs"),
      item("签证步骤", ".visa-step", ".visa-step"),
      item("签证勾选", ".visa-check", ".visa-check")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await seedStaticPlanner(page, "visa");
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/planner");
      await page.waitForSelector(".planner-tabs", { timeout: 30_000 });
      await page.getByRole("button", { name: "签证清单" }).click();
      await page.waitForSelector(".visa-step", { timeout: 30_000 });
    }
  },
  {
    key: "auth-modal",
    title: "登录弹窗",
    kind: "modal",
    requiredSelector: ".modal-backdrop, #authModal",
    selectors: [
      item("登录遮罩", ".modal-backdrop", ".modal-backdrop"),
      item("登录面板", "#authModal .modal", ".auth-panel"),
      item("登录标签页", ".auth-tabs", ".auth-tabs"),
      item("登录表单", ".auth-modal-body", ".auth-form")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.openAuth?.("login"));
      await page.waitForSelector("#authModal", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.evaluate(() => document.querySelector(".header-actions .primary-action")?.click());
      await page.waitForSelector(".auth-panel", { timeout: 30_000 });
    }
  },
  {
    key: "calculator-modal",
    title: "费用估算弹窗",
    kind: "modal",
    requiredSelector: ".tool-modal-inner, #calcModal",
    selectors: [
      item("费用遮罩", "#calcModal", ".modal-backdrop"),
      item("费用面板", "#calcModal .tool-modal-inner", ".tool-modal-inner--calculator"),
      item("费用头部", "#calcModal .tool-modal-header", ".tool-modal-header"),
      item("费用表单", "#calcModal .tool-modal-body", ".tool-modal-body"),
      item("费用结果", "#calcModal .calc-result", ".calc-result")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.openCalc?.());
      await page.waitForSelector("#calcModal", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.evaluate(() => document.querySelectorAll(".floating-tools .floating-tool")[0]?.click());
      await page.waitForSelector(".tool-modal-inner--calculator", { timeout: 30_000 });
    }
  },
  {
    key: "recommend-modal",
    title: "智能推荐弹窗",
    kind: "modal",
    requiredSelector: ".tool-modal-inner, #recModal",
    selectors: [
      item("推荐遮罩", "#recModal", ".modal-backdrop"),
      item("推荐面板", "#recModal .tool-modal-inner", ".tool-modal-inner--recommend"),
      item("推荐头部", "#recModal .tool-modal-header", ".tool-modal-header"),
      item("推荐卡片", "#recModal .rec-card", ".rec-card"),
      item("推荐分数", "#recModal .rec-score", ".rec-score")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await seedStaticPlanner(page, "overview");
      await page.evaluate(() => globalThis.openRec?.());
      await page.waitForSelector("#recModal", { timeout: 30_000 });
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.evaluate(() => document.querySelectorAll(".floating-tools .floating-tool")[1]?.click());
      await page.waitForSelector(".tool-modal-inner--recommend", { timeout: 30_000 });
      await page.waitForSelector(".rec-card, .fav-empty", { timeout: 30_000 });
    }
  }
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
  await writeReports();
  console.error(`TASK-028 全页面视觉回归失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  mockPort = Number(process.env.STUDYMY_TASK028_API_PORT || await getFreePort(4300));
  webPort = Number(process.env.STUDYMY_TASK028_WEB_PORT || await getFreePort(5173));
  mockBaseUrl = `http://127.0.0.1:${mockPort}/api`;
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  report.services = { mockBaseUrl, webBaseUrl };

  await step("启动 mock API", startMockApi);
  await step("启动用户端", startWeb);
  await step("截取桌面端和移动端核心页面与弹窗截图", captureScreenshots);

  const blockingIssues = report.comparisons.flatMap((comparison) => comparison.blockingIssues);
  report.status = blockingIssues.length ? "failed" : "passed";
  report.finishedAt = new Date().toISOString();
  await writeReports();
  console.log(JSON.stringify({
    status: report.status,
    outputRoot,
    markdownReport: join(outputRoot, "visual-diff-report.md"),
    jsonReport: join(outputRoot, "visual-diff-report.json"),
    screenshotCount: report.screenshots.length,
    comparisonCount: report.comparisons.length,
    blockingIssueCount: blockingIssues.length
  }, null, 2));
  if (blockingIssues.length) process.exitCode = 1;
}

async function step(name, fn) {
  const startedAt = new Date().toISOString();
  const result = await fn();
  report.steps = report.steps || [];
  report.steps.push({ name, status: "passed", startedAt, finishedAt: new Date().toISOString(), result });
  return result;
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

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK028_HEADED !== "1" });
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
  return { screenshots: report.screenshots.length, comparisons: report.comparisons.length };
}

async function captureScenario(browser, target, scenario, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1
  });

  if (target === "web") {
    await context.addInitScript((entries) => {
      localStorage.clear();
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, buildWebStorage(scenario));
  }

  const page = await context.newPage();
  try {
    if (target === "static") await scenario.staticSetup(page);
    else await scenario.webSetup(page);
    await waitForPageReady(page);
    const requiredSelector = target === "static"
      ? scenario.staticRequiredSelector || scenario.requiredSelector
      : scenario.webRequiredSelector || scenario.requiredSelector;
    await page.waitForSelector(requiredSelector, { timeout: 30_000 });

    const screenshotPath = join(outputRoot, `${target}-${scenario.key}-${viewport.key}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: scenario.kind !== "modal",
      animations: "disabled"
    });
    const metrics = await collectMetrics(page, scenario, target);
    report.screenshots.push({
      target: target === "static" ? "静态 HTML" : "Vue 用户端",
      page: scenario.title,
      viewport: viewport.label,
      path: screenshotPath
    });
    return { path: screenshotPath, metrics };
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
    studymy_locale: "zh-CN",
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
    studymy_profile: JSON.stringify({
      level: "master",
      targetCategory: "it",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6,
      experience: "1-3 years",
      acceptNoLanguage: true
    })
  };

  if (scenario.key === "favorites") {
    storage.studymy_favorites = JSON.stringify({ universities: [1], programs: [201] });
  }
  if (scenario.key === "compare") {
    storage.studymy_compare = JSON.stringify([1, 2]);
  }
  return storage;
}

async function waitForPageReady(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(500);
}

async function gotoStatic(page) {
  await page.goto(pathToFileURL(staticHtmlPath).href, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#app", { timeout: 30_000 });
}

async function gotoWeb(page, path = "/") {
  await page.goto(`${webBaseUrl}${path}`, { waitUntil: "domcontentloaded" });
}

async function runStatic(page, script) {
  await page.evaluate((source) => globalThis.eval(source), script);
}

async function seedStaticPlanner(page, tab) {
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
    setTab('${tab}');
  `);
}

async function collectMetrics(page, scenario, target) {
  const selectors = scenario.selectors.map((entry) => ({
    label: entry.label,
    selector: target === "static" ? entry.static : entry.web
  }));
  return page.evaluate(({ selectors, kind }) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const modalPanel = document.querySelector(".program-detail-modal, .auth-panel, .tool-modal-inner, #authModal .modal, #calcModal .tool-modal-inner, #recModal .tool-modal-inner, .modal");
    const modalRect = modalPanel ? rectFor(modalPanel) : null;
    return {
      url: location.href,
      viewportWidth,
      viewportHeight,
      scrollWidth,
      scrollHeight,
      horizontalOverflow: Math.max(0, Math.round(scrollWidth - viewportWidth)),
      selectors: Object.fromEntries(selectors.map((entry) => [entry.label, readElement(entry.selector)])),
      overflowSuspects: overflowSuspects().slice(0, 18),
      modal: kind === "modal" && modalRect ? {
        ...modalRect,
        bottomDelta: Math.round(viewportHeight - modalRect.bottom),
        widthDelta: Math.round(viewportWidth - modalRect.width),
        topRadius: getComputedStyle(modalPanel).borderTopLeftRadius
      } : null
    };

    function readElement(selector) {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const style = getComputedStyle(element);
      const rect = rectFor(element);
      return {
        selector,
        missing: false,
        text: compactText(element.innerText || element.textContent || "", 140),
        rect,
        display: style.display,
        position: style.position,
        overflowX: style.overflowX,
        gridTemplateColumns: style.gridTemplateColumns,
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderRadius: style.borderRadius,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        padding: style.padding,
        gap: style.gap
      };
    }

    function overflowSuspects() {
      return Array.from(document.querySelectorAll("body *"))
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") return false;
          if (style.overflowX === "auto" || style.overflowX === "scroll") return false;
          if (element.closest(".compare-table-scroll, .programme-table-wrap, .site-nav")) return false;
          const rect = element.getBoundingClientRect();
          if (rect.width < 24 || rect.height < 12) return false;
          const textOverflow = element.scrollWidth - element.clientWidth > 3;
          const viewportOverflow = rect.left < -2 || rect.right > viewportWidth + 2;
          return textOverflow || viewportOverflow;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            selector: selectorLabel(element),
            text: compactText(element.textContent || "", 90),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            left: Math.round(rect.left),
            right: Math.round(rect.right)
          };
        });
    }

    function rectFor(element) {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bottom: Math.round(rect.bottom)
      };
    }

    function selectorLabel(element) {
      const className = String(element.className || "").trim().replace(/\s+/g, ".");
      return className ? `.${className}` : element.tagName.toLowerCase();
    }

    function compactText(value, length) {
      return value.replace(/\s+/g, " ").trim().slice(0, length);
    }
  }, { selectors, kind: scenario.kind });
}

function compareScenario(scenario, viewport, staticResult, webResult) {
  const differences = [];
  const blockingIssues = [];
  const webMetrics = webResult.metrics;

  if (webMetrics.horizontalOverflow > 2) {
    blockingIssues.push(`Vue 存在 ${webMetrics.horizontalOverflow}px 整页横向溢出。`);
  }
  if (webMetrics.overflowSuspects.length) {
    blockingIssues.push(`Vue 检测到 ${webMetrics.overflowSuspects.length} 个可能溢出元素。`);
  }
  if (scenario.kind === "modal") {
    if (!webMetrics.modal) {
      blockingIssues.push("Vue 未检测到弹窗面板。");
    } else if (viewport.width < 768) {
      const bottomDelta = Math.abs(webMetrics.modal.bottomDelta);
      if (bottomDelta > 2) blockingIssues.push(`Vue 移动端弹窗未贴底，底部偏差 ${webMetrics.modal.bottomDelta}px。`);
      if (webMetrics.modal.widthDelta > 2) differences.push(`Vue 弹窗宽度未铺满视口，宽度差 ${webMetrics.modal.widthDelta}px。`);
    } else {
      const sideSpace = Math.round((viewport.width - webMetrics.modal.width) / 2);
      const centerDelta = Math.abs(webMetrics.modal.x - sideSpace);
      if (webMetrics.modal.x < 20) blockingIssues.push(`Vue 桌面端弹窗左侧外边距过小：${webMetrics.modal.x}px。`);
      if (webMetrics.modal.width > viewport.width - 48) blockingIssues.push(`Vue 桌面端弹窗宽度过大：${webMetrics.modal.width}px。`);
      if (webMetrics.modal.y < 20) differences.push(`Vue 桌面端弹窗顶部外边距偏小：${webMetrics.modal.y}px。`);
      if (centerDelta > 28) differences.push(`Vue 桌面端弹窗水平居中偏差 ${centerDelta}px。`);
    }
  }

  for (const entry of scenario.selectors) {
    const left = staticResult.metrics.selectors[entry.label];
    const right = webMetrics.selectors[entry.label];
    if (!right || right.missing) {
      blockingIssues.push(`Vue 缺少关键元素：${entry.label}。`);
      continue;
    }
    if (!left || left.missing) {
      differences.push(`静态 HTML 未检测到 ${entry.label}，Vue 已检测到。`);
      continue;
    }
    const widthDelta = Math.abs((left.rect?.width || 0) - (right.rect?.width || 0));
    const heightDelta = Math.abs((left.rect?.height || 0) - (right.rect?.height || 0));
    if (widthDelta > Math.max(120, (left.rect?.width || 0) * 0.45)) {
      differences.push(`${entry.label} 宽度差异较大：静态 HTML ${left.rect.width}px，Vue ${right.rect.width}px。`);
    }
    if (scenario.kind === "modal" && heightDelta > Math.max(140, (left.rect?.height || 0) * 0.42)) {
      differences.push(`${entry.label} 高度差异较大：静态 HTML ${left.rect.height}px，Vue ${right.rect.height}px。`);
    }
  }

  return {
    page: scenario.title,
    key: scenario.key,
    viewport: viewport.label,
    viewportSize: `${viewport.width}x${viewport.height}`,
    staticScreenshot: staticResult.path,
    webScreenshot: webResult.path,
    differenceCount: differences.length,
    blockingIssueCount: blockingIssues.length,
    differences,
    blockingIssues,
    staticMetrics: staticResult.metrics,
    webMetrics
  };
}

async function writeReports() {
  const jsonPath = join(outputRoot, "visual-diff-report.json");
  const markdownPath = join(outputRoot, "visual-diff-report.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(markdownPath, buildMarkdownReport(), "utf8");
}

function buildMarkdownReport() {
  const lines = [];
  lines.push("# TASK-028 全页面视觉回归验收报告");
  lines.push("");
  lines.push(`- 运行编号：${report.runId}`);
  lines.push(`- 静态 HTML：${report.staticHtmlPath}`);
  lines.push(`- Vue 用户端：${report.services?.webBaseUrl || "未启动"}`);
  lines.push(`- 输出目录：${report.outputRoot}`);
  lines.push(`- 状态：${report.status || "运行中"}`);
  lines.push("");
  lines.push("## 覆盖范围");
  lines.push("");
  lines.push("- 视口：1440x1000、390x844。");
  lines.push("- 页面和弹窗：首页、院校列表、院校详情、专业列表、专业详情弹窗、收藏、对比、规划、登录、费用估算、智能推荐。");
  lines.push("");
  lines.push("## 已修复项");
  lines.push("");
  for (const item of report.fixedItems) lines.push(`- ${item}`);
  lines.push("");
  lines.push("## 剩余差异");
  lines.push("");
  for (const item of report.remainingDifferences) lines.push(`- ${item}`);
  lines.push("");
  lines.push("## 截图清单");
  lines.push("");
  lines.push("| 页面 | 视口 | 来源 | 截图 |");
  lines.push("| --- | --- | --- | --- |");
  for (const item of report.screenshots) {
    lines.push(`| ${item.page} | ${item.viewport} | ${item.target} | ${item.path} |`);
  }
  lines.push("");
  lines.push("## 自动指标差异");
  lines.push("");
  for (const item of report.comparisons) {
    lines.push(`### ${item.page} / ${item.viewport}`);
    lines.push("");
    lines.push(`- 静态截图：${item.staticScreenshot}`);
    lines.push(`- Vue 截图：${item.webScreenshot}`);
    lines.push(`- 阻塞级问题数：${item.blockingIssueCount}`);
    lines.push(`- 非阻塞差异数：${item.differenceCount}`);
    if (item.blockingIssues.length) {
      for (const issue of item.blockingIssues) lines.push(`- 阻塞：${issue}`);
    } else {
      lines.push("- 未检测到整页横向溢出、文本溢出或弹窗布局阻塞。");
    }
    if (item.differences.length) {
      for (const diff of item.differences) lines.push(`- 差异：${diff}`);
    }
    lines.push("");
  }
  lines.push("## 说明");
  lines.push("");
  lines.push("- 本报告使用 mock API 和 localStorage 固定视觉状态，避免本地数据库状态影响截图。");
  lines.push("- Notion 未在脚本中更新；报告保存到本地 `output/playwright/`。");
  return `${lines.join("\n")}\n`;
}

function routePayload(pathname, url) {
  if (pathname === "/api/universities/meta/home") {
    return {
      stats: { universityCount: universities.length, programCount: programs.length, bestQsRank: 60 },
      contentBlocks: []
    };
  }
  if (pathname === "/api/universities") return universities;
  if (pathname === "/api/programs") return programs;
  if (pathname === "/api/search/suggestions") {
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    if (!query) return [];
    return [
      { id: "u-1", type: "university", title: "马来亚大学", subtitle: "Universiti Malaya", highlight: "马来亚大学", universitySlug: "universiti-malaya-um" },
      { id: "p-201", type: "program", title: "数据科学硕士", subtitle: "马来亚大学", highlight: "数据科学硕士", universitySlug: "universiti-malaya-um", programId: 201 }
    ];
  }
  if (pathname.startsWith("/api/universities/")) {
    const slug = pathname.split("/").pop();
    const university = universities.find((entry) => entry.slug === slug) || universities[0];
    return { ...university, programs: programs.filter((entry) => entry.universityId === university.id) };
  }
  if (pathname.startsWith("/api/programs/detail/")) {
    const id = Number(pathname.split("/").pop());
    const program = programs.find((entry) => entry.id === id) || programs[0];
    const university = universities.find((entry) => entry.id === program.universityId) || universities[0];
    return { ...program, university, annualCostCny: program.annualTuitionCny + university.livingCostCny };
  }
  return null;
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

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function item(label, staticSelector, webSelector) {
  return { label, static: staticSelector, web: webSelector };
}

const l = (en, zhCN) => ({ en, ms: en, "zh-CN": zhCN, "zh-TW": zhCN });
const a = (items) => ({ en: items, ms: items, "zh-CN": items, "zh-TW": items });

const universities = [
  {
    id: 1,
    slug: "universiti-malaya-um",
    code: "UM",
    name: l("Universiti Malaya", "马来亚大学"),
    shortName: "UM",
    nameEn: "Universiti Malaya",
    nameEnOfficial: "Universiti Malaya",
    logoUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/University_of_Malaya_coat_of_arms.svg/200px-University_of_Malaya_coat_of_arms.svg.png",
    imageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=1200&h=800&fit=crop",
    color: "#003DA5",
    qsRank: 60,
    qsAsiaRank: 12,
    location: l("Kuala Lumpur", "吉隆坡"),
    region: l("Federal Territory of Kuala Lumpur", "吉隆坡联邦直辖区"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1905,
    students: 30000,
    intlStudents: 5200,
    csrCertified: true,
    description: l("Malaysia's flagship research university.", "马来西亚旗舰研究型大学，位于吉隆坡核心区域，拥有广泛国际认可度。"),
    website: "https://www.um.edu.my",
    admissionEmail: "study@um.edu.my",
    officialWebsite: "https://www.um.edu.my",
    studyPortalUrl: "https://study.um.edu.my",
    internationalPageUrl: "https://study.um.edu.my/international",
    applicationPortalUrl: "https://maya.um.edu.my",
    officialAddress: "Universiti Malaya, 50603 Kuala Lumpur, Malaysia",
    applicationPeriods: ["第一学期（10月）为主", "部分研究生项目开放 3 月入学"],
    applicationFees: ["申请费以官方系统为准"],
    applicationDocuments: a(["护照", "成绩单", "语言成绩", "个人陈述"]),
    chinaStudentRequirements: a(["中国学生需核对成绩、公证翻译和语言要求。"]),
    officialProfile: {
      chineseName: "马来亚大学",
      legalName: "Universiti Malaya",
      institutionType: "公立大学",
      universityType: "研究型大学",
      city: "Kuala Lumpur",
      country: "Malaysia",
      address: "Universiti Malaya, 50603 Kuala Lumpur, Malaysia",
      levels: ["本科", "硕士", "博士"],
      studyModes: ["全日制", "授课型", "研究型"],
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
      qualityNote: "官方入口、基础资料、申请入口和专业费用字段已按静态 HTML 基线整理。",
      sourceNote: "以 UM 官网、Study Portal 和官方申请入口为主要来源。",
      verifiedAt: "2026-05-23",
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
        { label: "研究生", value: "3月 / 10月或滚动开放" }
      ],
      applicationFees: [{ label: "申请费", value: "以官方系统显示为准" }],
      applicationDocuments: ["护照", "成绩单", "语言成绩", "个人陈述", "研究计划（研究型）"],
      chinaRequirement: { summary: "中国学生需按具体专业核对高中 / 本科成绩、语言要求、公证翻译和补充材料。" }
    },
    officialSources: [
      { title: "Official website", url: "https://www.um.edu.my", sourceType: "official-website", verifiedAt: "2026-05-23", status: "official-verified", note: null }
    ],
    officialVerifiedAt: "2026-05-23",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "UM 官方资料已核验。",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "吉隆坡生活费需按住宿与个人消费调整。",
    tuitionMinCny: 32000,
    tuitionMaxCny: 92000,
    livingCostCny: 30000,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: a(["中央图书馆", "大学医学中心", "创新中心", "国际学生服务中心"]),
    highlights: a(["QS 世界排名 Top 100", "公立研究型大学", "课程覆盖广泛", "吉隆坡核心位置"]),
    programCount: 5
  },
  {
    id: 2,
    slug: "universiti-putra-malaysia-upm",
    code: "UPM",
    name: l("Universiti Putra Malaysia", "博特拉大学"),
    shortName: "UPM",
    nameEn: "Universiti Putra Malaysia",
    nameEnOfficial: "Universiti Putra Malaysia",
    logoUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=200&h=200&fit=crop",
    imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&h=800&fit=crop",
    color: "#0F6B45",
    qsRank: 148,
    qsAsiaRank: 25,
    location: l("Serdang", "雪兰莪沙登"),
    region: l("Selangor", "雪兰莪"),
    ownership: "public",
    institutionType: "research",
    foundedYear: 1931,
    students: 25000,
    intlStudents: 4300,
    csrCertified: true,
    description: l("A public research university in Selangor.", "位于雪兰莪的公立研究型大学。"),
    website: "https://www.upm.edu.my",
    admissionEmail: "admission@upm.edu.my",
    officialWebsite: "https://www.upm.edu.my",
    studyPortalUrl: "https://akademik.upm.edu.my",
    internationalPageUrl: "https://intl.upm.edu.my",
    applicationPortalUrl: "https://sgsportal.upm.edu.my",
    officialAddress: "Universiti Putra Malaysia, 43400 UPM Serdang, Selangor",
    applicationPeriods: ["以官方系统开放时间为准"],
    applicationFees: ["申请费以官方系统为准"],
    applicationDocuments: a(["护照", "成绩单", "语言成绩"]),
    chinaStudentRequirements: a(["中国学生需按项目核对入学要求。"]),
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: "2026-05-23",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "UPM 官方资料已核验。",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "雪兰莪生活费按住宿方式调整。",
    tuitionMinCny: 28000,
    tuitionMaxCny: 78000,
    livingCostCny: 26000,
    minIelts: 5.5,
    acceptNoLanguage: true,
    facilities: a(["图书馆", "研究中心", "学生服务中心"]),
    highlights: a(["公立研究型大学", "农业与生命科学优势", "多学科覆盖"]),
    programCount: 5
  }
];

function program(id, universityId, level, category, nameZh, nameEn, facultyZh, tuitionDisplay, annualTuitionCny, ielts) {
  return {
    id,
    universityId,
    slug: `program-${id}`,
    code: `P-${id}`,
    name: l(nameEn, nameZh),
    nameEn,
    nameEnOfficial: nameEn,
    level,
    category,
    faculty: l(facultyZh, facultyZh),
    facultyZh,
    studyMode: "Full time",
    campus: "Main campus",
    durationYears: level === "bachelor" ? 3.5 : level === "master" ? 1.5 : 3,
    durationOfficial: level === "bachelor" ? "3.5 Years" : level === "master" ? "1.5 Years" : "3 Years",
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
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: l("Relevant academic background required.", "需具备相关学术背景。") },
    officialAcademicRequirement: "按官方专业页面入学要求核对。",
    chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
    applicationDocs: a(["护照", "成绩单", "语言成绩", "个人陈述"]),
    curriculum: a(["核心课程", "研究方法", "行业项目"]),
    careers: a(["分析师", "工程师", "研究人员"]),
    specializations: a([]),
    description: l(`${nameEn} in Malaysia.`, `${nameZh} 是面向国际学生展示的官方项目之一。`),
    officialAccreditationNote: "以专业页和 MQA 记录为准。",
    officialSourceUrl: "https://study.um.edu.my",
    officialEntryRequirementSourceUrl: "https://study.um.edu.my",
    officialAccreditationSourceUrl: "",
    sourceUrls: [],
    officialVerifiedAt: "2026-05-23",
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "费用以官方页面最新公布为准。",
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
      note: "不包含住宿费和个人支出。"
    },
    requirements: {
      language: { ielts, toefl: 80, pte: 50, muet: 4 },
      officialLanguageRequirement: `IELTS ${ielts}`,
      academic: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: l("Relevant academic background required.", "需具备相关学术背景。") },
      officialAcademicRequirement: "按官方专业页面入学要求核对。",
      chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
      specialRequirementsNote: null
    },
    requirementInfo: {
      language: { ielts, toefl: 80, pte: 50, muet: 4 },
      officialLanguageRequirement: `IELTS ${ielts}`,
      academic: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: l("Relevant academic background required.", "需具备相关学术背景。") },
      officialAcademicRequirement: "按官方专业页面入学要求核对。",
      chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
      specialRequirementsNote: null
    }
  };
}

const programs = [
  program(101, 1, "bachelor", "it", "计算机科学学士（人工智能）", "Bachelor of Computer Science (Artificial Intelligence)", "计算机科学与信息技术学院", "RM 74,200", 42000, 5.5),
  program(102, 1, "bachelor", "engineering", "电气工程学士", "Bachelor of Electrical Engineering", "工程学院", "RM 86,400", 52000, 5.5),
  program(201, 1, "master", "it", "数据科学硕士", "Master of Data Science", "计算机科学与信息技术学院", "RM 46,300", 46000, 6),
  program(202, 1, "master", "business", "工商管理硕士", "Master of Business Administration", "商学院", "RM 52,800", 52000, 6),
  program(301, 1, "phd", "it", "计算机科学博士", "Doctor of Philosophy in Computer Science", "计算机科学与信息技术学院", "RM 55,600", 38000, 6),
  program(401, 2, "master", "it", "软件工程硕士", "Master of Software Engineering", "计算机学院", "RM 38,600", 39000, 6),
  program(402, 2, "master", "science", "食品科学硕士", "Master of Food Science", "食品科学学院", "RM 35,200", 36000, 6),
  program(403, 2, "master", "it", "信息安全硕士", "Master of Information Security", "计算机学院", "RM 40,800", 41000, 6),
  program(404, 2, "master", "it", "人工智能硕士", "Master of Artificial Intelligence", "计算机学院", "RM 42,600", 43000, 6),
  program(203, 1, "master", "it", "软件系统工程硕士", "Master of Software Systems Engineering", "计算机科学与信息技术学院", "RM 48,500", 48500, 6)
];
