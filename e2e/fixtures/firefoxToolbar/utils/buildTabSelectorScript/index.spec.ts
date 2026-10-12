import { describe, expect, it } from "vitest";

import { buildTabSelectorScript } from ".";

const buildTab = (spec: string) => ({ linkedBrowser: { currentURI: { spec } } });

/** Runs the script against a stand-in `gBrowser`, returning its result and selection. */
const run = (urlEnding: string) => {
  const gBrowser = {
    tabs: [buildTab("https://example.org/a.html"), buildTab("https://example.org/b.html")],
    selectedTab: undefined as unknown,
  };
  const found = (
    new Function("gBrowser", buildTabSelectorScript(urlEnding)) as (g: unknown) => boolean
  )(gBrowser);

  return { found, selected: gBrowser.selectedTab, tabs: gBrowser.tabs };
};

describe("buildTabSelectorScript", () => {
  it("selects the tab whose address ends as asked", () => {
    const { found, selected, tabs } = run("/b.html");

    expect(found).toBe(true);
    expect(selected).toBe(tabs[1]);
  });

  it("selects nothing and says so when no tab matches", () => {
    expect(run("/c.html")).toMatchObject({ found: false, selected: undefined });
  });
});
