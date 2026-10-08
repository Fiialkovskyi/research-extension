import { beforeEach, describe, expect, it, vi } from "vitest";

import { POPUP_PANEL_ID } from "../constants";

const { executeScript, waitUntil } = vi.hoisted(() => ({
  executeScript: vi.fn(),
  waitUntil: vi.fn(async (condition: () => Promise<boolean>) => {
    if (!(await condition())) {
      throw new Error("waitUntil condition was not met");
    }
    return true;
  }),
}));

vi.mock("@wdio/globals", () => ({ browser: { executeScript, waitUntil } }));

const { closePopup } = await import("./index");

const respond = (panelState: string) =>
  executeScript.mockImplementation(async (script: string) =>
    script.includes("hidePopup") ? undefined : `{"state":"${panelState}","anchorId":null}`,
  );

describe("closePopup", () => {
  beforeEach(() => {
    executeScript.mockReset();
    waitUntil.mockClear();
  });

  it("hides the extension popup's own panel", async () => {
    respond("closed");

    await closePopup();

    expect(executeScript).toHaveBeenCalledWith(expect.stringContaining("hidePopup"), [
      POPUP_PANEL_ID,
    ]);
  });

  // Returning before the panel is gone would leak an open popup into the next
  // test, where the following click would close it instead of opening it.
  it("waits for the panel to leave the open state", async () => {
    respond("open");

    await expect(closePopup()).rejects.toThrow();
  });

  it("accepts any non-open state, including the intermediate 'hiding'", async () => {
    respond("hiding");

    await expect(closePopup()).resolves.toBeUndefined();
  });
});
