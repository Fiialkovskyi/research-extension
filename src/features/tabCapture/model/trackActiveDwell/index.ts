import type { IDBPDatabase } from "idb";

import { addNodeSignals, readTabNode } from "@/features/researchGraph";
import { getActiveSession, setSessionFocus } from "@/features/researchSession";
import { ENGAGEMENT_RULES } from "@/shared/config";
import type { ResearchDatabaseSchema, StoredFocusVisit } from "@/shared/storage";

export interface TrackActiveDwellOptions {
  database: IDBPDatabase<ResearchDatabaseSchema>;
  /**
   * The tab the user is reading now: the selected tab of the focused window,
   * while the user is not idle. `undefined` when there is none.
   */
  focusedTabId: number | undefined;
  /** When the change happened. For idleness, when input stopped. */
  now: number;
  /**
   * Drops the running interval instead of counting it. At start-up the
   * interval was left open by a browser that has since gone away, and its
   * length says nothing about reading.
   */
  discardOpen?: boolean;
}

/** Which node, if any, gained active dwell. */
export interface TrackedDwell {
  dwelledNodeId: string | undefined;
}

/** How much of a running interval counts: never negative, never above the cap. */
const getIntervalMs = (since: number, now: number): number =>
  Math.min(Math.max(now - since, 0), ENGAGEMENT_RULES.maximumIntervalMs);

/**
 * Brings the session's active reading time up to `now`, then follows focus to
 * the tab the user is reading (target spec §4, "Focus and active time").
 *
 * Called after every event that may have moved focus, rather than kept running
 * in memory: the background can be unloaded at any time, and the open visit
 * on the session record is what it picks up from.
 *
 * A visit pauses while the window is unfocused or the user idle, and resumes
 * when the same node is read again; it ends when another node gets focus. A
 * visit to a node that already had dwell is a revisit, counted once it reaches
 * the revisit threshold.
 */
export const trackActiveDwell = async ({
  database,
  focusedTabId,
  now,
  discardOpen = false,
}: TrackActiveDwellOptions): Promise<TrackedDwell> => {
  const session = await getActiveSession(database);

  if (session === undefined) {
    return { dwelledNodeId: undefined };
  }

  let visit: StoredFocusVisit | undefined = session.focus;
  let dwelledNodeId: string | undefined;

  if (visit !== undefined && visit.since !== null) {
    const intervalMs = discardOpen ? 0 : getIntervalMs(visit.since, now);

    if (intervalMs > 0) {
      const visitDwellMs = visit.visitDwellMs + intervalMs;
      const isRevisitReached =
        visit.isRevisit &&
        !visit.isRevisitCounted &&
        visitDwellMs >= ENGAGEMENT_RULES.revisitDwellMs;

      await addNodeSignals(database, visit.nodeId, {
        activeDwellMs: intervalMs,
        ...(isRevisitReached ? { revisitCount: 1 } : {}),
      });
      visit = {
        ...visit,
        visitDwellMs,
        isRevisitCounted: visit.isRevisitCounted || isRevisitReached,
      };
      dwelledNodeId = visit.nodeId;
    }

    visit = { ...visit, since: null };
  }

  const target =
    focusedTabId === undefined ? undefined : await readTabNode(database, session.id, focusedTabId);

  if (target !== undefined) {
    visit =
      visit?.nodeId === target.id
        ? { ...visit, since: now }
        : {
            nodeId: target.id,
            since: now,
            visitDwellMs: 0,
            isRevisit: target.signals.activeDwellMs > 0,
            isRevisitCounted: false,
          };
  }

  if (visit !== undefined) {
    await setSessionFocus(database, session.id, visit);
  }

  return { dwelledNodeId };
};
