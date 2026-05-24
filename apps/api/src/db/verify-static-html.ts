import { extractStaticCatalog, validateStaticCatalog } from "./static-html-catalog.js";
import {
  compareDbStats,
  createCatalogDataSource,
  getStaticCatalogDbStats,
  getStaticCatalogDbStatsOptions
} from "./static-html-importer.js";
import type { StaticCatalogLayerName } from "./static-html-catalog.js";

function getArgValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function getCatalogLayer(value: string | null): StaticCatalogLayerName {
  if (!value || value === "base") return "base";
  if (value === "supplement" || value === "merged") return value;
  throw new Error(`Unsupported static catalog layer: ${value}. Use base, supplement, or merged.`);
}

const input = getArgValue("--input") || process.env.STATIC_HTML_PATH || undefined;
const includeDatabase = process.argv.includes("--db");
const layer = getCatalogLayer(getArgValue("--layer") || process.env.STATIC_HTML_LAYER || null);
const universityCode = getArgValue("--university-code") || process.env.STATIC_HTML_UNIVERSITY_CODE || null;
const universitySlug = getArgValue("--university-slug") || process.env.STATIC_HTML_UNIVERSITY_SLUG || null;
const catalog = extractStaticCatalog(input, { layer, universityCode, universitySlug });
const validation = validateStaticCatalog(catalog);
let dbStats: Awaited<ReturnType<typeof getStaticCatalogDbStats>> | null = null;
let dbErrors: string[] = [];

if (includeDatabase) {
  const dataSource = createCatalogDataSource({ synchronize: false });
  await dataSource.initialize();
  try {
    dbStats = await getStaticCatalogDbStats(dataSource, getStaticCatalogDbStatsOptions(catalog));
    dbErrors = compareDbStats(dbStats, catalog.expectedStats);
  } finally {
    await dataSource.destroy();
  }
}

console.log(
  JSON.stringify(
      {
        input: catalog.sourceHtmlPath,
        layer: catalog.layer,
        scope: catalog.scope || null,
        staticValidation: validation,
        dbStats,
      dbValidation: includeDatabase
        ? {
            ok: dbErrors.length === 0,
            errors: dbErrors
          }
        : null
    },
    null,
    2
  )
);

if (!validation.ok || dbErrors.length) {
  process.exitCode = 1;
}
