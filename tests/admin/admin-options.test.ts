import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createSourceLink,
  dictionaryOptions,
  formatLineList,
  hasSourceUrl,
  isValidUrl,
  normalizeNullableDate,
  normalizeSourceLinks,
  optionLabel,
  parseLineList,
  statusTagType
} from "../../apps/admin/src/utils/adminOptions.ts";

describe("admin form option helpers", () => {
  test("uses enabled dictionary items before default options", () => {
    const options = dictionaryOptions([
      { dictType: "program_category", code: "law", label: "法学", status: "disabled", sortOrder: 1 },
      { dictType: "program_category", code: "ai", label: "人工智能", status: "enabled", sortOrder: 2 },
      { dictType: "program_category", code: "data", label: "数据科学", status: "enabled", sortOrder: 1 }
    ], "program_category");

    assert.deepEqual(options, [
      { label: "数据科学", value: "data" },
      { label: "人工智能", value: "ai" }
    ]);
    assert.equal(optionLabel(options, "ai"), "人工智能");
    assert.equal(optionLabel(options, "unknown"), "unknown");
  });

  test("normalizes key form fields for source links and line lists", () => {
    assert.deepEqual(parseLineList("passport, transcript\nphoto"), ["passport", "transcript", "photo"]);
    assert.equal(formatLineList(["passport", "", "photo"]), "passport\nphoto");
    assert.deepEqual(createSourceLink("official-verified"), {
      title: "",
      url: "",
      sourceType: "other",
      verifiedAt: null,
      status: "official-verified",
      note: ""
    });

    const links = normalizeSourceLinks([
      { title: "Official page", url: "https://example.edu/program", sourceType: "profile", status: "official-verified" },
      { note: "Needs manual review" },
      null
    ]);

    assert.equal(links.length, 2);
    assert.equal(hasSourceUrl(links), true);
    assert.equal(isValidUrl("https://example.edu/program"), true);
    assert.equal(isValidUrl("ftp://example.edu/program"), false);
    assert.equal(normalizeNullableDate("2026-05-22"), "2026-05-22");
    assert.equal(normalizeNullableDate(""), null);
  });

  test("maps status values to Element Plus tag types", () => {
    assert.equal(statusTagType("ready"), "success");
    assert.equal(statusTagType("pending-review"), "warning");
    assert.equal(statusTagType("source-conflict"), "danger");
    assert.equal(statusTagType(null), "info");
  });
});
