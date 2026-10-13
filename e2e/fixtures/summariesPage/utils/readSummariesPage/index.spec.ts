import { describe, expect, it, vi } from "vitest";

const { browser, switchToSummariesTab, enterBrowserChrome } = vi.hoisted(() => ({
  browser: { executeScript: vi.fn(), execute: vi.fn() },
  switchToSummariesTab: vi.fn(),
  enterBrowserChrome: vi.fn(),
}));

vi.mock("@wdio/globals", () => ({ browser }));
vi.mock("../switchToSummariesTab", () => ({ switchToSummariesTab }));
vi.mock("../../../firefoxToolbar/utils", () => ({ enterBrowserChrome }));

const { readSummariesPage } = await import("./index");

describe("readSummariesPage", () => {
  it("reads the page in its tab and returns to the chrome context", async () => {
    const empty = { empty: true, title: null, needsModel: false, clusters: [] };

    browser.execute.mockResolvedValue(JSON.stringify(empty));

    expect(await readSummariesPage()).toEqual(empty);
    expect(switchToSummariesTab).toHaveBeenCalled();
    expect(enterBrowserChrome).toHaveBeenCalled();
  });
});
