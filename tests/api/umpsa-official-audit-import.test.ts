import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUmpsaOfficialAuditRows,
  buildUmpsaUniversityRow,
  DEFAULT_UMPSA_DOCTORAL_AUDIT_PATH,
  DEFAULT_UMPSA_MASTER_AUDIT_PATH,
  DEFAULT_UMPSA_UNDERGRADUATE_AUDIT_PATH,
  loadUmpsaReviewedAudits,
  summarizeUmpsaOfficialAuditImport,
  UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
  validateUmpsaReviewedAudit,
  verifyUmpsaAllLevelPublicRecordSet
} from "../../apps/api/src/db/import-umpsa-official-audit.ts";
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

function languageIelts(row: { languageRequirement?: unknown }) {
  return Number((row.languageRequirement as { ielts?: number } | undefined)?.ielts || 0);
}

describe("UMPSA all-level official publication import", () => {
  const audits = loadUmpsaReviewedAudits();

  test("validates reviewed audit inputs without treating safe_to_import as approval", () => {
    assert.deepEqual(validateUmpsaReviewedAudit(audits.undergraduate, 34, "undergraduate"), []);
    assert.deepEqual(validateUmpsaReviewedAudit(audits.master, 19, "master"), []);
    assert.deepEqual(validateUmpsaReviewedAudit(audits.doctoral, 5, "doctoral"), []);
    assert.equal(DEFAULT_UMPSA_UNDERGRADUATE_AUDIT_PATH.endsWith("UMPSA_audit_undergraduate_20260627_reviewed_v8.json"), true);
    assert.equal(DEFAULT_UMPSA_MASTER_AUDIT_PATH.endsWith("UMPSA_audit_master_20260628_reviewed_v4.json"), true);
    assert.equal(DEFAULT_UMPSA_DOCTORAL_AUDIT_PATH.endsWith("UMPSA_audit_doctoral_20260628_reviewed_v1.json"), true);
    assert.equal(audits.undergraduate.safe_to_import, false);
    assert.equal(audits.master.safe_to_import, false);
    assert.equal(audits.doctoral.safe_to_import, false);
    assert.equal(audits.undergraduate.validationMeta?.overallDecision, "PASS-WITH-EXCEPTIONS");
    assert.equal(audits.master.validationMeta?.overallDecision, "PASS");
    assert.equal(audits.doctoral.validationMeta?.overallDecision, "PASS-WITH-EXCEPTIONS");
  });

  test("builds 58 publication-ready bachelor/master/phd rows with hard-gate fields", () => {
    const rows = buildUmpsaOfficialAuditRows(audits);
    const summary = summarizeUmpsaOfficialAuditImport(rows);

    assert.equal(rows.length, 58);
    assert.deepEqual(summary.byLevel, { bachelor: 34, master: 19, phd: 5 });
    assert.equal(summary.readyRows, 58);
    assert.equal(summary.publishedRows, 58);
    assert.equal(summary.uniqueSlugs, 58);
    assert.equal(summary.officialFeeRows, 58);
    assert.equal(summary.languageRows, 58);
    assert.equal(summary.chineseNameRows, 58);
    assert.equal(summary.chineseFacultyRows, 58);
    assert.equal(summary.chineseCurriculumRows, 58);
    assert.equal(summary.chineseCareerRows, 58);
    assert.equal(summary.englishPublicTextRows, 58);
    assert.equal(summary.sourceRows, 58);
    assert.equal(summary.officialUnpublishedCurriculumRows, 28);
    assert.ok(rows.every((row) => String(row.slug).startsWith(UMPSA_PUBLIC_ALL_LEVEL_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
    assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
    assert.ok(rows.every((row) => row.officialFeeAuditStatus === "matched-official"));
    assert.ok(rows.every((row) => typeof row.officialTuitionMYR === "number" && row.officialTuitionMYR > 0));
    assert.ok(rows.every((row) => Number(row.durationYears) > 0));
    assert.ok(rows.every((row) => languageIelts(row) > 0));
    assert.ok(rows.filter((row) => row.level === "bachelor").every((row) => languageIelts(row) >= 5));
    assert.equal(languageIelts(rows.find((row) => row.nameEnOfficial === "Bachelor of Business Engineering With Honours") || {}), 5.5);
    assert.equal(languageIelts(rows.find((row) => row.nameEnOfficial === "Bachelor of Business Analytics with Honours") || {}), 5.5);
    assert.equal(languageIelts(rows.find((row) => row.nameEnOfficial === "Bachelor of Project Management with Honours") || {}), 5.5);
    assert.equal(languageIelts(rows.find((row) => row.nameEnOfficial === "Bachelor of Industrial Technology Management with Honours") || {}), 5.5);
    assert.equal(languageIelts(rows.find((row) => row.nameEnOfficial === "Bachelor of Financial Technology with Honours") || {}), 6);
    assert.ok(rows.every((row) => hasChinese((row.name as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => !hasChinese((row.name as LocalizedText)?.en)));
    assert.ok(rows.every((row) => hasChinese((row.faculty as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => !hasChinese((row.faculty as LocalizedText)?.en)));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.careers)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.careers)));
  });

  test("keeps the Business Analytics IELTS and programme-page fee decision explicit", () => {
    const rows = buildUmpsaOfficialAuditRows(audits);
    const row = rows.find((item) => item.nameEnOfficial === "Bachelor of Business Analytics with Honours");

    assert.ok(row);
    assert.equal(row?.officialTuitionMYR, 43530);
    assert.equal(row?.officialFeeSourceUrl, "https://fim.umpsa.edu.my/index.php/programmes/undergraduate/bachelors-of-business-analytics-hons.html");
    assert.equal((row?.languageRequirement as { ielts?: number }).ielts, 5.5);
    assert.match(String(row?.officialTuitionNote), /FIM 官方 Business Analytics 专业页/);
    assert.match(String(row?.auditNote), /费用主链接已按 Ian 裁定改为 FIM 官方专业页/);
  });

  test("overwrites stale UMPSA profile fields before publication", () => {
    const rows = buildUmpsaOfficialAuditRows(audits);
    const university = buildUmpsaUniversityRow(audits, rows, {
      slug: "universiti-malaysia-pahang-al-sultan-abdullah-umpsa",
      code: "UMPSA",
      website: "#",
      acceptNoLanguage: true,
      publicDisplayStatus: "needs-review",
      isPublished: false,
      description: {
        en: "白名单样板院校数据",
        ms: "白名单样板院校数据",
        "zh-CN": "白名单样板院校数据",
        "zh-TW": "白名单样板院校数据"
      }
    } as any);

    assert.equal(university.website, "https://www.umpsa.edu.my/en");
    assert.equal(university.acceptNoLanguage, false);
    assert.equal(university.publicDisplayStatus, "ready");
    assert.equal(university.isPublished, true);
    assert.equal(university.programCount, 58);
    assert.equal((university.description as LocalizedText)["zh-CN"].includes("白名单"), false);
  });

  test("verifies the public university record set and rejects unarchived stale UMPSA rows", () => {
    const rows = buildUmpsaOfficialAuditRows(audits).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 66
    }));
    const university = {
      ...buildUmpsaUniversityRow(audits, rows as never),
      id: 66,
      programCount: 58,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;

    const verification = verifyUmpsaAllLevelPublicRecordSet(university, rows as any, rows as any);
    assert.equal(verification.importRows, 58);
    assert.equal(verification.activeSupersededRows, 0);
    assert.equal(verification.legacyVisibleRows, 0);

    const stale = {
      ...rows[0],
      id: 999,
      slug: "umpsa-old-public-row",
      isPublished: true,
      publicDisplayStatus: "ready"
    };
    assert.throws(
      () => verifyUmpsaAllLevelPublicRecordSet(university, rows as any, [...rows, stale] as any),
      /UMPSA all-level public verification failed/
    );
  });
});
