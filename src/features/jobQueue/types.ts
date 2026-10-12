/** The work a job does, which is also what identifies it. */
export interface JobIdentity {
  type: string;
  /** Content hashes of what the job reads. Their order does not matter. */
  inputHashes: string[];
  /** Version of the code or model producing the output. */
  producerVersion: string;
}

/** A job to enqueue. */
export interface NewJob extends JobIdentity {
  sessionId?: string;
  /** Higher runs first. Defaults to 0. */
  priority?: number;
  /** What the job works on beyond its identity, such as a record id; its type validates it. */
  payload?: unknown;
}
