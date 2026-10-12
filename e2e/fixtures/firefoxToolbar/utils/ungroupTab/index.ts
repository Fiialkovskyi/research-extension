import { browser } from "@wdio/globals";

import { buildTabUngrouperScript } from "../buildTabUngrouperScript";

/**
 * Takes the tab showing `url` out of its group. Must be called in the chrome
 * context.
 *
 * @throws If no tab shows the URL.
 */
export const ungroupTab = async (url: string): Promise<void> => {
  const ungrouped = JSON.parse(
    String(await browser.executeScript(buildTabUngrouperScript(url), [])),
  );

  if (ungrouped !== true) {
    throw new Error(`No tab shows ${url}, so none could leave its group.`);
  }
};
