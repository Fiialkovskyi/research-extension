import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { openTabOutsideGroups } = await import("./index");

describe("openTabOutsideGroups", () => {
  it("runs the opener script in the chrome context", async () => {
    await openTabOutsideGroups("http://127.0.0.1:1/b.html");

    expect(executeScript).toHaveBeenCalledWith(expect.stringContaining("addTrustedTab"), []);
  });
});
