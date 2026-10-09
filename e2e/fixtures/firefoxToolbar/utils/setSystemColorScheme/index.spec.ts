import { beforeEach, describe, expect, it, vi } from "vitest";

import { DARK_THEME_PREF } from "../../constants";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { setSystemColorScheme } = await import("./index");

describe("setSystemColorScheme", () => {
  beforeEach(() => {
    executeScript.mockReset();
  });

  it("sets the override preference as an integer", async () => {
    await setSystemColorScheme("dark");

    expect(executeScript).toHaveBeenCalledWith(expect.stringContaining("setIntPref"), [
      DARK_THEME_PREF,
      1,
    ]);
  });

  it("writes the light value as well, so the override can be flipped back", async () => {
    await setSystemColorScheme("light");

    expect(executeScript).toHaveBeenCalledWith(expect.anything(), [DARK_THEME_PREF, 0]);
  });
});
