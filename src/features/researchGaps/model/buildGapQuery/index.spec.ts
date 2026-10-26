import { describe, expect, it } from "vitest";

import { buildGapQuery } from ".";

describe("buildGapQuery", () => {
  it("searches an entity with its missing attributes, in one search", () => {
    expect(
      buildGapQuery(
        {
          kind: "cell",
          cell: { entity: "MacBook Neo 13", attributes: ["price", "weight"], moreCount: 0 },
        },
        "x",
      ),
    ).toEqual({
      kind: "cell",
      text: "No price, weight for MacBook Neo 13",
      query: "MacBook Neo 13 price weight",
    });
  });

  it("says how many more attributes are missing", () => {
    expect(
      buildGapQuery(
        { kind: "cell", cell: { entity: "Neo", attributes: ["a", "b", "c"], moreCount: 2 } },
        "x",
      ).text,
    ).toBe("No a, b, c and 2 more for Neo");
  });

  it("searches the subject with a word for a missing category", () => {
    expect(buildGapQuery({ kind: "category", category: "video" }, "MacBook Neo 13")).toEqual({
      kind: "category",
      text: "No videos watched yet",
      query: "MacBook Neo 13 video review",
    });
  });

  it("trims a long query at a word", () => {
    const { query } = buildGapQuery(
      { kind: "category", category: "review" },
      Array.from({ length: 40 }, () => "word").join(" "),
    );

    expect(query.length).toBeLessThanOrEqual(120);
    expect(query.endsWith("word")).toBe(true);
  });
});
