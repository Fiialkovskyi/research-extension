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
  ACTIVITY_STORE,
  AI_SETUP_STORE,
  SETTINGS_STORE,
  PAGE_METADATA_STORE,
  CHUNK_STORE,
  CLUSTERING_STORE,
  EDGE_STORE,
  ENTITY_STORE,
  EXTRACTION_STORE,
  FACT_STORE,
  HEARTBEAT_STORE,
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
  SUMMARY_STORE,
  TABLE_COLUMNS_STORE,
  REJECTION_STORE,
  QUESTION_STORE,
  BLOCKED_SITES_STORE,
  VECTOR_STORE,
} from "./constants";
export type {
  ActivityKind,
  ConformanceStatus,
  StoredActivity,
  StoredAiSetup,
  StoredPageMetadata,
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
  StoredEntity,
  StoredExtraction,
  StoredFact,
  StoredFactProvenance,
  StoredHeartbeat,
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
  StoredSummary,
  StoredTableColumns,
  StoredRejection,
  StoredQuestions,
  StoredBlockedSites,
  StoredSpace,
  StoredChunk,
  StoredVector,
} from "./types";
export { openResearchDatabase } from "./openResearchDatabase";
export { readInferenceRuns } from "./readInferenceRuns";
export { recordInferenceRun } from "./recordInferenceRun";
