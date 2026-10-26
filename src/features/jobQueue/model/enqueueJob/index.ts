import type { IDBPDatabase } from "idb";

import { JOB_STORE, type ResearchDatabaseSchema, type StoredJob } from "@/shared/storage";

import type { NewJob } from "../../types";
import { buildJobId } from "../buildJobId";

/** A first-time job, due now. Its inputs are kept sorted, as they were hashed. */
const buildQueuedJob = (
  id: string,
  { priority = 0, notBefore, ...work }: NewJob,
  now: number,
): StoredJob => {
  return {
    ...work,
    id,
    inputHashes: work.inputHashes.toSorted(),
    status: "queued",
    priority,
    attempts: 0,
    nextAttemptAt: Math.max(now, notBefore ?? now),
    createdAt: now,
    queuedAt: now,
    updatedAt: now,
  };
};

/** A failed job asked for again: due now, attempts and failure cleared, checkpoint kept. */
const requeue = (
  { failureReason: _previousFailure, ...job }: StoredJob,
  now: number,
  notBefore = now,
): StoredJob => {
  return {
    ...job,
    status: "queued",
    attempts: 0,
    nextAttemptAt: Math.max(now, notBefore),
    queuedAt: now,
    updatedAt: now,
  };
};

/**
 * Queues work unless the same work is already queued, running or done.
 *
 * `notBefore` holds a new or requeued job back until then, to debounce work.
 *
 * A job that failed for good is queued again with its attempts reset: asking
 * for the work again is how a retry is requested. Its checkpoint is kept, so it
 * resumes rather than restarts.
 *
 * The id is hashed before the transaction opens; awaiting the hash inside it
 * would let IndexedDB commit the transaction with nothing written.
 */
export const enqueueJob = async (
  database: IDBPDatabase<ResearchDatabaseSchema>,
  job: NewJob,
): Promise<StoredJob> => {
  const id = await buildJobId(job);
  const now = Date.now();
  const transaction = database.transaction(JOB_STORE, "readwrite");
  const existing = await transaction.store.get(id);

  if (existing !== undefined && existing.status !== "failed") {
    await transaction.done;
    return existing;
  }

  const queued =
    existing === undefined ? buildQueuedJob(id, job, now) : requeue(existing, now, job.notBefore);

  await transaction.store.put(queued);
  await transaction.done;

  return queued;
};
