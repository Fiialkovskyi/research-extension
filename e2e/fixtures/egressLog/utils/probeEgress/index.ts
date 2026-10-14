import { browser } from "@wdio/globals";

import { EXTENSION_ID } from "@/shared/config";
import { buildEgressProbeScript } from "../buildEgressProbeScript";

/** Makes one request as the add-on, to show the log sees it. Must be called in the chrome context. */
export const probeEgress = async (
  url: string,
  extensionId: string = EXTENSION_ID,
): Promise<void> => {
  await browser.executeScript(buildEgressProbeScript(extensionId, url), []);
};
