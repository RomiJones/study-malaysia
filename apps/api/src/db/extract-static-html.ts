import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEFAULT_STATIC_CATALOG_LAYER, extractStaticCatalog, validateStaticCatalog } from "./static-html-catalog.js";
import type { StaticCatalogLayerName } from "./static-html-catalog.js";

function getArgValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function getCatalogLayer(value: string | null): StaticCatalogLayerName {
  if (!value) return DEFAULT_STATIC_CATALOG_LAYER;
  if (value === "base" || value === "supplement" || value === "merged") return value;
  throw new Error(`Unsupported static catalog layer: ${value}. Use base, supplement, or merged.`);
}

const input = getArgValue("--input") || process.env.STATIC_HTML_PATH || undefined;
const output = getArgValue("--out");
const layer = getCatalogLayer(getArgValue("--layer") || process.env.STATIC_HTML_LAYER || null);
const universityCode = getArgValue("--university-code") || process.env.STATIC_HTML_UNIVERSITY_CODE || null;
const universitySlug = getArgValue("--university-slug") || process.env.STATIC_HTML_UNIVERSITY_SLUG || null;
const catalog = extractStaticCatalog(input, { layer, universityCode, universitySlug });
const validation = validateStaticCatalog(catalog);

if (output) {
  const outputPath = resolve(output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        sourceHtmlPath: catalog.sourceHtmlPath,
        layer: catalog.layer,
        scope: catalog.scope || null,
        stats: catalog.stats,
        universities: catalog.universities,
        programs: catalog.programs
      },
      null,
      2
    ),
    "utf8"
  );
}

console.log(
  JSON.stringify(
    {
      input: catalog.sourceHtmlPath,
      output: output ? resolve(output) : null,
      layer: catalog.layer,
      scope: catalog.scope || null,
      stats: catalog.stats,
      validation
    },
    null,
    2
  )
);

if (!validation.ok) {
  process.exitCode = 1;
}
