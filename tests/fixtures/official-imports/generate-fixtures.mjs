import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(fixtureRoot, "../../..");
const baselineParentHead = "c29e4ee0dbda958efe2591b018d4dd1cbde3b97d";
const sourcePaths = [
  "audits/APU_audit_doctoral_20260627.json",
  "audits/APU_audit_master_20260626_reviewed_v1.json",
  "audits/APU_audit_undergraduate_20260626_reviewed_v1.json",
  "audits/IIUM_audit_doctoral_20260629_verified_20260629.json",
  "audits/IIUM_audit_master_20260629_verified_20260629_r3.json",
  "audits/LUC_audit_undergraduate_20260630_verified_20260630_r4.json",
  "audits/MSU_audit_undergraduate_20260629_verified_20260629_v9.json",
  "audits/UCSI_audit_doctoral_20260625_reviewed_v2.json",
  "audits/UMPSA_audit_doctoral_20260628_reviewed_v1.json",
  "audits/UMPSA_audit_master_20260628_reviewed_v4.json",
  "audits/UMPSA_audit_undergraduate_20260627_reviewed_v8.json",
  "audits/UNITEN_audit_doctoral_20260626_reviewed_v1.json",
  "audits/UNITEN_audit_master_20260626_reviewed_v5.json",
  "audits/UNITEN_audit_undergraduate_20260626_reviewed_v1.json",
  "audits/UUM_audit_doctoral_20260628_reviewed_v3.json",
  "audits/UUM_audit_master_20260628_reviewed_v7.json",
  "audits/UUM_audit_undergraduate_20260627_reviewed_v6.json",
  "audits/UiTM_audit_doctoral_20260628_reviewed_v1.json",
  "audits/UiTM_audit_master_20260628_reviewed_v3.json",
  "audits/UiTM_audit_undergraduate_20260627_reviewed_v4.json",
  "data/imports/iiu/2026-06-20/iiu-20260620/02_official_source_registry.json",
  "data/imports/iiu/2026-06-20/iiu-20260620/08_candidate_dataset.json",
  "data/imports/msu/2026-06-30/msu-2026-tuition-web-search-report.json",
  "data/imports/msu/2026-06-30/msu-postgraduate-2026-authorized-fee-candidates.json",
  "data/imports/mum/2026-06-19/official-audit/08_candidate_dataset.json",
  "data/imports/sunway/2026-06-20/sunway-20260620/08_candidate_dataset.json",
  "data/imports/tsu/2026-06-20/tsu-20260620/08_candidate_dataset.json",
  "data/imports/ucsi/2026-06-20/official-audit/08_candidate_dataset.json",
  "data/imports/unm/2026-06-19/official-audit/08_candidate_dataset.json",
  "data/imports/utm/2026-06-18/phd/candidate-dataset.json",
  "data/imports/utm/2026-06-18/phd/skill-workflow-audit/04_official_row_disposal.json",
  "data/imports/utp/2026-06-19/official-audit/08_candidate_dataset.json"
];

const entries = [];

for (const sourcePath of sourcePaths) {
  const absoluteSourcePath = path.join(repositoryRoot, sourcePath);
  const content = await fs.readFile(absoluteSourcePath);
  JSON.parse(content.toString("utf8"));

  const fixturePath = `${sourcePath}.gz`;
  const absoluteFixturePath = path.join(fixtureRoot, fixturePath);
  const compressed = gzipSync(content, { level: 9, mtime: 0 });

  await fs.mkdir(path.dirname(absoluteFixturePath), { recursive: true });
  await fs.writeFile(absoluteFixturePath, compressed);

  entries.push({
    sourcePath,
    fixturePath,
    bytes: content.length,
    compressedBytes: compressed.length,
    sha256: crypto.createHash("sha256").update(content).digest("hex")
  });
}

const manifest = {
  schemaVersion: 1,
  purpose: "Minimal deterministic fixtures for root tests whose operational inputs are excluded from the code baseline.",
  baselineParentHead,
  compression: "gzip-level-9-mtime-0",
  entries
};

await fs.writeFile(path.join(fixtureRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  fixtureCount: entries.length,
  sourceBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
  compressedBytes: entries.reduce((sum, entry) => sum + entry.compressedBytes, 0)
}, null, 2));
