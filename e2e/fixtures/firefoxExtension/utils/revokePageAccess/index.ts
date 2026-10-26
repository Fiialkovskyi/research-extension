import { browser } from "@wdio/globals";

import { EXTENSION_ID } from "@/shared/config";
import { buildPageAccessRevokeScript } from "../buildPageAccessRevokeScript";

/**
 * Takes the extension's access to page contents away, as the user switching it
 * off in `about:addons` would. Must be called in the chrome context.
 *
 * The extension is granted access with its install, so a spec that is about
 * access missing, or granted later, starts by revoking it.
 */
export const revokePageAccess = async (extensionId: string = EXTENSION_ID): Promise<void> => {
  await browser.executeScript(buildPageAccessRevokeScript(extensionId), []);
};
