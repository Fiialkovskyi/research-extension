import type { StoredSession } from "@/shared/storage";

import type { SessionSummary } from "../../types";

/**
 * Builds what a surface is told about a session.
 *
 * A stored record never travels to a surface as it is, so a field added to the
 * record for the background's own use does not leak into the protocol.
 */
export const buildSessionSummary = ({ id, title, groupId }: StoredSession): SessionSummary => {
  return { id, title, groupId };
};
