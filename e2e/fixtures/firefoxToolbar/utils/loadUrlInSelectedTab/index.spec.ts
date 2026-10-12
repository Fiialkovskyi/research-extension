import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { loadUrlInSelectedTab } = await import("./index");

describe("loadUrlInSelectedTab", () => {
  it("runs the loader script in the chrome context", async () => {
    executeScript.mockResolvedValue(null);

    await loadUrlInSelectedTab("http://127.0.0.1:1/a.html");

    expect(executeScript).toHaveBeenCalledWith(expect.stringContaining("openTrustedLinkIn"), []);
  });
});
