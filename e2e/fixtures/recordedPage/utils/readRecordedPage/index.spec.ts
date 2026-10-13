import { describe, expect, it, vi } from "vitest";

const { browser, switchToRecordedTab, enterBrowserChrome } = vi.hoisted(() => ({
  browser: { executeScript: vi.fn(), execute: vi.fn() },
  switchToRecordedTab: vi.fn(),
  enterBrowserChrome: vi.fn(),
}));

vi.mock("@wdio/globals", () => ({ browser }));
vi.mock("../switchToRecordedTab", () => ({ switchToRecordedTab }));
vi.mock("../../../firefoxToolbar/utils", () => ({ enterBrowserChrome }));

const { readRecordedPage } = await import("./index");

describe("readRecordedPage", () => {
  it("reads the page in its tab and returns to the chrome context", async () => {
    const empty = { empty: true, title: null, canExtractFacts: false, entries: [] };

    browser.execute.mockResolvedValue(JSON.stringify(empty));

    expect(await readRecordedPage()).toEqual(empty);
    expect(switchToRecordedTab).toHaveBeenCalled();
    expect(enterBrowserChrome).toHaveBeenCalled();
  });
});
