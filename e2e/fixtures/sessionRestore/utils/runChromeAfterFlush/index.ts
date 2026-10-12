import { browser } from "@wdio/globals";

import { buildFlushedChromeScript } from "../buildFlushedChromeScript";
import { parseChromeResult } from "../parseChromeResult";

/**
 * Runs `body` once every tab has flushed its session history, as a person's
 * tabs long have by the time they close a group. Must be called in the chrome
 * context.
 *
 * @throws With the body's own message if it throws.
 */
export const runChromeAfterFlush = async (body: string): Promise<unknown> => {
  return parseChromeResult(await browser.executeAsyncScript(buildFlushedChromeScript(body), []));
};
