import { browser } from "@wdio/globals";

import { PANEL_OPEN, POPUP_PANEL_ID, UI_TIMEOUT_MS } from "../../constants";
import { getPopupPanelState } from "../getPopupPanelState";

/** Dismisses the panel so the next interaction starts from a closed state. */
export const closePopup = async (): Promise<void> => {
  await browser.executeScript(`document.getElementById(arguments[0])?.hidePopup();`, [
    POPUP_PANEL_ID,
  ]);

  await browser.waitUntil(async () => (await getPopupPanelState()).state !== PANEL_OPEN, {
    timeout: UI_TIMEOUT_MS,
    timeoutMsg: "The toolbar popup did not close.",
  });
};
