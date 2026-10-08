import { browser } from "@wdio/globals";

import { POPUP_PANEL_ID } from "../constants";
import { type PopupPanelState, parsePanelState } from "./utils/parsePanelState";

export type { PopupPanelState };

/**
 * Privileged script reporting the panel's state and anchor.
 *
 * The anchor is an inner part of the widget and usually carries no id of its
 * own, so the enclosing toolbar item stands in for it — that is the element
 * whose id identifies the extension.
 */
const PANEL_STATE_SCRIPT = `const panel = document.getElementById(arguments[0]);
     const anchor = panel?.anchorNode ?? null;
     const anchorId = anchor
       ? anchor.id || anchor.closest?.("toolbaritem")?.id || null
       : null;
     return JSON.stringify({ state: panel?.state ?? "absent", anchorId });`;

/** Reads the popup panel's current state without waiting for anything. */
export async function getPopupPanelState(): Promise<PopupPanelState> {
  return parsePanelState(await browser.executeScript(PANEL_STATE_SCRIPT, [POPUP_PANEL_ID]));
}
