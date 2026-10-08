import { beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_ID } from "@/shared/config/extension";

import { NAV_BAR_AREA } from "../constants";
import { getToolbarWidgetId } from "../getToolbarWidgetId";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { placeToolbarAction } = await import("./index");

describe("placeToolbarAction", () => {
  beforeEach(() => {
    executeScript.mockReset();
  });

  it("places this extension's widget through Firefox's customisation API", async () => {
    executeScript.mockResolvedValue(NAV_BAR_AREA);

    await placeToolbarAction();

    expect(executeScript).toHaveBeenCalledWith(expect.stringContaining("CustomizableUI"), [
      getToolbarWidgetId(EXTENSION_ID),
    ]);
  });

  it("fails when Firefox parked the widget elsewhere", async () => {
    executeScript.mockResolvedValue("unified-extensions-area");

    await expect(placeToolbarAction()).rejects.toThrow(/not on the navigation bar/);
  });
});
