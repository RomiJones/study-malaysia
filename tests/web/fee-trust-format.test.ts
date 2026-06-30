import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  formatProgramFeeVerifiedLabel,
  formatProgramListTuition,
  formatProgramTuition,
  hasVerifiedProgramFee
} from "../../apps/web/src/utils/format.ts";

function program(overrides: Record<string, unknown> = {}) {
  return {
    publicDisplayStatus: "ready",
    durationYears: 2,
    annualTuitionCny: 50000,
    filterableTuitionCny: null,
    hasVerifiedFee: false,
    feeConfidence: "display-only",
    tuitionAmount: null,
    tuitionCurrency: "MYR",
    tuitionDisplay: "",
    officialTuitionMYR: null,
    officialFeeSourceUrl: "",
    officialFeeAuditStatus: "pending-review",
    tuitionInfo: {
      amount: null,
      currency: "MYR",
      displayText: "",
      filterableTuitionCny: null,
      officialAmountMYR: null,
      sourceUrl: null,
      auditStatus: "pending-review"
    },
    listTuitionText: "",
    ...overrides
  } as any;
}

describe("web fee trust display", () => {
  test("does not expose exact fallback tuition for unverified fees", () => {
    assert.equal(
      formatProgramTuition(program({ officialTuitionMYR: 62000 }), undefined, "zh-CN"),
      "以院校官方页面为准"
    );
  });

  test("shows exact tuition and verified badge for trusted fees", () => {
    const trusted = program({
      filterableTuitionCny: 48050,
      hasVerifiedFee: true,
      feeConfidence: "verified",
      officialTuitionMYR: 62000,
      officialFeeSourceUrl: "https://example.edu/fees",
      officialFeeAuditStatus: "fee-sheet-verified",
      tuitionInfo: {
        amount: 62000,
        currency: "MYR",
        displayText: "RM 62,000",
        filterableTuitionCny: 48050,
        officialAmountMYR: 62000,
        sourceUrl: "https://example.edu/fees",
        auditStatus: "fee-sheet-verified"
      }
    });

    assert.equal(formatProgramTuition(trusted, undefined, "zh-CN"), "RM 62,000");
    assert.equal(hasVerifiedProgramFee(trusted), true);
    assert.equal(formatProgramFeeVerifiedLabel("zh-CN"), "官方核验");
  });

  test("keeps display-only official ranges as text without marking them verified", () => {
    const displayOnly = program({
      feeConfidence: "display-only",
      tuitionDisplay: "MYR 71,490 - 86,190 total programme fee range",
      officialFeeAuditStatus: "official-non-scalar",
      officialFeeSourceUrl: "https://example.edu/fees",
      tuitionInfo: {
        amount: null,
        currency: "MYR",
        displayText: "MYR 71,490 - 86,190 total programme fee range",
        filterableTuitionCny: null,
        officialAmountMYR: null,
        sourceUrl: "https://example.edu/fees",
        auditStatus: "official-non-scalar"
      }
    });

    assert.equal(formatProgramListTuition(displayOnly, undefined, "zh-CN"), "RM 71,490 - 86,190");
    assert.equal(hasVerifiedProgramFee(displayOnly), false);
  });
});
