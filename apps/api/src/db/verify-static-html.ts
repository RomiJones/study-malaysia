import { extractStaticCatalog, validateStaticCatalog } from "./static-html-catalog.js";
import { compareDbStats, createCatalogDataSource, getStaticCatalogDbStats } from "./static-html-importer.js";

function getArgValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

const input = getArgValue("--input") || process.env.STATIC_HTML_PATH || undefined;
const includeDatabase = process.argv.includes("--db");
const catalog = extractStaticCatalog(input);
const validation = validateStaticCatalog(catalog);
let dbStats: Awaited<ReturnType<typeof getStaticCatalogDbStats>> | null = null;
let dbErrors: string[] = [];

if (includeDatabase) {
  const dataSource = createCatalogDataSource();
  await dataSource.initialize();
  try {
    dbStats = await getStaticCatalogDbStats(dataSource);
    dbErrors = compareDbStats(dbStats);
  } finally {
    await dataSource.destroy();
  }
}

console.log(
  JSON.stringify(
    {
      input: catalog.sourceHtmlPath,
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
