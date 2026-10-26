import { describe, expect, it } from "vitest";

import { readSourceLabel } from ".";

describe("readSourceLabel", () => {
  it("names the site the page gave", () => {
    expect(readSourceLabel({ siteName: "Яблуко", url: "https://shop.example/p/1" })).toBe("Яблуко");
  });

  it("falls back to the host without www", () => {
    expect(readSourceLabel({ url: "https://www.shop.example/p/1" })).toBe("shop.example");
    expect(readSourceLabel({ siteName: "  ", url: "https://shop.example/p" })).toBe("shop.example");
  });

  it("falls back to the address when it is not one", () => {
    expect(readSourceLabel({ url: "not a url" })).toBe("not a url");
  });
});
