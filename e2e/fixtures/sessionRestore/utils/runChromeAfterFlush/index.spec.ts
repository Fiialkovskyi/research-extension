import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeAsyncScript } = vi.hoisted(() => ({ executeAsyncScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeAsyncScript } }));

const { runChromeAfterFlush } = await import("./index");

describe("runChromeAfterFlush", () => {
  beforeEach(() => {
    executeAsyncScript.mockReset();
  });

  it("runs the body after a flush and returns its value", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ ok: "1791-9" }));

    expect(await runChromeAfterFlush("return 1;")).toBe("1791-9");
    expect(executeAsyncScript).toHaveBeenCalledWith(
      expect.stringMatching(/flushWindow[\s\S]*return 1;/),
      [],
    );
  });

  it("throws the body's own failure", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ error: "Error: boom" }));

    await expect(runChromeAfterFlush("throw 1;")).rejects.toThrow("boom");
  });
});
