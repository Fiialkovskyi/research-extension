import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeScript } = vi.hoisted(() => ({ executeScript: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { executeScript } }));

import { readToolbarBadge } from ".";

beforeEach(() => {
  executeScript.mockReset();
});

describe("readToolbarBadge", () => {
  it("reads the badge off the add-on's own button", async () => {
    executeScript.mockResolvedValue("!");

    expect(await readToolbarBadge()).toBe("!");
    expect(executeScript.mock.calls[0]?.[0]).toContain("browser-action");
  });
});
