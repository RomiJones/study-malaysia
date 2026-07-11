import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  feeReviewFrontendRisk,
  qualityIssueFrontendRisk,
  qualityRiskTagType
} from "../../apps/admin/src/utils/qualityRisk.ts";

describe("admin quality frontend risk helpers", () => {
  test("maps missing fee source to budget filtering risk", () => {
    const risk = qualityIssueFrontendRisk({ ruleId: "R002", entityType: "program", fieldPath: "officialFeeSourceUrl" });

    assert.equal(risk.title, "专业费用缺少官方来源");
    assert.equal(risk.ability, "预算筛选");
    assert.ok(risk.summary.includes("专业列表学费不能作为可信预算筛选依据"));
    assert.ok(risk.pages.includes("专业列表"));
    assert.ok(risk.pages.includes("推荐"));
    assert.equal(qualityRiskTagType(risk), "danger");
  });

  test("maps ready university source issue to public credibility risk", () => {
    const risk = qualityIssueFrontendRisk({ ruleId: "R001", entityType: "university", fieldPath: "officialSources" });

    assert.equal(risk.title, "Ready 院校缺少官方来源");
    assert.equal(risk.ability, "公开可信度");
    assert.ok(risk.pages.includes("首页卡片"));
    assert.ok(risk.pages.includes("院校详情"));
  });

  test("maps localized name issue to multilingual leakage risk", () => {
    const risk = qualityIssueFrontendRisk({ ruleId: "R005", entityType: "program", fieldPath: "name" });

    assert.equal(risk.title, "多语言名称缺失");
    assert.equal(risk.ability, "多语言展示");
    assert.ok(risk.summary.includes("混入中文"));
    assert.ok(risk.pages.includes("专业详情弹窗"));
  });

  test("maps fee review issue types to the highest impact risk", () => {
    const risk = feeReviewFrontendRisk(["unverified", "missing_source"]);

    assert.equal(risk.title, "专业费用缺少官方来源");
    assert.equal(risk.severity, "high");
  });
});
