import { describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({ browser: { executeScript: vi.fn() } }));

vi.mock("@wdio/globals", () => ({ browser }));

const { grantPageAccess } = await import("./index");

describe("grantPageAccess", () => {
  it("runs the grant for this extension in the chrome context", async () => {
    await grantPageAccess("research-graph@example.org");

    expect(browser.executeScript).toHaveBeenCalledWith(
      expect.stringContaining('getByID("research-graph@example.org")'),
      [],
    );
  });
});
