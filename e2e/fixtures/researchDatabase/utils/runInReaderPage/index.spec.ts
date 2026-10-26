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

const { runInReaderPage } = await import("./index");

describe("runInReaderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["page", "reader"]);
    browser.getUrl
      .mockResolvedValueOnce("http://x/a.html")
      .mockResolvedValue("moz-extension://8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42/options.html");
    browser.execute.mockResolvedValue("complete");
  });

  it("runs the work in a loaded extension page, closes it, and returns what the work did", async () => {
    expect(await runInReaderPage(() => Promise.resolve(42))).toBe(42);
    expect(browser.executeScript).toHaveBeenCalledWith(expect.stringContaining("options.html"), []);
    expect(browser.closeWindow).toHaveBeenCalledOnce();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });

  it("selects the tab the user had selected again at the end", async () => {
    await runInReaderPage(() => Promise.resolve());

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

  it("closes the page and returns to the chrome context when the work fails", async () => {
    await expect(runInReaderPage(() => Promise.reject(new Error("blocked")))).rejects.toThrow(
      "blocked",
    );
    expect(browser.closeWindow).toHaveBeenCalledOnce();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
