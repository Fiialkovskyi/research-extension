import { describe, expect, it } from "vitest";

import { buildTabGroupsReaderScript } from ".";

/** Runs the script against a stand-in for the browser window's `gBrowser`. */
const run = (gBrowser: unknown): unknown => {
  return JSON.parse(
    (new Function("gBrowser", buildTabGroupsReaderScript()) as (g: unknown) => string)(gBrowser),
  );
};

describe("buildTabGroupsReaderScript", () => {
  it("reports each group's label, colour and number of tabs", () => {
    const gBrowser = { tabGroups: [{ label: "Motors", color: "blue", tabs: [{}, {}] }] };

    expect(run(gBrowser)).toEqual([{ label: "Motors", color: "blue", tabCount: 2 }]);
  });

  it("reports no groups on a Firefox without tab groups", () => {
    expect(run({})).toEqual([]);
  });
});
