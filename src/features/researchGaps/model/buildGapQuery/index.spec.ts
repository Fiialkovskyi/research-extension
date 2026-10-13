import { describe, expect, it } from "vitest";

import { buildGapQuery } from ".";

describe("buildGapQuery", () => {
  it("searches an empty cell's entity and attribute", () => {
    expect(
      buildGapQuery({ kind: "cell", cell: { entity: "MacBook Neo 13", attribute: "price" } }, "x"),
    ).toEqual({ kind: "cell", text: "No price for MacBook Neo 13", query: "MacBook Neo 13 price" });
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
