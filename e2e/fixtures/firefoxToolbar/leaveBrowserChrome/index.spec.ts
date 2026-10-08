import { beforeEach, describe, expect, it, vi } from "vitest";

const { setMozContext } = vi.hoisted(() => ({ setMozContext: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { setMozContext } }));

const { leaveBrowserChrome } = await import("./index");

describe("leaveBrowserChrome", () => {
  beforeEach(() => {
    setMozContext.mockReset();
  });

  it("switches back with the lowercase spelling as well", async () => {
    await leaveBrowserChrome();

    expect(setMozContext).toHaveBeenCalledWith("content");
  });
});
