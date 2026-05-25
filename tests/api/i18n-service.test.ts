import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { I18nController } from "../../apps/api/src/i18n/i18n.controller.ts";
import { I18nService } from "../../apps/api/src/i18n/i18n.service.ts";

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    role: "student",
    method: "email",
    account: "student@example.com",
    passwordHash: "hash",
    displayName: "Student",
    preferredLocale: "zh-CN",
    localePreferenceSource: "default",
    localePreferenceUpdatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

function createRepository(initialUser: any = createUser()) {
  let user = initialUser;
  return {
    findOne: async ({ where }: { where: { id: number } }) => (user && user.id === where.id ? user : null),
    save: async (payload: any) => {
      user = {
        ...payload,
        updatedAt: new Date("2026-05-25T04:00:00.000Z")
      };
      return user;
    },
    get user() {
      return user;
    }
  };
}

function getExceptionResponse(error: unknown) {
  assert.ok(error instanceof BadRequestException || error instanceof NotFoundException);
  return error.getResponse() as Record<string, any>;
}

describe("i18n API service and controller", () => {
  test("exposes language switcher and header navigation contracts", () => {
    const service = new I18nService(createRepository() as any);
    const controller = new I18nController(service);

    const result = controller.options("en-US") as any;

    assert.equal(result.switcher.currentLocale, "en");
    assert.equal(result.preference.locale, "en");
    assert.equal(result.preference.source, "browser");
    assert.equal(result.preference.persisted, false);
    assert.equal(result.switcher.options.length, 4);
    assert.equal(result.navigation.items.some((item: any) => item.id === "universities"), true);
    assert.equal(result.request.header, "x-studymy-locale");
    assert.equal(result.request.queryParam, "locale");
  });

  test("switches device locale while preserving a safe route", () => {
    const service = new I18nService(createRepository() as any);

    const result = service.switchLocale({
      locale: "zh-HK",
      source: "header",
      currentRoutePath: "/universities/universiti-malaya-um?tab=master",
      preserveRoute: true
    }) as any;

    assert.equal(result.status, "fallback-applied");
    assert.equal(result.preference.locale, "zh-TW");
    assert.equal(result.preference.persistenceScope, "device");
    assert.equal(result.preference.persisted, false);
    assert.equal(result.switchSource, "header");
    assert.equal(result.preservedRoutePath, "/universities/universiti-malaya-um?tab=master");
    assert.equal(result.options.length, 4);
  });

  test("rejects unsupported locale and unsafe routes with localized error payloads", () => {
    const service = new I18nService(createRepository() as any);

    assert.throws(
      () => service.switchLocale({ locale: "fr" }),
      (error) => {
        const response = getExceptionResponse(error);
        assert.equal(response.code, "UNSUPPORTED_LOCALE");
        assert.equal(response.message["zh-CN"], "不支持的语言，请选择 zh-CN、zh-TW、en 或 ms。");
        assert.deepEqual(response.details.supportedLocales, ["en", "ms", "zh-CN", "zh-TW"]);
        return true;
      }
    );

    assert.throws(
      () => service.switchLocale({ locale: "en", currentRoutePath: "https://example.com" }),
      (error) => {
        const response = getExceptionResponse(error);
        assert.equal(response.code, "INVALID_ROUTE_PATH");
        assert.equal(response.message.en, "Route path must be a safe relative path.");
        return true;
      }
    );
  });

  test("persists authenticated user locale preference", async () => {
    const repository = createRepository();
    const service = new I18nService(repository as any);

    const saved = await service.saveUserPreference(7, {
      locale: "ms-MY",
      source: "account-settings",
      preserveRoute: false
    }) as any;
    const preference = await service.getUserPreference(7);

    assert.equal(saved.status, "fallback-applied");
    assert.equal(saved.preference.locale, "ms");
    assert.equal(saved.preference.persistenceScope, "user-account");
    assert.equal(saved.preference.persisted, true);
    assert.equal(saved.preference.updatedAt, repository.user.localePreferenceUpdatedAt.toISOString());
    assert.equal(repository.user.preferredLocale, "ms");
    assert.equal(repository.user.localePreferenceSource, "user-account");
    assert.equal(preference.locale, "ms");
    assert.equal(preference.source, "user-account");
    assert.equal(preference.persisted, true);
  });

  test("reports missing users and invalid switch sources through API errors", async () => {
    const service = new I18nService(createRepository(null) as any);

    await assert.rejects(
      () => service.getUserPreference(99),
      (error) => {
        const response = getExceptionResponse(error);
        assert.equal(response.code, "USER_NOT_FOUND");
        assert.equal(response.message["zh-CN"], "用户不存在。");
        return true;
      }
    );

    await assert.rejects(
      () => service.saveUserPreference(99, { locale: "en", source: "footer" }),
      (error) => {
        const response = getExceptionResponse(error);
        assert.equal(response.code, "INVALID_SOURCE");
        assert.deepEqual(response.details.supportedSources, ["header", "mobile-menu", "account-settings", "system"]);
        return true;
      }
    );
  });
});
