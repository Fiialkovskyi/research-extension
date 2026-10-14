import { $ } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../../firefoxToolbar/constants";
import { enterBrowserChrome } from "../../../firefoxToolbar/utils";
import { switchToMapTab } from "../switchToMapTab";

/** A view of the map, as its switcher names it. */
export type MapViewName = "history" | "tree" | "anchors" | "telemetry";

/** The element each view renders as its root, by test id. */
const VIEW_ROOTS: Record<MapViewName, string> = {
  history: "map-history",
  tree: "research-map",
  anchors: "map-anchors",
  telemetry: "map-telemetry",
};

/**
 * Picks a view with the map's switcher, as a person would, and waits until the
 * view is drawn. Must be called in the chrome context, and returns to it.
 */
export const switchMapView = async (view: MapViewName): Promise<void> => {
  try {
    await switchToMapTab();
    await $(`[data-testid="map-view-${view}"]`).click();
    await $(`[data-testid="${VIEW_ROOTS[view]}"]`).waitForExist({ timeout: UI_TIMEOUT_MS });
  } finally {
    await enterBrowserChrome();
  }
};
