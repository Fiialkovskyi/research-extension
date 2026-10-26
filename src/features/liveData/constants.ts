/** The kinds of data a page can be told have changed. */
export const DATA_TOPICS = [
  "pages",
  "snapshots",
  "facts",
  "clusters",
  "summaries",
  "questions",
  "models",
  "access",
  /** Which session the popup, and the pages that follow it, refer to. */
  "viewed",
  /** The job queue: what the local AI is doing, waiting for or has done. */
  "jobs",
] as const;
