import { $, browser } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../constants";
import { enterBrowserChrome } from "../enterBrowserChrome";
import { leaveBrowserChrome } from "../leaveBrowserChrome";

/**
 * Clicks an element in the page of the tab whose URL ends with `urlEnding`, as
 * a person would. Must be called in the chrome context, and returns to it.
 *
 * Goes through the content context's real input: a click a page script made
 * would not count as the user's, and Firefox would refuse to open a link in a
 * new tab from it.
 *
 * @throws If no tab comes to show such a URL in time.
 */
export const clickInTabShowing = async (urlEnding: string, selector: string): Promise<void> => {
  await leaveBrowserChrome();

  try {
    // Polled: a page the tab was just sent to is not yet the one its window shows.
    await browser.waitUntil(
      async () => {
        for (const handle of await browser.getWindowHandles()) {
          await browser.switchToWindow(handle);

          if ((await browser.getUrl()).endsWith(urlEnding)) {
            return true;
          }
        }

        return false;
      },
      {
        timeout: UI_TIMEOUT_MS,
        timeoutMsg: `No tab shows a URL ending in "${urlEnding}".`,
      },
    );

    const element = $(selector);

    await element.waitForClickable({ timeout: UI_TIMEOUT_MS });
    await element.click();
  } finally {
    await enterBrowserChrome();
  }
};
