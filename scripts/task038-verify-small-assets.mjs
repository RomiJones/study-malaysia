import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, "apps", "web", "public");
const webSrcRoot = path.join(projectRoot, "apps", "web", "src");
const checks = [];

async function main() {
  await checkRequiredStaticAssets();
  await checkCssAssetReferences();
  await checkVueIconUsage();
  await checkNoLegacyTextIcons();
  await checkFavicon();

  console.log(JSON.stringify({
    taskId: "TASK-038",
    status: "passed",
    checks
  }, null, 2));
}

async function checkRequiredStaticAssets() {
  const required = [
    "assets/static-html/fallback-university-logo.svg",
    "assets/static-html/fallback-university-cover.svg",
    "assets/static-html/inline-svg-inline-svg-bb78dac7fc1c-bb78dac7fc1c.svg",
    "assets/static-html/inline-svg-inline-svg-c37be65d3006-c37be65d3006.svg",
    "assets/static-html/inline-svg-inline-svg-f843c6d34847-f843c6d34847.svg",
    "assets/static-html/inline-svg-inline-svg-e2bf67ea8213-e2bf67ea8213.svg",
    "assets/static-html/inline-svg-inline-svg-be91448f6f5a-be91448f6f5a.svg",
    "assets/static-html/inline-svg-inline-svg-0408b92c9e54-0408b92c9e54.svg",
    "assets/static-html/icon-university.svg",
    "assets/static-html/icon-compass.svg",
    "assets/static-html/icon-calculator.svg",
    "assets/static-html/icon-sparkle.svg",
    "assets/static-html/icon-heart.svg",
    "assets/static-html/icon-heart-filled.svg",
    "assets/static-html/icon-graduation.svg",
    "assets/static-html/icon-trophy.svg",
    "assets/static-html/icon-wallet.svg",
    "assets/static-html/icon-book-open.svg",
    "assets/static-html/icon-zap.svg",
    "assets/static-html/icon-check.svg",
    "assets/static-html/icon-vs.svg",
    "assets/static-html/icon-official.svg",
    "assets/static-html/icon-circle.svg",
    "assets/static-html/icon-draft.svg",
    "assets/static-html/icon-progress.svg",
    "favicon.svg"
  ];

  for (const file of required) {
    await assertFile(path.join(publicRoot, file), `required asset exists: ${file}`);
  }
}

async function checkCssAssetReferences() {
  const cssPath = path.join(webSrcRoot, "style.css");
  const css = await readText(cssPath);
  const publicPaths = [...css.matchAll(/url\(["']?(\/assets\/static-html\/[^"')]+)["']?\)/g)].map((match) => match[1]);
  assert(publicPaths.length > 10, "style.css references local static HTML SVG assets");

  for (const publicPath of new Set(publicPaths)) {
    await assertFile(path.join(publicRoot, publicPath.replace(/^\//, "")), `CSS local asset exists: ${publicPath}`);
  }
}

async function checkVueIconUsage() {
  const requiredSnippets = [
    ["components/SiteHeader.vue", "header-brand-mark-icon ui-icon ui-icon--school"],
    ["components/SiteHeader.vue", "nav-link__icon ui-icon"],
    ["pages/HomePage.vue", "search-icon ui-icon ui-icon--search"],
    ["pages/HomePage.vue", "filter-panel__icon"],
    ["pages/HomePage.vue", "filter-group-arrow ui-icon ui-icon--chevron"],
    ["pages/HomePage.vue", "ui-icon ui-icon--arrow-left"],
    ["pages/HomePage.vue", "ui-icon ui-icon--arrow-right"],
    ["components/UniversityCard.vue", "ui-icon--heart-filled"],
    ["components/UniversityCard.vue", "ui-icon--compare"],
    ["App.vue", "floating-tool-icon ui-icon ui-icon--calculator"],
    ["App.vue", "floating-tool-icon ui-icon ui-icon--recommend"],
    ["components/AuthModal.vue", "ui-icon ui-icon--close"],
    ["components/CalculatorModal.vue", "ui-icon ui-icon--close"],
    ["components/RecommendModal.vue", "ui-icon ui-icon--close"],
    ["pages/UniversityPage.vue", "ui-icon ui-icon--close"],
    ["pages/FavoritesPage.vue", "ui-icon ui-icon--heart-filled"],
    ["pages/ComparePage.vue", "ui-icon ui-icon--vs"],
    ["pages/PlannerPage.vue", "ui-icon ui-icon--check"],
    ["pages/PlannerPage.vue", "statusIconClass"],
    ["pages/UniversityPage.vue", "ui-icon ui-icon--arrow-left"]
  ];

  for (const [relativePath, snippet] of requiredSnippets) {
    const source = await readText(path.join(webSrcRoot, relativePath));
    assert(source.includes(snippet), `${relativePath} uses local icon snippet: ${snippet}`);
  }
}

async function checkFavicon() {
  const source = await readText(path.join(publicRoot, "favicon.svg"));
  assert(source.includes("#0C0E1A") && source.includes("#C8A84B"), "favicon uses static page ink/gold brand colors");
  assert(!source.includes("#6C47FF") && !source.includes("#FF6B35"), "favicon no longer uses old purple/orange gradient");
}

async function checkNoLegacyTextIcons() {
  const checksByFile = [
    ["pages/HomePage.vue", [">←<", ">→<", "search-icon\">⌕", "filter-group-arrow\"", "active-tag-x\" @click"]],
    ["pages/UniversityPage.vue", ["← {{", "modal-close\" type=\"button\" :aria-label=\"t('common.close')\" @click=\"closeProgramModal\">×"]],
    ["pages/PlannerPage.vue", ["statusIcon(", "? '✓' : ''"]],
    ["components/AuthModal.vue", [">×</button>"]],
    ["components/CalculatorModal.vue", [">×</button>"]],
    ["components/RecommendModal.vue", [">×</button>", "fav-empty-icon\">✦"]]
  ];

  for (const [relativePath, legacySnippets] of checksByFile) {
    const source = await readText(path.join(webSrcRoot, relativePath));
    for (const snippet of legacySnippets) {
      assert(!source.includes(snippet), `${relativePath} does not use legacy text icon: ${snippet}`);
    }
  }
}

async function assertFile(filePath, name) {
  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats?.isFile() || stats.size <= 0) throw new Error(name);
  checks.push({ name, status: "passed", file: relative(filePath), sizeBytes: stats.size });
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push({ name: message, status: "passed" });
}

function relative(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
