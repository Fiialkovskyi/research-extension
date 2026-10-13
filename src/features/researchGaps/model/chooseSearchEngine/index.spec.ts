import { describe, expect, it } from "vitest";

import { chooseSearchEngine } from ".";

describe("chooseSearchEngine", () => {
  it("uses the engine the session searched with most", () => {
    expect(
      chooseSearchEngine([
        "https://www.google.com/search?q=a",
        "https://www.bing.com/search?q=b",
        "https://www.google.de/search?q=c",
      ]).name,
    ).toBe("Google");
  });

  it("uses DuckDuckGo when the session made no search", () => {
    expect(chooseSearchEngine([]).name).toBe("DuckDuckGo");
  });
});
