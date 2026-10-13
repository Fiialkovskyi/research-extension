import { describe, expect, it } from "vitest";

import { readDomainCategory } from ".";

describe("readDomainCategory", () => {
  it.each([
    ["www.rtings.com", "review"],
    ["reddit.com", "forum"],
    ["old.reddit.com", "forum"],
    ["m.youtube.com", "video"],
    ["amazon.de", "retailer"],
    ["www.amazon.co.uk", "retailer"],
    ["telemart.ua", "retailer"],
    ["uk.wikipedia.org", "reference"],
    ["www.theverge.com", "news"],
    ["forum.example.org", "forum"],
    ["community.bike.com", "forum"],
    ["example.org", "other"],
  ])("sorts %s as %s", (host, category) => {
    expect(readDomainCategory(host)).toBe(category);
  });

  it("does not take a host that merely ends in a listed name", () => {
    expect(readDomainCategory("notreddit.com")).toBe("other");
  });
});
