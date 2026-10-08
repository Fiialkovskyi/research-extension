import { describe, expect, it } from "vitest";

import { parsePanelState } from "./index";

describe("parsePanelState", () => {
  it("reads the state and anchor the privileged script reported", () => {
    expect(parsePanelState('{"state":"open","anchorId":"widget-id"}')).toEqual({
      state: "open",
      anchorId: "widget-id",
    });
  });

  it("keeps a null anchor null, for a panel that hangs from nothing", () => {
    expect(parsePanelState('{"state":"closed","anchorId":null}').anchorId).toBeNull();
  });

  it("fails loudly when the script returned something other than a JSON string", () => {
    expect(() => parsePanelState(undefined)).toThrow(/Expected the panel state as a JSON string/);
  });

  it("names the type it got, so the failure is diagnosable", () => {
    expect(() => parsePanelState(42)).toThrow(/got number/);
  });
});
