import { describe, expect, it } from "vitest";

import { matchFacts } from ".";

const battery = { concept: "battery capacity", value: "5100 мАг" };
const size = { concept: "dimensions", value: "154.94 x 73.66 x 10.16 мм" };
const chip = { concept: "processor", value: "Google Tensor" };

describe("matchFacts", () => {
  it("finds a labelled number however the unit is worded", () => {
    expect(matchFacts([battery], [{ value: "5100", unit: "mAh" }]).found).toEqual([battery]);
  });

  it("needs every number of a size", () => {
    expect(matchFacts([size], [{ value: "154.94 x 73.66" }]).missing).toEqual([size]);
    expect(matchFacts([size], [{ value: "154,94 x 73,66 x 10,16 mm" }]).found).toEqual([size]);
  });

  it("matches a value without numbers on its words", () => {
    expect(matchFacts([chip], [{ value: "google tensor g4" }]).found).toEqual([chip]);
    expect(matchFacts([chip], [{ value: "Tensor" }]).missing).toEqual([chip]);
  });

  it("reports what no fact states", () => {
    expect(matchFacts([battery, chip], [{ value: "5100" }])).toEqual({
      found: [battery],
      missing: [chip],
    });
  });
});
