import { describe, expect, it } from "vitest";

import { scoreMerges } from ".";

const labels = {
  sameConcept: [["battery capacity", "battery size"]] as [string, string][],
  differentConcept: [["screen size", "screen resolution"]] as [string, string][],
};

describe("scoreMerges", () => {
  it("counts a pair that shares a column as merged", () => {
    const keys = new Map([
      ["battery capacity", "battery capacity"],
      ["battery size", "battery capacity"],
      ["screen size", "screen size"],
      ["screen resolution", "screen resolution"],
    ]);

    expect(scoreMerges(keys, labels)).toEqual({
      sameTotal: 1,
      sameMerged: 1,
      differentTotal: 1,
      differentApart: 1,
    });
  });

  it("lowers the score of a pair kept apart that should merge, and of one merged that should not", () => {
    const keys = new Map([
      ["battery capacity", "battery capacity"],
      ["battery size", "battery size"],
      ["screen size", "screen size"],
      ["screen resolution", "screen size"],
    ]);

    expect(scoreMerges(keys, labels)).toEqual({
      sameTotal: 1,
      sameMerged: 0,
      differentTotal: 1,
      differentApart: 0,
    });
  });

  it("ignores a pair the run never produced both sides of", () => {
    const keys = new Map([["battery capacity", "battery capacity"]]);

    expect(scoreMerges(keys, labels)).toEqual({
      sameTotal: 0,
      sameMerged: 0,
      differentTotal: 0,
      differentApart: 0,
    });
  });

  it("finds a concept however the run cased it", () => {
    const keys = new Map([
      ["Battery Capacity", "battery"],
      ["battery size", "battery"],
    ]);

    expect(scoreMerges(keys, labels).sameMerged).toBe(1);
  });
});
