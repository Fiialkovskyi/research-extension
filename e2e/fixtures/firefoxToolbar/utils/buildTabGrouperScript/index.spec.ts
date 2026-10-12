import { describe, expect, it, vi } from "vitest";

import { buildTabGrouperScript } from ".";

/** Runs the script against a stand-in for `gBrowser`. */
const run = (gBrowser: unknown, url: string, label: string): unknown =>
  JSON.parse(
    (new Function("gBrowser", buildTabGrouperScript(url, label)) as (g: unknown) => string)(
      gBrowser,
    ),
  );

const tabShowing = (spec: string) => ({ linkedBrowser: { currentURI: { spec } } });

describe("buildTabGrouperScript", () => {
  it("adds the tab showing the URL to the labelled group", () => {
    const tab = tabShowing("http://x/b.html");
    const group = { label: "Motors", addTabs: vi.fn() };

    expect(
      run(
        { tabs: [tabShowing("http://x/a.html"), tab], tabGroups: [group] },
        "http://x/b.html",
        "Motors",
      ),
    ).toBe(true);
    expect(group.addTabs).toHaveBeenCalledWith([tab]);
  });

  it("reports a missing tab or group instead of failing silently", () => {
    const group = { label: "Motors", addTabs: vi.fn() };

    expect(run({ tabs: [], tabGroups: [group] }, "http://x/b.html", "Motors")).toBe(false);
    expect(
      run({ tabs: [tabShowing("http://x/b.html")], tabGroups: [] }, "http://x/b.html", "Motors"),
    ).toBe(false);
    expect(group.addTabs).not.toHaveBeenCalled();
  });
});
