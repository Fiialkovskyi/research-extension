import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTOR_ERROR_PREFIX } from "../../constants";

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

const { submitPopupGroupTitle } = await import("./index");

describe("submitPopupGroupTitle", () => {
  beforeEach(() => {
    executeAsyncScript.mockReset();
  });

  it("resolves once the popup reports the form was submitted", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ submitted: true }));

    await expect(submitPopupGroupTitle("Motors")).resolves.toBeUndefined();
    expect(executeAsyncScript.mock.calls[0]?.[0]).toContain("Motors");
  });

  it("fails when the popup has no session form", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ submitted: false }));

    await expect(submitPopupGroupTitle("Motors")).rejects.toThrow(/no session form/);
  });

  it("surfaces an actor failure rather than timing out on it", async () => {
    executeAsyncScript.mockResolvedValue(`${ACTOR_ERROR_PREFIX}permission denied`);

    await expect(submitPopupGroupTitle("Motors")).rejects.toThrow(/permission denied/);
  });
});
