import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildUcsiOfficialAuditRows,
  buildUcsiOfficialAuditPublicBachelorMasterRows,
  buildUcsiReviewedDoctoralRows,
  buildUcsiReviewedDoctoralUniversityRow,
  buildUcsiUniversityRow,
  DEFAULT_UCSI_OFFICIAL_AUDIT_CANDIDATE_PATH,
  DEFAULT_UCSI_REVIEWED_DOCTORAL_AUDIT_PATH,
  summarizeUcsiOfficialAuditImport,
  summarizeUcsiReviewedDoctoralImport,
  UCSI_OFFICIAL_AUDIT_SLUG_PREFIX,
  UCSI_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
  UCSI_REVIEWED_DOCTORAL_SLUG_PREFIX,
  validateUcsiOfficialAuditDataset,
  validateUcsiReviewedDoctoralAudit,
  verifyUcsiAllLevelPublicRecordSet
} from "../../apps/api/src/db/import-ucsi-official-audit.ts";
import { ProgramsService } from "../../apps/api/src/programs/programs.service.ts";
import { UniversitiesService } from "../../apps/api/src/universities/universities.service.ts";

function localizedRowsAreChinese(rows: unknown) {
  return Array.isArray(rows) &&
    rows.length > 0 &&
    rows.every((row) => /[\u3400-\u9fff]/.test(String(row))) &&
    rows.every((row) => !/翻译待补充|翻譯待補充|localization pending|Refer to the official source/i.test(String(row)));
}

describe("UCSI official audit review import", () => {
  const dataset = JSON.parse(readFileSync(DEFAULT_UCSI_OFFICIAL_AUDIT_CANDIDATE_PATH, "utf8"));

  test("keeps the complete official candidate dataset reproducible", () => {
    const rows = buildUcsiOfficialAuditRows(dataset);
    const summary = summarizeUcsiOfficialAuditImport(rows);

    assert.deepEqual(validateUcsiOfficialAuditDataset(dataset), []);
    assert.deepEqual(summary.byLevel, {
      bachelor: 60,
      master: 40,
      phd: 18
    });
    assert.equal(summary.candidateRows, 118);
    assert.equal(summary.importRows, 118);
    assert.equal(summary.uniqueSlugs, 118);
    assert.equal(summary.readyRows, 0);
    assert.equal(summary.needsReviewRows, 118);
    assert.equal(summary.publishedRows, 0);
    assert.equal(summary.pendingFeeRows, 118);
    assert.equal(summary.officialTotalRows, 0);
    assert.equal(summary.languageMissingRows, 3);
    assert.equal(summary.careerMissingRows, 5);
  });

  test("maps every programme into a non-public review row", () => {
    const rows = buildUcsiOfficialAuditRows(dataset);

    assert.equal(rows.length, 118);
    assert.ok(rows.every((row) => String(row.slug).startsWith(UCSI_OFFICIAL_AUDIT_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.isPublished === false));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "needs-review"));
    assert.ok(rows.every((row) => row.officialSourceStatus === "needs-review"));
    assert.ok(rows.every((row) => row.officialFeeAuditStatus === "pending-review"));
    assert.ok(rows.every((row) => row.tuitionAmount === null));
    assert.ok(rows.every((row) => row.officialTuitionMYR === null));
    assert.ok(rows.every((row) => row.tuitionCurrency === "MYR"));
    assert.ok(rows.every((row) => String(row.tuitionDisplay).includes("review")));
    assert.ok(rows.every((row) => String(row.officialSourceUrl).includes("ucsiuniversity.edu.my")));
    assert.ok(rows.every((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 3));
    assert.ok(
      rows.every((row) =>
        row.sourceUrls?.some((source) => source.url === "https://www.ucsiuniversity.edu.my/international-students")
      )
    );
    assert.ok(
      rows.every((row) =>
        row.sourceUrls?.some((source) => source.url.includes("/admission-procedure/international/"))
      )
    );
  });

  test("builds a review-only university row without publishing a new institution", () => {
    const rows = buildUcsiOfficialAuditRows(dataset);
    const summary = summarizeUcsiOfficialAuditImport(rows);
    const university = buildUcsiUniversityRow(dataset, summary);

    assert.equal(university.code, "UCSI");
    assert.equal(university.slug, "ucsi-university");
    assert.equal(university.nameEnOfficial, "UCSI University");
    assert.equal(university.isPublished, false);
    assert.equal(university.publicDisplayStatus, "needs-review");
    assert.equal(university.officialSourceStatus, "needs-review");
    assert.equal(university.programCount, 118);
    assert.ok(Array.isArray(university.officialSources));
    assert.ok(university.officialSources?.some((source) => source.url === "https://www.ucsiuniversity.edu.my/"));
    assert.ok(university.officialSources?.some((source) => source.url.includes("/programmes/Kuala-Lumpur")));
  });

  test("preserves a public UCSI institution surface during review-only re-import", () => {
    const rows = buildUcsiOfficialAuditRows(dataset);
    const summary = summarizeUcsiOfficialAuditImport(rows);
    const university = buildUcsiUniversityRow(dataset, summary, null, {
      existingUniversity: {
        slug: "ucsi-university",
        code: "UCSI",
        shortName: "UCSI",
        logoUrl: "/logo.svg",
        imageUrl: "/image.jpg",
        color: "#CC0000",
        qsRank: 282,
        qsAsiaRank: 30,
        institutionType: "comprehensive",
        foundedYear: 1986,
        students: 13000,
        intlStudents: 3500,
        csrCertified: true,
        admissionEmail: "international@ucsiuniversity.edu.my",
        description: {
          en: "UCSI University public profile.",
          ms: "UCSI University public profile.",
          "zh-CN": "思特雅大学公开简介。",
          "zh-TW": "思特雅大學公開簡介。"
        },
        officialProfile: {
          rankings: {
            qsWorld: {
              year: 2027,
              status: "ranked",
              rankDisplay: "282"
            }
          },
          authorization: "review-import",
          reviewImportPolicy: { importedRows: 118 },
          workflowAcceptance: { reviewRows: 118 }
        },
        officialSources: [],
        officialSourceStatus: "needs-review",
        officialAuditSummary: "UCSI review-only import leaked summary.",
        applicationDocuments: {
          en: ["Review-only leaked document."],
          ms: ["Review-only leaked document."],
          "zh-CN": ["Review-only leaked document."],
          "zh-TW": ["Review-only leaked document."]
        },
        chinaStudentRequirements: {
          en: ["Review-only leaked requirement."],
          ms: ["Review-only leaked requirement."],
          "zh-CN": ["Review-only leaked requirement."],
          "zh-TW": ["Review-only leaked requirement."]
        },
        programCount: 6,
        publicDisplayStatus: "ready",
        isPublished: true
      } as never
    });

    const serialized = JSON.stringify(university).toLowerCase();
    assert.equal(university.isPublished, true);
    assert.equal(university.publicDisplayStatus, "ready");
    assert.equal(university.officialSourceStatus, "official-verified");
    assert.equal(university.officialAuditSummary, null);
    assert.equal(university.programCount, 6);
    assert.equal(university.officialSources?.length, 3);
    assert.ok(!serialized.includes("review-import"));
    assert.ok(!serialized.includes("reviewimportpolicy"));
    assert.ok(!serialized.includes("workflowacceptance"));
    assert.ok(!serialized.includes("review-only"));
    assert.ok(!serialized.includes("needs-review"));
  });

  test("keeps review rows out of the default public detail surface", async () => {
    const rows = buildUcsiOfficialAuditRows(dataset).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 10
    }));
    const summary = summarizeUcsiOfficialAuditImport(rows);
    const publicUniversity = {
      ...buildUcsiUniversityRow(dataset, summary, null, {
        existingUniversity: {
          slug: "ucsi-university",
          code: "UCSI",
          shortName: "UCSI",
          publicDisplayStatus: "ready",
          isPublished: true
        } as never
      }),
      id: 10,
      programs: rows,
      programCount: rows.length
    };
    const universitiesService = new UniversitiesService(
      { findOne: async () => publicUniversity } as any,
      { find: async () => rows } as any,
      {} as any,
      { getJson: async () => null, setJson: async () => undefined } as any
    );

    const defaultDetail = await universitiesService.getBySlug("ucsi-university") as any;

    assert.equal(defaultDetail.programs.length, 0);
    assert.equal(defaultDetail.catalogStatusSummary.all.needsReview, 0);
    assert.equal("getReviewPreviewBySlug" in universitiesService, false);
  });

  test("keeps review programme details out of the public programme detail surface", async () => {
    const row = {
      ...buildUcsiOfficialAuditRows(dataset)[0],
      id: 1,
      universityId: 10
    };
    const summary = summarizeUcsiOfficialAuditImport([row]);
    const publicUniversity = {
      ...buildUcsiUniversityRow(dataset, summary, null, {
        existingUniversity: {
          slug: "ucsi-university",
          code: "UCSI",
          shortName: "UCSI",
          publicDisplayStatus: "ready",
          isPublished: true
        } as never
      }),
      id: 10
    };
    const programsService = new ProgramsService(
      {
        findOne: async (options: { where?: { isPublished?: boolean } }) => {
          assert.equal(options.where?.isPublished, true);
          return null;
        }
      } as any,
      { findOneBy: async () => publicUniversity } as any,
      { getJson: async () => null, setJson: async () => undefined } as any
    );

    await assert.rejects(
      () => programsService.getByIdentifier(String(row.id)),
      /Program not found/
    );
    assert.equal("getReviewPreviewByIdentifier" in programsService, false);
    assert.equal(row.publicDisplayStatus, "needs-review");
    assert.equal(row.isPublished, false);
    assert.ok(String(row.slug).startsWith(UCSI_OFFICIAL_AUDIT_SLUG_PREFIX));
  });

  test("can publish official bachelor and master rows without review-only leakage", () => {
    const rows = buildUcsiOfficialAuditPublicBachelorMasterRows(dataset);
    const summary = summarizeUcsiOfficialAuditImport(rows);
    const serialized = JSON.stringify(rows).toLowerCase();

    assert.equal(rows.length, 100);
    assert.deepEqual(summary.byLevel, {
      bachelor: 60,
      master: 40,
      phd: 0
    });
    assert.equal(summary.readyRows, 100);
    assert.equal(summary.needsReviewRows, 0);
    assert.equal(summary.publishedRows, 100);
    assert.equal(summary.uniqueSlugs, 100);
    assert.ok(rows.every((row) => String(row.slug).startsWith(UCSI_PUBLIC_ALL_LEVEL_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
    assert.ok(rows.every((row) => row.isPublished === true));
    assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
    assert.ok(rows.every((row) => /[\u4e00-\u9fff]/.test(String((row.name as any)?.["zh-CN"] || ""))));
    assert.ok(rows.every((row) => /[\u4e00-\u9fff]/.test(String((row.faculty as any)?.["zh-CN"] || ""))));
    assert.ok(rows.every((row) => /[\u4e00-\u9fff]/.test(String(row.facultyZh || ""))));
    assert.ok(rows.every((row) => row.officialFeeAuditStatus === "matched-official"));
    assert.ok(rows.every((row) => Number(row.tuitionAmount || 0) > 0));
    assert.ok(rows.every((row) => row.tuitionCurrency === "MYR"));
    assert.ok(rows.every((row) => /^RM\s[\d,.]+$/.test(String(row.listTuitionText || ""))));
    assert.ok(rows.every((row) => !/[|;]/.test(String(row.listTuitionText || ""))));
    assert.ok(rows.every((row) => !/Local Students|TVET Module|personality test/i.test(String(row.listTuitionText || ""))));
    assert.ok(rows.every((row) => String(row.officialTuitionNote || "").includes("International Students")));
    assert.ok(rows.every((row) => String(row.officialTuitionNote || "").includes("官方")));
    assert.ok(rows.every((row) => (row.applicationDocs as any)?.en?.[0] ===
      "International application and visa/payment documents are governed by UCSI's international admission procedure."));
    assert.ok(rows.every((row) => localizedRowsAreChinese((row.applicationDocs as any)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese((row.applicationDocs as any)?.["zh-TW"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese((row.curriculum as any)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese((row.careers as any)?.["zh-CN"])));

    const byCode = new Map(rows.map((row) => [row.code, row]));
    assert.equal(byCode.get("UCSI-BACHELOR-013")?.tuitionAmount, 114863);
    assert.equal(byCode.get("UCSI-MASTER-003")?.tuitionAmount, 72624);
    assert.equal(byCode.get("UCSI-MASTER-060")?.tuitionAmount, 59747);
    assert.equal(byCode.get("UCSI-MASTER-076")?.tuitionAmount, 62670);
    assert.equal(byCode.get("UCSI-MASTER-077")?.tuitionAmount, 74521);
    assert.equal(byCode.get("UCSI-MASTER-086")?.tuitionAmount, 49981);
    assert.equal(byCode.get("UCSI-BACHELOR-095")?.tuitionAmount, 98480.6);
    assert.equal(byCode.get("UCSI-BACHELOR-095")?.officialTuitionMYR, null);
    assert.equal(byCode.get("UCSI-BACHELOR-095")?.listTuitionText, "RM 98,480.60");
    assert.ok(!serialized.includes("review-only"));
    assert.ok(!serialized.includes("public display is disabled"));
  });

  test("requires superseded UCSI rows to be archived after all-level publication", () => {
    const audit = JSON.parse(readFileSync(DEFAULT_UCSI_REVIEWED_DOCTORAL_AUDIT_PATH, "utf8"));
    const rows = [
      ...buildUcsiOfficialAuditPublicBachelorMasterRows(dataset),
      ...buildUcsiReviewedDoctoralRows(audit)
    ].map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 10
    })) as any[];
    const university = {
      id: 10,
      code: "UCSI",
      slug: "ucsi-university",
      publicDisplayStatus: "ready",
      isPublished: true,
      programCount: 118
    } as any;
    const supersededReviewRow = {
      id: 999,
      universityId: 10,
      slug: `${UCSI_OFFICIAL_AUDIT_SLUG_PREFIX}001-old-review`,
      publicDisplayStatus: "needs-review",
      isPublished: false
    } as any;

    assert.throws(
      () => verifyUcsiAllLevelPublicRecordSet(university, rows as any, [...rows, supersededReviewRow] as any),
      /UCSI all-level public verification failed/
    );

    const result = verifyUcsiAllLevelPublicRecordSet(university, rows as any, [
      ...rows,
      { ...supersededReviewRow, publicDisplayStatus: "archived" }
    ] as any) as any;

    assert.equal(result.activeSupersededRows, 0);
    assert.equal(result.oldReviewRowsHidden, 1);
  });
});

describe("UCSI reviewed doctoral publication import", () => {
  const audit = JSON.parse(readFileSync(DEFAULT_UCSI_REVIEWED_DOCTORAL_AUDIT_PATH, "utf8"));

  test("keeps the reviewed doctoral audit complete and publication-ready", () => {
    const rows = buildUcsiReviewedDoctoralRows(audit);
    const summary = summarizeUcsiReviewedDoctoralImport(rows);

    assert.deepEqual(validateUcsiReviewedDoctoralAudit(audit), []);
    assert.equal(audit.safe_to_import, false);
    assert.equal(rows.length, 18);
    assert.deepEqual(summary.byLevel, {
      bachelor: 0,
      master: 0,
      phd: 18
    });
    assert.equal(summary.candidateRows, 18);
    assert.equal(summary.importRows, 18);
    assert.equal(summary.uniqueSlugs, 18);
    assert.equal(summary.readyRows, 18);
    assert.equal(summary.needsReviewRows, 0);
    assert.equal(summary.publishedRows, 18);
    assert.equal(summary.pendingFeeRows, 0);
    assert.equal(summary.officialTotalRows, 18);
  });

  test("maps reviewed doctoral programmes into public ready official rows", () => {
    const rows = buildUcsiReviewedDoctoralRows(audit);

    assert.ok(rows.every((row) => String(row.slug).startsWith(UCSI_REVIEWED_DOCTORAL_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.isPublished === true));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
    assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
    assert.ok(rows.every((row) => row.officialFeeAuditStatus === "matched-official"));
    assert.ok(rows.every((row) => Number(row.tuitionAmount || 0) > 0));
    assert.ok(rows.every((row) => Number(row.officialTuitionMYR || 0) > 0));
    assert.ok(rows.every((row) => row.tuitionCurrency === "MYR"));
    assert.ok(rows.every((row) => (row.applicationDocs as any)?.en?.includes(
      "International application and visa/payment documents are governed by UCSI's international admission procedure."
    )));
    assert.ok(rows.every((row) => (row.applicationDocs as any)?.en?.includes(
      "Research proposal, portfolio, audition or publication evidence applies where the official programme page states it."
    )));
    assert.ok(rows.every((row) => localizedRowsAreChinese((row.applicationDocs as any)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese((row.applicationDocs as any)?.["zh-TW"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese((row.curriculum as any)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese((row.careers as any)?.["zh-CN"])));
    assert.ok(rows.every((row) => String(row.officialSourceUrl).includes("ucsiuniversity.edu.my")));
    assert.ok(rows.every((row) => Array.isArray(row.sourceUrls) && row.sourceUrls.length >= 3));
    assert.ok(JSON.stringify(rows).includes("官网未公布"));
  });

  test("retains the official DBA warning while publishing the current official display", () => {
    const rows = buildUcsiReviewedDoctoralRows(audit);
    const dba = rows.find((row) => row.nameEnOfficial === "DBA (Doctor of Business Administration)");

    assert.ok(dba);
    assert.equal(dba.publicDisplayStatus, "ready");
    assert.equal(dba.isPublished, true);
    assert.ok(String(dba.reviewReason || "").includes("Approval"));
    assert.ok(String(dba.officialAccreditationNote || "").includes("R2/340/8/0877"));
    assert.ok(String(dba.officialAccreditationNote || "").includes("A10091"));
  });

  test("builds a public UCSI institution row for doctoral review", () => {
    const rows = buildUcsiReviewedDoctoralRows(audit);
    const university = buildUcsiReviewedDoctoralUniversityRow(audit, rows);

    assert.equal(university.code, "UCSI");
    assert.equal(university.slug, "ucsi-university");
    assert.equal(university.isPublished, true);
    assert.equal(university.publicDisplayStatus, "ready");
    assert.equal(university.officialSourceStatus, "official-verified");
    assert.ok(Array.isArray(university.officialSources));
    assert.ok(university.officialSources?.some((source) => source.url === "https://www.ucsiuniversity.edu.my/"));
    assert.ok(university.officialSources?.some((source) => source.url.includes("Office-of-Research-and-Postgraduate-Studies")));
    assert.ok(!JSON.stringify(university).toLowerCase().includes("needs-review"));
  });
});
