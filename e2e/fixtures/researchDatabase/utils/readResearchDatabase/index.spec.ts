import { beforeEach, describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({
  browser: {
    executeScript: vi.fn(),
    setMozContext: vi.fn(),
    waitUntil: vi.fn(async (condition: () => Promise<boolean>) => condition()),
    getWindowHandles: vi.fn(),
    switchToWindow: vi.fn(),
    getUrl: vi.fn(),
    execute: vi.fn(),
    closeWindow: vi.fn(),
  },
}));

vi.mock("@wdio/globals", () => ({ browser }));

const { readResearchDatabase } = await import("./index");

const snapshot = { sessions: [], nodes: [], snapshots: [], edges: [], groups: [] };

describe("readResearchDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["page", "reader"]);
    browser.getUrl
      .mockResolvedValueOnce("http://x/a.html")
      .mockResolvedValue("moz-extension://8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42/options.html");
  });

  it("reads through an extension page, closes it, and returns to the chrome context", async () => {
    browser.execute.mockResolvedValueOnce("complete").mockResolvedValue(JSON.stringify(snapshot));

    expect(await readResearchDatabase()).toEqual(snapshot);
    expect(browser.executeScript).toHaveBeenCalledWith(expect.stringContaining("options.html"), []);
    expect(browser.closeWindow).toHaveBeenCalled();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
    expect(browser.executeScript).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("selectedTab"),
      [],
    );
    expect(browser.executeScript).toHaveBeenLastCalledWith(
      expect.stringContaining("gBrowser.selectedTab = tab"),
      [],
    );
  });

  it("returns to the chrome context when the read fails", async () => {
    browser.execute.mockResolvedValueOnce("complete").mockResolvedValue("ERROR blocked");

    await expect(readResearchDatabase()).rejects.toThrow("blocked");
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
