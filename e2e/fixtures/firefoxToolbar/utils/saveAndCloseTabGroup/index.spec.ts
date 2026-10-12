import { describe, expect, it, vi } from "vitest";

const { executeAsyncScript } = vi.hoisted(() => ({ executeAsyncScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeAsyncScript } }));

const { saveAndCloseTabGroup } = await import("./index");

describe("saveAndCloseTabGroup", () => {
  it("returns the saved group's internal id", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify("1791-93"));

    expect(await saveAndCloseTabGroup("Motors")).toBe("1791-93");
  });

  it("says which group could not be saved", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify(null));

    await expect(saveAndCloseTabGroup("Motors")).rejects.toThrow(
      'Could not save the group "Motors"',
    );
  });
});
