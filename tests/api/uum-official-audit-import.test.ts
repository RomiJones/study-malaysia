import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_UUM_DOCTORAL_AUDIT_PATH,
  DEFAULT_UUM_MASTER_AUDIT_PATH,
  DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH,
  UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
  buildUumOfficialAuditRows,
  buildUumUniversityRow,
  loadUumPublicationAudits,
  summarizeUumOfficialAuditImport,
  validateUumPublicationAudit,
  verifyUumAllLevelPublicRecordSet
} from "../../apps/api/src/db/import-uum-official-all-level.ts";
import type { LanguageRequirement, LocalizedStringArray, LocalizedText } from "@studymy/shared";

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

describe("UUM official all-level publication import", () => {
  const audits = loadUumPublicationAudits();

  test("validates UUM reviewed audit inputs without treating safe_to_import as approval", () => {
    assert.deepEqual(validateUumPublicationAudit(audits.undergraduate, 38, "undergraduate"), []);
    assert.deepEqual(validateUumPublicationAudit(audits.master, 61, "master"), []);
    assert.deepEqual(validateUumPublicationAudit(audits.doctoral, 6, "doctoral"), []);

    assert.equal(DEFAULT_UUM_UNDERGRADUATE_AUDIT_PATH.endsWith("UUM_audit_undergraduate_20260627_reviewed_v6.json"), true);
    assert.equal(DEFAULT_UUM_MASTER_AUDIT_PATH.endsWith("UUM_audit_master_20260628_reviewed_v7.json"), true);
    assert.equal(DEFAULT_UUM_DOCTORAL_AUDIT_PATH.endsWith("UUM_audit_doctoral_20260628_reviewed_v3.json"), true);
    assert.equal(audits.undergraduate.safe_to_import, false);
    assert.equal(audits.master.safe_to_import, false);
    assert.equal(audits.doctoral.safe_to_import, false);
  });

  test("builds the complete UUM public row set with publication display fields", () => {
    const rows = buildUumOfficialAuditRows(audits);
    const summary = summarizeUumOfficialAuditImport(rows);

    assert.equal(rows.length, 105);
    assert.deepEqual(summary.byLevel, { bachelor: 38, master: 61, phd: 6 });
    assert.equal(summary.readyRows, 105);
    assert.equal(summary.publishedRows, 105);
    assert.equal(summary.uniqueSlugs, 105);
    assert.equal(summary.officialTotalFeeRows, 38);
    assert.equal(summary.calculatedFromOfficialRateRows, 67);
    assert.equal(summary.officialRateFeeRows, 0);
    assert.equal(summary.scalarTuitionRows, 105);
    assert.equal(summary.rateOnlyDisplayRows, 0);
    assert.equal(summary.languageRows, 105);
    assert.equal(summary.undergraduateEquivalentIeltsRows, 37);
    assert.equal(summary.durationKnownRows, 105);
    assert.equal(summary.durationOfficialUnpublishedRows, 0);
    assert.equal(summary.chineseNameRows, 105);
    assert.equal(summary.chineseFacultyRows, 105);
    assert.equal(summary.chineseCurriculumRows, 105);
    assert.equal(summary.chineseCareerRows, 105);
    assert.equal(summary.sourceRows, 105);
    assert.ok(rows.every((row) => String(row.slug).startsWith(UUM_PUBLIC_ALL_LEVEL_SLUG_PREFIX)));
    assert.ok(rows.every((row) => row.publicDisplayStatus === "ready"));
    assert.ok(rows.every((row) => row.officialSourceStatus === "official-verified"));
    assert.ok(rows.every((row) => hasChinese((row.name as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => hasChinese((row.faculty as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.careers)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.careers)));
  });

  test("keeps Ian-approved UUM IELTS and calculated total tuition decisions explicit", () => {
    const rows = buildUumOfficialAuditRows(audits);
    const counselling = rows.find((row) => row.nameEnOfficial === "Bachelor of Counselling with Honours");
    const computerScience = rows.find((row) => row.nameEnOfficial === "Bachelor of Science with Honours (Information Technology)");
    const researchMaster = rows.find((row) => row.nameEnOfficial === "Master of Science (Accounting) - Research");
    const phdOyagsb = rows.find((row) => row.nameEnOfficial === "Doctor of Philosophy (PhD) by OYAGSB");
    const edd = rows.find((row) => row.nameEnOfficial === "Doctor of Education (Ed.D.)");
    const dba = rows.find((row) => row.nameEnOfficial === "Doctor of Business Administration (DBA)");

    assert.equal((counselling?.languageRequirement as LanguageRequirement).ielts, 5);
    assert.equal((computerScience?.languageRequirement as LanguageRequirement).ielts, 5.5);
    assert.match(String(counselling?.auditNote), /本科列表 IELTS 展示口径/);
    assert.equal(researchMaster?.officialFeeAuditStatus, "calculated-from-official-rate");
    assert.equal(researchMaster?.listTuitionText, "RM 18,600");
    assert.equal(researchMaster?.tuitionAmount, 18600);
    assert.equal(phdOyagsb?.officialFeeAuditStatus, "calculated-from-official-rate");
    assert.equal(phdOyagsb?.listTuitionText, "RM 34,200");
    assert.equal(edd?.listTuitionText, "RM 31,500");
    assert.equal(dba?.listTuitionText, "RM 52,920");
    assert.ok(rows.every((row) => !/\/\s*(?:semester|credit)/i.test(String(row.listTuitionText || row.tuitionDisplay || ""))));
    assert.equal(Number(researchMaster?.durationYears), 2);
    assert.equal(Number(phdOyagsb?.durationYears), 3);
    assert.match(String(phdOyagsb?.durationOfficial), /^3 years$/i);
  });

  test("overwrites unsafe placeholder university profile fields before publication", () => {
    const rows = buildUumOfficialAuditRows(audits);
    const university = buildUumUniversityRow(audits, rows, {
      slug: "universiti-utara-malaysia-uum",
      code: "UUM",
      website: "#",
      acceptNoLanguage: true,
      publicDisplayStatus: "needs-review",
      officialSourceStatus: "needs-review",
      isPublished: false,
      description: {
        en: "白名单样板院校数据",
        ms: "白名单样板院校数据",
        "zh-CN": "白名单样板院校数据",
        "zh-TW": "白名单样板院校数据"
      }
    } as any);

    assert.equal(university.website, "https://www.uum.edu.my/");
    assert.equal(university.acceptNoLanguage, false);
    assert.equal(university.publicDisplayStatus, "ready");
    assert.equal(university.officialSourceStatus, "official-verified");
    assert.equal(university.isPublished, true);
    assert.equal(university.programCount, 105);
    assert.equal(university.minIelts, 5);
    assert.equal((university.description as LocalizedText)["zh-CN"].includes("白名单"), false);
  });

  test("verifies the public university record set and rejects unarchived stale UUM rows", () => {
    const rows = buildUumOfficialAuditRows(audits).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 66
    }));
    const university = {
      ...buildUumUniversityRow(audits, rows as never),
      id: 66,
      programCount: 105,
      isPublished: true,
      publicDisplayStatus: "ready"
    } as any;

    const verification = verifyUumAllLevelPublicRecordSet(university, rows as any, rows as any);
    assert.equal(verification.importRows, 105);
    assert.equal(verification.activeSupersededRows, 0);
    assert.equal(verification.legacyVisibleRows, 0);

    const stale = {
      ...rows[0],
      id: 999,
      slug: "uum-old-bachelor-row",
      isPublished: true,
      publicDisplayStatus: "ready"
    };
    assert.throws(
      () => verifyUumAllLevelPublicRecordSet(university, rows as any, [...rows, stale] as any),
      /UUM all-level public verification failed/
    );
  });
});
