import { describe, expect, it } from "vitest";

import { buildSearchUrl } from ".";

describe("buildSearchUrl", () => {
  it("puts the query in the template, encoded", () => {
    expect(
      buildSearchUrl(
        { searchUrl: "https://duckduckgo.com/?q={query}" },
        'MacBook Neo 13" ціна & price',
      ),
    ).toBe(
      "https://duckduckgo.com/?q=MacBook%20Neo%2013%22%20%D1%86%D1%96%D0%BD%D0%B0%20%26%20price",
    );
  });
});
