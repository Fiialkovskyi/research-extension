/** What the toolbar action's panel is doing, and what it hangs from. */
export interface PopupPanelState {
  /** Firefox's panel state: `closed`, `showing`, `open`, `hiding`, `absent`. */
  state: string;
  /** DOM id of the toolbar item the panel is anchored to, when it has one. */
  anchorId: string | null;
}

/**
 * Parses what the privileged panel script reported.
 *
 * The script returns JSON because its result crosses the WebDriver boundary,
 * where only simple values survive reliably.
 *
 * @throws If the script returned something other than a JSON string, which
 *   means it failed rather than reported a state.
 */
export function parsePanelState(raw: unknown): PopupPanelState {
  if (typeof raw !== "string") {
    throw new Error(`Expected the panel state as a JSON string, got ${typeof raw}.`);
  }

  return JSON.parse(raw) as PopupPanelState;
}
