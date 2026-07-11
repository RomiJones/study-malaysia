import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = process.argv.slice(2);
const searchRoots = roots.length ? roots : ["tests"];

function collectTestFiles(root) {
  if (!existsSync(root)) return [];
  const stats = statSync(root);
  if (stats.isFile()) return root.endsWith(".test.ts") ? [root] : [];

  const files = [];
  for (const entry of readdirSync(root)) {
    files.push(...collectTestFiles(join(root, entry)));
  }
  return files;
}

const testFiles = searchRoots
  .flatMap(collectTestFiles)
  .sort()
  .map((file) => relative(process.cwd(), file));

if (!testFiles.length) {
  console.error(`No test files found under: ${searchRoots.join(", ")}`);
  process.exit(1);
}

const tsxBin = join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const fixturePreload = join(process.cwd(), "tests", "fixtures", "official-imports", "install-fixture-fallback.cjs");
const nodeOptions = [process.env.NODE_OPTIONS, `--require=${fixturePreload}`].filter(Boolean).join(" ");
const result = spawnSync(tsxBin, ["--tsconfig", "tsconfig.test.json", "--test", ...testFiles], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions
  },
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
