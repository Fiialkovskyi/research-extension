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

const { putResearchRecords } = await import("./index");

describe("putResearchRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.getWindowHandles.mockResolvedValue(["page", "reader"]);
    browser.getUrl.mockResolvedValue(
      "moz-extension://8cf4bf6a-5f3a-4d5a-9f2f-2f0a1ff2ab42/options.html",
    );
  });

  it("writes the records from an extension page and returns to the chrome context", async () => {
    browser.execute.mockResolvedValueOnce("complete").mockResolvedValue("OK");

    await putResearchRecords("models", [{ ref: "a" }]);

    expect(browser.execute).toHaveBeenLastCalledWith(expect.any(Function), "models", [
      { ref: "a" },
    ]);
    expect(browser.closeWindow).toHaveBeenCalled();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });

  it("says why a write was refused, still closing the page", async () => {
    browser.execute.mockResolvedValueOnce("complete").mockResolvedValue("ERROR NotFoundError");

    await expect(putResearchRecords("missing", [])).rejects.toThrow(
      'Could not write to "missing": NotFoundError',
    );
    expect(browser.closeWindow).toHaveBeenCalled();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
