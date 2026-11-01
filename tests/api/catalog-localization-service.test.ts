import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AdminAuthGuard } from "../../apps/api/src/common/guards.ts";
import { CatalogLocalizationController } from "../../apps/api/src/i18n/catalog-localization.controller.ts";
import { CatalogLocalizationService } from "../../apps/api/src/i18n/catalog-localization.service.ts";

function text(en: string, ms = en, zhCN = en, zhTW = zhCN) {
  return { en, ms, "zh-CN": zhCN, "zh-TW": zhTW };
}

function list(en: string[] = [], ms = en, zhCN = en, zhTW = zhCN) {
  return { en, ms, "zh-CN": zhCN, "zh-TW": zhTW };
}

function university(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "universiti-malaya-um",
    code: "UM",
    name: text("Universiti Malaya", "Universiti Malaya", "\u9a6c\u6765\u4e9a\u5927\u5b66", "\u99ac\u4f86\u4e9e\u5927\u5b78"),
    location: text("Kuala Lumpur", "Kuala Lumpur", "\u5409\u9686\u5761", "\u5409\u9686\u5761"),
    region: text("Kuala Lumpur", "Kuala Lumpur", "\u5409\u9686\u5761", "\u5409\u9686\u5761"),
    description: text("Research university", "Universiti penyelidikan", "\u7814\u7a76\u578b\u5927\u5b66", "\u7814\u7a76\u578b\u5927\u5b78"),
    facilities: list(["Library"], ["Perpustakaan"], ["\u56fe\u4e66\u9986"], ["\u5716\u66f8\u9928"]),
    highlights: list(["QS Top 100"], ["QS Top 100"], ["QS \u767e\u5f3a"], ["QS \u767e\u5f37"]),
    applicationDocuments: list(),
    chinaStudentRequirements: list(),
    publicDisplayStatus: "ready",
    isPublished: true,
    ...overrides
  };
}

function program(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    slug: "um-master-information-technology",
    code: "UM-MIT",
    name: text("Master of Information Technology", "Sarjana Teknologi Maklumat", "\u4fe1\u606f\u6280\u672f\u7855\u58eb", "\u8cc7\u8a0a\u79d1\u6280\u78a9\u58eb"),
    faculty: text("Faculty of Computer Science", "Fakulti Sains Komputer", "\u8ba1\u7b97\u673a\u5b66\u9662", "\u8a08\u7b97\u6a5f\u5b78\u9662"),
    description: text("Official program description", "Penerangan program rasmi", "\u5b98\u65b9\u4e13\u4e1a\u4ecb\u7ecd", "\u5b98\u65b9\u5c08\u696d\u4ecb\u7d39"),
    requirement: {
      note: text("Bachelor degree required", "Ijazah sarjana muda diperlukan", "\u9700\u8981\u672c\u79d1\u5b66\u4f4d", "\u9700\u8981\u672c\u79d1\u5b78\u4f4d")
    },
    applicationDocs: list(["Passport"], ["Pasport"], ["\u62a4\u7167"], ["\u8b77\u7167"]),
    curriculum: list(),
    careers: list(),
    specializations: list(),
    publicDisplayStatus: "ready",
    isPublished: true,
    ...overrides
  };
}

function repository<T extends { isPublished: boolean; publicDisplayStatus: string }>(items: T[]) {
  return {
    find: async (options?: { where?: Partial<T> }) => {
      if (options?.where?.isPublished === true && options.where.publicDisplayStatus === "ready") {
        return items.filter((item) => item.isPublished && item.publicDisplayStatus === "ready");
      }
      return items;
    }
  };
}

function getExceptionResponse(error: unknown) {
  assert.ok(error instanceof BadRequestException);
  return error.getResponse() as Record<string, any>;
}

describe("catalog localization API service", () => {
  test("reports missing locales and CJK leakage for public university and program data", async () => {
    const service = new CatalogLocalizationService(
      repository([
        university({ description: text("\u9a6c\u6765\u4e9a\u5927\u5b66", "Universiti penyelidikan", "\u7814\u7a76\u578b\u5927\u5b66", "\u7814\u7a76\u578b\u5927\u5b78") }),
        university({ id: 2, slug: "hidden", isPublished: false, publicDisplayStatus: "hidden-unverified" })
      ]) as any,
      repository([
        program({
          name: text("Master of Information Technology", "", "\u4fe1\u606f\u6280\u672f\u7855\u58eb", "\u8cc7\u8a0a\u79d1\u6280\u78a9\u58eb"),
          faculty: text("\u8ba1\u7b97\u673a\u5b66\u9662", "Fakulti Sains Komputer", "\u8ba1\u7b97\u673a\u5b66\u9662", "\u8a08\u7b97\u6a5f\u5b78\u9662")
        })
      ]) as any
    );

    const report = await service.getCoverageReport({ limit: "20" });

    assert.equal(report.contract.endpoint, "/i18n/catalog-localization/coverage");
    assert.ok(report.contract.query.field.includes("university.name"));
    assert.ok(report.contract.query.field.includes("program.requirement.note"));
    assert.ok(report.contract.query.publicDisplayStatus.includes("hidden-unverified"));
    assert.equal(report.query.entityType, "all");
    assert.equal(report.summary.scanned.universities, 1);
    assert.equal(report.summary.scanned.programs, 1);
    assert.equal(report.summary.issues.total, 3);
    assert.equal(report.summary.issues.byCode["missing-locale"], 1);
    assert.equal(report.summary.issues.byCode["non-cjk-locale-has-cjk-content"], 2);
    assert.equal(report.summary.issues.byLocale.en, 2);
    assert.equal(report.summary.issues.byLocale.ms, 1);
    assert.equal(report.summary.completeRecords.total, 0);
    assert.deepEqual(
      report.issues.map((issue) => `${issue.entityType}:${issue.field}:${issue.locale}:${issue.code}`).sort(),
      [
        "program:faculty:en:non-cjk-locale-has-cjk-content",
        "program:name:ms:missing-locale",
        "university:description:en:non-cjk-locale-has-cjk-content"
      ]
    );
  });

  test("supports entity, locale, field, public status, hidden-record and limit query controls", async () => {
    const service = new CatalogLocalizationService(
      repository([university()]) as any,
      repository([
        program({ id: 12, slug: "hidden-program", isPublished: false, publicDisplayStatus: "hidden-unverified", faculty: text("\u8ba1\u7b97\u673a\u5b66\u9662") })
      ]) as any
    );

    const report = await service.getCoverageReport({
      entityType: "program",
      locale: "en",
      field: "program.faculty",
      publicDisplayStatus: "hidden-unverified",
      includeHidden: "true",
      limit: "1"
    });

    assert.equal(report.query.entityType, "program");
    assert.equal(report.query.locale, "en");
    assert.equal(report.query.field, "program.faculty");
    assert.equal(report.query.publicDisplayStatus, "hidden-unverified");
    assert.equal(report.query.includeHidden, true);
    assert.equal(report.summary.scanned.universities, 0);
    assert.equal(report.summary.scanned.programs, 1);
    assert.equal(report.summary.issues.total, 1);
    assert.equal(report.summary.issues.returned, 1);
    assert.equal(report.issues[0].slug, "hidden-program");
  });

  test("skips nullable optional localized fields without marking records incomplete", async () => {
    const service = new CatalogLocalizationService(
      repository([university({ applicationDocuments: null, chinaStudentRequirements: null })]) as any,
      repository([]) as any
    );

    const report = await service.getCoverageReport({ entityType: "university" });

    assert.equal(report.summary.scanned.universities, 1);
    assert.equal(report.summary.issues.total, 0);
    assert.equal(report.summary.completeRecords.universities, 1);
  });

  test("reports missing locales for non-empty optional localized arrays", async () => {
    const service = new CatalogLocalizationService(
      repository([
        university({
          facilities: { en: [], ms: [], "zh-CN": ["\u56fe\u4e66\u9986"], "zh-TW": [] }
        })
      ]) as any,
      repository([]) as any
    );

    const report = await service.getCoverageReport({ entityType: "university", limit: "10" });

    assert.equal(report.summary.issues.total, 3);
    assert.equal(report.summary.issues.byCode["missing-locale"], 3);
    assert.equal(report.summary.completeRecords.universities, 0);
    assert.deepEqual(
      report.issues.map((issue) => `${issue.field}:${issue.locale}:${issue.code}`).sort(),
      [
        "facilities:en:missing-locale",
        "facilities:ms:missing-locale",
        "facilities:zh-TW:missing-locale"
      ]
    );
  });

  test("reports invalid shape for optional localized arrays with unsupported locale keys", async () => {
    const service = new CatalogLocalizationService(
      repository([
        university({
          facilities: { foo: ["Library"] }
        })
      ]) as any,
      repository([]) as any
    );

    const report = await service.getCoverageReport({ entityType: "university", limit: "10" });

    assert.equal(report.summary.issues.total, 4);
    assert.equal(report.summary.issues.byCode["invalid-localized-shape"], 4);
    assert.equal(report.summary.completeRecords.universities, 0);
    assert.deepEqual(
      report.issues.map((issue) => `${issue.field}:${issue.locale}:${issue.code}`).sort(),
      [
        "facilities:en:invalid-localized-shape",
        "facilities:ms:invalid-localized-shape",
        "facilities:zh-CN:invalid-localized-shape",
        "facilities:zh-TW:invalid-localized-shape"
      ]
    );
  });

  test("skips optional localized arrays when every locale is empty", async () => {
    const service = new CatalogLocalizationService(
      repository([
        university({
          facilities: list([], [], [], [])
        })
      ]) as any,
      repository([]) as any
    );

    const report = await service.getCoverageReport({ entityType: "university" });

    assert.equal(report.summary.issues.total, 0);
    assert.equal(report.summary.completeRecords.universities, 1);
  });

  test("reports invalid locale value shape for non-empty optional localized arrays", async () => {
    const service = new CatalogLocalizationService(
      repository([
        university({
          applicationDocuments: { en: "Passport", ms: [], "zh-CN": [], "zh-TW": [] }
        })
      ]) as any,
      repository([]) as any
    );

    const report = await service.getCoverageReport({ entityType: "university", locale: "en", limit: "10" });

    assert.equal(report.summary.issues.total, 1);
    assert.equal(report.summary.issues.byCode["invalid-localized-shape"], 1);
    assert.equal(report.summary.completeRecords.universities, 0);
    assert.deepEqual(report.issues.map((issue) => `${issue.field}:${issue.locale}:${issue.code}`), [
      "applicationDocuments:en:invalid-localized-shape"
    ]);
  });

  test("reports non-null optional fields when they are not localized payloads", async () => {
    const service = new CatalogLocalizationService(
      repository([university({ applicationDocuments: ["Passport"], chinaStudentRequirements: null })]) as any,
      repository([]) as any
    );

    const report = await service.getCoverageReport({ entityType: "university", limit: "10" });

    assert.equal(report.summary.issues.total, 4);
    assert.equal(report.summary.issues.byCode["invalid-localized-shape"], 4);
    assert.equal(report.summary.completeRecords.universities, 0);
    assert.deepEqual(new Set(report.issues.map((issue) => issue.field)), new Set(["applicationDocuments"]));
  });

  test("rejects unsupported query values with structured localized errors", async () => {
    const service = new CatalogLocalizationService(repository([]) as any, repository([]) as any);

    await assert.rejects(
      () => service.getCoverageReport({ entityType: "school" }),
      (error) => {
        const response = getExceptionResponse(error);
        assert.equal(response.code, "INVALID_ENTITY_TYPE");
        assert.deepEqual(response.details.supportedEntityTypes, ["all", "university", "program"]);
        assert.equal(response.message["zh-CN"], "\u4e0d\u652f\u6301\u7684\u76ee\u5f55\u591a\u8bed\u8a00\u5b9e\u4f53\u7c7b\u578b\u3002");
        return true;
      }
    );

    await assert.rejects(
      () => service.getCoverageReport({ locale: "fr" }),
      (error) => {
        const response = getExceptionResponse(error);
        assert.equal(response.code, "INVALID_LOCALE");
        assert.deepEqual(response.details.supportedLocales, ["en", "ms", "zh-CN", "zh-TW"]);
        return true;
      }
    );

    await assert.rejects(
      () => service.getCoverageReport({ field: "program.unknown" }),
      (error) => getExceptionResponse(error).code === "INVALID_FIELD"
    );

    await assert.rejects(
      () => service.getCoverageReport({ publicDisplayStatus: "draft" }),
      (error) => getExceptionResponse(error).code === "INVALID_PUBLIC_DISPLAY_STATUS"
    );

    await assert.rejects(
      () => service.getCoverageReport({ includeHidden: "yes" }),
      (error) => getExceptionResponse(error).code === "INVALID_INCLUDE_HIDDEN"
    );

    await assert.rejects(
      () => service.getCoverageReport({ limit: "201" }),
      (error) => getExceptionResponse(error).code === "INVALID_LIMIT"
    );
  });

  test("controller exposes contract and delegates coverage query", async () => {
    const calls: unknown[] = [];
    const controller = new CatalogLocalizationController({
      getContract: () => ({ endpoint: "/i18n/catalog-localization/coverage" }),
      getCoverageReport: async (query: unknown) => {
        calls.push(query);
        return { summary: { scanned: { total: 0 } } };
      }
    } as any);

    assert.deepEqual(controller.contract(), { endpoint: "/i18n/catalog-localization/coverage" });
    assert.deepEqual(await controller.coverage({ entityType: "program", locale: "en" }), {
      summary: { scanned: { total: 0 } }
    });
    assert.deepEqual(calls, [{ entityType: "program", locale: "en" }]);
  });

  test("coverage endpoint requires admin authentication before hidden records can be queried", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, CatalogLocalizationController.prototype.coverage);

    assert.ok(Array.isArray(guards));
    assert.ok(guards.includes(AdminAuthGuard));
  });
});
