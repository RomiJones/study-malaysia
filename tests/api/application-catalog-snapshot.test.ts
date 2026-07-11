import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildApplicationCatalogSnapshot,
  compareApplicationCatalogSnapshot,
  getApplicationCatalogSnapshot
} from "../../apps/api/src/common/application-catalog-snapshot.ts";
import type { ApplicationMaterialItem } from "../../apps/api/src/common/application-materials.ts";
import type { ProgramEntity, UniversityEntity } from "../../apps/api/src/db/entities.ts";

const zh = (value: string) => ({ en: value, ms: value, "zh-CN": value, "zh-TW": value });
const zhList = (items: string[]) => ({ en: items, ms: items, "zh-CN": items, "zh-TW": items });

function university(overrides: Partial<UniversityEntity> = {}): UniversityEntity {
  return {
    id: 1,
    code: "UM",
    slug: "um",
    name: zh("马来亚大学"),
    shortName: "UM",
    publicDisplayStatus: "ready",
    officialSourceStatus: "official-verified",
    officialVerifiedAt: "2026-07-01",
    isPublished: true,
    officialWebsite: "https://www.um.edu.my",
    website: "https://www.um.edu.my",
    ...overrides
  } as unknown as UniversityEntity;
}

function program(overrides: Partial<ProgramEntity> = {}): ProgramEntity {
  return {
    id: 10,
    universityId: 1,
    code: "MSC-CS",
    slug: "msc-cs",
    name: zh("计算机科学硕士"),
    level: "master",
    category: "it",
    faculty: zh("计算机学院"),
    durationYears: 1,
    durationOfficial: "1 year",
    annualTuitionCny: 50000,
    tuitionAmount: 50000,
    tuitionCurrency: "CNY",
    tuitionDisplay: "CNY 50,000 / year",
    officialTuitionMYR: null,
    officialTuitionNote: "",
    officialFeeSourceUrl: "https://www.um.edu.my/fees",
    secondaryOfficialFeeSourceUrl: "",
    officialFeeAuditStatus: "matched-official",
    officialFeeAuditedAt: "2026-07-01",
    intakeMonths: ["9"],
    officialIntake: "September",
    officialIntakeNote: "",
    languageRequirement: { ielts: 6 },
    officialLanguageRequirement: "IELTS 6.0",
    requirement: { gpa: 3, gaokaoRequired: false, huikaoRequired: false, note: zh("本科相关背景") },
    officialAcademicRequirement: "Bachelor degree",
    chinaStudentRequirement: "",
    specialRequirementsNote: "",
    applicationDocs: zhList(["护照", "成绩单"]),
    curriculum: zhList([]),
    careers: zhList([]),
    specializations: zhList([]),
    description: zh("Computer science programme"),
    publicDisplayStatus: "ready",
    publicDisplayNote: "",
    reviewReason: "",
    auditNote: "",
    officialSourceStatus: "official-verified",
    officialVerifiedAt: "2026-07-01",
    officialSourceUrl: "https://www.um.edu.my/programme",
    officialEntryRequirementSourceUrl: "https://www.um.edu.my/entry",
    officialAccreditationSourceUrl: "",
    listTuitionText: "CNY 50,000 / year",
    isPublished: true,
    ...overrides
  } as unknown as ProgramEntity;
}

function material(overrides: Partial<ApplicationMaterialItem> = {}): ApplicationMaterialItem {
  return {
    key: "passport",
    title: "护照",
    requirementLevel: "required",
    source: "school",
    sourceLabel: "院校要求",
    reason: "院校或专业页面列出的申请材料。",
    status: "draft",
    reviewStatus: "not-uploaded",
    ...overrides
  };
}

describe("application catalog snapshot", () => {
  test("captures submitted catalog fields and case material snapshot", () => {
    const snapshot = buildApplicationCatalogSnapshot({
      university: university(),
      program: program(),
      caseMaterials: [material()],
      snapshotAt: "2026-07-04T08:00:00.000Z"
    });

    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.university?.name, "马来亚大学");
    assert.equal(snapshot.program?.fee.filterableTuitionCny, 50000);
    assert.equal(snapshot.program?.language.summary, "IELTS 6");
    assert.deepEqual(snapshot.program?.applicationDocs, ["护照", "成绩单"]);
    assert.equal(snapshot.caseMaterials[0]?.title, "护照");
    assert.equal(snapshot.program?.publicDisplayStatusLabel, "可公开展示");
  });

  test("returns stored snapshot from application metadata", () => {
    const snapshot = buildApplicationCatalogSnapshot({ university: university(), program: program() });
    assert.equal(getApplicationCatalogSnapshot({ applicationCatalogSnapshot: snapshot })?.program?.code, "MSC-CS");
    assert.equal(getApplicationCatalogSnapshot({ catalogSnapshot: snapshot })?.university?.code, "UM");
    assert.equal(getApplicationCatalogSnapshot({ applicationCatalogSnapshot: { version: 2 } }), null);
  });

  test("compares current catalog changes with risk levels and consultant advice", () => {
    const submitted = buildApplicationCatalogSnapshot({
      university: university(),
      program: program(),
      caseMaterials: [material()],
      snapshotAt: "2026-07-04T08:00:00.000Z"
    });
    const current = buildApplicationCatalogSnapshot({
      university: university({ officialSourceStatus: "source-conflict", officialVerifiedAt: "2026-07-05" }),
      program: program({
        annualTuitionCny: 65000,
        tuitionAmount: 65000,
        tuitionDisplay: "CNY 65,000 / year",
        listTuitionText: "CNY 65,000 / year",
        officialFeeAuditStatus: "source-conflict",
        officialFeeSourceUrl: "https://www.um.edu.my/new-fees",
        languageRequirement: { ielts: 6.5 },
        officialLanguageRequirement: "IELTS 6.5",
        applicationDocs: zhList(["护照", "成绩单", "作品集"]),
        publicDisplayStatus: "needs-review",
        officialSourceStatus: "source-conflict",
        officialVerifiedAt: "2026-07-05"
      })
    });

    const comparison = compareApplicationCatalogSnapshot(submitted, current);
    const categories = comparison.differences.map((item) => item.category);

    assert.equal(comparison.hasSnapshot, true);
    assert.equal(comparison.summary.high > 0, true);
    assert.equal(comparison.summary.hasHighRisk, true);
    assert.equal(categories.includes("fee"), true);
    assert.equal(categories.includes("language"), true);
    assert.equal(categories.includes("materials"), true);
    assert.equal(categories.includes("publication"), true);
    assert.equal(categories.includes("source"), true);
    assert.ok(comparison.differences.some((item) => item.key === "program.applicationDocs" && item.riskLevel === "high"));
    assert.match(comparison.summary.recommendation, /申请时快照/);
  });

  test("marks old applications without submitted catalog snapshot", () => {
    const current = buildApplicationCatalogSnapshot({ university: university(), program: program() });
    const comparison = compareApplicationCatalogSnapshot(null, current);

    assert.equal(comparison.hasSnapshot, false);
    assert.equal(comparison.summary.missingSnapshot, true);
    assert.equal(comparison.differences.length, 0);
    assert.match(comparison.summary.recommendation, /没有申请时目录快照/);
  });
});
