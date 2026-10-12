import { beforeEach, describe, expect, it, vi } from "vitest";

const { browser, switchToMapTab } = vi.hoisted(() => ({
  browser: { executeScript: vi.fn(), execute: vi.fn(), setMozContext: vi.fn() },
  switchToMapTab: vi.fn(),
}));

vi.mock("@wdio/globals", () => ({ browser }));
vi.mock("../switchToMapTab", () => ({ switchToMapTab }));

const { readResearchMap } = await import("./index");

const snapshot = {
  documentId: "1",
  nodesChangedAt: null,
  empty: true,
  sessionTitle: null,
  nodes: [],
  edges: [],
};

describe("readResearchMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the map and restores the selected tab in the chrome context", async () => {
    browser.execute.mockResolvedValue(JSON.stringify(snapshot));

    expect(await readResearchMap()).toEqual(snapshot);
    expect(browser.executeScript).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("selectedTab"),
      [],
    );
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
    expect(browser.executeScript).toHaveBeenLastCalledWith(
      expect.stringContaining("gBrowser.selectedTab = tab"),
      [],
    );
  });

  it("returns to the chrome context when the map cannot be found", async () => {
    switchToMapTab.mockRejectedValueOnce(new Error("No tab shows the research map."));

    await expect(readResearchMap()).rejects.toThrow(/research map/);
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
