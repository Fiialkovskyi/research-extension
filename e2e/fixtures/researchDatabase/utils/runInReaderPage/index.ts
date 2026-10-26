import { browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import {
  enterBrowserChrome,
  leaveBrowserChrome,
  openTabOutsideGroups,
} from "../../../firefoxToolbar/utils";
import {
  READER_PAGE_PATH,
  REMEMBER_SELECTED_TAB_SCRIPT,
  RESTORE_SELECTED_TAB_SCRIPT,
} from "../../constants";

/**
 * Runs `work` in an extension page of its own, outside any group, and returns
 * what it returns. Must be called in the chrome context, and returns to it.
 *
 * The database belongs to the extension's origin, and the group ids a spec
 * compares with it are the ones `tabGroups` hands the extension, so both are
 * reached from there. The page is closed again before returning.
 */
export const runInReaderPage = async <T>(work: () => Promise<T>): Promise<T> => {
  const readerUrl = getExtensionUrl(READER_PAGE_PATH);

  // Switching to the reader's tab selects it, and so does switching back to
  // any tab afterwards. The tab the user had selected is remembered here and
  // selected again at the end, so a spec's next step acts where it expects.
  await browser.executeScript(REMEMBER_SELECTED_TAB_SCRIPT, []);
  await openTabOutsideGroups(readerUrl);
  await leaveBrowserChrome();

  try {
    await browser.waitUntil(async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);

        // The URL is the reader's as soon as its load starts; a script run
        // before the load finishes is lost with the document it ran in.
        if (
          (await browser.getUrl()) === readerUrl &&
          (await browser.execute(() => document.readyState)) === "complete"
        ) {
          return true;
        }
      }

      return false;
    });

    try {
      return await work();
    } finally {
      // Closed whether or not the work succeeded, so a failed read leaves no tab behind.
      await browser.closeWindow();
    }
  } finally {
    const [remaining] = await browser.getWindowHandles();

    if (remaining !== undefined) {
      await browser.switchToWindow(remaining);
    }

    await enterBrowserChrome();
    await browser.executeScript(RESTORE_SELECTED_TAB_SCRIPT, []);
  }
};
