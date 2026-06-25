import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_INTI_OFFICIAL_AUDIT_CANDIDATE_PATH,
  DEFAULT_INTI_OFFICIAL_SOURCE_REGISTRY_PATH,
  buildIntiOfficialAuditRows,
  buildIntiUniversityRow,
  summarizeIntiOfficialAuditImport,
  validateIntiOfficialAuditDataset
} from "../../apps/api/src/db/import-inti-official-audit.ts";

const source = JSON.parse(readFileSync(DEFAULT_INTI_OFFICIAL_AUDIT_CANDIDATE_PATH, "utf8"));
const sourceRegistry = JSON.parse(readFileSync(DEFAULT_INTI_OFFICIAL_SOURCE_REGISTRY_PATH, "utf8"));

function hasCjk(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function isEnglishProgrammeTitle(value: unknown) {
  return /\b(Bachelor|Master|Doctor|Diploma|Foundation|Certificate|Programme|Program|Degree|PhD|MBA|MSc|BSc|BA|Honours|Engineering|Management|Science|Arts|Medicine|Pharmacy|Nursing|Accounting|Finance|Education|Technology|Business)\b/i.test(String(value || ""));
}

test("INTI official audit import publishes official approximate fees as public programme rows", () => {
  assert.deepEqual(validateIntiOfficialAuditDataset(source, sourceRegistry), []);

  const rows = buildIntiOfficialAuditRows(source);
  const summary = summarizeIntiOfficialAuditImport(rows);

  assert.equal(rows.length, 107);
  assert.deepEqual(summary.byLevel, { bachelor: 74, master: 23, phd: 10 });
  assert.equal(summary.readyRows, 107);
  assert.equal(summary.needsReviewRows, 0);
  assert.equal(summary.publishedRows, 107);
  assert.equal(summary.uniqueSlugs, 107);
  assert.equal(summary.pendingFeeRows, 0);
  assert.equal(summary.officialApproximateFeeRows, 91);
  assert.equal(summary.approximateFeeRows, 91);
  assert.equal(summary.nonScalarApproximateFeeRows, 16);
  assert.equal(summary.rowsWithApproximateFeeEvidence, 107);
  assert.equal(summary.rowsWithOfficialSourceUrl, 107);
  assert.equal(summary.rowsWithDurationYears, 107);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 107 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 107 });
  assert.deepEqual(summary.feeAuditStatusCounts, { "official-approximate": 91, "official-non-scalar": 16 });

  assert.ok(rows.every((row) => row.isPublished === true));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => row.officialFeeAuditStatus === "official-approximate" || row.officialFeeAuditStatus === "official-non-scalar"));
  assert.equal(rows.filter((row) => row.officialFeeAuditStatus === "official-approximate").every((row) => Number(row.tuitionAmount) > 0), true);
  assert.equal(rows.filter((row) => row.officialFeeAuditStatus === "official-non-scalar").every((row) => row.tuitionAmount == null), true);
  assert.ok(rows.every((row) => row.officialTuitionMYR == null));
  assert.ok(rows.every((row) => row.tuitionCurrency === "MYR"));
  assert.ok(rows.every((row) => Number(row.annualTuitionCny) > 0));
  assert.ok(rows.every((row) => !/excludes 6% SST|exclude 6% SST/i.test(String(row.tuitionDisplay))));
  assert.ok(rows.every((row) => !/excludes 6% SST|exclude 6% SST/i.test(String(row.listTuitionText))));
  assert.ok(rows.every((row) => /official approximate fee|Multiple official approximate fee options/i.test(String(row.officialTuitionNote))));
  assert.ok(rows.every((row) => /exclude 6% SST/i.test(String(row.officialTuitionNote))));
  assert.ok(rows.every((row) => String(row.officialSourceUrl || "").includes("newinti.edu.my")));
  assert.ok(rows.every((row) => String(row.officialFeeSourceUrl || "").includes("newinti.edu.my")));
  assert.ok(rows.every((row) => row.slug && String(row.slug).startsWith("inti-official-2026-programme-")));
  assert.ok(rows.every((row) => row.code && String(row.code).startsWith("INTI-")));
  assert.ok(rows.every((row) => Number(row.durationYears) > 0));
  assert.ok(rows.every((row) => hasCjk((row.name as any)?.["zh-CN"])));
  assert.ok(rows.every((row) => !isEnglishProgrammeTitle((row.name as any)?.["zh-CN"])));
  assert.ok(rows.every((row) => hasCjk((row.faculty as any)?.["zh-CN"])));
  assert.ok(rows.every((row) => !isEnglishProgrammeTitle((row.faculty as any)?.["zh-CN"])));
  assert.ok(rows.every((row) => !hasCjk((row.name as any)?.en)));
  assert.ok(rows.every((row) => !hasCjk((row.name as any)?.ms)));
  assert.ok(rows.every((row) => !hasCjk((row.faculty as any)?.en)));
  assert.ok(rows.every((row) => !hasCjk((row.faculty as any)?.ms)));

  const scienceTransfer = rows.find((row) => row.code === "INTI-B-003");
  assert.equal(scienceTransfer?.nameEnOfficial, "Australian Degree Transfer Programme (Science)");
  assert.equal((scienceTransfer?.name as any)?.["zh-CN"], "澳大利亚学位转学分课程（理科）");
  assert.equal(Number(scienceTransfer?.durationYears), 3);
  assert.match(String(scienceTransfer?.durationOfficial), /years?|semesters?/i);

  const physiotherapy = rows.find((row) => row.code === "INTI-B-005");
  assert.equal(physiotherapy?.nameEnOfficial, "B.Sc. (Hons) in Physiotherapy");
  assert.equal(physiotherapy?.officialFeeAuditStatus, "official-approximate");
  assert.equal(Number(physiotherapy?.tuitionAmount), 105027);
  assert.equal(Number(physiotherapy?.languageRequirement?.ielts), 5.5);
  assert.equal(Number(physiotherapy?.languageRequirement?.toefl), 550);
  assert.equal(Number(physiotherapy?.languageRequirement?.muet), 4);
  assert.match(String(physiotherapy?.officialTuitionNote), /RM 105,027/);

  const actuarialScience = rows.find((row) => row.code === "INTI-B-001");
  assert.equal(actuarialScience?.officialFeeAuditStatus, "official-non-scalar");
  assert.equal(actuarialScience?.tuitionAmount, null);
  assert.equal(actuarialScience?.tuitionDisplay, "Approx. RM 46,012 - 48,820");
  assert.equal((actuarialScience?.name as any)?.["zh-CN"], "精算科学课程（美国大学转学分课程）");
  assert.equal((actuarialScience?.faculty as any)?.["zh-CN"], "美国大学课程");
});

test("INTI public university row preserves an existing public institution page", () => {
  const rows = buildIntiOfficialAuditRows(source);
  const summary = summarizeIntiOfficialAuditImport(rows);
  const existingPublicUniversity = {
    code: "INTI",
    shortName: "INTI",
    slug: "inti-existing-public",
    isPublished: true,
    publicDisplayStatus: "ready",
    name: { en: "Existing INTI", ms: "Existing INTI", "zh-CN": "现有英迪", "zh-TW": "現有英迪" },
    description: { en: "Existing public copy", ms: "Existing public copy", "zh-CN": "现有公开文案", "zh-TW": "現有公開文案" },
    officialProfile: { rankings: { qsWorld: { rankDisplay: "=406" } } },
    officialAuditSummary: "Existing public audit summary",
    officialSources: [{ title: "Official website", url: "https://newinti.edu.my", sourceType: "official-website", status: "official-verified" }],
    color: "#111111",
    qsRank: 516,
    tuitionMinCny: 1,
    tuitionMaxCny: 2,
    livingCostCny: 3,
    minIelts: 5.5,
    programCount: 5
  } as const;

  const preserved = buildIntiUniversityRow(source, summary, sourceRegistry, { existingUniversity: existingPublicUniversity });
  const preservedProfile = preserved.officialProfile as any;
  assert.equal(preserved.slug, "inti-existing-public");
  assert.equal(preserved.isPublished, true);
  assert.equal(preserved.publicDisplayStatus, "ready");
  assert.equal(preserved.description?.["zh-CN"], "现有公开文案");
  assert.equal(preserved.programCount, 5);
  assert.equal(preserved.officialAuditSummary, "Existing public audit summary");
  assert.equal(preservedProfile?.rankings?.qsWorld?.rankDisplay, "=406");
  assert.equal(preservedProfile?.reviewImportPolicy, undefined);
  assert.equal(preservedProfile?.catalogStatusSummary, undefined);

  const newPublic = buildIntiUniversityRow(source, summary, sourceRegistry);
  const newPublicProfile = newPublic.officialProfile as any;
  assert.equal(newPublic.isPublished, true);
  assert.equal(newPublic.publicDisplayStatus, "ready");
  assert.equal(newPublicProfile?.publicationPolicy?.publicReadyRows, 107);
  assert.equal(newPublicProfile?.publicationPolicy?.allRowsPublished, true);
});
