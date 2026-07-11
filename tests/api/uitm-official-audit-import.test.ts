import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUitmOfficialAuditRows,
  buildUitmUniversityRow,
  DEFAULT_UITM_DOCTORAL_AUDIT_PATH,
  DEFAULT_UITM_MASTER_AUDIT_PATH,
  DEFAULT_UITM_UNDERGRADUATE_AUDIT_PATH,
  loadUitmReviewedAudits,
  summarizeUitmOfficialAuditImport,
  UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX,
  validateUitmReviewedAudit,
  verifyUitmAllLevelPublicRecordSet
} from "../../apps/api/src/db/import-uitm-official-audit.ts";
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

function localizedEnglishTextIsNotChinese(value: unknown) {
  return !hasChinese((value as LocalizedText | undefined)?.en || "");
}

describe("UiTM official all-level publication import", () => {
  const audits = loadUitmReviewedAudits();

  test("validates reviewed audit inputs without treating safe_to_import as approval", () => {
    assert.deepEqual(validateUitmReviewedAudit(audits.undergraduate, 164, "undergraduate"), []);
    assert.deepEqual(validateUitmReviewedAudit(audits.master, 162, "master"), []);
    assert.deepEqual(validateUitmReviewedAudit(audits.doctoral, 62, "doctoral"), []);

    assert.equal(DEFAULT_UITM_UNDERGRADUATE_AUDIT_PATH.endsWith("UiTM_audit_undergraduate_20260627_reviewed_v4.json"), true);
    assert.equal(DEFAULT_UITM_MASTER_AUDIT_PATH.endsWith("UiTM_audit_master_20260628_reviewed_v3.json"), true);
    assert.equal(DEFAULT_UITM_DOCTORAL_AUDIT_PATH.endsWith("UiTM_audit_doctoral_20260628_reviewed_v1.json"), true);
    assert.equal(audits.undergraduate.safe_to_import, false);
    assert.equal(audits.master.safe_to_import, false);
    assert.equal(audits.doctoral.safe_to_import, false);
    assert.equal(audits.master.validationMeta?.counts?.issuesPending, 0);
    assert.equal(audits.doctoral.validationMeta?.counts?.issuesPending, 0);
  });

  test("builds 388 visible UiTM rows with ready, international-unavailable and language-exception partitions", () => {
    const rows = buildUitmOfficialAuditRows(audits);
    const summary = summarizeUitmOfficialAuditImport(rows);

    assert.equal(rows.length, 388);
    assert.deepEqual(summary.byLevel, { bachelor: 164, master: 162, phd: 62 });
    assert.equal(summary.readyRows, 222);
    assert.equal(summary.notAvailableForInternationalRows, 166);
    assert.equal(summary.languageExceptionRows, 0);
    assert.equal(summary.publishedRows, 388);
    assert.equal(summary.uniqueSlugs, 388);
    assert.equal(summary.officialFeeRows, 222);
    assert.equal(summary.officialFeeNotPublishedRows, 166);
    assert.equal(summary.directIeltsRows, 225);
    assert.equal(summary.readyIeltsRows, 222);
    assert.equal(summary.chineseNameRows, 388);
    assert.equal(summary.chineseFacultyRows, 388);
    assert.equal(summary.chineseCurriculumRows, 388);
    assert.equal(summary.chineseCareerRows, 388);
    assert.equal(summary.englishPublicTextRows, 388);
    assert.equal(summary.sourceRows, 388);
    assert.deepEqual(summary.publicDisplayStatusCounts, {
      "not-available-for-international": 166,
      ready: 222
    });
    assert.ok(rows.every((row) => String(row.slug).startsWith(UITM_PUBLIC_ALL_LEVEL_SLUG_PREFIX)));
    assert.ok(rows.every((row) => hasChinese((row.name as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => !hasChinese((row.name as LocalizedText)?.en)));
    assert.ok(rows.every((row) => hasChinese((row.faculty as LocalizedText)?.["zh-CN"])));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.careers)));
    assert.ok(rows.every((row) => localizedRowsAreChinese(row.specializations)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.curriculum)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.careers)));
    assert.ok(rows.every((row) => localizedEnglishRowsAreNotChinese(row.specializations)));
    assert.ok(rows.every((row) => localizedEnglishTextIsNotChinese(row.requirement?.note)));
    assert.ok(rows.every((row) => !hasChinese(row.officialAcademicRequirement)));
    assert.ok(rows.every((row) => !hasChinese(row.durationOfficial)));
    assert.ok(rows.every((row) => !/localization pending|Refer to the official source/i.test(JSON.stringify(row.specializations))));
  });

  test("keeps UiTM publication exceptions explicit and non-ready where required", () => {
    const rows = buildUitmOfficialAuditRows(audits);
    const md786 = rows.find((row) => row.code === "UITM-MASTER-MD786");
    const am700 = rows.find((row) => row.code === "UITM-MASTER-AM700");
    const md784 = rows.find((row) => row.code === "UITM-MASTER-MD784");
    const lg950 = rows.find((row) => row.code === "UITM-PHD-LG950");
    const as950 = rows.find((row) => row.code === "UITM-PHD-AS950");
    const lt990 = rows.find((row) => row.code === "UITM-PHD-LT990");
    const cdcs702 = rows.find((row) => row.code === "UITM-MASTER-CDCS702");

    for (const row of [md786, am700]) {
      assert.ok(row);
      assert.equal(row?.publicDisplayStatus, "not-available-for-international");
      assert.equal(row?.officialSourceStatus, "official-page-verified-international-not-available");
      assert.equal(row?.officialFeeAuditStatus, "not-published");
      assert.equal(row?.officialTuitionMYR, null);
      assert.equal((row?.languageRequirement as LanguageRequirement).ielts, 0);
      assert.match(String(row?.publicDisplayNote), /不开放国际/);
    }

    assert.ok(lg950);
    assert.equal(lg950?.publicDisplayStatus, "ready");
    assert.equal(lg950?.officialFeeAuditStatus, "matched-official");
    assert.equal(lg950?.officialTuitionMYR, 50280);
    assert.equal((lg950?.languageRequirement as LanguageRequirement).ielts, 5);
    assert.equal((lg950?.languageRequirement as LanguageRequirement).muet, 3);
    assert.match(String(lg950?.publicDisplayNote), /条件型语言要求/);
    assert.match(String(lg950?.officialLanguageRequirement), /列表按国际学生最低语言门槛显示 IELTS 5\.0/);
    assert.match(String(lg950?.officialLanguageRequirement), /English major.*IELTS 6\.0/);
    assert.match(String(lg950?.officialLanguageRequirement), /其他语言方向.*IELTS 5\.0/);

    assert.equal(as950?.publicDisplayStatus, "ready");
    assert.equal(as950?.officialTuitionMYR, 50280);
    assert.equal((as950?.languageRequirement as LanguageRequirement).ielts, 5);
    assert.match(String(as950?.auditNote), /AS950/);

    assert.equal(lt990?.publicDisplayStatus, "ready");
    assert.equal(lt990?.officialTuitionMYR, 27070);
    assert.equal((lt990?.languageRequirement as LanguageRequirement).ielts, 5);
    assert.match(String(lt990?.auditNote), /MITRANS|LT990/);

    assert.ok(cdcs702);
    assert.deepEqual(cdcs702?.intakeMonths, []);
    assert.equal(cdcs702?.officialIntake, "Official source does not publish a programme-level intake month");

    assert.ok(md784);
    assert.match(String((md784?.curriculum as LocalizedStringArray)["zh-CN"].join(" ")), /四年内科学研究生临床训练/);
    assert.match(String((md784?.curriculum as LocalizedStringArray).en.join(" ")), /Four-year postgraduate training programme/);
    assert.match(String((md784?.careers as LocalizedStringArray)["zh-CN"].join(" ")), /三级医疗中心内科医生/);
    assert.match(String((md784?.careers as LocalizedStringArray).en.join(" ")), /Graduates prepared for independent practice/);

    assert.match(String((md786?.curriculum as LocalizedStringArray)["zh-CN"].join(" ")), /四年儿科专科临床训练/);
    assert.match(String((md786?.curriculum as LocalizedStringArray).en.join(" ")), /Programme highlights/);
    assert.match(String((md786?.careers as LocalizedStringArray)["zh-CN"].join(" ")), /儿科专科临床医生/);
    assert.match(String((md786?.careers as LocalizedStringArray).en.join(" ")), /advancing paediatric medicine/);

    const am700CurriculumEn = (am700?.curriculum as LocalizedStringArray).en;
    assert.match(String((am700?.curriculum as LocalizedStringArray)["zh-CN"].join(" ")), /公司问责与可持续发展/);
    assert.ok(am700CurriculumEn.length >= 4);
    assert.match(am700CurriculumEn[0], /^EMA760 Corporate Accountability and Sustainability$/);
    assert.doesNotMatch(String(am700CurriculumEn.join(" ")), /Full-time Programme Structures|Informatio$/);
    assert.match(String((lg950?.curriculum as LocalizedStringArray)["zh-CN"].join(" ")), /PhD by Research|supervised research/);
    assert.doesNotMatch(String((lg950?.careers as LocalizedStringArray).en.join(" ")), /generally support academic/i);
  });

  test("overwrites stale UiTM profile fields while keeping the all-level university visible", () => {
    const rows = buildUitmOfficialAuditRows(audits);
    const university = buildUitmUniversityRow(audits, rows, {
      slug: "universiti-teknologi-mara-uitm",
      code: "UITM",
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

    assert.equal(university.website, "https://uitm.edu.my");
    assert.equal(university.acceptNoLanguage, false);
    assert.equal(university.publicDisplayStatus, "ready");
    assert.equal(university.officialSourceStatus, "official-verified");
    assert.equal(university.isPublished, true);
    assert.equal(university.programCount, 388);
    assert.ok(Number(university.minIelts) > 0);
    assert.equal((university.description as LocalizedText)["zh-CN"].includes("本科保留为官方参考行"), true);
    assert.equal(hasChinese((university.description as LocalizedText).en), false);
  });

  test("verifies the all-level public record set and rejects unarchived stale UiTM rows", () => {
    const rows = buildUitmOfficialAuditRows(audits).map((row, index) => ({
      ...row,
      id: index + 1,
      universityId: 88
    }));
    const university = {
      ...buildUitmUniversityRow(audits, rows as never),
      id: 88,
      programCount: 388,
      isPublished: true,
      publicDisplayStatus: "ready",
      officialSourceStatus: "official-verified"
    } as any;

    const verification = verifyUitmAllLevelPublicRecordSet(university, rows as any, rows as any);
    assert.equal(verification.importRows, 388);
    assert.equal(verification.readyRows, 222);
    assert.equal(verification.notAvailableForInternationalRows, 166);
    assert.equal(verification.languageExceptionRows, 0);
    assert.equal(verification.activeSupersededRows, 0);
    assert.equal(verification.legacyVisibleRows, 0);

    const stale = {
      ...rows[0],
      id: 999,
      slug: "uitm-old-public-row",
      isPublished: true,
      publicDisplayStatus: "ready"
    };
    assert.throws(
      () => verifyUitmAllLevelPublicRecordSet(university, rows as any, [...rows, stale] as any),
      /UiTM all-level public verification failed/
    );
  });
});
