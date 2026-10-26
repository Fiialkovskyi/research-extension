import { browser } from "@wdio/globals";

import { enterBrowserChrome } from "../enterBrowserChrome";
import { leaveBrowserChrome } from "../leaveBrowserChrome";

/** What a page shows of the notice that it was added to research. */
export interface PageNoticeSnapshot {
  /** Whether the notice's host element is in the page. */
  isShown: boolean;
  /** The host's position in the corner, as the page's own styles read it. */
  position: string;
  /** The host's pointer events, which must be `none`. */
  pointerEvents: string;
  /** Whether the page can read into the notice: a closed root gives it nothing. */
  isOpen: boolean;
}

/**
 * Reads the notice of the tab whose URL ends with `urlEnding`, as the page
 * itself could. Must be called in the chrome context, and returns to it.
 *
 * What the notice says is out of the page's reach by design, so this reports
 * that it is there, in the corner and click-through, and that its content is not
 * readable; its text is covered by the unit specs.
 *
 * @throws If no tab shows such a URL.
 */
export const readNoticeInTabShowing = async (urlEnding: string): Promise<PageNoticeSnapshot> => {
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

    return await browser.execute(() => {
      const host = document.querySelector("research-graph-notice");

      return {
        isShown: host !== null,
        position: host === null ? "" : getComputedStyle(host).position,
        pointerEvents: host === null ? "" : getComputedStyle(host).pointerEvents,
        isOpen: host?.shadowRoot != null,
      };
    });
  } finally {
    await enterBrowserChrome();
  }
};
