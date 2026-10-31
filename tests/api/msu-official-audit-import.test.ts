import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMsu2026TuitionCandidates,
  buildMsuOfficialAuditRows,
  buildMsuUniversityRow,
  DEFAULT_MSU_UNDERGRADUATE_AUDIT_PATH,
  loadMsuReviewedAudit,
  MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX,
  summarizeMsuOfficialAuditImport,
  validateMsuReviewedAudit,
  verifyMsuReviewRecordSet
} from "../../apps/api/src/db/import-msu-official-audit.ts";
import type { LocalizedStringArray, LocalizedText } from "@studymy/shared";
import { ProgramsService } from "../../apps/api/src/programs/programs.service.ts";
import { UniversitiesService } from "../../apps/api/src/universities/universities.service.ts";

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function localizedRowsAreChinese(value: unknown) {
  const rows = (value as LocalizedStringArray | undefined)?.["zh-CN"] || [];
  return rows.length > 0 && rows.every(hasChinese);
}

describe("MSU undergraduate official review import", () => {
  const audit = loadMsuReviewedAudit();

  test("validates the latest MSU reviewed audit as review-only input", () => {
    assert.deepEqual(validateMsuReviewedAudit(audit), []);
    assert.equal(DEFAULT_MSU_UNDERGRADUATE_AUDIT_PATH.endsWith("MSU_audit_undergraduate_20260629_verified_20260629_v9.json"), true);
    assert.equal(audit.safe_to_import, false);
    assert.equal(audit.recommended_for_import, false);
    assert.equal(audit.workflow_status, "validation_failed");
    assert.equal(audit.auditMeta?.readyCount, 0);
    assert.equal(audit.auditMeta?.needsReviewCount, 80);
    assert.equal(audit.validation_result?.blocking_issues?.length, 4);
  });

  test("builds all 80 MSU undergraduate rows in hidden review status", () => {
    const rows = buildMsuOfficialAuditRows(audit);
    const summary = summarizeMsuOfficialAuditImport(rows);

    assert.equal(rows.length, 80);
    assert.deepEqual(summary.byLevel, { bachelor: 80, master: 0, phd: 0 });
    assert.equal(summary.readyRows, 0);
    assert.equal(summary.needsReviewRows, 80);
    assert.equal(summary.publishedRows, 0);
    assert.equal(summary.uniqueSlugs, 80);
    assert.equal(summary.officialFeeRows, 0);
    assert.equal(summary.nonOfficialCandidateFeeRows, 74);
    assert.equal(summary.missingNonOfficialCandidateFeeRows, 6);
    assert.equal(summary.sourceConflictFeeRows, 6);
    assert.equal(summary.pendingFeeRows, 80);
    assert.equal(summary.directIeltsRows, 19);
    assert.equal(summary.missingDirectIeltsRows, 61);
    assert.equal(summary.durationReviewRows, 4);
    assert.equal(summary.curriculumRows, 75);
    assert.equal(summary.careerRows, 72);
    assert.equal(summary.sourceRows, 80);
    assert.deepEqual(summary.publicDisplayStatusCounts, { "needs-review": 80 });
    assert.deepEqual(summary.officialSourceStatusCounts, { "needs-review": 80 });
    assert.deepEqual(summary.feeAuditStatusCounts, { "pending-review": 74, "source-conflict": 6 });

    assert.ok(rows.every((row) => String(row.slug).startsWith(MSU_REVIEW_UNDERGRADUATE_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.isPublished === false));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "needs-review"));
    assert.ok(rows.every((row) => row.officialSourceStatus === "needs-review"));
    assert.ok(rows.every((row) => ["pending-review", "source-conflict"].includes(String(row.officialFeeAuditStatus))));
    assert.ok(rows.every((row) => row.officialTuitionMYR == null));
    assert.equal(rows.filter((row) => Number(row.tuitionAmount || 0) > 0).length, 74);
    assert.equal(rows.filter((row) => Number(row.annualTuitionCny || 0) > 0).length, 74);
    assert.equal(rows.filter((row) => String(row.officialFeeSourceUrl || "").includes("your-uni.com") || String(row.officialFeeSourceUrl || "").includes("easyuni.com")).length, 74);
    assert.ok(rows.every((row) => String(row.officialSourceUrl).includes("msu.edu.my")));
    assert.ok(rows.every((row) => hasChinese((row.name as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => hasChinese(row.facultyZh)));
    assert.ok(rows.filter((row) => localizedRowsAreChinese(row.curriculum)).length === 75);
    assert.ok(rows.filter((row) => localizedRowsAreChinese(row.careers)).length === 72);
  });

  test("applies Ian-authorized MSU-only non-official 2026 annual tuition candidates", () => {
    const candidates = buildMsu2026TuitionCandidates(audit);
    const rows = buildMsuOfficialAuditRows(audit);
    const byName = new Map(rows.map((row) => [row.nameEnOfficial, row]));

    assert.equal(candidates.size, 74);

    const accounting = byName.get("Bachelor in Accounting and Finance (Hons)");
    assert.equal(accounting?.tuitionAmount, 21250);
    assert.equal(accounting?.tuitionDisplay, "RM 21,250 / year");
    assert.equal(accounting?.officialFeeAuditStatus, "pending-review");
    assert.match(String(accounting?.officialTuitionNote), /non-official 2026 annual tuition candidates/i);

    const computerScience = byName.get("Bachelor in Computer Science (Hons)");
    assert.equal(computerScience?.tuitionAmount, 28037);
    assert.equal(computerScience?.officialFeeAuditStatus, "source-conflict");
    assert.match(String(computerScience?.officialTuitionNote), /selected the higher amount/i);

    const pjj = byName.get("Bachelor in Early Childhood Education (Hons) – PJJ");
    assert.equal(pjj?.tuitionAmount, null);
    assert.equal(pjj?.officialFeeSourceUrl, "");

    const musicPerformance = byName.get("Bachelor in Music Performance (Hons)");
    assert.equal(musicPerformance?.tuitionAmount, null);
    assert.equal(musicPerformance?.officialFeeAuditStatus, "pending-review");
  });

  test("keeps unresolved MSU blockers explicit in representative rows", () => {
    const rows = buildMsuOfficialAuditRows(audit);
    const byName = new Map(rows.map((row) => [row.nameEnOfficial, row]));

    const broadcasting = byName.get("Bachelor in Broadcasting (Hons)");
    assert.equal(broadcasting?.languageRequirement?.ielts, 0);
    assert.match(String(broadcasting?.officialTuitionNote), /国际学生费用需向 MSU 咨询/);
    assert.match(String(broadcasting?.reviewReason), /non-official 2026 annual tuition candidate/i);
    assert.match(String(broadcasting?.reviewReason), /direct IELTS list score not published/i);

    const accessories = byName.get("Bachelor in Accessories Design (Hons)");
    assert.equal(accessories?.officialSourceUrl, "https://apply.msu.edu.my/course/?faculty=school-of-hospitality-and-creative-arts&qualification=bachelor");
    assert.match(String(accessories?.reviewReason), /pending issue/i);
  });

  test("preserves the public QS-ranked MSU university profile while adding review metadata", () => {
    const rows = buildMsuOfficialAuditRows(audit);
    const summary = summarizeMsuOfficialAuditImport(rows);
    const existingUniversity = {
      slug: "management-and-science-university",
      code: "MSU",
      name: { en: "Management and Science University", ms: "Management and Science University", "zh-CN": "管理与科学大学", "zh-TW": "管理与科学大学" },
      shortName: "MSU",
      qsRank: 608,
      qsAsiaRank: 999,
      imageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&h=500&fit=crop",
      color: "#7C3AED",
      publicDisplayStatus: "ready",
      isPublished: true,
      officialSourceStatus: "official-verified",
      officialProfile: {
        rankings: {
          qsWorld: {
            year: 2027,
            rankDisplay: "=608",
            status: "ranked"
          }
        }
      }
    } as any;

    const university = buildMsuUniversityRow(audit, summary, existingUniversity) as any;

    assert.equal(university.publicDisplayStatus, "ready");
    assert.equal(university.isPublished, true);
    assert.equal(university.qsRank, 608);
    assert.equal(university.qsAsiaRank, 999);
    assert.equal(university.imageUrl, existingUniversity.imageUrl);
    assert.equal(university.color, "#7C3AED");
    assert.equal(university.officialSourceStatus, "official-verified");
    assert.equal(university.officialProfile.rankings.qsWorld.rankDisplay, "=608");
    assert.equal(university.officialProfile.msuUndergraduateReviewImport.catalogStatusSummary.all.needsReview, 80);
    assert.equal(university.officialProfile.msuUndergraduateReviewImport.catalogStatusSummary.all.ready, 0);
    assert.equal(university.officialProfile.msuUndergraduateReviewImport.tuitionAudit.candidateCoverage.annualTuitionRows, 74);
    assert.equal(university.officialProfile.msuUndergraduateReviewImport.tuitionAudit.candidateCoverage.sourceConflictRows, 6);
  });

  test("verifies the review-only programme set and rejects unarchived stale bachelor rows", () => {
    const rows = buildMsuOfficialAuditRows(audit).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 77
    }));
    const summary = summarizeMsuOfficialAuditImport(rows);
    const university = {
      ...buildMsuUniversityRow(audit, summary),
      id: 77,
      programCount: 80,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;

    const verification = verifyMsuReviewRecordSet(university, rows as any, rows as any);
    assert.equal(verification.importRows, 80);
    assert.equal(verification.publicLeakageRows, 0);
    assert.equal(verification.adminNeedsReviewRows, 80);
    assert.equal(verification.activeSupersededRows, 0);

    const stale = {
      ...rows[0],
      id: 999,
      slug: "msu-old-public-row",
      isPublished: true,
      publicDisplayStatus: "ready"
    };
    assert.throws(
      () => verifyMsuReviewRecordSet(university, rows as any, [...rows, stale] as any),
      /MSU review import verification failed/
    );

    const archivedStale = {
      ...stale,
      isPublished: false,
      publicDisplayStatus: "archived"
    };
    assert.equal(
      verifyMsuReviewRecordSet(university, rows as any, [...rows, archivedStale] as any).activeSupersededRows,
      0
    );
  });

  test("exposes MSU review rows only through the keyed preview API", async () => {
    const rows = buildMsuOfficialAuditRows(audit).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 77
    }));
    const summary = summarizeMsuOfficialAuditImport(rows);
    const university = {
      ...buildMsuUniversityRow(audit, summary),
      id: 77,
      programs: rows,
      programCount: 80,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;
    const universitiesService = new UniversitiesService(
      {
        findOne: async ({ where }: any) => where?.code === "MSU" ? university : null
      } as any,
      {
        find: async () => rows
      } as any,
      { find: async () => [] } as any,
      { getJson: async () => null, setJson: async () => undefined } as any
    );

    const preview = await universitiesService.getReviewPreview("management-and-science-university", "msu-official-audit-2026") as any;
    assert.equal(preview.programs.length, 80);
    assert.equal(preview.reviewPreview.programmeCount, 80);
    assert.equal(preview.catalogStatusSummary.all.ready, 0);
    assert.equal(preview.catalogStatusSummary.all.needsReview, 80);
    await assert.rejects(
      () => universitiesService.getReviewPreview("management-and-science-university", "wrong-key"),
      /University not found/
    );

    const programsService = new ProgramsService(
      {
        findOne: async ({ where }: any) => {
          const row = rows.find((item) => where?.id === item.id || where?.slug === item.slug);
          return row ? { ...row, university } : null;
        }
      } as any,
      {
        findOneBy: async () => university
      } as any,
      { getJson: async () => null, setJson: async () => undefined } as any
    );
    const programPreview = await programsService.getReviewPreviewByIdentifier(String(rows[0].id), "msu-official-audit-2026") as any;
    assert.equal(programPreview.id, rows[0].id);
    assert.equal(programPreview.publicDisplayStatus, "needs-review");
    assert.equal(programPreview.university.code, "MSU");
    await assert.rejects(
      () => programsService.getReviewPreviewByIdentifier(String(rows[0].id), "wrong-key"),
      /Program not found/
    );
  });
});
