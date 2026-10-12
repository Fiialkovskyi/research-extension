import { browser } from "@wdio/globals";

import { enterBrowserChrome } from "../../../firefoxToolbar/utils";
import {
  REMEMBER_SELECTED_TAB_SCRIPT,
  RESTORE_SELECTED_TAB_SCRIPT,
} from "../../../researchDatabase/constants";
import { buildMapReaderScript } from "../buildMapReaderScript";
import { type MapSnapshot, parseMapSnapshot } from "../parseMapSnapshot";
import { switchToMapTab } from "../switchToMapTab";

/**
 * Reads what the open map page shows. Must be called in the chrome context,
 * and returns to it with the tab that was selected before selected again, so
 * a spec's next step acts where it expects.
 */
export const readResearchMap = async (): Promise<MapSnapshot> => {
  await browser.executeScript(REMEMBER_SELECTED_TAB_SCRIPT, []);

  try {
    await switchToMapTab();

    return parseMapSnapshot(await browser.execute(buildMapReaderScript()));
  } finally {
    await enterBrowserChrome();
    await browser.executeScript(RESTORE_SELECTED_TAB_SCRIPT, []);
  }
};
