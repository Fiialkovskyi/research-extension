import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeScript, waitUntil } = vi.hoisted(() => ({
  executeScript: vi.fn(),
  // Stand-in for WebdriverIO's poller: run the condition once and resolve to
  // whatever truthy value it returned, the way the real `waitUntil` does.
  waitUntil: vi.fn(async (condition: () => Promise<unknown>) => {
    const result = await condition();

    if (!result) {
      throw new Error("waitUntil condition was not met");
    }

    return result;
  }),
}));

vi.mock("@wdio/globals", () => ({ browser: { executeScript, waitUntil } }));

const { waitForPopupPanel } = await import("./index");

describe("waitForPopupPanel", () => {
  beforeEach(() => {
    executeScript.mockReset();
    waitUntil.mockClear();
  });

  it("returns the state once the panel is open", async () => {
    executeScript.mockResolvedValue('{"state":"open","anchorId":"widget-id"}');

    expect(await waitForPopupPanel()).toEqual({ state: "open", anchorId: "widget-id" });
  });

  // `showing` is a real intermediate state; treating it as open made the first
  // version of the suite read the popup before it had finished opening.
  it("does not accept the intermediate 'showing' state as open", async () => {
    executeScript.mockResolvedValue('{"state":"showing","anchorId":null}');

    await expect(waitForPopupPanel()).rejects.toThrow();
  });

  it("says what failed when the panel never opens", async () => {
    executeScript.mockResolvedValue('{"state":"closed","anchorId":null}');

    await expect(waitForPopupPanel()).rejects.toThrow();
    expect(waitUntil).toHaveBeenCalledWith(expect.anything(), {
      timeout: expect.any(Number),
      timeoutMsg: "The toolbar action did not open its popup panel.",
    });
  });
});
