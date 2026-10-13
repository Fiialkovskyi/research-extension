import { $, browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import { OPTIONS_PAGE_PATH, PROBE_CARD_TIMEOUT_MS } from "../../constants";
import { buildProbeReaderScript } from "../buildProbeReaderScript";
import { type ProbeRun, parseProbeRuns } from "../parseProbeRuns";

/**
 * Opens the options page in the current tab and reads the probe runs its
 * Developer card lists, newest first, once the card has heard back.
 */
export const readLifetimeProbes = async (): Promise<ProbeRun[]> => {
  await browser.url(getExtensionUrl(OPTIONS_PAGE_PATH));
  await $('[data-testid="lifetime-probe"][data-read="true"]').waitForExist({
    timeout: PROBE_CARD_TIMEOUT_MS,
    timeoutMsg: "The options page's probe card never listed its runs.",
  });

  return parseProbeRuns(await browser.execute(buildProbeReaderScript()));
};
