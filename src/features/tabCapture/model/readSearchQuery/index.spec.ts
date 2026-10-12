import { describe, expect, it } from "vitest";

import { readSearchQuery } from ".";

describe("readSearchQuery", () => {
  it.each([
    ["https://www.google.com/search?q=e-bike+motors&hl=en", "e-bike motors"],
    ["https://www.google.co.uk/search?q=hub+motor", "hub motor"],
    ["https://www.bing.com/search?q=mid-drive&form=QBLH", "mid-drive"],
    ["https://duckduckgo.com/?q=torque+sensor&ia=web", "torque sensor"],
    ["https://html.duckduckgo.com/html/?q=cadence", "cadence"],
    ["https://www.startpage.com/sp/search?query=battery+range", "battery range"],
    ["https://www.startpage.com/do/search?q=battery", "battery"],
    ["https://www.ecosia.org/search?method=index&q=pedelec", "pedelec"],
    ["https://kagi.com/search?q=bafang", "bafang"],
    ["https://search.brave.com/search?q=shimano+steps", "shimano steps"],
  ])("reads the query of %s", (url, query) => {
    expect(readSearchQuery(url)).toBe(query);
  });

  it("ignores the scheme and the port", () => {
    expect(readSearchQuery("http://duckduckgo.com:8123/?q=motors")).toBe("motors");
  });

  it("trims the query", () => {
    expect(readSearchQuery("https://www.bing.com/search?q=%20%20motors%20")).toBe("motors");
  });

  it.each([
    "https://www.google.com/",
    "https://www.google.com/search?q=",
    "https://www.google.com/search?q=%20%20",
    "https://www.google.com/search",
    "https://www.google.com/maps?q=berlin",
    "https://duckduckgo.com/about",
    "https://example.org/search?q=motors",
    "not a url",
  ])("finds no query in %s", (url) => {
    expect(readSearchQuery(url)).toBeUndefined();
  });
});
