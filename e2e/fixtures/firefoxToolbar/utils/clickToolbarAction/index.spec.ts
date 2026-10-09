import { beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_ID } from "@/shared/config";

import { ELEMENT_KEY } from "../../constants";
import { getToolbarWidgetId } from "../getToolbarWidgetId";
import { buildPointerClickActions } from "../buildPointerClickActions";

const { findElement, performActions } = vi.hoisted(() => ({
  findElement: vi.fn(),
  performActions: vi.fn(),
}));

vi.mock("@wdio/globals", () => ({ browser: { findElement, performActions } }));

const { clickToolbarAction } = await import("./index");

describe("clickToolbarAction", () => {
  beforeEach(() => {
    findElement.mockReset();
    performActions.mockReset();
  });

  it("clicks the element the chrome DOM returned for the widget", async () => {
    findElement.mockResolvedValue({ [ELEMENT_KEY]: "element-7" });

    await clickToolbarAction();

    expect(findElement).toHaveBeenCalledWith(
      "css selector",
      `#${getToolbarWidgetId(EXTENSION_ID)}`,
    );
    expect(performActions).toHaveBeenCalledWith(buildPointerClickActions("element-7"));
  });

  it("explains that the widget is missing instead of clicking nothing", async () => {
    findElement.mockResolvedValue({});

    await expect(clickToolbarAction()).rejects.toThrow(/is not in the chrome DOM/);
    expect(performActions).not.toHaveBeenCalled();
  });
});
