import { $$ } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../../firefoxToolbar/constants";
import { enterBrowserChrome } from "../../../firefoxToolbar/utils";
import { switchToSummariesTab } from "../switchToSummariesTab";

/**
 * Clicks the first control of the Synthesis page with a test id, as a person
 * would. Must be called in the chrome context, and returns to it.
 */
export const clickSummariesButton = async (testId: string): Promise<void> => {
  try {
    await switchToSummariesTab();

    // Several controls may share the id, one per gap: the first is clicked.
    const [button] = await $$(`[data-testid="${testId}"]`);

    if (button === undefined) {
      throw new Error(`The Synthesis page has no control "${testId}".`);
    }

    await button.waitForClickable({ timeout: UI_TIMEOUT_MS });
    await button.click();
  } finally {
    await enterBrowserChrome();
  }
};
