import { extractStaticCatalog, validateStaticCatalog } from "./static-html-catalog.js";
import { compareDbStats, createCatalogDataSource, importStaticCatalog } from "./static-html-importer.js";

function getArgValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

const input = getArgValue("--input") || process.env.STATIC_HTML_PATH || undefined;
const dryRun = process.argv.includes("--dry-run");
const pruneCatalog = !process.argv.includes("--no-prune");
const catalog = extractStaticCatalog(input);
const validation = validateStaticCatalog(catalog);

if (dryRun || !validation.ok) {
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        input: catalog.sourceHtmlPath,
        pruneCatalog,
        staticValidation: validation
      },
      null,
      2
    )
  );
  if (!validation.ok) process.exitCode = 1;
} else {
  const dataSource = createCatalogDataSource();
  await dataSource.initialize();
  try {
    const summary = await importStaticCatalog(dataSource, catalog, { pruneCatalog });
    const dbErrors = compareDbStats(summary.dbStats);
    console.log(
      JSON.stringify(
        {
          mode: "import",
          input: catalog.sourceHtmlPath,
          pruneCatalog,
          staticValidation: validation,
          importSummary: summary,
          dbValidation: {
            ok: dbErrors.length === 0,
            errors: dbErrors
          }
        },
        null,
        2
      )
    );
    if (dbErrors.length) process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}
