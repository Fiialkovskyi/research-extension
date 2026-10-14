import { browser } from "@wdio/globals";

import { buildEgressReaderScript } from "../buildEgressReaderScript";
import { type EgressRequest, parseEgressLog } from "../parseEgressLog";

/** Reads the requests the add-on triggered since the log started. Must be called in the chrome context. */
export const readEgressLog = async (): Promise<EgressRequest[]> =>
  parseEgressLog(await browser.executeScript(buildEgressReaderScript(), []));
