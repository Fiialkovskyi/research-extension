import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { closeTabGroup } = await import("./index");

describe("closeTabGroup", () => {
  it("resolves once the chrome context closed the group's tabs", async () => {
    executeScript.mockResolvedValue(JSON.stringify(1));

    await expect(closeTabGroup("Motors")).resolves.toBeUndefined();
  });

  it("says which group was missing", async () => {
    executeScript.mockResolvedValue(JSON.stringify(0));

    await expect(closeTabGroup("Motors")).rejects.toThrow('No tab group titled "Motors" to close.');
  });
});
