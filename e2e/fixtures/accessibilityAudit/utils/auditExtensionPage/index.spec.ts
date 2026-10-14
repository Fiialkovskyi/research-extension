import { describe, expect, it, vi } from "vitest";

const { browser } = vi.hoisted(() => ({
  browser: {
    url: vi.fn(),
    waitUntil: vi.fn(),
    pause: vi.fn(),
    execute: vi.fn(() => Promise.resolve("[]")),
  },
}));

vi.mock("@wdio/globals", () => ({ browser }));

const { auditExtensionPage } = await import("./index");

describe("auditExtensionPage", () => {
  it("loads the page, waits for it, and runs axe in it", async () => {
    expect(await auditExtensionPage("options.html")).toEqual([]);
    expect(browser.url).toHaveBeenCalledWith(expect.stringContaining("options.html"));
    expect(browser.execute).toHaveBeenLastCalledWith(expect.stringContaining("axe"));
  });

  it("runs a preparation script before the audit", async () => {
    await auditExtensionPage("options.html", "document.body.append('x');");

    expect(browser.execute).toHaveBeenCalledWith("document.body.append('x');");
  });
});
