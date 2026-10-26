import { browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import { UI_TIMEOUT_MS } from "../../../firefoxToolbar/constants";
import { leaveBrowserChrome } from "../../../firefoxToolbar/utils";
import { MAP_PAGE_PATH } from "../../constants";

/**
 * Attaches the content-side driver to the map's tab, once its page has loaded.
 * Leaves the content context active.
 *
 * Switching to a tab selects it in Firefox, so a caller that must not change
 * the selection remembers and restores it around this.
 *
 * @throws If no tab shows the map within the UI timeout.
 */
export const switchToMapTab = async (): Promise<void> => {
  const mapUrl = getExtensionUrl(MAP_PAGE_PATH);

  await leaveBrowserChrome();
  await browser.waitUntil(
    async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);

        // The map keeps its current view in the fragment (`#telemetry`).
        if (
          (await browser.getUrl()).split(/[?#]/)[0] === mapUrl &&
          (await browser.execute(() => document.readyState)) === "complete"
        ) {
          return true;
        }
      }

      return false;
    },
    { timeout: UI_TIMEOUT_MS, timeoutMsg: "No tab shows the research map." },
  );
};
