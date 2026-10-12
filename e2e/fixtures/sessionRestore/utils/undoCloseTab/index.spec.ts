import { describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

const { undoCloseTab } = await import("./index");

describe("undoCloseTab", () => {
  it("runs the same command as Ctrl+Shift+T", async () => {
    await undoCloseTab();

    expect(executeScript).toHaveBeenCalledWith(
      expect.stringContaining("SessionWindowUI.undoCloseTab(window)"),
      [],
    );
  });
});
