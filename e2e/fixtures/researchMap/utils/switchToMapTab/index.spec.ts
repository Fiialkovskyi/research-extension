import { beforeEach, describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({
  browser: {
    setMozContext: vi.fn(),
    waitUntil: vi.fn(async (condition: () => Promise<boolean>) => {
      if (!(await condition())) {
        throw new Error("No tab shows the research map.");
      }
    }),
    getWindowHandles: vi.fn(),
    switchToWindow: vi.fn(),
    getUrl: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock("@wdio/globals", () => ({ browser }));

const { switchToMapTab } = await import("./index");

describe("switchToMapTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["page", "map"]);
  });

  it("stays on the tab that shows the loaded map", async () => {
    browser.getUrl
      .mockResolvedValueOnce("http://x/a.html")
      .mockResolvedValue("moz-extension://8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42/map.html");
    browser.execute.mockResolvedValue("complete");

    await switchToMapTab();

    expect(browser.setMozContext).toHaveBeenCalledWith("content");
    expect(browser.switchToWindow).toHaveBeenLastCalledWith("map");
  });

  it("fails when no tab shows the map", async () => {
    browser.getUrl.mockResolvedValue("http://x/a.html");

    await expect(switchToMapTab()).rejects.toThrow(/No tab shows the research map/);
  });
});
