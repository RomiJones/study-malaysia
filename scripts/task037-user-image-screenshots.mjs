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
const outputRoot = join(root, "output", "playwright", `task037-${runStamp}`);
const childProcesses = [];
const report = {
  taskId: "TASK-037",
  runId: `task037-${runStamp}`,
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
  console.error(`TASK-037 user image screenshot check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await stopServices();
});

async function main() {
  mockPort = Number(process.env.STUDYMY_TASK037_API_PORT || await getFreePort(4500));
  webPort = Number(process.env.STUDYMY_TASK037_WEB_PORT || await getFreePort(5190));
  mockBaseUrl = `http://127.0.0.1:${mockPort}/api`;
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  report.services = { mockBaseUrl, webBaseUrl };

  await step("start mock API", startMockApi);
  await step("start web app", startWeb);
  await step("desktop user image pages", auditDesktopPages);
  await step("recommend modal images", auditRecommendModal);
  await step("mobile user image pages", auditMobilePages);

  report.status = "passed";
  report.finishedAt = new Date().toISOString();
  await writeReport();
  console.log(JSON.stringify({
    status: report.status,
    outputRoot: normalizePath(outputRoot),
    jsonReport: normalizePath(join(outputRoot, "task037-user-image-screenshots.json")),
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

async function auditDesktopPages() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK037_HEADED !== "1" });
  const results = [];
  try {
    const context = await newContext(browser, { width: 1440, height: 1000 });
    const page = await context.newPage();
    attachRequestAudit(page);

    results.push(await auditPage(page, "/", ".university-card", "home-desktop.png"));
    results.push(await auditPage(page, "/universities/universiti-malaya-um", ".detail-hero", "university-detail-desktop.png"));
    results.push(await auditPage(page, "/favorites", ".favorite-university-card", "favorites-desktop.png"));
    results.push(await auditPage(page, "/compare", ".compare-table", "compare-desktop.png"));
    results.push(await auditPage(page, "/planner", ".planner-panel", "planner-desktop.png"));

    await context.close();
  } finally {
    await browser.close();
  }
  return results;
}

async function auditRecommendModal() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK037_HEADED !== "1" });
  try {
    const context = await newContext(browser, { width: 1440, height: 1000 });
    const page = await context.newPage();
    attachRequestAudit(page);
    await page.goto(webBaseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".university-card").first().waitFor({ timeout: 30_000 });
    await page.locator(".floating-tools .floating-tool").nth(1).click();
    await page.locator(".tool-modal-inner--recommend").waitFor({ timeout: 30_000 });
    await screenshot(page, "recommend-modal-desktop.png");
    const result = await assertHealthyImages(page, "recommend modal");
    await context.close();
    return result;
  } finally {
    await browser.close();
  }
}

async function auditMobilePages() {
  const browser = await chromium.launch({ headless: process.env.STUDYMY_TASK037_HEADED !== "1" });
  try {
    const context = await newContext(browser, { width: 390, height: 844 });
    const page = await context.newPage();
    attachRequestAudit(page);
    const home = await auditPage(page, "/", ".university-card", "home-mobile.png");
    const detail = await auditPage(page, "/universities/universiti-malaya-um", ".detail-hero", "university-detail-mobile.png");
    await context.close();
    return [home, detail];
  } finally {
    await browser.close();
  }
}

async function auditPage(page, pathname, readySelector, screenshotName) {
  await page.goto(`${webBaseUrl}${pathname}`, { waitUntil: "domcontentloaded" });
  await page.locator(readySelector).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(300);
  await screenshot(page, screenshotName);
  return assertHealthyImages(page, pathname);
}

async function newContext(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.route("https://fonts.googleapis.com/**", (route) => {
    route.fulfill({ status: 200, contentType: "text/css", body: "" });
  });
  await context.route("https://fonts.gstatic.com/**", (route) => {
    route.fulfill({ status: 204, body: "" });
  });
  await context.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("studymy_locale", "zh-CN");
    localStorage.setItem("studymy_favorites", JSON.stringify({ universities: [1, 2], programs: [1001] }));
    localStorage.setItem("studymy_compare", JSON.stringify([1, 2]));
    localStorage.setItem("studymy_profile", JSON.stringify({
      level: "master",
      targetCategory: "it",
      budgetCny: 90000,
      gpa: 3.2,
      ielts: 6,
      experience: "1-3 years",
      acceptNoLanguage: true
    }));
  });
  return context;
}

function attachRequestAudit(page) {
  const imageRequests = [];
  const externalImageRequests = [];
  const failedImageRequests = [];

  page.on("request", (request) => {
    if (request.resourceType() !== "image") return;
    const url = request.url();
    imageRequests.push(url);
    if (!url.startsWith(webBaseUrl) && !url.startsWith("data:image/")) {
      externalImageRequests.push(url);
    }
  });
  page.on("requestfailed", (request) => {
    if (request.resourceType() !== "image") return;
    failedImageRequests.push(`${request.url()} ${request.failure()?.errorText || ""}`.trim());
  });

  page.__task037ImageAudit = { imageRequests, externalImageRequests, failedImageRequests };
}

async function assertHealthyImages(page, label) {
  await page.waitForLoadState("domcontentloaded");
  const imageResults = await page.evaluate(() => Array.from(document.images).map((image) => ({
    alt: image.alt,
    src: image.currentSrc || image.src,
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    visible: Boolean(image.offsetWidth || image.offsetHeight || image.getClientRects().length)
  })));
  const brokenImages = imageResults.filter((image) =>
    image.visible && (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0)
  );
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  const audit = page.__task037ImageAudit || { imageRequests: [], externalImageRequests: [], failedImageRequests: [] };

  assert(audit.externalImageRequests.length === 0, `${label} requested external images: ${audit.externalImageRequests.join(", ")}`);
  assert(audit.failedImageRequests.length === 0, `${label} has failed image requests: ${audit.failedImageRequests.join(", ")}`);
  assert(brokenImages.length === 0, `${label} has broken visible images: ${JSON.stringify(brokenImages, null, 2)}`);
  assert(metrics.scrollWidth <= metrics.viewportWidth + 1, `${label} has horizontal overflow: ${metrics.scrollWidth} > ${metrics.viewportWidth}`);

  return {
    label,
    checkedDomImages: imageResults.length,
    imageRequests: audit.imageRequests.length,
    externalImageRequests: audit.externalImageRequests,
    failedImageRequests: audit.failedImageRequests,
    scrollWidth: metrics.scrollWidth,
    viewportWidth: metrics.viewportWidth
  };
}

async function screenshot(page, filename) {
  const filePath = join(outputRoot, filename);
  await page.screenshot({ path: filePath, fullPage: true });
  report.screenshots.push(normalizePath(filePath));
}

function routePayload(pathname) {
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
  if (pathname === "/api/search/suggestions") return [];
  if (pathname.startsWith("/api/universities/")) {
    const slug = pathname.split("/").pop();
    const university = universities.find((item) => item.slug === slug) || universities[0];
    return { ...university, programs: programs.filter((programItem) => programItem.universityId === university.id) };
  }
  if (pathname.startsWith("/api/programs/") && !pathname.startsWith("/api/programs/detail/")) {
    const slug = pathname.split("/").pop();
    const programItem = programs.find((item) => item.slug === slug) || programs[0];
    const university = universities.find((item) => item.id === programItem.universityId) || universities[0];
    return { ...programItem, university };
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
  writeFileSync(join(outputRoot, "task037-user-image-screenshots.json"), JSON.stringify(report, null, 2), "utf8");
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

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

const logoFallback = "/assets/static-html/fallback-university-logo.svg";
const coverFallback = "/assets/static-html/fallback-university-cover.svg";

const universities = [
  {
    id: 1,
    slug: "universiti-malaya-um",
    code: "UM",
    name: localized("Universiti Malaya", "马来亚大学", "Universiti Malaya", "馬來亞大學"),
    shortName: "UM",
    nameEn: "Universiti Malaya",
    nameEnOfficial: "Universiti Malaya",
    logoUrl: logoFallback,
    imageUrl: "/assets/static-html/card-image-photo-1562774053-701939374585-81c45bbca274.jpg",
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
    description: localized("Malaysia's flagship research university.", "马来西亚旗舰研究型大学，位于吉隆坡核心区域。", "Universiti penyelidikan utama Malaysia.", "馬來西亞旗艦研究型大學，位於吉隆坡核心區域。"),
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
    facilities: localizedArray(["Library", "Research labs"], ["图书馆", "研究实验室"], ["Perpustakaan", "Makmal penyelidikan"], ["圖書館", "研究實驗室"]),
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
    logoUrl: logoFallback,
    imageUrl: "/assets/static-html/card-image-photo-1541339907198-e08756dedf3f-8421a6bf5c1a.jpg",
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
    facilities: localizedArray(["Library", "Agriculture labs"], ["图书馆", "农业实验室"], ["Perpustakaan", "Makmal pertanian"], ["圖書館", "農業實驗室"]),
    highlights: localizedArray(["Research university"], ["研究型大学"], ["Universiti penyelidikan"], ["研究型大學"]),
    programCount: 2
  },
  {
    id: 3,
    slug: "taylors-university",
    code: "TAYLORS",
    name: localized("Taylor's University", "泰莱大学", "Taylor's University", "泰萊大學"),
    shortName: "Taylor's",
    nameEn: "Taylor's University",
    nameEnOfficial: "Taylor's University",
    logoUrl: logoFallback,
    imageUrl: coverFallback,
    color: "#C43830",
    qsRank: 253,
    qsAsiaRank: 41,
    location: localized("Subang Jaya", "梳邦再也", "Subang Jaya", "梳邦再也"),
    region: localized("Selangor", "雪兰莪", "Selangor", "雪蘭莪"),
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 1969,
    students: 20000,
    intlStudents: 6000,
    csrCertified: true,
    description: localized("A private comprehensive university near Kuala Lumpur.", "位于吉隆坡周边的私立综合型大学。", "Universiti swasta komprehensif berhampiran Kuala Lumpur.", "位於吉隆坡周邊的私立綜合型大學。"),
    website: "https://university.taylors.edu.my",
    admissionEmail: "admissions@taylors.edu.my",
    officialWebsite: "https://university.taylors.edu.my",
    studyPortalUrl: "https://university.taylors.edu.my",
    internationalPageUrl: "https://university.taylors.edu.my/en/international-students.html",
    applicationPortalUrl: "https://university.taylors.edu.my",
    officialAddress: "Taylor's University Lakeside Campus, Subang Jaya, Selangor",
    applicationPeriods: ["Multiple intakes"],
    applicationFees: ["Refer to official portal"],
    applicationDocuments: localizedArray(["Passport", "Academic transcript"], ["护照", "成绩单"], ["Pasport", "Transkrip akademik"], ["護照", "成績單"]),
    chinaStudentRequirements: localizedArray(["Verify by programme."], ["按专业核对。"], ["Semak mengikut program."], ["按專業核對。"]),
    officialProfile: null,
    officialSources: [],
    officialVerifiedAt: "2026-05-23",
    officialSourceStatus: "official-verified",
    officialAuditSummary: "Official source verified.",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: "Living cost depends on accommodation.",
    tuitionMinCny: 42000,
    tuitionMaxCny: 108000,
    livingCostCny: 32000,
    minIelts: 5,
    acceptNoLanguage: true,
    facilities: localizedArray(["Lakeside campus"], ["湖畔校园"], ["Kampus tepi tasik"], ["湖畔校園"]),
    highlights: localizedArray(["Private university"], ["私立大学"], ["Universiti swasta"], ["私立大學"]),
    programCount: 1
  }
];

const programs = [
  program(1001, 1, "bachelor", "it", "Bachelor of Software Engineering", "软件工程学士", 42000, 5.5),
  program(1002, 1, "master", "business", "Master of Management", "管理学硕士", 52000, 6),
  program(2001, 2, "master", "it", "Master of Data Science", "数据科学硕士", 39000, 6),
  program(2002, 2, "bachelor", "engineering", "Bachelor of Engineering", "工程学士", 41000, 5.5),
  program(3001, 3, "master", "it", "Master of Applied Computing", "应用计算硕士", 56000, 6)
];

function program(id, universityId, level, category, nameEn, nameZh, annualTuitionCny, ielts) {
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
    faculty: localized("Faculty of Computing", "计算机学院", "Fakulti Pengkomputeran", "計算機學院"),
    duration: "1-3 years",
    durationMonths: 24,
    tuitionDisplay: `CNY ${annualTuitionCny}`,
    annualTuitionCny,
    tuitionCurrency: "CNY",
    tuitionInfo: {
      display: `CNY ${annualTuitionCny}`,
      currency: "CNY",
      officialAmountMYR: null,
      annualCny: annualTuitionCny,
      sourceUrl: "https://example.edu/fees",
      lastCheckedAt: "2026-05-23",
      auditStatus: "matched-official",
      note: ""
    },
    minGpa: 2.7,
    languageRequirement: { ielts, toefl: null, pte: null, muet: null },
    requirement: {
      gpa: 2.7,
      gaokaoRequired: false,
      huikaoRequired: false,
      note: localized("Relevant academic background.", "相关学术背景。", "Latar akademik berkaitan.", "相關學術背景。")
    },
    intake: ["February", "September"],
    applicationDocs: localizedArray(["Passport", "Transcript"], ["护照", "成绩单"], ["Pasport", "Transkrip"], ["護照", "成績單"]),
    curriculum: localizedArray(["Core courses", "Project"], ["核心课程", "项目"], ["Kursus teras", "Projek"], ["核心課程", "項目"]),
    careers: localizedArray(["Engineer", "Analyst"], ["工程师", "分析师"], ["Jurutera", "Penganalisis"], ["工程師", "分析師"]),
    specializations: localizedArray(["Software", "Data"], ["软件", "数据"], ["Perisian", "Data"], ["軟件", "數據"]),
    publicDisplayStatus: "ready",
    officialSourceStatus: "official-verified",
    officialVerifiedAt: "2026-05-23",
    officialSourceUrl: "https://example.edu/program",
    officialFeeSourceUrl: "https://example.edu/fees",
    officialEntryRequirementSourceUrl: "https://example.edu/entry",
    officialAccreditationSourceUrl: "https://example.edu/accreditation",
    officialIntakeNote: "",
    officialAccreditationNote: "",
    sourceUrls: [],
    description: localized("Official programme information.", "官方专业信息。", "Maklumat program rasmi.", "官方專業資訊。")
  };
}
