import { describe, expect, it } from "vitest";

import { groupCitationsByPage } from ".";

const cite = (id: string, url: string) => ({ id, url });

describe("groupCitationsByPage", () => {
  it("makes one entry of a page's citations, in the order pages first appear", () => {
    expect(
      groupCitationsByPage([
        cite("1", "https://a"),
        cite("2", "https://b"),
        cite("3", "https://a"),
        cite("4", "https://a"),
      ]),
    ).toEqual([
      { first: cite("1", "https://a"), more: [cite("3", "https://a"), cite("4", "https://a")] },
      { first: cite("2", "https://b"), more: [] },
    ]);
  });

  it("gives nothing for no citations", () => {
    expect(groupCitationsByPage([])).toEqual([]);
  });
});
