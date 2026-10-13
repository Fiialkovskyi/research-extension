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
export const DATABASE_VERSION = 15;

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

/**
 * How many runs the log keeps. Runs are written on every embedding job and
 * only ever read as recent history, so an unbounded log would be pure cost.
 */
export const MAXIMUM_INFERENCE_RUNS = 1000;
