import type { DBSchema } from "idb";

import type { InferenceDevice, ModelManifest } from "../modelManifest";
import type { INFERENCE_RUN_STORE, MODEL_FILE_STORE, MODEL_STORE } from "./constants";

/** Outcome of the family conformance suite, which gates activation. */
export type ConformanceStatus = "pending" | "passed" | "failed";

/** How an inference run ended. */
export type InferenceOutcome = "ok" | "failed" | "cancelled";

export interface StoredModel {
  /** Repository and pinned revision, so two revisions coexist rather than collide. */
  ref: string;
  manifest: ModelManifest;
  /**
   * Whether features may obtain this model. Deliberately not an index:
   * IndexedDB cannot key on a boolean, and a profile holds a handful of models,
   * so filtering in memory costs nothing an index would save.
   */
  active: boolean;
  conformance: ConformanceStatus;
  /** Why conformance failed, shown to the user instead of a bare refusal. */
  conformanceReason?: string;
  diskBytes: number;
  installedAt: number;
}

export interface StoredModelFile {
  ref: string;
  path: string;
  /** Verified contents. Written only after its digest matched the manifest. */
  contents: ArrayBuffer;
}

/**
 * One inference run, recorded for lineage and for honest throughput claims.
 *
 * Content-free by construction: there is no field for the text that was
 * embedded or generated, so the log cannot accumulate page content.
 */
export interface StoredInferenceRun {
  runId: string;
  modelRef: string;
  device: InferenceDevice;
  durationMs: number;
  outcome: InferenceOutcome;
  /** How many texts or chunks the run processed. A count, never the content. */
  itemCount: number;
  startedAt: number;
}

export interface ResearchDatabaseSchema extends DBSchema {
  [MODEL_STORE]: {
    key: string;
    value: StoredModel;
    indexes: { family: string };
  };
  [MODEL_FILE_STORE]: {
    key: [string, string];
    value: StoredModelFile;
    indexes: { ref: string };
  };
  [INFERENCE_RUN_STORE]: {
    key: string;
    value: StoredInferenceRun;
    indexes: { modelRef: string; startedAt: number };
  };
}
