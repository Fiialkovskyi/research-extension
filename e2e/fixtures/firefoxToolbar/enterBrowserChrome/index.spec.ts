import { beforeEach, describe, expect, it, vi } from "vitest";

const { setMozContext } = vi.hoisted(() => ({ setMozContext: vi.fn() }));

vi.mock("@wdio/globals", () => ({ browser: { setMozContext } }));

const { enterBrowserChrome } = await import("./index");

describe("enterBrowserChrome", () => {
  beforeEach(() => {
    setMozContext.mockReset();
  });

  // Firefox rejects "CHROME" with `unknown variant`, so the casing is part of
  // the contract rather than a style choice.
  it("switches with the lowercase spelling Marionette accepts", async () => {
    await enterBrowserChrome();

    expect(setMozContext).toHaveBeenCalledWith("chrome");
  });
});
