/**
 * The add-on's one local database. Today it holds installed models, their
 * files, and a content-free log of every inference run; research data joins it
 * as further stores, each added by a migration step rather than a second
 * database.
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
  INFERENCE_RUN_STORE,
  DATABASE_NAME,
  DATABASE_VERSION,
  MODEL_FILE_STORE,
  MODEL_STORE,
  SESSION_STORE,
} from "./constants";
export type {
  ConformanceStatus,
  InferenceOutcome,
  ResearchDatabaseSchema,
  SessionStatus,
  StoredInferenceRun,
  StoredModel,
  StoredModelFile,
  StoredSession,
} from "./types";
export { openResearchDatabase } from "./openResearchDatabase";
export { readInferenceRuns } from "./readInferenceRuns";
export { recordInferenceRun } from "./recordInferenceRun";
