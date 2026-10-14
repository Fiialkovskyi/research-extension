import { describe, expect, it } from "vitest";

import { getPercentile } from ".";

describe("getPercentile", () => {
  it("takes the nearest rank", () => {
    const values = Array.from({ length: 20 }, (_, index) => 20 - index);

    expect(getPercentile(values, 95)).toBe(19);
    expect(getPercentile(values, 50)).toBe(10);
    expect(getPercentile([7], 95)).toBe(7);
  });

  it("refuses no measurements", () => {
    expect(() => getPercentile([], 95)).toThrow();
  });
});
