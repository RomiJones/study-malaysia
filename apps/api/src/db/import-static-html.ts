import { extractStaticCatalog, validateStaticCatalog } from "./static-html-catalog.js";
import {
  compareDbStats,
  createCatalogDataSource,
  importStaticCatalog,
  previewStaticCatalogImport,
  shouldPruneStaticCatalog
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
const dryRun = process.argv.includes("--dry-run");
const layer = getCatalogLayer(getArgValue("--layer") || process.env.STATIC_HTML_LAYER || null);
const supplementImportConfirmed = process.argv.includes("--confirm-supplement");
const importConfirmed = process.argv.includes("--confirm-import");
const universityCode = getArgValue("--university-code") || process.env.STATIC_HTML_UNIVERSITY_CODE || null;
const universitySlug = getArgValue("--university-slug") || process.env.STATIC_HTML_UNIVERSITY_SLUG || null;
const catalog = extractStaticCatalog(input, { layer, universityCode, universitySlug });
const pruneCatalog = shouldPruneStaticCatalog(layer, {
  noPrune: process.argv.includes("--no-prune"),
  confirmPrune: process.argv.includes("--confirm-prune"),
  scopeActive: Boolean(catalog.scope)
});
const validation = validateStaticCatalog(catalog);

if (dryRun || !validation.ok) {
  let importPlan: Awaited<ReturnType<typeof previewStaticCatalogImport>> | null = null;
  if (dryRun && validation.ok) {
    const dataSource = createCatalogDataSource();
    await dataSource.initialize();
    try {
      importPlan = await previewStaticCatalogImport(dataSource, catalog, { pruneCatalog });
    } finally {
      await dataSource.destroy();
    }
  }
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        input: catalog.sourceHtmlPath,
        layer: catalog.layer,
        scope: catalog.scope || null,
        pruneCatalog,
        supplementImportConfirmed,
        importConfirmed,
        importPlan,
        staticValidation: validation
      },
      null,
      2
    )
  );
  if (!validation.ok || (importPlan?.conflicts.length || 0) > 0) process.exitCode = 1;
} else if (catalog.layer !== "base" && !supplementImportConfirmed) {
  console.log(
    JSON.stringify(
      {
        mode: "blocked",
        input: catalog.sourceHtmlPath,
        layer: catalog.layer,
        scope: catalog.scope || null,
        pruneCatalog,
        supplementImportConfirmed,
        importConfirmed,
        error: "Supplement or merged static catalog imports require --confirm-supplement."
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} else if (catalog.scope && !importConfirmed) {
  console.log(
    JSON.stringify(
      {
        mode: "blocked",
        input: catalog.sourceHtmlPath,
        layer: catalog.layer,
        scope: catalog.scope,
        pruneCatalog,
        supplementImportConfirmed,
        importConfirmed,
        error: "Scoped static catalog imports require --confirm-import after reviewing --dry-run output."
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} else {
  const dataSource = createCatalogDataSource();
  await dataSource.initialize();
  try {
    const importPlan = await previewStaticCatalogImport(dataSource, catalog, { pruneCatalog });
    if (importPlan.conflicts.length) {
      console.log(
        JSON.stringify(
          {
            mode: "blocked",
            input: catalog.sourceHtmlPath,
            layer: catalog.layer,
            scope: catalog.scope || null,
            pruneCatalog,
            supplementImportConfirmed,
            importConfirmed,
            importPlan,
            error: "Static catalog import has code/slug conflicts. Resolve conflicts before writing data."
          },
          null,
          2
        )
      );
      process.exitCode = 1;
    } else {
      const summary = await importStaticCatalog(dataSource, catalog, { pruneCatalog });
      const dbErrors = compareDbStats(summary.dbStats, summary.expectedStats);
      console.log(
        JSON.stringify(
          {
            mode: "import",
            input: catalog.sourceHtmlPath,
            layer: catalog.layer,
            scope: catalog.scope || null,
            pruneCatalog,
            supplementImportConfirmed,
            importConfirmed,
            staticValidation: validation,
            importPlan,
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
    }
  } finally {
    await dataSource.destroy();
  }
}
