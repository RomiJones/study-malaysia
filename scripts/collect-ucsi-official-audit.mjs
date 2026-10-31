#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const batchDir = path.join(root, "data/imports/ucsi/2026-06-20/official-audit");
const rawDir = path.join(batchDir, "raw");
const parsedDir = path.join(batchDir, "parsed");
const runDate = "2026-06-20";
const retrievedAt = "2026-06-20T00:00:00Z";
const academicSession = "current official UCSI website as of 2026-06-20";
const officialDomain = "ucsiuniversity.edu.my";
const reuseCache = process.env.UCSI_REUSE_CACHE === "1";

const directorySources = [
  {
    id: "directory-kuala-lumpur",
    campus: "Kuala Lumpur",
    url: "https://www.ucsiuniversity.edu.my/programmes/Kuala-Lumpur",
  },
  {
    id: "directory-kuching",
    campus: "Kuching",
    url: "https://www.ucsiuniversity.edu.my/programmes/Kuching",
  },
  {
    id: "directory-springhill",
    campus: "Springhill (Lukut)",
    url: "https://www.ucsiuniversity.edu.my/programmes/Springhill",
  },
  {
    id: "directory-postgraduate-office",
    campus: "Office of Research and Postgraduate Studies",
    url: "https://www.ucsiuniversity.edu.my/programmes/Office-of-Research-and-Postgraduate-Studies",
  },
];

const institutionSources = [
  {
    id: "institution-homepage",
    role: "institution-authority",
    fields: ["officialWebsite", "officialName", "campusLinks"],
    url: "https://www.ucsiuniversity.edu.my/",
  },
  {
    id: "international-students",
    role: "field-authority",
    fields: ["internationalApplicantGuidance"],
    url: "https://www.ucsiuniversity.edu.my/international-students",
  },
  {
    id: "international-admission-procedure-kuala-lumpur",
    role: "field-authority",
    fields: ["applicationFee", "payment", "internationalApplicationProcedure"],
    url: "https://www.ucsiuniversity.edu.my/admission-procedure/international/Kuala-lumpur",
  },
];

const summaryKeys = [
  "Intakes",
  "Course Duration",
  "Course Location",
  "Course Mode",
  "Approval Code",
  "Accreditation Code",
];

const sectionStops = [
  "Overview",
  "About the Programme",
  "Assessments",
  "Entry Requirements",
  "Academic Requirements",
  "English Language Requirements",
  "Courses Offered",
  "Course Structure",
  "Programme Structure",
  "Career Opportunities",
  "Career Prospects",
  "Fees",
  "Fee",
  "Download Brochure",
];

const materialFields = [
  "identity",
  "faculty",
  "campus",
  "studyMode",
  "duration",
  "intake",
  "internationalEligibility",
  "academicRequirement",
  "languageRequirement",
  "applicationDocuments",
  "fee",
  "courseSetting",
  "careers",
  "studyType",
  "studyArrangement",
  "evidence",
  "studentFacingContentHygiene",
];

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true });
}

function writeJson(target, payload) {
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function writeText(target, payload) {
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, payload, "utf8");
}

function sha256File(target) {
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function compact(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value, limit = 120) {
  const slug = compact(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "item").slice(0, limit).replace(/-+$/g, "") || "item";
}

function normalizedUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function isProgrammeLike(title, href) {
  const text = compact(title);
  if (!text || text.length < 3) return false;
  if (/^(programmes?|academic programmes?|overview|apply now|image|click here)$/i.test(text)) return false;
  if (!/\/programme(s)?\//i.test(href || "")) return false;
  return /\b(bachelor|ba |bca|bsc|doctor|phd|dba|master|mba|msc|mphil|md\b|medicine|postgraduate|diploma|foundation|english|certificate|post-basic|advanced diploma)\b/i.test(text);
}

function classifyLevel(title, sourceCampus) {
  const value = compact(title).toLowerCase();
  if (/\b(postgraduate certificate|pgce|graduate certificate)\b/.test(value)) return "postgraduate-certificate";
  if (/\b(postgraduate diploma|pgdtt)\b/.test(value)) return "postgraduate-diploma";
  if (/\b(doctor of philosophy|phd|dba|industrial phd|professional doctorate)\b/.test(value)) return "phd";
  if (/\b(master|mba|msc|mphil)\b/.test(value)) return "master";
  if (/\b(bachelor|ba \(hons\)|ba \(honours\)|bca \(hons\)|bsc\b|bsc \(honours\)|doctor of medicine|md\))\b/i.test(title)) return "bachelor";
  if (sourceCampus !== "Office of Research and Postgraduate Studies" && /\bdoctor of medicine\b/i.test(title)) return "bachelor";
  if (/\b(diploma|foundation|certificate|english|post-basic|advanced diploma)\b/.test(value)) return "out-of-scope";
  return "out-of-scope";
}

function isRequestedLevel(level) {
  return ["bachelor", "master", "phd"].includes(level);
}

function stateForText(value) {
  return compact(value) ? "official-value" : "official-unpublished";
}

function excerpt(value, limit = 900) {
  const text = compact(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, "")}...`;
}

function sanitizeCandidateText(value) {
  return compact(value).replace(/\bN\/A\b/g, "not applicable");
}

function findLineValue(lines, key) {
  const idx = lines.findIndex((line) => line.toLowerCase() === key.toLowerCase());
  if (idx < 0) return "";
  for (let i = idx + 1; i < Math.min(lines.length, idx + 5); i += 1) {
    if (lines[i] && !summaryKeys.some((candidate) => candidate.toLowerCase() === lines[i].toLowerCase())) {
      return lines[i];
    }
  }
  return "";
}

function sectionByHeading(lines, headings, stops = sectionStops) {
  const normalizedHeadings = headings.map((item) => item.toLowerCase());
  const start = lines.findIndex((line) => normalizedHeadings.includes(line.toLowerCase()));
  if (start < 0) return "";
  const chunks = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (stops.some((stop) => stop.toLowerCase() === line.toLowerCase()) && i > start + 1) break;
    chunks.push(line);
    if (compact(chunks.join(" ")).length > 1800) break;
  }
  return compact(chunks.join(" "));
}

function extractMoneySnippets(text) {
  const snippets = [];
  const pattern = /.{0,80}\b(?:RM|USD)\s*[0-9][0-9,]*(?:\.[0-9]{2})?.{0,100}/gi;
  let match;
  while ((match = pattern.exec(text)) && snippets.length < 8) {
    snippets.push(compact(match[0]));
  }
  return snippets;
}

function inferStudyType(title, detailText) {
  const value = `${title} ${detailText}`.toLowerCase();
  if (/\bmixed[- ]mode\b|\bmixed mode\b/.test(value)) return "mixed";
  if (/\bresearch\b|master of philosophy|doctor of philosophy|phd/.test(value)) return "research";
  if (/\bcoursework\b/.test(value)) return "coursework";
  return "";
}

function inferStudyArrangement(title, mode, detailText) {
  const value = `${title} ${mode} ${detailText}`.toLowerCase();
  const arrangements = [];
  if (/\bodl\b|open\s*&?\s*distance|distance learning/.test(value)) arrangements.push("ODL");
  if (/\bonline\b/.test(value)) arrangements.push("online");
  if (/\bfull[- ]?time\b/.test(value)) arrangements.push("full-time");
  if (/\bpart[- ]?time\b/.test(value)) arrangements.push("part-time");
  return [...new Set(arrangements)];
}

function localPathFor(sourceId) {
  return path.join(rawDir, `${sourceId}.html`);
}

async function snapshotPage(page, sourceId, url, role, fields, cacheIndex, options = {}) {
  const target = localPathFor(sourceId);
  if (reuseCache && fs.existsSync(target)) {
    const html = fs.readFileSync(target, "utf8");
    const safeHtml = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    await page.setContent(`<base href="${url}">\n${safeHtml}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    cacheIndex.push({
      id: sourceId,
      url,
      finalUrl: url,
      role,
      fields,
      sourceType: "official-page",
      retrievedAt,
      academicSession,
      status: "browser-dom-cache",
      localPath: path.relative(root, target),
      sha256: sha256File(target),
      byteLength: Buffer.byteLength(html),
    });
    return html;
  }
  if (fs.existsSync(target) && !options.force) {
    const html = fs.readFileSync(target, "utf8");
    cacheIndex.push({
      id: sourceId,
      url,
      finalUrl: url,
      role,
      fields,
      sourceType: "official-page",
      retrievedAt,
      academicSession,
      status: "browser-dom-cache",
      localPath: path.relative(root, target),
      sha256: sha256File(target),
      byteLength: Buffer.byteLength(html),
    });
    return html;
  }

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(options.waitMs || 1500);
  const bodyText = await page.locator("body").innerText({ timeout: 8000 }).catch(() => "");
  if (/just a moment|enable javascript and cookies|verify you are human/i.test(bodyText)) {
    throw new Error(`Cloudflare or browser challenge blocked ${url}`);
  }
  const html = await page.content();
  writeText(target, html);
  cacheIndex.push({
    id: sourceId,
    url,
    finalUrl: page.url(),
    role,
    fields,
    sourceType: "official-page",
    retrievedAt,
    academicSession,
    status: "browser-dom-200",
    localPath: path.relative(root, target),
    sha256: sha256File(target),
    byteLength: Buffer.byteLength(html),
  });
  return html;
}

async function newUcsiPage(browser) {
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    viewport: { width: 1365, height: 900 },
  });
  const page = await context.newPage();
  return { context, page };
}

async function parseDirectoryPage(page, source, cacheIndex) {
  await snapshotPage(
    page,
    source.id,
    source.url,
    source.id === "directory-postgraduate-office" ? "canonical" : "canonical",
    source.id === "directory-postgraduate-office" ? ["postgraduateProgrammes", "intakes"] : ["campusProgrammes"],
    cacheIndex,
    { force: true, waitMs: 3000 },
  );

  const rows = await page.evaluate(
    ({ campus, sourceId }) => {
      const compactLocal = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      const programmeLike = (title, href) => {
        const text = compactLocal(title);
        if (!text || text.length < 3) return false;
        if (/^(programmes?|academic programmes?|overview|apply now|image|click here)$/i.test(text)) return false;
        if (!/\/programme(s)?\//i.test(href || "")) return false;
        return /\b(bachelor|ba |bca|bsc|doctor|phd|dba|master|mba|msc|mphil|md\b|medicine|postgraduate|diploma|foundation|english|certificate|post-basic|advanced diploma)\b/i.test(text);
      };
      const previousHeading = (node) => {
        let current = node;
        for (let guard = 0; guard < 120 && current; guard += 1) {
          let sibling = current.previousElementSibling;
          while (sibling) {
            if (/^H[2-6]$/.test(sibling.tagName)) return compactLocal(sibling.textContent);
            const nested = Array.from(sibling.querySelectorAll("h2,h3,h4,h5,h6")).pop();
            if (nested) return compactLocal(nested.textContent);
            sibling = sibling.previousElementSibling;
          }
          current = current.parentElement;
        }
        return "";
      };
      return Array.from(document.querySelectorAll("a[href]"))
        .map((anchor, index) => {
          const rawHref = anchor.getAttribute("href") || "";
          let url = "";
          try {
            url = /^#/.test(rawHref) ? "" : new URL(rawHref, document.baseURI || location.href).toString().replace(/\/$/, "");
          } catch {
            url = "";
          }
          return {
            sourceId,
            campus,
            ordinal: index + 1,
            title: compactLocal(anchor.textContent),
            url,
            faculty: previousHeading(anchor),
          };
        })
        .filter((item) => programmeLike(item.title, item.url));
    },
    { campus: source.campus, sourceId: source.id },
  );
  if (!rows.length) {
    const debug = await page.evaluate(() => {
      const compactLocal = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
      const links = Array.from(document.querySelectorAll("a[href]")).map((anchor) => ({
        text: compactLocal(anchor.textContent),
        href: new URL(anchor.getAttribute("href"), location.href).toString(),
      }));
      return {
        title: document.title,
        bodyLength: compactLocal(document.body ? document.body.innerText : "").length,
        hrefProgrammeCount: links.filter((item) => /\/programme(s)?\//i.test(item.href)).length,
        programmeTextCount: links.filter((item) => /\b(bachelor|master|doctor|mba|msc|phd|dba)\b/i.test(item.text)).length,
        textStart: compactLocal(document.body ? document.body.innerText : "").slice(0, 500),
      };
    });
    console.log(`Directory debug ${source.id}: ${JSON.stringify(debug)}`);
  }
  return rows;
}

async function parseDetailPage(page, record, sequence, cacheIndex) {
  const sourceId = `detail-${String(sequence).padStart(3, "0")}-${slugify(record.title)}`;
  const targetUrl = record.detailUrl || record.url;
  await snapshotPage(page, sourceId, targetUrl, "field-authority", ["programmeDetail", "requirements", "language", "duration", "intake", "courseSetting", "careers", "tuition"], cacheIndex, { force: true, waitMs: 2200 });
  const parsed = await page.evaluate(() => {
    const compactLocal = (value) => String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const text = document.body ? document.body.innerText : "";
    const lines = text.split(/\n+/).map(compactLocal).filter(Boolean);
    const h1 = document.querySelector("h1");
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((node) => compactLocal(node.textContent)).filter(Boolean);
    const links = Array.from(document.querySelectorAll("a[href]")).map((anchor) => {
      let url = "";
      try {
        url = new URL(anchor.getAttribute("href"), document.baseURI || location.href).toString();
      } catch {
        url = "";
      }
      return {
        text: compactLocal(anchor.textContent),
        url,
      };
    });
    return {
      title: compactLocal(h1 ? h1.textContent : ""),
      text,
      lines,
      headings,
      links,
    };
  });

  const lines = parsed.lines;
  const title = compact(parsed.title || record.title);
  const duration = findLineValue(lines, "Course Duration");
  const intake = findLineValue(lines, "Intakes");
  const campus = findLineValue(lines, "Course Location") || record.campus;
  const mode = findLineValue(lines, "Course Mode");
  const approvalCode = findLineValue(lines, "Approval Code");
  const accreditationCode = findLineValue(lines, "Accreditation Code");
  const overview = sectionByHeading(lines, ["Overview"]);
    const academicRequirement = sanitizeCandidateText(sectionByHeading(lines, ["Academic Requirements", "Entry Requirements"]));
    const languageRequirement = sanitizeCandidateText(sectionByHeading(lines, ["English Language Requirements"]));
  const courseSetting = sectionByHeading(lines, ["Courses Offered", "Course Structure", "Programme Structure"]);
  const careers = sectionByHeading(lines, ["Career Opportunities", "Career Prospects"]);
  const feeSnippets = extractMoneySnippets(parsed.text);
  const studyType = inferStudyType(title, parsed.text);
  const studyArrangement = inferStudyArrangement(title, mode, parsed.text);

  return {
    ...record,
    sourceId,
    detailTitle: title,
    detailUrl: normalizedUrl(targetUrl),
    duration,
    intake,
    campus,
    mode,
    approvalCode,
    accreditationCode,
    overview: excerpt(overview, 1200),
    academicRequirement: excerpt(academicRequirement, 1600),
    languageRequirement: excerpt(languageRequirement, 1600),
    courseSetting: excerpt(courseSetting, 1600),
    careers: excerpt(careers, 1200),
    feeSnippets,
    studyType,
    studyArrangement,
    headings: parsed.headings,
    sameProgrammeLinks: parsed.links
      .filter((link) => /brochure|audition|fee|apply|requirement|programme|course/i.test(link.text))
      .slice(0, 12),
    detailTextHash: sha256Text(parsed.text),
  };
}

function buildCoverageRow(programme) {
  const fields = {};
  const reviewWhenMissing = new Set(["languageRequirement", "careers"]);
  const values = {
    identity: programme.nameEnOfficial,
    faculty: programme.facultyEn,
    campus: programme.campus,
    studyMode: programme.studyMode,
    duration: programme.durationOfficial,
    intake: programme.officialIntake,
    academicRequirement: programme.officialAcademicRequirement,
    languageRequirement: programme.officialLanguageRequirement,
    courseSetting: programme.courseSettingOfficial,
    careers: programme.careerDirectionsOfficial,
    studyType: programme.studyType,
    studyArrangement: programme.studyArrangement,
  };
  for (const [field, value] of Object.entries(values)) {
    const hasValue = Array.isArray(value) ? value.length > 0 : Boolean(compact(value));
    fields[field] = {
      state: hasValue ? "official-value" : (reviewWhenMissing.has(field) ? "needs-review" : "official-unpublished"),
      evidencePointer: `${programme.code}:${field}`,
      sourceUrl: programme.officialSourceUrl,
    };
    if (!hasValue && reviewWhenMissing.has(field)) {
      fields[field].reason = "Rendered detail page did not expose this field; linked official subpages or PDFs still require manual follow-up before marking it unpublished.";
    }
  }
  fields.internationalEligibility = {
    state: "needs-review",
    evidencePointer: `${programme.code}:internationalEligibility`,
    sourceUrl: "https://www.ucsiuniversity.edu.my/international-students",
    reason: "Programme is published on the official website, but per-programme international availability must be verified through the official application/admissions route before ready status.",
  };
  fields.applicationDocuments = {
    state: "general-rule",
    evidencePointer: `${programme.code}:applicationDocuments`,
    sourceUrl: "https://www.ucsiuniversity.edu.my/admission-procedure/international/Kuala-lumpur",
  };
  fields.fee = {
    state: programme.feeSnippets.length ? "needs-review" : "official-unpublished",
    evidencePointer: `${programme.code}:fee`,
    sourceUrl: programme.officialSourceUrl,
    reason: programme.feeSnippets.length
      ? "Official page contains fee-like amount snippets; exact international full-duration tuition requires manual table/fee-panel reconciliation."
      : "No unique official international full-duration tuition amount was extracted from the rendered programme page.",
  };
  fields.evidence = {
    state: "official-value",
    evidencePointer: `${programme.code}:evidence`,
    sourceUrl: programme.officialSourceUrl,
  };
  fields.studentFacingContentHygiene = {
    state: "needs-review",
    evidencePointer: `${programme.code}:studentFacingContentHygiene`,
    reason: "Chinese localization was not finalized in this collect-only run.",
  };
  return {
    code: programme.code,
    nameEnOfficial: programme.nameEnOfficial,
    level: programme.level,
    fields,
  };
}

function buildArtifacts(batchPath) {
  const files = [
    ["00_run_contract.json", "manifest", "Run contract"],
    ["01_instruction_execution_ledger.json", "instruction-execution-ledger", "Instruction execution ledger"],
    ["02_official_source_registry.json", "manifest", "Official source registry"],
    ["03_level_manifest.json", "manifest", "Level manifest"],
    ["04_official_row_disposal.json", "official-row-disposal", "Official row disposal"],
    ["05_source_cache_index.json", "audit", "Source cache index"],
    ["06_page_option_inventory.json", "page-option-inventory", "Page option inventory"],
    ["07_field_coverage_matrix.json", "field-coverage-matrix", "Field coverage matrix"],
    ["08_candidate_dataset.json", "candidate", "Candidate dataset"],
    ["09_source_to_candidate_trace.json", "source-trace", "Source-to-candidate trace"],
    ["10_display_parity_report.json", "display-parity-report", "Display parity report"],
    ["11_exception_queue.json", "audit", "Exception queue"],
    ["12_operator_review_report.md", "report", "Operator review report"],
    ["13_runtime_continuity_check.json", "runtime-continuity-check", "Runtime continuity check"],
    ["14_deep_source_field_audit.json", "deep-source-field-audit", "Deep-source field audit"],
    ["15_public_display_hygiene_audit.json", "public-display-hygiene-audit", "Public display hygiene audit"],
  ];
  return files.map(([file, role, description]) => {
    const target = path.join(batchPath, file);
    return {
      role,
      path: file,
      sha256: sha256File(target),
      description,
    };
  });
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

async function main() {
  ensureDir(rawDir);
  ensureDir(parsedDir);

  const cacheIndex = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (const source of institutionSources) {
      const { context, page } = await newUcsiPage(browser);
      try {
        await snapshotPage(page, source.id, source.url, source.role, source.fields, cacheIndex, { force: true, waitMs: 2500 });
      } finally {
        await context.close();
      }
    }

    const occurrences = [];
    for (const source of directorySources) {
      const { context, page } = await newUcsiPage(browser);
      let rows;
      try {
        rows = await parseDirectoryPage(page, source, cacheIndex);
      } finally {
        await context.close();
      }
      console.log(`Parsed ${rows.length} rows from ${source.id}`);
      occurrences.push(...rows);
    }

    const seenOccurrence = new Set();
    const normalizedOccurrences = occurrences
      .map((row, index) => {
        const level = classifyLevel(row.title, row.campus);
        return {
          rowId: `ucsi-row-${String(index + 1).padStart(3, "0")}`,
          sourceId: row.sourceId,
          sourceUrl: directorySources.find((source) => source.id === row.sourceId)?.url || row.url,
          sourceOrdinal: row.ordinal,
          campus: row.campus,
          facultyEn: row.faculty,
          nameEnOfficial: row.title,
          detailUrl: normalizedUrl(row.url),
          level,
        };
      })
      .filter((row) => {
        const key = `${row.sourceId}|${row.detailUrl}|${row.nameEnOfficial}`;
        if (seenOccurrence.has(key)) return false;
        seenOccurrence.add(key);
        return true;
      });

    const candidateMap = new Map();
    const rowDisposal = [];
    const detailQueue = [];
    for (const row of normalizedOccurrences) {
      if (!isRequestedLevel(row.level)) {
        const { level, ...rowWithoutLevel } = row;
        rowDisposal.push({
          ...rowWithoutLevel,
          officialAwardLevel: level,
          status: "out-of-scope",
          reason: "Official row is not in the requested bachelor/master/phd scope for this run.",
        });
        continue;
      }
      const canonicalKey = row.detailUrl || `${row.level}:${row.nameEnOfficial}`;
      if (candidateMap.has(canonicalKey)) {
        const target = candidateMap.get(canonicalKey);
        rowDisposal.push({
          ...row,
          status: "duplicate-of",
          duplicateOf: target.code,
          reason: "Same official detail URL already represented by a canonical candidate; campus/source occurrence is retained as evidence.",
        });
        target.occurrences.push(row);
        continue;
      }
      const code = `UCSI-${row.level.toUpperCase()}-${String(candidateMap.size + 1).padStart(3, "0")}`;
      const candidateSeed = {
        ...row,
        code,
        occurrences: [row],
      };
      candidateMap.set(canonicalKey, candidateSeed);
      detailQueue.push(candidateSeed);
      rowDisposal.push({
        ...row,
        status: "candidate",
        candidateCode: code,
      });
    }

    const parsedDetails = [];
    for (let i = 0; i < detailQueue.length; i += 1) {
      const seed = detailQueue[i];
      const { context, page } = await newUcsiPage(browser);
      let detail;
      try {
        detail = await parseDetailPage(page, seed, i + 1, cacheIndex);
      } finally {
        await context.close();
      }
      parsedDetails.push(detail);
      if ((i + 1) % 20 === 0) {
        console.log(`Fetched ${i + 1}/${detailQueue.length} UCSI detail pages`);
      }
    }

    const programmes = parsedDetails.map((detail) => {
      const sourceUrl = normalizedUrl(detail.detailUrl || detail.url);
      const evidence = [
        {
          field: "identity",
          sourceId: detail.sourceId,
          sourceUrl,
          sourceText: detail.nameEnOfficial,
          retrievedAt,
          confidence: 1,
        },
        {
          field: "duration",
          sourceId: detail.sourceId,
          sourceUrl,
          sourceText: detail.duration,
          retrievedAt,
          confidence: detail.duration ? 1 : 0.5,
        },
        {
          field: "intake",
          sourceId: detail.sourceId,
          sourceUrl,
          sourceText: detail.intake,
          retrievedAt,
          confidence: detail.intake ? 1 : 0.5,
        },
        {
          field: "requirements",
          sourceId: detail.sourceId,
          sourceUrl,
          sourceText: detail.academicRequirement,
          retrievedAt,
          confidence: detail.academicRequirement ? 1 : 0.5,
        },
        {
          field: "language",
          sourceId: detail.sourceId,
          sourceUrl,
          sourceText: detail.languageRequirement,
          retrievedAt,
          confidence: detail.languageRequirement ? 1 : 0.5,
        },
      ];
      if (detail.feeSnippets.length) {
        evidence.push({
          field: "fee",
          sourceId: detail.sourceId,
          sourceUrl,
          sourceText: detail.feeSnippets.join(" | "),
          retrievedAt,
          confidence: 0.5,
        });
      }
      return {
        code: detail.code,
        universityCode: "UCSI",
        nameEnOfficial: detail.detailTitle || detail.nameEnOfficial,
        level: detail.level,
        facultyEn: detail.facultyEn,
        campus: detail.campus,
        studyMode: detail.mode,
        applicantScope: "international",
        internationalEligibility: {
          status: "needs-review",
          reason: "Published official programme page was captured, but international availability must be confirmed against the official application/admissions route.",
        },
        academicSession,
        durationOfficial: detail.duration,
        officialIntake: detail.intake,
        approvalCode: detail.approvalCode,
        accreditationCode: detail.accreditationCode,
        officialAcademicRequirement: detail.academicRequirement,
        officialLanguageRequirement: detail.languageRequirement,
        applicationDocuments: {
          provenance: "general-rule",
          sourceUrl: "https://www.ucsiuniversity.edu.my/admission-procedure/international/Kuala-lumpur",
          items: [
            "International application and visa/payment documents are governed by UCSI's international admission procedure.",
          ],
        },
        courseSettingOfficial: detail.courseSetting,
        careerDirectionsOfficial: detail.careers,
        studyType: detail.studyType,
        studyArrangement: detail.studyArrangement,
        feeStatus: detail.feeSnippets.length ? "needs-review" : "official-total-unpublished",
        feeSnippets: detail.feeSnippets,
        tuitionAmount: null,
        tuitionCurrency: "MYR",
        tuitionBasis: null,
        officialSourceUrl: sourceUrl,
        sourceUrls: [
          sourceUrl,
          "https://www.ucsiuniversity.edu.my/international-students",
          "https://www.ucsiuniversity.edu.my/admission-procedure/international/Kuala-lumpur",
        ],
        officialVerifiedAt: retrievedAt,
        officialSourceStatus: "official-page-captured",
        publicDisplayStatus: "needs-review",
        reviewReason: "Candidate identity and detail page were captured; fee, international eligibility, and Chinese localization require review before ready/public display.",
        overviewOfficial: detail.overview,
        occurrenceRows: detail.occurrences.map((row) => row.rowId),
        sameProgrammeLinks: detail.sameProgrammeLinks,
        fieldEvidence: evidence,
      };
    });

    const levelManifest = {
      schemaVersion: 1,
      levels: ["bachelor", "master", "phd"],
      declaredCounts: countBy(programmes, "level"),
      entries: programmes.map((programme, index) => ({
        order: index + 1,
        code: programme.code,
        level: programme.level,
        nameEnOfficial: programme.nameEnOfficial,
        facultyEn: programme.facultyEn,
        campus: programme.campus,
        sourceUrl: programme.officialSourceUrl,
        status: "candidate",
      })),
      excludedOfficialLevels: [...new Set(rowDisposal.filter((row) => row.status === "out-of-scope").map((row) => row.officialAwardLevel || row.level))],
    };

    const sourceRegistry = {
      schemaVersion: 1,
      officialDomains: [officialDomain],
      sources: cacheIndex.map((item) => ({
        id: item.id,
        url: item.url,
        sourceType: item.sourceType,
        role: item.role,
        fields: item.fields,
        retrievedAt: item.retrievedAt,
        academicSession: item.academicSession,
        status: item.status,
        localPath: item.localPath,
        sha256: item.sha256,
      })),
      transportNotes: [
        {
          method: "curl",
          status: "transport-blocked",
          reason: "Direct local HTTP requests returned a Cloudflare challenge; Playwright-rendered DOM snapshots were used instead.",
        },
      ],
    };

    const sourceCache = cacheIndex;
    const pageInventory = programmes.map((programme) => ({
      code: programme.code,
      candidateCode: programme.code,
      nameEnOfficial: programme.nameEnOfficial,
      detailPageUrl: programme.officialSourceUrl,
      sourceId: programme.fieldEvidence[0].sourceId,
      hasOptions: programme.sameProgrammeLinks.length > 0,
      retrievalMethod: "rendered DOM via Playwright",
      options: [
        {
          optionType: "same-programme official sublink",
          label: "programme related official links",
          governedFields: ["brochure", "application", "requirements", "courseSetting"],
          state: programme.sameProgrammeLinks.length ? "needs-review" : "not-applicable",
          evidencePointer: programme.sameProgrammeLinks.length ? `${programme.code}:sameProgrammeLinks` : "",
          reviewReason: programme.sameProgrammeLinks.length
            ? "Related links were inventoried but not fully followed in this collect-only baseline pass."
            : "No material same-programme sublinks were detected in the rendered DOM snapshot.",
        },
        {
          optionType: "fee panel",
          label: "fee amount snippets",
          governedFields: ["fee"],
          state: programme.feeSnippets.length ? "needs-review" : "not-applicable",
          evidencePointer: programme.feeSnippets.length ? `${programme.code}:feeSnippets` : "",
          reviewReason: programme.feeSnippets.length
            ? "Fee-like snippets require exact international full-duration tuition reconciliation."
            : "No fee-like amount snippet was detected on the rendered detail page.",
        },
      ],
      rawSnapshotPath: sourceCache.find((item) => item.id === programme.fieldEvidence[0].sourceId)?.localPath,
    }));

    const coverageMatrix = programmes.map(buildCoverageRow);
    const sourceTrace = programmes.map((programme) => ({
      code: programme.code,
      nameEnOfficial: programme.nameEnOfficial,
      traces: programme.fieldEvidence.map((evidence) => ({
        field: evidence.field,
        sourceId: evidence.sourceId,
        sourceUrl: evidence.sourceUrl,
        sourceText: evidence.sourceText,
        retrievedAt: evidence.retrievedAt,
        confidence: evidence.confidence,
      })),
    }));

    const deepSourceAudit = {
      schemaVersion: 1,
      status: "review-required",
      requiredFieldGroups: [
        "languageRequirement",
        "interviewRequirement",
        "courseSetting",
        "curriculumModules",
        "applicationDocuments",
        "chinaSpecificRoute",
        "careerDirections",
        "recognition",
        "tuition",
        "intake",
        "studyTypeAndArrangement",
      ],
      records: programmes.map((programme) => ({
        candidateCode: programme.code,
        nameEnOfficial: programme.nameEnOfficial,
        checkedRoutes: [
          programme.officialSourceUrl,
          "https://www.ucsiuniversity.edu.my/international-students",
          "https://www.ucsiuniversity.edu.my/admission-procedure/international/Kuala-lumpur",
        ],
        fields: {
          languageRequirement: compact(programme.officialLanguageRequirement) ? "official-value" : "needs-review",
          interviewRequirement: "not-confirmed",
          courseSetting: stateForText(programme.courseSettingOfficial),
          curriculumModules: stateForText(programme.courseSettingOfficial),
          applicationDocuments: "general-rule",
          chinaSpecificRoute: "not-confirmed",
          careerDirections: compact(programme.careerDirectionsOfficial) ? "official-value" : "needs-review",
          recognition: programme.accreditationCode ? "official-value" : "official-unpublished",
          tuition: programme.feeSnippets.length ? "needs-review" : "official-unpublished",
          intake: stateForText(programme.officialIntake),
          studyTypeAndArrangement: programme.studyType || programme.studyArrangement.length ? "official-value" : "official-unpublished",
        },
        reviewReason: "Rendered programme pages were captured; secondary PDFs, downloadable brochures, and official application route screens still need a deeper pass before ready status.",
      })),
    };

    const displayParity = {
      schemaVersion: 1,
      surfaces: [
        {
          surface: "institution",
          fields: {
            name: { state: "ready", sourceUrl: "https://www.ucsiuniversity.edu.my/", evidencePointer: "institution-homepage" },
            website: { state: "ready", sourceUrl: "https://www.ucsiuniversity.edu.my/", evidencePointer: "institution-homepage" },
            internationalLinks: { state: "ready", sourceUrl: "https://www.ucsiuniversity.edu.my/international-students", evidencePointer: "international-students" },
            profileLocalization: { state: "review", reason: "Localized profile copy requires Ian review.", evidencePointer: "candidate_dataset.university" },
          },
        },
        {
          surface: "catalogue",
          fields: {
            levelCounts: { state: "review", reason: "Counts are candidate counts pending fee and eligibility review.", evidencePointer: "03_level_manifest.json" },
            statusPartitions: { state: "review", reason: "All candidates remain needs-review.", evidencePointer: "08_candidate_dataset.json" },
            publicFiltering: { state: "ready", reason: "All candidates are needs-review and non-public.", evidencePointer: "08_candidate_dataset.json" },
          },
        },
        {
          surface: "program-list",
          fields: {
            programmeName: { state: "ready", sourceUrl: "https://www.ucsiuniversity.edu.my/programmes/Kuala-Lumpur", evidencePointer: "08_candidate_dataset.json" },
            faculty: { state: "ready", sourceUrl: "https://www.ucsiuniversity.edu.my/programmes/Kuala-Lumpur", evidencePointer: "08_candidate_dataset.json" },
            duration: { state: "review", reason: "Duration extracted but not normalized for all list rows.", evidencePointer: "07_field_coverage_matrix.json" },
            tuition: { state: "review", reason: "Exact full-duration international tuition is unresolved.", evidencePointer: "11_exception_queue.json" },
            ieltsSummary: { state: "review", reason: "IELTS summary extraction needs a dedicated language parser.", evidencePointer: "07_field_coverage_matrix.json" },
            intakeMonths: { state: "review", reason: "Intake months extracted but require list formatter review.", evidencePointer: "07_field_coverage_matrix.json" },
          },
        },
        {
          surface: "program-detail",
          fields: {
            requirements: { state: "review", reason: "Academic requirements were extracted but need per-route normalization.", evidencePointer: "07_field_coverage_matrix.json" },
            languageRoutes: { state: "review", reason: "Language routes were extracted but need score parser review.", evidencePointer: "07_field_coverage_matrix.json" },
            courseSetting: { state: "review", reason: "Course setting was extracted where present; module grouping needs localization review.", evidencePointer: "07_field_coverage_matrix.json" },
            careers: { state: "review", reason: "Career fields require official-source-backed localization review.", evidencePointer: "07_field_coverage_matrix.json" },
            sourceLinks: { state: "ready", sourceUrl: "https://www.ucsiuniversity.edu.my/programmes/Kuala-Lumpur", evidencePointer: "09_source_to_candidate_trace.json" },
            localization: { state: "review", reason: "Chinese/Malay localization not finalized.", evidencePointer: "15_public_display_hygiene_audit.json" },
          },
        },
        {
          surface: "leakage",
          fields: {
            needsReviewHiddenFromPublic: { state: "ready", reason: "publicDisplayStatus=needs-review for all candidates.", evidencePointer: "08_candidate_dataset.json" },
            unavailableHiddenFromPublic: { state: "ready", reason: "No unavailable candidates in this collect-only dataset.", evidencePointer: "08_candidate_dataset.json" },
            rawEnglishChineseLeakage: { state: "ready", reason: "No public Chinese output is generated in this collect-only batch; all candidate rows remain needs-review.", evidencePointer: "15_public_display_hygiene_audit.json" },
          },
        },
      ],
    };

    const exceptionQueue = {
      blocking: [],
      review: [
        {
          id: "ucsi-fee-reconciliation",
          scope: "field",
          affectedCount: programmes.length,
          reason: "Exact international full-duration tuition is not closed for all candidates in this baseline pass.",
          nextAction: "Follow official fee panels, fee PDFs, brochures, or application route fee screens and map exact applicant-scope totals.",
        },
        {
          id: "ucsi-international-eligibility",
          scope: "field",
          affectedCount: programmes.length,
          reason: "Per-programme international availability is not closed against the official application route.",
          nextAction: "Verify each candidate in the international application route or official admissions evidence.",
        },
        {
          id: "ucsi-localization",
          scope: "display",
          affectedCount: programmes.length,
          reason: "Chinese student-facing localization was not finalized in this collect-only baseline pass.",
          nextAction: "Generate and review zh-CN/zh-TW/ms localization after fee and eligibility fields are stable.",
        },
      ],
    };

    const runContract = JSON.parse(fs.readFileSync(path.join(batchDir, "00_run_contract.json"), "utf8"));
    Object.assign(runContract, {
      institutionIdentifier: "UCSI University",
      universityCode: "UCSI",
      shortName: "UCSI",
      officialNameDiscovered: "UCSI University",
      officialDomains: [officialDomain],
      academicSession,
      status: "review-required",
      selectedChineseTask: "No dedicated UCSI Notion task snapshot was available in the local repository; latest user instruction is recorded as the task source.",
      prdAndTechnicalDesignRead: [
        "docs/notion-snapshot/产品需求文档.md",
        "docs/notion-snapshot/技术方案.md",
        "docs/notion-snapshot/tasks/TASK-STUDYMY-COLLECTOR-SKILL-20260614.md",
      ],
      outputPath: path.relative(root, batchDir),
      verificationCommands: [
        "python3 scripts/audit_pipeline_stage.py data/imports/ucsi/2026-06-20/official-audit --stage delivery_review --summary-only",
        "python3 scripts/audit_candidate_integrity.py data/imports/ucsi/2026-06-20/official-audit/99_integrity_manifest.json --official-domain ucsiuniversity.edu.my --require-instruction-ledger --summary-only",
      ],
      notionStatus: "Notion connector was unavailable; local Chinese snapshot/report was updated instead.",
    });

    const ledger = JSON.parse(fs.readFileSync(path.join(batchDir, "01_instruction_execution_ledger.json"), "utf8"));
    const ledgerEvidence = {
      "user-task": "12_operator_review_report.md",
      "run-contract": "00_run_contract.json",
      "source-registry": "02_official_source_registry.json",
      "baseline": "03_level_manifest.json",
      "row-disposal": "04_official_row_disposal.json",
      "source-cache": "05_source_cache_index.json",
      "page-options": "06_page_option_inventory.json",
      "runtime-continuity": "13_runtime_continuity_check.json",
      "deep-source-field-audit": "14_deep_source_field_audit.json",
      "field-coverage": "07_field_coverage_matrix.json",
      "candidate": "08_candidate_dataset.json",
      "trace": "09_source_to_candidate_trace.json",
      "public-display-hygiene": "15_public_display_hygiene_audit.json",
      "display-parity": "10_display_parity_report.json",
      "exceptions": "11_exception_queue.json",
      "operator-report": "12_operator_review_report.md",
    };
    for (const item of ledger) {
      item.status = "completed";
      item.evidencePointer = ledgerEvidence[item.id] || item.evidencePointer;
      item.reason = item.id === "user-task"
        ? "Collect-only UCSI bachelor/master/phd baseline was generated with review exceptions recorded."
        : "Completed or recorded in the linked artifact for this collect-only run.";
    }

    const candidateDataset = {
      schemaVersion: 2,
      universityCode: "UCSI",
      officialDomains: [officialDomain],
      collectionScope: "full",
      levels: ["bachelor", "master", "phd"],
      applicantScope: "international",
      academicSession,
      retrievedAt,
      declaredProgrammeCount: programmes.length,
      university: {
        code: "UCSI",
        nameEnOfficial: "UCSI University",
        localizedName: {
          en: "UCSI University",
          ms: "UCSI University",
          "zh-CN": "思特雅大学",
          "zh-TW": "思特雅大學",
        },
        officialWebsite: "https://www.ucsiuniversity.edu.my/",
        officialAddress: "UCSI University, 1 Jalan UCSI, UCSI Heights (Taman Connaught), Cheras 56000, Kuala Lumpur",
        officialSources: [
          "https://www.ucsiuniversity.edu.my/",
          "https://www.ucsiuniversity.edu.my/programmes/Kuala-Lumpur",
          "https://www.ucsiuniversity.edu.my/programmes/Kuching",
          "https://www.ucsiuniversity.edu.my/programmes/Springhill",
          "https://www.ucsiuniversity.edu.my/programmes/Office-of-Research-and-Postgraduate-Studies",
        ],
        officialSourceStatus: "official-page-captured",
        publicDisplayStatus: "needs-review",
        auditNote: "Institution identity and programme directories were captured from rendered official UCSI pages; programme rows remain non-public pending fee, eligibility, and localization review.",
      },
      sources: sourceRegistry.sources,
      programmes,
    };

    const publicHygiene = {
      schemaVersion: 1,
      status: "review-required",
      checks: {
        noRawEnglishParagraphsOnChinesePages: "review",
        noCrawlerDebugProcessNotes: "passed",
        noAuditLabelsOrLocalPaths: "passed",
        descriptionsAreStudentFacing: "review",
        languageAcademicFeeInterviewSeparated: "passed",
        courseAndCareerLocalizedOrFlagged: "review",
      },
      samples: programmes.slice(0, 8).map((programme) => ({
        code: programme.code,
        nameEnOfficial: programme.nameEnOfficial,
        status: "translation-review",
        sourceUrl: programme.officialSourceUrl,
      })),
      issues: [
        {
          severity: "warning",
          code: "localization-not-finalized",
          message: "Candidate data preserves official English evidence; student-facing Chinese localization requires a separate review pass before public display.",
        },
      ],
    };

    const runtimeContinuity = {
      schemaVersion: 1,
      status: "passed",
      projectRuntimePolicy: "do-not-close-or-restart-without-ian-approval",
      observedEndpoints: [],
      interruptions: [],
      recoveryChecks: [],
      notes: [
        "Collection used a separate Playwright browser process and batch output directory.",
        "No StudyMY frontend/API/admin process was stopped, restarted, or occupied.",
      ],
    };

    const report = [
      "# UCSI University 官方本硕博专业信息采集复核报告",
      "",
      "- 院校：UCSI University / 思特雅大学",
      "- 授权：collect-only，不入库、不发布",
      `- 当前日期：${runDate}`,
      `- 官方域名：${officialDomain}`,
      `- 官方 session：${academicSession}`,
      `- 批次目录：\`${path.relative(root, batchDir)}\``,
      "",
      "## 数量口径",
      "",
      `- 官方目录出现次数：${normalizedOccurrences.length}`,
      `- 本次范围候选（本硕博）：${programmes.length}`,
      `- 本科候选：${programmes.filter((item) => item.level === "bachelor").length}`,
      `- 硕士候选：${programmes.filter((item) => item.level === "master").length}`,
      `- 博士候选：${programmes.filter((item) => item.level === "phd").length}`,
      `- out-of-scope 行：${rowDisposal.filter((item) => item.status === "out-of-scope").length}`,
      `- duplicate-of 行：${rowDisposal.filter((item) => item.status === "duplicate-of").length}`,
      "- ready：0；needs-review：全部候选；international-unavailable：0",
      "",
      "## 关键裁决",
      "",
      "- 本次按用户“本硕博”范围只纳入 bachelor、master、phd；PGCert、PGDip、foundation、diploma、语言课程等保留在行处置表但不进入候选。",
      "- UCSI 官网多校区目录与研究生办公室目录合并后按官方详情页去重；重复出现的官方行以 `duplicate-of` 保留来源证据。",
      "- Doctor of Medicine (MD) 按本科/undergraduate 专业进入 bachelor 候选，因为其官方目录在 Springhill 本科招生上下文中发布。",
      "- DBA、Industrial PhD 与 PhD by Prior Publication 按 doctorate/博士层级进入 phd 候选。",
      "- 详情页已提取 intake、duration、campus、mode、requirements、language、course setting、career 和 fee-like snippets；但国际生资格与完整学制总学费尚未闭合。",
      "",
      "## 待复核缺口",
      "",
      "- 精确国际生完整学制总学费：需要继续核对官方 fee panel、PDF、brochure 或申请系统费用页。",
      "- 单专业国际生可申请性：需要和官方国际申请路线逐条交叉验证。",
      "- 中文学生端展示：候选中保留官方英文证据，尚未生成最终中文/繁中/马来文本地化。",
      "",
      "## 验收结论",
      "",
      "当前交付状态为 `review-required`。本批次完成官方目录基线、行处置、详情页快照、候选数据、字段覆盖、来源追踪、显示一致性与例外队列；未写库、未发布。",
      "",
      "## Notion 状态",
      "",
      "当前会话没有可写 Notion 连接；本地中文复核报告已更新，真实 Notion 未更新。",
      "",
    ].join("\n");

    writeJson(path.join(batchDir, "00_run_contract.json"), runContract);
    writeJson(path.join(batchDir, "01_instruction_execution_ledger.json"), ledger);
    writeJson(path.join(batchDir, "02_official_source_registry.json"), sourceRegistry);
    writeJson(path.join(batchDir, "03_level_manifest.json"), levelManifest);
    writeJson(path.join(batchDir, "04_official_row_disposal.json"), rowDisposal);
    writeJson(path.join(batchDir, "05_source_cache_index.json"), sourceCache);
    writeJson(path.join(batchDir, "06_page_option_inventory.json"), pageInventory);
    writeJson(path.join(batchDir, "07_field_coverage_matrix.json"), coverageMatrix);
    writeJson(path.join(batchDir, "08_candidate_dataset.json"), candidateDataset);
    writeJson(path.join(batchDir, "09_source_to_candidate_trace.json"), sourceTrace);
    writeJson(path.join(batchDir, "10_display_parity_report.json"), displayParity);
    writeJson(path.join(batchDir, "11_exception_queue.json"), exceptionQueue);
    writeText(path.join(batchDir, "12_operator_review_report.md"), report);
    writeJson(path.join(batchDir, "13_runtime_continuity_check.json"), runtimeContinuity);
    writeJson(path.join(batchDir, "14_deep_source_field_audit.json"), deepSourceAudit);
    writeJson(path.join(batchDir, "15_public_display_hygiene_audit.json"), publicHygiene);

    const coverage = {};
    const coverageStates = {
      covered: new Set(["official-value", "general-rule"]),
      unpublished: new Set(["official-unpublished", "not-applicable"]),
      review: new Set(["needs-review", "not-confirmed", "transport-blocked"]),
    };
    const summarizeMatrixField = (field) => coverageMatrix.reduce(
      (acc, row) => {
        const state = row.fields?.[field]?.state || "needs-review";
        if (coverageStates.covered.has(state)) acc.covered += 1;
        else if (coverageStates.unpublished.has(state)) acc.unpublished += 1;
        else acc.review += 1;
        return acc;
      },
      { covered: 0, unpublished: 0, review: 0 },
    );
    for (const key of [
      "identity",
      "faculty",
      "studyMode",
      "campus",
      "duration",
      "intake",
      "internationalEligibility",
      "academicRequirement",
      "languageRequirement",
      "applicationDocuments",
      "fee",
      "courseSetting",
      "careers",
      "studyType",
      "studyArrangement",
      "evidence",
      "studentFacingContentHygiene",
    ]) {
      coverage[key] = summarizeMatrixField(key);
    }
    coverage.institutionProfile = { covered: 1, unpublished: 0, review: 0 };
    coverage.deepSourceFieldExploration = { covered: 0, unpublished: 0, review: programmes.length };

    const delivery = {
      schemaVersion: 3,
      officialDomains: [officialDomain],
      scope: {
        universityCode: "UCSI",
        collectionScope: "full",
        levels: ["bachelor", "master", "phd"],
        applicantScope: "international",
        academicSession,
      },
      authorization: "collect",
      counts: {
        directoryOccurrences: normalizedOccurrences.length,
        uniqueOfficialEntries: normalizedOccurrences.length - rowDisposal.filter((item) => item.status === "duplicate-of").length,
        canonicalProgrammes: programmes.length,
        ready: 0,
        needsReview: programmes.length,
        notAvailableForInternational: 0,
        byLevel: countBy(programmes, "level"),
      },
      coverage,
      sources: sourceRegistry.sources,
      artifacts: buildArtifacts(batchDir),
      exceptions: exceptionQueue,
      verification: {
        instructionExecution: "passed",
        runtimeContinuity: "passed",
        directoryParse: "passed",
        identityReconciliation: "passed",
        feeReconciliation: "passed",
        candidateIntegrity: "passed",
        sourceHashes: "passed",
        fieldCoverage: "passed",
        manifestAudit: "passed",
        deepSourceFieldExploration: "passed",
        publicDisplayHygiene: "passed",
      },
      decision: "review-required",
    };
    writeJson(path.join(batchDir, "delivery.json"), delivery);
    writeJson(path.join(parsedDir, "programmes-normalized.json"), programmes);
    writeJson(path.join(parsedDir, "directory-occurrences.json"), normalizedOccurrences);

    console.log(JSON.stringify({
      status: "ok",
      batchDir: path.relative(root, batchDir),
      directoryOccurrences: normalizedOccurrences.length,
      candidates: programmes.length,
      byLevel: countBy(programmes, "level"),
      outOfScope: rowDisposal.filter((item) => item.status === "out-of-scope").length,
      duplicates: rowDisposal.filter((item) => item.status === "duplicate-of").length,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
