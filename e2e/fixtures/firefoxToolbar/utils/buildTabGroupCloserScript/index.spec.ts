import { describe, expect, it, vi } from "vitest";

import { buildTabGroupCloserScript } from ".";

/** Runs the script against a stand-in for the browser window's `gBrowser`. */
const run = (label: string, gBrowser: unknown): unknown => {
  return JSON.parse(
    (new Function("gBrowser", buildTabGroupCloserScript(label)) as (g: unknown) => string)(
      gBrowser,
    ),
  );
};

describe("buildTabGroupCloserScript", () => {
  it("closes every tab of the group with that label", () => {
    const tabs = [{ id: 1 }, { id: 2 }];
    const gBrowser = {
      tabGroups: [
        { label: "Other", tabs: [{ id: 3 }] },
        { label: "Motors", tabs },
      ],
      removeTabs: vi.fn(),
    };

    expect(run("Motors", gBrowser)).toBe(2);
    expect(gBrowser.removeTabs).toHaveBeenCalledWith(tabs);
  });

  it("closes nothing when no group carries the label", () => {
    const gBrowser = { tabGroups: [], removeTabs: vi.fn() };

    expect(run("Motors", gBrowser)).toBe(0);
    expect(gBrowser.removeTabs).not.toHaveBeenCalled();
  });

  it("keeps a label with quotes inside the string it searches for", () => {
    const gBrowser = {
      tabGroups: [{ label: 'A "quoted" title', tabs: [{}] }],
      removeTabs: vi.fn(),
    };

    expect(run('A "quoted" title', gBrowser)).toBe(1);
  });
});
