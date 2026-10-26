import { describe, expect, it } from "vitest";

import { formatLeftOff } from ".";

describe("formatLeftOff", () => {
  it("words where the user left off, rounding the share read", () => {
    expect(formatLeftOff({ title: "Page B", readFraction: 0.456 })).toBe(
      "You left off at Page B (46% read)",
    );
  });
});
