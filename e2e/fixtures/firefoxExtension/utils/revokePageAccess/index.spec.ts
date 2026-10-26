import { describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({ browser: { executeScript: vi.fn() } }));

vi.mock("@wdio/globals", () => ({ browser }));

const { revokePageAccess } = await import("./index");

describe("revokePageAccess", () => {
  it("runs the revoke for this extension in the chrome context", async () => {
    await revokePageAccess("research-graph@example.org");

    expect(browser.executeScript).toHaveBeenCalledWith(
      expect.stringContaining('getByID("research-graph@example.org")'),
      [],
    );
  });
});
