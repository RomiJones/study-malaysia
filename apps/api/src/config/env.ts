import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import dotenv from "dotenv";

function dedupe(paths: string[]) {
  return Array.from(new Set(paths.map((item) => resolve(item))));
}

function buildEnvCandidates() {
  const initCwd = process.env.INIT_CWD;
  const cwd = process.cwd();

  return dedupe([
    join(initCwd || cwd, ".env"),
    join(initCwd || cwd, ".env.local"),
    join(cwd, ".env"),
    join(cwd, ".env.local"),
    join(cwd, "..", ".env"),
    join(cwd, "..", ".env.local"),
    join(cwd, "..", "..", ".env"),
    join(cwd, "..", "..", ".env.local")
  ]);
}

export const ENV_FILE_PATHS = buildEnvCandidates();

export function loadEnvFiles() {
  for (const envPath of ENV_FILE_PATHS) {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }
}
