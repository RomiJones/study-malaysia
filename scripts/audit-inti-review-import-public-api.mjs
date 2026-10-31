#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const readArg = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] || fallback;
};

const baseUrl = readArg("--base-url", "http://localhost:3000").replace(/\/+$/, "");
const output = readArg("--output", "data/imports/iiu/2026-06-20/iiu-20260620/21_post_import_display_audit.json");
const reviewSlug = "inti-official-2026-review-row-001-actuarial-science-program-american-university-program";

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${path} returned ${response.status}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function getStatus(path) {
  const response = await fetch(`${baseUrl}${path}`);
  return response.status;
}

function listItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function addIssue(issues, code, message, evidence = {}) {
  issues.push({ code, message, evidence });
}

const issues = [];
const university = await getJson("/api/universities/inti-international-university");
const publicPrograms = Array.isArray(university.programs) ? university.programs : [];
const catalogueSummary = university.catalogStatusSummary || {};
if (university.code !== "INTI") addIssue(issues, "wrong-university", "INTI public university route returned the wrong code.", { code: university.code });
if (university.publicDisplayStatus !== "ready") addIssue(issues, "university-not-ready", "Existing INTI university page was not preserved as public ready.", { publicDisplayStatus: university.publicDisplayStatus });
if (publicPrograms.length !== 0) addIssue(issues, "public-program-leakage", "INTI public university detail exposes review-only programmes.", { publicProgramCount: publicPrograms.length });
if (catalogueSummary?.all?.total !== 0 || catalogueSummary?.all?.needsReview !== 0 || catalogueSummary?.all?.ready !== 0) {
  addIssue(issues, "catalogue-summary-leakage", "INTI public catalogue summary exposes review-only partition counts.", { catalogueSummary });
}

const publicSearch = await getJson("/api/programs?search=INTI&pageSize=200");
const publicSearchItems = listItems(publicSearch);
const reviewSearchMatches = publicSearchItems.filter((item) => String(item.slug || "").startsWith("inti-official-2026-review-row-"));
if (reviewSearchMatches.length !== 0) {
  addIssue(issues, "program-search-leakage", "Public programme search exposes INTI review-only rows.", { slugs: reviewSearchMatches.map((item) => item.slug) });
}

const publicUniversityPrograms = await getJson("/api/programs?universityId=13&pageSize=200");
const publicUniversityProgramItems = listItems(publicUniversityPrograms);
if (publicUniversityProgramItems.some((item) => String(item.slug || "").startsWith("inti-official-2026-review-row-"))) {
  addIssue(issues, "university-program-list-leakage", "Public programme list by university exposes INTI review-only rows.");
}

const reviewDetailStatus = await getStatus(`/api/programs/${reviewSlug}`);
if (reviewDetailStatus !== 404) {
  addIssue(issues, "review-detail-route-leakage", "Public detail route for an INTI review-only row is accessible.", { status: reviewDetailStatus });
}

const report = {
  status: issues.length ? "failed" : "passed",
  checkedAt: new Date().toISOString(),
  baseUrl,
  universityRoute: {
    path: "/api/universities/inti-international-university",
    code: university.code,
    slug: university.slug,
    publicDisplayStatus: university.publicDisplayStatus,
    exposedProgrammes: publicPrograms.length,
    catalogStatusSummary: catalogueSummary
  },
  publicProgramSearch: {
    path: "/api/programs?search=INTI&pageSize=200",
    itemCount: publicSearchItems.length,
    reviewSlugMatches: reviewSearchMatches.length
  },
  publicProgramListByUniversity: {
    path: "/api/programs?universityId=13&pageSize=200",
    itemCount: publicUniversityProgramItems.length,
    reviewSlugMatches: publicUniversityProgramItems.filter((item) => String(item.slug || "").startsWith("inti-official-2026-review-row-")).length
  },
  reviewDetailRoute: {
    path: `/api/programs/${reviewSlug}`,
    status: reviewDetailStatus
  },
  conclusion: issues.length
    ? "INTI review-only import is not safe for front-end review until the listed public leakage issues are fixed."
    : "INTI review-only rows are available for database/admin review while public student APIs keep review rows and review counts hidden.",
  issues
};

mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(resolve(output), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
process.exit(issues.length ? 1 : 0);
