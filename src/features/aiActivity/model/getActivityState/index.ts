import type { JobActivity } from "@/features/jobQueue";

import type { ActivityState, SessionTotals } from "../../types";
import { getWorkLabel } from "../getWorkLabel";

export interface ActivityConditions {
  /** The local inference server last failed to answer. */
  isPaused: boolean;
}

/** The session totals the ready state reports, by the job type that produces each. */
const TOTAL_TYPES: ReadonlyArray<[keyof SessionTotals, string]> = [
  ["pagesRead", "embedSnapshot"],
  ["factsFrom", "extractFacts"],
  ["summaries", "summarizeCluster"],
];

const isShown = (type: string): boolean => getWorkLabel(type) !== undefined;

/**
 * Decides what the popup's strip shows, from the queue and whether the local
 * server answers. The first state that applies wins: paused, working, waiting
 * for the user to step away, ready. Work the user would not recognize is left
 * out of every count first, so a diagnostics run never shows.
 */
export const getActivityState = (
  activity: JobActivity,
  { isPaused }: ActivityConditions,
): ActivityState => {
  const running = activity.running.filter((work) => isShown(work.type));
  const queued = activity.queued.filter((work) => isShown(work.type));
  const pendingCount = running.length + queued.length;

  if (pendingCount === 0) {
    const totals: SessionTotals = {};

    for (const [total, type] of TOTAL_TYPES) {
      const count = activity.sessionDoneByType[type] ?? 0;

      if (count > 0) {
        totals[total] = count;
      }
    }

    return {
      kind: "ready",
      totals,
      failed: activity.sessionFailedTypes.filter(isShown).length,
    };
  }

  const settled = activity.batch?.settledTypes.filter(isShown).length ?? 0;
  const failed = activity.batch?.failedTypes.filter(isShown).length ?? 0;

  if (isPaused) {
    return { kind: "paused", waiting: pendingCount, failed };
  }

  const current = running[0];
  // While nothing runs, the work about to: a retry waiting out its backoff, or
  // a job the next pass claims.
  const named = current ?? queued.find((work) => work.isPermitted);

  if (named === undefined) {
    return { kind: "waiting", waiting: pendingCount, failed };
  }

  return {
    kind: "working",
    label: getWorkLabel(named.type) ?? named.type,
    settled,
    total: settled + pendingCount,
    ...(current === undefined ? {} : { startedAt: current.startedAt }),
    failed,
  };
};
