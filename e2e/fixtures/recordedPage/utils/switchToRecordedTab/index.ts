import { browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import { UI_TIMEOUT_MS } from "../../../firefoxToolbar/constants";
import { leaveBrowserChrome } from "../../../firefoxToolbar/utils";
import { RECORDED_PAGE_PATH } from "../../constants";

/**
 * Switches WebDriver to the loaded "What was recorded" tab, in the content
 * context. The caller returns to the chrome context.
 */
export const switchToRecordedTab = async (): Promise<void> => {
  const pageUrl = getExtensionUrl(RECORDED_PAGE_PATH);

  await leaveBrowserChrome();
  await browser.waitUntil(
    async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);

        if (
          (await browser.getUrl()) === pageUrl &&
          (await browser.execute(() => document.readyState)) === "complete"
        ) {
          return true;
        }
      }

      return false;
    },
    { timeout: UI_TIMEOUT_MS, timeoutMsg: 'No tab shows "What was recorded".' },
  );
};
