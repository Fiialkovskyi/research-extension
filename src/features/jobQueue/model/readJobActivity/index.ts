import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema, type StoredJob } from "@/shared/storage";

import type { JobActivity, ReadJobActivityOptions } from "./types";

/** Identifies a piece of work across producer versions: a page re-embedded by a new model is the same page. */
const getWorkKey = (job: StoredJob): string => `${job.type}\u0000${job.inputHashes.join(",")}`;

/**
 * Whether a queued job is outstanding work. A first attempt held back to
 * debounce is not yet; a retry waiting out its backoff still is.
 */
const isPending = (job: StoredJob, now: number): boolean =>
  job.status === "running" || job.attempts > 0 || job.nextAttemptAt <= now;

/**
 * Summarizes the queue for a surface: what runs, what waits, how far the
 * current batch has got and what the session has had done.
 *
 * A batch is derived from the store alone, so it survives the background being
 * unloaded: it starts when the earliest pending job entered the queue, and
 * holds every job pending now or settled since.
 */
export const readJobActivity = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  { now = Date.now(), sessionId, isPermitted = () => true }: ReadJobActivityOptions = {},
): Promise<JobActivity> => {
  const byStatus = (status: "queued" | "running") =>
    database.getAllFromIndex(
      JOB_STORE,
      "statusPriority",
      IDBKeyRange.bound([status, -Infinity], [status, Infinity]),
    );
  const [queuedJobs, runningJobs] = await Promise.all([byStatus("queued"), byStatus("running")]);
  const pending = [...runningJobs, ...queuedJobs.toReversed()].filter((job) => isPending(job, now));
  const activity: JobActivity = {
    running: runningJobs.map((job) => ({ type: job.type, startedAt: job.updatedAt })),
    queued: pending
      .filter((job) => job.status === "queued")
      .map((job) => ({ type: job.type, isPermitted: isPermitted(job) })),
    sessionDoneByType: {},
    sessionFailedTypes: [],
  };

  if (pending.length > 0) {
    const startedAt = Math.min(...pending.map((job) => job.queuedAt ?? job.createdAt));
    const settled = (
      await database.getAllFromIndex(JOB_STORE, "updatedAt", IDBKeyRange.lowerBound(startedAt))
    ).filter((job) => job.status === "done" || job.status === "failed");

    activity.batch = {
      startedAt,
      settledTypes: settled.map((job) => job.type),
      failedTypes: settled.filter((job) => job.status === "failed").map((job) => job.type),
    };
  }

  if (sessionId !== undefined) {
    const sessionJobs = await database.getAllFromIndex(JOB_STORE, "sessionId", sessionId);
    const done = new Map<string, string>();
    const failed = new Map<string, string>();

    for (const job of sessionJobs) {
      if (job.status === "done") {
        done.set(getWorkKey(job), job.type);
      } else if (job.status === "failed") {
        failed.set(getWorkKey(job), job.type);
      }
    }

    for (const type of done.values()) {
      activity.sessionDoneByType[type] = (activity.sessionDoneByType[type] ?? 0) + 1;
    }

    activity.sessionFailedTypes = [...failed]
      .filter(([key]) => !done.has(key))
      .map(([, type]) => type);
  }

  return activity;
};
