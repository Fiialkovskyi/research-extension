import { browser } from "@wdio/globals";
import { Key } from "webdriverio";

import { enterBrowserChrome } from "../enterBrowserChrome";
import { leaveBrowserChrome } from "../leaveBrowserChrome";

/** The platform's copy shortcut modifier: Command on macOS, Control elsewhere. */
const getCopyModifier = (platform: NodeJS.Platform): string =>
  platform === "darwin" ? Key.Command : Key.Ctrl;

/**
 * Selects the text of `selector` in the page of the tab whose URL ends with
 * `urlEnding`, and copies it with the keyboard, as a person would. Must be
 * called in the chrome context, and returns to it.
 *
 * Through real key input: a page observer counts only copies the user made,
 * and a `copy` event a script dispatched would not be one.
 *
 * @throws If no tab shows such a URL.
 */
export const copyInTabShowing = async (urlEnding: string, selector: string): Promise<void> => {
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

    await browser.execute((target: string) => {
      const element = document.querySelector(target);
      const selection = window.getSelection();

      if (element === null || selection === null) {
        throw new Error(`Nothing to select at "${target}".`);
      }

      const range = document.createRange();

      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }, selector);
    await browser.keys([getCopyModifier(process.platform), "c"]);
  } finally {
    await enterBrowserChrome();
  }
};
