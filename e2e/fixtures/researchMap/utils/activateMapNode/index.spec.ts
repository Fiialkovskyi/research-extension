import { beforeEach, describe, expect, it, vi } from "vitest";

const { browser, node, $, switchToMapTab } = vi.hoisted(() => {
  const element = { waitForExist: vi.fn(), click: vi.fn() };

  return {
    browser: { execute: vi.fn(), keys: vi.fn(), setMozContext: vi.fn() },
    node: element,
    $: vi.fn(() => element),
    switchToMapTab: vi.fn(),
  };
});

vi.mock("@wdio/globals", () => ({ browser, $ }));
vi.mock("../switchToMapTab", () => ({ switchToMapTab }));

const { activateMapNode } = await import("./index");

describe("activateMapNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clicks the node with the label and returns to the chrome context", async () => {
    await activateMapNode('Page "B"');

    expect($).toHaveBeenCalledWith('[data-testid="map-node"][title="Page \\"B\\""]');
    expect(node.click).toHaveBeenCalledTimes(1);
    expect(browser.keys).not.toHaveBeenCalled();
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });

  it("focuses the node and presses Enter when activated from the keyboard", async () => {
    await activateMapNode("Page B", "keyboard");

    expect(browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      '[data-testid="map-node"][title="Page B"]',
    );
    expect(browser.keys).toHaveBeenCalledWith("Enter");
    expect(node.click).not.toHaveBeenCalled();
  });

  it("returns to the chrome context when the map cannot be found", async () => {
    switchToMapTab.mockRejectedValueOnce(new Error("No tab shows the research map."));

    await expect(activateMapNode("Page B")).rejects.toThrow(/research map/);
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
