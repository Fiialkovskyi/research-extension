import { browser } from "@wdio/globals";

import { buildTabGroupsReaderScript } from "../buildTabGroupsReaderScript";
import { type TabGroupSnapshot, parseTabGroupsSnapshot } from "../parseTabGroupsSnapshot";

export type { TabGroupSnapshot };

/** Lists the current window's tab groups. Must be called in the chrome context. */
export const readTabGroups = async (): Promise<TabGroupSnapshot[]> => {
  return parseTabGroupsSnapshot(await browser.executeScript(buildTabGroupsReaderScript(), []));
};
