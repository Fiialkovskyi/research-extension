import { describe, expect, it, vi } from "vitest";

const { browser, element } = vi.hoisted(() => ({
  browser: { url: vi.fn(), execute: vi.fn() },
  element: { waitForExist: vi.fn() },
}));

vi.mock("@wdio/globals", () => ({ browser, $: () => element }));
vi.mock("../../../firefoxExtension/utils", () => ({
  getExtensionUrl: (path: string) => `moz-extension://test/${path}`,
}));

const { readLifetimeProbes } = await import("./index");

describe("readLifetimeProbes", () => {
  it("opens the options page, waits for the card and reads its runs", async () => {
    browser.execute.mockResolvedValue(
      JSON.stringify([{ runId: "a", strategy: "none", state: "stopped", text: "" }]),
    );

    expect(await readLifetimeProbes()).toEqual([
      { runId: "a", strategy: "none", state: "stopped", text: "" },
    ]);
    expect(browser.url).toHaveBeenCalledWith("moz-extension://test/options.html");
    expect(element.waitForExist).toHaveBeenCalled();
  });
});
