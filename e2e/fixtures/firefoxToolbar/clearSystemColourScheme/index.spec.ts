import { beforeEach, describe, expect, it, vi } from "vitest";

import { DARK_THEME_PREF } from "../constants";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { clearSystemColourScheme } = await import("./index");

describe("clearSystemColourScheme", () => {
  beforeEach(() => {
    executeScript.mockReset();
  });

  it("clears the override instead of pinning the scheme to light", async () => {
    await clearSystemColourScheme();

    expect(executeScript).toHaveBeenCalledWith(expect.stringContaining("clearUserPref"), [
      DARK_THEME_PREF,
    ]);
  });
});
