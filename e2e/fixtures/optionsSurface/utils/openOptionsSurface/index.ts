import { $, browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import { AI_STATUS_TEST_ID, CAPABILITIES_TEST_ID, SURFACE_TIMEOUT_MS } from "../../constants";
import { IS_IN_BROWSER_BACKEND_ENABLED } from "@/shared/config";

/**
 * Opens the options document and waits until it has heard from the background.
 *
 * Waiting for an answer rather than for the document is what makes this
 * meaningful: a rendered document proves only that React mounted. The AI
 * status says whether it is set up only once the background has answered over
 * the port; with in-extension models on, the reported capabilities also mean
 * the inference worker answered.
 *
 * @param optionsPath path of the options document inside the package.
 */
export const openOptionsSurface = async (optionsPath: string): Promise<void> => {
  await browser.url(getExtensionUrl(optionsPath));

  await $(`[data-testid="${AI_STATUS_TEST_ID}"][data-set-up]`).waitForExist({
    timeout: SURFACE_TIMEOUT_MS,
    timeoutMsg:
      "The options surface never said whether AI is set up, so the background did not answer.",
  });

  if (IS_IN_BROWSER_BACKEND_ENABLED) {
    await $(`[data-testid="${CAPABILITIES_TEST_ID}"]`).waitForExist({
      timeout: SURFACE_TIMEOUT_MS,
      timeoutMsg:
        "The options surface never reported what this installation can run, " +
        "so the inference worker did not answer.",
    });
  }
};
