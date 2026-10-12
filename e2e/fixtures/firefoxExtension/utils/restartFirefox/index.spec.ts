import { describe, expect, it, vi } from "vitest";

const { browser, readFirefoxZipAsBase64 } = vi.hoisted(() => ({
  browser: { reloadSession: vi.fn(), installAddOn: vi.fn() },
  readFirefoxZipAsBase64: vi.fn(() => "UEsDBA=="),
}));

vi.mock("@wdio/globals", () => ({ browser }));
vi.mock("../readFirefoxZipAsBase64", () => ({ readFirefoxZipAsBase64 }));

const { restartFirefox } = await import("./index");

describe("restartFirefox", () => {
  it("restarts with the given capabilities, then installs the add-on again", async () => {
    const capabilities = { browserName: "firefox" };

    await restartFirefox(capabilities);

    expect(browser.reloadSession).toHaveBeenCalledWith(capabilities);
    expect(browser.installAddOn).toHaveBeenCalledWith("UEsDBA==", true);
    expect(browser.reloadSession.mock.invocationCallOrder[0]).toBeLessThan(
      browser.installAddOn.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
