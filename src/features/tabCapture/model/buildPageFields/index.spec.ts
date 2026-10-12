import { describe, expect, it } from "vitest";

import { buildPageFields } from ".";

describe("buildPageFields", () => {
  it("classifies a results page as a SERP with its query", () => {
    expect(buildPageFields("https://duckduckgo.com/?q=e-bike+motors")).toEqual({
      kind: "serp",
      query: "e-bike motors",
      domain: "duckduckgo.com",
    });
  });

  it("classifies any other page as a plain page, with no query at all", () => {
    const fields = buildPageFields("https://example.org/motors");

    expect(fields).toEqual({ kind: "page", domain: "example.org" });
    expect(fields).not.toHaveProperty("query");
  });
});
