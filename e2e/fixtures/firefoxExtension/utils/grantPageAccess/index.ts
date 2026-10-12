import { browser } from "@wdio/globals";

import { EXTENSION_ID } from "@/shared/config";
import { buildPageAccessGrantScript } from "../buildPageAccessGrantScript";

/**
 * Grants the extension access to page contents, as the user allowing Firefox's
 * prompt would. Must be called in the chrome context.
 *
 * The suite submits the popup's form from a script, which Firefox does not
 * count as the user's click, so the popup's own request is refused; this is
 * the answer the user would have given.
 */
export const grantPageAccess = async (extensionId: string = EXTENSION_ID): Promise<void> => {
  await browser.executeScript(buildPageAccessGrantScript(extensionId), []);
};
