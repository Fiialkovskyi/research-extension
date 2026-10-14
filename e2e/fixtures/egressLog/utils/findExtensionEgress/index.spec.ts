import { describe, expect, it } from "vitest";

import { findExtensionEgress } from ".";

describe("findExtensionEgress", () => {
  it("keeps the add-on's own requests and leaves out tabs it opened", () => {
    expect(
      findExtensionEgress([
        { url: "https://duckduckgo.com/?q=a", type: 6 },
        { url: "https://tracker.example/beacon", type: 11 },
      ]),
    ).toEqual([{ url: "https://tracker.example/beacon", type: 11 }]);
  });
});
