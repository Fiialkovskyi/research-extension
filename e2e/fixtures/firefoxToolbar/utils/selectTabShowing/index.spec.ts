import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { selectTabShowing } = await import("./index");

describe("selectTabShowing", () => {
  it("resolves when the tab was selected", async () => {
    executeScript.mockResolvedValue(true);

    await expect(selectTabShowing("/a.html")).resolves.toBeUndefined();
    expect(executeScript.mock.calls[0]?.[0]).toContain('"/a.html"');
  });

  it("fails when no tab shows the address", async () => {
    executeScript.mockResolvedValue(false);

    await expect(selectTabShowing("/a.html")).rejects.toThrow(/No tab shows/);
  });
});
