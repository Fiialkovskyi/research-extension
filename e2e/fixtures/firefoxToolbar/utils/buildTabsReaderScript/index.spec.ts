import { describe, expect, it } from "vitest";

import { buildTabsReaderScript } from ".";

/** Runs the script against a stand-in for the browser window's `gBrowser`. */
const run = (gBrowser: unknown): unknown => {
  return JSON.parse(
    (new Function("gBrowser", buildTabsReaderScript()) as (g: unknown) => string)(gBrowser),
  );
};

const buildTab = (spec: string, selected: boolean, group?: { label: string }) => ({
  linkedBrowser: { currentURI: { spec } },
  selected,
  group,
});

describe("buildTabsReaderScript", () => {
  it("reports each tab's address, selection and group", () => {
    const gBrowser = {
      tabs: [
        buildTab("https://example.org/a", false, { label: "Motors" }),
        buildTab("moz-extension://uuid/map.html", true),
      ],
    };

    expect(run(gBrowser)).toEqual([
      { url: "https://example.org/a", selected: false, group: "Motors" },
      { url: "moz-extension://uuid/map.html", selected: true, group: null },
    ]);
  });
});
