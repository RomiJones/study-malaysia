import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildUsmUndergraduateProgramRows,
  DEFAULT_USM_UNDERGRADUATE_DETAILS_PATH,
  DEFAULT_USM_UNDERGRADUATE_MANIFEST_PATH,
  summarizeUsmUndergraduateRows,
  validateUsmUndergraduateManifest,
  verifyUsmUndergraduateImportedRecordSet,
  type UsmUndergraduateDetail,
  type UsmUndergraduateManifest
} from "../../apps/api/src/db/import-usm-undergraduate-official.ts";

const manifest: UsmUndergraduateManifest = {
  universityCode: "USM",
  academicSession: "2025/2026",
  retrievedAt: "2026-06-12T04:32:37.174952+00:00",
  records: [
    {
      rowNumber: 1,
      code: "US6145004",
      nameEnOfficial: "BACHELOR OF EDUCATION (TESOL) WITH HONOURS",
      level: "bachelor",
      category: "arts",
      universityCode: "USM",
      facultyEn: "SCHOOL OF EDUCATIONAL STUDIES",
      studyMode: "unknown",
      campus: "Main Campus, Penang Island",
      internationalEligibility: "available",
      officialSourceUrl: "https://admission.usm.my/index.php/main/undergraduate/international",
      officialVerifiedAt: "2026-06-12",
      officialSourceStatus: "official-verified",
      publicDisplayStatus: "needs-review",
      evidence: [],
      totalTuitionCandidateUSD: 13750,
      pdfPerSemesterCandidateUSD: 1718.75,
      tuitionBasis: "total-programme",
      feeCrossCheckStatus: "consistent-integer-semesters",
      detailVerified: true,
      qualityFlags: []
    },
    {
      rowNumber: 2,
      code: "0020",
      nameEnOfficial: "BACHELOR OF MANAGEMENT WITH HONOURS",
      level: "bachelor",
      category: "business",
      universityCode: "USM",
      facultyEn: "SCHOOL OF MANAGEMENT",
      studyMode: "unknown",
      campus: "USM International, RECSAM Penang",
      internationalEligibility: "available",
      officialSourceUrl: "https://admission.usm.my/index.php/main/undergraduate/international",
      officialVerifiedAt: "2026-06-12",
      officialSourceStatus: "source-conflict",
      publicDisplayStatus: "hidden-unverified",
      evidence: [],
      totalTuitionCandidateUSD: 10937.5,
      tuitionBasis: "total-programme",
      feeCrossCheckStatus: "not-comparable",
      detailVerified: false,
      qualityFlags: ["invalid-programme-code"]
    }
  ]
};

const details: UsmUndergraduateDetail[] = [
  {
    url: "https://admission.usm.my/index.php/course-ug-international/us6145004",
    code: "US6145004",
    name: "Bachelor of Education (TESOL) with Honours",
    durationOfficial: "4 Years / 8 Semester",
    mediumInstruction: "English Language",
    semesterOffered: "Semester 1 (October)",
    ieltsMinimum: 6,
    interviewRequired: true,
    feeRows: [],
    courseSectionCount: 4,
    careerCount: 1,
    careers: ["Teacher"]
  }
];

describe("USM undergraduate official import", () => {
  test("keeps the complete normalized undergraduate dataset reproducible in the repository", () => {
    const completeManifest = JSON.parse(
      readFileSync(DEFAULT_USM_UNDERGRADUATE_MANIFEST_PATH, "utf8")
    ) as UsmUndergraduateManifest;
    const completeDetails = JSON.parse(
      readFileSync(DEFAULT_USM_UNDERGRADUATE_DETAILS_PATH, "utf8")
    ) as UsmUndergraduateDetail[];
    const rows = buildUsmUndergraduateProgramRows(completeManifest, completeDetails);
    const summary = summarizeUsmUndergraduateRows(completeManifest, rows);

    assert.deepEqual(validateUsmUndergraduateManifest(completeManifest), []);
    assert.deepEqual(summary, {
      manifestRows: 91,
      uniqueSlugs: 91,
      detailVerifiedRows: 19,
      uniqueDetailVerifiedCodes: 9,
      publicDisplayStatusCounts: {
        "needs-review": 59,
        "hidden-unverified": 32
      },
      officialSourceStatusCounts: {
        "source-conflict": 40,
        "official-verified": 9,
        "needs-review": 42
      },
      feeAuditStatusCounts: {
        "source-conflict": 40,
        "matched-official": 9,
        "pending-review": 42
      },
      invalidCodeRows: 3,
      duplicateCodeGroups: 15
    });
  });

  test("validates the official USM manifest boundary", () => {
    assert.deepEqual(validateUsmUndergraduateManifest(manifest), []);
  });

  test("maps every source row to a stable unpublished review row", () => {
    const rows = buildUsmUndergraduateProgramRows(manifest, details);

    assert.equal(rows.length, 2);
    assert.equal(new Set(rows.map((row) => row.slug)).size, 2);
    assert.ok(rows.every((row) => row.isPublished === false));
    assert.ok(rows.every((row) => row.publicDisplayStatus !== "ready"));
    assert.equal(rows[0].durationYears, 4);
    assert.equal(rows[0].officialFeeAuditStatus, "matched-official");
    assert.equal(rows[0].tuitionAmount, 13750);
    assert.equal(rows[1].tuitionAmount, null);
    assert.match(String(rows[1].tuitionDisplay), /10,937\.50/);
  });

  test("reports invalid codes and review-state counts without dropping records", () => {
    const rows = buildUsmUndergraduateProgramRows(manifest, details);
    const summary = summarizeUsmUndergraduateRows(manifest, rows);

    assert.equal(summary.manifestRows, 2);
    assert.equal(summary.invalidCodeRows, 1);
    assert.equal(summary.uniqueDetailVerifiedCodes, 1);
    assert.deepEqual(summary.publicDisplayStatusCounts, {
      "needs-review": 1,
      "hidden-unverified": 1
    });
  });

  test("keeps source-conflict rows out of matched fee status", () => {
    const conflictManifest: UsmUndergraduateManifest = {
      ...manifest,
      records: [
        {
          ...manifest.records[0],
          officialSourceStatus: "source-conflict",
          publicDisplayStatus: "hidden-unverified"
        }
      ]
    };

    const [row] = buildUsmUndergraduateProgramRows(conflictManifest, details);

    assert.equal(row.officialFeeAuditStatus, "source-conflict");
    assert.equal(row.isPublished, false);
  });

  test("downgrades ready source rows and preserves decimal USD without rounding", () => {
    const readyManifest: UsmUndergraduateManifest = {
      ...manifest,
      records: [
        {
          ...manifest.records[1],
          publicDisplayStatus: "ready",
          officialSourceStatus: "needs-review",
          qualityFlags: []
        }
      ]
    };

    const [row] = buildUsmUndergraduateProgramRows(readyManifest, []);

    assert.equal(row.publicDisplayStatus, "needs-review");
    assert.equal(row.tuitionAmount, null);
    assert.match(String(row.officialTuitionNote), /USD 10,937\.50/);
  });

  test("rejects duplicate rows and non-USM source URLs", () => {
    const invalidManifest: UsmUndergraduateManifest = {
      ...manifest,
      records: [
        manifest.records[0],
        {
          ...manifest.records[1],
          rowNumber: manifest.records[0].rowNumber,
          officialSourceUrl: "https://example.com/program"
        }
      ]
    };

    assert.deepEqual(validateUsmUndergraduateManifest(invalidManifest), [
      "Duplicate manifest rowNumber 1.",
      "Row 1 has a non-USM source URL."
    ]);
  });

  test("verifies imported review rows and blocks published or ready leakage", () => {
    const reviewRows = [
      {
        isPublished: false,
        publicDisplayStatus: "needs-review" as const,
        officialSourceStatus: "official-verified" as const,
        officialFeeAuditStatus: "matched-official" as const
      },
      {
        isPublished: false,
        publicDisplayStatus: "hidden-unverified" as const,
        officialSourceStatus: "source-conflict" as const,
        officialFeeAuditStatus: "source-conflict" as const
      }
    ];

    assert.deepEqual(verifyUsmUndergraduateImportedRecordSet(reviewRows, 2), {
      importedRows: 2,
      publishedRows: 0,
      readyRows: 0,
      publicDisplayStatusCounts: { "needs-review": 1, "hidden-unverified": 1 },
      officialSourceStatusCounts: { "official-verified": 1, "source-conflict": 1 },
      feeAuditStatusCounts: { "matched-official": 1, "source-conflict": 1 }
    });
    assert.throws(
      () => verifyUsmUndergraduateImportedRecordSet([{ ...reviewRows[0], isPublished: true }], 1),
      /published=1/
    );
    assert.throws(
      () =>
        verifyUsmUndergraduateImportedRecordSet(
          [{ ...reviewRows[0], publicDisplayStatus: "ready" as const }],
          1
        ),
      /ready=1/
    );
    assert.throws(() => verifyUsmUndergraduateImportedRecordSet(reviewRows, 3), /expected=3, actual=2/);
  });
});
