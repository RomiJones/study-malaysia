import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUocOfficialAuditRows,
  buildUocUniversityRow,
  DEFAULT_UOC_DOCTORAL_AUDIT_PATH,
  DEFAULT_UOC_MASTER_AUDIT_PATH,
  DEFAULT_UOC_UNDERGRADUATE_AUDIT_PATH,
  loadUocReviewedAudits,
  summarizeUocOfficialAuditImport,
  UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
  validateUocReviewedAudit,
  verifyUocAllLevelPublicRecordSet
} from "../../apps/api/src/db/import-uoc-official-audit.ts";
import type { LocalizedStringArray, LocalizedText } from "@studymy/shared";

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function localizedRowsAreChinese(value: unknown) {
  const rows = (value as LocalizedStringArray | undefined)?.["zh-CN"] || [];
  return rows.length > 0 && rows.every(hasChinese);
}

function localizedEnglishRowsAreNotChinese(value: unknown) {
  const rows = (value as LocalizedStringArray | undefined)?.en || [];
  return rows.length > 0 && rows.every((row) => !hasChinese(row));
}

describe("UoC official all-level publication import", () => {
  const audits = loadUocReviewedAudits();

  test("validates the reviewed audit inputs", () => {
    assert.deepEqual(validateUocReviewedAudit(audits.undergraduate, 21, "undergraduate"), []);
    assert.deepEqual(validateUocReviewedAudit(audits.master, 16, "master"), []);
    assert.deepEqual(validateUocReviewedAudit(audits.doctoral, 5, "doctoral"), []);

    assert.equal(DEFAULT_UOC_UNDERGRADUATE_AUDIT_PATH.endsWith("UoC_audit_undergraduate_20260625_reviewed_v3.json"), true);
    assert.equal(DEFAULT_UOC_MASTER_AUDIT_PATH.endsWith("UoC_audit_master_20260625_reviewed_v1.json"), true);
    assert.equal(DEFAULT_UOC_DOCTORAL_AUDIT_PATH.endsWith("UoC_audit_doctoral_20260625_reviewed_v1.json"), true);
  });

  test("builds the complete public row set", () => {
    const rows = buildUocOfficialAuditRows(audits);
    const summary = summarizeUocOfficialAuditImport(rows);

    assert.equal(rows.length, 42);
    assert.deepEqual(summary.byLevel, { bachelor: 21, master: 16, phd: 5 });
    assert.equal(summary.readyRows, 42);
    assert.equal(summary.publishedRows, 42);
    assert.equal(summary.uniqueSlugs, 42);
    assert.equal(summary.officialFeeRows, 42);
    assert.equal(summary.languageRows, 42);
    assert.equal(summary.chineseNameRows, 42);
    assert.equal(summary.chineseCurriculumRows, 42);
    assert.equal(summary.chineseCareerRows, 42);
    assert.equal(summary.sourceRows, 42);
    assert.ok(rows.every((row) => String(row.slug).startsWith(UOC_PUBLIC_ALL_LEVEL_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
    assert.ok(rows.every((row) => row.officialFeeAuditStatus === "matched-official"));
    assert.ok(rows.every((row) => typeof row.officialTuitionMYR === "number" && row.officialTuitionMYR > 0));
    assert.ok(rows.every((row) => String(row.officialSourceUrl).includes("cyberjaya.edu.my")));
    assert.ok(rows.every((row) => String(row.officialFeeSourceUrl).includes("/international-fees-structure")));
    assert.ok(rows.every((row) => hasChinese((row.name as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.careers)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.careers)));
  });

  test("keeps important UoC fee and exception decisions explicit", () => {
    const rows = buildUocOfficialAuditRows(audits);
    const byName = new Map(rows.map((row) => [row.nameEnOfficial, row]));

    assert.equal(byName.get("Bachelor of Homeopathic Medical Science (Hons)")?.officialTuitionMYR, 99300);
    assert.equal(byName.get("Master in Islamic Finance (Open & Distance Learning)")?.officialTuitionMYR, 30000);
    assert.equal(byName.get("Master of Science in Occupational Safety and Health (OSH) Management (Open & Distance Learning)")?.officialTuitionMYR, 36750);
    assert.equal(byName.get("Doctor of Business Administration")?.officialTuitionMYR, 58300);
    assert.equal(byName.get("Doctor of Philosophy (PhD) in Pharmaceutical Sciences")?.officialTuitionMYR, 63300);
    assert.equal(byName.has("Doctor of Business Administration (ODL)"), false);
    assert.equal(byName.has("Master of Business Administration (MBA) DUAL AWARD (TOP UP)"), false);
  });

  test("verifies the public university record set and rejects unarchived stale rows", () => {
    const rows = buildUocOfficialAuditRows(audits).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 66
    }));
    const university = {
      ...buildUocUniversityRow(audits, rows as never),
      id: 66,
      programCount: 42,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;

    const verification = verifyUocAllLevelPublicRecordSet(university, rows as any, rows as any);
    assert.equal(verification.importRows, 42);
    assert.equal(verification.activeSupersededRows, 0);
    assert.equal(verification.legacyVisibleRows, 0);

    const stale = {
      ...rows[0],
      id: 999,
      slug: "uoc-old-public-row",
      isPublished: true,
      publicDisplayStatus: "ready"
    };
    assert.throws(
      () => verifyUocAllLevelPublicRecordSet(university, rows as any, [...rows, stale] as any),
      /UoC all-level public verification failed/
    );

    const archivedStale = {
      ...stale,
      isPublished: false,
      publicDisplayStatus: "archived"
    };
    assert.equal(
      verifyUocAllLevelPublicRecordSet(university, rows as any, [...rows, archivedStale] as any).activeSupersededRows,
      0
    );
  });
});
