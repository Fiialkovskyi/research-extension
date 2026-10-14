import { beforeEach, describe, expect, it, vi } from "vitest";

const { browser, element, $, switchToMapTab } = vi.hoisted(() => {
  const found = { waitForExist: vi.fn(), click: vi.fn() };

  return {
    browser: { setMozContext: vi.fn() },
    element: found,
    $: vi.fn(() => found),
    switchToMapTab: vi.fn(),
  };
});

vi.mock("@wdio/globals", () => ({ browser, $ }));
vi.mock("../switchToMapTab", () => ({ switchToMapTab }));

const { switchMapView } = await import("./index");

describe("switchMapView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clicks the view's button, waits for its root and returns to the chrome context", async () => {
    await switchMapView("telemetry");

    expect($).toHaveBeenNthCalledWith(1, '[data-testid="map-view-telemetry"]');
    expect($).toHaveBeenNthCalledWith(2, '[data-testid="map-telemetry"]');
    expect(element.click).toHaveBeenCalledTimes(1);
    expect(element.waitForExist).toHaveBeenCalledTimes(1);
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });

  it("waits for the tree's own root", async () => {
    await switchMapView("tree");

    expect($).toHaveBeenLastCalledWith('[data-testid="research-map"]');
  });

  it("returns to the chrome context when the map cannot be found", async () => {
    switchToMapTab.mockRejectedValueOnce(new Error("No tab shows the research map."));

    await expect(switchMapView("history")).rejects.toThrow(/research map/);
    expect(browser.setMozContext).toHaveBeenLastCalledWith("chrome");
  });
});
