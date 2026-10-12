import { browser } from "@wdio/globals";

import { readFirefoxZipAsBase64 } from "../readFirefoxZipAsBase64";

/**
 * Quits Firefox and starts it again with `capabilities`, then installs the
 * add-on again — a temporary add-on does not survive a restart.
 *
 * With a kept profile and the restart preferences, this is what a user's
 * restart looks like to the extension's data: the session restored and the
 * database still there. The extension wakes through `runtime.onInstalled`
 * rather than `runtime.onStartup`, because it was installed anew.
 */
export const restartFirefox = async (capabilities: WebdriverIO.Capabilities): Promise<void> => {
  await browser.reloadSession(capabilities);
  await browser.installAddOn(readFirefoxZipAsBase64(), true);
};
