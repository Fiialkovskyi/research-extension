import { browser } from "@wdio/globals";

import { buildTabOpenerScript } from "../buildTabOpenerScript";

/** Opens a URL in a new tab outside any group. Must be called in the chrome context. */
export const openTabOutsideGroups = async (url: string): Promise<void> => {
  await browser.executeScript(buildTabOpenerScript(url), []);
};
