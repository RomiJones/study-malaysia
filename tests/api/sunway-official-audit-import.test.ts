import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_SUNWAY_OFFICIAL_AUDIT_CANDIDATE_PATH,
  SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX,
  buildSunwayOfficialAuditRows,
  buildSunwayUniversityRow,
  summarizeSunwayOfficialAuditImport,
  validateSunwayOfficialAuditDataset,
  verifySunwayImportedRecordSet,
  type SunwayCandidateDataset
} from "../../apps/api/src/db/import-sunway-official-audit.ts";

const source = JSON.parse(readFileSync(DEFAULT_SUNWAY_OFFICIAL_AUDIT_CANDIDATE_PATH, "utf8")) as SunwayCandidateDataset;

test("Sunway official audit import keeps all bachelor/master/phd rows review-only", () => {
  assert.deepEqual(validateSunwayOfficialAuditDataset(source), []);

  const rows = buildSunwayOfficialAuditRows(source);
  const summary = summarizeSunwayOfficialAuditImport(rows);
  const university = buildSunwayUniversityRow(source, summary);

  assert.equal(source.programmes.length, 97);
  assert.equal(rows.length, 97);
  assert.equal(summary.candidateRows, 97);
  assert.equal(summary.importRows, 97);
  assert.deepEqual(summary.byLevel, { bachelor: 48, master: 33, phd: 16 });
  assert.equal(summary.readyRows, 0);
  assert.equal(summary.needsReviewRows, 97);
  assert.equal(summary.publishedRows, 0);
  assert.equal(summary.uniqueSlugs, 97);
  assert.equal(summary.pendingFeeRows, 0);
  assert.equal(summary.notPublishedFeeRows, 4);
  assert.equal(summary.officialDurationRows, 97);
  assert.equal(summary.officialIntakeRows, 94);
  assert.equal(summary.officialLanguageRows, 97);
  assert.equal(summary.officialIeltsRows, 97);
  assert.equal(summary.noOfficialIeltsRows, 0);
  assert.equal(summary.minIelts, 5.5);
  assert.equal(summary.academicRequirementRows, 97);
  assert.equal(summary.applicationDocumentRows, 97);
  assert.equal(summary.courseSettingRows, 95);
  assert.equal(summary.careerRows, 83);
  assert.equal(summary.sourceLinkedRows, 97);
  assert.deepEqual(summary.publicDisplayStatusCounts, { "needs-review": 97 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "needs-review": 97 });
  assert.deepEqual(summary.feeAuditStatusCounts, {
    "matched-official": 10,
    "not-published": 4,
    "official-rate-verified": 83
  });

  assert.ok(rows.every((row) => row.slug && String(row.slug).startsWith(SUNWAY_OFFICIAL_AUDIT_SLUG_PREFIX)));
  assert.ok(rows.every((row) => row.code && String(row.code).length <= 50));
  assert.ok(rows.every((row) => row.isPublished === false));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "needs-review"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "needs-review"));
  assert.equal(rows.filter((row) => row.tuitionCurrency === "USD" && Number(row.tuitionAmount) > 0).length, 83);
  assert.equal(rows.filter((row) => row.tuitionCurrency === "MYR" && Number(row.tuitionAmount) > 0 && Number(row.officialTuitionMYR) > 0).length, 10);
  assert.equal(rows.filter((row) => row.tuitionCurrency === "UNKNOWN" && row.tuitionAmount == null).length, 4);
  assert.ok(rows.some((row) => /USD9,942/.test(String(row.tuitionDisplay))));
  assert.ok(rows.some((row) => /RM47,000/.test(String(row.tuitionDisplay))));
  assert.ok(rows.every((row) => Number(row.durationYears) > 0));
  assert.ok(rows.every((row) => row.officialSourceUrl?.includes("sunwayuniversity.edu.my")));
  assert.ok(rows.every((row) => (row.sourceUrls || []).some((source) => source.url.includes("sunwayuniversity.edu.my"))));
  assert.ok(rows.every((row) => (row.applicationDocs?.["zh-CN"] || []).some((doc) => /官方申请|源 PDF|来源属性/.test(doc))));
  assert.ok(rows.every((row) => !/^(本科|硕士|博士)课程[：:]/.test(String(row.name?.["zh-CN"] || ""))));
  assert.ok(rows.every((row) => /\p{Script=Han}/u.test(String(row.name?.["zh-CN"] || ""))));
  assert.ok(rows.every((row) => !/\b(?:BA|BSc|Bachelor|Master|Masters|Doctor|PhD|Hons|Honours|Honors)\b/i.test(String(row.name?.["zh-CN"] || ""))));
  assert.ok(rows.every((row) => !/Sunway|School|Faculty|Master's Degrees|Online/i.test(String(row.facultyZh || ""))));
  assert.equal(rows.filter((row) => row.languageRequirement?.ielts && row.languageRequirement.ielts < 5.5).length, 0);
  assert.deepEqual(rows.filter((row) => Number(row.languageRequirement?.ielts || 0) === 0).map((row) => row.code), []);

  const onlineEducation = rows.find((row) => row.code === "SUNWAY-MASTER-030");
  assert.equal(onlineEducation?.studyMode, "Coursework / part-time / online");
  assert.equal(onlineEducation?.officialFeeAuditStatus, "matched-official");
  assert.match(String(onlineEducation?.tuitionDisplay), /online programme fee/i);

  const creativeArtsPhd = rows.find((row) => row.nameEnOfficial === "Doctor of Philosophy in Creative Arts and Media");
  assert.equal(creativeArtsPhd?.level, "phd");
  assert.equal(creativeArtsPhd?.officialIntake, "");
  assert.equal(Number(creativeArtsPhd?.durationYears), 3);
  assert.match(String(creativeArtsPhd?.officialIntakeNote), /did not publish/i);

  assert.equal(university.code, "SUNWAY");
  assert.equal(university.isPublished, false);
  assert.equal(university.publicDisplayStatus, "needs-review");
  assert.equal(university.officialSourceStatus, "needs-review");
  assert.equal(university.qsRank, 354);
  assert.equal(university.minIelts, 5.5);
  assert.equal((university.officialProfile as any).rankings.qsWorld.rankDisplay, "=354");
  assert.equal((university.officialProfile as any).rankings.qsWorld.year, 2027);
  assert.equal((university.officialProfile as any).rankings.qsWorld.status, "ranked");
  assert.equal((university.officialProfile as any).catalogStatusSummary.all.total, 97);
  assert.equal((university.officialProfile as any).catalogStatusSummary.all.ready, 0);
  assert.equal((university.officialProfile as any).catalogStatusSummary.all.needsReview, 97);
  assert.equal((university.officialProfile as any).catalogStatusSummary.byLevel.master.needsReview, 33);
});

test("Sunway official audit import can publish all verified rows without review-only public copy", () => {
  assert.deepEqual(validateSunwayOfficialAuditDataset(source), []);

  const rows = buildSunwayOfficialAuditRows(source, { publish: true });
  const summary = summarizeSunwayOfficialAuditImport(rows);
  const university = buildSunwayUniversityRow(source, summary, { publish: true });

  assert.equal(rows.length, 97);
  assert.deepEqual(summary.byLevel, { bachelor: 48, master: 33, phd: 16 });
  assert.equal(summary.readyRows, 97);
  assert.equal(summary.needsReviewRows, 0);
  assert.equal(summary.publishedRows, 97);
  assert.equal(summary.uniqueSlugs, 97);
  assert.equal(summary.pendingFeeRows, 0);
  assert.equal(summary.notPublishedFeeRows, 4);
  assert.equal(summary.officialIeltsRows, 97);
  assert.equal(summary.noOfficialIeltsRows, 0);
  assert.equal(summary.minIelts, 5.5);
  assert.deepEqual(summary.publicDisplayStatusCounts, { ready: 97 });
  assert.deepEqual(summary.officialSourceStatusCounts, { "official-verified": 97 });
  assert.deepEqual(summary.feeAuditStatusCounts, {
    "matched-official": 10,
    "not-published": 4,
    "official-rate-verified": 83
  });

  assert.ok(rows.every((row) => row.isPublished === true));
  assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
  assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
  assert.ok(rows.every((row) => row.reviewReason == null));
  assert.equal(rows.filter((row) => row.tuitionCurrency === "USD" && Number(row.tuitionAmount) > 0).length, 83);
  assert.equal(rows.filter((row) => row.tuitionCurrency === "MYR" && Number(row.tuitionAmount) > 0 && Number(row.officialTuitionMYR) > 0).length, 10);
  assert.equal(rows.filter((row) => row.tuitionCurrency === "UNKNOWN" && row.tuitionAmount == null).length, 4);
  assert.ok(rows.every((row) => !/^(本科|硕士|博士)课程[：:]/.test(String(row.name?.["zh-CN"] || ""))));
  assert.ok(rows.every((row) => /\p{Script=Han}/u.test(String(row.name?.["zh-CN"] || ""))));
  assert.ok(rows.every((row) => !/\b(?:BA|BSc|Bachelor|Master|Masters|Doctor|PhD|Hons|Honours|Honors)\b/i.test(String(row.name?.["zh-CN"] || ""))));
  assert.ok(rows.every((row) => !/Sunway|School|Faculty|Master's Degrees|Online/i.test(String(row.facultyZh || ""))));
  assert.equal(rows.filter((row) => row.languageRequirement?.ielts && row.languageRequirement.ielts < 5.5).length, 0);
  const ieltsDistribution = rows
    .map((row) => Number(row.languageRequirement?.ielts || 0))
    .filter((score) => score > 0)
    .reduce<Record<string, number>>((acc, score) => {
      acc[String(score)] = (acc[String(score)] || 0) + 1;
      return acc;
    }, {});
  assert.deepEqual(ieltsDistribution, { "5.5": 6, "6": 86, "6.5": 3, "7": 2 });
  assert.deepEqual(rows.filter((row) => Number(row.languageRequirement?.ielts || 0) === 0).map((row) => row.code), []);
  assert.equal(rows.find((row) => row.code === "SUNWAY-BACHELOR-001")?.name?.en, "Bachelor of Science (Hons) in Accounting and Finance");
  assert.equal(rows.find((row) => row.code === "SUNWAY-BACHELOR-001")?.name?.["zh-CN"], "会计与金融理学荣誉学士");
  assert.equal(rows.find((row) => row.code === "SUNWAY-BACHELOR-001")?.name?.["zh-TW"], "會計與金融理學榮譽學士");
  assert.equal(rows.find((row) => row.code === "SUNWAY-BACHELOR-001")?.facultyZh, "双威商学院");
  assert.equal(rows.find((row) => row.code === "SUNWAY-BACHELOR-005")?.name?.["zh-CN"], "精算学理学荣誉学士");
  assert.equal(rows.find((row) => row.code === "SUNWAY-BACHELOR-005")?.facultyZh, "数学科学学院");
  assert.equal(rows.find((row) => row.code === "SUNWAY-MASTER-029")?.name?.["zh-CN"], "数据科学硕士");
  assert.equal(rows.find((row) => row.code === "SUNWAY-MASTER-029")?.facultyZh, "数学科学学院");
  assert.equal(rows.find((row) => row.code === "SUNWAY-MASTER-030")?.name?.["zh-CN"], "教育硕士");
  assert.equal(rows.find((row) => row.code === "SUNWAY-MASTER-030")?.facultyZh, "教育学院");
  assert.equal(rows.find((row) => row.code === "SUNWAY-MASTER-033")?.name?.["zh-CN"], "市场营销硕士");
  assert.equal(rows.find((row) => row.code === "SUNWAY-MASTER-033")?.facultyZh, "双威商学院");

  const localOnlyFeeRows = [
    ["SUNWAY-MASTER-020", 56100],
    ["SUNWAY-PHD-014", 73700],
    ["SUNWAY-PHD-016", 73700]
  ] as const;
  for (const [code, amount] of localOnlyFeeRows) {
    const row = rows.find((item) => item.code === code);
    assert.equal(row?.tuitionCurrency, "MYR");
    assert.equal(row?.tuitionAmount, amount);
    assert.equal(row?.officialTuitionMYR, amount);
    assert.equal(row?.officialFeeAuditStatus, "matched-official");
    assert.match(String(row?.tuitionDisplay), new RegExp(`RM${amount.toLocaleString("en-US")}`));
    assert.match(String(row?.officialTuitionNote), /Malaysian students/i);
    assert.match(String(row?.officialTuitionNote), /no separate USD amount/i);
  }

  const genuinelyUnpublishedFeeRows = ["SUNWAY-BACHELOR-020", "SUNWAY-BACHELOR-028", "SUNWAY-MASTER-007", "SUNWAY-PHD-009"];
  for (const code of genuinelyUnpublishedFeeRows) {
    const row = rows.find((item) => item.code === code);
    assert.equal(row?.tuitionCurrency, "UNKNOWN");
    assert.equal(row?.tuitionAmount, null);
    assert.equal(row?.officialTuitionMYR, null);
    assert.equal(row?.officialFeeAuditStatus, "not-published");
    assert.match(String(row?.tuitionDisplay), /Official fee not published/i);
  }

  const medicalSciencePhd = rows.find((row) => row.code === "SUNWAY-PHD-008");
  assert.equal(medicalSciencePhd?.name?.["zh-CN"], "医学科学哲学博士");
  assert.equal(medicalSciencePhd?.languageRequirement?.ielts, 6);
  assert.equal(medicalSciencePhd?.languageRequirement?.muet, 4);
  assert.match(String(medicalSciencePhd?.officialLanguageRequirement), /minimum score of 6\.0 in the IELTS/i);
  assert.doesNotMatch(String(medicalSciencePhd?.officialLanguageRequirement), /IELTS[^.]*4\.0/i);

  const nursingPhd = rows.find((row) => row.code === "SUNWAY-PHD-009");
  assert.equal(nursingPhd?.name?.["zh-CN"], "护理学哲学博士");
  assert.equal(nursingPhd?.languageRequirement?.ielts, 6);
  assert.equal(nursingPhd?.languageRequirement?.muet, 4);
  assert.doesNotMatch(String(nursingPhd?.officialLanguageRequirement), /IELTS|International English Language Testing System/i);
  assert.match(String(nursingPhd?.officialLanguageRequirement), /MUET\) OR equivalent to Common European Framework of Reference \(CEFR\)\(Mid B2\)/i);
  assert.match(String(nursingPhd?.specialRequirementsNote), /等效折算为 IELTS 6\.0/);

  const publicText = rows
    .map((row) =>
      [
        row.description?.["zh-CN"],
        row.publicDisplayNote,
        row.reviewReason,
        row.officialIntakeNote,
        row.chinaStudentRequirement,
        ...(row.applicationDocs?.["zh-CN"] || []),
        ...(row.curriculum?.["zh-CN"] || []),
        ...(row.careers?.["zh-CN"] || [])
      ].filter(Boolean).join(" ")
    )
    .join(" ");
  assert.doesNotMatch(publicText, /后台|待审查|待审核|公开展示前|review-only|needs-review|before public display/i);
  assert.doesNotMatch(publicText, /\b(?:bachelor|master|phd)\s+专业/i);
  assert.doesNotMatch(publicText, /official-application-form-pdf|programme-details|sourceId|provenance/i);
  assert.ok(rows.every((row) => /双威大学通过官方专业页面和申请页面公布国际申请要求/.test(String(row.chinaStudentRequirement))));
  assert.ok(rows.every((row) => row.auditNote == null));

  assert.equal(university.code, "SUNWAY");
  assert.equal(university.isPublished, true);
  assert.equal(university.publicDisplayStatus, "ready");
  assert.equal(university.officialSourceStatus, "official-verified");
  assert.equal(university.programCount, 97);
  assert.equal(university.minIelts, 5.5);
  assert.equal(university.qsRank, 354);
  assert.equal((university.officialProfile as any).rankings.qsWorld.rankDisplay, "=354");
  assert.equal((university.officialProfile as any).rankings.qsWorld.year, 2027);
  assert.equal((university.officialProfile as any).rankings.qsWorld.status, "ranked");
  assert.equal((university.officialProfile as any).authorization, "publish");
  assert.equal((university.officialProfile as any).catalogStatusSummary.all.total, 97);
  assert.equal((university.officialProfile as any).catalogStatusSummary.all.ready, 97);
  assert.equal((university.officialProfile as any).catalogStatusSummary.all.needsReview, 0);
  assert.equal((university.officialProfile as any).catalogStatusSummary.byLevel.master.ready, 33);
});

test("Sunway published verification blocks active legacy placeholder rows", () => {
  const rows = buildSunwayOfficialAuditRows(source, { publish: true });
  const summary = summarizeSunwayOfficialAuditImport(rows);
  const university = buildSunwayUniversityRow(source, summary, { publish: true });
  const activeLegacy = {
    slug: "sunway-university-bachelor-of-accounting-and-finance-hons-1401",
    code: "SUNWAYP1401",
    isPublished: true,
    publicDisplayStatus: "needs-review",
    officialSourceStatus: "missing-source",
    officialFeeAuditStatus: "not-published"
  };

  assert.throws(
    () => verifySunwayImportedRecordSet(university as any, rows as any, [...rows, activeLegacy] as any, { publish: true }),
    /legacyActiveRows/
  );

  const archivedLegacy = { ...activeLegacy, isPublished: false, publicDisplayStatus: "archived" };
  const verification = verifySunwayImportedRecordSet(university as any, rows as any, [...rows, archivedLegacy] as any, { publish: true });
  assert.equal(verification.legacyActiveRows, 0);
  assert.equal(verification.legacyPublicRows, 0);
  assert.equal(verification.publicProgrammeCount, 97);
});
