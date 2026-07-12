import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const suiteArg = args.find((arg) => arg.startsWith("--suite="));
const suite = suiteArg?.slice("--suite=".length) || "all";
const roots = args.filter((arg) => !arg.startsWith("--suite="));
const searchRoots = roots.length ? roots : ["tests"];

if (!["all", "gate2", "gate3"].includes(suite)) {
  console.error(`Unknown test suite: ${suite}`);
  process.exit(1);
}

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
  .filter((file) => {
    const normalized = file.replaceAll("\\", "/");
    if (suite === "gate2") return !normalized.includes("/tests/gate3/") && !normalized.startsWith("tests/gate3/");
    if (suite === "gate3") return normalized.includes("/tests/gate3/") || normalized.startsWith("tests/gate3/");
    return true;
  })
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
