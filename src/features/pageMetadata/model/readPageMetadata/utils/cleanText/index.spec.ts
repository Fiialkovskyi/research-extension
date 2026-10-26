import { describe, expect, it } from "vitest";

import { cleanText } from ".";

describe("cleanText", () => {
  it("collapses runs of whitespace and trims", () => {
    expect(cleanText("  Mid-drive \n\t motors  ", 100)).toBe("Mid-drive motors");
  });

  it("cuts to the limit", () => {
    expect(cleanText("abcdefgh", 5)).toBe("abcde");
  });

  it("does not leave half a surrogate pair", () => {
    expect(cleanText("ab😀cd", 3)).toBe("ab😀");
  });

  it("returns nothing for an empty, blank or missing value", () => {
    expect(cleanText("", 5)).toBeUndefined();
    expect(cleanText(" \n ", 5)).toBeUndefined();
    expect(cleanText(null, 5)).toBeUndefined();
    expect(cleanText(undefined, 5)).toBeUndefined();
  });
});
