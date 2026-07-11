import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_I18N_FIELD_OPTIONS,
  catalogI18nFieldLabel,
  catalogI18nFrontendRisk,
  catalogI18nIssueRoute,
  catalogI18nRiskTagType,
  normalizeCatalogI18nReport
} from "../../apps/admin/src/utils/catalogI18nGovernance.ts";

describe("admin catalog i18n governance helpers", () => {
  test("covers the required university and program business fields", () => {
    const values = new Set(CATALOG_I18N_FIELD_OPTIONS.map((option) => option.value));

    for (const value of [
      "university.name",
      "university.description",
      "university.highlights",
      "university.facilities",
      "university.location",
      "university.region",
      "program.name",
      "program.description",
      "program.faculty",
      "program.applicationDocs",
      "program.curriculum",
      "program.careers",
      "program.specializations",
      "program.requirement.note"
    ]) {
      assert.ok(values.has(value), `${value} should be covered`);
    }
  });

  test("maps CJK leakage to frontend language consistency risk", () => {
    const risk = catalogI18nFrontendRisk({
      entityType: "program",
      field: "faculty",
      locale: "en",
      code: "non-cjk-locale-has-cjk-content",
      publicDisplayStatus: "ready"
    });

    assert.equal(risk.title, "英文/马来文字段中文泄漏");
    assert.equal(risk.ability, "语言一致性");
    assert.equal(risk.severity, "high");
    assert.ok(risk.pages.includes("专业列表"));
    assert.equal(catalogI18nRiskTagType(risk), "danger");
  });

  test("normalizes coverage reports and localized messages", () => {
    const report = normalizeCatalogI18nReport({
      summary: {
        scanned: { universities: 1, programs: 2, total: 3 },
        issues: {
          total: 1,
          returned: 1,
          byCode: { "missing-locale": 1 },
          byLocale: { ms: 1 },
          byEntityType: { university: 1 }
        },
        completeRecords: { universities: 0, programs: 2, total: 2 }
      },
      issues: [
        {
          entityType: "university",
          entityId: 7,
          slug: "um",
          field: "name",
          locale: "ms",
          code: "missing-locale",
          message: { "zh-CN": "name (ms) 缺少必要的多语言内容。" },
          publicDisplayStatus: "ready",
          isPublished: true
        }
      ]
    });

    assert.equal(report.summary.scanned.total, 3);
    assert.equal(report.summary.issues.byCode["missing-locale"], 1);
    assert.equal(report.summary.issues.byCode["invalid-localized-shape"], 0);
    assert.equal(report.issues[0].message, "name (ms) 缺少必要的多语言内容。");
    assert.equal(catalogI18nFieldLabel(report.issues[0]), "学校名称");
  });

  test("builds repair routes for university and program edit dialogs", () => {
    assert.deepEqual(catalogI18nIssueRoute({ entityType: "university", entityId: 3, field: "description" }), {
      path: "/universities",
      query: { editId: 3, focus: "description" }
    });
    assert.deepEqual(catalogI18nIssueRoute({ entityType: "program", entityId: 12, field: "requirement.note" }), {
      path: "/programs",
      query: { editId: 12, focus: "requirement.note" }
    });
  });
});
