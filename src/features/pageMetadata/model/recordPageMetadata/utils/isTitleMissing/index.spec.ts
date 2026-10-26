import { describe, expect, it } from "vitest";

import { isTitleMissing } from ".";

describe("isTitleMissing", () => {
  it("is true for a blank title, the address and the host", () => {
    expect(isTitleMissing("", "https://example.org/a")).toBe(true);
    expect(isTitleMissing("  ", "https://example.org/a")).toBe(true);
    expect(isTitleMissing("https://example.org/a", "https://example.org/a")).toBe(true);
    expect(isTitleMissing("example.org", "https://example.org/a")).toBe(true);
  });

  it("is false for a real title", () => {
    expect(isTitleMissing("Mid-drive motors", "https://example.org/a")).toBe(false);
  });

  it("is false for a title that merely contains the host", () => {
    expect(isTitleMissing("example.org: motors", "https://example.org/a")).toBe(false);
  });
});
