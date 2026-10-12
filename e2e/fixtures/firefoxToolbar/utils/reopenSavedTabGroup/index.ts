import { browser } from "@wdio/globals";

import { buildSavedGroupOpenerScript } from "../buildSavedGroupOpenerScript";

/**
 * Reopens a saved group and returns the internal id it came back with. Must be
 * called in the chrome context.
 *
 * @throws If nothing was saved under the id.
 */
export const reopenSavedTabGroup = async (savedId: string): Promise<string> => {
  const reopened: unknown = JSON.parse(
    String(await browser.executeScript(buildSavedGroupOpenerScript(savedId), [])),
  );

  if (typeof reopened !== "string") {
    throw new Error(`No group is saved under "${savedId}".`);
  }

  return reopened;
};
