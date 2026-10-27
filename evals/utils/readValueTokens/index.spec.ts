import { describe, expect, it } from "vitest";

import { readValueTokens } from ".";

describe("readValueTokens", () => {
  it("reads a decimal comma and a decimal point alike", () => {
    expect(readValueTokens('6,3"')).toEqual(["6.3"]);
    expect(readValueTokens("6.3 inch")).toEqual(["6.3", "inch"]);
  });

  it("splits a size into its numbers", () => {
    expect(readValueTokens("2424 x 1080")).toEqual(["2424", "x", "1080"]);
  });

  it("keeps words of any script and drops what is left of the punctuation", () => {
    expect(readValueTokens("5100 мАг.")).toEqual(["5100", "маг"]);
  });
});
