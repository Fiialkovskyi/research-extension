import { describe, expect, it } from "vitest";

import { buildSeededRandom } from ".";

const take = (next: () => number, count: number) => Array.from({ length: count }, next);

describe("buildSeededRandom", () => {
  it("gives the same sequence for the same seed", () => {
    expect(take(buildSeededRandom(42), 5)).toEqual(take(buildSeededRandom(42), 5));
  });

  it("gives a different sequence for another seed", () => {
    expect(take(buildSeededRandom(42), 5)).not.toEqual(take(buildSeededRandom(43), 5));
  });

  it("stays within [0, 1)", () => {
    expect(take(buildSeededRandom(7), 1000).every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
