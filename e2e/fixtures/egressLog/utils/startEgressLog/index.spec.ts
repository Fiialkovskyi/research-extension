import { describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({ browser: { executeScript: vi.fn() } }));

vi.mock("@wdio/globals", () => ({ browser }));

const { startEgressLog } = await import("./index");

describe("startEgressLog", () => {
  it("starts recording this add-on's requests in the chrome context", async () => {
    await startEgressLog("research-graph@example.org");

    expect(browser.executeScript).toHaveBeenCalledWith(
      expect.stringContaining('const extensionId = "research-graph@example.org"'),
      [],
    );
  });
});
