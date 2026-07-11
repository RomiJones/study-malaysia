import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
  buildApuOfficialAuditRows,
  buildApuUniversityRow,
  DEFAULT_APU_DOCTORAL_AUDIT_PATH,
  DEFAULT_APU_MASTER_AUDIT_PATH,
  DEFAULT_APU_UNDERGRADUATE_AUDIT_PATH,
  loadApuPublicationAudits,
  summarizeApuOfficialAuditImport,
  validateApuPublicationAudit,
  verifyApuAllLevelPublicRecordSet
} from "../../apps/api/src/db/import-apu-official-audit.ts";
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

describe("APU official all-level publication import", () => {
  const audits = loadApuPublicationAudits();

  test("validates APU audit inputs without treating safe_to_import as approval", () => {
    assert.deepEqual(validateApuPublicationAudit(audits.undergraduate, 56, "undergraduate"), []);
    assert.deepEqual(validateApuPublicationAudit(audits.master, 42, "master"), []);
    assert.deepEqual(validateApuPublicationAudit(audits.doctoral, 9, "doctoral"), []);

    assert.equal(DEFAULT_APU_UNDERGRADUATE_AUDIT_PATH.endsWith("APU_audit_undergraduate_20260626_reviewed_v1.json"), true);
    assert.equal(DEFAULT_APU_MASTER_AUDIT_PATH.endsWith("APU_audit_master_20260626_reviewed_v1.json"), true);
    assert.equal(DEFAULT_APU_DOCTORAL_AUDIT_PATH.endsWith("APU_audit_doctoral_20260627.json"), true);
    assert.equal(audits.undergraduate.safe_to_import, false);
    assert.equal(audits.master.safe_to_import, false);
    assert.equal(audits.doctoral.safe_to_import, false);
  });

  test("builds the complete APU public row set with hard-gate fields", () => {
    const rows = buildApuOfficialAuditRows(audits);
    const summary = summarizeApuOfficialAuditImport(rows);

    assert.equal(rows.length, 107);
    assert.deepEqual(summary.byLevel, { bachelor: 56, master: 42, phd: 9 });
    assert.equal(summary.readyRows, 107);
    assert.equal(summary.publishedRows, 107);
    assert.equal(summary.uniqueSlugs, 107);
    assert.equal(summary.officialFeeRows, 107);
    assert.equal(summary.languageRows, 107);
    assert.equal(summary.chineseNameRows, 107);
    assert.equal(summary.chineseFacultyRows, 107);
    assert.equal(summary.chineseCurriculumRows, 107);
    assert.equal(summary.chineseCareerRows, 107);
    assert.equal(summary.sourceRows, 107);
    assert.equal(summary.officialUnpublishedCareerRows, 8);
    assert.ok(rows.every((row) => String(row.slug).startsWith(APU_PUBLIC_ALL_LEVEL_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
    assert.ok(rows.every((row) => row.officialFeeAuditStatus === "matched-official"));
    assert.ok(rows.every((row) => typeof row.officialTuitionMYR === "number" && row.officialTuitionMYR > 0));
    assert.ok(rows.every((row) => String(row.officialSourceUrl).includes("apu.edu.my")));
    assert.ok(rows.every((row) => String(row.officialFeeSourceUrl).includes("apu.edu.my/course/")));
    assert.ok(rows.every((row) => hasChinese((row.name as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => hasChinese((row.faculty as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.careers)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.careers)));
  });

  test("keeps key APU fee and unpublished-field decisions explicit", () => {
    const rows = buildApuOfficialAuditRows(audits);
    const byName = new Map(rows.map((row) => [row.nameEnOfficial, row]));

    assert.equal(byName.get("Bachelor of Science (Honours) in Information Technology")?.officialTuitionMYR, 108500);
    assert.equal(byName.get("MSc in Software Engineering")?.officialTuitionMYR, 42000);
    assert.equal(byName.get("PhD in Computing")?.officialTuitionMYR, 50800);
    assert.equal(byName.get("PhD in Computing (ODL)")?.officialTuitionMYR, 42800);
    assert.equal(byName.get("Doctor of Business Administration (DBA)")?.officialTuitionMYR, 56800);
    assert.deepEqual((byName.get("PhD in Computing")?.careers as LocalizedStringArray)["zh-CN"], ["官网未公布具体职业方向"]);
    assert.equal((byName.get("Doctor of Business Administration (DBA)")?.careers as LocalizedStringArray)["zh-CN"].includes("首席执行官（CEO）"), true);
  });

  test("overwrites unsafe placeholder university profile fields before publication", () => {
    const rows = buildApuOfficialAuditRows(audits);
    const university = buildApuUniversityRow(audits, rows, {
      slug: "asia-pacific-university",
      code: "APU",
      website: "#",
      admissionEmail: "待更新",
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

    assert.equal(university.website, "https://www.apu.edu.my");
    assert.equal(university.admissionEmail, "info@apu.edu.my");
    assert.equal(university.applicationPortalUrl, "https://admissions.apu.edu.my/");
    assert.equal(university.acceptNoLanguage, false);
    assert.equal(university.publicDisplayStatus, "ready");
    assert.equal(university.isPublished, true);
    assert.equal(university.programCount, 107);
    assert.equal((university.description as LocalizedText)["zh-CN"].includes("白名单"), false);
  });

  test("verifies the public university record set and rejects unarchived stale APU rows", () => {
    const rows = buildApuOfficialAuditRows(audits).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 77
    }));
    const university = {
      ...buildApuUniversityRow(audits, rows as never),
      id: 77,
      programCount: 107,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;

    const verification = verifyApuAllLevelPublicRecordSet(university, rows as any, rows as any);
    assert.equal(verification.importRows, 107);
    assert.equal(verification.activeSupersededRows, 0);
    assert.equal(verification.legacyVisibleRows, 0);

    const stale = {
      ...rows[0],
      id: 999,
      slug: "apu-bachelor-cyber-security",
      isPublished: true,
      publicDisplayStatus: "ready"
    };
    assert.throws(
      () => verifyApuAllLevelPublicRecordSet(university, rows as any, [...rows, stale] as any),
      /APU all-level public verification failed/
    );
  });
});
