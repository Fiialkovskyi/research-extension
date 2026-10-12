import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { reopenSavedTabGroup } = await import("./index");

describe("reopenSavedTabGroup", () => {
  it("returns the id the group came back with", async () => {
    executeScript.mockResolvedValue(JSON.stringify("1791-93"));

    expect(await reopenSavedTabGroup("1791-93")).toBe("1791-93");
  });

  it("says nothing was saved under the id", async () => {
    executeScript.mockResolvedValue(JSON.stringify(null));

    await expect(reopenSavedTabGroup("missing")).rejects.toThrow(
      'No group is saved under "missing".',
    );
  });
});
