import { beforeEach, describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({
  browser: {
    setMozContext: vi.fn(),
    getWindowHandles: vi.fn(),
    switchToWindow: vi.fn(),
    getUrl: vi.fn(),
    execute: vi.fn(),
    waitUntil: vi.fn(async (condition: () => Promise<boolean>) => {
      if (!(await condition())) {
        throw new Error("timed out");
      }
    }),
  },
}));

vi.mock("@wdio/globals", () => ({ browser }));

const { switchToSummariesTab } = await import("./index");

describe("switchToSummariesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["one", "two"]);
    browser.execute.mockResolvedValue("complete");
  });

  it("stops at the tab showing the loaded page", async () => {
    browser.getUrl
      .mockResolvedValueOnce("about:blank")
      .mockResolvedValueOnce("moz-extension://8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42/summaries.html");

    await switchToSummariesTab();

    expect(browser.switchToWindow).toHaveBeenLastCalledWith("two");
  });

  it("fails when no tab shows it", async () => {
    browser.getUrl.mockResolvedValue("about:blank");

    await expect(switchToSummariesTab()).rejects.toThrow();
  });
});
