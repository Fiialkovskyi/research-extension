import { browser } from "@wdio/globals";

import { enterBrowserChrome } from "../../../firefoxToolbar/utils";
import {
  REMEMBER_SELECTED_TAB_SCRIPT,
  RESTORE_SELECTED_TAB_SCRIPT,
} from "../../../researchDatabase/constants";
import { buildRecordedReaderScript } from "../buildRecordedReaderScript";
import { parseRecordedSnapshot, type RecordedSnapshot } from "../parseRecordedSnapshot";
import { switchToRecordedTab } from "../switchToRecordedTab";

/**
 * Reads what the "What was recorded" page shows. Must be called in the chrome
 * context, and returns to it with the tab the user had selected selected again.
 */
export const readRecordedPage = async (): Promise<RecordedSnapshot> => {
  await browser.executeScript(REMEMBER_SELECTED_TAB_SCRIPT, []);

  try {
    await switchToRecordedTab();

    return parseRecordedSnapshot(await browser.execute(buildRecordedReaderScript()));
  } finally {
    await enterBrowserChrome();
    await browser.executeScript(RESTORE_SELECTED_TAB_SCRIPT, []);
  }
};
