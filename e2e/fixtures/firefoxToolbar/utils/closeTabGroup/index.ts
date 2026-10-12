import { browser } from "@wdio/globals";

import { buildTabGroupCloserScript } from "../buildTabGroupCloserScript";

/**
 * Closes every tab of the group with the given label, which removes the group.
 * Must be called in the chrome context.
 *
 * @throws If no group carries that label.
 */
export const closeTabGroup = async (label: string): Promise<void> => {
  const raw = await browser.executeScript(buildTabGroupCloserScript(label), []);
  const closed = JSON.parse(String(raw)) as number;

  if (closed === 0) {
    throw new Error(`No tab group titled "${label}" to close.`);
  }
};
