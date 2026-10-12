import { $ } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../../firefoxToolbar/constants";
import { enterBrowserChrome } from "../../../firefoxToolbar/utils";
import { switchToRecordedTab } from "../switchToRecordedTab";

/**
 * Clicks a control of the "What was recorded" page by its test id — the first
 * one, or the one inside the entry of `nodeId` — as a person would. Must be
 * called in the chrome context, and returns to it.
 */
export const clickRecordedButton = async (testId: string, nodeId?: string): Promise<void> => {
  try {
    await switchToRecordedTab();

    const scope =
      nodeId === undefined ? "" : `[data-testid="recorded-entry"][data-node-id="${nodeId}"] `;
    const button = $(`${scope}[data-testid="${testId}"]`);

    await button.waitForClickable({ timeout: UI_TIMEOUT_MS });
    await button.click();
  } finally {
    await enterBrowserChrome();
  }
};
