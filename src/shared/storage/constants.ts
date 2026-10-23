/**
 * The add-on's local database: what is stored, under which keys.
 *
 * The background is the only writer (the target spec's single-writer rule), so
 * every shape here is written in one place and read everywhere else.
 */

/** Database name. One database per add-on origin. */
export const DATABASE_NAME = "research-graph";

/**
 * Current schema version. Migrations are forward-only: raising this adds a step
 * rather than editing an existing one, so a profile that has already migrated
 * is never asked to migrate differently.
 */
export const DATABASE_VERSION = 22;

export const MODEL_STORE = "models";
export const MODEL_FILE_STORE = "modelFiles";
export const INFERENCE_RUN_STORE = "runs";
export const SESSION_STORE = "sessions";
export const NODE_STORE = "nodes";
export const EDGE_STORE = "edges";
export const JOB_STORE = "jobs";
export const SNAPSHOT_STORE = "snapshots";
export const KEY_STORE = "keys";
export const CLUSTERING_STORE = "clusterings";
export const SPACE_STORE = "spaces";
export const CHUNK_STORE = "chunks";
export const VECTOR_STORE = "vectors";
/** Diagnostics only: the background-lifetime probe's heartbeats. Content-free. */
export const HEARTBEAT_STORE = "heartbeats";
/** Facts extracted from deep-read pages; their text is encrypted. */
export const FACT_STORE = "facts";
/** One record per extracted snapshot: its progress and counts. */
export const EXTRACTION_STORE = "extractions";
/** The things a session's facts are about; their names are encrypted. */
export const ENTITY_STORE = "entities";
/** One summary per cluster; its statements are encrypted. */
export const SUMMARY_STORE = "summaries";
/** The columns a user chose for a comparison table, per session and type; encrypted. */
export const TABLE_COLUMNS_STORE = "tableColumns";
/** Facts the user marked wrong, by a hash of what they state. */
export const REJECTION_STORE = "rejections";
/** The open questions the model suggested for a session; encrypted. */
export const QUESTION_STORE = "questions";
/** The sites the user added to the capture denylist; one encrypted record. */
export const BLOCKED_SITES_STORE = "blockedSites";
/** When each page was read, copied from and pasted into: times and counts, never content. */
export const ACTIVITY_STORE = "activity";
/** Whether the user started setting AI up, and how the popup's setup banner is shown. One record. */
export const AI_SETUP_STORE = "aiSetup";

/**
 * How many runs the log keeps. Runs are written on every embedding job and
 * only ever read as recent history, so an unbounded log would be pure cost.
 */
export const MAXIMUM_INFERENCE_RUNS = 1000;
