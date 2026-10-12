import { describe, expect, it, vi } from "vitest";

import { buildTabUngrouperScript } from ".";

const run = (gBrowser: unknown, url: string): unknown =>
  JSON.parse(
    (new Function("gBrowser", buildTabUngrouperScript(url)) as (g: unknown) => string)(gBrowser),
  );

describe("buildTabUngrouperScript", () => {
  it("takes the tab showing the URL out of its group", () => {
    const tab = { linkedBrowser: { currentURI: { spec: "http://x/b.html" } } };
    const gBrowser = { tabs: [tab], ungroupTab: vi.fn() };

    expect(run(gBrowser, "http://x/b.html")).toBe(true);
    expect(gBrowser.ungroupTab).toHaveBeenCalledWith(tab);
  });

  it("reports a missing tab", () => {
    const gBrowser = { tabs: [], ungroupTab: vi.fn() };

    expect(run(gBrowser, "http://x/b.html")).toBe(false);
    expect(gBrowser.ungroupTab).not.toHaveBeenCalled();
  });
});
