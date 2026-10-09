import { $, browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import { CAPABILITIES_TEST_ID, SURFACE_TIMEOUT_MS } from "../../constants";

/**
 * Opens the options document and waits until it has heard from the background.
 *
 * Waiting for the reported capabilities rather than for the document is what
 * makes this meaningful: the line only renders once the surface has connected a
 * port, the background has spawned the inference worker, and the worker has
 * answered. A rendered document proves only that React mounted.
 *
 * @param optionsPath path of the options document inside the package.
 */
export const openOptionsSurface = async (optionsPath: string): Promise<void> => {
  await browser.url(getExtensionUrl(optionsPath));

  await $(`[data-testid="${CAPABILITIES_TEST_ID}"]`).waitForExist({
    timeout: SURFACE_TIMEOUT_MS,
    timeoutMsg:
      "The options surface never reported what this installation can run, " +
      "so the port to the background or the inference worker did not answer.",
  });
};
