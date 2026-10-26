import type { StoredJob } from "@/shared/storage";

/** A job being worked on now. */
export interface RunningWork {
  type: string;
  /** When it was claimed. */
  startedAt: number;
}

/** A job waiting its turn, highest priority first. */
export interface QueuedWork {
  type: string;
  /** Whether the queue may hand it out now, as the caller judges it. */
  isPermitted: boolean;
}

/** The work that arrived together, from the first pending job until the queue empties. */
export interface JobBatch {
  /** When the earliest pending job entered the queue. */
  startedAt: number;
  /** The type of every job settled since then, done or failed for good. */
  settledTypes: string[];
  /** The type of every job in the batch that failed for good. */
  failedTypes: string[];
}

/** What the queue holds, as plain data a surface can word for itself. */
export interface JobActivity {
  running: RunningWork[];
  queued: QueuedWork[];
  /** Absent when nothing is pending. */
  batch?: JobBatch;
  /** Distinct work done for the session, by job type. Empty without a session. */
  sessionDoneByType: Record<string, number>;
  /** The type of each distinct piece of the session's work that failed for good and was not done since. */
  sessionFailedTypes: string[];
}

export interface ReadJobActivityOptions {
  now?: number;
  /** The session whose finished work is counted. */
  sessionId?: string;
  /** Whether a queued job may be claimed now; every job may by default. */
  isPermitted?: (job: StoredJob) => boolean;
}
