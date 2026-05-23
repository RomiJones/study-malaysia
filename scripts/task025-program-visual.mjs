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
const taskId = "task025";
const staticHtmlPath = process.env.STATIC_HTML_PATH || "D:\\mydev\\StudyMY_UM_v58_na_display_tidy.html";
const runStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outputRoot = join(root, "output", "playwright", `${taskId}-${runStamp}`);
const childProcesses = [];
const report = {
  taskId: "TASK-025",
  runId: `${taskId}-${runStamp}`,
  startedAt: new Date().toISOString(),
  staticHtmlPath,
  outputRoot,
  screenshots: [],
  comparisons: [],
  fixedItems: [
    "专业列表标题、计数圆点、表格容器、7 列 grid、行按钮字体和 focus 状态对齐静态 HTML。",
    "1180px 以下保留横向滚动，760px 以下专业行按 data-label 转为块状字段。",
    "专业详情弹窗保留桌面居中、移动端贴底、860px 最大宽度和 88vh / 92vh 高度规则。",
    "弹窗章节顺序调整为费用与开学、入学要求、核心课程、职业方向、申请材料、官方来源。",
    "官方来源区域补充费用状态、开学备注、资料备注和多来源链接展示。"
  ],
  remainingDifferences: [
    "Vue 页面由 API 字段驱动；当接口没有完整官方字段时，弹窗会使用回退文案，静态 HTML 则直接读取内置数据。",
    "静态 HTML 关闭按钮使用内联 SVG，Vue 页面仍使用现有文本关闭按钮并保持同等 32px 点击区域。",
    "本脚本记录截图和关键 DOM 指标差异，不做逐像素相似度断言，最终仍需人工抽样查看截图。"
  ]
};

const viewports = [
  { key: "desktop", label: "桌面端", width: 1440, height: 1000 },
  { key: "mobile", label: "移动端", width: 390, height: 844 }
];

const scenarios = [
  { key: "program-list", title: "UM 专业列表", staticTab: "bachelorPrograms", webTab: "本科专业", openModal: false },
  { key: "program-modal", title: "UM 首个专业详情弹窗", staticTab: "bachelorPrograms", webTab: "本科专业", openModal: true }
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
  console.error(`TASK-025 截图对比失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  mockPort = Number(process.env.STUDYMY_TASK025_API_PORT || await getFreePort(4300));
  webPort = Number(process.env.STUDYMY_TASK025_WEB_PORT || await getFreePort(5173));
  mockBaseUrl = `http://127.0.0.1:${mockPort}/api`;
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  report.services = { mockBaseUrl, webBaseUrl };

  await step("启动 mock API", startMockApi);
  await step("启动用户端", startWeb);
  await step("截取静态 HTML 与 Vue 专业列表和弹窗截图", captureScreenshots);

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
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
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
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK025_HEADED !== "1" });
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
  return { screenshots: report.screenshots.length };
}

async function captureScenario(browser, target, scenario, viewport) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1
  });
  try {
    if (target === "static") {
      await page.goto(pathToFileURL(staticHtmlPath).href, { waitUntil: "domcontentloaded" });
      await page.evaluate((tab) => {
        globalThis.viewUni?.(1);
        globalThis.setUniTab?.(tab);
      }, scenario.staticTab);
      await page.waitForSelector(".detail-hero", { timeout: 30_000 });
      await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
      if (scenario.openModal) {
        await page.locator(".programme-grid-row").first().click();
        await page.waitForSelector(".modal", { timeout: 30_000 });
      }
    } else {
      await page.goto(`${webBaseUrl}/universities/universiti-malaya-um`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".detail-hero", { timeout: 30_000 });
      await page.getByRole("tab", { name: scenario.webTab }).click();
      await page.waitForSelector(".programme-grid-row", { timeout: 30_000 });
      if (scenario.openModal) {
        await page.locator(".programme-grid-row").first().click();
        await page.waitForSelector(".program-detail-modal", { timeout: 30_000 });
      }
    }
    await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
    await page.waitForTimeout(350);

    const screenshotPath = join(outputRoot, `${target}-${scenario.key}-${viewport.key}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: !scenario.openModal, animations: "disabled" });
    const metrics = await collectMetrics(page);
    report.screenshots.push({
      target: target === "static" ? "静态 HTML" : "Vue 用户端",
      page: scenario.title,
      viewport: viewport.label,
      path: screenshotPath
    });
    return { path: screenshotPath, metrics };
  } finally {
    await page.close();
  }
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const selectors = [
      ".programme-table-wrap",
      ".programme-table-title",
      ".programme-grid-head",
      ".programme-grid-row",
      ".programme-name-zh",
      ".programme-fee-main",
      ".programme-detail-link",
      ".modal-backdrop",
      ".modal",
      ".modal-header",
      ".modal-section",
      ".req-grid",
      ".program-doc-list",
      ".career-pills",
      ".req-source-link"
    ];
    return {
      url: location.href,
      scrollHeight: Math.round(document.documentElement.scrollHeight),
      counts: {
        programmeRows: document.querySelectorAll(".programme-grid-row").length,
        programmeCells: document.querySelectorAll(".programme-cell").length,
        modalSections: document.querySelectorAll(".modal-section").length,
        reqItems: document.querySelectorAll(".req-item").length,
        documentItems: document.querySelectorAll(".program-doc-list li, .modal-section li").length,
        careerPills: document.querySelectorAll(".career-pill").length,
        sourceLinks: document.querySelectorAll(".req-source-link").length,
        overflowSuspects: overflowSuspects().length
      },
      overflowSuspects: overflowSuspects().slice(0, 12),
      selectors: Object.fromEntries(selectors.map((selector) => [selector, readElement(selector)]))
    };

    function readElement(selector) {
      const element = document.querySelector(selector);
      if (!element) return { missing: true };
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        missing: false,
        text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        fontSize: style.fontSize,
        padding: style.padding
      };
    }

    function overflowSuspects() {
      return Array.from(document.querySelectorAll(".programme-grid-row *, .modal *"))
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") return false;
          if (style.overflowX === "auto" || style.overflowX === "scroll") return false;
          return element.scrollWidth - element.clientWidth > 2;
        })
        .map((element) => ({
          selector: String(element.className || element.tagName.toLowerCase()),
          text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth
        }));
    }
  });
}

function compareScenario(scenario, viewport, staticResult, webResult) {
  const differences = [];
  if (webResult.metrics.counts.programmeRows < 1) {
    differences.push("Vue 专业列表未检测到专业行。");
  }
  if (scenario.openModal && webResult.metrics.counts.modalSections < 5) {
    differences.push(`Vue 专业弹窗章节数量偏少：${webResult.metrics.counts.modalSections}。`);
  }
  if (scenario.openModal && webResult.metrics.counts.documentItems < 1) {
    differences.push("Vue 专业弹窗未检测到申请材料。");
  }
  if (scenario.openModal && webResult.metrics.counts.sourceLinks < 1) {
    differences.push("Vue 专业弹窗未检测到官方来源链接。");
  }
  if (scenario.openModal && webResult.metrics.selectors[".modal"].missing) {
    differences.push("Vue 专业弹窗未打开。");
  }
  if (!scenario.openModal && webResult.metrics.selectors[".programme-grid-head"].missing && viewport.key !== "mobile") {
    differences.push("Vue 桌面专业列表未检测到表头。");
  }
  if (webResult.metrics.counts.overflowSuspects > 0) {
    differences.push(`检测到 ${webResult.metrics.counts.overflowSuspects} 个可能文本溢出元素，请结合 overflowSuspects 明细复核。`);
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
  lines.push("# TASK-025 专业列表和专业详情弹窗视觉截图对比报告");
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
    if (!item.differences.length) {
      lines.push("- 自动指标未检测到阻塞级差异，仍需结合截图人工复核。");
    } else {
      for (const diff of item.differences) lines.push(`- ${diff}`);
    }
    lines.push("");
  }
  lines.push("## 说明");
  lines.push("");
  lines.push("- 本报告使用 mock API 固定 UM 专业字段，避免本地数据库状态影响专业列表和弹窗视觉验证。");
  lines.push("- Notion 未在脚本中更新；报告保存到本地 `output/playwright/`。");
  return `${lines.join("\n")}\n`;
}

function routePayload(pathname) {
  if (pathname === "/api/universities/meta/home") {
    return {
      stats: { universityCount: 1, programCount: programs.length, bestQsRank: 60 },
      contentBlocks: []
    };
  }
  if (pathname === "/api/universities") return [universityListItem];
  if (pathname === "/api/programs") return programs;
  if (pathname === "/api/universities/universiti-malaya-um" || pathname === "/api/universities/universiti-malaya") {
    return { ...universityListItem, programs };
  }
  if (pathname.startsWith("/api/programs/detail/")) {
    const id = Number(pathname.split("/").pop());
    const program = programs.find((item) => item.id === id) || programs[0];
    return { ...program, university: universityListItem, annualCostCny: program.annualTuitionCny + universityListItem.livingCostCny };
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

const l = (en, zhCN) => ({ en, ms: en, "zh-CN": zhCN, "zh-TW": zhCN });
const a = (items) => ({ en: items, ms: items, "zh-CN": items, "zh-TW": items });

const universityListItem = {
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
  description: l(
    "Universiti Malaya is Malaysia's flagship research university with strong international recognition.",
    "马来亚大学是马来西亚旗舰研究型大学，拥有较高国际认可度，学科覆盖广泛，适合作为公立研究型院校重点对比对象。"
  ),
  website: "https://www.um.edu.my",
  admissionEmail: "study@um.edu.my",
  officialWebsite: "https://www.um.edu.my",
  studyPortalUrl: "https://study.um.edu.my",
  internationalPageUrl: "https://study.um.edu.my/international",
  applicationPortalUrl: "https://maya.um.edu.my",
  officialAddress: "Universiti Malaya, 50603 Kuala Lumpur, Malaysia",
  applicationPeriods: ["第一学期（10月）申请以官方入口开放时间为准", "第二学期（3月）部分研究生项目开放"],
  applicationFees: ["本科 / 授课型硕士申请费以官方系统显示为准", "研究型项目可能需要额外审核材料"],
  applicationDocuments: a(["护照", "成绩单", "语言成绩", "个人陈述", "推荐信（硕博）"]),
  chinaStudentRequirements: a(["中国学生需按专业页核对高中 / 本科成绩、语言要求和材料公证要求。"]),
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
    qualityNote: "官方入口、基础资料、申请入口和专业费用字段已按静态 HTML 基线整理。",
    sourceNote: "以 UM 官网、Study Portal 和官方申请入口为主要来源。",
    verifiedAt: "2026-05-23",
    tuitionAudit: {
      displayText: "按专业显示 RM 官方总学费",
      notes: ["每个专业显示官方国际学生总学费，费用以官方最新公布为准。"]
    },
    undergraduateAudit: {
      officialBachelorTotal: 4,
      readyForPublicDisplay: 4,
      needsReview: 0,
      notAvailableForInternational: 0
    },
    applicationPeriods: [
      { label: "本科", value: "第一学期（10月）为主" },
      { label: "研究生", value: "3月 / 10月或滚动开放" }
    ],
    applicationFees: [
      { label: "申请费", value: "以官方系统显示为准" }
    ],
    applicationDocuments: ["护照", "成绩单", "语言成绩", "个人陈述", "研究计划（研究型）"],
    chinaRequirement: { summary: "中国学生需按具体专业核对高中 / 本科成绩、语言要求、公证翻译和补充材料。" }
  },
  officialSources: [
    { title: "Official website", url: "https://www.um.edu.my", sourceType: "official-website", verifiedAt: "2026-05-23", status: "official-verified", note: null },
    { title: "Study Portal", url: "https://study.um.edu.my", sourceType: "study-portal", verifiedAt: "2026-05-23", status: "official-verified", note: null }
  ],
  officialVerifiedAt: "2026-05-23",
  officialSourceStatus: "official-verified",
  officialAuditSummary: "UM 官方资料已核验，专业页费用和入学要求以官方页面为准。",
  publicDisplayStatus: "ready",
  livingCostOfficialNote: "吉隆坡生活费需按住宿与个人消费调整。",
  tuitionMinCny: 32000,
  tuitionMaxCny: 92000,
  livingCostCny: 30000,
  minIelts: 5.5,
  acceptNoLanguage: false,
  facilities: a(["中央图书馆", "大学医学中心", "创新中心", "国际学生服务中心"]),
  highlights: a(["马来西亚排名领先的公立研究型大学", "QS 世界排名 Top 100", "课程覆盖本科、硕士与博士", "吉隆坡核心位置"]),
  programCount: 6
};

function program(id, level, nameZh, nameEn, facultyZh, tuitionDisplay, durationOfficial, officialIntake, ielts) {
  return {
    id,
    universityId: 1,
    slug: `um-program-${id}`,
    code: `UM-${id}`,
    name: l(nameEn, nameZh),
    nameEn,
    nameEnOfficial: nameEn,
    level,
    category: level === "bachelor" ? "it" : id % 2 ? "business" : "science",
    faculty: l(facultyZh, facultyZh),
    facultyZh,
    studyMode: "Full time",
    campus: "Main campus",
    durationYears: level === "bachelor" ? 3.5 : level === "master" ? 1.5 : 3,
    durationOfficial,
    annualTuitionCny: 42000,
    tuitionAmount: null,
    tuitionCurrency: "MYR",
    tuitionDisplay,
    officialTuitionMYR: Number(tuitionDisplay.replace(/\D/g, "")) || null,
    officialFeeSourceUrl: "https://study.um.edu.my/fees",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: "2026-05-23",
    intakeMonths: ["October"],
    officialIntake,
    officialIntakeNote: "Subject to the availability of the programme offering.",
    languageRequirement: { ielts, toefl: 80, pte: 50, muet: 4 },
    officialLanguageRequirement: `IELTS ${ielts}`,
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: l("Relevant academic background required.", "需具备相关学术背景。") },
    officialAcademicRequirement: "按官方专业页面入学要求核对。",
    chinaStudentRequirement: "中国学生需准备成绩单、公证翻译和语言成绩。",
    applicationDocs: a(["护照", "成绩单", "语言成绩", "个人陈述"]),
    curriculum: a(["核心课程", "研究方法", "行业项目"]),
    careers: a(["分析师", "工程师", "研究人员"]),
    specializations: a([]),
    description: l(`${nameEn} at Universiti Malaya.`, `${nameZh} 是马来亚大学面向国际学生展示的官方项目之一。`),
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
    auditNote: "SST、住宿费和费用变动说明保留在详情页字段，以官方页面最新公布为准。",
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
      note: "不包含可能适用的 SST、住宿费和个人支出。"
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
  program(101, "bachelor", "计算机科学学士（人工智能）", "Bachelor of Computer Science (Artificial Intelligence)", "计算机科学与信息技术学院", "RM 74,200", "3.5 Years", "Semester 1 (October) Intake", 5.5),
  program(102, "bachelor", "电气工程学士", "Bachelor of Electrical Engineering", "工程学院", "RM 86,400", "4 Years", "Semester 1 (October) Intake", 5.5),
  program(201, "master", "数据科学硕士", "Master of Data Science", "计算机科学与信息技术学院", "RM 46,300", "1.5 Years", "Semester 1 (October) / Semester 2 (March) Intake", 6),
  program(202, "master", "公共卫生硕士", "Master of Public Health", "医学与公共卫生学院", "RM 44,800", "1.5 Years", "March Intake", 6),
  program(301, "phd", "计算机科学博士", "Doctor of Philosophy in Computer Science", "计算机科学与信息技术学院", "RM 55,600", "3 Years", "Rolling", 6),
  program(302, "phd", "教育学博士", "Doctor of Philosophy in Education", "教育学院", "RM 48,200", "3 Years", "Rolling", 6)
];
