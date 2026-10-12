import { describe, expect, it } from "vitest";

import { isSamePage } from ".";

describe("isSamePage", () => {
  it("treats a page and a place on it as the same page", () => {
    expect(isSamePage("https://example.org/a", "https://example.org/a#torque")).toBe(true);
    expect(isSamePage("https://example.org/a#one", "https://example.org/a#two")).toBe(true);
  });

  it("tells different pages apart, query included", () => {
    expect(isSamePage("https://example.org/a", "https://example.org/b")).toBe(false);
    expect(isSamePage("https://example.org/a?page=1", "https://example.org/a?page=2")).toBe(false);
  });
});
