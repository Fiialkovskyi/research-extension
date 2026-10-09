import { browser } from "@wdio/globals";

import { CHROME_CONTEXT } from "../../constants";

/**
 * Enters the context where the browser's own UI is scriptable — the toolbar,
 * its panels and the XUL documents around the page.
 *
 * Requires geckodriver's `--allow-system-access`; without it Marionette
 * refuses the switch. Note that `browser.execute` and `$` are useless here:
 * they route through BiDi into the content realm regardless of the context,
 * so privileged work uses the classic protocol commands.
 */
export const enterBrowserChrome = async (): Promise<void> => {
  await browser.setMozContext(CHROME_CONTEXT);
};
