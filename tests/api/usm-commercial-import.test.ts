import "reflect-metadata";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildUsmCommercialRows,
  DEFAULT_USM_COMMERCIAL_SOURCE_PATH,
  summarizeUsmCommercialRows,
  validateUsmCommercialSource,
  type CommercialSource
} from "../../apps/api/src/db/import-usm-undergraduate-commercial.ts";

const source = JSON.parse(
  readFileSync(DEFAULT_USM_COMMERCIAL_SOURCE_PATH, "utf8")
) as CommercialSource;

describe("USM undergraduate commercial publication", () => {
  test("keeps the canonical official catalogue complete and reproducible", () => {
    const rows = buildUsmCommercialRows(source);

    assert.deepEqual(validateUsmCommercialSource(source), []);
    assert.deepEqual(summarizeUsmCommercialRows(rows), {
      rows: 63,
      uniqueCodes: 63,
      uniqueSlugs: 63,
      published: 63,
      ready: 63,
      officialVerified: 63,
      feeMatched: 63,
      localized: 63
    });
    assert.equal(source.programmes.filter((item) => item.intakeMonths.includes("March")).length, 9);
    assert.equal(source.programmes.filter((item) => item.offshore).length, 4);
    assert.equal(source.programmes.filter((item) => item.mediumInstruction === "Malay").length, 3);
    assert.ok(rows.every((row) => String(row.slug).length <= 120));
  });

  test("requires complete evidence, fees, names, careers and four-language display fields", () => {
    const rows = buildUsmCommercialRows(source);

    assert.ok(source.programmes.every((item) =>
      item.nameEnOfficial
      && item.nameMs
      && item.nameMs !== item.nameEnOfficial
      && item.generalRequirementEn
      && item.highSchoolRequirementEn
      && item.alternativeQualificationRequirementEn
      && item.totalTuitionUSD > 0
      && item.careersEn.length > 0
    ));
    assert.ok(rows.every((row) => {
      const fields = [row.name, row.faculty, row.description, row.requirement?.note, row.applicationDocs, row.curriculum, row.careers, row.specializations];
      return fields.every((field) => {
        const localized = field as Record<string, unknown>;
        return ["en", "ms", "zh-CN", "zh-TW"].every((locale) => Array.isArray(localized?.[locale])
          ? true
          : Boolean(localized?.[locale]));
      });
    }));
  });

  test("retains official conflict decisions and exact decimal tuition totals", () => {
    const byCode = new Map(source.programmes.map((item) => [item.code, item]));

    assert.equal(byCode.get("US6524001")?.nameEnOfficial, "Bachelor of Chemical Engineering with Honours");
    assert.equal(byCode.get("US6545003")?.nameEnOfficial, "Bachelor of Applied Science in Medical Physics with Honours");
    assert.equal(byCode.get("US6581002")?.nameEnOfficial, "Bachelor of Urban and Regional Planning (Honours)");
    assert.equal(byCode.get("US6545002")?.nameEnOfficial, "Bachelor of Applied Science in Industrial Chemistry with Honours");
    assert.equal(byCode.get("US6212001")?.totalTuitionUSD, 10937.5);
    assert.equal(byCode.get("US6345001")?.tuitionPerSemesterUSD, 2285.71);
    assert.match(byCode.get("US6526001")?.feeNote || "", /retained without recalculation/);
  });

  test("uses official specialization translations instead of career labels", () => {
    const rows = buildUsmCommercialRows(source);
    const management = rows.find((row) => row.code === "US6345001");
    const specializations = management?.specializations as Record<string, string[]>;

    assert.deepEqual(specializations.en, [
      "Finance",
      "International Business",
      "Marketing",
      "Operations Management",
      "Strategy and Organisational Management",
      "Islamic Finance",
      "Business Analytics"
    ]);
    assert.equal(specializations["zh-CN"][0], "金融");
    assert.equal(specializations.ms[0], "Kewangan");
    assert.ok(specializations["zh-CN"].every((item) => !item.startsWith("官方职业方向")));
  });

});
