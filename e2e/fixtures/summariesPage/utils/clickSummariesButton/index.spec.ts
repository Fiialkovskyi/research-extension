import { describe, expect, it, vi } from "vitest";

const { $$, click, switchToSummariesTab, enterBrowserChrome } = vi.hoisted(() => {
  const clickElement = vi.fn();

  return {
    click: clickElement,
    $$: vi.fn(() =>
      Promise.resolve([
        { click: clickElement, waitForClickable: vi.fn() },
        { click: vi.fn(), waitForClickable: vi.fn() },
      ]),
    ),
    switchToSummariesTab: vi.fn(),
    enterBrowserChrome: vi.fn(),
  };
});

vi.mock("@wdio/globals", () => ({ $$ }));
vi.mock("../switchToSummariesTab", () => ({ switchToSummariesTab }));
vi.mock("../../../firefoxToolbar/utils", () => ({ enterBrowserChrome }));

const { clickSummariesButton } = await import("./index");

describe("clickSummariesButton", () => {
  it("clicks the first control of that id in the page, and returns to the chrome context", async () => {
    await clickSummariesButton("gap-search");

    expect($$).toHaveBeenCalledWith('[data-testid="gap-search"]');
    expect(click).toHaveBeenCalled();
    expect(switchToSummariesTab).toHaveBeenCalled();
    expect(enterBrowserChrome).toHaveBeenCalled();
  });

  it("fails when the page has no such control", async () => {
    $$.mockResolvedValueOnce([]);

    await expect(clickSummariesButton("missing")).rejects.toThrow('no control "missing"');
    expect(enterBrowserChrome).toHaveBeenCalled();
  });
});
