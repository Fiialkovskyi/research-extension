import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { moveTabToGroup } = await import("./index");

describe("moveTabToGroup", () => {
  it("resolves once the chrome context moved the tab", async () => {
    executeScript.mockResolvedValue(JSON.stringify(true));

    await expect(moveTabToGroup("http://x/b.html", "Motors")).resolves.toBeUndefined();
  });

  it("names the tab and group it could not find", async () => {
    executeScript.mockResolvedValue(JSON.stringify(false));

    await expect(moveTabToGroup("http://x/b.html", "Motors")).rejects.toThrow(
      'Could not move the tab showing http://x/b.html into the group "Motors".',
    );
  });
});
