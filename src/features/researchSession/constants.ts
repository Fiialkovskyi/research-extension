/**
 * The key under which a session tab carries its session's id, as a per-tab
 * session value. Firefox keeps the value with the tab's closed-tab record and
 * gives it back when the tab is restored, even when the tab comes back outside
 * any group — which is how a restored tab is recognised as the session's.
 */
export const SESSION_TAB_VALUE_KEY = "researchSessionId";

/** The `groupId` Firefox reports for a tab that is in no group. */
export const NO_TAB_GROUP = -1;
