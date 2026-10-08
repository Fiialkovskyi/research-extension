import { browser } from "@wdio/globals";

import { PANEL_OPEN, UI_TIMEOUT_MS } from "../constants";
import { type PopupPanelState, getPopupPanelState } from "../getPopupPanelState";

/**
 * Waits for the panel to finish opening.
 *
 * Firefox takes the panel through `showing` first; reading it in that state
 * catches the popup before its document has rendered.
 */
export async function waitForPopupPanel(): Promise<PopupPanelState> {
  return browser.waitUntil(
    async () => {
      const panel = await getPopupPanelState();

      return panel.state === PANEL_OPEN && panel;
    },
    {
      timeout: UI_TIMEOUT_MS,
      timeoutMsg: "The toolbar action did not open its popup panel.",
    },
  );
}
