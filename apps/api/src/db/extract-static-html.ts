import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { extractStaticCatalog, validateStaticCatalog } from "./static-html-catalog.js";

function getArgValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((item) => item.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

const input = getArgValue("--input") || process.env.STATIC_HTML_PATH || undefined;
const output = getArgValue("--out");
const catalog = extractStaticCatalog(input);
const validation = validateStaticCatalog(catalog);

if (output) {
  const outputPath = resolve(output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        sourceHtmlPath: catalog.sourceHtmlPath,
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
