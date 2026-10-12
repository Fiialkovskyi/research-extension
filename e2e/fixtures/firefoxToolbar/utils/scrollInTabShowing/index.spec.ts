import { beforeEach, describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({
  browser: {
    setMozContext: vi.fn(),
    getWindowHandles: vi.fn(),
    switchToWindow: vi.fn(),
    getUrl: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock("@wdio/globals", () => ({ browser }));

const { scrollInTabShowing } = await import("./index");

describe("scrollInTabShowing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["one", "two"]);
  });

  it("scrolls the page of the tab showing the URL, and returns to the chrome context", async () => {
    browser.getUrl
      .mockResolvedValueOnce("about:blank")
      .mockResolvedValueOnce("http://x/article.html");

    await scrollInTabShowing("/article.html", 1);

    expect(browser.switchToWindow).toHaveBeenLastCalledWith("two");
    expect(browser.execute).toHaveBeenCalledWith(expect.any(Function), 1);
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });

  it("says which URL no tab shows, still returning to the chrome context", async () => {
    browser.getUrl.mockResolvedValue("about:blank");

    await expect(scrollInTabShowing("/article.html", 1)).rejects.toThrow(
      'No tab shows a URL ending in "/article.html".',
    );
    expect(browser.execute).not.toHaveBeenCalled();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
