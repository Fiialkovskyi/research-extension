import type { StoredSession } from "@/shared/storage";

/**
 * Refuses to go on while a session is active, naming it.
 *
 * Until after the MVP there is one session at a time, and a refusal that says
 * which one is active tells the user what to finish first.
 *
 * @throws If `active` is a session.
 */
export const assertNoActiveSession = (active: StoredSession | undefined): void => {
  if (active !== undefined) {
    throw new Error(`A session is already active: "${active.title}".`);
  }
};
