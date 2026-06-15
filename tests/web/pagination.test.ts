import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildPaginationItems } from "../../apps/web/src/utils/pagination.ts";

describe("pagination helpers", () => {
  test("keeps compact first and last page access", () => {
    assert.deepEqual(buildPaginationItems(1, 26), [1, 2, 3, "ellipsis", 26]);
    assert.deepEqual(buildPaginationItems(13, 26), [1, "ellipsis", 12, 13, 14, "ellipsis", 26]);
    assert.deepEqual(buildPaginationItems(26, 26), [1, "ellipsis", 24, 25, 26]);
  });

  test("avoids ellipsis for short page ranges and clamps invalid input", () => {
    assert.deepEqual(buildPaginationItems(2, 4), [1, 2, 3, 4]);
    assert.deepEqual(buildPaginationItems(0, 0), [1]);
    assert.deepEqual(buildPaginationItems(99, 3), [1, 2, 3]);
  });
});
