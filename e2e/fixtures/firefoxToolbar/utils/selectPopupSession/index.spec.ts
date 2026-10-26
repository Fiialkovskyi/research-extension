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

const { selectPopupSession } = await import("./index");

describe("selectPopupSession", () => {
  beforeEach(() => {
    executeAsyncScript.mockReset();
  });

  it("resolves once the popup reports the session was chosen", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ selected: true }));

    await expect(selectPopupSession("Motors")).resolves.toBeUndefined();
    expect(executeAsyncScript.mock.calls[0]?.[0]).toContain("Motors");
  });

  it("fails when the picker has no such session", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ selected: false }));

    await expect(selectPopupSession("Motors")).rejects.toThrow(/no session "Motors"/);
  });
});
