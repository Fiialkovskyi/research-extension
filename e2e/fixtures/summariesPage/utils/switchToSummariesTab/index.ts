import { browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import { UI_TIMEOUT_MS } from "../../../firefoxToolbar/constants";
import { leaveBrowserChrome } from "../../../firefoxToolbar/utils";
import { SUMMARIES_PAGE_PATH } from "../../constants";

/**
 * Switches WebDriver to the loaded Summaries tab, in the content
 * context. The caller returns to the chrome context.
 */
export const switchToSummariesTab = async (): Promise<void> => {
  const pageUrl = getExtensionUrl(SUMMARIES_PAGE_PATH);

  await leaveBrowserChrome();
  await browser.waitUntil(
    async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);

        if (
          (await browser.getUrl()).split(/[?#]/)[0] === pageUrl &&
          (await browser.execute(() => document.readyState)) === "complete"
        ) {
          return true;
        }
      }

      return false;
    },
    { timeout: UI_TIMEOUT_MS, timeoutMsg: "No tab shows Summaries." },
  );
};
