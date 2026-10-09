import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { readTabGroups } = await import("./index");

describe("readTabGroups", () => {
  it("returns the groups the chrome context reported", async () => {
    executeScript.mockResolvedValue(
      JSON.stringify([{ label: "Motors", color: "red", tabCount: 1 }]),
    );

    expect(await readTabGroups()).toEqual([{ label: "Motors", color: "red", tabCount: 1 }]);
  });
});
