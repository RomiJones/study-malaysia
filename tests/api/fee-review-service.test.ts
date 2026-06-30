import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { feeReviewIssueTypes } from "../../apps/api/src/admin/fee-review.service.ts";

describe("fee review issue classification", () => {
  test("maps verified fee without source to R002 missing source", () => {
    const issueTypes = feeReviewIssueTypes({
      officialFeeAuditStatus: "fee-sheet-verified",
      officialFeeSourceUrl: "",
      officialTuitionMYR: 28000,
      tuitionCurrency: "MYR"
    });

    assert.deepEqual(issueTypes, ["missing_source"]);
  });

  test("maps pending review status to R003 pending and unverified", () => {
    const issueTypes = feeReviewIssueTypes({
      officialFeeAuditStatus: "pending-review",
      officialFeeSourceUrl: "https://example.edu/fees",
      officialTuitionMYR: null,
      tuitionCurrency: "UNKNOWN"
    });

    assert.deepEqual(issueTypes, ["pending", "unverified"]);
  });

  test("maps source conflict status to R003 conflict and unverified", () => {
    const issueTypes = feeReviewIssueTypes({
      officialFeeAuditStatus: "source-conflict",
      officialFeeSourceUrl: "https://example.edu/fees",
      officialTuitionMYR: 32000,
      tuitionCurrency: "MYR"
    });

    assert.deepEqual(issueTypes, ["conflict", "unverified"]);
  });

  test("keeps display-only official statuses out of R002 when source exists", () => {
    const issueTypes = feeReviewIssueTypes({
      officialFeeAuditStatus: "official-rate-verified",
      officialFeeSourceUrl: "https://example.edu/fees",
      officialTuitionMYR: null,
      tuitionCurrency: "UNKNOWN"
    });

    assert.deepEqual(issueTypes, ["unverified"]);
  });
});
