import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { ungroupTab } = await import("./index");

describe("ungroupTab", () => {
  it("resolves once the chrome context ungrouped the tab", async () => {
    executeScript.mockResolvedValue(JSON.stringify(true));

    await expect(ungroupTab("http://x/b.html")).resolves.toBeUndefined();
  });

  it("names the tab it could not find", async () => {
    executeScript.mockResolvedValue(JSON.stringify(false));

    await expect(ungroupTab("http://x/b.html")).rejects.toThrow("No tab shows http://x/b.html");
  });
});
