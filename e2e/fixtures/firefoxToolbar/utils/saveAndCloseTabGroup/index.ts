import { browser } from "@wdio/globals";

import { buildGroupSaverScript } from "../buildGroupSaverScript";

/**
 * Saves and closes the group labelled `label`, and returns its internal id, by
 * which it can be reopened. Must be called in the chrome context.
 *
 * @throws If no group has the label, or the flush failed.
 */
export const saveAndCloseTabGroup = async (label: string): Promise<string> => {
  const result: unknown = JSON.parse(
    String(await browser.executeAsyncScript(buildGroupSaverScript(label), [])),
  );

  if (typeof result !== "string") {
    throw new Error(`Could not save the group "${label}": ${JSON.stringify(result)}.`);
  }

  return result;
};
