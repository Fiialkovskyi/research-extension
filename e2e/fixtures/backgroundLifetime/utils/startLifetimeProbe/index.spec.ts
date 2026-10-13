import { describe, expect, it, vi } from "vitest";

const { browser, element } = vi.hoisted(() => ({
  browser: {
    url: vi.fn(),
    execute: vi.fn(),
    waitUntil: vi.fn(async (condition: () => Promise<boolean>) => {
      if (!(await condition())) {
        throw new Error("timed out");
      }
    }),
  },
  element: { waitForExist: vi.fn() },
}));

vi.mock("@wdio/globals", () => ({ browser, $: () => element }));
vi.mock("../../../firefoxExtension/utils", () => ({
  getExtensionUrl: (path: string) => `moz-extension://test/${path}`,
}));

const { startLifetimeProbe } = await import("./index");

const runs = (...ids: string[]) =>
  JSON.stringify(ids.map((runId) => ({ runId, strategy: "none", state: "running", text: "" })));

describe("startLifetimeProbe", () => {
  it("starts a run, returns its id, and leaves the page", async () => {
    browser.execute
      .mockResolvedValueOnce(runs("old"))
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(runs("new", "old"));

    expect(await startLifetimeProbe("apiActivity", 20)).toBe("new");
    expect(browser.execute.mock.calls[1]?.[0]).toContain('"apiActivity"');
    expect(browser.url).toHaveBeenLastCalledWith("about:blank");
  });

  it("fails when the card is missing a control", async () => {
    browser.execute.mockResolvedValueOnce(runs()).mockResolvedValueOnce("probe-start");

    await expect(startLifetimeProbe("none", 20)).rejects.toThrow("no probe-start");
  });

  it("fails when no new run appears", async () => {
    browser.execute.mockReset();
    browser.execute
      .mockResolvedValueOnce(runs("old"))
      .mockResolvedValueOnce(true)
      .mockResolvedValue(runs("old"));

    await expect(startLifetimeProbe("none", 20)).rejects.toThrow("timed out");
  });
});
