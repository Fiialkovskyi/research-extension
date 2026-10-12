import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeAsyncScript, waitUntil } = vi.hoisted(() => ({
  executeAsyncScript: vi.fn(),
  waitUntil: vi.fn(async (condition: () => Promise<unknown>) => {
    const value = await condition();
    if (value === undefined || value === null || value === false) {
      throw new Error("waitUntil condition was not met");
    }
    return value;
  }),
}));

vi.mock("@wdio/globals", () => ({ browser: { executeAsyncScript, waitUntil } }));

const { clickPopupButton } = await import("./index");

describe("clickPopupButton", () => {
  beforeEach(() => {
    executeAsyncScript.mockReset();
  });

  it("resolves once the popup reports the button was clicked", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ clicked: true }));

    await expect(clickPopupButton("open-map")).resolves.toBeUndefined();
    expect(executeAsyncScript.mock.calls[0]?.[0]).toContain("open-map");
  });

  it("fails when the popup has no such button", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ clicked: false }));

    await expect(clickPopupButton("open-map")).rejects.toThrow(/no button "open-map"/);
  });
});
