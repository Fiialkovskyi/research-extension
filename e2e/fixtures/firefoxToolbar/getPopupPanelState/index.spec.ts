import { beforeEach, describe, expect, it, vi } from "vitest";

import { POPUP_PANEL_ID } from "../constants";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { getPopupPanelState } = await import("./index");

describe("getPopupPanelState", () => {
  beforeEach(() => {
    executeScript.mockReset();
  });

  it("asks about the extension popup's own panel", async () => {
    executeScript.mockResolvedValue('{"state":"open","anchorId":null}');

    await getPopupPanelState();

    expect(executeScript).toHaveBeenCalledWith(expect.stringContaining("anchorNode"), [
      POPUP_PANEL_ID,
    ]);
  });

  it("reports the state and anchor it found", async () => {
    executeScript.mockResolvedValue('{"state":"open","anchorId":"widget-id"}');

    expect(await getPopupPanelState()).toEqual({ state: "open", anchorId: "widget-id" });
  });

  it("reports 'absent' when the panel is not in the DOM at all", async () => {
    executeScript.mockResolvedValue('{"state":"absent","anchorId":null}');

    expect((await getPopupPanelState()).state).toBe("absent");
  });

  // The anchor is an inner element without an id of its own; the enclosing
  // toolbar item is what identifies the extension.
  it("falls back to the enclosing toolbar item for the anchor", async () => {
    executeScript.mockResolvedValue('{"state":"open","anchorId":null}');

    await getPopupPanelState();

    expect(executeScript).toHaveBeenCalledWith(
      expect.stringContaining('closest?.("toolbaritem")'),
      [POPUP_PANEL_ID],
    );
  });
});
