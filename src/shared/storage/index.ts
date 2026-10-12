/**
 * The add-on's one local database: installed models, their files and a
 * content-free log of every inference run, and the research data — sessions,
 * their graphs, jobs and page snapshots — each store added by a migration step
 * rather than a second database.
 *
 * The background is the only writer, which is not merely a preference: it
 * avoids cross-context transaction races and keeps every surface a pure view.
 * Migrations are forward-only and run in one transaction, so a failure leaves
 * the previous version intact.
 *
 * The run log has no field for the text that was processed, so it cannot
 * accumulate page content even by mistake.
 */

export {
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
  INFERENCE_RUN_STORE,
  JOB_STORE,
  KEY_STORE,
  DATABASE_NAME,
  DATABASE_VERSION,
  MODEL_FILE_STORE,
  MODEL_STORE,
  NODE_STORE,
  SESSION_STORE,
  SNAPSHOT_STORE,
  SPACE_STORE,
  VECTOR_STORE,
} from "./constants";
export type {
  ConformanceStatus,
  StoredCluster,
  StoredClustering,
  EdgeKind,
  InferenceOutcome,
  JobStatus,
  NodeKind,
  NodeTabState,
  ResearchDatabaseSchema,
  SessionStatus,
  StoredDataKey,
  StoredEdge,
  StoredInferenceRun,
  StoredJob,
  StoredModel,
  StoredModelFile,
  StoredNode,
  StoredNodeSignals,
  StoredFocusSwitch,
  StoredLastPosition,
  StoredSavedTab,
  StoredFocusVisit,
  StoredSession,
  StoredSnapshot,
  StoredSpace,
  StoredChunk,
  StoredVector,
} from "./types";
export { openResearchDatabase } from "./openResearchDatabase";
export { readInferenceRuns } from "./readInferenceRuns";
export { recordInferenceRun } from "./recordInferenceRun";
