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
const taskId = "task026";
const staticHtmlPath = process.env.STATIC_HTML_PATH || "D:\\mydev\\StudyMY_UM_v58_na_display_tidy.html";
const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputRoot = join(root, "output", "playwright", `${taskId}-${runStamp}`);
const childProcesses = [];
const report = {
  taskId: "TASK-026",
  runId: `${taskId}-${runStamp}`,
  startedAt: new Date().toISOString(),
  staticHtmlPath,
  outputRoot,
  screenshots: [],
  comparisons: [],
  fixedItems: [
    "收藏页改为静态页接近的紧凑收藏卡片和纵向专业收藏列表。",
    "规划页顶部改为静态页接近的标题、说明、五标签页和概览卡片节奏。",
    "费用估算、智能推荐、登录 / 注册弹窗去除与静态页差异较大的额外控件。",
    "保留材料进度、申请任务、签证清单、浮动按钮、桌面居中和移动贴底弹窗状态。"
  ],
  remainingDifferences: [
    "Vue 页面由 API 和本地状态驱动，静态 HTML 使用内置数组和全局状态；具体院校 / 专业字段可能不完全一致。",
    "Vue 端关闭按钮使用文本 ×，静态页部分位置使用内联 SVG；点击区域和视觉层级保持一致。",
    "本脚本记录截图、DOM 样式和关键数量差异，不做逐像素相似度断言，最终仍需结合截图人工抽样复核。"
  ]
};

const viewports = [
  { key: "desktop", label: "桌面端", width: 1440, height: 1000 },
  { key: "mobile", label: "移动端", width: 390, height: 844 }
];

const scenarios = [
  {
    key: "favorites-filled",
    title: "收藏页已收藏状态",
    kind: "page",
    requiredSelector: ".fav-empty, .favorite-university-card, .university-card, .card",
    metricPairs: [
      pair("导航", "#nav", ".site-header"),
      pair("右下浮动按钮", ".fab-group, .floating-tools", ".floating-tools"),
      pair("收藏页主体", ".container.section", ".favorites-page"),
      pair("收藏卡片", ".fav-empty, .card", ".favorite-university-card, .favorite-program-card")
    ],
    countPairs: [
      pair("收藏卡片", ".card", ".favorite-university-card, .favorite-program-card")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await runStatic(page, `
        const firstUniversity = universities[0];
        const firstProgram = firstUniversity.programs[0];
        S.favorites = { universities:[firstUniversity.id], programs:[firstProgram.id] };
        ss(STORAGE_KEYS.favorites, S.favorites);
        nav('favorites');
      `);
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/favorites");
    }
  },
  {
    key: "favorites-empty",
    title: "收藏页空状态",
    kind: "page",
    requiredSelector: ".fav-empty",
    metricPairs: [
      pair("空状态", ".fav-empty", ".fav-empty"),
      pair("空状态图标", ".fav-empty-icon", ".fav-empty-icon")
    ],
    countPairs: [
      pair("空状态", ".fav-empty", ".fav-empty")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await runStatic(page, `
        S.favorites = { universities:[], programs:[] };
        ss(STORAGE_KEYS.favorites, S.favorites);
        nav('favorites');
      `);
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/favorites");
    }
  },
  {
    key: "compare-filled",
    title: "对比页表格状态",
    kind: "page",
    requiredSelector: ".compare-table",
    metricPairs: [
      pair("对比页主体", ".container.section", ".compare-page"),
      pair("对比表格", ".compare-table", ".compare-table"),
      pair("对比标签列", ".compare-label-col", ".compare-label-col")
    ],
    countPairs: [
      pair("对比表头", ".compare-table th", ".compare-table th"),
      pair("对比行", ".compare-table tbody tr", ".compare-table tbody tr")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await runStatic(page, `
        S.compareList = universities.slice(0,2).map(u => u.id);
        ss(STORAGE_KEYS.compareList, S.compareList);
        nav('compare');
      `);
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/compare");
    }
  },
  {
    key: "compare-empty",
    title: "对比页空状态",
    kind: "page",
    requiredSelector: ".fav-empty",
    metricPairs: [
      pair("空状态", ".fav-empty", ".fav-empty"),
      pair("空状态图标", ".fav-empty-icon", ".fav-empty-icon")
    ],
    countPairs: [
      pair("空状态", ".fav-empty", ".fav-empty")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await runStatic(page, `
        S.compareList = [];
        ss(STORAGE_KEYS.compareList, S.compareList);
        nav('compare');
      `);
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/compare");
    }
  },
  {
    key: "planner-overview",
    title: "规划页申请概览",
    kind: "page",
    requiredSelector: ".planner-tabs",
    metricPairs: [
      pair("规划页主体", ".container.section", ".planner-page"),
      pair("规划标签页", ".planner-tabs", ".planner-tabs"),
      pair("进度卡片", ".progress-bar", ".progress-bar"),
      pair("推荐卡片", ".rec-card", ".rec-card, .fav-empty")
    ],
    countPairs: [
      pair("规划标签", ".planner-tab", ".planner-tab"),
      pair("推荐卡片", ".rec-card", ".rec-card")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await seedStaticPlanner(page, "overview");
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/planner");
    }
  },
  {
    key: "planner-materials",
    title: "规划页材料清单",
    kind: "page",
    requiredSelector: ".material-item",
    metricPairs: [
      pair("规划标签页", ".planner-tabs", ".planner-tabs"),
      pair("材料项", ".material-item", ".material-item"),
      pair("材料状态", ".material-status", ".material-status")
    ],
    countPairs: [
      pair("材料项", ".material-item", ".material-item")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await seedStaticPlanner(page, "materials");
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/planner");
      await page.getByRole("button", { name: "材料清单" }).click();
    }
  },
  {
    key: "planner-visa",
    title: "规划页签证清单",
    kind: "page",
    requiredSelector: ".visa-step",
    metricPairs: [
      pair("规划标签页", ".planner-tabs", ".planner-tabs"),
      pair("签证步骤", ".visa-step", ".visa-step"),
      pair("签证勾选", ".visa-check", ".visa-check")
    ],
    countPairs: [
      pair("签证步骤", ".visa-step", ".visa-step"),
      pair("完成签证步骤", ".visa-step.done", ".visa-step.done")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await seedStaticPlanner(page, "visa");
    },
    webSetup: async (page) => {
      await gotoWeb(page, "/planner");
      await page.getByRole("button", { name: "签证清单" }).click();
    }
  },
  {
    key: "auth-modal",
    title: "登录弹窗",
    kind: "modal",
    requiredSelector: ".modal-backdrop, #authModal",
    metricPairs: [
      pair("登录遮罩", ".modal-backdrop", ".modal-backdrop"),
      pair("登录面板", "#authModal .modal", ".auth-panel"),
      pair("登录标签页", ".auth-tabs", ".auth-tabs"),
      pair("登录表单", ".auth-modal-body", ".auth-form")
    ],
    countPairs: [
      pair("登录输入项", "#authModal input", ".auth-form input")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.openAuth?.("login"));
    },
    webSetup: async (page) => {
      await gotoWeb(page);
      await page.evaluate(() => document.querySelector(".header-actions .primary-action")?.click());
      await page.waitForSelector(".auth-panel", { timeout: 30_000 });
    }
  },
  {
    key: "calculator-modal",
    title: "费用计算弹窗",
    kind: "modal",
    requiredSelector: ".tool-modal-inner, #calcModal",
    metricPairs: [
      pair("费用遮罩", "#calcModal", ".modal-backdrop"),
      pair("费用面板", "#calcModal .tool-modal-inner", ".tool-modal-inner--calculator"),
      pair("费用头部", "#calcModal .tool-modal-header", ".tool-modal-header"),
      pair("费用表单", "#calcModal .tool-modal-body", ".tool-modal-body"),
      pair("费用结果卡", "#calcModal .calc-result", ".calc-result")
    ],
    countPairs: [
      pair("费用输入项", "#calcModal input", ".calculator-grid input")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await page.evaluate(() => globalThis.openCalc?.());
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
    metricPairs: [
      pair("推荐遮罩", "#recModal", ".modal-backdrop"),
      pair("推荐面板", "#recModal .tool-modal-inner", ".tool-modal-inner--recommend"),
      pair("推荐头部", "#recModal .tool-modal-header", ".tool-modal-header"),
      pair("推荐卡片", "#recModal .rec-card", ".rec-card"),
      pair("推荐分数", "#recModal .rec-score", ".rec-score")
    ],
    countPairs: [
      pair("推荐卡片", "#recModal .rec-card", ".rec-card")
    ],
    staticSetup: async (page) => {
      await gotoStatic(page);
      await seedStaticPlanner(page, "overview");
      await page.evaluate(() => globalThis.openRec?.());
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
  console.error(`TASK-026 截图对比失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  mockPort = Number(process.env.STUDYMY_TASK026_API_PORT || await getFreePort(4300));
  webPort = Number(process.env.STUDYMY_TASK026_WEB_PORT || await getFreePort(5173));
  mockBaseUrl = `http://127.0.0.1:${mockPort}/api`;
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  report.services = { mockBaseUrl, webBaseUrl };

  await step("启动 mock API", startMockApi);
  await step("启动用户端", startWeb);
  await step("截取工具页和弹窗截图", captureScreenshots);

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
    const payload = routePayload(url.pathname);
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
  const env = {
    ...process.env,
    VITE_API_BASE_URL: mockBaseUrl
  };
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
  ], env));
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
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK026_HEADED !== "1" });
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
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
    }, buildWebStorage(scenario));
  }

  const page = await context.newPage();
  try {
    if (target === "static") await scenario.staticSetup(page);
    else await scenario.webSetup(page);
    await waitForPageReady(page);
    await page.waitForSelector(scenario.requiredSelector, { timeout: 30_000 });

    const screenshotPath = join(outputRoot, `${target}-${scenario.key}-${viewport.key}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: scenario.kind !== "modal",
      animations: "disabled"
    });
    const metrics = await collectMetrics(page, scenario.metricPairs, scenario.countPairs, target);
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
      study_plan: "wait",
      recommendation: "draft"
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
      targetCategory: "IT",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6,
      experience: "1-3 years",
      acceptNoLanguage: true
    })
  };
  if (scenario.key === "favorites-filled") {
    storage.studymy_favorites = JSON.stringify({ universities: [1], programs: [201] });
  }
  if (scenario.key === "favorites-empty") {
    storage.studymy_favorites = JSON.stringify({ universities: [], programs: [] });
  }
  if (scenario.key === "compare-filled") {
    storage.studymy_compare = JSON.stringify([1, 2]);
  }
  if (scenario.key === "compare-empty") {
    storage.studymy_compare = JSON.stringify([]);
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
    S.materialProgress = { passport:'done', photo:'progress', transcript:'wait', language:'draft', degree_certificate:'progress', study_plan:'wait', recommendation:'draft' };
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
    return {
      url: location.href,
      scrollHeight: Math.round(document.documentElement.scrollHeight),
      bodyTextSample: compactText(document.body.innerText || "", 220),
      root: {
        bodyBackground: bodyStyle.backgroundColor,
        bodyFontFamily: bodyStyle.fontFamily,
        ink: rootStyle.getPropertyValue("--ink").trim(),
        paper: rootStyle.getPropertyValue("--paper").trim(),
        gold: rootStyle.getPropertyValue("--gold").trim(),
        teal: rootStyle.getPropertyValue("--teal").trim(),
        radius: rootStyle.getPropertyValue("--r").trim()
      },
      selectors: Object.fromEntries(selectors.map((item) => [item.label, readElement(item.selector)])),
      counts: Object.fromEntries(counts.map((item) => [item.label, document.querySelectorAll(item.selector).length])),
      overflowSuspects: overflowSuspects().slice(0, 12)
    };

    function readElement(selector) {
      const element = document.querySelector(selector);
      if (!element) return { selector, missing: true };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        missing: false,
        text: compactText(element.innerText || element.textContent || "", 140),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        fontFamily: style.fontFamily,
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
          const rect = element.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 12) return false;
      if (element.closest(".hero-panel")) return false;
      return element.scrollWidth - element.clientWidth > 3;
        })
        .map((element) => ({
          selector: String(element.className || element.tagName.toLowerCase()),
          text: compactText(element.textContent || "", 90),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth
        }));
    }

    function compactText(value, length) {
      return value.replace(/\s+/g, " ").trim().slice(0, length);
    }
  }, { selectors, counts });
}

function compareScenario(scenario, viewport, staticResult, webResult) {
  const differences = [];
  for (const [label, staticCount] of Object.entries(staticResult.metrics.counts)) {
    const webCount = webResult.metrics.counts[label];
    if (webCount !== undefined && staticCount !== webCount) {
      differences.push(`${label} 数量不同：静态 HTML ${staticCount}，Vue ${webCount}。`);
    }
  }
  for (const pair of scenario.metricPairs) {
    const left = staticResult.metrics.selectors[pair.label];
    const right = webResult.metrics.selectors[pair.label];
    if (!left || !right) continue;
    if (left.missing || right.missing) {
      differences.push(`${pair.label} 可用性不同：静态 HTML ${left.missing ? "缺失" : "存在"}，Vue ${right.missing ? "缺失" : "存在"}。`);
      continue;
    }
    const widthDelta = Math.abs(left.rect.width - right.rect.width);
    const heightDelta = Math.abs(left.rect.height - right.rect.height);
    if (widthDelta > Math.max(96, left.rect.width * 0.32)) {
      differences.push(`${pair.label} 宽度差异较大：静态 HTML ${left.rect.width}px，Vue ${right.rect.width}px。`);
    }
    if (scenario.kind === "modal" && heightDelta > Math.max(96, left.rect.height * 0.36)) {
      differences.push(`${pair.label} 高度差异较大：静态 HTML ${left.rect.height}px，Vue ${right.rect.height}px。`);
    }
    if (normalizeCss(left.borderRadius) !== normalizeCss(right.borderRadius) && pair.label.includes("面板")) {
      differences.push(`${pair.label} 圆角不同：静态 HTML ${left.borderRadius}，Vue ${right.borderRadius}。`);
    }
  }
  if (webResult.metrics.overflowSuspects.length) {
    differences.push(`Vue 检测到 ${webResult.metrics.overflowSuspects.length} 个可能文本溢出元素，需结合 JSON 明细复核。`);
  }

  return {
    page: scenario.title,
    viewport: viewport.label,
    viewportSize: `${viewport.width}x${viewport.height}`,
    staticScreenshot: staticResult.path,
    webScreenshot: webResult.path,
    differenceCount: differences.length,
    differences,
    staticMetrics: staticResult.metrics,
    webMetrics: webResult.metrics
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
  lines.push("# TASK-026 工具页与弹窗视觉截图对比报告");
  lines.push("");
  lines.push(`- 运行编号：${report.runId}`);
  lines.push(`- 静态 HTML：${report.staticHtmlPath}`);
  lines.push(`- Vue 用户端：${report.services?.webBaseUrl || "未启动"}`);
  lines.push(`- 输出目录：${report.outputRoot}`);
  lines.push(`- 状态：${report.status || "运行中"}`);
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
    lines.push(`### ${item.page} / ${item.viewport}（${item.viewportSize}）`);
    lines.push("");
    lines.push(`- 静态截图：${item.staticScreenshot}`);
    lines.push(`- Vue 截图：${item.webScreenshot}`);
    lines.push(`- 自动检测差异数：${item.differenceCount}`);
    if (!item.differences.length) {
      lines.push("- 自动指标未检测到阻塞级差异，仍需结合截图人工复核。");
    } else {
      for (const diff of item.differences) lines.push(`- ${diff}`);
    }
    lines.push("");
  }
  lines.push("## 说明");
  lines.push("");
  lines.push("- 本报告使用 mock API 固定收藏、对比、规划、费用估算、智能推荐和登录弹窗状态，避免本地数据库状态影响视觉验证。");
  lines.push("- Notion 未在脚本中更新；报告保存到本地 `output/playwright/`。");
  return `${lines.join("\n")}\n`;
}

function routePayload(pathname) {
  if (pathname === "/api/universities/meta/home") {
    return {
      stats: { universityCount: universities.length, programCount: programs.length, bestQsRank: 60 },
      contentBlocks: []
    };
  }
  if (pathname === "/api/universities") return universities;
  if (pathname === "/api/programs") return programs;
  if (pathname.startsWith("/api/universities/")) {
    const slug = pathname.split("/").pop();
    const university = universities.find((item) => item.slug === slug) || universities[0];
    return { ...university, programs: programs.filter((item) => item.universityId === university.id) };
  }
  if (pathname.startsWith("/api/programs/detail/")) {
    const id = Number(pathname.split("/").pop());
    const program = programs.find((item) => item.id === id) || programs[0];
    const university = universities.find((item) => item.id === program.universityId) || universities[0];
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

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function pair(label, staticSelector, webSelector) {
  return { label, static: staticSelector, web: webSelector };
}

function normalizeCss(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
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
    description: l("Malaysia's flagship research university.", "马来西亚旗舰研究型大学，位于吉隆坡核心区域。"),
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
    officialProfile: null,
    officialSources: [],
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
    facilities: a(["中央图书馆", "大学医学中心", "创新中心"]),
    highlights: a(["QS 世界排名 Top 100", "公立研究型大学", "课程覆盖广泛"]),
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
    officialIntake: "Semester 1 (October)",
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
  program(201, 1, "master", "it", "数据科学硕士", "Master of Data Science", "计算机科学与信息技术学院", "RM 46,300", 46000, 6),
  program(202, 1, "master", "business", "工商管理硕士", "Master of Business Administration", "商学院", "RM 52,800", 52000, 6),
  program(301, 1, "phd", "it", "计算机科学博士", "Doctor of Philosophy in Computer Science", "计算机科学与信息技术学院", "RM 55,600", 38000, 6),
  program(401, 2, "master", "it", "软件工程硕士", "Master of Software Engineering", "计算机学院", "RM 38,600", 39000, 6),
  program(402, 2, "master", "science", "食品科学硕士", "Master of Food Science", "食品科学学院", "RM 35,200", 36000, 6),
  program(403, 2, "master", "it", "信息安全硕士", "Master of Information Security", "计算机学院", "RM 40,800", 41000, 6),
  program(404, 2, "master", "it", "人工智能硕士", "Master of Artificial Intelligence", "计算机学院", "RM 42,600", 43000, 6),
  program(203, 1, "master", "it", "软件系统工程硕士", "Master of Software Systems Engineering", "计算机科学与信息技术学院", "RM 48,500", 48500, 6),
  program(204, 1, "master", "it", "网络安全硕士", "Master of Cyber Security", "计算机科学与信息技术学院", "RM 49,800", 49800, 6)
];
