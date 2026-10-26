import { beforeEach, describe, expect, it, vi } from "vitest";

const { browser, click, $ } = vi.hoisted(() => {
  const clickElement = vi.fn();
  const waitForClickable = vi.fn();

  return {
    click: clickElement,
    $: vi.fn(() => ({ click: clickElement, waitForClickable })),
    browser: {
      setMozContext: vi.fn(),
      getWindowHandles: vi.fn(),
      switchToWindow: vi.fn(),
      getUrl: vi.fn(),
      waitUntil: vi.fn(
        async (condition: () => Promise<unknown>, options: { timeoutMsg: string }) => {
          if (!(await condition())) {
            throw new Error(options.timeoutMsg);
          }
        },
      ),
    },
  };
});

vi.mock("@wdio/globals", () => ({ browser, $ }));

const { clickInTabShowing } = await import("./index");

describe("clickInTabShowing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["one", "two"]);
  });

  it("clicks in the tab showing the URL and returns to the chrome context", async () => {
    browser.getUrl.mockResolvedValueOnce("about:blank").mockResolvedValueOnce("http://x/a.html");

    await clickInTabShowing("/a.html", "#open-c");

    expect(browser.switchToWindow).toHaveBeenLastCalledWith("two");
    expect($).toHaveBeenCalledWith("#open-c");
    expect(click).toHaveBeenCalled();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });

  it("says which URL no tab shows, still returning to the chrome context", async () => {
    browser.getUrl.mockResolvedValue("about:blank");

    await expect(clickInTabShowing("/a.html", "#open-c")).rejects.toThrow('"/a.html"');
    expect(click).not.toHaveBeenCalled();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
