import { browser } from "@wdio/globals";

import { buildTabGrouperScript } from "../buildTabGrouperScript";

/**
 * Moves the tab showing `url` into the group labelled `label`. Must be called
 * in the chrome context.
 *
 * @throws If no tab shows the URL or no group has the label.
 */
export const moveTabToGroup = async (url: string, label: string): Promise<void> => {
  const moved = JSON.parse(
    String(await browser.executeScript(buildTabGrouperScript(url, label), [])),
  );

  if (moved !== true) {
    throw new Error(`Could not move the tab showing ${url} into the group "${label}".`);
  }
};
