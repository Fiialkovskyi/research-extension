import { describe, expect, it } from "vitest";

import { describePageSource } from ".";

describe("describePageSource", () => {
  it("names the site and the day", () => {
    expect(describePageSource({ siteName: "Bike Lab", publishedDate: "2026-05-01" })).toBe(
      "Bike Lab, 2026-05-01",
    );
  });

  it("names whichever the page gave", () => {
    expect(describePageSource({ siteName: "Bike Lab" })).toBe("Bike Lab");
    expect(describePageSource({ publishedDate: "2026-05-01" })).toBe("2026-05-01");
  });

  it("is empty when the page gave neither", () => {
    expect(describePageSource({})).toBe("");
  });
});
