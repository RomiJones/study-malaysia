import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const root = resolve(new URL("..", import.meta.url).pathname);
const apiUrl = readArg("--api-url") || "http://127.0.0.1:3000/api/universities/universiti-sains-malaysia-usm";
const webUrl = readArg("--web-url") || "http://127.0.0.1:5173/universities/universiti-sains-malaysia-usm";
const reportPath = resolve(readArg("--report") || "tmp/reports/usm-commercial-release-gate.json");
const report = {
  schemaVersion: 1,
  gate: "usm-commercial-release",
  startedAt: new Date().toISOString(),
  apiUrl,
  webUrl,
  checks: []
};

await main();

async function main() {
  try {
    run("verify undergraduate database", "npm", ["--workspace", "@studymy/api", "run", "verify:usm:undergraduate:commercial"]);
    run("verify master candidate", "python3", [
      "scripts/verify-usm-master-commercial-candidate.py",
      "--manifest",
      "data/imports/usm/2026-06-14/master-commercial-candidate.json"
    ]);
    run("verify master database", "npm", ["--workspace", "@studymy/api", "run", "verify:usm:master:commercial"]);
    run("verify doctoral candidate", "python3", [
      "scripts/verify-usm-phd-candidate.py",
      "--manifest",
      "data/imports/usm/2026-06-14/phd-candidate.json"
    ]);
    run("verify doctoral delivery", "python3", [
      "scripts/audit_delivery.py",
      "data/imports/usm/2026-06-14/phd-delivery.json",
      "--summary-only"
    ]);
    run("verify doctoral database", "npm", ["--workspace", "@studymy/api", "run", "verify:usm:phd:commercial"]);
    run("audit tuition policy", "python3", [
      "scripts/audit-official-total-tuition.py",
      "data/imports/usm/2026-06-13/undergraduate-commercial-source.json",
      "data/imports/usm/2026-06-14/master-commercial-candidate.json",
      "data/imports/usm/2026-06-14/phd-candidate.json",
      apiUrl,
      "--summary-only"
    ]);
    run("full tests", "npm", ["test"]);
    run("production build", "npm", ["run", "build"]);
    run("four-locale audit", "npm", ["run", "verify:task040:i18n"]);
    await checkApi();
    await checkUi();
    report.status = "passed";
    report.decision = "commercial-release-ready";
  } catch (error) {
    report.status = "failed";
    report.decision = "blocked";
    report.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    report.finishedAt = new Date().toISOString();
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      status: report.status,
      decision: report.decision,
      reportPath,
      checks: report.checks
    }, null, 2));
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function run(name, command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  const status = result.status ?? 1;
  report.checks.push({ name, status: status === 0 ? "passed" : "failed" });
  if (status !== 0) throw new Error(`${name} failed.`);
}

async function checkApi() {
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`USM API returned HTTP ${response.status}.`);
  const data = await response.json();
  const programmes = data.programs || [];
  const levelCounts = Object.fromEntries(["bachelor", "master", "phd"].map((level) => [
    level,
    programmes.filter((row) => row.level === level).length
  ]));
  const expectedLevels = { bachelor: 63, master: 304, phd: 93 };
  const summary = data.officialProfile?.catalogStatusSummary?.all;
  const feeStatusCounts = Object.fromEntries([
    "matched-official",
    "calculated-from-official-rate",
    "not-published"
  ].map((status) => [
    status,
    programmes.filter((row) => row.officialFeeAuditStatus === status).length
  ]));
  const expectedFeeStatuses = {
    "matched-official": 194,
    "calculated-from-official-rate": 213,
    "not-published": 53
  };
  const forbiddenFee = programmes.filter((row) => {
    const display = String(row.tuitionDisplay || "");
    return /\d[\d,]*(?:\.\d+)?\s*[-–]\s*\d[\d,]*(?:\.\d+)?/.test(display)
      || /estimated|估算|估計/i.test(display)
      || /per[\s-]semester|per[\s-]year|每学期|每年|每學期/i.test(display);
  });
  const invalidCalculatedTotals = programmes.filter((row) =>
    row.officialFeeAuditStatus === "calculated-from-official-rate"
    && (
      !(Number(row.tuitionAmount) > 0)
      || !/(?:USD|MYR|RM|CNY)\s+\d[\d,]*(?:\.\d+)?\s+total tuition/i.test(String(row.tuitionDisplay || ""))
      || !/official minimum semesters/i.test(String(row.tuitionInfo?.note || ""))
    )
  );
  const nonReady = programmes.filter((row) => row.publicDisplayStatus !== "ready");
  if (
    data.programCount !== 460
    || programmes.length !== 460
    || JSON.stringify(levelCounts) !== JSON.stringify(expectedLevels)
    || summary?.total !== 463
    || summary?.ready !== 460
    || summary?.needsReview !== 0
    || summary?.notAvailableForInternational !== 3
    || JSON.stringify(feeStatusCounts) !== JSON.stringify(expectedFeeStatuses)
    || forbiddenFee.length
    || invalidCalculatedTotals.length
    || nonReady.length
  ) {
    throw new Error("USM public API commercial invariants failed.");
  }
  report.checks.push({
    name: "public API invariants",
    status: "passed",
    result: {
      canonical: 463,
      public: 460,
      levelCounts,
      feeStatusCounts,
      forbiddenFee: 0,
      invalidCalculatedTotals: 0,
      nonReady: 0
    }
  });
}

async function checkUi() {
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const localeSummary = {
    "zh-CN": {
      summary: "按专业查看官方学费",
      note: "按官方全日制费率与官方最短学制计算一个标准总学费"
    },
    "zh-TW": {
      summary: "按專業查看官方學費",
      note: "按官方全日制費率與官方最短學制計算一個標準總學費"
    },
    en: {
      summary: "Official tuition shown by programme",
      note: "calculated from the official full-time rate and official minimum duration"
    },
    ms: {
      summary: "Yuran rasmi dipaparkan mengikut program",
      note: "dikira daripada kadar sepenuh masa rasmi dan tempoh minimum rasmi"
    }
  };
  try {
    for (const [locale, expectedText] of Object.entries(localeSummary)) {
      const context = await browser.newContext();
      await context.addInitScript((value) => localStorage.setItem("studymy_locale", value), locale);
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(`${locale}: ${message.text()}`);
      });
      await page.goto(webUrl, { waitUntil: "networkidle" });
      await page.getByText(expectedText.summary, { exact: true }).waitFor({ timeout: 15_000 });
      const overview = await page.locator('[role="tabpanel"]:not([hidden])').innerText();
      assertNoFeeRange(overview, `${locale} overview`);
      if (!overview.includes(expectedText.note)) {
        throw new Error(`${locale} overview does not explain the calculated total tuition basis.`);
      }
      if (locale === "zh-CN") {
        await page.getByRole("tab", { name: "硕士专业", exact: true }).click();
        const master = await page.locator('[role="tabpanel"]:not([hidden])').innerText();
        assertNoFeeRange(master, "master list");
        if (!master.includes("按官方费率与学制计算")) throw new Error("Master list does not expose calculated total tuition status.");
        await page.getByRole("tab", { name: "博士专业", exact: true }).click();
        const phd = await page.locator('[role="tabpanel"]:not([hidden])').innerText();
        assertNoFeeRange(phd, "doctoral list");
        if (!phd.includes("USD 16,200") || !phd.includes("按官方费率与学制计算")) {
          throw new Error("Doctoral fee display is missing the DBA total or calculated tuition status.");
        }
        const fineArtsUrl = new URL(
          "/programs/usm-master-commercial-2026-usm-m-article-367-eee02810",
          webUrl
        ).toString();
        await page.goto(fineArtsUrl, { waitUntil: "networkidle" });
        const fineArts = await page.locator("body").innerText();
        if (
          !fineArts.includes("官方学费")
          || !fineArts.includes("USD 2,800")
          || !fineArts.includes("每学期 USD 1,400 × 官方最短 2 个学期")
          || !fineArts.includes("官方非全日制费率为每学期 USD 1,190")
        ) {
          throw new Error("Calculated tuition detail does not expose the localized formula and part-time rate.");
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(" | ")}`);
  report.checks.push({
    name: "four-locale browser tuition audit",
    status: "passed",
    result: { locales: Object.keys(localeSummary), consoleErrors: 0 }
  });
}

function assertNoFeeRange(text, label) {
  if (/(?:USD|MYR|RM)\s*\d[\d,]*(?:\.\d+)?\s*[-–]\s*\d[\d,]*(?:\.\d+)?/i.test(text)) {
    throw new Error(`${label} contains a tuition range.`);
  }
  if (/estimated total tuition|per[\s-]semester tuition/i.test(text)) {
    throw new Error(`${label} contains an estimated or rate-only tuition display.`);
  }
}
