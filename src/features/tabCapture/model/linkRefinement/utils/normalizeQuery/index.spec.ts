import { describe, expect, it } from "vitest";

import { normalizeQuery } from ".";

describe("normalizeQuery", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeQuery("  E-bike \t Motors ")).toBe("e-bike motors");
  });
});
