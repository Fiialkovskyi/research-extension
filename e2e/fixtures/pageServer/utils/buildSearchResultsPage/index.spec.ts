import { describe, expect, it } from "vitest";

import { buildSearchResultsPage } from ".";

describe("buildSearchResultsPage", () => {
  it("is titled after the query and links page A on the loopback origin, in a new tab", () => {
    const page = buildSearchResultsPage("e-bike motors", "http://127.0.0.1:4000");

    expect(page).toContain("<title>e-bike motors - Search</title>");
    expect(page).toContain(
      '<a id="first-result" href="http://127.0.0.1:4000/a.html" target="_blank">',
    );
  });

  it("escapes the query, which comes from the URL", () => {
    expect(buildSearchResultsPage('<b>"x"</b>', "http://127.0.0.1:4000")).toContain(
      "&lt;b&gt;&quot;x&quot;&lt;/b&gt;",
    );
  });
});
