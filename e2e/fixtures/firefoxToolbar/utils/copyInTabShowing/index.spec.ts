import { beforeEach, describe, expect, it, vi } from "vitest";
import { Key } from "webdriverio";

const { browser } = vi.hoisted(() => ({
  browser: {
    setMozContext: vi.fn(),
    getWindowHandles: vi.fn(),
    switchToWindow: vi.fn(),
    getUrl: vi.fn(),
    execute: vi.fn(),
    keys: vi.fn(),
  },
}));

vi.mock("@wdio/globals", () => ({ browser }));

const { copyInTabShowing } = await import("./index");

describe("copyInTabShowing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["one", "two"]);
  });

  it("selects the element and copies it with the platform's shortcut", async () => {
    browser.getUrl
      .mockResolvedValueOnce("about:blank")
      .mockResolvedValueOnce("http://x/article.html");

    await copyInTabShowing("/article.html", "#headline");

    expect(browser.switchToWindow).toHaveBeenLastCalledWith("two");
    expect(browser.execute).toHaveBeenCalledWith(expect.any(Function), "#headline");
    expect(browser.keys).toHaveBeenCalledWith([
      process.platform === "darwin" ? Key.Command : Key.Ctrl,
      "c",
    ]);
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });

  it("says which URL no tab shows, still returning to the chrome context", async () => {
    browser.getUrl.mockResolvedValue("about:blank");

    await expect(copyInTabShowing("/article.html", "#headline")).rejects.toThrow(
      'No tab shows a URL ending in "/article.html".',
    );
    expect(browser.keys).not.toHaveBeenCalled();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
