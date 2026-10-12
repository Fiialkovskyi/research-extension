import { describe, expect, it, vi } from "vitest";

const { $, click, switchToRecordedTab, enterBrowserChrome } = vi.hoisted(() => {
  const clickElement = vi.fn();

  return {
    click: clickElement,
    $: vi.fn(() => ({ click: clickElement, waitForClickable: vi.fn() })),
    switchToRecordedTab: vi.fn(),
    enterBrowserChrome: vi.fn(),
  };
});

vi.mock("@wdio/globals", () => ({ $ }));
vi.mock("../switchToRecordedTab", () => ({ switchToRecordedTab }));
vi.mock("../../../firefoxToolbar/utils", () => ({ enterBrowserChrome }));

const { clickRecordedButton } = await import("./index");

describe("clickRecordedButton", () => {
  it("clicks the control inside the named entry, and returns to the chrome context", async () => {
    await clickRecordedButton("recorded-show-text", "node-a");

    expect($).toHaveBeenCalledWith(
      '[data-testid="recorded-entry"][data-node-id="node-a"] [data-testid="recorded-show-text"]',
    );
    expect(click).toHaveBeenCalled();
    expect(enterBrowserChrome).toHaveBeenCalled();
  });

  it("clicks the first control of that id when no entry is named", async () => {
    await clickRecordedButton("recorded-delete-session");

    expect($).toHaveBeenLastCalledWith('[data-testid="recorded-delete-session"]');
  });
});
