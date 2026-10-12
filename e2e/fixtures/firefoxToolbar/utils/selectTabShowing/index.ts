import { browser } from "@wdio/globals";

import { buildTabSelectorScript } from "../buildTabSelectorScript";

/**
 * Selects the tab whose address ends with `urlEnding`. Must be called in the
 * chrome context.
 *
 * @throws If no tab shows such an address.
 */
export const selectTabShowing = async (urlEnding: string): Promise<void> => {
  if ((await browser.executeScript(buildTabSelectorScript(urlEnding), [])) !== true) {
    throw new Error(`No tab shows a URL ending in "${urlEnding}".`);
  }
};
