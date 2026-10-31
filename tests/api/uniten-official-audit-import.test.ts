import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUnitenOfficialAuditRows,
  buildUnitenUniversityRow,
  DEFAULT_UNITEN_DOCTORAL_AUDIT_PATH,
  DEFAULT_UNITEN_MASTER_AUDIT_PATH,
  DEFAULT_UNITEN_UNDERGRADUATE_AUDIT_PATH,
  loadUnitenReviewedAudits,
  summarizeUnitenOfficialAuditImport,
  UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
  validateUnitenReviewedAudit,
  verifyUnitenAllLevelPublicRecordSet
} from "../../apps/api/src/db/import-uniten-official-audit.ts";
import type { LocalizedStringArray, LocalizedText } from "@studymy/shared";

function hasChinese(value: unknown) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function localizedRowsAreChinese(value: unknown) {
  const rows = (value as LocalizedStringArray | undefined)?.["zh-CN"] || [];
  return rows.length > 0 && rows.every(hasChinese);
}

describe("UNITEN official all-level publication import", () => {
  const audits = loadUnitenReviewedAudits();

  test("validates reviewed audit inputs", () => {
    assert.deepEqual(validateUnitenReviewedAudit(audits.undergraduate, 18, "undergraduate"), []);
    assert.deepEqual(validateUnitenReviewedAudit(audits.master, 16, "master"), []);
    assert.deepEqual(validateUnitenReviewedAudit(audits.doctoral, 3, "doctoral"), []);

    assert.equal(DEFAULT_UNITEN_UNDERGRADUATE_AUDIT_PATH.endsWith("UNITEN_audit_undergraduate_20260626_reviewed_v1.json"), true);
    assert.equal(DEFAULT_UNITEN_MASTER_AUDIT_PATH.endsWith("UNITEN_audit_master_20260626_reviewed_v5.json"), true);
    assert.equal(DEFAULT_UNITEN_DOCTORAL_AUDIT_PATH.endsWith("UNITEN_audit_doctoral_20260626_reviewed_v1.json"), true);
  });

  test("builds publication-ready public rows with hard-gate fields", () => {
    const rows = buildUnitenOfficialAuditRows(audits);
    const summary = summarizeUnitenOfficialAuditImport(rows);

    assert.equal(rows.length, 37);
    assert.deepEqual(summary.byLevel, { bachelor: 18, master: 16, phd: 3 });
    assert.equal(summary.readyRows, 37);
    assert.equal(summary.publishedRows, 37);
    assert.equal(summary.uniqueSlugs, 37);
    assert.equal(summary.officialFeeRows, 37);
    assert.equal(summary.languageRows, 37);
    assert.equal(summary.chineseNameRows, 37);
    assert.equal(summary.chineseFacultyRows, 37);
    assert.equal(summary.chineseCurriculumRows, 37);
    assert.equal(summary.chineseCareerRows, 37);
    assert.equal(summary.sourceRows, 37);
    assert.ok(rows.every((row) => String(row.slug).startsWith(UNITEN_PUBLIC_ALL_LEVEL_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
    assert.ok(rows.every((row) => row.officialFeeAuditStatus === "matched-official"));
    assert.ok(rows.every((row) => typeof row.officialTuitionMYR === "number" && row.officialTuitionMYR > 0));
    assert.ok(rows.every((row) => Number(row.durationYears) > 0));
    assert.ok(rows.every((row) => Number((row.languageRequirement as { ielts?: number }).ielts || 0) > 0));
    assert.ok(rows.every((row) => hasChinese((row.name as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => hasChinese((row.faculty as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.careers)));
  });

  test("keeps key UNITEN field decisions explicit", () => {
    const rows = buildUnitenOfficialAuditRows(audits);
    const byName = new Map(rows.map((row) => [row.nameEnOfficial, row]));

    assert.equal(byName.get("Bachelor of Electrical and Electronics Engineering (Honours)")?.officialTuitionMYR, 98000);
    assert.equal(byName.get("Master in Energy Management (By Coursework & Project)")?.officialTuitionMYR, 50600);
    assert.equal(byName.get("Master in Electrical Engineering (By Coursework & Research)")?.durationYears, 1);
    assert.equal(byName.get("Master of Science in Electrical Engineering (By Research)")?.durationYears, 2);
    assert.equal(byName.get("Doctor of Philosophy (Engineering)")?.officialTuitionMYR, 36600);
  });

  test("overwrites stale placeholder university profile fields before publication", () => {
    const rows = buildUnitenOfficialAuditRows(audits);
    const university = buildUnitenUniversityRow(audits, rows, {
      slug: "universiti-tenaga-nasional",
      code: "UNITEN",
      website: "#",
      admissionEmail: "待更新",
      foundedYear: 2000,
      acceptNoLanguage: true,
      description: {
        en: "白名单样板院校数据",
        ms: "白名单样板院校数据",
        "zh-CN": "白名单样板院校数据",
        "zh-TW": "白名单样板院校数据"
      },
      facilities: {
        en: ["样板数据待补充"],
        ms: ["样板数据待补充"],
        "zh-CN": ["样板数据待补充"],
        "zh-TW": ["样板数据待补充"]
      }
    } as any);

    assert.equal(university.website, "https://www.uniten.edu.my");
    assert.equal(university.admissionEmail, "intadmission@uniten.edu.my");
    assert.equal(university.foundedYear, 1997);
    assert.equal(university.acceptNoLanguage, false);
    assert.equal((university.description as LocalizedText)["zh-CN"].includes("白名单"), false);
    assert.equal((university.facilities as LocalizedStringArray)["zh-CN"].some((item) => item.includes("样板")), false);
  });

  test("verifies the public university record set and rejects unarchived stale rows", () => {
    const rows = buildUnitenOfficialAuditRows(audits).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 88
    }));
    const university = {
      ...buildUnitenUniversityRow(audits, rows as never),
      id: 88,
      programCount: 37,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;

    const verification = verifyUnitenAllLevelPublicRecordSet(university, rows as any, rows as any);
    assert.equal(verification.importRows, 37);
    assert.equal(verification.activeSupersededRows, 0);
    assert.equal(verification.legacyVisibleRows, 0);

    const stale = {
      ...rows[0],
      id: 999,
      slug: "uniten-old-public-row",
      isPublished: true,
      publicDisplayStatus: "ready"
    };
    assert.throws(
      () => verifyUnitenAllLevelPublicRecordSet(university, rows as any, [...rows, stale] as any),
      /UNITEN all-level public verification failed/
    );
  });
});
