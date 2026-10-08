import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTOR_ERROR_PREFIX } from "../constants";

const { executeAsyncScript, waitUntil } = vi.hoisted(() => ({
  executeAsyncScript: vi.fn(),
  waitUntil: vi.fn(async (condition: () => Promise<unknown>) => {
    const value = await condition();
    if (value === null || value === false) {
      throw new Error("waitUntil condition was not met");
    }
    return value;
  }),
}));

vi.mock("@wdio/globals", () => ({ browser: { executeAsyncScript, waitUntil } }));

const { readPopup } = await import("./index");

const SNAPSHOT = JSON.stringify({ greeting: "Hello World", panelWidth: 320 });

describe("readPopup", () => {
  beforeEach(() => {
    executeAsyncScript.mockReset();
    waitUntil.mockClear();
  });

  it("returns the snapshot once the popup has rendered", async () => {
    executeAsyncScript.mockResolvedValue(SNAPSHOT);

    expect((await readPopup()).greeting).toBe("Hello World");
  });

  it("keeps waiting while the popup has not loaded", async () => {
    executeAsyncScript.mockResolvedValue(null);

    await expect(readPopup()).rejects.toThrow(/waitUntil condition was not met/);
  });

  it("surfaces an actor failure rather than timing out on it", async () => {
    executeAsyncScript.mockResolvedValue(`${ACTOR_ERROR_PREFIX}permission denied`);

    await expect(readPopup()).rejects.toThrow(/Reading the popup failed: permission denied/);
  });
});
