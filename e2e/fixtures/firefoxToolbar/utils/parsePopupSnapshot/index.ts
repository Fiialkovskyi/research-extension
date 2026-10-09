import * as v from "valibot";

import { popupSnapshotSchema } from "./schemas";

export type PopupSnapshot = v.InferOutput<typeof popupSnapshotSchema>;

/**
 * Parses the snapshot the popup document returned.
 *
 * @throws If the popup returned something other than a JSON string, or a
 *   string whose content is not a snapshot.
 */
export const parsePopupSnapshot = (raw: unknown): PopupSnapshot => {
  if (typeof raw !== "string") {
    throw new Error(`Expected the popup snapshot as a JSON string, got ${typeof raw}.`);
  }

  return v.parse(popupSnapshotSchema, JSON.parse(raw));
};
