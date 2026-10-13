import { describe, expect, it } from "vitest";

import { findCategoryGaps } from ".";

describe("findCategoryGaps", () => {
  it("lists every other category when only shops were visited", () => {
    expect(findCategoryGaps(["https://telemart.ua/a", "https://rozetka.com.ua/b"])).toEqual([
      "review",
      "forum",
      "video",
      "reference",
    ]);
  });

  it("lists nothing once every category was visited", () => {
    expect(
      findCategoryGaps([
        "https://www.rtings.com/a",
        "https://www.reddit.com/r/x",
        "https://www.youtube.com/watch?v=1",
        "https://telemart.ua/a",
        "https://en.wikipedia.org/wiki/X",
      ]),
    ).toEqual([]);
  });

  it("does not count unknown hosts, or what is not a URL, toward any category", () => {
    expect(findCategoryGaps(["https://example.org/a", "nonsense"])).toHaveLength(5);
  });
});
