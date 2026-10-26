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

const { readNoticeInTabShowing } = await import("./index");

describe("readNoticeInTabShowing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["one", "two"]);
  });

  it("reads the notice of the tab showing the URL, and returns to the chrome context", async () => {
    const snapshot = { isShown: true, position: "fixed", pointerEvents: "none", isOpen: false };

    browser.getUrl.mockResolvedValueOnce("about:blank").mockResolvedValueOnce("http://x/a.html");
    browser.execute.mockResolvedValue(snapshot);

    expect(await readNoticeInTabShowing("/a.html")).toEqual(snapshot);
    expect(browser.switchToWindow).toHaveBeenLastCalledWith("two");
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });

  it("says which URL no tab shows, still returning to the chrome context", async () => {
    browser.getUrl.mockResolvedValue("about:blank");

    await expect(readNoticeInTabShowing("/a.html")).rejects.toThrow(
      'No tab shows a URL ending in "/a.html".',
    );
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
