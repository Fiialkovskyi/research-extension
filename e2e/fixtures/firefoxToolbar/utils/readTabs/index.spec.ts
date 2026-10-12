import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { readTabs } = await import("./index");

describe("readTabs", () => {
  it("parses the tabs the chrome context reports", async () => {
    executeScript.mockResolvedValue(
      JSON.stringify([{ url: "https://example.org/", selected: true, group: null }]),
    );

    await expect(readTabs()).resolves.toEqual([
      { url: "https://example.org/", selected: true, group: null },
    ]);
  });

  it("refuses something other than a list of tabs", async () => {
    executeScript.mockResolvedValue(JSON.stringify([{ url: 1 }]));

    await expect(readTabs()).rejects.toThrow();
  });

  it("explains itself when the script returns no string", async () => {
    executeScript.mockResolvedValue(null);

    await expect(readTabs()).rejects.toThrow(/JSON string, got object/);
  });
});
