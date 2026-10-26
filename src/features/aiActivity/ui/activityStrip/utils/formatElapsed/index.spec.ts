import { describe, expect, it } from "vitest";

import { formatElapsed } from ".";

describe("formatElapsed", () => {
  it.each([
    [0, "0s"],
    [40_900, "40s"],
    [60_000, "1m 00s"],
    [125_000, "2m 05s"],
    [-5_000, "0s"],
  ])("writes %i ms as %s", (milliseconds, text) => {
    expect(formatElapsed(milliseconds)).toBe(text);
  });
});
