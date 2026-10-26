import { describe, expect, it } from "vitest";

import { findCategoryGaps } from ".";

describe("findCategoryGaps", () => {
  it("reports the kinds no page is when most pages are classified", () => {
    expect(findCategoryGaps(["shop", "review", "shop", undefined])).toEqual(["forum", "video"]);
  });

  it("reports nothing when most pages are unclassified", () => {
    expect(findCategoryGaps(["shop", undefined, undefined, undefined])).toEqual([]);
  });

  it("reports nothing for fewer than three pages", () => {
    expect(findCategoryGaps(["shop", "review"])).toEqual([]);
    expect(findCategoryGaps([])).toEqual([]);
  });

  it("reports nothing when every kind is read", () => {
    expect(findCategoryGaps(["shop", "review", "forum", "video"])).toEqual([]);
  });

  it("counts half as most", () => {
    expect(findCategoryGaps(["shop", "shop", undefined, undefined])).toEqual([
      "review",
      "forum",
      "video",
    ]);
  });
});
