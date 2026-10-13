import { browser } from "@wdio/globals";

import { enterBrowserChrome } from "../../../firefoxToolbar/utils";
import {
  REMEMBER_SELECTED_TAB_SCRIPT,
  RESTORE_SELECTED_TAB_SCRIPT,
} from "../../../researchDatabase/constants";
import { buildSummariesReaderScript } from "../buildSummariesReaderScript";
import { parseSummariesSnapshot, type SummariesSnapshot } from "../parseSummariesSnapshot";
import { switchToSummariesTab } from "../switchToSummariesTab";

/**
 * Reads what the Summaries page shows. Must be called in the chrome
 * context, and returns to it with the tab the user had selected selected again.
 */
export const readSummariesPage = async (): Promise<SummariesSnapshot> => {
  await browser.executeScript(REMEMBER_SELECTED_TAB_SCRIPT, []);

  try {
    await switchToSummariesTab();

    return parseSummariesSnapshot(await browser.execute(buildSummariesReaderScript()));
  } finally {
    await enterBrowserChrome();
    await browser.executeScript(RESTORE_SELECTED_TAB_SCRIPT, []);
  }
};
