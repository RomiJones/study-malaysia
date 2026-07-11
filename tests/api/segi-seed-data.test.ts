import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { segi2026ProgramFees, segiOfficialProgramPages } from "../../apps/api/src/db/import-segi-2026-fee-sheet.ts";

describe("SEGi 2026 fee sheet seed data", () => {
  test("covers all supported degree programmes from the provided 2026 fee sheet", () => {
    assert.equal(segi2026ProgramFees.length, 49);
    assert.equal(segi2026ProgramFees.filter((program) => program.level === "bachelor").length, 27);
    assert.equal(segi2026ProgramFees.filter((program) => program.level === "master").length, 17);
    assert.equal(segi2026ProgramFees.filter((program) => program.level === "phd").length, 5);

    const expected = new Map([
      ["SEGI-BBM", 94558.7],
      ["SEGI-BCS", 102376.2],
      ["SEGI-BIT", 94558.7],
      ["SEGI-MBBS", 419864],
      ["SEGI-BDS", 423012.2],
      ["SEGI-MBA", 59916],
      ["SEGI-MSC-MGMT", 60534.4],
      ["SEGI-DRBA", 90085.5]
    ]);

    for (const [code, amount] of expected) {
      const program = segi2026ProgramFees.find((item) => item.code === code);
      assert.ok(program, `${code} should be present`);
      assert.equal(program.totalMYR, amount);
    }

    assert.ok(segi2026ProgramFees.every((program) => program.totalMYR > 0));
    assert.ok(segi2026ProgramFees.every((program) => program.intakeMonths.length > 0));
  });

  test("maps every public SEGi degree programme to an official programme detail page", () => {
    assert.equal(Object.keys(segiOfficialProgramPages).length, 49);

    for (const program of segi2026ProgramFees) {
      const source = segiOfficialProgramPages[program.code];
      assert.ok(source, `${program.code} should have an official source page`);
      assert.match(source.url, /^https:\/\/university\.segi\.edu\.my\/course\//);
      assert.doesNotMatch(source.url, /世纪大学学费单2026\.pdf|\/Users\//);
    }
  });
});
