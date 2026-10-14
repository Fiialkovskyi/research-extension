import { describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({ browser: { executeScript: vi.fn() } }));

vi.mock("@wdio/globals", () => ({ browser }));

const { probeEgress } = await import("./index");

describe("probeEgress", () => {
  it("requests the URL as the add-on, in the chrome context", async () => {
    await probeEgress("http://127.0.0.1:1/probe", "a@b");

    expect(browser.executeScript).toHaveBeenCalledWith(
      expect.stringContaining('uri: "http://127.0.0.1:1/probe"'),
      [],
    );
  });
});
