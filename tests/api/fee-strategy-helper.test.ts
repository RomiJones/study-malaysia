import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  getFilterableTuitionCny,
  resolveProgramFee
} from "../../apps/api/src/common/fee-strategy.helper.ts";

describe("fee strategy helper", () => {
  test("returns annual CNY as filterable value for matched official fees", () => {
    const result = resolveProgramFee({
      officialTuitionMYR: 62000,
      officialFeeAuditStatus: "matched-official",
      annualTuitionCny: 48050,
      tuitionDisplay: "RM 62,000 total tuition"
    });

    assert.equal(result.filterableTuitionCny, 48050);
    assert.equal(result.hasVerifiedFee, true);
    assert.equal(result.confidence, "verified");
    assert.equal(result.displayText, "RM 62,000 total tuition");
  });

  test("supports fee-sheet-verified status and falls back from official MYR total", () => {
    const result = resolveProgramFee({
      officialTuitionMYR: 38000,
      officialFeeAuditStatus: "fee-sheet-verified",
      durationYears: 2,
      tuitionDisplay: null
    });

    assert.equal(result.filterableTuitionCny, 29450);
    assert.equal(result.hasVerifiedFee, true);
    assert.equal(result.confidence, "verified");
    assert.equal(result.displayText, "RM 38,000");
  });

  test("supports calculated-from-official-rate as a filterable status", () => {
    const result = resolveProgramFee({
      officialFeeAuditStatus: "calculated-from-official-rate",
      annualTuitionCny: 52000
    });

    assert.equal(result.filterableTuitionCny, 52000);
    assert.equal(result.hasVerifiedFee, true);
    assert.equal(result.confidence, "verified");
  });

  test("does not filter pending-review fees even when legacy annual tuition exists", () => {
    const result = resolveProgramFee({
      officialFeeAuditStatus: "pending-review",
      annualTuitionCny: 50000,
      tuitionDisplay: "Fee pending review"
    });

    assert.equal(result.filterableTuitionCny, null);
    assert.equal(getFilterableTuitionCny({ officialFeeAuditStatus: "pending-review", annualTuitionCny: 50000 }), null);
    assert.equal(result.hasVerifiedFee, false);
    assert.equal(result.confidence, "display-only");
    assert.equal(result.displayText, "Fee pending review");
  });

  test("does not filter legacy data without a fee audit status", () => {
    const result = resolveProgramFee({
      officialFeeAuditStatus: null,
      annualTuitionCny: 50000
    });

    assert.equal(result.filterableTuitionCny, null);
    assert.equal(result.hasVerifiedFee, false);
    assert.equal(result.confidence, "unavailable");
    assert.equal(result.displayText, "CNY 50,000 / year");
  });

  test("keeps display-only statuses out of numeric budget filtering", () => {
    for (const status of ["official-approximate", "official-rate-verified", "official-non-scalar", "not-published"]) {
      const result = resolveProgramFee({
        officialFeeAuditStatus: status,
        annualTuitionCny: 50000,
        tuitionDisplay: "Refer to official fee schedule"
      });

      assert.equal(result.filterableTuitionCny, null);
      assert.equal(result.hasVerifiedFee, false);
      assert.equal(result.confidence, "display-only");
    }
  });
});
