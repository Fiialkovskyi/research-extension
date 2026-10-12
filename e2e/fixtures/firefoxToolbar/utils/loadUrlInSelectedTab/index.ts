import { browser } from "@wdio/globals";

import { buildTabLoaderScript } from "../buildTabLoaderScript";

/** Loads a URL into the selected tab. Must be called in the chrome context. */
export const loadUrlInSelectedTab = async (url: string): Promise<void> => {
  await browser.executeScript(buildTabLoaderScript(url), []);
};
