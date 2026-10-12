import { browser } from "@wdio/globals";

import { enterBrowserChrome } from "../enterBrowserChrome";
import { leaveBrowserChrome } from "../leaveBrowserChrome";

/**
 * Scrolls the page of the tab whose URL ends with `urlEnding` so that
 * `fraction` of the way down is at the top of the view. Must be called in the
 * chrome context, and returns to it.
 *
 * The page scrolls itself, but the `scroll` events that follow are the
 * browser's own, which is all a page observer listens to.
 *
 * @throws If no tab shows such a URL.
 */
export const scrollInTabShowing = async (urlEnding: string, fraction: number): Promise<void> => {
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

    await browser.execute((to: number) => {
      window.scrollTo(0, to * (document.documentElement.scrollHeight - window.innerHeight));
    }, fraction);
  } finally {
    await enterBrowserChrome();
  }
};
