import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_TSU_OFFICIAL_AUDIT_CANDIDATE_PATH,
  TSU_OFFICIAL_AUDIT_SLUG_PREFIX,
  buildTsuOfficialAuditRows,
  buildTsuUniversityRow,
  summarizeTsuOfficialAuditImport,
  validateTsuOfficialAuditDataset
} from "../../apps/api/src/db/import-tsu-official-audit.ts";

const source = JSON.parse(readFileSync(DEFAULT_TSU_OFFICIAL_AUDIT_CANDIDATE_PATH, "utf8"));

test("TSU official audit import keeps all bachelor/master/phd rows in review-only status", () => {
  assert.deepEqual(validateTsuOfficialAuditDataset(source), []);

  const rows = buildTsuOfficialAuditRows(source);
  const summary = summarizeTsuOfficialAuditImport(rows);

  assert.equal(rows.length, 89);
  assert.deepEqual(summary.byLevel, { bachelor: 46, master: 28, phd: 15 });
  assert.equal(summary.readyRows, 0);
  assert.equal(summary.needsReviewRows, 89);
  assert.equal(summary.publishedRows, 0);
  assert.equal(summary.uniqueSlugs, 89);
  assert.equal(summary.officialTotalRows, 89);
  assert.equal(summary.ieltsOfficialValueRows, 79);
  assert.equal(summary.noIeltsScalarRows, 10);
  assert.equal(summary.localizedNameRows, 89);
  assert.equal(summary.localizedFacultyRows, 89);
  assert.deepEqual(summary.publicDisplayStatusCounts, { "needs-review": 89 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 89 });
  assert.deepEqual(summary.feeAuditStatusCounts, { "matched-official": 89 });

  assert.ok(rows.every((row) => row.isPublished === false));
  assert.ok(rows.every((row) => row.code && String(row.code).length <= 50));
  assert.ok(rows.every((row) => row.slug && String(row.slug).startsWith(TSU_OFFICIAL_AUDIT_SLUG_PREFIX)));
  assert.ok(rows.every((row) => Number(row.durationYears) > 0));
  assert.ok(rows.every((row) => row.tuitionCurrency === "USD"));
  assert.ok(rows.every((row) => Number(row.tuitionAmount) > 0));
  assert.ok(rows.every((row) => Number(row.annualTuitionCny) > 0));
  assert.ok(rows.every((row) => row.officialFeeSourceUrl?.includes("taylors.edu.my")));
  assert.ok(rows.every((row) => row.officialSourceUrl?.includes("taylors.edu.my")));
  assert.ok(rows.every((row) => row.name?.["zh-CN"] && row.name["zh-CN"] !== row.name?.en));
  assert.ok(rows.every((row) => row.name?.["zh-TW"] && row.name["zh-TW"] !== row.name?.en));
  assert.ok(rows.every((row) => row.faculty?.["zh-CN"] && row.faculty["zh-CN"] !== row.faculty?.en));

  const noIeltsRows = rows.filter((row) => Number(row.languageRequirement?.ielts || 0) === 0);
  assert.equal(noIeltsRows.length, 10);
  assert.ok(noIeltsRows.every((row) => /No IELTS-only scalar published/i.test(String(row.reviewReason))));

  const mbbs = rows.find((row) => row.nameEnOfficial === "Bachelor of Medicine, Bachelor of Surgery (MBBS)");
  assert.equal(mbbs?.name?.["zh-CN"], "医学士与外科学士（MBBS）");
  assert.equal(mbbs?.category, "medicine");
});

test("TSU review import university row defaults to hidden but preserves an existing public page", () => {
  const rows = buildTsuOfficialAuditRows(source);
  const summary = summarizeTsuOfficialAuditImport(rows);
  const newUniversity = buildTsuUniversityRow(source, summary);

  assert.equal(newUniversity.code, "TSU");
  assert.equal(newUniversity.isPublished, false);
  assert.equal(newUniversity.publicDisplayStatus, "needs-review");
  assert.equal(newUniversity.officialSourceStatus, "official-verified");
  assert.equal(newUniversity.programCount, 89);
  assert.equal(newUniversity.officialProfile?.tsuReviewImport?.workflowAcceptance?.candidateProgrammes, 89);

  const preservedPublic = buildTsuUniversityRow(source, summary, {
    id: 1001,
    code: "TSU",
    slug: "existing-taylors-public-page",
    shortName: "Taylor's",
    name: { en: "Existing Taylor's", ms: "Existing Taylor's", "zh-CN": "已有泰莱", "zh-TW": "已有泰萊" },
    logoUrl: "",
    imageUrl: "",
    color: "#111111",
    qsRank: 251,
    qsAsiaRank: null,
    location: { en: "Existing", ms: "Existing", "zh-CN": "已有", "zh-TW": "已有" },
    region: { en: "Selangor", ms: "Selangor", "zh-CN": "雪兰莪州", "zh-TW": "雪蘭莪州" },
    ownership: "private",
    institutionType: "comprehensive",
    foundedYear: 1969,
    students: 0,
    intlStudents: 0,
    csrCertified: false,
    description: { en: "Keep me", ms: "Keep me", "zh-CN": "保留", "zh-TW": "保留" },
    website: "https://example.edu",
    admissionEmail: "",
    nameEnOfficial: "Existing Taylor's",
    officialWebsite: "https://example.edu",
    studyPortalUrl: "",
    internationalPageUrl: "",
    applicationPortalUrl: "",
    officialAddress: "",
    applicationPeriods: [],
    applicationFees: [],
    applicationDocuments: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
    chinaStudentRequirements: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
    officialProfile: { oldProfile: true },
    officialSources: [],
    officialVerifiedAt: null,
    officialSourceStatus: "official-verified",
    officialAuditSummary: "existing public summary",
    publicDisplayStatus: "ready",
    livingCostOfficialNote: null,
    tuitionMinCny: 0,
    tuitionMaxCny: 0,
    livingCostCny: 0,
    minIelts: 5.5,
    acceptNoLanguage: false,
    facilities: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
    highlights: { en: [], ms: [], "zh-CN": [], "zh-TW": [] },
    programCount: 12,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  assert.equal(preservedPublic.slug, "existing-taylors-public-page");
  assert.equal(preservedPublic.isPublished, true);
  assert.equal(preservedPublic.publicDisplayStatus, "ready");
  assert.equal(preservedPublic.officialProfile?.oldProfile, true);
  assert.equal(preservedPublic.officialProfile?.tsuReviewImport?.reviewOnlyControls?.preserveExistingPublicInstitutionPage, true);
});
