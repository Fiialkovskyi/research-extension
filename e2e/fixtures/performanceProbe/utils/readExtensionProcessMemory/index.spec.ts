import { describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({
  browser: {
    executeScript: vi.fn(() => Promise.resolve('[{"type":"extension","memory":42}]')),
  },
}));

vi.mock("@wdio/globals", () => ({ browser }));

const { readExtensionProcessMemory } = await import("./index");

describe("readExtensionProcessMemory", () => {
  it("minimises memory first, then reads the extension process's memory", async () => {
    expect(await readExtensionProcessMemory()).toBe(42);
    expect(browser.executeScript).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("minimizeMemoryUsage"),
      [],
    );
  });
});
