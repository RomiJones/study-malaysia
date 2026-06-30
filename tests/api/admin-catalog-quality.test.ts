import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AdminCmsService } from "../../apps/api/src/admin/admin-cms.service.ts";

function localized(value: string) {
  return { en: value, ms: value, "zh-CN": value, "zh-TW": value };
}

function university(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: "UM",
    shortName: "UM",
    name: localized("University of Malaya"),
    website: "https://www.um.edu.my",
    officialWebsite: "https://www.um.edu.my",
    officialSources: [],
    officialSourceStatus: "official-verified",
    publicDisplayStatus: "ready",
    isPublished: true,
    ...overrides
  };
}

function program(overrides: Record<string, unknown> = {}) {
  const baseUniversity = university();
  return {
    id: 11,
    universityId: baseUniversity.id,
    university: baseUniversity,
    code: "UMP1",
    name: localized("Master of Information Technology"),
    nameEnOfficial: "Master of Information Technology",
    level: "master",
    category: "it",
    officialSourceUrl: "https://example.edu/program",
    officialEntryRequirementSourceUrl: "",
    officialAccreditationSourceUrl: "",
    sourceUrls: [],
    officialSourceStatus: "official-verified",
    officialFeeAuditStatus: "pending-review",
    officialFeeSourceUrl: "",
    officialTuitionMYR: null,
    tuitionCurrency: "CNY",
    publicDisplayStatus: "ready",
    isPublished: true,
    ...overrides
  };
}

function serviceWithData(universities: any[], programs: any[]) {
  return new AdminCmsService(
    { find: async () => universities } as any,
    { find: async () => programs } as any,
    {} as any,
    {} as any,
    { clearByPrefix: async () => undefined } as any,
    { write: async () => undefined } as any
  );
}

describe("admin catalog quality", () => {
  test("summarizes public catalog quality and returns actionable issues", async () => {
    const missingSourceUniversity = university({ officialWebsite: "", website: "", officialSources: [] });
    const readyMissingSourceProgram = program({
      id: 12,
      code: "NO-SOURCE",
      officialSourceUrl: "",
      officialSourceStatus: "needs-review",
      university: missingSourceUniversity
    });
    const feeMissingSourceProgram = program({
      id: 13,
      code: "NO-FEE-SOURCE",
      officialFeeAuditStatus: "matched-official",
      officialTuitionMYR: 22000,
      officialFeeSourceUrl: "",
      university: missingSourceUniversity
    });
    const hiddenProgram = program({
      id: 14,
      code: "HIDDEN",
      isPublished: false,
      publicDisplayStatus: "hidden-unverified",
      university: missingSourceUniversity
    });
    const service = serviceWithData(
      [missingSourceUniversity],
      [readyMissingSourceProgram, feeMissingSourceProgram, hiddenProgram]
    );

    const result = await service.catalogQuality() as any;
    const issueCodes = result.issues.map((issue: any) => issue.code);

    assert.equal(result.overview.universityTotal, 1);
    assert.equal(result.overview.publicUniversityCount, 1);
    assert.equal(result.overview.programTotal, 3);
    assert.equal(result.overview.publicProgramCount, 2);
    assert.equal(result.overview.readyProgramCount, 2);
    assert.equal(result.overview.missingUniversitySourceCount, 1);
    assert.equal(result.overview.missingProgramSourceCount, 1);
    assert.equal(result.overview.missingFeeSourceCount, 1);
    assert.equal(result.overview.programPublicDisplayCounts.ready, 2);
    assert.equal(result.overview.feeAuditCounts["matched-official"], 1);
    assert.equal(issueCodes.includes("university-ready-missing-source"), true);
    assert.equal(issueCodes.includes("program-ready-missing-source"), true);
    assert.equal(issueCodes.includes("program-fee-source-missing"), true);
    assert.equal(result.issues.every((issue: any) => issue.targetLabel && issue.hint), true);
  });
});
