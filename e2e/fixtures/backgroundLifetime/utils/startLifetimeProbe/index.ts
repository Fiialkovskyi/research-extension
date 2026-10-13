import { $, browser } from "@wdio/globals";

import { getExtensionUrl } from "../../../firefoxExtension/utils";
import { OPTIONS_PAGE_PATH, PROBE_CARD_TIMEOUT_MS } from "../../constants";
import { buildProbeReaderScript } from "../buildProbeReaderScript";
import { buildProbeStartScript } from "../buildProbeStartScript";
import { parseProbeRuns } from "../parseProbeRuns";

/**
 * Starts a probe run from the options page's Developer card, waits until the
 * run is listed, then leaves the page for `about:blank`, so no extension page
 * keeps the background company while the run holds.
 *
 * @returns The new run's id.
 */
export const startLifetimeProbe = async (
  strategy: string,
  holdSeconds: number,
): Promise<string> => {
  await browser.url(getExtensionUrl(OPTIONS_PAGE_PATH));
  await $('[data-testid="lifetime-probe"][data-read="true"]').waitForExist({
    timeout: PROBE_CARD_TIMEOUT_MS,
    timeoutMsg: "The options page's probe card never listed its runs.",
  });

  const before = new Set(
    parseProbeRuns(await browser.execute(buildProbeReaderScript())).map(({ runId }) => runId),
  );
  const started = await browser.execute(buildProbeStartScript(strategy, holdSeconds));

  if (started !== true) {
    throw new Error(`The probe card has no ${String(started)} to start a run with.`);
  }

  let runId: string | undefined;

  await browser.waitUntil(
    async () => {
      runId = parseProbeRuns(await browser.execute(buildProbeReaderScript())).find(
        (run) => !before.has(run.runId),
      )?.runId;

      return runId !== undefined;
    },
    { timeout: PROBE_CARD_TIMEOUT_MS, timeoutMsg: `The ${strategy} probe run never started.` },
  );
  await browser.url("about:blank");

  if (runId === undefined) {
    throw new Error(`The ${strategy} probe run never started.`);
  }

  return runId;
};
