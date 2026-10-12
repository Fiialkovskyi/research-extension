import { describe, expect, it, vi } from "vitest";

import { buildFlushedChromeScript } from ".";

/**
 * Runs the script against stand-ins for the chrome globals it touches. The
 * callback goes in as the last argument, which is where `arguments` finds it.
 */
const run = async (
  body: string,
  flushWindow: () => Promise<void>,
  order: string[] = [],
): Promise<unknown> => {
  return new Promise((resolve) => {
    const ChromeUtils = { importESModule: () => ({ TabStateFlusher: { flushWindow } }) };
    const script = new Function("ChromeUtils", "window", "order", buildFlushedChromeScript(body));

    script(ChromeUtils, {}, order, (raw: string) => resolve(JSON.parse(raw)));
  });
};

describe("buildFlushedChromeScript", () => {
  it("runs the body only after the window has flushed", async () => {
    const order: string[] = [];
    const flushWindow = vi.fn(async () => {
      order.push("flush");
    });

    expect(await run(`order.push("body"); return "done";`, flushWindow, order)).toEqual({
      ok: "done",
    });
    expect(order).toEqual(["flush", "body"]);
  });

  it("answers a body that throws as an error", async () => {
    expect(await run(`throw new Error("no group");`, async () => {})).toEqual({
      error: "Error: no group",
    });
  });
});
