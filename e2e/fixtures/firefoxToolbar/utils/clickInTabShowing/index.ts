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
 * @throws If no tab shows such a URL.
 */
export const clickInTabShowing = async (urlEnding: string, selector: string): Promise<void> => {
  await leaveBrowserChrome();

  try {
    let found = false;

    for (const handle of await browser.getWindowHandles()) {
      await browser.switchToWindow(handle);

      if ((await browser.getUrl()).endsWith(urlEnding)) {
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(`No tab shows a URL ending in "${urlEnding}".`);
    }

    const element = $(selector);

    await element.waitForClickable({ timeout: UI_TIMEOUT_MS });
    await element.click();
  } finally {
    await enterBrowserChrome();
  }
};
