import { browser } from "@wdio/globals";

import { EXTENSION_ID } from "@/shared/config";
import { buildEgressRecorderScript } from "../buildEgressRecorderScript";

/** Starts, or empties, the log of the add-on's requests. Must be called in the chrome context. */
export const startEgressLog = async (extensionId: string = EXTENSION_ID): Promise<void> => {
  await browser.executeScript(buildEgressRecorderScript(extensionId), []);
};
