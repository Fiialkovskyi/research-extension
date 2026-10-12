import { describe, expect, it, vi } from "vitest";

import { buildGroupSaverScript } from ".";

/** Runs the asynchronous script against stand-ins, resolving with what it reports. */
const run = (gBrowser: unknown, label: string) =>
  new Promise<unknown>((resolve) => {
    const ChromeUtils = {
      importESModule: () => ({ TabStateFlusher: { flushWindow: () => Promise.resolve() } }),
    };
    const script = new Function("gBrowser", "ChromeUtils", "window", buildGroupSaverScript(label));

    script.call(undefined, gBrowser, ChromeUtils, {}, (raw: string) => resolve(JSON.parse(raw)));
  });

describe("buildGroupSaverScript", () => {
  it("saves and closes the labelled group after flushing, reporting its id", async () => {
    const group = { id: "1791-93", label: "Motors", saveAndClose: vi.fn() };

    expect(await run({ tabGroups: [group] }, "Motors")).toBe("1791-93");
    expect(group.saveAndClose).toHaveBeenCalled();
  });

  it("reports null when no group has the label", async () => {
    expect(await run({ tabGroups: [] }, "Motors")).toBeNull();
  });
});
