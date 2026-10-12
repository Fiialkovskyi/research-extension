import { describe, expect, it, vi } from "vitest";

const { executeAsyncScript } = vi.hoisted(() => ({ executeAsyncScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeAsyncScript } }));

const { openPageInGroup } = await import("./index");

describe("openPageInGroup", () => {
  it("returns the group's tab count once the page has loaded", async () => {
    executeAsyncScript.mockResolvedValue(JSON.stringify({ ok: 2 }));

    expect(await openPageInGroup("Motors", "http://127.0.0.1/a")).toBe(2);
    expect(executeAsyncScript).toHaveBeenCalledWith(expect.stringContaining('"Motors"'), []);
  });

  it("throws when the group is missing", async () => {
    executeAsyncScript.mockResolvedValue(
      JSON.stringify({ error: 'No tab group titled "Motors".' }),
    );

    await expect(openPageInGroup("Motors", "http://127.0.0.1/a")).rejects.toThrow("No tab group");
  });
});
