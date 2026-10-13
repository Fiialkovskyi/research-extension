import { describe, expect, it } from "vitest";

import { readSearchEngine } from ".";

describe("readSearchEngine", () => {
  it("names the engine of a results page", () => {
    expect(readSearchEngine("https://www.google.de/search?q=x")?.name).toBe("Google");
    expect(readSearchEngine("https://duckduckgo.com/?q=x")?.name).toBe("DuckDuckGo");
  });

  it("names none for another page of an engine's host, or any other page", () => {
    expect(readSearchEngine("https://www.google.com/maps")).toBeUndefined();
    expect(readSearchEngine("https://example.org/search?q=x")).toBeUndefined();
    expect(readSearchEngine("not a url")).toBeUndefined();
  });
});
