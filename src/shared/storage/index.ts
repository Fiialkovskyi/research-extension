/**
 * The add-on's local database: installed models, their files, and a
 * content-free log of every inference run.
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
  MODEL_DATABASE_NAME,
  MODEL_DATABASE_VERSION,
  MODEL_FILE_STORE,
  MODEL_STORE,
} from "./constants";
export type {
  ConformanceStatus,
  InferenceOutcome,
  ModelDatabaseSchema,
  StoredInferenceRun,
  StoredModel,
  StoredModelFile,
} from "./constants";
export { openModelDatabase } from "./openModelDatabase";
export { readInferenceRuns } from "./readInferenceRuns";
export { recordInferenceRun } from "./recordInferenceRun";
