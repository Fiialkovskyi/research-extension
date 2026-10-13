import { afterEach, describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({ browser: { executeScript: vi.fn() } }));

vi.mock("@wdio/globals", () => ({ browser }));

const { setBackgroundIdleTimeout } = await import("./index");

afterEach(() => {
  browser.executeScript.mockReset();
});

describe("setBackgroundIdleTimeout", () => {
  it("sets the idle timeout preference to the given milliseconds", async () => {
    await setBackgroundIdleTimeout(8_000);

    expect(browser.executeScript).toHaveBeenCalledWith(expect.stringContaining("setIntPref"), [
      "extensions.background.idle.timeout",
      8_000,
    ]);
  });

  it("restores Firefox's default when given nothing", async () => {
    await setBackgroundIdleTimeout(undefined);

    expect(browser.executeScript).toHaveBeenCalledWith(expect.stringContaining("clearUserPref"), [
      "extensions.background.idle.timeout",
    ]);
  });
});
