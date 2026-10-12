import { $, browser } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../../firefoxToolbar/constants";
import { enterBrowserChrome } from "../../../firefoxToolbar/utils";
import { switchToMapTab } from "../switchToMapTab";

/** How the user activates a node: a pointer click, or Enter on the focused node. */
export type MapActivation = "click" | "keyboard";

/**
 * Activates the map node labelled `label`, as a person would, through the
 * content context's real input. Must be called in the chrome context, and
 * returns to it.
 *
 * The selection is not restored afterwards: what activating a node selects is
 * what the caller checks. Reaching the map selects its tab first, so a node
 * that changes nothing leaves the map's tab selected.
 */
export const activateMapNode = async (
  label: string,
  activation: MapActivation = "click",
): Promise<void> => {
  try {
    await switchToMapTab();

    const selector = `[data-testid="map-node"][title=${JSON.stringify(label)}]`;
    const node = $(selector);

    await node.waitForExist({ timeout: UI_TIMEOUT_MS });

    if (activation === "keyboard") {
      // Found again in the page: an element handle does not cross into a
      // script as a DOM node over BiDi.
      await browser.execute((nodeSelector: string) => {
        document.querySelector<HTMLElement>(nodeSelector)?.focus();
      }, selector);
      await browser.keys("Enter");
    } else {
      await node.click();
    }
  } finally {
    await enterBrowserChrome();
  }
};
