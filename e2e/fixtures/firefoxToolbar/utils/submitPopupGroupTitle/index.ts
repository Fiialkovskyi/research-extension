import { browser } from "@wdio/globals";

import { UI_TIMEOUT_MS } from "../../constants";
import { buildGroupTitleSubmitScript } from "../buildGroupTitleSubmitScript";
import { buildPopupReaderScript } from "../buildPopupReaderScript";
import { parseReaderResult } from "../parseReaderResult";

/**
 * Types a session title into the open popup and submits it.
 *
 * Reaches the popup the same way `readPopup` does, through Firefox's
 * Marionette actor, because the popup's document is out of reach otherwise.
 *
 * @throws If the popup never loads, or never shows a session form to submit.
 */
export const submitPopupGroupTitle = async (title: string): Promise<void> => {
  const script = buildPopupReaderScript(buildGroupTitleSubmitScript(title));

  // The script submits only when the form is there, so a popup still reading
  // its sessions is asked again rather than reported as having no form.
  await browser.waitUntil(
    async () => {
      const raw = parseReaderResult(await browser.executeAsyncScript(script, []));

      return raw !== undefined && (JSON.parse(raw) as { submitted: boolean }).submitted;
    },
    { timeout: UI_TIMEOUT_MS, timeoutMsg: "The popup never showed a session form to submit." },
  );
};
