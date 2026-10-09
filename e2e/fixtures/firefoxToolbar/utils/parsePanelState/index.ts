import * as v from "valibot";

import { popupPanelStateSchema } from "./schemas";

export type PopupPanelState = v.InferOutput<typeof popupPanelStateSchema>;

/**
 * Parses what the privileged panel script reported.
 *
 * The script returns JSON because its result crosses the WebDriver boundary,
 * where only simple values survive reliably.
 *
 * @throws If the script returned something other than a JSON string, which
 *   means it failed rather than reported a state, or a string whose content is
 *   not a panel state.
 */
export const parsePanelState = (raw: unknown): PopupPanelState => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the panel state as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(popupPanelStateSchema, JSON.parse(raw));
};
